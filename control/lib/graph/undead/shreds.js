/**
 * THE SHREDS: torn cloth hanging from an undead body, what is left of what it was buried or killed in. FORM ONLY: the
 * strips are their own group (`Cloth`), toned by the palette, never patterned.
 *
 * Each strip is a thin ribbon (a `rings` part: its rings flat, broad across the body's surface and thin off it, so it
 * faces outward at any angle round the body), hung from a band round the body and falling straight down, clear of
 * everything below it on that side, tapering to a torn end. The strips are seeded and uneven, never mirrored:
 *
 *   chest   from the shoulders over the ribs, front and back (a tunic's or a tabard's rags)
 *   hips    from the hip crest all round (a belt's or a skirt's), the front and sides following each thigh
 *   arms    a few from each upper arm (a sleeve's)
 *
 *   shreds(body, spec, { k, rand })   → { segments, chest: [names], arms: [names] } (the parts the lean hinges:
 *                     the chest's and the arms'; the hips' stay planted with the pelvis)
 *   spec { chest, back, hips, arms, length }: how much of each is still there (0 none; above, the band's hem, and that
 *                     share of its strips hanging long), the back the chest's back half, `length` the long strips' ×
 *
 * Pure: the dice are the caller's (`rand`, its own seeded stream). Template metres at 2 m tall (× k).
 *
 *   trunkPoints(body), band(pts, lo, hi)   the points a body's trunk parts reach, and the band they make over a span
 *                     of z ({ ax, front, back }): what the rags hang clear of, and what the decayed flesh shrinks inside
 */
const r3 = (x) => Math.round(x * 1000) / 1000;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => mul(v, 1 / (Math.hypot(...v) || 1));
const SLOTS = ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'];
const TRUNK_GROUPS = new Set(['Torso', 'Pelvis', 'Flesh']);

// the points a body's trunk parts reach, to fit a band to: a trunk's ellipses, a loft's stations, a segment's ends
export function trunkPoints(body) {
  const out = [], rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  for (const s of body.segments) {
    // (not the collarbones: the cloth hangs from them, but the band under them is the cage's, not the shoulders')
    if (!TRUNK_GROUPS.has(s.group) || /^clav/.test(s.name)) continue;
    if (s.kind === 'trunk') for (const st of s.stations) { const [rx, ry] = Array.isArray(st.r) ? st.r : [st.r, st.r], yc = st.yc ?? 0; out.push([rx, yc, st.z], [-rx, yc, st.z], [0, yc + ry, st.z], [0, yc - ry, st.z], [rx * 0.7, yc + ry * 0.7, st.z], [rx * 0.7, yc - ry * 0.7, st.z]); }
    else if (s.kind === 'loft') for (const st of s.stations) { const r = rad(st.r); out.push(add(st.at, [r, 0, 0]), add(st.at, [-r, 0, 0]), add(st.at, [0, r, 0]), add(st.at, [0, -r, 0])); if (s.mirror === 'name') out.push([-st.at[0] - r, st.at[1], st.at[2]]); }
    else if (s.kind === 'segment') for (const [j, r] of [[s.from, s.rA], [s.to, s.rB]]) { const p = body.joints[j]; if (p) out.push(add(p, [rad(r), 0, 0]), add(p, [0, rad(r), 0]), add(p, [0, -rad(r), 0])); }
  }
  return out;
}
// the band round the body over z in [lo, hi]: half width, the front and the back
export function band(pts, lo, hi) {
  const s = pts.filter((p) => p[2] >= lo && p[2] <= hi);
  if (!s.length) return null;
  return { ax: Math.max(...s.map((p) => Math.abs(p[0]))), front: Math.max(...s.map((p) => p[1])), back: Math.min(...s.map((p) => p[1])) };
}
// a point on a band at angle θ (0 the front, toward +x positive) and its outward normal
function onBand(B, th, z) {
  const ay = (B.front - B.back) / 2, yc = (B.front + B.back) / 2;
  const p = [B.ax * Math.sin(th), yc + ay * Math.cos(th), z], n = unit([Math.sin(th) / B.ax, Math.cos(th) / ay, 0]);
  return { p, n };
}
// a flat ring: `n` its face's normal (the cloth's outside), `d` the strip's run, half width `w` across, half thickness `t`
// off the face (the slots' winding as station-loft-plan.js ringPoints winds a loft's: front, then round by R)
function flatRing(c, d, n, w, t) {
  let f = unit(sub(n, mul(d, dot(n, d)))), s = unit(cross(f, d));
  if (s[0] < 0) s = mul(s, -1);
  return Object.fromEntries(SLOTS.map((sl, k) => { const a = (2 * Math.PI * k) / 6; return [sl, add(c, add(mul(f, t * Math.cos(a)), mul(s, w * Math.sin(a)))).map(r3)]; }));
}
// one strip: its stations' centres, a normal, its half widths; a bind
function strip(name, C, n, W, t, rand, bind, reach = 1.2) {
  const m = C.length, dirAt = (i) => unit(sub(C[Math.min(i + 1, m - 1)], C[Math.max(i - 1, 0)]));
  const stations = C.map((c, i) => ({ id: `st${i}`, points: flatRing(c, dirAt(i), n, W[i], t) }));
  const dl = dirAt(m - 1), across = unit(cross(n, dl));
  // the torn end: past the last ring, off to one side
  const tip = add(add(C[m - 1], mul(dl, W[m - 1] * reach)), mul(across, (rand() - 0.5) * W[m - 1] * 1.4)).map(r3);
  return { name, kind: 'rings', slots: 'limb6', stations, caps: { back: add(C[0], mul(dirAt(0), -t * 2)).map(r3), tip }, group: 'Cloth', tint: '#cccccc', mirror: null, bind };
}
const U = [0, 0.3, 0.65, 1];

