import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import type powerbi from "powerbi-visuals-api";
import { matrixFixture } from "../fixtures";
import { installHost, HarnessWindow } from "./host";

const guid = "atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37";
let js: string;
let css: string;

test.beforeAll(async () => {
    const version = JSON.parse(readFileSync("pbiviz.json", "utf8")).visual.version;
    const zip = await JSZip.loadAsync(readFileSync(join("dist", `${guid}.${version}.pbiviz`)));
    const file = Object.values(zip.files).find(entry => entry.name.startsWith("resources/") && entry.name.endsWith(".json"));
    if (!file) throw new Error("No packaged visual resource");
    const payload = JSON.parse(await file.async("string"));
    js = payload.content.js;
    css = payload.content.css;
});

async function load(page: Page, config: Partial<Parameters<typeof installHost>[0]> = {}): Promise<void> {
    await page.setContent('<!doctype html><html><head></head><body style="margin:0"><div id="visual"></div></body></html>');
    await page.evaluate(() => {
        (window as unknown as HarnessWindow).powerbi = { visuals: { plugins: {} } };
    });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: js });
    await page.evaluate(installHost, { guid, locale: "en-US", highContrast: false, interactions: true, ...config });
}

async function update(page: Page, data: powerbi.DataView | undefined, width = 720, height = 480, type = 2, operationKind = 0): Promise<void> {
    await page.evaluate(({ data, width, height, type, operationKind }) => {
        (window as unknown as HarnessWindow).heatmap.visual.update({
            dataViews: data ? [data] : [], viewport: { width, height }, type, operationKind
        });
    }, { data, width, height, type, operationKind });
}

async function state(page: Page) {
    return page.evaluate(() => (window as unknown as HarnessWindow).heatmap.state);
}

test("packaged matrix renders model formats, states, and literal user labels without network", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", request => requests.push(request.url()));
    await load(page);
    const data = matrixFixture();
    const rows = data.matrix!.rows.root.children!;
    rows[0].values![0] = { value: 0 };
    Object.assign(rows[0].values![3], { value: null });
    delete rows[0].values![6];
    rows[0].values![9] = { value: "123" };
    rows[1].levelValues![0].value = '<img src="invalid" onerror="alert(1)">';
    await update(page, data);
    await expect(page.locator("td")).toHaveCount(12);
    await expect(page.locator('td[data-state="value"]').first()).toHaveText("$0.00");
    await expect(page.locator('td[data-state="blank"]')).toHaveText("B");
    await expect(page.locator('td[data-state="absent"]')).toHaveText("-");
    await expect(page.locator('td[data-state="invalid"]')).toHaveText("!");
    await expect(page.locator("tbody th").nth(1)).toHaveText('<img src="invalid" onerror="alert(1)">');
    await expect(page.locator("#visual img")).toHaveCount(0);
    expect(requests).toEqual([]);
    expect((await state(page)).lifecycle).toEqual(["started", "finished"]);
    await expect(page.locator(".legal")).toHaveText(JSON.parse(readFileSync(join("src", "thirdParty.json"), "utf8")).text);
});

test("host row/column/cell selections, multiselect, native tooltip, context menu, incoming selection and clear", async ({ page }) => {
    await load(page);
    await update(page, matrixFixture());
    await page.locator("tbody th").first().click();
    expect((await state(page)).selections).toEqual(["r0"]);
    await expect(page.locator('tbody tr').first().locator('td[aria-selected="true"]')).toHaveCount(4);
    await page.locator("thead th").nth(2).click();
    expect((await state(page)).selections).toEqual(["c1"]);
    const first = page.locator("td").first();
    await first.click({ modifiers: ["Control"] });
    expect((await state(page)).selectionCalls.at(-1)).toEqual({ key: "r0|c0", multi: true });
    await first.hover();
    expect((await state(page)).tooltipCalls.at(-1)?.dataItems.some(item => item.displayName === "Units")).toBe(true);
    expect((await state(page)).tooltipCalls.at(-1)?.dataItems.some(item => item.value === "$100.50")).toBe(true);
    await first.click({ button: "right" });
    expect((await state(page)).contextCalls.at(-1)?.key).toBe("r0|c0");
    await page.evaluate(() => (window as unknown as HarnessWindow).heatmap.incoming(["r2"]));
    await expect(page.locator("tbody tr").nth(2).locator('td[aria-selected="true"]')).toHaveCount(4);
    await first.focus();
    await page.keyboard.press("Escape");
    expect((await state(page)).selections).toEqual([]);
});

