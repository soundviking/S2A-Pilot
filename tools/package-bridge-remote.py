"""Package the freshly compiled native Bridge, without overwriting prior releases."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json, plistlib, hashlib

repo=Path(__file__).resolve().parents[1]
app=repo/'S2A-Copilot/build-beta/S2A Pilot Bridge.app'
info=plistlib.loads((app/'Contents/Info.plist').read_bytes())
meta=json.loads((repo/'S2A-Copilot/version.json').read_text())
assert info['CFBundleShortVersionString']==meta['version']=='1.6.31'
out=repo/'dist/bridge-remote';out.mkdir(parents=True,exist_ok=True)
archive=out/f"S2A-Pilot-Bridge-{meta['version']}-app.zip"
files=[]
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=7) as z:
    for p in sorted(app.rglob('*')):
        if not p.is_file():continue
        name=str(p.relative_to(app.parent));z.write(p,name)
        files.append(dict(path=name,mode=p.stat().st_mode,size=p.stat().st_size))
with ZipFile(archive) as z:assert z.testzip() is None
(out/'app-files.json').write_text(json.dumps(dict(version=meta['version'],build=meta['build'],channel='beta',architectures=['arm64','x86_64'],files=files),indent=2)+'\n')
(out/'verification-native.json').write_text(json.dumps({'bridge':meta['version'],'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'macos_build':True,'native_qlab_executed':False,'architectures':['arm64','x86_64']},indent=2)+'\n')
print(archive.name,archive.stat().st_size,'bytes')
