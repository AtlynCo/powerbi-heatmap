import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import {
    artifactFiles, assertSafeOutput, buildProject, modelFolder, parseArgs,
    projectName, reportFolder, root, safeRelative, schemaRoot, sha256
} from "./create-sample.mjs";

export const schemaCommit = "83ce11373faada0d01e76264a5cceb0ba70003e6";

function readLiteral(value) {
    const text = value?.expr?.Literal?.Value;
    assert.equal(typeof text, "string", "Formatting must contain a persisted expression literal");
    if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
    if (text === "true" || text === "false") return text === "true";
    assert(/^-?\d+(?:\.\d+)?D$/.test(text), `Expected a typed Double literal, not an untyped number: ${text}`);
    return Number(text.slice(0, -1));
}

function checkFixtures(datasets) {
    const revenue = datasets.get("ProductRegion");
    const defects = datasets.get("DefectLine");
    assert.equal(revenue.rows.length, 15);
    assert.equal(defects.rows.length, 11);
    const revenueValue = (product, region) => revenue.rows.find(row => row[0] === product && row[2] === region)?.[4];
    assert.equal(revenueValue("Pumps", "North"), 0);
    assert.equal(revenueValue("Pumps", "West"), null);
    assert.equal(revenueValue("Filters", "East"), undefined);
    const pumpsTotal = revenue.rows.filter(row => row[0] === "Pumps").reduce((total, row) => total + (row[4] ?? 0), 0);
    assert.equal(revenueValue("Pumps", "Central") / pumpsTotal, 0.4);
    assert.equal(revenue.rows.reduce((total, row) => total + (row[4] ?? 0), 0), 18000);
    const defectValue = (defect, line) => defects.rows.find(row => row[0] === defect && row[2] === line)?.[4];
    assert.equal(defectValue("Scratch", "Line B"), 0);
    assert.equal(defectValue("Dent", "Line A"), null);
    assert.equal(defectValue("Label", "Line C"), undefined);
    const exposures = new Map();
    for (const row of defects.rows) {
        assert(!exposures.has(row[2]) || exposures.get(row[2]) === row[5], "MAX-per-line assumption is false");
        exposures.set(row[2], row[5]);
    }
    assert.equal([...exposures.values()].reduce((sum, value) => sum + value, 0), 460);
    assert.equal(defectValue("Seal", "Line B") / exposures.get("Line B"), 0.02);
}

