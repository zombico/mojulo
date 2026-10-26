/**
 * THE ERA MARKS: what each era gives each World page input, in the engine marks' words (scene/engines/marks.js), since
 * an era is a render as an engine is (era/eras.js): the same recipe, read in another era, is another render of it.
 *
 *   { 'gen-6': 'built' }                                   paint is gen-6's own: it draws every input as it always has
 *   { 'gen-7': 'built', neutral: true }                    an input no era changes (a rule, a camera, a sound, a page option)
 *   { 'gen-7': 'approximated', how: '…' }                  a surface the form render does not draw yet: drawn as paint
 *
 * A SURFACE input holds its light in its colour (vertex light, painted tiles, ramp stops, baked occlusion, a cel band) or
 * is the live light darkening that paint. The form render (gen-7: material and geometry, lit by the renderer) replaces
 * each; until it draws one, a gen-7 read draws it as paint under the live light and reads `approximated`, never built.
 * A gap is named, never approximated silently: eraReading lists every surface a payload carries that its era draws so.
 *
 * The two lists below are closed over emitThreeWorld's parameters (engines/mark-sources.js pageInputs): a new page input
 * is classified here before the ratchet (era-marks.test.js) passes.
 *
 * Pure data and one read. No builder is imported.
 */
import { markRow } from '../scene/engines/marks.js';
import { ERAS, readEra } from './eras.js';

/** The page inputs that hold light in their colour, or are the live light over it: the form render replaces each. */
export const SURFACE_INPUTS = Object.freeze([
  'faces', 'repeats', 'textures', 'resample', 'surfaces', 'terrain', 'figures', 'walkers', 'carMeshes', 'splats', 'liveGrass',
  'fabric', 'tone', 'toon', 'vertexContrast', 'strokeOverlay', 'ao', 'light', 'glow', 'soft', 'wetSand', 'wetRoad',
  'shallows', 'softGround', 'snowPrints', 'shadows', 'occlusion', 'creases', 'lightTier',
]);
// the live light itself (scene/live-light.js): a form render's light, darkening paint until there is material to light
const LIVE = new Set(['shadows', 'occlusion', 'creases', 'lightTier']);

/** The page inputs no era changes: what a world is and does, how the page is drawn, what it sounds like. */
export const NEUTRAL_INPUTS = Object.freeze([
  'cameras', 'viewBox', 'title', 'bg', 'inline', 'cdn', 'sky', 'wireframe', 'walk', 'spin', 'hud', 'picks', 'tracers', 'planets',
  'movers', 'comets', 'fields', 'heatSpheres', 'starSurfaces', 'buildups', 'transports', 'deforms', 'raymarch', 'decollide',
  'capture', 'signs', 'physics', 'actions', 'entities', 'camera', 'pilot', 'spectate', 'seats', 'ai', 'colliders', 'breakables',
  'breakPieces', 'hangar', 'match', 'smoke', 'wreckExplodes', 'tutorial', 'aiDifficulty', 'lock', 'commander', 'events', 'fog',
  'audio', 'fx', 'effects', 'spriteSfx', 'marks', 'driveSurface', 'shoot', 'game', 'backdrop', 'cars', 'signals',
  'trafficLanes', 'trafficConstants', 'xr', 'stream', 'haze', 'crystalLight', 'fire', 'metersPerUnit', 'cutouts', 'doors',
  'items', 'jets', 'jetLight', 'sway', 'flicker', 'motes', 'weather', 'pack', 'pixel', 'versus', 'board', 'screen', 'runner',
  'science', 'hazeHeight', 'fauna', 'meet', 'court', 'turns', 'pitch', 'holo', 'innings',
]);

const PAINT_HOW = 'drawn as paint, its light in its colour, under the live light: the form render does not draw it yet';
const LIVE_HOW = 'the live light darkening paint: the form render will light material with it';
const g6 = markRow('gen-6'), g7 = markRow('gen-7');

/** Each era's marks over every World page input: { [era]: { [input]: row } }. */
export const ERA_PAGE_MARKS = Object.freeze({
  'gen-6': Object.freeze(Object.fromEntries([...SURFACE_INPUTS, ...NEUTRAL_INPUTS].map((k) => [k, g6('built')]))),
  'gen-7': Object.freeze(Object.fromEntries([
    ...SURFACE_INPUTS.map((k) => [k, g7('approximated', LIVE.has(k) ? LIVE_HOW : PAINT_HOW)]),
    ...NEUTRAL_INPUTS.map((k) => [k, Object.freeze({ 'gen-7': 'built', neutral: true })]),
  ])),
});

const carried = (v) => v !== undefined && v !== null && v !== false && !(Array.isArray(v) && !v.length);

/**
 * What a resolved payload reads in an era: { era, surface, approximated: [{ input, how }], absent: [{ input, how }] },
 * each list the inputs the payload carries that the era does not draw as built (an era drawing all of them: both empty).
 */
export function eraReading(payload, era) {
  readEra(era);
  const marks = ERA_PAGE_MARKS[era], out = { era, surface: ERAS[era].surface, approximated: [], absent: [] };
  for (const [input, row] of Object.entries(marks)) {
    if (row[era] === 'built' || !carried(payload?.[input])) continue;
    out[row[era]].push({ input, how: row.how });
  }
  return out;
}
