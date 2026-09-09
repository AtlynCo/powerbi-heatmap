import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { matrixFixture } from "../fixtures";
import { load, update, state, metadata } from "./runtime";
import { HarnessWindow, installHost } from "./host";
import { example } from "./examples";

test("synchronous host failures stay visible and fetch refusal survives resize", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await load(page);
    await update(page, matrixFixture(3, 4, true));
    await page.evaluate(() => Object.assign((window as unknown as HarnessWindow).heatmap.state, { selectionThrows: true, contextThrows: true, fetchThrows: true }));
    await page.locator("td").first().click();
    await expect(page.locator(".status")).toContainText("could not apply");
    await page.locator("td").first().click({ button: "right" });
    await expect(page.locator(".status")).toContainText("could not open");
    await page.getByRole("button", { name: "Load more rows" }).click();
    await expect(page.locator(".status")).toContainText("request failed");
    await update(page, undefined, 600, 400, 4);
    await expect(page.locator(".status")).toContainText("request failed");
    await update(page, matrixFixture(3, 4, true));
    await page.evaluate(() => Object.assign((window as unknown as HarnessWindow).heatmap.state, { fetchThrows: false, fetchAccepted: false }));
    await page.getByRole("button", { name: "Load more rows" }).click();
    await update(page, undefined, 700, 400, 4);
    await expect(page.locator(".status")).toContainText("declined");
    expect(errors).toEqual([]);
});

test("every tooltip measure retains its own model-provided cell format", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    data.matrix!.rows.root.children![0].values![1].objects = { general: { formatString: "0.000" } };
    data.matrix!.rows.root.children![0].values![2].objects = { general: { formatString: "0.00" } };
    await update(page, data);
    await expect(page.locator("td").first()).toHaveText("$100.50");
    await page.locator("td").first().hover();
    const tooltip = (await state(page)).tooltipCalls.at(-1)!.dataItems;
    expect(tooltip.find(item => item.displayName === "Regional target")?.value).toBe("2000.000");
    expect(tooltip.find(item => item.displayName === "Units")?.value).toBe("10.00");
});

test("a segment that fills unknown intersections counts as progress without adding axis categories", async ({ page }) => {
    await load(page);
    const data = matrixFixture(3, 4, true);
    delete data.matrix!.rows.root.children![0].values![0];
    await update(page, data);
    await expect(page.locator("td").first()).toHaveText("?");
    await page.getByRole("button", { name: "Load more rows" }).click();
    data.matrix!.rows.root.children![0].values![0] = { value: 0 };
    await update(page, data, 720, 480, 2, 1);
    await expect(page.locator("td").first()).toHaveText("$0.00");
    await expect(page.getByRole("button", { name: "Load more rows" })).toBeEnabled();
    await expect(page.locator(".status")).toContainText("Incomplete");
});

test("group warning survives focus; focus follows identity through reordered rows; text never fades", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    data.metadata.objects = { scale: { scope: "row" } };
    await update(page, data);
    await page.locator("td").first().click();
    await expect(page.locator(".scope-warning")).toContainText("not comparable");
    expect(await page.locator("td").nth(1).evaluate(node => getComputedStyle(node).opacity)).toBe("1");
    data.matrix!.rows.root.children!.reverse();
    await update(page, data);
    await expect(page.locator('td[data-row="3"][data-column="1"]')).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".scope-warning")).toContainText("not comparable");
    await update(page, data, 258, 198);
    await expect(page.locator(".semantics")).toContainText("Sequential");
    const geometry = await page.evaluate(() => ({
        warning: document.querySelector(".scope-warning")!.getBoundingClientRect().bottom,
        heading: document.querySelector(".heading")!.getBoundingClientRect().bottom
    }));
    expect(geometry.warning).toBeLessThanOrEqual(geometry.heading);
});

