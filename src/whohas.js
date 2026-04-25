import { execSync } from "node:child_process";

/**
 * Returns info about the process occupying a port, or null if none.
 * @returns {{ pid: number, name: string, cmd: string } | null}
 */
export function whoHasPort(port) {
  try {
    if (process.platform === "win32") {
      return parseWindows(port);
    }
    return parseUnix(port);
  } catch {
    return null;
  }
}

function parseUnix(port) {
  const out = execSync(`lsof -i :${port} -sTCP:LISTEN -n -P`, {
    encoding: "utf8",
  });
  const lines = out.trim().split("\n").slice(1);
  if (!lines.length || !lines[0].trim()) return null;
  const parts = lines[0].trim().split(/\s+/);
  const name = parts[0];
  const pid = parseInt(parts[1], 10);
  return { pid, name, cmd: name };
}

function parseWindows(port) {
  const out = execSync(`netstat -ano`, { encoding: "utf8" });
  const lines = out.split("\n");
  for (const line of lines) {
    const m = line.match(/TCP\s+[\d.]+:(\d+)\s+[\d.*]+\s+LISTENING\s+(\d+)/);
    if (m && parseInt(m[1], 10) === port) {
      const pid = parseInt(m[2], 10);
      const name = getWindowsProcessName(pid);
      return { pid, name, cmd: name };
    }
  }
  return null;
}

function getWindowsProcessName(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
    });
    const m = out.match(/"([^"]+)"/);
    return m ? m[1].replace(".exe", "") : String(pid);
  } catch {
    return String(pid);
  }
}
