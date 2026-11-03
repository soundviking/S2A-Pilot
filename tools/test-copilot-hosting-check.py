"""Test the diagnostic as packaged, including its conservative failure states."""
import json,subprocess,tempfile,zipfile
from pathlib import Path
repo=Path(__file__).resolve().parents[1]
archive=repo/'downloads/beta/copilot-install/S2A-Copilot-Preparation-o2switch-beta.zip'
with tempfile.TemporaryDirectory() as folder:
    public=Path(folder)/'public_html'/'S2A-Pilot-Beta';public.mkdir(parents=True)
    with zipfile.ZipFile(archive) as z:
        names=z.namelist();assert len(names)==len(set(names));assert z.testzip() is None
        assert all(n.startswith('copilot-test/') or n=='LISEZ-MOI-COPILOT.html' for n in names)
        z.extractall(public)
    index=public/'copilot-test/index.php'
    code='$_GET["check"]=1;$_SERVER["HTTPS"]="on";require '+json.dumps(str(index))+';'
    ready=json.loads(subprocess.check_output(['php','-r',code]))
    assert ready['scope']=='hosting_check_only' and ready['connected_to_pilot'] is False
    assert ready['ready_for_next_step'] is True,ready
    assert all(c['ok'] for c in ready['checks'])
    assert folder not in json.dumps(ready)
    no_extensions=json.loads(subprocess.check_output(['php','-n','-r',code]))
    assert no_extensions['ready_for_next_step'] == all(c['ok'] for c in no_extensions['checks'])
    missing_random=json.loads(subprocess.check_output(['php','-d','disable_functions=random_bytes','-r',code]))
    assert missing_random['ready_for_next_step'] is False
    assert next(c for c in missing_random['checks'] if c['id']=='exchange')['ok'] is False
    http=json.loads(subprocess.check_output(['php','-r','$_GET["check"]=1;require '+json.dumps(str(index))+';']))
    assert next(c for c in http['checks'] if c['id']=='https')['ok'] is False
    assert http['ready_for_next_step'] is False
    assert not list(Path(folder).rglob('*.sqlite'))
    print('PASS packaged deployment, HTTPS/SQLite checks, missing-function fallback, no private paths, no database files, beta-only contents')
