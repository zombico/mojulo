/**
 * THE MECHANISM KIT — a fabricator for what READS as working. fabricator/ and machina/ prove a thing works; this kit
 * proves a thing looks like it could, and that its parts read as one design.
 *
 * A MECHANISM is one topology: named parts in fixed places, the sockets it offers, the joints it turns on. A wheel
 * is a hub on its axle and a rim at its contact; a track is a drive sprocket at the rear, an idler at the front
 * (raised), road wheels on the ground and return rollers when they are small, wrapped in one belt. A DRESS restyles a
 * mechanism without moving its parts: what it is MADE of and how it is DRIVEN (a setting's words, never a date) pick
 * it, so a world tracks one wheel, and every wheel it shows is that wheel dressed.
 *
 * Every mechanism gives two things:
 *   CAGE    the triangles that ship: its silhouette and its joints, fitted to where it is designed to be seen
 *   DETAIL  bolts, lugs, grousers, tread: geometry kept for the bake (normals, occlusion, cavity), never shipped as
 *           triangles, unless it stands in the silhouette and the design camera resolves it: then it joins the cage
 *
 *   MADE, DRIVEN                 the setting's words a dress answers to
 *   MECHANISMS                   wheel, track: what each is, its parts, its dresses
 *   SETTING_BY_FINISH            the setting a finish implies, until the world says its own
 *   pickDress(mechanism, { setting, motif, dress?, on? }) → { dress, why, refused: [{ dress, why }] }   (on: 'ground' | 'rail')
 *   resolveMechanism(need, { setting, motif, fit, fitLen, smooth?, pxPerM, dress? })
 *     → { mechanism, dress, why, refused, cage: [monomer], detail: [monomer], joints, lift? }
 *       a monomer: { kind: 'lathes' | 'extrudes' | 'sweeps', spec, piece, role, group, mass? }
 *   lathed(spec, fit, fitLen, smooth?)   a lathe sized by where it is met
 *
 * Pure; no dice. Names no form: a body plan asks for a wheel, never for a cart's wheel.
 */

const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (p) => ({ x: r3(p[0]), y: r3(p[1]), z: r3(p[2]) });
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };

/** What a thing is made of, and what drives it: the words a setting is read in. */
export const MADE = Object.freeze(['timber-and-rope', 'iron-and-rivet', 'steel-and-rubber', 'alloy-and-glass', 'stone-and-rune', 'chitin-and-sinew']);
export const DRIVEN = Object.freeze(['muscle', 'wind', 'steam', 'combustion', 'field', 'arcane', 'grown']);
/** The setting a civilization's finish implies, until the world says its own (the setting read). */
export const SETTING_BY_FINISH = Object.freeze({
  alloy: Object.freeze({ made: 'steel-and-rubber', driven: 'combustion' }),
  composite: Object.freeze({ made: 'alloy-and-glass', driven: 'combustion' }),
  'iron-and-timber': Object.freeze({ made: 'iron-and-rivet', driven: 'steam' }),
  'stone-and-brass': Object.freeze({ made: 'stone-and-rune', driven: 'arcane' }),
});
export const DEFAULT_SETTING = SETTING_BY_FINISH.alloy;

/** A lathe sized by where it is met: points round by `fitR`; rings along by its profile's arc (the slant counts), or,
 * shaded smooth, the fewest rings that land on every corner of its profile (a lathe's profile is straight between
 * its points, so a ring between them is spent on nothing), never more than its arc would ask. */
export function lathed(spec, fit, fitLen, smooth = false) {
  if (spec.fitR === undefined) return spec;
  const { fitR, ...rest } = spec, a = [spec.axisFrom.x, spec.axisFrom.y, spec.axisFrom.z], b = [spec.axisTo.x, spec.axisTo.y, spec.axisTo.z], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  let arc = 0;
  for (let i = 1; i < spec.profile.length; i++) arc += Math.hypot((spec.profile[i].t - spec.profile[i - 1].t) * L, spec.profile[i].radius - spec.profile[i - 1].radius);
  const most = fitLen(arc);
  if (!smooth) return { ...rest, samples: fit(fitR), crossSections: most };
  let n = 2;
  while (n < most && !spec.profile.every((p) => Math.abs(p.t * n - Math.round(p.t * n)) < 1e-6)) n++;
  return { ...rest, samples: fit(fitR), crossSections: n };
}

