# Cash-flow reconciliation for v1.5

Evidence checked October 10, 2026. Dollar amounts below are billions unless stated otherwise. This note separates published facts from model choices.

## Published evidence

The [Investor Day CFO presentation, PDF page 13](https://investor.sandisk.com/static-files/9023ed3e-9baf-44f1-944d-dbe81121ea31) gives **FY2028–30 average performance** targets: approximately 80% non-GAAP gross margin, 75% non-GAAP operating margin, 50% adjusted free-cash-flow margin, mid-to-high-teens revenue growth, and mid-single-digit capital intensity. These are period targets, not annual commitments. Forward non-GAAP reconciliations are not fully available.

The [FY2026 Q4 release](https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-fourth-quarter-2026-financial-results) defines adjusted FCF by incorporating net Flash Ventures activity and removing NBM prepayment/deposit effects from conventional FCF. Its FY2026 bridge is $11.494B FCF − $0.275B net Flash Ventures activity − $2.476B NBM effects = $8.743B adjusted FCF. Thus NBM cash receipts are **excluded**, not included, in that reported adjusted measure. This corrects the contrary wording in the preserved v1.3 README.

## What the model can and cannot reconcile

v1.3's management-reference economic cash margins were approximately 62.56%, 61.24% and 60.12% in FY2028, FY2029 and FY2030. Its price and margin bridge did not reconcile the separate cash target. Its early reference margins also exceeded the company's period targets because they faded down only by FY2030.

v1.5 uses 80% GM and 75% OM in each reference year as a simple annual allocation of the published averages. The modeled adjusted-FCF **proxy** starts with adjusted operating income after illustrative tax, adds standalone depreciation, and deducts direct capex, incremental net JV funding, working-capital investment and specified other cash uses. It excludes NBM receipts. This is an approximation; it is not a reconstruction of all future GAAP operating-cash adjustments.

The economic cash flow used for valuation additionally charges stock compensation. Its after-tax cost is `afterTax(adjusted EBIT) − afterTax(adjusted EBIT − SBC)`, including the existing no-immediate-tax-credit convention when earnings are negative. Matching the company's cash target therefore does not remove this shareholder cost.

## Visible calibration instead of an invented expense breakdown

The unchanged reference is calibrated to 50% adjusted-FCF proxy in each of FY2028–30. That annual allocation also produces a revenue-weighted 50% period margin. We cannot infer the company's precise future capex, JV, tax and working-capital split from an aggregate target.

| Reference bridge | FY2028 | FY2029 | FY2030 |
|---|---:|---:|---:|
| Revenue | 57.0024 | 66.1228 | 76.7024 |
| Raw adjusted-FCF proxy | 34.4358 | 39.9163 | 46.4204 |
| Additional capital cash allowance | 1.5501 | 1.7561 | 2.1351 |
| Other unallocated cash allowance | 4.3845 | 5.0988 | 5.9340 |
| Total additional cash allowance | 5.9346 | 6.8549 | 8.0692 |
| Reconciled adjusted-FCF proxy | 28.5012 | 33.0614 | 38.3512 |
| Reconciled adjusted-FCF margin | 50.00% | 50.00% | 50.00% |
| Separate economic SBC charge | 0.2550 | 0.2805 | 0.3060 |
| Economic cash flow for valuation | 28.2462 | 32.7809 | 38.0452 |
| Economic cash-flow margin | 49.55% | 49.58% | 49.60% |

**Model choices:** 5% is an analyst midpoint for the capital-intensity reference. We use it as a cash investment proxy, topping up modeled direct capex plus net JV funding. Published capital intensity need not equal this cash-basis measure. The remaining difference is shown as an **unallocated cash allowance**, not assigned to invented taxes, JV costs or working capital. Both components together are a transparent sensitivity, not independently verified expenses. The split does not change total FCF.

The reference budget is frozen independently of scenario edits. Allowances scale with modeled core physical volume and the base-revenue size, not the scenario's selling price. Lower ASP therefore still reduces profit and cash. Increasing a scenario's capex, taxes or costs does not automatically reduce the allowance to hide the change. If a researched line-item budget replaces the residual, the user should turn the allowance off or lower its scale.

## Beyond the guidance period

FY2027 remains the original analyst reference. FY2031–32 carries forward the FY2030 allowance per bit; neither the yearly amount nor this extension is company guidance. Beyond the explicit forecast, the existing growth/incremental-return model determines reinvestment and terminal value. It does not also subtract the explicit-year allowance, avoiding an unexamined double deduction. Long-run cash conversion therefore still needs separate scrutiny.

The cash calibration is separate from operating cost calibration: switching off the latter does not erase the cash budget. The app labels both switches. The on/off comparison is conditional scenario analysis, not an upper/lower confidence interval.

## Verification and outstanding evidence

Node tests verify target reconciliation, separate SBC treatment, downside sensitivity and that user spending/tax changes are not canceled. Python independently rebuilds the reference allowances from revenue, margins, tax, depreciation, capex, JV funding and working capital, then reconstructs each tested scenario's cash flows and funding balances. Browser tests verify the displayed reconciliation, controls and exports.

Still unknown: the detailed future company cash bridge, exact capital-intensity/cash-budget mapping, future NBM payment timing, realistic working-capital needs through a downturn, and future funding terms. The app now exposes these gaps rather than presenting the original 60–63% cash margin as reconciled guidance.
