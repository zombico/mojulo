/**
 * Test helper (not shipped): make packages unresolvable in a child Node process, as if they
 * were not installed. Load it with `node --require <this file>` and list the packages in
 * MOJULO_BLOCK_MODULES (comma-separated; a name also blocks its subpaths, `react` blocks
 * `react/jsx-runtime`).
 *
 * `--require` preloads run in every thread, including the module.register hooks thread where
 * scripts/mcp-stdio-loader.mjs requires @swc/core, so the CommonJS patch below covers that
 * require too. ESM imports on the main thread are blocked by a resolve hook registered here,
 * before the stdio entry registers its own loader. Every blocked attempt is written to stderr
 * as `[boot-guard] blocked <specifier> <- <parent>`, so a test can assert none happened.
 */

const Module = require('node:module');
const { isMainThread } = require('node:worker_threads');

const blocked = (process.env.MOJULO_BLOCK_MODULES || '').split(',').map((s) => s.trim()).filter(Boolean);
const isBlocked = (spec) => typeof spec === 'string' && blocked.some((b) => spec === b || spec.startsWith(`${b}/`));

if (blocked.length) {
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function guardedResolveFilename(request, parent, ...rest) {
    if (isBlocked(request)) {
      process._rawDebug(`[boot-guard] blocked ${request} <- ${parent?.filename ?? '?'}`);
      const err = new Error(`Cannot find module '${request}' (made unresolvable by boot-guard-hook.cjs)`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    return resolveFilename.call(this, request, parent, ...rest);
  };

  if (isMainThread) {
    const hook = `
      const blocked = ${JSON.stringify(blocked)};
      export async function resolve(specifier, context, nextResolve) {
        if (blocked.some((b) => specifier === b || specifier.startsWith(b + '/'))) {
          process._rawDebug('[boot-guard] blocked ' + specifier + ' <- ' + (context.parentURL ?? '?'));
          const err = new Error("Cannot find package '" + specifier + "' (made unresolvable by boot-guard-hook.cjs)");
          err.code = 'ERR_MODULE_NOT_FOUND';
          throw err;
        }
        return nextResolve(specifier, context);
      }`;
    Module.register(`data:text/javascript,${encodeURIComponent(hook)}`);
  }
}
