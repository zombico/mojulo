/**
 * IN-HALL — an indoor walk from a recipe, not from code: the first rung of the rooms' ladder (hall → section → floor),
 * the out-trail's (era/out-trail.js) twin indoors. A hall is the run of rooms a player passes through in about 8 to 20 s
 * and explores in one to two and a half minutes. Where a trail strings beats on a spine across the land, a hall strings
 * them as ROOMS on a walk: each beat is a room (or a side room off the walk), shaped by what the beat is for, and the
 * stage (era/stage.js) builds them as it builds any rooms, in the kit and the cube's stone.
 *
 *   hall: { id?, run?, heartbeat?, beats?, height?, mouth?, exit? }
 *     run        seconds to walk through, IN_HALL.run's range (the walk's length is run × speed)
 *     heartbeat  0–1: how hard the walk presses in and opens out (0 every room the same height, 1 low squeezes and tall
 *                reveals)
 *     beats      3–8 beats in walking order (IN_BEATS); absent, drawn by the seed under the grammar
 *     height     the hall's ceiling, metres (3–12): every beat's height is a share of it
 *     mouth      how the hall is entered: 'arch' (default), 'door', 'portal', 'cave' (its port; a threshold reads it)
 *     exit       how it is left, the same words, or 'none' (a dead end: its landmark is its end)
 *
 *   readInHall(h) → H (the recipe checked, its defaults in)
 *   drawHallBeats(n, seed) → [beat]             under the grammar: a reveal, a landmark and a pocket always
 *   hallOrderFaults(order) → [fault]            the sequence rules
 *   planInHall(kit, H, seed) → { id, mouth, exit, beats, rooms, links, ways, spine, findings }   rooms on the kit's grid
 *   hallAnchors(hall, plan) → anchors           beats and ports, tagged `hall: 'in-hall:<id>'`
 *   inHallLaws(hall, plan) → [{ law, ok, value, want }]   measured on the stage's own plan (planStage)
 *
 * THE GRAMMAR (the out-trail's, indoors): never two beats alike together; a reveal is never first and always comes out
 * of a squeeze (compression, then release); the landmark is neither first nor past the middle, so the mouth sees it down
 * the walk and it pulls the walker on; a pocket opens off the room before it, so it is never first.
 *
 * THE WALK (phase 1): a straight spine from the mouth (`-y` of the first room) along `+y`, every room centred on one
 * axis with an even width, so every doorway stands on the axis and the mouth sees down it. A pocket is a side room off
 * the spine room before it, no deeper than its host, so it meets no neighbour. The HEARTBEAT is each beat's height and
 * width, its share swung by `heartbeat`. Turns, storeys (a stair beat), and the beats that need their own geometry
 * (`crossing`, `pit`, `gate`) are named in IN_HALL.planned and refused until they are built.
 *
 * Deterministic: the seed's dice only (dirt.js hash3).
 */
import { hash3 } from './dirt.js';

export const IN_HALL = Object.freeze({
  // an explorer's walk indoors (slower than the trail's runner), the exploring pace, the run and the explore ranges
  speed: 4.5, pace: 1.3, run: [8, 20, 12], explore: [60, 150], height: [3, 12, 5],
  // how far a room's depth may be stretched past its beat's range to make the run
  stretch: 1.5,
  // the lowest a room's ceiling comes down, metres: a squeeze presses in, but its doorway (half a metre under it,
  // stage.js) stays a full metre over the walker's eye
  floor: 3.5,
  // each beat: its room (w across the walk, d along it, metres; h its share of the hall's height), its DWELL (seconds an
  // explorer spends there) and its words
  beats: Object.freeze({
    squeeze: { w: [4, 4], d: [6, 10], h: 0.6, dwell: 3, words: 'the walls close in and the roof comes down: a passage' },
    reveal: { w: [12, 16], d: [12, 18], h: 1.9, dwell: 12, words: 'through the narrow door the room opens up and away' },
    landmark: { w: [10, 12], d: [11, 15], h: 1.4, dwell: 10, words: 'something great at the end of the sightline: the set piece' },
    pocket: { w: [5, 7], d: [5, 7], h: 0.85, dwell: 8, words: 'a side room off the walk, a dead end with something in it' },
    rest: { w: [8, 10], d: [7, 9], h: 1, dwell: 6, words: 'a still, even room: the walk eases' },
  }),
  caps: Object.freeze({ pocket: 2, reveal: 2, landmark: 1, rest: 1 }),
  // named and refused: each needs geometry the stage does not lay yet
  planned: Object.freeze({ crossing: 'a channel across the floor', pit: 'a floor fallen through', stair: 'a flight to another storey', gate: 'a locked door, its key in a pocket' }),
  ports: Object.freeze(['arch', 'door', 'portal', 'cave']),
});
export const IN_BEATS = Object.freeze(Object.keys(IN_HALL.beats));
const C = IN_HALL;
const r2 = (v) => Math.round(v * 100) / 100;

