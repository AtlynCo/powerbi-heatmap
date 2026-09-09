import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// These controlled sample CSVs intentionally contain no quoted fields or commas in labels.
function csv(path: URL): Record<string, string>[] {
    const [header, ...rows] = readFileSync(path, "utf8").trim().split(/\r?\n/).map(line => line.split(","));
    return rows.map(row => {
        assert.equal(row.length, header.length);
        return Object.fromEntries(header.map((name, i) => [name, row[i]]));
    });
}

test("product-region recipe arithmetic, zero, blank and absent example are accurate", () => {
    const rows = csv(new URL("../samples/product-region.csv", import.meta.url));
    const cell = (product: string, region: string) => rows.find(row => row.Product === product && row.Region === region);
    assert.equal(cell("Pumps", "North")?.Revenue, "0");
    assert.equal(cell("Pumps", "West")?.Revenue, "");
    assert.equal(cell("Filters", "East"), undefined);
    const observed = rows.filter(row => row.Revenue !== "");
    assert.equal(observed.reduce((sum, row) => sum + Number(row.Revenue), 0), 18000);
    const pumps = observed.filter(row => row.Product === "Pumps").reduce((sum, row) => sum + Number(row.Revenue), 0);
    assert.equal(Number(cell("Pumps", "Central")!.Revenue) / pumps, 0.4);
    assert.equal(new Set(rows.map(row => `${row.Product}|${row.Region}`)).size, rows.length);
});

test("defect-line recipe has consistent repeated exposure, without counting it per defect", () => {
    const rows = csv(new URL("../samples/defect-line.csv", import.meta.url));
    for (const line of new Set(rows.map(row => row.Line))) {
        assert.equal(new Set(rows.filter(row => row.Line === line).map(row => row.Opportunities)).size, 1);
    }
    const seal = rows.find(row => row.Defect === "Seal" && row.Line === "Line B")!;
    assert.equal(Number(seal.Defects) / Number(seal.Opportunities), 0.02);
    assert.equal(rows.find(row => row.Defect === "Dent" && row.Line === "Line A")?.Defects, "");
    assert.equal(rows.find(row => row.Defect === "Label" && row.Line === "Line C"), undefined);
});
