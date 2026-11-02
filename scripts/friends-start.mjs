import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

console.log("\nOpenFront Friends — private multiplayer\n");
console.log("This PC: http://localhost:9000");
for (const entries of Object.values(networkInterfaces())) {
  for (const entry of entries ?? []) {
    if (entry.family === "IPv4" && !entry.internal) {
      console.log(`Friends on your network: http://${entry.address}:9000`);
    }
  }
}
console.log(
  "\nHost a match, copy the lobby link, and send it to friends.\nKeep this window open. Press Ctrl+C to stop.\n",
);
// npm_execpath avoids Windows shell quoting and works with a local npm 12.
const child = spawn(
  process.execPath,
  [process.env.npm_execpath, "run", "dev:host"],
  {
    stdio: "inherit",
    env: { ...process.env, SKIP_BROWSER_OPEN: "true" },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
