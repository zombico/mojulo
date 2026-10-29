/**
 * TAILORED FRONT — a tailored jacket's FRONT and SHAPE (the card's `front`, `lapel`, `buttons`, `shoulder`, `waist`, a
 * `tie` and a waistcoat: the expander's `tailoring`), made by the tailor (body-relational-tailor.js) on whatever body wears
 * it: the realistic body's (body-relational-wear.js) and the game body's (authored-tailoring.js):
 *
 *   the TIE      on the shirt from its knot at the collar to the belt
 *   a WAISTCOAT  its V from beside the neck to its top button, its armholes, its buttons down it
 *   the SHAPE    structured shoulders squared on a pad; the waist suppressed toward what the jacket is worn over, or
 *                straight (a sack); the ridge a belt leaves eased into the cloth over it
 *   the FRONT    its V cut from the top button up to the collar, the shirt and the tie showing in it; its lapels and
 *                collar one band along the roll lines and round the back of the neck, shaped by the lapel's word;
 *                CLOSED, the right front over the left (a woman's left over her right), its edge standing on the other
 *                down to the hem (a single front cut away below its last button, the quarters opening on the trousers; a
 *                double front square, its lapels crossing above the buttons); its buttons at the stance, one row or two
 *
 *   tailorFronts(parts, recipe, tailoring, opts) → parts, in place. `parts` the garments worn (and the belts); `recipe`
 *       the body (its `torso`, `pelvis`, `neck` and thighs). opts: `beltZones`, `beltPts` (the belts made: [[zLo, zHi]],
 *       their points); `shoulderZ` the shoulder joint's height; `layer` a layer's step; `jacketOf(G)` the names of a
 *       jacket's pieces on the trunk (default its one tube, `<G>_body` or `<G>_torso`), `shirtOf()` the shirt's
 *       (default `top_body` or `top_torso`); `view(pieces)` those pieces read as one tube (default the one piece); `read(P)`
 *       a skin part as its points are read (default as it is). Each change is made on every piece; every read is of the
 *       view, made again after each change; `read` also gives the garments the jacket is worn over as their points are
 *       read; `collars: false` makes the lapels alone, each its own band, no collar round the back of the neck (the game
 *       body's suit). Pure and deterministic.
 */
import { clearanceOver, cutV, cutOpening, armholes, clearOver, lapelBand, buttonOn, bladeOn, squareShoulders, takeIn, fallStraight, clothWalker, bindRibbon, bindNearest, bridgeRun } from './body-relational-tailor.js';

const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const unitH = (p, c) => { const d = [p[0] - c[0], p[1] - c[1], 0], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, 0]; };
/** a LAPEL's width (m) along its roll line, s 0 at the top button (its foot, where it rolls from the front: `FOOT_W`)
 * … 1 where it meets the collar, the collar's width on past it: the NOTCH (a step at the gorge between the lapel and the collar), the PEAK (the lapel's corner carried up and
 * out past the collar), the SHAWL (one curve into the collar, no step); 'none' no lapel (the stand collar) */
/** points along each roll line (a lapel's rings: 2.7 cm apart over a bust, its flat stretch between two dipped under the cloth) */
const ROLL_N = 30;
const LAPEL_W = 0.075, COLLAR_W = 0.032, FOOT_W = 0.02, ramp = (s, a, b) => Math.max(0, Math.min(1, (s - a) / (b - a)));
const LAPELS = Object.freeze({
  notch: (s) => (s < 0.76 ? FOOT_W + (LAPEL_W - FOOT_W) * ramp(s, 0, 0.76) : s < 0.8 ? LAPEL_W - (LAPEL_W - 0.012) * ramp(s, 0.78, 0.8) : 0.012 + (COLLAR_W - 0.012) * ramp(s, 0.8, 0.84)),
  peak: (s) => (s < 0.72 ? FOOT_W + (LAPEL_W - FOOT_W) * ramp(s, 0, 0.72) : s < 0.8 ? LAPEL_W * (1 + 0.25 * ramp(s, 0.72, 0.8)) : s < 0.815 ? 0.012 + (LAPEL_W * 1.25 - 0.012) * (1 - ramp(s, 0.8, 0.815)) : 0.012 + (COLLAR_W - 0.012) * ramp(s, 0.815, 0.85)),
  shawl: (s) => (s < 0.6 ? FOOT_W + (LAPEL_W - FOOT_W) * Math.sin((Math.PI / 2) * ramp(s, 0, 0.6)) : COLLAR_W + (LAPEL_W - COLLAR_W) * 0.5 * (1 + Math.cos(Math.PI * ramp(s, 0.6, 1)))),
  none: null,
});

