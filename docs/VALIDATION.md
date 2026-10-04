# Local release-quality evidence

This is engineering evidence for 1.0.3.0, **not Microsoft certification, native Power BI validation, or Marketplace submission**. GitHub Actions is disabled; no workflow or hosted CI result is required or used. The retained immutable release manifest identifies the exact source commit, package bytes, tooling, assets, and command logs.

## Reproduce locally

Use Node >=22, PowerShell 7 on Windows, and the pinned lockfile. Run `npm ci`, `npm run notices`, `node scripts/icon.mjs`, then `npm run validate:release`. If Chromium is missing, install it using the existing `npx playwright install chromium` tooling. The release runner stops on any failure, records each command's output and outcome under ignored `dist/evidence`, packages with the official certification audit, and tests that exact package.

The sample stage authors five bound pages/six heatmaps with native matrices and slicers and verifies 47 JSON documents against 13 pinned Microsoft schemas. AJV is an explicit, pinned development dependency. Schema validation downloads public definitions only; it does not upload source or report data, execute hosted CI, or introduce visual runtime requests. `sample-validation.json` retains every schema source/hash and the package hash.

### Recorded release run: September 9, 2026

| Gate | Actual outcome |
| --- | --- |
| Clean pinned install (`npm ci --ignore-scripts`) | Passed; no dependency lifecycle scripts needed |
| Strict typecheck / required ESLint command | Passed |
| Numerical, matrix, oracle, settings and sample tests | 62 passed |
| Official SDK package/build with certification audit | Passed; no external requests found |
| Package metadata, capabilities, icons, resources, notices and static audit | Passed |
| Actual packaged Chromium regressions and screenshots | 22 passed |
| Full / production dependency audits | Production audit: 0 vulnerabilities; Full dev audit: 6 high vulnerabilities via dev-dependency SDK powerbi-visuals-tools 7.2.1 -> braces <=3.0.3 (GHSA-vfj7-8cjw-p6xm, unpatched upstream) |
| Bound offline sample generation / validation | 61 files, five pages, six heatmaps; 47 JSON documents / 13 pinned schemas passed |
| Native Power BI / PBIX / Marketplace certification | Not performed by this local runner; subsequent coordinator-reported status is recorded below |

Run performance separately, without builds or other stress work in this checkout:

```powershell
$env:HEATMAP_BENCHMARK = '1'
npx playwright test benchmark.spec --output .tmp\benchmark-results
Remove-Item Env:\HEATMAP_BENCHMARK
```

`HEATMAP_PACKAGE` optionally selects an immutable earlier package; `HEATMAP_BENCHMARK_OUTPUT` selects a different JSON result file. Defaults use current `pbiviz.json` metadata and `dist/benchmark.json`. This uses Playwright's existing TypeScript runner, not a development-server renderer.

## Meaningful quality changes

The release review reproduced and corrected synchronous host selection/context/fetch exceptions, loss of a fetch-refusal explanation on resize, loss of the per-group color-incomparability warning after focusing a cell, coordinate-based focus moving to a different category after model reorder, and faded selection/highlight text undermining palette contrast. Host failures remain explicit; old-query promise rejections cannot replace current-query status. Details retain their expanded state, focus is restored by model identity, and independent visual instances do not share selection state or steal each other's toolbar focus. English fallback prose now keeps readable direction inside RTL reports without changing logical sticky-header direction; duplicate binding-error notices are removed.

Touch contact no longer opens a mouse-hover tooltip during a scroll gesture. Native tap/long-press/report-page tooltip behavior still requires mobile/host testing. Cells retain full numeric text contrast when excluded; dashed borders and highlight dots distinguish states without changing base domains. Keyboard selection ignores repeated keydown events. Formatting results have a bounded per-instance cache; accessible/title descriptions are computed once per cell rather than twice. No virtualization or statistical semantics were introduced.

