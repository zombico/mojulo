/**
 * A BAY'S GLASS (era/bay.js): windows in the walls that face out and a glazed booth on a tall room's floor, each pane's
 * look the construction catalog's glass as construction/glazing.js reads it (its colour, the share of the view it takes).
 *
 *   GLASS_GROUPS  the groups glass is drawn in, each its own opacity (scene-three: a group's first alpha is its own), all
 *                 out of the shadow occluders (era/stage.js); the PANES reflect by Fresnel in gen-7 (channels/form.js)
 *     stage:pane      clear glass          stage:wired     a register's other glass (wired, frosted)
 *     stage:frit      the manifestation band a walker sees glass by       stage:glint     a pane's two streaks (gen-6's reflection)
 *     stage:sky       the daylight beyond an outside window (self-lit, a gradient up it)
 *     stage:sunpatch  a window's light laid on the floor along the register's sun
 *   outsideSpans(r, rooms, F, side) → [[u0, u1]]   where a wall faces out: no room stands against it
 *   glazeOpening(out, F, u0, u1, z0, z1, G, S) → [[u0, u1, z0, z1]]   an opening glazed through the wall: its reveal (the
 *                 wall's half thickness, `G.reveal`), its frame at `G.line` (mullions at most `G.every` apart, head and sill
 *                 rails), a sill board inside, the panes, their glints, the sky at the wall's outer face. `S` the surfaces
 *                 { reveal, frame, sill, look (glassLook), group }
 *   sunPatches(out, F, panes, sun, inside) → n   each pane's light on the floor: its corners carried along the sun's
 *                 direction (`sun.el` its elevation, `sun.toward` where its light travels) down to the floor, where they all
 *                 land inside the room (`inside(x, y)`) and the sun comes in through this wall at all
 *   reveal(out, F, u0, u1, z0, z1, t, sf)   an opening's jambs, head and sill through the wall's thickness
 *   pane(cs, n, look, group) → a face   frit(out, a, U, len, z0, z1, n) dots in rows on a pane's plane
 *
 * Pure: no dice.
 */
import { P, r5, box, quad, onWall, hexRgb } from './geom.js';

export const GLASS_GROUPS = Object.freeze(['stage:glass', 'stage:pane', 'stage:wired', 'stage:frit', 'stage:glint', 'stage:sky', 'stage:sunpatch']);
export const PANE_GROUPS = Object.freeze(['stage:pane', 'stage:wired']);
const FRIT = { fill: '#f2f4f4', alpha: 0.62 }, GLINT = { fill: '#ffffff', alpha: 0.14 };

const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const bbox = (out, p, q, sf) => box(out, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], sf, sf.cell ?? 1);

export const pane = (cs, n, look, group, extra = {}) => ({ corners: cs.map(P), normal: n.map(r5), outNormal: n.map(r5), fill: look.fill, alpha: look.alpha, group, ...extra });

export function outsideSpans(r, rooms, F, side) {
  const b = r.box, alongX = side.endsWith('y'), line = side === '-x' ? b[0] : side === '+x' ? b[2] : side === '-y' ? b[1] : b[3];
  const against = (q) => (side === '-x' ? q.box[2] === line : side === '+x' ? q.box[0] === line : side === '-y' ? q.box[3] === line : q.box[1] === line);
  const toU = (v) => { const p = alongX ? [v, line] : [line, v]; return (p[0] - F.o[0]) * F.U[0] + (p[1] - F.o[1]) * F.U[1]; };
  const shut = (rooms || []).filter((q) => q !== r && q.box && against(q)).map((q) => {
    const lo = Math.max(alongX ? b[0] : b[1], alongX ? q.box[0] : q.box[1]), hi = Math.min(alongX ? b[2] : b[3], alongX ? q.box[2] : q.box[3]);
    const a = toU(lo), c = toU(hi);
    return [Math.min(a, c), Math.max(a, c)];
  }).filter(([a, c]) => c > a).sort((p, q) => p[0] - q[0]);
  const open = [];
  let u = 0;
  for (const [a, c] of shut) { if (a > u) open.push([u, Math.min(a, F.len)]); u = Math.max(u, c); }
  if (u < F.len) open.push([u, F.len]);
  return open.filter(([a, c]) => c - a > 0.05);
}