export async function validateSample({ output, packagePath, schemas = false }) {
    assertSafeOutput(output);
    const built = await buildProject(packagePath);
    const onDisk = artifactFiles(output);
    assert.deepEqual(onDisk, [...built.files.keys()].sort(), "Generated file set differs from the authored project");
    for (const [name, content] of built.files) {
        assert.equal(sha256(readFileSync(path.join(output, ...name.split("/")))), sha256(content),
            `Artifact is stale, changed, or not derived from this package: ${name}`);
    }
    const read = name => JSON.parse(readFileSync(path.join(output, ...safeRelative(name).split("/")), "utf8"));
    const pbip = read(`${projectName}.pbip`);
    assert.equal(pbip.artifacts.length, 1);
    assert.equal(pbip.artifacts[0].report.path, reportFolder);
    const pbir = read(`${reportFolder}/definition.pbir`);
    assert.deepEqual(Object.keys(pbir.datasetReference), ["byPath"]);
    assert.equal(pbir.datasetReference.byPath.path, `../${modelFolder}`);
    assert(existsSync(path.join(output, modelFolder, "definition.pbism")), "PBIR semantic model target missing");
    const report = read(`${reportFolder}/definition/report.json`);
    assert(!report.publicCustomVisuals?.length && !report.organizationCustomVisuals?.length, "Private visual must not require a store download");
    const custom = report.resourcePackages.filter(item => item.type === "CustomVisual");
    assert.equal(custom.length, 1);
    assert.equal(custom[0].name, built.spec.guid);
    for (const resource of custom[0].items) {
        assert.equal(resource.type, "CustomVisualMetadata");
        assert.equal(resource.path, path.posix.basename(built.provenance.package.metadata));
        assert(existsSync(path.join(output, reportFolder, "CustomVisuals", custom[0].name, "resources", safeRelative(resource.path))));
    }
    const tables = new Map();
    for (const dataset of built.datasets.values()) {
        tables.set(dataset.table, { columns: dataset.columns.map(item => item.name), measures: dataset.measures.map(item => item.name) });
        for (const dimension of dataset.dimensions) tables.set(dimension, { columns: [dimension, `${dimension}Sort`], measures: [] });
    }
    const checkField = field => {
        const ref = field.Column ?? field.Measure;
        assert(ref, "Only direct model Column/Measure field bindings are authored");
        const entity = ref.Expression.SourceRef.Entity;
        const table = tables.get(entity);
        assert(table, `Unresolved table: ${entity}`);
        assert((field.Column ? table.columns : table.measures).includes(ref.Property), `Unresolved model field: ${entity}.${ref.Property}`);
    };
    for (const name of onDisk.filter(item => item.endsWith(".tmdl"))) {
        const text = readFileSync(path.join(output, ...name.split("/")), "utf8");
        assert(!/\b(Web|File|Folder|Sql|OData|AzureStorage)\s*\.|\bDirectQuery\b|https?:\/\//i.test(text), `Non-offline model source: ${name}`);
        if (name.includes("/tables/")) {
            assert(text.includes("Source = #table(type table ["), `No embedded typed data in ${name}`);
            assert(text.includes("\t\tmode: import"), `Not an import partition: ${name}`);
            assert(!text.includes("\r"), "TMDL must have deterministic LF endings");
        }
    }
    const relations = readFileSync(path.join(output, modelFolder, "definition", "relationships.tmdl"), "utf8");
    assert.equal([...relations.matchAll(/^relationship /gm)].length, 4);
    for (const dataset of built.datasets.values()) for (const dimension of dataset.dimensions) {
        assert(relations.includes(`fromColumn: ${dataset.table}.${dimension}\n\ttoColumn: ${dimension}.${dimension}`));
        const tmdl = readFileSync(path.join(output, modelFolder, "definition", "tables", `${dimension}.tmdl`), "utf8");
        assert(tmdl.includes(`sortByColumn: '${dimension}Sort'`), `Missing dimension sortByColumn: ${dimension}`);
    }
    const pages = read(`${reportFolder}/definition/pages/pages.json`);
    assert.equal(pages.pageOrder.length, built.spec.pages.length);
    assert(pages.pageOrder.includes(pages.activePageName));
    let visualCount = 0;
    let heatmapCount = 0;
    for (const pageName of pages.pageOrder) {
        const prefix = `${reportFolder}/definition/pages/${pageName}/`;
        const page = read(`${prefix}page.json`);
        assert.equal(page.name, pageName);
        const visuals = onDisk.filter(name => name.startsWith(`${prefix}visuals/`) && name.endsWith("/visual.json")).map(read);
        const names = visuals.map(item => item.name);
        assert.equal(new Set(names).size, names.length);
        assert(visuals.some(item => item.visual.visualType === built.spec.guid), `Page has no bound heatmap: ${pageName}`);
        assert(visuals.some(item => item.visual.visualType === "pivotTable"), `Page has no native comparison: ${pageName}`);
        for (const interaction of page.visualInteractions) {
            assert(names.includes(interaction.source) && names.includes(interaction.target) && interaction.source !== interaction.target, "Unresolved interaction");
        }
        for (const container of visuals) {
            visualCount++;
            const pos = container.position;
            assert(pos.x >= 0 && pos.y >= 0 && pos.x + pos.width <= page.width && pos.y + pos.height <= page.height, "Visual exceeds page bounds");
            const visual = container.visual;
            if (visual.visualType === "textbox") continue;
            assert(visual.query?.queryState, "Visual has no authored query");
            const references = [];
            for (const state of Object.values(visual.query.queryState)) for (const projection of state.projections) {
                checkField(projection.field);
                references.push(projection.queryRef);
            }
            assert.equal(new Set(references).size, references.length, "Duplicate queryRef in one visual");
            for (const sort of visual.query.sortDefinition.sort) checkField(sort.field);
            if (visual.visualType !== built.spec.guid) continue;
            heatmapCount++;
            const query = visual.query.queryState;
            for (const role of ["row", "column", "value"]) assert.equal(query[role].projections.length, 1, `Incorrect ${role} cardinality`);
            for (const role of ["row", "column"]) assert(query[role].projections[0].field.Column);
            for (const role of ["value", "denominator", "tooltips"]) for (const projection of query[role]?.projections ?? []) assert(projection.field.Measure);
            assert((query.denominator?.projections.length ?? 0) <= 1 && (query.tooltips?.projections.length ?? 0) <= 3);
            const mappings = built.payload.capabilities.dataViewMappings;
            assert(mappings.some(mapping => mapping.matrix && mapping.conditions?.some(condition =>
                Object.entries(query).every(([role, state]) => condition[role]
                    && state.projections.length <= condition[role].max
                    && state.projections.length >= (condition[role].min ?? 0)))), "Query violates packaged matrix mapping");
            for (const [objectName, instances] of Object.entries(visual.objects)) for (const instance of instances) {
                for (const [property, expression] of Object.entries(instance.properties)) {
                    const type = built.payload.capabilities.objects[objectName]?.properties[property]?.type;
                    assert(type, `Formatting property missing from package: ${objectName}.${property}`);
                    const value = readLiteral(expression);
                    if (type.enumeration) assert(type.enumeration.some(option => option.value === value), "Unsupported persisted enum");
                    else if (type.bool) assert.equal(typeof value, "boolean");
                    else if (type.numeric || type.formatting?.fontSize) assert.equal(typeof value, "number");
                    else assert.fail(`Unhandled authored property type: ${objectName}.${property}`);
                }
            }
            const normalization = readLiteral(visual.objects.values[0].properties.normalization);
            const additive = readLiteral(visual.objects.values[0].properties.additive);
            if (["row", "column", "all"].includes(normalization)) assert(additive, "Unsafe additive share assertion");
            if (normalization === "denominator") assert(query.denominator && !additive, "Denominator page must use the explicit model measure");
        }
    }
    checkFixtures(built.datasets);
    const schemaDocuments = [];
    const loaded = new Map();
    if (schemas) {
        const loadSchema = async uri => {
            assert(uri.startsWith(schemaRoot), `Unexpected remote schema: ${uri}`);
            const relative = uri.slice("https://developer.microsoft.com/json-schemas/".length);
            safeRelative(relative);
            const url = `https://raw.githubusercontent.com/microsoft/json-schemas/${schemaCommit}/${relative}`;
            const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
            assert(response.ok, `Schema fetch failed (${response.status}): ${url}`);
            const text = await response.text();
            loaded.set(uri, { uri, source: url, sha256: sha256(text) });
            return JSON.parse(text);
        };
        const ajv = new Ajv({ allErrors: true, loadSchema, unknownFormats: "ignore", logger: false });
        const validators = new Map();
        for (const name of onDisk.filter(item => /\.(json|pbip|pbir|pbism)$/.test(item) && !item.includes("/CustomVisuals/"))) {
            const document = read(name);
            if (!document.$schema) continue;
            if (!validators.has(document.$schema)) validators.set(document.$schema, await ajv.compileAsync(await loadSchema(document.$schema)));
            const validate = validators.get(document.$schema);
            assert(validate(document), `JSON schema failure in ${name}: ${ajv.errorsText(validate.errors, { separator: "\n" })}`);
            schemaDocuments.push(name);
        }
        console.log(`Microsoft JSON Schema validation passed: ${schemaDocuments.length} documents, ${loaded.size} pinned schemas (${schemaCommit}).`);
    }
    console.log(`Static validation passed: ${onDisk.length} files, ${pages.pageOrder.length} pages, ${visualCount} visuals, ${heatmapCount} heatmaps.`);
    console.log(`Package SHA-256: ${built.provenance.package.sha256}`);
    console.log("Verified: byte-exact package extraction, current inputs, role/cardinality/formatting references, offline fixture invariants.");
    console.log("NOT verified: native TMDL/M/DAX execution, Desktop open/refresh/render/accessibility/export. No PBIX is generated.");
    return { files: onDisk.length, pages: pages.pageOrder.length, visuals: visualCount, heatmaps: heatmapCount,
        packageSha256: built.provenance.package.sha256, schemaDocuments, schemaCommit, schemas: [...loaded.values()],
        nativeDesktopValidated: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await validateSample(parseArgs(process.argv.slice(2)));
    const evidence = path.join(root, "dist", "evidence");
    mkdirSync(evidence, { recursive: true });
    writeFileSync(path.join(evidence, "sample-validation.json"), JSON.stringify(result, null, 2));
}
