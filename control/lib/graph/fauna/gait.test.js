import { describe, it, expect } from 'vitest';
import { gaitFrames, prepare, poseGait } from './gait.js';
import { faunaSkeleton } from './skeleton.js';
import { SPECIES } from './species.js';
import { locomotionFor, PATTERNS } from './locomotion/index.js';

// The gait machine gate: every gait of every animal poses, bones stay rigid, and a planted foot stays planted for
// the gait's duty factor. How it LOOKS is the eyes gate (scripts/fauna-gait-strip.mjs), never claimed here.
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const N = 24;

describe('fauna gaits', () => {
  for (const id of Object.keys(SPECIES)) {
    const L = locomotionFor(SPECIES[id].family, id);
    it(`${id}: every gait poses every bone, finite and rigid (${Object.keys(L.gaits).join(', ')})`, () => {
      const S = faunaSkeleton(id);
      for (const g of Object.keys(L.gaits)) {
        for (const f of gaitFrames(id, g, 8)) {
          for (const b of S.bones) {
            const p = f.bones[b.id];
            expect(p.head.concat(p.tail).every(Number.isFinite), `${id}.${g}.${b.id}`).toBe(true);
            expect(Math.abs(len(p.head, p.tail) - len(b.head, b.tail)), `${id}.${g}.${b.id} keeps its length`).toBeLessThan(1e-6);
          }
        }
      }
    });
  }

  it('a planted foot stays planted, for the duty factor of its gait', () => {
    const cases = [['wolf', 'walk'], ['wolf', 'trot'], ['horse', 'walk'], ['elephant', 'walk'], ['brownBear', 'walk'], ['crocodile', 'walk'], ['chicken', 'walk']];
    for (const [id, g] of cases) {
      const ctx = prepare(id), gait = ctx.L.gaits[g];
      const S = faunaSkeleton(id), by = Object.fromEntries(S.bones.map((b) => [b.id, b]));
      for (const [fk] of Object.entries(PATTERNS[gait.pattern].feet)) {
        const chain = ctx.limbs[fk === 'L' ? 'LH' : fk === 'R' ? 'RH' : fk]; if (!chain) continue;
        const foot = chain[chain.length - 1], restZ = by[foot].tail[2];
        const down = Array.from({ length: N }, (_, i) => poseGait(id, g, i / N, ctx)).map((f) => Math.abs(f.bones[foot].tail[2] - restZ) < 1e-3);
        const measured = down.filter(Boolean).length / N;
        expect(Math.abs(measured - gait.duty), `${id} ${g} ${fk}: down ${measured} vs duty ${gait.duty}`).toBeLessThanOrEqual(1.5 / N);
      }
    }
  });

  it('is deterministic', () => {
    for (const [id, g] of [['cheetah', 'gallop'], ['snake', 'slither'], ['kangaroo', 'hop'], ['salmon', 'swim']]) {
      expect(JSON.stringify(gaitFrames(id, g, 6))).toBe(JSON.stringify(gaitFrames(id, g, 6)));
    }
  });

  it('an unknown gait names the ones the animal has', () => {
    expect(() => poseGait('elephant', 'gallop', 0)).toThrow(/walk, amble/);
  });
});
