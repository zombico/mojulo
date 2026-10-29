/**
 * THE GEOTOWN'S LAWS — what a neighbourhood's map is measured by. Each advises and never refuses: { law, ok, value,
 * want }. The budget's laws are the map's own (every square metre one surface, a back yard every plot); the levels'
 * laws are the land's (a street's grade, a pad's step to its neighbour, the wall where two rows' back yards meet).
 *
 *   geotownLaws(design) → [{ law, ok, value, want }]
 */
import { SURFACES } from './pattern.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const GEOTOWN_LAWS = Object.freeze({
  closes: 'every square metre of the frame is one surface, and every plot\'s allocation sums to the plot',
  'back-yard': 'every plot keeps a back yard at least the pattern\'s least deep',
  coverage: 'a house\'s envelope covers its share of its plot, inside the pattern\'s rail',
  frontage: 'every plot\'s frontage inside its form\'s rail (a corner\'s wider by the corner)',
  setback: 'a block face holds one front yard depth',
  grade: 'no street steeper than the pattern\'s grade',
  'pad-step': 'neighbouring pads along a row step at most the pattern\'s step',
  green: 'the soft ground (verges, yards, parks) at least the pattern\'s share of the map',
  evokes: 'an evocation keeps the town to scale\'s measures: how its plots share their ground, and its mix of semis and detached houses',
});
// how far an evocation's shares may stand from the town to scale's before the law advises
export const EVOKE_TOLERANCE = Object.freeze({ share: 0.08, semis: 0.3 });

/** How a design's plots share their ground (house, front and path, side, back, of all the plots' area) and the share of
 *  its houses that are semis. */
export function plotShares(d) {
  const sum = (k) => d.plots.reduce((a, pl) => a + (Array.isArray(k) ? k.reduce((b, kk) => b + pl.alloc[kk], 0) : pl.alloc[k]), 0), all = d.plots.reduce((a, pl) => a + pl.w * pl.d, 0) || 1;
  return { house: sum('house') / all, front: sum(['front', 'path']) / all, side: sum('side') / all, back: sum('back') / all, semis: d.plots.filter((pl) => pl.form === 'semi').length / (d.plots.length || 1) };
}

/** The laws, measured on a design. */
export function geotownLaws(d) {
  const P = d.pattern, out = [], law = (id, ok, value) => out.push({ law: id, ok, value, want: GEOTOWN_LAWS[id] });
  // the budget closes: the town to a millionth of its area, each plot to a hundredth of a square metre
  const plotErr = Math.max(0, ...d.plots.map((pl) => Math.abs(Object.values(pl.alloc).reduce((a, b) => a + b, 0) - pl.w * pl.d)));
  const townErr = Math.abs(d.ledger.total - d.ledger.frame);
  law('closes', townErr <= d.ledger.frame * 1e-6 + 0.01 && plotErr <= 0.01, `the map ${d.ledger.total} of ${d.ledger.frame} m²; the worst plot off by ${r3(plotErr)} m²`);
  const backs = d.plots.map((pl) => pl.d - pl.setback - pl.house.depth), least = backs.length ? Math.min(...backs) : Infinity;
  law('back-yard', !backs.length || least >= P.back - 1e-6, backs.length ? `the shallowest back yard ${r2(least)} m (least ${P.back})` : 'no plots');
  const cov = d.plots.map((pl) => pl.alloc.house / (pl.w * pl.d)), outCov = cov.filter((c) => c < P.coverage[0] || c > P.coverage[1]).length;
  law('coverage', outCov === 0, cov.length ? `${r2(Math.min(...cov))}–${r2(Math.max(...cov))} of a plot (rail ${P.coverage.join('–')}); ${outCov} outside` : 'no plots');
  const offRail = d.plots.filter((pl) => { const [lo, hi] = P.plot[pl.form], extra = pl.corner === 'both' ? 2 * P.plot.corner : pl.corner ? P.plot.corner : 0; return pl.w < lo - 0.05 || pl.w > hi + extra + 0.05 + (hi - lo) * 0.25; }).length;
  law('frontage', offRail === 0, `${d.plots.length} plots, ${offRail} off their rail`);
  const faces = d.blocks.filter((b) => b.setbacks).flatMap((b) => Object.entries(b.setbacks).map(([s, F]) => ({ b: b.id, s, F, held: d.plots.filter((pl) => pl.block === b.id && pl.side === s).every((pl) => pl.setback === F) })));
  law('setback', faces.every((f) => f.held), faces.length ? faces.map((f) => `${f.b}${f.s} ${f.F} m`).join(', ') : 'no block faces');
  // a street's grade: its ground along its centre, 4 m a step
  let steep = 0, where = null;
  for (const s of d.streets) {
    const z = (t) => (s.axis === 'y' ? d.land.S(s.at, t) : d.land.S(t, s.at));
    for (let t = s.from; t + 4 <= s.to + 1e-9; t += 4) { const g = Math.abs(z(t + 4) - z(t)) / 4; if (g > steep) { steep = g; where = s.id; } }
  }
  law('grade', steep <= P.grade + 1e-9, `the steepest ${r3(steep)} (${where ?? 'none'}), the pattern's most ${P.grade}`);
  // pads along each row, in walking order; and the wall where a block's two rows meet at their back line
  let step = 0, wall = 0;
  for (const b of d.blocks) for (const s of ['w', 'e']) {
    const row = d.plots.filter((pl) => pl.block === b.id && pl.side === s).sort((p, q) => p.k - q.k);
    for (let k = 1; k < row.length; k++) step = Math.max(step, Math.abs(row[k].pad - row[k - 1].pad));
  }
  for (const b of d.blocks) {
    const W = d.plots.filter((pl) => pl.block === b.id && pl.side === 'w'), E = d.plots.filter((pl) => pl.block === b.id && pl.side === 'e');
    for (const p of W) for (const q of E) if (p.rect[1] < q.rect[3] && q.rect[1] < p.rect[3]) wall = Math.max(wall, Math.abs(p.pad - q.pad));
  }
  law('pad-step', step <= P.pad.step + 1e-9, `the largest step between neighbours ${r2(step)} m (most ${P.pad.step}); the highest back wall ${r2(wall)} m`);
  const soft = Object.entries(d.ledger.town).filter(([k]) => SURFACES[k].soft).reduce((a, [, v]) => a + v, 0) / (d.ledger.total || 1);
  // (an evocation's streets ring a block or two: its ground is read by `evokes`, the plots' shares, not the map's)
  if (!d.evoked) law('green', soft >= P.green - 1e-9, `${r2(soft)} of the map is soft ground (least ${P.green})`);
  if (d.evoked) {
    const own = plotShares(d), ref = d.evoked.ref, keys = ['house', 'front', 'side', 'back'];
    const off = Math.max(...keys.map((k) => Math.abs(own[k] - ref[k]))), semis = Math.abs(own.semis - ref.semis);
    law('evokes', off <= EVOKE_TOLERANCE.share && semis <= EVOKE_TOLERANCE.semis, `${d.evoked.shows} plots for ${d.evoked.stands.plots}: ${keys.map((k) => `${k} ${r2(own[k])}/${r2(ref[k])}`).join(', ')}; semis ${r2(own.semis)}/${r2(ref.semis)}`);
  }
  return out;
}
