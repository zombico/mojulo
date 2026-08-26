/**
 * recipe-book registry — the LEAF state module for the attached recipe book
 * (recipe-book.plan.md, Door 2). Deliberately imports NOTHING so that sync,
 * widely-imported consumers (sketch-manifest's sketchRenderMode, create_view's
 * kind enum) can read the loaded snapshot without any risk of an import cycle.
 *
 * The loader (./loader.js) owns all fs / dynamic-import / handshake logic and
 * populates this snapshot exactly once per process via setBookSnapshot. Until
 * it runs, every reader sees the empty state — which is byte-for-byte today's
 * no-book behavior. The MCP init path (ensureToolsRegistered) and the /world
 * route's kind-miss path both await the loader, so in practice the snapshot is
 * warm before any book artifact is minted or rendered.
 */

const EMPTY = () => ({
  loaded: false,
  // create_view kind id → { id, manifestKind, family, title, plan, assemble }
  kinds: new Map(),
  // stored manifest kind → { title, resolve } (the WORLD_KINDS row shape)
  worldKinds: new Map(),
  // stored manifest kinds that render as 'world' (sketchRenderMode)
  renderKinds: new Set(),
  // parsed card objects (view-vocab card shape + { source: 'recipe-book' })
  cards: [],
  // human-readable load warnings (skipped entries, version skew) — surfaced
  // to the operator/agent by the loader's consumers.
  warnings: [],
});

let state = EMPTY();

export function setBookSnapshot(next) {
  state = { ...EMPTY(), ...next, loaded: true };
}

export function bookLoaded() { return state.loaded; }
export function bookViewKinds() { return state.kinds; }
export function bookWorldKind(manifestKind) { return state.worldKinds.get(manifestKind) ?? null; }
export function isBookRenderKind(manifestKind) { return state.renderKinds.has(manifestKind); }
export function bookCards() { return state.cards; }
export function bookWarnings() { return state.warnings; }

// Test seam.
export function _resetBookRegistry() { state = EMPTY(); }
