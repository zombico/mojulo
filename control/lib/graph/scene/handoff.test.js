/**
 * The engine handoff (scene/handoff.js): a gen-7 trail handed off leaves lit (glTF metal-rough, no unlit extension, no
 * light baked in its colours), its scree's stones as instances turned to their ground and counted in the ledger, the
 * same bytes twice; a stone stands as the page stands it (+Z onto its normal, then its yaw); a thing that is no world
 * hands off its albedo, with no instances.
 */
import { describe, expect, it } from 'vitest';

import { resolveHandoff, stoneInstances, HANDOFF_VERSION } from './handoff.js';

const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const rotate = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v, ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};

const TRAIL = { title: 'trail', manifest: { kind: 'geocube', cube: 'island-noon', show: 'trail', seed: 1 } };

describe('the engine handoff', () => {
  it('a gen-7 trail: lit, its stones as instances, the same bytes twice', async () => {
    const a = await resolveHandoff(TRAIL), b = await resolveHandoff(TRAIL);
    expect(Buffer.compare(Buffer.from(a.exported.bytes), Buffer.from(b.exported.bytes))).toBe(0);
    const j = glbJson(a.exported.bytes);
    expect(j.extensionsUsed ?? []).not.toContain('KHR_materials_unlit');
    expect(j.materials.every((m) => m.pbrMetallicRoughness)).toBe(true);
    const n = a.payload.form.land.stones.n;
    expect(n).toBeGreaterThan(0);
    expect(a.ledger).toMatchObject({ version: HANDOFF_VERSION, era: 'gen-7', what: 'level', carried: { instances: { stones: n } } });
    expect(j.nodes.filter((x) => String(x.name).startsWith('form:stones:') && x.mesh !== undefined).length).toBe(n);
    // (each stone set its own lit material in its solved colour)
    const stoneMats = j.materials.filter((m) => String(m.name).startsWith('form:stones:'));
    expect(stoneMats.length).toBe(a.instances.length);
    for (const m of stoneMats) expect(m.pbrMetallicRoughness.baseColorFactor.slice(0, 3).some((v) => v > 0 && v < 1)).toBe(true);
  }, 300_000);

  it('a stone stands on its normal, yawed by its index, as wide and deep as the page draws it', () => {
    const n = [0.6, 0, 0.8], at = [1, 2, 3], r = 0.5;
    const pack = new Float32Array([...at, r, ...n, 1, 2]);
    const [set] = stoneInstances({ n: 1, px: Buffer.from(pack.buffer).toString('base64'), base: [0.5, 0.4, 0.3] });
    expect(set.name).toBe('form:stones:2:near:1.0');
    const t = set.transforms[0];
    expect(t.translation).toEqual(at);
    const up = rotate(t.rotation, [0, 0, 1]);
    for (let k = 0; k < 3; k++) expect(up[k]).toBeCloseTo(n[k], 4);
    expect(t.scale[2]).toBe(r);
    expect(t.scale[0]).toBeGreaterThanOrEqual(0.45 - 1e-6);
    expect(t.scale[0]).toBeLessThanOrEqual(0.6 + 1e-6);
    // (a stone on flat ground: its yaw alone, about +Z)
    const [flat] = stoneInstances({ n: 1, px: Buffer.from(new Float32Array([0, 0, 0, 0.1, 0, 0, 1, 1, 0]).buffer).toString('base64'), base: [0.5, 0.5, 0.5] });
    expect(flat.transforms[0].rotation.slice(0, 2)).toEqual([0, 0]);
  });

  it('a thing that is no world hands off its albedo, with no instances', async () => {
    const h = await resolveHandoff({ title: 'box', manifest: { kind: 'workbench', units: 'mm', frames: [{ id: 'box', unit: 'mm', build: { type: 'table', w: 600, d: 400, h: 450, species: 'oak' } }] } }, { what: 'asset' });
    expect(h.instances).toEqual([]);
    expect(h.ledger.carried.instances).toEqual({});
    expect(glbJson(h.exported.bytes).extensionsUsed ?? []).not.toContain('KHR_materials_unlit');
  }, 120_000);
});
