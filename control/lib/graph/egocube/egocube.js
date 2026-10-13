/**
 * THE EGOCUBE: one character, rolled, written out as design notes for the visual outcome (docs/egocube.md). It builds
 * nothing and sets no dial: the sheet says what the face, the stance, the silhouette and the dress should carry, and
 * names the dials that can carry it; the character loop decides the amounts.
 *
 *   readEgocube(spec)                                  throws on an unknown facet or value, naming the known ones
 *   rollEgocube({ brief?, facets?, seed = 1, path })   → the sheet
 *
 * A facet is decided by, in order: an explicit `facets` entry, a brief word (lexicon.js), the seed. Every facet throws
 * its die whether or not it is used, so fixing one never moves another. A roll that breaks a FAULT is drawn again on
 * the next attempt seed (up to MAX_ATTEMPTS); a fault among asked facets only (explicit or a brief word) is the
 * operator's and is kept, marked `held`. Pure and deterministic: the same arguments, the same sheet, byte for byte.
 *
 * The blend: motivation m (0 selfless … 1 self-serving) reads the archetype at t = smoothstep(0.25, 0.85, m): its light
 * below a third, its shadow above two thirds, both between (turning). Age scales the face-of-life channels by the
 * band's `life`; under 0.2 only the age's own notes reach them (a child's face is not yet drawn). Ancestry is born and
 * is never scaled (ancestry.js): a human ancestry is a range of colouring and hair; a lineage, a band of humanity with
 * cues from the creature loop's passes, and below its door the body is the creature loop's, not the hero door's.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { CHANNEL_IDS, FACE_OF_LIFE, readDerive, dialKey } from './channels.js';
import { AGES, POLES, BUILDS, ROLES, ARCHETYPES, ARCHETYPE_IDS, MOTIVES, ORDERS } from './facets.js';
import { readBrief } from './lexicon.js';
import { HUMAN_IDS, LINEAGES, ancestryIds, readLineage, resolveAncestry } from './ancestry.js';

export const MAX_ATTEMPTS = 8;
export const SPEC_KEYS = Object.freeze(['age', 'pole', 'ancestry', 'humanity', 'build', 'role', 'archetype', 'motivation', 'order']);

/**
 * The seed's priors: weights per value (an absent value weighs 0). Motivation and order are uniform on [0, 1]. A blind
 * roll is human: a non-human people is the world's decision (a faction), so a lineage comes only by ask.
 */
export const PRIORS = Object.freeze({
  age: { child: 0.05, youth: 0.25, adult: 0.35, seasoned: 0.25, elder: 0.1 },
  pole: { male: 0.5, female: 0.5 },
  build: { lithe: 0.2, canonical: 0.3, heroic: 0.25, stout: 0.15, brute: 0.1 },
  role: Object.fromEntries(Object.keys(ROLES).map((r) => [r, 1])),
  archetype: Object.fromEntries(ARCHETYPE_IDS.map((a) => [a, 1])),
  ancestry: Object.fromEntries(HUMAN_IDS.map((a) => [a, 1])),
});

/** Incoherent rolls: drawn again unless every facet in `on` was asked for. A table to grow at the eyes gate. */
export const FAULTS = Object.freeze([
  { id: 'child-shadow', on: ['age', 'motivation'], when: (f) => f.age === 'child' && f.motivation > 0.5,
    why: 'a child does not carry a lifetime of self-serving: that is a brief, not a roll' },
  { id: 'bound-outlaw', on: ['archetype', 'order'], when: (f) => f.archetype === 'outlaw' && f.order < 0.2,
    why: 'an outlaw bound by a code (the honourable thief) is a brief, not a roll' },
  { id: 'lineage-build', on: ['ancestry', 'build'], when: (f, lineages) => !((lineages[f.ancestry] || LINEAGES[f.ancestry])?.builds?.includes(f.build) ?? true),
    why: 'a people built otherwise than its kind (a stout elf) is a brief, not a roll' },
  { id: 'selfless-free-ruler', on: ['archetype', 'order', 'motivation'], when: (f) => f.archetype === 'ruler' && f.order > 0.8 && f.motivation < 0.5,
    why: 'a ruler who answers to no rule and serves others is a brief, not a roll' },
]);

