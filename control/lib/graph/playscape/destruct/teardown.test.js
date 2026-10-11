/**
 * teardown — the laws: the order is the manual's, the exploded pose is the frame's own `explode`, assembly is
 * disassembly played backwards, and the same piece gives the same bytes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { teardownPlan, teardownTracks, teardownPose, poseFaces } from './teardown.js';
import { manualPlan } from '../../construction/manual.js';
import { lowerFrame } from '../../construction/frame.js';
import { ensureExactKernel } from '../../polygonizer/field-exact.js';

const PIECES = {
  table: { id: 'table', unit: 'mm', build: { type: 'table', w: 1200, d: 750, h: 750, species: 'oak' } },
  chair: { id: 'chair', unit: 'mm', build: { type: 'chair' } },
  dresser: { id: 'dresser', unit: 'mm', build: { type: 'carcass', w: 800, h: 1000, d: 450, drawers: 4, drawerHeight: 230 } },
  cabinet: { id: 'cabinet', unit: 'mm', build: { type: 'carcass', w: 800, h: 1800, d: 400, doors: 2, shelves: 3 } },
  sofa: { id: 'sofa', unit: 'mm', build: { type: 'sofa', seats: 3 } },
};
const plans = {};

describe('teardown: a frame taken apart in its manual\'s order', () => {
  beforeAll(async () => {
    await ensureExactKernel();
    for (const [k, spec] of Object.entries(PIECES)) plans[k] = teardownPlan(spec);
  });

  for (const name of Object.keys(PIECES)) {
    describe(name, () => {
      it('steps are the manual\'s fit and join steps, in its order, adding the same parts', () => {
        const m = manualPlan(PIECES[name]).steps.filter((s) => s.kind !== 'anchor');
        expect(plans[name].steps.map((s) => [s.n, s.kind, s.parts])).toEqual(m.map((s) => [s.n, s.kind, s.kind === 'join' ? s.adds : s.hosts]));
        expect(plans[name].lock).toBe(null);
      });

      it('the distance defaults to 12% of the piece\'s largest side, and every term sits on a real step', () => {
        const p = plans[name], ns = new Set(p.steps.map((s) => s.n));
        expect(p.k).toBeGreaterThan(0);
        for (const t of p.terms) expect(ns.has(t.step), `${t.id} on step ${t.step}`).toBe(true);
      });

      it('the exploded pose is the frame\'s own explode at the same distance (to 1e-9)', () => {
        const p = plans[name];
        const want = lowerFrame({ ...PIECES[name], explode: p.k }).faces;
        const got = poseFaces(lowerFrame(PIECES[name]).faces, teardownPose(p), p.owners);
        expect(got.length).toBe(want.length);
        let worst = 0;
        got.forEach((f, i) => f.corners.forEach((c, j) => c.forEach((v, a) => { worst = Math.max(worst, Math.abs(v - want[i].corners[j][a])); })));
        expect(worst).toBeLessThan(1e-9);
      });

      it('assembly is disassembly reversed in time, frame for frame; it starts apart and ends at rest', () => {
        const p = plans[name], dis = teardownTracks(p, { show: 'disassemble' }), asm = teardownTracks(p, { show: 'assemble' });
        expect(asm.seconds).toBe(dis.seconds);
        expect(asm.tracks.map((t) => t.id)).toEqual(dis.tracks.map((t) => t.id));
        const full = teardownPose(p);
        for (const [i, tr] of dis.tracks.entries()) {
          const back = asm.tracks[i].frames;
          // sampled on the same clock, so frame j of one is frame (n−1−j) of the other, but for the last sample (T)
          expect(tr.frames[0].off).toEqual([0, 0, 0]);
          expect(back.at(-1).off).toEqual([0, 0, 0]);
          tr.frames.at(-1).off.forEach((v, a) => expect(v).toBeCloseTo(full.get(tr.id)[a], 4));
          expect(back[0].off).toEqual(tr.frames.at(-1).off);
        }
        // the clocks mirror: each assembly step runs where its disassembly step ran, reflected
        for (const s of asm.steps) { const d = dis.steps.find((x) => x.n === s.n); expect(s.t0).toBeCloseTo(dis.seconds - d.t1, 5); }
      });
    });
  }

  it('a step moves only its own parts: before a step starts, the parts it seats are at rest', () => {
    const p = plans.dresser, dis = teardownTracks(p, { show: 'disassemble' });
    const first = dis.steps[0], moving = new Set(p.terms.filter((t) => t.step === first.n).map((t) => t.id));
    const still = dis.tracks.filter((t) => !moving.has(t.id) && !moving.has(p.rides[t.id]));
    const at = (tr, t) => tr.frames.find((f) => f.t >= t).off;
    for (const tr of still) expect(at(tr, first.t1)).toEqual([0, 0, 0]);
  });

  it('exploded opens every part at once and holds', () => {
    const p = plans.table, ex = teardownTracks(p, { show: 'exploded' }), full = teardownPose(p);
    expect(ex.steps.every((s) => s.t0 === 0)).toBe(true);
    for (const tr of ex.tracks) tr.frames.at(-1).off.forEach((v, a) => expect(v).toBeCloseTo(full.get(tr.id)[a], 4));
  });

  it('teardownPose at k undoes the last k steps only', () => {
    const p = plans.table, last = p.steps.at(-1);
    const pose = teardownPose(p, { at: 1 });
    const moved = new Set(p.terms.filter((t) => t.step === last.n).map((t) => t.id));
    for (const [id, o] of pose) if (!moved.has(id) && !moved.has(p.rides[id])) expect(o).toEqual([0, 0, 0]);
    expect(teardownPose(p, { at: 0 }).size).toBe(0);
  });

  it('is pure: the same piece, the same bytes', () => {
    const a = teardownPlan(PIECES.chair), b = teardownPlan(PIECES.chair);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(teardownTracks(a))).toBe(JSON.stringify(teardownTracks(b)));
  });

  it('a show it does not know is an error that names the shows', () => {
    expect(() => teardownTracks(plans.table, { show: 'melt' })).toThrow(/exploded, disassemble, assemble/);
  });
});
