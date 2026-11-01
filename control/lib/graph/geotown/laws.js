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
  'pad-step': 'neighbouring pads along a row step at most the pattern\'s step beyond their walk\'s own fall',
  green: 'the soft ground (verges, yards, parks) at least the pattern\'s share of the map',
  mansions: 'a midtown mansion\'s property much larger than its street\'s houses\', two at most in a block segment, none on a block touching a main or major street',
  fits: 'each segment tuned to its cell: its rows\' frontages spread inside the pattern\'s stretch, its plots no more than half again as deep as they need',
  sites: 'a school\'s or a sports field\'s site near its rails (0.6–1.7 of them) and its surfaces\' shares near the site to scale\'s',
  apart: 'two playing fields (a school\'s, a sports field\'s) never side by side across one street: a block of something else between them',
  parking: 'room for parking: the stalls of its parking lanes, its front pads and its garages, at least its streetscape\'s least a household',
  evokes: 'an evocation keeps the town to scale\'s measures: how its plots share their ground, and its mix of semis and detached houses',
});
// how far an evocation's shares may stand from the town to scale's before the law advises
export const EVOKE_TOLERANCE = Object.freeze({ share: 0.08, semis: 0.3, deep: 1.5 });
// how far a site may stand from its rails, and its shares from the site to scale's
export const SITE_TOLERANCE = Object.freeze({ size: [0.6, 1.7], share: 0.1 });
// (the street's own houses: a mansion is measured as a mansion)
const housesOf = (d) => d.plots.filter((pl) => (pl.kind ?? 'houses') === 'houses' && pl.form !== 'mansion');
// a mansion's property is at least this many times the mean of its street's houses', two at most in a segment
export const MANSION = Object.freeze({ larger: 2, most: 2 });

/** How a design's plots share their ground (house, front and path, side, back, of all the plots' area) and the share of
 *  its houses that are semis. */
export function plotShares(d) {
  const plots = housesOf(d), sum = (k) => plots.reduce((a, pl) => a + (Array.isArray(k) ? k.reduce((b, kk) => b + pl.alloc[kk], 0) : pl.alloc[k]), 0), all = plots.reduce((a, pl) => a + pl.w * pl.d, 0) || 1;
  // (a garage off a lane is its yard's, not its house's)
  const sheds = plots.reduce((a, pl) => a + pl.alloc.house - houseA(pl), 0);
  return { house: (sum('house') - sheds) / all, front: sum(['front', 'path']) / all, side: sum('side') / all, back: (sum('back') + sheds) / all, semis: plots.filter((pl) => pl.form === 'semi').length / (plots.length || 1) };
}
/** A house's own footprint: its envelope (a garage at the back of its yard not in it). */
const houseA = (pl) => (pl.house.env[2] - pl.house.env[0]) * pl.house.depth;

/** Whether two plots of a block's two rows meet along their back lines. */
export function backTouch(p, q) {
  const [a, b] = [p.rect, q.rect], e = 1e-3;
  if (Math.abs(a[2] - b[0]) < e || Math.abs(b[2] - a[0]) < e) return a[1] < b[3] - e && b[1] < a[3] - e;
  if (Math.abs(a[3] - b[1]) < e || Math.abs(b[3] - a[1]) < e) return a[0] < b[2] - e && b[0] < a[2] - e;
  return false;
}

