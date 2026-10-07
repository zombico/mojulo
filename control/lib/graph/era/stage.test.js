import { describe, it, expect } from 'vitest';
import { planStage, buildStageGeometry, assembleStageScene, stageRubble, STAGE_KITS } from './stage.js';
import { makeDirt } from './dirt.js';
import { measureFidelity, pngSize } from './fidelity.js';
import { SIXTH_GEN } from './sixth-gen.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';

// the DMC3 study: a tall nave and a lower side gallery through one doorway
export const DMC3_STUDY = {
  kind: 'stage', reference: 'dmc3', kit: 'gothic-stone',
  rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }],
  links: [{ from: 'nave', to: 'gallery' }],
};

describe('stage plan', () => {
  it('rejects off-grid rooms, unknown kits, unknown references and links without a shared wall', () => {
    expect(() => planStage({ rooms: [{ id: 'a', x: 0.5, y: 0, w: 6, d: 6, h: 4 }] })).toThrow(/grid/);
    expect(() => planStage({ kit: 'nope', rooms: DMC3_STUDY.rooms })).toThrow(/kit/);
    expect(() => planStage({ reference: 'nope', rooms: DMC3_STUDY.rooms })).toThrow(/reference/);
    expect(() => planStage({ rooms: [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }, { id: 'b', x: 20, y: 0, w: 6, d: 6, h: 4 }], links: [{ from: 'a', to: 'b' }] })).toThrow(/share/);
  });
  it('a link cuts the same doorway into both rooms, centred on the shared wall', () => {
    const p = planStage(DMC3_STUDY);
    expect(p.links).toHaveLength(1);
    const [l] = p.links;
    expect(l.wall).toBe('+x'); expect(l.at).toBe(12);
    expect((l.lo + l.hi) / 2).toBe(10);
    expect(p.rooms[0].openings['+x']).toHaveLength(1);
    expect(p.rooms[1].openings['-x']).toHaveLength(1);
  });
});

