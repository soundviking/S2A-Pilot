"""Run production runtime/workspace tests and compile AppleScripts without executing them."""
from pathlib import Path
import subprocess
import tempfile

repo = Path(__file__).resolve().parents[1]
source = (repo / 'S2A-Copilot/Sources/S2ACopilot.swift').read_text()
models = source[source.index('struct ShowCueProject:'):source.index('enum ShowCueError:')]
with tempfile.TemporaryDirectory(prefix='s2a-bridge-checks-') as folder:
    root = Path(folder)
    model = root / 'Models.swift'
    model.write_text('import Foundation\n' + models)
    for name, inputs in (
        ('runtime', [model, repo/'S2A-Copilot/Sources/BridgeRuntime.swift']),
        ('workspaces', [repo/'S2A-Copilot/Sources/BridgeWorkspaceQuery.swift']),
    ):
        binary = root / name
        subprocess.run(['xcrun', 'swiftc', '-module-cache-path', '/tmp/s2a-swift-cache',
                        *map(str, inputs), str(repo/f'tools/test-bridge-{name}.swift'), '-o', str(binary)], check=True)
        subprocess.run([str(binary), str(root if name == 'runtime' else root/'workspace.applescript')], check=True)
    for name in ('runtime', 'selection', 'workspace'):
        subprocess.run(['/usr/bin/osacompile', '-o', str(root/(name+'.scpt')),
                        str(root/(name+'.applescript'))], check=True)
    print('PASS: runtime, selection and workspace AppleScripts compile; none executed')
