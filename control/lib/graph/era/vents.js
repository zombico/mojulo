/**
 * VENTS — crawl spaces through a building: a DUCT along the back wall of a row of rooms (the rooms side by side off one
 * side of a corridor), through a hole in each wall they share, under a lid a body lying down passes beneath and one
 * standing does not, with a HATCH into each room it passes (a gap in its front wall). A body goes in at one room's
 * hatch, lying, and comes out at another's, never in the corridor the guards walk. A guard cannot follow, nor see a body
 * lying in it from over it (its lid and its front wall stand between).
 *
 *   readVents(v)            → the program's `vents`: true | { depth?, clear?, rooms? } (checked), or null
 *     depth                 the duct's width inside, from the back wall (1.3 m)
 *     clear                 its height inside, the underside of its lid (0.75 m: a body lying is 0.45)
 *     rooms                 at least this many rooms in a row for a duct (2)
 *   planVents(rooms, links, V) → { ducts: [{ id, corridor, storey, back, rooms, segments: [{ room, strip, hatch, parts }]}],
 *                             holes: [{ room, side, lo, hi, top }], unders: [{ under, min, max, near }],
 *                             sills: [{ min, max }] }   (each hole's floor through the wall's thickness)
 *     strip                 the duct's floor in a room ({ min: [x, y], max: [x, y] })
 *     hatch                 its way in from the room: the gap's middle and the side it opens to ({ at: [x, y], side })
 *     parts                 the boxes it is built of, world metres ({ min: [x, y, z], max: [x, y, z], part }): its front
 *                           wall (with the hatch's gap) and its lid
 *
 * Laid by the stage (era/stage.js planStage) where a program asks for them (era/programs.js `vents`): the holes cut in
 * the shared walls, the parts drawn and made colliders, the ducts' insides the page's crawl spaces (veil.js `under`),
 * their floors and hatches kept clear of every piece (compose-dress.js keepOuts). Pure.
 */
// (a duct a body lying in it fits with room either side, never a slot it sticks in: 1.3 m inside, a hatch 1.4 m wide)
const D = Object.freeze({ depth: 1.3, clear: 0.75, rooms: 2 });
const T = 0.06, LID = 0.08, HATCH = 1.4;
const r3 = (v) => Math.round(v * 1000) / 1000;
const FLIP = Object.freeze({ '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' });

export function readVents(v) {
  if (v === undefined || v === false || v === null) return null;
  if (v === true) return { ...D };
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('program: vents is true, or { depth?, clear?, rooms? } (a duct behind each row of rooms)');
  for (const k of Object.keys(v)) if (!(k in D)) throw new Error(`program: vents.${k} is not a setting (${Object.keys(D).join(', ')})`);
  const o = { ...D, ...v };
  if (!(o.depth >= 1.1 && o.depth <= 1.8)) throw new Error('program: vents.depth is a duct\'s width inside, 1.1 to 1.8 m');
  if (!(o.clear >= 0.6 && o.clear <= 1.0)) throw new Error('program: vents.clear is its height inside, 0.6 to 1 m (a body lying is 0.45)');
  if (!(Number.isInteger(o.rooms) && o.rooms >= 2)) throw new Error('program: vents.rooms is the fewest rooms in a row a duct runs behind, 2 or more');
  return o;
}

