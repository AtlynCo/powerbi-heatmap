import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

export const root = fileURLToPath(new URL("..", import.meta.url));
export const projectName = "AtlynHeatmapSample";
export const reportFolder = `${projectName}.Report`;
export const modelFolder = `${projectName}.SemanticModel`;
export const defaultOutput = path.join(root, "dist", "submission", projectName);
export const defaultPackage = path.join(root, "dist", "atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37.1.0.1.0.pbiviz");
export const schemaRoot = "https://developer.microsoft.com/json-schemas/fabric/";
export const schemas = {
    report: `${schemaRoot}item/report/definition/report/2.0.0/schema.json`,
    visual: `${schemaRoot}item/report/definition/visualContainer/1.4.0/schema.json`,
    page: `${schemaRoot}item/report/definition/page/1.3.0/schema.json`,
    pages: `${schemaRoot}item/report/definition/pagesMetadata/1.0.0/schema.json`,
    version: `${schemaRoot}item/report/definition/versionMetadata/1.0.0/schema.json`
};
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const tmdlName = value => `'${value.replaceAll("'", "''")}'`;
const mString = value => `"${value.replaceAll("#", "#(#)").replaceAll('"', '""')}"`;
const literal = value => ({
    expr: { Literal: { Value: typeof value === "string" ? `'${value.replaceAll("'", "''")}'` : typeof value === "number" ? `${value}D` : String(value) } }
});
const objectProperties = properties => [{ properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, literal(value)])) }];
const column = (entity, property = entity) => ({ Column: { Expression: { SourceRef: { Entity: entity } }, Property: property } });
const measure = (entity, property) => ({ Measure: { Expression: { SourceRef: { Entity: entity } }, Property: property } });
const projection = field => {
    const ref = field.Column ?? field.Measure;
    return {
        field, queryRef: `${ref.Expression.SourceRef.Entity}.${ref.Property}`,
        nativeQueryRef: ref.Property, ...(field.Column ? { active: true } : {})
    };
};
const role = (...fields) => ({ projections: fields.map(projection) });
const sortedQuery = (queryState, ...fields) => ({
    queryState,
    sortDefinition: { sort: fields.map(field => ({ field, direction: "Ascending" })), isDefaultSort: false }
});

export function safeRelative(name) {
    assert(typeof name === "string" && name.length > 0 && !name.includes("\\") && !name.includes(":")
        && !name.startsWith("/") && name.split("/").every(part => part && part !== "." && part !== ".."),
    `Unsafe artifact path: ${name}`);
    return name;
}

function parseCsv(text, definition) {
    const [header, ...lines] = text.trimEnd().split(/\r?\n/);
    assert.equal(header, definition.columns.map(item => item.name).join(","), `${definition.input}: unexpected CSV header`);
    return lines.map((line, index) => {
        const cells = line.split(",");
        assert.equal(cells.length, definition.columns.length, `${definition.input}: invalid row ${index + 2}`);
        return cells.map((cell, i) => {
            assert(!cell.includes('"'), "This fixture reader expects unquoted CSV cells");
            if (definition.columns[i].type === "string") {
                assert(cell.length > 0, "Dimension keys cannot be blank");
                return cell;
            }
            if (cell === "") return null;
            const value = Number(cell);
            assert(Number.isFinite(value) && value >= 0, `Invalid nonnegative numeric fixture: ${cell}`);
            if (definition.columns[i].type === "int64") assert(Number.isSafeInteger(value), `Not an integer: ${cell}`);
            return value;
        });
    });
}

function parseMeasures(text, formats) {
    const source = text.replace(/^\/\/.*$/gm, "").trim();
    const headings = [...source.matchAll(/^([A-Za-z][A-Za-z0-9 ]*) =\s*$/gm)];
    assert(headings.length > 0 && headings[0].index === 0, "DAX fixture must contain named measure definitions");
    const measures = headings.map((heading, i) => ({
        name: heading[1],
        expression: source.slice(heading.index + heading[0].length, headings[i + 1]?.index ?? source.length)
            .trim().split(/\r?\n/).map(line => line.trim()).join("\n"),
        format: formats[heading[1]]
    }));
    assert.deepEqual(measures.map(item => item.name).sort(), Object.keys(formats).sort(), "DAX measure/format mismatch");
    assert(measures.every(item => item.expression.length > 0), "Empty DAX expression");
    return measures;
}

