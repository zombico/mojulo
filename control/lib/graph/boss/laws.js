/**
 * THE LAWS OF A PATTERN — what a boss's attack must hold for the body facing it: it is TOLD before it lands, every place
 * it lands can be ESCAPED, it is SURVIVABLE whole, and an OPENING follows it. Measured, never declared: the pattern is laid
 * (patterns.js layPattern) with the body `reach` metres down the aim, and each hazard is read over a quarter-metre grid of
 * the ground it touches, cell by cell: when it first lands there (after its mark is shown), how long it stays, and how
 * far the nearest ground it never touches lies (a chamfer distance over the grid).
 *
 * A cell is escaped by a body (BODY: the operative's numbers, or a game's own):
 *   out      it runs out in the time left after it reacts (speed × (landing − shown − reaction))
 *   through  the hazard passes over it in less than the dive's invincible time, and the dive can be started in time
 *   under    the hazard passes over a crouch (`low`)
 *   cover    a box between its origin and the body stops it (`cover`): the arena's to supply (arenaLaws), never counted here
 *
 *   BODY                         { speed, reaction, dive: { dist, dur, iframes } }
 *   hazardReads(h, body)         → { cells, shares: { out, through, under, cover, none }, told, worstExit } one laid hazard
 *   patternLaws(pattern, body?)  → [{ law, holds, says }]   told · escapable · survivable · opening
 *
 * Pure: no dice, no clock.
 */
import { readPattern, layPattern, hazardHit, hazardFoot } from './patterns.js';

/** the operative's numbers (gameworld/infiltration-room.js, its feel card): one pace, a dive of a second, invincible through it */
export const BODY = Object.freeze({ speed: 5.8, reaction: 0.6, dive: Object.freeze({ dist: 4.8, dur: 1, iframes: 1 }) });
const CELL = 0.25, DT = 0.02, MARGIN = 6;

/** How one laid hazard is escaped, cell by cell (see the header). */
export function hazardReads(h, body = BODY) {
  const [X0, Y0, X1, Y1] = hazardFoot(h), x0 = X0 - MARGIN, y0 = Y0 - MARGIN, nx = Math.ceil((X1 - x0 + MARGIN) / CELL), ny = Math.ceil((Y1 - y0 + MARGIN) / CELL), N = nx * ny;
  const first = new Float64Array(N).fill(Infinity), dwell = new Float64Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL, k = j * nx + i;
    for (let t = h.t0; t <= h.t1 + 1e-9; t += DT) if (hazardHit(h, x, y, t)) { if (first[k] === Infinity) first[k] = t; dwell[k] += DT; }
  }
  // (how far each cell lies from ground the hazard never touches: a two-pass chamfer, 1 and √2 a cell)
  const dist = new Float64Array(N);
  for (let k = 0; k < N; k++) dist[k] = first[k] === Infinity ? 0 : 1e9;
  const D = Math.SQRT2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!dist[k]) continue; let d = dist[k]; if (i > 0) d = Math.min(d, dist[k - 1] + 1); if (j > 0) d = Math.min(d, dist[k - nx] + 1); if (i > 0 && j > 0) d = Math.min(d, dist[k - nx - 1] + D); if (i < nx - 1 && j > 0) d = Math.min(d, dist[k - nx + 1] + D); dist[k] = d; }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; if (!dist[k]) continue; let d = dist[k]; if (i < nx - 1) d = Math.min(d, dist[k + 1] + 1); if (j < ny - 1) d = Math.min(d, dist[k + nx] + 1); if (i < nx - 1 && j < ny - 1) d = Math.min(d, dist[k + nx + 1] + D); if (i > 0 && j < ny - 1) d = Math.min(d, dist[k + nx - 1] + D); dist[k] = d; }
  const S = { out: 0, through: 0, under: 0, cover: 0, none: 0 };
  let cells = 0, told = Infinity, worstExit = 0;
  for (let k = 0; k < N; k++) {
    if (first[k] === Infinity) continue;
    cells++;
    const left = first[k] - h.tm - body.reaction, exit = dist[k] * CELL;
    told = Math.min(told, first[k] - h.tm); worstExit = Math.max(worstExit, exit);
    if (left >= 0 && exit <= body.speed * left) S.out++;
    else if (left >= 0 && dwell[k] <= body.dive.iframes * 0.8) S.through++;
    else if (h.low) S.under++;
    else if (h.cover) S.cover++;
    else S.none++;
  }
  const shares = Object.fromEntries(Object.entries(S).map(([k, v]) => [k, cells ? Math.round((v / cells) * 1000) / 1000 : 0]));
  return { cells, shares, told: told === Infinity ? null : Math.round(told * 100) / 100, worstExit: Math.round(worstExit * 100) / 100 };
}

/** A pattern's laws (see the header). */
export function patternLaws(pattern, body = BODY) {
  const p = readPattern(pattern), H = layPattern(p, [0, 0], [p.reach, 0], 0), R = H.map((h) => hazardReads(h, body));
  const minTold = Math.min(...R.map((r) => r.told ?? Infinity)), none = R.reduce((a, r) => Math.max(a, r.shares.none), 0), cover = R.reduce((a, r) => Math.max(a, r.shares.cover), 0);
  // (survivable: the most a body standing in one place takes, every hazard that ever touches that place landing on it)
  const F = H.map(hazardFoot), bx = [Math.min(...F.map((f) => f[0])), Math.min(...F.map((f) => f[1])), Math.max(...F.map((f) => f[2])), Math.max(...F.map((f) => f[3]))];
  let harm = 0;
  for (let x = bx[0]; x <= bx[2]; x += 0.5) for (let y = bx[1]; y <= bx[3]; y += 0.5) {
    let sum = 0;
    for (const h of H) for (let t = h.t0; t <= h.t1 + 1e-9; t += 0.05) if (hazardHit(h, x, y, t)) { sum += h.harm; break; }
    harm = Math.max(harm, sum);
  }
  const end = Math.max(...p.hazards.map((h) => h.at + h.for));
  return [
    { law: 'told', holds: minTold >= body.reaction, says: `every landing shown ${Math.round(minTold * 100) / 100} s or more before it comes (a reaction is ${body.reaction} s)` },
    { law: 'escapable', holds: none === 0, says: none ? `${Math.round(none * 100)}% of the ground it lands on cannot be left, passed under or dived through in time` : cover ? `escaped everywhere, ${Math.round(cover * 100)}% of it only behind cover the arena must stand` : 'escaped everywhere without cover: out, through or under' },
    { law: 'survivable', holds: harm <= 0.5, says: `a body that stands still anywhere in it takes ${Math.round(harm * 100)}% of its health${harm > 0.5 ? ', more than half: one mistake is a death' : ''}` },
    { law: 'opening', holds: p.open.at >= end - 1e-9 && p.open.for >= 1.2, says: p.open.at < end - 1e-9 ? `its opening (${p.open.at} s) comes before its last hazard ends (${end} s)` : `an opening of ${p.open.for} s after it` },
  ];
}
