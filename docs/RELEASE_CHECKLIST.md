# v1 release checklist

Unchecked boxes are **unverified blockers** until supported by dated evidence for the exact candidate package. Do not check a host gate based on a mocked host or standalone browser screenshot. The parent coordinator owns authorized publication and Partner Center actions; this child prepares local artifacts only. GitHub Actions remains disabled, no workflows are present, and no hosted CI results count as current release proof.

Record automated outcomes in [VALIDATION.md](VALIDATION.md), including failures and environmental limitations. For manual evidence, record tester, date, Desktop/Service/browser version, OS, locale, tenant settings, candidate version/hash, source report, expected result, actual result, and evidence location. Do not capture customer data.

Owner-approved commercial model (September 10, 2026): existing Atlyn storefront subscriptions, ungated runtime and free shared viewing, with no author-entitlement enforcement. Runtime licensing integration is not a gate. Preserve existing first-party/third-party terms and the offline runtime; see [SUBMISSION.md](SUBMISSION.md). Official Microsoft Power BI certification is owner-required in addition to general Marketplace review; the actual grant remains pending and no badge is claimed. Main, certification-ref movement and submission remain coordinator-held.

The coordinator reports native Desktop open/refresh, cross-filtering, Save PBIX and reopen with exact embedded-package proof; final assets are forthcoming. Record that narrow [attributed status](VALIDATION.md#coordinator-reported-native-status-september-10-2026) without checking off broader cases before their evidence is reviewed.

## Artifact and automated evidence

- [ ] Confirm GUID `atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37`, `.pbiviz` version `1.0.3.0`, private package `@atlyn/heatmap` `1.0.2`, host API contract (`apiVersion`) `5.11.0`, `powerbi-visuals-api` SDK npm package `5.11.1`, visuals tools `7.2.1`, TypeScript `5.9.3`, and Node `>=22`. Official tools normalize the supported host contract to `5.11.0`; verify the manifest and package audit use that value rather than the npm package version.
- [ ] Record results of `typecheck`, `lint`, `test`, `package`, `audit:package`, and `test:browser` for the candidate. Check what `validate` actually runs rather than assuming coverage.
- [ ] Run/record full `npm audit` and `audit:dependencies` separately; assess production advisories and packaged runtime exposure. Confirm the development-only `qs` `6.16.0` and `sockjs` → `uuid` `11.1.1` mitigations in the lockfile/dependency graph. Do not equate a production-only audit with auditing every development tool; record dated vulnerability counts in `VALIDATION.md`.
- [ ] Generate/check `THIRD_PARTY_NOTICES.md`, including the MIT scaffold attribution and applicable bundled-component licenses. Confirm original Atlyn work remains all rights reserved.
- [ ] Verify the Node build/package wrapper invokes official `pbiviz package --all-locales --no-stats`, retains offline locales to avoid the SDK ESM locale-pruning incompatibility, and applies no `node_modules` patch.
- [ ] Verify ignored `.tmp\tool-home` isolation and file-only ephemeral certificate setup: PowerShell 7 (`pwsh`) with .NET `CertificateRequest` on Windows, OpenSSL on Linux/macOS. Verify named certificate/private-key/password files are removed after success and failure; no certificate-store mutation or trust is established. Record which platforms were actually exercised.
- [ ] Regenerate `stringResources\en-US\resources.resjson` from canonical `src\strings.json` with `npm run resources`; check start/build/package pre-hooks and packaged localization resources.
- [ ] Inspect the distributable for exactly one visual, empty privileges, packaged icon/resources, English localization-manager resources, no runtime network/external assets, `eval`, unsafe HTML, telemetry, licensing, or backend.
- [ ] Record package filename and cryptographic hash. Ensure screenshots and tests refer to that same artifact, not a development-server build.

## Native Power BI Desktop

- [ ] Import the actual `.pbiviz` from disk into the supported Desktop version. Open/save/reopen the sample report without a development server. Check normal view, focus mode, resizing, filters, and slicers.
- [ ] Run Microsoft's current submission-test sample dataset in Desktop/Service. Record arbitrary bucket removal and native chart/gauge conversion, format pane state, saved settings/bookmarks, multiple versions/instances/pages, touch/mobile interaction and dashboard pin results.
- [ ] Bind exactly one Row, one Column, and one numeric Value; verify the optional single numeric Denominator and at most three numeric or text Tooltip measures. Check invalid binding guidance rather than assuming role enforcement.
- [ ] Validate both [offline source recipes](../samples/README.md), custom model sort order, explicit zero, BLANK, and an absent intersection. Verify that absent source data is not changed to zero.
- [ ] Check subtotal exclusion and unsupported hierarchy inputs. Confirm no accidental totals, drilldown behavior, or invented categories.
- [ ] Verify model formatting, including currency, counts, negative values, and dynamic format strings that vary **by cell** (use a calculation group/measure if necessary). Check `general.formatString` overrides in raw cells, accessibility, and raw tooltip values when the host supplies cell metadata; check source-measure fallback when it does not. Legends must use measure metadata rather than a cell override; derived percentages retain `0.0%`. If a host provides no supported cell-level dynamic format path, document that limitation explicitly; do not claim universal cell-level dynamic format support.

## Power BI Service and tenant policy

- [ ] In an authorized test tenant only, verify the same package/report in Service edit and reading views, including reload and supported browser behavior. This is validation, not permission to publish/distribute publicly.
- [ ] Record organizational/custom-visual restrictions: importing private visuals, uncertified visual restrictions, organization store policy, report sharing/access, and export permissions. No privilege request bypasses tenant policy.
- [ ] Verify tooltip, selection, formatting, high contrast, and resize behavior in Service rather than transferring Desktop results.
- [ ] Test the packaged runtime without reliance on internet-hosted visual assets or a license/backend endpoint. Power BI itself and Service authentication may still require connectivity.

## Real host matrix continuation and limits

- [ ] Use a real report large enough for `metadata.segment`. Verify row window 200, column top 100, a **manual** Load more rows button, and aggregated `fetchMoreData(true)` behavior. Verify subsequent updates actually grow the model without duplicating rows or losing identities.
- [ ] Test 500-row, 100-column, and 20,000-cell boundaries, including the shrinking row bound: 100 columns permits only 200 rows.
- [ ] Verify exactly 100 delivered columns warns **possibly reduced**, even without a segment. Verify more than 100 source columns cannot be misrepresented as complete.
- [ ] Verify segments, rejected requests, no-progress responses, and hard bounds stop appropriately with a truthful incomplete warning. If a host failure cannot be reproduced natively, record that gap alongside mocked coverage.
- [ ] Verify unknown `?` for undelivered intersections when partial and absent `-` only without completeness warnings. Explicit `B`, `0`, and `!` must retain their meanings.
- [ ] Check only computed row/column/all shares are blocked by partial/reduced data, including exactly 100 delivered columns. Check invalid/negative group blocking, BLANK exclusion, and zero-total unavailability on complete data.
- [ ] Verify explicit positive denominator ratios still work on partial data and without the additive toggle; missing/BLANK/zero/negative/nonfinite denominators never become inferred totals.

## Selection, tooltip, and host integration

- [ ] Validate row/column/cell selection against a second report visual; verify Ctrl/Cmd multi-selection, cross-filtering, and incoming host highlights.
- [ ] Validate Escape, Clear selection, and blank-background clearing without unintended re-selection.
- [ ] Validate host selection identities with duplicate displayed labels and model sort keys. Test labels/tooltips longer than 1,024 characters: display is capped with `...`, but full original identities and selections remain unchanged.
- [ ] Validate raw tooltip formats, supplied denominators, up to three numeric or text extra measures, and raw highlighted values. Text Tooltip measures remain valid plain text; invalid numeric Value/highlight values must not appear numeric.
- [ ] Validate native tooltip service, title fallback, and configured report-page tooltips in the supported hosts. Document unsupported report-tooltip behavior rather than claiming it.
- [ ] Verify Shift+F10/context menu carries the intended model identity.
- [ ] Confirm base colors/domains stay fixed on scrolling, selection, and highlight; filters/fetches may change loaded-data domains. Check exact active-group bounds and color-incomparability warning.

## Keyboard, screen reader, RTL, and layout

- [ ] Keyboard-only pass in Desktop **and** Service: Tab entry/exit, roving focus, arrows, Home/End, Ctrl+Home/End, PageUp/PageDown, Enter/Space, modifiers, Shift+F10, Escape, and focus visibility after scrolling/update.
- [ ] Real screen-reader pass (record assistive technology/version): table headers, focused cell coordinates, raw/derived value and state, incomplete warnings, controls, selection state, and legend meaning.
- [ ] Host high-contrast pass: host palette used, numbers/symbols forced visible, distinguishable focus/highlight/selection, no color-only state communication. Check that the missing-state key stays visible and hiding values does not hide zero/missing-state symbols.
- [ ] RTL pass in a real supported host/locale: logical sticky edges, labels, scroll direction, and reversed horizontal navigation. English resources do not imply translated UI.
- [ ] Reduced-motion pass and verification that the visual has no animations.
- [ ] Check below 180 × 120 requests enlargement; check responsive reduction of requested label/cell sizes reserves actual data space on small tiles. Test very large fonts, which may require more than the baseline 180 × 120. Check larger dense matrices scroll in one region with sticky headers, bounded labels, and no overlapping controls.

## Export and evidence

- [ ] Test actual supported Power BI PDF/PowerPoint/image export paths and record host/tenant availability. Export **only the current viewport**; do not promise the entire scrolled matrix.
- [ ] Test scrolled and unscrolled states: clipping, sticky headers, selected/highlighted states, high contrast, fonts, warnings, and tiny-size guidance. Record if a host export path resets scrolling or otherwise differs from the live viewport.
- [ ] Capture real package-in-host screenshots for the product-region and defect-line scenarios, including a state/legend example; no mockups labeled as product screenshots.
- [ ] Open and refresh the generated bound offline PBIP, inspect its exact embedded package, and save a genuine PBIX. Do not equate schema/reference checks with successful Desktop loading.
- [ ] Verify support link ownership/availability, mailbox delivery, and actual support responsiveness. Metadata alone is insufficient.
- [ ] Complete [SUBMISSION.md](SUBMISSION.md) evidence/permission TODOs. Microsoft certification is **not claimed** and remains a separate Microsoft process.
- [ ] During authorized submission, the coordinator must select **Request Power BI certification** to satisfy the owner's required additional official review. Retain evidence of the selection, submission ID and certification-review status; general Marketplace review alone does not satisfy this requirement, and submission is not a certification grant.
