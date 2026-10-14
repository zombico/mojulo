// vegetation/grass-contact — what touches the grass, as a LOAD on the blade. Import-free closure, so a page can inline
// grassContact.toString() and run the same rules Node verifies (the soft-ground bed's pattern).
//
// A blade in the wind is already one cantilever (vegetation/wind.js): a sideways load R, in the blade's own weights, goes
// through the elastica's bend table and comes back as a change of shape that keeps the blade's length. Contact is more
// of the same load. The page adds it to the wind's R before the bend-table lookup, so a foot and a gust add up and a
// blade pressed flat keeps its length (at R = 12, the table's top, a meadow blade's tip is about 15° off the ground).
//
// Two sources of contact load:
//   THE BED      a square of `reach` m round the camera in cells of `cell` m. Each cell holds how far its blades are LAID
//                (f, 0 standing to 1 flat) and which way (a unit direction). A body standing in the grass stamps it
//                every frame: its footprint (radius `body`, falling off smoothly to its edge) lays the blades away from
//                its centre and, as it moves, along its way, so a walked line reads as a trail. Blades spring back
//                with a half-life of `recover` s; `recover` 0 keeps no memory, only what is pressed now. The bed slides
//                with the camera by whole cells, and what slides out is forgotten.
//   IMPACTS      a landing, a hit, a blast: a ring of load travelling out from the point at `wave.speed` m/s, `wave.width`
//                m thick, dying with a time constant of `wave.decay` s and spreading as 1/√(1 + r), strength `e` (1 is a
//                jump's landing). A closed form of the clock: the page evaluates it per blade on the GPU from the last
//                `impacts` of them, so a frame with a pinned clock is reproducible. The impact also stamps a CRATER in the
//                bed, `crater`·√e m across, laid outward: what the ring flattens stays down and recovers like a print.
// A landing is found from a body's own fall: a body that was falling faster than `land` m/s and has stopped makes an
// impact of its speed / 10.
//
// The bed's load at full lay is `flat` (in blade weights) × `press`, the share of full flat a body gives (0.3: grass that
// only bows; 1: trampled). The GPU reads the bed as an RGBA8 texture, linear: R the lay, G and B the lay's vector (lay ×
// direction) coded 127 ± 127, so an untouched cell decodes to exactly no load and filtering averages the vectors.
export const GRASS_CONTACT_DEFAULTS = Object.freeze({ reach: 24, cell: 0.25, body: 0.6, press: 1, recover: 6, flat: 10, impacts: 8, crater: 0.9, land: 4,
  wave: Object.freeze({ speed: 6, width: 0.7, decay: 0.8, gain: 6 }) });

