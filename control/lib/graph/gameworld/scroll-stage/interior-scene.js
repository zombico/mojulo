/**
 * THE INTERIOR, DRAWN (Blaze Gunner): a run inside a station or a facility (interior.js its plan) as the faces a scroll
 * stage's page draws, laid in screen axes and stood in the world by the view (frame.js toWorld), so the top view gets it
 * turned. The corridor is a box seen from its open side, as the side map's interiors are (side-map/scene.js), and every
 * change of height in it a RAMP: its floor and ceiling run as lines through the plan's knots (interior.js edges).
 *
 *   THE CUT       each wall's face toward the camera: the station's section, cut at the play plane, plated (the hull
 *                 kibble the fleet's capital ships wear, scene/channels/hull-kibble.js, its blocks the interior's), its
 *                 edge to the open BEVELLED and bare (no kibble), so the key catches it clean as it catches a hull's chine
 *   THE DECKS     the floor's top and the ceiling's underside, from the back of the corridor to the cut, in three bands
 *                 deeper into the station (each a little more enclosed), a lamp on each knot's stretch
 *   RIBS          the structure's frames, every other knot: a raised band round the corridor, over the decks and up the
 *                 back, their sides catching the light
 *   CONDUITS      a pipe along the back over the floor and under the ceiling, following their ramps
 *   the BACK      the corridor's far wall in bays, lamp strips on alternate bays, a station's windows out to the stars
 *                 (holes: the space layers show through, the stage's world beyond)
 *   BULKHEADS     the one square thing across the way: a slab plated as the cut, its tip marked (the facility's in
 *                 hazard stripes), a signal lamp on it
 *   HATCHES, SLOTS  a hatch's opening in the deck, its rim; the slot a crusher or a lock's leaf draws back into, dark
 *                 through the deck and up the cut, warning lamps either side (red a crusher's, amber a lock's); a lock's
 *                 frame on the back (the movers' bodies are the page's, on their rule: worlds/controllable/scroll-foes.js)
 *   the HULL      the station's face where the run begins and ends, plated, its docking lights either side
 *   FOREGROUND    struts in front of the play, dark, sliding past fastest (the side map's girders), a lit edge each
 *
 * LIT AS THE SHIP IS (car-designer/form-light.js SPACE_MOOD, the cast rig, scene/channels/cast-rig.js): one key from the
 * stage's star (the sky's sun, the ship's own key), the galaxy's faint sky over the dark as the fill, a cool fresnel
 * rim where a face turns from the eye, toned by the rig's curve (Khronos neutral), so a wall and the ship read as one
 * scene. Baked into each face (the stage's pages draw their colours as they are): its key by its facing, its fill and
 * its rim; a face inside the station ENCLOSED (its key and fill less the deeper it stands, the cut's lip shading it); the
 * look's lamps a little light of their own on what faces the corridor; the lamps themselves drawn bright (the page's
 * bloom takes them, and what is fired lights the walls it passes, the shot light).
 *
 *   INTERIOR_LOOK   the looks (a new look is a row): albedos { cut, deck, back, backBay, rib, pipe, trim, stripe? },
 *                   lamp, window? (a station's), strut, kibble levels { cut, deck, back, rib, bulkhead, hull }
 *   WALL_DEPTH      the slab's reach off the play plane: { front (toward the camera), back }, camera distances
 *   castBake(hex, n, toEye, rig, { enclosed?, glow? }) → the face's colour under the rig (n, toEye: world unit vectors)
 *   shipRig(view?, sun?)  → the rig: the space mood's light with its key from the stage's star (castBake's)
 *   layInterior(plan, cam, { view, seed?, sun? }) → { faces, kibble: { <block>: level }, report: { faces, windows, lamps,
 *                   ribs, struts } }
 *
 * Pure: seeded dice, the same plan the same faces.
 */
