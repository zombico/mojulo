// Isolate to in-memory SQLite — must run before any import that pulls in db/index.js (the
// controllable+unitRef case writes a stored assembler unit). Same pattern as context.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * unshaded-export — the opt-in flat-albedo (FLAT_LIGHT) render mode
 * (interchange.plan.md I5 blender leg). `resolveWorldScene(sketch, { unshaded:true })`
 * resolves a world carrying RAW ALBEDO — no Lambert directional shading, no ambient
 * occlusion, no procedural-material / weathering darkening — the clean base for external
 * GI baking (Blender). This net pins three things:
 *   (a) unshaded object/rig faces sit at raw albedo (litFactor ≡ 1), where the shaded
 *       resolve is directional;
 *   (b) unshaded skips the darkening channels — no baked AO, no material cornerFills;
 *   (c) IDENTITY: absent the flag, the resolve is byte/structure-identical (the flag is a
 *       pure additive gate — the standing char nets guard the rest of the default path).
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { resolveWorldScene } from './world-scene.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from './workbench.js';
import { lowerAssemblerBuild } from './workbench-assembler.js';
import { FLAT_LIGHT } from '../polygonizer/vexar.js';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';

// ── fixtures ────────────────────────────────────────────────────────────────
const RAW = '#c04030';
const workbenchSketch = () => ({
  manifest: {
    kind: 'workbench',
    lathes: [{
      axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 3 },
      profile: [{ t: 0, radius: 0.8 }, { t: 1, radius: 0.6 }], crossSections: 8, samples: 8, tint: RAW,
    }],
  },
});

// A controllable stage whose floor face opts into a procedural MATERIAL and whose manifest
// asks for a baked AO — the two darkening channels unshaded must skip.
const materialWorldSketch = () => ({
  manifest: {
    kind: 'controllable',
    ao: true,
    faces: [{
      corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]],
      fill: '#555555', material: 'brushed-steel', doubleSided: true,
    }],
  },
});

