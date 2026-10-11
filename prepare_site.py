"""Publish only tested v2.0 HTML, retaining the historical v1.5 download URL."""
from pathlib import Path
import hashlib
import json
ROOT = Path(__file__).resolve().parent
OUT = ROOT / '_site'
APP = 'sndk_valuation_v2_0.html'
LEGACY = 'sndk_valuation_v1_5.html'
data = (ROOT / 'v2.0' / APP).read_bytes()
old = (ROOT / LEGACY).read_bytes()
browser = json.loads((ROOT / 'v2.0/verification/browser_report.json').read_text())
legacy_browser = json.loads((ROOT / 'test_browser_report.json').read_text())
assert browser['status'] == 'pass'
assert browser['appSha256'] == hashlib.sha256(data).hexdigest(), 'Run v2.0 browser tests before publishing'
assert legacy_browser['appSha256'] == hashlib.sha256(old).hexdigest(), 'Run legacy browser tests before publishing'
outputs = {'index.html': data, APP: data, LEGACY: old, '.nojekyll': b''}
OUT.mkdir(exist_ok=True)
assert not OUT.is_symlink(), 'Website directory must not be a symlink'
assert {p.name for p in OUT.iterdir()} <= outputs.keys(), 'Unexpected files in website output'
for name, contents in outputs.items():
    target = OUT / name
    assert not target.is_symlink(), 'Website output must not contain symlinks'
    target.write_bytes(contents)
    assert target.read_bytes() == contents
print(json.dumps({'website': '_site', 'version': '2.0', 'files': sorted(outputs), 'appSha256': browser['appSha256']}))
