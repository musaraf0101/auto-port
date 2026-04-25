#!/usr/bin/env node
import { readHistory, clearHistory, forgetPort } from "../src/store.js";
import { isProcessAlive, relativeTime } from "../src/history.js";

const args = process.argv.slice(2);

if (args.includes("--clear")) {
  clearHistory();
  console.log("Port history cleared.");
  process.exit(0);
}

if (args.includes("--forget")) {
  const idx = args.indexOf("--forget");
  const port = parseInt(args[idx + 1], 10);
  if (!port) {
    console.error("Usage: port-history --forget <port>");
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

if (args.includes("--json")) {
  console.log(JSON.stringify(enriched, null, 2));
  process.exit(0);
}

// Compute column widths
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
