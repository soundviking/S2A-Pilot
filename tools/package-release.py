"""Package the built Bridge and downloadable PWA without changing older releases."""
from pathlib import Path
import json, zipfile
repo = Path(__file__).resolve().parents[1]
app = repo / 'S2A-Copilot/build/S2A Pilot Bridge.app'
pwa = repo / 'PWA'
release = json.loads((pwa / 'version.json').read_text())['version']
bridge = '1.3.1'
entries = []
companion = pwa / f'companion/S2A-Pilot-Bridge-{bridge}-app.zip'
with zipfile.ZipFile(companion, 'w', zipfile.ZIP_STORED) as archive:
    for file in sorted(app.rglob('*')):
        if file.is_file():
            name = 'S2A Pilot Bridge.app/' + file.relative_to(app).as_posix()
            archive.write(file, name)
            entries.append({'path': name, 'mode': file.stat().st_mode, 'size': file.stat().st_size})
(pwa / 'companion/app-files.json').write_text(json.dumps({'version': bridge, 'architectures': ['arm64', 'x86_64'], 'files': entries}, indent=2) + '\n')
bridge_zip = repo / f'downloads/S2A-Pilot-Bridge-{bridge}-macOS-Universel.zip'
with zipfile.ZipFile(bridge_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(app.rglob('*')):
        if file.is_file(): archive.write(file, 'S2A Pilot Bridge.app/' + file.relative_to(app).as_posix())
    for name in ['INSTALLATION-S2A-Pilot-Bridge.txt', 'INSTALLATION.en.txt', 'LICENSE']:
        archive.write(repo / 'S2A-Copilot' / name, name)
pwa_zip = repo / f'downloads/S2A-Pilot-V{release}-PWA.zip'
with zipfile.ZipFile(pwa_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(pwa.rglob('*')):
        if file.is_file() and file.name != '.DS_Store': archive.write(file, file.relative_to(pwa).as_posix())
for file in [companion, bridge_zip, pwa_zip]:
    assert file.stat().st_size < 100 * 1024 * 1024, 'GitHub file limit exceeded'
    with zipfile.ZipFile(file) as archive: assert archive.testzip() is None
    print(file.name, round(file.stat().st_size / 1024 / 1024, 1), 'MiB; verified')
