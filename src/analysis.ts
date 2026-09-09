import type { Cell, Model, Scalar } from "./data";

export type Normalization = "raw" | "row" | "column" | "all" | "denominator";
export type ScaleScope = "global" | "row" | "column";
export type Palette = "sequential" | "diverging";
export interface AnalysisOptions {
    normalization: Normalization;
    additive: boolean;
    scope: ScaleScope;
    palette: Palette;
}
export interface Domain { min: number; max: number; }
export interface AnalyzedCell { cell: Cell; displayed: Scalar; domain?: Domain; }
export interface Analysis { cells: AnalyzedCell[]; domains: (Domain | undefined)[]; error?: string; notices: string[]; }

const unavailable = (): Scalar => ({ state: "unavailable" });
const groupIndex = (cell: Cell, scope: ScaleScope | Normalization): number =>
    scope === "row" ? cell.row : scope === "column" ? cell.column : 0;

interface Sum { value: number; correction: number; }
function add(sum: Sum, value: number): void {
    if (!Number.isFinite(sum.value)) return;
    const next = sum.value + value;
    if (Number.isFinite(next)) {
        sum.correction += sum.value >= value ? (sum.value - next) + value : (value - next) + sum.value;
    } else sum.correction = 0;
    sum.value = next;
}

export function analyze(model: Model, options: AnalysisOptions): Analysis {
    const result: Analysis = {
        cells: model.cells.map(cell => ({ cell, displayed: cell.raw })),
        domains: [], notices: []
    };
    const block = (message: string): Analysis => {
        result.error = message;
        for (const cell of result.cells) cell.displayed = cell.cell.raw.state === "value" ? unavailable() : cell.cell.raw;
        return result;
    };
    if (model.error) return block(model.error);
    if (options.normalization !== "raw" && options.normalization !== "denominator" && model.partial) {
        return block("Computed shares require complete data. Load all data or use raw values.");
    }
    if (options.normalization === "denominator") {
        if (!model.denominatorSource) return block("Bind a numeric Denominator measure to calculate ratios.");
        let rejected = false;
        for (const item of result.cells) {
            const numerator = item.cell.raw;
            const denominator = item.cell.denominator;
            if (numerator.state !== "value") {
                item.displayed = numerator;
            } else if (denominator.state !== "value" || denominator.value === undefined
                || !Number.isFinite(denominator.value) || denominator.value <= 0) {
                item.displayed = unavailable();
                rejected = true;
            } else if (numerator.state === "value") {
                const ratio = (numerator.value ?? NaN) / denominator.value;
                item.displayed = Number.isFinite(ratio) ? { state: "value", value: ratio } : unavailable();
                rejected ||= !Number.isFinite(ratio);
            }
        }
        if (rejected) result.notices.push("Ratios require a finite positive denominator and a finite result; unavailable ratios are not shown as zero.");
    } else if (options.normalization !== "raw") {
        if (!options.additive) return block("Share normalization requires explicit confirmation that Value is additive. Rates and ratios must not be summed.");
        result.notices.push("Share normalization supports only nonnegative additive values. BLANK and absent intersections are excluded, not treated as zero.");
        const groups = new Map<number, { max: number; sum: Sum; scaledSum: Sum; invalid: boolean }>();
        for (const item of result.cells) {
            const key = groupIndex(item.cell, options.normalization);
            let group = groups.get(key);
            if (!group) {
                group = { max: 0, sum: { value: 0, correction: 0 }, scaledSum: { value: 0, correction: 0 }, invalid: false };
                groups.set(key, group);
            }
            const value = item.cell.raw;
            if (value.state === "value") {
                if (value.value === undefined || !Number.isFinite(value.value) || value.value < 0) group.invalid = true;
                else group.max = Math.max(group.max, value.value);
            } else if (value.state !== "blank" && value.state !== "absent") group.invalid = true;
        }
        // Compensate small contributions; keep a scaled fallback for overflowing totals.
        for (const item of result.cells) {
            const group = groups.get(groupIndex(item.cell, options.normalization))!;
            if (!group.invalid && group.max > 0 && item.cell.raw.state === "value") {
                add(group.sum, item.cell.raw.value!);
                add(group.scaledSum, item.cell.raw.value! / group.max);
            }
        }
        let blockedGroup = false;
        let zeroGroup = false;
        for (const item of result.cells) {
            const group = groups.get(groupIndex(item.cell, options.normalization))!;
            if (group.invalid) {
                item.displayed = item.cell.raw.state === "value" ? unavailable() : item.cell.raw;
                blockedGroup = true;
            } else if (item.cell.raw.state === "value") {
                const scaledTotal = group.scaledSum.value + group.scaledSum.correction;
                const total = group.sum.value + group.sum.correction;
                if (group.max === 0 || scaledTotal === 0 || !Number.isFinite(scaledTotal)) {
                    item.displayed = unavailable();
                    zeroGroup = true;
                } else {
                    // One division avoids double-rounding representable subnormal shares to zero.
                    item.displayed = { state: "value", value: Number.isFinite(total)
                        ? item.cell.raw.value! / total : (item.cell.raw.value! / group.max) / scaledTotal };
                }
            }
        }
        if (blockedGroup) result.error = "Share normalization is unavailable for groups containing negative, invalid, or unloaded values.";
        if (zeroGroup) result.notices.push("Shares are unavailable for zero-total groups; a zero total is not a percentage denominator.");
    }
    const count = options.scope === "row" ? model.rows.length : options.scope === "column" ? model.columns.length : 1;
    result.domains = Array.from({ length: count }, () => undefined);
    for (const item of result.cells) {
        if (item.displayed.state !== "value" || item.displayed.value === undefined || !Number.isFinite(item.displayed.value)) continue;
        const index = groupIndex(item.cell, options.scope);
        const value = item.displayed.value;
        const domain = result.domains[index];
        if (domain) {
            domain.min = Math.min(domain.min, value);
            domain.max = Math.max(domain.max, value);
        } else result.domains[index] = { min: value, max: value };
    }
    if (options.palette === "diverging") {
        for (const domain of result.domains) {
            if (!domain) continue;
            const extent = Math.max(Math.abs(domain.min), Math.abs(domain.max));
            domain.min = extent === 0 ? 0 : -extent;
            domain.max = extent;
        }
    }
    for (const item of result.cells) item.domain = result.domains[groupIndex(item.cell, options.scope)];
    return result;
}

