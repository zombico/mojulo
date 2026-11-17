/**
 * THE ROOM PRIMITIVES — what one room for a game is composed of, as the board rail composes a board game out of its
 * kernel's primitives. A closed table: each primitive is its blocks (what stands and collides), the anchors it gives
 * (where things happen) and what it AFFORDS play (why it is there). A room is a list of them laid on a plane; nothing
 * else stands in it. A new kind of room is a new composition of these, and a new primitive is a row.
 *
 *   PRIMITIVES   { <kind>: { about, size: [w, d] metres, h, affords: [...], fill } }  (a platform's h is the room's own)
 *   AFFORDS      what a primitive offers play, in words
 *   ANCHORS      the places a room names that stand nothing: spawn, goal, foe; a fight's way, rift, boss and ring
 *   RESERVES     the floor a fight keeps clear, standing nothing: the ring, the run-up
 *   blocksOf(p)  → [{ id, x: [x0, x1], y: [y0, y1], h, fill, group, kind }]: a laid primitive's boxes, in metres
 *                  p: { kind, id, at: [x, y, z], rot?: 0 | 90, h? }; a MARK (a rift) stands nothing: no boxes
 *   footprint(p) → { x: [x0, x1], y: [y0, y1] } its plan, its approach included where it has one (a platform's step)
 *
 * Pure, no dice.
 */
export const AFFORDS = Object.freeze({
  cover: 'a body crouches behind it: a shot or a blow from the far side is stopped',
  screen: 'it blocks the sight between its sides: a sneak, a flank, a line a shooter cannot take',
  hop: 'low enough to be jumped or vaulted',
  vantage: 'a place above the floor that sees over the rest',
  climb: 'reached by a jump or a step from the floor',
  station: 'a place of work: a shift\'s station stands on it',
  source: 'where a raw thing is taken (a shift\'s crate)',
  store: 'where a made thing waits (a shift\'s shelf)',
  handin: 'where the work is handed in (a shift\'s counter)',
  // a fight's (fight.js): what a hero that plays strings asks of the place it fights in (needs.js kitAsks)
  ring: 'open floor of a radius: a string\'s travel and a pack round the hero',
  air: 'headroom over the ring: a launch and an air string above it',
  'run-up': 'a clear lane: a dashing blow carried its length into a foe',
  perch: 'a place above the blade\'s reach a shooter stands on: the sidearm\'s, or the air\'s',
  way: 'a way in or on',
  seal: 'a way held while a fight stands',
  rift: 'where a wave comes in',
  break: 'struck, it breaks',
  reward: 'it pays what it held',
  heal: 'it gives health back',
  rest: 'a breath between fights: where a death begins again',
  show: 'where a boss stands to be seen',
});

export const PRIMITIVES = Object.freeze({
  'cover-low': { about: 'a waist-high block: cover a body crouches behind, low enough to vault', size: [1.6, 0.5], h: 1, affords: ['cover', 'hop'], fill: '#c9b8a2' },
  'cover-tall': { about: 'a wall-high panel: cover that also blocks the sight past it', size: [1.8, 0.4], h: 2.2, affords: ['cover', 'screen'], fill: '#b3a48f' },
  pillar: { about: 'a column: it screens a line of sight and turns a chase', size: [0.6, 0.6], h: 3, affords: ['screen'], fill: '#a89c8a' },
  platform: { about: 'a raised deck reached by a step: a vantage over the floor', size: [3, 3], h: null, affords: ['vantage', 'climb'], fill: '#d3c9b9' },
  crate: { about: 'a crate: low cover, and a step up', size: [0.8, 0.8], h: 0.8, affords: ['cover', 'climb', 'hop'], fill: '#c9a978' },
  counter: { about: 'a work counter: a shift\'s station stands on it', size: [1, 1], h: 0.9, affords: ['station'], fill: '#e4875f' },
  bin: { about: 'a crate a raw thing is taken from', size: [0.8, 0.8], h: 0.7, affords: ['source'], fill: '#c9a978' },
  shelf: { about: 'a shelf a made thing waits on', size: [0.6, 0.6], h: 1.1, affords: ['store'], fill: '#a99f90' },
  pass: { about: 'the counter the work is handed in at', size: [1.6, 0.8], h: 1, affords: ['handin'], fill: '#f6f2ea' },
  // a fight's (fight.js)
  rift: { about: 'a mark on the floor where a wave comes in, foe spots round it; it stands nothing', size: [1.6, 1.6], h: 0, mark: true, affords: ['rift'], fill: '#8c3b2f' },
  perch: { about: 'a high narrow deck a shooter stands on, out of the blade\'s reach from the floor', size: [1.6, 1.6], h: null, affords: ['perch', 'vantage'], fill: '#bdb2a0' },
  urn: { about: 'an urn: struck, it breaks and pays', size: [0.6, 0.6], h: 0.9, affords: ['break', 'reward'], fill: '#b98a5a' },
  font: { about: 'a font: it heals once a fight, a breath between two', size: [0.8, 0.8], h: 1, affords: ['heal', 'rest'], fill: '#7fc9b4' },
  dais: { about: 'a low step a boss stands on to be seen', size: [4, 3], h: 0.3, affords: ['show'], fill: '#cfc4b2' },
});
export const ANCHORS = Object.freeze({
  spawn: 'where the hero starts',
  goal: 'where the room is won or left',
  foe: 'where a foe stands',
  way: 'a way in or on, given by the place (a room\'s doorway, a trail\'s end); sealed while a fight stands',
  rift: 'where a wave comes in',
  boss: 'where a boss stands',
  ring: 'the fight\'s centre',
});
export const RESERVES = Object.freeze({
  ring: 'a circle of open floor: nothing stands in it',
  'run-up': 'a lane: nothing stands in it',
});

const r3 = (v) => Math.round(v * 1000) / 1000;
const dims = (p) => { const P = PRIMITIVES[p.kind], [w, d] = P.size; return p.rot === 90 ? [d, w] : [w, d]; };
const STEP = 0.45;

export function footprint(p) {
  const [w, d] = dims(p), [x, y] = p.at;
  // a platform's step stands on its south side, so its plan reaches that far
  const step = p.kind === 'platform' && (p.h ?? 0) > STEP * 1.6 ? 0.9 : 0;
  return { x: [r3(x - w / 2), r3(x + w / 2)], y: [r3(y - d / 2 - step), r3(y + d / 2)] };
}

export function blocksOf(p) {
  const P = PRIMITIVES[p.kind];
  if (!P) throw new Error(`game room: no primitive '${p.kind}' (${Object.keys(PRIMITIVES).join(', ')})`);
  if (P.mark) return [];
  const [w, d] = dims(p), [x, y, z = 0] = p.at, h = p.h ?? P.h;
  const box = (id, cx, cy, bw, bd, bh, fill) => ({ id, x: [r3(cx - bw / 2), r3(cx + bw / 2)], y: [r3(cy - bd / 2), r3(cy + bd / 2)], h: r3(z + bh), fill, group: `room:${p.kind}`, kind: p.kind });
  const out = [box(p.id, x, y, w, d, h, P.fill)];
  // a platform too high to step onto stands a step before it (the half of its height a walker climbs)
  if (p.kind === 'platform' && h > STEP * 1.6) out.push(box(`${p.id}-step`, x, y - d / 2 - 0.45, Math.min(1.6, w), 0.9, r3(h / 2), '#ddd5c8'));
  return out;
}
