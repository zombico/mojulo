import { describe, it, expect } from 'vitest';
import { GAITS, PATTERNS, RIGS, LOCOMOTION, TAILS, locomotionFor, gaitWords } from './index.js';
import { FAMILIES, FAMILY_SPECIES } from '../families.js';
import { speciesPlan } from '../species.js';
import { animalEntryCards } from '../entries.js';

// The locomotion contract: every animal says how it moves, in plain words over a real mechanism.
const AXIAL_HEAD = ['steady', 'nod', 'thrust', 'sway', 'reach'];
const AXIAL_TAIL = Object.keys(TAILS);
const WAVES = ['none', 'standing', 'travelling'];
const unit = (v) => typeof v === 'number' && v >= 0 && v <= 1;

describe('locomotion: the vocabulary', () => {
  it('every footfall pattern has phases in [0, 1) and starts a foot at 0', () => {
    for (const [k, p] of Object.entries(PATTERNS)) {
      expect(['feet', 'wave', 'stroke'], k).toContain(p.kind);
      if (p.kind !== 'feet') continue;
      const ph = Object.values(p.feet);
      for (const v of ph) expect(v >= 0 && v < 1, `${k}: ${v}`).toBe(true);
      expect(Math.min(...ph), k).toBe(0);
    }
  });

  it('every tail word says what it does and carries its mechanics', () => {
    for (const [k, T] of Object.entries(TAILS)) {
      expect(k === 'none' ? T.line === null : typeof T.line === 'string' && T.line.length > 0, k).toBe(true);
      expect(unit(T.gain), k).toBe(true);
      if (T.gain) expect(unit(T.lag) && T.whip >= 0, k).toBe(true);
    }
    expect(locomotionFor('macropod', 'kangaroo').axial.tail).toBe('prop');
  });

  it('wave patterns carry their numbers', () => {
    for (const [k, p] of Object.entries(PATTERNS)) if (p.kind === 'wave') {
      expect(p.waves > 0 && unit(p.amp) && unit(p.from), k).toBe(true);
      expect(['lateral', 'vertical'], k).toContain(p.plane);
    }
  });
});

describe('locomotion: the families', () => {
  it('every built family has an entry, and every entry is a built family', () => {
    expect(Object.keys(LOCOMOTION).sort()).toEqual(Object.keys(FAMILIES).sort());
  });

  for (const [family, e] of Object.entries(LOCOMOTION)) {
    it(`${family}: a rig, fixed spine counts, real gaits, an axial ride, a note and a source`, () => {
      expect(RIGS[e.rig], `${family}.rig`).toBeDefined();
      for (const k of ['trunk', 'neck', 'tail']) expect(Number.isInteger(e.spine[k]) && e.spine[k] >= 0, `${family}.spine.${k}`).toBe(true);
      expect(typeof e.note === 'string' && e.note.length > 0 && typeof e.source === 'string' && e.source.length > 0).toBe(true);
      for (const id of Object.keys(e.species || {})) expect(FAMILY_SPECIES[id]?.family, `${family}.species.${id} is not in the family`).toBe(family);
    });
  }

  for (const [id, s] of Object.entries(FAMILY_SPECIES)) {
    it(`${id}: its merged gaits name a plain word over a known pattern, with sane numbers`, () => {
      const L = locomotionFor(s.family, id);
      expect(RIGS[L.rig], `${id}.rig`).toBeDefined();
      const words = Object.keys(L.gaits);
      expect(words.length, `${id} has no gaits`).toBeGreaterThan(0);
      for (const w of words) {
        const g = L.gaits[w];
        expect(GAITS[w], `${id}: '${w}' is not a plain gait word`).toBeDefined();
        const P = PATTERNS[g.pattern];
        expect(P, `${id}.${w}: unknown pattern '${g.pattern}'`).toBeDefined();
        if (P.kind === 'feet' && !g.bottomWalk) {
          expect(g.duty > 0 && g.duty < 1, `${id}.${w}.duty`).toBe(true);
          expect(g.stride > 0, `${id}.${w}.stride`).toBe(true);
          expect(Array.isArray(g.fr) && g.fr[0] < g.fr[1], `${id}.${w}.fr`).toBe(true);
        }
      }
      const A = L.axial;
      for (const k of ['flex', 'lateral', 'roll', 'yaw']) expect(unit(A[k]), `${id}.axial.${k}`).toBe(true);
      expect(WAVES).toContain(A.wave);
      expect(AXIAL_HEAD).toContain(A.head);
      expect(AXIAL_TAIL).toContain(A.tail);
    });
  }

  it('the walking gaits are listed slowest first by speed band', () => {
    for (const [id, s] of Object.entries(FAMILY_SPECIES)) {
      const bands = Object.values(locomotionFor(s.family, id).gaits).filter((g) => g.fr).map((g) => g.fr[0]);
      // stalk/crawl/walk can share a floor of 0; past that, each gait starts no slower than the one before
      for (let i = 1; i < bands.length; i++) expect(bands[i] >= bands[i - 1], `${id}: ${bands}`).toBe(true);
    }
  });

  it('a few readings the biomechanics insists on', () => {
    expect(locomotionFor('feline', 'cheetah').gaits.gallop.pattern).toBe('rotaryGallop');
    expect(locomotionFor('equine', 'horse').gaits.gallop.pattern).toBe('transverseGallop');
    expect(gaitWords('equine', 'camel')).toContain('pace');
    expect(gaitWords('pachyderm', 'elephant')).toEqual(['walk', 'amble']);   // never a flight phase
    expect(locomotionFor('primate', 'chimpanzee').gaits.walk.pattern).toBe('diagonalWalk');
    expect(locomotionFor('squamate', 'monitorLizard').rig).toBe('sprawling');
    expect(locomotionFor('squamate', 'rattlesnake').gaits.sidewind).toBeDefined();
    expect(locomotionFor('teleost', 'morayEel').gaits.swim.pattern).toBe('anguilliform');
    expect(locomotionFor('chondrichthyan', 'mantaRay').gaits.fly.pattern).toBe('mobuliform');
    expect(PATTERNS.flipperFlight.phase).toBe(0.5);                          // the plesiosaur's hind pair half a beat behind
  });
});

describe('locomotion: what it touches', () => {
  it('the gaits reach every species card as MOVES, inside the ceiling', () => {
    const byId = new Map(animalEntryCards().map((c) => [c.id, c]));
    for (const [id, s] of Object.entries(FAMILY_SPECIES)) {
      expect(byId.get(`animal/${id}`).body, id).toContain(`MOVES    ${gaitWords(s.family, id).join(', ')}`);
      const tail = TAILS[locomotionFor(s.family, id).axial.tail].line;
      if (tail) expect(byId.get(`animal/${id}`).body, id).toContain(`TAIL     ${tail}`);
    }
  });

  it('no plan carries it: locomotion is data beside the build, not in it', () => {
    for (const id of Object.keys(FAMILY_SPECIES)) {
      const plan = JSON.stringify(speciesPlan(id));
      expect(plan.includes('"gaits"') || plan.includes('"locomotion"'), id).toBe(false);
    }
  });
});
