/**
 * THE ELEMENTS — what a town is made of, designed before any building is composed. An element is a set of RULES, never
 * a shape: its params each have a rail, and each says whether the STREET holds it (every citizen on a street shares
 * it: the eave line, the pitch, the light's head, the bond) or a HOUSE may vary it (a bay a little wider, a few more
 * lights, shutters or none). Each has a depth (the ring prunes it) and reads at a ring as geometry, a mark in the tile,
 * or not at all, by the eye spot. Building elements (the wall and its bond, the cap, the light, the door, the socle,
 * the cornice, sills, lintels, quoins, shutters, the chimney, points, ribs, bands, the frame) and street elements (the
 * road, the footway, the kerb, the lamp, the post, the fence) are designed together: the street is part of the
 * anchor.
 *
 * Then the ANCHOR is composed from them: a CITIZEN (the ordinary house, at full effort, standing in its SLICE of street:
 * footway, kerb, road, lamp, posts). `composeAnchor` checks every element against its kind's rails and the grammar,
 * and compiles the composition into the pieces the language is decompiled from (era/out-anchor-structure.js), with the
 * street section and the holds beside them.
 *
 *   ELEMENT_KINDS               the kinds: family, depth, params { rail, hold }, how each reads
 *   ELEMENT_SETS                the authored anchors: elements first, then a small composition
 *   seedElements(seed)          elements drawn from the kinds' rails, each choice constraining the next
 *   composeAnchor(anchor)       → { read, use, lot, storeyH, storeys, pieces, street, holds, bonds, elements }
 *   build                       the element builders, shared by speak, the town's dress and the sheet's swatches
 *
 * Pure; seeded dice only; values only (each face a value on a surface group; the paint colours it).
 */
import { geometry as G } from './out-structures.js';

const { face, wallQuad, wallPoly, wallOf, add3, unit, dice, subSeed, r3 } = G;

// ── the kinds ───────────────────────────────────────────────────────────────────────────────────────────────────────
// a param: `rail` [lo, hi] or a list of words; `hold` 'street' (a street holds it) or { house: k } (a household moves it
// by up to k, a fraction, or ± k whole for a count), or 'share' (the share of households that have the element)
const ST = 'street';
const WORDS = {
  bond: ['none', 'coursed', 'ashlar', 'brick', 'rubble', 'boards'], capForm: ['gable', 'hip', 'pyramid', 'flat', 'dome', 'cone', 'none'], lightForm: ['rect', 'arch', 'round', 'lens'],
  doorForm: ['rect', 'arch'], lintelForm: ['flat', 'key'], head: ['lantern', 'globe', 'hood', 'orb'], arm: ['post', 'bracket', 'crook'], postForm: ['square', 'round', 'capped'],
  fenceForm: ['rail', 'paling', 'wall'], footPaving: ['flags', 'setts', 'slabs'], roadPaving: ['setts', 'flags', 'earth'],
};
export const ELEMENT_KINDS = Object.freeze({
  wall: { family: 'building', depth: 0, read: 'the wall, storey by storey: its material (a surface group and value) and how it is laid (its bond, marks in the tile)', params: { bond: { rail: WORDS.bond, hold: ST } } },
  cap: { family: 'building', depth: 0, read: 'what covers the mass: its form, pitch or rise, eave, covering and courses', params: { form: { rail: WORDS.capForm, hold: ST }, pitch: { rail: [20, 60], hold: ST }, eave: { rail: [0.2, 1.4], hold: ST }, rise: { rail: [0.5, 1.4], hold: { house: 0.08 } } } },
  light: { family: 'building', depth: 1, read: 'the window: its form, size and head line (held by the street), its rhythm (a house may widen a bay or add a light)', params: { form: { rail: WORDS.lightForm, hold: ST }, w: { rail: [0.6, 1.4], hold: ST }, h: { rail: [0.6, 2], hold: ST }, sill: { rail: [0.6, 1.1], hold: ST }, bay: { rail: [2.2, 3.6], hold: { house: 0.12 } }, count: { rail: [1, 4], hold: { house: 1 } } } },
  door: { family: 'building', depth: 1, read: 'the way in: its head (square or round); its size is the use\'s, its bay the household\'s', params: { form: { rail: WORDS.doorForm, hold: ST }, w: { rail: [0.9, 1.4], hold: ST }, h: { rail: [2, 2.5], hold: ST } } },
  socle: { family: 'building', depth: 2, read: 'a plinth band at the wall\'s foot: the building stands on something', params: { h: { rail: [0.3, 0.9], hold: ST } } },
  cornice: { family: 'building', depth: 2, read: 'a proud band under the eave: the wall ends, the cap begins', params: { h: { rail: [0.15, 0.45], hold: ST }, proud: { rail: [0.08, 0.3], hold: ST } } },
  sill: { family: 'building', depth: 3, read: 'a ledge under each light, wider than it', params: { h: { rail: [0.15, 0.24], hold: ST }, over: { rail: [0.04, 0.15], hold: ST } } },
  lintel: { family: 'building', depth: 3, read: 'what carries the wall over each light: a beam, or a keystone over a round head', params: { h: { rail: [0.16, 0.32], hold: ST }, form: { rail: WORDS.lintelForm, hold: ST } } },
  quoins: { family: 'building', depth: 3, read: 'dressed stones at the corners, long and short in turn', params: { w: { rail: [0.25, 0.5], hold: ST }, course: { rail: [0.25, 0.4], hold: ST } } },
  shutters: { family: 'building', depth: 3, read: 'a pair beside each square light; not every household hangs them', params: { share: { rail: [0, 1], hold: 'share' } } },
  chimney: { family: 'building', depth: 2, read: 'a hearth\'s stack through the cap, where the use has a hearth', params: { w: { rail: [0.5, 0.9], hold: ST } } },
  point: { family: 'building', depth: 2, read: 'pointed finials: one at a crown, or a counted radial set', params: { count: { rail: [1, 6], hold: ST }, len: { rail: [0.06, 0.25], hold: ST }, base: { rail: [0.14, 0.3], hold: ST } } },
  rib: { family: 'building', depth: 2, read: 'vertical ribs between the lights; a share of households carry them', params: { count: { rail: [2, 6], hold: ST }, w: { rail: [0.12, 0.3], hold: ST }, share: { rail: [0, 1], hold: 'share' } } },
  band: { family: 'building', depth: 2, read: 'a horizontal band at each storey line', params: { w: { rail: [0.14, 0.3], hold: ST } } },
  frame: { family: 'building', depth: 3, read: 'timber members over the upper walls, posts at each bay', params: { member: { rail: [0.15, 0.26], hold: ST } } },
  road: { family: 'street', depth: 0, read: 'the way itself: its paving by the route\'s rank (the lane the section\'s, the back lane earth)', params: { paving: { rail: WORDS.roadPaving, hold: ST } } },
  footway: { family: 'street', depth: 0, read: 'the walk beside the road, behind the kerb; it narrows down the hierarchy and is gone on a back lane', params: { w: { rail: [1, 2.6], hold: ST }, paving: { rail: WORDS.footPaving, hold: ST } } },
  kerb: { family: 'street', depth: 1, read: 'the edge between road and footway: a stone set on end', params: { h: { rail: [0.08, 0.2], hold: ST }, w: { rail: [0.15, 0.35], hold: ST } } },
  lamp: { family: 'street', depth: 2, read: 'the streetlight: a post, an arm, a head, at a stride along the kerb', params: { h: { rail: [2.4, 4], hold: ST }, head: { rail: WORDS.head, hold: ST }, arm: { rail: WORDS.arm, hold: ST }, stride: { rail: [12, 24], hold: ST } } },
  post: { family: 'street', depth: 2, read: 'a bollard where the walk meets an open place or a stair', params: { h: { rail: [0.5, 1.1], hold: ST }, form: { rail: WORDS.postForm, hold: ST }, stride: { rail: [2.5, 6], hold: ST } } },
  fence: { family: 'street', depth: 2, read: 'what closes a lot\'s back: rails, palings or a low wall', params: { h: { rail: [0.8, 1.4], hold: ST }, form: { rail: WORDS.fenceForm, hold: ST } } },
});
export const ELEMENT_KIND_IDS = Object.freeze(Object.keys(ELEMENT_KINDS));
/** The ornament kinds a building's pieces carry (the details among them), and those that need a flat wall. */
export const DETAIL_KINDS = Object.freeze(['socle', 'cornice', 'sill', 'lintel', 'quoins']);
export const FLAT_WALL = Object.freeze(['sill', 'lintel', 'quoins', 'shutters', 'frame']);

