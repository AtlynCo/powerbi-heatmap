import assert from "node:assert/strict";
import test from "node:test";
import type powerbi from "powerbi-visuals-api";
import { analyze, AnalysisOptions, colorFor, Domain, textColor } from "../src/analysis";
import { buildModel, Model } from "../src/data";
import { matrixFixture } from "./fixtures";

const defaults: AnalysisOptions = { normalization: "raw", additive: false, scope: "global", palette: "sequential" };

function values(input: (number | null | undefined | string)[][]): Model {
    const view = matrixFixture(input.length, input[0].length);
    for (let row = 0; row < input.length; row++) {
        const node = view.matrix!.rows.root.children![row];
        node.values = {};
        input[row].forEach((value, column) => {
            if (value !== undefined) node.values![column * 3] = { value: value as powerbi.PrimitiveValue };
            node.values![column * 3 + 1] = { value: 10, valueSourceIndex: 1 };
        });
    }
    return buildModel(view);
}

test("raw mode preserves states and never implicitly sums rates or ratios", () => {
    const model = values([[0.25, null, undefined, "2", 0.5]]);
    const result = analyze(model, defaults);
    assert.equal(result.error, undefined);
    result.cells.forEach((cell, index) => {
        assert.equal(cell.cell, model.cells[index]);
        assert.equal(cell.displayed, model.cells[index].raw);
    });
    assert.deepEqual(result.domains, [{ min: 0.25, max: 0.5 }]);
    assert.deepEqual(result.cells.map(cell => cell.displayed.state), ["value", "blank", "absent", "invalid", "value"]);
});

test("additive consent is required for row, column and all shares", () => {
    const model = values([[0.2, 0.4]]);
    for (const normalization of ["row", "column", "all"] as const) {
        const result = analyze(model, { ...defaults, normalization });
        assert.match(result.error!, /additive/);
        assert.ok(result.cells.every(cell => cell.displayed.state === "unavailable"));
        assert.deepEqual(result.domains, []);
        assert.equal(result.cells[0].cell.raw.value, 0.2);
    }
});

test("computed shares are blocked on incomplete data but model denominators remain usable", () => {
    const model = values([[1, 2]]);
    model.partial = true;
    for (const normalization of ["row", "column", "all"] as const) {
        const result = analyze(model, { ...defaults, normalization, additive: true });
        assert.match(result.error!, /complete data/);
        assert.ok(result.cells.every(cell => cell.displayed.state === "unavailable"));
    }
    assert.equal(analyze(model, defaults).cells[0].displayed.value, 1);
    model.denominatorSource = { displayName: "Model denominator", roles: { denominator: true } };
    for (const cell of model.cells) cell.denominator = { state: "value", value: 10 };
    const ratio = analyze(model, { ...defaults, normalization: "denominator" });
    assert.equal(ratio.error, undefined);
    assert.deepEqual(ratio.cells.map(cell => cell.displayed.value), [0.1, 0.2]);
});

test("row, column and all shares use the requested denominator and preserve empty states", () => {
    const model = values([[1, 3, null], [2, 2, undefined]]);
    const expected = {
        row: [0.25, 0.75, undefined, 0.5, 0.5, undefined],
        column: [1 / 3, 3 / 5, undefined, 2 / 3, 2 / 5, undefined],
        all: [1 / 8, 3 / 8, undefined, 2 / 8, 2 / 8, undefined]
    };
    for (const normalization of ["row", "column", "all"] as const) {
        const result = analyze(model, { ...defaults, normalization, additive: true });
        assert.equal(result.error, undefined);
        result.cells.forEach((cell, index) => {
            if (expected[normalization][index] === undefined) assert.equal(cell.displayed.value, undefined);
            else assert.ok(Math.abs(cell.displayed.value! - expected[normalization][index]!) < 1e-15);
        });
        assert.equal(result.cells[2].displayed.state, "blank");
        assert.equal(result.cells[5].displayed.state, "absent");
        assert.ok(result.notices.some(notice => notice.includes("nonnegative")));
    }
});

test("invalid and negative values block their entire share group, never just drop bad members", () => {
    for (const bad of [-1, "2", NaN, Infinity]) {
        const model = values([[1, bad], [2, 2]]);
        const result = analyze(model, { ...defaults, normalization: "row", additive: true });
        assert.match(result.error!, /negative, invalid/);
        const badState = bad === -1 ? "unavailable" : "invalid";
        assert.deepEqual(result.cells.map(cell => cell.displayed.state), ["unavailable", badState, "value", "value"]);
        assert.equal(result.cells[2].displayed.value, 0.5);
        const global = analyze(model, { ...defaults, normalization: "all", additive: true });
        assert.deepEqual(global.cells.map(cell => cell.displayed.state), ["unavailable", badState, "unavailable", "unavailable"]);
    }
});

