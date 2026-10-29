// scene-gltf: a race's machines reach the GLB. A racer or supercar minted now is drawn in the form render
// (roster.js MINT, quick.js's supercars), its parts packed `{ form: {…} }` (vehicle-rig.js packFormMesh); the rig export
// (an engine pack's clips '_all') read them as the painted parts' `{ col, q, … }` and threw on every race.

import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { racerOf, racerSpec } from '../car-designer/roster.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';
import { ARCHETYPES } from '../egocube/facets.js';

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
});
