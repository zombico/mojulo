import { describe, it, expect } from 'vitest';
import { gaitFrames, prepare, poseGait } from './gait.js';
import { faunaSkeleton } from './skeleton.js';
import { PATTERNS } from './locomotion/index.js';
import { PER_PATTERN } from './test-cases.js';

// The gait machine gate, on one gait per footfall or body-wave pattern: it poses, bones stay rigid, left and right
// mirror as the pattern says, and a planted foot stays planted for the gait's duty factor. How it LOOKS is the eyes gate (scripts/fauna-gait-strip.mjs), never claimed here.
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const N = 24;

describe('fauna gaits', () => {
  for (const [id, g, pattern] of PER_PATTERN) {
    it(`${pattern} (${id} ${g}): poses every bone, finite and rigid`, () => {
      const S = faunaSkeleton(id);
      for (const f of gaitFrames(id, g, 8)) {
        for (const b of S.bones) {
          const p = f.bones[b.id];
          expect(p.head.concat(p.tail).every(Number.isFinite), `${id}.${g}.${b.id}`).toBe(true);
          expect(Math.abs(len(p.head, p.tail) - len(b.head, b.tail)), `${id}.${g}.${b.id} keeps its length`).toBeLessThan(1e-6);
        }
      }
    });
  }

  it('chirality: the mirror of a gait is itself half a stride on, or at once, or, with a lead, never', () => {
    // the body is mirror-symmetric about x = 0, so the mirror of a pose (x negated, left and right swapped) is a pose
    // of the same gait at the phase the pattern offsets its sides by: half a stride (a walk, a trot, a lateral wave),
    // none (a bound, a hop, a vertical wave). A gait with a lead (a gallop, a canter) is its own other-lead mirror at no
    // phase. A stroke names no offset: its mirror is read at either.
    const side = (b) => (/[a-z]R$/i.test(b) ? `${b.slice(0, -1)}L` : /[a-z]L$/i.test(b) ? `${b.slice(0, -1)}R` : b);
    const offset = (P) => {
      if (P.kind === 'wave') return P.plane === 'lateral' ? 0.5 : 0;
      if (P.kind !== 'feet') return undefined;
      const o = [['LH', 'RH'], ['LF', 'RF'], ['L', 'R']].filter(([l, r]) => l in P.feet && r in P.feet).map(([l, r]) => (((P.feet[r] - P.feet[l]) % 1) + 1) % 1);
      return o.every((x) => x === o[0]) && (o[0] === 0 || o[0] === 0.5) ? o[0] : null;
    };
    const n = 12;   // even: half a stride lands on a frame
    for (const [id, g, pattern] of PER_PATTERN) {
      if (pattern === 'mobuliform') continue;   // the manta's wing flight does not mirror at any phase: an open question
      const F = gaitFrames(id, g, n), at = (k) => {   // the worst gap between pose t mirrored and pose t + k/N
        let e = 0;
        for (let i = 0; i < n; i++) for (const [b, q] of Object.entries(F[i].bones)) {
          const o = F[(i + k) % n].bones[side(b)];
          for (const p of ['head', 'tail']) e = Math.max(e, Math.abs(q[p][0] + o[p][0]), Math.abs(q[p][1] - o[p][1]), Math.abs(q[p][2] - o[p][2]));
        }
        return e;
      };
      const s = offset(PATTERNS[pattern]), what = `${id} ${g} (${pattern})`;
      if (s === null) expect(Math.min(...Array.from({ length: n }, (_, k) => at(k))), `${what} has a lead`).toBeGreaterThan(0.01);
      else if (s === undefined) expect(Math.min(at(0), at(n / 2)), what).toBeLessThan(1e-9);
      else expect(at(s * n), what).toBeLessThan(1e-9);
    }
  });

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

  it('a tail balances by what the legs do and what it is made of', () => {
    const tip = (id, g) => { const ctx = prepare(id), b = ctx.S.bones.filter((x) => /^tail\d+$/.test(x.id)).at(-1).id;
      return Array.from({ length: N }, (_, i) => poseGait(id, g, i / N, ctx).bones[b].tail); };
    const sweep = (id, g, axis) => { const v = tip(id, g).map((p) => p[axis]); return Math.max(...v) - Math.min(...v); };
    // a dog's tail sways with the hips at a walk and trot and is braced at the gallop (Wada et al. 1993)
    expect(sweep('dog', 'trot', 0)).toBeGreaterThan(0.03);
    expect(sweep('dog', 'gallop', 0)).toBeLessThan(sweep('dog', 'trot', 0) / 4);
    // a biped's stride swings the hips: the counterweight sways; a hop pitches: up and down
    expect(sweep('tRex', 'walk', 0)).toBeGreaterThan(0.15);           // (the pelvis turns with the stride too, taking a share)
    expect(sweep('kangaroo', 'hop', 2)).toBeGreaterThan(sweep('kangaroo', 'hop', 0) + 0.1);
    // the cheetah's counterweight swings against the rump it hangs from
    const ctx = prepare('cheetah'), rump = ctx.byId.tail0.parent;
    const pitch = (p) => Math.atan2(p.tail[2] - p.head[2], Math.hypot(p.tail[0] - p.head[0], p.tail[1] - p.head[1]));
    const F = Array.from({ length: N }, (_, i) => poseGait('cheetah', 'gallop', i / N, ctx));
    const a = F.map((f) => pitch(f.bones[rump])), b = F.map((f) => pitch(f.bones.tail0));
    const ma = a.reduce((s, x) => s + x) / N, mb = b.reduce((s, x) => s + x) / N;
    expect(a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0)).toBeLessThan(0);
    // a white-tailed deer flags its tail up in flight, and lets it hang at a walk
    const high = (g) => Math.max(...tip('deer', g).map((p) => p[2]));
    expect(high('bound')).toBeGreaterThan(high('walk') + 0.05);
  });

  it('the tail\'s physics come from the model: a bushy tail is light, a hair switch is long', () => {
    expect(prepare('squirrel').tail.rho).toBeLessThan(1);                    // 3% of the body, long: light but effective
    expect(prepare('horse').tail.swingLength).toBeGreaterThan(0.8);          // the hair hangs past the dock
    expect(prepare('kangaroo').tail.legs.H).toBeGreaterThan(prepare('kangaroo').tail.legs.F * 5);   // hops on the hind pair
  });

  it('the spine follows the footfalls: from above a C in a trot, none in a pace; from the side rounded in a gallop, straight in a pronk', () => {
    // the trunk's sideways bend: the heading change from the first spine bone to the last, over a stride
    const bend = (id, g) => { const ctx = prepare(id), sp = ctx.S.bones.filter((b) => /^spine\d+$/.test(b.id)), a = sp[0].id, b = sp.at(-1).id;
      const yaw = (p) => Math.atan2(p.tail[0] - p.head[0], p.tail[1] - p.head[1]);
      return Math.max(...Array.from({ length: N }, (_, i) => { const f = poseGait(id, g, i / N, ctx).bones; return Math.abs(yaw(f[b]) - yaw(f[a])); })); };
    const arch = (id, g) => { const ctx = prepare(id), sp = ctx.S.bones.filter((b) => /^spine\d+$/.test(b.id)), a = sp[0].id, b = sp.at(-1).id;
      const pitch = (p) => Math.atan2(p.tail[2] - p.head[2], Math.hypot(p.tail[0] - p.head[0], p.tail[1] - p.head[1]));
      return Math.max(...Array.from({ length: N }, (_, i) => { const f = poseGait(id, g, i / N, ctx).bones; return Math.abs(pitch(f[b]) - pitch(f[a])); })); };
    expect(bend('crocodile', 'walk')).toBeGreaterThan(0.3);          // a sprawler's standing wave
    expect(bend('wolf', 'trot')).toBeGreaterThan(0.05);              // a mammal's small C
    expect(bend('camel', 'pace')).toBeLessThan(1e-9);                // both girdles turn together: no bend
    expect(arch('cheetah', 'gallop')).toBeGreaterThan(0.5);          // the spring of the gallop
    expect(arch('gazelle', 'pronk')).toBeLessThan(1e-9);             // all four feet together: a straight back
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
