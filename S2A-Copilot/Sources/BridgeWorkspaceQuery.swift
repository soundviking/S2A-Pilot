import Foundation

struct WorkspaceInfo: Identifiable, Equatable {
    let id: String
    let name: String
    let workspacePath: String

    var projectFolder: URL? {
        guard !workspacePath.isEmpty else { return nil }
        return URL(fileURLWithPath: workspacePath).deletingLastPathComponent()
    }
}

enum BridgeWorkspaceQuery {
    enum QueryError: Error { case invalidReply, workspaceClosed }
    private static let header = "S2A_WORKSPACES_V1\u{1e}"
    private static let notRunning = "S2A_QLAB_NOT_RUNNING"

    private static func literal(_ text: String) -> String {
        "\"" + text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"") + "\""
    }

    static func script(id: String? = nil) -> String {
        // Test and query the same application in the same Apple event request.
        // A separate NSRunningApplication snapshot must not decide that a workspace closed.
        let requestedIDs = id.map { "{\(literal($0))}" } ?? "(get unique id of workspaces)"
        return """
        if application id "com.figure53.QLab.5" is not running then return "\(notRunning)"
        tell application id "com.figure53.QLab.5"
            set resultText to "S2A_WORKSPACES_V1" & (ASCII character 30)
            set requestedIDs to \(requestedIDs)
            repeat with candidateID in requestedIDs
                set wid to (contents of candidateID) as text
                set matches to (workspaces whose unique id is wid)
                if (count of matches) is 1 then
                set w to first item of matches
                set wname to (get name of w) as text
                set wpath to ""
                try
                    set rawPath to get path of w
                    if rawPath is not missing value and rawPath is not "" then
                        try
                            set wpath to POSIX path of (rawPath as alias)
                        on error
                            set wpath to rawPath as text
                        end try
                    end if
                end try
                set resultText to resultText & wid & (ASCII character 31) & wname & (ASCII character 31) & wpath & (ASCII character 30)
                end if
            end repeat
            return resultText
        end tell
        """
    }

    static func parse(_ output: String) throws -> [WorkspaceInfo] {
        let reply = output.trimmingCharacters(in: .newlines)
        if reply == notRunning { return [] }
        guard reply.hasPrefix(header), reply.hasSuffix("\u{1e}") else { throw QueryError.invalidReply }
        let body = String(reply.dropFirst(header.count))
        if body.isEmpty { return [] }
        var result: [WorkspaceInfo] = []
        for record in body.dropLast().components(separatedBy: "\u{1e}") {
            let parts = record.components(separatedBy: "\u{1f}")
            guard parts.count == 3, !parts[0].isEmpty,
                  !result.contains(where: { $0.id == parts[0] }) else { throw QueryError.invalidReply }
            result.append(WorkspaceInfo(id: parts[0], name: parts[1], workspacePath: parts[2]))
        }
        return result
    }

    static func resolve(id: String, query: (String) throws -> [WorkspaceInfo]) throws -> WorkspaceInfo {
        // Recheck one empty snapshot before reporting a closure. Errors remain errors;
        // they must never be converted into an empty list or another selected workspace.
        for _ in 0..<2 {
            if let workspace = try query(id).first(where: { $0.id == id }) { return workspace }
        }
        throw QueryError.workspaceClosed
    }
}