// ── the parts every dress is built from ───────────────────────────────────────────────────────────────────────────
// a frame on an axle: `a` along it (outward), `u` and `v` across its face
function axleFrame(a) {
  const A = unit(a), up = Math.abs(A[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], U = unit(cross(up, A));
  return { a: A, u: U, v: cross(A, U) };
}
const lathe = (id, from, to, profile, fitR) => ({ id, axisFrom: P(from), axisTo: P(to), profile: profile.map(([t, r]) => ({ t, radius: r3(r) })), fitR });
const ring = (c, F, R, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = (2 * Math.PI * i) / n; out.push(add(add(c, F.u, R * Math.cos(t)), F.v, R * Math.sin(t)).map(r3)); } return out; };

/** A wheel's dresses. Each builds its cage and detail about a centre `c`, its axle outward along `a`, radius r, width w. */
const WHEEL_DRESSES = Object.freeze({
  spoked: {
    read: 'a rim on spokes from a nave: the gaps between the spokes are its silhouette',
    made: ['timber-and-rope', 'iron-and-rivet'], driven: ['muscle', 'wind', 'steam'], motifs: ['ornate', 'riveted'],
    build({ id, c, a, r, w, fit }, made) {
      const F = axleFrame(a), tr = Math.min(w * 0.5, r * 0.09), rc = r - tr, hub = r * 0.17, n = r > 0.5 ? 12 : 8, sr = Math.max(0.012, r * 0.035);
      const cage = [
        { kind: 'sweeps', spec: { id, path: ring(c, F, rc, fit(rc)), radius: r3(tr), sides: Math.max(5, fit(tr)), caps: false }, part: 'rim', group: made === 'iron-and-rivet' ? 'tech:trim' : 'tech:frame' },
        { kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, -w * 0.8), add(c, F.a, w * 0.8), [[0, hub * 0.7], [0.3, hub], [0.7, hub], [1, hub * 0.6]], hub), part: 'hub', group: 'tech:trim' },
      ];
      for (let i = 0; i < n; i++) {
        const t = (2 * Math.PI * (i + 0.5)) / n, d = add(F.u, F.v, 0).map((_, k) => F.u[k] * Math.cos(t) + F.v[k] * Math.sin(t));
        cage.push({ kind: 'sweeps', spec: { id: `${id}-spoke-${i + 1}`, path: [add(c, d, hub * 0.9).map(r3), add(c, d, rc - tr * 0.5).map(r3)], radius: r3(sr), sides: Math.max(4, fit(sr)) }, part: 'spoke', group: 'tech:frame' });
      }
      // an iron tyre is riveted to its felloes; a timber one is pegged (under the bake's resolution)
      const detail = made === 'iron-and-rivet' ? Array.from({ length: n }, (_, i) => { const t = (2 * Math.PI * i) / n, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), p = add(add(c, d, rc), F.a, tr * 0.9); return { kind: 'lathes', spec: lathe(`${id}-rivet-${i + 1}`, p, add(p, F.a, tr * 0.25), [[0, tr * 0.3], [1, tr * 0.18]], tr * 0.3), part: 'rivet', group: 'tech:trim', size: tr * 0.6 }; }) : [];
      return { cage, detail };
    },
  },
  wire: {
    read: 'a light rim on many thin spokes, a rubber tyre round it: pedalled, or drawn by hand',
    made: ['steel-and-rubber', 'alloy-and-glass', 'iron-and-rivet'], driven: ['muscle', 'wind'], motifs: ['smooth', 'faceted'],
    build({ id, c, a, r, w, fit }) {
      const F = axleFrame(a), tr = Math.max(0.018, Math.min(w * 0.6, r * 0.09)), rc = r - tr, hub = r * 0.1, n = 18, sr = Math.max(0.004, r * 0.012);
      const cage = [
        { kind: 'sweeps', spec: { id, path: ring(c, F, rc, fit(rc)), radius: r3(tr), sides: Math.max(6, fit(tr)), caps: false }, part: 'tyre', group: 'tech:frame' },
        { kind: 'sweeps', spec: { id: `${id}-rim`, path: ring(c, F, rc - tr * 1.2, fit(rc)), radius: r3(tr * 0.35), sides: 5, caps: false }, part: 'rim', group: 'tech:trim' },
        { kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, -w * 1.2), add(c, F.a, w * 1.2), [[0, hub * 0.8], [0.5, hub], [1, hub * 0.8]], hub), part: 'hub', group: 'tech:trim' },
      ];
      for (let i = 0; i < n; i++) {
        const t = (2 * Math.PI * (i + 0.5)) / n, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), side = i % 2 ? 1 : -1;
        cage.push({ kind: 'sweeps', spec: { id: `${id}-spoke-${i + 1}`, path: [add(add(c, d, hub * 0.8), F.a, side * w).map(r3), add(c, d, rc - tr * 1.4).map(r3)], radius: r3(sr), sides: 4 }, part: 'spoke', group: 'tech:trim' });
      }
      return { cage, detail: [] };
    },
  },
  disc: {
    read: 'a dished disc with a boss: iron cast or steel pressed',
    made: ['iron-and-rivet', 'steel-and-rubber'], driven: ['steam', 'combustion'], motifs: ['riveted', 'faceted'],
    build({ id, c, a, r, w, fit }) {
      const F = axleFrame(a), boss = r * 0.32;
      const cage = [
        { kind: 'lathes', spec: lathe(id, add(c, F.a, -w / 2), add(c, F.a, w / 2), [[0, r * 0.93], [0.12, r], [0.88, r], [1, r * 0.93]], r), part: 'rim', group: 'tech:frame' },
        { kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, w / 2 - 0.01), add(c, F.a, w / 2 + r * 0.14), [[0, boss], [0.5, boss * 0.92], [1, boss * 0.55]], boss), part: 'hub', group: 'tech:trim' },
      ];
      const bolt = r * 0.045, detail = Array.from({ length: 8 }, (_, i) => { const t = (2 * Math.PI * i) / 8, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), p = add(add(c, d, r * 0.55), F.a, w / 2); return { kind: 'lathes', spec: lathe(`${id}-bolt-${i + 1}`, p, add(p, F.a, bolt), [[0, bolt], [1, bolt * 0.7]], bolt), part: 'bolt', group: 'tech:trim', size: bolt * 2 }; });
      return { cage, detail };
    },
  },
  road: {
    read: 'a rubber tyre on a recessed rim, lugs on its hub and tread across its face',
    made: ['steel-and-rubber', 'alloy-and-glass'], driven: ['combustion', 'field'], motifs: ['smooth', 'faceted', 'spiked'],
    build({ id, c, a, r, w, fit }) {
      const F = axleFrame(a), rim = r * 0.62, cap = r * 0.24;
      const cage = [
        { kind: 'lathes', spec: lathe(id, add(c, F.a, -w / 2), add(c, F.a, w / 2), [[0, r * 0.8], [0.1, r * 0.96], [0.5, r], [0.9, r * 0.96], [1, r * 0.8]], r), part: 'tyre', group: 'tech:frame' },
        { kind: 'lathes', spec: lathe(`${id}-rim`, add(c, F.a, w / 2 - 0.01), add(c, F.a, w / 2 + r * 0.04), [[0, rim], [1, rim * 0.92]], rim), part: 'rim', group: 'tech:trim' },
        { kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, w / 2 + r * 0.03), add(c, F.a, w / 2 + r * 0.14), [[0, cap], [1, cap * 0.6]], cap), part: 'hub', group: 'tech:trim' },
      ];
      const lug = r * 0.04, detail = Array.from({ length: 5 }, (_, i) => { const t = (2 * Math.PI * i) / 5, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), p = add(add(c, d, cap * 1.35), F.a, w / 2 + r * 0.04); return { kind: 'lathes', spec: lathe(`${id}-lug-${i + 1}`, p, add(p, F.a, lug * 1.2), [[0, lug], [1, lug * 0.8]], lug), part: 'lug', group: 'tech:trim', size: lug * 2 }; });
      // tread blocks stand proud of the tyre's round: they are in its silhouette
      // shallow and close-set: a tread, not a cog
      const nt = Math.max(24, Math.round((2 * Math.PI * r) / (r * 0.17))), th = r * 0.028;
      for (let i = 0; i < nt; i++) {
        const t = (2 * Math.PI * i) / nt, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), q = F.u.map((x, k) => -x * Math.sin(t) + F.v[k] * Math.cos(t)), b0 = add(c, d, r - th * 0.3), hw = r * 0.05;
        // counter-clockwise about the axle, as an extrude's profile is wound
        const pts = [add(b0, q, -hw), add(add(b0, q, -hw * 0.8), d, th), add(add(b0, q, hw * 0.8), d, th), add(b0, q, hw)];
        detail.push({ kind: 'extrudes', spec: { id: `${id}-tread-${i + 1}`, ...prismAcross(pts, F.a, c, w * 0.42) }, part: 'tread', group: 'tech:frame', size: th, silhouette: true });
      }
      return { cage, detail };
    },
  },
  pad: {
    read: 'a lift pad where a wheel would be: a disc that holds the thing off the ground on its glow; it does not roll',
    made: ['alloy-and-glass', 'stone-and-rune'], driven: ['field', 'arcane'], motifs: ['smooth', 'ornate', 'organic'], lifts: true,
    build({ id, c, a, r, w }) {
      // the pad lies flat under where the axle would be, drawn in under the body it lifts, a gap below it; its glow
      // faces the ground
      const z = Math.max(r * 0.35, 0.12), gap = r * 0.25, R = r * 0.9, A = unit(a), base = [c[0] - A[0] * R * 0.6, c[1] - A[1] * R * 0.6, gap];
      const cage = [
        { kind: 'lathes', spec: lathe(id, base, add(base, [0, 0, 1], z), [[0, R * 0.8], [0.3, R], [1, R * 0.85]], R), part: 'pad', group: 'tech:frame' },
        { kind: 'lathes', spec: lathe(`${id}-glow`, add(base, [0, 0, 1], -0.02), add(base, [0, 0, 1], 0.03), [[0, R * 0.62], [1, R * 0.7]], R * 0.7), part: 'emitter', group: 'tech:light' },
        { kind: 'lathes', spec: lathe(`${id}-hub`, add(base, [0, 0, 1], z), add(base, [0, 0, 1], z + w * 0.4), [[0, R * 0.3], [1, R * 0.22]], R * 0.3), part: 'hub', group: 'tech:trim' },
      ];
      return { cage, detail: [], lift: { gap: r3(gap), cue: 'emitter' } };
    },
  },
  flanged: {
    read: 'a wheel on a rail: its flange inside the rail\'s head keeps it on; a large one is spoked and weighted',
    on: ['rail'], made: ['iron-and-rivet', 'steel-and-rubber', 'timber-and-rope', 'alloy-and-glass'], driven: ['muscle', 'wind', 'steam', 'combustion'], motifs: ['riveted', 'ornate', 'faceted', 'smooth'],
    build({ id, c, a, r, w, fit }, made) {
      // the flange is on the inside of the wheel (−a), the tread coned to the outside
      const F = axleFrame(a), lip = r * 1.12, cage = [];
      cage.push({ kind: 'lathes', spec: lathe(`${id}-flange`, add(c, F.a, -w / 2), add(c, F.a, -w / 2 + w * 0.22), [[0, lip * 0.97], [0.5, lip], [1, r * 0.98]], lip), part: 'flange', group: 'tech:trim' });
      if (r > 0.55) {
        // a driving wheel: a rim on spokes and a counterweight between them, the crank boss on its face
        const tr = Math.min(w * 0.4, r * 0.08), rc = r - tr, hub = r * 0.2, n = 14, sr = r * 0.03;
        cage.push({ kind: 'sweeps', spec: { id, path: ring(add(c, F.a, w * 0.1), F, rc, fit(rc)), radius: r3(tr), sides: Math.max(5, fit(tr)), caps: false }, part: 'rim', group: 'tech:frame' });
        cage.push({ kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, -w * 0.4), add(c, F.a, w * 0.6), [[0, hub], [0.6, hub], [1, hub * 0.7]], hub), part: 'hub', group: 'tech:trim' });
        for (let i = 0; i < n; i++) {
          const t = (2 * Math.PI * (i + 0.5)) / n, d = F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), o = add(c, F.a, w * 0.1);
          cage.push({ kind: 'sweeps', spec: { id: `${id}-spoke-${i + 1}`, path: [add(o, d, hub * 0.9).map(r3), add(o, d, rc - tr * 0.5).map(r3)], radius: r3(sr), sides: Math.max(4, fit(sr)) }, part: 'spoke', group: 'tech:frame' });
        }
        // the counterweight: a crescent between the spokes opposite the crank
        const cw = [], q = 10;
        for (let i = 0; i <= q; i++) { const t = Math.PI * 0.7 + (Math.PI * 0.6 * i) / q; cw.push(add(c, F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), rc * 0.92)); }
        for (let i = q; i >= 0; i--) { const t = Math.PI * 0.75 + (Math.PI * 0.5 * i) / q; cw.push(add(c, F.u.map((x, k) => x * Math.cos(t) + F.v[k] * Math.sin(t)), rc * 0.5)); }
        cage.push({ kind: 'extrudes', spec: { id: `${id}-weight`, ...prismAcross(cw, F.a, add(c, F.a, w * 0.1), w * 0.12) }, part: 'counterweight', group: 'tech:frame' });
      } else {
        cage.push({ kind: 'lathes', spec: lathe(id, add(c, F.a, -w / 2 + w * 0.2), add(c, F.a, w / 2), [[0, r], [1, r * 0.95]], r), part: 'tread', group: 'tech:frame' });
        cage.push({ kind: 'lathes', spec: lathe(`${id}-hub`, add(c, F.a, w / 2 - 0.01), add(c, F.a, w / 2 + r * 0.16), [[0, r * 0.3], [1, r * 0.2]], r * 0.3), part: 'hub', group: 'tech:trim' });
      }
      return { cage, detail: [] };
    },
  },
  maglev: {
    read: 'a shoe that rides over the rail on its field: it does not touch, and its glow runs along the rail',
    on: ['rail'], made: ['alloy-and-glass', 'stone-and-rune'], driven: ['field', 'arcane'], motifs: ['smooth', 'ornate', 'organic'], lifts: true,
    build({ id, c, r, w }) {
      // the shoe straddles where the wheel would sit, a gap over the rail's head; its glow underneath
      const gap = r * 0.18, top = c[2] - r, L = r * 2.2, half = w * 0.9, z0 = top + gap, h = r * 0.5;
      const box = (bid, y0, y1, za, zb, part, group) => ({ kind: 'extrudes', spec: { id: bid, profile: { points: [[r3(y0), r3(za)], [r3(y1), r3(za)], [r3(y1), r3(zb)], [r3(y0), r3(zb)]] }, axisFrom: P([c[0] - L / 2, 0, 0]), axisTo: P([c[0] + L / 2, 0, 0]) }, part, group });
      return { cage: [box(id, c[1] - half, c[1] + half, z0, z0 + h, 'shoe', 'tech:frame'), box(`${id}-glow`, c[1] - half * 0.7, c[1] + half * 0.7, z0 - 0.02, z0, 'emitter', 'tech:light')], detail: [], lift: { gap: r3(gap), cue: 'emitter', over: r3(top) } };
    },
  },
});

