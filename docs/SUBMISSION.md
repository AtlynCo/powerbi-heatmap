# Submission preparation — not a submission

This document is listing/evidence source only. No public release, repository publication, Partner Center action, commercial offer, or Microsoft certification is authorized or claimed.

## Fixed identity

| Field | Value |
| --- | --- |
| Product | Atlyn Heatmap |
| Author | Atlyn |
| Contact | atlyn.help@gmail.com |
| Support URL | https://www.atlynco.com/docs/faq |
| Private source repository | https://github.com/AtlynCo/powerbi-heatmap |
| Visual GUID | `atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37` |
| Visual version | `1.0.0.0` |
| Private npm package | `@atlyn/heatmap` `1.0.0` |
| Host API contract (`apiVersion`) | `5.11.0` |
| `powerbi-visuals-api` SDK npm package | `5.11.1` |
| Visuals tools / TypeScript | `7.2.1` / `5.9.3` |
| Development Node.js | `>=22` |
| UI resources | English, via host localization manager |
| Original work | All rights reserved to Atlyn; see [LICENSE](../LICENSE) |

Contact and private repository details come from product metadata. They are not a verified support-response commitment.

The official tools normalize the supported host API contract to `5.11.0`; this is distinct from the installed `powerbi-visuals-api` SDK npm package version `5.11.1`. Manifest and package auditing use the host contract value.

## Proposed description

**Short:** Compare categorical measures in a row-by-column heatmap with explicit color scales, distinct missing-data states, and model-backed selection.

**Long:** Atlyn Heatmap displays a numeric measure across one row category and one column category. Use it to compare product revenue by operating region or defect counts by production line. Separate global, per-row, or per-column color scopes from raw values, optional additive shares, or a ratio using an explicitly supplied model denominator. Sequential blue and zero-centered blue–neutral–orange diverging scales support comparison; per-group legends explain when colors are not comparable across groups.

The visual distinguishes zero, BLANK, invalid, absent, and unknown/unloaded intersections, with a visible missing-state key. Sticky headers, keyboard navigation, model-backed selection, host tooltips, high-contrast presentation, and RTL layout support analysis of the bounded grid. Display labels/tooltips are capped at 1,024 characters with `...` when shortened; full original model identities are preserved. Manual row loading and clear completeness warnings prevent an incomplete matrix from masquerading as a complete one.

**Important limitations:** 500 rows, 100 columns, and 20,000 dense cells maximum; row capacity decreases with column count. Exactly 100 returned columns is conservatively flagged possibly reduced. Computed shares require an explicit nonnegative-additive author assertion and complete data; explicit positive-denominator ratios remain usable on partial data without that assertion. Up to three numeric or text measures can supply tooltip context. Small tiles may reduce requested label/cell sizes; very large fonts can require more than the 180 × 120 baseline. No totals, hierarchy drilldown, inferred categories, correlation, clustering, calendar, writeback, spreadsheet editing, licensing service, or backend. Export is current viewport only, not the full scrolled matrix. Host support and accessibility claims require the evidence below.

**Proposed discovery themes:** Analytics; comparison; categorical heatmap; matrix/table. These are descriptive suggestions, not asserted current marketplace category identifiers. TODO: the authorized listing owner must choose categories actually available in the destination portal. Do not categorize it as a statistical correlation tool, calendar heatmap, or editable spreadsheet.

## Privacy and permissions declaration

The v1 architecture is one visual with **empty privileges**, no runtime network calls or external runtime assets, no telemetry, no backend/license service, no `eval`, and no unsafe HTML. No special visual privileges are requested; normal Power BI host processing and organization policies still apply.

TODO: verify this declaration against the final `.pbiviz` and record package evidence in [VALIDATION.md](VALIDATION.md). A private/uncertified custom visual may be blocked by tenant rules, and export or report sharing may require separate host permissions. Empty privileges is not certification, a tenant-policy exemption, or a blanket assertion about all data processing by Power BI.

## Required real evidence and owner decisions

- [ ] Real screenshots from the final package in Desktop/Service: product × region, defect × line, legend/state disclosure, and the relevant small/high-contrast view. Record version/hash. No generated or placeholder image counts as evidence.
- [ ] Real Desktop and Service test reports/results, including selection, host tooltips/report-page tooltips, cell `general.formatString` when supplied or a documented source-format fallback, segmentation, 100-column conservatism, and tenant restrictions.
- [ ] Real keyboard, screen-reader, RTL, high-contrast, and viewport-export results. Browser/host-mock automation alone does not satisfy these.
- [ ] Offline sample recipe replay in Desktop. Source currently consists of CSV + Power Query + DAX + layout instructions; no validated PBIP or PBIX is supplied.
- [ ] Support URL ownership and availability, mailbox delivery, and evidence of support responsiveness. Do not invent response times or service guarantees.
- [ ] Confirm authority to distribute the original work and all third-party materials. Preserve MIT scaffold attribution and generated `THIRD_PARTY_NOTICES.md`.
- [ ] Authorized owner supplies any destination-required legal/privacy/listing documents and permissions. This document creates no commercial license, pricing, purchase mechanism, trial, or support contract.
- [ ] Recheck current Microsoft submission/certification requirements through official sources when an authorized submission is actually planned. Record decisions and outstanding gaps; do not substitute local lint/package checks for Microsoft review.

**Certification status: NOT CLAIMED.** No Microsoft certification badge, approval language, or “certified visual” assertion may be used without actual Microsoft approval for the applicable product/version.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for manual blockers and [VALIDATION.md](VALIDATION.md) for automated evidence. An unchecked prerequisite remains open; this document is not evidence that a submission occurred.