Independent numerical review corrected close-large-domain interpolation, lost small summation contributions, and double rounding of representable subnormal shares. Denominator/tooltip cell formats now survive decoding and rendering independently. Malformed wrappers and duplicate measure indexes fail closed instead of exposing an arbitrary measure/highlight. Oversized source/hierarchy metadata is rejected before traversal. Seeded independent matrix fixtures vary physical subtotal slots, source order, category order, and duplicate captions; BigInt rational oracles verify group rules independently from production arithmetic. Segments filling unknown intersections count as progress even when axis dimensions do not grow.

## Evidence boundaries

The browser suite extracts JS/CSS from the actual `.pbiviz`, registers its plugin, and supplies deliberately mocked matrix/host APIs. It checks model-backed selection calls, rejected and throwing host operations, formatting replay during progressive binding, independent locales/instances, disposal, render lifecycle, actual sample arithmetic, loading/refusal/stall/reset transitions, high contrast/RTL, reduced motion, literal user text, zero requests, and a 20,000-cell cap. Numerical and independent oracle cases are in `tests/data.test.ts`, `tests/analysis.test.ts`, and `tests/oracle.test.ts`.

Geometry and real browser images cover **80x80, 258x198, 398x298, 1280x620, and 1366x768**, long labels and last-cell scroll offsets. The 80x80 result intentionally requests a larger tile. Large fonts can require larger tiles. Header/footer disclosures are independently scrollable on constrained tiles; not every disclosure fits simultaneously. Listing images are actual package renders using the checked-in product-region/defect-line CSVs, with explicit explanatory callouts and a browser/mock-host source label, not fabricated Desktop captures.

## Performance methodology and objectives

`tests/browser/benchmark.spec.ts` uses deterministic `matrixFixture` data: 16x12 (192), 50x40 (2,000), and 200x100 (20,000) cells. Every intersection has value `(row+1)*(column+1)*100.5`, a denominator, and a tooltip. Two warm-ups and 20 measured samples per operation, one sequential browser page, no CPU throttling. Raw sample arrays and nearest-rank p50/p95/max are retained, not just favorable aggregates.

Timing begins inside Chromium immediately before update/click/scroll and ends after two animation frames. This includes local DOM/layout and a paint opportunity; it is not a GPU presentation timestamp. Selection includes only the mock host and local repaint, not DAX/query/cross-filter completion. Resize alternates 1280/1366 width. A fresh Data update is measured separately from Resize. Scrolling moves to both extremes and does not recompute domains.

Objectives: normal report tiles should render at p95 <=200 ms (2,000 cells) and complete selection/scroll feedback at p95 <=100 ms; the contractual maximum should render/resize at p95 <=2,000 ms and selection/scroll at <=200 ms. These are useful task budgets (compare a report tile, move focus/select a category, inspect a dense matrix), not guaranteed SLAs or evidence of market leadership. The 20,000-cell DOM is intentionally bounded but not virtualized; heavy dense-table work remains a limitation.

Machine: shared Windows VM, AMD EPYC 7763 presented as 16 logical processors. Actual memory/OS/Chromium/Node versions and free memory at completion are recorded in each JSON. Other users/processes are not controlled. Do not claim an isolated benchmark or infer native/competitor speed. Review raw outliers and repeat separately if contention makes results unstable.

Final run at 22:38 UTC: Windows 10.0.26200, 68,665,831,424 bytes guest RAM, Chromium 153.0.8010.12, Node 24.17.0. Times below are milliseconds; all stated **p95** objectives were met. The raw JSON, exact package hash and all 20 samples per cell-count/task are in the immutable evidence bundle.

