import { describe, it, expect, vi, beforeEach } from "vitest";
import net from "node:net";

vi.mock("node:net", () => {
  const EventEmitter = require("node:events");
  return {
    default: {
      createServer: vi.fn(),
    },
  };
});

// Re-import after mock
const { isPortBusy } = await import("../src/detect.js");

describe("isPortBusy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves true when port is busy (EADDRINUSE)", async () => {
    net.createServer.mockReturnValue({
      once: function (event, cb) {
        if (event === "error")
          setTimeout(
            () => cb(Object.assign(new Error(), { code: "EADDRINUSE" })),
            0,
          );
        return this;
      },
      listen: vi.fn(),
    });
    expect(await isPortBusy(3000)).toBe(true);
  });

  it("resolves false when port is free", async () => {
    const serverMock = {
      once: function (event, cb) {
        if (event === "listening") setTimeout(() => cb(), 0);
        return this;
      },
      close: vi.fn((cb) => cb?.()),
      listen: vi.fn(),
    };
    net.createServer.mockReturnValue(serverMock);
    expect(await isPortBusy(3001)).toBe(false);
  });
});
