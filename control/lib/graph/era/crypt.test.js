import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry } from './stage.js';
import { cryptTomb, cryptCobwebs, cobwebPilasters, cryptNiches, accentWall } from './crypt.js';
import { PRINCIPLE_LAWS } from './laws.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { CRYPT } from './style/crypt.js';
import { checkStageLaws } from './law-checks.js';
import { DMC3_STUDY } from './stage.test.js';

const CRYPT_STUDY = { ...DMC3_STUDY, reference: 'gothic-night' };

describe('the crypt: gothic-stone dressed as a burial vault', () => {
  const scene = assembleStageScene(CRYPT_STUDY), plan = planStage(CRYPT_STUDY);

  it('keeps every law its card states that the checks can read', () => {
    const r = checkStageLaws(scene, { only: [...new Set(PRINCIPLE_LAWS.crypt.flat())] });
    expect(r.of).toBeGreaterThanOrEqual(8);   // every law on its card that a check can read off the payload
    for (const l of r.laws) expect(l.ok, `${l.law}: ${l.why}`).toBe(true);
  });

  it('principle 2 — the tomb stands in the last room of the walk, set back from the way in, on its dais', () => {
    const { faces, corners } = cryptTomb(plan), last = plan.rooms.find((r) => r.id === plan.links[plan.links.length - 1].to);
    const xs = faces.flatMap((f) => f.corners.map((c) => c[0])), ys = faces.flatMap((f) => f.corners.map((c) => c[1]));
    expect(Math.min(...xs)).toBeGreaterThan(last.x0); expect(Math.max(...xs)).toBeLessThan(last.x1);
    expect(Math.min(...ys)).toBeGreaterThan(last.y0); expect(Math.max(...ys)).toBeLessThan(last.y1);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(cx).toBeGreaterThan((last.x0 + last.x1) / 2);   // the way in is on the gallery's −x side: the tomb is set back toward +x
    expect(corners).toHaveLength(4);
    expect(faces.every((f) => f.group.startsWith('stage:focus'))).toBe(true);
    const cam = scene.cameras.find((c) => c.name === 'tomb');   // the view the walk leads to
    expect(cam.worldFraming.cameraPosition[0]).toBeLessThan(cx);
  });

  it('principle 5 — cobwebs in the pilaster angles, and no two neighbouring pilasters both dressed', () => {
    const geom = buildStageGeometry(plan), webs = cryptCobwebs(plan, geom.pilasters);
    expect(webs.length).toBeGreaterThan(0);
    expect(webs.every((f) => f.texture === 'card:cobweb')).toBe(true);
    const flags = cobwebPilasters(plan, geom.pilasters), dressed = geom.pilasters.filter((p, i) => flags[i]);
    expect(dressed.length).toBeGreaterThan(0);
    for (const p of dressed) expect(dressed.some((q) => q !== p && q.room === p.room && q.F === p.F && Math.abs(q.k - p.k) === 1), `pilaster ${p.room}/${p.k}`).toBe(false);
  });

  it('the candles light the tomb and leave no soot: a light per dais corner, its flames in their own group', () => {
    expect(scene.faces.filter((f) => f.group === 'stage:candle' && f.emissive).length).toBe(4 * CRYPT.candles.per * 2);
  });

  it('grime is one dial: the crypt\'s own grime is the default, none takes the blends away, too much is refused', () => {
    expect(JSON.stringify(assembleStageScene({ ...CRYPT_STUDY, grime: 0.5 }))).toBe(JSON.stringify(scene));
    const clean = assembleStageScene({ ...CRYPT_STUDY, grime: 0 });
    expect(clean.faces.some((f) => f.blend)).toBe(false);
    const old = assembleStageScene({ ...CRYPT_STUDY, grime: 1 });
    expect(old.faces.filter((f) => f.blend).length).toBeGreaterThanOrEqual(scene.faces.filter((f) => f.blend).length);
    expect(() => planStage({ ...CRYPT_STUDY, grime: 2 })).toThrow(/grime is a number from 0/);
  });

  it('principle 7 — every bare bay carries the same niche; the accent wall carries none', () => {
    const geom = buildStageGeometry(plan), tomb = cryptTomb(plan), tc = [tomb.corners.reduce((s, c) => s + c[0], 0) / 4, tomb.corners.reduce((s, c) => s + c[1], 0) / 4];
    const acc = accentWall(plan, geom.pilasters, tc), niches = cryptNiches(plan, geom.pilasters, acc).filter((f) => f.group === 'stage:niche');
    const sizes = new Set(niches.map((f) => { const [a, b, , d] = f.corners; return [Math.hypot(b[0] - a[0], b[1] - a[1]), d[2] - a[2]].map((v) => v.toFixed(2)).join('x'); }));
    expect(niches.length).toBeGreaterThan(0);
    // no niche in a doorway: none within a door's span on its wall
    for (const l of plan.links) {
      const mid = (l.lo + l.hi) / 2, c = l.wall.endsWith('y') ? [mid, l.at] : [l.at, mid];
      for (const f of niches) { const m = [0, 1].map((k) => f.corners.reduce((s, q) => s + q[k], 0) / 4); expect(Math.hypot(m[0] - c[0], m[1] - c[1]) > (l.hi - l.lo) / 2 + 0.3, 'a niche in a doorway').toBe(true); }
    }
    expect(sizes.size).toBeLessThanOrEqual(2);   // one design (a narrower bay may take a narrower niche)
    expect(niches.some((f) => f.normal[0] === acc.F.N[0] && f.normal[1] === acc.F.N[1] && Math.abs((f.corners[0][0] - acc.F.o[0]) * acc.F.N[0] + (f.corners[0][1] - acc.F.o[1]) * acc.F.N[1]) < 0.05)).toBe(false);
  });

  it('principle 8 — one accent wall, behind the tomb, in its own stone', () => {
    const acc = scene.faces.filter((f) => f.group === 'stage:accent');
    expect(new Set(acc.map((f) => f.normal.join())).size).toBe(1);
    expect(acc.every((f) => f.texture.startsWith('gen:stone-brick-'))).toBe(true);
    expect(scene.faces.some((f) => f.group === 'stage:wall' && f.texture === acc[0].texture)).toBe(false);
  });

  it('principle 9 — corner things: off the walking line and the tomb, every face baked', () => {
    const props = scene.faces.filter((f) => f.group === 'stage:prop');
    expect(props.length).toBeGreaterThan(0);
    expect(props.every((f) => Array.isArray(f.cornerFills) || typeof f.fill === 'string')).toBe(true);
    const tomb = cryptTomb(plan), xs = tomb.corners.map((c) => c[0]), ys = tomb.corners.map((c) => c[1]);
    for (const f of props) for (const c of f.corners) expect(c[0] > Math.min(...xs) && c[0] < Math.max(...xs) && c[1] > Math.min(...ys) && c[1] < Math.max(...ys)).toBe(false);
  });

  it('real fire: the starter lights its torches through the fire channel', async () => {
    const stage = assembleStageScene({ ...CRYPT_STUDY, fire: true });
    expect(stage.fireSources.filter((s) => s.kind === 'torch').length).toBe(stage.lights.length - 4);   // every torch, not the candles
    const { payload } = await resolveWorldScene({ ref: 'sk_crypt_fire', title: 'crypt', manifest: { ...CRYPT_STUDY, fire: true } });
    expect(payload.fire).toBeTruthy();
    expect(payload.fireSources).toBeUndefined();   // consumed into the page's fire channel
  });
});
