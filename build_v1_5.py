"""Build the offline app from the local canonical JS and HTML template.

No third-party Python packages are required. --check verifies without writing.
"""
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
js = (ROOT / 'sndk_valuation_v1_5.js').read_text()
template = (ROOT / 'app_template.html').read_text()
assert template.count('<!-- EMBED_ENGINE -->') == 1
assert '</script>' not in js.lower(), 'Engine must not terminate its script tag'
outputs = {
    'sndk_valuation_v1_5.html': template.replace('<!-- EMBED_ENGINE -->', '<script>' + js + '</script>'),
}
for name, contents in outputs.items():
    path = ROOT / name
    if args.check:
        assert path.read_bytes() == contents.encode('utf-8'), f'Stale generated file: {name}'
    else:
        path.write_bytes(contents.encode('utf-8'))
print('PASS generated files match source' if args.check else 'Built standalone v1.5 HTML')
