# Atlyn Heatmap

An analytical row-by-column heatmap for Power BI. Compare operations by region or defects by production line without turning missing data into zero or silently summing ratios.

**v1 release candidate — not a Microsoft-certified visual.** Automated evidence and limitations belong in [docs/VALIDATION.md](docs/VALIDATION.md); actual Desktop, Service, accessibility, and export validation is tracked in the [release checklist](docs/RELEASE_CHECKLIST.md). Host-mock/browser checks are not proof of those integrations.

## Use it

Import the locally built `.pbiviz` into an authorized Power BI Desktop report, subject to your organization's custom-visual policy. Assign:

| Field well | Required | Meaning |
| --- | --- | --- |
| Row | 1 categorical field | For example, product or defect |
| Column | 1 categorical field | For example, region or production line |
| Value | 1 numeric measure | Raw measure values are the default |
| Denominator | Optional: 1 numeric measure | Explicit model-defined denominator |
| Tooltips | Optional: up to 3 numeric or text measures | Additional cell context |

Use single-level categories: no hierarchy drilldown or totals are displayed. The visual preserves delivered model order, formats, and node identities. Display labels and tooltip text are capped at 1,024 characters, including a trailing `...` when shortened; original selection identities are unchanged. Set model **Sort by column** for business ordering; the visual does not alphabetize or reconstruct categories.

When supplied by the host, per-cell `general.formatString` overrides format raw cells, accessible values, denominators, and each tooltip measure independently. Otherwise the source-measure format applies. Legends use measure metadata rather than an individual cell's format override.

### Color is separate from calculation

- Choose color scope: **global**, **per row**, or **per column**.
- Independently choose **raw**, **share of row**, **share of column**, **share of all**, or **Value / supplied Denominator**.
- Computed shares require the author to enable **“Value is a nonnegative additive measure”**. They use finite, nonnegative observations, exclude BLANK/absent cells, reject invalid/negative groups and zero totals, and are disabled on incomplete/reduced matrices. Do not enable this for rates, averages, distinct counts, or other nonadditive measures.
- A supplied finite, positive denominator works without that toggle and on partial matrices. Its scope comes from the model measure, not an inferred visual total. Derived values use `0.0%`; tooltips retain the source raw format.
- Choose sequential blue or a symmetric, zero-centered blue–neutral–orange diverging scale. Per-group legends warn that colors are not comparable between groups and show the exact focused/hovered group's bounds.
- Domains use loaded data, not the viewport or selection/highlight. Fetching more data or filtering can change them.

### Read states before reading colors

| Symbol | Meaning |
| --- | --- |
| `B` | Explicit BLANK/null |
| `0` | Numeric zero |
| `-` | Absent intersection in otherwise complete delivered axes |
| `!` | Invalid value: string, NaN, or Infinity, not numeric zero |
| `?` | Unknown/unloaded intersection when completeness is uncertain |
| `n/a` | Requested derived value is unavailable |

Values can be hidden, but zero/missing-state symbols remain visible. A visible missing-state key remains available. High contrast forces numbers and symbols. See the [data contract](docs/DATA_CONTRACT.md) for exact precedence and normalization rules.

### Limits and navigation

The matrix requests row windows of 200 and the top 100 columns. **Load more rows** manually calls aggregated `fetchMoreData(true)` while the host exposes a segment. Maximums are **500 rows, 100 columns, and 20,000 dense cells**; at 100 columns the row limit is 200. Reaching 100 returned columns is conservatively marked possibly reduced even without a segment. Limits, rejection, or no progress stop fetching and leave a truthful incomplete warning.

The bounded, nonvirtualized HTML table has one scroll area and sticky headers. Arrow keys move focus; Home/End, Ctrl+Home/End, and PageUp/PageDown navigate; Enter/Space select; Ctrl/Cmd adds selections; Shift+F10 opens the model-backed context menu. Escape, **Clear selection**, or the visual background clears selection. Row, column, and cell selections use host identities.

Accessible cell labels, roving focus, host high-contrast colors, RTL logical sticky positioning/reversed horizontal keys, and motion-free rendering are part of the v1 contract. Host highlights add dots/outlines without recoloring base values; tooltips distinguish raw highlighted values, including invalid highlights. Tooltips use host support with a title fallback.

Below 180 × 120 pixels, enlarge the visual; very large fonts can require more space even above that baseline. Responsive layout reduces requested label/cell sizes on small tiles to reserve actual data space. Larger matrices scroll. **Export covers only the current viewport, not the full scrolled matrix**; actual host export behavior remains a release-validation requirement.

## Offline sample report source

[samples/README.md](samples/README.md) provides two local CSV datasets, Power Query imports/dimensions, DAX measures, and a report layout recipe:

- Product × region revenue, including zero, BLANK, and an absent intersection.
- Defect × production line counts with explicit inspection-opportunity denominators.

