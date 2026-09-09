# Offline Power BI Project sample

The authored generator builds **AtlynHeatmapSample.pbip**, an enhanced PBIR report, a TMDL semantic model, and the **private visual extracted byte-for-byte from the official release package**. It is not an empty report or a manual field-binding recipe. All five pages already contain bound Atlyn Heatmap queries, persisted settings, a native Power BI matrix, and two dimension slicers.

**This is a source-generated project, not a native-validated report or a PBIX.** Microsoft JSON Schema and static/reference checks can pass without Desktop accepting or rendering the project. Native open, refresh, interactions, accessibility, and genuine Desktop Save As/export to PBIX remain a release hold. No Desktop, service, browser session, or tenant has been used to validate this sample.

## Build after the final package is frozen

From the repository root, after official packaging has produced the **final** candidate:

```powershell
node scripts\create-sample.mjs
node scripts\validate-sample.mjs
```

Default input:

```text
dist\atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37.1.0.1.0.pbiviz
```

Default output:

```text
dist\submission\AtlynHeatmapSample\
  AtlynHeatmapSample.pbip
  AtlynHeatmapSample.Report\
    definition.pbir
    definition\
      version.json
      report.json
      pages\pages.json
      pages\<page>\page.json
      pages\<page>\visuals\<visual>\visual.json
    CustomVisuals\
      atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37\
        package.json
        resources\
          atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37.pbiviz.json
  AtlynHeatmapSample.SemanticModel\
    definition.pbism
    definition\
      database.tmdl
      model.tmdl
      relationships.tmdl
      tables\<table>.tmdl
  sample-manifest.json
  README.txt
  .gitignore
```

An alternative **child of the repository's ignored `dist` directory** can be supplied:

```powershell
node scripts\create-sample.mjs --package dist\atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37.1.0.1.0.pbiviz --output dist\sample-review
node scripts\validate-sample.mjs --output dist\sample-review
```

A positional output argument is also accepted. The builder reads the package at runtime; it never rebuilds it, signs it, downloads it, mutates its payload, or substitutes another version. It verifies the source configuration, package manifest, and visual payload all have the stable GUID and `1.0.1.0`. It resolves the payload through `metadata.pbivizjson.resourceId` and the corresponding `sourceType: 5` resource, not by taking an arbitrary JSON file.

Every non-directory ZIP entry is extracted unchanged below `Report\CustomVisuals\<GUID>`. The report registers a `CustomVisual` resource package whose item type is `CustomVisualMetadata`, with the payload **basename** as its name/path. That basename resolves inside the extracted package's `resources` folder. This matches an actual public PBIR export, not a guessed `.pbiviz` download URL. There is no `publicCustomVisuals` or organization-store dependency.

Do not generate the deliverable until the final candidate package is known. A build against an earlier same-version package must be regenerated after the package changes; validation against different package bytes fails.

## Authored source and offline model

- `samples\project\project.json`: datasets, field/measure names, page copy, and frozen visual enum/settings choices.
- `samples\project\*.pbip`, `definition.pbir`, `definition.pbism`: project/report/model reference templates.
- `samples\project\database.tmdl`, `model.tmdl`: model compatibility, culture and table references.
- `scripts\create-sample.mjs`: query/visual/page builders, typed inline partitions, relationships, package extraction and provenance.
- Existing `samples\product-region.csv`, `samples\defect-line.csv`, and corresponding `.dax` files are **read-only build inputs**. The builder does not change the standalone PQ/DAX/CSV examples.

The generated model contains six import tables. `ProductRegion` embeds all 15 CSV rows and `DefectLine` embeds all 11 CSV rows in typed M `#table` expressions followed by `Table.TransformColumnTypes`. Empty numeric CSV cells become M `null`, explicit zero remains zero, and omitted intersections remain omitted. No `File.Contents`, external folder parameter, credentials, web query, live dataset, or machine-specific path is in the model. The CSVs need not accompany the generated project.

`Product`, `Region`, `Defect` and `Line` are explicit dimension tables, also embedded inline. Keys are unique. Each label uses its numeric `*Sort` column as `sortByColumn`; sort keys are hidden. Four active default many-to-one, single-direction relationships connect fact labels to dimension keys. Fact columns are hidden to encourage use of the dimensions and authored measures. Measures are imported from the existing DAX definitions with the configured currency/integer/percentage format strings; no implicit aggregation or `COALESCE` is introduced.

The model contains **no `cache.abf`**. Microsoft documents that a project without this cache opens with its definition but without loaded data. A supported Desktop must **Refresh** the inline partitions before interpreting the visuals. That refresh requires no data-source network access; the project cannot control the host's own telemetry or organizational policy. Schema URLs are authoring metadata, not report data sources.

