/**
 * Heavy dependencies, loaded on first use — the door for packages the stdio boot never loads.
 *
 * A host spawns `npx mojulo` and waits for MCP `initialize` under its own startup timeout (Claude
 * Code: 30 s, and a stdio server gets no retry). Tool registration imports every tool module, so a
 * package imported at module scope anywhere on that path loads on every boot, whether or not a call
 * ever needs it. These do not load at boot:
 *   - puppeteer-core — the scene/World PNG bakers and World frame capture (lib/graph/scene/chromium.js)
 *   - archiver — zip bundles (export_model `bundle`) and bot artifacts (lib/deployers/docker.js)
 *   - pdf2json, officeparser — document ingest (lib/document-parser.js)
 *   - react, react-dom — the diagram SVG renderer (lib/sketch-svg.js)
 * Each caller loads its package through `lazyDependency` on the first call that needs it. A package
 * that cannot load becomes a DependencyUnavailableError on that one call; the kernel, the CLI and every
 * other tool stay up. scripts/mcp-stdio.boot-guard.test.js boots the stdio server with these
 * packages unresolvable and asserts the same tool list, so a static import cannot creep back in.
 *
 * Callers pass their own literal `() => import('x')`: the Next build must still see the specifier
 * (serverExternalPackages keeps it a runtime require in the standalone dashboard). `sharp` has its
 * own door, lib/sharp-lazy.js.
 */

export class DependencyUnavailableError extends Error {
  constructor(name, purpose, cause) {
    super(
      `${name} (${purpose}) could not be loaded on this host: ${cause?.message || cause}. `
        + 'It ships as a dependency of the mojulo package, so this install is incomplete; reinstall mojulo '
        + '(a fresh `npx -y mojulo`, or `npm install` in the package directory) and retry. '
        + 'Tools that do not need it keep working.',
    );
    this.name = 'DependencyUnavailableError';
    this.code = 'DEPENDENCY_UNAVAILABLE';
    this.dependency = name;
    this.cause = cause;
  }
}

/**
 * Wrap a dynamic import so it runs once, on first use. A failed load is not cached: a later
 * install may fix it without a restart.
 *
 * @param {string} name — the package, as the error names it
 * @param {() => Promise<any>} importer — `() => import('pkg')`, literal so bundlers see it
 * @param {string} purpose — what the package is for, in a few words
 * @returns {() => Promise<any>} a loader resolving to whatever `importer` resolves to
 */
export function lazyDependency(name, importer, purpose) {
  let loading = null;
  return function load() {
    if (!loading) {
      loading = importer().catch((err) => {
        loading = null;
        throw new DependencyUnavailableError(name, purpose, err);
      });
    }
    return loading;
  };
}
