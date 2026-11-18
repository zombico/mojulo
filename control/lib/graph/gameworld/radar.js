/**
 * THE RADAR AND THE MAP — where things are round the pilot, and where the pilot is in the level. Two reads of one
 * scene, each a list of marks mana-ui's minimap draws:
 *
 *   the radar   a round scope, the pilot at its middle and AHEAD AT THE TOP, so it turns as the pilot turns, the level's
 *               plan under it turning with it (a MINIMAP: the same plan the map draws, at the scope's scale): every foe
 *               awake within its range, and the task in hand (a place to go) pinned to the rim while it is further
 *               off. A foe asleep is not on it: a room's foes wake as it is walked into, and the radar keeps that.
 *   the map     the level's plan, NORTH AT THE TOP and still: what stands in a body's way on the ground drawn from
 *               the scene's own colliders (so it is the level as it is played, never a second drawing of it), its
 *               water, the pilot, the task in hand and the foes awake.
 *
 * One concept wherever it is drawn; a mission draws both on mana-ui (mission-mana.js).
 *
 *   RADAR                      its numbers: its range (m), the most marks it draws, the rim a pinned mark sits on
 *   radarMarks(pos, heading, things, cfg) → [{ x, y, kind }]   0 to 1, the pilot at 0.5, 0.5, ahead at the top
 *                                (things: [{ at: [x, y], kind, pin? }]; heading radians, counter-clockwise from +x)
 *   planBox(colliders, water?) → [x0, y0, side]   the square the plan is drawn in (metres)
 *   planPoint(box, p)          → { x, y }   a place on the plan, 0 to 1, north at the top
 *   planSvg(colliders, water, box) → the plan as an SVG document (a string): masses, low things, water
 *   sceneThings(W, me, goal)   → the things of a scene the two read: the pilot's foes awake, the task's place
 *
 * The page's side only: every function here is inlined with toString() and references nothing outside itself.
 */
export const RADAR = Object.freeze({ range: 40, most: 12, rim: 0.46 });

/** The radar's marks (see the header). */
export function radarMarks(pos, heading, things, cfg) {
  const h = heading || 0, fx = Math.cos(h), fy = Math.sin(h), out = [];
  const near = things.map((t) => { const dx = t.at[0] - pos[0], dy = t.at[1] - pos[1]; return { t, d: Math.hypot(dx, dy), u: dx * fy - dy * fx, v: dx * fx + dy * fy }; }).sort((a, b) => a.d - b.d);
  for (const n of near) {
    if (out.length >= cfg.most) break;
    if (n.d > cfg.range && !n.t.pin) continue;
    // (past its range a pinned mark sits on the rim, toward where it is)
    const k = n.d > cfg.range ? cfg.rim / (n.d || 1) : 0.5 / cfg.range, r = (v) => Math.round(v * 1000) / 1000;
    out.push({ x: r(0.5 + n.u * k), y: r(0.5 - n.v * k), kind: n.t.kind });
  }
  return out;
}

/** The square a level's plan is drawn in: its colliders' and its water's reach, a margin round it. */
export function planBox(colliders, water, rect) {
  // (`rect`, a level that says where it is fought: [x0, y0, x1, y1], the plan boxed on it and not on the whole site)
  if (rect) { const side = Math.max(rect[2] - rect[0], rect[3] - rect[1]) + 4; return [(rect[0] + rect[2]) / 2 - side / 2, (rect[1] + rect[3]) / 2 - side / 2, side]; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of colliders || []) { if (!c || !c.min || !c.max) continue; x0 = Math.min(x0, c.min[0]); y0 = Math.min(y0, c.min[1]); x1 = Math.max(x1, c.max[0]); y1 = Math.max(y1, c.max[1]); }
  for (const q of water || []) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[2]); y1 = Math.max(y1, q[3]); }
  if (!(x1 > x0) || !(y1 > y0)) return [-20, -20, 40];
  const side = Math.max(x1 - x0, y1 - y0) + 4;
  return [(x0 + x1) / 2 - side / 2, (y0 + y1) / 2 - side / 2, side];
}
export function planPoint(box, p) {
  const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  return { x: r((p[0] - box[0]) / box[2]), y: r(1 - (p[1] - box[1]) / box[2]) };
}

/** The plan drawn: what stands in a body's way on the ground (a mass over a head's height dark, a low thing lighter),
 *  the water under them. A floor over the ground (a slab a body walks under) is not in the way and is not drawn. */
export function planSvg(colliders, water, box, z = 0) {
  const S = 512, k = S / box[2], f = (v) => Math.round(v * 10) / 10;
  const rect = (x0, y0, x1, y1, fill) => `<rect x="${f((x0 - box[0]) * k)}" y="${f(S - (y1 - box[1]) * k)}" width="${f(Math.max(1, (x1 - x0) * k))}" height="${f(Math.max(1, (y1 - y0) * k))}" fill="${fill}"/>`;
  const wet = (water || []).map((q) => rect(q[0], q[1], q[2], q[3], '#3f6f8f')), low = [], tall = [];
  for (const c of colliders || []) {
    // (`z`: the floor the plan is of, where it is not the world's zero: a yard on its land, an arena on a hill)
    if (!c || !c.min || !c.max || c.min[2] - z > 1.2 || c.max[2] - z < 0.75) continue;
    (c.max[2] - z >= 1.6 ? tall : low).push(rect(c.min[0], c.min[1], c.max[0], c.max[1], c.max[2] - z >= 1.6 ? '#d9d2bd' : '#8f8a78'));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#1c1f1c"/>${wet.join('')}${low.join('')}${tall.join('')}</svg>`;
}

/** The things of a scene the radar and the map read: the pilot's foes awake and standing, and the place of the task
 *  in hand (`goal`: [x, y] or null), pinned. */
export function sceneThings(W, me, goal) {
  const out = [];
  if (goal) out.push({ at: goal, kind: 'goal', pin: true });
  for (const e of (W && W.entities) || []) {
    if (!e || e === me || !e.transform || e.isCamera || e.dormant || e.downed || e.gone || !e.team || e.team === me.team || !e.body || !e.body.hittable) continue;
    out.push({ at: e.transform.pos, kind: 'foe' });
  }
  return out;
}