// ── the authored element sets, and how each is composed ─────────────────────────────────────────────────────────────
const S = (group, value, bond = 'none') => ({ group, value, bond });
export const ELEMENT_SETS = Object.freeze({
  'timber-hall': {
    read: 'a timber-framed house: coursed stone below on a socle, quoined at the corners, plaster and frame above, a steep tiled gable, square lights on stone sills under timber lintels, shutters at most windows, a chimney, a wing behind; a setts lane, flagged footways, lanterns on brackets',
    storeyH: 2.9,
    elements: {
      wall: { kind: 'wall', storeys: [S('str:stone', 0.62, 'coursed'), S('str:plaster', 0.88)] },
      roof: { kind: 'cap', form: 'gable', pitch: 42, eave: 0.75, group: 'str:tile', value: 0.5, courses: true },
      lights: { kind: 'light', form: 'rect', w: 1.1, h: 1.4, sill: 0.85, bay: 2.7, group: 'str:opening', value: 0.04 },
      door: { kind: 'door', form: 'rect', w: 1.1, h: 2.2 },
      socle: { kind: 'socle', h: 0.5, group: 'str:stone', value: 0.48 },
      sills: { kind: 'sill', h: 0.18, over: 0.08, group: 'str:stone', value: 0.78 },
      lintels: { kind: 'lintel', h: 0.22, form: 'flat', group: 'str:timber', value: 0.28 },
      quoins: { kind: 'quoins', w: 0.38, course: 0.32, group: 'str:stone', value: 0.8 },
      stack: { kind: 'chimney', w: 0.65, group: 'str:stone', value: 0.55 },
      frame: { kind: 'frame', member: 0.2, group: 'str:timber', value: 0.25 },
      shutters: { kind: 'shutters', share: 0.7, group: 'str:paint', value: 0.55 },
      road: { kind: 'road', paving: 'setts' }, footway: { kind: 'footway', w: 1.6, paving: 'flags' }, kerb: { kind: 'kerb', h: 0.14, w: 0.25 },
      lamp: { kind: 'lamp', h: 3.1, head: 'lantern', arm: 'bracket', stride: 16 }, post: { kind: 'post', h: 0.9, form: 'capped', stride: 3.5 }, fence: { kind: 'fence', h: 1.1, form: 'rail' },
    },
    compose: { mass: { kind: 'block', w: 10, d: 7.5 }, storeys: 2, annex: { scale: 0.6 } },
  },
  shell: {
    read: 'a pale spheroid shell on a low ring of stone: round lights set in it like small domes, ribs between them in most households, three points at the crown, a satellite shell behind; a path of slabs beside a flagged way, orbs on crooks',
    storeyH: 2.8,
    elements: {
      wall: { kind: 'wall', storeys: [S('str:shell', 0.9)] },
      roof: { kind: 'cap', form: 'none', rise: 1.15 },
      lights: { kind: 'light', form: 'lens', w: 1.1, h: 1.1, count: 3, group: 'str:lens', value: 0.5 },
      door: { kind: 'door', form: 'arch', w: 1.1, h: 2.25 },
      socle: { kind: 'socle', h: 0.4, group: 'str:motif', value: 0.6 },
      points: { kind: 'point', count: 3, len: 0.1, base: 0.2, group: 'str:shell', value: 0.82 },
      ribs: { kind: 'rib', count: 4, w: 0.16, share: 0.75, group: 'str:motif', value: 0.62 },
      road: { kind: 'road', paving: 'flags' }, footway: { kind: 'footway', w: 1.4, paving: 'slabs' }, kerb: { kind: 'kerb', h: 0.1, w: 0.3 },
      lamp: { kind: 'lamp', h: 3.4, head: 'orb', arm: 'crook', stride: 18 }, post: { kind: 'post', h: 0.7, form: 'round', stride: 3 }, fence: { kind: 'fence', h: 0.9, form: 'wall' },
    },
    compose: { mass: { kind: 'shell', w: 11, d: 11 }, storeys: 1, annex: { scale: 0.6 } },
  },
  tiered: {
    read: 'a tiered timber tower-house: each storey a smaller tier under its own wide hipped eave with a cornice under it, round-headed lights with keystones, a band at every storey, one tall point at the crown; a flagged lane, setts footways, hooded lamps on posts, paling fences',
    storeyH: 3.1,
    elements: {
      wall: { kind: 'wall', storeys: [S('str:timber', 0.72, 'boards')] },
      roof: { kind: 'cap', form: 'hip', pitch: 30, eave: 1.15, group: 'str:tile', value: 0.5, courses: true },
      lights: { kind: 'light', form: 'arch', w: 1, h: 1.6, sill: 0.8, bay: 2.6, group: 'str:opening', value: 0.04 },
      door: { kind: 'door', form: 'arch', w: 1.15, h: 2.3 },
      cornice: { kind: 'cornice', h: 0.24, proud: 0.14, group: 'str:timber', value: 0.38 },
      lintels: { kind: 'lintel', h: 0.24, form: 'key', group: 'str:timber', value: 0.4 },
      finial: { kind: 'point', count: 1, len: 0.2, base: 0.26, group: 'str:timber', value: 0.4 },
      bands: { kind: 'band', w: 0.24, group: 'str:paint', value: 0.55 },
      road: { kind: 'road', paving: 'flags' }, footway: { kind: 'footway', w: 1.3, paving: 'setts' }, kerb: { kind: 'kerb', h: 0.12, w: 0.2 },
      lamp: { kind: 'lamp', h: 2.6, head: 'hood', arm: 'post', stride: 14 }, post: { kind: 'post', h: 0.6, form: 'square', stride: 2.8 }, fence: { kind: 'fence', h: 1.2, form: 'paling' },
    },
    compose: { mass: { kind: 'block', w: 8.5, d: 8.5 }, storeys: 2, tiers: { shrink: 0.76, every: true } },
  },
});