export function readInHall(h) {
  if (h === true) h = {};
  if (!h || typeof h !== 'object' || Array.isArray(h)) throw new Error('stage: hall is { id?, run?, heartbeat?, beats?, height?, mouth?, exit? } (or true)');
  const known = ['id', 'run', 'heartbeat', 'beats', 'height', 'mouth', 'exit'];
  for (const k of Object.keys(h)) if (!known.includes(k)) throw new Error(`stage: hall.${k} is not a hall setting (settings: ${known.join(', ')})`);
  const num = (k, lo, hi, d, words) => {
    if (h[k] === undefined) return d;
    if (typeof h[k] !== 'number' || !(h[k] >= lo && h[k] <= hi)) throw new Error(`stage: hall.${k} is ${words}`);
    return h[k];
  };
  const run = num('run', C.run[0], C.run[1], C.run[2], `the seconds an explorer walks through, ${C.run[0]} to ${C.run[1]}`);
  const heartbeat = num('heartbeat', 0, 1, 0.6, 'a number from 0 (every room alike) to 1 (low squeezes, tall reveals)');
  const height = num('height', C.height[0], C.height[1], C.height[2], `the hall's ceiling in metres, ${C.height[0]} to ${C.height[1]}`);
  let beats = null;
  if (h.beats !== undefined) {
    if (!Array.isArray(h.beats) || h.beats.length < 3 || h.beats.length > 8) throw new Error('stage: hall.beats is a list of 3 to 8 beats, in walking order');
    for (const b of h.beats) {
      if (C.planned[b]) throw new Error(`stage: hall.beats: '${b}' (${C.planned[b]}) is planned, not built yet (beats: ${IN_BEATS.join(', ')})`);
      if (!IN_BEATS.includes(b)) throw new Error(`stage: hall.beats: '${b}' is not a beat (beats: ${IN_BEATS.join(', ')})`);
    }
    const faults = hallOrderFaults(h.beats);
    if (faults.length) throw new Error(`stage: hall.beats: ${faults.join('; ')}`);
    beats = [...h.beats];
  }
  const id = h.id === undefined ? 'hall' : h.id;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,31}$/.test(id)) throw new Error('stage: hall.id is a short lower-case name (letters, digits, hyphens)');
  const port = (k, none) => {
    if (h[k] === undefined) return 'arch';
    if (!(C.ports.includes(h[k]) || (none && h[k] === 'none'))) throw new Error(`stage: hall.${k} is ${[...C.ports, ...(none ? ['none'] : [])].join(', ')}`);
    return h[k];
  };
  const mouth = port('mouth', false), exit = port('exit', true);
  if (exit === 'none' && !beats) throw new Error('stage: hall.exit \'none\' is a dead end: name its beats, ending at its landmark');
  if (exit === 'none' && beats && spineOf(beats).at(-1) !== 'landmark') throw new Error('stage: hall.exit \'none\' is a dead end: its walk ends at its landmark (beats ending \'landmark\')');
  return { id, run, heartbeat, height, beats, mouth, exit };
}

// the beats the walk passes through (a pocket opens off the one before it)
const spineOf = (order) => order.filter((b) => b !== 'pocket');

