// THE LOOK IN GODOT (IV2–IV6): the page's sky (its background colour, its dome, its haze), a toned stage, the pixel
// medium and a metal's reflections are carried by the score and built by the kernel (since 0.24.0). What a machine can
// hold is held here: the score carries each, absent ⇒ no key, and a headless Godot builds the environment, the sky shader,
// the fog, the tone's materials and the pixel scaling from them, with no shader or script error. Whether it LOOKS like the
// page is the eyes gate: the operator's.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractEngineScore } from './engine-score.js';
import { facesToGlb } from './scene-gltf.js';
import { writeHarnessPack, playInGodot, playBoth } from './godot-harness.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = (x0, y0, x1, y1, z, group) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: '#888888', ...(group ? { group } : {}) });
const walker = { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } };
export function lookLevel(extra = {}) {
  return { faces: [quad(-20, -20, 20, 20, 0, 'floor'), quad(-2, 5, 2, 9, 1, 'stone')], entities: [walker], ...extra };
}
const SKY = { zenith: [40, 80, 160], horizon: [200, 170, 140], day: 0.2, stars: 1, seed: 7, moon: { u: 0.3, h: 0.6, phase: 0.6, nightFactor: 0.8 }, sun: { u: 0.7, h: 0.3 } };
const TONE = { steps: 4, gain: 1.2, mid: 0.5, detail: 0.3, ramps: [[[0.05, 0.03, 0.08], [0.2, 0.1, 0.2], [0.4, 0.3, 0.3], [0.7, 0.6, 0.4], [0.95, 0.9, 0.7]], [[0, 0, 0], [0.1, 0.1, 0.1], [0.3, 0.3, 0.3], [0.6, 0.6, 0.6], [1, 1, 1]]], def: 0, groups: { stone: 1 }, keep: [] };

describe('the look in Godot', () => {
  it('the score carries the background, the dome, the haze and the pixel medium; a plain world none of them', () => {
    const s = extractEngineScore({ ref: 'r', manifest: {} }, lookLevel({ bg: '#223344', sky: SKY, haze: { color: '#a0b0c0', density: 0.02 }, pixel: { scale: 4 } }));
    expect(s.bg).toBe('#223344');
    expect(s.skyDome).toMatchObject({ space: false, zenith: [40, 80, 160], horizon: [200, 170, 140], day: 0.2, stars: 1, seed: 7 });
    expect(s.haze).toEqual({ color: '#a0b0c0', density: 0.02 });
    expect(s.pixel).toEqual({ scale: 4 });
    const plain = extractEngineScore({ ref: 'r', manifest: {} }, lookLevel());
    for (const k of ['bg', 'skyDome', 'haze', 'pixel']) expect(plain, k).not.toHaveProperty(k);
    expect(extractEngineScore({ ref: 'r', manifest: {} }, lookLevel({ backdrop: 'https://example.com/b.png' })).ledger.sky_approximated).toBeTruthy();
  });

  it('a blend tile leaves the GLB as the page draws it: faded in per corner (COLOR_0 RGBA, BLEND), a cut layer masked', () => {
    const q = (z, extra) => ({ corners: [[0, 0, z], [4, 0, z], [4, 4, z], [0, 4, z]], fill: '#808080', ...extra });
    const glb = (faces) => { const b = facesToGlb({ faces }).bytes, n = b.readUInt32LE(12); return JSON.parse(b.slice(20, 20 + n).toString()); };
    const j = glb([q(0, { group: 'ground' }), q(0, { group: 'moss', blend: true, cornerAlpha: [0, 0.5, 1, 0.25] }), q(0, { group: 'cut', blend: 'cut', cornerAlpha: [1, 1, 0, 0] })]);
    const node = (name) => j.meshes[j.nodes.find((x) => x.name === name).mesh];
    expect(j.accessors[node('moss:blend').primitives[0].attributes.COLOR_0].type).toBe('VEC4');
    expect(j.materials.find((m) => m.name === 'moss:blend').alphaMode).toBe('BLEND');
    expect(j.materials.find((m) => m.name === 'cut:blend')).toMatchObject({ alphaMode: 'MASK', alphaCutoff: 0.5 });
    expect(j.materials.find((m) => m.name === 'ground').alphaMode).toBeUndefined();
  });

  const run = (payload) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-look-'));
    try {
      writeHarnessPack(dir, payload, { godot: GODOT });
      return playInGodot(dir, payload, [{}, {}], GODOT);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  const look = (text) => (text.split('\n').find((l) => l.startsWith('[mojulo-look] ')) || '').slice(14);

  it.skipIf(!GODOT)('a headless Godot builds the sky, the haze, the pixel scaling and the tone from the score (MOJULO_GODOT)', () => {
    const a = run(lookLevel({ bg: '#223344', sky: SKY, haze: { color: '#a0b0c0', density: 0.02 }, pixel: { scale: 4 } }));
    expect(a.error).toBe(null);
    expect(a.text).not.toMatch(/SHADER ERROR/);
    expect(look(a.text)).toMatch(/^bg=223344 mode=sky sky=ShaderMaterial fog=true density=0\.0200 fogcolor=a0b0c0 reflect=false scale=0\.250 filter=nearest$/);
    const space = run(lookLevel({ sky: { space: true, stars: 1, sun: { dir: [1, 0, 0.2] } } }));
    expect(space.error).toBe(null);
    expect(look(space.text)).toMatch(/mode=sky sky=ShaderMaterial fog=false/);
    const toned = run(lookLevel({ tone: TONE }));
    expect(toned.error).toBe(null);
    expect(toned.text).not.toMatch(/SHADER ERROR/);
    expect(toned.text).toMatch(/moj: tone over 2 surface material\(s\)/);
    expect(look(toned.text)).toMatch(/^bg=0d0814 mode=color/);   // the background takes the default ramp's darkest stop
    // a metal surface reflects a sky: the plain studio one when the level has none (IV6)
    const metal = run(lookLevel({ faces: [quad(-20, -20, 20, 20, 0, 'floor'), { ...quad(-2, 5, 2, 9, 1, 'plate'), metal: { s: '{"metal":"steel","finish":"brushed","along":"x","seed":0}', d: 0, ta: 0 } }] }));
    expect(metal.error).toBe(null);
    expect(look(metal.text)).toMatch(/mode=color sky=ProceduralSkyMaterial .* reflect=true/);
    // a blend tile over the ground: imported clean, and the pilot stands on the ground under it as the page's does
    const blended = lookLevel({ faces: [quad(-20, -20, 20, 20, 0, 'floor'), { ...quad(-6, -6, 6, 6, 0, 'moss'), blend: true, cornerAlpha: [0, 1, 1, 0] }] });
    const walk = Array.from({ length: 40 }, () => ({ forward: 1 }));
    const bb = playBoth(blended, walk, { godot: GODOT });
    expect(bb.godot.error).toBe(null);
    expect(bb.compare.equal).toBe(true);
    const plain = run(lookLevel());
    expect(look(plain.text)).toBe('');
  }, 600000);
});