const KNOWN = { age: Object.keys(AGES), pole: POLES, build: Object.keys(BUILDS), role: Object.keys(ROLES), archetype: ARCHETYPE_IDS };

export function readEgocube(spec = {}, lineages = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('egocube: the facets are an object');
  const known = { ...KNOWN, ancestry: ancestryIds(lineages) };
  for (const [k, v] of Object.entries(spec)) {
    if (!SPEC_KEYS.includes(k)) throw new Error(`egocube: unknown facet '${k}' (known: ${SPEC_KEYS.join(', ')})`);
    if (k === 'motivation' || k === 'order' || k === 'humanity') {
      if (typeof v !== 'number' || !(v >= 0 && v <= 1)) throw new Error(`egocube: ${k} is a number 0 … 1 (got ${JSON.stringify(v)})`);
    } else if (!known[k].includes(v)) throw new Error(`egocube: unknown ${k} '${v}' (known: ${known[k].join(', ')})`);
  }
  return spec;
}

/** A string to a 32-bit seed (FNV-1a). */
function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function pick(rand, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
  return entries[entries.length - 1][0];
}
const unit = (rand) => Math.round(rand() * 100) / 100;

/** Every facet's die, thrown in a fixed order; a new facet's die goes last, so an old seed rolls the old character. */
function throwDice(rand) {
  return {
    age: pick(rand, PRIORS.age), pole: pick(rand, PRIORS.pole), build: pick(rand, PRIORS.build),
    role: pick(rand, PRIORS.role), archetype: pick(rand, PRIORS.archetype), motivation: unit(rand), order: unit(rand),
    ancestry: pick(rand, PRIORS.ancestry), humanity: unit(rand),
  };
}

