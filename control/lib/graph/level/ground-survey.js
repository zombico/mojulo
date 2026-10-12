/**
 * THE GROUND SURVEY — a level's ground read back from above, on its grid (ground.js), for whoever shapes it next: a
 * map of the cells (each cell's height as a digit, what stands in it as a mark), the dials each trail is built by,
 * the trails' laws that the ground now breaks, and the HOTSPOTS: the places that already ask for something (a summit,
 * a hollow, open flat ground, a dull stretch of walk), each with edits ready to paste into `level.ground.edits`.
 *
 * The survey advises; it never edits. `surveyLevelGround(level)` builds every trail's site (the same sites the stage
 * builds), so it costs what laying the level costs. Pure.
 */
import { readLevel } from './graph.js';
import { sequentialOrder, sequentialLevel } from './sequential.js';
import { levelFrame, cellName, parseCell, GROUND_CELL } from './ground.js';
import { outTrailOf } from '../era/out-trail-board.js';
import { outTrailLaws } from '../era/out-trail.js';

const r1 = (v) => Math.round(v * 10) / 10;
const K = 4;   // samples a side in a cell
/** The marks a map cell can carry, strongest first. */
export const SURVEY_MARKS = Object.freeze({
  T: 'trailhead', X: 'exit', R: 'reveal', L: 'landmark', P: 'pocket', C: 'crossing', N: 'pinch', S: 'rest', O: 'pit',
  '#': 'stairs', '=': 'the walk', '^': 'summit', v: 'hollow', '_': 'open flat ground', '|': 'behind the far cliff', '.': 'nothing',
});
const BEAT_MARK = { trailhead: 'T', exit: 'X', reveal: 'R', landmark: 'L', pocket: 'P', crossing: 'C', pinch: 'N', rest: 'S', pit: 'O' };