`npm run sample` prepares the authored, bound offline PBIP described in [samples/PBIP.md](samples/PBIP.md), embedding the exact built visual. On September 10, 2026, the coordinator reported successful Desktop open/refresh, cross-filtering, Save PBIX and reopen with exact embedded-package proof. Final native assets are still forthcoming for this repository/dossier; see the [attributed status and remaining gates](docs/VALIDATION.md#coordinator-reported-native-status-september-10-2026). No fabricated PBIX is supplied. The visual itself makes no runtime network calls and uses no runtime external assets.

## Development and verification

| Item | Fixed v1 metadata |
| --- | --- |
| Visual GUID | `atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37` |
| `.pbiviz` version | `1.0.2.0` |
| Private npm package | `@atlyn/heatmap` `1.0.2` |
| Power BI host API contract (`apiVersion`) | `5.11.0` |
| `powerbi-visuals-api` SDK npm package | `5.11.1` |
| Power BI visuals tools | `7.2.1` |
| TypeScript | `5.9.3` |
| Node.js | `>=22` |

After obtaining this private source through an authorized channel, use Node.js 22 or newer, then `npm ci`. This installs development dependencies; it is not needed for an already packaged visual's runtime.

| Script | Purpose |
| --- | --- |
| `npm start` | Local visual development server |
| `npm run typecheck` | TypeScript validation |
| `npm run lint` | Source linting |
| `npm run eslint` | Certification-required ESLint entry point |
| `npm test` | Automated unit/host-mock tests |
| `npm run build` | Package through the Node wrapper and official SDK |
| `npm run package` | Create `.pbiviz` through the same wrapper |
| `npm run test:browser` | Browser/host-mock interaction checks |
| `npm run audit:package` | Inspect packaged artifacts |
| `npm run audit:dependencies` | Audit production dependencies |
| `npm run resources` | Generate English SDK resources from canonical strings |
| `npm run notices` | Generate `THIRD_PARTY_NOTICES.md` and bundled offline legal text |
| `npm run validate` | Run the configured validation chain |
| `npm run sample` | Generate bound offline PBIP from the exact current package |

**Local validation only.** GitHub Actions is disabled and this repository has no workflows. Do not enable Actions, dispatch hosted jobs, or treat historical CI as current release proof. Source hosting, pushes, and pull requests remain allowed. See [quality evidence](docs/VALIDATION.md) and the [evidence-based comparison](docs/COMPARISON.md).

Run dependency auditing and notice generation explicitly when preparing evidence; do not assume `validate` covers every release gate. Consult [VALIDATION.md](docs/VALIDATION.md) for recorded results, not an implied pass from this command list.

### Packaging environment

`build` and `package` use `scripts\package.mjs` to invoke the official `pbiviz package --all-locales --no-stats`. The official tools normalize the supported host API contract to `5.11.0`; the installed `powerbi-visuals-api` SDK npm package remains `5.11.1`. Package auditing checks the `5.11.0` host contract. Retaining packaged locales avoids the SDK's confirmed ESM locale-pruning incompatibility and keeps those resources offline; no `node_modules` patch is applied.

The SDK resolves development-certificate files even during packaging. The wrapper isolates its tool home in ignored `.tmp\tool-home`, generates an ephemeral **file-only** certificate, and deletes its named certificate/private-key/password files afterward. Windows packaging requires **PowerShell 7 (`pwsh`)**, using .NET `CertificateRequest`; Linux/macOS require **OpenSSL**. The wrapper does not mutate certificate stores or establish trust. This describes packaging, not the separate development server's HTTPS setup.

`npm run resources` generates `stringResources\en-US\resources.resjson` from canonical `src\strings.json`; the start/build/package pre-hooks run it. Edit the canonical strings, not the generated resource. Retaining SDK locales does not claim translated Atlyn UI.

Development-dependency mitigations pin `qs` to `6.16.0` and scope `uuid` `11.1.1` to `sockjs`. Record current full `npm audit` and production-only audit results in [VALIDATION.md](docs/VALIDATION.md); an override or a past clean audit is not a future security guarantee.

## Scope, privacy, and ownership

One visual; empty privileges; no telemetry, backend, license service, runtime network access, external runtime assets, `eval`, or unsafe HTML. English resources use the host localization manager. This is not statistical correlation, clustering, a calendar, writeback, or a spreadsheet editor.

### Commercial acquisition and shared viewing

Owner-approved model (September 10, 2026): **storefront subscriptions, ungated visuals**. Commercial acquisition uses existing Atlyn storefront subscriptions. The visual remains fully ungated in Power BI, with free shared viewing and no viewer subscription check. It does not verify author purchases or enforce author entitlements; report access still follows Power BI and tenant policies.

The existing offline renderer is the intended runtime, not an interim build awaiting paid integration. Do not add license checks, signers/keys, AAD/API integration, feature gates, or runtime requests for this commercial model. The owner requires official Microsoft Power BI certification in addition to general Marketplace review. During authorized submission, the coordinator must select **Request Power BI certification**. Microsoft's actual grant is pending; no certified badge or approval is claimed, and rendering remains ungated.

Original Atlyn work is **all rights reserved**; see [LICENSE](LICENSE). Third-party components retain their own terms, including MIT scaffold attribution in generated [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). These full notices also ship inside the visual under **Third-party licenses**, without requiring an external license sidecar.

The private package's existing license identifier is `UNLICENSED`; `LICENSE` makes no additional license grant and does not offer the original source/docs/assets under an open-source license. Ungated rendering and free shared viewing do not relicense that work. This documentation does not replace existing storefront/customer terms or invent prices, trials, distribution rights, or a new EULA.

Author: **Atlyn**, [atlyn.help@gmail.com](mailto:atlyn.help@gmail.com). Support: <https://www.atlynco.com/docs/faq>. Private source: <https://github.com/AtlynCo/powerbi-heatmap>. These contact/repository details are product metadata, not evidence of support responsiveness. See [submission preparation](docs/SUBMISSION.md); this repository does not claim publication, a Partner Center submission, a public release, or Microsoft certification.
