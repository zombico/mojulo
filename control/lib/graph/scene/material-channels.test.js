/**
 * Material payload channels (material-response.plan.md P2 + P3) — the contract
 * between material-tagged faces and the two consumers:
 *   • World page: faceListToMesh packs per-vertex `aSpec`; emitThreeWorld splices the
 *     specular block ONLY when a group carries it (zero bytes otherwise — the
 *     glow/shadow one-shot posture, no char-net re-pin).
 *   • .glb export: faces tagged `pbr` split into a real pbrMetallicRoughness node;
 *     everything else stays KHR_materials_unlit, byte-identical to today.
 */

import { describe, it, expect } from 'vitest';

import { faceListToMesh } from '../figures/face-mesh.js';
import { emitThreeWorld } from './scene-three.js';
import { facesToGlb } from './scene-gltf.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { extrudeToFaces } from '../polygonizer/extrude-faces.js';
import { MATERIALS, materialPbr } from '../polygonizer/materials.js';

const quad = (extra = {}) => ({
  corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
  fill: '#808080',
  ...extra,
});

const LATHE = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 1 },
  profile: [{ t: 0, radius: 0.4 }, { t: 1, radius: 0.3 }],
  crossSections: 4,
  samples: 8,
};

function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

describe('spec vertex packing (P2)', () => {
  it('packs [strength, power] per vertex only when a face asks', () => {
    const plain = faceListToMesh([quad(), quad()]);
    expect(plain.specs).toBeNull();
    const mixed = faceListToMesh([quad({ spec: [0.6, 22] }), quad()]);
    expect(mixed.specs).toBeInstanceOf(Float32Array);
    expect(mixed.specs.length).toBe(mixed.vertexCount * 2);
    // first face's 6 verts carry [0.6, 22]; the untagged face's carry the inert [0, 1]
    expect(mixed.specs[0]).toBeCloseTo(0.6, 6);
    expect(mixed.specs[1]).toBe(22);
    expect([mixed.specs[12], mixed.specs[13]]).toEqual([0, 1]);
  });

  it('generators tag faces from the shelf (spec + pbr), and only then', () => {
    const plain = latheToFaces(LATHE, {});
    expect(plain.every((f) => f.spec === undefined && f.pbr === undefined)).toBe(true);
    const gold = latheToFaces(LATHE, { material: 'gold' });
    expect(gold.every((f) => f.spec?.[0] === MATERIALS.gold.specular && f.pbr?.[0] === 1)).toBe(true);
    const box = extrudeToFaces({ profile: { rect: { w: 1, h: 1 } }, axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 1 } }, { material: 'stone' });
    expect(box.every((f) => f.pbr?.[0] === 0)).toBe(true);
    expect(box.every((f) => f.spec?.[0] === MATERIALS.stone.specular)).toBe(true);
  });
});

describe('World emission gating (P2)', () => {
  const base = { viewBox: { width: 320, height: 240 }, inline: true, title: 't' };

  it('no spec faces → zero channel bytes', () => {
    const html = emitThreeWorld({ ...base, faces: [quad()] });
    expect(html).not.toContain('aSpec');
    expect(html).not.toContain('specular channel');
  });

  it('spec faces → the block, the attribute, and the group payload', () => {
    const html = emitThreeWorld({ ...base, faces: [quad(), ...latheToFaces(LATHE, { material: 'chrome' })] });
    expect(html).toContain('aSpec');
    expect(html).toContain('"spec":');
    expect(html).toContain('dFdx');
  });
});