test("progressive binding, persisted settings replay, independent instances and destroy", async ({ page }) => {
    await load(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const role of ["row", "column", "value"]) {
        const incomplete = matrixFixture();
        delete incomplete.metadata.columns.find(source => source.roles?.[role])!.roles![role];
        await update(page, incomplete);
        await expect(page.locator(".empty")).toBeVisible();
        const messages = await page.locator(".footer .status, .footer .notice").allTextContents();
        expect(new Set(messages).size).toBe(messages.length);
        expect(await page.evaluate(() => (window as unknown as HarnessWindow).heatmap.visual.getFormattingModel?.()?.cards.length)).toBe(3);
    }
    const data = example("product-region");
    data.metadata.objects = { values: { normalization: "row", additive: true }, scale: { scope: "column", palette: "diverging" }, layout: { cellWidth: 120 } };
    await update(page, data);
    await expect(page.locator('td[data-row="1"][data-column="3"]')).toHaveText("40.0%");
    await page.evaluate(() => { const root = document.createElement("div"); root.id = "second"; document.body.appendChild(root); });
    await page.evaluate(installHost, { guid: metadata.visual.guid, locale: "de-DE", interactions: true, highContrast: false, rootId: "second" });
    await page.evaluate(data => {
        const target = window as unknown as HarnessWindow;
        target.heatmaps.second.visual.update({ dataViews: [data], viewport: { width: 398, height: 298 }, type: 2 });
    }, example("product-region"));
    await expect(page.locator('#second td[data-row="1"][data-column="3"]')).toContainText("1.200");
    await page.locator("#visual td").first().click();
    expect(await page.locator('#second [aria-selected="true"]').count()).toBe(0);
    await update(page, data, 398, 298);
    await expect(page.locator('#visual td[data-row="1"][data-column="3"]')).toHaveText("40.0%");
    await page.evaluate(() => (window as unknown as HarnessWindow).heatmap.visual.destroy!());
    await expect(page.locator("#visual .atlyn-heatmap")).toHaveCount(0);
    await expect(page.locator("#second td")).toHaveCount(16);
    expect(errors).toEqual([]);
});

test("touch contact does not open a hover tooltip; tapping and reduced-motion keyboard still work", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await load(page);
    await update(page, matrixFixture());
    const cell = page.locator("td").first();
    await cell.dispatchEvent("pointerover", { pointerType: "touch" });
    expect((await state(page)).tooltipCalls).toEqual([]);
    await cell.dispatchEvent("click");
    await expect(cell).toHaveAttribute("aria-selected", "true");
    await cell.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('td[data-row="2"][data-column="1"]')).toBeFocused();
});

test("render failure replaces stale data and recovers with paired lifecycle events", async ({ page }) => {
    await load(page);
    const data = matrixFixture();
    await update(page, data);
    const outcome = await page.evaluate(data => {
        const { host, visual, state } = (window as unknown as HarnessWindow).heatmap;
        const builder = host.createSelectionIdBuilder;
        host.createSelectionIdBuilder = () => { throw new Error("Deliberate unavailable host identity service"); };
        visual.update({ dataViews: [data], viewport: { width: 398, height: 298 }, type: 2 });
        const error = document.querySelector(".empty")?.textContent;
        const cellsAfterFailure = document.querySelectorAll("td").length;
        host.createSelectionIdBuilder = builder;
        visual.update({ dataViews: [data], viewport: { width: 398, height: 298 }, type: 2 });
        return { error, cellsAfterFailure, lifecycle: state.lifecycle };
    }, data);
    expect(outcome.error).toContain("could not render");
    expect(outcome.cellsAfterFailure).toBe(0);
    expect(outcome.lifecycle.map(event => event.split(":")[0])).toEqual(["started", "finished", "started", "failed", "started", "finished"]);
    await expect(page.locator("td")).toHaveCount(12);
});

