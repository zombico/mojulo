/** mesh-fit (interchange-next N4): a normalised, differently-framed return lands on the greybox. */
import { describe, expect, it } from 'vitest';

import { facesBox, fitFacesToBox } from './mesh-fit.js';

// a unit-ish "return": a box 0.6 × 0.5 wide, 0.9 tall — but tall along mojulo −y (TripoSR after the reader)
const quad = (a, b, c, d) => ({ corners: [a, b, c, d], fill: '#ccc' });
const RETURN = [
  quad([-0.3, -0.45, -0.25], [0.3, -0.45, -0.25], [0.3, 0.45, -0.25], [-0.3, 0.45, -0.25]),
  quad([-0.3, -0.45, 0.25], [0.3, -0.45, 0.25], [0.3, 0.45, 0.25], [-0.3, 0.45, 0.25]),
];
const GREYBOX = { min: [-19.7, -22.59, 0], max: [19.7, 19.7, 100] };

describe('fitFacesToBox', () => {
  it('stands a triposr-framed return up, scales it to the greybox height, floors and centres it', () => {
    const r = fitFacesToBox(RETURN, { box: GREYBOX, up: 'triposr' });
    expect(r.raw.size.map((v) => +v.toFixed(2))).toEqual([0.6, 0.5, 0.9]);
    expect(r.fitted.size.map((v) => +v.toFixed(2))).toEqual([66.67, 55.56, 100]);
    expect(r.fitted.min[2]).toBeCloseTo(0, 6);
    expect((r.fitted.min[0] + r.fitted.max[0]) / 2).toBeCloseTo(0, 6);
    expect((r.fitted.min[1] + r.fitted.max[1]) / 2).toBeCloseTo(-1.445, 6);
    expect(r.scale).toBeCloseTo(100 / 0.9, 6);
  });
  it("'z' leaves the frame alone and only scales + places", () => {
    const r = fitFacesToBox(RETURN, { box: GREYBOX, up: 'z' });
    expect(r.fitted.size[2]).toBeCloseTo(100, 6);
    expect(r.fitted.size[0]).toBeCloseTo(0.6 * (100 / 0.5), 6);
  });
  it('refuses a bad box or up, and a flat return', () => {
    expect(() => fitFacesToBox(RETURN, {})).toThrow(/box/);
    expect(() => fitFacesToBox(RETURN, { box: GREYBOX, up: 'sideways' })).toThrow(/up/);
    expect(() => fitFacesToBox([quad([0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0])], { box: GREYBOX })).toThrow(/height/);
    expect(facesBox(RETURN).size[2]).toBeCloseTo(0.5, 6);
  });
});
