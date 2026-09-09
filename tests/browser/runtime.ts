import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import type powerbi from "powerbi-visuals-api";
import { installHost, HarnessWindow } from "./host";

export const metadata = JSON.parse(readFileSync("pbiviz.json", "utf8"));
export const packagePath = join("dist", `${metadata.visual.guid}.${metadata.visual.version}.pbiviz`);

export async function load(page: Page, config: Partial<Parameters<typeof installHost>[0]> = {}, path = packagePath): Promise<void> {
    const zip = await JSZip.loadAsync(readFileSync(path));
    const file = zip.file(`resources/${metadata.visual.guid}.pbiviz.json`);
    if (!file) throw new Error("No packaged visual resource");
    const payload = JSON.parse(await file.async("string"));
    await page.setContent('<!doctype html><html><head></head><body style="margin:0"><div id="visual"></div></body></html>');
    await page.evaluate(() => { (window as unknown as HarnessWindow).powerbi = { visuals: { plugins: {} } }; });
    await page.addStyleTag({ content: payload.content.css });
    await page.addScriptTag({ content: payload.content.js });
    await page.evaluate(installHost, { guid: metadata.visual.guid, locale: "en-US", highContrast: false, interactions: true, ...config });
}

export async function update(page: Page, data: powerbi.DataView | undefined, width = 720, height = 480, type = 2, operationKind = 0): Promise<void> {
    await page.evaluate(({ data, width, height, type, operationKind }) => {
        (window as unknown as HarnessWindow).heatmap.visual.update({
            dataViews: data ? [data] : [], viewport: { width, height }, type, operationKind
        });
    }, { data, width, height, type, operationKind });
}

export async function state(page: Page) {
    return page.evaluate(() => (window as unknown as HarnessWindow).heatmap.state);
}
