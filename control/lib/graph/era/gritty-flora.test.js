// Gritty flora (gritty-flora.js): what grows on a gritty land laid with relief in its own colours, as strong as the land
// is gritty; a quiet land's flora as it came.
import { describe, expect, it } from 'vitest';
import { withGrittyFlora, FLORA_CUTS } from './gritty-flora.js';
import { GRIT_PIXELS } from '../matte-paint/fabric.js';
import { assembleStageScene } from './stage.js';

const quad = (group, normal, z = 0) => ({ group, fill: '#506040', normal, corners: normal[2] > 0.7 ? [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]] : [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] });
const faces = () => [quad('isekai:crown', [0, 0, 1], 5), quad('isekai:crown', [0, -1, 0]), quad('isekai:wood', [0, -1, 0]), quad('isekai:wood', [0, 0, 1]), quad('isekai:ground', [0, 0, 1])];

describe('gritty flora', () => {
  it('a quiet land\'s flora comes back as it came', () => {
    const F = faces();
    expect(withGrittyFlora(F, GRIT_PIXELS - 0.01)).toBe(F);
    expect(withGrittyFlora(F, undefined)).toBe(F);
  });

  it('lays leaves on crowns (top and side) and bark up trunks, over the face\'s own colour', () => {
    const [top, side, trunk, cut, ground] = withGrittyFlora(faces(), 0.7);
    for (const f of [top, side, trunk]) { expect(f.texture).toMatch(/^detail:dressed-/); expect(f.textureLit).toBe(true); expect(f.uv).toHaveLength(4); }
    expect(top.texture).not.toBe(trunk.texture);
    // (a trunk's level cut, its top, is no bark; the ground is not flora)
    expect(cut.texture).toBeUndefined();
    expect(ground.texture).toBeUndefined();
    expect(Object.keys(FLORA_CUTS)).toEqual(['isekai:crown', 'isekai:wood']);
  });

  it('its strength is the land\'s grit: another grit, another relief', () => {
    expect(withGrittyFlora(faces(), 0.9)[0].texture).not.toBe(withGrittyFlora(faces(), 0.5)[0].texture);
    expect(withGrittyFlora(faces(), 0.7)).toEqual(withGrittyFlora(faces(), 0.7));
  });

  it('a gritty polygon land lays it; a quiet one does not', () => {
    const M = { kind: 'stage', kit: 'isekai-meadow' }, crowns = (P) => P.faces.filter((f) => f.group === 'isekai:crown');
    expect(crowns(assembleStageScene({ ...M, shading: { grit: 0.7 } })).some((f) => /^detail:/.test(f.texture || ''))).toBe(true);
    expect(crowns(assembleStageScene({ ...M, shading: true })).some((f) => /^detail:/.test(f.texture || ''))).toBe(false);
  });
});
