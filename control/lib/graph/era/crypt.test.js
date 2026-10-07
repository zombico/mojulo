import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry } from './stage.js';
import { cryptTomb, cryptCobwebs, cobwebPilasters } from './crypt.js';
import { CRYPT } from './style/crypt.js';
import { checkStageLaws } from './law-checks.js';
import { DMC3_STUDY } from './stage.test.js';

const CRYPT_STUDY = { ...DMC3_STUDY, reference: 'gothic-night' };

describe('the crypt: gothic-stone dressed as a burial vault', () => {
  const scene = assembleStageScene(CRYPT_STUDY), plan = planStage(CRYPT_STUDY);

  it('keeps every law the checks can read: value order, the vault its own material, blends, cards, a focus, coloured shade', () => {
    const r = checkStageLaws(scene);
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
});
