"""Decode a real Pilot ZIP with Bridge's production model; check its media and app."""
from pathlib import Path
import tempfile, subprocess, zipfile, os
repo=Path(__file__).resolve().parents[1]
source=(repo/'S2A-Copilot/Sources/S2ACopilot.swift').read_text()
model=source[source.index('struct ShowCueProject:'):source.index('struct QueuedShowCuePackage:')]
with tempfile.TemporaryDirectory(prefix='s2a-bridge-export-') as folder:
 root=Path(folder)
 browsers=['chromium'] if os.environ.get('S2A_TEST_ENGINES')=='chromium' else ['chromium','webkit']
 for browser in browsers:
  archive=Path('/tmp/s2a-lightweight-export-'+browser+'.zip')
  subprocess.run(['/usr/bin/ditto','-x','-k',str(archive),str(root/browser)],check=True)
  app=root/browser/'companion/S2A Pilot Bridge.app'
  assert not (app/'Contents/Resources/Copilot').exists()
  subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(app)],check=True)
 harness=root/'validate.swift'
 harness.write_text('import Foundation\n'+model+'''
for argument in CommandLine.arguments.dropFirst() {
 let root=URL(fileURLWithPath:argument)
 let project=try JSONDecoder().decode(ShowCueProject.self,from:Data(contentsOf:root.appendingPathComponent("conduite.json")))
 precondition(project.isMultimedia && project.version == 5 && project.cues.count == 2)
 precondition(project.multimediaActionCount == 2)
 for cue in project.cues {
  precondition(!(cue.description ?? "").isEmpty)
  precondition(cue.monitorDescription == cue.description)
  if let path=cue.imagePath { precondition(FileManager.default.fileExists(atPath:root.appendingPathComponent(path).path)) }
  for action in cue.mediaActions ?? [] where !action.isStopAll {
   precondition(action.path != nil && action.isAudio)
   precondition(FileManager.default.fileExists(atPath:root.appendingPathComponent(action.path!).path))
   precondition(action.start == 0 && action.end == 1 && action.loop == false)
  }
 }
 print("PASS Bridge production decoder: \\(project.title), \\(project.cues.count) cues, media and visuals exist, timing and audio settings preserved")
}
''')
 subprocess.run(['swift',str(harness),*[str(root/browser) for browser in browsers]],check=True)
