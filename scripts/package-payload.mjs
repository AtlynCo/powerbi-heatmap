import { readFileSync } from "node:fs";
import JSZip from "jszip";

export const config = JSON.parse(readFileSync(new URL("../pbiviz.json", import.meta.url), "utf8"));
export const guid = config.visual.guid;
export const version = config.visual.version;
export const packagePath = new URL(`../dist/${guid}.${version}.pbiviz`, import.meta.url);

export async function readPackage() {
    const bytes = readFileSync(packagePath);
    const zip = await JSZip.loadAsync(bytes);
    const manifestFile = zip.file("package.json");
    if (!manifestFile) throw new Error("Package has no package.json");
    const manifest = JSON.parse(await manifestFile.async("string"));
    const resourceFile = Object.values(zip.files).find(file => !file.dir && file.name.startsWith("resources/") && file.name.endsWith(".json"));
    if (!resourceFile) throw new Error("Package has no visual payload");
    const resource = JSON.parse(await resourceFile.async("string"));
    return { bytes, zip, manifest, resource };
}
