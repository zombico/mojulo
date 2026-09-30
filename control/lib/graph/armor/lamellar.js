// armor/lamellar — the LAMELLAR family (samurai tōsei-gusoku) as an adornment kit for the hero. Pure data out; no dice.
//
// Lamellar is ROWS held by LACING, and the construction IS the ornament (law 12 over law 11):
//   dō        the cuirass: rows round the torso (wrapped: the dō is hinged, not split), a solid breast plate (munaita),
//             lacing columns, shoulder straps (watagami) with gold fittings
//   sode      the shoulder boards: an anchor plate on the upper arm, pinned to the torso (the arm moves beneath), whose
//             `boards` signature hangs flat laced rows standing off the arm — the square shoulders
//   kusazuri  the hip skirt: six anchor bands at the waist hanging flaring laced boards
//   kote      the armoured sleeve's forearm plate; suneate: splinted greaves
//   kabuto    the bowl (hachi), the peak (mabizashi), the neck guard (shikoro) over the skull's back and on down the
//             neck, the turn-backs (fukigaeshi) framing the face, and the CREST (maedate): the suit's one focal (law 1),
//             directly above the face (law 6), growing fastest with stylize (law 2)
//
// Rows are a SAWTOOTH, never true stacking (`stack: false`): each row's top edge is snug at its own standoff and its
// bottom edge stands out by ~1.4 row thicknesses, so the upper row's lower edge lies over the next row's top edge.
// Stacked, rows piled outward (a dō's top row 15 cm off the chest). Ids carry their carrier's name like every kit's;
// the flag, not the name, is what keeps a piece out of the beneath of those worn after it.
//
// The cranium's `t` is a SLOT INDEX, not an angle: its 16 slots crowd the face (front, bridge, nose, ala, inner, outer,
// side, rear, back = 0 … 8), so the back half is t 5 → 8. The cranium ends at the nose (st0): the neck guard continues
// on the neck, pinned to the cranium so it rides the head.
import { armorProportion } from './principles.js';
import { r4 } from './plate.js';

const lerp = (a, b, t) => a + (b - a) * t;
const HC = 8;   // the cranium's ring half (16 slots, no slotT)

// ORDER (law 9, per family): the crested kabuto is the focal; the dō, then the sode, the skirt, the sleeves, the greaves
export const LAMELLAR_ORDER = Object.freeze([[0.0, 'kabuto'], [0.2, 'do'], [0.4, 'sode'], [0.6, 'kusazuri'], [0.8, 'kote'], [1.0, 'suneate']]);
export const CRESTS = Object.freeze(['crescent', 'kuwagata', 'sun']);

