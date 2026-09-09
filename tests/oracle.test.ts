import assert from "node:assert/strict";
import test from "node:test";
import type powerbi from "powerbi-visuals-api";
import { analyze, type Domain, type Normalization, type ScaleScope } from "../src/analysis";
import { buildModel, type Scalar } from "../src/data";

type Input = number | string | null | undefined;
const scopes: ScaleScope[] = ["global", "row", "column"];

function generator(seed: number): (limit: number) => number {
    let state = seed >>> 0;
    return limit => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % limit;
    };
}

function shuffled<T>(input: readonly T[], next: (limit: number) => number): T[] {
    const result = [...input];
    for (let index = result.length - 1; index > 0; index--) {
        const target = next(index + 1);
        [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
}

// Deliberately independent of fixtures.ts: source order, measure-leaf order, displayed
// category order and physical subtotal slots are each varied separately.
function delivered(raw: Input[][], denominators: Input[][], seed: number, partial = false) {
    const next = generator(seed);
    const rowSource: powerbi.DataViewMetadataColumn = { displayName: "Row", roles: { row: true } };
    const columnSource: powerbi.DataViewMetadataColumn = { displayName: "Column", roles: { column: true } };
    const sources = shuffled(["value", "denominator", "numericTip", "textTip", "blankTip"], next).map(name => ({
        displayName: name,
        queryName: name,
        roles: { [name === "value" || name === "denominator" ? name : "tooltips"]: true },
        type: name === "textTip" ? { text: true } : { numeric: true },
        isMeasure: true,
        discourageAggregationAcrossGroups: true,
        format: "0.00"
    }));
    const rowOrder = shuffled(raw.map((_, index) => index), next);
    const columnOrder = shuffled(raw[0].map((_, index) => index), next);
    const slots: { column?: number; source: number; subtotal: boolean }[] = [];
    const columnNodes: powerbi.DataViewMatrixNode[] = [];
    const expectedColumns: powerbi.DataViewMatrixNode[] = [];
    for (const column of [undefined, ...columnOrder, undefined]) {
        const leafOrder = shuffled(sources.map((_, index) => index), next);
        const node: powerbi.DataViewMatrixNode = {
            level: 0, isSubtotal: column === undefined,
            levelValues: [{ levelSourceIndex: 0, value: "Same caption" }],
            identity: { key: `column-${column}` }, children: []
        };
        const subtotalPosition = next(sources.length + 1);
        for (let index = 0; index <= leafOrder.length; index++) {
            if (index === subtotalPosition) {
                node.children!.push({ level: 1, isSubtotal: true });
                slots.push({ column, source: 0, subtotal: true });
            }
            if (index < leafOrder.length) {
                const source = leafOrder[index];
                node.children!.push({ level: 1, levelSourceIndex: source });
                slots.push({ column, source, subtotal: column === undefined });
            }
        }
        columnNodes.push(node);
        if (column !== undefined) expectedColumns.push(node);
    }
    const rowNodes = rowOrder.map(row => {
        const values: NonNullable<powerbi.DataViewMatrixNode["values"]> = {};
        slots.forEach((slot, key) => {
            if (slot.subtotal) {
                values[key] = { value: 999999, valueSourceIndex: 99 };
                return;
            }
            const column = slot.column!;
            const name = sources[slot.source].displayName;
            const value = name === "value" ? raw[row][column]
                : name === "denominator" ? denominators[row][column]
                    : name === "numericTip" ? row * 100 + column
                        : name === "textTip" ? `plain <text> ${row}:${column}` : null;
            if (value !== undefined) values[key] = {
                value: value as powerbi.PrimitiveValue,
                ...(slot.source === 0 ? {} : { valueSourceIndex: slot.source }),
                objects: { general: { formatString: `${name} ${row}:${column}` } }
            };
        });
        return {
            level: 0, levelValues: [{ levelSourceIndex: 0, value: "Same caption" }],
            identity: { key: `row-${row}` }, values
        } satisfies powerbi.DataViewMatrixNode;
    });
    const view: powerbi.DataView = {
        metadata: { columns: [rowSource, columnSource, ...sources], ...(partial ? { segment: {} } : {}) },
        matrix: {
            valueSources: sources,
            rows: {
                levels: [{ sources: [rowSource] }],
                root: { children: [{ isSubtotal: true }, ...rowNodes, { isSubtotal: true }] }
            },
            columns: {
                levels: [{ sources: [columnSource] }, { sources }],
                root: { children: columnNodes }
            }
        }
    };
    return { view, rowOrder, columnOrder, rowNodes, columnNodes: expectedColumns, sources };
}

function observed(input: Input, partial: boolean): Scalar {
    if (input === undefined) return { state: partial ? "unloaded" : "absent" };
    if (input === null) return { state: "blank" };
    if (typeof input !== "number" || !Number.isFinite(input)) return { state: "invalid" };
    return { state: "value", value: input };
}

test("seeded independent sparse matrices preserve physical slots, category identities and all measure formats", () => {
    const choices: Input[] = [undefined, null, "12", NaN, Infinity, -0, 0, -2.5, 0.125, 12345.75];
    for (let seed = 1; seed <= 40; seed++) {
        const next = generator(seed);
        const rows = 1 + next(6);
        const columns = 1 + next(6);
        const raw = Array.from({ length: rows }, () => Array.from({ length: columns }, () => choices[next(choices.length)]));
        const denominators = Array.from({ length: rows }, () => Array.from({ length: columns }, () => choices[next(choices.length)]));
        const partial = seed % 3 === 0;
        const fixture = delivered(raw, denominators, seed, partial);
        const model = buildModel(fixture.view);
        assert.equal(model.error, undefined, `seed ${seed}`);
        assert.equal(model.partial, partial);
        assert.equal(model.cells.length, rows * columns);
        model.rows.forEach((axis, index) => assert.equal(axis.node, fixture.rowNodes[index]));
        model.columns.forEach((axis, index) => assert.equal(axis.node, fixture.columnNodes[index]));
        for (const cell of model.cells) {
            const row = fixture.rowOrder[cell.row];
            const column = fixture.columnOrder[cell.column];
            assert.deepEqual(cell.raw, observed(raw[row][column], partial));
            assert.deepEqual(cell.denominator, observed(denominators[row][column], partial));
            assert.equal(cell.format, raw[row][column] === undefined ? undefined : `value ${row}:${column}`);
            assert.equal(cell.denominatorFormat, denominators[row][column] === undefined ? undefined : `denominator ${row}:${column}`);
            for (const tooltip of cell.tooltips) {
                const name = tooltip.source.displayName;
                assert.equal(tooltip.source, fixture.sources.find(source => source.displayName === name));
                assert.equal(tooltip.format, `${name} ${row}:${column}`);
                assert.equal(tooltip.value, name === "numericTip" ? row * 100 + column
                    : name === "textTip" ? `plain <text> ${row}:${column}` : null);
            }
        }
    }
});

function shareOracle(raw: Input[][], row: number, column: number, normalization: Normalization, partial: boolean): Scalar {
    const source = observed(raw[row][column], partial);
    if (source.state !== "value") return source;
    if (partial) return { state: "unavailable" };
    const members = normalization === "row" ? raw[row]
        : normalization === "column" ? raw.map(values => values[column]) : raw.flat();
    if (members.some(value => value !== null && value !== undefined
        && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) {
        return { state: "unavailable" };
    }
    // Exact integer arithmetic defines the rational denominator, independent of
    // implementation summation/scaling. These generated integers are all exactly representable.
    const denominator = members.reduce<bigint>((sum, value) =>
        typeof value === "number" ? sum + BigInt(value) : sum, 0n);
    if (denominator === 0n) return { state: "unavailable" };
    const numerator = BigInt(source.value!);
    return { state: "value", value: Number(numerator) / Number(denominator) };
}

test("exact rational share oracle independently checks group blocking and calculation/color-scope separation", () => {
    for (let seed = 1; seed <= 48; seed++) {
        const next = generator(seed * 7919);
        const rows = 1 + next(6);
        const columns = 1 + next(6);
        const choices: Input[] = seed % 4 === 0 ? [undefined, null, 0, "3", -1, 7, 19]
            : [undefined, null, 0, 0, 1, 7, 19, 1023];
        const raw = Array.from({ length: rows }, () => Array.from({ length: columns }, () => choices[next(choices.length)]));
        const partial = seed % 11 === 0;
        const fixture = delivered(raw, raw.map(row => row.map(() => 13)), seed, partial);
        const model = buildModel(fixture.view);
        assert.equal(model.error, undefined);
        const before = model.cells.map(cell => ({ ...cell.raw }));
        for (const normalization of ["row", "column", "all"] as const) {
            const expected = model.cells.map(cell => shareOracle(raw,
                fixture.rowOrder[cell.row], fixture.columnOrder[cell.column], normalization, partial));
            for (const scope of scopes) for (const palette of ["sequential", "diverging"] as const) {
                const result = analyze(model, { normalization, additive: true, scope, palette });
                assert.deepEqual(result.cells.map(cell => cell.displayed), expected,
                    `seed ${seed}, ${normalization}/${scope}/${palette}`);
                if (partial) {
                    assert.deepEqual(result.domains, []);
                    continue;
                }
                const count = scope === "row" ? rows : scope === "column" ? columns : 1;
                const domains: (Domain | undefined)[] = Array.from({ length: count }, (_, group) => {
                    const numbers = expected.flatMap((scalar, index) => {
                        const cell = model.cells[index];
                        const included = scope === "global" || (scope === "row" ? cell.row : cell.column) === group;
                        return included && scalar.state === "value" ? [scalar.value!] : [];
                    });
                    if (!numbers.length) return undefined;
                    const min = Math.min(...numbers);
                    const max = Math.max(...numbers);
                    const extent = Math.max(Math.abs(min), Math.abs(max));
                    return palette === "sequential" ? { min, max } : { min: extent === 0 ? 0 : -extent, max: extent };
                });
                assert.deepEqual(result.domains, domains);
            }
        }
        assert.deepEqual(model.cells.map(cell => cell.raw), before);
    }
});

test("supplied double-valued denominators remain cell-local across ordering, color and filter replacement", () => {
    const raw: Input[][] = [[-0.125, 0.75, 2.5, 0, Number.MIN_VALUE], [null, undefined, "2", Number.MAX_VALUE, 0.625]];
    const denominators: Input[][] = [[0.5, 0.25, 0.125, 0.75, 1.5], [1, 1, 1, Number.MIN_VALUE, undefined]];
    for (let seed = 1; seed <= 12; seed++) {
        const fixture = delivered(raw, denominators, seed, true);
        const model = buildModel(fixture.view);
        for (const scope of scopes) {
            const result = analyze(model, { normalization: "denominator", additive: false, scope, palette: "sequential" });
            assert.equal(result.error, undefined);
            for (const item of result.cells) {
                const row = fixture.rowOrder[item.cell.row];
                const column = fixture.columnOrder[item.cell.column];
                const numerator = raw[row][column];
                const denominator = denominators[row][column];
                const source = observed(numerator, true);
                const ratio = typeof numerator === "number" && typeof denominator === "number" && denominator > 0
                    ? numerator / denominator : NaN;
                assert.deepEqual(item.displayed, source.state !== "value" ? source
                    : Number.isFinite(ratio) ? { state: "value", value: ratio } : { state: "unavailable" });
            }
        }
    }
    const initial = delivered([[0.2, 0.8]], [[0.1, 0.4]], 7);
    const filtered = delivered([[0.2]], [[0.5]], 7);
    const options = { normalization: "denominator", additive: false, scope: "global", palette: "sequential" } as const;
    assert.deepEqual(analyze(buildModel(initial.view), options).cells.map(cell => cell.displayed.value), [2, 2]);
    assert.equal(analyze(buildModel(filtered.view), options).cells[0].displayed.value, 0.4);
    assert.equal(analyze(buildModel(filtered.view), { ...options, normalization: "raw" }).cells[0].displayed.value, 0.2);
    assert.match(analyze(buildModel(filtered.view), { ...options, normalization: "all" }).error!, /additive/);
});
