/**
 * THE FLEET'S BUILDER — a capital ship or a station (fleet/classes.js) laid out as PIECES, boxes each a part with a role
 * (fleet/language.js ROLES), and drawn in the fleet's language: every face plated with its seams, each plate its own
 * tone, an accent band along a hull, windows in lit decks, the drive's nozzles glowing, hazard round a bay, running
 * lights at the extremities, soot aft. Every piece is a block destructible physics (rupa) breaks by its matter: a hull
 * module a steel shell, an armour plate welded on by its side (stripped, not broken), a truss thin steel, a radiator
 * aluminium, the reactor's casing armour; its faces are its block's, so what breaks takes its faces with it.
 *
 *   buildCapital(cls, { seed?, look? }) → { kind, label, pieces, faces, hardpoints, lights }   in its own frame (x the
 *                bow, y port, z up, its middle at the origin); a class with a `form` is one shape (fleet/forms.js)
 *   buildStation(kind, { seed?, look? }) → the same for a station (z its axis)
 *   placeFleet(piece, { at, heading?, id }) → { blocks, faces, colliders, hardpoints, core, anchor, bounds }   in the
 *                world: rotated by a quarter-turn heading (0 | 90 | 180 | 270°: rupa's blocks are boxes on the world's
 *                axes), each piece a block `<id>/<piece>` with its matter (rupa/matter.js blockMatter), its faces in its
 *                block's break group (`break:<id>/<piece>`), shaded under the map's star
 *
 * Pure: the same class and seed, the same ship.
 */
import { CAPITAL_CLASSES, STATION_KINDS } from './classes.js';
import { FLEET_LOOKS, ROLES, LIGHTS, KIBBLE_SCALE, shade } from './language.js';
import { blockMatter } from '../rupa/matter.js';
import { mulberry32, strHash } from '../city/plan/dice.js';
import { buildForm } from './forms.js';

const r2 = (v) => Math.round(v * 100) / 100;
const PLATE = { hull: 8, bow: 7, armour: 6, core: 5, drive: 6, tower: 4, tank: 6, hab: 5, deck: 8, turret: 3 };
const SEAM = 0.18;

function tint(hex, k) { return '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join(''); }

// a rectangle on a box's face: its axis k, its side s (±1), the plane, u and v ranges (the other two axes, cyclic), as
// corners wound to face out
function rect(k, s, at, u0, u1, v0, v1, off = 0) {
  const u = (k + 1) % 3, v = (k + 2) % 3, p = (a, b) => { const c = [0, 0, 0]; c[k] = at + s * off; c[u] = a; c[v] = b; return c; };
  const q = [p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)];
  return s > 0 ? q : q.reverse();
}
const normal = (k, s) => { const n = [0, 0, 0]; n[k] = s; return n; };

/** The pieces' faces: each face plated (seams dark under plates of its role's size, each plate's tone off its
 *  neighbours'), the accent band, the windows, the soot; a truss as its chords and braces; a radiator's fins. */
