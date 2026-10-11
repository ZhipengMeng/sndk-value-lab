"""Build/test v1.5, verify preserved v1.4, and optionally run browser/package checks."""
from pathlib import Path
from datetime import datetime, timezone
from subprocess import run
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser', action='store_true')
parser.add_argument('--package', action='store_true')
args = parser.parse_args()
commands = [
    [sys.executable, 'build_v1_5.py'], ['node', 'generate_results.js'],
    ['node', '--check', 'sndk_valuation_v1_5.js'], ['node', 'test_engine.js'],
    [sys.executable, 'audit_independent.py'],
]
if args.browser:
    commands.append([sys.executable, 'test_browser.py'])
commands.append([sys.executable, 'build_v1_5.py', '--check'])
for command in commands:
    run(command, cwd=ROOT, check=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
baseline = json.loads((ROOT / 'v1_4_preservation.json').read_text())
original = ROOT / baseline['originalDirectory']
preservation = 'not checked: original sibling v1.4 is not present in this checkout'
if original.is_dir():
    now = {str(p.relative_to(original)): sha(p) for p in original.rglob('*') if p.is_file()}
    assert now == baseline['sha256'], 'Original v1.4 differs from preservation baseline'
    preservation = f'verified: all {len(now)} original files unchanged'
browser_path = ROOT / 'test_browser_report.json'
browser = json.loads(browser_path.read_text()) if browser_path.exists() else {}
browser_current = browser.get('appSha256') == sha(ROOT / 'sndk_valuation_v1_5.html')
if args.package:
    assert browser_current, 'Run browser tests against this HTML before packaging'
engine = json.loads((ROOT / 'test_engine_report.json').read_text())
audit = json.loads((ROOT / 'audit_independent_report.json').read_text())
report = {
    'version': '1.5', 'checkedAt': datetime.now(timezone.utc).isoformat(),
    'engineTestGroups': engine['engineAssertionsPassed'],
    'independentChecks': audit['independentArithmeticChecksPassed'], 'arithmeticCases': audit['caseCount'],
    'browserChecks': browser.get('checksPassed') if browser_current else None,
    'browserHtmlMatches': browser_current, 'v1_4Preservation': preservation,
    'engineSha256': sha(ROOT / 'sndk_valuation_v1_5.js'),
    'appSha256': sha(ROOT / 'sndk_valuation_v1_5.html'),
}
(ROOT / 'release_validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('Preservation:', preservation)
if args.package:
    run([sys.executable, 'package_release.py'], cwd=ROOT, check=True)
    run([sys.executable, 'verify_release.py'], cwd=ROOT, check=True)
print('PASS release checks')
