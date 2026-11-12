/**
 * THE ERA MARKS: what each era gives each World page input (built, approximated or absent), since an era is a render
 * (era/eras.js): the same recipe, read in another era, is another render of it.
 *
 *   { 'gen-6': 'built' }                                   paint is gen-6's own: it draws every input as it always has
 *   { 'gen-7': 'built', neutral: true }                    an input no era changes (a rule, a camera, a sound, a page option)
 *   { 'gen-7': 'approximated', how: '…' }                  a surface the form render does not draw yet: drawn as paint
 *
 * A SURFACE input holds its light in its colour (vertex light, painted tiles, ramp stops, baked occlusion, a cel band) or
 * is the live light darkening that paint. The form render (gen-7: material and geometry, lit by the renderer) replaces
 * each; until it draws one, a gen-7 read draws it as paint under the live light and reads `approximated`, never built.
 * A gap is named, never approximated silently: eraReading lists every surface a payload carries that its era draws so.
 * A FIGURE under the cast rig (its `cast`, color-theorist/cast-rig.js) or with a form body (a vehicle's `form`) is the form
 * render's: eraReading reads a bank of only those as built, and names them where the rest are still paint.
 *
 * The lists below are closed over emitThreeWorld's parameters (scene-three.js, read by era-marks.test.js): a new page
 * input is classified here before that ratchet passes.
 *
 * Pure data and one read. No builder is imported.
 */
import { ERAS, readEra } from './eras.js';

/** The marks an era gives an input: built (drawn as the era draws), approximated (drawn simpler: the `how` says how),
 * absent (not drawn). */
export const MARKS = Object.freeze(['built', 'approximated', 'absent']);
/** A row maker for one era: `markRow('gen-7')('approximated', 'why')` → { 'gen-7': 'approximated', how: 'why' }. */
const markRow = (era) => (mark, how) => Object.freeze({ [era]: mark, ...(how ? { how } : {}) });

/** The page inputs that hold light in their colour, or are the live light over it: the form render replaces each. */
export const SURFACE_INPUTS = Object.freeze([
  'faces', 'repeats', 'textures', 'resample', 'leaves', 'surfaces', 'terrain', 'figures', 'walkers', 'carMeshes', 'splats', 'liveGrass',
  'fabric', 'tone', 'toon', 'vertexContrast', 'strokeOverlay', 'ao', 'light', 'glow', 'soft', 'wetSand', 'wetRoad',
  'shallows', 'seaway', 'softGround', 'snowPrints', 'shadows', 'occlusion', 'creases', 'lightTier',
]);
// the live light itself (scene/live-light.js): a form render's light, darkening paint until there is material to light
const LIVE = new Set(['shadows', 'occlusion', 'creases', 'lightTier']);

/** The page inputs no era changes: what a world is and does, how the page is drawn, what it sounds like. */
export const NEUTRAL_INPUTS = Object.freeze([
  'cameras', 'viewBox', 'title', 'bg', 'inline', 'cdn', 'sky', 'wireframe', 'walk', 'spin', 'hud', 'chrome', 'picks', 'tracers', 'planets',
  'movers', 'comets', 'fields', 'heatSpheres', 'starSurfaces', 'buildups', 'transports', 'deforms', 'raymarch', 'decollide',
  'capture', 'captureSize', 'signs', 'physics', 'actions', 'entities', 'camera', 'pilot', 'spectate', 'seats', 'ai', 'colliders', 'breakables',
  'breakPieces', 'loose', 'rupa', 'hangar', 'match', 'smoke', 'wreckExplodes', 'tutorial', 'aiDifficulty', 'lock', 'commander', 'events', 'fog',
  'audio', 'fx', 'effects', 'spriteSfx', 'marks', 'driveSurface', 'shoot', 'game', 'backdrop', 'cars', 'signals',
  'trafficLanes', 'trafficConstants', 'flow', 'beacons', 'xr', 'stream', 'haze', 'crystalLight', 'fire', 'metersPerUnit', 'cutouts', 'doors',
  'items', 'jets', 'jetLight', 'sway', 'flicker', 'motes', 'weather', 'pack', 'pixel', 'versus', 'brawl', 'board', 'screen', 'runner', 'tempo', 'grade',
  'science', 'hazeHeight', 'fauna', 'meet', 'court', 'turns', 'pitch', 'holo', 'innings', 'broadcasts', 'cone', 'formSky', 'air', 'soften',
  'knock', 'guide', 'footless', 'finish', 'hydraulics', 'flames',
]);

