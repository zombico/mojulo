import { describe, it, expect } from 'vitest';
import { readOutTrail, outTrailSite, outTrailLaws, planOutTrail, beatOrderFaults, OUT_TRAIL, OUT_BEATS } from './out-trail.js';
import { outTrailBoardHtml } from './out-trail-board.js';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';
import { gridX, gridY } from '../polygonizer/landform.js';

// an outdoor trail from a recipe: spine, beats, heartbeat, bumpiness, the passes, the laws, the annotation (era/out-trail.js)
const ST = ISEKAI_STYLES['isekai-meadow'];
const site = (t = {}, seed = 3) => outTrailSite(ST, { heartbeat: 0.6, bumpiness: 0.5, ...t }, seed);
const built = new Map();
const stage = (m) => { const k = JSON.stringify(m); return built.get(k) || built.set(k, assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', ...m })).get(k); };

describe('out-trail', () => {
  it('reads a trail, its dials and its beats; and says what is wrong', () => {
    expect(readOutTrail(true)).toEqual({ id: 'trail', run: 12, heartbeat: 0.5, bumpiness: 0.4, beats: null, bounds: {} });
    expect(readOutTrail({ id: 'b', after: { id: 'a', seed: 4 } }).after).toEqual({ seed: 4, recipe: { id: 'a' }, id: 'a' });
    expect(readOutTrail({ run: 20, beats: ['pinch', 'reveal', 'pocket'] }).beats).toEqual(['pinch', 'reveal', 'pocket']);
    expect(() => readOutTrail({ run: 8 })).toThrow(/12 to 25/);
    expect(() => readOutTrail({ heartbeat: 2 })).toThrow(/0 \(level\) to 1/);
    expect(() => readOutTrail({ beats: ['pinch', 'cave', 'reveal'] })).toThrow(/'cave' is not a beat/);
    expect(() => readOutTrail({ length: 70 })).toThrow(/not a trail setting/);
    expect(beatOrderFaults(['reveal', 'pinch', 'pinch'])).toEqual(['two pinchs together', 'a reveal first: there is no climb before it']);
  });

  it('the isekai meadow is the default: 72 m of spine, twelve seconds to run, two to three minutes to explore, every law holding', () => {
    for (const seed of [1, 3, 8]) {
      const s = site({}, seed), laws = outTrailLaws(s);
      expect(laws.filter((l) => !l.ok)).toEqual([]);
      expect(s.out.plan.L - 2 * OUT_TRAIL.ends).toBe(72);
      expect(s.D).toBeGreaterThan(70);
      expect(s.D).toBeLessThan(74);
      // a drawn trail always has its reveal, its landmark and its pocket
      for (const b of ['reveal', 'landmark', 'pocket']) expect(s.out.plan.order).toContain(b);
    }
  });

  it('the heartbeat dial sets how hard the trail rises and falls; past the grade the walk becomes a stairs site', () => {
    const range = (s) => { const a = [...s.out.plan.profile.smoothed]; return Math.max(...a) - Math.min(...a); };
    const lo = site({ heartbeat: 0 }), mid = site({ heartbeat: 0.5 }), hi = site({ heartbeat: 1 });
    expect(range(lo)).toBe(0);
    expect(range(mid)).toBeGreaterThan(1.5);
    expect(range(hi)).toBeGreaterThan(range(mid) * 1.8);
    expect(lo.out.plan.stairs).toEqual([]);
    expect(hi.out.plan.stairs.length).toBeGreaterThan(0);
    // the rough pass is the heartbeat before it is smoothed: never smoother than the smoothed one
    const step = (a) => Math.max(...Array.from(a).slice(1).map((v, k) => Math.abs(v - a[k])));
    expect(step(hi.out.plan.profile.rough)).toBeGreaterThanOrEqual(step(hi.out.plan.profile.smoothed));
  });

  it('bumpiness roughens the ground off the walk, and the smooth pass lays the walk level across', () => {
    // the bumps are what bumpiness adds to the rough pass: full off the walk, a little on it
    const b0 = site({ bumpiness: 0 }), b1 = site({ bumpiness: 1 }), g0 = b0.passes.rough, g1 = b1.passes.rough;
    const off = [], on = [];
    for (let j = 2; j + 2 < g0.ny; j += 3) for (let i = 2; i + 2 < g0.nx; i += 3) {
      const x = gridX(g0, i), y = gridY(g0, j), d = b0.trailDist(x, y), q = j * g0.nx + i;
      if (x < b0.cliffX(y) + 10) continue;
      (d > 8 ? off : d < b0.halfWAt(y) ? on : []).push(Math.abs(g1.z[q] - g0.z[q]));
    }
    const mean = (a) => a.reduce((t, v) => t + v, 0) / a.length;
    expect(mean(off)).toBeGreaterThan(0.25);
    expect(mean(on)).toBeLessThan(mean(off) * 0.3);
    const s = site({ heartbeat: 1, bumpiness: 1, beats: ['landmark', 'pocket', 'pinch', 'reveal'] });
    for (let y = 6; y < s.D - 6; y += 3) {
      const x = s.trailX(y), w = s.halfWAt(y) * 0.8;
      expect(Math.abs(s.ground(x - w, y) - s.ground(x + w, y))).toBeLessThan(0.12);
    }
  });

  it('annotates every beat and hazard: a pit and a ford with their severity, a way round and a respawn before them', () => {
    const s = site({ beats: ['landmark', 'pit', 'pocket', 'crossing', 'reveal'] });
    const A = s.out.anchors, ids = A.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(A.filter((a) => a.kind === 'beat').map((a) => a.beat)).toEqual(['trailhead', 'landmark', 'pit', 'pocket', 'crossing', 'reveal', 'exit']);
    const pit = A.find((a) => a.hazard === 'pit'), ford = A.find((a) => a.hazard === 'water');
    expect(pit).toMatchObject({ severity: 'fall', of: 'pit-1', jump: OUT_TRAIL.pit.w, around: true });
    expect(ford).toMatchObject({ severity: 'slow', of: 'crossing-1' });
    for (const h of [pit, ford]) expect(h.respawn[1]).toBeLessThan(h.at[1]);
    // the pit is cut: the ground under the walk drops by its depth, and is whole wide of it
    const y = s.out.pits[0].y, x = s.trailX(y);
    expect(s.ground(x, y - 3) - s.ground(x, y)).toBeGreaterThan(OUT_TRAIL.pit.depth * 0.8);
    expect(Math.abs(s.ground(x + 9, y) - s.ground(x + 9, y - 3))).toBeLessThan(1.2);
    const pocket = A.find((a) => a.beat === 'pocket');
    expect(Math.hypot(pocket.at[0] - pocket.mouth[0], pocket.at[1] - pocket.mouth[1])).toBeGreaterThan(OUT_TRAIL.pocket.reach[0]);
  });

  it('the same recipe builds the same trail; another seed another', () => {
    const a = site({}, 5), b = site({}, 5), c = site({}, 6);
    expect(b.out.anchors).toEqual(a.out.anchors);
    expect(Array.from(b.passes.smooth.z)).toEqual(Array.from(a.passes.smooth.z));
    expect(c.out.anchors).not.toEqual(a.out.anchors);
    expect(planOutTrail(ST, readOutTrail({ beats: ['rest', 'landmark', 'reveal'] }), 2).order).toEqual(['rest', 'landmark', 'reveal']);
    expect(OUT_BEATS).toEqual(['pinch', 'reveal', 'landmark', 'crossing', 'pocket', 'rest', 'pit']);
  });

  it('a stage built from a trail carries its trail, its anchors, a landmark by name and a trailhead looking at it; absent, none of it', () => {
    const plain = stage({}), p = stage({ seed: 8, trail: { heartbeat: 0.8, bumpiness: 0.6, beats: ['landmark', 'pit', 'crossing', 'reveal'] } });
    expect(plain.outTrail).toBe(undefined);
    expect(plain.anchors).toBe(undefined);
    expect(p.outTrail).toMatchObject({ id: 'out-trail:trail', run: 12, length: 72 });
    expect(p.outTrail.laws.every((l) => l.ok)).toBe(true);
    const lm = p.anchors.find((a) => a.beat === 'landmark');
    expect(p.faces.filter((f) => f.node === 'landmark-1').length).toBeGreaterThan(10);
    expect(p.cameras[0].name).toBe('trailhead');
    expect(p.cameras[0].worldFraming.lookAt.slice(0, 2)).toEqual(lm.at.slice(0, 2));
    expect(p.faces.some((f) => f.group === 'trail:water')).toBe(true);
    // the ribbon breaks at the pit
    const pit = p.anchors.find((a) => a.hazard === 'pit');
    const over = p.faces.filter((f) => f.group === 'isekai:trail' && f.corners.every((c) => c[1] > pit.box.min[1] && c[1] < pit.box.max[1]));
    expect(over).toEqual([]);
  }, 60000);

  it('a trail AFTER another starts where it leaves: on its line, at its height, on its ground; a junction between them', () => {
    const A = { id: 'meadow', heartbeat: 0.8, bumpiness: 0.6 }, a = outTrailSite(ST, A, 8);
    const b = outTrailSite(ST, { id: 'ford', run: 16, heartbeat: 0.85, bumpiness: 0.7, beats: ['pinch', 'landmark', 'crossing', 'pocket', 'pit', 'reveal'], after: { ...A, seed: 8 } }, 33);
    expect(outTrailLaws(b).filter((l) => !l.ok)).toEqual([]);
    expect(outTrailLaws(b).find((l) => l.law === 'seam').value).toBeLessThan(0.01);
    for (let x = -10; x <= 44; x += 2) expect(Math.abs(b.ground(x, 0) - a.ground(x, a.D))).toBeLessThan(0.01);
    expect(Math.abs(b.trailX(0) - a.trailX(a.D))).toBeLessThan(1e-6);
    expect(Math.abs(b.cliffX(0) - a.cliffX(a.D))).toBeLessThan(1e-6);
    expect(b.origin).toBe(a.D);
    const j = b.out.anchors.find((q) => q.kind === 'junction');
    expect(j).toMatchObject({ id: 'junction-meadow-ford', between: ['out-trail:meadow', 'out-trail:ford'] });
    expect(b.out.anchors.every((q) => q.trail === 'out-trail:ford')).toBe(true);
    // and a third after the second: the chain carries the origin on
    const c = outTrailSite(ST, { id: 'climb', after: { id: 'ford', run: 16, heartbeat: 0.85, bumpiness: 0.7, beats: ['pinch', 'landmark', 'crossing', 'pocket', 'pit', 'reveal'], seed: 33, after: { ...A, seed: 8 } } }, 5);
    expect(c.origin).toBeCloseTo(a.D + b.D, 6);
    expect(outTrailLaws(c).filter((l) => !l.ok)).toEqual([]);
    expect(() => readOutTrail({ id: 'x', after: { run: 12 } })).toThrow(/by an id of its own/);
    expect(() => readOutTrail({ id: 'x', after: { id: 'x' } })).toThrow(/by an id of its own/);
  });

  it('a trail is for open ground', () => {
    expect(() => assembleStageScene({ kind: 'stage', kit: 'gothic-stone', trail: true })).toThrow(/is not open ground/);
    expect(() => assembleStageScene({ kind: 'stage', kit: 'jungle-trail', trail: true })).toThrow(/lays its own trail/);
  });

  it('the landform board shows both passes, the heartbeat, the laws and the beats, in black and white', () => {
    const html = outTrailBoardHtml({ kind: 'stage', kit: 'isekai-meadow', seed: 3, trail: { heartbeat: 0.8 } });
    expect((html.match(/<img src="data:image\/png;base64,/g) || []).length).toBe(2);
    for (const w of ['1 · rough', '2 · smooth', 'Heartbeat', 'Laws', 'trailhead', 'landmark-1', 'proposed']) expect(html).toContain(w);
    expect(html).not.toContain('BROKEN');
    // black and white: no colour but greys
    const colours = [...new Set(html.match(/#[0-9a-f]{3,6}\b/gi))];
    for (const c of colours) { const h = c.length === 4 ? c.slice(1).split('').map((d) => d + d) : [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)]; expect(new Set(h.map((d) => d.toLowerCase())).size).toBe(1); }
  });
});