| Cells | Task | p50 | p95 | Max |
| --- | --- | ---: | ---: | ---: |
| 192 | Render | 35.2 | 42.8 | 43.7 |
| 192 | Resize | 34.4 | 40.0 | 41.5 |
| 192 | Selection | 29.9 | 33.9 | 34.7 |
| 192 | Scroll | 33.2 | 35.0 | 35.0 |
| 2,000 | Render | 104.6 | 150.0 | 150.3 |
| 2,000 | Resize | 101.1 | 152.1 | 175.9 |
| 2,000 | Selection | 31.9 | 34.4 | 37.0 |
| 2,000 | Scroll | 33.2 | 34.5 | 35.1 |
| 20,000 | Render | 830.4 | 1,104.6 | 1,344.8 |
| 20,000 | Resize | 958.6 | 1,276.0 | 1,347.8 |
| 20,000 | Selection | 53.0 | 79.0 | 82.7 |
| 20,000 | Scroll | 34.7 | 67.6 | 78.2 |

The archived 1.0.0.0 package was also measured locally with the same harness: 20,000-cell p95 render 1,380.5 ms, resize 1,457.4 ms, selection 132.8 ms and scroll 52.7 ms. The candidate is not faster on every measured task; shared-VM noise and the lack of native/competitor timing prevent a causal speed or leadership claim. Dense render/resize remain noticeable, bounded main-thread work rather than a promised frame-rate interaction.

## Packaging and audit scope

Official tools 7.2.1 / API npm package 5.11.1 (host API 5.11.0) were current when checked. `--all-locales` is the supported workaround for the formattingutils locale-pruning ESM incompatibility. There are no dependency source patches. The wrapper generates file-only untrusted development certificates in isolated ignored tool-home storage and removes their exact files; it does not install trust, services, or background infrastructure.

Audit checks cover archive metadata, frozen GUID/version, icon, capabilities/empty privileges, English UI resources, embedded full third-party notices, syntax/forbidden runtime patterns, and package hash. Official audit checks external requests; browser request observers add dynamic evidence for tested paths. These are bounded checks, not a proof about every possible host input. Full and production dependency audits are separate and time-sensitive: production audit (`npm audit --omit=dev`) reports zero vulnerabilities, while full development audit is currently affected by 6 high findings from upstream unpatched `braces <=3.0.3` (GHSA-vfj7-8cjw-p6xm) in `powerbi-visuals-tools 7.2.1`. The SDK's optional Landing Page/Total-Subtotal recommendations are disclosed; v1 has binding guidance and intentionally no displayed totals.

## Coordinator-reported native status: September 10, 2026

The parent coordinator reports successful native Heatmap Desktop open/refresh, cross-filtering, Save PBIX and reopen, with exact embedded-package proof. This is an attributed native report, not an inference from the local browser suite or TOM parsing. The package remains `1.0.1.0`, SHA-256 `95ecfae70676f40aa83e2c058fa2142de906333165f8c7a9a8a750a66dfbec8d`.

Final native assets, tester/host metadata and the PBIX/proof files are forthcoming for this source/dossier. No new captures or PBIX are fabricated here, and the report does not close broader native gates before evidence is attached and reviewed. The sealed local evidence bundle is unchanged.

The owner also approved **existing Atlyn storefront subscriptions with ungated runtime and free shared viewing**. The current offline renderer is intended; runtime licensing integration is no longer a blocker. This documentation-only update changes no runtime bytes or version. Official Microsoft Power BI certification is owner-required in addition to general Marketplace review: the coordinator must select **Request Power BI certification** during authorized submission. The actual grant is pending, not claimed. Certification-ref movement, remote main and live submission remain subject to the coordinator's final gate.

## Native/publication gates still open

The reported Desktop results above do not establish Service behavior, Microsoft test-dataset report execution, screen-reader/mobile testing, dashboard pin, host sorting/dynamic formats, all selection/highlight modes, real segmented delivery, bookmarks, or PDF/PowerPoint/image export. Multiple-instance and settings-replay mocks are not saved-report/native bookmark proof. Parent owns these checks and all live Partner Center actions. See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) and [SUBMISSION.md](SUBMISSION.md). Do not mark any such gate complete without dated evidence for the exact package.