The opportunities measure removes the **whole Defect dimension**, takes the repeated exposure once per line using `MAX`, and uses `SUMX` over lines for a meaningful total. The validator checks that each line really repeats one consistent exposure; it does not assume `MAX` is safe for arbitrary data.

## Pages and actual queries

Each custom visual has one `row` Column projection, one `column` Column projection, one `value` Measure projection, optional one `denominator` Measure projection, and one `tooltips` Measure projection. These use PBIR `Column`/`Measure` expressions with `SourceRef.Entity`, actual model properties, unique `queryRef`s and ascending dimension sort expressions—not display-only field labels.

| Page | Row / column / value | Persisted normalization / color scope | Denominator |
|---|---|---|---|
| 01 Revenue – raw | `Product[Product]` / `Region[Region]` / `[Total Revenue]` | `raw` / `global`; additive **false** | None |
| 02 Revenue – row shares | Same, in two side-by-side heatmaps | Both `row`; left `global`, right `row`; additive **true** | None: visible loaded row totals |
| 03 Defects – counts | `Defect[Defect]` / `Line[Line]` / `[Defect Count]` | `raw` / `global`; additive **false** | None |
| 04 Defects – opportunities | Same defect dimensions and count | `denominator` / `global`; additive **false** | `[Line Inspection Opportunities]` |
| 05 Interpretation and keyboard | Product / Region / Total Revenue | `denominator` / `global`; additive **false** | `[Product Revenue Across Regions]` |

Tooltips bind `[Revenue Records]` or `[Defect Records]`. All six heatmaps persist `scale.palette = sequential` and `values.showValues = true`. Layout values are authored explicitly under `layout.cellWidth`, `cellHeight`, `labelWidth`, and `fontSize`. Persisted numeric formatting expressions use the semantic-query schema's typed Double encoding (for example, `12D`), booleans use `true`/`false`, and strings are single-quoted literals. The builder does not rename or reinterpret existing enum values.

Every page also has a native `pivotTable` matrix with dimension Rows/Columns and three Values: raw measure, model denominator, model-authored ratio. The two native `slicer` visuals use the corresponding dimension fields with verified dropdown mode. Explicit page `DataFilter` interactions connect data visuals so cell/header selections can be inspected in the companion matrix. Page 02 deliberately shows the same numbers with different color comparability. The default host theme is used; no downloaded theme or ornamental resource is required.

The 1280 × 900 pages include interpretation notes and explicit tab order. The keyboard page describes arrows, Home/End, Enter/Space, additive Ctrl/Cmd selection, Escape and Shift+F10; this is a **test instruction**, not evidence that the native host passed those checks.

### Expected synthetic checks after a real refresh

1. Product order: Pumps, Valves, Sensors, Filters. Region order: North, West, Central, East.
2. Pumps/North is zero; Pumps/West is BLANK; Filters/East has no fact row. Total revenue is 18,000.
3. Unfiltered Pumps/Central row share is **40.0%** in both page-02 heatmaps. Global/per-row color scope changes colors, not ratios. Filter Region to Central: the visible share is 100.0%, while the model-authored share remains 40.0%.
4. Defect order: Scratch, Dent, Seal, Label. Line order: Line B, Line A, Line C.
5. Scratch/Line B is zero, Dent/Line A is BLANK, Label/Line C has no fact row.
6. Page 04 Seal/Line B is **4 / 200 = 2.0%**, and filtering Defect to Seal leaves Line B opportunities at 200. Unfiltered total opportunities are **460**, not the repeated-row sum.
7. Page 05 Region=Central leaves Pumps at **40.0%**, because the model denominator removes Region, including its sort column.

Record absence versus explicit BLANK is ultimately constrained by the host's matrix representation. Especially when a nonblank denominator is projected, the host may materialize otherwise missing intersections as BLANK. Neither the sample nor its notes promise that the visual can reconstruct absence from such a host value entry.

## Determinism and validation

