# port-lister — Project Plan

> npm package · fully local · zero runtime dependencies

---

## Overview

`port-lister` is a CLI tool that automatically detects port conflicts and starts your app on the next available port — no manual `PORT=3001` juggling, no killing other processes. It works with **any frontend or backend framework** by wrapping any command and injecting the correct port variable automatically.

```bash
# frontend
npx port-lister npm start           # CRA, Vite, Next.js, Nuxt, SvelteKit...
# backend
npx port-lister node server.js      # Express, Fastify, plain Node...
# non-Node
npx port-lister python manage.py runserver

# ⚠  Port 3000 in use → node (pid 4521)
# ✓  Finding next available port...
# ✅  Starting on port 3001
# 🚀  http://localhost:3001
```

---

## Tech Stack

| Tool            | Purpose                     |
| --------------- | --------------------------- |
| Node.js ESM     | Runtime                     |
| `net` module    | Port detection              |
| `child_process` | Spawn user command          |
| `node:os`       | Cross-platform support      |
| Vitest          | Unit testing                |
| GitHub Actions  | CI / cross-platform testing |

**Zero runtime dependencies** — everything uses Node.js built-in modules.

---

## Project Structure

```
port-lister/
├── src/
│   ├── detect.js      ← is port busy?
│   ├── finder.js      ← find next free port
│   ├── runner.js      ← spawn with injected PORT
│   ├── whohas.js      ← what process owns the port
│   ├── framework.js   ← detect framework + port injection strategy
│   ├── history.js     ← read/write port history log
│   ├── store.js       ← persistent JSON store (~/.port-lister/history.json)
│   └── index.js       ← public programmatic API
├── bin/
│   └── port-lister.js    ← CLI entry point + --history sub-command
├── test/
│   ├── detect.test.js
│   ├── finder.test.js
│   ├── whohas.test.js
│   ├── framework.test.js
│   └── history.test.js
├── package.json
├── README.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Phase 1 — Project Scaffold & Core Engine

**Timeline: Week 1**

### Goals

Build the fundamental detection and resolution engine with no external dependencies.

### Tasks

- [ ] Init npm package with `type: "module"`, set `bin` field in `package.json`
- [ ] Port detection using `net.createServer` — attempt to bind, catch EADDRINUSE
- [ ] Free port finder — scan upward from requested port until free (max +20 range)
- [ ] Process identifier (`whohas.js`) — find what process owns a port
  - macOS / Linux: parse `lsof -i :PORT` output
  - Windows: parse `netstat -ano` output
- [ ] Export clean programmatic API from `index.js`

### Core Logic

```js
// detect.js — check if a port is in use
import net from "node:net";

export function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}
```

```js
// finder.js — find next free port
import { isPortBusy } from "./detect.js";

export async function findFreePort(start, max = 20) {
  for (let port = start; port <= start + max; port++) {
    if (!(await isPortBusy(port))) return port;
  }
  throw new Error(`No free port found in range ${start}–${start + max}`);
}
```

---

## Phase 2 — CLI Interface & Port Injection

**Timeline: Week 1–2**

### Goals

Wrap the engine in a clean CLI that transparently spawns the user's command with the resolved port.

### Usage Patterns

```bash
# frontend
npx port-lister npm start                    # Create React App
npx port-lister vite                         # Vite
npx port-lister next dev                     # Next.js
npx port-lister ng serve                     # Angular
npx port-lister npm run dev                  # SvelteKit, Nuxt, Remix

# backend
npx port-lister node server.js               # Express / plain Node
npx port-lister ts-node app.ts               # TypeScript
npx port-lister python manage.py runserver   # Django
npx port-lister go run main.go               # Go