function pieceFaces(P, look, rnd, ctx) {
  const out = [], push = (corners, n, color, lit = false, id = P.id) => out.push({ corners, n, color, lit, piece: id });
  const size = [0, 1, 2].map((k) => P.max[k] - P.min[k]);
  if (P.role === 'truss') {
    // chords along its long axis, braces across its faces: an open frame (its block still a box for physics)
    const L = size.indexOf(Math.max(...size)), a = (L + 1) % 3, b = (L + 2) % 3, t = Math.max(0.4, Math.min(size[a], size[b]) * 0.12);
    for (const ca of [P.min[a], P.max[a] - t]) for (const cb of [P.min[b], P.max[b] - t]) {
      const mn = [0, 0, 0], mx = [0, 0, 0]; mn[L] = P.min[L]; mx[L] = P.max[L]; mn[a] = ca; mx[a] = ca + t; mn[b] = cb; mx[b] = cb + t;
      out.push(...boxFaces({ id: P.id, min: mn, max: mx }, look.trim));
    }
    const bay = Math.max(size[a], size[b]), n = Math.max(1, Math.round(size[L] / bay));
    for (let i = 0; i < n; i++) {
      const l0 = P.min[L] + (i * size[L]) / n, l1 = P.min[L] + ((i + 1) * size[L]) / n;
      for (const [k, s] of [[a, 1], [a, -1], [b, 1], [b, -1]]) {
        const at = s > 0 ? P.max[k] : P.min[k], o = k === a ? b : a, w = t * 0.7, v0 = P.min[o], v1 = P.max[o];
        // (a diagonal brace as a thin quad from one corner of the bay to the other)
        const c = (l, vv) => { const q = [0, 0, 0]; q[k] = at; q[L] = l; q[o] = vv; return q; };
        const d = i % 2 ? [c(l0, v0), c(l0 + w, v0), c(l1, v1 - 0), c(l1 - w, v1)] : [c(l0, v1), c(l0 + w, v1), c(l1, v0), c(l1 - w, v0)];
        push(s > 0 ? d : d.slice().reverse(), normal(k, s), look.trim);
      }
    }
    return out;
  }
  const P0 = PLATE[P.role] ?? 6, soot = ctx.sootX;
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    const u = (k + 1) % 3, v = (k + 2) % 3, at = s > 0 ? P.max[k] : P.min[k], n = normal(k, s);
    const U0 = P.min[u], U1 = P.max[u], V0 = P.min[v], V1 = P.max[v];
    // (the seams: the face's dark under its plates)
    push(rect(k, s, at, U0, U1, V0, V1, -0.02), n, look.dark);
    // (the plates: in courses along the face's longer side, each course's plates of uneven length and staggered as
    // brickwork, so the joints never line up into a grid; a few service panels darker, a few vents slotted)
    const long = (U1 - U0) >= (V1 - V0), A0 = long ? U0 : V0, A1 = long ? U1 : V1, B0 = long ? V0 : U0, B1 = long ? V1 : U1;
    const nc = Math.max(1, Math.round((B1 - B0) / P0));
    const base = P.role === 'armour' || P.role === 'core' || P.role === 'turret' ? look.trim : P.role === 'radiator' ? look.dark : look.base;
    const plate = (a0, a1, b0, b1, c) => push(long ? rect(k, s, at, a0, a1, b0, b1) : rect(k, s, at, b0, b1, a0, a1), n, c);
    for (let j = 0; j < nc; j++) {
      const b0 = B0 + ((B1 - B0) * j) / nc + SEAM, b1 = B0 + ((B1 - B0) * (j + 1)) / nc - SEAM;
      let a = A0 + (j % 2 ? -P0 * (0.3 + 0.4 * rnd()) : 0);
      while (a < A1) {
        const len = P0 * (0.6 + rnd() * 1.1), a0 = Math.max(A0, a) + SEAM, a1 = Math.min(A1, a + len) - SEAM;
        a += len;
        if (a1 - a0 < 0.6) continue;
        let c = tint(base, 1 + (rnd() * 2 - 1) * look.vary);
        const r = rnd();
        if (r < 0.06) c = tint(look.trim, 0.85);                     // (a service panel)
        const xMid = (long ? u : v) === 0 ? (a0 + a1) / 2 : (long ? v : u) === 0 ? (b0 + b1) / 2 : at;
        if (soot !== undefined && xMid < soot + 18) c = tint(c, 0.62 + 0.38 * Math.min(1, Math.max(0, (xMid - soot) / 18)));
        plate(a0, a1, b0, b1, c);
        if (r > 0.95 && a1 - a0 > 2.5) for (let q = 0; q < 4; q++) { const m0 = a0 + 0.4 + q * 0.5; plate(m0, m0 + 0.22, b0 + 0.4, b1 - 0.4, look.dark); }   // (a vent's slots)
      }
    }
    // (the accent band: a thin stripe along a hull's sides, never more than a tenth of it)
    if ((P.role === 'hull' || P.role === 'deck') && k === 1 && P.band !== undefined) {
      const zb = P.band, xs = [P.min[0], P.max[0]];
      push(rect(k, s, at, zb - 0.9, zb + 0.9, xs[0], xs[1], 0.04), n, look.accent);
    }
    // (its frames: a rib round a hull module's forward end, standing proud of it, as the yard welded it)
    if ((P.role === 'hull' || P.role === 'deck' || P.role === 'core') && k !== 0) {
      const x0 = P.max[0] - 1.6, x1 = P.max[0] - 0.2, o = 0.5;
      if (k === 1) push(rect(k, s, at, P.min[2], P.max[2], x0, x1, o), n, tint(look.trim, 1.05));
      else push(rect(k, s, at, x0, x1, P.min[1], P.max[1], o), n, tint(look.trim, 1.05));
    }
    // (on a top: the small detail, conduits along it and boxes on it, the third size, seen only near)
    if (k === 2 && s > 0 && (P.role === 'hull' || P.role === 'deck' || P.role === 'hab' || P.role === 'drive' || P.role === 'core')) {
      const area = (U1 - U0) * (V1 - V0), nb = Math.min(14, Math.round(area / 90));
      for (let g = 0; g < nb; g++) {
        const w = 1 + rnd() * 3.5, d = 1 + rnd() * 3.5, h = 0.6 + rnd() * 2, cx = U0 + w + rnd() * Math.max(0, U1 - U0 - 2 * w), cy = V0 + d + rnd() * Math.max(0, V1 - V0 - 2 * d);
        out.push(...boxFaces({ id: P.id, min: [cx - w / 2, cy - d / 2, at], max: [cx + w / 2, cy + d / 2, at + h] }, tint(rnd() < 0.5 ? look.trim : look.base, 0.92 + rnd() * 0.12)));
      }
      // (a conduit run its length, off its centreline)
      const yo = V0 + (V1 - V0) * (0.2 + rnd() * 0.6);
      out.push(...boxFaces({ id: P.id, min: [P.min[0] + 0.5, yo - 0.45, at], max: [P.max[0] - 0.5, yo + 0.45, at + 0.9] }, look.trim));
    }
    // (a radiator's fins: dark lines along its chord, both faces)
    if (P.role === 'radiator' && k === 2) for (let f = 1; f < 10; f++) { const y = U0 + ((U1 - U0) * f) / 10; push(rect(k, s, at, y - 0.25, y + 0.25, V0, V1, 0.03), n, look.trim); }
    // (windows: lit decks along a hull's or a habitat's side, a tower's front; some dark)
    if (P.windows && (k === 1 || (P.role === 'tower' && k === 0 && s > 0))) {
      const along = k === 1 ? 0 : 1, rows = Math.max(1, Math.floor((P.max[2] - P.min[2]) / 7)), step = 3.2;
      for (let row = 0; row < rows; row++) {
        const z = P.min[2] + ((row + 0.6) * (P.max[2] - P.min[2])) / (rows + 0.2);
        for (let x = P.min[along] + 2; x < P.max[along] - 2; x += step) {
          if (rnd() < 0.38) continue;
          const c = (aa, zz) => { const q = [0, 0, 0]; q[k] = at + s * 0.05; q[along] = aa; q[2] = zz; return q; };
          const w = [c(x, z), c(x + 1.4, z), c(x + 1.4, z + 0.8), c(x, z + 0.8)];
          push(s > 0 ? (k === 1 ? w : w.slice().reverse()) : (k === 1 ? w.slice().reverse() : w), n, tint(LIGHTS.window, 0.75 + rnd() * 0.25), true);
        }
      }
    }
  }
  return out;
}
// a plain box's six faces in one colour (a chord, a barrel, a nozzle's ring)
function boxFaces(B, color, lit = false) {
  const out = [];
  for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
    const u = (k + 1) % 3, v = (k + 2) % 3;
    out.push({ corners: rect(k, s, s > 0 ? B.max[k] : B.min[k], B.min[u], B.max[u], B.min[v], B.max[v]), n: normal(k, s), color, lit, piece: B.id });
  }
  return out;
}