/** A prism across an axle: a quad `pts` (in the plane through `c` normal to `a`) pushed `half` either side of it. */
function prismAcross(pts, a, c, half) {
  // the extrude's profile is in its own (u, v) plane about its axis; with the axis along `a`, carry each point as
  // (u, v) in the axle's frame
  const F = axleFrame(a), uv = pts.map((p) => { const d = add(p, c, -1); return [r3(d[0] * F.u[0] + d[1] * F.u[1] + d[2] * F.u[2]), r3(d[0] * F.v[0] + d[1] * F.v[1] + d[2] * F.v[2])]; });
  return { profile: { points: uv }, axisFrom: P(add(c, F.a, -half)), axisTo: P(add(c, F.a, half)) };
}

/** A track's dresses: the same five parts (sprocket, idler, road wheels, rollers when wanted, belt), sized and spaced. */
const TRACK_DRESSES = Object.freeze({
  link: {
    read: 'iron or steel links on small road wheels, return rollers on the top run, grousers biting the ground',
    made: ['iron-and-rivet', 'steel-and-rubber'], driven: ['steam', 'combustion'], motifs: ['riveted', 'faceted', 'spiked'],
    road: 0.52, rollers: true, sprocket: 0.92, idler: 0.8, grousers: true,
  },
  band: {
    read: 'a rubber band on large interleaved road wheels, no return rollers, a chevron tread',
    made: ['steel-and-rubber', 'alloy-and-glass'], driven: ['combustion', 'field'], motifs: ['smooth', 'organic'],
    road: 0.78, rollers: false, sprocket: 0.85, idler: 0.8, grousers: false,
  },
});

