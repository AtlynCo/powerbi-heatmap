import type powerbi from "powerbi-visuals-api";

export const MAX_ROWS = 500;
export const MAX_COLUMNS = 100;
export const MAX_CELLS = 20000;

export type CellState = "value" | "blank" | "absent" | "invalid" | "unloaded" | "unavailable";
export interface Scalar { state: CellState; value?: number; }
export interface Axis {
    node: powerbi.DataViewMatrixNode;
    source: powerbi.DataViewMetadataColumn;
    value: powerbi.PrimitiveValue;
}
export interface Cell {
    row: number;
    column: number;
    raw: Scalar;
    denominator: Scalar;
    highlight: Scalar;
    hasHighlight: boolean;
    format?: string;
    tooltips: { source: powerbi.DataViewMetadataColumn; value: powerbi.PrimitiveValue | undefined }[];
}
export interface Model {
    rows: Axis[];
    columns: Axis[];
    cells: Cell[];
    rowLevels: powerbi.DataViewHierarchyLevel[];
    columnLevels: powerbi.DataViewHierarchyLevel[];
    valueSource?: powerbi.DataViewMetadataColumn;
    denominatorSource?: powerbi.DataViewMetadataColumn;
    partial: boolean;
    segment: boolean;
    limited: boolean;
    hasHighlights: boolean;
    error?: string;
    notices: string[];
}

