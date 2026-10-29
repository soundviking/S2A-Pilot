"""Package Pilot and the offline Bridge installer. No Copilot service or runtime."""
from pathlib import Path
import json, zipfile, plistlib, sys
repo=Path(__file__).resolve().parents[1]
pwa=repo/'PWA'
if json.loads((pwa/'version.json').read_text()).get('channel') == 'beta':
 raise SystemExit('Beta branch: use tools/package-beta.py; stable distributions must not be replaced.')
app=repo/'S2A-Copilot/build/S2A Pilot Bridge.app'
release=json.loads((pwa/'version.json').read_text())['version']
bridge=plistlib.loads((app/'Contents/Info.plist').read_bytes())['CFBundleShortVersionString']
assert not (app/'Contents/Resources/Copilot').exists()
assert not list(pwa.rglob('*.php'))
if '--bridge-only' in sys.argv:
 bridge_zip=repo/f'downloads/S2A-Pilot-Bridge-{bridge}-macOS-Universel.zip'
 with zipfile.ZipFile(bridge_zip,'w',zipfile.ZIP_DEFLATED) as archive:
  for file in sorted(app.rglob('*')):
   if file.is_file():archive.write(file,'S2A Pilot Bridge.app/'+file.relative_to(app).as_posix())
  for name in ['INSTALLATION-S2A-Pilot-Bridge.txt','INSTALLATION.en.txt','INSTALLATION.es.txt','INSTALLATION.de.txt','LICENSE']:
   archive.write(repo/'S2A-Copilot'/name,name)
 with zipfile.ZipFile(bridge_zip) as archive:assert archive.testzip() is None
 assert bridge_zip.stat().st_size<100*1024*1024
 print(bridge_zip.name,round(bridge_zip.stat().st_size/1000000,2),'MB; verified; Pilot archives unchanged')
 sys.exit(0)
bridge_folder=pwa/'Bridge';bridge_folder.mkdir(exist_ok=True)
archive_path=bridge_folder/f'S2A-Pilot-Bridge-{bridge}-app.zip'
entries=[]
with zipfile.ZipFile(archive_path,'w',zipfile.ZIP_STORED) as archive:
 for file in sorted(app.rglob('*')):
  if file.is_file():
   name='S2A Pilot Bridge.app/'+file.relative_to(app).as_posix()
   archive.write(file,name);entries.append({'path':name,'mode':file.stat().st_mode,'size':file.stat().st_size})
for stale in bridge_folder.glob('S2A-Pilot-Bridge-*-app.zip'):
 if stale!=archive_path:stale.unlink()
(bridge_folder/'app-files.json').write_text(json.dumps({'version':bridge,'architectures':['arm64','x86_64'],'files':entries},indent=2)+'\n')
if '--companion-only' in sys.argv:
 print(f'Prepared offline Bridge companion {bridge}; release downloads unchanged.')
 sys.exit(0)
bridge_zip=repo/f'downloads/S2A-Pilot-Bridge-{bridge}-macOS-Universel.zip'
with zipfile.ZipFile(bridge_zip,'w',zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(app.rglob('*')):
  if file.is_file():archive.write(file,'S2A Pilot Bridge.app/'+file.relative_to(app).as_posix())
 for name in ['INSTALLATION-S2A-Pilot-Bridge.txt','INSTALLATION.en.txt','INSTALLATION.es.txt','INSTALLATION.de.txt','LICENSE']:archive.write(repo/'S2A-Copilot'/name,name)
pwa_zip=repo/f'downloads/S2A-Pilot-V{release}-PWA.zip'
with zipfile.ZipFile(pwa_zip,'w',zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(pwa.rglob('*')):
  if file.is_file() and file.name!='.DS_Store':archive.write(file,file.relative_to(pwa).as_posix())
for file in [archive_path,bridge_zip,pwa_zip]:
 assert file.stat().st_size<100*1024*1024
 with zipfile.ZipFile(file) as archive:assert archive.testzip() is None
 print(file.name,round(file.stat().st_size/1000000,2),'MB; verified')
