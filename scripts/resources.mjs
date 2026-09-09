import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../stringResources/en-US", import.meta.url), { recursive: true });
copyFileSync(new URL("../src/strings.json", import.meta.url), new URL("../stringResources/en-US/resources.resjson", import.meta.url));
