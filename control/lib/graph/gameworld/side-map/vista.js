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
 *                and its capital), arch (two columns and a lintel); and THE FUTURE'S: arcology (a tower under a dome, its
 *                window bands lit, a ring round its waist, a mast), dome (a glass dome on its podium, lit from inside),
 *                needle (a stalk under a saucer deck and its dome), piston (a cylinder whose rod pumps). A layer may carry
 *                `neon` (a sign down a building's side), `skyway` (a rail across the layer on pylons, a train running on
 *                it); a vista its `traffic` (lit craft drifting between the layers)
 *   the SET      (`set`) one giant thing a vista is built round, laid once at its zone's middle and animated: the
 *                `reactor`, the machine the plant makes, a wheel of spokes and a rim of lights turning about a core that
 *                pulses, an inner ring turning the other way (the page's ambient channel spins each about its hub)
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
/** the future's lit colours: its neon, its windows' glow, its domes' glass */
export const NEON = Object.freeze(['#ff3d9a', '#3df2ff', '#ffb43d', '#a46bff', '#5dff9a']);
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
  // THE FUTURE: a city of domed arcologies and needle towers under the night, a skyway and its train across the nearest
  // layer, craft drifting between, neon down the near buildings
  future: Object.freeze({ sky: true, haze: 0.72, traffic: 9, layers: Object.freeze([
    L(-100, 'arcology', [8, 14], [5, 9], [0.5, 0.88], 0.42),
    L(-62, 'needle', [16, 26], [6, 9], [0.45, 0.72], 0.52),
    L(-36, 'dome', [18, 28], [10, 15], [0.24, 0.4], 0.6),
    L(-24, 'arcology', [11, 17], [4, 6.5], [0.3, 0.56], 0.68, { windows: true, neon: true, skyway: true }),
  ]) }),
  // THE REACTOR: the machine the plant makes, a wheel taller than the frame turning in its hall, its core pulsing,
  // pistons pumping before it
  reactor: Object.freeze({ far: Object.freeze({ x: -30, tone: 0.34 }), haze: 0.45, set: Object.freeze({ kind: 'reactor', x: -21, h: 0.92 }), layers: Object.freeze([
    L(-12, 'piston', [8, 12], [1.5, 2.2], [0.45, 0.7], 0.72),
  ]) }),
  // (SEEDED from the rows above, docs/backdrop-variations.md) a NEON MARKET: towers crowded close, their windows lit and
  // billboards of neon on their faces, craft thick between
  market: Object.freeze({ sky: true, haze: 0.7, traffic: 14, layers: Object.freeze([
    L(-92, 'arcology', [7, 12], [4, 7], [0.45, 0.8], 0.4),
    L(-52, 'tower', [4, 7], [3.5, 6], [0.35, 0.62], 0.52, { windows: true, neon: true }),
    L(-26, 'tower', [6, 10], [4, 6.5], [0.2, 0.36], 0.64, { windows: true, neon: true }),
  ]) }),
  // ORBIT: no dusk but the stars, a planet rising under the window, a ring across it, a station's needles far off
  orbit: Object.freeze({ sky: true, glow: false, stars: 160, haze: 0.5, traffic: 5, set: Object.freeze({ kind: 'planet', x: -140, h: 1.5 }), layers: Object.freeze([
    L(-70, 'needle', [26, 40], [5, 8], [0.35, 0.6], 0.5),
  ]) }),
  // a GREENHOUSE: glass domes under a far wall, gardens growing in them, pipes feeding them
  greenhouse: Object.freeze({ far: Object.freeze({ x: -26, tone: 0.32 }), haze: 0.45, layers: Object.freeze([
    L(-18, 'dome', [12, 16], [8, 11], [0.38, 0.55], 0.6, { garden: true }),
    L(-8, 'pipe', [7, 10], [0.3, 0.45], [0.95, 1.1], 0.76),
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
/** How the life moves on the page (channels/ambient.js): beacons blink, steam drifts and rises, neon breathes, craft and
 * a skyway's train cross, a dome glows, a piston pumps, a reactor's core pulses (its wheels' spins are each vista's own:
 * a pivot a wheel, the vista's `motion`). */
export const VISTA_MOTION = Object.freeze({
  'sidemap:vista-beacon': Object.freeze({ depth: 0.85, beat: 1.7, duty: 0.4, spread: 2.3 }),
  'sidemap:vista-steam': Object.freeze({ amp: [0, 1.4, 0.9], period: 6.5, spread: 0.5, depth: 0.25, beat: 9 }),
  'sidemap:vista-neon': Object.freeze({ depth: 0.55, beat: 3.1, spread: 0.9 }),
  'sidemap:vista-traffic': Object.freeze({ amp: [0, 24, 0.8], period: 22, spread: 0.13 }),
  'sidemap:vista-train': Object.freeze({ amp: [0, 34, 0], period: 19 }),
  'sidemap:vista-dome': Object.freeze({ depth: 0.3, beat: 6, spread: 0.2 }),
  'sidemap:vista-piston': Object.freeze({ amp: [0, 0, 1.6], period: 2.4, spread: 1.4 }),
  'sidemap:vista-core': Object.freeze({ depth: 0.45, beat: 2.2, spread: 0 }),
  'sidemap:vista-stars': Object.freeze({ depth: 0.7, beat: 3.6, spread: 1.9 }),
  'sidemap:vista-garden': Object.freeze({ amp: [0, 0.08, 0.05], period: 4.2, spread: 0.7 }),
});
/** THE REACTOR's measures: its rim (a share of its radius) cut in segments and lit at `lights`; its spokes; its inner
 * ring; its core; how fast its wheel and its ring turn (radians a second, the ring the other way) */
export const REACTOR = Object.freeze({ rim: 0.84, segments: 28, lights: 14, spokes: 8, ring: Object.freeze([0.38, 0.5]), core: 0.24, turn: 0.2, counter: -0.34, glow: '#6ff7ff' });

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
    // (a shape drawn flat at its depth: a dome, a disc, a ring's segment, a spoke; its bounds kept for what reads a box)
    const motion = {};
    const shape = (x, pts, fill, { lit = false, group } = {}) => { const ss = pts.map((q) => q[0]), zz = pts.map((q) => q[1]); if (room && (Math.min(...ss) < Z.rect[0] - 1e-3 || Math.max(...ss) > Z.rect[1] + 1e-3)) return; boxes.push({ x0: r3(x), x1: r3(x), s0: r3(Math.min(...ss)), s1: r3(Math.max(...ss)), z0: r3(Math.min(...zz)), z1: r3(Math.max(...zz)), poly: pts.map(([a, b]) => [r3(a), r3(b)]), fill, ...(lit ? { lit: true } : {}), ...(group ? { group } : {}) }); };
    const arc = (cs, cz, r, h, a0, a1, n) => Array.from({ length: n + 1 }, (_, k) => { const a = a0 + ((a1 - a0) * k) / n; return [cs + r * Math.cos(a), cz + h * Math.sin(a)]; });
    const domeAt = (x, cs, cz, r, h, fill, opts) => shape(x, [...arc(cs, cz, r, h, 0, Math.PI, 14)], fill, opts);
    const discAt = (x, cs, cz, r, fill, opts) => shape(x, arc(cs, cz, r, r, 0, 2 * Math.PI * (17 / 18), 17), fill, opts);
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
    if (V.sky && V.glow !== false && V.layers.length) {
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
          // (a billboard of neon on its face: a lit panel and its frame)
          if (Ly.neon && live() < 0.55) { const bh = Math.min((top - z0) * 0.25, 2.2 * f), bz = z0 + (top - z0) * (0.45 + 0.3 * live()), c = NEON[Math.floor(live() * NEON.length)]; boxes.push({ x0: r3(Ly.x + 0.02), x1: r3(Ly.x + 0.04), s0: r3(a + w * 0.08), s1: r3(b - w * 0.08), z0: r3(bz - 0.1 * f), z1: r3(bz + bh + 0.1 * f), fill: dark, lit: true }); boxes.push({ x0: r3(Ly.x + 0.04), x1: r3(Ly.x + 0.07), s0: r3(a + w * 0.14), s1: r3(b - w * 0.14), z0: r3(bz), z1: r3(bz + bh), fill: mix(c, into, haze(Ly.x) * 0.3), lit: true, group: 'sidemap:vista-neon' }); }
          // (the middle layer's windows: fewer and dimmer than the nearest's, so the city is lived in at every depth)
          if (!Ly.windows && !nearest && live() < 0.5) { const ww = 0.35 * f, wh = 0.5 * f, gap = 1.6 * f; for (let wz = z0 + gap * 2; wz < top - gap; wz += gap) for (let ws = a + gap * 0.5; ws < b - gap * 0.5; ws += gap) if (live() < 0.22) boxes.push({ x0: r3(Ly.x), x1: r3(Ly.x + 0.03), s0: r3(ws), s1: r3(ws + ww), z0: r3(wz), z1: r3(wz + wh), fill: mix(WINDOW.warm, into, haze(Ly.x) * 0.75), lit: true }); }
          if (Ly.windows) { const ww = 0.35 * f, wh = 0.5 * f, gap = 1.1 * f, c = d() < 0.5 ? WINDOW.warm : WINDOW.cool;
            for (let wz = z0 + gap * 2; wz < top - gap; wz += gap) for (let ws = a + gap * 0.6; ws < b - gap * 0.6; ws += gap) if (d() < 0.55) boxes.push({ x0: r3(Ly.x), x1: r3(Ly.x + 0.03), s0: r3(ws), s1: r3(ws + ww), z0: r3(wz), z1: r3(wz + wh), fill: mix(c, into, haze(Ly.x) * 0.5), lit: true }); }
        } else if (Ly.kind === 'arcology') {
          // (a tower under a dome: its body, its dome and the dome's lit glass, a ring round its waist, its window bands, a
          // mast and its beacon)
          const r = w / 2, dh = Math.min(r * 0.9, (top - z0) * 0.22), body = top - dh, glow = mix(NEON[Math.floor(live() * NEON.length)], into, haze(Ly.x) * 0.55);
          box(a, b, z0, body);
          domeAt(Ly.x, s, body, r, dh, fill);
          domeAt(Ly.x + 0.02, s, body, r * 0.7, dh * 0.7, glow, { lit: true, group: 'sidemap:vista-dome' });
          const rz = z0 + (body - z0) * (0.5 + 0.2 * live());
          box(a - w * 0.14, b + w * 0.14, rz, rz + 0.35 * f, dark);
          const band = mix(live() < 0.5 ? WINDOW.cool : WINDOW.warm, into, haze(Ly.x) * 0.55);
          for (let wz = z0 + 1.4 * f; wz < body - 1.2 * f; wz += 1.35 * f) if (live() < (Ly.windows ? 0.6 : 0.35)) boxes.push({ x0: r3(Ly.x), x1: r3(Ly.x + 0.03), s0: r3(a + w * 0.12), s1: r3(b - w * 0.12), z0: r3(wz), z1: r3(wz + 0.22 * f), fill: band, lit: true });
          if (Ly.neon && live() < 0.6) { const ns = live() < 0.5 ? a + w * 0.06 : b - w * 0.16; boxes.push({ x0: r3(Ly.x + 0.03), x1: r3(Ly.x + 0.06), s0: r3(ns), s1: r3(ns + w * 0.1), z0: r3(z0 + (body - z0) * 0.25), z1: r3(z0 + (body - z0) * (0.55 + 0.2 * live())), fill: NEON[Math.floor(live() * NEON.length)], lit: true, group: 'sidemap:vista-neon' }); }
          beacon(s, top, Bc.red, live() < 0.6 ? dh * 0.8 : 0);
        } else if (Ly.kind === 'dome') {
          // (a glass dome on its podium, lit from inside, a spire on its crown)
          const pod = z0 + (top - z0) * 0.22, r = w / 2, glass = mix(NEON[1 + Math.floor(live() * 3)], into, haze(Ly.x) * 0.5);
          box(a - w * 0.05, b + w * 0.05, z0, pod, dark);
          domeAt(Ly.x, s, pod, r, top - pod, fill);
          domeAt(Ly.x + 0.02, s, pod, r * 0.88, (top - pod) * 0.86, glass, { lit: true, group: 'sidemap:vista-dome' });
          // (a garden under the glass: round crowns of green growing in it, stirring)
          if (Ly.garden) for (let k = 0; k < 4; k++) { const gs = s + (k - 1.5) * r * 0.42, gr = r * (0.16 + 0.08 * live()), gz = pod + gr * (0.9 + live()); discAt(Ly.x + 0.03, gs, gz, gr, mix(['#4fb36a', '#7fd06a', '#2f9a5a'][k % 3], into, haze(Ly.x) * 0.4), { lit: true, group: 'sidemap:vista-garden' }); }
          for (const k of [-0.5, 0, 0.5]) shape(Ly.x + 0.04, [[s + k * r * 0.88 - 0.08 * f, pod], [s + k * r * 0.88 + 0.08 * f, pod], [s + k * r * 0.3 + 0.05 * f, pod + (top - pod) * (0.95 - 0.35 * Math.abs(k))], [s + k * r * 0.3 - 0.05 * f, pod + (top - pod) * (0.95 - 0.35 * Math.abs(k))]], dark);
          beacon(s, top, Bc.red, (top - z0) * 0.12);
        } else if (Ly.kind === 'needle') {
          // (a stalk under a saucer deck, a dome on the deck, its rim lit)
          const st = Math.max(0.5 * f, w * 0.1), deck = top - (top - z0) * 0.16, dw = w / 2;
          box(s - st / 2, s + st / 2, z0, deck);
          shape(Ly.x, [[s - st, deck - (top - z0) * 0.05], [s + st, deck - (top - z0) * 0.05], [s + dw, deck], [s + dw * 0.9, deck + (top - deck) * 0.25], [s - dw * 0.9, deck + (top - deck) * 0.25], [s - dw, deck]], fill);
          boxes.push({ x0: r3(Ly.x + 0.02), x1: r3(Ly.x + 0.05), s0: r3(s - dw * 0.92), s1: r3(s + dw * 0.92), z0: r3(deck + 0.02 * f), z1: r3(deck + 0.12 * f), fill: mix(NEON[Math.floor(live() * NEON.length)], into, haze(Ly.x) * 0.4), lit: true, group: 'sidemap:vista-neon' });
          domeAt(Ly.x, s, deck + (top - deck) * 0.25, dw * 0.45, (top - deck) * 0.75, dark);
          beacon(s, top, Bc.red, (top - z0) * 0.06);
        } else if (Ly.kind === 'piston') {
          // (a cylinder whose rod pumps: its body standing, its rod and head a group the page moves)
          const body = z0 + (top - z0) * 0.55;
          box(a, b, z0, body, dark); box(a - w * 0.12, b + w * 0.12, body - 0.25 * f, body);
          boxes.push({ x0: r3(Ly.x - 0.2), x1: r3(Ly.x - 0.1), s0: r3(s - w * 0.14), s1: r3(s + w * 0.14), z0: r3(body), z1: r3(top), fill, group: 'sidemap:vista-piston' });
          boxes.push({ x0: r3(Ly.x - 0.1), x1: r3(Ly.x), s0: r3(a - w * 0.2), s1: r3(b + w * 0.2), z0: r3(top - 0.5 * f), z1: r3(top), fill: dark, group: 'sidemap:vista-piston' });
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
      // (a SKYWAY across the layer on its pylons, a train of lit cars running on it)
      if (Ly.skyway) {
        const kz = at(Ly.x, 0.42), th = 0.5 * f;
        boxes.push({ x0: r3(Ly.x + 0.3), x1: r3(Ly.x + 0.6), s0: r3(s0), s1: r3(s1), z0: r3(kz - th), z1: r3(kz), fill: dark });
        for (let ps = s0 + 9 * f * live(); ps < s1; ps += 14 * f) boxes.push({ x0: r3(Ly.x + 0.3), x1: r3(Ly.x + 0.55), s0: r3(ps), s1: r3(ps + 0.6 * f), z0: r3(foot(Ly.x)), z1: r3(kz - th), fill: dark });
        const mid = (s0 + s1) / 2, car = 3.2 * f;
        for (let k = 0; k < 4; k++) {
          const c0 = mid - 2 * car + k * (car + 0.25 * f);
          boxes.push({ x0: r3(Ly.x + 0.6), x1: r3(Ly.x + 0.8), s0: r3(c0), s1: r3(c0 + car), z0: r3(kz), z1: r3(kz + 1.1 * f), fill: tone(z.key, 1.15), group: 'sidemap:vista-train' });
          boxes.push({ x0: r3(Ly.x + 0.8), x1: r3(Ly.x + 0.83), s0: r3(c0 + car * 0.1), s1: r3(c0 + car * 0.9), z0: r3(kz + 0.5 * f), z1: r3(kz + 0.8 * f), fill: WINDOW.warm, lit: true, group: 'sidemap:vista-train' });
        }
      }
    }
    // (THE SET: one giant thing at the zone's middle, animated; the reactor a wheel turning about its core)
    if (V.set?.kind === 'reactor') {
      // (centred on the zone's opening as the camera sees it at the set's depth, a little larger than the opening shows: it
      // fills the frame and runs past it, the way a thing too big for the room does)
      const X = V.set.x, f = view(X), op = (LY.open ?? []).filter((o) => o.zone === z.zone), lo = op.length ? Math.min(...op.map((o) => o.z0)) : lane, hi = op.length ? Math.max(...op.map((o) => o.z1)) : lane + H;
      const cz = zc + ((lo + hi) / 2 - zc) * f, R = Math.min(((hi - lo) / 2) * f * V.set.h * 1.25, ((Z.rect[1] - Z.rect[0]) / 2) * 0.95), cs = (Z.rect[0] + Z.rect[1]) / 2, Rr = REACTOR;
      const metal = fillAt(X, 0.62), deepM = fillAt(X, 0.42), lamp = mix(Rr.glow, into, haze(X) * 0.3), wheel = `sidemap:vista-reactor-${z.zone}`, ring = `${wheel}-ring`;
      // (its housing behind it, a cradle under it)
      boxes.push({ x0: r3(X - 1.2), x1: r3(X - 0.6), s0: r3(cs - R * 1.12), s1: r3(cs + R * 1.12), z0: r3(cz - R * 1.12), z1: r3(cz + R * 1.12), fill: deepM });
      discAt(X - 0.3, cs, cz, R * 1.04, mix(deepM, '#000000', 0.35));
      boxes.push({ x0: r3(X - 0.5), x1: r3(X + 0.4), s0: r3(cs - R * 0.5), s1: r3(cs + R * 0.5), z0: r3(foot(X)), z1: r3(cz - R * 0.75), fill: deepM });
      // (the rim in segments, every other a shade darker, its lights; the spokes; all one wheel)
      for (let k = 0; k < Rr.segments; k++) {
        const a0 = (k / Rr.segments) * 2 * Math.PI, a1 = ((k + 1) / Rr.segments) * 2 * Math.PI, ri = R * Rr.rim;
        shape(X, [[cs + ri * Math.cos(a0), cz + ri * Math.sin(a0)], [cs + R * Math.cos(a0), cz + R * Math.sin(a0)], [cs + R * Math.cos(a1), cz + R * Math.sin(a1)], [cs + ri * Math.cos(a1), cz + ri * Math.sin(a1)]], k % 7 ? metal : mix(metal, '#ffffff', 0.18), { group: wheel });
      }
      for (let k = 0; k < Rr.lights; k++) { const a = (k / Rr.lights) * 2 * Math.PI, rl = R * (1 + Rr.rim) / 2, q = R * 0.028; shape(X + 0.03, [[cs + rl * Math.cos(a) - q, cz + rl * Math.sin(a) - q], [cs + rl * Math.cos(a) + q, cz + rl * Math.sin(a) - q], [cs + rl * Math.cos(a) + q, cz + rl * Math.sin(a) + q], [cs + rl * Math.cos(a) - q, cz + rl * Math.sin(a) + q]], lamp, { lit: true, group: wheel }); }
      for (let k = 0; k < Rr.spokes; k++) { const a = (k / Rr.spokes) * 2 * Math.PI, n = [-Math.sin(a), Math.cos(a)], hw = R * 0.055, r0 = R * Rr.ring[1], r1 = R * Rr.rim; shape(X - 0.05, [[cs + r0 * Math.cos(a) + n[0] * hw, cz + r0 * Math.sin(a) + n[1] * hw], [cs + r1 * Math.cos(a) + n[0] * hw, cz + r1 * Math.sin(a) + n[1] * hw], [cs + r1 * Math.cos(a) - n[0] * hw, cz + r1 * Math.sin(a) - n[1] * hw], [cs + r0 * Math.cos(a) - n[0] * hw, cz + r0 * Math.sin(a) - n[1] * hw]], metal, { group: wheel }); }
      // (the inner ring turning the other way, and the core that pulses)
      for (let k = 0; k < 12; k++) { const a0 = (k / 12) * 2 * Math.PI, a1 = a0 + (Math.PI / 12) * 1.6, [r0, r1] = Rr.ring.map((v) => v * R); shape(X + 0.05, [[cs + r0 * Math.cos(a0), cz + r0 * Math.sin(a0)], [cs + r1 * Math.cos(a0), cz + r1 * Math.sin(a0)], [cs + r1 * Math.cos(a1), cz + r1 * Math.sin(a1)], [cs + r0 * Math.cos(a1), cz + r0 * Math.sin(a1)]], k % 3 ? metal : lamp, { lit: k % 3 === 0, group: ring }); }
      discAt(X + 0.08, cs, cz, R * Rr.core, lamp, { lit: true, group: 'sidemap:vista-core' });
      discAt(X + 0.1, cs, cz, R * Rr.core * 0.55, mix(lamp, '#ffffff', 0.6), { lit: true, group: 'sidemap:vista-core' });
      motion[wheel] = { spin: { at: [r3(cs), r3(cz)], rate: Rr.turn } };
      motion[ring] = { spin: { at: [r3(cs), r3(cz)], rate: Rr.counter } };
    }
    // (THE PLANET: a world rising under the window at the set's depth, its night side toward the camera, its day's rim lit,
    // its air a band round it and a ring across it)
    if (V.set?.kind === 'planet') {
      const X = V.set.x, f = view(X), [t0, t1] = span(X), R = H * f * V.set.h * 0.5, cs = (Z.rect[0] + Z.rect[1]) / 2 + (t1 - t0) * 0.12, cz = foot(X) - R * 0.55;
      discAt(X - 0.6, cs, cz, R * 1.05, mix('#9fd8ff', into, 0.35), { lit: true });
      discAt(X, cs, cz, R, '#2c3f8a', { lit: true });
      discAt(X + 0.2, cs - R * 0.08, cz - R * 0.05, R * 0.93, '#1c2a5e', { lit: true });
      for (let k = 0; k < 4; k++) { const bz = cz + R * (0.15 + 0.2 * k); boxes.push({ x0: r3(X + 0.3), x1: r3(X + 0.32), s0: r3(cs - Math.sqrt(Math.max(0, R * R * 0.86 - (bz - cz) ** 2))), s1: r3(cs + Math.sqrt(Math.max(0, R * R * 0.86 - (bz - cz) ** 2))), z0: r3(bz), z1: r3(bz + R * 0.05), fill: '#3a56a8', lit: true }); }
      // (its ring: an ellipse in segments, across it)
      for (let k = 0; k < 36; k++) { const a0 = (k / 36) * 2 * Math.PI, a1 = ((k + 1) / 36) * 2 * Math.PI, ra = R * 1.7, rb = R * 0.22, w2 = R * 0.12; shape(X + 0.5, [[cs + ra * Math.cos(a0), cz + R * 0.35 + rb * Math.sin(a0)], [cs + (ra + w2) * Math.cos(a0), cz + R * 0.35 + (rb + w2 * 0.13) * Math.sin(a0)], [cs + (ra + w2) * Math.cos(a1), cz + R * 0.35 + (rb + w2 * 0.13) * Math.sin(a1)], [cs + ra * Math.cos(a1), cz + R * 0.35 + rb * Math.sin(a1)]], mix('#e0c890', into, 0.25), { lit: true }); }
    }
    // (stars over a vista with no dusk: lit points scattered high, twinkling)
    if (V.stars) {
      const X = Math.min(...V.layers.map((Ly) => Ly.x)) - 30, f = view(X), [t0, t1] = span(X);
      for (let k = 0; k < V.stars; k++) { const cs = t0 + (t1 - t0) * live(), cz = at(X, 0.1 + 1.1 * live()), q = (0.06 + 0.12 * live() ** 3) * f; boxes.push({ x0: r3(X), x1: r3(X + 0.02), s0: r3(cs - q), s1: r3(cs + q), z0: r3(cz - q), z1: r3(cz + q), fill: live() < 0.2 ? '#ffe6c4' : '#e8eeff', lit: true, group: 'sidemap:vista-stars' }); }
    }
    // (craft drifting between the layers, their lights lit)
    if (V.traffic) {
      const xs = V.layers.map((Ly) => Ly.x).sort((a, b) => a - b);
      for (let k = 0; k < V.traffic; k++) {
        const x = xs[0] + (xs[xs.length - 1] - xs[0]) * live(), f = view(x), [t0, t1] = span(x), cs = t0 + (t1 - t0) * live(), cz = at(x, 0.45 + 0.4 * live()), w = 0.9 * f;
        boxes.push({ x0: r3(x), x1: r3(x + 0.05), s0: r3(cs - w / 2), s1: r3(cs + w / 2), z0: r3(cz), z1: r3(cz + 0.3 * f), fill: mix(live() < 0.5 ? '#fff4d8' : '#ff5a4a', into, haze(x) * 0.3), lit: true, group: 'sidemap:vista-traffic' });
      }
    }
    out.push({ zone: z.zone, ...(V.sky ? { sky: true } : {}), ...(far ? { far } : {}), boxes, ...(Object.keys(motion).length ? { motion } : {}) });
  }
  return out;
}