export const MECHANISMS = Object.freeze({
  wheel: Object.freeze({ read: 'a hub on its axle and a rim at its contact; it turns about its axle', parts: Object.freeze(['hub', 'rim']), dresses: WHEEL_DRESSES }),
  track: Object.freeze({ read: 'a drive sprocket at the rear, an idler at the front, road wheels on the ground (rollers on the top run when they are small), one belt round them all', parts: Object.freeze(['sprocket', 'idler', 'road', 'belt']), dresses: TRACK_DRESSES }),
});

/** Pick a dress by the setting: what it is made of first, then what drives it, then the motif; each refusal says why. */
export function pickDress(mechanism, { setting = DEFAULT_SETTING, motif, dress, on = 'ground', prefer = [] } = {}) {
  const M = MECHANISMS[mechanism];
  if (!M) throw new Error(`mech kit: '${mechanism}' is not a mechanism (${Object.keys(MECHANISMS).join(', ')})`);
  if (dress !== undefined) {
    if (!M.dresses[dress]) throw new Error(`mech kit: '${dress}' is not a ${mechanism}'s dress (${Object.keys(M.dresses).join(', ')})`);
    return { dress, why: 'said', refused: [] };
  }
  const score = (D) => (D.made[0] === setting.made ? 2.5 : D.made.includes(setting.made) ? 2 : 0) + (D.driven.includes(setting.driven) ? 1 : 0) + (motif && D.motifs.includes(motif) ? 0.25 : 0);
  // only the dresses that run on what it runs on: a wheel on the ground or a wheel on a rail
  const fits = Object.entries(M.dresses).filter(([, D]) => (D.on ?? ['ground']).includes(on));
  const ranked = fits.map(([id, D]) => ({ id, D, s: score(D) })).sort((x, y) => y.s - x.s);
  // a row may prefer a dress (a motorcycle's wire wheels): taken when the setting makes it of what it is made of
  const pref = prefer.map((p) => ranked.find((x) => x.id === p && x.D.made.includes(setting.made))).find(Boolean);
  if (pref) return { dress: pref.id, why: `preferred, and made of ${setting.made}`, refused: ranked.filter((x) => x !== pref).map(({ id, D }) => ({ dress: id, why: `not preferred (${D.made.join(' or ')}, ${D.driven.join(' or ')})` })) };
  const best = ranked[0];
  const said = `${setting.made}, ${setting.driven}`;
  const why = best.s >= 3 ? `made of ${setting.made} and driven by ${setting.driven}` : best.s >= 2 ? `made of ${setting.made}` : best.s >= 1 ? `driven by ${setting.driven}` : `nothing answers ${said}: the nearest`;
  return { dress: best.id, why, refused: ranked.slice(1).map(({ id, D }) => ({ dress: id, why: `${D.made.join(' or ')}, ${D.driven.join(' or ')}: not ${said}` })) };
}

