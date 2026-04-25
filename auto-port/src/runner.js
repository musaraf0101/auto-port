import { spawn } from "node:child_process";
import { writeEntry } from "./store.js";
import { detectProjectName } from "./history.js";
import { buildEnvAndArgs } from "./framework.js";

export function run(command, cmdArgs, port, framework, { quiet = false } = {}) {
  const { env, args } = buildEnvAndArgs(cmdArgs, port, framework);

  const child = spawn(command, args, {
    stdio: quiet ? ["inherit", "pipe", "pipe"] : "inherit",
    env,
    shell: true,
  });

  if (quiet && child.stdout) child.stdout.pipe(process.stdout);
  if (quiet && child.stderr) child.stderr.pipe(process.stderr);

  writeEntry({
    port,
    project: detectProjectName(process.cwd()),
    cwd: process.cwd(),
    pid: child.pid,
    startedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });

  const cleanup = () => {
    try {
      child.kill("SIGINT");
    } catch {
      /* already dead */
    }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return child;
}