/** The street a pieces-only anchor stands in (it named no street elements). */
export const DEFAULT_STREET = Object.freeze({
  road: { kind: 'road', paving: 'setts' }, footway: { kind: 'footway', w: 1.5, paving: 'flags' }, kerb: { kind: 'kerb', h: 0.14, w: 0.25 },
  lamp: { kind: 'lamp', h: 3, head: 'lantern', arm: 'bracket', stride: 16 }, post: { kind: 'post', h: 0.9, form: 'capped', stride: 3.5 }, fence: { kind: 'fence', h: 1.1, form: 'rail' },
});
const STREET_KINDS = ['road', 'footway', 'kerb', 'lamp', 'post', 'fence'];

/**
 * Elements drawn from the kinds' rails, each choice constraining the next: the cap first (it decides what masses can
 * carry it), then a light those masses can hold, the wall's material and bond, the details a flat wall allows, the
 * ornaments, and the street.
 */
export function seedElements(seed = 1) {
  const D = dice(subSeed(seed, 'anchor')), pick = (a) => a[Math.floor(D.R() * a.length)], roll = (r) => D.roll(r);
  const cap = pick(['gable', 'gable', 'hip', 'pyramid', 'flat', 'dome', 'cone', 'none']);
  const masses = { gable: ['block'], hip: ['block'], pyramid: ['block'], flat: ['block', 'drum'], dome: ['block', 'drum'], cone: ['drum'], none: ['shell'] }[cap];
  const flat = masses.includes('block'), round = !flat || (masses.length > 1 && D.R() < 0.4);
  const light = pick(round ? ['round', 'lens', 'arch'] : ['rect', 'arch', 'round']);
  const wallG = pick(['str:stone', 'str:plaster', 'str:timber', 'str:shell']), topG = pick(round ? ['str:shell', 'str:plaster'] : ['str:plaster', 'str:timber']);
  const v = (g) => (g === 'str:stone' ? 0.62 : g === 'str:timber' ? 0.7 : 0.9), vt = (g) => (g === 'str:timber' ? 0.7 : 0.88);
  const bondOf = (g) => (g === 'str:stone' ? pick(['coursed', 'ashlar', 'rubble', 'brick']) : g === 'str:timber' ? pick(['boards', 'none']) : 'none');
  const storeys = [{ ...S(wallG, v(wallG)), bond: round ? 'none' : bondOf(wallG) }, { ...S(topG, vt(topG)), bond: round ? 'none' : bondOf(topG) }].sort((a, b) => a.value - b.value);
  const covering = pick(['str:tile', 'str:shingle', 'str:slate', 'str:thatch']), pitched = ['gable', 'hip', 'pyramid'].includes(cap);
  const COVER_MIN = { 'str:thatch': 45, 'str:tile': 30, 'str:shingle': 26, 'str:slate': 25 };
  const E = {
    wall: { kind: 'wall', storeys },
    roof: cap === 'none' ? { kind: 'cap', form: 'none', rise: roll([0.9, 1.4]) } : { kind: 'cap', form: cap, pitch: pitched ? Math.max(COVER_MIN[covering], roll([28, 52])) : undefined, rise: cap === 'dome' || cap === 'cone' ? roll([0.5, 1.2]) : undefined, eave: roll([0.4, 1.1]), group: cap === 'flat' ? 'str:stone' : cap === 'dome' || cap === 'cone' ? pick([covering, 'str:shell']) : covering, value: 0.5, courses: pitched },
    lights: { kind: 'light', form: light, w: roll([0.9, 1.2]), h: light === 'rect' || light === 'arch' ? roll([1.2, 1.7]) : roll([0.9, 1.2]), sill: 0.85, bay: roll([2.4, 3.2]), count: Math.floor(roll([1, 4.9])), group: light === 'lens' ? 'str:lens' : 'str:opening', value: light === 'lens' ? 0.5 : 0.04 },
    door: { kind: 'door', form: light === 'rect' ? 'rect' : 'arch', w: 1.1, h: 2.25 },
  };
  // the details: a socle under any wall; a cornice under an eave; sills, lintels and quoins on a flat wall
  if (D.R() < 0.55) E.socle = { kind: 'socle', h: roll([0.35, 0.7]), group: 'str:stone', value: 0.5 };
  if (cap !== 'none' && D.R() < 0.45) E.cornice = { kind: 'cornice', h: roll([0.18, 0.36]), proud: roll([0.1, 0.22]), group: storeys[storeys.length - 1].group === 'str:timber' ? 'str:timber' : 'str:stone', value: 0.42 };
  const flatOnly = !round;
  if (flatOnly && light !== 'round' && D.R() < 0.6) E.sills = { kind: 'sill', h: roll([0.16, 0.22]), over: roll([0.05, 0.12]), group: 'str:stone', value: 0.78 };
  if (flatOnly && light !== 'round' && D.R() < 0.5) E.lintels = { kind: 'lintel', h: roll([0.18, 0.28]), form: light === 'arch' ? 'key' : 'flat', group: pick(['str:stone', 'str:timber']), value: 0.36 };
  if (flatOnly && storeys[0].group === 'str:stone' && D.R() < 0.5) E.quoins = { kind: 'quoins', w: roll([0.3, 0.45]), course: roll([0.28, 0.36]), group: 'str:stone', value: 0.78 };
  for (const k of ['point', 'chimney', 'rib', 'band', 'frame', 'shutters']) {
    if (D.R() > 0.42) continue;
    if ((k === 'chimney' && !pitched) || ((k === 'frame' || k === 'shutters') && (round || light !== 'rect'))) continue;
    E[k] = { kind: k, count: k === 'point' ? pick([1, 3, 4]) : k === 'rib' ? pick([2, 4, 6]) : undefined, len: k === 'point' ? roll([0.08, 0.2]) : undefined, base: k === 'point' ? 0.2 : undefined, w: k === 'rib' || k === 'band' ? roll([0.16, 0.28]) : k === 'chimney' ? 0.65 : undefined, member: k === 'frame' ? 0.2 : undefined, share: k === 'shutters' ? roll([0.5, 0.9]) : k === 'rib' ? roll([0.6, 0.9]) : undefined, group: k === 'rib' || k === 'band' ? (round ? 'str:motif' : 'str:paint') : k === 'frame' ? 'str:timber' : k === 'shutters' ? 'str:paint' : k === 'chimney' ? 'str:stone' : wallG, value: k === 'frame' ? 0.25 : 0.55 };
  }
  // the street: the section and its furniture, drawn from the same seed
  E.road = { kind: 'road', paving: pick(['setts', 'flags']) };
  E.footway = { kind: 'footway', w: roll([1.2, 2.2]), paving: pick(WORDS.footPaving) };
  E.kerb = { kind: 'kerb', h: roll([0.1, 0.18]), w: roll([0.2, 0.3]) };
  E.lamp = { kind: 'lamp', h: roll([2.6, 3.8]), head: pick(round ? ['orb', 'globe', 'hood'] : WORDS.head), arm: pick(WORDS.arm), stride: roll([14, 22]) };
  E.post = { kind: 'post', h: roll([0.6, 1]), form: pick(WORDS.postForm), stride: roll([2.8, 4.5]) };
  E.fence = { kind: 'fence', h: roll([0.9, 1.3]), form: pick(WORDS.fenceForm) };
  // the composition the elements allow: the mass their cap and light can stand on
  const mass = masses.length === 1 ? masses[0] : light === 'lens' || (round && D.R() < 0.7) ? 'drum' : 'block';
  if (mass !== 'block') for (const k of ['sills', 'lintels', 'quoins', 'frame', 'shutters']) delete E[k];
  const tiers = mass === 'block' && D.R() < 0.3;
  const compose = { mass: { kind: mass, w: roll([7, 11]), d: roll([7, 10]), rise: mass === 'shell' ? E.roof.rise : undefined }, storeys: mass === 'shell' ? 1 : 2, ...(tiers ? { tiers: { shrink: roll([0.7, 0.85]), every: true } } : {}), ...(!tiers && D.R() < 0.6 ? { annex: { scale: roll([0.5, 0.7]) } } : {}) };
  return { read: `a seeded anchor (${seed}): ${mass}${cap !== 'none' ? ` under a ${cap}` : ''}, ${light} lights${tiers ? ', tiered' : ''}`, storeyH: 2.9, seeded: seed, elements: E, compose };
}

