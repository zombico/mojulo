/**
 * THE VEHICLE SHEET: one vehicle, rolled, written out as design notes (the Egocube's method for a machine). It builds
 * nothing: the sheet says what the frame, the stance, the silhouette and the rest should carry, and names the dials that
 * can carry them (channels.js); compiling it decides the amounts.
 *
 *   readVehicleSheet(spec)                                     throws on an unknown facet or value, naming the known
 *   rollVehicleSheet({ brief?, facets?, seed = 1, path })      → the sheet
 *
 * A facet is decided by, in order: an explicit `facets` entry, a brief word (lexicon.js), the class (a realistic
 * sheet's shape, stance, cockpit, engine, motif and drive are its class's: CLASS_TRAITS), the seed. Every facet throws
 * its die whether or not it is used, so fixing one never moves another. A roll that breaks a FAULT is drawn again on the
 * next attempt seed; a fault among asked facets only is the operator's and is kept, marked `held`.
 *
 * Priority, highest first, when two facets name one dial: the class (its numbers are the world's), then the
 * silhouette, the cockpit, the engine, the stance, the era, the motif, the drive, the wear, the livery, the pole.
 * Pure and deterministic: the same arguments, the same sheet, byte for byte.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { CHANNEL_IDS, readDerive, dialKey } from './channels.js';
import { POLES, CLASS_TRAITS, CLASS_IDS, HEAVY, SILHOUETTES, STANCES, COCKPITS, ENGINES, ERAS, MOTIF_READS, DRIVES, WEARS, LIVERIES } from './facets.js';
import { readBrief } from './lexicon.js';

export const MAX_ATTEMPTS = 8;
export const SPEC_KEYS = Object.freeze(['pole', 'class', 'silhouette', 'stance', 'cockpit', 'engine', 'era', 'motif', 'drive', 'wear', 'livery', 'exaggeration']);
const TABLES = { pole: POLES, class: CLASS_TRAITS, silhouette: SILHOUETTES, stance: STANCES, cockpit: COCKPITS, engine: ENGINES, era: ERAS, motif: MOTIF_READS, drive: DRIVES, wear: WEARS, livery: LIVERIES };
/** What a realistic sheet takes from its class unless asked. */
const FROM_CLASS = Object.freeze(['silhouette', 'stance', 'cockpit', 'engine', 'motif', 'drive']);
/** Two-wheelers are not built yet: a bike's rider sits astride, another pose family. */
export const UNBUILT = Object.freeze({ dirtBike: 'a two-wheeler: its rider sits astride, a pose family not built yet' });

/** The seed's priors per pole: weights per value (absent weighs 0); exaggeration is uniform in the pole's band. */
export const PRIORS = Object.freeze({
  realistic: {
    class: { compact: 3, midsize: 3, crossover: 3, pickup: 2, van: 1, sports: 2, rally: 1, buggy: 1, trophyTruck: 0.5, straightTruck: 0.5, bus: 0.3, tractorTrailer: 0.3 },
    era: { classic: 0.15, modern: 0.75, future: 0.1 },
    wear: { pristine: 0.3, used: 0.6, battered: 0.1 },
    livery: { mono: 0.75, 'two-tone': 0.15, striped: 0.07, numbered: 0.03 },
    exaggeration: [0, 0],
  },
  racer: {
    class: { kart: 1 },
    silhouette: Object.fromEntries(Object.keys(SILHOUETTES).map((k) => [k, 1])),
    stance: { low: 0.4, level: 0.4, raised: 0.2 },
    cockpit: { open: 0.6, canopy: 0.25, closed: 0.15 },
    engine: { exposed: 0.4, oversized: 0.35, hidden: 0.25 },
    era: { vintage: 0.2, classic: 0.3, modern: 0.25, future: 0.25 },
    motif: Object.fromEntries(Object.keys(MOTIF_READS).map((k) => [k, 1])),
    drive: { rear: 0.7, all: 0.3 },
    wear: { pristine: 0.4, used: 0.4, battered: 0.2 },
    livery: { mono: 0.25, 'two-tone': 0.3, striped: 0.25, numbered: 0.2 },
    exaggeration: [0.4, 1],
  },
});

