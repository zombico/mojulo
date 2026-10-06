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

  it('a tail balances by what the legs do: calm in a trot, swaying against a stride, swinging against a hop', () => {
    const sweep = (id, g, axis) => { const ctx = prepare(id), tip = ctx.S.bones.filter((b) => /^tail\d+$/.test(b.id)).at(-1).id;
      const v = Array.from({ length: N }, (_, i) => poseGait(id, g, i / N, ctx).bones[tip].tail[axis]); return Math.max(...v) - Math.min(...v); };
    expect(sweep('wolf', 'trot', 0)).toBeLessThan(1e-6);            // the diagonal pairs cancel: no side-to-side spin
    expect(sweep('tRex', 'walk', 0)).toBeGreaterThan(0.3);          // a biped's stride swings the hips: the tail sways
    expect(sweep('kangaroo', 'hop', 2)).toBeGreaterThan(sweep('kangaroo', 'hop', 0) + 0.1);   // a hop pitches: up and down
    // the tail swings against the rump it hangs from (a counterweight)
    const ctx = prepare('cheetah'), root = ctx.S.bones.find((b) => b.id === 'tail0'), rump = root.parent;
    const pitch = (p) => Math.atan2(p.tail[2] - p.head[2], Math.hypot(p.tail[0] - p.head[0], p.tail[1] - p.head[1]));
    const F = Array.from({ length: N }, (_, i) => poseGait('cheetah', 'gallop', i / N, ctx));
    const a = F.map((f) => pitch(f.bones[rump])), b = F.map((f) => pitch(f.bones.tail0));
    const ma = a.reduce((s, x) => s + x) / N, mb = b.reduce((s, x) => s + x) / N;
    expect(a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0)).toBeLessThan(0);
  });

  it('a propping tail is planted while its foot is down (the kangaroo\'s slow walk)', () => {
    const ctx = prepare('kangaroo'), duty = ctx.L.gaits.crawl.duty, tails = ctx.S.bones.filter((b) => /^tail\d+$/.test(b.id));
    const low = (t) => Math.min(...tails.map((b) => poseGait('kangaroo', 'crawl', t, ctx).bones[b.id].tail[2]));
    expect(low(duty / 2)).toBeLessThan(0.01);                       // mid-stance: on the ground
    expect(low(duty + (1 - duty) / 2)).toBeGreaterThan(low(duty / 2));
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