The same source inputs and exact package bytes produce the same **61 generated files**, including the manifest: no timestamps, random IDs, absolute source paths, cache, credentials or host state. `sample-manifest.json` records source-input SHA-256s, the exact `.pbiviz` SHA-256, and every generated file's hash except its own. Validators compare the manifest itself against the expected rebuild, so stale or altered manifest contents also fail. The schema metadata and generated paths use `/` where Microsoft's file format requires it; command-line/filesystem examples use Windows `\`.

`validate-sample.mjs` checks:

- the complete generated file set and byte identity against the current builder, inputs and exact package;
- PBIP → report → relative semantic-model references, resource registration/extraction, and page/visual references;
- six embedded import partitions, four fact/dimension relationships, sort columns and fixture invariants;
- all model field references, matrix role cardinalities and the **packaged** capabilities mapping;
- persisted enum values and property types against packaged capabilities, plus safe additive/denominator settings;
- visual bounds, interaction targets, native companions and presence of a bound heatmap on every page.

Optional **public-schema-only network validation**, not a report runtime dependency:

```powershell
node scripts\validate-sample.mjs --schemas
```

This reads Microsoft JSON schemas at commit `83ce11373faada0d01e76264a5cceb0ba70003e6`, using the repository's existing AJV dependency; it installs nothing, uploads nothing and writes no schema cache. It checks the 47 schema-bearing project/report JSON documents and resolves 13 pinned schemas, including nested expression, formatting and filter definitions. Schema validation does not execute native visual capabilities, TMDL, M or DAX. PBIR generic formatting dictionaries do not themselves validate native slicer/matrix runtime semantics; those conventions were checked against public exports listed below.

The builder only writes below ignored `dist`, rejects linked output paths, rejects archive traversal names, and refuses to overwrite files that differ from the previous generated manifest. Desktop-edited output or a directory with extra files needs a **fresh output directory**, not destructive regeneration.

## Verified public format sources

Consulted 2026-09-09; versions are deliberately pinned, not assumed to be the newest format supported by every Desktop:

- Microsoft Learn: [report folder, private `CustomVisuals`, PBIR structure and `byPath` references](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-report).
- Microsoft Learn: [semantic-model folder, `definition.pbism`, TMDL and behavior without `cache.abf`](https://learn.microsoft.com/en-us/power-bi/developer/projects/projects-dataset).
- Microsoft Learn: [TMDL grammar, M partitions, measure expressions, relationships, sort references and folder representation](https://learn.microsoft.com/en-us/analysis-services/tmdl/tmdl-overview).
- Microsoft JSON schemas, pinned [repository revision](https://github.com/microsoft/json-schemas/tree/83ce11373faada0d01e76264a5cceb0ba70003e6/fabric): PBIP properties 1.0.0, report definition properties 2.0.0, semantic-model definition properties 1.0.0, report 2.0.0, visual container 1.4.0, page 1.3.0, pages metadata 1.0.0, version metadata 1.0.0. Every generated JSON document declares its exact schema URI.
- Actual public **ProdataSQL/FinancialModelling Finance-GL** PBIR export at commit `ec738ceb6a801f416b88b93c1dcfddbbe89426b7`: [report resource registration](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/report.json), [private visual package tree](https://github.com/ProdataSQL/FinancialModelling/tree/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/CustomVisuals), [native matrix query roles](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/pages/ReportSection/visuals/a3cb21632766798b9308/visual.json), [native dropdown slicer query](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/pages/ReportSection/visuals/0ed45cfce949e310eeb0/visual.json), [textbox paragraphs](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.Report/definition/pages/ReportSection/visuals/d906773d9c4675ad1a66/visual.json), [database](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.SemanticModel/definition/database.tmdl) and [model/table references](https://github.com/ProdataSQL/FinancialModelling/blob/ec738ceb6a801f416b88b93c1dcfddbbe89426b7/Workspace/Finance-GL.SemanticModel/definition/model.tmdl).
- Independent public **PBI-DataVizzle/pbi_content** export: [private custom-visual registration](https://github.com/PBI-DataVizzle/pbi_content/blob/fc055302181e29512ec2a9db6c1f7f38716e7e47/my_deneb_showcases/slope/slope.Report/definition/report.json) and [PBIR version `2.0.0`](https://github.com/PBI-DataVizzle/pbi_content/blob/fc055302181e29512ec2a9db6c1f7f38716e7e47/my_deneb_showcases/slope/slope.Report/definition/version.json).

Public exports are evidence of file/query conventions, not permission to claim this separately authored project loaded successfully. No sample visual binaries or other reports' business data were copied.

## Required native release hold

In an authorized, supported Power BI Desktop with PBIP/PBIR/TMDL enabled as applicable: open a **copy** of the generated project, refresh inline data, verify that the embedded package and all bound visuals load, run the checks above, inspect filter and keyboard behavior, then save/export a genuine PBIX using Desktop. Record the Desktop version, exact package/sample hashes and actual outcome. Do not rename the project or ZIP to `.pbix`, fabricate screenshots, or mark native validation complete from these static checks.