// ── compose ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const inRail = (v, rail) => (typeof rail[0] === 'string' ? rail.includes(v) : typeof v === 'number' && v >= rail[0] - 1e-9 && v <= rail[1] + 1e-9);
/** Check an element against its kind's rails: an unknown kind or a value off its rail is refused, saying what is allowed. */
export function readElement(id, el) {
  const K = ELEMENT_KINDS[el?.kind];
  if (!K) throw new Error(`element '${id}': '${el?.kind}' is not an element kind (${ELEMENT_KIND_IDS.join(', ')})`);
  for (const [p, spec] of Object.entries(K.params)) if (el[p] !== undefined && !inRail(el[p], spec.rail)) throw new Error(`element '${id}' (${el.kind}): ${p} is ${typeof spec.rail[0] === 'string' ? spec.rail.join(' | ') : `${spec.rail[0]}–${spec.rail[1]}`} (got ${JSON.stringify(el[p])})`);
  if (el.kind === 'wall') for (const s of el.storeys ?? []) if (!inRail(s.bond ?? 'none', K.params.bond.rail)) throw new Error(`element '${id}' (wall): a bond is ${WORDS.bond.join(' | ')} (got ${s.bond})`);
  return el;
}

/** What a household may move, read off the elements' params: street-held keys, house rails, and shares. */
function holdsOf(E) {
  const holds = { street: ['storeyH', 'pitch', 'eave', 'shrink', 'head', 'bond', 'socle', 'cornice', 'section'], house: { annexScale: 0.15, rise: 0.1 }, share: {} };
  const k = (el) => ELEMENT_KINDS[el.kind].params;
  for (const el of Object.values(E)) {
    if (el.kind === 'light') { holds.house.bay = k(el).bay.hold.house; holds.house.lights = k(el).count.hold.house; }
    if (el.kind === 'cap' && el.form !== 'none') holds.house.capRise = k(el).rise.hold.house;
    if (el.share !== undefined) holds.share[el.kind] = el.share;
  }
  return holds;
}

/**
 * An anchor composed from its elements: each checked against its kind, the grammar's rules on what stands on what,
 * then compiled into pieces (the form the language is decompiled from), the street section, the holds and the bonds.
 * An anchor given as pieces (no elements) passes through with the default street.
 */
export function composeAnchor(A) {
  if (A.pieces) return { ...A, use: A.use ?? 'dwelling', lot: A.lot ?? { w: 12, d: 18 }, storeys: A.storeys ?? A.pieces.find((p) => p.role === 'mass')?.storeys?.length ?? 1, street: A.street ?? DEFAULT_STREET, holds: A.holds ?? { street: ['storeyH', 'pitch', 'eave', 'shrink', 'head'], house: { bay: 0.1, lights: 1, capRise: 0.1, rise: 0.1, annexScale: 0.1 }, share: { shutters: 1, rib: 0.75 } }, bonds: A.bonds ?? [], elements: A.elements ?? null };
  const E = A.elements, C = A.compose;
  if (!E || !C?.mass) throw new Error('anchor: compose an anchor from { elements, compose: { mass } } (or give its pieces)');
  for (const [id, el] of Object.entries(E)) readElement(id, el);
  const of = (kind) => Object.entries(E).filter(([, el]) => el.kind === kind), one = (kind) => of(kind)[0]?.[1];
  const wall = one('wall'), cap = one('cap'), light = one('light'), door = one('door');
  if (!wall || !cap || !light || !door) throw new Error('anchor: a citizen needs a wall, a cap (or { form: \'none\' }), a light and a door among its elements');
  const mass = C.mass.kind, block = mass === 'block';
  // the grammar, at the elements: what needs a flat wall, what needs an eave
  for (const k of FLAT_WALL) if (of(k).length && !block) throw new Error(`anchor: ${k} need a flat wall; a ${mass} has none`);
  if (of('cornice').length && cap.form === 'none') throw new Error('anchor: a cornice runs under an eave; a shell has none');
  const pieces = [{ id: 'mass', role: 'mass', kind: mass, w: C.mass.w, d: C.mass.d, rise: mass === 'shell' ? C.mass.rise ?? cap.rise : undefined, storeys: wall.storeys.map((s) => ({ group: s.group, value: s.value })), ...(C.tiers ? { tiers: { shrink: C.tiers.shrink } } : {}) }];
  if (cap.form !== 'none') pieces.push({ id: 'cap', role: 'cap', kind: cap.form, on: 'mass', pitch: cap.pitch, rise: cap.rise, eave: cap.eave, every: !!C.tiers?.every, group: cap.group, value: cap.value, courses: !!cap.courses });
  pieces.push({ id: 'lights', role: 'opening', kind: light.form, on: 'mass', w: light.w, h: light.h, sill: light.sill, rhythm: block ? { by: 'bays', bay: light.bay } : { by: 'band', count: light.count ?? 2 }, group: light.group, value: light.value });
  pieces.push({ id: 'door', role: 'entry', kind: block ? 'door' : 'tunnel', shape: door.form, on: 'mass', w: door.w, h: door.h });
  for (const [id, el] of Object.entries(E)) if (!['wall', 'cap', 'light', 'door', ...STREET_KINDS].includes(el.kind)) pieces.push({ ...el, id, role: 'ornament', kind: el.kind, on: 'mass' });
  if (C.annex) pieces.push({ id: 'annex', role: 'annex', kind: mass, on: 'mass', at: 'behind', scale: C.annex.scale });
  const street = Object.fromEntries(STREET_KINDS.map((k) => [k, one(k) ?? DEFAULT_STREET[k]]));
  return { read: A.read, use: 'dwelling', lot: A.lot ?? { w: 12, d: 18 }, storeyH: A.storeyH, storeys: C.storeys ?? 1, seeded: A.seeded, pieces, street, holds: holdsOf(E), bonds: wall.storeys.map((s) => s.bond ?? 'none'), elements: E, compose: C };
}

// ── the secondary: a counterpoint derived from the anchor ──────────────────────────────────────────────────────────
/**
 * THE SECONDARY is not authored: it is derived from the anchor's elements by contrast rules, so every anchor (authored
 * or seeded) has one. It shares what makes the town one place and turns what gives a skyline its rhythm: upright where
 * the citizen is broad, steep where it is low, dark where the street is pale (or pale where it is dark), crowned where
 * it is plain. The town sets it among the citizens as punctuation.
 */
