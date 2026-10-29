"""Stage beta distributions separately; never write stable downloads or PWA/Bridge."""
from pathlib import Path
import hashlib,json,plistlib,shutil,zipfile
repo=Path(__file__).resolve().parents[1]
meta=json.loads((repo/'PWA/version.json').read_text());assert meta['channel']=='beta'
version=meta['version'];out=repo/'downloads/beta'/version
out.mkdir(parents=True,exist_ok=True)
stage=out/'PWA';shutil.copytree(repo/'PWA',stage,dirs_exist_ok=True)
app=repo/'S2A-Copilot/build-beta/S2A Pilot Bridge.app'
info=plistlib.loads((app/'Contents/Info.plist').read_bytes());assert info['CFBundleShortVersionString']==version
folder=stage/'Bridge';shutil.rmtree(folder);folder.mkdir()
files=[]
with zipfile.ZipFile(folder/f'S2A-Pilot-Bridge-{version}-app.zip','w',zipfile.ZIP_STORED) as z:
 for p in sorted(app.rglob('*')):
  if p.is_file():
   name='S2A Pilot Bridge.app/'+p.relative_to(app).as_posix();z.write(p,name);files.append(dict(path=name,mode=p.stat().st_mode,size=p.stat().st_size))
(folder/'app-files.json').write_text(json.dumps(dict(version=version,channel='beta',architectures=['arm64','x86_64'],files=files),indent=2)+'\n')
bridge=out/f'S2A-Pilot-Bridge-{version}-beta-macOS-Universel.zip'
with zipfile.ZipFile(bridge,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(app.rglob('*')):
  if p.is_file():z.write(p,'S2A Pilot Bridge.app/'+p.relative_to(app).as_posix())
 z.writestr('BETA.txt','S2A Pilot Bridge '+version+' bêta — tests uniquement. Ne remplacez pas votre version stable.\n')
pilot=out/f'S2A-Pilot-{version}-beta-PWA.zip'
with zipfile.ZipFile(pilot,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(stage.rglob('*')):
  if p.is_file() and p.name!='.DS_Store':z.write(p,p.relative_to(stage).as_posix())
for p in [pilot,bridge]:
 with zipfile.ZipFile(p) as z:assert z.testzip() is None
 print(p,hashlib.sha256(p.read_bytes()).hexdigest())
