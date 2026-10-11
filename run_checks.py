"""Build/test v2.0 and v1.5, verify preserved v1.4, and optionally run browser/package checks."""
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
    [sys.executable, 'v2.0/build.py'],
    ['node', '--check', 'v2.0/source/engine.js'],
    ['node', '--check', 'v2.0/source/app.js'],
    ['node', 'v2.0/test_engine.js'],
    [sys.executable, 'v2.0/audit_independent.py'],
]
commands += [['node', 'market/test_quotes.js']]
if args.browser:
    commands.append(['node','market/test_browser_quotes.js'])
    commands.append([sys.executable, 'test_browser.py'])
    commands.append(['node', 'v2.0/test_browser.js'])
commands.append([sys.executable, 'build_v1_5.py', '--check'])
commands.append([sys.executable, 'v2.0/build.py', '--check'])
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
    'version': '2.0',
    'legacyVersion': '1.5', 'checkedAt': datetime.now(timezone.utc).isoformat(),
    'engineTestGroups': engine['engineAssertionsPassed'],
    'independentChecks': audit['independentArithmeticChecksPassed'], 'arithmeticCases': audit['caseCount'],
    'browserChecks': browser.get('checksPassed') if browser_current else None,
    'browserHtmlMatches': browser_current, 'v1_4Preservation': preservation,
    'engineSha256': sha(ROOT / 'sndk_valuation_v1_5.js'),
    'appSha256': sha(ROOT / 'sndk_valuation_v1_5.html'),
}
current_browser_path=ROOT / 'v2.0/verification/browser_report.json'
current_browser=json.loads(current_browser_path.read_text()) if current_browser_path.exists() else {}
current_match=current_browser.get('appSha256')==sha(ROOT / 'v2.0/sndk_valuation_v2_0.html')
if args.package:
    assert current_match, 'Run v2.0 browser tests before packaging'
legacy_report=report
report={
    'version':'2.0',
    'checkedAt':legacy_report['checkedAt'],
    'legacy':{k:v for k,v in legacy_report.items() if k not in ['legacyVersion']},
    'appSha256':sha(ROOT / 'v2.0/sndk_valuation_v2_0.html'),
    'browserHtmlMatches':current_match,
    'browserChecks':current_browser.get('checks') if current_match else None,
    'engineSha256':sha(ROOT / 'v2.0/source/engine.js'),
    'engine':json.loads((ROOT / 'v2.0/verification/engine_report.json').read_text()),
    'independentAudit':json.loads((ROOT / 'v2.0/verification/independent_audit.json').read_text()),
}
report['legacy']['version']='1.5'
quote_path=ROOT/'market/browser_report.json'
quote_report=json.loads(quote_path.read_text()) if quote_path.exists() else {}
quote_matches=quote_report.get('status')=='pass' and bool(quote_report.get('htmlSha256')) and all(sha(ROOT/name)==digest for name,digest in quote_report.get('htmlSha256',{}).items())
if args.package:assert quote_matches,'Run automatic quote browser tests against current HTML'
report['automaticQuotes']={'browserHtmlMatches':quote_matches,'checks':quote_report.get('checks') if quote_matches else None}
(ROOT / 'release_validation.json').write_text(json.dumps(report, indent=2) + '\n')
print('Preservation:', preservation)
if args.package:
    run([sys.executable, 'package_release.py'], cwd=ROOT, check=True)
    run([sys.executable, 'verify_release.py'], cwd=ROOT, check=True)
print('PASS release checks')
