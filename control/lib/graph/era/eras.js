/**
 * The ERAS a level and its cast are drawn in: a LOOK, the light and surface conventions of a console generation, never
 * its screen. Every era is drawn at the resolution the game is exported to (target.js sets how dense that makes the
 * polygons); `gen-6` is the sixth generation's principles at today's resolution, directionally right, not a 640×448
 * CRT frame. A level's era is its geocube's; a hero in the cube takes it.
 *
 * AN ERA IS A RENDER, not a property of the source: the same recipe read in `gen-6` or `gen-7` is two renders of one
 * world, the era a choice of the read and the export (worlds/world-scene.js `era`, as the engine is), the cube's own its
 * default. Each era names its SURFACE MODEL: `paint` (the light held in the colour: vertex light, painted tiles, ramp
 * stops, drawn unlit) or `form` (material and geometry, lit by the renderer). What each era gives each World page input
 * is its row in the era marks (era/era-marks.js).
 *
 * Each era `extends` the one before and adds its conventions. Every convention carries a status (`built`: mojulo makes
 * it today; `partial`: made for part of the cast, its `note` says which; `planned`: named so a readout can say it is
 * missing, never claimed). `world` is the world side's status in
 * the cosmos reality facet's terms (built | partial | absent). Data, not code paths.
 */
export const ERAS = Object.freeze({
  'gen-6': Object.freeze({
    reads: 'the sixth generation (PS2, GameCube, Xbox), drawn at today\'s resolution', extends: null,
    surface: 'paint',
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
    // the form render: a surface carries its material and its form, never light, and the renderer lights it. Built for a
    // room under no sun (form/room-form.js, form/room-light.js: its tiles as material, its light solved and baked); every
    // other surface a gen-7 read draws as paint under the live light (scene/live-light.js liveLightDefaults), and the era
    // marks name each one it does. The sun does not move, live or within a level: a level
    // is lit at one hour, so a moving sun is not planned here. (The live light over paint is gen-6's to opt into as well:
    // a recipe's `shadows` and `occlusion`, a hero's level's actor shadows.)
    surface: 'form',
    world: Object.freeze({ status: 'partial', lowers: 'lib/graph/scene/live-light.js', note: 'the form render (material and geometry, lit by the renderer) is built for a geocube\'s island and trail (form/land-read.js: its land as layered material under the cube\'s light) and for a glyph map a geocube paints (the same land read over its tiles, its plants grown as form, form/flora-read.js, and a range of real mountains round it as the form\'s far land, level/far-range.js; a map no cube paints is drawn as paint) and for a room under no sun (form/room-form.js: its tiles read as material, colour under no light, normal, occlusion, roughness and height; form/room-light.js: its light solved from its palette and baked apart from its colour with each lamp\'s shadow, the four lamps nearest the eye lighting its relief, its height marched near the eye), for a stage under a sun or a moon (the same bake with the sun beside its lamps, form/room-light.js solveDayLight) and, by day, for a town\'s buildings, a city\'s massing and the frontage its streets repeat (form/sun-light.js: each corner its base and the day\'s light, the sun\'s shadow the live light\'s; a detail tile read as the dressed cut it was painted from); elsewhere a gen-7 read (the read\'s or the export\'s `era`, or the cube\'s) draws each surface as paint under the live light, actor shadows, the hour\'s shadow map (drawn once at load: the sun does not move) and contact occlusion (SSAO) under the quality tier, and the era marks (era/era-marks.js) name every surface it draws so; planned: every other surface as material (a town and a city at night, a street\'s kit, its vehicles and its glass), the room under the cube\'s light, relief as geometry near the eye, lightmaps and light probes, HDR, IBL, height fog' }),
    cast: Object.freeze({
      light: 'live-key-over-baked-indirect',
      conventions: Object.freeze([
        // partial: the realistic hero's one-skin head, on the lit engine export (epidermis/dermal-relief.js)
        { id: 'relief-in-normal', line: 'Seams, folds and plate edges live in a normal map baked from the figure\'s own field.', status: 'partial', note: 'built for the realistic hero\'s head (its one skin and ears, minted under realistic laws 5) on the lit engine export; planned: its body, hands and armour, the game body and the anime heads, and the World page (its fills are unlit)' },
        // partial: the cast rig (color-theorist/cast-rig.js; the page's material, scene/channels/cast-rig.js)
        { id: 'albedo-unlit', line: 'Vertex colour holds the material\'s colour and its cavity only; the light is live.', status: 'partial', note: 'built under the cast rig (one key the world shares, the sky over the ground and the rim in the body\'s own shader): a fight game\'s and a brawl\'s bodies under a register, the hero a player pilots on a page whose land is drawn as form, a vehicle\'s form body; planned: every other figure (a walker, a foe, a crowd), and the hero on a gen-7 page with no form land (a metro, a room)' },
        { id: 'material-by-response', line: 'Skin, cloth, metal and visor are told apart by how they reflect, each its own material.', status: 'partial', note: 'built for a vehicle\'s form body (its slots: paint under clearcoat, glass, alloy, rubber, carbon) and for the realistic hero in a fight (its relief and its roughness); planned: a hero\'s skin, cloth and metal each its own material on every page' },
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

/** A read's or an export's `era` (an era is a render: the same recipe in another era): the id, or a throw that teaches. */
export function readEra(v) {
  const e = typeof v === 'string' ? eraError(v) : `era is a string, one of ${ERA_IDS.join(', ')} (the render's, as the engine is)`;
  if (e) throw new Error(e);
  return v;
}

/** An era's cast conventions through its `extends` chain, oldest first. */
export function eraCastConventions(id) {
  const e = ERAS[id];
  return [...(e.extends ? eraCastConventions(e.extends) : []), ...e.cast.conventions];
}
