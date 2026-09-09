import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

mkdirSync("dist/evidence", { recursive: true });
const commands = [
    ["typecheck", ["npm", "run", "typecheck"]],
    ["eslint", ["npm", "run", "eslint"]],
    ["unit", ["npm", "test"]],
    ["package", ["npm", "run", "package", "--", "--certification-audit"]],
    ["package-audit", ["npm", "run", "audit:package"]],
    ["browser", ["npx", "playwright", "test", "--grep-invert", "measure.release.package"]],
    ["dependency-full", ["npm", "audit"]],
    ["dependency-production", ["npm", "audit", "--omit=dev"]],
    ["sample", ["npm", "run", "sample"]],
    ["sample-validation", ["node", join("scripts", "validate-sample.mjs"), "--schemas"]]
];
const outcomes = [];
for (const [name, command] of commands) {
    const start = new Date().toISOString();
    // Windows package-manager entry points are cmd shims; arguments here are fixed, never host data.
    const result = process.platform === "win32"
        ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command.map(argument => /\s/.test(argument) ? `"${argument}"` : argument).join(" ")], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
        : spawnSync(command[0], command.slice(1), { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    const log = `${result.stdout || ""}${result.stderr || ""}${result.error ? String(result.error) : ""}`;
    writeFileSync(`dist/evidence/${name}.log`, log);
    outcomes.push({ name, command, start, end: new Date().toISOString(), exitCode: result.status });
    writeFileSync("dist/evidence/commands.json", JSON.stringify(outcomes, null, 2));
    console.log(`${name}: ${result.status === 0 ? "PASS" : "FAIL"}`);
    if (result.status !== 0) { console.error(log); process.exit(result.status || 1); }
}