test("model-backed per-cell formats survive raw rendering, accessibility and native tooltips", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    data.matrix!.rows.root.children![0].values![0] = {
        value: 0.25, objects: { general: { formatString: "0.0%" } }
    };
    await update(page, data);
    const first = page.locator("td").first();
    await expect(first).toHaveText("25.0%");
    await expect(first).toHaveAttribute("aria-label", /Raw model value: 25.0%/);
    await first.hover();
    expect((await state(page)).tooltipCalls.at(-1)?.dataItems.some(item => item.value === "25.0%")).toBe(true);
});

test("keyboard roving grid, sticky scroll geometry, resize focus and stable domains", async ({ page }) => {
    await load(page);
    await update(page, matrixFixture(40, 12), 520, 300);
    const first = page.locator("td").first();
    const color = await first.evaluate(el => getComputedStyle(el).backgroundColor);
    await first.focus();
    await page.keyboard.press("Control+End");
    const last = page.locator('td[data-row="40"][data-column="12"]');
    await expect(last).toBeFocused();
    const geometry = await page.evaluate(() => {
        const v = document.querySelector(".viewport")!.getBoundingClientRect();
        const cell = document.activeElement!.getBoundingClientRect();
        const th = document.querySelector("thead th")!.getBoundingClientRect();
        const rh = document.querySelector("tbody tr:last-child th")!.getBoundingClientRect();
        return { v: v.toJSON(), cell: cell.toJSON(), th: th.toJSON(), rh: rh.toJSON() };
    });
    expect(geometry.cell.top).toBeGreaterThanOrEqual(geometry.th.bottom - 1);
    expect(geometry.cell.left).toBeGreaterThanOrEqual(geometry.rh.right - 1);
    expect(geometry.cell.bottom).toBeLessThanOrEqual(geometry.v.bottom + 1);
    await update(page, undefined, 620, 360, 4);
    await expect(last).toBeFocused();
    await expect(page.locator('[tabindex="0"][data-row]')).toHaveCount(1);
    expect(await first.evaluate(el => getComputedStyle(el).backgroundColor)).toEqual(color);
    await page.keyboard.press("Control+Home");
    await expect(page.locator("thead th").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("tbody th").first()).toBeFocused();
    await page.keyboard.press("Shift+F10");
    expect((await state(page)).contextCalls.at(-1)?.key).toBe("r0");
});

test("partial fetching is bounded, nonduplicating on resize and truthful on rejection", async ({ page }) => {
    await load(page);
    const data = matrixFixture(3, 4, true);
    delete data.matrix!.rows.root.children![0].values![0];
    await update(page, data);
    await expect(page.locator('td[data-state="unloaded"]')).toHaveText("?");
    await page.getByRole("button", { name: "Load more rows" }).click();
    expect((await state(page)).fetchCalls).toEqual([true]);
    await expect(page.getByRole("button", { name: "Load more rows" })).toBeDisabled();
    await update(page, undefined, 800, 500, 4);
    expect((await state(page)).fetchCalls).toEqual([true]);
    await update(page, matrixFixture(5, 4, true), 800, 500, 2, 1);
    await expect(page.locator("td")).toHaveCount(20);
    await page.evaluate(() => { (window as unknown as HarnessWindow).heatmap.state.fetchAccepted = false; });
    await page.getByRole("button", { name: "Load more rows" }).click();
    await expect(page.locator(".status")).toContainText("declined");
    await update(page, matrixFixture(3, 4));
    await expect(page.getByRole("button", { name: "Load more rows" })).toHaveCount(0);
});

test("replacement queries do not inherit pending-fetch stalls", async ({ page }) => {
    await load(page);
    await update(page, matrixFixture(3, 4, true));
    await page.getByRole("button", { name: "Load more rows" }).click();
    await update(page, matrixFixture(3, 4, true), 720, 480, 2, 0);
    await expect(page.getByRole("button", { name: "Load more rows" })).toBeEnabled();
    await expect(page.locator(".status")).not.toContainText("No additional");
});

test("small tiles reserve visible space beyond maximum-width sticky labels", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    data.metadata.objects = { layout: { labelWidth: 240, cellWidth: 180, cellHeight: 64 } };
    await update(page, data, 240, 160);
    await page.locator("td").first().focus();
    await page.keyboard.press("End");
    const visible = await page.evaluate(() => {
        const cell = document.activeElement!.getBoundingClientRect();
        const label = document.querySelector("tbody th")!.getBoundingClientRect();
        const view = document.querySelector(".viewport")!.getBoundingClientRect();
        return { cell: cell.toJSON(), label: label.toJSON(), view: view.toJSON() };
    });
    expect(visible.cell.left).toBeGreaterThanOrEqual(visible.label.right - 1);
    expect(visible.cell.right).toBeLessThanOrEqual(visible.view.right + 1);
});

