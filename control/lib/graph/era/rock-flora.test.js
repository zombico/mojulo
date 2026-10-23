// The rock ground drawn (isekai.js formationGround) and what grows on it (rock-flora.js): the pieces in the kit's own
// ramps, the clumps rooted in the joints the karst tile draws, nothing new on a land that names no formation, no grass
// on the pavement.
import { describe, expect, it } from 'vitest';
import { ROCK_FLORA, ROCK_FLORA_GROUP, rockPiece, rockFloraFill, growRockFlora } from './rock-flora.js';
import { pavementJoints } from './gritty-flora.js';
import { KARST_GRIKE } from '../matte-paint/dressed.js';
import { substrateOf } from './substrate-of.js';
import { turnField } from './substrate.js';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';

const st = ISEKAI_STYLES['isekai-meadow'], flat = () => 0;
const cells = Array.from({ length: 64 }, (_, k) => [(k % 8) + 0.5, Math.floor(k / 8) + 0.5]);

describe('the rock flora', () => {
  it('builds each kind as small faces in the kit\'s ramps, the same piece for the same dice', () => {
    for (const kind of Object.keys(ROCK_FLORA)) {
      const it0 = { p: [1, 2, 0], size: ROCK_FLORA[kind].size[1], yaw: 0.3, v: 5 }, fs = rockPiece(kind, it0, st.palette);
      expect(fs.length, kind).toBeGreaterThan(1);
      expect(fs.every((f) => f.group === ROCK_FLORA_GROUP && f.corners.length >= 3), kind).toBe(true);
      expect(rockPiece(kind, it0, st.palette)).toEqual(fs);
      for (const f of fs) expect(rockFloraFill(st, f, true, false).every((v) => Number.isInteger(v) && v >= 0 && v <= 255), `${kind} ${f.part}`).toBe(true);
    }
  });

  it('roots its clumps in the karst tile\'s joints and lays its lichen on the clints', () => {
    const J = pavementJoints(), P = growRockFlora(st, { cells, cell: 1, heightAt: flat, seed: 3, grit: 0.7, joints: J });
    const clumps = P.filter((p) => ROCK_FLORA[p.kind].joint), lichen = P.filter((p) => p.kind === 'lichen-crust');
    expect(clumps.length).toBeGreaterThan(0);
    expect(lichen.length).toBeGreaterThan(0);
    expect(clumps.every((p) => J.dist(p.at[0], p.at[1]) < KARST_GRIKE.half + 1e-4)).toBe(true);
    expect(lichen.every((p) => J.dist(p.at[0], p.at[1]) > KARST_GRIKE.half + KARST_GRIKE.lip - 1e-4)).toBe(true);
  });

  it('finds its ferns in the shade', () => {
    const ferns = (shade) => growRockFlora(st, { cells, cell: 1, heightAt: flat, seed: 3, grit: 0.7, shadeAt: () => shade }).filter((p) => p.kind === 'crevice-fern').length;
    expect(ferns(true)).toBeGreaterThan(ferns(false));
  });
});

describe('the rock ground drawn on a stage', () => {
  const M = { kind: 'stage', kit: 'isekai-meadow', trail: {}, biocube: 'meadow' };
  const groups = (P) => new Set(P.faces.map((f) => f.group));

  it('draws nothing new on a land that names no formation', () => {
    const P = assembleStageScene({ ...M, shading: { grit: 0.7 } }, {});
    for (const g of ['isekai:pavement', 'isekai:talus', ROCK_FLORA_GROUP]) expect(groups(P).has(g), g).toBe(false);
  }, 60000);

  it('draws a limestone land\'s pavement and talus, grown, the pavement\'s line through the cells, no grass on it', () => {
    const shading = { grit: 0.7, skin: 'limestone' }, P = assembleStageScene({ ...M, shading }, {});
    const S = substrateOf({ ...M, shading }), field = turnField('limestone', 1);
    const at = ([x, y]) => { const i = Math.floor((x - S.x0) / S.cell), j = Math.floor((y - S.y0) / S.cell); return i >= 0 && j >= 0 && i < S.nx && j < S.ny && S.turnable[j * S.nx + i] === 1 && field(x, y) > 0; };
    const pave = P.faces.filter((f) => f.group === 'isekai:pavement');
    expect(pave.length).toBeGreaterThan(0);
    expect(pave.some((f) => f.corners.length !== 4)).toBe(true);
    for (const g of ['isekai:talus', ROCK_FLORA_GROUP]) expect(groups(P).has(g), g).toBe(true);
    const roots = P.faces.filter((f) => f.group === 'isekai:grass').map((f) => { const [a, b] = [...f.corners].sort((p, q) => p[2] - q[2]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    expect(roots.filter(at)).toEqual([]);
  }, 60000);
});
