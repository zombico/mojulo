/**
 * THE VISTA (docs/side-map-principles.md "The look"): what the camera sees behind a zone where its back is open, the
 * cheapest way a stage tells the player the scene has changed as they cross it. A zone's place names its vista (dress.js
 * SETTINGS: a place's `vista`), and the vista is a few LAYERS of simple 3D things stood at their depth behind the play,
 * each hazed toward the sky (or, inside, toward a lit far wall) the further back it stands, so the perspective camera gives
 * them their parallax for nothing. `wall` is the plain back wall, as a zone without a vista has always had: sometimes a
 * wall is right.
 *
 *   the LAYERS   each at its depth `x` (metres behind the lane, negative), its things one `kind` laid along the zone at
 *                `every` metres apart (a range, seeded), each `w` wide (metres, as the lane would read it) and `h` tall (a
 *                share of the frame's height, from the frame's foot), `tone` its brightness off the zone's own hue; laid
 *                in screen shares and grown by the depth's view (a far thing drawn as big as it must be to be seen at that
 *                share of the frame), wide enough to fill the frame wherever along the zone the camera stands
 *   the KINDS    tower (a block, its windows lit), stack (a chimney, its lip), tank (a drum and its cap), gantry (two legs
 *                and a beam), pipe (an upright run and its collars), peak (a mountain's face), column (a shaft, its base
 *                and its capital), arch (two columns and a lintel)
 *   the BACK     `sky` the cube's sky behind it all (outdoor vistas, seen through an open back); `far` a lit far wall at its
 *                depth (a hall's), its `tone` off the zone's hue: a ROOM, its things kept to the zone's length and its ends
 *                closed by side walls (scene.js), so a neighbour's opening never sees into it
 *   the LIFE     (docs/side-scroll-backgrounds.md) what makes a vista a place still running while the hero passes it, on
 *                its own dice so the layers stand where they stood: under the sky a horizon GLOW in bands behind the far
 *                layer (the dusk a skyline stands dark against: the vista's value pole, its things silhouettes); a BEACON
 *                on a tall thing's top that blinks (a tower's red, a gantry's amber), a mast on some towers; STEAM over a
 *                stack that drifts; a hall's far wall a row of lit clerestory windows. Each in its own group
 *                (`sidemap:vista-glow`, `-beacon`, `-steam`) so the page moves it (VISTA_MOTION, channels/ambient.js)
 *
 *   VISTAS                       the library (a new vista is a row; a new kind of thing a kind here)
 *   VISTA_IDS                    their names
 *   vistaOf(layout, dress, { seed?, horizon? }) → [{ zone, x, boxes: [{ x0, x1, s0, s1, z0, z1, fill, lit? }], far? }]
 *                                each zone's vista as boxes (front, top and ends drawn by scene.js), its far wall a box
 *                                one face deep; `lit` marks a window's light, kept as it is by the light pass
 *
 * Pure and deterministic: seeded dice (city/plan/dice.js streamOf), the same map the same vista.
 */
import { streamOf } from '../../city/plan/dice.js';