const owns = (object: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(object, key);
const role = (source: powerbi.DataViewMetadataColumn, name: string): boolean => source.roles?.[name] === true;

function scalar(value: unknown, partial: boolean): Scalar {
    if (value === undefined) return { state: partial ? "unloaded" : "absent" };
    if (value === null) return { state: "blank" };
    return typeof value === "number" && Number.isFinite(value)
        ? { state: "value", value } : { state: "invalid" };
}

function category(node: powerbi.DataViewMatrixNode, source: powerbi.DataViewMetadataColumn): Axis {
    // levelValues is authoritative, including an explicitly blank category.
    const value = node.levelValues !== undefined ? node.levelValues[0]?.value : node.value;
    // The host uses null for BLANK although the API's PrimitiveValue omits it.
    return { node, source, value: (value ?? null) as powerbi.PrimitiveValue };
}

function isNumeric(source: powerbi.DataViewMetadataColumn): boolean {
    return !source.type || source.type.numeric === true || source.type.integer === true;
}

function isMeasureSource(source: powerbi.DataViewMetadataColumn, sources: powerbi.DataViewMetadataColumn[]): boolean {
    return !role(source, "row") && !role(source, "column")
        && (source.isMeasure === true || sources.some(candidate => candidate === source
            || (candidate.queryName !== undefined && candidate.queryName === source.queryName)));
}

function validCategory(node: powerbi.DataViewMatrixNode): boolean {
    return (node.level === undefined || node.level === 0)
        && (node.levelSourceIndex === undefined || node.levelSourceIndex === 0)
        && (node.levelValues === undefined || (Array.isArray(node.levelValues) && node.levelValues.length === 1
            && node.levelValues[0]?.levelSourceIndex === 0));
}

export function buildModel(dataView: powerbi.DataView | undefined): Model {
    const segment = dataView?.metadata?.segment !== undefined;
    const reduced = dataView?.metadata?.dataReduction !== undefined;
    const model: Model = {
        rows: [], columns: [], cells: [], rowLevels: [], columnLevels: [],
        partial: segment || reduced, segment, limited: reduced, hasHighlights: false, notices: []
    };
    const fail = (message: string): Model => {
        model.error = message;
        model.rows = [];
        model.columns = [];
        model.cells = [];
        model.hasHighlights = false;
        return model;
    };
    const matrix = dataView?.matrix;
    if (!matrix || !matrix.rows?.root || !matrix.columns?.root
        || !Array.isArray(matrix.valueSources) || !Array.isArray(matrix.rows.levels)
        || !Array.isArray(matrix.columns.levels)) {
        return fail("Add one Row field, one Column field, and one numeric Value measure.");
    }
    model.rowLevels = matrix.rows.levels;
    model.columnLevels = matrix.columns.levels;
    const sources = matrix.valueSources;
    const validSource = (source: powerbi.DataViewMetadataColumn): boolean => source !== null && typeof source === "object";
    if (!sources.every(validSource)
        || [...matrix.rows.levels, ...matrix.columns.levels].some(level =>
            !level || !Array.isArray(level.sources) || !level.sources.every(validSource))
        || (matrix.rows.root.children !== undefined && !Array.isArray(matrix.rows.root.children))
        || (matrix.columns.root.children !== undefined && !Array.isArray(matrix.columns.root.children))
        || (dataView?.metadata?.columns !== undefined && (!Array.isArray(dataView.metadata.columns)
            || !dataView.metadata.columns.every(validSource)))) {
        return fail("The host returned an invalid matrix structure.");
    }
    const valueIndices = sources.flatMap((source, index) => role(source, "value") ? [index] : []);
    const denominatorIndices = sources.flatMap((source, index) => role(source, "denominator") ? [index] : []);
    const tooltipIndices = sources.flatMap((source, index) => role(source, "tooltips") ? [index] : []);
    const rowSource = matrix.rows.levels[0]?.sources[0];
    const columnSource = matrix.columns.levels[0]?.sources[0];
    const metadata = dataView?.metadata?.columns ?? [];
    if (!rowSource || !columnSource || !role(rowSource, "row") || !role(columnSource, "column")
        || matrix.rows.levels.length !== 1 || matrix.rows.levels[0].sources.length !== 1
        || matrix.columns.levels[0].sources.length !== 1 || matrix.columns.levels.length > 2
        || (matrix.columns.levels[1] && !matrix.columns.levels[1].sources.every(source => isMeasureSource(source, sources)))
        || metadata.filter(source => role(source, "row")).length > 1
        || metadata.filter(source => role(source, "column")).length > 1) {
        return fail("Use exactly one Row field and one Column field; additional category hierarchy levels are not supported.");
    }
    if (valueIndices.length !== 1 || denominatorIndices.length > 1 || tooltipIndices.length > 3 || sources.length > 5
        || metadata.filter(source => role(source, "value")).length > 1
        || metadata.filter(source => role(source, "denominator")).length > 1
        || sources.some(source => ((role(source, "value") || role(source, "denominator")) && !isNumeric(source))
            || !(role(source, "value") || role(source, "denominator") || role(source, "tooltips")))) {
        return fail("Use one numeric Value, at most one numeric Denominator, and up to three tooltip measures.");
    }
    const valueIndex = valueIndices[0];
    const denominatorIndex = denominatorIndices[0];
    model.valueSource = sources[valueIndex];
    model.denominatorSource = denominatorIndex === undefined ? undefined : sources[denominatorIndex];
    const columnSlots: number[][] = [];
    let ordinal = 0;
    let columnCount = 0;
    let scannedColumns = 0;
    let scanLimited = false;
    const columnNodes = matrix.columns.root.children ?? [];
    columnsLoop:
    for (let nodeIndex = 0; nodeIndex < columnNodes.length; nodeIndex++) {
        if (++scannedColumns > MAX_CELLS) {
            scanLimited = true;
            break;
        }
        const node = columnNodes[nodeIndex];
        if (!node || typeof node !== "object" || (node.children !== undefined && !Array.isArray(node.children))) {
            return fail("The host returned an invalid matrix structure.");
        }
        const children = node.children ?? [];
        if (!node.isSubtotal && !validCategory(node)) {
            return fail("Additional category hierarchy levels are not supported.");
        }
        const offsets: number[] = [];
        for (let index = 0; index < children.length; index++) {
            if (++scannedColumns > MAX_CELLS) {
                scanLimited = true;
                break columnsLoop;
            }
            const child = children[index];
            if (!child || typeof child !== "object" || (child.children?.length ?? 0) > 0
                || (child.level !== undefined && child.level !== 1)
                || !matrix.columns.levels[1]
                || !matrix.columns.levels[1].sources.every(source => isMeasureSource(source, sources))) {
                return fail("Additional category hierarchy levels are not supported.");
            }
            if (!child.isSubtotal && !node.isSubtotal) {
                if (offsets.length >= sources.length) return fail("The host returned too many measure leaves for a column.");
                offsets.push(index);
            }
        }
        // Matrix value keys address flattened measure leaves, not displayed categories.
        // Even excluded subtotal columns consume their original ordinal slots.
        const count = children.length || sources.length;
        if (children.length === 0 && !node.isSubtotal) sources.forEach((_, index) => offsets.push(index));
        if (!node.isSubtotal) {
            columnCount++;
            model.columns.push(category(node, columnSource));
            columnSlots.push(offsets.map(offset => ordinal + offset));
            if (columnCount >= MAX_COLUMNS) break;
        }
        ordinal += count;
    }
    const rowLimit = model.columns.length === 0 ? MAX_ROWS
        : Math.min(MAX_ROWS, Math.floor(MAX_CELLS / model.columns.length));
    let rowCount = 0;
    let scannedRows = 0;
    const rowNodes = matrix.rows.root.children ?? [];
    for (let nodeIndex = 0; nodeIndex < rowNodes.length; nodeIndex++) {
        if (++scannedRows > MAX_CELLS) {
            scanLimited = true;
            break;
        }
        const node = rowNodes[nodeIndex];
        if (!node || typeof node !== "object" || (node.children !== undefined && !Array.isArray(node.children))) {
            return fail("The host returned an invalid matrix structure.");
        }
        if (node.isSubtotal) continue;
        if (!validCategory(node) || (node.children?.length ?? 0) > 0) {
            return fail("Additional category hierarchy levels are not supported.");
        }
        rowCount++;
        if (rowCount > rowLimit) break;
        model.rows.push(category(node, rowSource));
    }
    model.limited ||= columnCount >= MAX_COLUMNS || rowCount > rowLimit || scanLimited;
    model.partial ||= model.limited;
    if (model.segment) model.notices.push("The host supplied a data segment; some intersections may not be loaded.");
    if (reduced) model.notices.push("The host reports data reduction; the matrix may be incomplete.");
    if (columnCount >= MAX_COLUMNS) model.notices.push("The 100-column host limit was reached; additional columns may be omitted.");
    if (rowCount > rowLimit) model.notices.push("The displayed matrix is capped at 500 rows, 100 columns, and 20,000 cells.");
    if (scanLimited) model.notices.push("The matrix hierarchy exceeds the safe processing limit; remaining categories were not loaded.");
    if (model.partial) model.notices.push("Computed shares are unavailable while the data is incomplete; supplied model denominators remain usable.");
    if (model.rows.length === 0 || model.columns.length === 0) return fail("No category intersections were returned for the current filters.");
    for (let row = 0; row < model.rows.length; row++) {
        const values = model.rows[row].node.values;
        for (let column = 0; column < model.columns.length; column++) {
            const slots = columnSlots[column];
            const measures = new Map<number, powerbi.DataViewMatrixNodeValue>();
            const invalid = new Set<number>();
            for (let offset = 0; offset < slots.length; offset++) {
                const key = slots[offset];
                if (!values || !owns(values, key)) continue;
                const entry = values[key];
                if (entry === undefined) continue;
                if (entry === null || typeof entry !== "object") {
                    invalid.add(offset % sources.length);
                    continue;
                }
                const sourceIndex = entry.valueSourceIndex ?? 0;
                if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= sources.length) {
                    return fail("The host returned an invalid matrix measure index.");
                }
                if ((!owns(entry, "value") || entry.value === undefined) && !owns(entry, "highlight")
                    && typeof entry.objects?.general?.formatString !== "string") continue;
                if (measures.has(sourceIndex)) invalid.add(sourceIndex);
                measures.set(sourceIndex, entry);
            }
            const measureValue = (index: number): powerbi.PrimitiveValue | undefined => {
                const entry = measures.get(index);
                return entry && owns(entry, "value") ? entry.value : undefined;
            };
            const read = (index: number | undefined): Scalar => index === undefined ? { state: "unavailable" }
                : invalid.has(index) ? { state: "invalid" } : scalar(measureValue(index), model.partial);
            const entry = measures.get(valueIndex);
            const hasHighlight = entry !== undefined && owns(entry, "highlight");
            const format = entry?.objects?.general?.formatString;
            model.hasHighlights ||= hasHighlight;
            model.cells.push({
                row, column, raw: read(valueIndex), denominator: read(denominatorIndex),
                highlight: hasHighlight ? scalar(entry?.highlight, model.partial) : { state: "absent" },
                hasHighlight,
                format: typeof format === "string" ? format : undefined,
                tooltips: tooltipIndices.map(index => ({ source: sources[index], value: measureValue(index) }))
            });
        }
    }
    return model;
}
