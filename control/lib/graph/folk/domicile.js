/**
 * THE DOMICILE: who lives in a house. Its unit is the DWELLER, the lot's first person, and the house is the people round
 * them, written as the egocube cast writes a request (docs/egocube.md: H + 0, H + R, H + Pn):
 *
 *   D + 0              alone          the dweller lives alone
 *   D + P              couple         with a partner
 *   D of F (P + Cx)    family         with a partner and x children (also written D + P + Cx)
 *
 *   SHAPES                              the three, each { reads, partner, children }
 *   readDomicile(words)                 → { shape, children } from a notation or { shape, children? }; throws, teaching
 *   notationOf(d)                       → 'D + 0' | 'D + P' | 'D of F (P + C2)'
 *   rollDomicile(age, rand, band?)      → { shape, children } for a dweller of that age band, on the house's own die
 *   DWELLER                             the lean on a dweller's own roll: a house is not headed by a child
 *   partnerLean(age) / childLean(age)   the age a partner and a child lean to, from the dweller's
 *
 * The dweller's age says what a house can be: a youth lives alone or with a partner, an adult or a seasoned dweller
 * most often has a family, an elder's children have mostly grown and gone. Children are always younger than the
 * dweller, and share the dweller's ancestry (the born channel); a partner is near the dweller's age and their own
 * person. A partner's body pole is rolled as any person's: a house leans on no one's pairing. An asked shape is the
 * operator's and is kept, whatever the age.
 *
 * First readings, for the eyes gate. Pure and deterministic.
 */
import { AGES } from '../egocube/facets.js';

const R = (o) => Object.freeze(o);
const BANDS = Object.keys(AGES);

export const SHAPES = Object.freeze({
  alone: R({ reads: 'the dweller lives alone', partner: false, children: false }),
  couple: R({ reads: 'the dweller and a partner', partner: true, children: false }),
  family: R({ reads: 'the dweller, a partner and their children', partner: true, children: true }),
});
export const SHAPE_IDS = Object.freeze(Object.keys(SHAPES));
export const MAX_CHILDREN = 4;

/** The odds of each shape by the dweller's age band (a child heads no house: DWELLER). */
export const SHAPE_ODDS = Object.freeze({
  child: R({ alone: 1, couple: 0, family: 0 }),
  youth: R({ alone: 6, couple: 3, family: 0 }),
  adult: R({ alone: 2, couple: 3, family: 5 }),
  seasoned: R({ alone: 2, couple: 3, family: 5 }),
  elder: R({ alone: 5, couple: 4, family: 1 }),
});

/** The lean on a dweller's own roll, over its role's. */
export const DWELLER = Object.freeze({ age: Object.freeze({ child: 0, youth: 0.6 }) });

const WORDS = [
  [/^D\s*\+\s*0$/i, () => ({ shape: 'alone', children: 0 })],
  [/^D\s*\+\s*P$/i, () => ({ shape: 'couple', children: 0 })],
  [/^D\s*of\s*F\s*\(\s*P\s*\+\s*C\s*(\d+)\s*\)$/i, (m) => ({ shape: 'family', children: +m[1] })],
  [/^D\s*\+\s*P\s*\+\s*C\s*(\d+)$/i, (m) => ({ shape: 'family', children: +m[1] })],
];
const TEACH = `a domicile is 'D + 0' (alone), 'D + P' (with a partner) or 'D of F (P + Cx)' (a family of x children, 1 to ${MAX_CHILDREN}), or { shape: ${SHAPE_IDS.join(' | ')}, children? }`;

/** A domicile asked for, as notation or words. */
export function readDomicile(words) {
  let d = null;
  if (typeof words === 'string') { for (const [re, f] of WORDS) { const m = words.trim().match(re); if (m) { d = f(m); break; } } }
  else if (words && typeof words === 'object' && !Array.isArray(words)) {
    for (const k of Object.keys(words)) if (k !== 'shape' && k !== 'children') throw new Error(`domicile: '${k}' is not a domicile word (shape, children)`);
    if (!SHAPES[words.shape]) throw new Error(`domicile: shape is ${SHAPE_IDS.join(', ')} (got ${JSON.stringify(words.shape)})`);
    d = { shape: words.shape, children: words.shape === 'family' ? words.children ?? 1 : 0 };
    if (words.children !== undefined && words.shape !== 'family') throw new Error(`domicile: only a family has children (${notationOf({ shape: words.shape })} has none)`);
  }
  if (!d) throw new Error(`domicile: ${TEACH} (got ${JSON.stringify(words)})`);
  if (d.shape === 'family' && !(Number.isInteger(d.children) && d.children >= 1 && d.children <= MAX_CHILDREN)) throw new Error(`domicile: a family has 1 to ${MAX_CHILDREN} children (got ${d.children})`);
  return d;
}

export const notationOf = (d) => (d.shape === 'alone' ? 'D + 0' : d.shape === 'couple' ? 'D + P' : `D of F (P + C${d.children})`);

/** A house for a dweller of this age, on the house's own die: its shape, then how many children the house has room for. */
export function rollDomicile(age, rand, band = [1, 1]) {
  const odds = SHAPE_ODDS[age] ?? SHAPE_ODDS.adult, total = SHAPE_IDS.reduce((a, s) => a + odds[s], 0);
  let u = rand() * total, shape = SHAPE_IDS[SHAPE_IDS.length - 1];
  for (const s of SHAPE_IDS) { if (u < odds[s]) { shape = s; break; } u -= odds[s]; }
  // a second die whatever the shape, so the shape's roll never moves the next house's
  const c = rand();
  if (shape !== 'family') return { shape, children: 0 };
  const room = Math.max(1, Math.min(MAX_CHILDREN, band[1] ?? 1));
  return { shape, children: Math.min(MAX_CHILDREN, 1 + Math.floor(c * (room + 1))) };
}

/** A partner near the dweller's age: the same band most often, a band either side less. */
export function partnerLean(age) {
  const i = BANDS.indexOf(age);
  return { age: Object.fromEntries(BANDS.map((b, k) => [b, k === i ? 4 : Math.abs(k - i) === 1 && b !== 'child' ? 1 : 0])) };
}

/** A child younger than the dweller: young under an adult, grown under an elder. */
export function childLean(age) {
  const W = { child: { child: 1 }, youth: { child: 1 }, adult: { child: 4, youth: 1 }, seasoned: { child: 2, youth: 3, adult: 1 }, elder: { youth: 1, adult: 3 } };
  const w = W[age] ?? W.adult;
  return { age: Object.fromEntries(BANDS.map((b) => [b, w[b] ?? 0])) };
}
