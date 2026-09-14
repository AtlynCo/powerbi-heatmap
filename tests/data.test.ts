import assert from "node:assert/strict";
import test from "node:test";
import type powerbi from "powerbi-visuals-api";
import { buildModel, MAX_CELLS, MAX_COLUMNS, MAX_ROWS } from "../src/data";
import { matrixFixture } from "./fixtures";

const blank = null as unknown as powerbi.PrimitiveValue;

function singleMeasure(rows = 1, columns = 2, children = false): powerbi.DataView {
    const view = matrixFixture(rows, columns);
    const matrix = view.matrix!;
    matrix.valueSources = [matrix.valueSources[0]];
    view.metadata.columns = view.metadata.columns.filter(source => !source.roles?.denominator && !source.roles?.tooltips);
    matrix.columns.levels = children
        ? [matrix.columns.levels[0], { sources: matrix.valueSources }] : [matrix.columns.levels[0]];
    for (const node of matrix.columns.root.children!) {
        node.children = children ? [{ level: 1 }] : undefined;
    }
    matrix.rows.root.children!.forEach((node, row) => {
        node.values = Object.fromEntries(Array.from({ length: columns }, (_, column) => [column, { value: row * 10 + column }]));
    });
    return view;
}

test("missing input and wrong shape return clear errors with no fake cells", () => {
    for (const input of [undefined, { metadata: { columns: [] } }, {} as powerbi.DataView]) {
        const model = buildModel(input);
        assert.ok(model.error);
        assert.deepEqual(model.cells, []);
        assert.deepEqual(model.rows, []);
        assert.deepEqual(model.columns, []);
    }
});

test("empty state and partial field mappings fail safely with clear errors and no fake cells", () => {
    const rowSource: powerbi.DataViewMetadataColumn = { displayName: "RowCol", queryName: "RowCol", roles: { row: true } };
    const colSource: powerbi.DataViewMetadataColumn = { displayName: "ColCol", queryName: "ColCol", roles: { column: true } };
    const valSource: powerbi.DataViewMetadataColumn = { displayName: "ValCol", queryName: "ValCol", isMeasure: true, roles: { value: true } };
    const emptyHierarchy: powerbi.DataViewHierarchy = { root: {}, levels: [] };

    const partialCases: [string, powerbi.DataView | undefined][] = [
        ["undefined dataView", undefined],
        ["empty dataView object", {} as powerbi.DataView],
        ["empty columns array", { metadata: { columns: [] } }],
        ["row only", {
            metadata: { columns: [rowSource] },
            matrix: {
                rows: { root: { children: [{ value: "R1" }] }, levels: [{ sources: [rowSource] }] },
                columns: emptyHierarchy,
                valueSources: []
            }
        }],
        ["column only", {
            metadata: { columns: [colSource] },
            matrix: {
                rows: emptyHierarchy,
                columns: { root: { children: [{ value: "C1" }] }, levels: [{ sources: [colSource] }] },
                valueSources: []
            }
        }],
        ["value only", {
            metadata: { columns: [valSource] },
            matrix: {
                rows: emptyHierarchy,
                columns: emptyHierarchy,
                valueSources: [valSource]
            }
        }],
        ["row and column without value", {
            metadata: { columns: [rowSource, colSource] },
            matrix: {
                rows: { root: { children: [{ value: "R1" }] }, levels: [{ sources: [rowSource] }] },
                columns: { root: { children: [{ value: "C1" }] }, levels: [{ sources: [colSource] }] },
                valueSources: []
            }
        }],
        ["row and value without column", {
            metadata: { columns: [rowSource, valSource] },
            matrix: {
                rows: { root: { children: [{ value: "R1" }] }, levels: [{ sources: [rowSource] }] },
                columns: emptyHierarchy,
                valueSources: [valSource]
            }
        }],
        ["column and value without row", {
            metadata: { columns: [colSource, valSource] },
            matrix: {
                rows: emptyHierarchy,
                columns: { root: { children: [{ value: "C1" }] }, levels: [{ sources: [colSource] }] },
                valueSources: [valSource]
            }
        }]
    ];

    for (const [name, input] of partialCases) {
        const model = buildModel(input);
        assert.ok(model.error, `${name}: expected model.error to be set`);
        assert.deepEqual(model.cells, [], `${name}: expected model.cells to be empty`);
        assert.deepEqual(model.rows, [], `${name}: expected model.rows to be empty`);
        assert.deepEqual(model.columns, [], `${name}: expected model.columns to be empty`);
    }
});