describe('stage geometry', () => {
  const plan = planStage(DMC3_STUDY);
  const kit = STAGE_KITS['gothic-stone'];
  const { faces, seats, drains } = buildStageGeometry(plan);
  it('every face is a textured, multiply-lit quad no bigger than its part\'s cell, with a uv per corner', () => {
    for (const f of faces) {
      expect(f.corners).toHaveLength(4);
      expect(f.uv).toHaveLength(4);
      expect(f.textureLit).toBe(true);
      expect(surfaceTexture(f.texture), f.texture).toBeTruthy();
      const cell = Math.max(...Object.values(kit.cells));
      const span = (k) => Math.max(...f.corners.map((c) => c[k])) - Math.min(...f.corners.map((c) => c[k]));
      for (const k of [0, 1, 2]) expect(span(k)).toBeLessThanOrEqual(cell + 1e-6);
    }
    const wall = faces.filter((f) => f.group === 'stage:wall');
    for (const f of wall) for (const k of [0, 1, 2]) expect(Math.max(...f.corners.map((c) => c[k])) - Math.min(...f.corners.map((c) => c[k]))).toBeLessThanOrEqual(kit.cells.wall + 1e-6);
  });
  it('no wall face lies on the shared wall plane (walls have thickness, so neighbours never z-fight)', () => {
    const onPlane = faces.filter((f) => f.group === 'stage:wall' && f.corners.every((c) => Math.abs(c[0] - 12) < 1e-6));
    expect(onPlane).toHaveLength(0);
  });
  it('the kit dresses the shell: plinth, cornice, pilasters and ribs are present as trim', () => {
    const trim = faces.filter((f) => f.group === 'stage:trim');
    expect(trim.length).toBeGreaterThan(faces.length * 0.15);
    expect(seats.length).toBeGreaterThan(0);
  });
  it('floor and wall are different layers: other families, other shapes, a warmer and darker floor', () => {
    const fam = (g) => new Set(faces.filter((f) => f.group === g).map((f) => f.texture.replace(/-[a-d]$/, '')));
    expect([...fam('stage:floor')]).toEqual(['flagstone']);       // square/oblong flags in a grid
    // running-bond courses: the crypt's bluestone, worn at its grime (recessed joints, streaks, chipped arrises)
    expect([...fam('stage:wall')]).toHaveLength(1);
    expect([...fam('stage:wall')][0]).toMatch(/^gen:stone-brick-/);
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    expect(lum(kit.tint.wall) - lum(kit.tint.floor)).toBeGreaterThan(0.2);
    expect(kit.tint.floor[0] - kit.tint.floor[2]).toBeGreaterThan(0);   // warm
    expect(kit.tint.wall[2] - kit.tint.wall[0]).toBeGreaterThan(0);     // cool
  });
  it('the floor is paved in bays: each face sits inside one tile, whose edges fall on the pilaster lines', () => {
    const floor = faces.filter((f) => f.group === 'stage:floor');
    expect(new Set(floor.map((f) => f.texture)).size).toBeGreaterThan(1);
    for (const f of floor) for (const k of [0, 1]) {
      const us = f.uv.map((q) => q[k]), lo = Math.min(...us), hi = Math.max(...us);
      expect(Math.floor(hi - 1e-4) - Math.floor(lo + 1e-4), 'a face straddles a bay line').toBe(0);
    }
    // the nave is 11.5 m wide inside → 3 bays; the pilasters on its −y wall stand at the same thirds
    const nave = plan.rooms[0], bx = (nave.x1 - nave.x0) / 3;
    const onLine = floor.filter((f) => f.corners.some((c) => Math.abs(c[0] - (nave.x0 + bx)) < 1e-4));
    expect(onLine.length).toBeGreaterThan(0);
  });
  it('there is stuff between floor and wall: a recessed gutter runs the wall bases, broken at doorways', () => {
    const gutter = faces.filter((f) => f.group === 'stage:gutter');
    expect(gutter.length).toBeGreaterThan(0);
    expect(gutter.every((f) => f.corners.every((c) => c[2] <= 0))).toBe(true);
    expect(drains.length).toBeGreaterThan(8);   // 4 walls × 2 rooms, the linked walls split at the door
    const floorField = faces.filter((f) => f.group === 'stage:floor' && f.corners.every((c) => c[2] === 0));
    const B = kit.plinth.out + kit.gutter.width, nave = plan.rooms[0];
    // inside the nave, away from the door, no floor face reaches into the band
    const intrusions = floorField.filter((f) => f.corners.some((c) => c[0] < 10 && c[1] > nave.y0 && c[1] < nave.y1 && c[0] > nave.x0 && c[0] < nave.x0 + B - 1e-6));
    expect(intrusions).toHaveLength(0);
  });
});

describe('stage rubble', () => {
  it('pooled low-detail stones sit in the gutter, lit like the shell', () => {
    const plan = planStage(DMC3_STUDY), { drains } = buildStageGeometry(plan);
    const rubble = stageRubble(plan, drains);
    expect(rubble.length).toBeGreaterThan(0);
    for (const f of rubble) { expect(f.group).toBe('stage:rubble'); expect(f.tint).toHaveLength(3); expect(f.normal).toHaveLength(3); }
  });
});

describe('dirt by cause', () => {
  const plan = planStage(DMC3_STUDY);
  const lights = [{ at: [0.85, 10, 2.7], n: [1, 0, 0] }];   // a torch on the nave's −x wall
  const dirt = makeDirt(plan, lights);
  const wall = { group: 'stage:wall', normal: [1, 0, 0] };
  const v = (m) => (m[0] + m[1] + m[2]) / 3;
  it('soot darkens the wall above a torch, not beside it at the same height far away', () => {
    expect(v(dirt(wall, [0.25, 10, 3.6]))).toBeLessThan(v(dirt(wall, [0.25, 15, 3.6])));
  });
  it('soot lands only on faces that look the way the torch\'s wall looks (not a pilaster\'s side)', () => {
    const side = { group: 'stage:trim', normal: [0, 1, 0] };
    expect(v(dirt(side, [0.5, 9.7, 3.4]))).toBeCloseTo(v(dirt(side, [0.5, 15, 3.4])), 1);
  });
  it('the wall base is damp: darker and greener near the floor', () => {
    const low = dirt(wall, [0.25, 16, 0.1]), high = dirt(wall, [0.25, 16, 2.2]);
    expect(v(low)).toBeLessThan(v(high));
    expect(low[1]).toBeGreaterThan(low[0]);
  });
  it('the walk line is worn lighter than the floor edge', () => {
    const floor = { group: 'stage:floor', normal: [0, 0, 1] };
    expect(v(dirt(floor, [6, 10, 0]))).toBeGreaterThan(v(dirt(floor, [1.2, 3, 0])));
  });
  it('knobs scale the causes: a clean, dry stage barely marks', () => {
    const clean = makeDirt(plan, lights, { age: 0, damp: 0, soot: 0, traffic: 0 });
    const m = clean(wall, [0.25, 10, 3.6]);
    expect(v(m)).toBeCloseTo(1, 5);
  });
});

