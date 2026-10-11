# Release history

## v2.0 — October 11, 2026

- Publishes the audited NAND model as the default calculator while preserving the original v1.5 model and download.
- Adds end-market drivers, explicit JV funding and cash allowances, forward EPS reconciliation, the equity bridge, and terminal margin normalization.
- Retains the audited October 9 snapshot. Central value is $1,998.15 under the default assumptions, a conditional present value.
- Adds portable independent arithmetic and desktop/mobile checks to the existing verification and publishing workflow.

## v1.5

- Adds a public web entry point, usage and privacy notes, and GitHub Pages deployment after successful checks. The standalone app and all valuation equations remain available; source copyright stays reserved.
- Documents five operating outcomes with their FY2032 horizon, 11% required return, and explicit distinction between company targets and hypothetical assumptions.
- Adds a selectable guidance-based working preset: management reference through FY2030, four-year growth slowdown, 12% central return, and a displayed 11%–13% valuation envelope.
- Reproduces $2,412.49–$3,195.95, rounded to $2,400–$3,200, with a $2,749.97 central midpoint.
- Preserves the v1.4-equivalent scenario configuration and all original numerical regressions. No valuation equation changes.
- Exports the selected scenario together with model settings. Imports validate both before replacing current inputs. Earlier-version settings require a reviewed migration; they are not silently reinterpreted.
- Distinguishes custom assumptions from saved presets and clears the working range when inputs are invalid or the range contains an unfunded valuation.
- Adds numerical, independent arithmetic, and desktop/mobile regression checks for the new preset.
- Adds a clean reproducible release, read-only verification, source notices, and an original-v1.4 preservation manifest. Personal paths, environment files, test screenshots and redundant source dumps are excluded. Pages deployment permissions are restricted to the publishing job.

## v1.4 (preserved locally)

Corrected reverse valuation and funding-shortfall behavior, reconciled reference cash flow to company guidance, and made builds and browser tests portable. The unchanged original is kept outside this publishing directory.
