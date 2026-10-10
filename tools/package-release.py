"""Package lightweight Pilot; Bridge remains a separate, unchanged download."""
from pathlib import Path
import json, zipfile
repo = Path(__file__).resolve().parents[1]
pwa = repo / 'PWA'
release = json.loads((pwa / 'version.json').read_text())['version']
# Bridge is distributed only as its separate GitHub download. Never add it to PWA.
assert not (pwa / 'companion').exists(), 'Remove the obsolete embedded Bridge folder'
pwa_zip = repo / f'downloads/S2A-Pilot-V{release}-PWA.zip'
with zipfile.ZipFile(pwa_zip, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(pwa.rglob('*')):
        if file.is_file() and file.name != '.DS_Store': archive.write(file, file.relative_to(pwa).as_posix())
for file in [pwa_zip]:
    assert file.stat().st_size < 100 * 1024 * 1024, 'GitHub file limit exceeded'
    with zipfile.ZipFile(file) as archive: assert archive.testzip() is None
    print(file.name, round(file.stat().st_size / 1024 / 1024, 1), 'MiB; verified')
