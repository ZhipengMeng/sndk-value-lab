"""Explicit publishing allowlist; excludes logs, screenshots, credentials and caches."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PUBLISH_FILES = [
    '.gitignore', '.github/workflows/verify.yml', 'README.md', 'CHANGELOG.md',
    'LICENSE', 'THIRD_PARTY_NOTICES.md', 'CASH_FLOW_RECONCILIATION.md', 'sources.json',
    'sndk_valuation_v1_5.js', 'sndk_valuation_v1_5.html', 'app_template.html',
    'build_v1_5.py', 'generate_results.js', 'test_engine.js', 'test_browser.js',
    'test_browser.py', 'audit_export.js', 'audit_independent.py', 'run_checks.py',
    'release_files.py', 'package_release.py', 'verify_release.py', 'prepare_site.py',
    'package.json', 'package-lock.json', 'guidance_preset.json', 'guidance_results.json',
    'legacy_settings.json', 'legacy_results.json', 'v1_4_preservation.json',
    'test_engine_report.json', 'audit_independent_report.json',
    'test_browser_report.json', 'release_validation.json',
    'v1_5_README.md', 'v2.0/README.md', 'v2.0/model.json', 'v2.0/default_results.json',
    'v2.0/build.py', 'v2.0/sndk_valuation_v2_0.html', 'v2.0/source/engine.js',
    'v2.0/source/app.js', 'v2.0/source/template.html', 'v2.0/source/style.css',
    'v2.0/test_engine.js', 'v2.0/test_browser.js', 'v2.0/audit_independent.py',
    'v2.0/verification/engine_report.json', 'v2.0/verification/browser_report.json',
    'v2.0/verification/independent_audit.json',
]

def publishing_files():
    files = [ROOT / name for name in sorted(PUBLISH_FILES)]
    missing = [str(p.relative_to(ROOT)) for p in files if not p.is_file()]
    if missing:
        raise ValueError('Missing publishing files: ' + ', '.join(missing))
    return files
