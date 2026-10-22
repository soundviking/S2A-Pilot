import Foundation

struct BridgeRuntimeCue: Identifiable, Equatable {
    let id: String
    let name: String
    let kind: String
    let running: Bool
    let paused: Bool
    let elapsed: Double
    let duration: Double
    let notes: String
    let number: String
    let qName: String
    var active: Bool { running || paused }
}

struct BridgeRuntimeSnapshot {
    let standbyID: String
    let selectedID: String
    let roots: [BridgeRuntimeCue]
    let clocks: [String: BridgeRuntimeCue]

    enum ReadError: Error { case unavailable, invalidReply }

    static func decodeField(_ field: String) -> String {
        field.replacingOccurrences(of: "%1E", with: "\u{1e}")
            .replacingOccurrences(of: "%1F", with: "\u{1f}")
            .replacingOccurrences(of: "%25", with: "%")
    }

    static func parse(_ output: String) throws -> Self {
        let records = output.trimmingCharacters(in:.newlines).components(separatedBy:"\u{1e}")
        guard records.first == "S2A_RUNTIME_V3", records.count >= 4, records.last == "" else { throw ReadError.invalidReply }
        let standby = records[1]
        let selected = records[2]
        var roots: [BridgeRuntimeCue] = [], clocks: [String:BridgeRuntimeCue] = [:]
        for record in records.dropFirst(3).dropLast() where !record.isEmpty {
            let f = record.components(separatedBy:"\u{1f}")
            guard f.count == 12, ["R","C"].contains(f[0]), !f[1].isEmpty,
                  let running = Bool(f[4].lowercased()), let paused = Bool(f[5].lowercased()),
                  let elapsed = Double(f[6].replacingOccurrences(of:",",with:".")), elapsed.isFinite,
                  let duration = Double(f[7].replacingOccurrences(of:",",with:".")), duration.isFinite else { throw ReadError.invalidReply }
            let cue = BridgeRuntimeCue(id:f[1],name:decodeField(f[2]),kind:decodeField(f[3]),running:running,paused:paused,elapsed:max(0,elapsed),duration:max(0,duration),notes:decodeField(f[8]),number:decodeField(f[10]),qName:decodeField(f[11]))
            if f[0] == "R" { roots.append(cue) } else { clocks[f[9]] = cue }
        }
        return Self(standbyID:standby,selectedID:selected,roots:roots,clocks:clocks)
    }

    // Keep the followed active/paused item stable. The standby cursor is not playback.
    func current(previousID: String?) -> BridgeRuntimeCue? {
        if let previousID, let current = roots.first(where:{$0.id == previousID && $0.active}) { return current }
        return roots.first(where:{$0.running && !$0.paused}) ?? roots.first(where:{$0.paused})
    }

    static func script(workspaceID: String, shows: [SavedShowCue]) -> String {
        func quote(_ s:String) -> String { "\""+s.replacingOccurrences(of:"\\",with:"\\\\").replacingOccurrences(of:"\"",with:"\\\"")+"\"" }
        let clocks = shows.map { show in
            let id = show.clockID ?? show.mediaID ?? show.audioID ?? show.groupID
            return """
            set resultText to resultText & my snapshotCue(cue id \(quote(id)) of w, "C", \(quote(show.groupID)))
            """
        }.joined(separator:"\n")
        return """
        if application id "com.figure53.QLab.5" is not running then error "QLAB_NOT_RUNNING"
        tell application id "com.figure53.QLab.5"
            set matches to (workspaces whose unique id is \(quote(workspaceID)))
            if (count of matches) is not 1 then error "WORKSPACE_UNAVAILABLE"
            set w to first item of matches
            set standby to ""
            try
                set standby to uniqueID of playback position of current cue list of w as text
            end try
            set selectionID to ""
            set selectedCues to selected of w
            if (count of selectedCues) > 0 then set selectionID to uniqueID of (first item of selectedCues) as text
            if selectionID is "" then set selectionID to standby
            set resultText to "S2A_RUNTIME_V3" & (ASCII character 30) & standby & (ASCII character 30) & selectionID & (ASCII character 30)
            set rootIDs to uniqueID of cues of current cue list of w
            repeat with rootID in rootIDs
                set resultText to resultText & my snapshotCue(cue id (contents of rootID) of w, "R", "")
            end repeat
            \(clocks)
            return resultText
        end tell
        on snapshotCue(c, category, groupID)
            tell application id "com.figure53.QLab.5"
                set sep to ASCII character 31
                set cueID to uniqueID of c as text
                set cueName to my cleanText(q display name of c)
                set cueKind to my cleanText(q type of c)
                set cueRunning to running of c as text
                set cuePaused to paused of c as text
                set cueElapsed to action elapsed of c as text
                set cueDuration to current duration of c as text
                set cueNotes to my cleanText(notes of c)
                set cueNumber to my cleanText(q number of c)
                set cueRawName to my cleanText(q name of c)
                return category & sep & cueID & sep & cueName & sep & cueKind & sep & cueRunning & sep & cuePaused & sep & cueElapsed & sep & cueDuration & sep & cueNotes & sep & groupID & sep & cueNumber & sep & cueRawName & (ASCII character 30)
            end tell
        end snapshotCue
        on cleanText(value)
            set value to value as text
            repeat with pair in {{"%", "%25"}, {ASCII character 30, "%1E"}, {ASCII character 31, "%1F"}}
                set AppleScript's text item delimiters to item 1 of pair
                set parts to text items of value
                set AppleScript's text item delimiters to item 2 of pair
                set value to parts as text
            end repeat
            set AppleScript's text item delimiters to ""
            return value
        end cleanText
        """
    }

    static func quoted(_ value: String) -> String {
        "\"" + value.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ") + "\""
    }

    static func selectionScript(workspace: String, cue: String) -> String {
        """
        tell application id "com.figure53.QLab.5"
            set w to first workspace whose unique id is \(quoted(workspace))
            set targetCue to cue id \(quoted(cue)) of w
            set selected of w to {targetCue}
        end tell
        """
    }

}
