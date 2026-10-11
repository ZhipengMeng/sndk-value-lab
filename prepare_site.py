"""Prepare a minimal GitHub Pages site from the verified standalone calculator."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parent
OUT = ROOT / '_site'
APP = 'sndk_valuation_v1_5.html'
data = (ROOT / APP).read_bytes()
browser = json.loads((ROOT / 'test_browser_report.json').read_text())
assert browser['appSha256'] == hashlib.sha256(data).hexdigest(), 'Run browser tests before publishing'
allowed = {'index.html', APP, '.nojekyll'}
OUT.mkdir(exist_ok=True)
assert {p.name for p in OUT.iterdir()} <= allowed, 'Unexpected files in website output'
for name in allowed:
    target = OUT / name
    assert not target.is_symlink(), 'Website output must not contain symlinks'
    target.write_bytes(b'' if name == '.nojekyll' else data)
assert (OUT / 'index.html').read_bytes() == data
assert (OUT / APP).read_bytes() == data
print(json.dumps({'website': '_site', 'files': sorted(allowed), 'appSha256': browser['appSha256']}))
