import { readFileSync } from "node:fs";
import { join } from "node:path";

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function detectProjectName(cwd) {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
    if (pkg.name) return pkg.name;
  } catch {
    /* fall through */
  }
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? "unknown";
}