test("requested tile sizes, long labels, scroll offsets, and error/loading transitions", async ({ page }, info) => {
    await load(page);
    const data = matrixFixture(40, 12, true);
    data.matrix!.rows.root.children![0].levelValues![0].value = "Long manufacturing category ".repeat(60);
    for (const [width, height] of [[80, 80], [258, 198], [398, 298], [1280, 620], [1366, 768]]) {
        await page.setViewportSize({ width, height });
        await update(page, data, width, height);
        const root = page.locator(".atlyn-heatmap");
        expect(await root.boundingBox()).toMatchObject({ width, height });
        if (width === 80) await expect(page.locator(".empty")).toContainText("Enlarge");
        else {
            expect((await page.locator("tbody th").first().textContent())?.length).toBe(1024);
            if (width === 398) {
                await page.locator(".viewport").evaluate(node => { node.scrollTop = 0; node.scrollLeft = 0; });
                await page.screenshot({ path: info.outputPath("long-label-origin.png") });
            }
            await page.locator("td").first().focus();
            await page.keyboard.press("Control+End");
            const geometry = await page.evaluate(() => {
                const view = document.querySelector(".viewport")!.getBoundingClientRect();
                const cell = document.activeElement!.getBoundingClientRect();
                const header = document.querySelector("thead th")!.getBoundingClientRect();
                const row = document.querySelector("tbody tr:last-child th")!.getBoundingClientRect();
                return { view: view.toJSON(), cell: cell.toJSON(), header: header.toJSON(), row: row.toJSON() };
            });
            expect(geometry.cell.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1);
            expect(geometry.cell.bottom).toBeLessThanOrEqual(geometry.view.bottom + 1);
            expect(geometry.cell.left).toBeGreaterThanOrEqual(geometry.row.right - 1);
        }
        await page.screenshot({ path: info.outputPath(`${width}x${height}.png`) });
    }
    await update(page, { metadata: { columns: [] } });
    await expect(page.locator(".empty")).toBeVisible();
    await page.screenshot({ path: info.outputPath("binding-error.png") });
    await update(page, matrixFixture(0, 4));
    await expect(page.locator(".empty")).toBeVisible();
    await page.screenshot({ path: info.outputPath("empty.png") });
    await update(page, matrixFixture(3, 4, true));
    await page.getByRole("button", { name: "Load more rows" }).click();
    await expect(page.locator(".status")).toContainText("Loading");
    await page.screenshot({ path: info.outputPath("loading.png") });
    await update(page, matrixFixture(3, 4, true), 720, 480, 2, 1);
    await expect(page.locator(".status")).toContainText("No additional");
});

test("actual package listing illustrations with truthful callouts and sample arithmetic", async ({ page }) => {
    mkdirSync("dist/submission/screenshots", { recursive: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [index, kind] of (["product-region", "defect-line"] as const).entries()) {
        await load(page);
        const data = example(kind);
        data.metadata.objects = { layout: { fontSize: 16, cellHeight: 56, cellWidth: 180, labelWidth: 180 } };
        if (index === 1) data.metadata.objects.values = { normalization: "denominator", additive: false };
        await page.evaluate(({ title, explanation }) => {
            document.body.style.cssText = "margin:0;background:#eef3f7;font:18px Segoe UI,Arial;color:#172b3a;padding:32px";
            const header = document.createElement("h1"); header.textContent = title; header.style.margin = "0 0 12px";
            const note = document.createElement("p"); note.textContent = explanation; note.style.cssText = "border-left:5px solid #08519c;padding:14px;background:white;border-radius:6px";
            const source = document.createElement("p"); source.textContent = "Actual packaged renderer in an isolated browser with sample host data. Not a Power BI Desktop or Service capture."; source.style.cssText = "font-size:14px;color:#425869";
            document.body.prepend(header, note);
            document.body.appendChild(source);
        }, {
            title: index === 0 ? "Atlyn Heatmap | Product and region" : "Atlyn Heatmap | Defects and inspection opportunities",
            explanation: index === 0 ? "Read raw revenue before comparing colors. Pumps/North is zero, Pumps/West is BLANK, Filters/East is absent. No totals are invented."
                : "Seal / Line B = 4 defects / 200 opportunities = 2.0%. The model supplies each denominator; repeated exposures and rates are never summed."
        });

        await update(page, data, 1280, 520);
        await expect(page.locator('td[data-row="1"][data-column="1"]')).toHaveText(index === 0 ? "$0" : "0.0%");
        if (index === 1) await expect(page.locator('td[data-row="3"][data-column="1"]')).toHaveText("2.0%");
        const path = `dist/submission/screenshots/${kind}.png`;
        await page.screenshot({ path });
        expect(statSync(path).size).toBeLessThanOrEqual(1024 * 1024);
        const png = readFileSync(path);
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1366, 768]);
    }
});

