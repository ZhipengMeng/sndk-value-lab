"""Portable compatibility entry point for the Node Playwright browser suite."""
from pathlib import Path
from subprocess import run

ROOT=Path(__file__).resolve().parent
run(['node',str(ROOT/'test_browser.js')],cwd=ROOT,check=True)
