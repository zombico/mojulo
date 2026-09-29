import { describe, it, expect } from 'vitest';
import { facesToGlb } from '../scene/scene-gltf.js';
import { facesToUsda } from '../scene/scene-usd.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { resolveMetalSurface } from './metal-surface.js';

const parseGlb = (buf) => JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
const LATHE = (x) => ({ axisFrom: { x, y: 0, z: 0 }, axisTo: { x, y: 0, z: 1 }, profile: [{ t: 0, radius: 0.4 }, { t: 1, radius: 0.4 }] });
const TI = { metal: 'titanium', film: { anodize: 25 } }, AU = { metal: 'gold' };
const faces = () => [...latheToFaces(LATHE(0), { material: TI }), ...latheToFaces(LATHE(2), { material: AU })];

describe('metal surfaces in the exports (metal-surfaces S6)', () => {
  it('glTF: one :metal node per surface, its colour in baseColorFactor (film included), metallic 1, finish roughness', () => {
    const json = parseGlb(facesToGlb({ faces: faces() }).bytes);
    const mats = json.materials.filter((m) => /:metal/.test(m.name || ''));
    expect(mats).toHaveLength(2);
    const ti = resolveMetalSurface(TI), au = resolveMetalSurface(AU);
    const cols = mats.map((m) => m.pbrMetallicRoughness.baseColorFactor.slice(0, 3));
    for (const want of [ti.normal, au.normal]) expect(cols.some((c) => c.every((v, k) => Math.abs(v - want[k]) < 1e-3))).toBe(true);
    for (const m of mats) { expect(m.pbrMetallicRoughness.metallicFactor).toBe(1); expect(m.extensions?.KHR_materials_unlit).toBeUndefined(); }
    expect(ti.normal[2]).toBeGreaterThan(ti.normal[0]);   // the anodized blue travels, not bare titanium grey
    expect(json.nodes.filter((n) => /:metal/.test(n.name || ''))).toHaveLength(2);
  });
  it('glTF: shelf metals keep their old pbr path (no :metal node)', () => {
    const json = parseGlb(facesToGlb({ faces: latheToFaces(LATHE(0), { material: 'gold' }) }).bytes);
    expect(json.nodes.some((n) => /:metal/.test(n.name || ''))).toBe(false);
  });
  it('USD: each metal surface is a look with its own diffuse colour and metallic 1', () => {
    const usda = facesToUsda({ faces: faces() });
    const text = typeof usda === 'string' ? usda : usda.usda || usda.text || JSON.stringify(usda);
    expect((text.match(/def Material "[^"]*metal[^"]*"/g) || []).length).toBe(2);
    expect(text).toMatch(/color3f inputs:diffuseColor = \(/); expect(text).toMatch(/float inputs:metallic = 1/);
  });
});