test("comparison illustration separates raw color scope from additive percentage calculation", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await load(page);
    await page.evaluate(() => {
        document.body.style.cssText = "margin:0;padding:30px;background:#eef3f7;color:#172b3a;font:17px Segoe UI,Arial";
        const title = document.createElement("h1"); title.textContent = "The same observations. Three different analytical questions.";
        title.style.cssText = "font-size:30px;margin:0 0 12px";
        const note = document.createElement("p"); note.textContent = "Changing color scope does not change the numbers. Only an explicit additive-share setting calculates percentages.";
        note.style.cssText = "background:white;border-left:5px solid #08519c;padding:14px;border-radius:6px;margin:0 0 16px";
        const panels = document.createElement("div"); panels.style.cssText = "display:flex;gap:12px";
        const first = document.getElementById("visual")!;
        for (const [id, label] of [["visual", "1. Raw revenue / global colors"], ["scoped", "2. Raw revenue / within-row colors"], ["shares", "3. Row shares / global colors"]]) {
            const section = document.createElement("section");
            const heading = document.createElement("h3"); heading.textContent = label; heading.style.cssText = "font-size:17px;margin:0 0 10px";
            const root = id === "visual" ? first : document.createElement("div"); root.id = id;
            section.append(heading, root); panels.appendChild(section);
        }
        document.body.prepend(title, note, panels);
        const source = document.createElement("p");
        source.textContent = "Actual package, offline product-region CSV, isolated browser / mocked Power BI host. Not a Desktop or Service capture.";
        source.style.fontSize = "14px"; document.body.appendChild(source);
    });
    for (const id of ["scoped", "shares"]) await page.evaluate(installHost, { guid: metadata.visual.guid, locale: "en-US", highContrast: false, interactions: true, rootId: id });
    for (const id of ["visual", "scoped", "shares"]) {
        const data = example("product-region");
        data.metadata.objects = { layout: { labelWidth: 80, cellWidth: 56, cellHeight: 44 } };
        if (id === "scoped") data.metadata.objects.scale = { scope: "row" };
        if (id === "shares") data.metadata.objects.values = { normalization: "row", additive: true };
        await page.evaluate(({ id, data }) => (window as unknown as HarnessWindow).heatmaps[id].visual.update({
            dataViews: [data], viewport: { width: 424, height: 484 }, type: 2
        }), { id, data });
    }
    const target = 'td[data-row="1"][data-column="3"]';
    await expect(page.locator(`#visual ${target}`)).toHaveText("$1,200");
    await expect(page.locator(`#scoped ${target}`)).toHaveText("$1,200");
    await expect(page.locator(`#shares ${target}`)).toHaveText("40.0%");
    await expect(page.locator("#scoped .scope-warning")).toContainText("not comparable");
    expect(await page.locator(`#visual ${target}`).evaluate(node => getComputedStyle(node).backgroundColor))
        .not.toBe(await page.locator(`#scoped ${target}`).evaluate(node => getComputedStyle(node).backgroundColor));
    mkdirSync("dist/submission/screenshots", { recursive: true });
    const path = "dist/submission/screenshots/scaling-vs-shares.png";
    await page.screenshot({ path });
    const png = readFileSync(path);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1366, 768]);
    expect(png.length).toBeLessThanOrEqual(1024 * 1024);
});
