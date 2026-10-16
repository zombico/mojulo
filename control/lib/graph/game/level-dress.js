/**
 * level-dress — is a game level a bare greybox? An advisory read for create_game: it flags, never refuses.
 *
 * THE RULE. A level is UNDRESSED when its stored manifest (a `mapRef` level read over its map, as world-scene.js
 * inflates it) is all three:
 *   1. kind `controllable`, the bare stage kind (worlds/controllable-world.js#assembleControllableScene);
 *   2. on the DEFAULT GROUND: no `faces` of its own, so the stage lays its stock checkerboard (`defaultGround`;
 *      `ground` only resizes or recolours that checkerboard);
 *   3. with only PLAIN SHAPES for bodies: every entity's body is `type: 'mesh'` (the emitter's box or sphere), `none`,
 *      or absent; no `figure-rig` / `figure-frames` / `polygomer` (or any other) body.
 * Every other kind (a stage, city, roadway, airspace, building, terrain…) brings its own ground and set, so it is never
 * flagged. Plain Node, pure: the caller passes the row lookup.
 */
import { applyMapRef } from '../worlds/map-ref.js';

const PLAIN_BODIES = new Set(['mesh', 'none']);

/** The manifest a level bakes from: a controllable level's `mapRef` spread under it (map-ref.js), else as stored. */
function bakedManifest(manifest, getSketch) {
  if (manifest?.kind !== 'controllable' || typeof manifest.mapRef !== 'string' || !getSketch) return manifest;
  const map = getSketch(manifest.mapRef)?.manifest;
  return map && map.kind === 'controllable' ? applyMapRef(manifest, map) : manifest;
}

/** → null for a dressed level, else { why } naming what made it a greybox. */
export function undressedLevel(manifest, { getSketch } = {}) {
  const m = bakedManifest(manifest, getSketch);
  if (!m || m.kind !== 'controllable') return null;
  if (Array.isArray(m.faces) && m.faces.length) return null;
  const bodies = (Array.isArray(m.entities) ? m.entities : []).map((e) => e?.body?.type ?? 'none');
  if (bodies.some((t) => !PLAIN_BODIES.has(t))) return null;
  return {
    why: bodies.length
      ? `its ${bodies.length === 1 ? 'one body is a plain box/sphere' : `${bodies.length} bodies are all plain boxes/spheres`} on the default checkerboard ground`
      : 'it is the default checkerboard ground with no bodies on it',
  };
}

/** The readout for a game's levels: null when none is undressed. */
export function undressedReadout(levelRefs, getSketch) {
  const levels = [];
  for (const ref of levelRefs) {
    const u = undressedLevel(getSketch(ref)?.manifest, { getSketch });
    if (u) levels.push({ level: ref, why: u.why });
  }
  return levels.length ? {
    levels,
    note: 'advice, not a refusal: the game was minted. These levels are greyboxes (a `controllable` world, plain mesh bodies, no ground of its own).',
    next: "design_game makes levels the game rail dresses (stage, city, roadway or airspace ground, set dressing, the hero's figure): "
      + "design_game({ compose: { prompt: '<the game in words>' }, run: true }). Or dress this world in place with update_sketch: "
      + "its own `faces` for ground, a `figure-rig` body for the hero. Read get_game_vocab({ id: 'gameworld-guide' }).",
  } : null;
}