export function frit(out, a, U, len, z0, n) {
  // three rows of dots 40 mm on an 80 mm pitch, the band's middle at z0 + 0.06
  const d = 0.04, pitch = 0.08, m = Math.floor((len - 0.04) / pitch);
  for (let row = 0; row < 3; row++) for (let k = 0; k < m; k++) {
    const u = 0.04 + k * pitch + (row % 2) * pitch / 2, z = z0 + row * pitch * 0.75;
    if (u + d > len) continue;
    const p = add(a, mul(U, u));
    out.push(pane([[p[0], p[1], z], add([p[0], p[1], z], mul(U, d)), add([p[0], p[1], z + d], mul(U, d)), [p[0], p[1], z + d]], n, FRIT, 'stage:frit'));
  }
}

function glints(out, F, u0, u1, z0, z1, off, k) {
  const w = u1 - u0, h = z1 - z0, at = (u, z) => onWall(F, u, off, z), lean = 0.32 * w;
  for (const [s, sw] of [[0.18 + 0.12 * (k % 2), 0.09], [0.36 + 0.12 * (k % 2), 0.035]]) {
    const ua = u0 + s * w, b0 = z0 + 0.08 * h, b1 = z0 + 0.92 * h;
    out.push(pane([at(ua, b0), at(ua + sw * w, b0), at(ua + sw * w + lean, b1), at(ua + lean, b1)], F.N, GLINT, 'stage:glint'));
  }
}

/** An opening's reveal: the wall's thickness `t` round it, in the wall's own surface. */
export function reveal(out, F, u0, u1, z0, z1, t, sf) {
  const at = (u, o, z) => onWall(F, u, o, z), U = F.U;
  const sc = sf.scale, jamb = [[0, z0 / sc], [t / sc, z0 / sc], [t / sc, z1 / sc], [0, z1 / sc]], lintel = [[u0 / sc, 0], [u0 / sc, t / sc], [u1 / sc, t / sc], [u1 / sc, 0]];
  quad(out, [at(u0, 0, z0), at(u0, -t, z0), at(u0, -t, z1), at(u0, 0, z1)], U, sf, null, null, jamb);
  quad(out, [at(u1, 0, z0), at(u1, 0, z1), at(u1, -t, z1), at(u1, -t, z0)], mul(U, -1), sf, null, null, [jamb[0], jamb[3], jamb[2], jamb[1]]);
  quad(out, [at(u0, 0, z1), at(u0, -t, z1), at(u1, -t, z1), at(u1, 0, z1)], [0, 0, -1], sf, null, null, lintel);
  quad(out, [at(u0, 0, z0), at(u1, 0, z0), at(u1, -t, z0), at(u0, -t, z0)], [0, 0, 1], sf, null, null, [lintel[0], lintel[3], lintel[2], lintel[1]]);
}

export function glazeOpening(out, F, u0, u1, z0, z1, G, S) {
  const t = G.reveal, at = (u, o, z) => onWall(F, u, o, z), N = F.N;
  reveal(out, F, u0, u1, z0, z1, t, S.reveal);
  const L = G.line, m = G.mullion, n = Math.max(1, Math.ceil((u1 - u0) / G.every - 1e-6)), panes = [];
  bbox(out, at(u0, -L - m, z1 - m), at(u1, -L + m, z1), S.frame);
  bbox(out, at(u0, -L - m, z0), at(u1, -L + m, z0 + m), S.frame);
  for (let k = 0; k <= n; k++) { const u = u0 + ((u1 - u0) * k) / n, a = Math.max(u0, u - m / 2), b = Math.min(u1, u + m / 2); bbox(out, at(a, -L - m, z0 + m), at(b, -L + m, z1 - m), S.frame); }
  // the sill board inside, a hand's breadth into the room
  bbox(out, at(u0 - 0.05, -L + m, z0 - 0.03), at(u1 + 0.05, 0.06, z0), S.sill);
  for (let k = 0; k < n; k++) {
    const pa = u0 + ((u1 - u0) * k) / n + m / 2, pb = u0 + ((u1 - u0) * (k + 1)) / n - m / 2, za = z0 + m, zb = z1 - m;
    out.push(pane([at(pa, -L, za), at(pb, -L, za), at(pb, -L, zb), at(pa, -L, zb)], N, S.look, S.group));
    glints(out, F, pa, pb, za, zb, -L + 0.004, k);
    panes.push([pa, pb, za, zb]);
  }
  // the daylight beyond: the sky at the wall's outer face, brighter and bluer up it (a self-lit face: the bake leaves it)
  const sky = { corners: [at(u0, -t - 0.002, z0), at(u1, -t - 0.002, z0), at(u1, -t - 0.002, z1), at(u0, -t - 0.002, z1)].map(P), normal: N.map(r5), outNormal: N.map(r5),
    fill: G.sky.zenith, cornerFills: [G.sky.horizon, G.sky.horizon, G.sky.zenith, G.sky.zenith], group: 'stage:sky', emissive: hexRgb(G.sky.zenith), emissiveStrength: 1.4 };
  out.push(sky);
  return panes;
}