function tableTmdl(name, columns, rows, measures = [], dimension = false) {
    const parts = [`table ${tmdlName(name)}`];
    for (const item of measures) {
        parts.push(`\n\tmeasure ${tmdlName(item.name)} =\n${item.expression.split("\n").map(line => `\t\t\t${line}`).join("\n")}\n\t\tformatString: ${item.format}`);
    }
    for (const item of columns) {
        parts.push(`\n\tcolumn ${tmdlName(item.name)}\n\t\tdataType: ${item.type}`
            + (item.type === "string" && dimension ? "\n\t\tisKey" : "\n\t\tisHidden")
            + `\n\t\tsummarizeBy: none\n\t\tsourceColumn: ${item.name}`
            + (item.type === "string" && dimension ? `\n\t\tsortByColumn: ${tmdlName(`${item.name}Sort`)}` : ""));
    }
    const columnTypes = columns.map(item => `${item.name} = ${item.type === "string" ? "text" : "nullable number"}`).join(", ");
    const values = rows.map(row => `\t\t\t\t\t{${row.map(value => typeof value === "string" ? mString(value) : value === null ? "null" : String(value)).join(", ")}}`).join(",\n");
    const conversions = columns.map(item => `{${mString(item.name)}, ${item.type === "string" ? "type text" : item.type === "int64" ? "Int64.Type" : "type number"}}`).join(", ");
    parts.push(`\n\tpartition ${tmdlName(name)} = m\n\t\tmode: import\n\t\tsource =\n\t\t\tlet\n\t\t\t\tSource = #table(type table [${columnTypes}], {\n${values}\n\t\t\t\t}),\n\t\t\t\tTyped = Table.TransformColumnTypes(Source, {${conversions}}, "en-US")\n\t\t\tin\n\t\t\t\tTyped`);
    return `${parts.join("\n")}\n`;
}

function visual(name, visualType, position, title, query, objects) {
    return {
        $schema: schemas.visual, name, position,
        visual: {
            visualType, ...(query ? { query } : {}), ...(objects ? { objects } : {}),
            visualContainerObjects: {
                title: objectProperties({ show: Boolean(title), text: title ?? "", fontSize: 12 }),
                general: objectProperties({ altText: title ?? name })
            },
            drillFilterOtherVisuals: true
        }
    };
}

const position = (x, y, width, height, tabOrder) => ({ x, y, width, height, z: tabOrder * 1000, tabOrder });

function textVisual(name, text, bounds, size = 12, bold = false) {
    return visual(name, "textbox", bounds, undefined, undefined, {
        general: [{ properties: { paragraphs: [{
            textRuns: [{ value: text, textStyle: { fontSize: `${size}pt`, ...(bold ? { fontWeight: "bold" } : {}) } }]
        }] } }]
    });
}

function buildPage(page, dataset, guid) {
    const [row, col] = dataset.dimensions.map(name => column(name));
    const value = measure(dataset.table, dataset.value);
    const ratio = measure(dataset.table, dataset.ratio);
    const denominator = measure(dataset.table, dataset.denominator);
    const split = page.heatmaps.length === 2;
    const visuals = [
        textVisual(`${page.name}Heading`, page.heading, position(24, 16, 1232, 48, 0), 22, true),
        textVisual(`${page.name}Intro`, page.intro, position(24, 70, 1232, 68, 1))
    ];
    page.heatmaps.forEach((heatmap, i) => {
        const queryState = {
            row: role(row), column: role(col), value: role(value),
            ...(heatmap.denominator ? { denominator: role(denominator) } : {}),
            tooltips: role(measure(dataset.table, dataset.records))
        };
        visuals.push(visual(heatmap.name, guid,
            split ? position(24 + i * 628, 150, 604, 350, 2 + i) : position(24, 150, 888, 350, 2),
            heatmap.title, sortedQuery(queryState, row, col), {
                scale: objectProperties({ scope: heatmap.scope, palette: "sequential" }),
                values: objectProperties({ normalization: heatmap.normalization, additive: heatmap.additive, showValues: true }),
                layout: objectProperties({ cellWidth: split ? 100 : 160, cellHeight: 42, labelWidth: 118, fontSize: 12 })
            }));
    });
    visuals.push(visual(`${page.name}Companion`, "pivotTable", position(24, 540, 888, 248, 5),
        "Native matrix | model value, denominator and ratio",
        sortedQuery({ Rows: role(row), Columns: role(col), Values: role(value, denominator, ratio) }, row, col)));
    dataset.dimensions.forEach((dimension, i) => {
        visuals.push(visual(`${page.name}${dimension}Slicer`, "slicer",
            split ? position(940, 540 + i * 130, 316, 118, 6 + i) : position(940, 150 + i * 200, 316, 184, 6 + i),
            `Filter ${dimension}`, sortedQuery({ Values: role(column(dimension)) }, column(dimension)),
            { data: objectProperties({ mode: "Dropdown" }) }));
    });
    visuals.push(textVisual(`${page.name}Footer`, page.footer, position(24, 810, 1232, 74, 8)));
    const dataVisuals = visuals.filter(item => item.visual.query);
    return {
        page: {
            $schema: schemas.page, name: page.name, displayName: page.displayName,
            displayOption: "FitToPage", width: 1280, height: 900,
            visualInteractions: dataVisuals.flatMap(source => dataVisuals.filter(target => target !== source)
                .map(target => ({ source: source.name, target: target.name, type: "DataFilter" })))
        },
        visuals
    };
}

