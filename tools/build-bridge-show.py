"""Bundle the actual Pilot Show stylesheet; no server or companion installer."""
from pathlib import Path
import re, shutil, os
repo=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('S2A_BRIDGE_BUILD',str(repo/'S2A-Copilot/build')))/'S2A Pilot Bridge.app/Contents/Resources/Show'
out.mkdir(parents=True,exist_ok=True)
for f in (repo/'S2A-Copilot/Show').iterdir():
    if f.is_file():shutil.copy2(f,out/f.name)
html=(repo/'PWA/index.html').read_text()
(out/'pilot-show.css').write_text('\n'.join(re.findall(r'<style[^>]*>(.*?)</style>',html,re.S)))
shutil.copy2(repo/'S2A-Copilot/Resources/S2APilotBridgeIcon.png',out/'bridge.png')
print('Bundled Pilot Maverick styles and Bridge Show assets')

shutil.copy2(repo/'PWA/copilot-assets/qrcode.js',out/'qrcode.js')

# Use the same dialog and its scoped styles as Pilot.
dialog=re.search(r'<dialog id="copilotDialog".*?</dialog>',html,re.S).group()
shell=out/'index.html'
shell.write_text(shell.read_text().replace('<!-- COPILOT_DIALOG -->',dialog))
rules=[line for line in html.splitlines() if line.startswith(('#copilotDialog','.copilotDialogHeading','#copilotQr','.copilotMemberConnected'))]
rules.extend(line.replace('#copilotButton','#shareBridge') for line in html.splitlines() if line.startswith('#copilotButton'))
(out/'copilot-dialog.css').write_text('\n'.join(rules))
shutil.copy2(repo/'PWA/copilot-assets/copilot-logo.png',out/'copilot-logo.png')