/** A capital ship's pieces and its faces in its own frame. */
export function buildCapital(cls, { seed = 1, look } = {}) {
  const C = CAPITAL_CLASSES[cls];
  if (!C) throw new Error(`fleet: '${cls}' is not a capital ship's class (${Object.keys(CAPITAL_CLASSES).join(', ')})`);
  // (a form: one shape, fleet/forms.js)
  if (C.form) return buildForm(cls, C, { seed, look });
  const L0 = FLEET_LOOKS[look ?? C.look] ?? FLEET_LOOKS.navy, rnd = mulberry32(strHash(`capital|${cls}|${seed}`));
  const pieces = [], hard = [], lights = [], extra = [];
  const add = (id, role, min, max, o = {}) => { const p = { id, role, min: min.map(r2), max: max.map(r2), ...o }; pieces.push(p); return p; };
  const total = C.sections.reduce((s, x) => s + x.len, 0);
  let x = -total / 2, driveEnd = null, coreIds = [];
  const secs = [];
  for (const [si, sec] of C.sections.entries()) {
    const x0 = x, x1 = x + sec.len, hw = sec.w / 2, hh = sec.h / 2;
    secs.push({ ...sec, x0, x1 });
    if (sec.kind === 'bow') {
      // the bow: stepped in, each step narrower and lower, as a yard plates a taper
      const n = sec.steps || 3;
      for (let i = 0; i < n; i++) { const a = x0 + (sec.len * i) / n, b = x0 + (sec.len * (i + 1)) / n, f = 1 - (0.55 * (i + 1)) / n; add(`bow${i}`, 'bow', [a, -hw * f, -hh * (0.55 + 0.45 * f)], [b, hw * f, hh * f], { band: -hh * 0.1 }); }
    } else if (sec.kind === 'spine') {
      add(`spine`, 'truss', [x0, -hw, -hh], [x1, hw, hh]);
      // (its tanks either side, in a row)
      if (sec.tanks) { const n = Math.max(2, Math.round(sec.len / 18)); for (let i = 0; i < n; i++) for (const sy of [1, -1]) { const a = x0 + (sec.len * i) / n + 1, b = x0 + (sec.len * (i + 1)) / n - 1; add(`tank${i}${sy > 0 ? 'p' : 's'}`, 'tank', [a, sy > 0 ? hw : -hw - 10, -5], [b, sy > 0 ? hw + 10 : -hw, 5]); } }
    } else {
      // a run of modules of the class's length; a wide section split across, so a blow takes a half, not the beam
      const role = sec.kind === 'drive' ? 'drive' : sec.kind === 'core' ? 'core' : sec.kind === 'hangar' ? 'deck' : 'hull';
      const nm = Math.max(1, Math.round(sec.len / C.module)), ny = sec.w > 56 ? 2 : 1;
      for (let i = 0; i < nm; i++) for (let j = 0; j < ny; j++) {
        const a = x0 + (sec.len * i) / nm, b = x0 + (sec.len * (i + 1)) / nm, y0 = -hw + (sec.w * j) / ny, y1 = -hw + (sec.w * (j + 1)) / ny;
        const p = add(`${sec.kind}${si}.${i}${ny > 1 ? (j ? 'p' : 's') : ''}`, role, [a, y0, -hh], [b, y1, hh], { band: -hh * 0.1, ...(sec.windows ? { windows: true } : {}) });
        if (role === 'core') coreIds.push(p.id);
      }
      if (sec.kind === 'drive') {
        driveEnd = x1;
        // the nozzles on its stern: a dark ring each round a glowing throat, in a grid
        const [na, nu] = sec.bells || [2, 1], bw = Math.min(sec.w / na, sec.h / nu) * 0.38;
        for (let i = 0; i < na; i++) for (let j = 0; j < nu; j++) {
          const cy = -hw + (sec.w * (i + 0.5)) / na, cz = -hh + (sec.h * (j + 0.5)) / nu;
          extra.push(...boxFaces({ id: `drive${si}.0${C.sections[si].w > 56 ? 's' : ''}`, min: [x0 - bw * 0.7, cy - bw, cz - bw], max: [x0, cy + bw, cz + bw] }, L0.dark));
          extra.push({ corners: rect(0, -1, x0 - bw * 0.7, cy - bw * 0.7, cy + bw * 0.7, cz - bw * 0.7, cz + bw * 0.7, 0.05), n: [-1, 0, 0], color: LIGHTS.drive, lit: true, piece: `drive${si}.0` });
        }
      }
      // an armour belt: plates welded along its sides in two rows, each its own block (stripped one by one)
      if (sec.belt) {
        const pw = 12, n = Math.max(1, Math.round(sec.len / pw)), t = 0.8;
        for (let i = 0; i < n; i++) for (const sy of [1, -1]) for (let row = 0; row < 2; row++) {
          const a = x0 + (sec.len * i) / n + 0.3, b = x0 + (sec.len * (i + 1)) / n - 0.3, z0 = -hh * 0.55 + row * hh * 0.55, z1 = z0 + hh * 0.5;
          add(`belt${si}.${i}${sy > 0 ? 'p' : 's'}${row}`, 'armour', [a, sy > 0 ? hw : -hw - t, z0], [b, sy > 0 ? hw + t : -hw, z1]);
        }
      }
      // a hangar's bay: its opening, hazard round it, its deck lit within
      if (sec.bay) extra.push(...bayFaces(sec, x0, x1, hw, hh, L0));
    }
    x = x1;
  }
  // the tower: command, high on the hull, levels stepping back
  const top = (at) => { const s = secs.find((q) => at >= q.x0 && at <= q.x1) || secs[secs.length - 1]; return s.h / 2; };
  if (C.tower) {
    const T = C.tower, cx = -total / 2 + total * T.at, z0 = top(cx);
    for (let i = 0; i < T.levels; i++) { const f = 1 - i * 0.22, lh = T.h / T.levels; add(`tower${i}`, 'tower', [cx - (T.len * f) / 2, (-T.w * f) / 2, z0 + i * lh], [cx + (T.len * f) / 2 - i * 2, (T.w * f) / 2, z0 + (i + 1) * lh], { windows: true }); }
    // (its sensor mast, a strobe on its tip)
    const mz = z0 + T.h, mh = T.h * 0.8;
    extra.push(...boxFaces({ id: `tower${T.levels - 1}`, min: [cx - 0.8, -0.8, mz], max: [cx + 0.8, 0.8, mz + mh] }, L0.trim));
    lights.push({ at: [cx, 0, mz + mh + 1], color: LIGHTS.strobe, piece: `tower${T.levels - 1}` });
  }
  // radiator wings off the drive (or its section): a strut and a thin fin each side, in pairs along it
  if (C.radiators) {
    const R = C.radiators, sec = secs[R.at], hw = sec.w / 2;
    for (let pr = 0; pr < R.pairs; pr++) for (const sy of [1, -1]) {
      const a = sec.x0 + 4 + pr * (R.chord + 4), b = Math.min(sec.x1 - 2, a + R.chord);
      add(`strut${pr}${sy > 0 ? 'p' : 's'}`, 'truss', [a + R.chord * 0.35, sy > 0 ? hw : -hw - 8, -1.5], [a + R.chord * 0.65, sy > 0 ? hw + 8 : -hw, 1.5]);
      const half = R.span / 2;
      for (let h = 0; h < 2; h++) add(`rad${pr}${sy > 0 ? 'p' : 's'}${h}`, 'radiator', [a, sy > 0 ? hw + 8 + h * half : -hw - 8 - (h + 1) * half, -0.3], [b, sy > 0 ? hw + 8 + (h + 1) * half : -hw - 8 - h * half, 0.3]);
    }
  }
  // turrets on its hardpoints: an armoured block and its twin barrels, the hardpoint where a gun is mounted
  for (const [i, T] of (C.turrets || []).entries()) {
    const cx = -total / 2 + total * T.at, s = secs.find((q) => cx >= q.x0 && cx <= q.x1) || secs[0], hw = s.w / 2 + (s.belt ? 0.8 : 0), hh = s.h / 2, sz = Math.max(4, s.h * 0.16);
    // (on the hull piece under it, welded to its face: a bow's steps are lower than its section's height)
    const under = pieces.filter((q) => (q.role === 'hull' || q.role === 'bow' || q.role === 'core' || q.role === 'deck' || q.role === 'drive') && cx >= q.min[0] && cx <= q.max[0] && q.min[1] <= 0 && q.max[1] >= 0);
    const zt = under.length ? Math.max(...under.map((q) => q.max[2])) : hh, zb = under.length ? Math.min(...under.map((q) => q.min[2])) : -hh;
    const box = T.on === 'top' ? [[cx - sz, -sz, zt], [cx + sz, sz, zt + sz * 0.7]] : T.on === 'bottom' ? [[cx - sz, -sz, zb - sz * 0.7], [cx + sz, sz, zb]]
      : T.on === 'port' ? [[cx - sz, hw, -sz * 0.6], [cx + sz, hw + sz * 0.7, sz * 0.6]] : [[cx - sz, -hw - sz * 0.7, -sz * 0.6], [cx + sz, -hw, sz * 0.6]];
    const p = add(`turret${i}`, 'turret', box[0], box[1]);
    const up = T.on === 'top' ? [0, 0, 1] : T.on === 'bottom' ? [0, 0, -1] : T.on === 'port' ? [0, 1, 0] : [0, -1, 0];
    const c = [0, 1, 2].map((k) => (p.min[k] + p.max[k]) / 2 + up[k] * (sz * 0.35 + 0.8));
    for (const off of [-0.35, 0.35]) extra.push(...boxFaces({ id: p.id, min: [c[0], c[1] + off * sz - 0.4 + (up[1] ? 0 : 0), c[2] - 0.4], max: [c[0] + sz * 1.6, c[1] + off * sz + 0.4, c[2] + 0.4] }, L0.dark));
    hard.push({ id: p.id, at: c.map(r2), up });
  }
  // running lights: red to port and green to starboard at the widest point aft, a strobe on the bow
  const wide = secs.reduce((a, b) => (b.w > a.w ? b : a)), bowX = total / 2;
  lights.push({ at: [wide.x0 + 2, wide.w / 2 + 0.2, 0], color: LIGHTS.port, piece: pieces.find((p) => p.min[0] <= wide.x0 + 2 && p.max[0] >= wide.x0 + 2 && p.max[1] >= wide.w / 2 - 1)?.id });
  lights.push({ at: [wide.x0 + 2, -wide.w / 2 - 0.2, 0], color: LIGHTS.starboard, piece: pieces.find((p) => p.min[0] <= wide.x0 + 2 && p.max[0] >= wide.x0 + 2 && p.min[1] <= -wide.w / 2 + 1)?.id });
  lights.push({ at: [bowX + 0.2, 0, 0], color: LIGHTS.strobe, piece: pieces.filter((p) => p.role === 'bow').pop()?.id });
  const faces = [...pieces.flatMap((p) => pieceFaces(p, L0, rnd, { sootX: driveEnd ?? undefined })), ...extra];
  return { kind: cls, label: C.label, length: total, pieces, faces, hardpoints: hard, lights, core: coreIds, anchor: coreIds };
}