/** The form render's own inputs: what it draws as material in the place of paint (only a 'form' era's read carries one):
 *  `form.land` a geocube's island or trail (form/land-read.js), `form.room` a room under no sun (form/room-form.js). */
export const FORM_INPUTS = Object.freeze(['form']);
// a payload that carries the form render: its faces and their tiles are drawn as material
const FORMED = new Set(['faces', 'textures']);

const PAINT_HOW = 'drawn as paint, its light in its colour, under the live light: the form render does not draw it yet';
const FORM_HOW = { form: 'the land as material under the cube\'s light (form/land-read.js, channels/form-land.js): a geocube\'s island or trail; a room\'s tiles as material over its light solved from its palette and baked with its shadows, the nearest lamps lighting its relief (form/room-form.js, form/room-light.js, channels/form.js)' };
const LIVE_HOW = 'the live light darkening paint: the form render will light material with it';
const g6 = markRow('gen-6'), g7 = markRow('gen-7');

/** Each era's marks over every World page input: { [era]: { [input]: row } }. */
export const ERA_PAGE_MARKS = Object.freeze({
  'gen-6': Object.freeze(Object.fromEntries([...SURFACE_INPUTS, ...NEUTRAL_INPUTS, ...FORM_INPUTS].map((k) => [k, g6('built')]))),
  'gen-7': Object.freeze(Object.fromEntries([
    ...SURFACE_INPUTS.map((k) => [k, g7('approximated', LIVE.has(k) ? LIVE_HOW : PAINT_HOW)]),
    ...NEUTRAL_INPUTS.map((k) => [k, Object.freeze({ 'gen-7': 'built', neutral: true })]),
    ...FORM_INPUTS.map((k) => [k, g7('built', FORM_HOW[k])]),
  ])),
});

const carried = (v) => v !== undefined && v !== null && v !== false && !(Array.isArray(v) && !v.length);

/**
 * What a resolved payload reads in an era: { era, surface, approximated: [{ input, how }], absent: [{ input, how }] },
 * each list the inputs the payload carries that the era does not draw as built (an era drawing all of them: both empty).
 */
export function eraReading(payload, era) {
  readEra(era);
  const marks = ERA_PAGE_MARKS[era], out = { era, surface: ERAS[era].surface, approximated: [], absent: [] }, formed = carried(payload?.form);
  for (const [input, row] of Object.entries(marks)) {
    if (row[era] === 'built' || !carried(payload?.[input]) || (formed && FORMED.has(input))) continue;
    // (the figures: one that carries the cast rig or a form body is drawn as form, lit by the renderer; a bank of only
    // those is built, and one with some says which are still paint)
    if (input === 'figures' && ERAS[era].surface === 'form') {
      const F = Object.entries(payload.figures).filter(([, f]) => f && typeof f === 'object'), lit = F.filter(([, f]) => f.cast || f.form);
      if (F.length && lit.length === F.length) continue;
      if (lit.length) { out[row[era]].push({ input, how: `${lit.map(([n]) => n).sort().join(', ')} under the cast rig, lit by the renderer; the rest ${PAINT_HOW}` }); continue; }
    }
    // (the repeats: a template baked for the form render, form/sun-light.js, a street's frontage, is drawn as form; a
    // payload whose repeats are all so is built, and one with some says which are still paint)
    if (input === 'repeats' && ERAS[era].surface === 'form' && Array.isArray(payload.repeats)) {
      const baked = (r) => Array.isArray(r?.template) && r.template.length > 0 && r.template.every((f) => f && f.cornerLight !== undefined);
      const lit = payload.repeats.filter(baked);
      if (lit.length === payload.repeats.length) continue;
      if (lit.length) { const rest = [...new Set(payload.repeats.filter((r) => !baked(r)).map((r) => String(r?.group ?? 'repeat').replace(/[-:][^-:]*$/, '')))].sort(); out[row[era]].push({ input, how: `its baked templates drawn as form; the rest (${rest.join(', ')}) ${PAINT_HOW}` }); continue; }
    }
    out[row[era]].push({ input, how: row.how });
  }
  return out;
}
