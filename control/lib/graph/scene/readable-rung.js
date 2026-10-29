/**
 * THE READABLE RUNG (a game's renderer rail, era/compose-purpose.js): a piece drawn from its own faces at a coarser
 * grain, so a level reads at a glance and never goes into face overdrive. Every vertex snaps to the mean of the
 * vertices in its cell of a grid (`cell`, in the faces' own units); a face whose corners collapse to fewer than three,
 * or to no area, is gone, and two faces left on the same corners are one. Vertices shared before are shared after,
 * so nothing cracks; detail under the cell (a knob, a burner's rim, a stitched seam) melts into the form it sits on,
 * and the silhouette, the read, stays. Whatever made the piece (a workbench recipe, a facade, a field) is coarsened
 * alike, deterministically: the same faces and cell give the same faces.
 *
 *   readableFaces(faces, { cell }) → faces
 */

const PER_CORNER = ['uv', 'cornerLight'];
const keyOf = (v, cell) => `${Math.round(v[0] / cell)},${Math.round(v[1] / cell)},${Math.round(v[2] / cell)}`;

export function readableFaces(faces, { cell } = {}) {
  if (!(cell > 0)) throw new Error('readableFaces: cell is the grain, a positive length in the faces\' units');
  // each cell's vertices met, then their mean: the snapped vertex is the cell's, whatever order the faces came in
  const sums = new Map();
  for (const f of faces) for (const v of f.corners) {
    const k = keyOf(v, cell), s = sums.get(k);
    if (s) { s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; s[3] += 1; } else sums.set(k, [v[0], v[1], v[2], 1]);
  }
  const at = new Map([...sums].map(([k, s]) => [k, [s[0] / s[3], s[1] / s[3], s[2] / s[3]]]));
  const out = [], seen = new Set(), least = cell * cell * 0.02;
  for (const f of faces) {
    const keys = [], kept = [];
    f.corners.forEach((v, i) => { const k = keyOf(v, cell); if (keys[keys.length - 1] !== k) { keys.push(k); kept.push(i); } });
    while (keys.length > 1 && keys[0] === keys[keys.length - 1]) { keys.pop(); kept.pop(); }
    if (new Set(keys).size < 3) continue;
    const corners = keys.map((k) => at.get(k));
    // (its area by Newell's normal: a sliver a cell thin is no face)
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < corners.length; i += 1) {
      const a = corners[i], b = corners[(i + 1) % corners.length];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    if (Math.hypot(nx, ny, nz) / 2 < least) continue;
    const id = [...keys].sort().join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    // (what a face carries per corner follows its corners)
    const per = Object.fromEntries(PER_CORNER.filter((p) => Array.isArray(f[p])).map((p) => [p, kept.map((i) => f[p][i])]));
    out.push({ ...f, corners, ...per });
  }
  return out;
}