test("zero-total shares are unavailable while BLANK and absent stay distinct", () => {
    const result = analyze(values([[0, 0, null, undefined]]), { ...defaults, normalization: "row", additive: true });
    assert.deepEqual(result.cells.map(cell => cell.displayed.state), ["unavailable", "unavailable", "blank", "absent"]);
    assert.ok(result.notices.some(notice => notice.includes("zero-total")));
    assert.deepEqual(result.domains, [undefined]);
});

test("blocked calculations preserve nonnumeric source states, including when denominators are unusable", () => {
    const model = values([[0, null, undefined, "bad"]]);
    for (const normalization of ["row", "denominator"] as const) {
        for (const cell of model.cells) cell.denominator = { state: "blank" };
        const result = analyze(model, { ...defaults, normalization });
        assert.deepEqual(result.cells.map(cell => cell.displayed.state), ["unavailable", "blank", "absent", "invalid"]);
    }
    model.partial = true;
    model.cells[2].raw = { state: "unloaded" };
    const partial = analyze(model, { ...defaults, normalization: "all", additive: true });
    assert.deepEqual(partial.cells.map(cell => cell.displayed.state), ["unavailable", "blank", "unloaded", "invalid"]);
});

test("overflow-sized and subnormal values normalize using scaled finite sums", () => {
    const huge = analyze(values([[Number.MAX_VALUE, Number.MAX_VALUE]]), { ...defaults, normalization: "all", additive: true });
    assert.deepEqual(huge.cells.map(cell => cell.displayed.value), [0.5, 0.5]);
    const tiny = analyze(values([[Number.MIN_VALUE, Number.MIN_VALUE]]), { ...defaults, normalization: "all", additive: true });
    assert.deepEqual(tiny.cells.map(cell => cell.displayed.value), [0.5, 0.5]);
});

test("explicit denominators need no additive consent, allow negative numerator and retain raw values", () => {
    const model = values([[-5, 0, 20, null, undefined, "invalid"]]);
    const result = analyze(model, { ...defaults, normalization: "denominator" });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.cells.map(cell => cell.displayed.value), [-0.5, 0, 2, undefined, undefined, undefined]);
    assert.deepEqual(result.cells.map(cell => cell.displayed.state), ["value", "value", "value", "blank", "absent", "invalid"]);
    assert.equal(model.cells[0].raw.value, -5);
});

test("missing denominator binding is an actionable error", () => {
    const model = values([[1]]);
    model.denominatorSource = undefined;
    const result = analyze(model, { ...defaults, normalization: "denominator" });
    assert.match(result.error!, /Bind.*Denominator/);
    assert.equal(result.cells[0].displayed.state, "unavailable");
});

test("invalid, nonpositive, missing denominators and overflowing ratios are unavailable", () => {
    const model = values([[1, 1, 1, 1, 1, 1, Number.MAX_VALUE]]);
    const denominators = [
        { state: "value", value: 0 }, { state: "value", value: -1 }, { state: "blank" },
        { state: "absent" }, { state: "invalid" }, { state: "value", value: Infinity },
        { state: "value", value: Number.MIN_VALUE }
    ] as const;
    model.cells.forEach((cell, index) => cell.denominator = denominators[index]);
    const result = analyze(model, { ...defaults, normalization: "denominator" });
    assert.ok(result.cells.every(cell => cell.displayed.state === "unavailable"));
    assert.ok(result.notices.some(notice => notice.includes("positive denominator")));
});

test("global, row and column domains include all bounded base data, never highlights", () => {
    const model = values([[1, 2], [10, 20]]);
    model.cells[0].hasHighlight = true;
    model.cells[0].highlight = { state: "value", value: 10000 };
    model.hasHighlights = true;
    assert.deepEqual(analyze(model, defaults).domains, [{ min: 1, max: 20 }]);
    const rows = analyze(model, { ...defaults, scope: "row" });
    assert.deepEqual(rows.domains, [{ min: 1, max: 2 }, { min: 10, max: 20 }]);
    assert.equal(rows.cells[0].domain, rows.domains[0]);
    assert.equal(rows.cells[3].domain, rows.domains[1]);
    assert.deepEqual(analyze(model, { ...defaults, scope: "column" }).domains, [{ min: 1, max: 10 }, { min: 2, max: 20 }]);
    model.cells[0].highlight = { state: "value", value: -10000 };
    assert.deepEqual(analyze(model, defaults).domains, [{ min: 1, max: 20 }]);
});

