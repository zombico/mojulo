// content-pack.js — the one way core reaches an operator-local content pack (the gitignored
// `lib/graph/mobile-suit/` tree; archive-mobile-suit/install.mjs puts it there). No release
// carries a pack, so ABSENT is the normal state and stays silent; a pack that is present but fails
// to load is a real break and says so.
//
// `load` must wrap a LITERAL `import('../mobile-suit/x.js')` at the call site: webpack resolves
// literal specifiers for the dashboard build and cannot follow a computed one. `target` is the
// pack-relative tail (`mobile-suit/x.js`) used to tell "the pack file is missing" apart from "the
// pack file is here but something IT imports is missing" — the latter warns.

function missingSpecifier(err) {
  if (err?.code !== 'ERR_MODULE_NOT_FOUND' && err?.code !== 'MODULE_NOT_FOUND') return null;
  if (typeof err.url === 'string') return err.url;                 // Node ESM: the missing module's URL
  const m = /Cannot find module '([^']+)'/.exec(String(err.message)); // webpack / CJS: the first quoted path
  return m ? m[1] : null;
}

export function isAbsentPackModule(err, target) {
  const missing = missingSpecifier(err);
  return !!missing && missing.replace(/\\/g, '/').endsWith(target);
}

export async function optionalPackModule(load, target, label) {
  try {
    return await load();
  } catch (err) {
    if (!isAbsentPackModule(err, target)) {
      console.error(`${label}: content pack present but ${target} failed to load:`, err?.message);
    }
    return null;
  }
}