// The same minimal biped fixture unit-pose/unit-rig tests pose (g-series authoring
// convention, one gravity-seated item per station) — deriveBipedRig succeeds on it.
const strut = (len, r = 0.3, tint = '#888888') => ({
  lathes: [{
    axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: -len },
    profile: [{ t: 0.5, radius: r }], crossSections: 4, samples: 6, tint,
  }],
});
const footStrut = () => ({
  lathes: [{
    axisFrom: { x: 0, y: 0.1, z: 0.2 }, axisTo: { x: 0, y: -0.8, z: 0.2 },
    profile: [{ t: 0.5, radius: 0.2 }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});
const miniBiped = () => ({
  kind: 'assembler',
  facing: '-y',
  items: [
    { id: 'head', source: strut(1, 0.5), at: [0, 0, 9] },
    { id: 'torso', source: strut(3, 1), at: [0, 0, 8] },
    { id: 'pelvis', source: strut(1, 0.9), at: [0, 0, 5] },
    { id: 'upper_arm_l', source: strut(1.5), at: [-2, 0, 8] },
    { id: 'upper_arm_r', source: strut(1.5), at: [2, 0, 8] },
    { id: 'forearm_l', source: strut(1.5), at: [-2, 0, 6.5] },
    { id: 'forearm_r', source: strut(1.5), at: [2, 0, 6.5] },
    { id: 'thigh_l', source: strut(2, 0.4), at: [-1, 0, 4] },
    { id: 'thigh_r', source: strut(2, 0.4), at: [1, 0, 4] },
    { id: 'lower_leg_l', source: strut(2, 0.35), at: [-1, 0, 2] },
    { id: 'lower_leg_r', source: strut(2, 0.35), at: [1, 0, 2] },
    { id: 'foot_l', source: footStrut(), on: 'ground', at: [-1, 0, 0] },
    { id: 'foot_r', source: footStrut(), on: 'ground', at: [1, 0, 0] },
  ],
});

// ── helpers ─────────────────────────────────────────────────────────────────
const rawCount = (faces, hex) => faces.filter((f) => (f.fill || '').toLowerCase() === hex).length;
const lum = (hex) => { const s = hex.replace('#', ''); return (0.299 * parseInt(s.slice(0, 2), 16) + 0.587 * parseInt(s.slice(2, 4), 16) + 0.114 * parseInt(s.slice(4, 6), 16)); };
const meanLum = (faces) => faces.reduce((a, f) => a + (f.fill ? lum(f.fill) : 0), 0) / (faces.length || 1);

describe('unshaded export mode', () => {
  beforeEach(() => { closeDb(); });

  // ── (a) raw albedo vs directional ──
  it('(a) object faces: FLAT_LIGHT returns raw albedo, WORKBENCH_LIGHT is directional', () => {
    const flat = lowerObjectFaces(workbenchSketch().manifest, FLAT_LIGHT);
    const shaded = lowerObjectFaces(workbenchSketch().manifest, WORKBENCH_LIGHT);
    expect(flat.length).toBeGreaterThan(0);
    // every unshaded face is the untouched tint (litFactor ≡ 1)
    expect(flat.every((f) => (f.fill || '').toLowerCase() === RAW)).toBe(true);
    // the directional bake varies — not all faces sit at the raw tint
    expect(shaded.some((f) => (f.fill || '').toLowerCase() !== RAW)).toBe(true);
  });

  it('(a) resolveWorldScene(workbench): unshaded lifts object faces to raw albedo', async () => {
    const { payload: shaded } = await resolveWorldScene(workbenchSketch());
    const { payload: flat } = await resolveWorldScene(workbenchSketch(), { unshaded: true });
    // the shaded and unshaded face lists genuinely differ (the light took effect)
    expect(JSON.stringify(flat.faces)).not.toBe(JSON.stringify(shaded.faces));
    // far more faces sit at the raw tint under unshaded (all lathe faces) than under shaded
    expect(rawCount(flat.faces, RAW)).toBeGreaterThan(rawCount(shaded.faces, RAW));
    // mean luminance of the object faces rises (the grid faces are light-independent + equal)
    expect(meanLum(flat.faces)).toBeGreaterThan(meanLum(shaded.faces));
    // workbench IS a Lambert kind, so no honesty warning is attached
    expect(flat.unshadedWarning).toBeUndefined();
  });

  // ── (b) darkening channels skipped ──
  it('(b) unshaded skips the AO bake and the material cornerFills', async () => {
    const { payload: shaded } = await resolveWorldScene(materialWorldSketch());
    const { payload: flat } = await resolveWorldScene(materialWorldSketch(), { unshaded: true });
    // AO: shaded carries the bake setting, unshaded does not
    expect(shaded.ao).toBeDefined();
    expect(flat.ao).toBeUndefined();
    // material: shaded tessellates the material face into per-corner cornerFills; unshaded leaves it flat
    expect(shaded.faces.some((f) => Array.isArray(f.cornerFills))).toBe(true);
    expect(flat.faces.every((f) => !f.cornerFills)).toBe(true);
    // the tessellation makes the shaded face list strictly larger
    expect(shaded.faces.length).toBeGreaterThan(flat.faces.length);
  });

  // ── (a)/(mk2) the unit-rig / assembler path ──
  it('(mk2) lowerAssemblerBuild threads FLAT_LIGHT → raw-albedo rig faces', () => {
    const flat = lowerAssemblerBuild(miniBiped(), { light: FLAT_LIGHT }).faces;
    const shaded = lowerAssemblerBuild(miniBiped()).faces;   // default = WORKBENCH_LIGHT
    expect(flat.length).toBeGreaterThan(0);
    expect(flat.length).toBe(shaded.length);
    // every strut face lowers at its raw livery tint under FLAT_LIGHT
    expect(flat.every((f) => (f.fill || '').toLowerCase() === '#888888')).toBe(true);
    // the shaded bake is directional — most faces are darker than the raw tint
    expect(shaded.some((f) => (f.fill || '').toLowerCase() !== '#888888')).toBe(true);
    expect(meanLum(flat)).toBeGreaterThan(meanLum(shaded));
  });

  it('(mk2) resolveWorldScene(controllable + unitRef): unshaded re-bakes the rig flat', async () => {
    SketchRepository.create({ ref: 'unit-mini', title: 'mini', manifest: miniBiped() });
    const world = () => ({
      manifest: {
        kind: 'controllable',
        faces: [{ corners: [[-6, -6, 0], [6, -6, 0], [6, 6, 0], [-6, 6, 0]], fill: '#2a2a2a', doubleSided: true }],
        entities: [{ id: 'hero', body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0] }, rule: 'walk' }],
        figures: { hero: { unitRef: 'unit-mini' } },
        camera: { rule: 'follow', target: 'hero' },
      },
    });
    const { payload: shaded } = await resolveWorldScene(world());
    const { payload: flat } = await resolveWorldScene(world(), { unshaded: true });
    expect(shaded.figures?.hero?.parts?.length).toBeGreaterThan(0);
    expect(flat.figures?.hero?.parts?.length).toBe(shaded.figures.hero.parts.length);
    // the rig's packed colour buffers differ between the two bakes — the light threaded
    // through unitRef → bakeUnitRig → lowerAssemblerBuild all the way down.
    expect(JSON.stringify(flat.figures.hero.parts)).not.toBe(JSON.stringify(shaded.figures.hero.parts));
  });

  // ── (c) identity: absent the flag, the default path is unchanged ──
  it('(c) identity: unshaded:false and absent yield the same default-path payload', async () => {
    const absent = (await resolveWorldScene(workbenchSketch())).payload;
    const explicitFalse = (await resolveWorldScene(workbenchSketch(), { unshaded: false })).payload;
    expect(JSON.stringify(explicitFalse.faces)).toBe(JSON.stringify(absent.faces));
    // the flag leaks nothing into the default path
    expect(absent.unshadedWarning).toBeUndefined();
    expect(absent.ao).toBeUndefined();
    // and the default resolve is directional (NOT raw albedo everywhere)
    expect(absent.faces.some((f) => (f.fill || '').toLowerCase() !== RAW)).toBe(true);
  });

  it('(c) default-path workbench object-face fills are stable', async () => {
    const { payload } = await resolveWorldScene(workbenchSketch());
    // the object (lathe) faces only — grid faces carry fixed studio fills
    const objFills = payload.faces.map((f) => f.fill).filter((h) => h && h.toLowerCase() !== '#20262e' && h.toLowerCase() !== '#33414c' && h.toLowerCase() !== '#4a6a52');
    expect(objFills).toMatchSnapshot();
  });
});
