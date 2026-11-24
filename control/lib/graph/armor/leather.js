// armor/leather — the LEATHER family: hardened or soft hide, cut, stitched, laced and studded, as an adornment kit for
// the hero (station-loft-adorn.js modes). Pure data out; no dice.
//
// Leather is SEAMS AND FASTENINGS, never plates (law 12): the cuirass is one moulded body (a jerkin's or a boiled-leather
// cuirass's) whose edges are welted in a darker hide; it closes with laces or buckled straps, not hinges, and a studded
// coat carries its rivets in rows across the field. Its pieces are fewer and softer than plate's (a broad radius, little
// flare): rounded shoulder caps of two layers, laced bracers, a wide belt, hanging strips (pteruges) at the hips, laced
// greaves and a raised collar.
//
//   language: { cut: 'jerkin' (soft, laced up the front) | 'cuirass' (boiled and moulded, buckled at the sides),
//               studs: 0–3 (rows of rivets across the field: a studded coat) }
//   groups:   Leather (the hide), Welt (the darker edges and caps), Lace (the laces and strips' ties), Rivet (studs),
//             Buckle; the welt and lace finish as leather (materials/dress-materials.js), the studs as metal
//
// Addresses as plate.js: torso stations `s` 0 (hips) → 4 (neck), the ring parameter `t` in the halves Ht and Hl.
import { armorProportion } from './principles.js';
import { r4 } from './plate.js';

export const LEATHER_CUTS = Object.freeze(['jerkin', 'cuirass']);
// ORDER (law 9, per family): the cuirass first (it is what reads as leather), then the shoulders, the arms, the belt and
// strips, the legs and the collar
export const LEATHER_ORDER = Object.freeze([[0.0, 'cuirass'], [0.2, 'caps'], [0.35, 'bracer'], [0.5, 'belt'], [0.6, 'strips'], [0.75, 'greave'], [0.9, 'collar']]);