/** a lamellar suit at `dials.coverage` as one kit. opts: crest ('crescent' | 'kuwagata' | 'sun') */
export function lamellarSuit(dials, ctx, { crest = 'crescent' } = {}) {
  const { Ht, Hl, k = 1, height = 1.75 } = ctx; const c = dials.coverage ?? 1;
  const law = armorProportion(dials), s = dials.stylize ?? 0, minF = law.minFeature * height;
  const thick = Math.max(minF, 0.004 * k * law.thick), mug = (m) => r4(m * k * law.standoff);
  const stud = (group = 'Kanamono') => ({ kind: 'studs', j: -1, count: 1, r: r4(Math.max(minF * 0.5, 0.003 * k)), h: r4(Math.max(minF * 0.3, 0.002 * k)), m: 6, group });
  const rows = (n) => Math.max(2, Math.round(n * law.lames));   // law 2: rows fewer and bigger
  const laceGap = lerp(0.07, 0.16, s);                          // lacing: dense (kebiki) → spaced (sugake)
  const cord = (id, part, side, sA, sB, t, mugen, extra = {}) => ({ id, mode: 'strap', part, path: [[r4(sA), r4(t), side], [r4((sA + sB) / 2), r4(t), side], [r4(sB), r4(t), side]],
    width: r4(Math.max(minF * 1.2, 0.006 * k * law.rivet)), thick: r4(Math.max(minF * 0.5, 0.0025 * k)), mugen: r4(mugen), rad: r4(0.004 * k), group: 'Odoshi', stack: false, signature: stud('Odoshi'), ...extra });
  // a stack of sawtooth rows, `sTop` → `sBot` down the piece (either direction in s); `dm` steps each lower row out
  const rowStack = ({ key, part, side, t, sTop, sBot, n, m0, dm = 0, pin, over, nt = 10, cords = 0, tCords }) => {
    const out = [], lace = [], dir = Math.sign(sBot - sTop), step = Math.abs(sBot - sTop) / n, len = step * 1.3;
    for (let i = n - 1; i >= 0; i--) {
      const lo = Math.min(sTop, sBot), hi = Math.max(sTop, sBot), top = sTop + dir * i * step, bot = Math.max(lo, Math.min(hi, top + dir * len)), m = m0 + dm * i;
      out.push({ id: `${key}${i}`, mode: 'shell', part, side, s: [r4(Math.min(top, bot)), r4(Math.max(top, bot))], t, nt, ns: 2, mugen: r4(m), thick, rad: r4(0.01 * k), support: r4(top), ramp: r4((1.4 * thick) / m),
        group: 'Lacquer', rigid: true, stack: false, ...(pin ? { pin } : {}), ...(over ? { over } : {}), signature: stud() });
      if (cords && t !== 'wrap') { const [t0, t1] = tCords || t; for (let q = 0; q < cords; q++) { const tc = t0 + (t1 - t0) * (q + 0.5) / cords;
        lace.push(cord(`${key}o${i}c${q}`, part, side, top + dir * 0.05 * step, bot - dir * 0.08 * step, tc, m + thick * 1.9, pin ? { pin } : {})); } }
    }
    return [...out, ...lace];
  };
  // an anchor plate whose `boards` signature hangs the flat laced rows (a shell can never be a flat board)
  const bThick = r4(Math.max(minF, 0.005 * k * law.thick));
  const hang = (id, part, side, win, pin, P, bottom) => ({ id, mode: 'shell', part, side, s: win.s, t: win.t, nt: 8, ns: 2, mugen: win.mugen, thick: r4(thick * 1.3), rad: r4(0.01 * k), group: 'Lacquer', rigid: true, stack: false, pin,
    signature: { kind: 'boards', group: 'Lacquer', cordGroup: 'Odoshi', bottom, ...P } });
  const mDo = mug(0.007), mHachi = mug(0.012);
  const trace = { rows: {}, worn: [] };
  const PIECES = {
    do: () => { const out = [], nDo = rows(7); trace.rows.do = nDo;
      out.push(...rowStack({ key: 'torso-do', part: 'torso', side: 'R', t: 'wrap', sTop: 2.95, sBot: 1.05, n: nDo, m0: mDo, nt: 16 }));
      for (const S of ['R', 'L']) out.push({ id: `torso-munaita${S}`, mode: 'shell', part: 'torso', side: S, s: [2.72, 3.3], t: [0, r4(0.32 * Ht)], nt: 6, ns: 2, mugen: r4(mDo + thick * 2.2), thick: r4(thick * 1.3), rad: r4(0.01 * k), group: 'Lacquer', rigid: true, stack: false, signature: stud() });
      const nCol = Math.max(3, Math.round(0.9 / laceGap));   // one cord per column, riding the rows' outer skins
      for (const S of ['R', 'L']) for (let q = 0; q < nCol; q++) out.push(cord(`torso-odoshi${S}${q}`, 'torso', S, 2.72, 1.0, (0.05 + 0.9 * (q + 0.5) / nCol) * Ht, mDo + thick * 2.1));
      for (const S of ['R', 'L']) out.push({ id: `torso-watagami${S}`, mode: 'strap', part: 'torso', path: [[3.2, r4(0.22 * Ht), S], [3.85, r4(0.35 * Ht), S], [3.95, r4(0.5 * Ht), S], [3.85, r4(0.65 * Ht), S], [3.2, r4(0.78 * Ht), S]],
        width: r4(0.03 * k), thick: r4(thick * 1.4), mugen: r4(mDo + thick * 2.5), rad: r4(0.01 * k), group: 'Lacquer', stack: false, signature: { kind: 'studs', count: 2, r: r4(Math.max(minF * 0.6, 0.006 * k)), h: r4(Math.max(minF * 0.4, 0.004 * k)), m: 8, group: 'Kanamono' } });
      return out; },
    sode: () => { const nSode = rows(6); trace.rows.sode = nSode;
      return ['R', 'L'].map((S) => hang(`upperArm${S}-sode`, `upperArm${S}`, S, { s: [0.0, 0.22], t: [r4(0.12 * Hl), r4(0.88 * Hl)], mugen: mug(0.02) }, [3.7, r4(0.5 * Ht), S, 'torso'],
        { n: nSode, len: r4(0.3 * k * law.focal ** 0.15), wide: r4(2.4 * law.focal ** 0.2), stand: r4(0.03 * k * law.standoff),   // sode run 25–30 cm, ~2.4× the arm
          dm: r4(0.004 * k * law.flare), tilt: r4(bThick * 1.6), thick: bThick, bow: r4(0.02 * k), widen: 0.05,
          cords: Math.max(2, Math.round(0.45 / laceGap)), cordR: r4(Math.max(minF * 0.6, 0.003 * k * law.rivet)) }, 'jN')); },
    kusazuri: () => { const nKs = rows(5), out = []; trace.rows.kusazuri = nKs;
      for (const S of ['R', 'L']) for (const [p, t] of [['F', [0.02 * Ht, 0.3 * Ht]], ['S', [0.36 * Ht, 0.64 * Ht]], ['B', [0.7 * Ht, 0.98 * Ht]]])
        out.push(hang(`torso-kusazuri${S}${p}`, 'torso', S, { s: [0.35, 0.62], t: t.map(r4), mugen: r4(mDo + thick) }, [0.5, r4((t[0] + t[1]) / 2), S, 'torso'],
          { n: nKs, len: r4(0.26 * k), stand: r4(0.01 * k), dm: r4(0.012 * k * law.flare), tilt: r4(bThick * 1.8), thick: bThick, bow: r4(0.012 * k), widen: 0.06,
            cords: Math.max(2, Math.round(0.3 / laceGap)), cordR: r4(Math.max(minF * 0.6, 0.003 * k * law.rivet)) }, 'j0'));
      return out; },
    kote: () => ['R', 'L'].map((S) => ({ id: `foreArm${S}-kote`, mode: 'shell', part: `foreArm${S}`, side: S, s: [0.4, 1.75], t: [r4(0.15 * Hl), r4(0.85 * Hl)], nt: 8, ns: 2, mugen: mug(0.004), thick, rad: r4(0.02 * k), group: 'Lacquer', rigid: true, signature: stud() })),
    // the splints carry their shank's name, so they stack over the greave plates
    suneate: () => ['R', 'L'].flatMap((S) => [
      ...[[S, [0, 0.62 * Hl]], [S === 'R' ? 'L' : 'R', [0, 0.35 * Hl]]].map(([sd, tt]) => ({ id: `shank${S}-suneate${sd}`, mode: 'shell', part: `shank${S}`, side: sd, s: [0.25, 1.8], t: tt.map(r4), nt: 6, ns: 3, mugen: mug(0.004), thick, rad: r4(0.02 * k), group: 'Lacquer', rigid: true, signature: stud() })),
      ...[0.12, 0.35, 0.58].map((t) => ({ id: `shank${S}-splint${Math.round(t * 100)}`, mode: 'strap', part: `shank${S}`, path: [[0.3, r4(t * Hl), S], [1.0, r4(t * Hl), S], [1.75, r4(t * Hl), S]], width: r4(Math.max(minF, 0.008 * k)), thick: r4(thick), mugen: r4(mug(0.004) + thick * 1.2), rad: r4(0.004 * k), group: 'Kanamono', signature: stud() }))]),
    kabuto: () => { const out = [], nSh = rows(4); trace.rows.shikoro = nSh;
      out.push({ id: 'cranium-hachi', mode: 'shell', part: 'cranium', side: 'R', s: [4.3, 8], t: 'wrap', nt: 16, ns: 5, mugen: mHachi, thick: r4(thick * 1.2), rad: r4(0.01 * k), group: 'Lacquer', rigid: true, stack: false, signature: stud() });
      const nShTop = Math.max(1, Math.round(nSh / 2)), nShLow = Math.max(1, nSh - nShTop), mShLow = r4(mHachi + thick * 1.5 + 0.014 * k * law.flare * nShTop);
      for (const S of ['R', 'L']) {
        out.push(...rowStack({ key: `cranium-shikoro${S}`, part: 'cranium', side: S, t: [5.0, 8.0], sTop: 4.5, sBot: 0.0, n: nShTop, m0: r4(mHachi + thick * 1.5), dm: r4(0.014 * k * law.flare), nt: 8, cords: Math.max(2, Math.round(0.45 / laceGap)), tCords: [5.2, 7.8] }));
        out.push(...rowStack({ key: `neck-shikoro${S}`, part: 'neck', side: S, over: ['torso'], pin: [4.4, 6.5, S, 'cranium'], t: [1.4, 4.0], sTop: 2.0, sBot: 0.0, n: nShLow, m0: r4(mShLow + 0.03 * k), dm: r4(0.022 * k * law.flare), nt: 8, cords: Math.max(2, Math.round(0.45 / laceGap)), tCords: [1.6, 3.8] }));
      }
      for (const S of ['R', 'L']) out.push({ id: `cranium-fukigaeshi${S}`, mode: 'shell', part: 'cranium', side: S, s: [3.0, 4.6], t: [4.4, 5.4], nt: 4, ns: 3, mugen: r4(mHachi + thick * 2 + 0.01 * k * law.focal ** 0.5), thick: r4(thick * 1.2), rad: r4(0.01 * k), support: 4.6, ramp: r4(1.2 * law.flare), group: 'Lacquer', rigid: true, stack: false, signature: stud('Kanamono') });
      const crestSig = { kind: 'crest', shape: crest, w: r4(0.16 * k * law.focal), z: r4(0.05 * k * law.focal ** 0.8), r: r4(0.014 * k * law.focal), minR: r4(minF * 0.6), group: 'Crest' };
      for (const S of ['R', 'L']) out.push({ id: `cranium-mabizashi${S}`, mode: 'shell', part: 'cranium', side: S, s: [4.1, 4.9], t: [0, 3.2], nt: 5, ns: 2, mugen: r4(mHachi + thick * 1.5), thick: r4(thick * 1.2), rad: r4(0.03 * k), support: 4.9, ramp: r4(1.2 * law.flare), group: 'Lacquer', rigid: true, stack: false,
        signature: S === 'R' ? crestSig : stud() });
      return out; },
  };
  const kit = [];
  for (const [th, piece] of LAMELLAR_ORDER) if (c >= th - 1e-9) { trace.worn.push(piece); kit.push(...PIECES[piece]()); }
  return { kit, trace: { ...trace, pieces: trace.worn.length, focal: `crest:${crest}` } };
}