/** A lineage's humanity: the die placed in its band, unless asked. A human is 1. */
function humanityOf(f, asked, lineages) {
  const lin = lineages[f.ancestry] || LINEAGES[f.ancestry];
  if (!lin) return 1;
  if (asked.has('humanity')) return f.humanity;
  const [lo, hi] = lin.humanity;
  return Math.round((lo + f.humanity * (hi - lo)) * 100) / 100;
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The archetype's reading at motivation m: { t, reads: light | turning | shadow }. */
export function archetypeReading(m) {
  const t = Math.round(smoothstep(0.25, 0.85, m) * 1000) / 1000;
  return { t, reads: t < 1 / 3 ? 'light' : t > 2 / 3 ? 'shadow' : 'turning' };
}

/** The sources of a sheet's notes, highest priority first: { from, notes, derives }. */
function sources(f, anc) {
  const arch = ARCHETYPES[f.archetype], reading = archetypeReading(f.motivation);
  const out = [];
  const light = { from: `archetype.${f.archetype}`, ...arch.light }, shadow = { from: `archetype.${f.archetype}/shadow`, ...arch.shadow };
  if (reading.reads === 'light') out.push(light);
  else if (reading.reads === 'shadow') out.push(shadow);
  else out.push(...(reading.t >= 0.5 ? [shadow, light] : [light, shadow]));
  const motive = MOTIVES.find((b) => f.motivation <= b.upTo);
  out.push({ from: `motive.${motive.reads}`, ...motive });
  out.push({ from: `role.${f.role}`, ...ROLES[f.role] });
  if (f.order < 1 / 3) out.push({ from: 'order.bound', ...ORDERS.bound });
  else if (f.order > 2 / 3) out.push({ from: 'order.free', ...ORDERS.free });
  out.push({ from: `age.${f.age}`, ...AGES[f.age] });
  out.push({ from: `ancestry.${f.ancestry}`, notes: anc.notes, derives: anc.derives });
  if (f.age !== 'child') out.push({ from: `build.${f.build}`, ...BUILDS[f.build] });   // the child cast replaces the build
  return out;
}

const lines = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** Merge the sources per channel: notes in priority order; each dial once, its highest-priority direction or word. */
function compose(f, anc) {
  const life = AGES[f.age].life;
  const notes = {}, derives = {}, claimed = new Set();
  for (const src of sources(f, anc)) {
    const own = src.from.startsWith('age.') || src.from.startsWith('ancestry.');   // born: never scaled by the life
    for (const ch of CHANNEL_IDS) {
      if (FACE_OF_LIFE.includes(ch) && !own && life < 0.2) continue;
      for (const line of lines(src.notes?.[ch])) (notes[ch] ||= []).push({ line, from: src.from });
      for (const d of lines(src.derives?.[ch])) {
        const key = dialKey(readDerive(d));
        if (claimed.has(key)) continue;
        claimed.add(key);
        (derives[ch] ||= []).push(d);
      }
    }
  }
  const ordered = (o) => Object.fromEntries(CHANNEL_IDS.filter((c) => o[c]).map((c) => [c, o[c]]));
  return { notes: ordered(notes), derives: ordered(derives) };
}

function summary(f, anc) {
  const arch = ARCHETYPES[f.archetype], reading = archetypeReading(f.motivation);
  const archLine = reading.reads === 'light' ? arch.light.reads
    : reading.reads === 'shadow' ? `${arch.shadow.name}: ${arch.shadow.reads} (the ${f.archetype}'s shadow)`
      : `${arch.light.reads}, turning toward ${arch.shadow.name}`;
  const order = f.order < 1 / 3 ? ORDERS.bound.reads : f.order > 2 / 3 ? ORDERS.free.reads : null;
  return [AGES[f.age].reads, `${f.pole}; ${anc.reads}; ${f.age === 'child' ? 'the child cast' : BUILDS[f.build].reads}`, ROLES[f.role].reads, archLine,
    `motivation ${f.motivation}: ${MOTIVES.find((b) => f.motivation <= b.upTo).reads}`, ...(order ? [order] : [])];
}

/** Roll one Egocube. `path` names it in a cast (the anchor is 'hero' by default); it keys the seed. */
export function rollEgocube({ brief = '', facets = {}, seed = 1, path = 'hero', lineages = {} } = {}) {
  for (const [id, lin] of Object.entries(lineages)) readLineage(id, lin);
  readEgocube(facets, lineages);
  const fromBrief = readBrief(brief);
  readEgocube(fromBrief.facets);
  const given = { ...fromBrief.facets, ...facets };
  const asked = new Set(Object.keys(given));   // a brief word is an ask too
  let f, attempt = 0, broken = [];
  for (; attempt < MAX_ATTEMPTS; attempt++) {
    f = { ...throwDice(mulberry32(hashSeed(`${seed}::egocube::${path}::${attempt}`))), ...given };
    broken = FAULTS.filter((x) => x.when(f, lineages));
    if (broken.every((x) => x.on.every((k) => asked.has(k)))) break;   // none, or only the operator's own
  }
  if (attempt === MAX_ATTEMPTS) attempt -= 1;
  f.humanity = humanityOf(f, asked, lineages);
  const anc = resolveAncestry(f.ancestry, mulberry32(hashSeed(`${seed}::egocube::${path}::${attempt}::ancestry`)), f.humanity, lineages);
  const reading = archetypeReading(f.motivation);
  const { notes, derives } = compose(f, anc);
  const facetsOut = Object.fromEntries(SPEC_KEYS.map((k) => [k, f[k]]));
  return {
    path, seed, attempt,
    facets: facetsOut,
    given: SPEC_KEYS.filter((k) => k in given),
    reading: { archetype: f.archetype, shadow: ARCHETYPES[f.archetype].shadow.name, ...reading },
    ancestry: { id: f.ancestry, kind: anc.kind, reads: anc.reads, door: anc.door, colours: anc.colours, ...(anc.plan && Object.keys(anc.plan).length ? { plan: anc.plan } : {}) },
    reads: summary(f, anc),
    notes, derives,
    unread: { words: fromBrief.unread, channels: Object.keys(notes).filter((c) => !derives[c] && !(c === 'colouring' && anc.colours.Skin)) },   // the swatches carry colouring
    gaps: anc.gaps,
    faults: broken.map((x) => ({ id: x.id, why: x.why, held: x.on.every((k) => asked.has(k)) })),
  };
}
