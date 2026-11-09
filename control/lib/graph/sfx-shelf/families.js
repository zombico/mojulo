/**
 * sfx-shelf/families — the sounds the shelf builds rather than stores: a family is a procedure over dials (an
 * explosion's size, an impact's material and weight, a footstep's surface and the body making it), and a designed
 * variation is a point on its dials, not a hand-written cue. Pure: the same family and dials give the same cue, its
 * grain seeds hashed from them (never Math.random).
 *
 * A family:
 *   label    what it makes, in prose
 *   dials    { <dial>: [values…] }, each dial's values in order (an ordered dial runs light → heavy, small → huge)
 *   defaults { <dial>: value }
 *   ordered  the dials whose values run in order, with the measures that must move with them (families.laws.test.js
 *            holds each: { dial, rises?: [measure], falls?: [measure] })
 *   swells   the dial values whose sound swells rather than strikes (its crest is not held to the register's)
 *   sustain  true for a held voice (families/held.js): its build is a sustain spec driven by a control, not a cue;
 *            `idle` says whether it is silent or running at 0
 *   build(d, seed)  the cue: a beats-sfx gesture list in the realistic register (layers.js), or a held voice's spec
 *
 * A family's output for given dials is a compatibility promise, as a kernel's is: families.char.test.js pins every
 * roster row's cue. A new family is a file under `families/` and a line here; a new variation is a dial value.
 */
import { explosion } from './families/explosion.js';
import { impact } from './families/impact.js';
import { footstep } from './families/footstep.js';
import { melee } from './families/melee.js';
import { handling } from './families/handling.js';
import { projectile } from './families/projectile.js';
import { breakage } from './families/breakage.js';
import { elemental } from './families/elemental.js';
import { shield } from './families/shield.js';
import { launch } from './families/launch.js';
import { booster, engine, beam, servo, fire, charge } from './families/held.js';
import { ball, sport, crowd } from './families/sports.js';
import { tires, crash, motoring } from './families/racing.js';
import { magic, bow, interact } from './families/adventure.js';
import { platform, puzzle, tabletop, dice } from './families/play.js';
import { work, cooking } from './families/life.js';
import { heartbeat, breath, horror } from './families/horror.js';
import { build, siege, flight, brawl } from './families/war.js';
import { katana } from './families/blades.js';
import { gunshot } from './families/gunshot.js';
import { freeze } from './layers.js';

export const FAMILIES = Object.freeze({
  // combat and its world
  explosion, impact, footstep, melee, handling, projectile, breakage, elemental, shield, launch, gunshot,
  // held voices
  booster, engine, beam, servo, fire, charge,
  // by game type: sports, racing, adventure, platformers / puzzles / tables, life sims, horror, strategy / flight / brawlers
  ball, sport, crowd, tires, crash, motoring, magic, bow, interact, platform, puzzle, tabletop, dice, work, cooking,
  heartbeat, breath, horror, build, siege, flight, brawl,
  // blades
  katana,
});
export const FAMILY_NAMES = Object.freeze(Object.keys(FAMILIES));

// FNV-1a over the family and its dials: a grain's seed, the same every read.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

/** A family's dials, filled from its defaults and checked: an unknown dial or value throws, naming what it takes. */
export function familyDials(name, dials = {}) {
  const F = FAMILIES[name];
  if (!F) throw new Error(`sfx family '${name}': one of ${FAMILY_NAMES.join(', ')}`);
  const d = { ...F.defaults };
  for (const [k, v] of Object.entries(dials || {})) {
    if (!F.dials[k]) throw new Error(`sfx family '${name}' has no dial '${k}' (its dials: ${Object.keys(F.dials).join(', ')})`);
    if (!F.dials[k].includes(v)) throw new Error(`sfx family '${name}': ${k} is one of ${F.dials[k].join(', ')} (got ${JSON.stringify(v)})`);
    d[k] = v;
  }
  return d;
}

/** What a family makes at its dials, frozen: a gesture list (a cue), or a held voice's sustain spec. */
export function familyCue(name, dials = {}) {
  const d = familyDials(name, dials);
  const key = `${name}|${Object.keys(FAMILIES[name].dials).map((k) => `${k}=${d[k]}`).join('|')}`;
  const base = hash(key);
  return freeze(FAMILIES[name].build(d, (k) => (base + Math.imul(k + 1, 0x9e3779b1)) >>> 0 & 0x7fffffff));
}

/** Where a value sits on its dial, 0 for the first: what a builder scales by. */
export const at = (F, dial, value) => F.dials[dial].indexOf(value);
