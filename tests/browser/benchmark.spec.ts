import { chromium, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, totalmem, freemem, platform, release } from "node:os";
import { matrixFixture } from "../fixtures";
import { load, packagePath } from "./runtime";
import type { HarnessWindow } from "./host";

async function main(): Promise<void> {
    const path = process.env.HEATMAP_PACKAGE || packagePath;
    const output = process.env.HEATMAP_BENCHMARK_OUTPUT || "dist/benchmark.json";
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const samples = 20;
    const warmups = 2;
    const results: object[] = [];
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => errors.push(`Unexpected request: ${request.url()}`));
    try {
        for (const [rows, columns] of [[16, 12], [50, 40], [200, 100]]) {
            await load(page, {}, path);
            const data = matrixFixture(rows, columns);
            const values = await page.evaluate(async ({ data, samples, warmups }) => {
                const visual = (window as unknown as HarnessWindow).heatmap.visual;
                const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                const result: Record<string, number[]> = { render: [], resize: [], selection: [], scroll: [] };
                for (let n = -warmups; n < samples; n++) {
                    let start = performance.now();
                    visual.update({ dataViews: [data], viewport: { width: 1366, height: 768 }, type: 2 });
                    await paint();
                    if (n >= 0) result.render.push(performance.now() - start);
                    start = performance.now();
                    visual.update({ dataViews: [data], viewport: { width: n % 2 ? 1280 : 1366, height: 768 }, type: 4 });
                    await paint();
                    if (n >= 0) result.resize.push(performance.now() - start);
                    start = performance.now();
                    document.querySelector<HTMLElement>(`td[data-row="${n % 2 === 0 ? 1 : 2}"][data-column="1"]`)!.click();
                    await paint();
                    if (n >= 0) result.selection.push(performance.now() - start);
                    start = performance.now();
                    const view = document.querySelector<HTMLElement>(".viewport")!;
                    view.scrollTop = n % 2 ? view.scrollHeight : 0;
                    view.scrollLeft = n % 2 ? view.scrollWidth : 0;
                    await paint();
                    if (n >= 0) result.scroll.push(performance.now() - start);
                }
                return result;
            }, { data, samples, warmups });
            const timings = Object.fromEntries(Object.entries(values).map(([task, raw]) => {
                const sorted = [...raw].sort((a, b) => a - b);
                return [task, { p50: sorted[Math.ceil(samples * 0.5) - 1], p95: sorted[Math.ceil(samples * 0.95) - 1], max: sorted[samples - 1], samplesMs: raw }];
            }));
            const budgets: Record<string, number> = { render: rows * columns <= 2000 ? 200 : 2000, resize: rows * columns <= 2000 ? 200 : 2000, selection: rows * columns <= 2000 ? 100 : 200, scroll: rows * columns <= 2000 ? 100 : 200 };
            const objectives = Object.fromEntries(Object.entries(timings).map(([task, timing]) => [task, { p95BudgetMs: budgets[task], met: timing.p95 <= budgets[task] }]));
            results.push({ rows, columns, cells: rows * columns, timings, objectives });
            console.log(`${rows} x ${columns}: ${JSON.stringify(timings, (key, value) => key === "samplesMs" ? undefined : value)}`);
        }
        if (errors.length) throw new Error(errors.join("\n"));
        mkdirSync("dist", { recursive: true });
        writeFileSync(output, JSON.stringify({
            date: new Date().toISOString(), package: path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
            machine: { cpu: cpus()[0].model, logicalProcessors: cpus().length, totalMemoryBytes: totalmem(), freeMemoryBytesAtEnd: freemem(), platform: platform(), release: release(), node: process.version, chromium: browser.version() },
            samples, warmups, viewport: "1366x768; resize alternates 1280/1366",
            method: "One Chromium page, sequential workloads. Deterministic matrixFixture(r,c), value=(r+1)*(c+1)*100.5. Each measurement starts inside the browser immediately before the operation and ends after two animation frames. Nearest-rank percentiles. Render includes model/DOM/layout/paint opportunity; selection includes only mock host and local repaint, NOT actual Power BI filtering. Scroll includes setting both offsets and paint opportunity. No CPU throttling. Shared Windows VM contention is uncontrolled; results are observations, not native-host guarantees or competitor comparisons.",
            results
        }, null, 2));
    } finally { await browser.close(); }
}
test("measure release package report tasks", async () => {
    test.skip(process.env.HEATMAP_BENCHMARK !== "1", "Benchmarks run separately to avoid parallel stress loads.");
    test.setTimeout(600000);
    await main();
});