import { toWorld, SCROLL_VIEWS } from './frame.js';
import { streamOf } from '../../city/plan/dice.js';
import { SPACE_MOOD } from '../../car-designer/form-light.js';

const row = (o) => Object.freeze(o);
export const INTERIOR_LOOK = Object.freeze({
  // a station: light steel plate, a cyan that marks its lamps, windows out to the stars
  station: row({ cut: '#737c86', deck: '#7f8992', back: '#47515c', backBay: '#3f4852', rib: '#a3acb5', pipe: '#5f6d7a', trim: '#dde5ec', lamp: '#7fe8ff', window: true, strut: '#141a21',
    kibble: row({ cut: 0.5, deck: 0.4, back: 0.55, rib: 0.3, bulkhead: 0.5, hull: 0.7 }) }),
  // a facility: dark steel, rust-brown conduits, amber lamps, hazard stripes on what crosses the way
  facility: row({ cut: '#575c63', deck: '#6c7176', back: '#3b3f45', backBay: '#34383d', rib: '#7a8087', pipe: '#6b4a2e', trim: '#e0b020', stripe: '#1a1a1a', lamp: '#ffb347', window: false, strut: '#111214',
    kibble: row({ cut: 0.5, deck: 0.45, back: 0.5, rib: 0.35, bulkhead: 0.45, hull: 0.65 }) }),
});
export const WALL_DEPTH = Object.freeze({ front: 0.07, back: -0.3 });
const STRUT_DEPTH = 0.3, STRUT_EVERY = 1.3, BEVEL = 0.014, RIB = { every: 2, wide: 0.012, rise: 0.012 }, PIPE = { off: 0.09, size: 0.016 };
// (how enclosed a face inside the station stands: the cut open to the light, the decks less the deeper their band, the
// back most; the lamps' own light on what faces the corridor)
const ENCLOSED = { band: [0.85, 0.6, 0.4], back: 0.4 }, GLOW = 0.16;

const r3 = (v) => Math.round(v * 1000) / 1000;
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexLin = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const linHex = (c) => `#${c.map((v) => Math.round(Math.max(0, Math.min(1, srgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('')}`;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
// the rig's curve (Khronos PBR neutral, as the cast rig's shader tones a body on a painted page)
function neutral(c) {
  const start = 0.8 - 0.04, desat = 0.15, x = Math.min(...c), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let col = c.map((v) => v - off);
  const peak = Math.max(...col);
  if (peak < start) return col;
  const d = 1 - start, np = 1 - (d * d) / (peak + d - start);
  col = col.map((v) => (v * np) / peak);
  const g = 1 - 1 / (desat * (peak - np) + 1);
  return col.map((v) => v + (np - v) * g);
}

/** A face's colour under the rig (see the header): its albedo, its facing, the eye's way, how enclosed, a lamp's glow. */
export function castBake(hex, n, toEye, rig, { enclosed = 1, glow = null } = {}) {
  const a = hexLin(hex), kd = (Math.max(0, dot(n, rig.toLight)) * rig.keyIntensity * enclosed) / Math.PI;
  const h = 0.5 + 0.5 * n[2], hemi = rig.hemi.sky.map((s, i) => (rig.hemi.ground[i] + (s - rig.hemi.ground[i]) * h) * enclosed);
  const f = Math.pow(1 - Math.min(1, Math.abs(dot(n, toEye))), rig.rim.power) * rig.rim.strength;
  const g = glow ? hexLin(glow).map((v) => v * GLOW) : [0, 0, 0];
  return linHex(neutral(a.map((v, i) => v * (rig.key[i] * kd + hemi[i] + g[i]) + rig.rim.linear[i] * f)));
}

/** The ship's light on a stage (see the header): the space mood's, its key the stage's star (the side map's key: from
 *  behind the camera, over and ahead, where none is given). */