test("host row/column order and node identities survive without caption deduplication", () => {
    const view = matrixFixture(3, 2);
    const matrix = view.matrix!;
    matrix.rows.root.children![0].levelValues![0].value = "Same";
    matrix.rows.root.children![1].levelValues![0].value = "Same";
    matrix.columns.root.children![0].levelValues![0].value = "Same";
    matrix.columns.root.children![1].levelValues![0].value = "Same";
    const model = buildModel(view);
    assert.equal(model.error, undefined);
    assert.equal(model.rows.length, 3);
    assert.equal(model.columns.length, 2);
    model.rows.forEach((axis, index) => assert.equal(axis.node, matrix.rows.root.children![index]));
    model.columns.forEach((axis, index) => assert.equal(axis.node, matrix.columns.root.children![index]));
    assert.equal(model.rowLevels, matrix.rows.levels);
    assert.equal(model.columnLevels, matrix.columns.levels);
    assert.deepEqual(model.cells.map(cell => [cell.row, cell.column]), [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]);
});

test("levelValues preserve numeric, date and blank categories over deprecated values", () => {
    const view = matrixFixture(3, 3);
    const date = new Date("2026-01-01T00:00:00Z");
    const labels = [0, date, blank];
    for (const nodes of [view.matrix!.rows.root.children!, view.matrix!.columns.root.children!]) {
        nodes.forEach((node, index) => {
            node.value = "Deprecated";
            node.levelValues = [{ levelSourceIndex: 0, value: labels[index] }];
        });
    }
    const model = buildModel(view);
    assert.deepEqual(model.rows.map(axis => axis.value), labels);
    assert.deepEqual(model.columns.map(axis => axis.value), labels);
    assert.equal(model.rows[1].value, date);
});

test("legacy category value remains supported when levelValues is absent", () => {
    const view = singleMeasure();
    const node = view.matrix!.rows.root.children![0];
    delete node.levelValues;
    node.value = 42;
    assert.equal(buildModel(view).rows[0].value, 42);
});

test("canonical multi-measure leaf indexing uses valueSourceIndex, whose default is zero", () => {
    const view = matrixFixture(1, 2);
    const matrix = view.matrix!;
    const model = buildModel(view);
    assert.deepEqual(model.cells.map(cell => cell.raw.value), [100.5, 201]);
    assert.deepEqual(model.cells.map(cell => cell.denominator.value), [2000, 2000]);
    assert.equal(model.cells[1].tooltips[0].value, 10);
    assert.equal(model.cells[1].tooltips[0].source, matrix.valueSources[2]);
    assert.equal(model.valueSource, matrix.valueSources[0]);
    assert.equal(model.denominatorSource, matrix.valueSources[1]);

    matrix.valueSources = [matrix.valueSources[1], matrix.valueSources[0], matrix.valueSources[2]];
    matrix.columns.levels[1].sources = matrix.valueSources;
    matrix.rows.root.children![0].values = {
        0: { value: 9 }, 1: { value: 0.25, valueSourceIndex: 1 }, 2: { value: 3, valueSourceIndex: 2 },
        3: { value: 10 }, 4: { value: 0.75, valueSourceIndex: 1 }, 5: { value: 4, valueSourceIndex: 2 }
    };
    const reordered = buildModel(view);
    assert.deepEqual(reordered.cells.map(cell => cell.raw.value), [0.25, 0.75]);
    assert.deepEqual(reordered.cells.map(cell => cell.denominator.value), [9, 10]);
});

test("single-measure columns work with and without measure-only children", () => {
    for (const children of [false, true]) {
        const model = buildModel(singleMeasure(2, 2, children));
        assert.equal(model.error, undefined);
        assert.deepEqual(model.cells.map(cell => cell.raw.value), [0, 1, 10, 11]);
        assert.ok(model.cells.every(cell => cell.denominator.state === "unavailable"));
    }
});

test("multi-measure compact columns without explicit measure children preserve source stride", () => {
    const view = matrixFixture(1, 3);
    view.matrix!.columns.levels = [view.matrix!.columns.levels[0]];
    view.matrix!.columns.root.children!.forEach(node => delete node.children);
    const model = buildModel(view);
    assert.equal(model.error, undefined);
    assert.deepEqual(model.cells.map(cell => cell.raw.value), [100.5, 201, 301.5]);
    assert.deepEqual(model.cells.map(cell => cell.denominator.value), [2000, 2000, 2000]);
});