// a bay's opening on a section's underside (ventral) or its bow end (fore): dark, its deck lit far in, hazard round it
function bayFaces(sec, x0, x1, hw, hh, look) {
  const out = [], id = `${sec.kind === 'hangar' ? 'hangar' : sec.kind}${''}`;
  const hz = (corners, n, i) => out.push({ corners, n, color: i % 2 ? '#1c1c1c' : LIGHTS.hazard, lit: false, piece: null });
  if (sec.bay === 'ventral') {
    const a = x0 + sec.len * 0.2, b = x1 - sec.len * 0.2, w = hw * 0.6;
    out.push({ corners: rect(2, -1, -hh, -w, w, a, b, 0.06), n: [0, 0, -1], color: '#0c0d0f', lit: true, piece: null });
    out.push({ corners: rect(2, -1, -hh, -w * 0.8, w * 0.8, a + 4, a + 7, 0.08), n: [0, 0, -1], color: LIGHTS.bay, lit: true, piece: null });
    const n = Math.round((b - a) / 3);
    for (let i = 0; i < n; i++) { const p0 = a + ((b - a) * i) / n, p1 = a + ((b - a) * (i + 1)) / n; for (const sy of [1, -1]) hz(rect(2, -1, -hh, sy > 0 ? w : -w - 1.5, sy > 0 ? w + 1.5 : -w, p0, p1, 0.07), [0, 0, -1], i); }
  } else {
    const w = hw * 0.7, h = hh * 0.6;
    out.push({ corners: rect(0, 1, x1, -w, w, -h, h, 0.06), n: [1, 0, 0], color: '#0c0d0f', lit: true, piece: null });
    out.push({ corners: rect(0, 1, x1, -w, w, -h, -h + 1.5, 0.08), n: [1, 0, 0], color: LIGHTS.bay, lit: true, piece: null });
    const n = Math.round((2 * w) / 3);
    for (let i = 0; i < n; i++) { const p0 = -w + (2 * w * i) / n, p1 = -w + (2 * w * (i + 1)) / n; hz(rect(0, 1, x1, p0, p1, h, h + 1.5, 0.07), [1, 0, 0], i); hz(rect(0, 1, x1, p0, p1, -h - 1.5, -h, 0.07), [1, 0, 0], i); }
  }
  return out.map((f) => ({ ...f, piece: f.piece ?? `@bay:${x0}` }));
}

