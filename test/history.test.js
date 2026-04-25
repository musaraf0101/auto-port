import { describe, it, expect, vi } from "vitest";

vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));

import {
  isProcessAlive,
  relativeTime,
  detectProjectName,
} from "../src/history.js";
import { readFileSync } from "node:fs";

describe("isProcessAlive", () => {
  it("returns true when process.kill(pid, 0) succeeds", () => {
    vi.spyOn(process, "kill").mockImplementation(() => true);
    expect(isProcessAlive(1234)).toBe(true);
    process.kill.mockRestore();
  });

  it("returns false when process.kill throws", () => {
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("ESRCH");
    });
    expect(isProcessAlive(9999)).toBe(false);
    process.kill.mockRestore();
  });
});

describe("relativeTime", () => {
  it('returns "just now" for < 1 minute', () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it("returns Xm ago for minutes", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("5m ago");
  });

  it("returns Xh ago for hours", () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(relativeTime(iso)).toBe("3h ago");
  });

  it("returns Xd ago for days", () => {
    const iso = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(relativeTime(iso)).toBe("2d ago");
  });
});

describe("detectProjectName", () => {
  it("returns package.json name when available", () => {
    readFileSync.mockReturnValue(JSON.stringify({ name: "my-blog" }));
    expect(detectProjectName("/projects/my-blog")).toBe("my-blog");
  });

  it("falls back to directory name when package.json missing", () => {
    readFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    expect(detectProjectName("/projects/api-server")).toBe("api-server");
  });
});
