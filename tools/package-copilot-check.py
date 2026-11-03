"""Package the isolated o2switch preflight, never the stable app or a live relay."""
from pathlib import Path
import zipfile
repo = Path(__file__).resolve().parents[1]
source = repo / 'hosting/copilot-o2switch-check'
out = repo / 'downloads/beta/copilot-install'
out.mkdir(parents=True, exist_ok=True)
archive = out / 'S2A-Copilot-Preparation-o2switch-beta.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in sorted((source / 'site').rglob('*')):
        if path.is_file():
            z.write(path, 'copilot-test/' + path.relative_to(source / 'site').as_posix())
    z.write(source / 'LISEZ-MOI-COPILOT.html', 'LISEZ-MOI-COPILOT.html')
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert 'copilot-test/index.php' in z.namelist()
    assert all(name.startswith('copilot-test/') or name == 'LISEZ-MOI-COPILOT.html' for name in z.namelist())
print(archive)
print(str(archive.stat().st_size) + ' bytes')
