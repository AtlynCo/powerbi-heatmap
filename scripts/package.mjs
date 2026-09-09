import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, join } from "node:path";

// pbiviz resolves a dev-server certificate even for packaging. Isolate that setup
// and generate a file-only certificate, never a trusted or certificate-store entry.
const home = resolve(".tmp", "tool-home");
const certs = join(home, "pbiviz-certs");
mkdirSync(certs, { recursive: true });
const env = { ...process.env, HOME: home, USERPROFILE: home };
const files = {
    pfx: join(certs, "PowerBICustomVisualTest_public.pfx"),
    password: join(certs, "PowerBICustomVisualTestPass.txt"),
    key: join(certs, "PowerBICustomVisualTest_private.key"),
    cert: join(certs, "PowerBICustomVisualTest_public.crt")
};
function run(command, args, environment = env) {
    const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
try {
    if (process.platform === "win32") {
        const password = randomBytes(24).toString("hex");
        run("pwsh", ["-NoProfile", "-File", "scripts\\certificate.ps1"], {
            ...env, ATLYN_CERT_PATH: files.pfx, ATLYN_CERT_PASSWORD: password
        });
        writeFileSync(files.password, password);
    } else {
        run("openssl", ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", files.key, "-x509",
            "-days", "7", "-out", files.cert, "-subj", "/CN=localhost"]);
    }
    run(process.execPath, [resolve("node_modules", "powerbi-visuals-tools", "bin", "pbiviz.js"), "package", "--all-locales", "--no-stats", ...process.argv.slice(2)]);
} finally {
    for (const path of Object.values(files)) rmSync(path, { force: true });
}
