import { describe, it, expect, vi, beforeEach } from "vitest";
import * as child_process from "node:child_process";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

const { whoHasPort } = await import("../src/whohas.js");

describe("whoHasPort", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses lsof output on unix", () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });

    child_process.execSync.mockReturnValue(
      "COMMAND  PID USER   FD   TYPE\nnode    1234 dev   28u  IPv4\n",
    );

    const result = whoHasPort(3000);
    expect(result).toMatchObject({ pid: 1234, name: "node" });

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
  });

  it("returns null when execSync throws", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
    child_process.execSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(whoHasPort(9999)).toBeNull();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });
});