/** Incoherent rolls: drawn again unless every facet in `on` was asked for. A table to grow at the eyes gate. */
export const FAULTS = Object.freeze([
  { id: 'open-heavy', on: ['class', 'cockpit'], when: (f) => HEAVY.includes(f.class) && f.cockpit !== 'closed', why: 'a truck or a bus with an open seat is a brief, not a roll' },
  { id: 'low-offroad', on: ['class', 'stance'], when: (f) => ['buggy', 'trophyTruck', 'atv'].includes(f.class) && f.stance === 'low', why: 'an off-road machine slammed to the road is a brief, not a roll' },
  { id: 'vintage-canopy', on: ['era', 'cockpit'], when: (f) => f.era === 'vintage' && f.cockpit === 'canopy', why: 'a bubble canopy before the war is a brief, not a roll' },
  { id: 'heavy-bubble', on: ['class', 'silhouette'], when: (f) => HEAVY.includes(f.class) && ['bubble', 'needle', 'tub'].includes(f.silhouette), why: 'a truck shaped as a bubble, a needle or a tub is a brief, not a roll' },
  { id: 'hidden-oversized', on: ['engine', 'silhouette'], when: (f) => f.engine === 'oversized' && f.silhouette === 'needle', why: 'an oversized engine in a needle\'s narrow nose is a brief, not a roll' },
]);

export function readVehicleSheet(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('car-designer: the facets are an object');
  for (const [k, val] of Object.entries(spec)) {
    if (!SPEC_KEYS.includes(k)) throw new Error(`car-designer: unknown facet '${k}' (known: ${SPEC_KEYS.join(', ')})`);
    if (k === 'exaggeration') { if (typeof val !== 'number' || !(val >= 0 && val <= 1)) throw new Error(`car-designer: exaggeration is a number 0 … 1 (got ${JSON.stringify(val)})`); continue; }
    if (k === 'class' && UNBUILT[val]) throw new Error(`car-designer: class '${val}' is not built yet (${UNBUILT[val]})`);
    if (!(val in TABLES[k])) throw new Error(`car-designer: unknown ${k} '${val}' (known: ${Object.keys(TABLES[k]).join(', ')})`);
  }
  if (spec.pole === 'realistic' && spec.exaggeration > 0) throw new Error('car-designer: a realistic vehicle is true to its class: exaggeration is 0 (a racer\'s machine exaggerates)');
  return spec;
}

/** A string to a 32-bit seed (FNV-1a), as the Egocube's. */
function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function pick(rand, weights) {
  const entries = Object.entries(weights ?? {}).filter(([, w]) => w > 0);
  const r0 = rand();
  if (!entries.length) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = r0 * total;
  for (const [val, w] of entries) { if ((r -= w) < 0) return val; }
  return entries[entries.length - 1][0];
}

/** Every facet's die, thrown in a fixed order; a new facet's die goes last, so an old seed rolls the old vehicle. */
function throwDice(rand, P) {
  const out = {};
  for (const k of ['class', 'silhouette', 'stance', 'cockpit', 'engine', 'era', 'motif', 'drive', 'wear', 'livery']) out[k] = pick(rand, P[k]);
  const [lo, hi] = P.exaggeration, u = rand();
  out.exaggeration = Math.round((lo + (hi - lo) * u) * 100) / 100;
  return out;
}

/** The sources of a sheet's notes, highest priority first: { from, notes, derives }. */
function sources(f) {
  const T = CLASS_TRAITS[f.class], out = [];
  out.push({ from: `class.${f.class}`, notes: {}, derives: T.derives, reads: f.class });
  out.push({ from: `silhouette.${f.silhouette}`, ...SILHOUETTES[f.silhouette] });
  out.push({ from: `cockpit.${f.cockpit}`, ...COCKPITS[f.cockpit] });
  out.push({ from: `engine.${f.engine}`, ...ENGINES[f.engine] });
  out.push({ from: `stance.${f.stance}`, ...STANCES[f.stance] });
  out.push({ from: `era.${f.era}`, ...ERAS[f.era] });
  out.push({ from: `motif.${f.motif}`, ...MOTIF_READS[f.motif] });
  out.push({ from: `drive.${f.drive}`, ...DRIVES[f.drive] });
  out.push({ from: `wear.${f.wear}`, ...WEARS[f.wear] });
  out.push({ from: `livery.${f.livery}`, ...LIVERIES[f.livery] });
  out.push({ from: `pole.${f.pole}`, ...POLES[f.pole] });
  return out;
}

