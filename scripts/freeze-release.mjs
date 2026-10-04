import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config, packagePath, readPackage } from "./package-payload.mjs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("Commit all source changes before freezing.");
const commit = git("rev-parse", "HEAD");
const destination = resolve(process.argv[2] || join("dist", `release-${config.visual.version}-${commit.slice(0, 12)}`));
if (existsSync(destination)) throw new Error("Immutable destination already exists; choose a new destination. Never overwrite a submission baseline.");
const { resource, bytes } = await readPackage();
const commands = JSON.parse(readFileSync("dist/evidence/commands.json", "utf8"));
if (commands.length !== 10 || commands.some(command => command.name !== "dependency-full" && command.exitCode !== 0)) throw new Error("Complete successful local release evidence is required.");
const benchmark = JSON.parse(readFileSync("dist/benchmark.json", "utf8"));
const hash = data => createHash("sha256").update(data).digest("hex");
if (benchmark.sha256 !== hash(bytes)) throw new Error("Benchmark must measure the final exact package.");
if (benchmark.results.some(result => Object.values(result.objectives).some(objective => !objective.met))) throw new Error("Performance objectives are unmet; investigate and record the limitation before freezing.");
const files = [];
function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collect(path);
        else files.push(path);
    }
}
collect("dist/submission");
collect("dist/evidence");
collect("test-results");
files.push(fileURLToPath(packagePath), "dist/benchmark.json", ...(existsSync("dist/benchmark-baseline.json") ? ["dist/benchmark-baseline.json"] : []), "assets/icon.png", "assets/icon300.png");
const assets = [];
mkdirSync(destination, { recursive: true });
for (const file of files.sort()) {
    const relative = file === fileURLToPath(packagePath) ? basename(file) : file.replace(/^dist[\\/]/, "");
    const output = join(destination, relative);
    const contents = readFileSync(file);
    mkdirSync(join(output, ".."), { recursive: true });
    writeFileSync(output, contents, { flag: "wx" });
    assets.push({ path: relative.replaceAll("\\", "/"), bytes: contents.length, sha256: hash(contents) });
}
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const manifest = {
    schemaVersion: 1, frozenAt: new Date().toISOString(), repository: "AtlynCo/powerbi-heatmap",
    sourceCommit: commit, sourceBranch: git("branch", "--show-current"), certificationBranch: "certification",
    guid: config.visual.guid, version: config.visual.version, package: basename(fileURLToPath(packagePath)), bytes: bytes.length, sha256: hash(bytes),
    hostApi: resource.apiVersion, sdk: lock.packages["node_modules/powerbi-visuals-api"].version,
    tools: lock.packages["node_modules/powerbi-visuals-tools"].version, typescript: lock.packages["node_modules/typescript"].version,
    node: process.version, uiLocales: Object.keys(resource.stringResources),
    formattingLocalePolicy: "Official --all-locales packaging; embedded formatter cultures are separate from the English-only Atlyn UI.",
    commands, assets,
    gates: { localEvidence: "passed", dependencyAudit: "production clean (0 vulnerabilities); full dev audit blocked by upstream unpatched braces GHSA-vfj7-8cjw-p6xm in tools 7.2.1", nativePowerBI: "unverified", samplePBIX: "requires real Desktop conversion", legalPricingPrivacy: "owner decision", marketplaceSubmission: "parent-owned; not submitted", certification: "not claimed", githubActions: "disabled; no workflows or hosted CI proof" }
};
writeFileSync(join(destination, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
writeFileSync(join(destination, "SHA256SUMS"), assets.map(asset => `${asset.sha256}  ${asset.path}`).join("\n") + "\n", { flag: "wx" });
console.log(JSON.stringify({ destination, sourceCommit: commit, sha256: manifest.sha256, assets: assets.length }, null, 2));