/** a leather suit at `dials.coverage` as one kit. opts: cut ('jerkin' | 'cuirass'), studs (0–3 rows) */
export function leatherSuit(dials, ctx, { cut = 'jerkin', studs = 0 } = {}) {
  const { Ht, Hl, k = 1, height = 1.75 } = ctx; const c = dials.coverage ?? 1;
  const law = armorProportion(dials), minF = law.minFeature * height, orn = dials.ornament ?? 1;
  const hard = cut === 'cuirass', thick = Math.max(minF, (hard ? 0.006 : 0.004) * k * law.thick), mug = (m) => r4(m * k * law.standoff);
  const hide = (o) => ({ mode: 'shell', nt: 12, ns: 3, thick, rad: r4((hard ? 0.05 : 0.08) * k), group: 'Leather', rigid: hard, ...o });
  const rivet = (n, j = 0, group = 'Rivet') => ({ kind: 'studs', j, count: Math.max(1, n), r: r4(Math.max(minF * 0.6, 0.0045 * k * law.rivet)), h: r4(Math.max(minF * 0.4, 0.003 * k * law.rivet)), m: 8, group });
  // a welt: a narrow strap of the darker hide along a row of a piece, stitched (its signature a row of small studs: the stitches)
  const welt = (id, part, s, t, side, w = 0.014) => ({ id, mode: 'strap', part, path: Array.from({ length: 7 }, (_, i) => [r4(s), r4(t[0] + (t[1] - t[0]) * (0.02 + 0.96 * i / 6)), side]),
    width: r4(Math.max(minF * 1.5, w * k)), thick: r4(thick * 1.3), mugen: 0.0008, rad: r4(Math.max(minF, 0.008)), group: 'Welt',
    signature: { kind: 'studs', count: Math.max(2, Math.round(5 * law.lames)), r: r4(Math.max(minF * 0.4, 0.0018 * k)), h: r4(Math.max(minF * 0.25, 0.001 * k)), m: 4, group: 'Lace' } });
  // a lace: a cord zigzagging between two lines `tA`, `tB` down `s0` → `s1` (a jerkin's front, a bracer's inside)
  const lace = (id, part, side, s0, s1, tA, tB, n, mugen) => ({ id, mode: 'strap', part, path: Array.from({ length: 2 * n + 1 }, (_, i) => [r4(s0 + (s1 - s0) * i / (2 * n)), r4(i % 2 ? tB : tA), side]),
    width: r4(Math.max(minF, 0.004 * k)), thick: r4(Math.max(minF * 0.5, 0.0025 * k)), mugen: r4(mugen), rad: r4(0.004 * k), group: 'Lace', stack: false,
    signature: { kind: 'studs', count: 2, r: r4(Math.max(minF * 0.5, 0.003 * k)), h: r4(Math.max(minF * 0.3, 0.002 * k)), m: 6, group: 'Rivet' } });
  const buckle = (id, part, s, side, tA, tB) => ({ id, mode: 'strap', part, path: [[s, r4(tA), side], [s, r4((tA + tB) / 2), side], [s, r4(tB), side]], width: r4(0.02 * k), thick: r4(0.004 * k), mugen: 0.001, rad: r4(0.05 * k), group: 'Welt',
    signature: { kind: 'buckle', w: r4(0.014 * k), h: r4(0.012 * k), bar: r4(Math.max(minF * 0.5, 0.0025 * k)), standoff: r4(0.003 * k), group: 'Buckle' } });
  const mC = mug(hard ? 0.006 : 0.005);
  const nStud = Math.max(0, Math.min(3, studs)) * (orn >= 1 ? 1 : 0);
  const PIECES = {
    cuirass: () => { const out = [];
      // the body: front and back of one hide, open at the front for a jerkin's laces
      if (hard) out.push(hide({ id: 'torso-cuirass', part: 'torso', s: [1.0, 3.15], t: 'wrap', nt: 16, ns: 4, mugen: mC, signature: rivet(2 + orn, 0) }));
      else for (const S of ['R', 'L']) out.push(hide({ id: `torso-jerkin${S}`, part: 'torso', side: S, s: [0.95, 3.4], t: [r4(0.035 * Ht), Ht], nt: 12, ns: 5, mugen: mC, signature: rivet(1 + orn, 0) }));
      // the yoke: the hide over the shoulders, from the neck's foot down onto the chest and the back (it covers what the
      // torso's own stations leave to the shoulders' joints)
      out.push(hide({ id: 'neck-yoke', mode: 'band', part: 'neck', over: ['torso'], pin: [3.9, 0, 'R', 'torso'], s: [0.0, 1.0], t: 'wrap', nt: 14, ns: 4, mugen: mug(0.003), support: 0.0, ramp: r4(0.45 * law.flare), signature: rivet(1 + orn, -1) }));
      // the welted hem and neckline (a cuirass's moulded edge, a jerkin's turned one)
      for (const S of ['R', 'L']) { out.push(welt(`torso-hemWelt${S}`, 'torso', hard ? 1.04 : 0.99, [0, Ht], S)); out.push(welt(`torso-neckWelt${S}`, 'torso', hard ? 3.1 : 3.35, [r4(0.04 * Ht), Ht], S)); }
      // the closure: laces up a jerkin's front; buckled straps under a cuirass's arms
      if (!hard) out.push(lace('torso-frontLace', 'torso', 'R', 1.1, 3.05, r4(0.035 * Ht), r4(0.035 * Ht), Math.max(3, Math.round(6 * law.lames)), mC + thick * 1.5),
        lace('torso-frontLaceL', 'torso', 'L', 1.1, 3.05, r4(0.035 * Ht), r4(0.035 * Ht), Math.max(3, Math.round(6 * law.lames)), mC + thick * 1.5));
      else for (const S of ['R', 'L']) for (const sz of [1.3, 1.8]) out.push(buckle(`torso-side${S}${Math.round(sz * 10)}`, 'torso', sz, S, 0.42 * Ht, 0.58 * Ht));
      // a studded coat: rows of rivets across the field (ghosts: the rows carry their studs, the hide draws itself)
      for (let q = 0; q < nStud; q++) { const sq = r4(1.4 + q * 0.5);
        for (const S of ['R', 'L']) out.push({ id: `torso-studs${S}${q}`, mode: 'strap', part: 'torso', path: [[sq, r4(0.1 * Ht), S], [sq, r4(0.3 * Ht), S], [sq, r4(0.5 * Ht), S], [sq, r4(0.7 * Ht), S], [sq, r4(0.9 * Ht), S]],
          width: r4(Math.max(minF, 0.004 * k)), thick: r4(minF * 0.3), mugen: r4(mC + thick), rad: r4(0.004 * k), group: 'Leather', ghost: true, stack: false, signature: rivet(Math.round(7 * law.lames), 0) }); }
      return out; },
    // two rounded layers on each shoulder, the upper over the lower (worn last, so it lies over it), each welted
    caps: () => ['R', 'L'].flatMap((S) => { const arm = `upperArm${S}`;
      return [hide({ id: `${arm}-capLow`, part: arm, side: S, s: [0.3, 0.85], t: [r4(0.1 * Hl), r4(0.9 * Hl)], nt: 8, ns: 2, mugen: mug(0.002), support: 0.3, ramp: r4(0.12 * law.flare), signature: rivet(1 + orn, -1) }),
        hide({ id: `${arm}-cap`, part: 'torso', over: [arm], side: S, s: [2.85, 3.6], t: [r4(0.3 * Ht), r4(0.7 * Ht)], nt: 10, ns: 4, mugen: mug(0.003), group: 'Welt', support: 3.6, ramp: r4(0.18 * law.flare), signature: rivet(2 + orn, 0) })]; }),
    // a bracer laced down its inside
    bracer: () => ['R', 'L'].flatMap((S) => [hide({ id: `foreArm${S}-bracer`, part: `foreArm${S}`, s: [0.5, 1.65], t: 'wrap', mugen: mug(0.003), signature: rivet(1 + orn, -1) }),
      lace(`foreArm${S}-bracerLace`, `foreArm${S}`, S, 0.6, 1.55, r4(0.42 * Hl), r4(0.58 * Hl), 4, mug(0.003) + thick * 1.6)]),
    belt: () => [hide({ id: 'torso-belt', mode: 'band', part: 'torso', s: [0.72, 1.02], t: 'wrap', nt: 16, ns: 2, mugen: r4(mC + thick * 1.2), group: 'Welt', rigid: false, signature: { kind: 'buckle', j: 1, w: r4(0.03 * k), h: r4(0.026 * k), bar: r4(Math.max(minF * 0.5, 0.004 * k)), standoff: r4(0.004 * k), group: 'Buckle' } })],
    // pteruges: strips hung from the belt round the hips, front, sides and back
    strips: () => { const out = [], n = Math.max(2, Math.round(3 * law.lames));
      for (const S of ['R', 'L']) for (const [p, t0, t1] of [['F', 0.04, 0.3], ['S', 0.36, 0.64], ['B', 0.7, 0.96]])
        out.push({ id: `torso-strips${S}${p}`, mode: 'strap', part: 'torso', path: Array.from({ length: n + 1 }, (_, i) => [0.75, r4((t0 + (t1 - t0) * i / n) * Ht), S]), width: r4(0.02 * k), thick: r4(thick), mugen: r4(mC + thick * 1.6), rad: r4(0.01 * k), group: 'Welt', stack: false,
          signature: { kind: 'tabard', len: r4(0.16 * k * law.focal ** 0.2), thick: r4(thick * 1.2), stand: r4(0.002 * k), tilt: r4(0.006 * k * law.flare), taper: 0.92, group: 'Leather', hem: r4(thick * 1.8), hemGroup: 'Welt' } });
      return out; },
    greave: () => ['R', 'L'].flatMap((S) => [hide({ id: `shank${S}-greave`, part: `shank${S}`, side: S, s: [0.35, 1.7], t: [0, r4(0.75 * Hl)], nt: 10, ns: 3, mugen: mug(0.004), signature: rivet(1 + orn, -1) }),
      lace(`shank${S}-greaveLace`, `shank${S}`, S, 0.45, 1.6, r4(0.7 * Hl), r4(0.78 * Hl), 4, mug(0.004) + thick * 1.4)]),
    collar: () => [hide({ id: 'neck-collar', mode: 'band', part: 'neck', over: ['torso'], pin: [3.95, 0, 'R', 'torso'], s: [0.0, 0.5], t: 'wrap', nt: 12, ns: 2, mugen: mug(0.004), group: 'Welt', support: 0.5, ramp: r4(0.6 * law.flare), signature: rivet(1 + orn, 0) })],
  };
  const kit = [], worn = [];
  for (const [th, piece] of LEATHER_ORDER) if (c >= th - 1e-9 && (!ctx.keep || ctx.keep.includes(piece))) { worn.push(piece); kit.push(...PIECES[piece]()); }
  return { kit, trace: { worn, pieces: worn.length, focal: `cuirass:${cut}`, studs: nStud } };
}
