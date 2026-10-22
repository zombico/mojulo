// Gritty flora (gritty-flora.js): what grows on a gritty land laid with relief in its own colours, as strong as the land
// is gritty; a quiet land's flora as it came.
import { describe, expect, it } from 'vitest';
import { withGrittyFlora, withGrittyGround, FLORA_CUTS } from './gritty-flora.js';
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

  it('lays the path on the trail, turf on the ground, and the verge across a fringe lane from the trail\'s side', () => {
    const lane = { ...quad('isekai:ground', [0, 0, 1]), corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }, land = [quad('isekai:trail', [0, 0, 1]), quad('isekai:ground', [0, 0, 1]), lane];
    expect(withGrittyGround(land, 0.2)).toBe(land);
    // (the trail runs along x = −1: the lane's two corners at x 0 are its side)
    const [path, turf, verge] = withGrittyGround(land, 0.7, { verge: (i) => i === 2, nearTrail: (c) => c[0] + 1 });
    for (const f of [path, turf, verge]) expect(f.texture).toMatch(/^detail:dressed-/);
    expect(new Set([path.texture, turf.texture, verge.texture]).size).toBe(3);
    expect(verge.uv.map((q) => q[1])).toEqual([0, 0, 0.999, 0.999]);
  });

  it('a gritty polygon land lays it; a quiet one does not', () => {
    // (one gritty stage: its broken rock's strewn stones make it a heavy one)
    const M = { kind: 'stage', kit: 'isekai-meadow' }, G = assembleStageScene({ ...M, shading: { grit: 0.7 } }), Q = assembleStageScene({ ...M, shading: true });
    const of = (P, g) => P.faces.filter((f) => f.group === g), detailed = (f) => /^detail:/.test(f.texture || '');
    expect(of(G, 'isekai:crown').some(detailed)).toBe(true);
    expect(of(Q, 'isekai:crown').some(detailed)).toBe(false);
    expect(of(G, 'isekai:trail').every((f) => detailed(f) || Math.abs(f.normal[2]) <= 0.7)).toBe(true);
    expect(of(Q, 'isekai:trail').some(detailed)).toBe(false);
  }, 60000);

  it('a gritty land\'s live grass takes the material light, its contrast the grit\'s, no dry hue', () => {
    const M = { kind: 'stage', kit: 'isekai-meadow', biocube: 'meadow' };
    const G = assembleStageScene({ ...M, shading: { grit: 0.7 } }).liveGrass, Q = assembleStageScene({ ...M, shading: true }).liveGrass;
    const t = (0.7 - GRIT_PIXELS) / (1 - GRIT_PIXELS);
    expect(G.real.ao).toBeCloseTo(0.6 - 0.3 * t, 4);
    expect(G.real.back).toBeCloseTo(0.6 + 0.4 * t, 4);
    expect(G.real.dry).toBe(0);
    expect(Q.real).toBeUndefined();
  }, 60000);
});
