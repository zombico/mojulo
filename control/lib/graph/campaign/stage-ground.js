/**
 * A GROUND STAGE ON THE HOLO TABLE — a stage flown down a planet or a moon (stage.js, a route laid in segments) told on
 * the table over its real ground, not a schematic: the land the level lays, sampled along the way into a heightfield the
 * table draws as terrain; the way as it is flown; each wave where it is posted; the boss where it waits; the pillars in
 * the way; the colony's taller masses where they stand.
 *
 *   stageGround(airspace, { seed }) → { field, vertical, terrain, path, waves, ground?, boss, start, end, rocks, masses } | null
 *     airspace   the level's (a gameworld level's `airspace`, or a built level's manifest: map, ground, rail…)
 *     null for a space stage (no ground) or a route that does not lay
 *
 * The table's frame (metres, as campaign/briefing.js's theatre): the way runs up the table's y from its start, centred,
 * x across it, z up from the lowest ground under the way; `vertical` how much the table stretches heights so a canyon
 * reads (the client multiplies z by it, the things' too). The terrain is a grid { x0, y0, dx, nx, ny, z } (z in decimetres
 * over that floor, row by row along y).
 *
 * Pure but for the ground's own cache (gameworld/levels.js airspaceEnds): the same level, the same table.
 */
import { airspaceEnds } from '../gameworld/levels.js';

/** The table's terrain: samples across the way and along it (at most), and its stretch of the heights. */
export const TABLE_GROUND = Object.freeze({ across: 56, along: 168, vertical: 3, width: 4000, masses: 240, tall: 10 });
const r1 = (v) => Math.round(v * 10) / 10;

export function stageGround(airspace, { seed = 1 } = {}) {
  if (!airspace || !airspace.map || airspace.map.form === 'void' || airspace.space || !airspace.rail) return null;
  let ends;
  // (only what lays the ground and the way: the level's other words, its entities and its game, change neither)
  const M = { kind: 'airspace', map: airspace.map, ...(airspace.ground ? { ground: airspace.ground } : {}), rail: airspace.rail, ...(airspace.sky !== undefined ? { sky: airspace.sky } : {}), seed };
  try { ends = airspaceEnds(M); } catch { return null; }
  const field = ends.airField, R = ends.rail;
  if (!field || !R || !R.path || R.path.length < 2) return null;
  const P = R.path, a = P[0], b = P[P.length - 1];
  // (the table's frame: centred on the way, the way's run turned up the table's y)
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
  const toT = (x, y) => { const dx = x - cx, dy = y - cy; return [dx * uy - dy * ux, dx * ux + dy * uy]; };
  const toW = (tx, ty) => [cx + tx * uy + ty * ux, cy - tx * ux + ty * uy];
  let floor = Infinity; for (const p of P) floor = Math.min(floor, field.groundAt(p[0], p[1]));
  const W = Math.min(TABLE_GROUND.width, 2 * (field.bounds ? Math.min(Math.abs(field.bounds.y[0]), field.bounds.y[1]) : TABLE_GROUND.width));
  const L = len * 1.08, nx = TABLE_GROUND.across, ny = TABLE_GROUND.along, dx = Math.max(W / (nx - 1), L / (ny - 1));
  const gx = Math.round(W / dx) + 1, gy = Math.round(L / dx) + 1, x0 = -((gx - 1) * dx) / 2, y0 = -((gy - 1) * dx) / 2, z = new Array(gx * gy);
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const [X, Y] = toW(x0 + i * dx, y0 + j * dx); z[j * gx + i] = Math.round((field.groundAt(X, Y) - floor) * 10); }
  const at3 = (p) => { const [tx, ty] = toT(p[0], p[1]); return [r1(tx), r1(ty), r1(p[2] - floor)]; };
  // (each wave where its fighters are posted: their middle)
  const waves = R.waves.map((w) => { const F = R.foes.filter((f) => w.foes.includes(f.id)), n = F.length || 1; return at3([0, 1, 2].map((k) => F.reduce((s, f) => s + f.at[k], 0) / n)); });
  // (each ground group where its units stand: their middle)
  const ground = [...new Set((R.units ?? []).map((u) => u.group))].sort((a, b) => a - b).map((g) => { const U = R.units.filter((u) => u.group === g), n = U.length; return at3([0, 1, 2].map((k) => U.reduce((s, u) => s + u.at[k], 0) / n)); });
  // (the colony's masses that read from the table: its blocks and spires, not its habs; the tallest first)
  const A = field.aerial, masses = A ? A.boxes.filter((q) => q[5] >= TABLE_GROUND.tall).sort((p, q) => q[5] - p[5]).slice(0, TABLE_GROUND.masses).map((q) => { const [tx, ty] = toT(q[0], q[1]); return [r1(tx), r1(ty), r1(q[2] - floor), r1(q[3]), r1(q[4]), r1(q[5])]; }) : [];
  return {
    field: Math.round(Math.max(L, W) * 1.04), vertical: TABLE_GROUND.vertical,
    terrain: { x0: r1(x0), y0: r1(y0), dx: r1(dx), nx: gx, ny: gy, z },
    path: P.map(at3), waves, ...(ground.length ? { ground } : {}), boss: at3(R.boss.at), start: at3(a), end: at3(b),
    rocks: R.hazards.map((h) => { const p = at3(h.at); return [p[0], p[1], h.size ? r1(h.base - floor + h.size[2] / 2) : p[2], r1(h.radius)]; }),
    masses,
  };
}
