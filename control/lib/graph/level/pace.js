/**
 * THE PACE — how much happens along a scenario's walk (map-sketch.js `scenario`), measured on the map's own paths at the
 * hero's run: the way from each beat to the next walked tile by tile (grid.js walkFrom, a tile's side a tile's width),
 * its seconds at the run's speed. A segment's interest is its beats a minute of walking; the walk's dead air the longest
 * stretch with nothing in it; its shape the beats' `pace` in order (calm, tension, peak, rest).
 *
 *   paceOf(G, S, tileOf, { run? }) → { run, beats: [{ id, kind, pace, at, metres, seconds }], segments: { <S>: { beats,
 *       metres, seconds, perMinute } }, longest: { from, to, seconds } }
 *     G readGrid's read (its plan), S readSketch's read with a scenario, tileOf map-sketch.js beatTile
 *   paceLaws(P) → [{ law, ok, value }]: dead-air, pace-shape, segment-interest
 * Pure.
 */
import { walkFrom, mapStart } from './grid.js';

// the run a pace is measured at (m/s: a hero's run, a feel's ground.run about it) and the dead air a walk is allowed
export const PACE = Object.freeze({ run: 7, deadAir: 30, interest: 1.5 });
const r1 = (v) => Math.round(v * 10) / 10;

/** The walk's pace: each beat's way from the one before, in metres and seconds at the run. */
export function paceOf(G, S, tileOf, { run = PACE.run } = {}) {
  const J = S.scenario?.beats ?? S.concept?.journey ?? [], T = G.tile, P = G.plan;
  const key = (r, c) => `${r},${c}`, net = G.cells.filter((x) => x.kind === 'path' || (x.kind === 'place' && x.open?.length));
  // (a beat's tile on the paths: its own, else the nearest path tile to it)
  const onNet = ([r, c]) => { const R = Math.round(r), C = Math.round(c); const own = net.find((x) => x.r === R && x.c === C); return own ?? net.reduce((m, x) => (!m || Math.hypot(x.r - r, x.c - c) < Math.hypot(m.r - r, m.c - c) ? x : m), null); };
  let from = mapStart(G);
  const beats = [];
  for (const b of J) {
    // (an arrival with no tile of its own is where the walk sets out)
    const to = b.kind === 'arrival' && !b.tile ? from : onNet(tileOf(G, S, b));
    const tiles = from && to ? walkFrom(G, from).dist.get(key(to.r, to.c)) ?? null : null;
    const metres = tiles == null ? null : tiles * T;
    beats.push({ id: b.id, kind: b.kind, pace: b.pace ?? 'calm', at: b.at, metres, seconds: metres == null ? null : r1(metres / run) });
    if (to) from = to;
  }
  const segments = {};
  for (const seg of Object.keys(P.segments)) {
    const mine = beats.filter((b) => b.at === seg), metres = mine.reduce((t, b) => t + (b.metres ?? 0), 0), seconds = metres / run;
    segments[seg] = { beats: mine.length, metres, seconds: r1(seconds), perMinute: seconds > 0 ? r1((mine.length / seconds) * 60) : mine.length ? Infinity : 0 };
  }
  const gaps = beats.map((b, i) => ({ from: i ? beats[i - 1].id : 'the start', to: b.id, seconds: b.seconds ?? 0 }));
  const longest = gaps.reduce((m, g) => (!m || g.seconds > m.seconds ? g : m), null);
  return { run, beats, segments, longest, route: P.route };
}

/** The pace as laws: they advise. */
export function paceLaws(p) {
  const laws = [], seq = p.beats.map((b) => b.pace);
  // DEAD AIR: no stretch of the walk longer than PACE.deadAir seconds at the run with nothing in it
  laws.push({ law: 'dead-air', ok: !p.longest || p.longest.seconds <= PACE.deadAir, value: p.longest ? `the longest stretch with nothing in it, ${p.longest.from} to ${p.longest.to}, is ${p.longest.seconds} s at the run (${PACE.deadAir} s at most)` : 'no beats' });
  // THE SHAPE: tension before the first peak, a rest or calm after each peak but the last, the last beat a peak
  const bad = [];
  const firstPeak = seq.indexOf('peak');
  if (firstPeak >= 0 && !seq.slice(0, firstPeak).includes('tension')) bad.push('the first peak comes with no tension before it');
  seq.forEach((v, i) => { if (v === 'peak' && i < seq.length - 1 && !['rest', 'calm'].includes(seq[i + 1])) bad.push(`'${p.beats[i].id}' (a peak) is followed by ${seq[i + 1]}, not a breath`); });
  if (seq.length && seq.at(-1) !== 'peak') bad.push(`the walk ends on ${seq.at(-1)}, not its peak`);
  laws.push({ law: 'pace-shape', ok: !bad.length, value: bad.length ? bad.join('; ') : seq.join(' · ') });
  // INTEREST: every segment on the walk has something a minute and a half of walking at least
  const flat = p.route.filter((s) => p.segments[s] && p.segments[s].perMinute < PACE.interest).map((s) => `${s} (${p.segments[s].beats} beat${p.segments[s].beats === 1 ? '' : 's'} over ${p.segments[s].seconds} s)`);
  laws.push({ law: 'segment-interest', ok: !flat.length, value: flat.length ? `too little happens in ${flat.join(', ')}: ${PACE.interest} beats a minute at least` : p.route.map((s) => `${s} ${p.segments[s].perMinute === Infinity ? '∞' : p.segments[s].perMinute}/min`).join(', ') });
  return laws;
}
