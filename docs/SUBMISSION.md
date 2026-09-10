# Submission preparation — not a submission

This is the authored listing/certification dossier. The user has authorized publication, but the parent coordinator owns all live Partner Center actions and native Power BI validation. This child has not submitted or published anything. The owner approved the commercial model below on September 10, 2026; exact storefront/legal/listing fields still require consistency with existing Atlyn terms. This document does not create new terms.

## Approved commercial model

**Storefront subscriptions, ungated visuals.** Acquisition uses existing Atlyn storefront subscriptions outside Power BI. The runtime is ungated, including free shared viewing: it performs no author/viewer subscription check or author-entitlement enforcement. Report sharing/access remains subject to Power BI and tenant policy.

The current offline renderer is intended for this model. Runtime licensing integration is **not a blocker** and must not be added: no ad hoc checks, new signer/keys, AAD/API integration, feature gates, or runtime requests. No runtime repackage or version bump is needed for this documentation-only decision. Historical sealed archives remain unchanged.

Proposed purchase disclosure: "Available through existing Atlyn storefront subscriptions. The Power BI visual runs without license checks; shared report viewing is free. The visual does not enforce author entitlements." The listing owner must map this disclosure to actual portal fields and existing storefront terms; do not invent a portal-enforced subscription or trial.

The existing private npm license identifier is `UNLICENSED`. [LICENSE](../LICENSE) states "Copyright (c) 2026 Atlyn. All rights reserved.", says the original source, documentation and assets are not offered under an open-source license, and makes no additional license grant. Third-party terms remain separate. No first-party relicensing or new customer EULA is part of this decision.

The optional Microsoft Power BI certified badge remains a target subject to Microsoft review, not an awarded status. Remote `main`, certification-ref changes and submission remain held for the coordinator's final gate.

## Fixed identity

| Field | Value |
| --- | --- |
| Product | Atlyn Heatmap |
| Author | Atlyn |
| Contact | atlyn.help@gmail.com |
| Support URL | https://www.atlynco.com/docs/faq |
| Private source repository | https://github.com/AtlynCo/powerbi-heatmap |
| Visual GUID | `atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37` |
| Visual version | `1.0.1.0` |
| Private npm package | `@atlyn/heatmap` `1.0.1` |
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

The release runner audits the exact `.pbiviz` and preserves outcomes with its immutable manifest. A private/uncertified custom visual may be blocked by tenant rules, and export or report sharing may require separate host permissions. Empty privileges is not certification, a tenant-policy exemption, or a blanket assertion about all data processing by Power BI.

## Required real evidence and owner decisions

- [ ] Coordinator approval of final listing screenshots. `dist/submission/screenshots` contains three actual final-package browser renders, 1366x768 PNG, each <=1,024KB, with explanatory callouts and truthful source labels. They are not native captures; replace with matching real Desktop/Service captures if the portal/reviewer requires host chrome or a different presentation. Preserve source/package provenance either way.
- [ ] Real Desktop and Service test reports/results, including selection, host tooltips/report-page tooltips, cell `general.formatString` when supplied or a documented source-format fallback, segmentation, 100-column conservatism, and tenant restrictions.
- [ ] Real keyboard, screen-reader, RTL, high-contrast, and viewport-export results. Browser/host-mock automation alone does not satisfy these.
- [ ] Attach the coordinator's final native PBIX, package proof and dated open/refresh/cross-filter/save/reopen evidence. Those outcomes were reported September 10, 2026; final assets are forthcoming for this dossier. Keep the remaining native test cases separate. Schema/static/TOM checks are not native-host proof, and PBIP alone does not meet the real PBIX requirement.
- [ ] Support URL ownership and availability, mailbox delivery, and evidence of support responsiveness. Do not invent response times or service guarantees.
- [ ] Confirm authority to distribute the original work and all third-party materials. Preserve MIT scaffold attribution and generated `THIRD_PARTY_NOTICES.md`.
- [ ] Authorized owner supplies destination-required legal/privacy/listing documents and permissions consistent with existing Atlyn storefront subscriptions and first-party terms. This document creates no new license, price, purchase mechanism, trial, or support contract; runtime paid integration is not a prerequisite.
- [ ] Complete current Microsoft submission tests, including the Microsoft-provided sample test dataset, native chart/gauge conversion, removal of every field, format pane in each state, supported browsers, multiple instances/versions/pages, dashboard pin, scaling/scroll, bookmarks/save/reopen, mobile and export. Use the actual final package and record failures honestly.

## Submission inventory and immutable baseline