export function shipRig(view = 'side', sun = null) {
  const V = SCROLL_VIEWS[view], toLight = unit(sun ?? V.toward.map((t, i) => t * 0.6 + V.up[i] * 0.7 + V.along[i] * 0.35));
  const kp = Math.max(...SPACE_MOOD.key);
  return { toLight, key: SPACE_MOOD.key.map((v) => v / kp), keyIntensity: SPACE_MOOD.level * Math.min(1, kp), hemi: SPACE_MOOD.hemi, rim: SPACE_MOOD.rim };
}

/** The interior's faces (see the header). */
export function layInterior(plan, cam, { view = 'side', seed = 1, sun = null } = {}) {
  const V = SCROLL_VIEWS[view], K = INTERIOR_LOOK[plan.look] ?? INTERIOR_LOOK.station, C = cam.screen.across, A = cam.screen.along, rig = shipRig(view, sun);
  const dF = r3(WALL_DEPTH.front * cam.dist), dB = r3(WALL_DEPTH.back * cam.dist), depth = dF - dB;
  const faces = [], kibble = {}, report = { faces: 0, windows: 0, lamps: 0, ribs: 0, struts: 0 };
  const die = streamOf(seed, 'scroll-interior', 'dress'), E = plan.edges;
  const W = (p) => toWorld(view, p).map(r3), N = (n) => unit([0, 1, 2].map((k) => V.along[k] * n[0] + V.across[k] * n[1] + V.toward[k] * n[2]));
  const edgeAt = (u) => { for (let k = 1; k < E.length; k++) if (u <= E[k].u + 1e-9) { const a = E[k - 1], b = E[k], t = b.u - a.u > 1e-9 ? (u - a.u) / (b.u - a.u) : 0; return [a.lo + (b.lo - a.lo) * t, a.hi + (b.hi - a.hi) * t]; } return [E[E.length - 1].lo, E[E.length - 1].hi]; };
  const midAt = (u) => { for (let k = 1; k < E.length; k++) if (u <= E[k].u + 1e-9) { const a = E[k - 1], b = E[k], t = b.u - a.u > 1e-9 ? (u - a.u) / (b.u - a.u) : 0; return a.mid + (b.mid - a.mid) * t; } return E[E.length - 1].mid; };
  // a polygon from (u, v, d) corners facing n (screen axes), baked under the rig as the eye on the track sees it
  const poly = (pts, n, hex, block, { enclosed = 1, glow = null, lit = false } = {}) => {
    const w = pts.map(W), nw = N(n), c = pts.reduce((s, p) => s.map((x, k) => x + p[k] / pts.length), [0, 0, 0]), cw = W(c);
    const eye = unit(W([c[0], midAt(c[0]), cam.dist]).map((x, k) => x - cw[k]));
    const a = w[0], b = w[1], q = w[2], x = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], y = [q[0] - a[0], q[1] - a[1], q[2] - a[2]];
    const cr = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
    const group = `break:interior/${block}`;
    faces.push({ corners: dot(cr, nw) < 0 ? w.reverse() : w, normal: nw.map(r3), fill: lit ? hex : castBake(hex, nw, eye, rig, { enclosed, glow }), group, node: group.slice(6) });
    report.faces += 1;
  };
  const kb = (block, level) => { if (level > 0) kibble[`interior/${block}`] = level; return block; };
  // the open's edge normal between two knots (screen axes): the floor's up off it, the ceiling's down
  const normalOf = (a, b, side) => { const du = b.u - a.u, dv = side === 'floor' ? b.lo - a.lo : b.hi - a.hi, l = Math.hypot(du, dv) || 1, s = side === 'floor' ? 1 : -1; return [(-dv / l) * s, (du / l) * s, 0]; };
  const bevel = BEVEL * C, glow = K.lamp;

  for (let k = 1; k < E.length; k++) {
    const a = E[k - 1], b = E[k], si = b.section, kind = plan.sections[si].kind, R = plan.reach;
    if (b.u - a.u < 1e-6) continue;
    for (const side of ['floor', 'ceiling']) {
      const ea = side === 'floor' ? a.lo : a.hi, eb = side === 'floor' ? b.lo : b.hi, s = side === 'floor' ? -1 : 1, n = normalOf(a, b, side);
      const far = side === 'floor' ? Math.min(a.lo, b.lo) - R : Math.max(a.hi, b.hi) + R;
      // THE CUT: the section's plate, out from the bevel to past the frame
      poly([[a.u, ea + s * bevel, dF], [b.u, eb + s * bevel, dF], [b.u, far, dF], [a.u, far, dF]], [0, 0, 1], K.cut, kb(`cut-${si}`, K.kibble.cut));
      // its BEVEL to the open: half toward the camera, half the open's way, so the key catches it
      poly([[a.u, ea, dF - bevel], [b.u, eb, dF - bevel], [b.u, eb + s * bevel, dF], [a.u, ea + s * bevel, dF]], unit([n[0], n[1], 1]), K.trim, 'trim');
      // THE DECK: from the bevel back to the corridor's back, in three bands, each more enclosed
      const cuts = [dF - bevel, dF - bevel - depth * 0.25, dF - depth * 0.58, dB];
      for (let j = 0; j < 3; j++) poly([[a.u, ea, cuts[j + 1]], [b.u, eb, cuts[j + 1]], [b.u, eb, cuts[j]], [a.u, ea, cuts[j]]], n, K.deck, kb(`deck-${si}`, K.kibble.deck), { enclosed: ENCLOSED.band[j], glow });
      // a LAMP on each stretch: a bright bar set into the deck, a little off it into the open
      const lu = (a.u + b.u) / 2, lv = (ea + eb) / 2, half = (b.u - a.u) * 0.14, sl = (eb - ea) / (b.u - a.u), off = -s * 0.04;
      poly([[lu - half, lv - sl * half + off, dF - depth * 0.14], [lu + half, lv + sl * half + off, dF - depth * 0.14], [lu + half, lv + sl * half + off, dF - depth * 0.06], [lu - half, lv - sl * half + off, dF - depth * 0.06]], n, K.lamp, 'lamps', { lit: true });
      report.lamps += 1;
      // a CONDUIT along the back, over the floor and under the ceiling, following its ramp
      const po = -s * PIPE.off * C, ps = PIPE.size * C, d0 = dB + 0.6, d1 = d0 + ps;
      poly([[a.u, ea + po, d1], [b.u, eb + po, d1], [b.u, eb + po - s * ps, d1], [a.u, ea + po - s * ps, d1]], [0, 0, 1], K.pipe, kb(`rib-${si}`, K.kibble.rib), { enclosed: ENCLOSED.back + 0.2, glow });
      poly([[a.u, ea + po - s * ps, d0], [b.u, eb + po - s * ps, d0], [b.u, eb + po - s * ps, d1], [a.u, ea + po - s * ps, d1]], n, K.pipe, kb(`rib-${si}`, K.kibble.rib), { enclosed: ENCLOSED.back + 0.3, glow });
    }
    // THE BACK: a bay a stretch, a lamp strip on alternate bays, a station's window in its halls and its core
    const bay = k % 2 ? K.backBay : K.back, win = K.window && (kind === 'hall' || kind === 'core') && k % 4 === 2;
    const blk = kb(`back-${si}`, K.kibble.back), o = { enclosed: ENCLOSED.back, glow };
    const at = (u, f) => { const t = (u - a.u) / (b.u - a.u), lo = a.lo + (b.lo - a.lo) * t, hi = a.hi + (b.hi - a.hi) * t; return lo + (hi - lo) * f; };
    if (win) {
      const u0 = a.u + (b.u - a.u) * 0.2, u1 = b.u - (b.u - a.u) * 0.2;
      poly([[a.u, a.lo - 0.5, dB], [u0, at(u0, 0) - 0.5, dB], [u0, at(u0, 1) + 0.5, dB], [a.u, a.hi + 0.5, dB]], [0, 0, 1], bay, blk, o);
      poly([[u1, at(u1, 0) - 0.5, dB], [b.u, b.lo - 0.5, dB], [b.u, b.hi + 0.5, dB], [u1, at(u1, 1) + 0.5, dB]], [0, 0, 1], bay, blk, o);
      poly([[u0, at(u0, 0) - 0.5, dB], [u1, at(u1, 0) - 0.5, dB], [u1, at(u1, 0.3), dB], [u0, at(u0, 0.3), dB]], [0, 0, 1], bay, blk, o);
      poly([[u0, at(u0, 0.7), dB], [u1, at(u1, 0.7), dB], [u1, at(u1, 1) + 0.5, dB], [u0, at(u0, 1) + 0.5, dB]], [0, 0, 1], bay, blk, o);
      // its frame, set toward the camera
      for (const [f0, f1] of [[0.28, 0.3], [0.7, 0.72]]) poly([[u0, at(u0, f0), dB + 0.5], [u1, at(u1, f0), dB + 0.5], [u1, at(u1, f1), dB + 0.5], [u0, at(u0, f1), dB + 0.5]], [0, 0, 1], K.trim, blk, o);
      report.windows += 1;
    } else poly([[a.u, a.lo - 0.5, dB], [b.u, b.lo - 0.5, dB], [b.u, b.hi + 0.5, dB], [a.u, a.hi + 0.5, dB]], [0, 0, 1], bay, blk, o);
    if (k % 2 === 0) for (const f of [0.9, 0.1]) {
      const x0 = a.u + (b.u - a.u) * 0.15, x1 = b.u - (b.u - a.u) * 0.15;
      poly([[x0, at(x0, f) - 0.5, dB + 0.4], [x1, at(x1, f) - 0.5, dB + 0.4], [x1, at(x1, f) + 0.5, dB + 0.4], [x0, at(x0, f) + 0.5, dB + 0.4]], [0, 0, 1], K.lamp, 'lamps', { lit: true });
      report.lamps += 1;
    }
  }
  // ── RIBS: the frames round the corridor every other knot, raised over the decks and up the back ──
  for (let k = 1; k < E.length - 1; k++) {
    if (k % RIB.every !== 0) continue;
    const q = E[k], si = q.section, w = RIB.wide * C, h = RIB.rise * C, blk = kb(`rib-${si}`, K.kibble.rib), u0 = q.u - w / 2, u1 = q.u + w / 2;
    for (const side of ['floor', 'ceiling']) {
      const e = side === 'floor' ? q.lo : q.hi, s = side === 'floor' ? 1 : -1, top = e + s * h;
      poly([[u0, top, dB], [u1, top, dB], [u1, top, dF - bevel], [u0, top, dF - bevel]], [0, s, 0], K.rib, blk, { enclosed: 0.75, glow });
      poly([[u0, e, dB], [u0, top, dB], [u0, top, dF - bevel], [u0, e, dF - bevel]], [-1, 0, 0], K.rib, blk, { enclosed: 0.7 });
      poly([[u1, e, dB], [u1, top, dB], [u1, top, dF - bevel], [u1, e, dF - bevel]], [1, 0, 0], K.rib, blk, { enclosed: 0.7 });
      poly([[u0, e, dF - bevel], [u1, e, dF - bevel], [u1, top, dF - bevel], [u0, top, dF - bevel]], [0, 0, 1], K.rib, blk, { enclosed: 0.9 });
    }
    // (up the back: a pilaster between them, standing off the bay)
    poly([[u0, q.lo + h, dB + h], [u1, q.lo + h, dB + h], [u1, q.hi - h, dB + h], [u0, q.hi - h, dB + h]], [0, 0, 1], K.rib, blk, { enclosed: ENCLOSED.back + 0.15, glow });
    report.ribs += 1;
  }
  // ── BULKHEADS: a slab across the way, plated, its tip marked, a signal lamp on it ──
  for (const w of plan.walls.filter((x) => x.role === 'bulkhead')) {
    const fromTop = w.from === 'ceiling', tip = fromTop ? w.v0 : w.v1, s = fromTop ? 1 : -1, blk = kb(`bulkhead-${w.section}`, K.kibble.bulkhead);
    const n = Math.max(2, Math.round(Math.abs(w.v1 - w.v0) / (C * 0.05)));
    for (let j = 0; j < n; j++) {
      const v0 = w.v0 + ((w.v1 - w.v0) * j) / n, v1 = w.v0 + ((w.v1 - w.v0) * (j + 1)) / n, fill = K.stripe && Math.abs((fromTop ? v0 : v1) - tip) < C * 0.25 ? (j % 2 ? K.stripe : K.trim) : K.cut;
      poly([[w.u0, v0, dF], [w.u1, v0, dF], [w.u1, v1, dF], [w.u0, v1, dF]], [0, 0, 1], fill, blk);
    }
    poly([[w.u0, w.v0, dB], [w.u0, w.v1, dB], [w.u0, w.v1, dF], [w.u0, w.v0, dF]], [-1, 0, 0], K.cut, blk, { enclosed: 0.8, glow });
    poly([[w.u1, w.v0, dB], [w.u1, w.v1, dB], [w.u1, w.v1, dF], [w.u1, w.v0, dF]], [1, 0, 0], K.cut, blk, { enclosed: 0.8, glow });
    poly([[w.u0, tip, dB], [w.u1, tip, dB], [w.u1, tip, dF], [w.u0, tip, dF]], [0, -s, 0], K.trim, blk, { enclosed: 0.85 });
    const mu = (w.u0 + w.u1) / 2;
    poly([[mu - 0.8, tip - s * 0.05, dF - 3], [mu + 0.8, tip - s * 0.05, dF - 3], [mu + 0.8, tip - s * 0.05, dF - 1], [mu - 0.8, tip - s * 0.05, dF - 1]], [0, -s, 0], '#ff3b30', 'lamps', { lit: true });
    report.lamps += 1;
  }
  // ── what moves and what opens: each sets its place in the wall (the movers' bodies are the page's, on their rule) ──
  const slot = '#07090c', deckAt = (u, side) => { const o = edgeAt(u); return side === 'floor' ? o[0] : o[1]; };
  // a HATCH: a dark opening in the deck, its rim in the trim (the facility's striped)
  for (const h of plan.hatches || []) {
    const s = h.side === 'floor' ? 1 : -1, w = plan.step * 0.18, u0 = h.u - w, u1 = h.u + w, e0 = deckAt(u0, h.side) + s * 0.05, e1 = deckAt(u1, h.side) + s * 0.05, n = [0, s, 0];
    poly([[u0, e0, dF - depth * 0.5], [u1, e1, dF - depth * 0.5], [u1, e1, dF - depth * 0.1], [u0, e0, dF - depth * 0.1]], n, K.stripe ?? K.trim, 'trim', { enclosed: 0.8 });
    poly([[u0 + 1, e0 + s * 0.05, dF - depth * 0.46], [u1 - 1, e1 + s * 0.05, dF - depth * 0.46], [u1 - 1, e1 + s * 0.05, dF - depth * 0.14], [u0 + 1, e0 + s * 0.05, dF - depth * 0.14]], n, slot, 'slots', { lit: true });
  }
  // a MOVER's slot: where a crusher or a lock's leaf draws back, dark through the deck and up the cut, warning lamps either side
  for (const m of plan.movers || []) {
    const s = m.from === 'floor' ? 1 : -1, e0 = deckAt(m.u0, m.from) + s * 0.05, e1 = deckAt(m.u1, m.from) + s * 0.05, n = [0, s, 0];
    poly([[m.u0, e0, dB], [m.u1, e1, dB], [m.u1, e1, dF - bevel], [m.u0, e0, dF - bevel]], n, slot, 'slots', { lit: true });
    const far = e0 - s * m.reach;
    poly([[m.u0, far, dF + 0.05], [m.u1, far, dF + 0.05], [m.u1, e1, dF + 0.05], [m.u0, e0, dF + 0.05]], [0, 0, 1], slot, 'slots', { lit: true });
    for (const u of [m.u0 - 1.6, m.u1 + 0.4]) { poly([[u, e0 + s * 0.06, dF - 4], [u + 1.2, e0 + s * 0.06, dF - 4], [u + 1.2, e0 + s * 0.06, dF - 1.5], [u, e0 + s * 0.06, dF - 1.5]], n, m.kind === 'lock' ? '#ffcc33' : '#ff3b30', 'lamps', { lit: true }); report.lamps += 1; }
  }
  // a LOCK's frame on the back: two posts in the trim either side of its leaves
  for (const m of (plan.movers || []).filter((x) => x.kind === 'lock' && x.from === 'ceiling')) {
    const o = edgeAt((m.u0 + m.u1) / 2), w = plan.step * 0.05;
    for (const u of [m.u0 - w * 1.4, m.u1 + w * 0.4]) poly([[u, o[0], dB + 0.6], [u + w, o[0], dB + 0.6], [u + w, o[1], dB + 0.6], [u, o[1], dB + 0.6]], [0, 0, 1], K.trim, 'trim', { enclosed: ENCLOSED.back + 0.2, glow });
  }
  // ── the HULL's face where the run begins and ends, plated, its docking lights ──
  for (const [u, n, q] of [[plan.u0, -1, E[0]], [plan.u1, 1, E[E.length - 1]]]) {
    const blk = kb('hull', K.kibble.hull);
    poly([[u, q.hi, dB], [u, q.hi + plan.reach, dB], [u, q.hi + plan.reach, dF], [u, q.hi, dF]], [n, 0, 0], K.cut, blk, { enclosed: 0.9 });
    poly([[u, q.lo - plan.reach, dB], [u, q.lo, dB], [u, q.lo, dF], [u, q.lo - plan.reach, dF]], [n, 0, 0], K.cut, blk, { enclosed: 0.9 });
    for (const [v, hue] of [[q.hi + C * 0.02, '#ff3b30'], [q.lo - C * 0.02, '#3bff6a']]) { poly([[u + n * 0.3, v - 1.2, dF - 3], [u + n * 0.3, v + 1.2, dF - 3], [u + n * 0.3, v + 1.2, dF - 0.6], [u + n * 0.3, v - 1.2, dF - 0.6]], [n, 0, 0], hue, 'lamps', { lit: true }); report.lamps += 1; }
  }
  // ── FOREGROUND: struts in front of the play, a screen and a third apart (jittered), the frame's height and more ──
  const dS = STRUT_DEPTH * cam.dist, grow = (cam.dist - dS) / cam.dist, wide = C * 0.016;
  for (let u = plan.u0 + A * STRUT_EVERY * (0.3 + die() * 0.4); u < plan.u1; u += A * STRUT_EVERY * (0.8 + die() * 0.4)) {
    const mid = midAt(u), half = (C / 2) * grow * 1.3;
    poly([[u - wide / 2, mid - half, dS], [u + wide / 2, mid - half, dS], [u + wide / 2, mid + half, dS], [u - wide / 2, mid + half, dS]], [0, 0, 1], K.strut, 'struts', { enclosed: 0.25 });
    poly([[u - wide / 2, mid - half, dS + 0.05], [u - wide / 2 + wide * 0.18, mid - half, dS + 0.05], [u - wide / 2 + wide * 0.18, mid + half, dS + 0.05], [u - wide / 2, mid + half, dS + 0.05]], unit([-0.6, 0, 0.8]), K.rib, 'struts', { enclosed: 0.5 });
    report.struts += 1;
  }
  return { faces, kibble, report };
}