/** The laws, measured on a design. */
export function geotownLaws(d) {
  const P = d.pattern, out = [], law = (id, ok, value) => out.push({ law: id, ok, value, want: GEOTOWN_LAWS[id] });
  // the budget closes: the town to a millionth of its area, each plot to a hundredth of a square metre
  const plotErr = Math.max(0, ...d.plots.map((pl) => Math.abs(Object.values(pl.alloc).reduce((a, b) => a + b, 0) - pl.w * pl.d)));
  const townErr = Math.abs(d.ledger.total - d.ledger.frame);
  law('closes', townErr <= d.ledger.frame * 1e-6 + 0.01 && plotErr <= 0.01, `the map ${d.ledger.total} of ${d.ledger.frame} m²; the worst plot off by ${r3(plotErr)} m²`);
  // (a house's laws: a shop's or a walk-up's plot keeps a service yard, not a garden)
  const H = housesOf(d), backs = d.plots.filter((pl) => pl.rear === 'back').map((pl) => pl.d - pl.house.env[3]), least = backs.length ? Math.min(...backs) : Infinity;
  law('back-yard', !backs.length || least >= P.back - 1e-6, backs.length ? `the shallowest back yard ${r2(least)} m (least ${P.back})` : 'no plots');
  // (an evoked row run deeper than it needs, to fill its cell, keeps its house: its rail's low end by that depth)
  const deepOf = (pl) => Math.max(1, d.evoked?.fits.find((f) => f.block === pl.block && f.side === pl.side)?.deep ?? 1);
  // (a house's share of its plot less its half of a mutual drive, that strip the two houses' common ground, and less a
  // corner's flank, the side yard the corner gives to the cross street)
  const flank = (pl) => (pl.corner === 'both' ? 2 : pl.corner ? 1 : 0) * P.plot.corner;
  const cov = H.map((pl) => houseA(pl) / ((pl.w - (pl.mutual?.w ?? 0) - flank(pl)) * pl.d)), outCov = H.filter((pl, i) => cov[i] < P.coverage[0] / deepOf(pl) - 1e-9 || cov[i] > P.coverage[1]).length;
  law('coverage', outCov === 0, cov.length ? `${r2(Math.min(...cov))}–${r2(Math.max(...cov))} of a plot (rail ${P.coverage.join('–')}${d.evoked ? `, its low end over a row's depth stretch to ${r2(Math.max(...H.map(deepOf)))}` : ''}); ${outCov} outside` : 'no plots');
  const offRail = d.plots.filter((pl) => { const K = (pl.kind ?? 'houses') === 'houses' ? { rail: P.plot[pl.form], corner: P.plot.corner } : { rail: P.rows[pl.kind].frontage, corner: P.rows[pl.kind].corner }, [lo, hi] = K.rail, extra = pl.corner === 'both' ? 2 * K.corner : pl.corner ? K.corner : 0;
    // (an evocation's frontages spread inside its stretch to fill the cell it is tuned to)
    const [a, b] = d.evoked ? P.evoke.stretch : [1, 1];
    return pl.w < lo * Math.min(1, a) - 0.05 || pl.w > hi * Math.max(1, b) + extra + 0.05 + (hi - lo) * 0.25; }).length;
  law('frontage', offRail === 0, `${d.plots.length} plots, ${offRail} off their rail`);
  const faces = d.blocks.flatMap((b) => (b.rows ?? []).map((r) => ({ b: b.id, s: r.side, F: r.setback, held: d.plots.filter((pl) => pl.block === b.id && pl.side === r.side).every((pl) => pl.setback === r.setback) })));
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
  // (a step beyond the street's own fall between the two fronts: a long frontage on a slope falls with its walk)
  const walkAt = (pl) => d.land.S(pl.A[0] + pl.ex[0] * pl.w / 2, pl.A[1] + pl.ex[1] * pl.w / 2);
  for (const b of d.blocks) for (const r of b.rows ?? []) {
    const row = d.plots.filter((pl) => pl.block === b.id && pl.side === r.side).sort((p, q) => p.k - q.k);
    for (let k = 1; k < row.length; k++) step = Math.max(step, Math.abs(row[k].pad - row[k - 1].pad) - Math.abs(walkAt(row[k]) - walkAt(row[k - 1])));
  }
  for (const b of d.blocks) {
    const [ra, rb] = b.rows ?? [];
    if (!rb) continue;
    const A = d.plots.filter((pl) => pl.block === b.id && pl.side === ra.side), B = d.plots.filter((pl) => pl.block === b.id && pl.side === rb.side);
    for (const p of A) for (const q of B) if (backTouch(p, q)) wall = Math.max(wall, Math.abs(p.pad - q.pad));
  }
  law('pad-step', step <= P.pad.step + 1e-9, `the largest step between neighbours ${r2(step)} m past their walk's fall (most ${P.pad.step}); the highest back wall ${r2(wall)} m`);
  const soft = Object.entries(d.ledger.town).filter(([k]) => SURFACES[k].soft).reduce((a, [, v]) => a + v, 0) / (d.ledger.total || 1);
  // (an evocation's streets ring a block or two: its ground is read by `evokes`, the plots' shares, not the map's)
  if (!d.evoked) law('green', soft >= P.green - 1e-9, `${r2(soft)} of the map is soft ground (least ${P.green})`);
  const big = d.plots.filter((pl) => pl.form === 'mansion');
  if (big.length) {
    const mean = H.reduce((a, pl) => a + pl.w * pl.d, 0) / (H.length || 1), per = {};
    for (const pl of big) per[pl.block] = (per[pl.block] ?? 0) + 1;
    const least = Math.min(...big.map((pl) => (pl.w * pl.d) / (mean || 1))), most = Math.max(...Object.values(per));
    // (none on a block touching a main or a major street)
    const busy = big.filter((pl) => { const B = d.blocks.find((b) => b.id === pl.block); return [d.sections.x[B.i], d.sections.x[(B.i1 ?? B.i) + 1], d.sections.y[B.j], d.sections.y[(B.j1 ?? B.j) + 1]].some((S) => S.rank !== 'street'); });
    law('mansions', least >= MANSION.larger - 1e-9 && most <= MANSION.most && !busy.length, `${big.length} mansions, the least ${r2(least)} times its street's mean house plot; at most ${most} in a segment; ${busy.length} on a block touching a main or major street`);
  }
  // (a household a house's plot, a mansion's among them; a walk-up's and a shop's lots are their own)
  // (a split house two households, its two flats)
  const PK = P.parking, homes = d.plots.filter((pl) => (pl.kind ?? 'houses') === 'houses').length + d.plots.filter((pl) => pl.duplex).length;
  if (d.parking && PK?.least > 0 && homes) {
    const room = d.parking.stalls + d.parking.pads + 2 * d.parking.garages + (d.parking.laneGarages ?? 0) + (d.parking.mutualGarages ?? 0);
    law('parking', room / homes >= PK.least - 1e-9, `${r2(room / homes)} stalls a household (least ${PK.least}): ${d.parking.stalls} on the street (${d.parking.sides}), ${d.parking.pads} front pads, ${d.parking.garages + (d.parking.laneGarages ?? 0) + (d.parking.mutualGarages ?? 0)} garages, for ${homes} households`);
  }
  if (d.beside && d.sites?.length > 1) law('apart', d.beside.length === 0, d.beside.length ? `side by side: ${d.beside.map(([a, b]) => `${a} and ${b}`).join(', ')}` : `${d.sites.length} fields, none side by side`);
  if (d.sites?.length) {
    const T = SITE_TOLERANCE, bad = d.sites.filter((s) => s.stretch < T.size[0] || s.stretch > T.size[1] || s.deepen < T.size[0] || s.deepen > T.size[1] || s.off > T.share);
    law('sites', bad.length === 0, d.sites.map((s) => `${s.block} ${s.type} ${Math.round(s.long)} × ${Math.round(s.deep)} m (${r2(s.stretch)} × ${r2(s.deepen)} of its rails), shares off ${r2(s.off)}`).join('; '));
  }
  if (d.evoked) {
    // (a row of one building other than a house, a walk-up, cannot be recut: its lot takes its cell's slack as grounds)
    const F = d.evoked.fits, ST = P.evoke.stretch, bad = F.filter((f) => (!(f.n === 1 && f.kind !== 'houses') && (f.stretch < ST[0] - 0.1 || f.stretch > ST[1] + 0.1)) || f.deep > EVOKE_TOLERANCE.deep);
    law('fits', bad.length === 0, F.length ? `${F.length} rows: spread ${r2(Math.min(...F.map((f) => f.stretch)))}–${r2(Math.max(...F.map((f) => f.stretch)))}, as deep as ${r2(Math.max(...F.map((f) => f.deep)))} of their need${bad.length ? `; ${bad.map((f) => `${f.block}${f.side}`).join(', ')} past it` : ''}` : 'no rows');
    const own = plotShares(d), ref = d.evoked.ref, keys = ['house', 'front', 'side', 'back'];
    const off = Math.max(...keys.map((k) => Math.abs(own[k] - ref[k]))), semis = Math.abs(own.semis - ref.semis);
    // (a segment of no houses, a school's or a sports field's or a park, is held by `sites`)
    if (housesOf(d).length) law('evokes', off <= EVOKE_TOLERANCE.share && semis <= EVOKE_TOLERANCE.semis, `${d.evoked.shows} plots for ${d.evoked.stands.plots}: ${keys.map((k) => `${k} ${r2(own[k])}/${r2(ref[k])}`).join(', ')}; semis ${r2(own.semis)}/${r2(ref.semis)}`);
  }
  return out;
}