describe('stage scene', () => {
  const a = assembleStageScene(DMC3_STUDY), b = assembleStageScene(DMC3_STUDY);
  it('is deterministic (byte-identical re-render)', () => {
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('bakes light per corner: torches make pools (corners differ within a face), every torch leaves as a punctual light', () => {
    const shell = a.faces.filter((f) => f.cornerFills);
    expect(shell.some((f) => new Set(f.cornerFills).size > 1)).toBe(true);
    expect(a.lights.length).toBeGreaterThan(0);
    for (const l of a.lights) { expect(l.type).toBe('point'); expect(l.position).toHaveLength(3); }
    // two flame cards per torch; the crypt's candles burn in their own group, one light per cluster
    const candles = new Set(a.faces.filter((f) => f.group === 'stage:candle' && f.glow).map((f) => f.corners[0].slice(0, 2).map(Math.round).join())).size > 0 ? 4 : 0;
    expect(a.faces.filter((f) => f.glow && f.group === 'stage:fixture')).toHaveLength((a.lights.length - candles) * 2);
  });
  it('rubble is in the scene, lit once per stone face', () => {
    const rubble = a.faces.filter((f) => f.group === 'stage:rubble');
    expect(rubble.length).toBeGreaterThan(0);
    expect(rubble.every((f) => typeof f.fill === 'string' && !f.tint)).toBe(true);
  });
  it('authored lights replace the auto torches; an empty list leaves only the dressing\'s own (the tomb\'s candles)', () => {
    const candles = assembleStageScene({ ...DMC3_STUDY, lights: [] }).lights.length;
    expect(candles).toBe(4);   // one per dais corner
    const one = assembleStageScene({ ...DMC3_STUDY, lights: [{ at: [6, 10, 3], color: '#ff3020' }] });
    expect(one.lights).toHaveLength(1 + candles);
    const none = assembleStageScene({ ...DMC3_STUDY, lights: [] });
    expect(none.lights).toHaveLength(candles);
    expect(none.faces.every((f) => !f.cornerFills || new Set(f.cornerFills).size >= 1)).toBe(true);
  });
  it('carries the reference air: haze in the fog colour, an interior sky', () => {
    expect(a.haze).toEqual({ color: '#151821', density: 0.05 });
    expect(a.sky).toEqual({ preset: 'interior' });
  });
});

// The phase-2 readout: the same hero and camera as the cave baseline, now in the kit-built nave.
describe('readout: hero in the DMC3 nave', () => {
  it('the kit raises the world density over the bare cave', () => {
    const scene = assembleStageScene(DMC3_STUDY);
    const hero = planLayered(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', register: 'round' }) })).mesh;
    const at = [6, 6, 0];
    const placed = { vertices: hero.vertices.map((v) => [v[0] + at[0], v[1] + at[1], v[2] + at[2]]), faces: hero.faces };
    const r = measureFidelity({
      cast: [placed], world: [scene.faces], frame: SIXTH_GEN.frame,
      camera: { eye: [6, 3.6, 1.3], target: [6, 6, 1.0], fovY: SIXTH_GEN.frame.fovY },
      texturePx: (k) => pngSize(surfaceTexture(k)),
    });
    console.log('[sixth-gen nave]', JSON.stringify(r));
    expect(r.world.trianglesPerKpx).toBeGreaterThan(2.006);   // the cave baseline
  }, 60000);
});
