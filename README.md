# SNDK Value Lab v1.5

An offline Sandisk valuation calculator with editable NAND scenarios, company-guidance cash reconciliation, and independently checked arithmetic. Financial inputs remain frozen as of **October 9, 2026**; the app does not fetch live prices.

Download this repository and open **[sndk_valuation_v1_5.html](sndk_valuation_v1_5.html)** in a browser. No installation, server, account, or internet connection is required to use the calculator. GitHub displays the HTML source; download it before opening locally. This private repository does not deploy a public website.

## Guidance-based working preset

The app opens with the management-reference scenario, an explicit forecast ending in FY2030, four additional years of growth slowdown, and a 12% required return. The working-range panel recomputes the same assumptions at 11%, 12%, and 13%; it does not hardcode a desired stock price.

| Required return | Present value per share | Midpoint |
|---|---:|---:|
| 11% | $3,013–$3,196 | $3,104 |
| 12% | $2,683–$2,817 | $2,750 |
| 13% | $2,412–$2,513 | $2,463 |

The exact envelope is **$2,412.49–$3,195.95**, displayed as approximately **$2,400–$3,200** after rounding to the nearest $100. It is a conditional present value, not a future market-price forecast, confidence interval, probability-weighted target, or downside floor.

The selected-rate valuation and the wider 11%–13% envelope are shown separately. Editing any assumptions changes the preset label to **Custom assumptions** and recalculates the results. Selecting a preset or Reset restores its saved inputs. Settings exports retain both the inputs and the selected scenario, so importing them reproduces the same view.

## Operating outcomes and modeled values

These selected scenarios use the **v1.4-equivalent preset**: an explicit forecast through **FY2032**, an **11% required return**, four additional years of growth slowdown, and **1.5%–2.5% terminal growth**. The figures are rounded present values per share from [legacy_results.json](legacy_results.json).

| Operating outcome | Modeled value per share |
|---|---:|
| Moderate price-led adjustment | $2,113–$2,226 |
| Deeper decline followed by recovery | $1,523–$1,602 |
| Deep collapse with hypothetical contract support | $936–$985 |
| Extreme historical-economics stress | $296–$310 |
| Management performance continuing through FY2032 | $3,594–$3,794 |

These scenarios use a longer explicit forecast and a different required return than the default FY2030 working preset above. Contract support in the collapse case is hypothetical. Extending management-reference performance through FY2032 is a model assumption; the published financial targets cover FY2028–30 average performance. No probabilities are assigned to these outcomes.

## Facts and assumptions

Sandisk's published FY2028–30 **average** targets are approximately 80% non-GAAP gross margin, 75% non-GAAP operating margin, 50% adjusted free-cash-flow margin, and mid-to-high-teens revenue growth. The calculator allocates these period targets evenly to annual reference years. That allocation, 16% annual bit growth with flat selling prices, the 11%–13% required returns, and the slowdown after FY2030 are model choices.

The FY2027 revenue anchor ($49.14B), EPS ($214.82), and associated analyst estimates are not full-year company guidance. Other assumptions include 155M diluted shares, 15% tax, 1.5%–2.5% perpetual growth, 25% return on incremental capital, no opening excess cash, and no HBF contribution.

**Long-run profitability remains a material uncertainty.** Growth slows after FY2030, but operating margins remain strong in the terminal calculation. Cash conversion after the explicit period follows the reinvestment/return model and is not constrained to a perpetual 50% cash margin. Future contract economics, investment, taxes, dilution, and financing terms remain uncertain. No scenario probabilities have been estimated.

See [CASH_FLOW_RECONCILIATION.md](CASH_FLOW_RECONCILIATION.md) for the cash bridge, and [sources.json](sources.json) for source URLs, dates, and the distinction between disclosed targets and assumptions. Source figures are attributed excerpts; no third-party reports or datasets are bundled.

## Earlier version and reproducibility

The **v1.4-equivalent** preset retains the earlier six scenarios and their numerical outputs, including the deeper-decline case at $1,523–$1,602. It uses FY2032 and 11%, so it is a different set of assumptions from the new working preset. Underlying valuation equations and the fixed cash-reference budget are unchanged.

The original sibling `v1.4` directory is preserved locally, byte for byte. [v1_4_preservation.json](v1_4_preservation.json) records all 38 file hashes; `run_checks.py` verifies them whenever that sibling is present. This repository contains the clean v1.5 release, not a modified copy of the historical release.

- [guidance_preset.json](guidance_preset.json): importable session for the new working case.
- [guidance_results.json](guidance_results.json): unrounded valuation results at all three returns.
- [legacy_settings.json](legacy_settings.json) and [legacy_results.json](legacy_results.json): earlier economics under the v1.5 engine.
- [release_validation.json](release_validation.json): saved test counts and tested-app checksum.
- [MANIFEST.txt](MANIFEST.txt): SHA-256 checksums of the publishing files.

## Build and verify

Use Node.js 18+ and Python 3.9+. Calculation tests use standard libraries. Browser tests use the pinned Playwright dependency and Chrome/Chromium.

```sh
python3 run_checks.py
npm ci
npx playwright install chromium
python3 run_checks.py --browser --package
```

The normal check command builds the HTML, generates reference results, runs 40 engine test groups and 93,188 independent arithmetic checks across 587 cases, and verifies source/HTML consistency. Browser testing adds 130 desktop/mobile checks, including preset selection, input edits, exported/imported sessions, invalid inputs, funding warnings, and offline behavior. Testing establishes implementation consistency, not forecast accuracy. Safari, Firefox and physical mobile devices are not covered by these tests.

The GitHub Actions workflow runs the same checks on pushes and pull requests with read-only repository permissions. It does not deploy the app. Test screenshots, browser exports, dependency folders, and local environment files are excluded from the release.

## Access and rights

Private research software; no open-source license is granted. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The model is not affiliated with or endorsed by Sandisk. Valuations are research scenarios, not individualized investment instructions.