const L = (x, kind, every, w, h, tone, more = {}) => Object.freeze({ x, kind, every: Object.freeze(every), w: Object.freeze(w), h: Object.freeze(h), tone, ...more });
export const VISTAS = Object.freeze({
  // the plain back wall (scene.js), none of this
  wall: null,
  // a machine hall: drums and gantries before a lit far wall, pipes running up nearest
  hall: Object.freeze({ far: Object.freeze({ x: -17, tone: 0.42 }), haze: 0.5, layers: Object.freeze([
    L(-14, 'tank', [7, 11], [2.6, 3.8], [0.32, 0.5], 0.62),
    L(-10, 'gantry', [10, 15], [5, 8], [0.5, 0.66], 0.7),
    L(-6, 'pipe', [5, 8], [0.3, 0.45], [0.95, 1.1], 0.78),
  ]) }),
  // a works' yard under the sky: chimneys far off, tanks nearer, a crane's gantry nearest
  yard: Object.freeze({ sky: true, haze: 0.75, layers: Object.freeze([
    L(-80, 'stack', [9, 15], [1.2, 2], [0.5, 0.78], 0.5),
    L(-45, 'tank', [10, 16], [3, 4.5], [0.22, 0.34], 0.62),
    L(-22, 'gantry', [16, 24], [6, 9], [0.4, 0.55], 0.72),
  ]) }),
  // a city's towers, lit windows in the nearest
  skyline: Object.freeze({ sky: true, haze: 0.8, layers: Object.freeze([
    L(-95, 'tower', [3, 6], [3, 6], [0.35, 0.7], 0.5),
    L(-55, 'tower', [5, 9], [3.5, 6], [0.3, 0.55], 0.6),
    L(-28, 'tower', [8, 13], [4, 7], [0.22, 0.42], 0.7, { windows: true }),
  ]) }),
  // a range of peaks, the far one pale
  peaks: Object.freeze({ sky: true, haze: 0.8, layers: Object.freeze([
    L(-120, 'peak', [10, 18], [14, 22], [0.45, 0.7], 0.55),
    L(-60, 'peak', [12, 20], [10, 16], [0.3, 0.48], 0.65),
  ]) }),
  // a colonnade's columns and arches before a far wall
  colonnade: Object.freeze({ far: Object.freeze({ x: -24, tone: 0.38 }), haze: 0.5, layers: Object.freeze([
    L(-18, 'arch', [12, 16], [6, 8], [0.62, 0.75], 0.6),
    L(-9, 'column', [6, 9], [1, 1.4], [1, 1.1], 0.72),
  ]) }),
});
export const VISTA_IDS = Object.freeze(Object.keys(VISTAS));