test("raw ratios are not normalized without author permission; explicit denominator works independently", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    data.metadata.objects = { values: { normalization: "row", additive: false } };
    await update(page, data);
    await expect(page.locator('td[data-state="unavailable"]')).toHaveCount(12);
    data.metadata.objects.values = { normalization: "row", additive: true };
    await update(page, data);
    await expect(page.locator("td").first()).toHaveText("10.0%");
    data.metadata.objects.values = { normalization: "denominator", additive: false };
    data.metadata.segment = {};
    await update(page, data);
    await expect(page.locator("td").first()).toHaveText("5.0%");
    await expect(page.locator(".semantics")).toContainText("No sum is computed");
});

test("highlights retain base domains, zero highlights, high contrast and RTL stay usable", async ({ page }, testInfo) => {
    await load(page, { locale: "ar-SA", highContrast: true });
    const data = matrixFixture();
    data.metadata.objects = { values: { showValues: false } };
    data.matrix!.rows.root.children![0].values![0].highlight = 0;
    Object.assign(data.matrix!.rows.root.children![0].values![3], { highlight: null });
    await update(page, data);
    await expect(page.locator(".atlyn-heatmap")).toHaveAttribute("dir", "rtl");
    expect(await page.locator(".semantics").evaluate(node => getComputedStyle(node).direction)).toBe("ltr");
    expect(await page.locator("tbody th").first().evaluate(node => getComputedStyle(node).direction)).toBe("rtl");
    await expect(page.locator("td").first()).toHaveClass(/highlighted/);
    await expect(page.locator("td").nth(1)).toHaveClass(/dimmed/);
    expect(await page.locator("td").first().textContent()).not.toBe("");
    expect(await page.locator("td").first().evaluate(el => getComputedStyle(el).color)).toBe("rgb(255, 255, 0)");
    await page.locator("td").first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("td").nth(1)).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("high-contrast-rtl.png") });
});

test("tiny, empty, invalid, small, normal, and large packaged states render without lifecycle errors", async ({ page }, testInfo) => {
    await load(page);
    for (const size of [{ width: 120, height: 80 }, { width: 240, height: 160 }, { width: 720, height: 480 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize({ width: Math.max(size.width, 300), height: Math.max(size.height, 200) });
        await update(page, matrixFixture(6, 8), size.width, size.height);
        if (size.width < 180) await expect(page.locator(".empty")).toContainText("Enlarge");
        else await expect(page.locator("td")).toHaveCount(48);
        await page.screenshot({ path: testInfo.outputPath(`${size.width}x${size.height}.png`) });
        const bounds = await page.locator(".atlyn-heatmap").boundingBox();
        expect(bounds?.width).toBe(size.width);
        expect(bounds?.height).toBe(size.height);
    }
    await update(page, matrixFixture(0, 4));
    await expect(page.locator(".empty")).toBeVisible();
    await update(page, { metadata: { columns: [] } });
    await expect(page.locator(".empty")).toBeVisible();
    expect((await state(page)).lifecycle.some(event => event.startsWith("failed"))).toBe(false);
});

test("20k-cell cap is deterministic and does not suggest all rows loaded", async ({ page }, testInfo) => {
    await load(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await update(page, matrixFixture(250, 100, true), 1366, 768);
    await expect(page.locator("td")).toHaveCount(20000);
    await expect(page.locator(".status")).toContainText("Incomplete");
    await expect(page.getByRole("button", { name: "Load more rows" })).toHaveCount(0);
    await expect(page.locator('td[data-row="201"]')).toHaveCount(0);
    await page.locator("td").first().focus();
    await page.keyboard.press("Control+End");
    await expect(page.locator('td[data-row="200"][data-column="100"]')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath("maximum-matrix-scrolled.png") });
});

test("missing identities and host interaction failures are visible rather than false successes", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    delete data.matrix!.rows.root.children![0].identity;
    await update(page, data);
    await page.locator("td").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".status")).toContainText("cannot be selected");
    expect((await state(page)).selectionCalls).toEqual([]);
    await page.evaluate(() => { (window as unknown as HarnessWindow).heatmap.state.selectionRejected = true; });
    await page.locator("tbody tr").nth(1).locator("td").first().click();
    await expect(page.locator(".status")).toContainText("could not apply");
    await page.evaluate(() => { (window as unknown as HarnessWindow).heatmap.host.hostCapabilities.allowInteractions = false; });
    await page.locator("tbody tr").nth(2).locator("td").first().click();
    await expect(page.locator(".status")).toContainText("disabled by the host");
});
