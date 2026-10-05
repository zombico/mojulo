import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage, buildStageGeometry } from './stage.js';
import { labDress } from './lab-dress.js';
import { readDecay } from './decay.js';
import { makeDirt } from './dirt.js';
import { hexRgb } from './geom.js';
import { RESEARCH_LAB } from './style/research-lab.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

// the lab gone derelict (`decay`, decay.js, lab-decay.js): machine checks for the style card's decay principles
const LAB = { kind: 'stage', reference: 'doom3', kit: 'research-lab', rooms: [{ id: 'lab', x: 0, y: 0, w: 16, d: 24, h: 9 }] };
const P = RESEARCH_LAB.decay.principles;
const clean = assembleStageScene(LAB), full = assembleStageScene({ ...LAB, decay: 1, water: true });
const scene = (decay) => { const plan = planStage({ ...LAB, decay }), geom = buildStageGeometry(plan); return { plan, geom, dress: labDress(plan, { ...geom, water: true }) }; };
const centroid = (f) => f.corners.reduce((s, p) => [s[0] + p[0] / f.corners.length, s[1] + p[1] / f.corners.length, s[2] + p[2] / f.corners.length], [0, 0, 0]);
const C = [8, 12];

describe('the lab gone derelict', () => {
  it('the floor holds: no decay (absent, 0, or every event at 0) is the clean lab byte for byte; bad shapes throw', () => {
    const j = JSON.stringify(clean);
    for (const d of [0, { collapse: 0 }]) expect(JSON.stringify(assembleStageScene({ ...LAB, decay: d }))).toBe(j);
    expect(readDecay(0.5).k).toEqual({ collapse: 0.5, leak: 0.5, breach: 0.5, blackout: 0.5, abandon: 0.5 });
    expect(() => readDecay(2)).toThrow(/decay must be/);
    expect(() => readDecay({ fire: 1 })).toThrow(/decay must be/);
    expect(() => assembleStageScene({ kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'p', x: 0, y: 0, w: 26, d: 22, h: 12 }], decay: 1 })).toThrow(/can't decay/);
  });

  it(P[0], () => {
    const { geom, dress, plan } = scene(1);
    const hole = geom.labs[0].hole.rect;
    // the debris lies under the hole it fell from
    const debris = dress.faces.filter((f) => f.group === 'stage:debris').map(centroid);
    expect(debris.length).toBeGreaterThan(50);
    for (const p of debris) { expect(p[0]).toBeGreaterThan(hole[0] - 1.2); expect(p[0]).toBeLessThan(hole[2] + 1.2); expect(p[1]).toBeGreaterThan(hole[1] - 1.2); expect(p[1]).toBeLessThan(hole[3] + 1.2); }
    // the deck is open over it
    expect(full.faces.some((f) => f.group === 'stage:ceiling' && (() => { const c = centroid(f); return c[0] > hole[0] + 0.7 && c[0] < hole[2] - 0.7 && c[1] > hole[1] + 0.7 && c[1] < hole[3] - 0.7 && c[2] > 8.9; })())).toBe(false);
    // the stain runs down from the leak: under its source the wall is darker than beside it
    const L = dress.dirt.leaks[0], dirt = makeDirt(plan, [], dress.dirt), n = [L.n[0], L.n[1], 0], t = [-L.n[1], L.n[0]];
    const wallAt = (lat, z) => dirt({ group: 'stage:wall', normal: n, tint: [0.7, 0.7, 0.7] }, [L.at[0] + t[0] * lat - L.n[0] * 0.24, L.at[1] + t[1] * lat - L.n[1] * 0.24, z])[0];
    expect(wallAt(0, 2.5)).toBeLessThan(wallAt(3, 2.5) * 0.85);
    // the spill spreads from the tank
    const spill = dress.after.filter((f) => f.group === 'stage:water').map(centroid);
    expect(spill.length).toBeGreaterThan(20);
    expect(spill.some((p) => Math.hypot(p[0] - C[0], p[1] - C[1]) < 1)).toBe(true);
  });

  it(P[1], () => {
    const { geom, dress } = scene({ blackout: 1 });
    const troffers = geom.seats.filter((s) => s.fixture === 'troffer').length, all = buildStageGeometry(planStage(LAB)).seats.filter((s) => s.fixture === 'troffer').length;
    expect(troffers).toBeLessThanOrEqual(Math.ceil(all * 0.35));
    expect(troffers).toBeGreaterThan(0);
    const em = dress.lights.filter((l) => l.fixture === 'emergency');
    expect(em.length).toBeGreaterThan(3);
    for (const l of em) { const c = hexRgb(l.color); expect(c[0]).toBeGreaterThan(c[1] + 0.5); }
    expect(dress.faces.filter((f) => f.group === 'stage:screen').length).toBeLessThanOrEqual(3);
    expect(geom.seats.filter((s) => s.fixture === 'window').length).toBe(0);
    // and the room is darker: the ambient went down
    const amb = (s) => hexRgb(planStage(s).ref.light.ambient).reduce((a, b) => a + b, 0);
    expect(amb({ ...LAB, decay: { blackout: 1 } })).toBeLessThan(amb(LAB) * 0.6);
  });

  it(P[2], () => {
    const { dress } = scene({ abandon: 1 });
    expect(dress.things.filter((t) => t.kind === 'chair' && t.tip).length).toBeGreaterThan(1);
    expect(dress.things.filter((t) => t.kind === 'sheet').length).toBeGreaterThan(30);
    expect(dress.things.some((t) => t.kind === 'screen')).toBe(true);    // monitors on the floor
    // nothing left the room
    for (const t of dress.things) { expect(t.at[0]).toBeGreaterThan(0); expect(t.at[0]).toBeLessThan(16); expect(t.at[1]).toBeGreaterThan(0); expect(t.at[1]).toBeLessThan(24); }
    // dust: an up-facing dark surface greys over, a down-facing one doesn't
    const plan = planStage({ ...LAB, decay: { abandon: 1 } }), dirt = makeDirt(plan, [], dress.dirt);
    const up = dirt({ group: 'stage:bench', normal: [0, 0, 1], tint: [0.2, 0.2, 0.2] }, [3, 3, 0.9]), down = dirt({ group: 'stage:bench', normal: [0, 0, -1], tint: [0.2, 0.2, 0.2] }, [3, 3, 0.9]);
    expect(up[0]).toBeGreaterThan(down[0] * 1.2);
  });

  it(P[3], () => {
    const { dress } = scene({ breach: 1 });
    expect(dress.faces.some((f) => f.group === 'stage:liquid')).toBe(false);
    expect(dress.pools.some((l) => l.fixture === 'tank')).toBe(false);
    const B = RESEARCH_LAB.decay.breach, T = RESEARCH_LAB.tank, zg = T.dais[0].h + T.dais[1].h + T.base.h;
    const glass = dress.faces.filter((f) => f.group === 'stage:tankglass');
    expect(glass.length).toBe(T.sides);
    expect(Math.max(...glass.flatMap((f) => f.corners.map((p) => p[2])))).toBeLessThanOrEqual(zg + B.keep + B.jag + 1e-6);
    // with `water`, the spill takes the water look
    expect(dress.after.filter((f) => f.group === 'stage:water').every((f) => f.liquid)).toBe(true);
    expect(dress.faces.filter((f) => f.group === 'stage:shards').length).toBeGreaterThan(20);
  });

  it('each event is its own cause: a collapse alone leaves the power on, the tank whole, the room tidy', () => {
    const { geom, dress } = scene({ collapse: 1 });
    expect(geom.labs[0].hole).toBeTruthy();
    expect(dress.lights || []).toEqual([]);
    expect(dress.faces.some((f) => f.group === 'stage:liquid')).toBe(true);
    expect(dress.things.some((t) => t.kind === 'sheet' || t.tip)).toBe(false);
    // only the troffers under the hole are lost
    expect(geom.seats.filter((s) => s.fixture === 'troffer').length).toBeGreaterThanOrEqual(13);
    expect(full.lights.length).toBeLessThan(clean.lights.length);
  });

  it('the dying lamps flicker on the page: survivors of the blackout stutter, a troffer hanging by a chain sparks', () => {
    expect('flicker' in clean).toBe(false);
    const lamps = full.flicker.lamps;
    expect(lamps.length).toBeGreaterThan(0);
    expect(lamps.length).toBeLessThanOrEqual(8);
    expect(lamps.some((l) => l.mode === 'stutter' && l.base === 1)).toBe(true);
    expect(lamps.some((l) => l.mode === 'spark' && l.base === 0)).toBe(true);
    // a collapse alone (the power still on) leaves only the hanging troffer's sparks
    expect(assembleStageScene({ ...LAB, decay: { collapse: 1 } }).flicker.lamps.every((l) => l.mode === 'spark')).toBe(true);
    // a dying tube carries no halo (its glow comes and goes with the flicker instead)
    const { geom } = scene({ blackout: 1 }), dying = geom.seats.filter((s) => s.flicker);
    for (const d of dying) expect(full.faces.some((f) => f.glow && f.group === 'stage:lamp' && Math.hypot(f.corners[0][0] - d.at[0], f.corners[0][1] - d.at[1]) < 1)).toBe(false);
    // the page carries the channel only when there is something to flicker
    const page = (p) => emitThreeWorld({ ...p, textures: collectFaceTextures(p.faces), inline: true });
    expect(page(full)).toContain('stage flicker');
    expect(page(clean)).not.toContain('stage flicker');
  });
});