const r3 = (v) => Math.round(v * 1000) / 1000;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => `#${c.map((v) => Math.round(255 * Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * t));
const tone = (h, k) => rgbHex(hexRgb(h).map((v) => v * k));
const WINDOW = Object.freeze({ warm: '#ffd88a', cool: '#9fe3ff' });
/** THE LIFE's measures: the glow's bands (each a share of the frame's height over the far layer's foot, and how far toward
 * the dusk), the dusk's colour; a beacon's size (m, at the lane's scale) and its colours; the steam's puffs over a stack;
 * how often a tower carries a beacon or a mast; a far wall's clerestory (its windows' height share and pitch) */
export const VISTA_LIFE = Object.freeze({
  glow: Object.freeze([[0.62, 0.12], [0.42, 0.26], [0.26, 0.42], [0.14, 0.58]]), dusk: '#ffb36b',
  beacon: Object.freeze({ size: 0.42, red: '#ff3b30', amber: '#ffb020', share: 0.55, mast: 0.35 }),
  steam: Object.freeze({ puffs: 4, colour: '#f2f4f7' }),
  clerestory: Object.freeze({ at: 0.72, h: 0.07, pitch: 3.2 }),
});
/** How the life moves on the page (channels/ambient.js): beacons blink, steam drifts and rises. */
export const VISTA_MOTION = Object.freeze({
  'sidemap:vista-beacon': Object.freeze({ depth: 0.85, beat: 1.7, duty: 0.4, spread: 2.3 }),
  'sidemap:vista-steam': Object.freeze({ amp: [0, 1.4, 0.9], period: 6.5, spread: 0.5, depth: 0.25, beat: 9 }),
});

/** Each zone's vista, as boxes at their depths. */
export function vistaOf(layout, dress, { seed = 1, horizon = '#9ab8d8' } = {}) {
  const LY = layout, W = LY.screen.width, H = LY.screen.height, C = LY.camera, out = [];
  for (const z of dress.zones) {
    const V = z.vista ? VISTAS[z.vista] : null;
    if (!V) continue;
    const Z = LY.zones[z.zone], lane = (Z.i ? LY.zones[Z.i - 1].exit : [0, 0])[1], zc = lane + C.lookH;
    const into = V.sky ? horizon : tone(z.key, 0.55), boxes = [], d = streamOf(seed, 'side-map-vista', `${z.zone}`), live = streamOf(seed, 'side-map-vista-life', `${z.zone}`);
    // (a depth's view: a thing at x seen f times the lane's size; its span the zone's, widened by what the frame sees there)
    const view = (x) => (C.dist - x) / C.dist;
    // (a ROOM, a vista with a far wall: its things kept to the zone's own length, closed at its ends by side walls, scene.js,
    // so the next zone's opening never looks into it; under the sky the span widens to fill the frame from anywhere in it)
    const room = !!V.far;
    const span = (x) => { if (room) return [Z.rect[0], Z.rect[1]]; const f = view(x); return [Z.rect[0] + W / 2 - (W / 2) * f - 2, Z.rect[1] - W / 2 + (W / 2) * f + 2]; };
    const at = (x, v) => zc + (lane + v * H - zc) * view(x), foot = (x) => at(x, -0.05);
    const haze = (x) => Math.min(0.92, (V.haze ?? 0.6) * (1 - Math.exp(x / 40)));
    const fillAt = (x, k) => mix(tone(z.key, k), into, haze(x));
    let far = null;
    if (V.far) {
      const [s0, s1] = span(V.far.x), f = view(V.far.x);
      far = { x0: V.far.x - 0.2, x1: V.far.x, s0: r3(s0), s1: r3(s1), z0: r3(zc - H * f), z1: r3(zc + H * f), fill: fillAt(V.far.x, V.far.tone) };
      // (its clerestory: a row of lit windows high along the far wall, the hall's light coming from somewhere)
      const Q = VISTA_LIFE.clerestory, qz = at(V.far.x, Q.at), qh = Q.h * H * f, qc = mix(WINDOW.warm, into, haze(V.far.x) * 0.6);
      for (let qs = s0 + Q.pitch * f * 0.5; qs < s1 - Q.pitch * f * 0.5; qs += Q.pitch * f) boxes.push({ x0: r3(V.far.x), x1: r3(V.far.x + 0.03), s0: r3(qs), s1: r3(qs + Q.pitch * f * 0.55), z0: r3(qz), z1: r3(qz + qh), fill: qc, lit: true });
    }
    // (under the sky, the GLOW: bands of dusk behind the far layer, low over its foot, so what stands before it is dark
    // against light)
    if (V.sky && V.layers.length) {
      const X = Math.min(...V.layers.map((Ly) => Ly.x - Math.max(0.6, 1.2 * view(Ly.x)))) - 2, [g0, g1] = span(X);
      VISTA_LIFE.glow.forEach(([v, k], i) => boxes.push({ x0: r3(X - 0.5 * i), x1: r3(X + 0.02 * i), s0: r3(g0), s1: r3(g1), z0: r3(foot(X)), z1: r3(at(X, v)), fill: mix(into, VISTA_LIFE.dusk, k), lit: true, group: 'sidemap:vista-glow' }));
    }
    for (const Ly of V.layers) {
      const f = view(Ly.x), [s0, s1] = span(Ly.x), fill = fillAt(Ly.x, Ly.tone), dark = fillAt(Ly.x, Ly.tone * 0.7), deep = Math.max(0.6, 1.2 * f);
      const box = (a0, b0, z0, z1, c = fill, lit = false) => { const a = room ? Math.max(a0, s0) : a0, b = room ? Math.min(b0, s1) : b0; if (b - a > 1e-3 && z1 - z0 > 1e-3) boxes.push({ x0: r3(Ly.x - deep), x1: r3(Ly.x), s0: r3(a), s1: r3(b), z0: r3(z0), z1: r3(z1), fill: c, ...(lit ? { lit: true } : {}) }); };
      const rnd = (r) => r[0] + (r[1] - r[0]) * d();
      // (a beacon on a thing's top, blinking; a mast under it on some towers)
      const Bc = VISTA_LIFE.beacon, nearest = Ly.x === Math.max(...V.layers.map((q) => q.x));
      const beacon = (cs, top, colour, mast = 0) => {
        const bw = Bc.size * Math.max(0.8, f * 0.6);
        if (mast) boxes.push({ x0: r3(Ly.x - 0.1), x1: r3(Ly.x), s0: r3(cs - bw * 0.12), s1: r3(cs + bw * 0.12), z0: r3(top), z1: r3(top + mast), fill: dark });
        boxes.push({ x0: r3(Ly.x + 0.02), x1: r3(Ly.x + 0.05), s0: r3(cs - bw / 2), s1: r3(cs + bw / 2), z0: r3(top + mast), z1: r3(top + mast + bw), fill: mix(colour, into, haze(Ly.x) * 0.3), lit: true, group: 'sidemap:vista-beacon' });
      };
      for (let s = s0 + rnd(Ly.every) * f * d(); s < s1; s += rnd(Ly.every) * f) {
        const w = rnd(Ly.w) * f, top = at(Ly.x, rnd(Ly.h)), z0 = foot(Ly.x), a = s - w / 2, b = s + w / 2;
        if (Ly.kind === 'tower') {
          box(a, b, z0, top);
          if (live() < Bc.share) beacon(s, top, Bc.red, live() < Bc.mast ? (top - z0) * 0.14 : 0);
          // (the middle layer's windows: fewer and dimmer than the nearest's, so the city is lived in at every depth)
          if (!Ly.windows && !nearest && live() < 0.5) { const ww = 0.35 * f, wh = 0.5 * f, gap = 1.6 * f; for (let wz = z0 + gap * 2; wz < top - gap; wz += gap) for (let ws = a + gap * 0.5; ws < b - gap * 0.5; ws += gap) if (live() < 0.22) boxes.push({ x0: r3(Ly.x), x1: r3(Ly.x + 0.03), s0: r3(ws), s1: r3(ws + ww), z0: r3(wz), z1: r3(wz + wh), fill: mix(WINDOW.warm, into, haze(Ly.x) * 0.75), lit: true }); }
          if (Ly.windows) { const ww = 0.35 * f, wh = 0.5 * f, gap = 1.1 * f, c = d() < 0.5 ? WINDOW.warm : WINDOW.cool;
            for (let wz = z0 + gap * 2; wz < top - gap; wz += gap) for (let ws = a + gap * 0.6; ws < b - gap * 0.6; ws += gap) if (d() < 0.55) boxes.push({ x0: r3(Ly.x), x1: r3(Ly.x + 0.03), s0: r3(ws), s1: r3(ws + ww), z0: r3(wz), z1: r3(wz + wh), fill: mix(c, into, haze(Ly.x) * 0.5), lit: true }); }
        } else if (Ly.kind === 'stack') {
          box(a, b, z0, top); box(a - w * 0.15, b + w * 0.15, top - w * 0.4, top, dark);
          // (its steam: puffs rising and widening off the lip, drifting; a beacon on every other one)
          const St = VISTA_LIFE.steam;
          for (let k = 0, pz = top; k < St.puffs; k++) { const pw = w * (0.9 + 0.45 * k), ph = pw * 0.7; boxes.push({ x0: r3(Ly.x - 0.4), x1: r3(Ly.x - 0.3 + 0.01 * k), s0: r3(s - pw / 2 + w * 0.3 * k), s1: r3(s + pw / 2 + w * 0.3 * k), z0: r3(pz), z1: r3(pz + ph), fill: mix(St.colour, into, Math.min(0.9, haze(Ly.x) + 0.15 * k)), lit: true, group: 'sidemap:vista-steam' }); pz += ph * 0.8; }
          if (live() < 0.5) beacon(s, top, Bc.red);
        }
        else if (Ly.kind === 'tank') { const cap = (top - z0) * 0.22; box(a, b, z0, top - cap); box(a + w * 0.12, b - w * 0.12, top - cap, top, dark); }
        else if (Ly.kind === 'gantry') { const leg = Math.max(0.3 * f, w * 0.06); box(a, a + leg, z0, top); box(b - leg, b, z0, top); box(a - leg, b + leg, top - leg * 1.4, top, dark); if (live() < Bc.share) beacon(live() < 0.5 ? a + leg / 2 : b - leg / 2, top, Bc.amber); }
        else if (Ly.kind === 'pipe') { box(a, b, z0, top); for (let cz = z0 + 1.5 * f; cz < top; cz += 2.4 * f) box(a - w * 0.25, b + w * 0.25, cz, cz + 0.18 * f, dark); }
        else if (Ly.kind === 'peak') { const steps = 5; for (let k = 0; k < steps; k++) { const t0 = k / steps, t1 = (k + 1) / steps, inset = (w / 2) * t0; box(a + inset, b - inset, z0 + (top - z0) * t0, z0 + (top - z0) * t1, k % 2 ? dark : fill); } }
        else if (Ly.kind === 'column') { box(a, b, z0, top); box(a - w * 0.25, b + w * 0.25, z0, z0 + w * 0.5, dark); box(a - w * 0.3, b + w * 0.3, top - w * 0.5, top, dark); }
        else if (Ly.kind === 'arch') { const leg = w * 0.16; box(a, a + leg, z0, top); box(b - leg, b, z0, top); box(a, b, top - leg * 1.3, top, dark); }
      }
    }
    out.push({ zone: z.zone, ...(V.sky ? { sky: true } : {}), ...(far ? { far } : {}), boxes });
  }
  return out;
}
