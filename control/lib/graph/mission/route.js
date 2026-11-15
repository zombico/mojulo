/**
 * A MISSION ON A GROUND — the same sections and tasks (sections.js, brief.js) laid along a ROUTE on a ground that is
 * already there, where compose.js lays them down a line on a ground of its own. A route is what a ground gives a body to
 * walk: a geocube trail's lane, a geotown's walk round its block. The mission takes the route's length as it finds it:
 * its sections one after another from where the body is set down, each fight's foes at its band along the way, cover
 * beside the way (never on it), and the way out the ground's own.
 *
 * What differs from a ground of its own, and is said rather than hidden:
 *   - there are no walls: a way on is a ZONE across the route just past its section's end, sealed until its task is met
 *     (a body that walks into it is put back, a step short of the end), and a body may walk round one on open ground. The tasks still hold their order: a section begins
 *     only in its turn (game/objectives.js), so nothing is gained by it
 *   - the route is as long as it is: where the mission asks for more than the ground gives, every section and band is
 *     scaled to fit and the `fits` law says by how much; where the ground gives more, the walk out is the longer
 *   - cover is the ground's blocks (playscape/terrain.js: a wall square to the world, a crate), stood on its land
 *
 *   makeRoute(points, ground?)   → { length, at(s) → { p, dir }, z(x, y), points }   a polyline in metres, by its length
 *   composeOnRoute(brief, route, { seed, room? }) → the mission (compose.js's shape, less its primitives and walls) with
 *       `on: 'route'`, each section's `s: [s0, s1]`, `zone: { at, radius }` and `door: { at, back, radius }`, `blocks`
 *       (the cover asked of the ground), `route: { length, points }` and `fit: { asked, length, scale }`
 *   routeLaws(M, brief)          → [{ law, holds, says }]: fits, grounded, banded, covered, entry-safe, in-order, armed,
 *                                  paced, and gated (what a zone on open ground does and does not hold)
 *   ROUTE                        its numbers (the room either side of the way, a way on's reach, the end kept clear)
 *
 * Pure; seeded dice only.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { SECTIONS, BANDS, BAND_IDS } from './sections.js';
import { MISSION } from './compose.js';

export const ROUTE = Object.freeze({ room: 4, gate: 6, start: 1, out: 6, yard: 22, closeYard: 14 });
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

/** A route: a polyline in metres, read by the length along it. */
export function makeRoute(points, ground = null) {
  const P = (points ?? []).map((p) => [p[0], p[1]]).filter((p, i, a) => !i || dist(p, a[i - 1]) > 1e-6);
  if (P.length < 2) throw new Error('mission: a route is two points or more (a trail\'s lane, a town\'s walk)');
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + dist(P[i], P[i - 1]));
  const length = cum[cum.length - 1];
  const at = (s) => {
    const q = Math.max(0, Math.min(length, s));
    let i = 1;
    while (i < P.length - 1 && cum[i] < q) i++;
    const a = P[i - 1], b = P[i], L = cum[i] - cum[i - 1] || 1, t = (q - cum[i - 1]) / L;
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
  };
  const z = (x, y) => { const g = ground ? ground(x, y) : 0; return Number.isFinite(g) ? g : 0; };
  return { length, at, z, points: P };
}