export const SECONDARY_RULES = Object.freeze([
  { id: 'shares', rule: 'the street, the storey height, the door, the lights\' form, the ground storey and its bond, the details: what makes it the same town' },
  { id: 'rises', rule: 'compact and upright: a square plan 0.62 of the anchor\'s least side (4.6–7.2 m), one or two storeys over the heartbeat where it stands' },
  { id: 'steepens', rule: 'a gable, hip, pyramid or flat becomes a pyramid 12° steeper than the anchor\'s pitch; a dome or a cone rises a third higher; a shell becomes a drum under a cone' },
  { id: 'turns-the-tone', rule: 'over a pale street a dark body (boards, or the motif on a curved mass), over a dark street a pale one (plaster); its covering the anchor\'s neighbour (tile → slate, slate → shingle, shingle → slate, thatch → shingle), never its walls\' material, a value under them' },
  { id: 'crowns', rule: 'one finial at its peak, and a band at every storey line in the opposite tone' },
  { id: 'upright-lights', rule: 'its lights 0.85 as wide and 1.15 as tall: the verticals lead' },
  { id: 'drops', rule: 'no annex and no tiers: it is punctuation, not a household spread out' },
]);
const NEIGHBOUR_COVER = { 'str:tile': 'str:slate', 'str:slate': 'str:shingle', 'str:shingle': 'str:slate', 'str:thatch': 'str:shingle' };
const COVER = { 'str:thatch': { min: 45, value: 0.35 }, 'str:tile': { min: 30, value: 0.5 }, 'str:shingle': { min: 26, value: 0.42 }, 'str:slate': { min: 25, value: 0.4 } };
/** The secondary's elements and composition, from an anchor (an element set, composed or not). */
export function deriveSecondary(anchor) {
  const A = composeAnchor(anchor);
  if (!A.elements) return null;
  const E = A.elements, of = (k) => Object.entries(E).find(([, el]) => el.kind === k), cap = of('cap')[1], light = of('light')[1], wall = of('wall')[1];
  const m0 = A.compose.mass.kind, least = Math.min(A.compose.mass.w, A.compose.mass.d), size = r3(Math.max(4.6, Math.min(7.2, least * 0.62)));
  const mass = m0 === 'block' ? 'block' : 'drum', block = mass === 'block';
  // the tone turns: a pale street gets a dark body, a dark one a pale body; the ground storey is the street's own
  const pale = Math.max(...wall.storeys.map((x) => x.value)) >= 0.8, ground = wall.storeys[0];
  const body = pale ? (block ? { group: 'str:timber', value: 0.5, bond: 'boards' } : { group: 'str:motif', value: 0.56, bond: 'none' }) : { group: 'str:plaster', value: 0.9, bond: 'none' };
  const storeys = [m0 === 'shell' ? { group: ground.group, value: ground.value, bond: 'none' } : { ...ground, bond: block ? ground.bond : 'none' }, body];
  const floor = Math.min(...storeys.map((x) => x.value));
  // the cap steepens and takes the neighbouring covering, a value under the walls
  let roof;
  if (block) {
    const group = NEIGHBOUR_COVER[cap.group] ?? 'str:slate';
    roof = { kind: 'cap', form: 'pyramid', pitch: r3(Math.min(60, Math.max(COVER[group].min, (cap.pitch ?? 34) + 12))), eave: Math.max(0.3, Math.min(1, cap.eave ?? 0.6)), group, value: r3(Math.min(COVER[group].value, floor - 0.14)), courses: true };
    if (cap.form === 'dome') roof = { kind: 'cap', form: 'dome', rise: r3(Math.min(1.4, (cap.rise ?? 0.8) * 1.33)), eave: cap.eave ?? 0.5, group: cap.group, value: r3(Math.min(cap.value, floor - 0.14)) };
  } else {
    const group = cap.form === 'none' ? A.elements.wall.storeys[0].group : cap.group;
    roof = { kind: 'cap', form: 'cone', rise: r3(Math.min(1.4, (cap.rise ?? 0.9) * 1.33)), eave: cap.eave ?? 0.4, group, value: r3(Math.min(0.45, floor - 0.14)) };
  }
  // its cap is never its walls' own material: a roof the paint could not tell from the wall under it
  if (storeys.some((x) => x.group === roof.group)) roof.group = ['str:slate', 'str:shingle', 'str:tile'].find((g) => !storeys.some((x) => x.group === g));
  const out = {
    wall: { kind: 'wall', storeys },
    roof,
    lights: { ...light, w: r3(Math.max(0.6, light.w * 0.85)), h: r3(Math.min(2, light.h * 1.15)), count: light.count ? Math.min(4, light.count) : undefined },
    door: { ...of('door')[1] },
  };
  // the details carry over where the mass can hold them; ornaments too, but for the crown and the bands it is given
  for (const [id, el] of Object.entries(E)) {
    if (['wall', 'cap', 'light', 'door', 'point', 'band'].includes(el.kind)) continue;
    if (!block && FLAT_WALL.includes(el.kind)) continue;
    if (el.kind === 'cornice' && roof.form === 'none') continue;
    out[id] = { ...el };
  }
  const pt = of('point')?.[1];
  out.finial = { kind: 'point', count: 1, len: r3(Math.min(0.25, Math.max(0.16, (pt?.len ?? 0.16) * 1.2))), base: r3(Math.max(0.2, pt?.base ?? 0.22)), group: pt?.group ?? (block ? 'str:timber' : storeys[0].group), value: pt?.value ?? 0.4 };
  out.bands = { kind: 'band', w: of('band')?.[1]?.w ?? 0.2, group: 'str:paint', value: pale ? 0.82 : 0.3 };
  return { read: `the secondary to ${A.seeded ? `seeded anchor ${A.seeded}` : 'its anchor'}: a ${size} m ${mass} rising over the street under a ${roof.form}${roof.pitch ? ` at ${roof.pitch}°` : ''}, ${pale ? 'a dark body in a pale street' : 'a pale body in a dark street'}, crowned by a finial and banded at each storey`, storeyH: A.storeyH, secondaryOf: A.seeded ?? true, elements: out, compose: { mass: { kind: mass, w: size, d: size }, storeys: 3 } };
}