test("subtotal columns keep ordinal slots while subtotal rows never become displayed data", () => {
    const view = matrixFixture(1, 2);
    const matrix = view.matrix!;
    const total: powerbi.DataViewMatrixNode = {
        level: 0, isSubtotal: true, children: [{ level: 1 }, { level: 1, levelSourceIndex: 1 }, { level: 1, levelSourceIndex: 2 }]
    };
    matrix.columns.root.children!.splice(1, 0, total);
    matrix.columns.root.children!.push(total);
    matrix.rows.root.children![0].values = {
        0: { value: 10 }, 1: { value: 20, valueSourceIndex: 1 }, 2: { value: 30, valueSourceIndex: 2 },
        3: { value: 999 }, 4: { value: 999, valueSourceIndex: 1 }, 5: { value: 999, valueSourceIndex: 2 },
        6: { value: 40 }, 7: { value: 50, valueSourceIndex: 1 }, 8: { value: 60, valueSourceIndex: 2 },
        9: { value: 999 }, 10: { value: 999, valueSourceIndex: 1 }, 11: { value: 999, valueSourceIndex: 2 }
    };
    matrix.rows.root.children!.unshift({ isSubtotal: true, values: { 0: { value: 99999 } } });
    const model = buildModel(view);
    assert.equal(model.error, undefined);
    assert.equal(model.rows.length, 1);
    assert.equal(model.columns.length, 2);
    assert.deepEqual(model.cells.map(cell => [cell.raw.value, cell.denominator.value, cell.tooltips[0].value]), [[10, 20, 30], [40, 50, 60]]);
});

test("subtotal leaf slots inside a category are skipped but still advance the next column", () => {
    const view = singleMeasure(1, 2, true);
    view.matrix!.columns.root.children![0].children!.unshift({ level: 1, isSubtotal: true });
    view.matrix!.rows.root.children![0].values = { 0: { value: 999 }, 1: { value: 10 }, 2: { value: 20 } };
    assert.deepEqual(buildModel(view).cells.map(cell => cell.raw.value), [10, 20]);
});

test("sparse multi-measure values never shift later columns or fill missing cells with zero", () => {
    const view = matrixFixture(1, 3);
    view.matrix!.rows.root.children![0].values = {
        0: { value: blank }, 2: { value: 12, valueSourceIndex: 2 },
        4: { value: 10, valueSourceIndex: 1 }, 6: { value: 0 }
    };
    const model = buildModel(view);
    assert.deepEqual(model.cells.map(cell => cell.raw), [{ state: "blank" }, { state: "absent" }, { state: "value", value: 0 }]);
    assert.deepEqual(model.cells.map(cell => cell.denominator.state), ["absent", "value", "absent"]);
    assert.equal(model.cells[0].tooltips[0].value, 12);
});

test("null, undefined, empty and omitted value slots retain separate meanings", () => {
    const view = singleMeasure(1, 5);
    view.matrix!.rows.root.children![0].values = { 0: { value: blank }, 1: { value: undefined }, 2: {}, 4: { value: 0 } };
    assert.deepEqual(buildModel(view).cells.map(cell => cell.raw.state), ["blank", "absent", "absent", "absent", "value"]);
    view.metadata.segment = {};
    assert.deepEqual(buildModel(view).cells.map(cell => cell.raw.state), ["blank", "unloaded", "unloaded", "unloaded", "value"]);
});

test("empty non-primary measure slots do not impersonate source zero", () => {
    const view = matrixFixture(1, 1);
    view.matrix!.rows.root.children![0].values = { 0: { value: 42 }, 1: {}, 2: { value: undefined } };
    const cell = buildModel(view).cells[0];
    assert.deepEqual(cell.raw, { state: "value", value: 42 });
    assert.equal(cell.denominator.state, "absent");
});

test("strings, booleans, NaN and infinities are invalid without coercion", () => {
    const view = singleMeasure(1, 6);
    view.matrix!.rows.root.children![0].values = Object.fromEntries(["12", true, NaN, Infinity, -Infinity, 0]
        .map((value, index) => [index, { value }]));
    assert.deepEqual(buildModel(view).cells.map(cell => cell.raw.state), ["invalid", "invalid", "invalid", "invalid", "invalid", "value"]);
});

