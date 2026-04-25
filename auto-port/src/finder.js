import { isPortBusy } from "./detect.js";

export async function findFreePort(start, max = 20) {
  for (let port = start; port <= start + max; port++) {
    if (!(await isPortBusy(port))) return port;
  }
  throw new Error(`No free port found in range ${start}–${start + max}`);
}
