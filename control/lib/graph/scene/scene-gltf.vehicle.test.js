// scene-gltf: a race's machines reach the GLB. A racer or supercar minted now is drawn in the form render
// (roster.js MINT, quick.js's supercars), its parts packed `{ form: {…} }` (vehicle-rig.js packFormMesh); the rig export
// (an engine pack's clips '_all') read them as the painted parts' `{ col, q, … }` and threw on every race.

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { racerOf, racerSpec } from '../car-designer/roster.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';
import { ARCHETYPES } from '../egocube/facets.js';
import { loftFigure } from '../car-designer/race-families.js';
import { FLEET } from '../roads/fleet.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { UNBUILT } from '../car-designer/sheet.js';
import { validateBytes } from 'gltf-validator';

function gltfJson(buf) {
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

// how many of the figure's parts are in the form render, and the GLB the rig export makes of it
function exported(fig) {
  const formParts = fig.parts.filter((p) => p?.form).length;
  const out = facesToGlb({ faces: [], figures: { car: fig } }, { clips: '_all' });
  return { formParts, out, json: gltfJson(out.bytes) };
}

describe('a race machine in the form render exports to GLB', () => {
  it('a supercar: its body and wheels decode from their form parts', () => {
    const { formParts, out, json } = exported(supercarFigure({ light: 'form' }));
    expect(formParts).toBeGreaterThan(0);
    expect(json.nodes.some((n) => n.name?.includes('wheelFL'))).toBe(true);
    expect(out.animatedFigures).toContain('car');
    expect(out.triangleCount).toBeGreaterThan(0);
  });

  it('a racer as the roster mints it (gloss, form)', () => {
    const spec = racerSpec(Object.keys(ARCHETYPES)[0], 0, 1);
    expect(spec.light).toBe('form');
    const { formParts, out } = exported(racerOf(spec).S.figure);
    expect(formParts).toBeGreaterThan(0);
    expect(out.animatedFigures).toContain('car');
    expect(out.triangleCount).toBeGreaterThan(0);
  });

  it('a realistic loft carries its material slots: a primitive a slot, its normals, the paint clearcoated, the lamps lit', () => {
    // (one class a body plan, found in code: a car's loft and a heavy class's own body)
    for (const cls of [Object.keys(FLEET).find((c) => FLEET[c].kind === 'car'), Object.keys(FLEET).find((c) => FLEET[c].kind === 'bus')]) {
      const fig = loftFigure({ class: cls, light: 'form' });
      const { out, json } = exported(fig);
      expect(out.triangleCount).toBeGreaterThan(0);
      const named = (n) => json.materials.findIndex((m) => m.name === `form:${n}`);
      for (const slot of ['paint', 'glass', 'rubber', 'alloy']) expect(named(slot), slot).toBeGreaterThanOrEqual(0);
      const paint = json.materials[named('paint')];
      expect(paint.extensions.KHR_materials_clearcoat.clearcoatFactor).toBeGreaterThan(0);
      expect(json.extensionsUsed).toContain('KHR_materials_clearcoat');
      expect(json.materials.some((m) => m.name?.startsWith('form:') && m.emissiveFactor)).toBe(true);
      const body = json.meshes.find((m) => m.name === 'car:root');
      expect(body.primitives.length).toBeGreaterThan(3);
      for (const p of body.primitives) { expect(p.attributes.NORMAL).toBeDefined(); expect(json.materials[p.material].name).toMatch(/^form:/); }
    }
  });
  it('a figure out of the form render keeps its one surface material', () => {
    const { json } = exported(loftFigure({ class: Object.keys(FLEET).find((c) => FLEET[c].kind === 'car'), light: 'paint' }));
    expect(json.materials.some((m) => m.name?.startsWith('form:'))).toBe(false);
    expect(json.meshes.find((m) => m.name === 'car:root').primitives).toHaveLength(1);
  });
});

// a field vehicle (road-military.js: each body the hull kit builds, in camo and worn) as the engines get it: the
// Khronos validator finds no error and no warning, its camo and grime in its vertex colours, its slots its own
describe('a field vehicle exports to a valid GLB', () => {
  // (each body the sheet builds: one still waiting for its parts is not yet a figure)
  for (const cls of Object.keys(MILITARY_CLASSES).filter((k) => !UNBUILT[k])) {
    it(`the ${MILITARY_CLASSES[cls]} body`, async () => {
      const fig = loftFigure({ class: cls, seed: 3, light: 'form', livery: 'woodland' });
      const { out, json } = exported(fig);
      const report = await validateBytes(new Uint8Array(out.bytes), { maxIssues: 50 });
      expect(report.issues.numErrors, JSON.stringify(report.issues.messages.filter((m) => m.severity === 0))).toBe(0);
      expect(report.issues.numWarnings).toBe(0);
      const body = json.meshes.find((m) => m.name === 'car:root');
      expect(body.primitives.every((p) => p.attributes.COLOR_0 !== undefined)).toBe(true);
      for (const slot of ['milPaint', 'mud', 'worn', 'rubber']) expect(json.materials.some((m) => m.name === `form:${slot}`), slot).toBe(true);
      // (a part that turns on its own, a tank's turret, is its own node, so an engine can traverse it)
      const own = fig.bones.filter((b) => b.id === 'turret');
      for (const b of own) expect(json.nodes.some((n) => n.name?.includes(b.id)), b.id).toBe(true);
    }, 60000);
  }
});
