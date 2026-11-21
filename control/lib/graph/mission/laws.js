/**
 * THE MISSION LAWS — a composed mission held to what a first level must be, in the game's own numbers (the brief's run,
 * its guns' bands). Measured on a quarter-metre grid of its floor, as the room laws are (gameroom/laws.js): every box
 * stood, the walls round it and across it. Advice, never a refusal; each says why.
 *
 *   walkable    with every way on open, every place the mission names (each section's way in, each foe, what lies on
 *               the floor, the mounted gun, the exit) is reached from the spawn, a body's half-width kept off every box
 *   sealed      with a section's way on shut, nothing past it is reached: there is no way round a task
 *   banded      each fight's foes stand in its band from its firing line (the range's body at that band)
 *   covered     each fight has cover within a second of the run from where the body comes in
 *   entry-safe  no foe is woken within arm's length of where the body comes in
 *   in-order    it begins by teaching (no fight first), the bands are met from the near one out before the yard tests
 *               them, and it ends at a way out
 *   armed       each fight's band is one a carried gun is for
 *   paced       its length is ten seconds to a minute of the run: a first level is short
 *
 *   missionLaws(M, brief) → [{ law, holds, says }]
 *   missionGrid(M, { shut, pad }) → { flood(from), reaches(seen, at, r), field(to), toward(F, from, ahead), free, cells }
 *                    (field and toward: the walk to a place, for a player that walks it: gameworld/mission-proof.js)
 *
 * Pure.
 */
import { blocksOf } from '../gameroom/primitives.js';
import { missionWalls } from './compose.js';
import { SECTIONS, BANDS, BAND_IDS } from './sections.js';

const BODY = 0.35, STEP = 0.25, COVER = ['cover-low', 'cover-tall', 'crate', 'pillar'];
const r1 = (v) => Math.round(v * 10) / 10;
const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