const lines = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** Merge the sources per channel: notes in priority order; each dial once, its highest-priority direction or word. */
function compose(f) {
  const notes = {}, derives = {}, claimed = new Set();
  for (const src of sources(f)) for (const ch of CHANNEL_IDS) {
    for (const line of lines(src.notes?.[ch])) (notes[ch] ||= []).push({ line, from: src.from });
    for (const d of lines(src.derives?.[ch])) {
      const key = dialKey(readDerive(d));
      if (claimed.has(key)) continue;
      claimed.add(key);
      (derives[ch] ||= []).push(d);
    }
  }
  // the class's own word, always first in the frame: the compiler starts from it
  derives.frame = [`class = ${f.class}`, ...(derives.frame ?? [])];
  const ordered = (o) => Object.fromEntries(CHANNEL_IDS.filter((c) => o[c]).map((c) => [c, o[c]]));
  return { notes: ordered(notes), derives: ordered(derives) };
}

function summary(f) {
  const out = [POLES[f.pole].reads, `${f.class}${f.pole === 'racer' ? `, exaggeration ${f.exaggeration}` : ''}`];
  for (const [k, T] of [['silhouette', SILHOUETTES], ['stance', STANCES], ['cockpit', COCKPITS], ['engine', ENGINES], ['era', ERAS], ['motif', MOTIF_READS], ['drive', DRIVES], ['wear', WEARS], ['livery', LIVERIES]]) out.push(T[f[k]].reads);
  return out;
}

/** Roll one vehicle sheet. `path` names it (a racer's machine is keyed by its driver's path); it keys the seed. */
export function rollVehicleSheet({ brief = '', facets = {}, seed = 1, path = 'vehicle' } = {}) {
  readVehicleSheet(facets);
  const fromBrief = readBrief(brief);
  const given = { ...fromBrief.facets, ...facets };
  readVehicleSheet(given);
  const asked = new Set(Object.keys(given));   // a brief word is an ask too
  const pole = given.pole ?? (given.class && given.class !== 'kart' ? 'realistic' : given.class === 'kart' ? 'racer' : 'realistic');
  const P = PRIORS[pole];
  let f, attempt = 0, broken = [];
  for (; attempt < MAX_ATTEMPTS; attempt++) {
    const dice = throwDice(mulberry32(hashSeed(`${seed}::vehicle::${path}::${attempt}`)), P);
    f = { ...dice, pole };
    if (given.class !== undefined) f.class = given.class;
    // a realistic vehicle's shape is its class's; a racer rolls its own
    if (pole === 'realistic') for (const k of FROM_CLASS) f[k] = CLASS_TRAITS[f.class][k];
    else for (const k of FROM_CLASS) f[k] ??= CLASS_TRAITS[f.class][k];
    if (pole === 'realistic') { f.motif = CLASS_TRAITS[f.class].motif; f.exaggeration = 0; }
    Object.assign(f, given);
    broken = FAULTS.filter((x) => x.when(f));
    if (broken.every((x) => x.on.every((k) => asked.has(k)))) break;   // none, or only the operator's own
  }
  if (attempt === MAX_ATTEMPTS) attempt -= 1;
  const { notes, derives } = compose(f);
  return {
    path, seed, attempt, pole,
    facets: Object.fromEntries(SPEC_KEYS.map((k) => [k, f[k]])),
    given: SPEC_KEYS.filter((k) => k in given),
    reads: summary(f),
    notes, derives,
    unread: { words: fromBrief.unread, channels: Object.keys(notes).filter((c) => !derives[c]) },
    faults: broken.map((x) => ({ id: x.id, why: x.why, held: x.on.every((k) => asked.has(k)) })),
  };
}
