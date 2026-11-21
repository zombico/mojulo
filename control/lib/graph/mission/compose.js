/**
 * THE MISSION, COMPOSED — the firing range stretched down one line: the brief's sections (brief.js) laid one after
 * another along +x, each a room across the mission's width, a wall between it and the next with one doorway in it, the
 * doorways on alternate sides so no line runs through two. A section stands what its row asks (sections.js): the cover
 * a body fires from where it comes in (the firing line), its foes at its band from that line, each behind cover of its
 * own, what lies on its floor, and the task that opens its way on. Everything it stands is a room primitive
 * (gameroom/primitives.js); the walls and the floor are the mission's own.
 *
 *   composeMission(brief, { seed }) → {
 *     seed, width, half, length, heading,
 *     sections: [{ id, kind, x: [x0, x1], band, entry, line, foes: [{ id, at, heading }], drops: [{ at, gives }],
 *                  task: { kind, text, … }, door: { at, width, back } | null, gun?: { at, heading } }],
 *     primitives: [{ kind, id, at, rot?, h?, section }],
 *     anchors: { spawn, exit } }
 *   task     take { at } · clear { foes } · man { foes, gun } · hold { seconds, every, waves: [[id]] } · reach { at }
 *   missionWalls(M) → [{ id, x: [x0, x1], y: [y0, y1], h, group }] the wall round it and the wall across each section's
 *                     end, its doorway left open (`shut`: the doors to fill instead, by section index: the laws' seal)
 *   MISSION  the layout's own numbers (the doorway, the walls, the firing line's depth, the end margin)
 *
 * Pure; seeded dice only.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { footprint } from '../gameroom/primitives.js';
import { SECTIONS, BANDS } from './sections.js';

export const MISSION = Object.freeze({ door: 3, wall: 3, thick: 0.4, line: 3.5, end: 4.5, side: 0.45, deck: 1.2, clear: 0.5 });
const r2 = (v) => Math.round(v * 100) / 100;
const WEST = Math.PI;

/** The mission (see the header). */
export function composeMission(brief, { seed = 1 } = {}) {
  if (!brief || !Array.isArray(brief.sections) || !brief.sections.length) throw new Error('mission: a brief with its sections (brief.js missionBrief)');
  const rnd = mulberry32(seed | 0), H = brief.width / 2, M = MISSION;
  const jit = (a) => (rnd() * 2 - 1) * a;
  const primitives = [], sections = [];
  let foeN = 0, x0 = 0, side = rnd() < 0.5 ? 1 : -1, entry = [2, 0, 0];
  // what must stay clear: where a body comes in, where it leaves, what lies on the floor
  const keep = [];
  const hits = (p) => {
    const f = footprint(p), c = M.clear;
    if (keep.some((k) => k.at[0] > f.x[0] - k.r && k.at[0] < f.x[1] + k.r && k.at[1] > f.y[0] - k.r && k.at[1] < f.y[1] + k.r)) return true;
    return primitives.some((q) => { const g = footprint(q); return f.x[0] < g.x[1] + c && f.x[1] > g.x[0] - c && f.y[0] < g.y[1] + c && f.y[1] > g.y[0] - c; });
  };
  // a primitive stood where it is asked, else a step aside (toward the middle first), else left out: what is stood
  // never crosses a way in or lies on another
  const put = (section, kind, at, more = {}) => {
    for (const dy of [0, -1.2, 1.2, -2.4, 2.4]) {
      const y = at[1] + (at[1] > 0 ? dy : -dy);
      if (Math.abs(y) > H - 1.2) continue;
      const p = { kind, id: `${section}-${kind}-${primitives.filter((q) => q.section === section && q.kind === kind).length + 1}`, at: [r2(at[0]), r2(y), 0], ...more, section };
      if (!hits(p)) { primitives.push(p); return p; }
    }
    return null;
  };
  const across = (n) => { const Y = H - 2.2; return Array.from({ length: n }, (_, i) => r2(-Y + (2 * Y * (i + 0.5)) / n + jit(0.5))); };
  const count = (kind) => Math.max(1, Math.min(8, Math.round(SECTIONS[kind].foes * brief.scale)));
  // a foe facing the way the body comes, behind cover of its own (a later wave's stands in the first's)
  const foeAt = (section, x, y, k, cover = true) => {
    if (cover) put(section, k % 2 ? 'crate' : 'cover-low', [x - 1.3, y], k % 2 ? {} : { rot: 90 });
    return { id: `foe-${++foeN}`, at: [r2(x), r2(y), 0], heading: WEST };
  };

  brief.sections.forEach((kind, k) => {
    const row = SECTIONS[kind], last = k === brief.sections.length - 1, band = row.band ? BANDS[row.band] : null;
    const line = r2(x0 + M.line), foes = [], drops = [];
    let length, task, gun = null;
    keep.push({ at: entry, r: 1.6 });
    const lie = (at, gives) => { drops.push({ at, gives }); keep.push({ at, r: 1.2 }); };
    if (kind === 'staging') {
      length = 10;
      lie([r2(x0 + 6), 0, 0], 'ammo');
      task = { kind: 'take', text: row.text, at: drops[0].at };
    } else if (kind === 'extract') {
      length = 8;
      task = { kind: 'reach', text: row.text, at: [r2(x0 + 5.5), 0, 0] };
      keep.push({ at: task.at, r: 2 });
    } else if (kind === 'holdout') {
      // (held at the band the kit reaches: a yard across the mission's width, or a room's length for close guns alone)
      length = brief.yard === 'close' ? 14 : brief.width + 6;
      const c = r2(x0 + length / 2), n = count(kind);
      lie([c, 1.6, 0], 'ammo'); lie([c, -1.6, 0], 'health');
      put(kind, 'cover-low', [line, entry[1]], { rot: 90 });
      for (const [dx, dy] of [[-3.6, 3.2], [-3.6, -3.2], [3.6, 3.2], [3.6, -3.2]]) put(kind, 'cover-low', [c + dx, dy], { rot: 90 });
      put(kind, 'pillar', [c, H - 3]); put(kind, 'pillar', [c, -(H - 3)]);
      // its waves come in at the far side, the first behind cover, each later one a step behind the last
      const waves = Array.from({ length: brief.waves }, (_, w) => across(n).map((y, i) => { const f = foeAt(kind, x0 + length - 2.4 - w * 1.5, y, i, w === 0); foes.push(f); return f.id; }));
      task = { kind: 'hold', text: row.text, seconds: brief.hold, every: r2(brief.hold / (brief.waves + 1)), waves };
    } else {
      // a fight at its band: the firing line where the body comes in, cover on it, the foes at the band from it
      length = Math.ceil(M.line + band.m + M.end);
      if (kind === 'overwatch') lie([r2(x0 + 3), r2(-(H - 3)), 0], 'ammo');
      if (kind === 'lane') lie([r2(line + band.m / 2), 0, 0], 'health');
      if (kind === 'emplacement') { gun = { at: [r2(x0 + 4.5), 0, 0], heading: 0 }; keep.push({ at: gun.at, r: 2.2 }); }
      put(kind, 'cover-low', [line, entry[1]], { rot: 90 });
      put(kind, 'cover-low', [line, entry[1] - Math.sign(entry[1] || 1) * 3.4], { rot: 90 });
      // cover to move through, a piece every five metres or so (seven down the long line), on alternate sides
      let s = rnd() < 0.5 ? 1 : -1;
      for (let d = 5; d < band.m - 3; d += band.m > 20 ? 7 : 5) { put(kind, 'cover-tall', [line + d, s * H * 0.36], { rot: 90 }); s = -s; }
      // the deck on the north side (its step stands to its south, toward the middle), near where the body comes in
      if (kind === 'overwatch') put(kind, 'platform', [x0 + 5.6, H - 2.7], { h: M.deck });
      across(count(kind)).forEach((y, i) => foes.push(foeAt(kind, line + band.m + jit(Math.min(1.5, band.m / 10)), y, i)));
      task = { kind: row.task, text: row.text, foes: foes.map((f) => f.id), ...(gun ? { gun: 'gun' } : {}) };
    }
    const x1 = r2(x0 + length);
    // the way on: a doorway in the wall at its far end, on the other side from the one it was come in by
    side = -side;
    const door = last ? null : { at: [x1, r2(side * H * M.side), 0], width: M.door, back: [r2(x1 - 2), r2(side * H * M.side), 0] };
    if (door) keep.push({ at: door.back, r: 1.8 });
    sections.push({ id: kind, kind, x: [r2(x0), x1], band: kind === 'holdout' ? brief.yard ?? row.band : row.band, entry: entry.slice(), line, foes, drops, task, door, ...(gun ? { gun } : {}) });
    if (door) entry = [r2(x1 + 1.6), door.at[1], 0];
    x0 = x1;
  });
  const out = sections[sections.length - 1], exit = out.task.kind === 'reach' ? out.task.at : [r2(out.x[1] - 2.5), 0, 0];
  return { seed, width: brief.width, half: H, length: r2(x0), heading: 0, sections, primitives, anchors: { spawn: [2, 0, 0], exit } };
}

/** The mission's walls: the one round it, and one across each section's end with its doorway. */
export function missionWalls(M, { shut = [] } = {}) {
  const H = M.half, L = M.length, T = 0.5, t = MISSION.thick / 2, h = MISSION.wall, out = [];
  const wall = (id, x, y, group = 'mission:wall') => out.push({ id, x: x.map(r2), y: y.map(r2), h, group });
  wall('wall-s', [-T, L + T], [-H - T, -H]); wall('wall-n', [-T, L + T], [H, H + T]);
  wall('wall-w', [-T, 0], [-H, H]); wall('wall-e', [L, L + T], [-H, H]);
  M.sections.forEach((S, k) => {
    if (!S.door) return;
    const [x, y] = S.door.at, w = S.door.width / 2;
    if (shut.includes(k)) { wall(`cross-${k}`, [x - t, x + t], [-H, H], 'mission:cross'); return; }
    wall(`cross-${k}-a`, [x - t, x + t], [-H, y - w], 'mission:cross'); wall(`cross-${k}-b`, [x - t, x + t], [y + w, H], 'mission:cross');
  });
  return out;
}
