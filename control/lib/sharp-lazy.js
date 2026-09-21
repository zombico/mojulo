/**
 * Lazy `sharp` — the one door every raster module walks through.
 *
 * `sharp` is a transitive dependency (the embedder's `@huggingface/transformers` pulls it in)
 * whose native half, `@img/sharp-<platform>`, is an OPTIONAL dependency. An
 * `npm install --omit=optional`, or a platform with no prebuilt libvips, leaves the JavaScript
 * half in place and makes its import throw `Could not load the "sharp" module`. Thirteen
 * modules on the tool-registration path used to import it statically, so a host in that state
 * could not even run `mojulo call version` (the 2026-09-21 Grok sandbox report). Every raster
 * call site now loads it here, on first use, so a missing `sharp` is an in-band error on the
 * one call that needed it and the kernel, the CLI, and every non-raster tool stay up.
 *
 * Bundler note: `sharp` is in next.config.mjs `serverExternalPackages`, so the dynamic import
 * stays a real runtime require in the standalone dashboard, exactly like the static one did.
 */

let sharpPromise = null;

export class SharpUnavailableError extends Error {
  constructor(cause) {
    super(
      `sharp (the image library) is not loadable on this host: ${cause?.message || cause}. `
        + 'Its native binary is an optional dependency that `npm install --omit=optional` leaves out; '
        + 'run `npm install sharp` in the package directory (or `mojulo install creative`) and retry. '
        + 'Recipes, exports, and every non-raster tool work without it.',
    );
    this.name = 'SharpUnavailableError';
    this.code = 'SHARP_UNAVAILABLE';
    this.cause = cause;
  }
}

/** Resolve to the `sharp` module's default export, loading it on the first call. */
export function loadSharp() {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((mod) => mod.default ?? mod)
      .catch((err) => {
        sharpPromise = null; // a later install may fix it; don't cache the failure
        throw new SharpUnavailableError(err);
      });
  }
  return sharpPromise;
}
