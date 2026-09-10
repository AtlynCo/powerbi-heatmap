# Offline report layout recipe

This is the optional manual assembly recipe after [importing the sample queries and measures](README.md), not a PBIP definition itself. Prefer the separately supplied [bound offline PBIP generator](PBIP.md) to avoid manual field binding. This recipe is not test evidence; the coordinator-reported Desktop outcomes and remaining gates for the generated sample are [tracked separately](../docs/VALIDATION.md#coordinator-reported-native-status-september-10-2026).

Use a 1280 × 720 page canvas. Suggested coordinates and sizes are in canvas pixels; adjust for the host's formatting UI. Import the local `.pbiviz` once, then reuse that one visual type across pages.

## Page 1 — Operations by region

| Element | Position / size | Content |
| --- | --- | --- |
| Text heading | x 24, y 16; 900 × 44 | Operations by region — synthetic revenue |
| Heatmap | x 24, y 76; 960 × 540 | Assign the fields below |
| Product slicer | x 1008, y 76; 248 × 240 | `Product[Product]` |
| Region slicer | x 1008, y 340; 248 × 240 | `Region[Region]` |
| Text note | x 24, y 632; 1232 × 64 | Zero is data; B is BLANK; - is absent only when complete. Colors use loaded data. |

Heatmap binding:

- Row: `Product[Product]`
- Column: `Region[Region]`
- Value: `[Total Revenue]`
- Denominator: leave empty for the initial raw/state check; bind `[Product Revenue Across Regions]` for the denominator walkthrough
- Tooltips: `[Revenue Records]` (one optional measure)

Initial settings: raw normalization, global color scope, sequential blue, values visible, additive assertion **off**. Use the model sort order; turn off any host sort-by-Value override. If an all-BLANK category is suppressed by the host, inspect **Show items with no data** availability, but do not assume the visual can infer missing categories.

Validation walkthrough:

1. Confirm row order Pumps → Valves → Sensors → Filters and column order North → West → Central → East.
2. Inspect Pumps/North (`0`), Pumps/West (`B`), and Filters/East (absent if delivered without a value entry and no completeness warning).
3. Enable **Value is a nonnegative additive measure**, choose share of row, and verify Pumps/Central = 40.0%. Choose share of all and verify 6.7% before filters.
4. Change color scope to per row without changing share-of-all normalization. The number must remain 6.7%; the legend must warn about color incomparability.
5. Bind `[Product Revenue Across Regions]` to Denominator, turn the additive assertion off, choose Value / Denominator, and select only Central in the Region slicer. Pumps/Central remains 40.0% because its model denominator removes the Region dimension filter. A computed share of this one visible column would answer a different question.
6. Return to raw mode before interpreting colors as currency. Select a row/cell and inspect cross-filter behavior using an added native table or chart.

## Page 2 — Defects by line

Use the same positions, replacing the heading with **Defects by line — synthetic counts**. Use a Defect slicer at the right and an optional native column chart beneath it to observe cross-filtering.

- Row: `Defect[Defect]`
- Column: `Line[Line]`
- Value: `[Defect Count]`
- Denominator: leave empty for the initial raw/state check; bind `[Line Inspection Opportunities]` for the denominator walkthrough
- Tooltips: `[Defect Records]`
- Native comparison chart: axis `Line[Line]`, value `[Defect Count]`

Initial settings: raw normalization, global sequential blue, values visible, additive assertion **off**.

Validation walkthrough:

1. Confirm model order Scratch → Dent → Seal → Label and Line B → Line A → Line C.
2. Confirm Scratch/Line B is zero and Dent/Line A is BLANK. Inspect the omitted Label/Line C intersection according to the actual host entry representation.
3. Bind `[Line Inspection Opportunities]` to Denominator and choose Value / Denominator without the additive assertion. Seal/Line B should show **2.0%**, with raw defect count **4** and denominator **200** in its tooltip.
4. Filter the Defect slicer to Seal. The Line B denominator stays **200**, not the sum of retained defect counts and not a repeated-row opportunity sum.
5. For a raw model-ratio comparison, use `[Defects Per Opportunity]` as Value in **raw** mode with the additive assertion off. Do not apply another ratio/share normalization.

## Page 3 — Interaction review (optional)

Duplicate a heatmap at 400 × 220 to force scrolling only if content exceeds that viewport; do not claim these small datasets exercise maximum-density limits. Add a second tiny copy below 180 × 120 to inspect enlargement guidance. Check that responsive sizing reserves data space on small tiles; very large font settings may require enlargement even above the baseline.

Use keyboard-only navigation, Shift+F10, Ctrl/Cmd selection, Escape, and a native companion chart. Test high contrast, RTL, screen readers, host tooltips/report-page tooltips, and export through the actual host. Capture real screenshots only after importing the candidate package.

Save the report locally after validation. A supported Desktop **Save as Power BI Project** flow may be used by the tester if available; validate its custom-visual references and refresh paths before distributing it. This manual recipe is independent of the generated PBIP documented in [PBIP.md](PBIP.md).