// ── the builders ────────────────────────────────────────────────────────────────────────────────────────────────────
// wall-hosted: each takes a wall W (era/out-structures.js wallOf) and pushes faces (or tile marks) with their group
const mk = (geo, group) => (geo ? { group } : { tile: true, group });
/** The bond: its joints as marks in the wall's tile, depicted a course for every few laid so they read at a sheet's scale. */
function bond(out, W, u0, u1, z0, z1, kind, value, group, seed = 1) {
  if (!kind || kind === 'none') return 0;
  const R = G.mulberry32(seed), t = 0.03, dark = Math.max(0.04, value - 0.22), ex = { tile: true, group }, before = out.length;
  const row = (z) => wallQuad(out, W, u0, u1, z - t / 2, z + t / 2, 0.006, 'bond', dark, ex);
  const perp = (u, za, zb) => { if (u > u0 + 0.05 && u < u1 - 0.05) wallQuad(out, W, u - t / 2, u + t / 2, za, zb, 0.006, 'bond', dark, ex); };
  // every course is drawn; the joints along it are depicted one for every few laid, so a wall reads as laid, not as noise
  const spec = { coursed: [0.45, 1.35], ashlar: [0.5, 1.5], brick: [0.3, 0.9], rubble: [0.4, 0] }[kind];
  if (kind === 'boards') { for (let z = z0 + 0.28; z < z1 - 0.1; z += 0.28) row(z); return out.length - before; }
  const [ch, pw] = spec;
  let k = 0;
  for (let z = z0 + ch; z < z1 - 0.08; z += ch, k++) {
    row(z);
    if (kind === 'rubble') { for (let u = u0 + R() * 0.9; u < u1; u += 0.8 + R() * 0.9) perp(u, z - ch, z); continue; }
    for (let u = u0 + (k % 2 ? pw / 2 : pw); u < u1; u += pw) perp(u, z - ch, z);
  }
  return out.length - before;
}
/** A socle: a band at the wall's foot, proud of it. */
function socle(out, W, u0, u1, h, value, group, geo = true) { wallQuad(out, W, u0, u1, 0, h, 0.05, 'socle', value, mk(geo, group)); }
/** A cornice: a proud band under the eave, with its top (so it reads as standing out). */
function cornice(out, W, u0, u1, z, h, proud, value, group, geo = true) {
  wallQuad(out, W, u0 - proud, u1 + proud, z - h, z, proud, 'cornice', value, mk(geo, group));
  if (geo) face(out, [W.at(u0 - proud, z, 0), W.at(u1 + proud, z, 0), W.at(u1 + proud, z, proud), W.at(u0 - proud, z, proud)], [0, 0, 1], 'cornice', Math.min(1, value + 0.12), { group });
}
/** A sill under a light at uc, z0 (the light's foot), w wide. */
function sill(out, W, uc, z0, w, h, over, value, group, geo = true) { wallQuad(out, W, uc - w / 2 - over, uc + w / 2 + over, z0 - h, z0, 0.045, 'sill', value, mk(geo, group)); }
/** A lintel over a light whose head is at z1: a beam a little wider, or over a round head a keystone. */
function lintel(out, W, uc, z1, w, h, form, value, group, geo = true) {
  if (form === 'key') { const k = Math.max(0.2, w * 0.24); wallPoly(out, W, [[uc - k / 2, z1 - 0.06], [uc + k / 2, z1 - 0.06], [uc + k * 0.65, z1 + h], [uc - k * 0.65, z1 + h]], 0.04, 'lintel', value, mk(geo, group)); return; }
  wallQuad(out, W, uc - w / 2 - 0.14, uc + w / 2 + 0.14, z1, z1 + h, 0.04, 'lintel', value, mk(geo, group));
}
/** Quoins at a wall's two ends, long and short in turn, z0 to z1. */
function quoins(out, W, z0, z1, w, course, value, group, geo = true) {
  let k = 0;
  for (let z = z0; z < z1 - 0.05; z += course, k++) {
    const q = k % 2 ? w * 0.6 : w, za = z + 0.02, zb = Math.min(z1, z + course) - 0.02;
    wallQuad(out, W, 0, q, za, zb, 0.02, 'quoin', value, mk(geo, group));
    wallQuad(out, W, W.len - q, W.len, za, zb, 0.02, 'quoin', value, mk(geo, group));
  }
}

// street furniture: each in its own frame (x right, y back, z up, its front at −y), parts 'dress' on `dress:` groups
function box(out, [x0, y0, z0], [x1, y1, z1], group, value, top = true) {
  const q = (pts, o) => face(out, pts, o, 'dress', value, { group });
  q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]); q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]); q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  if (top) q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
}
function prism(out, [cx, cy], r, z0, z1, group, value, sides = 8, topV = null) {
  const P = (k, z) => [cx + r * Math.cos((2 * Math.PI * k) / sides + Math.PI / sides), cy + r * Math.sin((2 * Math.PI * k) / sides + Math.PI / sides), z];
  for (let k = 0; k < sides; k++) { const a = P(k, z0), b = P(k + 1, z0); face(out, [a, b, P(k + 1, z1), P(k, z1)], [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0], 'dress', value, { group }); }
  face(out, Array.from({ length: sides }, (_, k) => P(k, z1)), [0, 0, 1], 'dress', topV ?? value, { group });
}
function cone(out, [cx, cy], r, z0, z1, group, value, sides = 8) {
  const P = (k) => [cx + r * Math.cos((2 * Math.PI * k) / sides), cy + r * Math.sin((2 * Math.PI * k) / sides), z0];
  for (let k = 0; k < sides; k++) face(out, [P(k), P(k + 1), [cx, cy, z1]], [Math.cos((2 * Math.PI * (k + 0.5)) / sides), Math.sin((2 * Math.PI * (k + 0.5)) / sides), 0.5], 'dress', value, { group });
}
const TIMBER = 'dress:timber', STONE = 'dress:stone', GLASS = 'dress:paint';
/** The streetlight: its post, its arm (none, a bracket out over the walk, or a crook), its head (lantern, globe, hood, orb). */
function lamp(out, el, ch = 1) {
  const p = 0.14 * ch, h = el.h, round = el.head === 'orb' || el.head === 'globe';
  if (round) prism(out, [0, 0], p * 0.6, 0, h, TIMBER, 0.3, 6); else box(out, [-p / 2, -p / 2, 0], [p / 2, p / 2, h], TIMBER, 0.3);
  // where the head hangs: on the post's top, out on a bracket, or at a crook's end
  let hx = 0, hy = 0, hz = h;
  if (el.arm === 'bracket') { box(out, [-0.04, -0.66, h - 0.18], [0.04, 0, h - 0.1], TIMBER, 0.3); hy = -0.62; hz = h - 0.2; }
  if (el.arm === 'crook') { box(out, [-0.04, -0.5, h - 0.06], [0.04, 0, h + 0.02], TIMBER, 0.3); box(out, [-0.04, -0.56, h - 0.32], [0.04, -0.48, h + 0.02], TIMBER, 0.3); hy = -0.52; hz = h - 0.32; }
  const hang = el.arm !== 'post';
  if (el.head === 'lantern') { const z0 = hang ? hz - 0.42 : hz, z1 = z0 + 0.4; box(out, [hx - 0.16, hy - 0.16, z0], [hx + 0.16, hy + 0.16, z1], GLASS, 0.95); cone(out, [hx, hy], 0.25, z1, z1 + 0.14, TIMBER, 0.25, 4); }
  else if (el.head === 'globe') { const z0 = hang ? hz - 0.4 : hz; prism(out, [hx, hy], 0.19, z0, z0 + 0.36, GLASS, 0.95, 8, 0.9); prism(out, [hx, hy], 0.08, z0 + 0.36, z0 + 0.44, TIMBER, 0.25, 6); }
  else if (el.head === 'hood') { const z0 = hang ? hz - 0.3 : hz; box(out, [hx - 0.1, hy - 0.1, z0], [hx + 0.1, hy + 0.1, z0 + 0.22], GLASS, 0.95); cone(out, [hx, hy], 0.34, z0 + 0.2, z0 + 0.46, TIMBER, 0.3, 8); }
  else { const z0 = hang ? hz - 0.42 : hz; cone(out, [hx, hy], 0.22, z0 + 0.2, z0, GLASS, 0.9, 8); cone(out, [hx, hy], 0.22, z0 + 0.2, z0 + 0.42, GLASS, 0.98, 8); }
}
/** A bollard: square, round, or square under a cap. */
function post(out, el, ch = 1) {
  const r = 0.11 * ch;
  if (el.form === 'round') { prism(out, [0, 0], r, 0, el.h, STONE, 0.62, 8, 0.75); return; }
  box(out, [-r, -r, 0], [r, r, el.h], STONE, 0.62);
  if (el.form === 'capped') cone(out, [0, 0], r * 1.5, el.h, el.h + 0.14, STONE, 0.72, 4);
}
/** A fence `len` long along x: posts and two rails, palings between rails, or a low coped wall. */
function fence(out, len, el, ch = 1) {
  if (el.form === 'wall') { box(out, [0, -0.18, 0], [len, 0.18, el.h * 0.8], STONE, 0.58); box(out, [-0.04, -0.24, el.h * 0.8], [len + 0.04, 0.24, el.h * 0.8 + 0.1], STONE, 0.74); return; }
  const n = Math.max(1, Math.ceil(len / 2.2)), p = 0.12 * ch;
  for (let k = 0; k <= n; k++) { const x = (len * k) / n; box(out, [x - p / 2, -p / 2, 0], [x + p / 2, p / 2, el.h], TIMBER, 0.35); }
  for (const z of [0.38 * el.h, 0.82 * el.h]) box(out, [0, -0.03, z], [len, 0.03, z + 0.08], TIMBER, 0.5);
  if (el.form === 'paling') for (let x = 0.15; x < len - 0.1; x += 0.3) for (const s of [-1, 1]) face(out, [[x - 0.05, -0.05 * s, 0.1], [x + 0.05, -0.05 * s, 0.1], [x + 0.05, -0.05 * s, el.h - 0.1], [x - 0.05, -0.05 * s, el.h - 0.1]], [0, -s, 0], 'dress', 0.55, { group: TIMBER });
}
/** A slice of street in section, `len` along x: the road's half from y = −(road/2) to the kerb, the kerb, the footway. */
function section(out, len, road, S) {
  const kerb = S.kerb, foot = S.footway.w, rg = S.road.paving === 'earth' ? 'town:soil' : 'town:stone';
  face(out, [[0, -road, 0], [len, -road, 0], [len, 0, 0], [0, 0, 0]], [0, 0, 1], 'ground', S.road.paving === 'earth' ? 0.6 : 0.62, { group: rg });
  face(out, [[0, 0, 0], [len, 0, 0], [len, 0, kerb.h], [0, 0, kerb.h]], [0, -1, 0], 'kerb', 0.5, { group: 'town:stone' });
  face(out, [[0, 0, kerb.h], [len, 0, kerb.h], [len, kerb.w, kerb.h], [0, kerb.w, kerb.h]], [0, 0, 1], 'kerb', 0.8, { group: 'town:stone' });
  face(out, [[0, kerb.w, kerb.h], [len, kerb.w, kerb.h], [len, foot, kerb.h], [0, foot, kerb.h]], [0, 0, 1], 'ground', 0.7, { group: 'town:stone' });
  // the footway's joints and the road's, marks in their tile
  const j = (pts) => face(out, pts, [0, 0, 1], 'joint', 0.35, { group: 'town:stone', tile: true });
  const fu = S.footway.paving === 'setts' ? 0.32 : S.footway.paving === 'slabs' ? 0.9 : 0.6;
  for (let x = fu; x < len; x += fu) j([[x - 0.015, kerb.w, kerb.h + 0.004], [x + 0.015, kerb.w, kerb.h + 0.004], [x + 0.015, foot, kerb.h + 0.004], [x - 0.015, foot, kerb.h + 0.004]]);
  if (S.road.paving !== 'earth') { const ru = S.road.paving === 'setts' ? 0.32 : 0.6; for (let y = -ru; y > -road; y -= ru) j([[0, y - 0.012, 0.004], [len, y - 0.012, 0.004], [len, y + 0.012, 0.004], [0, y + 0.012, 0.004]]); }
  return { top: kerb.h, foot };
}
export const build = Object.freeze({ bond, socle, cornice, sill, lintel, quoins, lamp, post, fence, section, box });

