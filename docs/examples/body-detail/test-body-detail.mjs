/** Machine checks for body-detail: closure, determinism, and the rules the passes hold themselves to. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, toSource, bend, facing, RECIPE, PALETTE, RIGID } from './body-detail.mjs';

const POSED = { grip: 45, tailCurl: 20, lean: 15 };
const rest = build(RECIPE, {}, true), posed = build(RECIPE, POSED, true);

test('every detail part is closed and consistently wound, at rest and posed', () => {
  for (const B of [rest, posed]) { const { audit } = toSource(B, PALETTE); assert.ok(audit.detailParts > 300); assert.equal(audit.open, 0); assert.equal(audit.wind, 0); }
});

test('deterministic, and the detail set never depends on the pose', () => {
  assert.equal(JSON.stringify(toSource(build(RECIPE, {}, true), PALETTE)), JSON.stringify(toSource(rest, PALETTE)));
  assert.deepEqual(Object.keys(posed.parts), Object.keys(rest.parts));
});

test('rigid on rigid: every tile sits where one bone dominates its whole footprint, and bend zones are left bare', () => {
  const tiles = Object.values(rest.parts).filter((p) => p.rigidW !== undefined);
  assert.ok(tiles.length > 50 && rest.stats.gatedTiles > 0);
  for (const t of tiles) assert.ok(t.rigidW >= RIGID - 1e-12, `a tile on ${t.bone} has weight ${t.rigidW}`);
});

test('a pad faces the side its joint flexes toward (the palm), read at the drive\'s extreme', () => {
  const { r } = rest; const L1 = posed.mesh.parts;
  const b = bend(L1, 'handR', 'fingerB1R'); const f = facing(L1, 'handR', 1.3, b.inside);
  assert.ok(f.d > 0.8, `palm pad faces the flex direction by ${f.d}`); assert.ok(r);
});

test('claws never enter a hand at full grip', () => {
  const g = build(RECIPE, { grip: 45 }, true); const M = g.mesh;
  const inside = (P, q) => { let c = 0; for (const f of Object.values(P.faces)) { const [A, B, C] = f.map((k) => P.points[k]); const e1 = B.map((x, i) => x - A[i]), e2 = C.map((x, i) => x - A[i]); const d = [1, 0.0003, 0.0007];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]]; const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-14) continue; const tv = q.map((x, i) => x - A[i]);
    const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det; if (u < 0 || u > 1) continue; const qq = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]]; const v = (d[0] * qq[0] + d[1] * qq[1] + d[2] * qq[2]) / det;
    if (v < 0 || u + v > 1) continue; if ((e2[0] * qq[0] + e2[1] * qq[1] + e2[2] * qq[2]) / det > 0) c++; } return c % 2 === 1; };
  let claws = 0; M.vertices.forEach((q, i) => { if (!/^clawH/.test(M.provenance[i].part)) return; claws++; assert.ok(!inside(M.parts.handR, q) && !inside(M.parts.handL, q), `claw vertex ${i} inside a hand`); });
  assert.ok(claws > 0);
});