/** Survey a level recipe's ground (level/graph.js shape; a gameworld level as resolveLevel lays it). */
export function surveyLevelGround(recipe, { inspect = [], top = 12 } = {}) {
  const G = readLevel(recipe), order = sequentialOrder(G), laid = sequentialLevel(G);
  const F = levelFrame(G, order, G.ground?.cell ?? GROUND_CELL.d);
  if (!F) throw new Error('level: a ground survey reads a level\'s trails, and this level has none (a climb\'s ground is its tiers)');
  const trails = laid.stages.filter((s) => s.section === 'trail').map((s) => {
    const span = F.spans.find((p) => p.node === s.node), { st, site } = outTrailOf(s.manifest);
    return { node: s.node, st, site, origin: span.origin, D: span.D };
  });
  const trailAt = (y) => trails.find((t) => y >= t.origin && y < t.origin + t.D) ?? trails[trails.length - 1];

  // ── the cells ──
  const { rows, cols, cell, x0 } = F, cells = [];
  for (let r = 1; r <= rows; r++) for (let c = 0; c < cols; c++) {
    const cx0 = x0 + c * cell, cy0 = (r - 1) * cell, t = trailAt(cy0 + cell / 2), S = t.site, z = [];
    let walk = false, walkZ = 0, walkN = 0;
    for (let j = 0; j < K; j++) {
      const y = cy0 + ((j + 0.5) / K) * cell, yl = Math.min(t.D, y - t.origin);
      for (let i = 0; i < K; i++) z.push(S.ground(cx0 + ((i + 0.5) / K) * cell, yl));
      const wx = S.trailX(yl);
      if (wx >= cx0 && wx < cx0 + cell) { walk = true; walkZ += S.out.plan.smoothAt(S.out.plan.sOf(yl)); walkN++; }
    }
    let lo = Infinity, hi = -Infinity, sum = 0, steep = 0;
    for (const v of z) { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; }
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) {
      if (i + 1 < K) steep = Math.max(steep, Math.abs(z[j * K + i + 1] - z[j * K + i]) / (cell / K));
      if (j + 1 < K) steep = Math.max(steep, Math.abs(z[(j + 1) * K + i] - z[j * K + i]) / (cell / K));
    }
    const cyl = cy0 + cell / 2 - t.origin;
    cells.push({ c, r, name: cellName(c, r), node: t.node, mean: sum / z.length, lo, hi, steep, walk, walkZ: walkN ? walkZ / walkN : null,
      behind: x0 + (c + 0.5) * cell < S.cliffX(Math.min(t.D, cyl)) + 1, marks: [] });
  }
  const at = (c, r) => (c >= 0 && c < cols && r >= 1 && r <= rows ? cells[(r - 1) * cols + c] : null);
  const cellOfPt = (x, y) => { const p = parseCell(F.cellOf(x, y)); return at(p.c, p.r); };
  for (const t of trails) for (const a of t.site.out.anchors) {
    const k = a.kind === 'beat' ? BEAT_MARK[a.beat] : a.kind === 'site' && a.site === 'stairs' ? '#' : null;
    if (k && Array.isArray(a.at)) cellOfPt(a.at[0], a.at[1] + t.origin)?.marks.push(k);
  }

  // ── the hotspots ──
  const nb = (q) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([dc, dr]) => at(q.c + dc, q.r + dr)).filter((n) => n && !n.behind);
  const open = (q) => !q.behind && !q.walk && !q.marks.length;
  const hot = [];
  for (const q of cells) {
    // a cell at the far cliff's foot reads the talus, not a hill: summits and hollows are read in the open
    if (q.behind || [[-1, 0], [-1, -1], [-1, 1]].some(([dc, dr]) => at(q.c + dc, q.r + dr)?.behind)) continue;
    const n = nb(q); if (n.length < 3) continue;
    const avg = n.reduce((a, b) => a + b.mean, 0) / n.length;
    if (n.every((m) => q.mean > m.mean) && q.mean - avg >= 0.8) {
      const seen = seenFromWalk(q, trailAt, F);
      hot.push({ kind: 'summit', cell: q.name, score: q.mean - avg, height: r1(q.mean), rise: r1(q.mean - avg), seen,
        why: `stands ${r1(q.mean - avg)} m over the ground round it${seen ? ', seen from the walk' : ', hidden from the walk'}${q.walk ? ', on the walk' : ''}`,
        suggest: q.walk
          ? [{ op: 'raise', at: q.name, height: 2, shape: 'dome', why: 'a crest to climb to: a reveal\'s top' }]
          : [{ op: 'raise', at: q.name, height: seen ? 3 : 5, shape: 'dome', why: seen ? 'a lookout or a landmark\'s seat: lift it so it reads from the walk' : 'lift it until the walk sees it, or leave it as a hidden reward' }] });
    } else if (n.every((m) => q.mean < m.mean) && avg - q.mean >= 0.6) {
      hot.push({ kind: 'hollow', cell: q.name, score: avg - q.mean, height: r1(q.mean), sink: r1(avg - q.mean),
        why: `sits ${r1(avg - q.mean)} m under the ground round it`,
        suggest: [{ op: 'lower', at: q.name, depth: 1.5, why: 'a basin: a pocket\'s floor, a pond, a camp out of the wind' }] });
    }
  }
  // open flat ground: 4-connected runs of level, unmarked cells off the walk
  const flat = (q) => open(q) && q.hi - q.lo < 0.6 && q.steep < 0.2, seenFlat = new Set();
  for (const q of cells) {
    if (seenFlat.has(q) || !flat(q)) continue;
    const region = [], stack = [q]; seenFlat.add(q);
    while (stack.length) {
      const p = stack.pop(); region.push(p);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const m = at(p.c + dc, p.r + dr); if (m && !seenFlat.has(m) && flat(m)) { seenFlat.add(m); stack.push(m); } }
    }
    if (region.length < 4) continue;
    const c0 = Math.min(...region.map((p) => p.c)), c1 = Math.max(...region.map((p) => p.c)), rr0 = Math.min(...region.map((p) => p.r)), rr1 = Math.max(...region.map((p) => p.r));
    const mid = region.reduce((b, p) => (Math.hypot(p.c - (c0 + c1) / 2, p.r - (rr0 + rr1) / 2) < Math.hypot(b.c - (c0 + c1) / 2, b.r - (rr0 + rr1) / 2) ? p : b), region[0]);
    for (const p of region) p.flat = true;
    hot.push({ kind: 'open', block: `${cellName(c0, rr0)}:${cellName(c1, rr1)}`, cells: region.length, score: region.length / 8,
      why: `${region.length} cells of level, open ground off the walk`,
      suggest: [
        { op: 'raise', at: mid.name, height: 3, shape: 'dome', why: 'a mound to break it, a knoll to stand a landmark on' },
        { op: 'flatten', at: `${cellName(c0, rr0)}:${cellName(c1, rr1)}`, why: 'or keep it, laid true: a camp, a field, a town plot' },
      ] });
  }
  // dull stretches of walk: four rows or more where the walk holds its height and nothing happens
  const walkRows = [];
  for (let r = 1; r <= rows; r++) {
    const w = cells.filter((q) => q.r === r && q.walk);
    walkRows.push(w.length ? { r, z: w.reduce((a, b) => a + b.walkZ, 0) / w.length, c: w[0].c, busy: w.some((q) => q.marks.some((m) => m !== '=' && m !== 'S')) } : null);
  }
  for (let i = 0; i < walkRows.length;) {
    const a = walkRows[i]; if (!a || a.busy) { i++; continue; }
    let j = i, lo = a.z, hi = a.z;
    while (j + 1 < walkRows.length && walkRows[j + 1] && !walkRows[j + 1].busy && Math.max(hi, walkRows[j + 1].z) - Math.min(lo, walkRows[j + 1].z) <= 0.5) { j++; lo = Math.min(lo, walkRows[j].z); hi = Math.max(hi, walkRows[j].z); }
    if (j - i + 1 >= 4) {
      const m = walkRows[Math.floor((i + j) / 2)], side = Math.min(cols - 1, m.c + 2);
      hot.push({ kind: 'dull', rows: `${a.r}–${walkRows[j].r}`, score: (j - i + 1) / 2, why: `${(j - i + 1) * cell} m of walk within ${r1(hi - lo)} m of level, nothing on it`,
        suggest: [
          { op: 'raise', at: cellName(m.c, m.r), height: 2.5, shape: 'dome', why: 'a crest on the walk: a climb, and a view off its top' },
          { op: 'ridge', path: `${cellName(side, a.r)}>${cellName(side, walkRows[j].r)}`, height: 3, why: 'a spine beside the walk, to walk under' },
          { op: 'gorge', path: `${cellName(Math.max(0, m.c - 2), m.r)}>${cellName(Math.min(cols - 1, m.c + 2), m.r)}`, depth: 3, why: 'a cut across it: down and up again (stairs sites follow)' },
        ] });
    }
    i = j + 1;
  }
  // the strongest first; open ground is common, so no more than three of it
  hot.sort((a, b) => b.score - a.score);
  const opens = hot.filter((h) => h.kind === 'open').slice(3);
  for (const h of opens) hot.splice(hot.indexOf(h), 1);

  // ── the map ──
  let zl = Infinity, zh = -Infinity;
  for (const q of cells) if (!q.behind) { zl = Math.min(zl, q.mean); zh = Math.max(zh, q.mean); }
  const summitCells = new Set(hot.filter((h) => h.kind === 'summit').map((h) => h.cell)), hollowCells = new Set(hot.filter((h) => h.kind === 'hollow').map((h) => h.cell));
  const digit = (q) => String(Math.max(0, Math.min(9, Math.floor(((q.mean - zl) / Math.max(0.01, zh - zl)) * 9.999))));
  const mark = (q) => q.marks[0] ?? (q.walk ? '=' : summitCells.has(q.name) ? '^' : hollowCells.has(q.name) ? 'v' : q.behind ? '|' : q.flat ? '_' : '.');
  const head = '     ' + Array.from({ length: cols }, (_, c) => ` ${String.fromCharCode(65 + c)} `).join('');
  const lines = [head];
  for (let r = 1; r <= rows; r++) {
    const t = trailAt((r - 0.5) * cell), first = Math.floor(t.origin / cell) + 1 === r && r > 1;
    lines.push(`${String(r).padStart(3)}  ${cells.slice((r - 1) * cols, r * cols).map((q) => `${digit(q)}${mark(q)} `).join('')}${r === 1 || first ? ` ← ${t.node}` : ''}`);
  }

  // ── the trails: their dials, their walk, the laws the ground now breaks ──
  const trailRead = trails.map((t) => {
    const P = t.site.out.plan, Gd = P.G, Lf = t.st.landform, rowsOf = [Math.floor(t.origin / cell) + 1, Math.ceil((t.origin + t.D) / cell)];
    let wlo = Infinity, whi = -Infinity; for (const v of P.profile.smoothed) { wlo = Math.min(wlo, v); whi = Math.max(whi, v); }
    const broken = outTrailLaws(t.site).filter((l) => !l.ok).map(({ law, value, want }) => ({ law, value, want }));
    return { node: t.node, rows: `${rowsOf[0]}–${rowsOf[1]}`, length: r1(t.D),
      dials: { amplitude: r1(Gd.A), depth: r1(Gd.Dp), grade: Gd.grade, drift: Gd.drift, bump: { height: r1(Gd.B), scale: Gd.bumpScale, walk: Gd.bumpWalk },
        shapes: Gd.shapes, cliff: { height: Gd.cliff.height ?? Lf.throw, face: Gd.cliff.face ?? Lf.face } },
      walk: { low: r1(wlo), high: r1(whi), stairs: P.stairs.length }, edits: Gd.edits.length, broken };
  });

  const inspected = inspect.map((ref) => {
    const p = parseCell(ref), q = p && at(p.c, p.r);
    if (!q) return { cell: ref, error: `not a cell on this grid (A1 to ${cellName(cols - 1, rows)})` };
    return { cell: q.name, trail: q.node, height: r1(q.mean), low: r1(q.lo), high: r1(q.hi), steepest: r1(q.steep), walk: q.walk ? r1(q.walkZ) : null,
      behindCliff: q.behind, marks: q.marks.map((m) => SURVEY_MARKS[m]) };
  });

  return {
    grid: { cell, cols, rows, corners: `A1 to ${cellName(cols - 1, rows)}`, across: `A is the far side (the kit's cliff, x ${r1(x0)} m), ${String.fromCharCode(64 + cols)} the open side`, along: 'row 1 is the trailhead; rows run along the walk', heights: `digit 0 = ${r1(zl)} m … 9 = ${r1(zh)} m (cells behind the far cliff left out of the scale)` },
    map: lines.join('\n'),
    legend: Object.entries(SURVEY_MARKS).map(([k, v]) => `${k} ${v}`).join(' · '),
    trails: trailRead,
    hotspots: hot.slice(0, top).map(({ score: _s, ...h }) => h),
    ...(laid.ground ? { placed: laid.ground.placed } : {}),
    // what paints this ground: the geocube, the terrain it got and from whom (graph.js); absent, the kits'
    ...(laid.paint ? { paint: laid.paint } : {}),
    ...(inspected.length ? { inspect: inspected } : {}),
    heights: cells.map((q) => r1(q.mean)),
  };
}