test("highlights preserve property presence and distinguish null, zero and undefined", () => {
    const view = singleMeasure(1, 5);
    view.matrix!.rows.root.children![0].values = {
        0: { value: 10 }, 1: { value: 20, highlight: blank }, 2: { value: 30, highlight: 0 },
        3: { value: 40, highlight: undefined }, 4: { value: 50, highlight: "2" }
    };
    const model = buildModel(view);
    assert.equal(model.hasHighlights, true);
    assert.deepEqual(model.cells.map(cell => cell.hasHighlight), [false, true, true, true, true]);
    assert.deepEqual(model.cells.map(cell => cell.highlight), [
        { state: "absent" }, { state: "blank" }, { state: "value", value: 0 }, { state: "absent" }, { state: "invalid" }
    ]);
    assert.deepEqual(model.cells.map(cell => cell.raw.value), [10, 20, 30, 40, 50]);
});

test("cell formats preserve host strings without synthesizing or coercing a format", () => {
    const view = singleMeasure(1, 5);
    view.matrix!.rows.root.children![0].values = {
        0: { value: 10, objects: { general: { formatString: "$0.00;($0.00)" } } },
        1: { value: 20, objects: { general: { formatString: 123 } } },
        2: { value: 30, objects: { general: {} } },
        3: { value: 40, objects: { general: { formatString: "" } } },
        4: { objects: { general: { formatString: "0.0%" } } }
    };
    const model = buildModel(view);
    assert.deepEqual(model.cells.map(cell => cell.format), ["$0.00;($0.00)", undefined, undefined, "", "0.0%"]);
    assert.equal(model.cells[4].raw.state, "absent");
    assert.equal(model.cells[0].raw.value, 10);
    assert.notEqual(model.valueSource?.format, model.cells[0].format);
});

test("denominator and tooltip cell formats never replace the Value cell format", () => {
    const view = matrixFixture(1, 1);
    const values = view.matrix!.rows.root.children![0].values!;
    values[1].objects = { general: { formatString: "0%" } };
    values[2].objects = { general: { formatString: "#,0" } };
    assert.equal(buildModel(view).cells[0].format, undefined);
});

test("all measure roles preserve their own cell format overrides and source identities", () => {
    const view = matrixFixture(1, 2);
    const values = view.matrix!.rows.root.children![0].values!;
    values[0].objects = { general: { formatString: "$0.00" } };
    values[1].objects = { general: { formatString: "0.000" } };
    values[2].objects = { general: { formatString: "0.0%" } };
    values[4].objects = { general: { formatString: "" } };
    values[5].objects = { general: { formatString: 123 } };
    const model = buildModel(view);
    assert.equal(model.cells[0].format, "$0.00");
    assert.equal(model.cells[0].denominatorFormat, "0.000");
    assert.equal(model.cells[0].tooltips[0].format, "0.0%");
    assert.equal(model.cells[1].format, undefined);
    assert.equal(model.cells[1].denominatorFormat, "");
    assert.equal(model.cells[1].tooltips[0].format, undefined);
    assert.equal(model.cells[0].tooltips[0].source, view.matrix!.valueSources[2]);
    assert.equal(model.denominatorSource, view.matrix!.valueSources[1]);
});

test("up to three tooltip measures retain their individual source and primitive values", () => {
    const view = matrixFixture(1, 1);
    const matrix = view.matrix!;
    const second = { ...matrix.valueSources[2], queryName: "Second", displayName: "Second" };
    const third = { ...matrix.valueSources[2], queryName: "Third", displayName: "Third" };
    matrix.valueSources.push(second, third);
    matrix.columns.levels[1].sources = matrix.valueSources;
    matrix.columns.root.children![0].children!.push({ level: 1, levelSourceIndex: 3 }, { level: 1, levelSourceIndex: 4 });
    matrix.rows.root.children![0].values![3] = { value: blank, valueSourceIndex: 3 };
    matrix.rows.root.children![0].values![4] = { value: 0, valueSourceIndex: 4 };
    const tooltips = buildModel(view).cells[0].tooltips;
    assert.deepEqual(tooltips.map(tooltip => tooltip.value), [10, null, 0]);
    assert.equal(tooltips[1].source, second);
    assert.equal(tooltips[2].source, third);
});

