/**
 * GRADE — the land reshaped round a building set into its slope (era/stage-buildings.js `embed`): the cut and fill a
 * builder makes before it builds, laid on a trail's ground grid (out-trail.js) after its edits and before anything
 * stands on it, so the ground, its growth and the walk round the building all read the graded land.
 *
 *   grade: [{ box: [x0, y0, x1, y1], z, fall? } | { box, z: [z0, z1], dir: [dx, dy], fall? }, …]   (world metres, the boxes
 *     axis-aligned)
 *     a PAD lays its box level at `z`; a RAMP lays it on a plane rising from `z0` at the box's edge `dir` points away from
 *     to `z1` at the edge it points to (`dir` a quarter-turn unit: [1, 0], [-1, 0], [0, 1], [0, -1]); each eases back
 *     into the land over `fall` metres out of its box (FALL by default; a short one keeps it from leaking onto what
 *     beside it is laid otherwise, a stair's strip). Laid in order, each over what is laid before it, as a flatten is
 *     (out-ground.js), so a pad laid after a ramp holds its level where they meet.
 *
 *   readGrade(grade)                      → the grade checked (internal: a building writes it), or null
 *   applyGrade(g, grade, { gridX, gridY, keep })   the grid's heights moved; `keep(x, y)` 0…1 the share kept as it was
 *                                          (the walk's own ground: the trail holds its height through a pad)
 *
 * Pure.
 */

// how far a grade eases back into the land out of its box (m)
export const FALL = 8;

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];

export function readGrade(grade) {
  if (grade === undefined || grade === null) return null;
  if (!Array.isArray(grade) || grade.some((p) => !p || !isBox(p.box) || !(Number.isFinite(p.z) || (Array.isArray(p.z) && p.z.length === 2 && p.z.every(Number.isFinite) && Array.isArray(p.dir)))))
    throw new Error('stage: _grade is [{ box: [x0, y0, x1, y1], z } | { box, z: [z0, z1], dir }]');
  return grade.length ? grade : null;
}

/** A grade's target height and its weight at (x, y). */
function at(p, x, y) {
  const [x0, y0, x1, y1] = p.box, out = Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, y0 - y, y - y1));
  const w = 1 - smooth(0, p.fall ?? FALL, out);
  if (w <= 0) return null;
  if (!Array.isArray(p.z)) return { z: p.z, w };
  // (a ramp: how far across its box, along `dir`, the point stands, held at its ends past them)
  const [dx, dy] = p.dir, lo = dx ? (dx > 0 ? x0 : x1) : dy > 0 ? y0 : y1, len = dx ? x1 - x0 : y1 - y0;
  const t = Math.max(0, Math.min(1, ((dx ? x : y) - lo) * (dx || dy) / len));
  return { z: p.z[0] + (p.z[1] - p.z[0]) * t, w };
}

export function applyGrade(g, grade, { gridX, gridY, keep = () => 0 }) {
  for (const p of grade) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = gridX(g, i), y = gridY(g, j), a = at(p, x, y); if (!a) continue;
    const w = a.w * (1 - keep(x, y)); if (w <= 0) continue;
    const q = j * g.nx + i; g.z[q] += (a.z - g.z[q]) * w;
    if (g.apron) g.apron[q] *= 1 - w;
    if (g.hard) g.hard[q] *= 1 - w;
  }
  return g;
}
