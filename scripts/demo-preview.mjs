import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!["build", "start"].includes(command)) throw new Error("Use npm run build:demo o npm run start:demo.");
const require = createRequire(import.meta.url);
const args = [require.resolve("next/dist/bin/next"), command];
if (command === "start") args.push("--hostname", "127.0.0.1", "--port", "3000");
const result = spawnSync(process.execPath, args, {
  cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "1", NEXT_PUBLIC_PILOT_MODE: "0", CODEX_DEMO_PREVIEW: "1" },
});
process.exit(result.status ?? 1);
