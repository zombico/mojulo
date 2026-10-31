/**
 * The engine handoff (scene/handoff.js): a gen-7 trail handed off leaves lit (glTF metal-rough, no unlit extension, no
 * light baked in its colours), its scree's stones as instances turned to their ground and counted in the ledger, the
 * same bytes twice; a stone stands as the page stands it (+Z onto its normal, then its yaw); a thing that is no world
 * hands off its albedo, with no instances.
 */
import { describe, expect, it } from 'vitest';

import { resolveHandoff, stoneInstances, floraInstances, mergeClumps, dressedMaterials, landParts, HANDOFF_VERSION } from './handoff.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { generatedSpecOf } from '../landscape/surface-textures.js';
import { decodePng } from '../era/tone.js';
import { facesToGlb } from './scene-gltf.js';
import { floraRead, FLORA_SPECIES } from '../form/flora-read.js';

const glbJson = (bytes) => { const b = Buffer.from(bytes); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const rotate = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v, ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};

// (the quick plants, as form/flora-read.test.js grows them: a needled tree, whose crown is its sleeve, and a shrub's dome
// of clumps)
const colours = { foliage: '#4a983a', grass: '#7cbf48', stone: '#e2cba0', floor: '#c4875a', accent: '#3a80d0' };
const bases = { foliage: [0.11, 0.33, 0.07], floor: [0.4, 0.2, 0.1] };
const needled = Object.keys(FLORA_SPECIES).find((f) => FLORA_SPECIES[f] === 'pine');
const plants = { form: 'blob', kinds: [needled], bushKinds: null, trees: [{ x: 0, y: 0, z: 0, h: 9, kind: 0, cluster: 0 }, { x: 10, y: 2, z: 1, h: 11, kind: 0, cluster: 0 }],
  bushes: [], shrubs: [{ x: 4, y: 4, z: 0, h: 1.2 }, { x: 6, y: 5, z: 0, h: 1 }] };

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
    // (the land as form: its parts meshes of their own, the layered ground carrying its layers' weights and atlases; the
    // painted land it stands for gone, the sea still the painted one)
    const land = a.instances.filter((s) => s.name.startsWith('form:land:'));
    expect(land.length).toBeGreaterThan(0);
    expect(a.ledger.carried.land.parts).toBe(land.length);
    const groups = new Set(a.payload.form.land.hides);
    const meshNames = new Set(j.meshes.map((m) => m.name));
    for (const g of groups) if (!g.endsWith(':water')) expect(meshNames.has(g), g).toBe(false);
    const layered = j.meshes.filter((m) => m.primitives[0].attributes._SPLAT);
    expect(layered.length).toBe(a.ledger.carried.land.layered);
    expect(layered.length).toBeGreaterThan(0);
    for (const m of layered) {
      const t = j.materials[m.primitives[0].material].extras.mojulo.terrain;
      expect(t.splat).toBe('_SPLAT');
      expect(t.keys).toEqual(a.payload.form.land.layers.keys);
      expect(t.layers.base.index).toBeGreaterThanOrEqual(0);
    }
    // (a trail's cliff under its relief: cut and pushed as the page pushes it)
    if (a.payload.form.land.relief && a.payload.form.land.ranges.some((R) => R.key === 'cliff')) expect(a.ledger.carried.land.reliefCut).toBeGreaterThan(0);
    // (the atlases written once, however many parts point at them)
    const atlasTex = new Set(layered.map((m) => j.materials[m.primitives[0].material].extras.mojulo.terrain.layers.base.index));
    expect(atlasTex.size).toBe(1);
    // (each stone set its own lit material in its solved colour)
    const stoneMats = j.materials.filter((m) => String(m.name).startsWith('form:stones:'));
    expect(stoneMats.length).toBe(a.instances.filter((x) => x.name.startsWith('form:stones:')).length);
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

  it('the plants: each template its wood on its bark and its crown, each plant a node of each, as tall as it stood', () => {
    const F = floraRead(plants, { kinds: plants.kinds, colours, bases }), sets = floraInstances(F);
    const wood = sets.filter((s) => s.name.endsWith(':wood')), crowns = sets.filter((s) => s.name.endsWith(':crown'));
    expect(wood.length).toBe(F.templates.length);
    // (the needled tree's crown is its sleeve, the web's for now; the shrub's dome a crown of clumps)
    expect(crowns.length).toBe(F.templates.filter((t) => !t.sleeve && t.nClumps).length);
    expect(crowns.length).toBeGreaterThan(0);
    expect(wood.reduce((a, s) => a + s.transforms.length, 0)).toBe(F.n);
    // (each plant where it stood, scaled to its height; its wood its template's, indexed, on its bark)
    const pine = wood.find((s) => s.textures);
    expect(pine.transforms[0].translation).toEqual([0, 0, 0]);
    const ti = Number(pine.name.split(':')[2]);
    expect(pine.transforms[1].scale[0] * F.templates[ti].height).toBeCloseTo(11, 2);
    expect(pine.indices.length % 3).toBe(0);
    expect(pine.uvs.length / 2).toBe(pine.positions.length / 3);
    // (a crown's colours under one, its normals unit and leaning out)
    for (const c of crowns) {
      expect(Math.max(...c.colors)).toBeLessThanOrEqual(1);
      for (let k = 0; k < c.normals.length; k += 3) expect(Math.hypot(c.normals[k], c.normals[k + 1], c.normals[k + 2])).toBeCloseTo(1, 4);
    }
    // (written: the bark textured, its height in the extras; the same bytes twice)
    const glb = () => facesToGlb({ faces: [] }, { lit: true, handoff: true, instances: floraInstances(F) });
    const a = glb(), j = glbJson(a.bytes);
    expect(Buffer.compare(Buffer.from(a.bytes), Buffer.from(glb().bytes))).toBe(0);
    const bark = j.materials.find((m) => m.name === pine.name);
    expect(bark.pbrMetallicRoughness.baseColorTexture).toBeDefined();
    expect(bark.normalTexture).toBeDefined();
    expect(bark.extras.mojulo.height).toBeDefined();
    expect(j.nodes.filter((x) => String(x.name).startsWith(`${pine.name}:`)).length).toBe(pine.transforms.length);
  }, 120_000);

  it('a clump merged as the page merges it: its leaves about its site, scaled, the template\'s vertex count', () => {
    const tri = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer).toString('base64'), c = Buffer.from(Uint8Array.from([128, 128, 128, 128, 128, 128, 128, 128, 128])).toString('base64');
    const site = Buffer.from(new Float32Array([5, 6, 7, 0, 0, 1, 1, 0, 0, 2, 1, 0]).buffer).toString('base64');
    const m = mergeClumps(site, 1, [{ p: tri, c, n: 1 }], false);
    expect(Array.from(m.positions)).toEqual([5, 6, 7, 7, 6, 7, 5, 8, 7]);
    expect(Array.from(m.colors)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('the dressed faces: each tile the matte painter painted leaves as the material it was painted from', async () => {
    const h = await resolveHandoff({ title: 'bay', manifest: { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 8, h: 3.5 }] } });
    const keys = Object.keys(h.materials);
    expect(keys.length).toBeGreaterThan(0);
    expect(h.ledger.carried.materials.dressed).toBe(keys.length);
    for (const k of keys) expect(generatedSpecOf(k).gen).toBe('dressed');
    const j = glbJson(h.exported.bytes);
    for (const k of keys) {
      const m = j.materials.find((x) => String(x.name).endsWith(`:${k}`));
      expect(m, k).toBeDefined();
      // (its colour, its relief's normal, glTF's ORM with no metal, its height for parallax over its depth)
      expect(m.pbrMetallicRoughness.baseColorTexture).toBeDefined();
      expect(m.normalTexture).toBeDefined();
      expect(m.occlusionTexture).toBeDefined();
      expect(m.pbrMetallicRoughness.metallicFactor).toBe(0);
      expect(m.extras.mojulo.depth).toBeGreaterThan(0);
      expect(m.extras.mojulo.metres).toBe(generatedSpecOf(k).cfg.metres ?? 2);
    }
    // (a tile's ORM carries no metal: its blue is none)
    const orm = decodePng(h.materials[keys[0]].orm);
    let metal = 0; for (let k = 0; k < orm.W * orm.H; k++) metal = Math.max(metal, orm.px[k * 4 + 2]);
    expect(metal).toBe(0);
    // (a key the painter did not paint is no material)
    expect(dressedMaterials(['asphalt', 'no-such-tile'])).toEqual({});
  }, 300_000);

  it('a cliff under a relief leaves as geometry: its triangles cut finer and pushed along their normal; a shared corner stays', () => {
    const b64 = (a) => Buffer.from(a.buffer).toString('base64');
    // (one standing triangle facing +x; a relief whose every height is its range's floor, -0.2 m: the face pushed back by it)
    const tri = [[0, 0, 0], [0, 1, 0], [0, 0, 1]];
    const land = (shared) => ({
      ranges: [{ key: 'cliff', start: 0, count: 3, rough: 0.9 }, ...(shared ? [{ key: 'soil', start: 3, count: 3, rough: 0.9 }] : [])],
      pos: b64(new Float32Array([...tri.flat(), ...(shared ? [0, 0, 0, 1, 0, 0, 0, -1, 0] : [])])),
      c7: b64(new Uint8Array(Array.from({ length: shared ? 6 : 3 }, () => [128, 128, 128, 255]).flat())),
      spl: b64(new Uint8Array(Array.from({ length: shared ? 6 : 3 }, () => [255, 0, 0, 0]).flat())),
      nrm: b64(new Int8Array(Array.from({ length: shared ? 6 : 3 }, () => [127, 0, 0]).flat())),
      relief: { px: b64(new Uint16Array(4)), size: 2, tile: 1, lo: 0, hi: 0.2 },
      layers: null,
    });
    const [cliff] = landParts(land(false));
    expect(cliff.relief).toBe(36);
    expect(cliff.positions.length / 9).toBe(36);
    for (let k = 0; k < cliff.positions.length; k += 3) expect(cliff.positions[k]).toBeCloseTo(-0.2, 5);
    // (the corner it shares with the soil stays put; the far edge moves)
    const [c2] = landParts(land(true));
    const at = (P, q) => { for (let k = 0; k < P.length; k += 3) if (Math.abs(P[k + 1] - q[1]) < 1e-6 && Math.abs(P[k + 2] - q[2]) < 1e-6) return P[k]; return null; };
    expect(at(c2.positions, [0, 0, 0])).toBeCloseTo(0, 6);
    expect(at(c2.positions, [0, 1, 0])).toBeCloseTo(-0.2, 5);
  });

  it('a room under the form render: its surfaces their solved bases, its lamps the solve\'s lights, the stage\'s own gone', async () => {
    const S = { title: 'room', manifest: { kind: 'geocube', cube: 'island-noon' } };
    const h = await resolveHandoff(S), j = glbJson(h.exported.bytes);
    const room = h.payload.form.room;
    expect(room.lights.length).toBeGreaterThan(0);
    expect(h.ledger.carried.lamps).toBe(room.lights.length);
    const L = j.extensions.KHR_lights_punctual.lights;
    expect(L.map((l) => l.name)).toEqual(room.lights.map((_, i) => `form:lamp:${i}`));
    for (const [i, l] of L.entries()) {
      expect(l.type).toBe('point');
      expect(Math.max(...l.color)).toBeCloseTo(1, 5);
      expect(l.intensity).toBeCloseTo(Math.PI * Math.max(...room.lights[i].key), 4);
      expect(l.range).toBe(room.lights[i].radius);
    }
    // (the solve's bases are not the paint: the same room read plainly unshaded paints other colours)
    const plain = (await resolveWorldScene(S, { unshaded: true, era: 'gen-7' })).payload;
    expect(plain.form?.room).toBeUndefined();
    expect(h.payload.faces.filter((f) => f.fill).map((f) => f.fill)).not.toEqual(plain.faces.filter((f) => f.fill).map((f) => f.fill));
  }, 300_000);

  it('a thing that is no world hands off its albedo, with no instances', async () => {
    const h = await resolveHandoff({ title: 'box', manifest: { kind: 'workbench', units: 'mm', frames: [{ id: 'box', unit: 'mm', build: { type: 'table', w: 600, d: 400, h: 450, species: 'oak' } }] } }, { what: 'asset' });
    expect(h.instances).toEqual([]);
    expect(h.ledger.carried.instances).toEqual({});
    expect(glbJson(h.exported.bytes).extensionsUsed ?? []).not.toContain('KHR_materials_unlit');
  }, 120_000);
});
