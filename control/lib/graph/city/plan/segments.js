/**
 * SEGMENTS: a city cut into the pieces it is played in. A segment is a rectangle of the city cut along its own streets
 * (the frame's edges and every straight run of the spine always; an avenue before a minor street), sized so it can be
 * crossed in a level's span (`across`, metres, the play scale's by default). Neighbours share an edge, and each pair is
 * joined by a PORTAL: the most important street crossing that edge (the spine before an avenue before a minor street,
 * the nearest the edge's middle on a tie), where a walker leaves one level and arrives in the next.
 *
 *   segments: { across?: [lo, hi] }      metres across a segment: game [180, 360], real [300, 600]
 *
 * Pure and dice-free: a function of the streets the plan already laid, so a segment moves only when its streets do.
 */

const r2 = (v) => Math.round(v * 100) / 100;
export const SEGMENT_ACROSS = Object.freeze({ game: [180, 360], real: [300, 600] });
const RANK = { spine: 3, major: 2, minor: 1 };

/** A recipe's `segments`, checked → { across } (null when the city is not cut). */
export function readSegments(s, play) {
  if (s === undefined || s === null || s === false) return null;
  if (s === true) return { across: SEGMENT_ACROSS[play] };
  if (typeof s !== 'object' || Array.isArray(s)) throw new Error('city: segments is true or { across?: [lo, hi] (metres), levels? }');
  for (const k of Object.keys(s)) if (!['across', 'levels', 'enter'].includes(k)) throw new Error(`city: segments.${k} is not a segments setting (across, levels, enter)`);
  const across = s.across ?? SEGMENT_ACROSS[play];
  if (!(Array.isArray(across) && across.length === 2 && across.every((v) => typeof v === 'number' && v >= 60 && v <= 3000) && across[0] < across[1])) throw new Error('city: segments.across is [lo, hi], metres across a segment, 60–3000');
  if (s.levels !== undefined && typeof s.levels !== 'boolean') throw new Error('city: segments.levels is true (mint a level per segment beside the city) or false');
  if (s.enter !== undefined) {
    const e = s.enter;
    if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some((k) => !['walk', 'door'].includes(k)) || !['walk', 'door'].every((k) => e[k] === undefined || (Number.isInteger(e[k]) && e[k] >= 0 && e[k] <= 6))) throw new Error('city: segments.enter is { walk?, door? }: how many of each segment\'s buildings are walked into (a lobby) and entered by a door (a level of its own), 0–6 each');
  }
  return { across, ...(s.levels ? { levels: true } : {}), ...(s.enter ? { enter: s.enter } : {}) };
}

/**
 * Cut [0, max] at a subset of the candidate lines: every forced one kept, each piece as near the middle of `across`
 * as the lines allow (a piece outside it pays for its distance), a minor street a little dearer than an avenue.
 */
function partition(cands, max, [lo, hi]) {
  const xs = [...new Map(cands.map((c) => [r2(c.at), c])).values()].sort((a, b) => a.at - b.at);
  const mid = (lo + hi) / 2, cost = (len) => (len < lo ? (lo - len) * 4 : len > hi ? (len - hi) * 4 : 0) + Math.abs(len - mid) * 0.2;
  const n = xs.length, best = new Array(n).fill(Infinity), prev = new Array(n).fill(-1);
  best[0] = 0;
  for (let j = 1; j < n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      if (best[i] === Infinity) continue;
      const c = best[i] + cost(xs[j].at - xs[i].at) + (xs[j].weight ?? 0) * mid;
      if (c < best[j]) { best[j] = c; prev[j] = i; }
      if (xs[i].forced) break;   // a forced line cannot be skipped
    }
  }
  const cuts = [];
  for (let j = n - 1; j >= 0; j = prev[j]) { cuts.unshift(xs[j]); if (j === 0) break; }
  return cuts.map((c) => c.at);
}

