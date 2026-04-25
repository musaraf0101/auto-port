#!/usr/bin/env node
import { isPortBusy } from "../src/detect.js";
import { findFreePort } from "../src/finder.js";
import { whoHasPort } from "../src/whohas.js";
import { detectFramework, loadPackageJson } from "../src/framework.js";
import { run } from "../src/runner.js";
import { readHistory, clearHistory, forgetPort } from "../src/store.js";
import { isProcessAlive, relativeTime } from "../src/history.js";

const args = process.argv.slice(2);

// ── port-lister --history [--json | --clear | --forget <port>] ──────────────
if (args[0] === "--history") {
  const rest = args.slice(1);

  if (rest.includes("--clear")) {
    clearHistory();
    console.log("Port history cleared.");
    process.exit(0);
  }

  if (rest.includes("--forget")) {
    const idx = rest.indexOf("--forget");
    const port = parseInt(rest[idx + 1], 10);
    if (!port) {
      console.error("Usage: port-lister --history --forget <port>");
      process.exit(1);
    }
    forgetPort(port);
    console.log(`Forgot port ${port}.`);
    process.exit(0);
  }

  const history = readHistory();

  if (!history.length) {
    console.log("No port history yet.");
    process.exit(0);
  }

  const enriched = history.map((e) => ({
    ...e,
    alive: isProcessAlive(e.pid),
    ago: relativeTime(e.lastSeenAt),
  }));

  if (rest.includes("--json")) {
    console.log(JSON.stringify(enriched, null, 2));
    process.exit(0);
  }

  const portW = Math.max(4, ...enriched.map((e) => String(e.port).length));
  const projW = Math.max(7, ...enriched.map((e) => (e.project ?? "").length));
  const timeW = Math.max(9, ...enriched.map((e) => e.ago.length));

  const header = [
    "PORT".padEnd(portW),
    "PROJECT".padEnd(projW),
    "LAST USED".padEnd(timeW),
    "STATUS",
  ].join("  ");

  console.log(header);
  console.log("-".repeat(header.length));

  for (const e of enriched) {
    const status = e.alive ? "● still running" : "○ stopped";
    console.log(
      [
        String(e.port).padEnd(portW),
        (e.project ?? "").padEnd(projW),
        e.ago.padEnd(timeW),
        status,
      ].join("  "),
    );
  }

  process.exit(0);
}

// ── port-lister [options] <command> [command-args...] ───────────────────────
if (!args.length || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: port-lister [options] <command> [command-args...]

Options:
  --port <n>       Target port (default: framework default or 3000)
  --range <a-b>    Search range for a free port
  --kill           Kill the conflicting process instead of shifting
  --quiet          Suppress port-lister output
  --save           Update .env with the resolved port
  -h, --help       Show this help

History:
  --history                    Show port history table
  --history --json             Machine-readable JSON
  --history --clear            Delete all history entries
  --history --forget <port>    Remove a single entry by port

Examples:
  port-lister npm start
  port-lister vite
  port-lister node server.js
  port-lister --port 4000 next dev
  port-lister python manage.py runserver
  port-lister --history`);
  process.exit(0);
}

// Parse flags
let preferredPort = null;
let rangeMax = 20;
let kill = false;
let quiet = false;
let save = false;
const cmdArgs = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--port") {
    preferredPort = parseInt(args[++i], 10);
  } else if (a === "--range") {
    const [lo, hi] = args[++i].split("-").map(Number);
    preferredPort = lo;
    rangeMax = hi - lo;
  } else if (a === "--kill") {
    kill = true;
  } else if (a === "--quiet") {
    quiet = true;
  } else if (a === "--save") {
    save = true;
  } else {
    cmdArgs.push(...args.slice(i));
    break;
  }
}

if (!cmdArgs.length) {
  console.error(
    "Error: no command provided. Run port-lister --help for usage.",
  );
  process.exit(1);
}

const [command, ...restArgs] = cmdArgs;
const pkg = loadPackageJson(process.cwd());
const framework = detectFramework(pkg);
const startPort = preferredPort ?? framework.default;

const warn = (msg) => {
  if (!quiet) process.stderr.write(msg + "\n");
};
const info = (msg) => {
  if (!quiet) process.stdout.write(msg + "\n");
};

const busy = await isPortBusy(startPort);
let port = startPort;

if (busy) {
  const owner = whoHasPort(startPort);
  if (owner) {
    warn(`Port ${startPort} in use → ${owner.name} (pid ${owner.pid})`);
  } else {
    warn(`Port ${startPort} in use`);
  }

  if (kill && owner) {
    warn(`   Killing pid ${owner.pid}...`);
    try {
      process.kill(owner.pid, "SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      /* already gone */
    }
    port = startPort;
  } else {
    warn(`✓  Finding next available port...`);
    port = await findFreePort(startPort + 1, rangeMax);
  }
}

if (save) {
  await saveDotEnv(port);
}

if (!quiet) {
  info(`Starting on port ${port}`);
  info(`http://localhost:${port}`);
}

const child = run(command, restArgs, port, framework, { quiet });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

async function saveDotEnv(port) {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const dotenvPath = `${process.cwd()}/.env`;
  let content = "";
  try {
    content = readFileSync(dotenvPath, "utf8");
  } catch {
    /* no .env yet */
  }
  const key = framework.portVar ?? "PORT";
  if (content.includes(`${key}=`)) {
    content = content.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${port}`);
  } else {
    content = content.trimEnd() + `\n${key}=${port}\n`;
  }
  writeFileSync(dotenvPath, content);
}