export function shreds(body, spec, { k, rand }) {
  const pts = trunkPoints(body), segments = [], chest = [], arms = [];
  const len = spec.length ?? 1, T = r3(0.0028 * k), J = body.joints;
  const shoulderZ = J.shoulder[2], hipZ = J.hip[2];
  // a band's strips: candidate angles round the body, every one a piece of the hem (broad enough at the top to overlap
  // its neighbours, so the band reads as one torn cloth), and each with the band's odds a long strip below it; all fall
  // straight, clear of the widest girth under the band
  const hang = (id, { z0, angles, odds, L, w, bind }) => {
    let i = 0;
    const gap = angles.length > 1 ? Math.abs(angles[1] - angles[0]) : 0.3;
    for (const th of angles) {
      const long = rand() < odds, Ls = long ? L[0] + (L[1] - L[0]) * rand() : (0.05 + 0.04 * rand()) * k, sway = (rand() - 0.5) * 0.04 * k;
      const below = band(pts, z0 - Math.max(Ls, L[0]), z0 + 0.01 * k);
      if (!below) continue;
      const a = onBand(below, th, z0), ds = Math.hypot(...sub(onBand(below, th + gap / 2, z0).p, onBand(below, th - gap / 2, z0).p));
      const C = U.map((u) => { const b = onBand(below, th, z0 - Ls * u), tg = unit(cross([0, 0, 1], b.n)); return add(add(b.p, mul(b.n, 0.012 * k)), mul(tg, sway * u * u)); });
      // (the top a hem's share, the strip narrowing as it tears; a short one is the hem's piece, its end torn off)
      const w0 = Math.max(ds * 0.58, w[0]), W = U.map((u) => r3(w0 * (1 - (long ? 0.55 : 0.1) * u) * (0.85 + 0.25 * rand())));
      const name = `shred${id}${i++}`;
      // (a hem's piece ends torn square, a long strip in a point)
      segments.push(strip(name, C, a.n, W, T, rand, bind(th), long ? 1.2 : 0.35));
      if (id !== 'Hips') chest.push(name);
    }
  };
  const step = (from, to, n) => Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 0.5)) / n + (rand() - 0.5) * 0.12);
  const deg = Math.PI / 180;
  if (spec.chest) hang('Chest', { z0: r3(shoulderZ - 0.07 * k), angles: step(-75 * deg, 75 * deg, 7), odds: spec.chest, L: [0.16 * k * len, 0.4 * k * len], w: [0.02 * k, 0.034 * k], bind: () => ({ bone: 'torso' }) });
  if (spec.back) hang('Back', { z0: r3(shoulderZ - 0.06 * k), angles: step(105 * deg, 255 * deg, 7), odds: spec.back, L: [0.2 * k * len, 0.46 * k * len], w: [0.022 * k, 0.036 * k], bind: () => ({ bone: 'torso' }) });
  // the hips: the strips over the front and the sides follow the thigh on their side down their length
  if (spec.hips) hang('Hips', { z0: r3(hipZ + 0.09 * k), angles: step(-180 * deg, 180 * deg, 12), odds: spec.hips, L: [0.12 * k * len, 0.32 * k * len], w: [0.022 * k, 0.04 * k],
    bind: (th) => { const near = Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < 110 * deg, S = Math.sin(th) >= 0 ? 'R' : 'L';
      return near ? { bone: 'pelvis', blend: { st2: { pelvis: 0.6, [`thigh${S}`]: 0.4 }, st3: { pelvis: 0.3, [`thigh${S}`]: 0.7 }, tip: { [`thigh${S}`]: 1 } } } : { bone: 'pelvis' }; } });
  // the sleeves: a few from each upper arm, hanging off its outside (the arms are posed: built where the rest holds them)
  if (spec.arms) for (const S of ['R', 'L']) {
    const split = !!J['shoulder__L'], sx = S === 'R' ? 1 : -1;
    const mir = (p) => [-p[0], p[1], p[2]], sh = S === 'R' ? J.shoulder : split ? J['shoulder__L'] : mir(J.shoulder), el = S === 'R' ? J.elbow : split ? J['elbow__L'] : mir(J.elbow);
    const ax = unit(sub(el, sh));
    let i = 0;
    for (const t0 of [0.3, 0.5, 0.7]) {
      if (rand() >= spec.arms) continue;
      const o = unit(sub([sx, (rand() - 0.6) * 1.2, 0], mul(ax, dot([sx, 0, 0], ax)))), Ls = (0.08 + 0.12 * rand()) * k * len, w0 = (0.014 + 0.01 * rand()) * k;
      const top = add(add(sh, mul(sub(el, sh), t0)), mul(o, 0.03 * k));
      const C = U.map((u) => add(add(top, mul(o, 0.008 * k * u)), [0, 0, -Ls * u]));
      const W = U.map((u) => r3(w0 * (1 - 0.4 * u) * (0.85 + 0.25 * rand())));
      const name = `shredArm${S}${i++}`;
      segments.push(strip(name, C, o, W, T, rand, { bone: `upperArm${S}` }));
      arms.push(name);
    }
  }
  return { segments, chest, arms };
}