/** The ducts, their holes and their crawl spaces (see the header). */
export function planVents(rooms, links, V) {
  const byId = new Map(rooms.map((r) => [r.id, r])), ducts = [], holes = [], unders = [], sills = [];
  // each room off a corridor, by the corridor and the side of it the room stands on (its wall facing the corridor)
  const rows = new Map();
  for (const l of links) {
    if (!l.wall) continue;
    const pair = /^corridor/.test(l.from) && !/^corridor|^core|^lobby/.test(l.to) ? [l.from, l.to, FLIP[l.wall]] : /^corridor/.test(l.to) && !/^corridor|^core|^lobby/.test(l.from) ? [l.to, l.from, l.wall] : null;
    if (!pair) continue;
    const [c, id, wall] = pair, r = byId.get(id);
    if (!r || r.gallery || r.h > 6) continue;   // (a tall hall is no room a duct runs behind)
    const key = `${c}|${wall}`;
    if (!rows.has(key)) rows.set(key, { corridor: c, wall, rooms: [] });
    if (!rows.get(key).rooms.includes(r)) rows.get(key).rooms.push(r);
  }
  for (const { corridor, wall, rooms: R0 } of rows.values()) {
    // (along the corridor: x when the room's corridor wall is a y wall)
    const alongX = wall.endsWith('y'), back = FLIP[wall], lo = (r) => (alongX ? r.x0 : r.y0), hi = (r) => (alongX ? r.x1 : r.y1);
    const sorted = R0.slice().sort((a, b) => lo(a) - lo(b));
    // runs of rooms side by side: one storey, a wall between each and the next
    const runs = [];
    for (const r of sorted) {
      const run = runs[runs.length - 1], last = run && run[run.length - 1];
      if (last && (last.storey ?? 0) === (r.storey ?? 0) && lo(r) - hi(last) < 0.8 && lo(r) - hi(last) > -0.01) run.push(r); else runs.push([r]);
    }
    for (const run of runs) {
      if (run.length < V.rooms) continue;
      const id = `vent-${corridor}-${back}-${ducts.length + 1}`, segments = [];
      // the strip along each room's back wall, and the hole through each wall to the next
      let broken = false;
      for (let k = 0; k < run.length; k++) {
        const r = run[k], z0 = r.z0 ?? 0;
        const vb = back.startsWith('+') ? (alongX ? r.y1 : r.x1) : alongX ? r.y0 : r.x0, sgn = back.startsWith('+') ? -1 : 1, vf = vb + sgn * V.depth;
        const v0 = Math.min(vb, vf), v1 = Math.max(vb, vf), u0 = lo(r), u1 = hi(r);
        const strip = alongX ? { min: [u0, v0], max: [u1, v1] } : { min: [v0, u0], max: [v1, u1] };
        // (the hatch: the middle of its front wall, a door's width, opening into the room)
        const hm = (u0 + u1) / 2, ga = hm - HATCH / 2, gb = hm + HATCH / 2;
        const fw0 = Math.min(vf, vf + sgn * T), fw1 = Math.max(vf, vf + sgn * T), box = (a, b, c0, c1, z1, z2, part) => (alongX ? { min: [r3(a), r3(c0), r3(z0 + z1)], max: [r3(b), r3(c1), r3(z0 + z2)], part } : { min: [r3(c0), r3(a), r3(z0 + z1)], max: [r3(c1), r3(b), r3(z0 + z2)], part });
        const parts = [box(u0, ga, fw0, fw1, 0, V.clear + LID, 'front'), box(gb, u1, fw0, fw1, 0, V.clear + LID, 'front'), box(u0, u1, Math.min(v0, fw0), Math.max(v1, fw1), V.clear, V.clear + LID, 'lid')];
        const hatch = { at: alongX ? [r3(hm), r3(vf + sgn * 0.5)] : [r3(vf + sgn * 0.5), r3(hm)], side: alongX ? (sgn > 0 ? '+y' : '-y') : sgn > 0 ? '+x' : '-x' };
        segments.push({ room: r.id, strip: { min: strip.min.map(r3), max: strip.max.map(r3) }, hatch, parts });
        unders.push({ under: true, min: [r3(strip.min[0]), r3(strip.min[1]), z0], max: [r3(strip.max[0]), r3(strip.max[1]), r3(z0 + V.clear)], near: 1.2 });
        if (k < run.length - 1) {
          // (a hole a body lying passes, at the duct's own span along the shared wall, where no doorway already is)
          const nx = run[k + 1], sideA = alongX ? '+x' : '+y', sideB = FLIP[sideA], h0 = r3(v0), h1 = r3(v1);
          const taken = (rr, sd) => (rr.openings?.[sd] ?? []).some((o) => o.lo < h1 + 0.3 && o.hi > h0 - 0.3);
          if (taken(r, sideA) || taken(nx, sideB)) { broken = true; continue; }
          holes.push({ room: r.id, side: sideA, lo: h0, hi: h1, top: r3(V.clear) }, { room: nx.id, side: sideB, lo: h0, hi: h1, top: r3(V.clear) });
          // (the hole's floor, through the wall's thickness: the rooms' floors stop at their walls)
          const ca = alongX ? (r.box ? r.box[2] : r.x1) : r.box ? r.box[3] : r.y1, cb = alongX ? (nx.box ? nx.box[0] : nx.x0) : nx.box ? nx.box[1] : nx.y0, a0 = Math.min(hi(r), ca) - 0.02, a1 = Math.max(lo(nx), cb) + 0.02;
          sills.push(alongX ? { min: [r3(a0), h0, r3(z0 - 0.1)], max: [r3(a1), h1, z0] } : { min: [h0, r3(a0), r3(z0 - 0.1)], max: [h1, r3(a1), z0] });
        }
      }
      ducts.push({ id, corridor, storey: run[0].storey ?? 0, back, rooms: run.map((r) => r.id), segments, ...(broken ? { broken: true } : {}) });
    }
  }
  return { ducts, holes, unders, sills };
}
