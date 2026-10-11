/**
 * The ERAS a level and its cast are drawn in: a LOOK, the light and surface conventions of a console generation, never
 * its screen. Every era is drawn at the resolution the game is exported to (target.js sets how dense that makes the
 * polygons); `gen-6` is the sixth generation's principles at today's resolution, directionally right, not a 640×448
 * CRT frame. A level's era is its geocube's; a hero in the cube takes it.
 *
 * Each era `extends` the one before and adds its conventions. Every convention carries a status (`built`: mojulo makes
 * it today; `planned`: named so a readout can say it is missing, never claimed). `world` is the world side's status in
 * the cosmos reality facet's terms (built | partial | absent). Data, not code paths.
 */
export const ERAS = Object.freeze({
  'gen-6': Object.freeze({
    reads: 'the sixth generation (PS2, GameCube, Xbox), drawn at today\'s resolution', extends: null,
    world: Object.freeze({ status: 'built', lowers: 'lib/graph/era/sixth-gen.js', note: 'baked vertex light, painted tiles, exp fog' }),
    cast: Object.freeze({
      light: 'baked-plus-rim',
      conventions: Object.freeze([
        { id: 'silhouette-and-value', line: 'The silhouette and three values carry the figure; the rings go where the outline turns.', status: 'built' },
        { id: 'light-in-the-vertex', line: 'The light is baked into vertex colour: the cube\'s key and its tinted ambient, never black.', status: 'built' },
        { id: 'rim-from-the-air', line: 'A rim in the cube\'s sky colour parts the figure from the level behind it.', status: 'built' },
      ]),
    }),
  }),
  'gen-7': Object.freeze({
    reads: 'the seventh generation (360, PS3: Halo 3, Skyrim)', extends: 'gen-6',
    world: Object.freeze({ status: 'absent', note: 'planned: normal maps, live sun, HDR, SSAO, IBL, height fog' }),
    cast: Object.freeze({
      light: 'live-key-over-baked-indirect',
      conventions: Object.freeze([
        { id: 'relief-in-normal', line: 'Seams, folds and plate edges live in a normal map baked from the figure\'s own field.', status: 'planned' },
        { id: 'albedo-unlit', line: 'Vertex colour holds the material\'s colour and its cavity only; the light is live.', status: 'planned' },
        { id: 'material-by-response', line: 'Skin, cloth, metal and visor are told apart by how they reflect, each its own material.', status: 'planned' },
        { id: 'hair-cards', line: 'Hair as alpha cards over a scalp cap.', status: 'planned' },
      ]),
    }),
  }),
});

export const ERA_IDS = Object.freeze(Object.keys(ERAS));
export const DEFAULT_ERA = 'gen-6';

/** Error text for an era id, or null when it is one. */
export function eraError(id, at = 'era') {
  return ERAS[id] ? null : `${at} '${id}' is not an era (${ERA_IDS.join(', ')}); how dense it is drawn is the target's (resolution, framing)`;
}

/** An era's cast conventions through its `extends` chain, oldest first. */
export function eraCastConventions(id) {
  const e = ERAS[id];
  return [...(e.extends ? eraCastConventions(e.extends) : []), ...e.cast.conventions];
}