/** A station's pieces and faces in its own frame (z its axis). */
export function buildStation(kind, { seed = 1, look } = {}) {
  const K = STATION_KINDS[kind];
  if (!K) throw new Error(`fleet: '${kind}' is not a station's kind (${Object.keys(STATION_KINDS).join(', ')})`);
  const L0 = FLEET_LOOKS[look ?? K.look] ?? FLEET_LOOKS.civil, rnd = mulberry32(strHash(`station|${kind}|${seed}`));
  const pieces = [], hard = [], lights = [], extra = [];
  const add = (id, role, min, max, o = {}) => { const p = { id, role, min: min.map(r2), max: max.map(r2), ...o }; pieces.push(p); return p; };
  let anchor = [], core = [];
  if (kind === 'outpost') {
    const c = K.column, hw = c.w / 2, n = Math.round(c.h / 28);
    for (let i = 0; i < n; i++) { const p = add(`column${i}`, i === Math.floor(n / 2) ? 'core' : 'hab', [-hw, -hw, -c.h / 2 + (c.h * i) / n], [hw, hw, -c.h / 2 + (c.h * (i + 1)) / n], { windows: true, band: 0 }); if (p.role === 'core') { core.push(p.id); anchor.push(p.id); } }
    // the habitat ring on its spokes at its waist: a square ring of modules (each side two, faces shared exactly) and a
    // spoke from the column to each side's middle
    const R = K.ring, Ro = R.r + R.w / 2, Ri = R.r - R.w / 2, zh = R.h / 2;
    for (const [i, [mn, mx]] of [
      [[-Ro, Ri, -zh], [0, Ro, zh]], [[0, Ri, -zh], [Ro, Ro, zh]], [[-Ro, -Ro, -zh], [0, -Ri, zh]], [[0, -Ro, -zh], [Ro, -Ri, zh]],
      [[Ri, -Ri, -zh], [Ro, 0, zh]], [[Ri, 0, -zh], [Ro, Ri, zh]], [[-Ro, -Ri, -zh], [-Ri, 0, zh]], [[-Ro, 0, -zh], [-Ri, Ri, zh]],
    ].entries()) add(`hab${i}`, 'hab', mn, mx, { windows: true });
    for (const [i, [dx, dy]] of [[1, 0], [-1, 0], [0, 1], [0, -1]].entries()) {
      add(`spoke${i}`, 'truss', [dx > 0 ? hw : dx < 0 ? -Ri : -3, dy > 0 ? hw : dy < 0 ? -Ri : -3, -3], [dx > 0 ? Ri : dx < 0 ? -hw : 3, dy > 0 ? Ri : dy < 0 ? -hw : 3, 3]);
    }
    // docking arms off the column's foot: a truss each, a berth at its end with hazard on its face, a light on its tip
    for (let i = 0; i < K.arms; i++) {
      const dx = [1, 0, -1, 0][i], dy = [0, 1, 0, -1][i], z = -c.h / 2 + 14, L = K.arm;
      add(`arm${i}`, 'truss', [dx > 0 ? hw : dx < 0 ? -hw - L : -3, dy > 0 ? hw : dy < 0 ? -hw - L : -3, z - 3], [dx > 0 ? hw + L : dx < 0 ? -hw : 3, dy > 0 ? hw + L : dy < 0 ? -hw : 3, z + 3]);
      const ex = dx * (hw + L), ey = dy * (hw + L);
      add(`berth${i}`, 'deck', [ex - 6 + dx * 6, ey - 6 + dy * 6, z - 6], [ex + 6 + dx * 6, ey + 6 + dy * 6, z + 6]);
      lights.push({ at: [ex + dx * 12.3, ey + dy * 12.3, z], color: i % 2 ? LIGHTS.port : LIGHTS.starboard, piece: `berth${i}` });
    }
    // arrays on masts above: a truss up, two radiator-panels wide across it
    for (let i = 0; i < K.arrays; i++) {
      const sy = i ? 1 : -1, z0 = c.h / 2;
      add(`mast${i}`, 'truss', [-3, sy > 0 ? hw : -hw - 40, z0 - 20], [3, sy > 0 ? hw + 40 : -hw, z0 - 14]);
      add(`array${i}`, 'radiator', [-30, sy > 0 ? hw + 40 : -hw - 100, z0 - 17.3], [30, sy > 0 ? hw + 100 : -hw - 40, z0 - 16.7]);
    }
    lights.push({ at: [0, 0, c.h / 2 + 1], color: LIGHTS.strobe, piece: `column${n - 1}` });
    for (const [i, a] of [0, 1, 2, 3].entries()) hard.push({ id: `column${n - 1}`, at: [Math.cos(a * Math.PI / 2) * (hw + 2), Math.sin(a * Math.PI / 2) * (hw + 2), c.h / 2 - 6].map(r2), up: [Math.cos(a * Math.PI / 2), Math.sin(a * Math.PI / 2), 0].map((v) => Math.round(v)) });
  } else if (kind === 'shipyard') {
    // the frame: its twelve edges as trusses in bays, each an anchor (the yard holds itself)
    const F = K.frame, hx = F.l / 2, hy = F.w / 2, hz = F.h / 2, b = F.beam, bays = (len) => Math.max(1, Math.round(len / 60));
    // (the corners are the long chords': the cross beams and the posts stop at their faces, so no two overlap)
    const beam = (id, axis, c0) => {
      const len = axis === 0 ? F.l : axis === 1 ? F.w : F.h, n = bays(len), e = axis === 0 ? b / 2 : -b / 2, L0 = -len / 2 - e, L1 = len / 2 + e;
      for (let i = 0; i < n; i++) {
        const mn = [c0[0] - b / 2, c0[1] - b / 2, c0[2] - b / 2], mx = [c0[0] + b / 2, c0[1] + b / 2, c0[2] + b / 2], lo = L0 + ((L1 - L0) * i) / n, hi = L0 + ((L1 - L0) * (i + 1)) / n;
        mn[axis] = lo; mx[axis] = hi;
        const p = add(`${id}.${i}`, 'truss', mn, mx); anchor.push(p.id);
      }
    };
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) beam(`fx${sy}${sz}`, 0, [0, sy * hy, sz * hz]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(`fy${sx}${sz}`, 1, [sx * hx, 0, sz * hz]);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) beam(`fz${sx}${sy}`, 2, [sx * hx, sy * hy, 0]);
    // cranes riding its top chords, a hook-block hanging from each
    for (let i = 0; i < K.cranes; i++) { const cx = -hx + (F.l * (i + 1)) / (K.cranes + 1); add(`crane${i}`, 'deck', [cx - 6, -hy - b / 2, hz + b / 2], [cx + 6, hy + b / 2, hz + b / 2 + 8]); lights.push({ at: [cx, hy + b + 0.2, hz + b / 2 + 4], color: LIGHTS.hazard, piece: `crane${i}` }); }
    // the berth: a frigate's hull, half plated, its drive not yet fitted
    const S = buildCapital(K.berth, { seed, look: 'civil' }), keep = S.pieces.filter((p) => p.role !== 'drive' && p.role !== 'radiator' && !p.id.startsWith('strut'));
    for (const p of keep) add(`berth:${p.id}`, p.role === 'hull' && rnd() < 0.35 ? 'truss' : p.role, p.min, p.max, { ...(p.windows ? { windows: false } : {}), band: p.band });
    core = keep.filter((p) => p.role === 'core').map((p) => `berth:${p.id}`);
    // (held in the frame by its cradle's clamps: its reactor's casing is anchored with the frame)
    anchor.push(...core);
  } else if (kind === 'platform') {
    // the core: an armoured shaft in courses, its middle the reactor; tiers of deck round it, turrets on every rim
    const c = K.core, hw = c.w / 2, n = Math.round(c.h / 22);
    for (let i = 0; i < n; i++) { const p = add(`core${i}`, i === Math.floor(n / 2) ? 'core' : 'armour', [-hw, -hw, -c.h / 2 + (c.h * i) / n], [hw, hw, -c.h / 2 + (c.h * (i + 1)) / n]); delete p.lateral; if (p.role === 'core') core.push(p.id); anchor.push(p.id); }
    for (let t = 0; t < K.tiers; t++) {
      const z0 = -c.h / 2 + 8 + t * (c.h - 16) / K.tiers, R = K.tierR * (1 - t * 0.18), h = K.tierH * 0.8;
      // (a tier: four slabs round the core, a square ring of deck, its rim's turrets)
      for (const [i, [a, b2]] of [[[hw, -R], [R, R]], [[-R, -R], [-hw, R]], [[-hw, hw], [hw, R]], [[-hw, -R], [hw, -hw]]].entries()) add(`tier${t}.${i}`, 'deck', [a[0], a[1], z0], [b2[0], b2[1], z0 + h], { windows: true });
      for (let k = 0; k < K.turretsPerRim; k++) {
        // (on the rim, clear of the core's corners where a tier is narrow)
        const ang = (2 * Math.PI * k) / K.turretsPerRim, rr = Math.max(R * 0.86, hw * Math.SQRT2 + 6), cx = Math.cos(ang) * rr, cy = Math.sin(ang) * rr;
        const p = add(`gun${t}.${k}`, 'turret', [cx - 3.5, cy - 3.5, z0 + h], [cx + 3.5, cy + 3.5, z0 + h + 3]);
        extra.push(...boxFaces({ id: p.id, min: [cx - 0.5, cy - 0.5, z0 + h + 3], max: [cx + Math.cos(ang) * 8 + 0.5, cy + Math.sin(ang) * 8 + 0.5, z0 + h + 4] }, L0.dark));
        hard.push({ id: p.id, at: [r2(cx), r2(cy), r2(z0 + h + 3.6)], up: [0, 0, 1] });
      }
    }
    // shield masts on top, a light each
    for (const sx of [-1, 1]) { add(`shield${sx > 0 ? 'p' : 's'}`, 'tower', [sx * 14 - 4, -4, c.h / 2], [sx * 14 + 4, 4, c.h / 2 + 26]); lights.push({ at: [sx * 14, 0, c.h / 2 + 26.5], color: LIGHTS.strobe, piece: `shield${sx > 0 ? 'p' : 's'}` }); }
  }
  const faces = [...pieces.flatMap((p) => pieceFaces(p, L0, rnd, {})), ...extra];
  return { kind, label: K.label, pieces, faces, hardpoints: hard, lights, core, anchor };
}

