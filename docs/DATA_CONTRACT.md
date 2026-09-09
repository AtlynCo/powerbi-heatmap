# Atlyn Heatmap v1 data contract

This is the intended v1 behavior. Evidence of implementation and host validation is recorded separately in [VALIDATION.md](VALIDATION.md) and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md). A browser harness does not establish Power BI host behavior.

## Roles and host model

| Role | Cardinality/type |
| --- | --- |
| Row | Exactly 1 categorical field |
| Column | Exactly 1 categorical field |
| Value | Exactly 1 numeric measure |
| Denominator | Optional, at most 1 numeric measure |
| Tooltips | Optional, at most 3 numeric or text measures |

Use matrix mapping with a row `window` count of 200 and column `top` count of 100. These are host reduction requests, not guarantees that all report categories were delivered. Preserve delivered order, model formats, and node identities. Do not sort by value, infer category members, infer combinations outside delivered axes, or manufacture identities from labels.

Display labels and tooltip text are bounded to 1,024 characters, including `...` when truncated. This presentation limit does not truncate or replace original model selection identities. Distinct identities must remain distinct even when shortened labels look the same.

Raw cell values, accessible values, denominators and each tooltip measure honor their own cell-level `general.formatString` metadata **when the host supplies it**; otherwise fall back to that measure's supplied source format. Legends use measure metadata rather than an individual cell's override. Derived percentages retain their `0.0%` format. Do not infer a dynamic cell format from formatted text, another cell, or a category label. Real Desktop/Service delivery and fallback behavior remain manual validation requirements.

Ignore subtotal nodes on both axes. No totals or hierarchy drilldown are displayed. Use one field per axis, rather than treating hierarchy levels or subtotal nodes as data cells. Model measures supply aggregation; the visual does not sum precomputed ratios.

## Completeness and manual pagination

1. Render the valid delivered axes and their bounded dense intersections.
2. When `metadata.segment` exists and bounds allow growth, expose **Load more rows**. Each deliberate activation requests `fetchMoreData(true)`; aggregation belongs to the host. Do not auto-fetch.
3. Stop at 500 rows, 100 columns, or 20,000 dense cells. The effective row bound is the smaller of 500 and `floor(20000 / returnedColumnCount)` for a nonempty column axis. At 100 columns, only 200 rows fit.
4. Stop if fetching is rejected, throws, or fails to make progress. Filling unknown intersections counts as progress even without additional axis categories. Keep the actual refusal/failure reason across resize. Do not retry indefinitely or announce complete data.
5. A segment, truncation, rejected/no-progress continuation, or other reduction warning means completeness is uncertain. A returned count of **100 columns always triggers a conservative “possibly reduced” disclosure**, even when no segment exists; an exactly-100-column complete model is indistinguishable from capped columns here.
6. Keep incomplete/reduced disclosure visible; explain whether a limit or continuation failure prevents further loading. Do not label a locally bounded matrix “all data.”

Completeness is relative to delivered axes, not proof that every category in the underlying model exists in the visual. Even without a warning, the visual cannot reconstruct categories or combinations not represented by those axes.

## Cell states

These are **Value** states. Text is valid in optional Tooltip measures and is displayed as bounded plain text; it is not a valid numeric Value or Denominator.

| Delivered/intersection state | Classification | Display |
| --- | --- | --- |
| Finite number other than zero | Observed numeric value | Source-formatted number, or derived percentage |
| Finite numeric zero | Observed zero | `0`, never mistaken for missing |
| Explicit null/BLANK | BLANK | `B` |
| String, NaN, Infinity, or other nonnumeric/nonfinite value | Invalid | `!` |
| No value entry at an intersection of delivered axes; no completeness warning | Absent | `-` |
| No value entry at an intersection of delivered axes; incomplete/reduced warning | Unknown/unloaded | `?` |
| Numeric numerator for which the requested derived calculation cannot be used | Derived unavailable | `n/a` |

A numeric-looking string is still invalid. Do not parse or coerce it to a number. Never fill BLANK, absent, or unknown cells with zero. An explicit null remains BLANK on a partial matrix; an explicit invalid value remains invalid. In derived modes, preserve these source-state distinctions instead of turning every nonnumeric source cell into `n/a`. Malformed matrix wrappers and duplicate measure indexes are structural errors for the whole returned matrix, not a license to guess which measure was intended.

In raw mode a negative finite value is valid. Zero is data even when a requested normalization has no valid result: `n/a` represents that unavailable calculation, with raw zero still identified in the accessible label/tooltip. Zero and missing-state symbols remain visible when numeric-value display is turned off.

Keep the missing-state key visible so `B`, `0`, `-`, `!`, `?`, and `n/a` can be interpreted without relying on color or a tooltip.

## Calculation is independent of color scope

