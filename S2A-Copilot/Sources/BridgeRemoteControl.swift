import Foundation

enum BridgeRemoteAction: String, Decodable {
    case go, play, next, previous, select
}

struct BridgeRemoteRequest: Decodable {
    let id: String
    let action: BridgeRemoteAction
    let cueID: String
    let age: Double
    enum CodingKeys: String, CodingKey { case id, action, age; case cueID = "cue_id" }
}

// One gate per Bridge share: never execute an ID twice, including after an uncertain result.
struct BridgeRemoteGate {
    private var handled = Set<String>()
    private var order: [String] = []
    private var lastGO = -Double.infinity

    mutating func accept(_ request: BridgeRemoteRequest, now: Double) -> String? {
        guard request.id.range(of: "^[a-f0-9]{32}$", options: .regularExpression) != nil,
              !handled.contains(request.id) else { return "rejected" }
        handled.insert(request.id); order.append(request.id)
        if order.count > 256 { handled.remove(order.removeFirst()) }
        if request.action == .go {
            guard now - lastGO >= 0.5 else { return "guarded" }
            lastGO = now
        }
        return nil
    }
}

enum BridgeRemoteScript {
    enum InvalidRequest: Error { case identifier, target, noActiveCue }

    static func quotedID(_ id: String) throws -> String {
        guard id.range(of: "^[A-Za-z0-9_.:-]{1,80}$", options: .regularExpression) != nil else {
            throw InvalidRequest.identifier
        }
        return "\"" + id + "\""
    }

    static func make(action: BridgeRemoteAction, workspace: String, expectedPlayhead: String,
                     active: String, target: String = "", pause: Bool = false) throws -> String {
        let workspaceID = try quotedID(workspace)
        let expected = expectedPlayhead.isEmpty ? "\"\"" : try quotedID(expectedPlayhead)
        let operation: String
        switch action {
        case .go:
            // QLab does not apply its double-GO guard to AppleScript. The native gate does.
            guard !expectedPlayhead.isEmpty else { throw InvalidRequest.target }
            operation = "go w"
        case .play:
            guard !active.isEmpty else { throw InvalidRequest.noActiveCue }
            let activeID = try quotedID(active)
            operation = """
            set activeCue to cue id \(activeID) of w
            if \(pause ? "running of activeCue is false or paused of activeCue is true" : "paused of activeCue is false") then error "BRIDGE_REMOTE_STALE"
            \(pause ? "pause w" : "start w")
            """
        case .next, .previous, .select:
            let targetID = try quotedID(target)
            operation = """
            set rootIDs to uniqueID of cues of targetList
            if rootIDs does not contain \(targetID) then error "BRIDGE_REMOTE_TARGET"
            set targetCue to cue id \(targetID) of w
            set playback position of targetList to targetCue
            set selected of w to {targetCue}
            """
        }
        return """
        if application id "com.figure53.QLab.5" is not running then error "QLAB_NOT_RUNNING"
        tell application id "com.figure53.QLab.5"
            set matches to workspaces whose unique id is \(workspaceID)
            if (count of matches) is not 1 then error "WORKSPACE_UNAVAILABLE"
            set w to first item of matches
            set targetList to current cue list of w
            set actualPlayhead to ""
            try
                set actualPlayhead to uniqueID of playback position of targetList as text
            end try
            if actualPlayhead is not \(expected) then error "BRIDGE_REMOTE_STALE"
            \(operation)
            return "S2A_REMOTE_OK"
        end tell
        """
    }
}
