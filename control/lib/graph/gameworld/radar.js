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
 *   radarMarks(pos, heading, things, cfg) → [{ x, y, kind, fan?, state? }]   0 to 1, the pilot at 0.5, 0.5, ahead at the
 *                                top; a watcher that shows its sight carries its `fan` (its cone as points on the scope,
 *                                itself first, each ray ended by what would hide the pilot) and its `state`: calm | search | seen
 *                                (things: [{ at: [x, y], kind, pin?, sight? }]; heading radians, counter-clockwise from +x)
 *   planBox(colliders, water?) → [x0, y0, side]   the square the plan is drawn in (metres)
 *   planPoint(box, p)          → { x, y }   a place on the plan, 0 to 1, north at the top
 *   planSvg(colliders, water, box, { z?, rel?, veils?, relief?, trail? } | z?) → the plan as an SVG document (a string): masses,
 *                                low things, water; `rel` each thing by its own height (a land that rises and falls),
 *                                `veils` tall grass, `relief` the land's contours (a height grid), `trail` the way walked
 *                                (a mask grid)
 *   planFloors(colliders)      → the heights of a level's floors (its slabs' tops), lowest first
 *   floorPlanSvg(planSvg, colliders, box, z) → one floor's plan: its slabs the ground, what stands at it on them, the
 *                                rest dark (the radar's `floor`, a level of storeys or decks)
 *   radarPlan(box, pos, heading, range) → { x, y, size, turn }   the plan laid under the radar's scope: the pilot's place on
 *                                it, its side in scope diameters, its turn (degrees clockwise) so ahead is at the top
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
    const mark = { x: r(0.5 + n.u * k), y: r(0.5 - n.v * k), kind: n.t.kind };
    // WHAT IT SEES (a thing with a `sight`: a watcher whose rule shows it): its cone as a fan on the scope, from where it
    // stands along its facing, each ray ended by what would hide the pilot as it stands now (a box across the line from
    // the watcher's eye to the pilot's: sight is a line in height, so low cover ends a ray only for a body low enough)
    const S = n.t.sight;
    if (S && n.d <= cfg.range + S.range) {
      const fan = [[mark.x, mark.y]], N = 8, E = S.eye, pe = S.pe;
      for (let i = 0; i <= N; i++) {
        const a = S.heading - S.cone + (2 * S.cone * i) / N, dx = Math.cos(a), dy = Math.sin(a);
        let reach = S.range;
        for (const b of S.boxes || []) {
          const h = b.max[2] - S.feet; if (h <= pe || b.min[2] - S.feet > Math.max(E, pe)) continue;
          let t0 = 0, t1 = reach, miss = false;
          for (let q = 0; q < 2; q++) {
            const o = n.t.at[q], d = q ? dy : dx;
            if (Math.abs(d) < 1e-9) { if (o < b.min[q] || o > b.max[q]) { miss = true; break; } continue; }
            const u0 = (b.min[q] - o) / d, u1 = (b.max[q] - o) / d;
            t0 = Math.max(t0, Math.min(u0, u1)); t1 = Math.min(t1, Math.max(u0, u1));
          }
          if (!miss && t0 <= t1 && t0 < reach) reach = t0;
        }
        const px = n.t.at[0] + dx * reach - pos[0], py = n.t.at[1] + dy * reach - pos[1];
        fan.push([r(0.5 + (px * fy - py * fx) * (0.5 / cfg.range)), r(0.5 - (px * fx + py * fy) * (0.5 / cfg.range))]);
      }
      mark.fan = fan; mark.state = S.state;
    }
    out.push(mark);
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
export function planSvg(colliders, water, box, opts) {
  const S = 512, k = S / box[2], f = (v) => Math.round(v * 10) / 10, o = typeof opts === 'number' ? { z: opts } : opts || {}, z = o.z || 0;
  const rect = (x0, y0, x1, y1, fill) => `<rect x="${f((x0 - box[0]) * k)}" y="${f(S - (y1 - box[1]) * k)}" width="${f(Math.max(1, (x1 - x0) * k))}" height="${f(Math.max(1, (y1 - y0) * k))}" fill="${fill}"/>`;
  const wet = (water || []).map((q) => rect(q[0], q[1], q[2], q[3], '#3f6f8f')), low = [], tall = [];
  for (const c of colliders || []) {
    // (`z`, or a number in place of the options: the floor the plan is of, where it is not the world's zero: a yard on
    // its land, an arena on a hill; `rel`: a land that rises and falls, each thing read by its own height, its foot
    // wherever the ground is)
    const lo = o.rel ? 0 : c && c.min ? c.min[2] - z : 0, hi = o.rel && c && c.min ? c.max[2] - c.min[2] : c && c.max ? c.max[2] - z : 0;
    if (!c || !c.min || !c.max || lo > 1.2 || hi < 0.75) continue;
    (hi >= 1.6 ? tall : low).push(rect(c.min[0], c.min[1], c.max[0], c.max[1], hi >= 1.6 ? '#d9d2bd' : '#8f8a78'));
  }
  // (`veils`: tall grass, a stealth land's cover, its patches under what stands)
  const grass = (o.veils || []).filter((v) => !v.under).map((v) => `<circle cx="${f((v.at[0] - box[0]) * k)}" cy="${f(S - (v.at[1] - box[1]) * k)}" r="${f(v.r * k)}" fill="#6f9442"/>`);
  // (`relief`: the land's heights on a grid, { x0, y0, cell, nx, ny, z: [row by row, null off the land], step?, major? },
  // drawn as its contours, a line every `step` metres (1) and a brighter one every `major` (5): marching squares, each
  // cell's crossings joined, so a slope's lines crowd and a cliff's run together)
  let topo = '';
  if (o.relief) {
    const R = o.relief, st = R.step || 1, maj = R.major || 5, minor = [], major = [], Z = (i, j) => R.z[j * R.nx + i];
    let zl = Infinity, zh = -Infinity; for (const v of R.z) if (v != null) { zl = Math.min(zl, v); zh = Math.max(zh, v); }
    const X = (i) => f((R.x0 + i * R.cell - box[0]) * k), Y = (j) => f(S - (R.y0 + j * R.cell - box[1]) * k);
    for (let lv = Math.ceil(zl / st) * st; lv <= zh; lv += st) {
      const out = Math.abs(lv / maj - Math.round(lv / maj)) < 1e-6 ? major : minor;
      for (let j = 0; j + 1 < R.ny; j++) for (let i = 0; i + 1 < R.nx; i++) {
        const a = Z(i, j), b = Z(i + 1, j), c = Z(i + 1, j + 1), d = Z(i, j + 1);
        if (a == null || b == null || c == null || d == null) continue;
        const pts = [], cut = (za, zb, xa, ya, xb, yb) => { if ((za < lv) !== (zb < lv)) { const t = (lv - za) / (zb - za); pts.push([xa + (xb - xa) * t, ya + (yb - ya) * t]); } };
        cut(a, b, i, j, i + 1, j); cut(b, c, i + 1, j, i + 1, j + 1); cut(c, d, i + 1, j + 1, i, j + 1); cut(d, a, i, j + 1, i, j);
        for (let q = 0; q + 1 < pts.length; q += 2) out.push(`M${X(pts[q][0])} ${Y(pts[q][1])}L${X(pts[q + 1][0])} ${Y(pts[q + 1][1])}`);
      }
    }
    topo = `<path d="${minor.join('')}" stroke="#4b5244" stroke-width="1" fill="none"/><path d="${major.join('')}" stroke="#78806c" stroke-width="1.6" fill="none"/>`;
  }
  // (`trail`: the way walked, a mask on a grid, { x0, y0, cell, nx, ny, on: [row by row, 1 on it] }, laid in runs a row)
  let way = '';
  if (o.trail) {
    const T = o.trail, runs = [];
    for (let j = 0; j < T.ny; j++) for (let i = 0; i < T.nx; i++) {
      if (!T.on[j * T.nx + i]) continue;
      let e = i; while (e + 1 < T.nx && T.on[j * T.nx + e + 1]) e++;
      runs.push(rect(T.x0 + i * T.cell - T.cell / 2, T.y0 + j * T.cell - T.cell / 2, T.x0 + e * T.cell + T.cell / 2, T.y0 + j * T.cell + T.cell / 2, '#8a7350'));
      i = e;
    }
    way = runs.join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#1c1f1c"/>${topo}${wet.join('')}${way}${grass.join('')}${low.join('')}${tall.join('')}</svg>`;
}

/** The floors a level stands on: the tops of its slabs (a box thinner than a storey, wide as a room), lowest first. */
export function planFloors(colliders) {
  const out = [];
  for (const c of colliders || []) {
    if (!c || !c.min || !c.max || c.max[2] - c.min[2] >= 1.2 || (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) < 9) continue;
    const z = Math.round(c.max[2] * 100) / 100;
    if (!out.some((q) => Math.abs(q - z) < 0.3)) out.push(z);
  }
  return out.sort((a, b) => a - b);
}

/** ONE FLOOR's plan (a level of storeys or decks, the radar's `floor`): the floor at `z` drawn as the ground a body walks
 *  (its slabs, every other place dark: a drop, a hole, the sea) and on it only what stands at that floor (planSvg's own
 *  masses and low things at `z`); a floor above or below is not on it. `planSvg` handed in: the page inlines both. */
export function floorPlanSvg(planSvg, colliders, box, z) {
  const S = 512, k = S / box[2], f = (v) => Math.round(v * 10) / 10, floor = [], on = [];
  for (const c of colliders || []) {
    if (!c || !c.min || !c.max) continue;
    if (Math.abs(c.max[2] - z) < 0.15 && c.max[2] - c.min[2] < 1.2) floor.push(`<rect x="${f((c.min[0] - box[0]) * k)}" y="${f(S - (c.max[1] - box[1]) * k)}" width="${f(Math.max(1, (c.max[0] - c.min[0]) * k))}" height="${f(Math.max(1, (c.max[1] - c.min[1]) * k))}" fill="#3d454b"/>`);
    else if (c.max[2] - z >= 0.75 && c.min[2] - z <= 1.2) on.push(c);
  }
  return planSvg(on, null, box, { z }).replace('fill="#1c1f1c"/>', `fill="#0e1214"/>${floor.join('')}`);
}

/** The plan under the radar (the scope's map): where the pilot is on it (0 to 1), how many scope diameters its side spans
 *  at the radar's range, and its turn so that ahead is at the top (degrees clockwise, north's own bearing on the scope). */
export function radarPlan(box, pos, heading, range) {
  const r = (v) => Math.round(v * 1000) / 1000;
  return { x: r((pos[0] - box[0]) / box[2]), y: r(1 - (pos[1] - box[1]) / box[2]), size: r(box[2] / (2 * range)), turn: r((((heading || 0) - Math.PI / 2) * 180) / Math.PI) };
}

/** The land under the radar's map, read when a level is built (a geocube level's `radar: { map: 'topo' }`): its heights
 *  every `cell` metres (form/land-read.js's grass map: the ground's top, null off it) and its trail's mask (the land read's
 *  path mask, on it where its signed distance is none or less), for planSvg's `relief` and `trail`. Node's side only. */
export function radarLand(read, cell = 1.5) {
  const G = read && read.grassMap, PM = read && read.PM;
  if (!G || !G.at) return null;
  const x0 = G.origin[0], y0 = G.origin[1], nx = Math.max(2, Math.floor(((G.size[0] - 1) * G.cell) / cell) + 1), ny = Math.max(2, Math.floor(((G.size[1] - 1) * G.cell) / cell) + 1);
  const z = [], on = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell, y = y0 + j * cell, g = G.at(x, y);
    z.push(g && Number.isFinite(g.z) ? Math.round(g.z * 10) / 10 : null);
    let t = 0;
    if (PM) { const pi = Math.round((x - PM.origin[0]) / PM.cell), pj = Math.round((y - PM.origin[1]) / PM.cell); if (pi >= 0 && pj >= 0 && pi < PM.size[0] && pj < PM.size[1] && PM.dist[pj * PM.size[0] + pi] - PM.inside[pj * PM.size[0] + pi] <= 0) t = 1; }
    on.push(t);
  }
  const r = (v) => Math.round(v * 1000) / 1000;
  return { relief: { x0: r(x0), y0: r(y0), cell, nx, ny, z }, ...(PM ? { trail: { x0: r(x0), y0: r(y0), cell, nx, ny, on } } : {}) };
}

/** The things of a scene the radar and the map read: the pilot's foes awake and standing, and the place of the task
 *  in hand (`goal`: [x, y] or null), pinned. */
export function sceneThings(W, me, goal) {
  const out = [];
  if (goal) out.push({ at: goal, kind: 'goal', pin: true });
  for (const e of (W && W.entities) || []) {
    if (!e || e === me || !e.transform || e.isCamera || e.dormant || e.downed || e.gone || !e.team || e.team === me.team || !e.body || !e.body.hittable) continue;
    const T = { at: e.transform.pos, kind: 'foe' }, r = e.rule;
    // (a watcher whose rule shows its sight: its cone, its reach, whether it is calm, searching or has the pilot; the
    // boxes near it, and the pilot's eye as it stands now)
    if (r && r.sightShown) {
      const now = W.time || 0, range = r.sightRange != null ? r.sightRange : 14, p = e.transform.pos, eyeOf = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 1.7) * 0.75;
      T.sight = { heading: e.transform.heading || 0, cone: r.sightCone != null ? r.sightCone : 0.6, range, eye: eyeOf(e), pe: eyeOf(me), feet: p[2] - (r.eye || 0),
        state: e.lastSeen && now - e.lastSeen.t < 0.6 ? 'seen' : e.alert && e.alert.level && e.alert.level !== 'calm' ? 'search' : 'calm',
        boxes: (W.colliders || []).filter((b) => b.max[0] > p[0] - range && b.min[0] < p[0] + range && b.max[1] > p[1] - range && b.min[1] < p[1] + range) };
    }
    out.push(T);
  }
  return out;
}
