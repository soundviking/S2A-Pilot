"""Bundle the actual Pilot Show stylesheet; no server or companion installer."""
from pathlib import Path
import re, shutil
repo=Path(__file__).resolve().parents[1]
out=repo/'S2A-Copilot/build/S2A Pilot Bridge.app/Contents/Resources/Show'
out.mkdir(parents=True,exist_ok=True)
for f in (repo/'S2A-Copilot/Show').iterdir():
    if f.is_file():shutil.copy2(f,out/f.name)
html=(repo/'PWA/index.html').read_text()
(out/'pilot-show.css').write_text('\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',html,re.S)))
shutil.copy2(repo/'S2A-Copilot/Resources/S2APilotBridgeIcon.png',out/'bridge.png')
print('Bundled Pilot Maverick styles and read-only Bridge Show view')