export async function buildProject(packagePath = defaultPackage) {
    const files = new Map();
    const inputHashes = {};
    const input = name => {
        const bytes = readFileSync(path.join(root, ...safeRelative(name).split("/")));
        inputHashes[name] = sha256(bytes);
        return bytes.toString("utf8");
    };
    const put = (name, content) => {
        safeRelative(name);
        assert(!files.has(name), `Duplicate artifact: ${name}`);
        files.set(name, Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"));
    };
    const spec = JSON.parse(input("samples/project/project.json"));
    const config = JSON.parse(input("pbiviz.json"));
    assert.equal(spec.guid, "atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37");
    assert.equal(spec.version, "1.0.1.0");
    assert.equal(config.visual.guid, spec.guid, "Source visual GUID changed");
    assert.equal(config.visual.version, spec.version, "Source visual version changed");
    const bytes = readFileSync(packagePath);
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
    assert(zip.file("package.json"), "The official package must contain package.json");
    const manifest = JSON.parse(await zip.file("package.json").async("string"));
    assert.equal(manifest.visual.guid, spec.guid, "Package GUID mismatch");
    assert.equal(manifest.visual.version, spec.version, "Package visual version mismatch");
    assert.equal(manifest.version, spec.version, "Package manifest version mismatch");
    const resourceId = manifest.metadata?.pbivizjson?.resourceId;
    const metadata = manifest.resources?.find(item => item.resourceId === resourceId && item.sourceType === 5);
    assert(metadata, "No declared pbiviz metadata resource in package");
    safeRelative(metadata.file);
    assert.equal(metadata.file, `resources/${spec.guid}.pbiviz.json`, "Unexpected official visual resource path");
    assert(zip.file(metadata.file), "Declared visual payload is missing");
    const payload = JSON.parse(await zip.file(metadata.file).async("string"));
    assert.equal(payload.visual.guid, spec.guid, "Payload GUID mismatch");
    assert.equal(payload.visual.version, spec.version, "Payload version mismatch");
    for (const property of ["name", "displayName", "visualClassName"]) {
        assert.equal(manifest.visual[property], config.visual[property], `Package ${property} mismatch`);
        assert.equal(payload.visual[property], config.visual[property], `Payload ${property} mismatch`);
    }
    assert(payload.content?.js && typeof payload.style === "string", "Missing packaged executable or style");
    assert(!payload.externalJS?.length && !payload.capabilities.privileges?.length, "Sample requires an offline, privilege-free package");
    assert.deepEqual(payload.capabilities.dataRoles.map(item => item.name).sort(), ["column", "denominator", "row", "tooltips", "value"]);
    for (const entry of Object.values(zip.files).filter(item => !item.dir).sort((a, b) => a.name.localeCompare(b.name))) {
        safeRelative(entry.name);
        assert(!entry.unsafeOriginalName || entry.unsafeOriginalName === entry.name, "Package contains a normalized traversal path");
        put(`${reportFolder}/CustomVisuals/${spec.guid}/${entry.name}`, await entry.async("nodebuffer"));
    }
    for (const resource of manifest.resources) assert(files.has(`${reportFolder}/CustomVisuals/${spec.guid}/${safeRelative(resource.file)}`), "Unresolved package resource");
    put(`${projectName}.pbip`, input("samples/project/AtlynHeatmapSample.pbip"));
    put(`${reportFolder}/definition.pbir`, input("samples/project/definition.pbir"));
    put(`${modelFolder}/definition.pbism`, input("samples/project/definition.pbism"));
    put(`${modelFolder}/definition/database.tmdl`, input("samples/project/database.tmdl").replaceAll("\r\n", "\n"));
    put(`${modelFolder}/definition/model.tmdl`, input("samples/project/model.tmdl").replaceAll("\r\n", "\n"));
    const relationships = [];
    const datasets = new Map();
    for (const dataset of spec.datasets) {
        const rows = parseCsv(input(`samples/${dataset.input}.csv`), dataset);
        const measures = parseMeasures(input(`samples/${dataset.input}.dax`), dataset.formats);
        put(`${modelFolder}/definition/tables/${dataset.table}.tmdl`, tableTmdl(dataset.table, dataset.columns, rows, measures));
        for (const dimension of dataset.dimensions) {
            const keyIndex = dataset.columns.findIndex(item => item.name === dimension);
            const sortIndex = dataset.columns.findIndex(item => item.name === `${dimension}Sort`);
            assert(keyIndex >= 0 && sortIndex >= 0, `Missing dimension/sort column: ${dimension}`);
            const keys = new Map();
            for (const row of rows) {
                assert(row[sortIndex] !== null, "Sort keys cannot be blank");
                assert(!keys.has(row[keyIndex]) || keys.get(row[keyIndex]) === row[sortIndex], "Conflicting dimension sort key");
                keys.set(row[keyIndex], row[sortIndex]);
            }
            assert.equal(new Set(keys.values()).size, keys.size, "Sort keys must be unique");
            const members = [...keys].sort((a, b) => a[1] - b[1]);
            put(`${modelFolder}/definition/tables/${dimension}.tmdl`,
                tableTmdl(dimension, [dataset.columns[keyIndex], dataset.columns[sortIndex]], members, [], true));
            relationships.push(`relationship ${dataset.table}_${dimension}\n\tfromColumn: ${dataset.table}.${dimension}\n\ttoColumn: ${dimension}.${dimension}\n\tfromCardinality: many\n\ttoCardinality: one\n\tcrossFilteringBehavior: oneDirection`);
        }
        datasets.set(dataset.table, { ...dataset, rows, measures });
    }
    put(`${modelFolder}/definition/relationships.tmdl`, `${relationships.join("\n\n")}\n`);
    put(`${reportFolder}/definition/version.json`, json({ $schema: schemas.version, version: "2.0.0" }));
    put(`${reportFolder}/definition/report.json`, json({
        $schema: schemas.report, themeCollection: {},
        resourcePackages: [{
            name: spec.guid, type: "CustomVisual",
            items: [{ name: path.posix.basename(metadata.file), path: path.posix.basename(metadata.file), type: "CustomVisualMetadata" }]
        }],
        settings: { defaultFilterActionIsDataFilter: true, useStylableVisualContainerHeader: true, exportDataMode: "AllowSummarized" },
        annotations: [{ name: "AtlynSample", value: "Synthetic offline sample; static checks are not native Desktop validation." }]
    }));
    put(`${reportFolder}/definition/pages/pages.json`, json({
        $schema: schemas.pages, pageOrder: spec.pages.map(page => page.name), activePageName: spec.pages[0].name
    }));
    for (const definition of spec.pages) {
        const dataset = datasets.get(definition.dataset);
        assert(dataset, `Unknown page dataset: ${definition.dataset}`);
        const page = buildPage(definition, dataset, spec.guid);
        put(`${reportFolder}/definition/pages/${definition.name}/page.json`, json(page.page));
        for (const item of page.visuals) put(`${reportFolder}/definition/pages/${definition.name}/visuals/${item.name}/visual.json`, json(item));
    }
    put(".gitignore", "**/.pbi/localSettings.json\n**/.pbi/cache.abf\n**/.pbi/unappliedChanges.json\n");
    put("README.txt", "Atlyn Heatmap offline synthetic sample\n\nOpen AtlynHeatmapSample.pbip in a supported Power BI Desktop, then Refresh.\nNo cache.abf is included: data is embedded in local M #table expressions.\nThe report already contains the private visual, field queries, measures and formatting.\nNo CSV paths, credentials, live model, externalJS or AppSource download is needed.\nSee samples\\PBIP.md in the source repository for build, validation and walkthroughs.\n\nNOT NATIVE-VALIDATED: Desktop open, refresh, rendering, interactions and genuine\nSave As / export to PBIX remain a manual release hold. This is NOT a PBIX.\n");
    input("scripts/create-sample.mjs");
    const provenance = {
        generator: "atlyn-offline-pbip-v1",
        package: { file: path.basename(packagePath), guid: spec.guid, version: spec.version, sha256: sha256(bytes), metadata: metadata.file },
        nativeDesktopValidated: false,
        inputSha256: Object.fromEntries(Object.entries(inputHashes).sort(([a], [b]) => a.localeCompare(b))),
        files: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, content]) => [name, sha256(content)]))
    };
    put("sample-manifest.json", json(provenance));
    return { files, spec, datasets, payload, provenance };
}

