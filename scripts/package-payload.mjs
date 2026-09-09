import { readFileSync } from "node:fs";
import JSZip from "jszip";

export const guid = "atlynHeatmapB5AA568F60B24834A73E7A7E279D8B37";
export const packagePath = new URL(`../dist/${guid}.1.0.0.0.pbiviz`, import.meta.url);

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