// the convex hull of points (u, v), counter-clockwise
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}

/** The detail a camera resolves in the silhouette joins the cage: at least this many pixels across. */
export const PROMOTE_PX = 6;

/**
 * A mechanism for a need, dressed by the setting.
 *   wheel: { mechanism: 'wheel', id, centre, axle (outward), r, w, on? ('ground' | 'rail': its contact at the rail's head) }
 *   track: { mechanism: 'track', id, x: [rear, front], y: [inner, outer], r (half its height) }
 */
export function resolveMechanism(need, { setting = DEFAULT_SETTING, motif, fit, fitLen, smooth = false, pxPerM = 0, dress } = {}) {
  // a need may say what drives it whatever the world's setting (a pedalled wheel, a drawn one: muscle)
  if (need.driven) setting = { ...setting, driven: need.driven };
  const pick = pickDress(need.mechanism, { setting, motif, dress: dress ?? need.dress, on: need.on ?? 'ground', prefer: need.prefer ?? [] }), D = MECHANISMS[need.mechanism].dresses[pick.dress];
  let built;
  if (need.mechanism === 'wheel') {
    const b = D.build({ id: need.id, c: need.centre, a: need.axle, r: need.r, w: need.w, fit, fitLen }, setting.made);
    const all = [...b.cage, ...b.detail].map((m) => m.spec.id);
    built = { ...b, joints: D.lifts ? [] : [{ id: need.id, parent: 'core', pivot: need.centre.map(r3), axis: unit(need.axle).map(r3), range: [0, 360], pieces: all }], parts: { hub: `${need.id}-hub`, contact: need.id } };
  } else {
    built = buildTrack(need, D, { setting, motif, fit, fitLen });
  }
  // the detail that stands in the silhouette and reads at the design camera joins the cage
  const promote = (m) => m.silhouette && m.size * pxPerM >= PROMOTE_PX;
  const cage = [...built.cage, ...built.detail.filter(promote)], detail = built.detail.filter((m) => !promote(m));
  const tag = (m) => ({ ...m, spec: m.kind === 'lathes' ? lathed(m.spec, fit, fitLen, smooth) : m.spec, piece: need.piece ?? need.id, role: m.role ?? 'running' });
  return { mechanism: need.mechanism, dress: pick.dress, read: D.read, why: pick.why, refused: pick.refused, cage: cage.map(tag), detail: detail.map(tag), promoted: built.detail.filter(promote).length, joints: built.joints, parts: built.parts, ...(built.lift ? { lift: built.lift } : {}) };
}