/** Into the world: a quarter-turn heading, each piece a block `<id>/<piece>` with its matter, its faces shaded under the
 *  star in its block's break group, the hardpoints and lights moved with it. */
export function placeFleet(B, { at = [0, 0, 0], heading = 0, id = B.kind } = {}) {
  const q = ((Math.round(heading / 90) % 4) + 4) % 4, rot = (p) => { let [x, y, z] = p; for (let i = 0; i < q; i++) [x, y] = [-y, x]; return [x, y, z]; };
  const P = (p) => { const r = rot(p); return [r2(r[0] + at[0]), r2(r[1] + at[1]), r2(r[2] + at[2])]; };
  const box = (mn, mx) => { const a = P(mn), b = P(mx); return { min: [0, 1, 2].map((k) => Math.min(a[k], b[k])), max: [0, 1, 2].map((k) => Math.max(a[k], b[k])) }; };
  const bid = (pid) => `${id}/${pid}`;
  const blocks = B.pieces.map((p) => { const b = box(p.min, p.max), R = ROLES[p.role] ?? ROLES.hull; return { id: bid(p.id), ...b, role: p.role, kibble: p.kibble ?? R.kibble ?? 0, ...(R.lateral ? { bond: 'lateral' } : {}), ...blockMatter(b, { matter: R.matter, fill: p.fill ?? R.fill }, `fleet ${id}.${p.id}`) }; });
  // (a face with no piece of its own, a bay's, goes with the block nearest its middle)
  const near = (c) => { let best = null, bd = Infinity; for (const p of B.pieces) { const d = Math.hypot(...[0, 1, 2].map((k) => Math.max(p.min[k] - c[k], 0, c[k] - p.max[k]))); if (d < bd) { bd = d; best = p.id; } } return best; };
  const faces = B.faces.map((f) => {
    const piece = f.piece && !String(f.piece).startsWith('@') && B.pieces.some((p) => p.id === f.piece) ? f.piece : near(f.corners.reduce((s, c) => s.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]));
    const n = rot(f.n);
    return { corners: f.corners.map(P), fill: f.lit ? f.color : shade(f.color, n), group: `break:${bid(piece)}`, ...(f.lit ? { lit: true } : {}) };
  });
  const lights = B.lights.map((l) => ({ at: P(l.at), color: l.color, group: `break:${bid(l.piece ?? near(l.at))}` }));
  const hardpoints = B.hardpoints.map((h) => ({ block: bid(h.id), at: P(h.at), up: rot(h.up) }));
  const lo = [0, 1, 2].map((k) => Math.min(...blocks.map((b) => b.min[k]))), hi = [0, 1, 2].map((k) => Math.max(...blocks.map((b) => b.max[k])));
  return { id, kind: B.kind, label: B.label, blocks, faces, lights, hardpoints, core: B.core.map(bid), anchor: B.anchor.map(bid), bounds: { min: lo, max: hi },
    colliders: blocks.map((b) => ({ id: b.id, min: b.min, max: b.max })) };
}