| Asset | Prepared source/output | Acceptance boundary |
| --- | --- | --- |
| Installable package | `dist/<GUID>.1.0.1.0.pbiviz` | Exact bytes/hash in frozen manifest; never silently rebuild after freezing |
| Source | Private repository, review PR, lowercase `certification` branch | Existing certification ref stays at the sealed source; parent approves any final ref movement/reviewer access and must not overwrite a submitted baseline |
| 20px visual icon | `assets/icon.png` | Embedded exact PNG audited against package |
| 300px listing logo | `assets/icon300.png` | Same accurate heatmap design, PNG exactly300x300; not an in-report marketing logo |
| Screenshots | `dist/submission/screenshots/product-region.png`, `defect-line.png`, `scaling-vs-shares.png` | Actual packaged renderer; 1366x768, <=1MB, explanatory callout, browser source label |
| Offline sample | `dist/submission/AtlynHeatmapSample` via `npm run sample` | Bound PBIP/model and embedded package; coordinator reports native conversion/reopen, final PBIX/proof assets forthcoming |
| Evidence | `dist/evidence`, `dist/benchmark*.json`, browser output | Local runner logs and raw observations, not hosted CI or native proof |
| Legal notices | `LICENSE`, `THIRD_PARTY_NOTICES.md` and embedded offline disclosure | Preserve first-party all-rights-reserved/no-additional-grant terms and OSS attributions; align destination EULA with existing storefront terms |

The freeze script requires a clean committed source tree, copies package/assets/evidence into a new immutable directory, and records SHA-256 for every included file, source commit, versions, locales, and open gates. No mutable final-package hash is embedded in source: doing so would create a self-referential commit/build loop. The external immutable manifest binds the pair instead. ZIP timestamps mean future rebuilds need not be byte-identical.

## Exact owner decisions / live fields

| Field or permission | Decision required |
| --- | --- |
| HTTPS privacy-policy URL | Owner-approved public document and working URL; empty privileges does not supply a legal privacy policy |
| License/EULA | Confirm the destination EULA/document matches existing Atlyn customer terms and unchanged `UNLICENSED`/all-rights-reserved source terms; this update grants no new rights |
| Pricing / purchase-required setting | Approved model: existing external Atlyn storefront subscriptions, ungated runtime and free shared viewing. Owner maps actual portal fields/prices to that model; do not promise author enforcement or in-visual paid gating |
| Offer ID, publisher/account, categories and markets | Authorized coordinator selects actual available portal values and account, not invented identifiers |
| Support URL and mailbox | Verify control, reachability and response process; no fabricated support SLA |
| Private source access | Authorized coordinator grants Microsoft's requested reviewer access through the official process; do not make the repository public or create credentials |
| Legal distribution authority | Owner confirms Atlyn original-work rights and third-party redistribution compliance |
| Final review and publication controls | Coordinator supplies native results/PBIX, reviews listing/media, submits for Microsoft review, and records submission ID/status |

## Current official requirements reviewed

- [Certified visuals requirements](https://learn.microsoft.com/en-us/power-bi/developer/visuals/power-bi-custom-visuals-certified): latest API/tooling, required ESLint/npm checks, no moderate/high audit issues, reviewable source, lowercase certification branch matching the package, rendering events, safe code/no external requests.
- [Microsoft-required sample test report](https://github.com/PowerBi-Projects/PowerBI-visuals/tree/gh-pages/assets): coordinator must use this official linked dataset in actual host testing; Atlyn's own examples and mocked fixtures do not substitute for it.
- [Submission testing](https://learn.microsoft.com/en-us/power-bi/developer/visuals/submission-testing): native interoperability, data/binding/layout/performance and report scenarios, including Microsoft's sample dataset.
- [Marketplace submission](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store): actual offline sample PBIX, 300px PNG logo, one to five 1366x768 PNG screenshots <=1,024KB with explanatory text, listing/support/privacy/EULA fields.
- [Publishing guidelines](https://learn.microsoft.com/en-us/power-bi/developer/visuals/guidelines-powerbi-visuals): context menus, correct purchasing disclosures, latest API, no misleading claims; in-report commercial logo restrictions. Atlyn shows the bound measure title, not a promotional logo.

Reviewed September 9, 2026; coordinator must recheck portal requirements at submission. A changed requirement or rejected asset remains an open gate, not a reason to claim approval.

**Certification status: NOT CLAIMED.** No Microsoft certification badge, approval language, or “certified visual” assertion may be used without actual Microsoft approval for the applicable product/version.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for manual blockers and [VALIDATION.md](VALIDATION.md) for automated evidence. An unchecked prerequisite remains open; this document is not evidence that a submission occurred.