test("empty local groups retain their domain array index without fabricated ranges", () => {
    const rows = analyze(values([[null, undefined], [4, 4]]), { ...defaults, scope: "row" });
    assert.deepEqual(rows.domains, [undefined, { min: 4, max: 4 }]);
    assert.equal(rows.cells[0].domain, undefined);
    const columns = analyze(values([[null, 1], [undefined, 2]]), { ...defaults, scope: "column" });
    assert.deepEqual(columns.domains, [undefined, { min: 1, max: 2 }]);
});

test("diverging domains are symmetric about exactly zero for all scale scopes", () => {
    const model = values([[-2, 4], [10, 20]]);
    assert.deepEqual(analyze(model, { ...defaults, palette: "diverging" }).domains, [{ min: -20, max: 20 }]);
    assert.deepEqual(analyze(model, { ...defaults, palette: "diverging", scope: "row" }).domains,
        [{ min: -4, max: 4 }, { min: -20, max: 20 }]);
    assert.deepEqual(analyze(model, { ...defaults, palette: "diverging", scope: "column" }).domains,
        [{ min: -10, max: 10 }, { min: -20, max: 20 }]);
    assert.deepEqual(analyze(values([[0]]), { ...defaults, palette: "diverging" }).domains, [{ min: 0, max: 0 }]);
});

test("sequential equal-value domains stay equal with a deterministic middle hue", () => {
    const result = analyze(values([[7, 7]]), defaults);
    assert.deepEqual(result.domains, [{ min: 7, max: 7 }]);
    assert.equal(colorFor(7, result.domains[0]!, "sequential"), "#7ca4ce");
    assert.equal(colorFor(Number.MAX_VALUE, { min: Number.MAX_VALUE, max: Number.MAX_VALUE }, "sequential"), "#7ca4ce");
});

test("fixed palettes have stable endpoints, centered neutral and clamp out-of-range values", () => {
    assert.equal(colorFor(0, { min: 0, max: 1 }, "sequential"), "#eff6ff");
    assert.equal(colorFor(1, { min: 0, max: 1 }, "sequential"), "#08519c");
    assert.equal(colorFor(-100, { min: 0, max: 1 }, "sequential"), "#eff6ff");
    assert.equal(colorFor(100, { min: 0, max: 1 }, "sequential"), "#08519c");
    assert.equal(colorFor(-1, { min: -1, max: 1 }, "diverging"), "#08519c");
    assert.equal(colorFor(0, { min: -1, max: 1 }, "diverging"), "#f7f7f7");
    assert.equal(colorFor(1, { min: -1, max: 1 }, "diverging"), "#b35806");
    assert.equal(colorFor(0, { min: 0, max: 0 }, "diverging"), "#f7f7f7");
});

test("extreme signed, subnormal and adjacent finite domains never overflow palette math", () => {
    const domains: Domain[] = [
        { min: -Number.MAX_VALUE, max: Number.MAX_VALUE },
        { min: Number.MIN_VALUE, max: Number.MIN_VALUE * 2 },
        { min: Number.MAX_VALUE / 2, max: Number.MAX_VALUE },
        { min: 1, max: 1 + Number.EPSILON }
    ];
    for (const domain of domains) {
        for (const palette of ["sequential", "diverging"] as const) {
            for (const value of [domain.min, domain.max, 0]) {
                assert.match(colorFor(value, domain, palette), /^#[0-9a-f]{6}$/);
            }
        }
        assert.equal(colorFor(domain.min, domain, "sequential"), "#eff6ff");
        assert.equal(colorFor(domain.max, domain, "sequential"), "#08519c");
    }
    assert.equal(colorFor(0, domains[0], "sequential"), "#7ca4ce");
});

function contrast(background: string, foreground: string): number {
    const luminance = (color: string): number => {
        const channels = [1, 3, 5].map(offset => {
            const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const a = luminance(background);
    const b = luminance(foreground);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("text color chooses black or white with WCAG AA contrast throughout both palettes", () => {
    for (const palette of ["sequential", "diverging"] as const) {
        for (let step = 0; step <= 100; step++) {
            const color = colorFor(step / 50 - 1, { min: -1, max: 1 }, palette);
            assert.ok(contrast(color, textColor(color)) >= 4.5, color);
        }
    }
    assert.equal(textColor("#fff"), "#000000");
    assert.equal(textColor("#000"), "#ffffff");
    assert.equal(textColor("invalid"), "#000000");
});

test("model errors block analysis without manufacturing domains or data", () => {
    const result = analyze(buildModel(undefined), defaults);
    assert.ok(result.error);
    assert.deepEqual(result.cells, []);
    assert.deepEqual(result.domains, []);
});
