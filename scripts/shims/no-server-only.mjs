// Test-only: neutralise the `server-only` / `client-only` import guards so
// trusted Node scripts can import app modules that use them. NOT used by the
// app build — only via `tsx --import` in package.json test scripts.
//
// tsx compiles TS to CJS, so the guard is loaded via require() — patch both the
// CJS resolver and the ESM loader.
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

const SHIMMED = new Set(["server-only", "client-only"]);
const emptyPath = fileURLToPath(new URL("./empty.cjs", import.meta.url));

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (SHIMMED.has(request)) return emptyPath;
  return origResolve.call(this, request, ...rest);
};

const hook = `
export async function resolve(specifier, context, next) {
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: ${JSON.stringify(new URL("./empty.cjs", import.meta.url).href)}, shortCircuit: true };
  }
  return next(specifier, context);
}
`;
register("data:text/javascript," + encodeURIComponent(hook), import.meta.url);