test("actual nested or composite grouping is rejected, not flattened or aggregated", () => {
    const rowHierarchy = matrixFixture(1, 1);
    rowHierarchy.matrix!.rows.root.children![0].children = [{ level: 1, value: "Extra" }];
    const columnHierarchy = matrixFixture(1, 1);
    columnHierarchy.matrix!.columns.levels[1] = { sources: [{ displayName: "Extra", roles: { column: true } }] };
    const composite = matrixFixture(1, 1);
    composite.matrix!.rows.root.children![0].levelValues!.push({ levelSourceIndex: 1, value: "Extra" });
    for (const view of [rowHierarchy, columnHierarchy, composite]) {
        assert.match(buildModel(view).error!, /hierarchy|exactly one/);
        assert.equal(buildModel(view).cells.length, 0);
    }
});

test("text tooltip measures are retained without being coerced into numeric values", () => {
    const view = matrixFixture(1, 1);
    view.matrix!.valueSources[2].type = { text: true };
    view.matrix!.rows.root.children![0].values![2].value = "Reviewed";
    const model = buildModel(view);
    assert.equal(model.error, undefined);
    assert.equal(model.cells[0].tooltips[0].value, "Reviewed");
});

test("extra value fields, nonnumeric fields and invalid measure indexes fail closed", () => {
    const duplicate = matrixFixture(1, 1);
    duplicate.matrix!.valueSources.push({ displayName: "Second value", roles: { value: true }, type: { numeric: true } });
    const nonnumeric = matrixFixture(1, 1);
    nonnumeric.matrix!.valueSources[0].type = { text: true };
    const badIndex = matrixFixture(1, 1);
    badIndex.matrix!.rows.root.children![0].values![0].valueSourceIndex = 99;
    for (const view of [duplicate, nonnumeric, badIndex]) {
        assert.ok(buildModel(view).error);
        assert.equal(buildModel(view).cells.length, 0);
    }
});

test("segment and reduction metadata are exposed even for invalid or empty data", () => {
    const model = buildModel({ metadata: { columns: [], segment: {}, dataReduction: { categorical: {} } } });
    assert.equal(model.segment, true);
    assert.equal(model.limited, true);
    assert.equal(model.partial, true);
    assert.ok(model.error);
});

test("host reduction makes missing intersections unloaded without requiring a segment", () => {
    const view = singleMeasure();
    view.metadata.dataReduction = { categorical: { values: {} } };
    delete view.matrix!.rows.root.children![0].values![1];
    const model = buildModel(view);
    assert.equal(model.partial, true);
    assert.equal(model.limited, true);
    assert.equal(model.segment, false);
    assert.equal(model.cells[1].raw.state, "unloaded");
});

test("malformed host arrays and nodes fail with model errors instead of throwing", () => {
    const malformed = [
        { ...matrixFixture(), matrix: { ...matrixFixture().matrix, valueSources: [null] } },
        { ...matrixFixture(), matrix: { ...matrixFixture().matrix, rows: { root: {}, levels: [null] } } },
        { ...matrixFixture(), matrix: { ...matrixFixture().matrix, columns: { root: { children: [null] }, levels: [] } } }
    ];
    for (const view of malformed) assert.ok(buildModel(view as unknown as powerbi.DataView).error);
});

test("malformed measure wrappers fail closed rather than attributing a bad slot to another measure", () => {
    for (const malformed of [null, 42, "bad", [], true]) {
        const view = matrixFixture(1, 1);
        view.matrix!.columns.root.children![0].children!.unshift({ level: 1, isSubtotal: true });
        view.matrix!.rows.root.children![0].values = {
            0: { value: 999 },
            1: { value: 10 },
            2: malformed as unknown as powerbi.DataViewMatrixNodeValue,
            3: { value: 30, valueSourceIndex: 2 }
        };
        const model = buildModel(view);
        assert.match(model.error!, /invalid matrix structure/);
        assert.deepEqual(model.cells, []);
    }
});

test("duplicate measure indexes cannot select the last raw, denominator, tooltip or highlight value", () => {
    for (const index of [0, 1, 2]) {
        const view = matrixFixture(1, 1);
        view.matrix!.rows.root.children![0].values = {
            0: { value: 1, valueSourceIndex: index, highlight: 1 },
            1: { value: 999, valueSourceIndex: index, highlight: 999 }
        };
        const model = buildModel(view);
        assert.match(model.error!, /invalid matrix measure index/);
        assert.deepEqual(model.cells, []);
        assert.equal(model.hasHighlights, false);
    }
});

