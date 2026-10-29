"""Exercise the real decoder, segment planner and generated QLab import without executing QLab."""
from pathlib import Path
import subprocess,tempfile
repo=Path(__file__).resolve().parents[1]
source=(repo/'S2A-Copilot/Sources/S2ACopilot.swift').read_text()
with tempfile.TemporaryDirectory(prefix='s2a-manual-bridge-') as tmp:
 root=Path(tmp)
 (root/'Models.swift').write_text('import Foundation\n'+source[source.index('struct ShowCueProject:'):source.index('enum ShowCueError:')])
 app=source[source.index('enum ShowCueError:'):source.index('struct ContentView:')]
 # Expose only the import entry point in the test build; production source is unchanged.
 (root/'AppModel.swift').write_text('import Foundation\nimport AppKit\nimport Combine\n'+app.replace('private func performImport(', 'func performImport('))
 inputs=[root/'Models.swift',root/'AppModel.swift']+[repo/'S2A-Copilot/Sources'/name for name in ['BridgeStrings.swift','BridgeRuntime.swift','BridgeWorkspaceQuery.swift','BridgeEditing.swift','BridgeFlowFilter.swift']]
 subprocess.run(['xcrun','swiftc','-module-cache-path','/tmp/s2a-swift-cache',*map(str,inputs),str(repo/'tools/test-manual-bridge.swift'),'-o',str(root/'test')],check=True)
 subprocess.run([str(root/'test'),str(root)],check=True)
 for script in root.glob('import-*.applescript'):
  subprocess.run(['/usr/bin/osacompile','-o',str(script.with_suffix('.scpt')),str(script)],check=True)
 print('PASS actual Autopilot/manual import scripts compile against QLab 5; not executed in QLab')
