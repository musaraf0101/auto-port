export { isPortBusy } from "./detect.js";
export { findFreePort } from "./finder.js";
export { whoHasPort } from "./whohas.js";
export {
  detectFramework,
  loadPackageJson,
  buildEnvAndArgs,
} from "./framework.js";
export { readHistory, writeEntry, clearHistory, forgetPort } from "./store.js";
export { isProcessAlive, relativeTime, detectProjectName } from "./history.js";
export { run } from "./runner.js";

import { isPortBusy } from "./detect.js";
import { findFreePort } from "./finder.js";
import { whoHasPort } from "./whohas.js";
import {
  detectFramework,
  loadPackageJson,
  buildEnvAndArgs,
} from "./framework.js";
import { readHistory, writeEntry } from "./store.js";
import { detectProjectName, isProcessAlive } from "./history.js";
import { run } from "./runner.js";

/**
 * Full auto — detect framework, resolve port, inject correctly, spawn, record history.
 */
export async function autoPort(commandLine, { port: preferredPort } = {}) {
  const [command, ...cmdArgs] = commandLine.split(" ");
  const pkg = loadPackageJson(process.cwd());
  const framework = detectFramework(pkg);
  const startPort = preferredPort ?? framework.default;

  const isBusy = await isPortBusy(startPort);
  let port = startPort;
  if (isBusy) {
    const owner = whoHasPort(startPort);
    if (owner) {
      process.stderr.write(
        `Port ${startPort} in use → ${owner.name} (pid ${owner.pid})\n`,
      );
    } else {
      process.stderr.write(`Port ${startPort} in use\n`);
    }
    process.stderr.write(`Finding next available port...\n`);
    port = await findFreePort(startPort + 1);
  }

  process.stderr.write(`Starting on port ${port}\n`);
  process.stderr.write(`http://localhost:${port}\n`);

  return run(command, cmdArgs, port, framework);
}

export const portHistory = {
  read() {
    return readHistory().map((entry) => ({
      ...entry,
      alive: isProcessAlive(entry.pid),
    }));
  },
};
