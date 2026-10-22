import Foundation

@main struct EditingTests {
    static func main() throws {
        func check(_ condition: @autoclosure () throws -> Bool) rethrows {
            let valid = try condition()
            precondition(valid)
        }
        let folder = URL(fileURLWithPath: CommandLine.arguments[1])
        let legacy = folder.appendingPathComponent("index.json")
        let current = folder.appendingPathComponent("index-workspace.json")
        let original = """
        {"version":1,"shows":[{"groupID":"group","mediaID":"media","audioID":"audio","title":"Original show","cues":[{"index":7,"time":12.5,"type":"cue","name":"Cue identique","description":"  Consigne originale\\nligne 2  ","imagePath":"images/7.png","mediaActions":[{"id":"audio-1","kind":"audio","inPoint":1.5,"outPoint":6,"path":"audio/test.wav","loop":false}]},{"index":8,"time":23,"name":"Cue identique"}],"imagePaths":{"7":"images/7.png"},"importedAt":"2026-10-22T10:00:00Z","showDuration":90,"clockID":"clock"},{"groupID":"other","title":"Other show","cues":[],"imagePaths":{},"importedAt":"2026-10-22T10:00:00Z"}]}
        """
        try Data(original.utf8).write(to: legacy)
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
        let baseline = try decoder.decode(SavedShowCueIndex.self, from: Data(contentsOf: legacy))
        func edit(_ name: String = "Été \\\"音\\\" <>&", _ description: String = "Nouvelle consigne\nDeuxième ligne\r\nFin", expectedName: String = "Cue identique", expectedDescription: String = "  Consigne originale\nligne 2  ", cueID: String = "7", groupID: String = "group", kind: BridgeEditRequest.Kind = .pilot) -> BridgeEditRequest {
            BridgeEditRequest(requestID:"request-1",workspaceID:"workspace",kind:kind,cueID:cueID,groupID:groupID,name:name,description:description,expectedName:expectedName,expectedDescription:expectedDescription)
        }
        let request = edit()
        let result = try BridgeEditing.savePilot(request, currentURL:current, legacyURL:legacy)
        let reopened = try decoder.decode(SavedShowCueIndex.self, from: Data(contentsOf: current))
        precondition(reopened.shows[0].cues[0].name == request.name)
        precondition(reopened.shows[0].cues[0].description == request.description)
        // Restore only the two edited fields; the entire record must then match the original.
        var restored = result
        restored.shows[0].cues[0].name = baseline.shows[0].cues[0].name
        restored.shows[0].cues[0].description = baseline.shows[0].cues[0].description
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]; encoder.dateEncodingStrategy = .iso8601
        try check(encoder.encode(restored) == encoder.encode(baseline))
        try check(Data(contentsOf:legacy) == Data(original.utf8))
        let saved = try Data(contentsOf:current)
        do { _ = try BridgeEditing.savePilot(request,currentURL:current,legacyURL:legacy); fatalError("Must not overwrite a concurrent edit") }
        catch BridgeEditing.EditError.conflict {}
        try check(Data(contentsOf:current) == saved)
        for bad in [edit(cueID:"999"), edit(groupID:"missing")] {
            do { _ = try BridgeEditing.applying(bad,to:baseline); fatalError("Missing target must fail") }
            catch BridgeEditing.EditError.missingCue {}
        }
        let cleared = try BridgeEditing.applying(edit("",""),to:baseline)
        precondition(cleared.shows[0].cues[0].name.isEmpty && cleared.shows[0].cues[0].description == "")
        do { try BridgeEditing.validate(edit("nul\0")); fatalError("NUL must fail") }
        catch BridgeEditing.EditError.invalidText {}
        // A failed write must leave the existing source untouched.
        let impossible = folder.appendingPathComponent("missing-parent/index.json")
        do { _ = try BridgeEditing.savePilot(edit(),currentURL:impossible,legacyURL:legacy); fatalError("Write should fail") } catch {}
        try check(Data(contentsOf:legacy) == Data(original.utf8))
        // Compile the production command with deliberately awkward user text.
        let qlab = edit("Nom \\\"été\\\" \\ 音", "Ligne 1\nLigne 2\rFin", kind:.qlab)
        let script = try BridgeEditing.script(qlab)
        precondition(script.contains("BRIDGE_EDIT_CONFLICT"))
        precondition(!script.contains("set selected") && !script.contains("playback position"))
        try script.write(to:folder.appendingPathComponent("editing.applescript"),atomically:true,encoding:.utf8)
        // Evaluate just the literal expression in AppleScript; no application is addressed.
        let literalText = qlab.name + "\n" + qlab.description + " 音 %25 <>&"
        try ("return (" + BridgeEditing.literal(literalText) + ")").write(to:folder.appendingPathComponent("literal.applescript"),atomically:true,encoding:.utf8)
        try Data((literalText+"\n").utf8).write(to:folder.appendingPathComponent("literal.expected"))
        print("PASS Bridge editing: ID identity, duplicate names, multiline/Unicode, atomic persistence, reopen, legacy index, missing/conflicting targets, empty text, write failure and unchanged timing/media/clock")
    }
}
