import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { aquaScoreEntry, aquaSurfaceFrame, aquaWaterBodies } from './aqua-export.js';
import { resolveAquaLook } from './aqua-look.js';
import { assembleBeachScene } from '../landscape/beach-view.js';
import { assembleOceanScene } from '../landscape/ocean-view.js';
import { assembleRiverScene } from '../landscape/river-view.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { extractEngineScore } from '../scene/engine-score.js';

// the GLB's JSON chunk (header 12 bytes, then a chunk length + type + JSON)
const glbJson = (bytes) => { const b = Buffer.from(bytes); const len = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + len).toString('utf8')); };

describe('aquaSurfaceFrame (an animated surface frozen for the exporters)', () => {
  it('freezes an aqua ocean, beach and river into a finite triangle soup, the same bytes twice', () => {
    for (const p of [assembleOceanScene({}), assembleBeachScene({}), assembleRiverScene({})]) {
      const f = aquaSurfaceFrame(p.surfaces[0]);
      expect(f.positions.length % 9).toBe(0);
      expect(f.normals.length).toBe(f.positions.length);
      expect(f.colors.length).toBe(f.positions.length);
      expect([...f.positions, ...f.normals, ...f.colors].every(Number.isFinite)).toBe(true);
      expect(Buffer.from(aquaSurfaceFrame(p.surfaces[0]).positions.buffer).equals(Buffer.from(f.positions.buffer))).toBe(true);
    }
  });

  it('carries nothing for a surface without a look, or a mode the exporters do not freeze', () => {
    const sf = assembleOceanScene({}).surfaces[0];
    expect(aquaSurfaceFrame({ ...sf, aqua: undefined })).toBeNull();
    expect(aquaSurfaceFrame({ ...sf, spout: { path: [] } })).toBeNull();
    expect(aquaSurfaceFrame(assembleRiverScene({ scenario: 'lava' }).surfaces[0])).toBeNull();
  });

  it('drops the river grid cells outside its banks', () => {
    const sf = assembleRiverScene({}).surfaces[0], full = (sf.grid.nx - 1) * (sf.grid.ny - 1) * 18;
    expect(aquaSurfaceFrame(sf).positions.length).toBeLessThan(full);
  });
});

describe('aquaWaterBodies + the GLB + the engine score', () => {
  it('names each body water:<kind>, indexing a second of the same kind', () => {
    const sf = assembleOceanScene({}).surfaces[0];
    expect(aquaWaterBodies({ surfaces: [sf, sf] }).map((b) => b.name)).toEqual(['water:ocean', 'water:ocean2']);
    expect(aquaWaterBodies({ surfaces: [{ ...sf, aqua: undefined }] })).toEqual([]);
  });

  it('exports the ocean view (no faces) as a water node with transmission / ior / volume', () => {
    const glb = facesToGlb(assembleOceanScene({}), { generator: 'test' });
    expect(glb).not.toBeNull();
    const j = glbJson(glb.bytes);
    expect(j.nodes.map((n) => n.name)).toContain('water:ocean');
    const mat = j.materials.find((m) => m.name === 'water:ocean');
    expect(mat.extensions.KHR_materials_ior.ior).toBe(1.333);
    expect(mat.extensions.KHR_materials_transmission.transmissionFactor).toBeGreaterThan(0);
    const att = mat.extensions.KHR_materials_volume.attenuationColor;
    expect(att[0]).toBeLessThan(att[2]);                       // water keeps blue, loses red
    for (const ext of ['KHR_materials_transmission', 'KHR_materials_ior', 'KHR_materials_volume']) expect(j.extensionsUsed.filter((e) => e === ext)).toHaveLength(1);
    expect(facesToGlb(assembleOceanScene({ aqua: false }), { generator: 'test' })).toBeNull();
  });

  it('splits liquid faces off the glass sheet: glass stays `water`, the lake becomes `water:lake`', () => {
    const q = (z, extra) => ({ corners: [[0, 0, z], [4, 0, z], [4, 4, z], [0, 4, z]], fill: 'rgba(40,90,110,0.7)', doubleSided: true, ...extra });
    const j = glbJson(facesToGlb({ faces: [q(-1, {}), q(0, { water: true }), q(0.5, { water: true, liquid: 'lake' })] }, { generator: 'test' }).bytes);
    const names = j.nodes.map((n) => n.name);
    expect(names).toContain('water');
    expect(names).toContain('water:lake');
  });

  it('carries each body\'s look in score.water, in metres, with a ledger row', () => {
    const p = assembleBeachScene({});
    const score = extractEngineScore({ manifest: { kind: 'beach-view' } }, p);
    const w = score.water['water:lagoon'];
    expect(w.kind).toBe('lagoon');
    expect(w.frozen).toBe(true);
    expect(w.sigma).toEqual(p.surfaces[0].aqua.sigma);
    expect(score.ledger.water_carried.count).toBe(1);
    expect(extractEngineScore({ manifest: {} }, assembleBeachScene({ aqua: false })).water).toBeUndefined();
  });

  it('scales the look into metres for a recipe authored in another unit', () => {
    const body = { look: resolveAquaLook('lake'), sheet: true };
    const m = aquaScoreEntry(body, 0.3048);
    expect(m.sigma[0]).toBeCloseTo(body.look.sigma[0] / 0.3048, 3);
    expect(m.shore).toBeCloseTo(body.look.shore * 0.3048, 3);
    expect(m.frozen).toBe(false);
  });
});

describe('the Godot kernel carries the water lowering', () => {
  const dir = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
  it('ships water.gdshader and level.gd applies it from score.water', () => {
    const shader = readFileSync(path.join(dir, 'water.gdshader'), 'utf8'), level = readFileSync(path.join(dir, 'level.gd'), 'utf8');
    expect(shader).toMatch(/hint_depth_texture/);
    expect(shader).toMatch(/hint_screen_texture/);
    expect(level).toMatch(/func _fix_water\(\)/);
    expect(level).toMatch(/res:\/\/kernel\/water\.gdshader/);
    // every uniform level.gd sets exists in the shader
    const body = level.slice(level.indexOf('func _fix_water'), level.indexOf('static func _vec3'));
    const set = [...body.matchAll(/set_shader_parameter\("([a-z_]+)"/g)].map((m) => m[1]);
    expect(set.length).toBeGreaterThan(10);
    for (const u of set) expect(shader).toMatch(new RegExp(`uniform [a-z0-9]+ ${u}\\b`));
  });
});