/** Is a cell's top seen from the walk within three rows of it (from a walker's eye, over the ground between)? */
function seenFromWalk(q, trailAt, F) {
  const [tx, ty] = F.at({ c: q.c, r: q.r }), t = trailAt(ty), S = t.site;
  const top = [tx, ty - t.origin, S.ground(tx, ty - t.origin) + 0.5];
  for (let dy = -3 * F.cell; dy <= 3 * F.cell; dy += F.cell) {
    const yl = Math.max(0, Math.min(t.D, top[1] + dy)), ex = S.trailX(yl), eye = [ex, yl, S.ground(ex, yl) + 1.7];
    let clear = true;
    for (let k = 1; k < 40 && clear; k++) { const u = k / 40; if (S.ground(eye[0] + (top[0] - eye[0]) * u, eye[1] + (top[1] - eye[1]) * u) > eye[2] + (top[2] - eye[2]) * u) clear = false; }
    if (clear) return true;
  }
  return false;
}

/** What changed between two surveys of one grid: the cells that moved, most first. */
export function groundDiff(before, after, { min = 0.25, top = 24 } = {}) {
  if (!before || before.grid.cols !== after.grid.cols || before.grid.rows !== after.grid.rows) return { comparable: false };
  const cols = after.grid.cols, moved = [];
  after.heights.forEach((z, k) => { const dz = z - before.heights[k]; if (Math.abs(dz) >= min) moved.push({ cell: cellName(k % cols, Math.floor(k / cols) + 1), dz: r1(dz) }); });
  moved.sort((a, b) => Math.abs(b.dz) - Math.abs(a.dz));
  const broke = after.trails.flatMap((t) => t.broken.filter((l) => !before.trails.find((b) => b.node === t.node)?.broken.some((x) => x.law === l.law)).map((l) => ({ trail: t.node, ...l })));
  const mended = before.trails.flatMap((t) => t.broken.filter((l) => !after.trails.find((a) => a.node === t.node)?.broken.some((x) => x.law === l.law)).map((l) => ({ trail: t.node, law: l.law })));
  return { comparable: true, moved: moved.length, cells: moved.slice(0, top), broke, mended };
}