/** What is wrong with an order of beats (the grammar's sequence rules). */
export function hallOrderFaults(order) {
  const out = [], spine = spineOf(order);
  order.forEach((b, i) => { if (i && order[i - 1] === b) out.push(`two ${b}s together`); });
  for (const [b, cap] of Object.entries(C.caps)) if (order.filter((x) => x === b).length > cap) out.push(`more than ${cap} ${b}`);
  if (order[0] === 'pocket') out.push('a pocket first: it opens off the room before it');
  if (spine[0] === 'reveal') out.push('a reveal first: there is no squeeze before it');
  spine.forEach((b, i) => { if (b === 'reveal' && i && spine[i - 1] !== 'squeeze') out.push(`the reveal after the ${spine[i - 1]}: a reveal comes out of a squeeze`); });
  const lm = spine.indexOf('landmark');
  if (lm === 0) out.push('the landmark first: nothing leads to it');
  if (lm > Math.floor(spine.length / 2) && !(lm === spine.length - 1 && spine.length <= 3)) out.push('the landmark past the middle: the mouth cannot be drawn by it');
  if (!order.includes('landmark')) out.push('no landmark: nothing pulls the walk on');
  return out;
}

/** The beats in walking order, drawn by dice when the recipe names none: a reveal (out of its squeeze), a landmark and a
 *  pocket always, the grammar's rules kept, nothing over its cap. */
export function drawHallBeats(n, seed) {
  const pool = ['squeeze', 'squeeze', 'pocket', 'rest', 'reveal', 'pocket'];
  for (let k = 0; k < 96; k++) {
    const r = (i) => hash3(i, k, seed + 1301);
    const picks = ['squeeze', 'reveal', 'landmark', 'pocket'].slice(0, Math.max(3, Math.min(n, 4))), left = [...pool];
    for (let i = 0; picks.length < n && left.length; i++) {
      const b = left.splice(Math.floor(r(i) * left.length), 1)[0];
      if (picks.filter((p) => p === b).length < (C.caps[b] ?? 3)) picks.push(b);
    }
    const order = picks.map((b, i) => [r(50 + i), b]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    if (hallOrderFaults(order).length === 0) return order;
  }
  return ['squeeze', 'reveal', 'pocket', 'landmark', 'rest'].slice(0, Math.max(4, Math.min(n, 5)));
}

/** How many beats a run holds: one for every two and a half seconds, three to seven. */
const beatCount = (run) => Math.max(3, Math.min(7, Math.round(run / 2.5)));

/**
 * THE PLAN: the beats as rooms on the kit's grid, the walk's links between them and its two ports.
 * → { id, mouth, exit, beats: [{ id, kind, room, spine }], rooms, links, ways, spine: [room id], findings }
 */
export function planInHall(kit, H, seed = 1) {
  const g = kit.grid, S = seed | 0, order = H.beats ?? drawHallBeats(beatCount(H.run), S), findings = [];
  const roll = (i, k) => hash3(i, k, S + 1409), swing = 0.4 + 0.6 * H.heartbeat;
  const snap = (v) => Math.round(v / g) * g, even = (v) => 2 * g * Math.max(1, Math.round(v / (2 * g)));
  const counts = {}, beats = order.map((kind, i) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    const B = C.beats[kind], u = roll(i, 1), v = roll(i, 2);
    // the heartbeat: the beat's share of the hall's height and its width, swung harder the higher the heartbeat
    const hf = 1 + (B.h - 1) * swing, wide = kind === 'reveal' ? 0.4 + 0.6 * H.heartbeat * u + 0.2 * (1 - H.heartbeat) : u;
    return { id: `${kind}-${counts[kind]}`, kind, i, w: even(B.w[0] + (B.w[1] - B.w[0]) * Math.min(1, wide)), d: B.d[0] + (B.d[1] - B.d[0]) * v,
      h: Math.max(C.floor, Math.round(H.height * hf * 2) / 2) };
  });
  const spine = beats.filter((b) => b.kind !== 'pocket');
  // THE RUN: the spine's depths drawn in their ranges, scaled together to the run's length, each held to its range
  // stretched (the law says when the walk misses)
  const want = H.run * C.speed, sum = spine.reduce((a, b) => a + b.d, 0), k = want / sum;
  for (const b of spine) { const B = C.beats[b.kind]; b.d = Math.max(B.d[0], Math.min(B.d[1] * C.stretch, snap(b.d * k))); }
  for (const b of beats) if (b.kind !== 'pocket') b.d = Math.max(2 * g, snap(b.d));
  // the spine along +y, every room centred on x = 0
  const rooms = [], links = [];
  let y = 0;
  for (const b of spine) { rooms.push({ id: b.id, x: -b.w / 2, y, w: b.w, d: b.d, h: b.h }); y += b.d; }
  const byId = new Map(rooms.map((r) => [r.id, r]));
  spine.slice(1).forEach((b, i) => links.push({ from: spine[i].id, to: b.id }));
  // the pockets: each off the spine room before it, on a side its dice pick (the other if that side is taken)
  const taken = new Set();
  beats.forEach((b, i) => {
    if (b.kind !== 'pocket') return;
    const host = byId.get(beats.slice(0, i).filter((q) => q.kind !== 'pocket').at(-1).id);
    const first = roll(i, 3) < 0.5 ? '+x' : '-x', side = [first, first === '+x' ? '-x' : '+x'].find((s) => !taken.has(`${host.id}${s}`));
    if (!side) { findings.push(`pocket ${b.id}: both sides of ${host.id} are taken`); return; }
    taken.add(`${host.id}${side}`);
    const d = Math.max(4 * g, Math.min(host.d, snap(b.d))), at = host.y + snap((host.d - d) / 2);
    rooms.push({ id: b.id, x: side === '+x' ? host.x + host.w : host.x - b.w, y: at, w: b.w, d, h: b.h });
    links.push({ from: host.id, to: b.id });
    b.host = host.id; b.side = side;
  });
  // the landmark's link last: the kit's dressing seats its set piece in the last link's room (crypt.js lastRoom)
  const lm = links.findIndex((l) => byId.get(l.to) && spine.find((s) => s.id === l.to)?.kind === 'landmark');
  if (lm >= 0) links.push(links.splice(lm, 1)[0]);
  const ways = [{ room: spine[0].id, side: '-y' }, ...(H.exit === 'none' ? [] : [{ room: spine.at(-1).id, side: '+y' }])];
  return { id: H.id, mouth: H.mouth, exit: H.exit, beats: beats.map((b) => ({ id: b.id, kind: b.kind, room: b.id, spine: b.kind !== 'pocket', ...(b.host ? { host: b.host, side: b.side } : {}) })),
    rooms, links, ways, spine: spine.map((b) => b.id), findings };
}

