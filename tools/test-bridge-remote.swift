import Foundation

@main struct RemoteTests {
    static func main() throws {
        func request(_ id: String, _ action: BridgeRemoteAction, cue: String = "") -> BridgeRemoteRequest {
            BridgeRemoteRequest(id:String(repeating:id,count:32),action:action,cueID:cue,age:0)
        }
        var gate = BridgeRemoteGate()
        precondition(gate.accept(request("a",.go),now:10) == nil)
        precondition(gate.accept(request("a",.go),now:11) == "rejected")
        precondition(gate.accept(request("b",.go),now:10.2) == "guarded")
        precondition(gate.accept(request("b",.go),now:11) == "rejected")
        precondition(gate.accept(request("c",.go),now:10.5) == nil)
        precondition(gate.accept(request("d",.select,cue:"cue-id"),now:10.6) == nil)
        precondition(gate.accept(request("z",.go),now:12) == "rejected")
        for action in [BridgeRemoteAction.go,.play,.next,.previous,.select] {
            let script = try BridgeRemoteScript.make(action:action,workspace:"workspace-id",expectedPlayhead:"cue-id",active:"active-id",target:"next-id",pause:true)
            precondition(script.contains("whose unique id is \"workspace-id\""))
            precondition(script.contains("BRIDGE_REMOTE_STALE"))
            precondition(!script.contains("front workspace"))
            precondition(script.contains("S2A_REMOTE_OK"))
            if action == .select { precondition(script.contains("set playback position of targetList to targetCue")) }
            if CommandLine.arguments.count > 1 {
                let root = URL(fileURLWithPath:CommandLine.arguments[1])
                try script.write(to:root.appendingPathComponent("remote-"+action.rawValue+".applescript"),atomically:true,encoding:.utf8)
            }
        }
        let resume = try BridgeRemoteScript.make(action:.play,workspace:"workspace",expectedPlayhead:"cue",active:"active",pause:false)
        precondition(resume.contains("start w") && !resume.contains("resume w"))
        for invalid in ["", "workspace\"", "workspace\n", "$(bad)", String(repeating:"x",count:81)] {
            do { _ = try BridgeRemoteScript.quotedID(invalid); preconditionFailure("Invalid identifier accepted") }
            catch BridgeRemoteScript.InvalidRequest.identifier {}
        }
        do { _ = try BridgeRemoteScript.make(action:.go,workspace:"workspace",expectedPlayhead:"",active:""); preconditionFailure("GO without playhead accepted") }
        catch BridgeRemoteScript.InvalidRequest.target {}
        do { _ = try BridgeRemoteScript.make(action:.play,workspace:"workspace",expectedPlayhead:"cue",active:""); preconditionFailure("Play must not launch a fresh cue") }
        catch BridgeRemoteScript.InvalidRequest.noActiveCue {}
        print("PASS remote: duplicate IDs, shared 500ms GO guard, fixed workspace, playhead race checks, root selection and identifier rejection")
    }
}