export function missionGrid(M, { shut = [], pad = BODY } = {}) {
  const nx = Math.ceil(M.length / STEP), ny = Math.ceil(M.width / STEP), H = M.half, blocked = new Uint8Array(nx * ny);
  const boxes = [...M.primitives.flatMap(blocksOf), ...missionWalls(M, { shut })];
  const idx = (i, j) => j * nx + i, ci = (x) => Math.floor(x / STEP), cj = (y) => Math.floor((y + H) / STEP), cx = (i) => (i + 0.5) * STEP, cy = (j) => -H + (j + 0.5) * STEP;
  for (const b of boxes) {
    for (let j = Math.max(0, cj(b.y[0] - pad)); j <= Math.min(ny - 1, cj(b.y[1] + pad)); j++) for (let i = Math.max(0, ci(b.x[0] - pad)); i <= Math.min(nx - 1, ci(b.x[1] + pad)); i++) {
      const x = cx(i), y = cy(j);
      if (x > b.x[0] - pad && x < b.x[1] + pad && y > b.y[0] - pad && y < b.y[1] + pad) blocked[idx(i, j)] = 1;
    }
  }
  const flood = (from) => {
    const seen = new Uint8Array(nx * ny), q = [], i0 = ci(from[0]), j0 = cj(from[1]);
    if (i0 < 0 || j0 < 0 || i0 >= nx || j0 >= ny || blocked[idx(i0, j0)]) return seen;
    seen[idx(i0, j0)] = 1; q.push(idx(i0, j0));
    while (q.length) {
      const c = q.pop(), i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = idx(a, b);
        if (!blocked[k] && !seen[k]) { seen[k] = 1; q.push(k); }
      }
    }
    return seen;
  };
  // a place is reached when a reached cell lies within `r` of it
  const reaches = (seen, at, r) => {
    for (let j = Math.max(0, cj(at[1] - r)); j <= Math.min(ny - 1, cj(at[1] + r)); j++) for (let i = Math.max(0, ci(at[0] - r)); i <= Math.min(nx - 1, ci(at[0] + r)); i++) {
      if (seen[idx(i, j)] && dist([cx(i), cy(j)], at) <= r) return true;
    }
    return false;
  };
  // THE WALK to a place: each free cell's steps from it (a flood out from the place; a place on a box, from the free cell
  // nearest it), and the point `ahead` steps down that field from where a body stands: what a walker heads for
  const freeNear = (x, y) => {
    const i0 = Math.max(0, Math.min(nx - 1, ci(x))), j0 = Math.max(0, Math.min(ny - 1, cj(y)));
    if (!blocked[idx(i0, j0)]) return idx(i0, j0);
    let best = -1, bd = Infinity;
    for (let j = Math.max(0, j0 - 8); j <= Math.min(ny - 1, j0 + 8); j++) for (let i = Math.max(0, i0 - 8); i <= Math.min(nx - 1, i0 + 8); i++) {
      if (blocked[idx(i, j)]) continue;
      const d = (cx(i) - x) ** 2 + (cy(j) - y) ** 2;
      if (d < bd) { bd = d; best = idx(i, j); }
    }
    return best;
  };
  const field = (to) => {
    const F = new Int32Array(nx * ny).fill(-1), s0 = freeNear(to[0], to[1]), q = [];
    if (s0 < 0) return F;
    F[s0] = 0; q.push(s0);
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = idx(a, b);
        if (!blocked[k] && F[k] < 0) { F[k] = F[c] + 1; q.push(k); }
      }
    }
    return F;
  };
  const toward = (F, from, ahead = 6) => {
    let c = freeNear(from[0], from[1]);
    if (c < 0 || F[c] < 0) return null;
    for (let n = 0; n < ahead && F[c] > 0; n++) {
      const i = c % nx, j = (c - i) / nx;
      let nextC = c;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
        const k = idx(a, b);
        // (a corner is cut only where both its sides are free)
        if (di && dj && (blocked[idx(i + di, j)] || blocked[idx(i, j + dj)])) continue;
        if (F[k] >= 0 && F[k] < F[nextC]) nextC = k;
      }
      if (nextC === c) break;
      c = nextC;
    }
    return { at: [cx(c % nx), cy((c - (c % nx)) / nx)], left: F[c] * STEP };
  };
  return { flood, reaches, field, toward, free: blocked.reduce((t, v) => t + (v ? 0 : 1), 0), cells: nx * ny };
}