export function parseArgs(args) {
    const result = { output: defaultOutput, packagePath: defaultPackage, schemas: false };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--output" || arg === "--package") {
            assert(args[i + 1] && !args[i + 1].startsWith("--"), `Missing value for ${arg}`);
            result[arg === "--output" ? "output" : "packagePath"] = path.resolve(args[++i]);
        } else if (arg === "--schemas") result.schemas = true;
        else if (!arg.startsWith("-") && result.output === defaultOutput) result.output = path.resolve(arg);
        else throw new Error(`Unknown argument: ${arg}`);
    }
    return result;
}

export function assertSafeOutput(output) {
    const relative = path.relative(path.join(root, "dist"), output);
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Output must be a child folder of this repository's ignored dist directory");
    let current = output;
    while (current !== path.dirname(root)) {
        if (existsSync(current)) assert(!lstatSync(current).isSymbolicLink(), `Refusing linked output path: ${current}`);
        current = path.dirname(current);
    }
}

export function artifactFiles(directory, prefix = "") {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        assert(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
        const name = `${prefix}${entry.name}`;
        return entry.isDirectory() ? artifactFiles(path.join(directory, entry.name), `${name}/`) : [name];
    }).sort();
}

export async function createSample({ output, packagePath }) {
    assertSafeOutput(output);
    const built = await buildProject(packagePath);
    if (existsSync(output) && artifactFiles(output).length) {
        const oldPath = path.join(output, "sample-manifest.json");
        assert(existsSync(oldPath), "Refusing to overwrite a folder without an Atlyn sample manifest");
        const old = JSON.parse(readFileSync(oldPath, "utf8"));
        assert.equal(old.generator, "atlyn-offline-pbip-v1", "Unrecognized output folder");
        assert.deepEqual(artifactFiles(output), [...Object.keys(old.files), "sample-manifest.json"].sort(), "Output has extra files; use a new folder for a Desktop-edited project");
        for (const [name, hash] of Object.entries(old.files)) {
            safeRelative(name);
            assert.equal(sha256(readFileSync(path.join(output, ...name.split("/")))), hash, `Refusing to overwrite modified artifact: ${name}`);
        }
        for (const name of Object.keys(old.files)) if (!built.files.has(name)) unlinkSync(path.join(output, ...name.split("/")));
    }
    for (const [name, content] of built.files) {
        const destination = path.join(output, ...name.split("/"));
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, content);
        assert.equal(sha256(readFileSync(destination)), sha256(content), `Write verification failed: ${name}`);
    }
    return built;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = parseArgs(process.argv.slice(2));
    assert(!args.schemas, "Use --schemas with scripts\\validate-sample.mjs, not the offline builder");
    const result = await createSample(args);
    console.log(`Generated ${result.files.size} files, ${result.spec.pages.length} bound pages: ${args.output}`);
    console.log(`Exact package SHA-256: ${result.provenance.package.sha256}`);
    console.log("Native Desktop open/refresh/render/export validation remains required.");
}
