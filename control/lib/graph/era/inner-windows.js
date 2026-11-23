/**
 * INNER WINDOWS — glass between a room and its corridor: an office's window beside its door, a lab's onto the clean
 * corridor. A guard walking the corridor sees into the room through it, and a body in the room sees the guard; neither
 * passes it. The window stands in the room's corridor wall on the longest stretch its doorway leaves, sill to head.
 *
 *   readInnerWindows(v)   → the program's `windows`: true | { sill?, top?, width?, roles? } (checked), or null
 *     sill, top           its sill's and its head's height (1.0 and 2.1 m)
 *     width               its widest (2.4 m); a stretch narrower than 1.2 m takes none
 *     roles               the rooms' roles that take one (every room off a corridor, when absent)
 *   planInnerWindows(rooms, links, W, wall) → { windows: [{ room, corridor, side, lo, hi, sill, top }],
 *                         holes: [{ room, side, lo, hi, top, sill }], barriers: [{ min, max, kind: 'glass', of }] }
 *
 * Laid by the stage (era/stage.js) where a program asks (era/programs.js `windows`): the holes cut in both walls, the
 * glass drawn by the kit's own glazing (bay-glass.js glazeOpening, no daylight beyond it), each pane a BARRIER (seen
 * through, never walked through: worlds/controllable/barrier.js). Pure.
 */
const D = Object.freeze({ sill: 1.0, top: 2.1, width: 2.4, roles: null });
const FLIP = Object.freeze({ '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' });
const r3 = (v) => Math.round(v * 1000) / 1000;

export function readInnerWindows(v) {
  if (v === undefined || v === false || v === null) return null;
  if (v === true) return { ...D };
  if (typeof v !== 'object' || Array.isArray(v)) throw new Error('program: windows is true, or { sill?, top?, width?, roles? } (glass between a room and its corridor)');
  for (const k of Object.keys(v)) if (!(k in D)) throw new Error(`program: windows.${k} is not a setting (${Object.keys(D).join(', ')})`);
  const o = { ...D, ...v };
  if (!(o.sill >= 0.6 && o.sill <= 1.4)) throw new Error('program: windows.sill is 0.6 to 1.4 m');
  if (!(o.top >= o.sill + 0.6 && o.top <= 2.8)) throw new Error('program: windows.top is over the sill by 0.6 m and at most 2.8 m');
  if (!(o.width >= 1.2 && o.width <= 4)) throw new Error('program: windows.width is 1.2 to 4 m');
  if (o.roles !== null && !(Array.isArray(o.roles) && o.roles.every((x) => typeof x === 'string'))) throw new Error('program: windows.roles is a list of room roles');
  return o;
}

/** The windows, their holes and their panes as barriers (see the header). `wall` the kit's wall thickness. */
export function planInnerWindows(rooms, links, W, wall = 0.5) {
  const byId = new Map(rooms.map((r) => [r.id, r])), windows = [], holes = [], barriers = [];
  const roleOf = (id) => id.replace(/-\d+[a-z]?$/, '');
  for (const l of links) {
    if (!l.wall) continue;
    const pair = /^corridor/.test(l.from) && !/^corridor|^core|^lobby/.test(l.to) ? [l.from, l.to, FLIP[l.wall]] : /^corridor/.test(l.to) && !/^corridor|^core|^lobby/.test(l.from) ? [l.to, l.from, l.wall] : null;
    if (!pair) continue;
    const [c, id, side] = pair, r = byId.get(id), C = byId.get(c);
    if (!r || !C || r.gallery || r.h > 6 || (W.roles && !W.roles.includes(roleOf(id)))) continue;
    if (windows.some((w) => w.room === id)) continue;
    const X = side.endsWith('x'), lo = X ? r.y0 : r.x0, hi = X ? r.y1 : r.x1;
    // (the stretches the room's openings on that wall leave, a body's width off its corners and off each doorway)
    const taken = (r.openings?.[side] ?? []).map((o) => [o.lo - 0.6, o.hi + 0.6]).sort((a, b) => a[0] - b[0]);
    let best = null, at = lo + 0.6;
    for (const [a, b] of [...taken, [hi - 0.6, hi - 0.6]]) { if (a - at > (best ? best[1] - best[0] : 0)) best = [at, a]; at = Math.max(at, b); }
    if (!best || best[1] - best[0] < 1.2) continue;
    const w = Math.min(W.width, best[1] - best[0] - 0.2), m = (best[0] + best[1]) / 2, wlo = r3(m - w / 2), whi = r3(m + w / 2);
    // (and the corridor's wall: the same span is free there, or no window)
    if ((C.openings?.[FLIP[side]] ?? []).some((o) => o.lo < whi + 0.3 && o.hi > wlo - 0.3)) continue;
    windows.push({ room: id, corridor: c, side, lo: wlo, hi: whi, sill: W.sill, top: W.top });
    holes.push({ room: id, side, lo: wlo, hi: whi, top: W.top, sill: W.sill }, { room: c, side: FLIP[side], lo: wlo, hi: whi, top: W.top, sill: W.sill });
    // (its pane a barrier through the wall's thickness, from its sill to its head; the wall's line the room's box edge)
    const line = side === '-x' ? (r.box ? r.box[0] : r.x0) : side === '+x' ? (r.box ? r.box[2] : r.x1) : side === '-y' ? (r.box ? r.box[1] : r.y0) : r.box ? r.box[3] : r.y1, t = wall / 2 + 0.02, z0 = r.z0 ?? 0;
    barriers.push(X ? { min: [r3(line - t), wlo, r3(z0 + W.sill)], max: [r3(line + t), whi, r3(z0 + W.top)], kind: 'glass', of: `window:${id}` } : { min: [wlo, r3(line - t), r3(z0 + W.sill)], max: [whi, r3(line + t), r3(z0 + W.top)], kind: 'glass', of: `window:${id}` });
  }
  return { windows, holes, barriers };
}