export function missionLaws(M, brief) {
  const laws = [], law = (id, holds, says) => laws.push({ law: id, holds, says });
  const A = M.anchors, S = M.sections;
  // WALKABLE: every named place reached with the doors open
  const open = missionGrid(M), seen = open.flood(A.spawn);
  const places = [{ name: 'the exit', at: A.exit, r: 1.6 }];
  for (const s of S) {
    places.push({ name: `${s.id}'s way in`, at: s.entry, r: 0.8 });
    s.foes.forEach((f) => places.push({ name: `${f.id} (${s.id})`, at: f.at, r: 0.8 }));
    s.drops.forEach((d, k) => places.push({ name: `${s.id}'s ${d.gives}${s.drops.length > 1 ? ` ${k + 1}` : ''}`, at: d.at, r: 1.2 }));
    if (s.gun) places.push({ name: `${s.id}'s gun`, at: s.gun.at, r: 1.8 });
  }
  const lost = places.filter((p) => !open.reaches(seen, p.at, p.r)).map((p) => p.name);
  law('walkable', !lost.length, lost.length ? `not reached from the spawn: ${lost.slice(0, 4).join(', ')}${lost.length > 4 ? ` (+${lost.length - 4})` : ''}` : `every place it names is reached from the spawn (${places.length})`);
  // SEALED: each way on shut, nothing past it reached
  const leaks = [];
  S.forEach((s, k) => {
    if (!s.door) return;
    const G = missionGrid(M, { shut: [k] }), got = G.flood(A.spawn);
    if (S.slice(k + 1).some((n) => G.reaches(got, n.entry, 0.8))) leaks.push(s.id);
  });
  law('sealed', !leaks.length, leaks.length ? `a way round the door of: ${leaks.join(', ')}` : 'no way round a section\'s door: each task is met before the next');
  // BANDED: a fight's foes at its band from its firing line (the yard's come in from its far side: not held to it)
  const off = [];
  for (const s of S) {
    if (!s.band || s.task.kind === 'hold') continue;
    const [lo, hi] = BANDS[s.band].reach;
    for (const f of s.foes) { const d = r1(f.at[0] - s.line); if (d < lo || d > hi) off.push(`${f.id} ${d} m in ${s.id} (${s.band}: ${lo} to ${hi})`); }
  }
  law('banded', !off.length, off.length ? `out of band: ${off.slice(0, 3).join('; ')}` : 'each fight\'s foes stand in its band from its firing line');
  // COVERED: cover within a second's run of the way in
  const reach = brief.run, bare = [];
  for (const s of S) {
    if (!SECTIONS[s.kind].fight) continue;
    const near = Math.min(...M.primitives.filter((p) => p.section === s.id && COVER.includes(p.kind)).map((p) => dist(p.at, s.entry)), Infinity);
    if (!(near <= reach)) bare.push(`${s.id} (${Number.isFinite(near) ? `${r1(near)} m` : 'none'})`);
  }
  law('covered', !bare.length, bare.length ? `no cover within ${r1(reach)} m (a second's run) of the way in: ${bare.join(', ')}` : `cover within ${r1(reach)} m (a second's run) of each fight's way in`);
  // ENTRY-SAFE: nobody woken in the body's face
  const close = [];
  for (const s of S) for (const f of s.foes) if (dist(f.at, s.entry) < BANDS.close.reach[0]) close.push(`${f.id} (${s.id})`);
  law('entry-safe', !close.length, close.length ? `woken within ${BANDS.close.reach[0]} m of the way in: ${close.join(', ')}` : `no foe within ${BANDS.close.reach[0]} m of a way in`);
  // IN ORDER: teach first, the bands from the near one out, the yard after what it tests, a way out last
  const faults = [], fights = S.filter((s) => SECTIONS[s.kind].fight), rank = (b) => BAND_IDS.indexOf(b);
  if (SECTIONS[S[0].kind].fight) faults.push(`it begins with a fight (${S[0].id}): nothing is taught before it`);
  if (S[S.length - 1].task.kind !== 'reach') faults.push(`it ends at ${S[S.length - 1].id}, not at a way out`);
  const taught = [];
  for (const s of fights) {
    if (s.task.kind === 'hold') { if (taught.length && !taught.includes(s.band) && rank(s.band) > Math.max(...taught.map(rank))) faults.push(`${s.id} tests the ${s.band} band before a section teaches it`); if (!taught.length) faults.push(`${s.id} is held before any fight teaches a band`); continue; }
    if (taught.length && rank(s.band) < Math.max(...taught.map(rank))) faults.push(`${s.id} (${s.band}) comes after a longer band`);
    taught.push(s.band);
  }
  law('in-order', !faults.length, faults.length ? faults.join('; ') : 'it teaches before it tests: the near band first, the yard after, a way out last');
  // ARMED: a carried gun for each fight's band
  // (a mounted gun is its own section's gun)
  const unarmed = fights.filter((s) => !s.gun && !brief.serves[s.band]).map((s) => `${s.id} (${s.band})`);
  law('armed', !unarmed.length, unarmed.length ? `no carried gun is for: ${unarmed.join(', ')} (${brief.guns.map((g) => `${g.name} ${g.band ?? 'free hand'}`).join(', ')})` : 'each fight\'s band is one a carried gun is for');
  // PACED: short
  const secs = r1(M.length / brief.run);
  law('paced', secs >= 10 && secs <= 60, `${M.length} m: ${secs} s of the run end to end${secs > 60 ? ' (long for a first level: fewer sections, or a faster body)' : secs < 10 ? ' (over before it begins)' : ''}`);
  return laws;
}
