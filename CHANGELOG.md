# Release history

## v1.5

- Adds a selectable guidance-based working preset: management reference through FY2030, four-year growth slowdown, 12% central return, and a displayed 11%–13% valuation envelope.
- Reproduces $2,412.49–$3,195.95, rounded to $2,400–$3,200, with a $2,749.97 central midpoint.
- Preserves the v1.4-equivalent scenario configuration and all original numerical regressions. No valuation equation changes.
- Exports the selected scenario together with model settings. Imports validate both before replacing current inputs. Earlier-version settings require a reviewed migration; they are not silently reinterpreted.
- Distinguishes custom assumptions from saved presets and clears the working range when inputs are invalid or the range contains an unfunded valuation.
- Adds numerical, independent arithmetic, and desktop/mobile regression checks for the new preset.
- Adds a clean reproducible release, read-only CI, source notices, and an original-v1.4 preservation manifest. Personal paths, environment files, test screenshots and redundant source dumps are excluded.

## v1.4 (preserved locally)

Corrected reverse valuation and funding-shortfall behavior, reconciled reference cash flow to company guidance, and made builds and browser tests portable. The unchanged original is kept outside this publishing directory.