// ── swatches: each element drawn on its own, for the sheet ──────────────────────────────────────────────────────────
/**
 * An element on a sample: a building element on a panel of wall (its storey's group and value), a corner for the
 * socle, cornice and quoins, a cap on a small square; a street element on its own. Faces, values only.
 */
export function elementSwatch(anchor, id, ch = 1.2) {
  const A = composeAnchor(anchor), el = A.elements?.[id], out = [];
  if (!el) return out;
  const st = A.elements.wall?.storeys ?? [{ group: 'str:plaster', value: 0.88 }], g0 = st[0], top = st[st.length - 1], H = 2.6;
  const panel = (rect, s, z0 = 0, z1 = H, sides = ['front']) => { for (const side of sides) { const W = wallOf(rect, side); wallQuad(out, W, 0, W.len, z0, z1, 0, 'wall', s.value, { group: s.group }); } };
  const W = wallOf([0, 0, 2.6, 0.4], 'front');
  if (el.kind === 'wall') { st.forEach((s, i) => { const Wi = wallOf([i * 2.7, 0, i * 2.7 + 2.4, 0.4], 'front'); wallQuad(out, Wi, 0, 2.4, 0, H, 0, 'wall', s.value, { group: s.group }); bond(out, Wi, 0, 2.4, 0, H, s.bond, s.value, s.group, 7 + i); }); return out; }
  if (el.kind === 'light') {
    panel([0, 0, 2.6, 0.4], top);
    const w = el.w, h = el.form === 'round' || el.form === 'lens' ? el.w : el.h, z0 = 0.7, uc = 1.3;
    if (el.form === 'round' || el.form === 'lens') { G.disc(out, W.at(uc, z0 + w / 2, 0), W.n, w / 2, 12, el.form === 'lens' ? 'lens' : 'opening', el.value, { group: el.group }); return out; }
    const arc = el.form === 'arch' ? Array.from({ length: 5 }, (_, k) => { const a = (Math.PI * (k + 1)) / 6; return [uc + (w / 2) * Math.cos(a), z0 + h - w / 2 + (w / 2) * Math.sin(a)]; }) : [];
    wallPoly(out, W, el.form === 'arch' ? [[uc - w / 2, z0], [uc + w / 2, z0], [uc + w / 2, z0 + h - w / 2], ...arc, [uc - w / 2, z0 + h - w / 2]] : [[uc - w / 2, z0], [uc + w / 2, z0], [uc + w / 2, z0 + h], [uc - w / 2, z0 + h]], 0.03, 'opening', el.value, { group: el.group });
    const S2 = A.elements;
    for (const e of Object.values(S2)) {
      if (e.kind === 'sill') sill(out, W, uc, z0, w, e.h * ch, e.over, e.value, e.group);
      if (e.kind === 'lintel') lintel(out, W, uc, z0 + h, w, e.h * ch, e.form, e.value, e.group);
      if (e.kind === 'shutters') for (const s of [-1, 1]) wallQuad(out, W, s < 0 ? uc - w - 0.04 : uc + w / 2 + 0.04, s < 0 ? uc - w / 2 - 0.04 : uc + w + 0.04, z0, z0 + h, 0.03, 'shutter', e.value, { group: e.group });
    }
    return out;
  }
  if (el.kind === 'door') { panel([0, 0, 2.6, 0.4], g0); const w = el.w, h = el.h, uc = 1.3, arc = el.form === 'arch' ? Array.from({ length: 5 }, (_, k) => { const a = (Math.PI * (k + 1)) / 6; return [uc + (w / 2) * Math.cos(a), h - w / 2 + (w / 2) * Math.sin(a)]; }) : []; wallPoly(out, W, el.form === 'arch' ? [[uc - w / 2, 0], [uc + w / 2, 0], [uc + w / 2, h - w / 2], ...arc, [uc - w / 2, h - w / 2]] : [[uc - w / 2, 0], [uc + w / 2, 0], [uc + w / 2, h], [uc - w / 2, h]], 0.03, 'door', 0.3, { group: 'str:timber' }); return out; }
  if (['socle', 'cornice', 'quoins', 'band', 'rib'].includes(el.kind)) {
    const rect = [0, 0, 2.2, 2.2];
    panel(rect, g0, 0, H, ['front', 'right']);
    for (const side of ['front', 'right']) {
      const Wc = wallOf(rect, side);
      if (el.kind === 'socle') socle(out, Wc, 0, Wc.len, el.h, el.value, el.group);
      if (el.kind === 'cornice') cornice(out, Wc, 0, Wc.len, H, el.h * ch, el.proud, el.value, el.group);
      if (el.kind === 'quoins') quoins(out, Wc, 0, H, el.w, el.course, el.value, el.group);
      if (el.kind === 'band') wallQuad(out, Wc, 0, Wc.len, H * 0.5 - el.w * ch, H * 0.5, 0.025, 'motif', el.value, { group: el.group });
      if (el.kind === 'rib') for (const u of [0.5, 1.7]) wallQuad(out, Wc, u - (el.w * ch) / 2, u + (el.w * ch) / 2, 0, H, 0.02, 'motif', el.value, { group: el.group });
    }
    return out;
  }
  if (el.kind === 'sill' || el.kind === 'lintel') return elementSwatch(anchor, Object.keys(A.elements).find((k) => A.elements[k].kind === 'light'), ch);
  if (el.kind === 'cap') {
    if (el.form === 'none') { const Sh = G.shellAt([1.4, 1.4], 1.4, 1.4, 1.4 * (el.rise ?? 1), 0); G.shellFaces(out, Sh, { lon: 12, lat: 5 }, 'shell', g0.value); for (const f of out) f.group = g0.group; return out; }
    panel([0, 0, 3, 3], top, 0, 1.2, ['front', 'right']);
    const tile = [], pitched = ['gable', 'hip', 'pyramid'].includes(el.form);
    if (pitched) G.roof(out, [0, 0, 3, 3], 1.2, { form: el.form, axis: 'x', e: el.eave * 0.4, p: el.pitch, mat: el.group, value: el.value, gableMat: top.group, gableValue: top.value, courses: el.courses ? { out: tile, course: 0.3 * ch, cap: 0.22 * ch, capGeo: true } : null });
    else if (el.form === 'flat') { for (const side of ['front', 'right']) { const Wc = wallOf([0, 0, 3, 3], side); wallQuad(out, Wc, 0, Wc.len, 1.2, 1.8, 0, 'wall', el.value, { group: el.group }); } }
    else { const Sh = G.shellAt([1.5, 1.5], 1.6, 1.6, 1.6 * (el.rise ?? 0.8), 1.2); if (el.form === 'dome') G.shellFaces(out, Sh, { lon: 12, lat: 4 }, 'roof', el.value); else for (let j = 0; j < 12; j++) { const a = (2 * Math.PI * j) / 12, b = (2 * Math.PI * (j + 1)) / 12; face(out, [[1.5 + 1.6 * Math.cos(a), 1.5 + 1.6 * Math.sin(a), 1.2], [1.5 + 1.6 * Math.cos(b), 1.5 + 1.6 * Math.sin(b), 1.2], [1.5, 1.5, 1.2 + 1.6 * (el.rise ?? 0.8)]], [Math.cos(a), Math.sin(a), 0.5], 'roof', el.value); } }
    for (const f of [...out, ...tile]) f.group ??= f.mat ?? el.group;
    return [...out, ...tile];
  }
  if (el.kind === 'chimney') { panel([0, 0, 2, 2], top, 0, 0.6, ['front', 'right']); const c = el.w * ch, r = [0.7, 0.7, 0.7 + c, 0.7 + c]; for (const side of ['front', 'right']) { const Wc = wallOf(r, side); wallQuad(out, Wc, 0, Wc.len, 0.6, 2, 0, 'wall', el.value, { group: el.group }); } face(out, [[r[0], r[1], 2], [r[2], r[1], 2], [r[2], r[3], 2], [r[0], r[3], 2]], [0, 0, 1], 'chimney', el.value, { group: el.group }); return out; }
  if (el.kind === 'point') { const n = el.count; for (let k = 0; k < n; k++) { const t = (2 * Math.PI * k) / n, p = n === 1 ? [0, 0, 0] : [0.5 * Math.cos(t), 0.5 * Math.sin(t), 0]; G.point(out, p, n === 1 ? [0, 0, 1] : unit([Math.cos(t) * 0.4, Math.sin(t) * 0.4, 1]), el.base * ch * 1.3, 1.4 * ch, 6, 'spike', el.value); } for (const f of out) f.group = el.group; return out; }
  if (el.kind === 'frame') { const rect = [0, 0, 2.7, 0.4], Wf = wallOf(rect, 'front'), mw = el.member * ch; panel(rect, top); for (const z of [0, H - mw]) wallQuad(out, Wf, 0, 2.7, z, z + mw, 0.012, 'frame', el.value, { group: el.group }); for (const u of [mw / 2, 1.35, 2.7 - mw / 2]) wallQuad(out, Wf, u - mw / 2, u + mw / 2, 0, H, 0.012, 'frame', el.value, { group: el.group }); return out; }
  if (el.kind === 'shutters') return elementSwatch(anchor, Object.keys(A.elements).find((k) => A.elements[k].kind === 'light'), ch);
  if (el.kind === 'lamp') { lamp(out, el, ch); return out; }
  if (el.kind === 'post') { for (let k = 0; k < 3; k++) { const o = []; post(o, el, ch); out.push(...o.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x + k * el.stride * 0.4), y, z]) }))); } return out; }
  if (el.kind === 'fence') { fence(out, 4.4, el, ch); return out; }
  if (el.kind === 'footway') { section(out, 3, 2.4, A.street); return out; }
  // the road on its own, its joints; the kerb close up, a little road before it and a little walk behind
  if (el.kind === 'road') { const tmp = []; section(tmp, 3, 2.4, A.street); return tmp.filter((f) => f.corners.every((c) => c[1] <= 1e-9 && c[2] < 0.01)); }
  if (el.kind === 'kerb') { const S2 = { ...A.street, footway: { ...A.street.footway, w: A.street.kerb.w + 0.35 } }; section(out, 1.2, 0.5, S2); return out; }
  return out;
}

/** The slice: the citizen's street in front of it, `len` along the frontage, its lamp and posts on the footway. */
export function sliceStreet(anchor, len = 14, ch = 1.2) {
  const A = composeAnchor(anchor), S = A.street, out = [];
  const { top, foot } = section(out, len, 3, S);
  const at = (faces, dx, dy) => faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x + dx), r3(y + dy), r3(z + top)]) }));
  const L = []; lamp(L, S.lamp, ch); out.push(...at(L, len * 0.78, S.kerb.w + 0.4).map((f) => ({ ...f, corners: f.corners })));
  for (const x of [1.2, 1.2 + S.post.stride]) { const P = []; post(P, S.post, ch); out.push(...at(P, x, S.kerb.w + 0.3)); }
  return { faces: out, foot, top };
}

void add3;