Color scope is **global / per row / per column**. Normalization is independently **raw / share of row / share of column / share of all / Value divided by supplied Denominator**. Changing color scope must not change a cell's numeric calculation.

### Raw

Use the model's numeric Value unchanged with its source format. This is the default and supports signed/nonadditive measures. Do not aggregate Value a second time or add ratios across cells.

### Computed shares

The report author must explicitly enable **“Value is a nonnegative additive measure”**. That is a semantic assertion the visual cannot verify. For example, additive nonnegative revenue or counts can qualify; an average, rate, ratio, or distinct count generally cannot.

- Computed row/column/all shares are unavailable for the entire partial/reduced matrix, including the conservative 100-column case. This restriction does **not** disable ratios using an explicitly supplied positive denominator.
- For complete matrices, the group is the row, column, or whole loaded matrix specified by normalization, not by color scope.
- The denominator is the sum of finite, nonnegative observed Value cells in that group. BLANK and absent entries are excluded, not filled with zero.
- Any invalid or negative Value in the group blocks shares for that group. A row error need not block a different row in share-of-row mode; share-of-all uses one group.
- A zero, nonfinite, or otherwise unusable group total makes that group's numeric shares unavailable.
- Preserve BLANK/absent/invalid source markers. Numeric cells whose shares are blocked show `n/a`.

Display computed shares as `0.0%`. Retain the raw Value and source format in the tooltip. Shares describe observed values within the delivered axes, not an inferred population.

### Supplied denominator

Divide a finite numeric Value by that cell's explicitly supplied finite, **positive** Denominator. This mode does not require the additive assertion and can operate on a partial matrix. Finite signed numerators are allowed. Never infer a denominator from row/column totals, tooltip measures, missing cells, or a neighboring cell.

A missing, BLANK, zero, negative, nonfinite, or nonnumeric denominator makes the derived result unavailable. A nonfinite division result is unavailable too. A nonnumeric numerator retains its source-state marker.

The DAX measure defines denominator scope. For example, `REMOVEFILTERS('Region')` can remove region filters while preserving product and other applicable context. That is different from dividing by the sum of the loaded columns and intentionally removes region slicers as well. Show the supplied denominator and raw numerator in the tooltip; display the ratio as `0.0%`. Nothing in this mode guarantees that the result is a part-to-whole share or lies between 0% and 100%.

## Color, highlights, and legends

- Sequential palette: blue. Diverging palette: blue–neutral–orange with a symmetric zero-centered domain.
- Derive domains from eligible numeric displayed values over the **loaded data** in the selected color scope, not only visible/scrolled cells.
- Selection and host highlight do not change base domains or colors. Filtering or loading data can change them.
- With per-row/per-column color, warn that equal colors across groups need not represent equal values. The focused/hovered group's legend exposes its exact domain bounds.
- Source states and unavailable calculations are not silently incorporated as zero.
- Host highlights use dots/outlines over unchanged base colors. Tooltips identify raw highlighted values separately from raw/base values; invalid highlights are not represented as numeric amounts.
- In host high contrast, use the host palette and force numbers plus symbols instead of relying on the analytical palette alone.

## Interaction and presentation

Use a bounded, nonvirtualized HTML table, one scroll region, and CSS sticky row/column headers. Accessible labels distinguish row, column, formatted raw/derived values, and source state. Use roving focus.

| Input | Behavior |
| --- | --- |
| Arrow keys | Move cell focus; reverse horizontal movement in RTL |
| Home / End | First / last cell in current row |
| Ctrl+Home / Ctrl+End | First / last cell in the matrix |
| PageUp / PageDown | Page navigation within the grid |
| Enter / Space | Select focused cell |
| Ctrl/Cmd with selection | Model-backed multi-selection |
| Shift+F10 | Context menu for focused model-backed selection |
| Escape / Clear selection / visual background | Clear selection |

Rows, columns, and cells use model-backed selection identities. Tooltips use host tooltip support and a title fallback. Report-page tooltip integration and context-menu behavior require real host evidence.

Use logical sticky positioning for RTL. Do not animate; respect reduced motion. Below 180 × 120 pixels require enlargement. This is a baseline, not a guarantee that every font setting fits: very large fonts can require a larger tile. Responsive layout reduces requested label/cell sizes on small tiles to reserve actual data space; when usable space exists, expose scrolling if data exceeds the viewport. Export is limited to the current viewport, **not a full scrolled-matrix export**.

## Deliberate exclusions

No statistical correlation, clustering, calendar interpretation, writeback, spreadsheet editing, licensing flow, backend, or telemetry. One visual, empty privileges, no runtime network calls or external assets, no `eval`, and no unsafe HTML. English localization is supplied through the host localization manager; this is not a claim of translated locale coverage.