export function grassContact(C) {
  const N = Math.max(4, Math.round(C.reach / C.cell)), cell = C.cell, H = N >> 1;
  let f = new Float32Array(N * N), dx = new Float32Array(N * N), dy = new Float32Array(N * N), i0 = -H, j0 = -H, live = 0;
  const imp = [];
  // the bed's origin follows the camera by whole cells; the overlap is kept, what slides out is forgotten
  function follow(cx, cy) {
    const ni = Math.floor(cx / cell) - H, nj = Math.floor(cy / cell) - H;
    if (ni === i0 && nj === j0) return false;
    const si = ni - i0, sj = nj - j0, F = new Float32Array(N * N), X = new Float32Array(N * N), Y = new Float32Array(N * N);
    if (live) for (let j = 0; j < N; j++) {
      const oj = j + sj; if (oj < 0 || oj >= N) continue;
      for (let i = 0; i < N; i++) { const oi = i + si; if (oi < 0 || oi >= N) continue; const a = j * N + i, b = oj * N + oi; F[a] = f[b]; X[a] = dx[b]; Y[a] = dy[b]; }
    }
    f = F; dx = X; dy = Y; i0 = ni; j0 = nj; return true;
  }
  // the blades spring back: half-life `recover` s; 0 forgets at once
  function recover(dt) {
    if (!live || !(dt > 0)) return;
    const k = C.recover > 0 ? Math.pow(0.5, dt / C.recover) : 0; let any = 0;
    for (let i = 0; i < f.length; i++) { if (!f[i]) continue; const v = f[i] * k; if (v < 1 / 512) { f[i] = 0; dx[i] = 0; dy[i] = 0; } else { f[i] = v; any = 1; } }
    live = any;
  }
  // a body of radius r at (x, y), moving (vx, vy) m/s, laying blades by `k` (0..1) at its centre
  function stamp(x, y, r, vx, vy, k) {
    if (!(r > 0) || !(k > 0)) return;
    const sp = Math.hypot(vx, vy), m = Math.min(1, sp / 1.5), ux = sp > 1e-6 ? vx / sp : 0, uy = sp > 1e-6 ? vy / sp : 0;
    const ia = Math.max(0, Math.floor((x - r) / cell) - i0), ib = Math.min(N - 1, Math.floor((x + r) / cell) - i0);
    const ja = Math.max(0, Math.floor((y - r) / cell) - j0), jb = Math.min(N - 1, Math.floor((y + r) / cell) - j0);
    for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
      const cx = (i0 + i + 0.5) * cell - x, cy = (j0 + j + 0.5) * cell - y, d = Math.hypot(cx, cy); if (d >= r) continue;
      const q = 1 - (d / r) * (d / r), p = k * q * q, a = j * N + i; if (p <= f[a]) continue;
      // away from the centre, and along the way the body goes
      let ex = (d > 1e-6 ? cx / d : 0) + 1.5 * m * ux, ey = (d > 1e-6 ? cy / d : 0) + 1.5 * m * uy; const el = Math.hypot(ex, ey);
      if (el < 1e-6) { ex = 1; ey = 0; } else { ex /= el; ey /= el; }
      const w = f[a] * (1 - p); let nx = dx[a] * w + ex * p, ny = dy[a] * w + ey * p; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      f[a] = p; dx[a] = nx; dy[a] = ny; live = 1;
    }
  }
  // an impact of strength e at (x, y) at time t (s): the ring, and the crater it leaves
  function impact(x, y, e, t) {
    if (!(e > 0)) return;
    imp.push([x, y, t, e]); while (imp.length > C.impacts) imp.shift();
    stamp(x, y, C.crater * Math.sqrt(e), 0, 0, Math.min(1, e));
  }
  // the impacts still ringing at t: older than 4.6 time constants (1 %) are dropped
  function ringing(t) {
    for (let i = imp.length - 1; i >= 0; i--) if (t - imp[i][2] > 4.6 * C.wave.decay) imp.splice(i, 1);
    return imp;
  }
  // the ring's load at a blade's root (x, y) at t: the GPU's sum, for the tests and the page's own reads
  function ringAt(x, y, t) {
    const W = C.wave; let lx = 0, ly = 0;
    for (const [ix, iy, t0, e] of imp) {
      const tau = t - t0; if (tau < 0) continue;
      const ddx = x - ix, ddy = y - iy, r = Math.hypot(ddx, ddy); if (r < 1e-3) continue;
      const u = (r - W.speed * tau) / W.width, a = W.gain * e * Math.exp(-tau / W.decay) * Math.exp(-u * u) / Math.sqrt(1 + r);
      lx += (ddx / r) * a; ly += (ddy / r) * a;
    }
    return [lx, ly];
  }
  // the bed's cell under (x, y): [lay, lay·dx, lay·dy], or zeros off the bed
  function at(x, y) {
    const i = Math.floor(x / cell) - i0, j = Math.floor(y / cell) - j0;
    if (i < 0 || j < 0 || i >= N || j >= N) return [0, 0, 0];
    const a = j * N + i; return [f[a], f[a] * dx[a], f[a] * dy[a]];
  }
  // the bed's load at (x, y) and the ring's: what the page adds to the wind's R
  const loadAt = (x, y, t) => { const b = at(x, y), r = ringAt(x, y, t), k = C.flat * C.press; return [b[1] * k + r[0], b[2] * k + r[1]]; };
  // the bed as RGBA8 for the GPU (lay, then the lay's vector coded 127 ± 127)
  function pack(out) {
    for (let a = 0, o = 0; a < f.length; a++, o += 4) {
      const v = f[a]; out[o] = Math.round(v * 255); out[o + 1] = Math.round(127 + 127 * v * dx[a]); out[o + 2] = Math.round(127 + 127 * v * dy[a]); out[o + 3] = 255;
    }
    return out;
  }
  // a body's landing: it fell faster than `land` m/s (vz0, its last vertical speed) and has stopped (vz) → its strength
  const landing = (vz0, vz) => (vz0 < -C.land && vz > 0.3 * vz0 ? -vz0 / 10 : 0);
  return { N, cell, follow, recover, stamp, impact, ringing, ringAt, at, loadAt, pack, landing,
    origin: () => [i0 * cell, j0 * cell], get live() { return !!live; } };
}

/** `grass.contact` on a stage recipe, resolved over the defaults: null when it is off. */
export function resolveGrassContact(contact, card = {}) {
  if (contact === false) return null;
  const c = contact && contact !== true ? contact : {};
  return { ...GRASS_CONTACT_DEFAULTS, ...card, ...c, wave: { ...GRASS_CONTACT_DEFAULTS.wave, ...(card.wave || {}), ...(c.wave || {}) } };
}

const CONTACT_KEYS = ['body', 'press', 'recover', 'wave', 'land'];
/** `grass.contact`: true, false or { body?, press?, recover?, wave?: { speed?, decay? }, land? } → error strings. */
export function validateGrassContact(contact) {
  if (contact === undefined || contact === true || contact === false) return [];
  if (!contact || typeof contact !== 'object' || Array.isArray(contact) || Object.keys(contact).some((k) => !CONTACT_KEYS.includes(k))) return ['grass.contact must be true, false or { body?, press?, recover?, wave?: { speed?, decay? }, land? }'];
  const e = [], num = (o, k, lo, hi, what, at = k) => { if (o[k] !== undefined && !(Number.isFinite(o[k]) && o[k] >= lo && o[k] <= hi)) e.push(`grass.contact.${at} must be ${lo}–${hi} (${what})`); };
  num(contact, 'body', 0.1, 3, 'metres: the radius a body lays the grass round its feet');
  num(contact, 'press', 0, 1, 'the share of flat a body lays the grass: 0.3 it bows, 1 it is trampled');
  num(contact, 'recover', 0, 600, 'seconds for laid grass to stand half way back up; 0 keeps no prints');
  num(contact, 'land', 1, 20, 'm/s: a body landing faster than this makes an impact');
  const w = contact.wave;
  if (w !== undefined) {
    if (!w || typeof w !== 'object' || Array.isArray(w) || Object.keys(w).some((k) => !['speed', 'decay'].includes(k))) e.push('grass.contact.wave must be { speed?, decay? }');
    else { num(w, 'speed', 0.5, 40, 'm/s the ring of an impact runs out through the grass', 'wave.speed'); num(w, 'decay', 0.1, 5, 'seconds: the ring\'s time constant', 'wave.decay'); }
  }
  return e;
}
