import Foundation

@main struct IntegrationTests {
    static func main() throws {
        func waitUntil(_ condition: () -> Bool) {
            let deadline = Date().addingTimeInterval(4)
            while !condition() && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.01)) }
            precondition(condition(), "Async operation timed out")
        }
        let folder = URL(fileURLWithPath: CommandLine.arguments[1]).appendingPathComponent("native-edit-tests")
        let dataFolder = folder.appendingPathComponent("S2A Pilot")
        try FileManager.default.createDirectory(at: dataFolder, withIntermediateDirectories: true)
        let indexURL = dataFolder.appendingPathComponent("index-workspace.json")
        let cue = ShowCueProject.Cue(index:7,time:12.5,type:nil,name:"Repère",description:"Avant",isBase:nil,imagePath:nil,mediaActions:nil)
        let show = SavedShowCue(groupID:"group",mediaID:"audio",audioID:"audio",title:"Titre initial",cues:[cue],imagePaths:[:],importedAt:Date(),showDuration:60,clockID:"clock")
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(SavedShowCueIndex(shows:[show])).write(to:indexURL)
        let lock = NSLock()
        var nativeName = "Titre initial"
        var writeScripts: [String] = []
        var forceConflict = false
        var nextReadGate: DispatchSemaphore?
        func reply() -> String {
            let f = ["R", "group", nativeName, "Group", "true", "false", "15", "60", "Notes", "", "2", nativeName].joined(separator:"\u{1f}")
            return "S2A_RUNTIME_V3\u{1e}group\u{1e}group\u{1e}" + f + "\u{1e}"
        }
        let model = AppModel { executable, arguments, stdin, _ in
            precondition(executable == "/usr/bin/osascript")
            lock.lock()
            if let script = stdin {
                writeScripts.append(script)
                let conflict = forceConflict
                if !conflict { nativeName = "Titre modifié" }
                lock.unlock()
                if conflict { throw NSError(domain:"fake-QLab",code:1,userInfo:[NSLocalizedDescriptionKey:"BRIDGE_EDIT_CONFLICT"]) }
                return "S2A_EDIT_OK"
            }
            let output = reply(), gate = nextReadGate
            nextReadGate = nil
            lock.unlock()
            gate?.wait()
            return output
        }
        model.workspace = WorkspaceInfo(id:"workspace",name:"Spectacle",workspacePath:folder.appendingPathComponent("spectacle.qlab5").path)
        model.savedShows = [show]; model.activeShow = show
        lock.lock(); let initial = reply(); lock.unlock()
        model.runtimeSnapshot = try BridgeRuntimeSnapshot.parse(initial)
        model.currentRuntimeID = "group"
        func request(_ id:String,_ kind:BridgeEditRequest.Kind,_ name:String,_ notes:String,expectedName:String,expectedNotes:String) -> BridgeEditRequest {
            BridgeEditRequest(requestID:id,workspaceID:"workspace",kind:kind,cueID:kind == .pilot ? "7" : "group",groupID:"group",name:name,description:notes,expectedName:expectedName,expectedDescription:expectedNotes)
        }
        model.editBridgeCue(request("pilot",.pilot,"Nouveau repère","Après\nligne 2",expectedName:"Repère",expectedNotes:"Avant"))
        waitUntil { model.bridgeEditReply?.requestID == "pilot" }
        precondition(model.bridgeEditReply?.success == true)
        precondition(model.activeShow?.cues[0].description == "Après\nligne 2")
        RunLoop.main.run(until:Date().addingTimeInterval(0.2))
        precondition(model.activeShow?.cues[0].name == "Nouveau repère") // old poll snapshot must not regress metadata
        lock.lock(); precondition(writeScripts.isEmpty); lock.unlock() // Pilot marker does not create or edit a QLab cue
        model.editBridgeCue(request("root",.qlab,"Titre modifié","Notes",expectedName:"Titre initial",expectedNotes:"Notes"))
        waitUntil { model.bridgeEditReply?.requestID == "root" }
        precondition(model.bridgeEditReply?.success == true)
        waitUntil { model.runtimeSnapshot?.roots.first?.qName == "Titre modifié" }
        lock.lock(); precondition(writeScripts.count == 1); forceConflict = true; lock.unlock()
        model.editBridgeCue(request("conflict",.qlab,"Autre titre","Notes",expectedName:"Titre modifié",expectedNotes:"Notes"))
        waitUntil { model.bridgeEditReply?.requestID == "conflict" }
        precondition(model.bridgeEditReply?.success == false)
        precondition(model.runtimeSnapshot?.roots.first?.qName == "Titre modifié")
        // Hold an old read in flight, queue an edit, then switch workspace before the write starts.
        let originalData = try Data(contentsOf:indexURL)
        let gate = DispatchSemaphore(value:0)
        lock.lock(); nextReadGate = gate; lock.unlock()
        model.startVisualMonitor()
        model.editBridgeCue(request("stale",.pilot,"À ne pas écrire","Mauvais workspace",expectedName:"Nouveau repère",expectedNotes:"Après\nligne 2"))
        model.workspace = WorkspaceInfo(id:"other",name:"Other",workspacePath:folder.appendingPathComponent("other.qlab5").path)
        model.stopVisualMonitor(); gate.signal()
        waitUntil { !model.bridgeEditInFlight }
        let unchanged = try Data(contentsOf:indexURL)
        precondition(unchanged == originalData)
        // Every native write is explicitly an edit, with no transport or selection command.
        lock.lock(); let scripts = writeScripts; lock.unlock()
        for script in scripts {
            precondition(script.contains("cue id \"group\" of w"))
            precondition(!script.contains("set selected") && !script.contains("playback position"))
        }
        print("PASS AppModel editing: real disk save, live metadata, acknowledged QLab rename, external conflict, stale workspace cancellation and no Pilot-to-QLab or transport writes")
    }
}
