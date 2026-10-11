"""Package only the explicit publishing allowlist and generate checksums."""
from pathlib import Path
import hashlib
import json
import zipfile
from release_files import ROOT, publishing_files

OUT = ROOT.parent / 'sndk_valuation_v1_5.zip'
files = publishing_files()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
lines = ['# SNDK Value Lab v1.5 - paths relative to this manifest',
         '# Explicit publishing allowlist; manifest excluded from its own hashes',
         'SHA256  BYTES  RELATIVE_PATH']
for p in files:
    lines.append(f'{sha(p)}  {p.stat().st_size:>9}  {p.relative_to(ROOT).as_posix()}')
manifest = ROOT / 'MANIFEST.txt'
manifest.write_text('\n'.join(lines) + '\n')
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as z:
    for p in [*files, manifest]:
        z.write(p, arcname='v1.5/' + p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    for p in [*files, manifest]:
        assert hashlib.sha256(z.read('v1.5/' + p.relative_to(ROOT).as_posix())).hexdigest() == sha(p)
print(json.dumps({'archive': OUT.name, 'files': len(files) + 1, 'checksums': 'pass'}))