export function sunPatches(out, F, panes, sun, inside) {
  // (a sun at or under the horizon lays none: a seated building's sun is the land's, at its hour)
  if (!(sun.el > 2)) return 0;
  const el = (sun.el * Math.PI) / 180, h = Math.hypot(...sun.toward), tw = sun.toward.map((v) => v / h);
  if (tw[0] * F.N[0] + tw[1] * F.N[1] < 0.2) return 0;
  const d = [tw[0] * Math.cos(el), tw[1] * Math.cos(el), -Math.sin(el)], look = { fill: sun.color, alpha: sun.alpha };
  let n = 0;
  for (const [u0, u1, z0, z1] of panes) {
    const cs = [[u0, z0], [u1, z0], [u1, z1], [u0, z1]].map(([u, z]) => { const p = onWall(F, u, 0, z), k = p[2] / Math.sin(el); return [p[0] + d[0] * k, p[1] + d[1] * k, 0.006]; });
    if (!cs.every(([x, y]) => inside(x, y))) continue;
    // (wound to face up whichever way the wall's frame turns it)
    const cr = (cs[1][0] - cs[0][0]) * (cs[3][1] - cs[0][1]) - (cs[1][1] - cs[0][1]) * (cs[3][0] - cs[0][0]);
    out.push(pane(cr > 0 ? cs : [cs[0], cs[3], cs[2], cs[1]], [0, 0, 1], look, 'stage:sunpatch'));
    n++;
  }
  return n;
}

/**
 * A glazed booth in a corner of a tall room (a control room, a site office, a meeting pod): `o` its corner against the
 * walls, `ex` along the long wall, `ey` into the room. Its two room-facing sides glass between storefront mullions (over
 * a solid dado, or full height with a frit band where a walker could walk into it), a glazed door in the long side
 * standing open with a transom over it, a roof with a downlight under it, a desk against the end wall with its screens
 * lit toward the glass. `Bt` its numbers, `S` its surfaces { frame, dado, roof, desk, look, screen, light }.
 *   → { panes, marked, unmarked, seat }   (`marked` the panes whose foot is under `Bt.markBelow` and carry their band)
 */
