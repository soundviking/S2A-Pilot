import Foundation
@main struct RuntimeTests {
 static func main() throws {
  func row(_ category:String,_ id:String,_ time:String,_ running:Bool,_ paused:Bool,_ group:String="") -> String { [category,id,"Nom <>&", "Group",String(running),String(paused),time,"200,1","Consigne\nmultiligne",group,"1.20","Nom brut"].joined(separator:"\u{1f}")+"\u{1e}" }
  let source="S2A_RUNTIME_V3\u{1e}next\u{1e}selected\u{1e}"+row("R","show","65,25",true,false)+row("R","other","1,0",true,false)+row("C","clock","65,25",true,false,"show")
  let snapshot=try BridgeRuntimeSnapshot.parse(source)
  precondition(snapshot.roots.count==2 && snapshot.standbyID=="next" && snapshot.selectedID=="selected" && snapshot.roots[0].number=="1.20")
  precondition(snapshot.clocks["show"]?.elapsed==65.25)
  precondition(snapshot.current(previousID:"show")?.id=="show")
  precondition(snapshot.roots[0].notes=="Consigne\nmultiligne")
  let paused=try BridgeRuntimeSnapshot.parse("S2A_RUNTIME_V3\u{1e}next\u{1e}selected\u{1e}"+row("R","show","65,25",false,true))
  precondition(paused.current(previousID:"show")?.paused==true)
  let backwards=try BridgeRuntimeSnapshot.parse("S2A_RUNTIME_V3\u{1e}next\u{1e}selected\u{1e}"+row("R","show","20,0",true,false))
  precondition(backwards.current(previousID:"show")?.elapsed==20)
  for broken in ["",source.replacingOccurrences(of:"65,25",with:"invalid"),String(source.dropLast()),source.replacingOccurrences(of:"65,25",with:"nan")] {
   do { _=try BridgeRuntimeSnapshot.parse(broken);fatalError("Invalid time must not silently become zero") } catch BridgeRuntimeSnapshot.ReadError.invalidReply {}
  }
  precondition(BridgeRuntimeSnapshot.decodeField("%251E%1E%1F") == "%1E\u{1e}\u{1f}")
  precondition(snapshot.roots[0].qName == "Nom brut")
  let old=Data("{\"groupID\":\"old\",\"title\":\"Ancienne conduite\",\"cues\":[],\"imagePaths\":{},\"importedAt\":0}".utf8)
  let record=try JSONDecoder().decode(SavedShowCue.self,from:old)
  precondition(record.clockID==nil)
  let query=BridgeRuntimeSnapshot.script(workspaceID:"test",shows:[record])
  precondition(query.contains("cue id \"old\" of w"))
  precondition(!query.contains("set cueList to"))
  if CommandLine.arguments.count > 1 {
   let root = URL(fileURLWithPath: CommandLine.arguments[1])
   try query.write(to:root.appendingPathComponent("runtime.applescript"),atomically:true,encoding:.utf8)
   try BridgeRuntimeSnapshot.selectionScript(workspace:"workspace",cue:"selected").write(to:root.appendingPathComponent("selection.applescript"),atomically:true,encoding:.utf8)
  }
  print("PASS Bridge runtime: decimal locale, active/paused identity, backward seeks, strict failure, notes and legacy index compatibility")
 }
}
