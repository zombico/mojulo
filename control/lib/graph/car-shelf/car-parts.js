/**
 * car-parts — what sits on a composed car's body (car-body.js), each set on the body's own surface, read from its
 * sections, so a part holds on any style at any size:
 *
 *   the face      head lamps (round | quad | rect | slim | oval | bar | eyes), a grille (bars | slats | oval | large |
 *                 mesh | closed | slots | smile), a lower intake, fog lamps, a splitter, a skid plate
 *   the tail      tail lamps (round | rect | slim | oval | bar | tower), the exhausts (single | twin | quad), a diffuser,
 *                 a spare wheel on an upright tailgate
 *   the bumpers   body (the shape alone) | black (a plastic band) | chrome (a bright bar standing proud) | steel
 *   the side      a strip down it (chrome | black), flares round the arches
 *   the top       roof rails, a sunroof, racing stripes, a spoiler (lip | roof | ducktail | wing)
 *   an open car   its windscreen in its frame, a dash, its seats in the tub, a steering wheel
 *
 *   carParts(shape, stations, { P, lift, hubs }) → form faces { corners, part, material, albedo, outNormal }
 *
 * A band (a bumper, a lamp wrapping a corner, a strip) follows the body's plan at its heights, offset out along the
 * plan's own normal; a mark on an end (a lamp, a grille) is a polygon on the end cap, just proud of it. Vehicle space
 * (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { CAR_HEX as C, FLARE, face } from './car-common.js';
import { milWheel } from '../car-designer/mil-wheel.js';

const M = (part, material, albedo) => ({ part, material, albedo });
const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);

export function carParts(S, stations, { P, lift }) {
  const D = S.D, Pt = D.parts, Pa = D.paint, Fr = D.frame, out = [], push = (f) => { if (f) out.push(f); };
  const W = Fr.W, front = stations[0], rear = stations[stations.length - 1];
  const bright = Pt.frames === 'chrome' || D.language === 'chrome' ? M('lamp.bezel', 'chrome', C.chrome) : M('lamp.bezel', 'carbon', C.smoke);
  const BODY = M('body', 'paint', Pa.body);
  // ── on an end cap ───────────────────────────────────────────────────────────
  const capOf = (sgn) => (sgn > 0 ? front : rear);
  const capHalf = (sgn, z) => capOf(sgn).xAt(z);
  const capPt = (sgn, x, z, proud) => { const p = P(capOf(sgn), [x, z]); return [p[0], p[1] + sgn * proud, p[2]]; };
  const onCap = (sgn, poly, proud, m) => push(face(poly.map(([x, z]) => capPt(sgn, x, z, proud)), m.part, m.material, m.albedo, [0, sgn, 0]));
  const ring = (cx, cz, rx, rz = rx, n = 16, tilt = 0) => Array.from({ length: n }, (_, i) => { const a = ((i + 0.5) / n) * 2 * Math.PI; const x = rx * Math.cos(a), z = rz * Math.sin(a); return [cx + x, cz + z + tilt * x]; });
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const both = (fn) => { for (const s of [-1, 1]) fn(s); };
  // ── bands: rows of points on the body, offset out along the plan's normal ─────
  const planNormal = (pts, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], t = [b[0] - a[0], b[1] - a[1]];
    let n = [t[1], -t[0]]; const d = Math.hypot(n[0], n[1]) || 1; n = [n[0] / d, n[1] / d];
    return n[0] * pts[i][0] + n[1] * pts[i][1] < 0 ? [-n[0], -n[1]] : n;
  };
  const band = (lo, hi, depth, m, { closed = depth > 0.012 } = {}) => {
    if (lo.length < 2) return;
    const off = (row, i) => { const n = planNormal(row, i); return [row[i][0] + n[0] * depth, row[i][1] + n[1] * depth, row[i][2]]; };
    const LO = lo.map((_, i) => off(lo, i)), HI = hi.map((_, i) => off(hi, i));
    for (let i = 0; i < lo.length - 1; i++) {
      const n = planNormal(lo, i), toward = [n[0], n[1], 0];
      push(face([LO[i], LO[i + 1], HI[i + 1], HI[i]], m.part, m.material, m.albedo, toward));
      if (closed) {
        push(face([hi[i], hi[i + 1], HI[i + 1], HI[i]], m.part, m.material, m.albedo, [0, 0, 1]));
        push(face([lo[i], lo[i + 1], LO[i + 1], LO[i]], m.part, m.material, m.albedo, [0, 0, -1]));
      }
    }
    if (closed) for (const i of [0, lo.length - 1]) { const n = planNormal(lo, i), e = i === 0 ? -1 : 1, t = [lo[Math.min(lo.length - 1, Math.max(0, i + e))][0] - lo[i][0], lo[Math.min(lo.length - 1, Math.max(0, i + e))][1] - lo[i][1]]; push(face([lo[i], LO[i], HI[i], hi[i]], m.part, m.material, m.albedo, [-t[0] + n[0] * 0.01, -t[1] + n[1] * 0.01, 0])); }
  };
  // the plan at height z round an end: the left side from `reach` of the end's length to the cap, across the cap, the
  // right side back (or one side's, from x on the cap), each point on the body
  const endRun = (sgn) => (sgn > 0 ? stations.filter((s) => s.f > 0 && s.f <= S.nl * 1.0001) : stations.filter((s) => s.f < 1 && s.f >= 1 - S.tl * 1.0001).reverse());
  const endPath = (sgn, z, { reach = 0.5, from = null, to = null, side = 0 } = {}) => {
    const run = endRun(sgn).filter((s) => (sgn > 0 ? s.f <= S.nl * reach + 1e-9 : s.f >= 1 - S.tl * reach - 1e-9));
    const e = capHalf(sgn, z), xs = [];
    const x0 = from ?? -e, x1 = to ?? e;
    for (let j = 0; j <= 8; j++) xs.push(x0 + ((x1 - x0) * j) / 8);
    const cap = xs.map((x) => P(capOf(sgn), [x, z]));
    const sideRun = (sx) => run.map((s) => P(s, [sx * s.xAt(z), z]));
    if (side > 0) return [...cap, ...sideRun(1)];
    if (side < 0) return [...sideRun(-1).reverse(), ...cap];
    return from === null && to === null ? [...sideRun(-1).reverse(), ...cap, ...sideRun(1)] : cap;
  };
  const endBand = (sgn, z0, z1, depth, m, opts) => band(endPath(sgn, z0, opts), endPath(sgn, z1, opts), depth, m);
  // ── the ends' measures ────────────────────────────────────────────────────────
  const capTop = (sgn) => Math.min(capOf(sgn).belt, capOf(sgn).zt) - 0.03, capBot = (sgn) => capOf(sgn).zs;
  const bumper = Pt.bumpers, barDepth = ['chrome', 'steel'].includes(bumper) ? 0.06 : bumper === 'black' ? 0.022 : 0;
  const bumpZ = (sgn) => { const b = capBot(sgn); return bumper === 'chrome' ? [b + 0.05, b + 0.15] : bumper === 'steel' ? [b + 0.02, b + 0.2] : [b + 0.03, b + 0.19]; };
  for (const sgn of [1, -1]) {
    const [z0, z1] = bumpZ(sgn);
    if (bumper === 'chrome') endBand(sgn, z0, z1, barDepth, M('bumper', 'chrome', C.chrome), { reach: 0.75 });
    else if (bumper === 'steel') endBand(sgn, z0, z1, barDepth, M('bumper', 'steel', C.steel), { reach: 0.35 });
    else if (bumper === 'black') endBand(sgn, z0, z1, barDepth, M('bumper', 'carbon', C.plastic), { reach: 0.7 });
  }
  const proudOver = barDepth + 0.006;
  // ── the face ────────────────────────────────────────────────────────────────
  {
    const top = capTop(1), [b0, b1] = bumpZ(1), e = (z) => capHalf(1, z);
    const lampH = Pt.lamps === 'bar' ? 0.035 : Pt.lamps === 'slim' ? 0.06 : Pt.lamps === 'eyes' ? 0.2 : Pt.lamps === 'round' || Pt.lamps === 'quad' ? 0.16 : 0.11;
    const lz1 = top - 0.015, lz0 = Math.max(b1 + 0.06, lz1 - lampH), lzc = (lz0 + lz1) / 2;
    const lamp = M('headlamp', 'lamp', C.lamp);
    // a round lamp: its bezel, its lens, the reflector's bowl a shade deeper inside it
    const roundAt = (cx, cz, rr) => { onCap(1, ring(cx, cz, rr + 0.018), 0.004, bright); onCap(1, ring(cx, cz, rr), 0.008, lamp); onCap(1, ring(cx, cz, rr * 0.55, rr * 0.55, 12), 0.01, M('headlamp.bowl', 'lamp', '#c9d3dc')); };
    if (Pt.lamps === 'round') both((s) => { const rr = Math.min(0.085, (lz1 - lz0) / 2); roundAt(s * e(lzc) * 0.66, lzc, rr); });
    else if (Pt.lamps === 'eyes') both((s) => { const rr = Math.min(0.11, (lz1 - lz0) / 2); roundAt(s * e(lzc) * 0.6, lzc, rr); });
    else if (Pt.lamps === 'quad') both((s) => { const rr = Math.min(0.065, (lz1 - lz0) / 2); for (const k of [0.5, 0.8]) roundAt(s * e(lzc) * k, lzc, rr); });
    else if (Pt.lamps === 'rect') both((s) => { const x0 = s * e(lzc) * 0.44, x1 = s * (e(lzc) - 0.06); onCap(1, rect(x0, x1, lz0 - 0.015, lz1 + 0.015), 0.004, bright); onCap(1, rect(x0 + s * 0.015, x1 - s * 0.015, lz0, lz1), 0.008, lamp); });
    else if (Pt.lamps === 'oval') both((s) => { const cx = s * e(lzc) * 0.64, rx = e(lzc) * 0.26, rz = (lz1 - lz0) / 2; onCap(1, ring(cx, lzc, rx + 0.015, rz + 0.015, 16, s * 0.12), 0.004, bright); onCap(1, ring(cx, lzc, rx, rz, 16, s * 0.12), 0.008, lamp); });
    else if (Pt.lamps === 'slim') both((s) => {
      // a smoked housing sweeping out round the corner, its light a line along its top
      const o = { reach: 0.42, side: s, ...(s > 0 ? { from: e(lzc) * 0.36, to: e(lzc) } : { from: -e(lzc), to: -e(lzc) * 0.36 }) };
      band(endPath(1, lz0, o), endPath(1, lz1, o), 0.004, M('lamp.bezel', 'carbon', C.smoke));
      band(endPath(1, lz1 - 0.018, o), endPath(1, lz1, o), 0.007, lamp);
    });
    else if (Pt.lamps === 'bar') endBand(1, lz0, lz1, 0.005, lamp, { reach: 0.5 });
    // the grille, between and below the lamps
    const gTop = Pt.lamps === 'bar' ? lz0 - 0.03 : lz1 - 0.01, gBot = b1 + 0.03, gw = (z) => e(z) * (Pt.lamps === 'round' || Pt.lamps === 'eyes' ? 0.36 : 0.4);
    const dark = M('grille', 'carbon', C.plastic), frame = Pt.frames === 'chrome' || D.language === 'chrome' ? M('grille.frame', 'chrome', C.chrome) : M('grille.frame', 'carbon', '#0e0f11');
    const slats = (x0, x1, z0, z1, n, m, proud = 0.012) => { for (let i = 1; i <= n; i++) { const z = z0 + ((z1 - z0) * i) / (n + 1); onCap(1, rect(x0, x1, z - 0.008, z + 0.008), proud, m); } };
    if (Pt.grille === 'bars') {
      const gz0 = b1 + 0.02, gz1 = Math.min(lz0 + 0.02, gz0 + 0.2), gx = e(gz0) * 0.62;
      onCap(1, rect(-gx - 0.02, gx + 0.02, gz0 - 0.02, gz1 + 0.02), 0.004, frame); onCap(1, rect(-gx, gx, gz0, gz1), 0.007, dark);
      slats(-gx, gx, gz0, gz1, 3, M('grille.bar', 'chrome', C.chrome));
    } else if (Pt.grille === 'slats') {
      const gx = gw(lzc); onCap(1, rect(-gx, gx, lz0, lz1), 0.006, dark); slats(-gx, gx, lz0, lz1, 4, M('grille.slat', 'carbon', '#3a3d41'));
    } else if (Pt.grille === 'oval') {
      const cz = gBot + (lz0 - gBot) * 0.5; onCap(1, ring(0, cz, e(cz) * 0.32, Math.max(0.04, (lz0 - gBot) * 0.42), 18), 0.006, dark);
    } else if (Pt.grille === 'large' || Pt.grille === 'mesh') {
      const q = [[-gw(gBot) * 1.15, gBot], [gw(gBot) * 1.15, gBot], [gw(gTop), gTop], [-gw(gTop), gTop]];
      onCap(1, q.map(([x, z]) => [x * 1.04 + Math.sign(x) * 0.012, z + (z === gTop ? 0.015 : -0.015)]), 0.004, frame);
      onCap(1, q, 0.007, dark);
      if (Pt.grille === 'mesh') for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const zc = gBot + ((gTop - gBot) * (j + 0.5)) / 3, x = -gw(zc) + (2 * gw(zc) * (i + 0.5)) / 6; onCap(1, ring(x, zc, 0.03, 0.022, 6), 0.01, M('grille.mesh', 'carbon', '#33363b')); }
      else slats(-gw(gTop) * 0.95, gw(gTop) * 0.95, gBot, gTop, 2, M('grille.bar', Pt.frames === 'chrome' ? 'chrome' : 'carbon', Pt.frames === 'chrome' ? C.chrome : '#2c2f33'));
    } else if (Pt.grille === 'slots') {
      const gx = gw(lzc) * 0.95, n = 7, w = (2 * gx) / (n * 2 - 1);
      for (let i = 0; i < n; i++) { const x = -gx + i * 2 * w; onCap(1, rect(x, x + w, lz0 - 0.02, lz1), 0.007, dark); }
    } else if (Pt.grille === 'smile') {
      // a small mouth smiling: its upper edge a shallow arc, its lower edge sagging deeper at the middle
      const cz = gBot + 0.05, rx = e(cz) * 0.28, n = 12, at = (t) => -rx + 2 * rx * t;
      const upper = Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [at(t), cz - 0.012 * (1 - (2 * t - 1) ** 2)]; });
      const lower = Array.from({ length: n }, (_, i) => { const t = 1 - i / (n - 1); return [at(t), cz - 0.012 - 0.045 * (1 - (2 * t - 1) ** 2)]; });
      onCap(1, [...upper, ...lower.slice(1, -1)], 0.006, dark);
    } else if (Pt.grille === 'closed') onCap(1, rect(-e(gBot) * 0.3, e(gBot) * 0.3, gBot - 0.01, gBot + 0.012), 0.004, dark);
    // a lower intake in a body-colour or black bumper (the chrome age's grille is the intake)
    if (bumper === 'body' || bumper === 'black') { const iz0 = b0 + 0.03, iz1 = b1 - 0.035, ix = e(iz0) * (Pt.grille === 'closed' ? 0.6 : 0.52); if (iz1 > iz0 + 0.03) onCap(1, rect(-ix, ix, iz0, iz1), proudOver, dark); }
    if (Pt.fogs) both((s) => { const cz = (b0 + b1) / 2, cx = s * e(cz) * 0.76; onCap(1, ring(cx, cz, 0.036, 0.036, 10), proudOver, M('foglamp', 'lamp', C.lamp)); });
    if (Pt.splitter) endBand(1, capBot(1) - 0.012, capBot(1) + 0.012, 0.05, M('splitter', 'carbon', C.plastic), { reach: 0.35 });
    if (Pt.skid) { const z = capBot(1), x = capHalf(1, z + 0.05) * 0.55; band(endPath(1, z - 0.005, { from: -x, to: x }), endPath(1, z + 0.08, { from: -x, to: x }), barDepth + 0.025, M('skid', 'chrome', '#9ba0a6')); }
  }
  // ── the tail ────────────────────────────────────────────────────────────────
  {
    const top = capTop(-1), [b0, b1] = bumpZ(-1), e = (z) => capHalf(-1, z), red = M('taillamp', 'tail', C.tail), amber = M('indicator', 'marker', C.amber);
    const tall = top - b1 > 0.55, tz1 = tall ? Math.min(top - 0.06, S.zBelt + 0.02) : top - 0.02, tz0 = Math.max(b1 + 0.05, tz1 - (Pt.tails === 'bar' ? 0.04 : Pt.tails === 'slim' ? 0.07 : 0.12)), tzc = (tz0 + tz1) / 2;
    if (Pt.tails === 'round') both((s) => { for (const k of D.language === 'chrome' ? [0.72] : [0.52, 0.78]) { const rr = Math.min(0.06, (tz1 - tz0) / 2); onCap(-1, ring(s * e(tzc) * k, tzc, rr + 0.014), 0.004, bright); onCap(-1, ring(s * e(tzc) * k, tzc, rr), 0.008, red); } });
    else if (Pt.tails === 'rect') both((s) => { const x0 = s * e(tzc) * 0.5, x1 = s * (e(tzc) - 0.05), xm = x0 + (x1 - x0) * 0.3; onCap(-1, rect(x0, x1, tz0 - 0.012, tz1 + 0.012), 0.004, bright); onCap(-1, rect(xm, x1 - s * 0.012, tz0, tz1), 0.008, red); onCap(-1, rect(x0 + s * 0.012, xm, tz0, tz1), 0.008, amber); });
    else if (Pt.tails === 'oval') both((s) => { onCap(-1, ring(s * e(tzc) * 0.66, tzc, e(tzc) * 0.24, (tz1 - tz0) / 2, 16, -s * 0.08), 0.008, red); });
    else if (Pt.tails === 'slim') both((s) => { const o = { reach: 0.4, side: s, ...(s > 0 ? { from: e(tzc) * 0.4, to: e(tzc) } : { from: -e(tzc), to: -e(tzc) * 0.4 }) }; band(endPath(-1, tz0, o), endPath(-1, tz1, o), 0.006, red); });
    else if (Pt.tails === 'bar') endBand(-1, tz0, tz1, 0.006, red, { reach: 0.45 });
    else if (Pt.tails === 'tower') both((s) => { const z0 = Math.max(b1 + 0.06, S.zBelt - 0.32), z1 = Math.min(top - 0.04, S.zBelt + 0.22), x1 = s * (e((z0 + z1) / 2) - 0.02), x0 = x1 - s * 0.075; onCap(-1, rect(Math.min(x0, x1), Math.max(x0, x1), z0, z1), 0.008, red); });
    if (Pt.exhaust !== 'hidden') {
      const xs = { single: [0.58], twin: [-0.6, 0.6], quad: [-0.7, -0.52, 0.52, 0.7] }[Pt.exhaust], z = b0 - 0.005, rr = Pt.exhaust === 'quad' ? 0.032 : 0.04;
      for (const k of xs) {
        const x = k * e(z + 0.05), y0 = P(rear, [x, z])[1] + 0.12, y1 = P(rear, [x, z])[1] - barDepth - 0.045;
        out.push(...tube([x, z + lift], rr, y0, y1, M('exhaust', 'chrome', C.chrome), M('exhaust.bore', 'seal', '#0b0c0d')));
      }
    }
    if (Pt.splitter) endBand(-1, capBot(-1), capBot(-1) + 0.08, barDepth + 0.015, M('diffuser', 'carbon', C.plastic), { reach: 0.2 });
    if (Pt.spare) {
      const zc = Math.max(b1 + Fr.r + 0.02, (b1 + top) / 2), y0 = P(rear, [0, zc])[1];
      // (a spare wheel on its carrier: the field's lugged tyre on a dark steel rim, its face out of the tailgate)
      out.push(...milWheel({ hub: [0, y0 - 0.13, zc + lift], r: Fr.r * 0.95, width: 0.24, paint: '#2c2f33', axis: [0, -1, 0] }).map((f) => ({ ...f, part: `spare.${f.part}` })));
      out.push(...boxAt([0, y0 - 0.005, zc + lift], [0.09, 0.02, 0.09], M('spare.carrier', 'steel', C.steel)));
    }
  }
  // ── the side ────────────────────────────────────────────────────────────────
  const mid = stations.filter((s) => s.f > S.nl && s.f < 1 - S.tl);
  if (Pt.strip !== 'none') both((sx) => {
    const m = Pt.strip === 'chrome' ? M('strip', 'chrome', C.chrome) : M('strip', 'carbon', C.plastic), h = Pt.strip === 'chrome' ? 0.022 : 0.05, d = Pt.strip === 'chrome' ? 0.008 : 0.016;
    let run = [];
    const flush = () => { if (run.length > 1) band(run.map((s) => P(s, [sx * s.xAt(s.zh - h / 2), s.zh - h / 2])), run.map((s) => P(s, [sx * s.xAt(s.zh + h / 2), s.zh + h / 2])), d, m); run = []; };
    for (const s of mid) { const zh = s.zs + (s.belt - s.zs) * (Pt.strip === 'chrome' ? 0.62 : 0.45); if (s.z0 < zh - h) run.push({ ...s, zh }); else flush(); }
    flush();
  });
  if (Pt.flares) both((sx) => {
    for (const ay of S.axles) {
      const run = stations.filter((s) => Math.abs(s.y - ay) < S.archR + 0.08);
      if (run.length < 2) continue;
      const lo = run.map((s) => P(s, [sx * s.xAt(s.z0), s.z0])), hi = run.map((s) => P(s, [sx * s.xAt(s.z0 + 0.07), s.z0 + 0.07]));
      band(sx > 0 ? lo : lo.slice().reverse(), sx > 0 ? hi : hi.slice().reverse(), FLARE, M('flare', 'carbon', C.plastic));
    }
  });
  // ── the top ─────────────────────────────────────────────────────────────────
  const topZ = (s, x) => {
    const u = s.right.slice(5).concat([[0, s.zt]]), ax = Math.abs(x);
    for (let i = 0; i < u.length - 1; i++) if (ax <= u[i][0] && ax >= u[i + 1][0]) { const t = (u[i][0] - ax) / (u[i][0] - u[i + 1][0] || 1); return u[i][1] + (u[i + 1][1] - u[i][1]) * t; }
    return s.zt;
  };
  const roofRun = stations.filter((s) => s.g > 0.1 && s.f > S.A + 0.015 && s.f < S.B - 0.015 && !s.tub);
  if (Pt.rails && roofRun.length > 2 && !S.open) both((sx) => {
    const run = roofRun.slice(1, -1), pts = run.map((s) => { const x = sx * (s.right[6][0] - 0.06); return P(s, [x, topZ(s, x) + 0.045]); });
    out.push(...rail(pts, 0.028, 0.028, M('rail', 'chrome', '#9ba0a6')));
    for (const s of [run[0], run[run.length - 1]]) { const x = sx * (s.right[6][0] - 0.06), b = P(s, [x, topZ(s, x) - 0.01]); out.push(...rail([b, [b[0], b[1], b[2] + 0.06]], 0.04, 0.07, M('rail.foot', 'carbon', C.plastic))); }
  });
  if (Pt.roof === 'sunroof' && roofRun.length > 2) {
    const f0 = S.A + (S.peak - S.A) * 0.3, f1 = S.peak + (S.B - S.peak) * 0.3, run = roofRun.filter((s) => s.f >= f0 && s.f <= f1), hx = Fr.W * D.lang.roofW * 0.25;
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i], b = run[i + 1], q = (s, x) => { const p = P(s, [x, topZ(s, x) + 0.004]); return p; };
      push(face([q(a, -hx), q(a, hx), q(b, hx), q(b, -hx)], 'glass.sunroof', 'glass', C.glass, [0, 0, 1]));
    }
  }
  if (Pt.stripes !== 'none') {
    const xs = Pt.stripes === 'twin' ? [[-0.24, -0.07], [0.07, 0.24]] : [[-0.13, 0.13]], col = lum(Pa.body) > 380 ? '#1c1d20' : '#eceae3';
    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i], b = stations[i + 1], slope = Math.abs(a.zt - b.zt) / Math.abs(a.y - b.y);
      if (a.tub || b.tub || (a.g > 0.02 && b.g > 0.02 && slope > 0.35)) continue;
      for (const [x0, x1] of xs) push(face([P(a, [x0, topZ(a, x0) + 0.003]), P(a, [x1, topZ(a, x1) + 0.003]), P(b, [x1, topZ(b, x1) + 0.003]), P(b, [x0, topZ(b, x0) + 0.003])], 'stripe', 'paint', col, [0, 0, 1]));
    }
  }
  if (Pt.spoiler !== 'none') {
    const m = Pt.spoiler === 'wing' ? M('spoiler', 'carbon', C.plastic) : BODY, n = 10;
    const across = (s, k, zOff = 0, yOff = 0) => Array.from({ length: n + 1 }, (_, j) => { const x = -k + (2 * k * j) / n, p = P(s, [x, topZ(s, x) + zOff]); return [p[0], p[1] + yOff, p[2]]; });
    if (Pt.spoiler === 'roof') {
      const s = [...stations].reverse().find((q) => q.f <= S.B && q.g > 0.1 && !q.tub);
      if (s) { const k = s.right[6][0] * 0.92, base = across(s, k, 0.01), tip = across(s, k, -0.02, -0.2); slab(base, tip, 0.028, m); }
    } else if (Pt.spoiler === 'wing') {
      const s = stations.find((q) => q.f >= 1 - S.tl - 0.05), k = s.xAt(s.belt) * 0.82;
      for (const sx of [-0.5, 0.5]) { const b = P(s, [sx * k, topZ(s, sx * k)]); out.push(...rail([b, [b[0], b[1] - 0.04, b[2] + 0.2]], 0.03, 0.06, m)); }
      const lead = across(s, k, 0.2, 0.06), trail = across(s, k, 0.23, -0.2);
      slab(lead, trail, 0.025, m);
    } else {
      // a lip, or a ducktail: a wedge across the deck's trailing edge
      const s = stations.find((q) => q.f >= 1 - S.tl * 0.9) ?? rear, k = s.xAt(s.belt) * 0.86, tall = Pt.spoiler === 'ducktail' ? 0.07 : 0.03, deep = Pt.spoiler === 'ducktail' ? 0.12 : 0.06;
      const base = across(s, k, 0), crest = across(s, k, tall, -deep);
      for (let j = 0; j < n; j++) push(face([base[j], base[j + 1], crest[j + 1], crest[j]], 'spoiler', m.material, m.albedo, [0, 0.3, 1]));
      for (let j = 0; j < n; j++) push(face([crest[j], crest[j + 1], [crest[j + 1][0], crest[j + 1][1], base[j + 1][2] - 0.02], [crest[j][0], crest[j][1], base[j][2] - 0.02]], 'spoiler', m.material, m.albedo, [0, -1, 0]));
    }
  }
  function slab(a, b, th, m) {
    const dn = (p) => [p[0], p[1], p[2] - th];
    for (let j = 0; j < a.length - 1; j++) {
      push(face([a[j], a[j + 1], b[j + 1], b[j]], 'spoiler', m.material, m.albedo, [0, 0, 1]));
      push(face([dn(a[j]), dn(a[j + 1]), dn(b[j + 1]), dn(b[j])], 'spoiler', m.material, m.albedo, [0, 0, -1]));
      push(face([b[j], b[j + 1], dn(b[j + 1]), dn(b[j])], 'spoiler', m.material, m.albedo, [0, -1, 0]));
    }
    for (const j of [0, a.length - 1]) push(face([a[j], b[j], dn(b[j]), dn(a[j])], 'spoiler', m.material, m.albedo, [Math.sign(a[j][0]) || 1, 0, 0]));
  }
  // ── an open car: its screen, its dash, its seats, its wheel ──────────────────
  if (S.open && Pt.roof === 'open') {
    const cowl = stations.reduce((b, s) => (Math.abs(s.f - D.style.hood) < Math.abs(b.f - D.style.hood) ? s : b), stations[0]);
    // (the screen's top the class's height, or a screen's height above the cowl: no taller than a driver's eyes need)
    const zc = cowl.zt, zTop = Math.min(Fr.H, zc + 0.42), back = (zTop - zc) * 0.8, hx0 = cowl.xAt(cowl.belt) * 0.9, hx1 = hx0 * 0.9;
    const p0 = (x) => P(cowl, [x, zc]), p1 = (x) => { const q = P(cowl, [x, zTop]); return [q[0], q[1] - back, q[2]]; };
    const glassQ = [p0(-hx0), p0(hx0), p1(hx1), p1(-hx1)];
    // (the screen's glass seen from both sides: its face forward and its face toward the cockpit)
    push(face(glassQ, 'glass', 'glass', C.glass, [0, 1, 0.8]));
    push(face(glassQ.map((p) => [p[0], p[1] - 0.006, p[2] - 0.004]), 'glass.inner', 'glass', C.glass, [0, -1, -0.8]));
    // its frame: a header across its top and a post up each side, bars round the glass's edge
    const fr = Pt.frames === 'chrome' || D.language === 'chrome' ? M('screen.frame', 'chrome', C.chrome) : M('screen.frame', 'carbon', '#121315');
    const [g0, g1, g2, g3] = glassQ;
    out.push(...rail([g3, g2], 0.04, 0.03, fr), ...rail([g0, g3], 0.035, 0.03, fr), ...rail([g1, g2], 0.035, 0.03, fr));
    const yS = (f) => S.y(f), rowsF = D.style.seats === 1 ? [0.5] : [0.33, 0.74], seatX = Math.min(0.3, W * 0.17);
    const zT = S.zTub + lift, dashY = cowl.y - back * 0.35;
    out.push(...boxAt([0, dashY - 0.1, S.zBelt + lift - 0.08], [hx0 * 0.95, 0.12, 0.08], M('dash', 'interior', C.interior)));
    for (const t of rowsF) {
      const yc = yS(S.cockA + (S.cockB - S.cockA) * t);
      for (const sx of [-1, 1]) {
        // a cushion, its back leaning, a headrest: under the screen's top, as a driver's head is
        out.push(...boxAt([sx * seatX, yc, zT + 0.07], [0.22, 0.24, 0.07], M('seat', 'interior', C.seat)));
        out.push(...boxAt([sx * seatX, yc - 0.27, zT + 0.34], [0.22, 0.055, 0.23], M('seat', 'interior', C.seat), -0.3));
        out.push(...boxAt([sx * seatX, yc - 0.36, zT + 0.64], [0.12, 0.05, 0.075], M('seat.headrest', 'interior', C.seat), -0.3));
      }
      if (t === rowsF[0]) out.push(...steering([-seatX, yc + 0.42, S.zBelt + lift - 0.02], 0.17));
    }
  }
  return out;
}

/** A tube along y at (x, z): its barrel `look`, its end cap `capLook` at the far end (y1). */
function tube([x, z], r, y0, y1, look, capLook, n = 12) {
  const out = [], P = (a, y) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
  for (let i = 0; i < n; i++) { const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n, am = (a0 + a1) / 2; out.push(face([P(a0, y0), P(a1, y0), P(a1, y1), P(a0, y1)], look.part, look.material, look.albedo, [Math.cos(am), 0, Math.sin(am)])); }
  out.push(face(Array.from({ length: n }, (_, i) => P((2 * Math.PI * i) / n, y1)), capLook.part, capLook.material, capLook.albedo, [0, Math.sign(y1 - y0), 0]));
  return out.filter(Boolean);
}
/** A bar of w × h along a path of points (its four sides each segment). */
function rail(pts, w, h, look) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], d = Math.hypot(...t) || 1, T = t.map((v) => v / d);
    let s = [T[1], -T[0], 0]; if (Math.hypot(...s) < 1e-6) s = [1, 0, 0]; const ds = Math.hypot(...s); s = s.map((v) => v / ds);
    const up = [s[1] * T[2] - s[2] * T[1], s[2] * T[0] - s[0] * T[2], s[0] * T[1] - s[1] * T[0]];
    const c = (p, i0, j0) => [p[0] + s[0] * i0 * w / 2 + up[0] * j0 * h / 2, p[1] + s[1] * i0 * w / 2 + up[1] * j0 * h / 2, p[2] + s[2] * i0 * w / 2 + up[2] * j0 * h / 2];
    for (const [i0, j0, i1, j1, n] of [[1, -1, 1, 1, s], [-1, 1, -1, -1, s.map((v) => -v)], [1, 1, -1, 1, up], [-1, -1, 1, -1, up.map((v) => -v)]]) out.push(face([c(a, i0, j0), c(b, i0, j0), c(b, i1, j1), c(a, i1, j1)], look.part, look.material, look.albedo, n));
  }
  return out.filter(Boolean);
}
/** A box at a centre, half sizes (x, y, z), leaning back about x by `lean` radians. */
function boxAt([cx, cy, cz], [hx, hy, hz], look, lean = 0) {
  const c = Math.cos(lean), s = Math.sin(lean), R = ([x, y, z]) => [cx + x, cy + y * c - z * s, cz + y * s + z * c];
  const P = (i, j, k) => R([i * hx, j * hy, k * hz]), out = [];
  const sides = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, -1, 0]], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]]];
  for (const q of sides) { const n = q[4], N = [n[0], n[1] * c - n[2] * s, n[1] * s + n[2] * c]; out.push(face(q.slice(0, 4).map((v) => P(...v)), look.part, look.material, look.albedo, N)); }
  return out.filter(Boolean);
}
/** A steering wheel: a ring facing the driver, tilted back, and its boss. */
function steering([x, y, z], rr) {
  const out = [], n = 14, tilt = 0.45, ct = Math.cos(tilt), st = Math.sin(tilt);
  const P = (a, k) => { const u = rr * k * Math.cos(a), v = rr * k * Math.sin(a); return [x + u, y - v * st * 0.0 + v * st, z + v * ct]; };
  const look = { part: 'steering', material: 'interior', albedo: '#141414' };
  for (let i = 0; i < n; i++) { const a0 = (2 * Math.PI * i) / n, a1 = (2 * Math.PI * (i + 1)) / n; out.push(face([P(a0, 0.84), P(a1, 0.84), P(a1, 1), P(a0, 1)], look.part, look.material, look.albedo, [0, -ct, st])); }
  out.push(face(Array.from({ length: 8 }, (_, i) => P((2 * Math.PI * i) / 8, 0.25)), look.part, look.material, '#2a2a2a', [0, -ct, st]));
  return out.filter(Boolean);
}
