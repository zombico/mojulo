// The workbench/assembler leg of the skin seam: a polygomer's baked face list
// renders as a filled control scaffold in the manji-svg lit-face polygon
// contract (data-shade), so skin-projection's reskin applies unchanged — and
// the world bake reproduces the scaffold's viewBox via scaffoldViewBox, so the
// painted skin registers to both the 2D reskin and the 3D faces (the shared
// camera IS the registration).
import { describe, it, expect } from 'vitest';

import { renderFacesScaffoldSvg, scaffoldViewBox } from './faces-scaffold-svg.js';
import { reskinManjiSvg, parseViewBox, bakeSkinOntoFaces, rasterSampler } from './skin-projection.js';
import { lowerObjectFaces, bakeBoundSkinFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';

const LATHE = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 6 },
  profile: [{ t: 0, radius: 2 }, { t: 0.5, radius: 2.6 }, { t: 1, radius: 0.4 }],
  tint: '#8a4a2e',
};
const BENCH = { kind: 'workbench', lathes: [LATHE] };

// A 4×4 raster: solid teal — every on-object sample reads the same albedo.
const TEAL = [42, 140, 128];
const raster = () => {
  const data = Buffer.alloc(4 * 4 * 3);
  for (let i = 0; i < 16; i += 1) { data[i * 3] = TEAL[0]; data[i * 3 + 1] = TEAL[1]; data[i * 3 + 2] = TEAL[2]; }
  return { data, width: 4, height: 4, channels: 3 };
};

describe('workbench control scaffold + reskin', () => {
  it('emits filled polygons with data-shade in the reskinnable contract', () => {
    const faces = lowerObjectFaces(BENCH, WORKBENCH_LIGHT);
    const svg = renderFacesScaffoldSvg(faces, { light: WORKBENCH_LIGHT });
    const shades = svg.match(/data-shade="[\d.]+"/g) || [];
    expect(shades.length).toBe(faces.length);
    expect(svg).toContain('stroke-linejoin="round"');
    expect(parseViewBox(svg)).toEqual(scaffoldViewBox(faces, {}));
  });

  it('is deterministic', () => {
    const faces = lowerObjectFaces(BENCH, WORKBENCH_LIGHT);
    expect(renderFacesScaffoldSvg(faces, { light: WORKBENCH_LIGHT }))
      .toBe(renderFacesScaffoldSvg(faces, { light: WORKBENCH_LIGHT }));
  });

  it('reskinManjiSvg recolors every scaffold face', () => {
    const faces = lowerObjectFaces(BENCH, WORKBENCH_LIGHT);
    const scaffold = renderFacesScaffoldSvg(faces, { light: WORKBENCH_LIGHT });
    const { svg, faces: reskinned } = reskinManjiSvg(scaffold, () => '#2a8c80');
    expect(reskinned).toBe(faces.length);
    expect(svg).not.toContain('#8a4a2e'); // the recipe tint is fully replaced
  });

  it('the 3D bake changes fills under the same camera + viewBox the scaffold used', () => {
    const faces = lowerObjectFaces(BENCH, WORKBENCH_LIGHT);
    const viewBox = scaffoldViewBox(faces, {});
    const baked = bakeSkinOntoFaces(faces, {
      sampler: rasterSampler(raster()), viewBox, light: WORKBENCH_LIGHT,
    });
    expect(baked.length).toBe(faces.length);
    expect(baked.some((f, i) => f.fill !== faces[i].fill)).toBe(true);
    // Every baked fill derives from the teal albedo, never the recipe tint.
    for (const f of baked) expect(f.fill).not.toBe('#8a4a2e');
  });

  it('bakeBoundSkinFaces is a no-op without a skin and applies one when bound', () => {
    const faces = lowerObjectFaces(BENCH, WORKBENCH_LIGHT);
    expect(bakeBoundSkinFaces(faces, null, BENCH)).toBe(faces);
    const worn = bakeBoundSkinFaces(faces, raster(), BENCH);
    expect(worn.some((f, i) => f.fill !== faces[i].fill)).toBe(true);
  });
});

describe('assembler control scaffold', () => {
  it('an assembly of parts scaffolds and reskins as one model', () => {
    const manifest = {
      kind: 'assembler',
      items: [
        { id: 'base', source: { lathes: [LATHE] }, at: [0, 0, 0] },
        { id: 'cap', source: { lathes: [{ ...LATHE, axisTo: { x: 0, y: 0, z: 2 } }] }, at: [0, 0, 6] },
      ],
    };
    const faces = lowerAssemblerFaces(manifest);
    expect(faces.length).toBeGreaterThan(0);
    const scaffold = renderFacesScaffoldSvg(faces, { light: WORKBENCH_LIGHT });
    const { faces: reskinned } = reskinManjiSvg(scaffold, () => '#2a8c80');
    expect(reskinned).toBe(faces.length);
  });
});
