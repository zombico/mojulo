/**
 * THE BOX'S LAWS (docs/metroidvania-map.md "What holds it"): the spiralling box's principles measured on a laid box
 * (box.js), its solution (solve.js) and its greybox (rooms.js). Advisory, as every law in the house: each says what it
 * measured, and a box that loses one is still laid.
 *
 *   entered-left     the way in is on the box's left side, at its first room
 *   fills-the-box    the rooms take most of the box (FILL): the space is spent, not left as mass between corridors
 *   shape            the walk keeps its shape's form (shapes.js) and ends at the core: a spiral never steps out to a ring
 *                    it left and turns one way round every ring; a serpentine never drops a row on its way and turns at
 *                    every row's end; a hub's every wing is stepped into from the hub and returns to it at its end
 *   both-axes        the walk climbs and drops as well as crossing: the cells walked up or down are a share of the walk
 *                    within its shape's band (a spiral's AXES; every spiral ring has a leg up and a leg down)
 *   gated-in         every step into a ring inside is a gate (the walled-core dungeon's `gated`)
 *   one-new-thing    each step in asks something no step before it asked
 *   found-before     every gate on the walk is met after what opens it is found (a key before its lock, a power before
 *                    its gate), so the walk is never stopped at a gate it cannot yet open
 *   solvable         walked to its end, every room is reached, the core's boss falls, and no one-way door lands where
 *                    the way back up to it is shut
 *   shortcuts        every ring past the first opens back out to the one before it besides the step in (a shortcut, or
 *                    a hub wing's return), and the way
 *                    back from the core is at most BACK of the way in
 *   revisits         every power opens something behind where it is found (a pocket, a shortcut), as well as ahead
 *   pockets          every pocket is opened by the time the box is done
 *   no-kick          every rise on a climb is a single jump's at most; a double-jump gate's last rise is over a jump and
 *                    under a double jump; nothing asks a wall kick or a stomp
 *   sill-holds       a double-jump sill is a gate: nothing to stand on in its room within a single jump under its top and
 *                    within SILL_CLEAR jumps of it across (a stair's ledge would let one jump over it)
 *   saves            no more than SAVE_EVERY rooms walked between save rooms
 *   boss-at-core     the core's last hall holds a boss
 *
 *   boxLaws(L, { solved?, greybox? }) → [{ id, holds, says, rooms? }]   (rooms: where a law is lost)
 *   BOX_LAWS, FILL, AXES, BACK, SAVE_EVERY, SILL_CLEAR
 *
 * Pure.
 */
import { solveBox } from './solve.js';
import { greyboxOf } from './rooms.js';
import { SHAPES } from './shapes.js';

export const BOX_LAWS = Object.freeze(['entered-left', 'fills-the-box', 'shape', 'both-axes', 'gated-in', 'one-new-thing', 'found-before', 'solvable', 'shortcuts', 'revisits', 'pockets', 'no-kick', 'sill-holds', 'saves', 'boss-at-core']);
export const FILL = 0.8;
export const AXES = SHAPES.spiral.axes;
export const BACK = 0.5;
export const SAVE_EVERY = 10;
/** how far across from a sill, in jumps, nothing may stand within a jump under its top (a running jump's length and more) */
export const SILL_CLEAR = 4;
const EPS = 1e-3;
const pct = (v) => `${Math.round(v * 100)}%`;
const CCW = ['corner', 'right', 'corner', 'up', 'corner', 'left', 'corner', 'down'], CW = ['corner', 'up', 'corner', 'right', 'corner', 'down', 'corner', 'left'];

