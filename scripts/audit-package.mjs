import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";
import { guid, version, packagePath, readPackage } from "./package-payload.mjs";

const { bytes, zip, manifest, resource } = await readPackage();
const config = JSON.parse(readFileSync(new URL("../pbiviz.json", import.meta.url), "utf8"));
const capabilities = JSON.parse(readFileSync(new URL("../capabilities.json", import.meta.url), "utf8"));
const strings = JSON.parse(readFileSync(new URL("../src/strings.json", import.meta.url), "utf8"));
assert.equal(config.visual.guid, guid, "The release GUID is frozen");
assert.equal(resource.visual.guid, guid);
assert.equal(resource.visual.version, version);
assert.equal(resource.visual.displayName, "Atlyn Heatmap");
assert.equal(resource.apiVersion, "5.11.0");
assert.equal(resource.author.name, "Atlyn");
assert.equal(resource.author.email, "atlyn.help@gmail.com");
assert.equal(resource.visual.supportUrl, "https://www.atlynco.com/docs/faq");
assert.deepEqual(resource.capabilities, capabilities);
assert.deepEqual(resource.capabilities.privileges, []);
assert.deepEqual(resource.stringResources["en-US"], strings);
assert.deepEqual(JSON.parse(readFileSync(new URL("../stringResources/en-US/resources.resjson", import.meta.url), "utf8")), strings);
assert.deepEqual(manifest.visual, resource.visual);
assert.deepEqual(manifest.author, resource.author);
assert.equal(manifest.version, version);
assert.deepEqual(manifest.resources, [{ resourceId: "rId0", sourceType: 5, file: `resources/${guid}.pbiviz.json` }]);
assert.equal(manifest.metadata.pbivizjson.resourceId, "rId0");
assert.equal(capabilities.supportsMultiVisualSelection, true);
assert.ok(resource.content.js.length > 10000, "Missing implementation");
assert.ok(resource.content.css.includes("atlyn-heatmap"), "Missing visual styles");
const notices = JSON.parse(readFileSync(new URL("../src/thirdParty.json", import.meta.url), "utf8")).text;
assert.equal(notices, readFileSync(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8"));
assert.ok(resource.content.js.includes("Permission is hereby granted, free of charge"), "MIT license must ship inside the visual");
assert.ok(resource.content.js.includes("Microsoft Corporation"), "Required upstream attribution must ship inside the visual");
assert.ok(resource.content.js.includes("powerbi-visuals-utils-formattingutils@7.0.0"), "Runtime legal text is missing");
new Script(resource.content.js);
const forbidden = [
    /\beval\s*\(/, /\bnew\s+Function\s*\(/, /\bFunction\s*\(/,
    /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/,
    /\.\s*(?:innerHTML|outerHTML)\s*=/,
    /document\s*\.\s*write\s*\(/, /sourceMappingURL=data:/,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/
];
for (const pattern of forbidden) assert.ok(!pattern.test(resource.content.js), `Forbidden runtime pattern: ${pattern}`);
assert.ok(!/@import|url\s*\(\s*['"]?https?:/i.test(resource.content.css), "External CSS asset");
const archiveFiles = Object.values(zip.files).filter(file => !file.dir).map(file => file.name).sort();
assert.deepEqual(archiveFiles, ["package.json", `resources/${guid}.pbiviz.json`]);
const icon = Buffer.from(resource.content.iconBase64.replace(/^data:image\/png;base64,/, ""), "base64");
assert.equal(icon.readUInt32BE(16), 20);
assert.equal(icon.readUInt32BE(20), 20);
assert.deepEqual(icon, readFileSync(new URL("../assets/icon.png", import.meta.url)));
const listingIcon = readFileSync(new URL("../assets/icon300.png", import.meta.url));
assert.equal(listingIcon.readUInt32BE(16), 300);
assert.equal(listingIcon.readUInt32BE(20), 300);
const hash = createHash("sha256").update(bytes).digest("hex");
writeFileSync(new URL("../dist/SHA256SUMS", import.meta.url), `${hash}  ${guid}.${version}.pbiviz\n`);
console.log(JSON.stringify({
    package: fileURLToPath(packagePath), guid, version: resource.visual.version, apiVersion: resource.apiVersion,
    bytes: bytes.length, jsBytes: Buffer.byteLength(resource.content.js), cssBytes: Buffer.byteLength(resource.content.css),
    sha256: hash, archiveFiles, result: "PASS",
    scope: "Package integrity and static certification-oriented checks, not Microsoft certification or native Power BI validation."
}, null, 2));
