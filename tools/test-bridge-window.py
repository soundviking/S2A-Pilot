"""Launch the real Show view with a simulated QLab connection in a temporary app."""
from pathlib import Path
import subprocess, tempfile, shutil, plistlib
repo=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='s2a-native-window-') as folder:
 root=Path(folder)
 app=root/'Bridge Window Test.app'
 resources=app/'Contents/Resources'
 binary=app/'Contents/MacOS/Test'
 binary.parent.mkdir(parents=True)
 resources.mkdir()
 shutil.copytree(repo/'S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources/Show',resources/'Show')
 for name in ['interface.json','S2APilotBridgeIcon.icns']:
  shutil.copy2(repo/'S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources'/name,resources/name)
 (app/'Contents/Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':'fr.s2a.bridge.window-test','CFBundleExecutable':'Test','CFBundleName':'Bridge Window Test','NSHighResolutionCapable':True}))
 source=(repo/'S2A-Copilot/Sources/S2ACopilot.swift').read_text()
 core=root/'AppCore.swift'
 core.write_text(source[:source.index('@main\nstruct ShowCueForQLabApp:')])
 inputs=[core,*[p for p in (repo/'S2A-Copilot/Sources').glob('*.swift') if p.name!='S2ACopilot.swift'],repo/'tools/test-bridge-window.swift']
 subprocess.run(['xcrun','swiftc','-parse-as-library',*map(str,inputs),'-o',str(binary),'-framework','SwiftUI','-framework','AppKit','-framework','WebKit','-framework','Foundation','-module-cache-path','/tmp/s2a-window-test-cache','-target','arm64-apple-macos13.0'],check=True)
 subprocess.run([str(binary)],check=True,timeout=25)
