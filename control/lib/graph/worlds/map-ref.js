/**
 * map-ref — manifest-level terrain inheritance: the world twin of the figures-map `unitRef`.
 *
 * A stored LEVEL manifest may carry `mapRef: '<sk_…>'` instead of a clone of its map's terrain.
 * world-scene.js resolves the ref at bake time and calls applyMapRef to re-inflate: the stored MAP
 * manifest spreads underneath and the level's own keys win on top. So a mode-variant level (see
 * mobile-suit/arena-modes.js) stores only the mode's OUTPUT — entities/match/game/camera/figures —
 * and the terrain (faces/colliders/lighting/arena hints) lives once, on the map row, shared by
 * every mode variant. Same doctrine as unitRef: recipes stay tiny, resolution happens at bake.
 *
 * Merge semantics (deliberately spread-simple, no per-key knowledge):
 *   - level key present  → level wins, wholesale (a level's `figures` REPLACES the map's — it was
 *     derived from it at mint with treatments applied; no deep merge).
 *   - level key absent   → the map's value is inherited.
 *   - level key === null → TOMBSTONE: the inherited key is DELETED and the null dropped — how a
 *     level suppresses a key its builder removed from the map clone (the map's pinned `ai:'off'`
 *     must not resurrect on a live level; a spectate level must shed the map's `pilot`).
 *
 * Pure and synchronous — the caller loads the map row (and validates kind) itself.
 */

export function applyMapRef(level, map) {
  const { mapRef, ...own } = level;
  const merged = { ...map, ...own };
  for (const [k, v] of Object.entries(own)) if (v === null) delete merged[k];
  return merged;
}
