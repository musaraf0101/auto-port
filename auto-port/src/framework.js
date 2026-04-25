import { readFileSync } from "node:fs";
import { join } from "node:path";

export function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps["vite"])
    return {
      name: "Vite",
      strategy: "env",
      portVar: "VITE_PORT",
      default: 5173,
    };
  if (deps["next"])
    return { name: "Next.js", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["react-scripts"])
    return { name: "CRA", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["nuxt"])
    return {
      name: "Nuxt",
      strategy: "env",
      portVar: "NUXT_PORT",
      default: 3000,
    };
  if (deps["@remix-run/node"])
    return { name: "Remix", strategy: "env", portVar: "PORT", default: 3000 };
  if (deps["@sveltejs/kit"])
    return {
      name: "SvelteKit",
      strategy: "env",
      portVar: "PORT",
      default: 5173,
    };
  if (deps["@angular/core"])
    return { name: "Angular", strategy: "flag", flag: "--port", default: 4200 };
  if (deps["webpack"])
    return { name: "Webpack", strategy: "flag", flag: "--port", default: 8080 };

  return { name: "Generic", strategy: "env", portVar: "PORT", default: 3000 };
}

export function loadPackageJson(cwd) {
  try {
    const raw = readFileSync(join(cwd, "package.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function buildEnvAndArgs(args, port, framework) {
  if (framework.strategy === "flag") {
    return { env: process.env, args: [...args, framework.flag, String(port)] };
  }
  return { env: { ...process.env, [framework.portVar]: String(port) }, args };
}