/** The mission laid along a route (see the header). */
export function composeOnRoute(brief, route, { seed = 1, room = ROUTE.room } = {}) {
  if (!brief || !Array.isArray(brief.sections) || !brief.sections.length) throw new Error('mission: a brief with its sections (brief.js missionBrief)');
  const rnd = mulberry32(seed | 0), jit = (a) => (rnd() * 2 - 1) * a, R = ROUTE, M0 = MISSION;
  // what each section asks of the way, in metres, before it is fitted (the walk out takes what is left)
  const ask = (kind) => (kind === 'staging' ? 10 : kind === 'extract' ? R.out : kind === 'holdout' ? (brief.yard === 'close' ? R.closeYard : R.yard) : Math.ceil(M0.line + BANDS[SECTIONS[kind].band].m + M0.end));
  const asked = brief.sections.reduce((n, k) => n + ask(k), 0) + R.start, k = Math.min(1, route.length / asked);
  // a place on the route, a side step off it (to its left, positive), stood on the ground
  const place = (s, off = 0) => { const { p, dir } = route.at(s), x = p[0] - dir[1] * off, y = p[1] + dir[0] * off; return [r2(x), r2(y), r2(route.z(x, y))]; };
  const facing = (s) => { const { dir } = route.at(s); return r2(Math.atan2(-dir[1], -dir[0])); };
  // a wall square to the world across the way it stands on (the ground's blocks are boxes), or a crate
  const blocks = [];
  const wall = (s, off, length, height) => { const { dir } = route.at(s), N = Math.abs(dir[0]) >= Math.abs(dir[1]) ? [Math.sign(dir[0]) || 1, 0] : [0, Math.sign(dir[1]) || 1]; blocks.push({ form: 'wall', at: place(s, off), N, length, height, thick: 0.5, value: 0.5 }); };
  const crate = (s, off, stack = 1) => blocks.push({ form: 'crate', at: place(s, off), stack, value: 0.42 });
  const across = (n) => Array.from({ length: n }, (_, i) => r2(-room + (2 * room * (i + 0.5)) / n + jit(0.4)));
  const count = (kind) => Math.max(1, Math.min(8, Math.round(SECTIONS[kind].foes * brief.scale)));
  let foeN = 0, s0 = R.start * k;
  // a foe behind cover of its own, a step back toward where the body comes from; never on the way itself
  const foeAt = (s, off, i, cover = true) => {
    const o = Math.abs(off) < 1.2 ? (off < 0 ? -1.2 : 1.2) : off;
    if (cover) { if (i % 2) crate(s - 1.3, o); else wall(s - 1.3, o, 1.6, 1); }
    return { id: `foe-${++foeN}`, at: place(s, o), heading: facing(s) };
  };
  const sections = brief.sections.map((kind, n) => {
    const row = SECTIONS[kind], last = n === brief.sections.length - 1, band = row.band ? BANDS[kind === 'holdout' ? brief.yard ?? row.band : row.band] : null;
    const L = last ? Math.max(ask(kind) * k, route.length - s0) : ask(kind) * k, s1 = Math.min(route.length, s0 + L);
    const line = s0 + M0.line * k, foes = [], drops = [];
    let task;
    const lie = (s, off, gives) => drops.push({ at: place(s, off), gives });
    if (kind === 'staging') { lie(s0 + 6 * k, 0, 'ammo'); task = { kind: 'take', text: row.text, at: drops[0].at }; }
    else if (kind === 'extract') task = { kind: 'reach', text: row.text, at: place(route.length) };
    else if (kind === 'holdout') {
      const c = (s0 + s1) / 2, nf = count(kind);
      lie(c, 1.4, 'ammo'); lie(c, -1.4, 'health');
      wall(line, 1.8, 1.6, 1); wall(c - 3, -2.6, 1.6, 1); wall(c + 2, 2.6, 1.6, 1); crate(c, -room + 0.6, 2); crate(c, room - 0.6, 2);
      const waves = Array.from({ length: brief.waves }, (_, w) => across(nf).map((off, i) => { const f = foeAt(s1 - (2.4 + w * 1.5) * k, off, i, w === 0); foes.push(f); return f.id; }));
      task = { kind: 'hold', text: row.text, seconds: brief.hold, every: r2(brief.hold / (brief.waves + 1)), waves };
    } else {
      // a fight at its band along the way: cover beside the firing line, cover to move through, the foes at the band
      if (kind === 'overwatch') lie(s0 + 3 * k, -(room - 1), 'ammo');
      if (kind === 'lane') lie(line + (band.m * k) / 2, 0, 'health');
      wall(line, n % 2 ? -1.8 : 1.8, 1.6, 1);
      let side = rnd() < 0.5 ? 1 : -1;
      for (let d = 5; d < band.m - 3; d += band.m > 20 ? 7 : 5) { wall(line + d * k, side * room * 0.7, 1.8, 2.2); side = -side; }
      across(count(kind)).forEach((off, i) => foes.push(foeAt(line + (band.m + jit(Math.min(1.5, band.m / 10))) * k, off, i)));
      task = { kind: row.task === 'man' ? 'clear' : row.task, text: row.text, foes: foes.map((f) => f.id) };
    }
    const mid = (s0 + s1) / 2;
    const S = {
      id: kind, kind, s: [r2(s0), r2(s1)], band: row.band ? (kind === 'holdout' ? brief.yard ?? row.band : row.band) : null,
      entry: place(n ? s0 + 1.6 * k : 0), line: r2(line), foes, drops, task,
      zone: { at: place(mid), radius: r2(Math.max(2, (s1 - s0) / 2 - 0.8 * k)) },
      // (the way on: a zone across the way just past where the section ends, so a body in the section is never in it; put
      // back, it stands a step short of the end)
      door: last ? null : { at: place(Math.min(route.length, s1 + R.gate)), back: place(Math.max(s0, s1 - 1.5)), radius: R.gate, width: 2 * R.gate },
    };
    s0 = s1;
    return S;
  });
  // the route as the page and a player read it: a point every two metres or so
  const pts = [];
  for (let s = 0; s < route.length; s += 2) pts.push(place(s));
  pts.push(place(route.length));
  const out = sections[sections.length - 1], exit = out.task.kind === 'reach' ? out.task.at : place(route.length);
  return { seed, on: 'route', room, width: 2 * room, half: room, length: r2(route.length), heading: r2(Math.atan2(route.at(0).dir[1], route.at(0).dir[0])), sections, blocks, primitives: [],
    anchors: { spawn: place(0), exit }, route: { length: r2(route.length), points: pts }, fit: { asked: r1(asked), length: r1(route.length), scale: r2(k) } };
}

