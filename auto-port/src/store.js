import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const STORE_DIR = join(homedir(), ".auto-port");
const STORE_FILE = join(STORE_DIR, "history.json");
const MAX_ENTRIES = 50;

export function readHistory() {
  try {
    return JSON.parse(readFileSync(STORE_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function writeEntry(entry) {
  mkdirSync(STORE_DIR, { recursive: true });
  const history = readHistory()
    .filter((e) => e.port !== entry.port)
    .slice(0, MAX_ENTRIES - 1);
  writeFileSync(STORE_FILE, JSON.stringify([entry, ...history], null, 2));
}

export function clearHistory() {
  mkdirSync(STORE_DIR, { recursive: true });
  writeFileSync(STORE_FILE, "[]");
}

export function forgetPort(port) {
  mkdirSync(STORE_DIR, { recursive: true });
  const history = readHistory().filter((e) => e.port !== port);
  writeFileSync(STORE_FILE, JSON.stringify(history, null, 2));
}
