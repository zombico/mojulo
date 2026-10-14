// The racer pole: a cartoon racer's machine read off its driver and composed from the parts library. One driver per
// distinct reading (an innocent, an outlaw, a ruler: three bodies, three cockpits), chosen here as the procedures they
// run through: the reading names its reasons; the solver keeps suggestions and takes a pin; the machine is plausible
// (wheels on the ground at the track, every part on its mount, the driver seen, the tips behind the tail); the figure
// is a vehicle rig; the physics is derived; deterministic.
import { describe, it, expect } from 'vitest';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from './racer.js';
import { PARTS, BODIES } from './parts.js';
import { JUICE, MOTION } from './juice.js';

const driver = (archetype, extra = {}) => racerFromSheet(rollEgocube({ facets: { archetype, ...extra }, seed: 11 }), { seed: 3 });
const innocent = driver('innocent'), outlaw = driver('outlaw'), ruler = driver('ruler');
const solved = new Map([innocent, outlaw, ruler].map((R) => [R, solveRacer(R, { seed: 3 })]));
const zs = (fs) => fs.flatMap((f) => f.corners.map((c) => c[2]));

describe('the racer pole', () => {
  it('reads the machine off the driver, every facet with its reason', () => {
    expect(innocent.vehicle.facets.silhouette).toBe('bubble');
    expect(outlaw.vehicle.facets.motif).toBe('spiked');
    expect(ruler.vehicle.facets.cockpit).toBe('canopy');
    for (const R of [innocent, outlaw, ruler]) {
      expect(R.vehicle.pole).toBe('racer');
      for (const r of R.reads) expect(r.why.length, r.facet).toBeGreaterThan(3);
      expect(R.palette.base).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('chooses a part per family by fit, keeps the runners-up, and re-fits round a pin', () => {
    const S = solved.get(outlaw), fams = S.chosen.map((c) => c.family);
    for (const f of ['body', 'wheel', 'engine', 'exhaust', 'seat', 'steering', 'tail', 'hero']) expect(fams, f).toContain(f);
    expect(S.chosen.find((c) => c.family === 'body').id).toBe(Object.keys(BODIES).find((k) => BODIES[k].fits.silhouette?.needle === 3));
    expect(S.chosen.find((c) => c.family === 'hero').id).toBe('horns');
    for (const list of Object.values(S.suggestions)) for (const s of list) expect(typeof s.why).toBe('string');
    const other = Object.keys(PARTS).find((k) => PARTS[k].family === 'wheel' && k !== S.ids.wheel);
    const P = solveRacer(outlaw, { seed: 3, parts: { wheel: other } });
    expect(P.ids.wheel).toBe(other);
    expect(P.chosen.find((c) => c.family === 'wheel').why).toBe('pinned');
    expect(() => solveRacer(outlaw, { parts: { wheel: 'moon' } })).toThrow(/no wheel part 'moon'/);
  });
  it('is plausible: wheels on the ground at the track, the driver seen, the tips behind the tail, nothing in a sweep', () => {
    for (const [R, S] of solved) {
      for (const w of S.faces.wheels) expect(Math.min(...zs(w.faces)), w.bone).toBeCloseTo(0, 2);
      const rear = S.faces.wheels.filter((w) => w.bone.startsWith('wheelR')).map((w) => w.hub[0]);
      expect(Math.abs(rear[0] - rear[1])).toBeCloseTo(S.frame.T, 3);
      for (const a of S.anchors.filter((x) => x.kind === 'tip' && x.dir[1] < -0.9)) expect(a.at[1]).toBeLessThan(S.frame.tailY);
      const hard = S.laws.filter((l) => ['touches', 'wheel-clear', 'budget'].includes(l.law));
      expect(hard, R.archetype).toEqual([]);
    }
    expect(solved.get(innocent).laws.filter((l) => l.law === 'driver-seen')).toEqual([]);
  });
  it('is a vehicle rig, its juice at the anchors it has, its physics derived from what was built', () => {
    const S = solved.get(ruler);
    expect(S.figure.rig).toBe(true);
    expect(S.figure.bones.map((b) => b.id)).toEqual(['root', ...S.faces.wheels.map((w) => w.bone), ...S.faces.bones.map((b) => b.id)]);
    expect(S.figure.clips.roll.k).toBeGreaterThan(1);
    // it lives: the front wheels steer, the body (and what rides it) leans about the wheelbase's middle; only the
    // wheels roll (a bone that lives otherwise holds still in the clip)
    const L = S.figure.live, nb = S.figure.bones.length, k1 = S.figure.clips.roll.b.slice(7 * nb, 14 * nb);
    expect(L.steer).toEqual(expect.arrayContaining(['wheelFL', 'wheelFR']));
    expect(L.body.bones[0]).toBe('root');
    expect(L.body.pivot[1]).toBeCloseTo(S.frame.WB / 2, 3);
    expect(L.gains.lean).toBe(MOTION.lean.gain);
    S.figure.bones.forEach((b, i) => expect(k1[7 * i + 3] < 1, b.id).toBe(b.id.startsWith('wheel')));
    if (S.faces.bones.some((b) => b.id === 'steering')) expect(L.wheel).toBe('steering');
    const kinds = new Set(S.anchors.map((a) => a.kind.split('.')[0]));
    for (const j of S.juice) expect(kinds.has(j.at.split('.')[0]), j.id).toBe(true);
    expect(S.juice.map((j) => j.id)).toContain(Object.keys(JUICE).find((k) => JUICE[k].at === 'contact.rear'));
    const brute = solveRacer(driver('ruler', { build: 'brute' }), { seed: 3 }), lithe = solveRacer(driver('ruler', { build: 'lithe' }), { seed: 3 });
    expect(brute.physics.mass).toBeGreaterThan(lithe.physics.mass);
    expect(solved.get(outlaw).physics.CdA).toBeLessThan(S.physics.CdA);
  });
  it('is deterministic', () => {
    expect(solveRacer(outlaw, { seed: 3 })).toEqual(solved.get(outlaw));
    expect(driver('outlaw')).toEqual(outlaw);
  });
});