/** The hall's own anchors: a beat in every beat's room, the mouth and the exit at their sills, facing out. */
export function hallAnchors(hall, plan) {
  const tag = `in-hall:${hall.id}`, room = new Map(plan.rooms.map((r) => [r.id, r]));
  const centre = (r) => [r2((r.x0 + r.x1) / 2), r2((r.y0 + r.y1) / 2), 0];
  const beats = hall.beats.map((b) => ({ id: `beat-${b.id}`, kind: 'beat', beat: b.kind, room: b.room, at: centre(room.get(b.room)), N: [0, 1, 0], hall: tag }));
  const ports = (plan.ways || []).map((w, i) => {
    const out = { '-y': [0, -1, 0], '+y': [0, 1, 0], '-x': [-1, 0, 0], '+x': [1, 0, 0] }[w.side], mid = r2((w.lo + w.hi) / 2);
    return { id: i === 0 ? 'mouth' : 'exit', kind: 'port', port: i === 0 ? 'mouth' : 'exit', as: i === 0 ? hall.mouth : hall.exit, room: w.room, side: w.side,
      at: w.side.endsWith('y') ? [mid, r2(w.at), 0] : [r2(w.at), mid, 0], N: out, width: r2(w.hi - w.lo), height: r2(w.top), hall: tag };
  });
  return [...ports, ...beats];
}

/**
 * THE LAWS of a hall, measured on the stage's plan (planStage: its rooms' interiors and its doorways as built): the walk
 * through, the exploring time, the order, every reveal a release out of a squeeze, the landmark seen from the mouth down
 * the doorways, the ports on outside walls, every room reached. → [{ law, ok, value, want }].
 */
