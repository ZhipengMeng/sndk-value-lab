# SNDK Value Lab v2.0

A standalone Sandisk valuation calculator with separate NAND end-market assumptions, forward earnings reconciliation, explicit joint-venture cash requirements, and a normalized terminal margin. Audited October 11, 2026; financial inputs and the valuation date remain frozen as of **October 9, 2026**, while online market quotes update separately.

**[Open the live calculator](https://zhipengmeng.github.io/sndk-value-lab/)** · [Download the standalone v2.0 app](https://zhipengmeng.github.io/sndk-value-lab/sndk_valuation_v2_0.html) · [Inputs and sources](v2.0/model.json) · [Three-company comparison](https://zhipengmeng.github.io/mu-value-lab/comparison/)

The live site opens v2.0. Select a scenario, adjust the assumptions, or export the displayed settings. Reload or Reset restores the original central assumptions. Exports are JSON records for reproducibility; v2.0 does not import v1.5 sessions. The [original v1.5 calculator](https://zhipengmeng.github.io/sndk-value-lab/sndk_valuation_v1_5.html) remains available at its existing address, with its [original documentation](v1_5_README.md). Its economics differ materially from v2.0.

## Automatic prices

All three models and the comparison now use one dated regular-session USD quote feed. Websites check it every five minutes; the central updater runs about every 15 minutes on U.S. market weekdays. P/E, upside and rankings update while company assumptions, EPS estimates, FX and the October 9 valuation date remain unchanged. Prices are not guaranteed real-time. Turn off **Update automatically** for the original snapshot. Failed updates retain visibly dated prices. See [quote source, schedule, fallback and checks](market/README.md).

## Current model results

| Illustrative scenario | Conditional present value per diluted share |
|---|---:|
| Downside | $323.48 |
| Central | $1,998.15 |
| Upside | $4,142.44 |

The central case uses a 12% required return, 2% perpetual growth, 25% after-tax return on incremental capital, and 50% terminal economic operating margin. The reference share price is $1,581.82. Results are conditional present values, not future stock-price targets, probabilities, confidence intervals, or downside floors.

The model forecasts FY2027–34, normalizes growth, operating margin and reinvestment during 2035–38, and values terminal cash flow from 2039. Future financial projections are research scenarios; the app does not retrieve live quotes.

## What changed from v1.5

The old default midpoint of about $2,750 carried a 74.50% economic operating margin into perpetuity. Management's financial framework covers **average FY2028–30 performance**, not perpetual profitability. The revised central case normalizes the terminal margin to 50% and separately models Datacenter, Edge and Consumer demand, shipment indices and price/mix. Neither the annual allocation of management's targets nor the eventual normalized margin is a reported fact.

Economic cash flow now shows own-company depreciation, direct capex, net JV funding, working capital and an unallocated cash allowance separately. JV depreciation in wafer purchase costs is not added back as Sandisk depreciation. Customer advances are excluded from new operating cash generation and existing liabilities are reserved. SBC remains an economic expense. Cash, investments, taxes and other claims are visible in the equity bridge.

FY2027 modeled adjusted-style EPS is approximately $215.02 versus $214.82 consensus. FY2028 is $240.91 versus $266.30 consensus: evenly allocating management's 75% period operating-margin target does not reproduce the higher analyst estimate. That gap remains visible. The FY2027 income statement is consensus anchored, not an independent earnings forecast.

## Facts and assumptions

[model.json](v2.0/model.json) records the input dates, disclosed financial amounts, source URLs and page/section locators, external analyst estimates, scenario assumptions and limitations. The calculator displays these distinctions. [default_results.json](v2.0/default_results.json) contains the unrounded outputs.

Material assumptions include the NAND pricing cycle, end-market costs and shipment splits, future net JV funding, the composition and persistence of the cash allowance, interim cash generation, dilution, and terminal profitability. The combined $31B investment announcement is not a disclosed Sandisk net-cash schedule. FY2028–30 targets and later model outcomes are uncertain. [The v2.0 guide](v2.0/README.md) describes the calculation and verification files.

This repository publishes the SNDK model only. MU and SKHY remain separate models: [MU](https://zhipengmeng.github.io/mu-value-lab/) and [SKHY](https://zhipengmeng.github.io/skhy-value-lab/). The [three-company comparison](https://zhipengmeng.github.io/mu-value-lab/comparison/) is hosted separately. Personal portfolio information is not included. Sources are linked; complete third-party filings, presentations and datasets are not redistributed here.

## Build, verify and publish

Use Python 3.9+ and Node.js 18+. Browser checks use the existing pinned Playwright dependency.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
python3 run_checks.py --browser --package
python3 prepare_site.py
```

The check command rebuilds both versions, independently checks the financial arithmetic, exercises desktop/mobile browser behavior, verifies generated source consistency, and creates a checksum-verified release at `dist/sndk_value_lab_v2_0.zip`. Run `python3 v2.0/build.py --check` for a read-only v2.0 source/output consistency check. The original v1.5 model is preserved and still passes its existing tests.

The GitHub Actions workflow runs these checks before publishing. Only successful `main` builds in this public repository deploy to GitHub Pages; pull requests do not deploy. Deployment receives separate, limited Pages permissions. `prepare_site.py` verifies the tested app hashes and copies only the v2.0 default, its standalone download, the preserved v1.5 download and a `.nojekyll` marker. Local paths, evidence PDFs, screenshots, exported settings, dependency folders and credentials are excluded by the publishing allowlist.

Verification establishes software and arithmetic consistency, not forecast accuracy. Safari, Firefox and physical mobile devices have not been tested.

## Privacy and rights

Calculations and exported settings stay in your browser. There are no analytics or accounts. Online pages fetch only the shared public quote feed; no external script is loaded. GitHub Pages serves the website under [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement); the standalone download works offline.

Copyright remains reserved; no open-source license is granted. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The model is independent of Sandisk and is not individualized investment advice.
