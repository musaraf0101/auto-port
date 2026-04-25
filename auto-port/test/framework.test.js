import { describe, it, expect } from "vitest";
import { detectFramework, buildEnvAndArgs } from "../src/framework.js";

describe("detectFramework", () => {
  const pkg = (deps) => ({ dependencies: deps, devDependencies: {} });

  it("detects Vite", () => {
    expect(detectFramework(pkg({ vite: "5.0.0" }))).toMatchObject({
      name: "Vite",
      portVar: "VITE_PORT",
    });
  });

  it("detects Next.js", () => {
    expect(detectFramework(pkg({ next: "14.0.0" }))).toMatchObject({
      name: "Next.js",
      portVar: "PORT",
    });
  });

  it("detects Angular (CLI flag strategy)", () => {
    expect(detectFramework(pkg({ "@angular/core": "17.0.0" }))).toMatchObject({
      strategy: "flag",
      flag: "--port",
    });
  });

  it("returns Generic fallback for unknown deps", () => {
    expect(detectFramework(pkg({}))).toMatchObject({
      name: "Generic",
      portVar: "PORT",
    });
  });
});

describe("buildEnvAndArgs", () => {
  it("injects env var for env strategy", () => {
    const fw = { strategy: "env", portVar: "PORT" };
    const { env, args } = buildEnvAndArgs(["dev"], 3001, fw);
    expect(env.PORT).toBe("3001");
    expect(args).toEqual(["dev"]);
  });

  it("appends CLI flag for flag strategy", () => {
    const fw = { strategy: "flag", flag: "--port" };
    const { args } = buildEnvAndArgs(["serve"], 4201, fw);
    expect(args).toEqual(["serve", "--port", "4201"]);
  });
});
