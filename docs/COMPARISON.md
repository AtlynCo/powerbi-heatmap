# Evidence-based comparison

Public documentation reviewed September 9, 2026. These are documented capability comparisons, not hands-on competitor benchmarks. Vendor claims have not been independently measured. No market-leadership or certification claim is made for Atlyn.

| Author task | Native Matrix | Powerviz Heatmap | Deneb | Atlyn Heatmap 1.0.1.0 |
| --- | --- | --- | --- | --- |
| Encode a measure with color | Gradients, custom min/max/midpoint, rules, field-value colors and blank formatting [1] | 30+ palettes, accessibility-safe options, data classes/custom color fields [2] | Vega/Vega-Lite JSON specification authored in the visual [3] | Two fixed sequential/diverging palettes; global/row/column scope separated from calculation |
| Totals and broader layouts | Conditional formatting supports totals/subtotals [1] | Row/column totals with bars, small multiples, reference lines and shapes [2] | Specification-dependent; broad declarative design flexibility [3] | Intentionally no totals, small multiples, reference lines, or freeform editor |
| Explain a percentage | Docs distinguish percent of numeric range from a percentage-valued measure [1] | The reviewed product page does not establish denominator/missing-state semantics; unknown, not asserted absent [2] | Author must specify relevant calculations/encodings [3] | Raw default; nonadditive safeguards; explicit additive consent or supplied positive model denominator; source-state markers preserved |
| Interact with Power BI | Native host integration | Product page is not detailed host conformance evidence | Integration supported with additional setup [3] | Model node identities, row/column/cell selection, tooltips/context APIs exercised locally; native host proof still pending |
| Certification/readiness | Native feature | Not evaluated in this review | Deneb's documentation states it is certified [3] | Not certified; private candidate, local evidence and owner/native submission gates |

**Concrete demonstrated strengths:** checked-in examples exercise zero vs BLANK vs absent, loaded-only domains and blocked incomplete computed shares, and 4/200 = 2% model-denominator rates without summing repeated exposures. Local regressions exercise identity-preserving focus, bounded 20,000-cell rendering, per-group warnings after interaction, high-contrast numeric visibility, and host failure notices. These are evidence for Atlyn's explicit contract, not proof competitors lack the same capability.

**Remaining gaps:** only two palettes; no user research measuring author success/error rates; no measured competitor performance; no independent color-vision-deficiency user study; no native screen-reader, mobile, persisted bookmarks, real-host exports or certification evidence yet. Numeric labels, symbols, blue/orange divergence and contrast tests reduce color-only dependence, but do not establish universal accessibility. The native Matrix is the appropriate baseline when subtotals, drilldown, established native support, or sophisticated report integration are needed. Deneb is the stronger documented choice for programmable layouts; Powerviz documents considerably broader styling and summary features.

## Sources

1. Microsoft, [Conditional formatting in tables and matrices](https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-conditional-table-formatting). Gradients/rules/field values, totals, blank formatting; percentage-range warning. Documentation, not a measured usability study.
2. Powerviz, [Heatmap](https://powerviz.ai/heatmap). The current page's server-provided product content lists Shapes, Data Color, Data Label, Reference Lines, Totals, Small Multiples and Conditional Formatting. Old `/power-bi-heatmap/` links returned 404; no unsupported lasso claims were carried forward.
3. Deneb, [Introduction, version 2.0](https://deneb.guide/docs). Packaged libraries, client rendering, Vega/Vega-Lite JSON authoring and Power BI integration with additional setup. The earlier `deneb-viz.github.io` domain redirects to this site.