# with flags
npx port-lister --port 3000 yarn dev
npx port-lister --range 3000-3010 node server.js
npx port-lister --kill npm run dev
npx port-lister --quiet vite
```

### CLI Flags

| Flag            | Description                                       |
| --------------- | ------------------------------------------------- |
| `--port <n>`    | Target port (default: reads from script or 3000)  |
| `--range <a-b>` | Search range for free port                        |
| `--kill`        | Kill the conflicting process instead of shifting  |
| `--quiet`       | Suppress port-lister output, show only app output |
| `--save`        | Update `.env` file with the resolved port         |

### Tasks

- [ ] Parse CLI args — command to run + all flags
- [ ] Inject resolved port as `PORT=XXXX` env var before spawning
- [ ] Pass through all stdio so child process output looks completely normal
- [ ] Handle `SIGINT` / `SIGTERM` — kill child process cleanly on Ctrl+C
- [ ] Colored terminal output with plain fallback when no TTY detected

### Port Injection

```js
// runner.js — spawn command with injected PORT
import { spawn } from "node:child_process";

export function run(command, args, port) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
    shell: true,
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  return child;
}
```

---

## Phase 3 — Universal Framework Detection & Port Injection

**Timeline: Week 2**

### Goals

Auto-detect any frontend or backend framework and apply the correct port injection strategy — env var, CLI flag, or both — without any config from the user.

### The Problem

Different frameworks read the port in completely different ways:

```
PORT=3001        → Express, CRA, Next.js, Fastify, Django  ← env var
VITE_PORT=3001   → Vite                                     ← different env var name
NUXT_PORT=3001   → Nuxt                                     ← different env var name
ng serve --port 3001  → Angular                             ← CLI flag, ignores env
webpack serve --port 3001 → Webpack DevServer               ← CLI flag
```

`framework.js` handles every case so the user never has to think about it.

### Detection Flow

```
Read package.json deps + scripts
        ↓
Match known framework
        ↓
┌─────────────────────────────────────────────────┐
│  Strategy A → inject ENV VAR  (most frameworks) │
│  Strategy B → append CLI FLAG (Angular, Webpack)│
│  Strategy C → ENV VAR + CLI FLAG (some tools)   │
└─────────────────────────────────────────────────┘
        ↓
Spawn command correctly
        ↓
Record to port history
```

### Full Compatibility Table

| Framework         | Type       | Strategy | Port variable / flag | Works?             |
| ----------------- | ---------- | -------- | -------------------- | ------------------ |
| Express           | Backend    | env var  | `PORT`               | ✅                 |
| Fastify           | Backend    | env var  | `PORT`               | ✅                 |
| plain Node.js     | Backend    | env var  | `PORT`               | ✅                 |
| Create React App  | Frontend   | env var  | `PORT`               | ✅                 |
| Next.js           | Full stack | env var  | `PORT`               | ✅                 |
| Vite              | Frontend   | env var  | `VITE_PORT`          | ✅                 |
| Nuxt              | Full stack | env var  | `NUXT_PORT`          | ✅                 |
| Remix             | Full stack | env var  | `PORT`               | ✅                 |
| SvelteKit         | Full stack | env var  | `PORT`               | ✅                 |
| Angular           | Frontend   | CLI flag | `--port`             | ✅                 |
| Webpack DevServer | Frontend   | CLI flag | `--port`             | ✅                 |
| Django            | Backend    | env var  | `PORT`               | ✅                 |
| Go / Rust         | Backend    | env var  | `PORT`               | ✅ if app reads it |
| Rails             | Backend    | CLI flag | `-p`                 | ⚠️ best effort     |

### Tasks

- [ ] `framework.js` — detect framework from `package.json` deps and scripts
- [ ] Strategy A: inject correct env var name per framework
- [ ] Strategy B: append `--port XXXX` or `-p XXXX` to command args
- [ ] Respect existing `.env` port values as starting point for conflict check
- [ ] Graceful fallback to `PORT` env var for unknown/non-Node projects
- [ ] `--save` flag: update `.env` file in place with the resolved port

### Framework Detection

```js
// framework.js — detect framework and return injection strategy
export function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  // env var strategies
  if (deps["vite"])
    return {
      name: "Vite",
      strategy: "env",
      portVar: "VITE_PORT",
      default: 5173,
    };
  if (deps["next"])
    return { name: "Next.js", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["react-scripts"])
    return { name: "CRA", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["nuxt"])
    return {
      name: "Nuxt",
      strategy: "env",
      portVar: "NUXT_PORT",
      default: 3000,
    };
  if (deps["@remix-run/node"])
    return { name: "Remix", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["@sveltejs/kit"])
    return {
      name: "SvelteKit",
      strategy: "env",
      portVar: "PORT",
      default: 5173,
    };

  // CLI flag strategies
  if (deps["@angular/core"])
    return { name: "Angular", strategy: "flag", flag: "--port", default: 4200 };
  if (deps["webpack"])
    return { name: "Webpack", strategy: "flag", flag: "--port", default: 8080 };

  // generic fallback — works for Express, Fastify, plain Node, Django, Go...
  return { name: "Generic", strategy: "env", portVar: "PORT", default: 3000 };
}

