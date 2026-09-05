/**
 * bake-prep (room-realism.plan.md, phase 3): the floorplan finding — a per-vertex
 * bake needs room-sized quads split, and floor cells under a rug or a seat bake dark
 * for a true reason.
 */
import assert from 'node:assert';
import { test } from 'vitest';
import { tessellateForBake, coveredMask } from './bake-prep.js';

const quad = (x0, y0, x1, y1, z, extra = {}) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill: '#888888', outNormal: [0, 0, 1], ...extra });

test('tessellateForBake splits a room-sized quad into cells and leaves small / special faces alone', () => {
  const floor = quad(0, 0, 20, 24, 0, { group: 'floor:skin' });
  const small = quad(0, 0, 1, 1, 0);
  const rug = quad(2, 2, 12, 9, 0.05, { cornerFills: ['#1', '#2', '#3', '#4'] });
  const oak = quad(0, 0, 8, 4, 0.02, { texture: 'wood-oak', textureLit: true, uv: [[0, 0], [2, 0], [2, 1], [0, 1]] });
  const decal = quad(0, 0, 8, 8, 0.02, { decal: 'shadow' });
  const tri = { corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], fill: '#888888', outNormal: [0, 0, 1] };
  const out = tessellateForBake([floor, small, rug, decal, tri, oak], 2);
  const oakCells = out.filter((f) => f.texture === 'wood-oak');
  assert.equal(oakCells.length, 4 * 2, 'a textured quad splits too');
  for (const c of oakCells) {
    assert.equal(c.textureLit, true);
    for (const [i, p] of c.corners.entries()) assert.ok(Math.abs(c.uv[i][0] - p[0] / 4) < 1e-9 && Math.abs(c.uv[i][1] - p[1] / 4) < 1e-9, 'uv interpolated with the corner');
  }
  const cells = out.filter((f) => f.group === 'floor:skin');
  assert.equal(cells.length, 10 * 12, '20×24 at 2 ft → 10×12 cells');
  for (const c of cells) {
    assert.equal(c.fill, '#888888'); assert.deepEqual(c.outNormal, [0, 0, 1]);
    for (const p of c.corners) assert.ok(p[0] >= 0 && p[0] <= 20 && p[1] >= 0 && p[1] <= 24 && p[2] === 0);
  }
  const area = cells.reduce((s, c) => s + Math.abs((c.corners[1][0] - c.corners[0][0]) * (c.corners[3][1] - c.corners[0][1])), 0);
  assert.ok(Math.abs(area - 480) < 1e-6, 'cells tile the quad exactly');
  assert.ok(out.includes(small) && out.includes(rug) && out.includes(decal) && out.includes(tri), 'passthrough by identity');
  assert.equal(tessellateForBake([floor], 2, { maxPerEdge: 4 }).length, 16, 'per-edge cap');
  assert.deepEqual(tessellateForBake([floor], 0), [floor], 'no cell → untouched');
});

test('coveredMask flags floor cells under a rug or a seat, not open floor or the rug itself', () => {
  const cells = [];
  for (let i = 0; i < 10; i += 1) for (let j = 0; j < 12; j += 1) cells.push(quad(i * 2, j * 2, i * 2 + 2, j * 2 + 2, 0));
  const rug = quad(4, 4, 12, 10, 0.05);
  const seat = quad(14, 14, 17, 17, 1.2);
  const wall = { corners: [[0, 0, 0], [20, 0, 0], [20, 0, 10], [0, 0, 10]], fill: '#aaa', outNormal: [0, 1, 0] };
  const faces = [...cells, rug, seat, wall];
  const mask = coveredMask(faces);
  const under = cells.filter((c, i) => mask[i]);
  const mid = (c) => [c.corners[0][0] + 1, c.corners[0][1] + 1];
  const underRug = ([x, y]) => x > 4 && x < 12 && y > 4 && y < 10;
  const underSeat = ([x, y]) => x >= 14 && x <= 17 && y >= 14 && y <= 17;
  assert.ok(under.length >= 12, `cells flagged (${under.length})`);
  assert.ok(under.every((c) => underRug(mid(c)) || underSeat(mid(c))), 'only cells whose centre lies under the rug / seat');
  assert.equal(under.filter((c) => underRug(mid(c))).length, 12, 'every cell under the rug');
  assert.equal(mask[cells.length], false, 'the rug itself is not covered');
  assert.equal(mask[cells.length + 2], false, 'a wall is never "covered"');
  assert.ok(!mask[0], 'a corner cell in the open is not covered');
});