/** The laws of a mission on a route (see the header). */
export function routeLaws(M, brief) {
  const laws = [], law = (id, holds, says) => laws.push({ law: id, holds, says }), S = M.sections;
  // FITS: the ground's way is as long as the mission asks
  law('fits', M.fit.scale >= 1, M.fit.scale >= 1 ? `the way is ${M.fit.length} m and the mission asks ${M.fit.asked} m: the walk out takes what is left` : `the way is ${M.fit.length} m and the mission asks ${M.fit.asked} m: every section and band is scaled to ${Math.round(M.fit.scale * 100)}% (a longer way: a trail's run, a town's block; or fewer sections)`);
  // GROUNDED: every place it names stands on the ground (a height read under it)
  const places = [M.anchors.spawn, M.anchors.exit, ...S.flatMap((s) => [s.entry, ...s.foes.map((f) => f.at), ...s.drops.map((d) => d.at)])];
  const off = places.filter((p) => !p.every(Number.isFinite)).length;
  law('grounded', !off, off ? `${off} place${off === 1 ? '' : 's'} with no ground read under it` : `every place it names stands on the ground (${places.length})`);
  // BANDED: a fight's foes at its band along the way (scaled as the mission was fitted)
  const out = [];
  for (const s of S) {
    if (!s.band || s.task.kind === 'hold') continue;
    const [lo, hi] = BANDS[s.band].reach.map((v) => v * M.fit.scale), at0 = s.entry;
    for (const f of s.foes) { const d = r1(dist(f.at, at0) - (MISSION.line - 1.6) * M.fit.scale); if (d < lo - 2.5 || d > hi + 2.5) out.push(`${f.id} ${d} m in ${s.id} (${s.band}: ${r1(lo)} to ${r1(hi)})`); }
  }
  law('banded', !out.length, out.length ? `out of band: ${out.slice(0, 3).join('; ')}` : 'each fight\'s foes stand in its band along the way');
  // COVERED: cover within a second's run of where the body comes into each fight
  const bare = [];
  for (const s of S) {
    if (!SECTIONS[s.kind].fight) continue;
    const near = Math.min(...M.blocks.map((b) => dist(b.at, s.entry)), Infinity);
    if (!(near <= brief.run)) bare.push(`${s.id} (${Number.isFinite(near) ? `${r1(near)} m` : 'none'})`);
  }
  law('covered', !bare.length, bare.length ? `no cover within ${r1(brief.run)} m (a second's run) of the way in: ${bare.join(', ')}` : `cover within ${r1(brief.run)} m (a second's run) of each fight's way in`);
  // ENTRY-SAFE
  const close = S.flatMap((s) => s.foes.filter((f) => dist(f.at, s.entry) < BANDS.close.reach[0] * M.fit.scale).map((f) => `${f.id} (${s.id})`));
  law('entry-safe', !close.length, close.length ? `woken within arm's length of the way in: ${close.join(', ')}` : 'no foe is woken within arm\'s length of a way in');
  // IN ORDER, ARMED, PACED: as on a ground of its own
  const faults = [], fights = S.filter((s) => SECTIONS[s.kind].fight), rank = (b) => BAND_IDS.indexOf(b), taught = [];
  if (SECTIONS[S[0].kind].fight) faults.push(`it begins with a fight (${S[0].id}): nothing is taught before it`);
  if (S[S.length - 1].task.kind !== 'reach') faults.push(`it ends at ${S[S.length - 1].id}, not at a way out`);
  for (const s of fights) {
    if (s.task.kind === 'hold') { if (!taught.length) faults.push(`${s.id} is held before any fight teaches a band`); continue; }
    if (taught.length && rank(s.band) < Math.max(...taught.map(rank))) faults.push(`${s.id} (${s.band}) comes after a longer band`);
    taught.push(s.band);
  }
  law('in-order', !faults.length, faults.length ? faults.join('; ') : 'it teaches before it tests: the near band first, the yard after, a way out last');
  const unarmed = fights.filter((s) => !brief.serves[s.band]).map((s) => `${s.id} (${s.band})`);
  law('armed', !unarmed.length, unarmed.length ? `no carried gun is for: ${unarmed.join(', ')}` : 'each fight\'s band is one a carried gun is for');
  const secs = r1(M.length / brief.run);
  law('paced', secs >= 10 && secs <= 60, `${M.length} m of way: ${secs} s of the run end to end${secs > 60 ? ' (long for a first level)' : secs < 10 ? ' (over before it begins)' : ''}`);
  // GATED: what a way on is, on open ground (said, never hidden)
  const gates = S.filter((s) => s.door).length;
  law('gated', true, `${gates} way${gates === 1 ? '' : 's'} on, each a zone across the way sealed until its task is met; on open ground a body may walk round one, and gains nothing: a section begins only in its turn`);
  return laws;
}