/** The placed ships and stations as a payload's destructible part: every block a breakable (its anchor said), every
 *  face with its block's node, each light a small lit cube in its block's group, and each block's kibble level (the
 *  page's hull-kibble channel). Not under destructible physics, the same faces stand as they are and the blocks as
 *  plain colliders. */
export function fleetPayload(placed, { physical = true } = {}) {
  const breakables = [], faces = [], colliders = [], kibble = {};
  for (const P of placed) {
    const anchors = new Set(P.anchor);
    for (const { kibble: kb, ...b } of P.blocks) {
      if (kb > 0) kibble[b.id] = kb;
      if (physical) breakables.push({ ...b, hp: 1, ...(anchors.has(b.id) ? { anchor: true } : {}) });
      else colliders.push({ min: b.min, max: b.max });
    }
    for (const f of P.faces) faces.push({ corners: f.corners, fill: f.fill, group: f.group, node: f.group.slice(6) });
    for (const l of P.lights) {
      const h = 0.7, B = { min: l.at.map((v) => v - h), max: l.at.map((v) => v + h) };
      for (let k = 0; k < 3; k++) for (const s of [1, -1]) {
        const u = (k + 1) % 3, v = (k + 2) % 3;
        faces.push({ corners: rect(k, s, s > 0 ? B.max[k] : B.min[k], B.min[u], B.max[u], B.min[v], B.max[v]), fill: l.color, group: l.group, node: l.group.slice(6) });
      }
    }
  }
  return { breakables, faces, colliders, ...(Object.keys(kibble).length ? { kibble: { scale: KIBBLE_SCALE, blocks: kibble } } : {}) };
}
