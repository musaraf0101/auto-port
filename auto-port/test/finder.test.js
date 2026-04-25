import { describe, it, expect, vi } from "vitest";

vi.mock("../src/detect.js", () => ({
  isPortBusy: vi.fn(),
}));

const { isPortBusy } = await import("../src/detect.js");
const { findFreePort } = await import("../src/finder.js");

describe("findFreePort", () => {
  it("returns start port when it is free", async () => {
    isPortBusy.mockResolvedValue(false);
    expect(await findFreePort(3000)).toBe(3000);
  });

  it("skips busy ports and returns the next free one", async () => {
    isPortBusy
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    expect(await findFreePort(3000)).toBe(3002);
  });

  it("throws when all ports in range are busy", async () => {
    isPortBusy.mockResolvedValue(true);
    await expect(findFreePort(3000, 2)).rejects.toThrow("No free port found");
  });
});
