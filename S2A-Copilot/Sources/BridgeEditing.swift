import Foundation

struct BridgeEditRequest: Decodable {
    enum Kind: String, Decodable { case qlab, pilot }
    let requestID: String
    let workspaceID: String
    let kind: Kind
    let cueID: String
    let groupID: String?
    let name: String
    let description: String
    let expectedName: String
    let expectedDescription: String
}

struct BridgeEditReply {
    let requestID: String
    let success: Bool
    let message: String
    var json: [String: Any] { ["requestID": requestID, "success": success, "message": message] }
}

enum BridgeEditing {
    enum EditError: Error, Equatable { case missingCue, conflict, invalidText, workspaceChanged }

    // Keep line endings and quotes intact; editable notes are never interpolated as code.
    static func literal(_ value: String) -> String {
        func quoted(_ part: String) -> String {
            "\"" + part.replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"") + "\""
        }
        return value.components(separatedBy: "\n").map { line in
            line.components(separatedBy: "\r").map(quoted).joined(separator: " & (ASCII character 13) & ")
        }.joined(separator: " & linefeed & ")
    }

    static func validate(_ edit: BridgeEditRequest) throws {
        guard !edit.requestID.isEmpty, !edit.workspaceID.isEmpty, !edit.cueID.isEmpty,
              ![edit.name, edit.description, edit.expectedName, edit.expectedDescription].contains(where: { $0.contains("\0") }) else {
            throw EditError.invalidText
        }
        if edit.kind == .pilot {
            guard edit.groupID?.isEmpty == false, Int(edit.cueID) != nil else { throw EditError.missingCue }
        }
    }

    static func script(_ edit: BridgeEditRequest) throws -> String {
        try validate(edit)
        guard edit.kind == .qlab else { throw EditError.missingCue }
        return """
        if application id "com.figure53.QLab.5" is not running then error "BRIDGE_EDIT_UNAVAILABLE"
        tell application id "com.figure53.QLab.5"
            set matches to (workspaces whose unique id is \(literal(edit.workspaceID)))
            if (count of matches) is not 1 then error "BRIDGE_EDIT_UNAVAILABLE"
            set w to first item of matches
            if not (exists (cue id \(literal(edit.cueID)) of w)) then error "BRIDGE_EDIT_MISSING"
            set targetCue to cue id \(literal(edit.cueID)) of w
            set oldName to q name of targetCue as text
            set oldNotes to notes of targetCue as text
            considering case, diacriticals
                if oldName is not (\(literal(edit.expectedName))) or oldNotes is not (\(literal(edit.expectedDescription))) then error "BRIDGE_EDIT_CONFLICT"
            end considering
            try
                set q name of targetCue to (\(literal(edit.name)))
                set notes of targetCue to (\(literal(edit.description)))
            on error errorMessage number errorNumber
                -- Restore our name write if notes failed, without reverting another writer's name.
                try
                    considering case, diacriticals
                        if (q name of targetCue as text) is (\(literal(edit.name))) then set q name of targetCue to oldName
                    end considering
                end try
                error errorMessage number errorNumber
            end try
            return "S2A_EDIT_OK"
        end tell
        """
    }

    static func applying(_ edit: BridgeEditRequest, to index: SavedShowCueIndex) throws -> SavedShowCueIndex {
        try validate(edit)
        guard edit.kind == .pilot,
              let showIndex = index.shows.firstIndex(where: { $0.groupID == edit.groupID }),
              let cueIndex = index.shows[showIndex].cues.firstIndex(where: { String($0.index) == edit.cueID }) else {
            throw EditError.missingCue
        }
        let cue = index.shows[showIndex].cues[cueIndex]
        guard cue.name == edit.expectedName, (cue.description ?? "") == edit.expectedDescription else {
            throw EditError.conflict
        }
        var updated = index
        updated.shows[showIndex].cues[cueIndex].name = edit.name
        updated.shows[showIndex].cues[cueIndex].description = edit.description
        return updated
    }

    static func savePilot(_ edit: BridgeEditRequest, currentURL: URL, legacyURL: URL) throws -> SavedShowCueIndex {
        let source = FileManager.default.fileExists(atPath: currentURL.path) ? currentURL : legacyURL
        guard FileManager.default.fileExists(atPath: source.path) else { throw EditError.missingCue }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let index = try decoder.decode(SavedShowCueIndex.self, from: Data(contentsOf: source))
        let updated = try applying(edit, to: index)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(updated).write(to: currentURL, options: .atomic)
        return updated
    }
}
