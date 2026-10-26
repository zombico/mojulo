// The sand drawn (isekai.js, the substrate's turn) and what lies on it (strand.js): the strand's pieces in the kit's own
// colours, shells only on a shore, nothing on a land with no sand, and no grass on the sand.
import { describe, expect, it } from 'vitest';
import { STRAND, STRAND_GROUP, DUNE_GROUP, strandPiece, strandFill, strewStrand, duneGrass } from './strand.js';
import { GRASSES } from '../vegetation/grass.js';
import { substrateOf } from './substrate-of.js';
import { turnField } from './substrate.js';
import { assembleStageScene } from './stage.js';
import { ISEKAI_STYLES } from './isekai.js';

const st = ISEKAI_STYLES['isekai-meadow'], flat = () => 0;
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

describe('the strand', () => {
  it('builds each kind as small faces in the kit\'s own ramps, the same piece for the same dice', () => {
    const own = new Set([...st.palette.rock, ...(st.palette.sand ?? st.palette.soil)].map(hex));
    for (const kind of Object.keys(STRAND)) {
      const it0 = { x: 1, y: 2, z: 0, size: STRAND[kind].size[1], yaw: 0.4, v: 7 }, fs = strandPiece(kind, it0, flat);
      expect(fs.length, kind).toBeGreaterThan(4);
      expect(fs.every((f) => f.group === STRAND_GROUP && f.corners.length >= 3), kind).toBe(true);
      expect(strandPiece(kind, it0, flat)).toEqual(fs);
      // (a pebble or a shell is its ramp's stop; the wood a mix of two of the kit's own)
      for (const f of fs) if (f.part !== 'wood') expect(own.has(hex(strandFill(st, f, true, false))), `${kind} ${f.part}`).toBe(true);
    }
    expect(GRASSES.marram.habit).toBe('tussock');
  });

  it('lays shells only where a shore says the tide reaches, and only where the ground is its', () => {
    const cells = Array.from({ length: 40 }, (_, k) => [(k % 8) + 0.5, Math.floor(k / 8) + 0.5]);
    const inland = strewStrand(st, { cells, cell: 1, heightAt: flat, seed: 3, grit: 1 });
    expect(inland.some((p) => p.kind === 'shells')).toBe(false);
    const beach = strewStrand(st, { cells, cell: 1, heightAt: flat, seed: 3, grit: 1, shore: (x) => x < 3, on: ([x]) => x < 6 });
    const shells = beach.filter((p) => p.kind === 'shells');
    expect(shells.length).toBeGreaterThan(0);
    // (a shell within its cell's reach of the tide line; nothing past where the ground is the strand's)
    expect(shells.every((p) => p.at[0] < 3.5)).toBe(true);
    expect(beach.every((p) => p.at[0] < 6)).toBe(true);
    expect(duneGrass(st, { cells, cell: 1, heightAt: flat, seed: 3, on: () => false })).toEqual([]);
  });
});

describe('the sand drawn on a stage', () => {
  const M = { kind: 'stage', kit: 'isekai-meadow', trail: {}, biocube: 'meadow', wind: true };
  const groups = (P) => new Set(P.faces.map((f) => f.group));

  it('draws nothing new on a land with no sand: no sand, no strand, no dune grass', () => {
    const P = assembleStageScene({ ...M, shading: { grit: 0.7, skin: 'limestone' } }, {});
    for (const g of ['isekai:sand', STRAND_GROUP, DUNE_GROUP]) expect(groups(P).has(g), g).toBe(false);
  }, 60000);

  it('draws a sandstone flat as sand, dressed, its line through the cells, and no grass on it', () => {
    const shading = { grit: 0.7, skin: 'sandstone' }, P = assembleStageScene({ ...M, shading }, {});
    const S = substrateOf({ ...M, shading }), field = turnField('sandstone', 1);
    const at = ([x, y]) => { const i = Math.floor((x - S.x0) / S.cell), j = Math.floor((y - S.y0) / S.cell); return i >= 0 && j >= 0 && i < S.nx && j < S.ny && S.turnable[j * S.nx + i] === 1 && field(x, y) > 0; };
    const sand = P.faces.filter((f) => f.group === 'isekai:sand');
    expect(sand.length).toBeGreaterThan(0);
    // (the line between sand and turf cuts through cells: some sand faces are not the grid's quads)
    expect(sand.some((f) => f.corners.length !== 4)).toBe(true);
    for (const g of [STRAND_GROUP, DUNE_GROUP]) expect(groups(P).has(g), g).toBe(true);
    // the grass cards stand off it: each card's root, between its two lowest corners
    const roots = P.faces.filter((f) => f.group === 'isekai:grass').map((f) => { const [a, b] = [...f.corners].sort((p, q) => p[2] - q[2]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; });
    expect(roots.length).toBeGreaterThan(0);
    expect(roots.filter(at)).toEqual([]);
    // and the live carpet's cells on it are bare
    const g = P.liveGrass.grid, m = Buffer.from(g.m.__b64, 'base64'), w = g.nx - 1;
    for (let k = 0; k < m.length; k++) if (m[k]) expect(at([g.x0 + (k % w + 0.5) * g.cell, g.y0 + (Math.floor(k / w) + 0.5) * g.cell])).toBe(false);
  }, 60000);
});
