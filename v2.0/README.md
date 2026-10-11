# Audited SNDK model v2.0

The public standalone model uses the same financial inputs and calculation engine as the locally audited October 11 model. Its quote and forecast snapshot is October 9, 2026. Public navigation replaces a local-only comparison link; this does not change valuation arithmetic.

- `model.json`: reported inputs, external estimates, company targets, assumptions, source URLs and evidence locators.
- `source/engine.js`: economic cash flow, EPS, equity bridge, fiscal-date discounting, terminal calculation and validation.
- `source/app.js`, `source/template.html`, `source/style.css`: controls, results, explanatory text and layout.
- `build.py`: reproducible standalone HTML and default results; `--check` verifies without writing.
- `default_results.json`: unrounded downside, central and upside outputs.
- `test_engine.js`, `audit_independent.py`: behavioral checks and independent Python arithmetic over scenario and sensitivity cases.
- `test_browser.js`: actual offline app checks at desktop and mobile viewports.
- `verification/`: portable test reports. Passing checks do not establish forecast accuracy.

Run the complete release checks from the repository root as described in the [main README](../README.md). The source register links to original public disclosures; full source documents and private local comparison files are not bundled.

The previous version's economics and historical documentation remain available in the repository. Use the root README and this directory for the current model. All financial forecasts and valuation assumptions remain conditional.
