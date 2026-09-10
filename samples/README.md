# Offline sample report source

These synthetic, small datasets demonstrate the v1 contract without external services. All labels are short and business ordering is explicit.

**What is supplied:** local CSVs, Power Query `.pq` queries, DAX measure definitions, a [manual report layout recipe](REPORT_LAYOUT.md), and a [fully authored bound offline PBIP generator](PBIP.md). `npm run sample` embeds the exact current `.pbiviz` into five pages with six heatmaps, native matrices and slicers, and a six-table inline-data model.

**Native evidence status:** the coordinator reported Desktop open/refresh, cross-filtering, Save PBIX and reopen with exact embedded-package proof on September 10, 2026. Final native assets are forthcoming for this repository/dossier; see the [attributed status and remaining gates](../docs/VALIDATION.md#coordinator-reported-native-status-september-10-2026). Schema/reference checks alone are not host proof. No fake PBIX is supplied. The instructions below are the alternative manual assembly route, not a requirement to bind fields in the generated project.

## 1. Import local files in Desktop

Copy this entire `samples` directory to a local folder. CSV file names must remain unchanged. No web data source is used.

1. In Power BI Desktop, open **Transform data**. Create a blank query named **SampleFolder** and paste `SampleFolder.pq` into Advanced Editor. Replace the example path with this local folder. Keep its type as Text and disable load.
2. Create blank queries named **ProductRegion** and **DefectLine**. Paste `product-region.pq` and `defect-line.pq`, respectively.
3. Create blank queries named **Product**, **Region**, **Defect**, and **Line**, using the corresponding `.pq` files. Query names matter because the queries and measures reference them.
4. Apply changes. Set these model relationships to **one-to-many, single direction from dimension to fact**, with active relationships:

   | One side | Many side |
   | --- | --- |
   | `Product[Product]` | `ProductRegion[Product]` |
   | `Region[Region]` | `ProductRegion[Region]` |
   | `Defect[Defect]` | `DefectLine[Defect]` |
   | `Line[Line]` | `DefectLine[Line]` |

5. Configure **Sort by column**:

   | Display column | Sort column |
   | --- | --- |
   | `Product[Product]` | `Product[ProductSort]` |
   | `Region[Region]` | `Region[RegionSort]` |
   | `Defect[Defect]` | `Defect[DefectSort]` |
   | `Line[Line]` | `Line[LineSort]` |

   Use dimension fields, not fact-table labels, on the visual axes. Hide sort columns and redundant fact label/sort columns from report view if helpful. Model sort metadata, rather than a CSV's physical row order, controls report ordering.
6. Add each measure in `product-region.dax` / `defect-line.dax` separately via **New measure**. The files contain individual definitions, not a single executable DAX query. Put them in the indicated fact table.
7. Set the currency/count formats specified in the DAX comments. Use the explicit `[Total Revenue]` measure rather than an implicit aggregation of the CSV's `Revenue` column. These are model measure formats; the visual's derived modes display `0.0%` and retain raw format in tooltips.
8. Import an authorized local Atlyn Heatmap `.pbiviz` using **Import a visual from a file**. Follow [REPORT_LAYOUT.md](REPORT_LAYOUT.md). This step is subject to your tenant policy.

The `.pq` queries trim/parse numbers explicitly with `en-US`, preserving empty numeric CSV fields as null rather than zero. They do not fabricate missing records. The samples intentionally contain no malformed numeric strings: invalid/NaN/Infinity states require a host test harness or an appropriately controlled host case, not a deliberately broken CSV import.

## 2. Know the expected states

### Product × region revenue

Rows in model order: **Pumps, Valves, Sensors, Filters**. Columns: **North, West, Central, East**.

- Pumps / North is numeric **zero** (`0`).
- Pumps / West is an explicit null Revenue on an existing record: **BLANK** (`B`).
- Filters / East has **no record**: absent (`-`) only if the host delivers the full axes without a completeness warning. If the host delivers a null entry instead, that entry is BLANK; the visual must honor the delivered model.
- Other numeric observations are positive; known nonnegative additive revenue totals **18,000**. Zeros are observations; blanks/absent records do not contribute invented zeros.
- Pumps / Central is **1,200**. Share of its delivered complete row is **40.0%** (`1,200 / 3,000`); share of all is **6.7%** (`1,200 / 18,000`) before filters.

Raw Revenue is a model sum over additive synthetic sales, not a sum of rates. The additive author toggle is appropriate for this dataset. It is not a blanket recommendation for every revenue measure.

### Defect × production line

Rows: **Scratch, Dent, Seal, Label**. Columns: **Line B, Line A, Line C**.

- Scratch / Line B is numeric **zero**.
- Dent / Line A has an explicit BLANK defect count.
- Label / Line C has no record; the same host-delivery caveat applies.
- Seal / Line B has **4** defects. Explicit **Line Inspection Opportunities** is **200**, so Value / Denominator is **2.0%** without the additive toggle.
- Line opportunities repeat on each recorded defect row: **200** for Line B, **160** for Line A, **100** for Line C. **Do not SUM the repeated Opportunities column** to obtain a line denominator.
- The model's denominator removes the Defect dimension filter and counts each line's opportunity count once. The defect-count measure is additive for this synthetic event-count dataset, but a defect/opportunity rate is not.

The supplied denominator intentionally remains model-defined even when defect categories are filtered or the matrix is partial. Real datasets must model opportunity populations correctly; do not copy `MAX` for facts whose repeated line values are not truly the same exposure count.

## 3. Denominator filter scope

`Product Revenue Across Regions` uses `REMOVEFILTERS('Region')`, preserving the current product and any other applicable model filters while removing **all Region dimension filters**, including its sort key and slicers.

`Line Inspection Opportunities` removes `Defect` dimension filters, then sums one repeated opportunity count per line. It preserves the Line context. Dimension tables avoid accidentally retaining a category sort-column filter or defining the denominator through an incomplete set of loaded visual columns.

Do not use the raw fact label columns as slicers if you expect these dimension-scoped removals to clear them. If you extend the model with dates, batches, or multiple observations, redesign the opportunity measure at the true exposure grain.

## 4. Validate honestly

These tiny datasets do not trigger the 200-row window, 100-column conservative warning, or 20,000-cell bound. Test those with a separate large model in Desktop/Service per [RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md). CSV absence does not guarantee a particular matrix entry representation: inspect the real delivered behavior. Adding a nonblank denominator can cause Power BI to deliver a previously absent combination with a BLANK numerator. The layout recipe leaves Denominator empty for initial raw-state checks, then binds it for the ratio checks.

The manual recipe is local-file based; the generated PBIP embeds the same data in M `#table` expressions and does not require CSV paths. Once dependencies/package are available, the visual needs no external asset or license service. Power BI installation, authentication, tenant policy, or Service itself may still need connectivity. The narrow coordinator-reported Desktop results do not establish fully offline host operation, native PDF/PowerPoint/image export or universal PBIP compatibility.