test("replacement views recompute completeness and source states rather than retaining a prior segment", () => {
    const view = singleMeasure();
    delete view.matrix!.rows.root.children![0].values![1];
    view.metadata.segment = {};
    const first = buildModel(view);
    assert.equal(first.cells[1].raw.state, "unloaded");
    delete view.metadata.segment;
    const replacement = buildModel(view);
    assert.equal(replacement.segment, false);
    assert.equal(replacement.partial, false);
    assert.equal(replacement.limited, false);
    assert.equal(replacement.cells[1].raw.state, "absent");
    assert.deepEqual(replacement.notices, []);
    assert.equal(first.partial, true);
    assert.equal(first.cells[1].raw.state, "unloaded");
});

test("invalid metadata cardinalities are rejected before walking arbitrarily long arrays", () => {
    const measures = matrixFixture(1, 1);
    measures.matrix!.valueSources.length = MAX_CELLS;
    Object.defineProperty(measures.matrix!.valueSources, 5, {
        get: () => { throw new Error("Unbounded measure metadata access"); }
    });
    const hierarchy = matrixFixture(1, 1);
    hierarchy.matrix!.rows.levels.length = MAX_CELLS;
    Object.defineProperty(hierarchy.matrix!.rows.levels, 1, {
        get: () => { throw new Error("Unbounded hierarchy metadata access"); }
    });
    for (const view of [measures, hierarchy]) assert.ok(buildModel(view).error);
});

test("exactly 100 returned columns is conservatively partial, while 99 is complete", () => {
    const complete = buildModel(singleMeasure(1, 99));
    assert.equal(complete.partial, false);
    const partial = buildModel(singleMeasure(1, MAX_COLUMNS));
    assert.equal(partial.segment, false);
    assert.equal(partial.limited, true);
    assert.equal(partial.partial, true);
    assert.ok(partial.notices.some(notice => notice.includes("100-column")));
});

test("cell retention is bounded by all three limits, preserving the leading host order", () => {
    const matrix = buildModel(singleMeasure(MAX_ROWS + 1, MAX_COLUMNS + 1));
    assert.equal(matrix.columns.length, MAX_COLUMNS);
    assert.equal(matrix.rows.length, MAX_CELLS / MAX_COLUMNS);
    assert.equal(matrix.cells.length, MAX_CELLS);
    assert.equal(matrix.partial, true);
    assert.equal(matrix.cells.at(-1)?.raw.value, 199 * 10 + 99);
    const narrow = buildModel(singleMeasure(MAX_ROWS + 1, 1));
    assert.equal(narrow.rows.length, MAX_ROWS);
    assert.equal(narrow.cells.length, MAX_ROWS);
    assert.equal(narrow.partial, true);
});

test("categories beyond the retained row and column bounds are not traversed", () => {
    const view = singleMeasure(MAX_ROWS + 2, MAX_COLUMNS + 1);
    const columns = view.matrix!.columns.root.children!;
    Object.defineProperty(columns, MAX_COLUMNS, { get: () => { throw new Error("Unbounded column access"); } });
    const rows = view.matrix!.rows.root.children!;
    Object.defineProperty(rows, MAX_CELLS / MAX_COLUMNS + 1, { get: () => { throw new Error("Unbounded row access"); } });
    const model = buildModel(view);
    assert.equal(model.cells.length, MAX_CELLS);
    assert.equal(model.partial, true);
});

test("long subtotal runs have bounded processing and leave remaining intersections unloaded", () => {
    const view = singleMeasure();
    const first = view.matrix!.columns.root.children![0];
    const total: powerbi.DataViewMatrixNode = { isSubtotal: true };
    const columns = [first, ...Array<powerbi.DataViewMatrixNode>(MAX_CELLS).fill(total)];
    Object.defineProperty(columns, MAX_CELLS, { get: () => { throw new Error("Unbounded subtotal access"); } });
    view.matrix!.columns.root.children = columns;
    const model = buildModel(view);
    assert.equal(model.error, undefined);
    assert.equal(model.columns.length, 1);
    assert.equal(model.partial, true);
    assert.ok(model.notices.some(notice => notice.includes("safe processing limit")));
});