/** The segments of a designed city: [{ id, rect, row, col, neighbours: [{ id, side, portal }] }]. */
export function citySegments(d, S) {
  const { W, D } = d.frame, vertical = (s) => Math.abs(s.pts[0][0] - s.pts[1][0]) < 1e-6 && s.pts.length === 2, horizontal = (s) => Math.abs(s.pts[0][1] - s.pts[1][1]) < 1e-6 && s.pts.length === 2;
  const cand = (pick, coord, max) => {
    const out = [{ at: 0, forced: true }, { at: max, forced: true }];
    for (const s of d.streets.filter(pick)) {
      const at = s.pts[0][coord];
      if (at <= 0 || at >= max) continue;
      out.push({ at, forced: s.source === 'spine', weight: s.source === 'spine' ? 0 : s.rank === 'major' ? 0.02 : 0.12 });
    }
    // a line given twice (a street cut by a site into runs) keeps its most important reading
    const by = new Map();
    for (const c of out) { const k = r2(c.at), o = by.get(k); if (!o || c.forced || (c.weight ?? 1) < (o.weight ?? 1)) by.set(k, c); }
    return [...by.values()];
  };
  const xs = partition(cand(vertical, 0, W), W, S.across), ys = partition(cand(horizontal, 1, D), D, S.across);
  const segs = [];
  for (let j = 1; j < ys.length; j++) for (let i = 1; i < xs.length; i++) {
    segs.push({ id: `r${j}c${i}`, row: j, col: i, rect: { x0: xs[i - 1], x1: xs[i], y0: ys[j - 1], y1: ys[j] }, neighbours: [] });
  }
  const at = (r, c) => segs.find((s) => s.row === r && s.col === c);
  // the portal on a shared edge: the most important street crossing it, the nearest its middle on a tie
  const portalOn = (axis, v, lo, hi) => {
    const cross = [];
    for (const s of d.streets) for (let k = 1; k < s.pts.length; k++) {
      const a = s.pts[k - 1], b = s.pts[k], ca = a[axis] - v, cb = b[axis] - v;
      if (ca * cb > 0 || Math.abs(ca - cb) < 1e-9) continue;   // does not cross (or runs along) the edge
      const t = ca / (ca - cb), o = axis === 0 ? a[1] + (b[1] - a[1]) * t : a[0] + (b[0] - a[0]) * t;
      if (o <= lo + 1 || o >= hi - 1) continue;
      cross.push({ street: s.id, rank: s.source === 'spine' ? RANK.spine : RANK[s.rank], half: s.road / 2 + s.walk, at: axis === 0 ? [r2(v), r2(o)] : [r2(o), r2(v)], off: Math.abs(o - (lo + hi) / 2) });
    }
    cross.sort((p, q) => q.rank - p.rank || p.off - q.off || (p.street < q.street ? -1 : 1));
    return cross[0] ? { street: cross[0].street, at: cross[0].at, half: r2(cross[0].half) } : null;
  };
  for (const s of segs) {
    const E = at(s.row, s.col + 1), Sx = at(s.row + 1, s.col);
    if (E) { const p = portalOn(0, s.rect.x1, s.rect.y0, s.rect.y1); if (p) { s.neighbours.push({ id: E.id, side: 'e', portal: p }); E.neighbours.push({ id: s.id, side: 'w', portal: p }); } }
    if (Sx) { const p = portalOn(1, s.rect.y1, s.rect.x0, s.rect.x1); if (p) { s.neighbours.push({ id: Sx.id, side: 's', portal: p }); Sx.neighbours.push({ id: s.id, side: 'n', portal: p }); } }
  }
  for (const s of segs) {
    s.neighbours.sort((a, b) => (a.id < b.id ? -1 : 1));
    const inside = (x, y) => x >= s.rect.x0 && x < s.rect.x1 && y >= s.rect.y0 && y < s.rect.y1;
    s.lots = d.lots.filter((l) => inside((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2)).map((l) => l.id);
    s.sites = d.sites.filter((x) => inside((x.rect.x0 + x.rect.x1) / 2, (x.rect.y0 + x.rect.y1) / 2)).map((x) => x.id);
    s.across = r2(Math.hypot(s.rect.x1 - s.rect.x0, s.rect.y1 - s.rect.y0));
  }
  return segs;
}