describe('texture × material', () => {
  const texQuad = (extra = {}) => quad({ texture: 'marble-carrara', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], textureLit: true, ...extra });

  it('packs specs per texture group only when a spec face touches it', () => {
    const plain = faceListToMesh([texQuad()]);
    expect(plain.textureGroups['marble-carrara'].specs).toBeNull();
    const mixed = faceListToMesh([texQuad({ spec: [0.22, 12] }), texQuad(), quad({ texture: 'other', uv: [[0, 0], [1, 0], [1, 1], [0, 1]], spec: [0.9, 40] })]);
    const marble = mixed.textureGroups['marble-carrara'];
    expect(marble.specs).toBeInstanceOf(Float32Array);
    expect(marble.specs.length).toBe((marble.positions.length / 3) * 2);
    expect(marble.specs[1]).toBe(12);          // tagged face
    expect(marble.specs[13]).toBe(1);          // untagged face in the same group → inert
    expect(mixed.textureGroups.other.specs[1]).toBe(40);
  });

  it('emits the channel + tex spec payload for a textured-material world', () => {
    const html = emitThreeWorld({
      viewBox: { width: 320, height: 240 }, inline: true, title: 't',
      faces: [texQuad({ spec: [0.22, 12] })],
      textures: { 'marble-carrara': 'data:image/png;base64,iVBORw0KGgo=' },
    });
    expect(html).toContain('aSpec');
    expect(html).toContain('"spec":');
  });

  it('.glb: a textured face with pbr exports a LIT material carrying the tile', () => {
    // 1×1 red PNG data URL
    const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const out = facesToGlb({ faces: [texQuad({ pbr: [0, 0.66] })], textures: { 'marble-carrara': px } });
    const json = parseGlb(out.bytes);
    const m = json.materials.find((x) => x.pbrMetallicRoughness?.baseColorTexture);
    expect(m).toBeTruthy();
    expect(m.extensions?.KHR_materials_unlit).toBeUndefined();
    expect(m.pbrMetallicRoughness.roughnessFactor).toBeCloseTo(0.66, 6);
  });
});

describe('vehicle paint (sticker livery × material)', () => {
  it('sweptFaces tags body/fascia with the paint material, wheels stay untagged', async () => {
    const { sweptFaces } = await import('../vehicles/vehicles-swept.js');
    const plain = sweptFaces({ net: 'sedan', family: 'car' });
    expect(plain.every((f) => f.spec === undefined)).toBe(true);
    const glossy = sweptFaces({ net: 'sedan', family: 'car', material: 'gloss' in MATERIALS ? 'gloss' : 'satin' });
    expect(glossy.length).toBe(plain.length);
    expect(glossy.some((f) => Array.isArray(f.spec))).toBe(true);
    // fills differ (response curve applied) while geometry count is identical
    expect(glossy.map((f) => f.fill).join()).not.toBe(plain.map((f) => f.fill).join());
  });
});

describe('.glb PBR mapping (P3)', () => {
  it('pbr faces split into a real pbrMetallicRoughness node; plain stays unlit', () => {
    const out = facesToGlb({ faces: [quad(), ...latheToFaces(LATHE, { material: 'gold' })] });
    const json = parseGlb(out.bytes);
    const pbrMats = json.materials.filter((m) => !m.extensions?.KHR_materials_unlit);
    const unlitMats = json.materials.filter((m) => m.extensions?.KHR_materials_unlit);
    expect(pbrMats.length).toBe(1);
    expect(unlitMats.length).toBe(1);
    const [metallic, roughness] = materialPbr(MATERIALS.gold);
    expect(pbrMats[0].pbrMetallicRoughness.metallicFactor).toBe(metallic);
    expect(pbrMats[0].pbrMetallicRoughness.roughnessFactor).toBeCloseTo(roughness, 6);
    expect(json.nodes.some((n) => n.name === 'static:pbr')).toBe(true);
  });

  it('no pbr faces → identical shape to today (single unlit material)', () => {
    const out = facesToGlb({ faces: [quad(), quad({ fill: '#334455' })] });
    const json = parseGlb(out.bytes);
    expect(json.materials.length).toBe(1);
    expect(json.materials[0].extensions?.KHR_materials_unlit).toBeTruthy();
    expect(json.nodes.some((n) => /:pbr/.test(n.name || ''))).toBe(false);
  });

  it('two shelf materials in one group → one pbr node per factor pair', () => {
    const faces = [
      ...latheToFaces(LATHE, { material: 'gold' }),
      ...latheToFaces({ ...LATHE, axisFrom: { x: 2, y: 0, z: 0 }, axisTo: { x: 2, y: 0, z: 1 } }, { material: 'stone' }),
    ];
    const json = parseGlb(facesToGlb({ faces }).bytes);
    const pbrMats = json.materials.filter((m) => !m.extensions?.KHR_materials_unlit);
    expect(pbrMats.length).toBe(2);
    const factors = pbrMats.map((m) => m.pbrMetallicRoughness.metallicFactor).sort();
    expect(factors).toEqual([0, 1]);
  });
});