export function inHallLaws(hall, H, plan) {
  const out = [], law = (id, ok, value, want) => out.push({ law: id, ok: !!ok, value, want });
  const room = new Map(plan.rooms.map((r) => [r.id, r])), spine = hall.spine.map((id) => room.get(id));
  const walk = spine.reduce((a, r) => a + (r.y1 - r.y0), 0) + plan.kit.wall * (spine.length - 1), runS = walk / C.speed;
  law('run', runS >= C.run[0] - 0.01 && runS <= C.run[1] + 0.01, r2(runS), `${C.run[0]}–${C.run[1]} s to walk through (the recipe asked ${H.run})`);
  const pockets = hall.beats.filter((b) => b.kind === 'pocket').map((b) => room.get(b.room)).filter(Boolean);
  const detour = pockets.reduce((a, r) => { const h = room.get(hall.beats.find((b) => b.room === r.id).host); return a + 2 * Math.hypot((r.x0 + r.x1) / 2 - (h.x0 + h.x1) / 2, (r.y0 + r.y1) / 2 - (h.y0 + h.y1) / 2); }, 0);
  const ex = Math.round((walk + detour) / C.pace + hall.beats.reduce((a, b) => a + C.beats[b.kind].dwell, 0));
  law('explore', ex >= C.explore[0] && ex <= C.explore[1], ex, `${C.explore[0]}–${C.explore[1]} s to explore deeply`);
  const faults = hallOrderFaults(hall.beats.map((b) => b.kind));
  law('order', faults.length === 0, faults.join('; ') || 'ok', 'a reveal out of a squeeze, the landmark early, never two alike together');
  const kinds = hall.beats.filter((b) => b.spine).map((b) => b.kind), soft = [];
  kinds.forEach((k, i) => { if (k === 'reveal' && i && spine[i].h < 1.5 * spine[i - 1].h) soft.push(`${hall.spine[i]} ${spine[i].h} m after ${spine[i - 1].h} m`); });
  law('release', soft.length === 0, soft.join('; ') || kinds.filter((k) => k === 'reveal').length, 'every reveal at least half again as tall as the squeeze it comes out of');
  const lmId = hall.beats.find((b) => b.kind === 'landmark')?.room;
  law('landmark', !!lmId && seenFromMouth(plan, hall, lmId), lmId ?? 'none', 'the landmark seen from the mouth, down the doorways');
  const boxes = plan.rooms.map((r) => r.box), faceOut = (plan.ways || []).every((w) => {
    const r = room.get(w.room), [x0, y0, x1, y1] = r.box, probe = { '-y': [(x0 + x1) / 2, y0 - 0.5], '+y': [(x0 + x1) / 2, y1 + 0.5], '-x': [x0 - 0.5, (y0 + y1) / 2], '+x': [x1 + 0.5, (y0 + y1) / 2] }[w.side];
    return !boxes.some((b) => probe[0] > b[0] && probe[0] < b[2] && probe[1] > b[1] && probe[1] < b[3]);
  });
  law('ports', faceOut && (plan.ways || []).length === (H.exit === 'none' ? 1 : 2), (plan.ways || []).map((w) => `${w.room} ${w.side}`).join(', '), 'a mouth and an exit (or a dead end), each through an outside wall');
  const seen = new Set([plan.rooms[0].id]);
  for (let grew = true; grew;) { grew = false; for (const l of plan.links) for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) if (seen.has(a) && !seen.has(b)) { seen.add(b); grew = true; } }
  law('reach', seen.size === plan.rooms.length, `${seen.size}/${plan.rooms.length}`, 'every room reached from the mouth');
  law('fit', hall.findings.length === 0, hall.findings.join('; ') || 'ok', 'every beat laid');
  return out;
}

// the mouth's eye (1.7 m up, a step inside the first room on the axis) to the landmark room's middle (1.5 m up): every
// wall the line crosses it crosses inside a doorway, under its head
function seenFromMouth(plan, hall, lmId) {
  const room = new Map(plan.rooms.map((r) => [r.id, r])), first = room.get(hall.spine[0]), lm = room.get(lmId);
  const eye = [(first.x0 + first.x1) / 2, first.y0 + 1.5, 1.7], at = [(lm.x0 + lm.x1) / 2, (lm.y0 + lm.y1) / 2, 1.5];
  for (const l of plan.links) {
    if (!l.wall.endsWith('y')) continue;
    if (!((l.at > eye[1] && l.at < at[1]) || (l.at < eye[1] && l.at > at[1]))) continue;
    const t = (l.at - eye[1]) / (at[1] - eye[1]), x = eye[0] + (at[0] - eye[0]) * t, z = eye[2] + (at[2] - eye[2]) * t;
    if (!(x > l.lo && x < l.hi && z < l.top)) return false;
  }
  // and no wall without a doorway between them: every spine wall the line crosses is a link
  const ys = hall.spine.map((id) => room.get(id).box[1]).filter((y) => y > eye[1] && y < at[1]);
  return ys.every((y) => plan.links.some((l) => l.wall.endsWith('y') && Math.abs(l.at - y) < 1e-6));
}
