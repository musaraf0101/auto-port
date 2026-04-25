# port-lister

> npm package · fully local · zero runtime dependencies

Automatically detects port conflicts and starts your app on the next available port — no manual `PORT=3001` juggling, no killing other processes. Works with **any frontend or backend framework** by wrapping any command and injecting the correct port variable.

```
⚠  Port 3000 in use → node (pid 4521)
✓  Finding next available port...
✅  Starting on port 3001
🚀  http://localhost:3001
```

---

## How It Works

1. **Detect** — checks if your target port is already bound using a TCP probe
2. **Identify** — looks up which process owns the busy port (`whohas`)
3. **Find** — scans upward from the next port until a free one is found
4. **Inject** — passes the resolved port to your command via the right mechanism for your framework (env var or CLI flag)
5. **Record** — writes the session (port, project name, PID) to `~/.port-lister/history.json`
6. **Spawn** — runs your original command with the corrected port, forwarding all output

---

## Requirements

- **Node.js >= 18**

---

## Installation

### Global install (recommended)

```bash
npm install -g port-lister
```

Then use it anywhere:

```bash
port-lister npm start
port-lister vite
port-lister node server.js
```

### Without installing (one-off)

```bash
npx port-lister <command>
```

### Local project install

```bash
npm install --save-dev port-lister
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "dev": "port-lister vite",
    "start": "port-lister node server.js"
  }
}
```

---

## CLI: `port-lister`

```
port-lister [options] <command> [command-args...]
port-lister --history [--json | --clear | --forget <port>]
```

### Options

| Flag            | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `--port <n>`    | Target port to start from (default: framework default or `3000`)  |
| `--range <a-b>` | Restrict the search to this port range (e.g. `3000-3010`)         |
| `--kill`        | Kill the conflicting process instead of shifting to the next port |
| `--quiet`       | Suppress port-lister output; only show your app's output          |
| `--save`        | Write the resolved port back to `.env`                            |
| `--history`     | Show port history (see [History](#history) section)               |
| `-h, --help`    | Show help                                                         |

### Examples

```bash
# Frontend frameworks
port-lister npm start                      # Create React App  (PORT=3001)
port-lister vite                           # Vite              (VITE_PORT=5174)
port-lister next dev                       # Next.js           (PORT=3001)
port-lister ng serve                       # Angular           (--port 4201)
port-lister npm run dev                    # SvelteKit / Nuxt / Remix

# Backend
port-lister node server.js                 # Express / plain Node
port-lister python manage.py runserver     # Django
port-lister go run main.go                 # Go

# With flags
port-lister --port 4000 yarn dev           # start search from 4000
port-lister --range 3000-3010 node app.js  # only consider ports 3000–3010
port-lister --kill npm run dev             # kill the owner of port 3000 instead of shifting
port-lister --quiet vite                   # hide port-lister banner
port-lister --save vite                    # write resolved port to .env
```

---

## History

Every time `port-lister` starts a process it records the port, project name, and PID to `~/.port-lister/history.json`. Use `--history` to inspect or manage that log.

```bash
port-lister --history
```

```
PORT   PROJECT          LAST USED    STATUS
---------------------------------------------
3000   my-blog          2h ago       ● still running
5173   dashboard-app    yesterday    ○ stopped
8080   api-server       3 days ago   ○ stopped
```

### Options

| Flag                        | Description                   |
| --------------------------- | ----------------------------- |
| `--history`                 | Show port history table       |
| `--history --json`          | Print history as JSON         |
| `--history --clear`         | Delete all history entries    |
| `--history --forget <port>` | Remove a single entry by port |

### Examples

```bash
port-lister --history                      # pretty table
port-lister --history --json               # machine-readable JSON
port-lister --history --clear              # wipe everything
port-lister --history --forget 8080        # remove the entry for port 8080
```

---

## Framework Support

`port-lister` auto-detects your framework from `package.json` and chooses the right injection strategy.

| Framework                      | Type       | Port injection      | Default port |
| ------------------------------ | ---------- | ------------------- | ------------ |
| Express / Fastify / plain Node | Backend    | `PORT` env var      | 3000         |
| Create React App               | Frontend   | `PORT` env var      | 3000         |
| Next.js                        | Full-stack | `PORT` env var      | 3000         |
| Remix                          | Full-stack | `PORT` env var      | 3000         |
| SvelteKit                      | Full-stack | `PORT` env var      | 5173         |
| Vite                           | Frontend   | `VITE_PORT` env var | 5173         |
| Nuxt                           | Full-stack | `NUXT_PORT` env var | 3000         |
| Angular                        | Frontend   | `--port` CLI flag   | 4200         |
| Webpack DevServer              | Frontend   | `--port` CLI flag   | 8080         |
| Django / Go / Rust / other     | Backend    | `PORT` env var      | 3000         |

---

## Programmatic API

Install as a dependency:

```bash
npm install port-lister
```

Import individual utilities or the high-level `autoPort` function:

```js
import {
  isPortBusy,
  findFreePort,
  whoHasPort,
  detectFramework,
  loadPackageJson,
  autoPort,
  portHistory,
} from "port-lister";
```

### `isPortBusy(port: number): Promise<boolean>`

Returns `true` if something is already listening on `port`.

```js
const busy = await isPortBusy(3000); // → true / false
```

### `findFreePort(startPort: number, maxOffset?: number): Promise<number>`

Scans from `startPort` upward and returns the first free port.

```js
const port = await findFreePort(3000); // → 3001
```

### `whoHasPort(port: number): { pid: number, name: string, cmd: string } | null`

Returns the process that owns `port`, or `null` if nothing is found.

```js
const proc = whoHasPort(3000);
// → { pid: 4521, name: 'node', cmd: 'node server.js' }
```

### `detectFramework(pkg: object): FrameworkInfo`

Inspects a parsed `package.json` object and returns framework metadata.

```js
const pkg = loadPackageJson(process.cwd());
const fw = detectFramework(pkg);
// → { name: 'Vite', strategy: 'env', portVar: 'VITE_PORT', default: 5173 }
```

### `autoPort(commandLine: string, options?: { port?: number }): Promise<ChildProcess>`

All-in-one: detects framework, resolves port, injects it correctly, spawns the process, and records history.

```js
const child = await autoPort("npm run dev", { port: 3000 });
child.on("exit", (code) => process.exit(code ?? 0));
```

### `portHistory.read(): HistoryEntry[]`

Returns all recorded sessions enriched with a live `alive` flag.

```js
const sessions = portHistory.read();
// [{ port: 3000, project: 'my-blog', pid: 4521, lastSeenAt: '...', alive: true }, ...]
```

---

## License

MIT
