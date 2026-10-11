"""Read-only manifest, ZIP, privacy-pattern and browser-result verification."""
import hashlib
import json
import re
import zipfile
from release_files import ROOT, publishing_files

sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = ROOT / 'MANIFEST.txt'
records = []
for line in manifest.read_text().splitlines():
    if line.startswith('#') or line.startswith('SHA256') or not line.strip():
        continue
    expected, size, name = line.split(maxsplit=2)
    p = ROOT / name
    assert p.resolve().is_relative_to(ROOT), name
    assert p.is_file() and p.stat().st_size == int(size) and sha(p) == expected, name
    records.append(p)
assert set(records) == set(publishing_files()), 'Manifest must exactly match publishing allowlist'
patterns = [r'/Users/' + r'[^/\s]+/', r'/home/' + r'[^/\s]+/',
            r'gh' + r'[opusr]_[A-Za-z0-9]{30,}', r'github_' + r'pat_[A-Za-z0-9_]{30,}',
            r'-----BEGIN ' + r'(?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
for p in records:
    text = p.read_text()
    assert not any(re.search(pattern, text) for pattern in patterns), 'Private-path or credential pattern: ' + p.name
with zipfile.ZipFile(ROOT / 'dist' / 'sndk_value_lab_v2_0.zip') as z:
    assert z.testzip() is None
    assert len(z.namelist()) == len(records) + 1
    for p in [*records, manifest]:
        assert hashlib.sha256(z.read('sndk-value-lab/' + p.relative_to(ROOT).as_posix())).hexdigest() == sha(p)
browser = json.loads((ROOT / 'test_browser_report.json').read_text())
assert browser['appSha256'] == sha(ROOT / 'sndk_valuation_v1_5.html'), 'Browser result is stale'
print(f'PASS manifest ({len(records)} files), ZIP, privacy pattern check and tested HTML')

current = json.loads((ROOT / 'v2.0/verification/browser_report.json').read_text())
assert current['appSha256'] == sha(ROOT / 'v2.0/sndk_valuation_v2_0.html'), 'v2.0 browser result is stale'
print('PASS v2.0 tested HTML matches release')