/** The laws measured. */
export function boxLaws(L, { solved, greybox } = {}) {
  const S = solved ?? solveBox(L), G = greybox ?? greyboxOf(L), out = [];
  const law = (id, holds, says, rooms) => out.push({ id, holds: !!holds, says, ...(rooms && rooms.length ? { rooms } : {}) });
  const room = new Map(L.rooms.map((r) => [r.id, r])), walkAt = new Map(L.walk.map((id, k) => [id, k]));
  const [cols, rows] = L.box, K = L.rings.length - 1;

  // the way in
  const first = room.get(L.entry.room);
  law('entered-left', L.entry.side === 'left' && first.rect[0] === 0, `entered through the ${L.entry.side} side at ${first.id} (column ${first.rect[0]})`);
  law('fills-the-box', L.cells / (cols * rows) >= FILL, `the rooms take ${L.cells} of ${cols * rows} cells (${pct(L.cells / (cols * rows))}; at least ${pct(FILL)})`);

  // (the shape's and the axes' laws are a box's: a map of several boxes, a castle, holds each box to them on its own)
  if (SHAPES[L.shape ?? 'spiral']) {
  // the shape
  const shape = L.shape ?? 'spiral', rings = L.walk.map((id) => room.get(id).ring), back = L.walk.filter((id, k) => k && room.get(id).ring < rings[k - 1]);
  const endsCore = L.rings[room.get(L.walk.at(-1)).ring].core;
  let wrong = [], form = '';
  if (shape === 'spiral') {
    const legs = L.rings.filter((r) => !r.core).map((r) => r.legs.map((l) => l.dir).join(' '));
    const want = (L.turn === 'cw' ? CW : CCW).join(' ');
    wrong = L.rings.filter((r, k) => !r.core && legs[k] !== want).map((r) => r.id);
    form = wrong.length ? `${wrong.join(', ')} turn${wrong.length === 1 ? 's' : ''} against the box's ${L.turn}` : `${K} ring${K === 1 ? '' : 's'} walked ${L.turn}, each inside the last, to the core`;
  } else if (shape === 'serpentine') {
    // (never a row lower than the last, and every row run the other way from the one under it)
    const low = L.walk.filter((id, k) => k && room.get(id).rect[1] < room.get(L.walk[k - 1]).rect[1]);
    const runs = new Map();   // row → the way the walk crosses it (its first walked cell to its last)
    for (const id of L.walk) for (const c of room.get(id).cells) { const o = runs.get(c[1]) ?? { from: c[0] }; o.to = c[0]; runs.set(c[1], o); }
    for (const [row, o] of runs) runs.set(row, Math.sign(o.to - o.from));
    const same = [...runs].filter(([row, d]) => runs.has(row - 1) && runs.get(row - 1) === d).map(([row]) => `row ${row}`);
    wrong = [...low, ...same];
    form = low.length ? `the walk drops a row at ${low.join(', ')}` : same.length ? `${same.join(', ')} run${same.length === 1 ? 's' : ''} the way the row under it ran` : `${rows} rows walked, each back the other way, climbing a row a turn, in ${K + 1} bands`;
  } else {
    // (every wing stepped into from the hub, and its end returning to it)
    const hub = L.rings[1], wings = L.rings.slice(2);
    const shut = wings.filter((w) => !L.doors.some((d) => d.kind === 'step' && room.get(d.a).ring === hub.i && room.get(d.b).ring === w.i)
      || !L.doors.some((d) => d.kind === 'return' && room.get(d.a).ring === w.i && room.get(d.b).ring === hub.i)).map((w) => w.id);
    wrong = shut;
    form = shut.length ? `${shut.join(', ')} ${shut.length === 1 ? 'is' : 'are'} not walked out from the hub and back to it` : `the approach climbed to ${hub.id}, ${wings.length} wing${wings.length === 1 ? '' : 's'} walked out from it and back`;
  }
  law('shape', !back.length && !wrong.length && endsCore, back.length ? `the walk steps back to a region it left at ${back.join(', ')}` : !endsCore ? 'the walk ends short of the core' : `a ${shape}: ${form}`, back.length ? back : wrong.filter((x) => room.has(x)));

  // both axes: cells walked up or down, of all walked (a spiral's shafts and its turns' climbs through them; another
  // shape's shafts, and each door on its walk that climbs or drops a row)
  let across = 0, upDown = 0, noClimb = [];
  if (shape === 'spiral') {
    for (const id of L.walk) { const r = room.get(id); if (r.kind === 'shaft') upDown += r.rect[3]; else if (r.kind !== 'turn') across += r.rect[2]; }
    noClimb = L.rings.filter((r) => !r.core && !(r.legs.some((l) => l.dir === 'up') && r.legs.some((l) => l.dir === 'down'))).map((r) => r.id);
  } else {
    L.walk.forEach((id, k) => {
      const r = room.get(id);
      if (r.kind === 'shaft') upDown += r.rect[3]; else across += r.rect[2];
      if (k && r.kind !== 'shaft' && room.get(L.walk[k - 1]).kind !== 'shaft' && r.rect[1] !== room.get(L.walk[k - 1]).rect[1]) upDown += 1;
    });
  }
  const band = SHAPES[shape].axes, vert = upDown / Math.max(1, across + upDown);
  law('both-axes', vert >= band[0] && vert <= band[1] && !noClimb.length, `${upDown} cells climbed or dropped against ${across} crossed (${pct(vert)}; ${pct(band[0])}–${pct(band[1])} for a ${shape})${noClimb.length ? `; ${noClimb.join(', ')} never climb${noClimb.length === 1 ? 's' : ''} and drop${noClimb.length === 1 ? 's' : ''}` : ''}`, noClimb);
  }

  // the gates in
  // (a hub whose own region says no gate leaves its first wing open: the hub is where the walk chooses)
  const free = L.shape === 'hub' && !L.rings[1].inward ? L.doors.find((d) => d.kind === 'step' && room.get(d.a).ring === 1 && room.get(d.b).ring === 2) : null;
  const steps = L.doors.filter((d) => d.kind === 'step'), open = steps.filter((d) => !d.gate && d !== free);
  law('gated-in', !open.length && steps.length === K, open.length ? `the step${open.length === 1 ? '' : 's'} into ${open.map((d) => d.b).join(', ')} stand${open.length === 1 ? 's' : ''} open` : `every step in is a gate: ${steps.filter((d) => d !== free).map((d) => d.gate).join(', ')}${free ? ` (the hub opens ${L.rings[2].id} freely)` : ''}`, open.map((d) => d.b));
  const kinds = steps.filter((d) => d !== free).map((d) => d.gate), again = kinds.filter((g, k) => g && kinds.indexOf(g) < k);
  law('one-new-thing', !again.length, again.length ? `a step in asks ${again.join(', ')} again` : `each step in asks something new: ${kinds.join(' → ')}`);

  // what opens each gate is found before it, on the walk
  const firstFound = new Map();   // token → walk index of the room that gives it
  for (const r of L.rooms) {
    if (r.key) firstFound.set(`key:${r.ring}`, Math.min(firstFound.get(`key:${r.ring}`) ?? Infinity, r.walk));
    if (r.finds) { const t = `gate:${L.powers[r.finds].opens}`; firstFound.set(t, Math.min(firstFound.get(t) ?? Infinity, r.walk)); }
  }
  const late = [];
  for (const d of L.doors.filter((x) => x.gate && x.gate !== 'boss' && (x.kind === 'path' || x.kind === 'step'))) {
    // (met when the walk goes through it: a hub's wing door is passed on the way to an earlier wing, and met when its wing is next)
    const t = d.gate === 'key' ? `key:${room.get(d.a).ring}` : `gate:${d.gate}`, at = Math.max(walkAt.get(d.a), walkAt.get(d.b) - 1);
    if (!(firstFound.get(t) <= at)) late.push(d.a);
  }
  law('found-before', !late.length, late.length ? `the walk meets a gate before what opens it at ${late.join(', ')}` : 'every gate on the walk is met after what opens it is found', late);

  law('solvable', S.done && !S.unreached.length && !S.traps.length,
    !S.done ? 'walked to the end of what it opens, the core\'s boss never falls' : S.unreached.length ? `never reached: ${S.unreached.join(', ')}` : S.traps.length ? `one-way door${S.traps.length === 1 ? '' : 's'} ${S.traps.join(', ')} land${S.traps.length === 1 ? 's' : ''} with no way back up` : `every room reached, ${S.got.filter((g) => g.kind === 'power').length} powers found, the core's boss felled, every drop with a way back`,
    S.unreached);

  // the way back
  const out1 = L.rings.slice(1).filter((r) => !r.core).filter((r) => !L.doors.some((d) => (d.kind === 'shortcut' || d.kind === 'return') && (room.get(d.a).ring === r.i || room.get(d.b).ring === r.i))).map((r) => r.id);
  const ratio = S.wayIn && S.wayBack !== null ? S.wayBack / S.wayIn : Infinity;
  law('shortcuts', !out1.length && ratio <= BACK, `${out1.length ? `${out1.join(', ')} open${out1.length === 1 ? 's' : ''} no way back out; ` : ''}the way back from the core is ${S.wayBack ?? 'shut'} cells, the way in ${S.wayIn} (${Number.isFinite(ratio) ? pct(ratio) : 'none'}; at most ${pct(BACK)})`);

  // every power spent behind it as well as ahead
  const dull = [];
  for (const [id, p] of Object.entries(L.powers)) {
    const at = L.rooms.find((r) => r.finds === id);
    if (!at) continue;
    const behind = L.doors.some((d) => d.gate === p.opens && Math.min(walkAt.get(d.a), walkAt.get(d.b)) < at.walk)
      || L.rooms.some((r) => r.walk < at.walk && r.pockets.some((q) => q.gate === p.opens));
    const ahead = L.doors.some((d) => d.gate === p.opens && Math.max(walkAt.get(d.a), walkAt.get(d.b)) > at.walk);
    if (!(behind && ahead)) dull.push(`${p.name ?? id} opens nothing ${!behind ? 'behind' : 'ahead'}`);
  }
  law('revisits', !dull.length, dull.length ? dull.join('; ') : 'every power opens something behind where it is found and something ahead');
  law('pockets', !S.pockets.left.length, S.pockets.left.length ? `left shut: ${S.pockets.left.map((p) => `${p.holds} in ${p.room} (${p.gate})`).join(', ')}` : `${S.pockets.got.length} pocket${S.pockets.got.length === 1 ? '' : 's'}, every one opened`, S.pockets.left.map((p) => p.room));

  // no kick: every rise a jump's at most, a double-jump gate's between a jump and a double jump
  const J = G.hero.jump, D = G.hero.double, tall = [];
  for (const c of G.chains) c.rises.forEach((r, k) => {
    const isGate = c.gate === 'double-jump' && k === c.rises.length - 1;
    if (isGate ? !(r > J + EPS && r <= D + EPS) : r > J + EPS) tall.push(`${c.room} rises ${r} m${isGate ? ' at its gate' : ''}`);
  });
  const sills = G.gates.filter((g) => g.kind === 'double-jump' && g.door).map((g) => Math.round((g.z1 - g.z0) * 1000) / 1000).filter((h) => !(h > J + EPS && h <= D + EPS));
  law('no-kick', !tall.length && !sills.length, tall.length || sills.length ? [...tall, ...sills.map((h) => `a sill of ${h} m`)].join('; ') : `every climb a stair of ledges at most ${G.step} m apart (a jump is ${J} m); every double-jump gate over a jump, under ${D} m; no chimney, no stomp`, [...new Set(tall.map((t) => t.split(' ')[0]))]);

  // the sills hold: nothing stood on within a jump under a sill's top and within SILL_CLEAR jumps of it
  const leaks = [];
  for (const q of G.sills ?? []) {
    const near = G.solids.filter((x) => x.room === q.room && (x.role === 'ledge' || x.role === 'lip') && x.z1 >= q.z - J - EPS && x.z1 < q.z - EPS)
      .filter((x) => (q.side > 0 ? q.s - x.s1 : x.s0 - q.s) < SILL_CLEAR * J);
    if (near.length) leaks.push(`${q.room}: a ledge ${Math.round(Math.min(...near.map((x) => Math.abs(q.side > 0 ? q.s - x.s1 : x.s0 - q.s))) * 10) / 10} m from its sill puts it in one jump`);
  }
  law('sill-holds', !leaks.length, leaks.length ? leaks.join('; ') : `every double-jump sill stands clear: nothing to stand on within a jump under it and ${SILL_CLEAR} jumps across`, [...new Set(leaks.map((t) => t.split(':')[0]))]);
  // saves
  let since = 0, most = 0;
  for (const id of L.walk) { since = room.get(id).save ? 0 : since + 1; most = Math.max(most, since); }
  law('saves', most <= SAVE_EVERY, `at most ${most} rooms walked between save rooms (at most ${SAVE_EVERY})`);
  const throne = L.rooms.filter((r) => L.rings[r.ring].core).at(-1);
  law('boss-at-core', !!throne?.boss, throne?.boss ? `${throne.boss} holds the core` : 'the core holds no boss: the walk ends at an empty hall');
  return out;
}