function mix(start: readonly number[], end: readonly number[], fraction: number): string {
    return `#${start.map((value, index) =>
        Math.round(value + (end[index] - value) * fraction).toString(16).padStart(2, "0")).join("")}`;
}

export function colorFor(value: number, domain: Domain, palette: Palette): string {
    const light = [239, 246, 255];
    const blue = [8, 81, 156];
    const neutral = [247, 247, 247];
    const orange = [179, 88, 6];
    if (!Number.isFinite(value) || !Number.isFinite(domain.min) || !Number.isFinite(domain.max) || domain.min > domain.max) {
        return "#f7f7f7";
    }
    if (palette === "diverging") {
        const extent = Math.max(Math.abs(domain.min), Math.abs(domain.max));
        const distance = extent === 0 ? 0 : Math.min(1, Math.abs(value) / extent);
        return value < 0 ? mix(neutral, blue, distance) : mix(neutral, orange, distance);
    }
    let fraction = 0.5;
    if (domain.min !== domain.max) {
        if (value <= domain.min) fraction = 0;
        else if (value >= domain.max) fraction = 1;
        else {
            const range = domain.max - domain.min;
            // Subtract before scaling to preserve close endpoints; halve only an overflowing range.
            fraction = Number.isFinite(range) ? (value - domain.min) / range
                : (value / 2 - domain.min / 2) / (domain.max / 2 - domain.min / 2);
        }
    }
    return mix(light, blue, fraction);
}

export function textColor(backgroundHex: string): string {
    const hex = backgroundHex.startsWith("#") ? backgroundHex.slice(1) : backgroundHex;
    const expanded = hex.length === 3 ? [...hex].map(character => character + character).join("") : hex;
    if (!/^[0-9a-f]{6}$/i.test(expanded)) return "#000000";
    const channels = [0, 2, 4].map(offset => {
        const value = parseInt(expanded.slice(offset, offset + 2), 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return 1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.05 ? "#ffffff" : "#000000";
}