// runner.js — apply strategy when spawning
export function buildEnvAndArgs(command, args, port, framework) {
  if (framework.strategy === "flag") {
    return { env: process.env, args: [...args, framework.flag, String(port)] };
  }
  return { env: { ...process.env, [framework.portVar]: String(port) }, args };
}
```

### Real World Scenario — Frontend + Backend Together

```bash
# Terminal 1 — backend already on 5000
npx port-lister node server.js
# ✅ Port 5000 free → starting normally

# Terminal 2 — someone grabbed 3000
npx port-lister vite
# ⚠  Port 3000 in use → node (pid 4521)
# ✅ Starting Vite on port 3002 (injected VITE_PORT=3002)
# 🚀 http://localhost:3002

# Later
npx port-lister --history
# 5000 → api-server     1h ago  ● still running
# 3002 → dashboard-app  1h ago  ● still running
# 3000 → my-blog        3h ago  ○ stopped
```

---

## Phase 4 — Port History

**Timeline: Week 2–3**

### Goals

Automatically remember which project used which port, when it was last active, and whether it is still running — stored in a local JSON file, never sent anywhere.

### Usage

```bash
npx port-lister --history
# PORT   PROJECT          LAST USED        STATUS
# 3000   my-blog          2h ago           ● still running
# 5173   dashboard-app    yesterday        ○ stopped
# 8080   api-server       3 days ago       ○ stopped

npx port-lister --history --json
npx port-lister --history --clear
npx port-lister --history --forget 8080
```

### How It Works

Every time `port-lister` starts a project, it appends an entry to `~/.port-lister/history.json`. On each `port-lister` read, it cross-references the stored PIDs against live system processes to determine if a project is still running.

```
port-lister starts project
        ↓
Write entry to ~/.port-lister/history.json
{ port, project, pid, cwd, startedAt }
        ↓
npx port-lister --history reads file
        ↓
Check each PID → still alive?
        ↓
Print table with status + relative time
```

### Storage Format

```json
// ~/.port-lister/history.json
[
  {
    "port": 3000,
    "project": "my-blog",
    "cwd": "/Users/dev/projects/my-blog",
    "pid": 4521,
    "startedAt": "2024-03-12T10:30:00Z",
    "lastSeenAt": "2024-03-12T12:45:00Z"
  },
  {
    "port": 5173,
    "project": "dashboard-app",
    "cwd": "/Users/dev/projects/dashboard-app",
    "pid": 8823,
    "startedAt": "2024-03-11T09:00:00Z",
    "lastSeenAt": "2024-03-11T18:00:00Z"
  }
]
```

### Project Name Detection

Project name is resolved in this priority order:

| Priority | Source                               | Example           |
| -------- | ------------------------------------ | ----------------- |
| 1        | `package.json` → `name` field        | `"my-blog"`       |
| 2        | `package.json` → `name` (parent dir) | `"dashboard-app"` |
| 3        | Current working directory name       | `"api-server"`    |

### Core Logic

```js
// store.js — read/write ~/.port-lister/history.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STORE_DIR = join(homedir(), ".port-lister");
const STORE_FILE = join(STORE_DIR, "history.json");

export function readHistory() {
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function writeEntry(entry) {
  mkdirSync(STORE_DIR, { recursive: true });
  const history = readHistory().filter((e) => e.port !== entry.port);
  writeFileSync(STORE_FILE, JSON.stringify([entry, ...history], null, 2));
}
```

```js
// history.js — check if a recorded PID is still alive
import { execSync } from "node:child_process";

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // signal 0 = existence check only
    return true;
  } catch {
    return false;
  }
}

