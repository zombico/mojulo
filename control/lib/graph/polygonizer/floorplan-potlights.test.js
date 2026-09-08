/**
 * Pot lights (lit-handoff.plan.md, the recipe-authored fixture) + the floorplan's unit
 * (metersPerUnit 0.3048): opt-in cans in the ceiling, baked pools on the floor, real
 * KHR_lights_punctual spots in the GLB, and a scaled engine score. Absent `potLights`,
 * the structure is untouched (the furnish char pins hold the bytes).
 */
import { describe, it, expect } from 'vitest';
import { structurizeFloorplan, assembleFloorWorldScene, FLOORPLAN_METERS_PER_UNIT } from './floorplan-structure.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { extractEngineScore } from '../scene/engine-score.js';

// the reference room: sk_lkypzdim4y (seed 7, 20×24 L, door on the south wall)
const ONE_CELL = {
  width: 24, height: 28,
  rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }],
  doors: [{ x: 12, y: 26, room: 0, edge: 'S' }],
};
const glbJson = (bytes) => JSON.parse(Buffer.from(bytes.buffer, bytes.byteOffset + 20, bytes.readUInt32LE(12)).toString('utf8'));
const lum = (hex) => [1, 3, 5].reduce((a, i) => a + parseInt(hex.slice(i, i + 2), 16), 0);
const cans = (faces) => faces.filter((f) => f.group === 'shell:ceiling:potlight');
const near = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);