/** The tailored fronts (see the head of this file). */
export function tailorFronts(parts, recipe, tailoring, { beltZones = [], beltPts = [], shoulderZ = null, layer = 0.0035,
  jacketOf = (G) => [[`${G}_body`, `${G}_torso`].find((k) => parts[k])].filter(Boolean), shirtOf = () => [Object.keys(parts).find((k) => /^top_(body|torso)$/.test(k))].filter(Boolean),
  view = (Ps) => Ps[0], read = (P) => P, collars = true } = {}) {
  const torso = recipe.parts.torso, neckSkin = recipe.parts.neck, ctr = (st) => mean(Object.values(st.points)), LAYER = layer;
  const jackets = Object.entries(tailoring || {}).filter(([k, T]) => k !== 'tie' && T && (k === 'vest' || T.lapel || T.shoulder || T.waist)), sgn = tailoring?.over === 'left' ? -1 : 1;
  if (torso && (jackets.length || tailoring?.tie)) {
    const ts = torso.stations[Math.floor(torso.stations.length / 2)], tc = ctr(ts), zWaist = ctr(torso.stations[0])[2];
    const front = (() => { const f = ts.points.front ?? ts.points[torso.slots[0]], d = [f[0] - tc[0], f[1] - tc[1], 0], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l, 0]; })();
    const dir = (deg) => { const a = (deg * Math.PI) / 180; return [front[0] * Math.cos(a) + Math.sin(a), front[1] * Math.cos(a), 0]; };
    const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
    // a cloth's SURFACE (with `extra` points: the neck above a jacket): a point's place on it and its normal, a point on
    // its front at a lateral `x` (its direction round the ring found so it lands there), its top and its bottom
    const surfaceOf = (P, extra = []) => {
      const C = P.stations.map(ctr).sort((u, v) => u[2] - v[2]), shell = clearanceOver([...pointsOf(P), ...extra]);
      const cAt = (z) => { if (z <= C[0][2]) return C[0]; for (let i = 1; i < C.length; i++) if (C[i][2] >= z) { const f = (z - C[i - 1][2]) / (C[i][2] - C[i - 1][2] || 1); return C[i - 1].map((v, q) => v + (C[i][q] - v) * f); } return C[C.length - 1]; };
      // (where no cloth lies along the ray, a neckline cut lower at the front, the ring's own mean radius there)
      const RR = P.stations.map((st) => { const c = ctr(st); return [c[2], P.slots.reduce((t, sl) => t + Math.hypot(st.points[sl][0] - c[0], st.points[sl][1] - c[1]), 0) / P.slots.length]; });
      const ringR = (z) => RR.reduce((b, x) => (Math.abs(x[0] - z) < Math.abs(b[0] - z) ? x : b))[1];
      const surface = (p) => { const c = cAt(p[2]), d = unitH(p, c), r = shell([c[0], c[1], p[2]])(d) || ringR(p[2]) || Math.hypot(p[0] - c[0], p[1] - c[1]); return [[c[0] + d[0] * r, c[1] + d[1] * r, p[2]], d]; };
      const onFront = (x, z) => { const c = cAt(z); let q = surface([c[0] + front[0], c[1] + front[1], z])[0];
        for (let it = 0; it < 3; it++) { const r = Math.hypot(q[0] - c[0], q[1] - c[1]) || 0.1, sn = Math.max(-0.95, Math.min(0.95, (x - c[0]) / r)), cs = Math.sqrt(1 - sn * sn); q = surface([c[0] + front[0] * cs + sn, c[1] + front[1] * cs, z])[0]; }
        return q; };
      return { cAt, surface, onFront, zTop: C[C.length - 1][2], zBot: C[0][2] };
    };
    const zs = (a, b, n) => Array.from({ length: n }, (_, k) => a + ((b - a) * k) / (n - 1));
    // THE TIE: down the shirt's front from the collar to the belt, its knot a block, its blade widening to a point
    const shirts = shirtOf().filter((k) => parts[k]), shirt = shirts.length ? view(shirts.map((k) => parts[k])) : null;
    let tiePts = null;
    if (tailoring?.tie && shirt) {
      const W = surfaceOf(shirt), z0 = W.zTop - 0.012, z1 = zWaist - 0.035, Z = zs(z0, z1, Math.max(8, Math.round((z0 - z1) / 0.01)));
      const width = Z.map((z) => (z > z0 - 0.04 ? 0.036 - 0.01 * ramp(z0 - z, 0, 0.04) : z > z1 + 0.05 ? 0.034 + 0.048 * ramp(z0 - 0.04 - z, 0, z0 - 0.09 - z1) : 0.082 * ramp(z - z1, 0, 0.05)));
      const thick = Z.map((z) => (z > z0 - 0.04 ? 0.011 : 0.0035));
      const tie = bladeOn(Z.map((z) => W.onFront(0, z)), width, thick, W.surface);
      if (tie) { parts.tie_torso = { ...tie, group: tailoring.tie.group ?? 'Tie', bind: bindRibbon(tie, shirt) }; tiePts = pointsOf(tie); }
    }
    const skinPts = ['torso', 'pelvis', 'neck', 'thighR', 'thighL'].map((k) => recipe.parts[k]).filter(Boolean).map(read).flatMap(pointsOf);
    let vestPts = null;
    const under = clearanceOver(skinPts), shirtGroup = shirt ? shirt.group ?? 'Top' : 'Skin';
    // (the neck above a jacket, 6 mm out: the surface its collar and its V's top are found on)
    const neckPts = neckSkin ? read(neckSkin).stations.flatMap((st) => { const c = ctr(st); return Object.values(st.points).map((p) => { const d = unitH(p, c); return [p[0] + d[0] * 0.006, p[1] + d[1] * 0.006, p[2]]; }); }) : [];
    for (const [G, T] of jackets) {
      // (the jacket's pieces, each worked as it is, and read as one tube: `view`, made again after each change)
      const names = jacketOf(G).filter((k) => parts[k]), Js = names.map((k) => parts[k]), each = (f) => Js.forEach(f), J = () => view(Js);
      if (!Js.length) continue;
      // (closed over the tie: the jacket carried out over it before it is cut)
      if (tiePts) each((P) => clearOver(P, tiePts, { gap: LAYER }));
      // THE WAISTCOAT: its V from beside the neck (nearer the front than a jacket's roll lines, so the waistcoat shows
      // between them) to its top button on the chest, the shirt and the tie showing
      // in it; its buttons down the middle to 3 cm over its hem (two rows, double-breasted); no lapel and no collar. The
      // jacket made after it is worn over it, and its own V shows the waistcoat's
      if (G === 'vest') {
        const { cAt, surface, onFront, zTop, zBot } = surfaceOf(J(), neckPts), zS = zWaist + 0.2, n = T.buttons, step = n > 1 ? (zS - 0.012 - (zBot + 0.03)) / (n - 1) : 0;
        const cTop = cAt(zTop), zC = zTop + 0.012, NP = (deg) => surface([cTop[0] + dir(deg)[0], cTop[1] + dir(deg)[1], zC])[0], NR = NP(45), NL = NP(-45);
        each((P) => cutV(P, under, { front, apex: [0, zS], necks: [[NR[0], NR[2]], [NL[0], NL[2]]], open: false, openHalf: 0, apexHalf: 0, group: shirtGroup, floor: 0.02 }));
        // (its armholes, painted: from 12 cm under the shoulder joint at the side seam up to a strap 5.5 cm out past the neck's side)
        const zSh = shoulderZ ?? zTop - 0.05;
        each((P) => armholes(P, { zArm: zSh - 0.12, zTop: zSh + 0.02, xIn: Math.abs(NR[0] - cTop[0]) + 0.055, group: shirtGroup, onto: shirt }));
        vestPts = Js.flatMap(pointsOf);
        const cols = T.front === 'double' ? [-0.045, 0.045] : [0];
        for (let i = 0; i < n; i++) for (const [j, x] of cols.entries()) {
          const at = onFront(x, zS - 0.012 - i * step), nrm = unitH(at, cAt(at[2])), b = buttonOn(at.map((v, q) => v + nrm[q] * 0.0015), nrm);
          parts[`${G}Button${i}${cols.length > 1 ? 'RL'[j] : ''}_torso`] = { ...b, group: 'Button', bind: bindNearest(b, J()) };
        }
        continue;
      }
      // ITS SHAPE: STRUCTURED shoulders squared on a pad (the straight line from the neck's point at 18°, 4 mm past the
      // widest ring, square down to it: farther, and the shoulder stands out past the sleeve's head under it); the waist SUPPRESSED (drawn in toward what it is worn over, the
      // shirt, the tie, the trousers or the skirt) or STRAIGHT (a sack: from the chest to the hip, its hollow bridged)
      const rings = Js.flatMap((P) => P.stations.map((st) => ({ c: ctr(st), w: Math.max(...P.slots.map((sl) => Math.abs(st.points[sl][0] - ctr(st)[0]))) }))).sort((u, v) => u.c[2] - v.c[2]);
      const top = rings[rings.length - 1], widest = rings.filter((g) => g.c[2] > zWaist + 0.15).reduce((b, g) => (g.w > b.w ? g : b), top);
      if (T.shoulder === 'structured' && widest !== top) each((P) => squareShoulders(P, { xN: top.w * 0.7, zN: top.c[2], xA: widest.w + 0.004, zA: widest.c[2], slope: 0.33 }));
      // (what it is worn over: the garments before it, the tie, the belt made on them)
      const worn = [...Object.entries(parts).filter(([k, P]) => !k.startsWith(`${G}_`) && !names.includes(k) && (P.garment || k === 'tie_torso') && /_(body|torso|pelvis)$/.test(k)).flatMap(([, P]) => pointsOf(read(P))), ...beltPts];
      if (T.waist === 'suppressed' && worn.length) { const w = clearanceOver(worn); each((P) => takeIn(P, w, { z: zWaist + 0.02, span: 0.11, depth: 0.8, gap: LAYER })); }
      // (over a belt, the ridge it leaves eased into the cloth above and below it, before the front is cut)
      for (const [zLo, zHi] of beltZones) each((P) => bridgeRun(P, { passes: 10, keep: 1, range: [zLo - 0.06, zHi + 0.06], around: false }));
      if (T.waist === 'straight') each((P) => fallStraight(P, { z0: widest.c[2] - 0.12, z1: zWaist - 0.12 }));
      if (!T.lapel) continue;
      // (over a waistcoat its V's walls read as the waistcoat, which shows beside them, not as the shirt)
      const wallGroup = vestPts ? parts.vest_body?.group ?? parts.vest_torso?.group ?? shirtGroup : shirtGroup;
      const double = T.front === 'double', n = T.buttons, closed = !T.open;
      // the STANCE: the top button's height (two a little above the waist, one under it, three higher); the front
      // worn over's EDGE, closed, past the middle on the other side (a man's right front over his left, `sgn` +1; a
      // woman's left over her right, −1; a double front's past the far row of buttons); OPEN, the fronts `h` apart
      const step = double ? 0.09 : 0.1;
      let zS = zWaist + (double ? 0.03 : { 1: -0.01, 2: 0.02, 3: 0.07 }[n] ?? 0.02), zB = zS - (n - 1) * step;
      const xE = closed ? -sgn * (double ? 0.085 : 0.02) : 0, h = closed ? 0 : 0.035;
      // the jacket's SURFACE before the cut (and the neck above it)
      const shaped = J(), { cAt, surface, onFront, zTop, zBot } = surfaceOf(shaped, neckPts), { across } = clothWalker(shaped);
      // (a short jacket, a tailcoat's or a spencer's cut at the waist: the stance raised till its last button is on the
      // cloth, 3 cm over the hem; off it, the front has no surface to lie on)
      if (zB < zBot + 0.03) { zS += zBot + 0.03 - zB; zB = zBot + 0.03; }
      // the ROLL LINES: from their feet at the stance up to where the collar meets them, at the side of the neck (a
      // double front's left lapel goes down under the right front to its own button, so the two cross above the stance)
      const zC = zTop + 0.012, cTop = cAt(zTop), NP = (deg) => surface([cTop[0] + dir(deg)[0], cTop[1] + dir(deg)[1], zC])[0], NR = NP(65), NL = NP(-65);
      const footOver = [xE, zS], footUnder = double && closed ? [-xE * 0.76, zS] : footOver;
      const footR = closed ? (sgn > 0 ? footOver : footUnder) : [h, zS], footL = closed ? (sgn > 0 ? footUnder : footOver) : [-h, zS];
      const tX = double && closed ? (footL[0] - footR[0]) / ((NR[0] - footR[0]) - (NL[0] - footL[0])) : 0, apex = [footR[0] + (NR[0] - footR[0]) * tX, zS + (zC - zS) * tX];
      const line = (from, N, t0 = 0) => zs(t0, 1, ROLL_N).map((t) => { const x = from[0] + (N[0] - from[0]) * t, z = from[1] + (N[2] - from[1]) * t; return onFront(x, z); });
      const shape = LAPELS[T.lapel];
      if (shape) {
        each((P) => cutV(P, under, { front, apex: closed ? apex : [0, zS], necks: [[NR[0], NR[2]], [NL[0], NL[2]]], open: T.open, openHalf: h, apexHalf: h, group: wallGroup, floor: closed ? 0.02 : 0 }));
        // the COLLAR round the back of the neck, right to left
        const collar = Array.from({ length: 23 }, (_, k) => surface([cTop[0] + dir(65 + (230 * (k + 1)) / 24)[0], cTop[1] + dir(65 + (230 * (k + 1)) / 24)[1], zC])[0]);
        // (the lapel over from its foot; the one under from where it comes out from under the front over it, tapered in
        // there; OPEN, the lapels on down the fronts' edges to the hem, the facing turned back the whole way)
        const tR = sgn > 0 ? 0 : tX, tL = sgn > 0 ? tX : 0, sR = zs(tR, 1, ROLL_N), sL = zs(tL, 1, ROLL_N).reverse(), R = line(footR, NR, tR), L = line(footL, NL, tL).reverse();
        const down = (x, top) => { const Z = zs(zS, zBot + 0.004, Math.max(4, Math.round((zS - zBot) / 0.012))).slice(1).map((z) => onFront(x, z)); return top ? Z.reverse() : Z; };
        const eR = closed ? [] : down(h, true), eL = closed ? [] : down(-h, false), path = [...eR, ...R, ...collar, ...L, ...eL];
        const taper = (k, m, t) => (t ? ramp(k, 0, 6) : 1);
        const width = [...eR.map(() => FOOT_W), ...sR.map((v, k) => shape(v) * taper(k, sR.length, tR)), ...collar.map(() => shape(1)), ...sL.map((v, k) => shape(v) * taper(sL.length - 1 - k, sL.length, tL)), ...eL.map(() => FOOT_W)];
        // (the lapel lies flat on the chest; from the gorge up it turns, and the collar falls down the back)
        // (the collar falls at the back, not at the sides of the neck, where over a squared shoulder it stood out as wings)
        const fall = [...eR.map(() => 0), ...sR.map((v) => 0.25 * ramp(v, 0.78, 1)), ...collar.map((_, k) => 0.25 + 0.5 * Math.sin((Math.PI * (k + 1)) / (collar.length + 1)) ** 2), ...sL.map((v) => 0.25 * ramp(v, 0.78, 1)), ...eL.map(() => 0)];
        if (collars) {
          const band = lapelBand(path, width, surface, { out0: [1, 0, 0], fall, overhang: 0.008, across, lift: 0.003 });
          if (band) parts[`${G}Lapel_torso`] = { ...band, group: T.group ?? 'Lapel', bind: bindRibbon(band, J()) };
        } else {
          // (NO COLLAR: the lapels alone, each its own band from its foot to the gorge, nothing round the back of the neck)
          const nR = eR.length + R.length, nL = L.length + eL.length, start = nR + collar.length;
          for (const [side, from, n, out0] of [['R', 0, nR, [1, 0, 0]], ['L', start, nL, [-1, 0, 0]]]) {
            const band = lapelBand(path.slice(from, from + n), width.slice(from, from + n), surface, { out0, fall: fall.slice(from, from + n), overhang: 0.008, across, lift: 0.003 });
            if (band) parts[`${G}Lapel${side}_torso`] = { ...band, group: T.group ?? 'Lapel', bind: bindRibbon(band, J()) };
          }
        }
      }
      if (closed) {
        // THE EDGE of the right front, standing on the left one from the stance down to the hem: a single front's curved
        // away below its last button (and the left front's edge come out from under it), a double front's square
        const fq = (z) => Math.max(0, (zB - z) / Math.max(0.02, zB - zBot)), xO = (z) => (double ? xE : xE + sgn * 0.09 * fq(z) ** 1.5), xU = (z) => -xE - sgn * 0.09 * fq(z) ** 1.5;
        const zQ = double ? null : zB - (zB - zBot) * ((2 * Math.abs(xE)) / 0.18) ** (2 / 3), edge = (fx, z0, out0, name) => {
          const Z = zs(z0, zBot + 0.004, Math.max(4, Math.round((z0 - zBot) / 0.012))), band = lapelBand(Z.map((z) => onFront(fx(z), z)), Z.map(() => 0.03), surface, { out0, overhang: 0.008, across });
          if (band) parts[`${G}${name}_torso`] = { ...band, group: Js[0].group ?? 'Outer', bind: bindRibbon(band, J()) };
        };
        if (!double) {
          const bottomGroup = Object.keys(parts).some((k) => /^(bottom\w*|skirt)_/.test(k)) ? 'Bottom' : 'Skin';
          each((P) => cutOpening(P, under, (p) => p[2] < zQ && p[0] > Math.min(xO(p[2]), xU(p[2])) && p[0] < Math.max(xO(p[2]), xU(p[2])), { front, group: bottomGroup }));
          edge(xU, zQ, [-sgn, 0, 0], 'EdgeUnder');
        }
        edge(xO, zS, [sgn, 0, 0], 'Edge');
      }
      // the BUTTONS: down the front from the stance (open, on the front under's edge), or two rows
      const cols = double ? [-0.065, 0.065] : [T.open ? -sgn * (h + 0.02) : xE + sgn * 0.02];
      for (let i = 0; i < n; i++) for (const [j, x] of cols.entries()) {
        const at = onFront(x, zS - i * step), nrm = unitH(at, cAt(at[2])), b = buttonOn(at.map((v, q) => v + nrm[q] * 0.0015), nrm);
        parts[`${G}Button${i}${cols.length > 1 ? 'RL'[j] : ''}_torso`] = { ...b, group: 'Button', bind: bindNearest(b, J()) };
      }
    }
  }
  return parts;
}