export function booth(out, o, ex, ey, Bt, S) {
  const { w, d, h, m } = Bt, P3 = (x, y, z) => add(add(o, mul(ex, x)), add(mul(ey, y), [0, 0, z])), res = { panes: 0, marked: 0, unmarked: 0 };
  const dA1 = w - 0.6, dA0 = dA1 - Bt.door, foot = Bt.dado > 0 ? Bt.dado + m : m, top = h - Bt.head;
  // a glass side from a to b along `U` (local), split in panels at most `every`, `door` the [lo, hi] left open on it
  const side = (base, U, len, nrm, door) => {
    const at = (u, z) => add(base, add(mul(U, u), [0, 0, z])), bars = [[0, len]];
    if (door) { bars.length = 0; bars.push([0, door[0]], [door[1], len]); }
    bbox(out, add(at(0, top), add(mul(ex, -m / 2), mul(ey, -m / 2))), add(at(len, h), add(mul(ex, m / 2), mul(ey, m / 2))), S.frame);
    for (const [a, b] of bars) {
      const n = Math.max(1, Math.ceil((b - a) / Bt.every - 1e-6));
      if (Bt.dado > 0) { bbox(out, add(at(a, 0), add(mul(ex, -0.03), mul(ey, -0.03))), add(at(b, Bt.dado), add(mul(ex, 0.03), mul(ey, 0.03))), S.dado); bbox(out, add(at(a, Bt.dado), add(mul(ex, -m / 2), mul(ey, -m / 2))), add(at(b, Bt.dado + m), add(mul(ex, m / 2), mul(ey, m / 2))), S.frame); }
      for (let k = 0; k <= n; k++) { const u = a + ((b - a) * k) / n; bbox(out, add(at(u - m / 2, 0), add(mul(ex, -m / 2), mul(ey, -m / 2))), add(at(u + m / 2, top), add(mul(ex, m / 2), mul(ey, m / 2))), S.frame); }
      for (let k = 0; k < n; k++) {
        const pa = a + ((b - a) * k) / n + m / 2, pb = a + ((b - a) * (k + 1)) / n - m / 2;
        out.push(pane([at(pa, foot), at(pb, foot), at(pb, top), at(pa, top)], nrm, S.look, 'stage:pane'));
        res.panes++;
        if (foot < Bt.markBelow) { if (Bt.frit) { frit(out, add(at(pa, 0), mul(nrm, 0.004)), U, pb - pa, Bt.frit, nrm); res.marked++; } else res.unmarked++; }
      }
    }
    return at;
  };
  const atA = side(P3(0, d, 0), ex, w, ey, [dA0, dA1]);
  side(P3(w, 0, 0), ey, d, ex, null);
  // the door: a frameless leaf on its hinge at the opening's near post, swung out into the room; a transom over it
  const doorTop = Math.min(2.2, top - 0.3);
  bbox(out, add(atA(dA0, doorTop), mul(ey, -m / 2)), add(atA(dA1, doorTop + m), mul(ey, m / 2)), S.frame);
  out.push(pane([atA(dA0 + m / 2, doorTop + m), atA(dA1 - m / 2, doorTop + m), atA(dA1 - m / 2, top), atA(dA0 + m / 2, top)], ey, S.look, 'stage:pane'));
  res.panes++;
  const ang = (Bt.swing * Math.PI) / 180, lu = add(mul(ex, Math.cos(ang)), mul(ey, Math.sin(ang))), ln = add(mul(ex, -Math.sin(ang)), mul(ey, Math.cos(ang))), hinge = atA(dA0 + m / 2, 0), lw = Bt.door - m;
  const leaf = (u, z) => add(hinge, add(mul(lu, u), [0, 0, z]));
  out.push(pane([leaf(0, 0.02), leaf(lw, 0.02), leaf(lw, doorTop - 0.02), leaf(0, doorTop - 0.02)], ln, S.look, 'stage:pane'));
  if (Bt.frit) { frit(out, add(leaf(0, 0), mul(ln, 0.004)), lu, lw, Bt.frit, ln); res.marked++; } else res.unmarked++;
  res.panes++;
  for (const z of [0.02, doorTop - 0.12]) bbox(out, add(leaf(0, z), mul(ln, -0.012)), add(leaf(0.18, z + 0.1), mul(ln, 0.012)), S.frame);
  bbox(out, add(leaf(lw - 0.12, 0.75), mul(ln, 0.03)), add(leaf(lw - 0.09, 1.45), mul(ln, 0.06)), S.frame);
  // the roof, its downlight
  bbox(out, P3(-0.01, -0.01, h), P3(w + m / 2, d + m / 2, h + 0.12), S.roof);
  const c = P3(w / 2, d / 2, h - 0.004), q = (a, b) => add(c, add(mul(ex, a), mul(ey, b)));
  out.push({ corners: [q(-0.25, -0.25), q(-0.25, 0.25), q(0.25, 0.25), q(0.25, -0.25)].map(P), normal: [0, 0, -1], outNormal: [0, 0, -1], fill: S.light.fill, group: 'stage:lamp', emissive: hexRgb(S.light.fill), emissiveStrength: 2.5, glow: `0 0 12px 4px ${S.light.color}` });
  res.seat = { at: P(P3(w / 2, d / 2, h - 0.4)), n: [0, 0, -1], color: S.light.color, intensity: S.light.intensity, radius: S.light.radius, fixture: 'down' };
  // the desk against the end wall, its screens lit toward the glass
  bbox(out, P3(0.05, 0.35, 0), P3(0.8, d - 0.35, 0.74), S.desk);
  const ns = Math.max(1, Math.floor((d - 0.9) / 0.65));
  for (let k = 0; k < ns; k++) {
    const y0 = 0.45 + k * 0.65, s0 = P3(0.42, y0, 0.84), s1 = P3(0.42, y0 + 0.55, 0.84);
    bbox(out, add(s0, mul(ex, -0.04)), add(s1, [0, 0, 0.36]), S.dado);
    out.push({ corners: [add(s0, mul(ex, 0.002)), add(s1, mul(ex, 0.002)), add(add(s1, mul(ex, 0.002)), [0, 0, 0.34]), add(add(s0, mul(ex, 0.002)), [0, 0, 0.34])].map(P), normal: ex.map(r5), outNormal: ex.map(r5), fill: S.screen, group: 'stage:lamp', emissive: hexRgb(S.screen), emissiveStrength: 1.6 });
  }
  return res;
}