export function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
```

### Tasks

- [ ] `store.js` — read/write `~/.port-lister/history.json` using `node:fs`
- [ ] Auto-write an entry every time `port-lister` successfully starts a project
- [ ] `history.js` — resolve project name from `package.json` or directory name
- [ ] `isProcessAlive(pid)` — use `process.kill(pid, 0)` for cross-platform alive check
- [ ] `relativeTime()` — human-readable time since last use
- [ ] `bin/port-lister.js` — `--history` sub-command that prints the formatted table
- [ ] `--history --json` flag — output raw JSON for scripting
- [ ] `--history --clear` flag — wipe entire history file
- [ ] `--history --forget <port>` flag — remove a single port entry
- [ ] Deduplicate entries — keep only the most recent entry per port
- [ ] Cap history at 50 entries to keep file size small

### Integration with port-lister

```js
// runner.js — write history entry after successful spawn
import { writeEntry } from "./store.js";
import { detectProjectName } from "./history.js";

export function run(command, args, port) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
    shell: true,
  });

  // record to history once process starts
  writeEntry({
    port,
    project: detectProjectName(process.cwd()),
    cwd: process.cwd(),
    pid: child.pid,
    startedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });

  process.on("SIGINT", () => child.kill("SIGINT"));
  return child;
}
```

---

## Phase 5 — Polish, Tests & Publish

**Timeline: Week 3**

### Goals

Production-ready package with tests, cross-platform CI, and published to npm.

### Tasks

- [ ] Unit tests for `detect`, `finder`, `whohas`, `framework`, `history`, `store` — mock `net`, `child_process`, `fs`
- [ ] Integration test: spawn a real Express server + Vite app, verify both conflict resolution and history recording
- [ ] Test all 3 injection strategies (env var, CLI flag, fallback) across frameworks
- [ ] Cross-platform CI via GitHub Actions (ubuntu, macos, windows)
- [ ] README with animated terminal GIF showing the full flow
- [ ] Programmatic API fully documented with JSDoc
- [ ] `package.json` — set `files` whitelist, `keywords`, provenance
- [ ] Publish to npm with `npm publish --provenance`

### Programmatic API

```js
import {
  findFreePort,
  whoHasPort,
  detectFramework,
  autoPort,
  portHistory,
} from "port-lister";

// find next free port starting from 3000
const port = await findFreePort(3000);
// → 3001

// find what process is on a port
const proc = await whoHasPort(3000);
// → { pid: 4521, name: 'node', cmd: 'node server.js' }

// detect framework from cwd
const fw = detectFramework(pkg);
// → { name: 'Vite', strategy: 'env', portVar: 'VITE_PORT', default: 5173 }

// read port history
const history = portHistory.read();
// → [{ port: 3000, project: 'my-blog', lastSeenAt: '...', alive: true }, ...]

// full auto — detect framework, resolve port, inject correctly, spawn, record history
await autoPort("npm run dev", { port: 3000 });
```

### CI Matrix

```yaml
# .github/workflows/ci.yml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: [18, 20, 22]
```

---

## Package Configuration

```json
{
  "name": "port-lister",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "port-lister": "./bin/port-lister.js"
  },
  "files": ["src", "bin"],
  "keywords": [
    "port",
    "conflict",
    "history",
    "cli",
    "dev",
    "localhost",
    "frontend",
    "backend",
    "vite",
    "express"
  ],
  "engines": { "node": ">=18" }
}
```

---

## Milestones

| Milestone                                 | Target        |
| ----------------------------------------- | ------------- |
| Core engine working locally               | End of Week 1 |
| CLI usable with `npx`                     | End of Week 1 |
| All frontend frameworks supported         | End of Week 2 |
| All backend frameworks supported          | End of Week 2 |
| `port-lister` recording & display working | End of Week 2 |
| All tests passing on 3 platforms          | End of Week 3 |
| Published to npm                          | End of Week 3 |

---

## Future Ideas (Post v1)

- `port-lister list` — show all ports currently in use across your machine
- VS Code extension — highlight port conflicts inline in terminal
- Config file support (`.portlisterrc`) — set preferred port ranges per project
- Proxy mode — forward traffic from old port to new port transparently
- `port-lister --watch` — live updating view of active dev servers
- Dashboard: browser UI showing all running dev servers from history
