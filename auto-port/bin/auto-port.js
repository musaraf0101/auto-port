#!/usr/bin/env node
import { isPortBusy } from "../src/detect.js";
import { findFreePort } from "../src/finder.js";
import { whoHasPort } from "../src/whohas.js";
import { detectFramework, loadPackageJson } from "../src/framework.js";
import { run } from "../src/runner.js";

const args = process.argv.slice(2);

if (!args.length || args[0] === "--help" || args[0] === "-h") {
  console.log(`Usage: auto-port [options] <command> [command-args...]

Options:
  --port <n>       Target port (default: framework default or 3000)
  --range <a-b>    Search range for a free port
  --kill           Kill the conflicting process instead of shifting
  --quiet          Suppress auto-port output
  --save           Update .env with the resolved port
  -h, --help       Show this help

Examples:
  auto-port npm start
  auto-port vite
  auto-port node server.js
  auto-port --port 4000 next dev
  auto-port python manage.py runserver`);
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
  console.error("Error: no command provided. Run auto-port --help for usage.");
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
    warn(`⚠  Port ${startPort} in use → ${owner.name} (pid ${owner.pid})`);
  } else {
    warn(`⚠  Port ${startPort} in use`);
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
  info(`✅  Starting on port ${port}`);
  info(`🚀  http://localhost:${port}`);
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
