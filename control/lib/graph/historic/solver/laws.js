/**
 * historic/solver/laws — what the field guide reads besides the plan: the ledger at the town's place and year (what
 * could be built, and any anachronism), and the laws a laid town keeps (every house on a lane, the lanes one network,
 * the monument whole on its site). They advise; none refuse.
 */
import { CELL, C } from '../layout-kit.js';
import { MONUMENTS } from '../monuments/index.js';
import { placeOf, buildableAt, ledgerFindings, cardSurfaces } from '../ledger/index.js';

/** The ledger at this place and year: what was buildable, and what the scene uses that nothing in reach makes. */
export function ledgerOf(X) {
  const { culture, K, F, monuments } = X, place = placeOf(culture);
  return {
    place, buildable: buildableAt(place),
    findings: ledgerFindings(place, { surfaces: cardSurfaces(K), rows: [...new Set([...monuments.flatMap((m) => MONUMENTS[m.id].cites), ...Object.values(F.cites || {}).flat()])] }),
  };
}

/** The laws, each `{ id, want, ok, detail }`. */
export function lawsOf(X) {
  const { slots, houseAssets, laneCells, precinctGateCell, at, cellOf, cols, rows, grid, F, AP, mRect, frame } = X;
  // a house's front: the cells just past its facing side, along its whole width
  const frontCells = (q) => { const r = q.rect, f = q.facing, out = []; for (let t = 0.5; t < (f === 'n' || f === 's' ? r.w : r.d); t += CELL) { const [x, y] = f === 'n' ? [r.x + t, r.y - 1.5] : f === 's' ? [r.x + t, r.y + r.d + 1.5] : f === 'w' ? [r.x - 1.5, r.y + t] : [r.x + r.w + 1.5, r.y + t]; out.push(at(...cellOf(x, y))); } return out; };
  const fronts = slots.filter((q) => houseAssets.has(q.asset)).filter((q) => !frontCells(q).some((v) => v === C.LANE || v === C.OPEN || v === C.PRECINCT)).length;
  // the lanes as one network: the share reachable from the precinct's gate
  const seen = new Uint8Array(cols * rows), q = [];
  let start = null, best = Infinity;
  for (const [c, r] of laneCells) { const d = Math.hypot(c - precinctGateCell[0], r - precinctGateCell[1]); if (d < best && at(c, r) === C.LANE) { best = d; start = [c, r]; } }
  if (start) { q.push(start); seen[start[1] * cols + start[0]] = 1; }
  const bridged = new Set();
  for (const s of slots) if (s.asset === F.water.bridge || s.asset === AP.quay) for (let rr = Math.floor(s.rect.y / CELL); rr < Math.ceil((s.rect.y + s.rect.d) / CELL); rr++) for (let c = Math.floor(s.rect.x / CELL); c < Math.ceil((s.rect.x + s.rect.w) / CELL); c++) bridged.add(rr * cols + c);
  while (q.length) { const [c, r] = q.pop(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || seen[rr * cols + cc]) continue; const v = at(cc, rr); if (v === C.LANE || v === C.OPEN || v === C.PRECINCT || bridged.has(rr * cols + cc)) { seen[rr * cols + cc] = 1; q.push([cc, rr]); } } }
  let lanes = 0, reached = 0; for (let i = 0; i < grid.length; i++) if (grid[i] === C.LANE) { lanes++; if (seen[i]) reached++; }
  const share = lanes ? reached / lanes : 1;
  const inFrame = mRect.x >= 0 && mRect.y >= 0 && mRect.x + mRect.w <= frame.w && mRect.y + mRect.d <= frame.d;
  return [
    { id: 'fronts', want: 'every house has its door on a lane', ok: fronts === 0, detail: fronts ? `${fronts} houses face no lane` : 'every house fronts a lane' },
    { id: 'connected', want: 'the lanes are one network, reached from the monument', ok: share > 0.9, detail: `${Math.round(share * 100)} % of the lanes reached from the precinct's gate` },
    { id: 'monument-fits', want: 'the monument stands whole on its site, inside the frame', ok: inFrame, detail: inFrame ? 'it stands whole' : 'it runs off the frame: move `armature.at` in' },
  ];
}