function buildTrack(need, D, { setting, fit }) {
  const { id, r } = need, [xr, xf] = need.x, [yi, yo] = need.y, sy = Math.sign(yo - yi) || 1, mid = (yi + yo) / 2, half = Math.abs(yo - yi) / 2, bt = r * 0.09;
  // the wheels it wraps, in its own plane (x along, z up): the sprocket at the rear, the idler raised at the front
  const rs = r * D.sprocket, ri = r * D.idler, rr = r * D.road;
  const sprocket = { x: xr + rs + bt, z: r, R: rs }, idler = { x: xf - ri - bt, z: r * 1.12, R: ri };
  const span = idler.x - ri - (sprocket.x + rs), n = Math.max(3, Math.floor(span / (2 * rr * (D.rollers ? 1.15 : 0.92))));
  const road = Array.from({ length: n }, (_, i) => ({ x: sprocket.x + rs * 0.6 + rr + ((span + rs * 0.4 + ri * 0.4 - 2 * rr) * i) / Math.max(1, n - 1), z: rr + bt, R: rr }));
  const nr = D.rollers ? Math.max(2, n - 2) : 0, rollers = Array.from({ length: nr }, (_, i) => ({ x: sprocket.x + ((idler.x - sprocket.x) * (i + 1)) / (nr + 1), z: 2 * r - r * 0.2, R: r * 0.16 }));
  const wheels = [sprocket, idler, ...road, ...rollers];
  // the belt: the hull of every wheel it wraps, its thickness outside them
  const sample = [];
  for (const w of wheels) { const m = Math.max(12, fit(w.R)); for (let i = 0; i < m; i++) { const t = (2 * Math.PI * i) / m; sample.push([r3(-(w.x + (w.R + bt) * Math.cos(t))), r3(w.z + (w.R + bt) * Math.sin(t))]); } }
  // its profile in the extrude's plane (u = −x, v = z, the axis along +y), wound counter-clockwise on either side
  const H = hull(sample), pts = H;
  const y0 = Math.min(yi, yo), y1 = Math.max(yi, yo);
  const cage = [{ kind: 'extrudes', spec: { id, profile: { points: pts }, axisFrom: P([0, y0, 0]), axisTo: P([0, y1, 0]) }, part: 'belt', group: 'tech:frame', mass: { box: { lo: [r3(xr), r3(y0), 0], hi: [r3(xf), r3(y1), r3(2 * r + bt)] } } }];
  // the wheels show on its outer flank, standing a little proud of it
  const flank = (w, wid, part, group) => cage.push({ kind: 'lathes', spec: lathe(`${id}-${wid}`, [w.x, yo - sy * half * 0.3, w.z], [w.x, yo + sy * r * 0.06, w.z], [[0, w.R * 0.96], [0.7, w.R * 0.96], [1, w.R * 0.82]], w.R), part, group });
  // the sprocket's teeth stand past its round: a star, so it reads as the one that drives
  const teeth = Math.max(9, Math.round(rs * 26)), star = [];
  for (let i = 0; i < 2 * teeth; i++) { const t = (Math.PI * i) / teeth, R = i % 2 ? rs * 0.86 : rs * 1.04; star.push([r3(-(sprocket.x + R * Math.cos(t))), r3(sprocket.z + R * Math.sin(t))]); }
  cage.push({ kind: 'extrudes', spec: { id: `${id}-sprocket`, profile: { points: [...star].reverse() }, axisFrom: P([0, Math.min(yo - sy * half * 0.4, yo + sy * r * 0.1), 0]), axisTo: P([0, Math.max(yo - sy * half * 0.4, yo + sy * r * 0.1), 0]) }, part: 'sprocket', group: 'tech:trim' });
  flank(idler, 'idler', 'idler', 'tech:trim');
  road.forEach((w, i) => flank(w, `road-${i + 1}`, 'road', 'tech:trim'));
  rollers.forEach((w, i) => flank(w, `roller-${i + 1}`, 'roller', 'tech:trim'));
  // grousers across the belt, every pitch round its loop: they stand in the silhouette
  const detail = [];
  if (D.grousers) {
    const loop = [...H, H[0]], pitch = r * 0.32, gt = r * 0.06;
    let carry = 0, k = 0;
    for (let i = 0; i + 1 < loop.length; i++) {
      const a = loop[i], b = loop[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), t = [(b[0] - a[0]) / (L || 1), (b[1] - a[1]) / (L || 1)], o = [t[1], -t[0]];
      for (let s = pitch - carry; s < L; s += pitch) {
        const p = [a[0] + t[0] * s, a[1] + t[1] * s], hw = gt * 0.8;
        const q = [[p[0] - t[0] * hw, p[1] - t[1] * hw], [p[0] + t[0] * hw, p[1] + t[1] * hw], [p[0] + t[0] * hw * 0.6 + o[0] * gt, p[1] + t[1] * hw * 0.6 + o[1] * gt], [p[0] - t[0] * hw * 0.6 + o[0] * gt, p[1] - t[1] * hw * 0.6 + o[1] * gt]].map(([u, v]) => [r3(u), r3(v)]);
        detail.push({ kind: 'extrudes', spec: { id: `${id}-grouser-${++k}`, profile: { points: [...q].reverse() }, axisFrom: P([0, y0, 0]), axisTo: P([0, y1, 0]) }, part: 'grouser', group: 'tech:frame', size: gt, silhouette: true });
        carry = L - s;
      }
      if (L < pitch - carry) carry += L;
    }
  }
  const spin = (w, wid) => ({ id: `${id}-${wid}`, parent: 'core', pivot: [r3(w.x), r3(yo), r3(w.z)], axis: [0, sy, 0], range: [0, 360], pieces: [`${id}-${wid}`] });
  const joints = [spin(sprocket, 'sprocket'), spin(idler, 'idler'), ...road.map((w, i) => spin(w, `road-${i + 1}`)), ...rollers.map((w, i) => spin(w, `roller-${i + 1}`))];
  return { cage, detail, joints, parts: { sprocket: `${id}-sprocket`, idler: `${id}-idler`, road: road.map((_, i) => `${id}-road-${i + 1}`), rollers: rollers.map((_, i) => `${id}-roller-${i + 1}`), belt: id }, wheels: { sprocket, idler, road, rollers, belt: bt } };
}
