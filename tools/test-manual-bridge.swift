import Foundation
@main struct ManualBridgeTests {
 static func main() throws {
  let root=URL(fileURLWithPath:CommandLine.arguments[1])
  let json="""
  {"format":"showcue-multimedia-package","version":5,"title":"Legacy","cues":[{"id":"m1","index":1,"time":0,"name":"Intro","mediaActions":[{"id":"a1","kind":"audio","path":"music.wav","duration":12}]},{"id":"t1","parentMusicId":"m1","relativeTime":3,"index":2,"time":3,"name":"Blue","description":"Lumière","imagePath":"visual.png"},{"id":"m2","index":3,"time":20,"name":"Final","mediaActions":[{"id":"a2","kind":"audio","path":"music.wav","duration":8}]},{"id":"t2","parentMusicId":"m2","relativeTime":2,"index":4,"time":22,"name":"Noir"}]}
  """
  var project=try JSONDecoder().decode(ShowCueProject.self,from:Data(json.utf8))
  let legacySegments=try project.importSegments();precondition(!project.isManual && legacySegments.count==1)
  project.conductType="manual"
  let segments=try project.importSegments()
  precondition(segments.count==2 && segments[0].cues[1].time==3 && segments[1].cues[1].time==2)
  precondition(segments[1].cues[0].index==3 && segments[0].cues[1].description=="Lumière" && segments[0].cues[1].imagePath=="visual.png")
  try Data([0]).write(to:root.appendingPathComponent("music.wav"));try Data([0]).write(to:root.appendingPathComponent("visual.png"))
  var scripts:[String]=[]
  let model=AppModel { _,args,_,_ in
   let script=args.last ?? ""
   if script.contains("S2A_WORKSPACES_V1") { return "S2A_WORKSPACES_V1\u{1e}w\u{1f}Test\u{1f}"+root.appendingPathComponent("show.qlab5").path+"\u{1e}" }
   scripts.append(script);return "group-\(scripts.count)\taudio\tclock"
  }
  var prior:String?=nil
  for (i,segment) in segments.enumerated(){let result=try model.performImport(project:segment,folder:root,workspaceID:"w",previousManualGroupID:prior);prior=result.groupID;let script=scripts.last!;precondition(script.contains("set continue mode of showGroup to do_not_continue") && script.contains("set post wait of showClock to \(i==0 ? "12.000" : "8.000")"));precondition(i==0 || script.contains("set cue target of abandonPrevious to previousManualGroup"));try script.write(to:root.appendingPathComponent("import-manual-\(i).applescript"),atomically:true,encoding:.utf8)}
  project.conductType=nil
  _=try model.performImport(project:project,folder:root,workspaceID:"w")
  precondition(!scripts.last!.contains("abandonPrevious") && !scripts.last!.contains("set continue mode of showGroup to do_not_continue"))
  try scripts.last!.write(to:root.appendingPathComponent("import-autopilot.applescript"),atomically:true,encoding:.utf8)
  var invalid=try JSONDecoder().decode(ShowCueProject.self,from:Data(json.replacingOccurrences(of:"\"parentMusicId\":\"m1\"",with:"\"parentMusicId\":\"missing\"").utf8));invalid.conductType="manual"
  do{_=try invalid.importSegments();fatalError("Invalid parent must fail")}catch is ShowCueProject.ManualConductError{}
  print("PASS legacy default, manual split, relative tops, descriptions, images, per-music Wait clocks, explicit GO boundaries, abandon previous group, safe invalid-parent rejection")
 }
}