describe('pot lights', () => {
  it('opt-in: the default structure has no cans, no lights, no pooled floor', () => {
    const s = structurizeFloorplan(ONE_CELL, { furnish: true });
    expect(cans(s.faces)).toHaveLength(0);
    expect(s.lights).toBeUndefined();
    expect(s.faces.some((f) => f.group === 'floor:skin' && f.cornerFills)).toBe(false);
    const w = assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true });
    expect(w.lights).toBeUndefined();
    expect(w.metersPerUnit).toBe(FLOORPLAN_METERS_PER_UNIT);
  });

  it('a 20×24 room gets a 3×3 grid of cans under the walk-tier ceiling, one spot each', () => {
    const w = assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true, potLights: true });
    expect(w.lights).toHaveLength(9);
    expect(cans(w.faces)).toHaveLength(9 * 12);                       // 8 trim quads + 4 lens quads per can
    for (const l of w.lights) {
      expect(l.type).toBe('spot');
      expect(l.position[2]).toBeCloseTo(10 - 0.02 - 0.08, 6);          // just under the lens, under a 10 ft ceiling
      expect(l.position[0]).toBeGreaterThan(2 + 2.5 - 1e-9);           // inset off the walls
      expect(l.position[0]).toBeLessThan(22 - 2.5 + 1e-9);
    }
    const xs = [...new Set(w.lights.map((l) => l.position[0].toFixed(3)))];
    expect(xs).toHaveLength(3);
    expect(w.lights.find((l) => near(l.position.slice(0, 2), [12, 14], 1e-6))).toBeTruthy();   // the centre can
    for (const f of cans(w.faces)) expect(f.corners).toHaveLength(4);   // quads only (face-mesh triangulates quads)
  });

  it('the floor finish is split and pooled: brighter under the centre can than at the wall', () => {
    const w = assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true, potLights: true });
    const boards = w.faces.filter((f) => f.group === 'floor:skin' && typeof f.texture === 'string');
    expect(boards.length).toBeGreaterThan(20);                          // tessellated
    expect(boards.every((f) => Array.isArray(f.cornerFills) && f.cornerFills.length === 4)).toBe(true);
    expect(boards.every((f) => Array.isArray(f.uv) && f.uv.length === 4)).toBe(true);   // uvs interpolated, the texture still maps
    const sample = (x, y) => {
      let best = null, bd = Infinity;
      for (const f of boards) f.corners.forEach((c, i) => { const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = f.cornerFills[i]; } });
      return lum(best);
    };
    expect(sample(12, 14)).toBeGreaterThan(sample(2.2, 14));
    expect(sample(12, 14)).toBeGreaterThan(lum('#d9cdb8'));             // brighter than the untouched base fill
  });

  it('the GLB carries the spots as KHR_lights_punctual and scales the root to metres', () => {
    const w = assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true, potLights: true });
    const out = facesToGlb(w, { generator: 'test' });
    expect(out.lightCount).toBe(9);
    expect(out.metersPerUnit).toBe(FLOORPLAN_METERS_PER_UNIT);
    const j = glbJson(out.bytes);
    expect(j.extensionsUsed).toContain('KHR_lights_punctual');
    const lights = j.extensions.KHR_lights_punctual.lights;
    expect(lights).toHaveLength(9);
    expect(lights[0]).toMatchObject({ type: 'spot', intensity: 400 });
    expect(lights[0].spot.outerConeAngle).toBeGreaterThan(lights[0].spot.innerConeAngle);
    const node = j.nodes.find((n) => n.name === 'light:pot:0');
    expect(node.extensions.KHR_lights_punctual.light).toBe(0);
    expect(near(node.translation, w.lights[0].position)).toBe(true);    // raw units; the root scales
    const root = j.nodes.find((n) => n.name === 'mojulo');
    expect(root.scale).toEqual([0.3048, 0.3048, 0.3048]);
    expect(root.children).toContain(j.nodes.indexOf(node));
    const spawn = j.scenes[0].extras['moj:spawn'];
    expect(spawn[2]).toBe(0);                                          // the FEET on the floor; the eye rides separately on the score (lounge review 2026-09-08)
    expect(w.walk.eye).toBeCloseTo(5.3, 6);                            // an adult's eye in feet, not 42% of the storey
    // the lens is an emissive PBR material of its own (the can reads switched on in a lit importer)
    const lens = j.materials.find((m) => m.name === 'shell:ceiling:potlight:emissive');
    expect(lens.emissiveFactor).toEqual([1, 0.93, 0.82]);
    expect(lens.extensions.KHR_materials_emissive_strength.emissiveStrength).toBe(3);
    expect(j.extensionsUsed).toContain('KHR_materials_emissive_strength');
    expect(j.nodes.some((n) => n.name === 'shell:ceiling:potlight:emissive')).toBe(true);
    // the lit export carries the same lights
    expect(facesToGlb(w, { generator: 'test', lit: true }).lightCount).toBe(9);
  });

  it('the engine score is in metres and carries the lights + a ledger line', () => {
    const sketch = { ref: 'sk_test', manifest: { kind: 'floorplan', ...ONE_CELL, furnish: true, potLights: true } };
    const w = assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true, potLights: true });
    const score = extractEngineScore(sketch, w);
    expect(score.metersPerUnit).toBe(FLOORPLAN_METERS_PER_UNIT);
    expect(score.eye).toBeCloseTo(w.walk.eye * 0.3048, 6);
    expect(score.spawn[0]).toBeCloseTo(12 * 0.3048, 6);
    expect(score.lights).toHaveLength(9);
    expect(score.lights[0].position[2]).toBeCloseTo(9.9 * 0.3048, 6);
    expect(score.ledger.lights_carried.count).toBe(9);
    expect(score.cameras[0].translation[2]).toBeCloseTo(w.cameras[0].worldFraming.cameraPosition[2] * 0.3048, 6);
    const plain = extractEngineScore(sketch, assembleFloorWorldScene(ONE_CELL, { furnish: true, walk: true }));
    expect(plain.lights).toBeUndefined();
    expect(plain.ledger.lights_carried).toBeUndefined();
    expect(plain.metersPerUnit).toBe(FLOORPLAN_METERS_PER_UNIT);
  });

  it('a metre-authored payload is untouched: no root scale, no metersPerUnit on the score', () => {
    const payload = { faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#888888' }], walk: { eye: 1.7 } };
    const j = glbJson(facesToGlb(payload, { generator: 'test' }).bytes);
    expect(j.nodes.find((n) => n.name === 'mojulo').scale).toBeUndefined();
    expect(j.extensionsUsed || []).not.toContain('KHR_lights_punctual');
    const score = extractEngineScore({ ref: 'x', manifest: {} }, payload);
    expect(score.metersPerUnit).toBeUndefined();
    expect(score.eye).toBe(1.7);
  });
});
