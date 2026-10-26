/**
 * The ERAS a level and its cast are drawn in: a LOOK, the light and surface conventions of a console generation, never
 * its screen. Every era is drawn at the resolution the game is exported to (target.js sets how dense that makes the
 * polygons); `gen-6` is the sixth generation's principles at today's resolution, directionally right, not a 640×448
 * CRT frame. A level's era is its geocube's; a hero in the cube takes it.
 *
 * Each era `extends` the one before and adds its conventions. Every convention carries a status (`built`: mojulo makes
 * it today; `partial`: made for part of the cast, its `note` says which; `planned`: named so a readout can say it is
 * missing, never claimed). `world` is the world side's status in
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
    // partial: naming the era turns the live light on (scene/live-light.js liveLightDefaults), each piece the recipe's own
    // where it says, all of it under the quality tier. The sun does not move, live or within a level: a level is lit at
    // one hour, so a moving sun is not planned here
    world: Object.freeze({ status: 'partial', lowers: 'lib/graph/scene/live-light.js', note: 'on when a world\'s geocube names it: actor shadows over the baked sun, the hour\'s shadow map (drawn once at load: the sun does not move), contact occlusion (SSAO), each the recipe\'s to turn off and all under the quality tier (light.tier, by the screen: a phone takes half, without occlusion); planned: lightmaps and light probes, normal maps on the world, HDR, IBL, height fog' }),
    cast: Object.freeze({
      light: 'live-key-over-baked-indirect',
      conventions: Object.freeze([
        // partial: the realistic hero's one-skin head, on the lit engine export (epidermis/dermal-relief.js)
        { id: 'relief-in-normal', line: 'Seams, folds and plate edges live in a normal map baked from the figure\'s own field.', status: 'partial', note: 'built for the realistic hero\'s head (its one skin and ears, minted under realistic laws 5) on the lit engine export; planned: its body, hands and armour, the game body and the anime heads, and the World page (its fills are unlit)' },
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
