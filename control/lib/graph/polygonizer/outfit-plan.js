/**
 * THE OUTFIT, DESIGNED: what a creature wears as one plan for its whole body (stages 2 and 3 of the dressing flow), from
 * who it is (an Egocube sheet, a reference, or an author) rather than a stock kit by role. A plan's `outfit`:
 *
 *   { intent: { silhouette?, symmetry: 'symmetric' | 'asymmetric', side?: 'R' | 'L', palette: { base, secondary,
 *               trim, accent, leather? } },
 *     pieces: [{ kind, id?, role?: 'focal' | 'support' | 'detail', colour?: 'base' | 'secondary' | 'trim' | 'accent'
 *                | 'leather', why?, …the kind's own settings }] }
 *
 * Each piece is a CATALOGUE word (OUTFIT_KINDS) that knows its layer (L1 base … L7 dangling), its rigidity class, its
 * usual colour role and how it compiles onto the body: fitted cloth (body-garment.js), a tailored skirt (a loft from the
 * waist that rides the pelvis above and each thigh below, its hem flat), or a worn piece (station-loft-adorn.js). Its
 * place is read off the body's own landmarks (the shoulders, the natural waist, the hips, the knees), so the same outfit
 * fits any build.
 *
 *   compileOutfit(plan)        the plan with its outfit compiled in layer order into `garments`, `adorn` and segments,
 *                              and the palette's roles as groups; no `outfit` ⇒ the plan itself
 *   outfitLaws(outfit, ctx)    the VISUAL-INTEREST laws (the Dressing Bible's), advisory: [{ law, ok, why }]
 *     ctx: { order?: 0 bound … 1 free, mustSee?: [families], height?: m, record? }
 */
import { hexLch, lchHex } from './station-loft-shade.js';
import { expandOutfit } from '../outfit/expand.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
export const COLOUR_GROUPS = Object.freeze({ base: 'OutfitBase', secondary: 'OutfitSecond', trim: 'OutfitTrim', accent: 'OutfitAccent', leather: 'Leather', metal: 'OutfitMetal', shade: 'OutfitShade' });
/** the SHADE a plate's inside and its liner are drawn in: the plate's own colour in shadow (darker, duller), so the gap
 * under a plate reads as a hollow, not as more plate */
export const shadeOf = (hex) => { const [L, C, h] = hexLch(hex); return lchHex(Math.max(10, L * 0.42), C * 0.55, h); };

/** A ring's address on its part: `st<k>` is k, a split's `st<a>_st<b>_<pct>` lies pct % of the way from a to b; a ring
 * with no id is addressed by its index. */
export function uOfStation(st, i) {
  const id = st?.id;
  if (typeof id !== 'string') return i;
  let m = id.match(/^st(\d+)$/); if (m) return +m[1];
  m = id.match(/^st(\d+)_st(\d+)_(\d+)$/); if (m) return +m[1] + ((+m[2] - +m[1]) * +m[3]) / 100;
  return i;
}

/** the body's landmarks, read off a creature plan: heights, the torso's and pelvis's rings by height, the size scale */
export function bodyMap(plan) {
  const J = plan.joints || {}, seg = (n) => (plan.segments || []).find((s) => s.name === n);
  const torso = seg('torso'), pelvis = seg('pelvis'), z = (n) => J[n]?.[2];
  // `s` is the part's own address, read off its rings' ids: a refined part (the hero's dense torso, a split inserting
  // `st1_st2_50` between st1 and st2) addresses by its first rings, so its index is not its address; an unrefined one's
  // ids are its indices
  const uOf = (S, i) => uOfStation(S[i], i), uTop = (part) => uOf(part.stations, part.stations.length - 1);
  const ringAt = (part, h) => { const S = part.stations; if (h <= S[0].z) return { s: uOf(S, 0), r: S[0].r, yc: S[0].yc ?? 0 }; for (let i = 0; i + 1 < S.length; i++) if (h <= S[i + 1].z) { const f = (h - S[i].z) / (S[i + 1].z - S[i].z), lerp = (a, b) => (Array.isArray(a) ? a.map((x, k) => x + (b[k] - x) * f) : a + (b - a) * f);
    return { s: lerp(uOf(S, i), uOf(S, i + 1)), r: lerp(S[i].r, S[i + 1].r), yc: lerp(S[i].yc ?? 0, S[i + 1].yc ?? 0) }; } const L = S[S.length - 1]; return { s: uOf(S, S.length - 1), r: L.r, yc: L.yc ?? 0 }; };
  // the natural WAIST: the torso's narrowest ring between the hips and the shoulders
  const waist = torso.stations.filter((st) => st.z > (z('hip') ?? 0) && st.z < (z('shoulder') ?? Infinity)).reduce((a, st) => (!a || rad(st.r) < rad(a.r) ? st : a), null) ?? torso.stations[1];
  const ankle = z('hock') ?? z('ankle') ?? z('toeBase') ?? 0;
  const thigh = seg('thighR'), arm = seg('upperArmR'), neckSeg = seg('neck'), shoulder = z('shoulder');
  // the OUTLINE's landmarks, as half-widths seen from the front: the chest at the shoulder line, the torso at its
  // widest, the arm line (the upper arm's outer side), the hips (the thighs' outer side)
  const chestW = rad(ringAt(torso, Math.min(shoulder, torso.stations[torso.stations.length - 1].z)).r[0] ?? 0.3);
  const torsoW = Math.max(...torso.stations.map((st) => (Array.isArray(st.r) ? st.r[0] : st.r)));
  const armX = Math.abs(J.shoulder?.[0] ?? chestW) + rad(arm?.rA ?? 0.08), hipW = Math.abs(J.hip?.[0] ?? 0.1) + (Array.isArray(thigh?.rA) ? thigh.rA[0] : thigh?.rA ?? 0.1);
  // the trunk's front and back at a height (y forward), and the PLUMB lines cloth hangs on from `top` down: it never
  // goes back in under a bulge above it
  const trunk = [...pelvis.stations, ...torso.stations].map((st) => ({ z: st.z, yc: st.yc ?? 0, ry: Array.isArray(st.r) ? st.r[1] : st.r })).sort((a, b) => a.z - b.z);
  const edgeAt = (h, sign) => { const S = trunk; if (h <= S[0].z) return S[0].yc + sign * S[0].ry; for (let i = 0; i + 1 < S.length; i++) if (h <= S[i + 1].z) { const f = (h - S[i].z) / Math.max(1e-9, S[i + 1].z - S[i].z); return (S[i].yc + sign * S[i].ry) * (1 - f) + (S[i + 1].yc + sign * S[i + 1].ry) * f; } const L = S[S.length - 1]; return L.yc + sign * L.ry; };
  const plumb = (h, top, sign) => { let y = edgeAt(h, sign); for (const st of trunk) if (st.z >= h && st.z <= top) y = sign > 0 ? Math.max(y, st.yc + st.ry) : Math.min(y, st.yc - st.ry); return y; };
  // the HEAD's volume, an ellipsoid round the head and the hair (an anime head is drawn on the mesh, not in the segments),
  // sized off its base and top: the hair rises above the top joint and stands out to its width and depth
  const hb = J.headBase, ht = plan.rig?.joints?.headTop?.at ?? J.headTop, hh = hb ? (ht ? ht[2] - hb[2] : 0.13 * ((z('neckTop') ?? 1.6) / 1.6)) : 0;
  const head = hb ? { at: [hb[0], hb[1], hb[2] + 0.85 * hh].map(r3), r: [1.1 * hh, 1.1 * hh, 0.88 * hh].map(r3) } : null;
  return { names: new Set((plan.segments || []).map((s) => s.name.replace(/[RL]$/, ''))), head, J, torso, pelvis, ringAt, uTop, shoulder, neck: z('neckBase') ?? z('neckTop'), neckTop: z('neckTop'), waist: waist.z, hip: z('hip'), knee: z('knee'), ankle, k: (z('neckTop') ?? 1.6) / 1.6,
    thigh, arm, neckSeg, hasMeta: !!seg('metaR'), chestW, torsoW, armX, hipW, tail: z('tail0') ?? null, top: torso.stations[torso.stations.length - 1], front: (h, top) => plumb(h, top, 1), back: (h, top) => plumb(h, top, -1) };
}

const shell = (id, part, s, extra = {}) => ({ id, mode: 'shell', part, s: s.map(r3), t: 'wrap', nt: 16, ns: 2, ...extra });

/** THE CATALOGUE: each kind's layer, class, colour role and compile (piece, body, groupOf) → { garments?, adorn?, segments? } */
export const OUTFIT_KINDS = Object.freeze({
  // L2: a GOWN, a ROBE, a TUNIC: a fitted bodice and a skirt tailored from the waist to its hem
  gown: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G, I) => gownOf(p, B, G, { hem: 'shin', flare: 0.45 }) },
  robe: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G, I) => gownOf(p, B, G, { hem: 'ankle', flare: 0.25 }) },
  tunic: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G, I) => gownOf(p, B, G, { hem: 'thigh', flare: 0.15 }) },
  // a WIZARD'S ROBE: a robe to the ankle, fuller, its sleeves belled wide at the wrist (`sleeve`, `hood` as a robe's)
  wizardRobe: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G, I) => gownOf(p, B, G, { hem: 'ankle', flare: 0.2, sleeve: 'bell' }) },
  // L3: a CLOAK behind (from the shoulder line, on the back's plumb line, to the calf or above a tail that must read), a
  // COLLAR standing behind the nape (a rise above the shoulders)
  cloak: { layer: 3, cls: 'loose', colour: 'secondary', compile: (p, B, G) => cloakOf(p, B, G) },
  collar: { layer: 3, cls: 'stiff', colour: 'secondary', compile: (p, B, G, I) => { const n = B.neckSeg, nr = n ? (Array.isArray(n.rA) ? n.rA[0] : n.rA) : B.chestW * 0.4, ny = (B.J.neckBase?.[1] ?? 0) - (n ? (Array.isArray(n.rA) ? n.rA[1] : n.rA) : 0.1);
    const z0 = B.top.z - 0.03 * B.k, rise = (p.rise ?? 0.16) * B.k, z1 = (B.neckTop ?? B.top.z) + rise, th = 0.01 * B.k;
    const pts = [[ny - 0.01 * B.k, z0, nr * 1.5], [ny - 0.03 * B.k, z0 + 0.45 * (z1 - z0), nr * 1.9], [ny - 0.06 * B.k, z1, nr * (p.flare ?? 2.5)]];
    return { segments: [boardOf(p.id ?? 'collar', pts, th, G(p), { bone: 'torso', blend: { st2: { torso: 0.7, neck: 0.3 }, tip: { torso: 0.7, neck: 0.3 } } })] }; } },
  // L3: a MANTLE over the shoulders
  mantle: { layer: 3, cls: 'loose', colour: 'secondary', compile: (p, B, G) => { const a = B.ringAt(B.torso, B.shoulder - 0.09 * B.k).s, b = B.uTop(B.torso) - 0.05;
    return { adorn: [shell(p.id ?? 'mantle', 'torso', [a, b], { nt: 16, ns: 3, mugen: r3(0.035 * B.k), thick: r3(0.016 * B.k), group: G(p), ...(p.clasp === false ? { signature: { kind: 'studs', r: r3(0.006 * B.k), h: r3(0.003 * B.k), count: 1, m: 6, group: G(p) } } : { signature: { kind: 'buckle', k: 0, j: 2, w: r3(0.05 * B.k), h: r3(0.04 * B.k), bar: r3(0.008 * B.k), standoff: r3(0.008 * B.k), group: G({ colour: p.claspColour ?? 'trim' }) } }) })] }; } },
  // L5: a SASH at the natural waist, a BELT on the hip line, a BALDRIC across the chest
  // a SASH is cloth (the secondary; the accent, where the chroma is spent, when it is the focal); only its buckle is the
  // trim's metal
  sash: { layer: 5, cls: 'soft', colour: 'secondary', compile: (p, B, G) => { const s = B.ringAt(B.torso, B.waist).s;
    return { adorn: [shell(p.id ?? 'sash', 'torso', [Math.max(0, s - 0.2), s + 0.2], { mugen: r3(0.028 * B.k), thick: r3(0.012 * B.k), group: G({ colour: p.colour ?? (p.role === 'focal' ? 'accent' : 'secondary') }), signature: { kind: 'buckle', k: 0, j: 1, w: r3(0.05 * B.k), h: r3(0.045 * B.k), bar: r3(0.009 * B.k), standoff: r3(0.009 * B.k), group: G({ colour: p.knotColour ?? p.colour ?? 'trim' }) } })] }; } },
  belt: { layer: 5, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [shell(p.id ?? 'belt', 'pelvis', [1.4, 1.85], { nt: 14, mugen: r3(0.02 * B.k), thick: r3(0.014 * B.k), group: G(p), signature: { kind: 'buckle', k: 0, j: 1, w: r3(0.06 * B.k), h: r3(0.05 * B.k), bar: r3(0.01 * B.k), standoff: r3(0.01 * B.k), group: G(p) } })] }) },
  baldric: { layer: 5, cls: 'stiff', colour: 'leather', compile: (p, B, G, I) => { const S = I.side ?? 'R', O = S === 'R' ? 'L' : 'R';
    return { adorn: [{ id: p.id ?? 'baldric', mode: 'strap', part: 'torso', path: [[3.6, 2.2, S], [3.2, 1.2, S], [2.5, 0.45, S], [1.9, 0.05, S], [1.4, 0.5, O], [0.8, 1.3, O], [0.4, 2.0, O]], width: r3(0.06 * B.k), thick: r3(0.01 * B.k), mugen: r3(0.03 * B.k), group: G(p), rad: r3(0.05 * B.k),
      signature: { kind: 'studs', r: r3(0.008 * B.k), h: r3(0.004 * B.k), count: 5, from: 2, m: 6, group: G({ colour: 'trim' }) } }] }; } },
  // L1: WRAPS at the wrists
  wraps: { layer: 1, cls: 'soft', colour: 'secondary', compile: (p, B, G) => ({ adorn: ['R', 'L'].map((S) => ({ id: `${p.id ?? 'wrap'}${S}`, mode: 'band', part: `foreArm${S}`, s: [1.25, 1.75], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.008 * B.k), thick: r3(0.006 * B.k), group: G(p),
    signature: { kind: 'ribbon', k: 0, j: 1, spine: [[0, 0, 0], [0.01 * B.k, -0.02 * B.k, -0.04 * B.k], [0.015 * B.k, -0.03 * B.k, -0.09 * B.k]], width: r3(0.022 * B.k), thick: r3(0.002 * B.k), tip: 'swallow', group: G(p) } })) }) },
  // L4: ARMOUR pieces (rigid; one bone each)
  // ARMOUR AS GAMES DRAW IT (armor/principles.js laws 13–15): a plate stays WITHIN the figure's own width (`within`, its
  // thickness past it at most: no shoulder carried out past the arm), no plate covers a whole part (each piece is
  // SEGMENTED into layered plates shingling away from where it hangs, what it covers showing between), and its ornament
  // is on the EDGE (a trim bead, rivets at a lame's ends) or IN THE SURFACE (an embossed or engraved motif), never a knob
  // on the field. `float: true` (an alien's detached masses) stands the cop off the shoulder by a hand's breadth, still
  // within the figure's width. `shoulder` is kept for the record and no longer broadens.
  pauldron: { layer: 4, cls: 'rigid', colour: 'secondary', compile: (p, B, G, I) => { const th = 0.012 * B.k, mugen = p.float ? 0.045 * B.k : 0.006 * B.k, base = p.id ?? 'pauldron';
    const plate = (S, id, extra) => ({ id, mode: 'shell', side: S, nt: 14, ns: 5, thick: r3(th), edge: 'roll', within: r3(th * 1.5), interior: G({ colour: 'shade' }), group: G(p), rigid: true, rim: { group: G({ colour: 'trim' }), at: 'low', ends: false }, ...extra });
    const sides = I.symmetry === 'symmetric' || p.pair ? ['R', 'L'] : [p.side ?? (I.side === 'R' ? 'L' : 'R')];
    // in the outfit's own cloth (`colour: 'base'`) it is a PAD, not armour: one soft cap, its edge topstitched
    if (p.colour === 'base') return { adorn: sides.map((S) => plate(S, `${base}${S}`, { part: 'torso', over: [`upperArm${S}`], s: capWindow(B), t: [1.1, 2.9], ns: 7, mugen: r3(mugen), thick: r3(0.016 * B.k), wall: r3(0.008 * B.k), crown: r3(0.012 * B.k), rad: r3(0.05 * B.k), support: 3.45, ramp: 0.5, rim: undefined, interior: undefined,
      signature: { kind: 'motif', name: 'dots', mode: 'border', w: r3(0.002 * B.k), lift: r3(0.0006 * B.k), group: G({ colour: 'shade' }) } })) };
    return { adorn: sides.flatMap((S) => [
      // the LAMES down the upper arm, the lowest innermost: each one up stands a plate's thickness further off, so they
      // shingle down from the cop (on the arm, so the arm lifts them; rivets at their ends)
      ...[[0.3, 0.5], [0.16, 0.36], [0.02, 0.22]].map((s, i) => plate(S, `${base}${S}Lame${i}`, { part: `upperArm${S}`, share: true, s, t: [0.1, 0.9], mugen: r3(mugen + i * th * 0.6), crown: r3(0.004 * B.k), rad: r3(0.03 * B.k), support: s[0], ramp: 0.4,
        signature: { kind: 'studs', r: r3(0.005 * B.k), h: r3(0.003 * B.k), count: 2, m: 6, group: G({ colour: 'trim' }) } })),
      // the COP capping the shoulder from the yoke, over the arm and its lames, crowned into a cup; its field the motif
      plate(S, `${base}${S}`, { part: 'torso', over: [`upperArm${S}`], s: capWindow(B), t: [1.1, 2.9], ns: 7, mugen: r3(mugen + 3 * th * 0.6), crown: r3(0.016 * B.k), rad: r3(0.05 * B.k), support: 3.45, ramp: 0.5,
        ...(p.float ? { hover: true } : { liner: { group: G({ colour: 'shade' }), seat: r3(0.004 * B.k) } }), signature: armourMotif(p, B, G) })]) }; } },
  // a BRACER in two bands (the wrist and the forearm), the skin or sleeve between them
  bracers: { layer: 4, cls: 'rigid', colour: 'leather', compile: (p, B, G, I) => ({ adorn: (I.symmetry === 'symmetric' ? ['R', 'L'] : [I.side ?? 'R']).flatMap((S) => [[0.62, 0.86], [0.94, 1.2]].map((s, i) => ({ id: `${p.id ?? 'bracer'}${S}${i ? '' : 'Wrist'}`, mode: 'shell', part: `foreArm${S}`, s, t: 'wrap', mugen: r3(0.012 * B.k), thick: r3(0.01 * B.k), edge: 'roll', crown: r3(0.004 * B.k), interior: G({ colour: 'shade' }), group: G(p), rigid: true,
    signature: i ? { kind: 'motif', name: p.motif ?? 'key', mode: 'border', w: r3(0.0025 * B.k), lift: r3(0.0004 * B.k), group: G({ colour: 'shade' }) } : { kind: 'studs', r: r3(0.006 * B.k), h: r3(0.003 * B.k), count: 3, m: 6, group: G({ colour: 'trim' }) } }))) }) },
  // L7: a BOW (`at`: back | collar | wrists; `tails` m, `loops` false for a scarf's knot): a knot, two loops standing out
  // of it, and two tails flowing from it as strands (hero-flow.js); `rigidity` the tails' (flowing by default)
  bow: { layer: 7, cls: 'soft', colour: 'accent', compile: (p, B, G) => bowOf(p, B, G) },
  // L7: a CHAIN OF OFFICE or a MEDALLION on a cord: a disc hanging at the chest, under the face
  chain: { layer: 7, cls: 'loose', colour: 'accent', compile: (p, B, G) => necklaceOf(p, B, G, { r: 0.055, heavy: 1.6 }) },
  medallion: { layer: 7, cls: 'loose', colour: 'accent', compile: (p, B, G) => (p.mount === 'harness' ? mountedOf(p, B, G, { r: 0.05 }) : necklaceOf(p, B, G, { r: 0.05, heavy: 1 })) },
  // FRAME ADORNMENT (a beast shows its body and is adorned, never clothed): straps, bands and metal on the frame's own
  // landmarks, each window a share of its part (station-loft-adorn.js `share`), so it sits alike on any build
  // a HARNESS: two straps, each one band from the opposite hip up the back, over the shoulder by the neck (the trapezius,
  // never the arm's cap, where a flat strap would flip) and down the front back to that hip: the shoulder is the strap's
  // middle, its two ends meet low at the side; a ring where the straps cross on the chest
  harness: { layer: 5, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: ['R', 'L'].map((S, i) => { const O = S === 'R' ? 'L' : 'R';
    return { id: `${p.id ?? 'harness'}${S}`, mode: 'strap', part: 'torso', path: [[0.45, 2.1, O], [0.8, 2.7, O], [1.4, 3.5, O], [1.9, 3.95, O], [2.5, 3.55, S], [3.2, 3.0, S], [3.75, 2.75, S], [3.98, 2.6, S], [3.98, 1.4, S], [3.75, 1.25, S], [3.2, 1.0, S], [2.5, 0.45, S], [1.9, 0.05, S], [1.4, 0.5, O], [0.8, 1.3, O], [0.45, 1.9, O]], width: r3(0.05 * B.k), thick: r3(0.009 * B.k), mugen: r3(0.026 * B.k + i * 0.01 * B.k), group: G(p), rad: r3(0.05 * B.k),
      signature: i === 0 && !p.mounted ? { kind: 'ring', R: r3(0.026 * B.k), r: r3(0.006 * B.k), standoff: r3(0.012 * B.k), lean: [0, 0, 0], m: 12, group: G({ colour: p.ringColour ?? 'trim' }) } : { kind: 'studs', r: r3(0.007 * B.k), h: r3(0.004 * B.k), count: p.studs ?? 3, from: 2, m: 6, group: G({ colour: 'trim' }) } }; }) }) },
  // a TORC: a metal band round the neck, its two terminals at the front
  torc: { layer: 7, cls: 'rigid', colour: 'trim', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'torc', mode: 'band', part: 'neck', share: true, s: [0.08, 0.26], t: 'wrap', nt: 14, ns: 2, mugen: r3(0.006 * B.k), thick: r3(0.016 * B.k), rad: r3(0.03 * B.k), group: G(p), rigid: true, edge: 'roll', crown: r3(0.003 * B.k), interior: G({ colour: 'shade' }),
    signature: { kind: 'studs', r: r3(0.014 * B.k), h: r3(0.012 * B.k), count: 2, m: 8, group: G({ colour: p.role === 'focal' ? 'accent' : 'trim' }) } }] }) },
  // ARM RINGS on the upper arm, ANKLETS above the foot, a TAIL RING near the tail's root: bands of metal or leather
  armRings: { layer: 7, cls: 'rigid', colour: 'trim', compile: (p, B, G, I) => ({ adorn: (I.symmetry === 'symmetric' || p.pair ? ['R', 'L'] : [p.side ?? I.side ?? 'R']).map((S) => ({ id: `${p.id ?? 'armRing'}${S}`, mode: 'band', part: `upperArm${S}`, share: true, s: [0.55, 0.72], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.004 * B.k), thick: r3(0.012 * B.k), rad: r3(0.03 * B.k), group: G(p), rigid: true, edge: 'roll', crown: r3(0.003 * B.k), interior: G({ colour: 'shade' }),
    signature: { kind: 'studs', r: r3(0.007 * B.k), h: r3(0.005 * B.k), count: 3, m: 6, group: G({ colour: 'trim' }) } })) }) },
  // on a digitigrade leg the ankle is the hock: the band goes on the tarsus below it (a bird's leg ringed), else the shin's foot
  anklets: { layer: 7, cls: 'rigid', colour: 'trim', compile: (p, B, G) => { const meta = B.hasMeta;
    return { adorn: ['R', 'L'].map((S) => ({ id: `${p.id ?? 'anklet'}${S}`, mode: 'band', part: meta ? `meta${S}` : `shin${S}`, share: true, s: meta ? [0.3, 0.48] : [0.8, 0.94], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.004 * B.k), thick: r3(0.01 * B.k), rad: r3(0.03 * B.k), group: G(p), rigid: true, edge: 'roll', crown: r3(0.003 * B.k), interior: G({ colour: 'shade' }),
    signature: { kind: 'studs', r: r3(0.006 * B.k), h: r3(0.004 * B.k), count: 2, m: 6, group: G({ colour: 'trim' }) } })) }; } },
  tailRing: { layer: 7, cls: 'rigid', colour: 'trim', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'tailRing', mode: 'band', part: p.part ?? 'tail1', share: true, s: [0.3, 0.6], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.004 * B.k), thick: r3(0.012 * B.k), rad: r3(0.03 * B.k), group: G(p), rigid: true, edge: 'roll', crown: r3(0.003 * B.k), interior: G({ colour: 'shade' }),
    signature: { kind: 'studs', r: r3(0.007 * B.k), h: r3(0.005 * B.k), count: 3, m: 6, group: G({ colour: 'trim' }) } }] }) },
  // a CHEST PLATE: the breast in two halves meeting on a ridge at the sternum, and below it (`cut: 'cuirass'`, to the
  // waist) the fauld: lames shingling down, the cloth showing between them and at the sides (laws 13–15). The default is a
  // high plate over the breast with one lame under it. The focal half carries the embossed motif; the edges the trim.
  // `cover` (0.4 … 1, default 0.8, the base proportion): how much of the chest's front it takes, across (to 0.8) and
  // down. At 0.8 the cloth shows at the sides and under the fauld; the whole front (1) is for a heavily ornamented plate
  // alone, asked for by name, never a default: an over-covered chest is a slab again
  chestPlate: { layer: 4, cls: 'rigid', colour: 'secondary', compile: (p, B, G, I) => { const base = p.id ?? 'chestPlate', cuirass = p.cut === 'cuirass', cv = Math.max(0.4, Math.min(1, p.cover ?? 0.8)), w = (x) => r3(x * Math.min(1, (0.5 + 0.7 * cv) / 1.06));   // past 0.8 it grows DOWN (the full fauld), never wider
    const plate = (S, id, s, t, extra) => ({ id, mode: 'shell', part: 'torso', side: S, share: true, s, t, nt: 12, ns: 5, mugen: r3(0.012 * B.k), thick: r3(0.012 * B.k), edge: 'roll', within: r3(0.018 * B.k), slab: r3(0.02 * B.k), interior: G({ colour: 'shade' }), rad: r3(0.06 * B.k), group: G(p), rigid: true, ...extra });
    // the fauld tapers toward the waist (each lame narrower than the one above): the plate follows the figure in, not out
    // the fauld: fewer lames the less it covers (the cloth of the belly showing under it), each narrower down to the waist
    const lames = (cuirass ? [[[0.14, 0.27], 0.2], [[0.24, 0.37], 0.23], [[0.34, 0.48], 0.26]].slice(cv >= 0.9 ? 0 : cv >= 0.65 ? 1 : 2) : [[[0.44, 0.57], 0.28]]).map(([s, x]) => [s, w(x)]), step = 0.008 * B.k;
    return { adorn: ['R', 'L'].flatMap((S) => [
      // rivets at each lame's OUTER end only, where it is strapped at the side: a column of them down the sternum reads
      // as buckles
      ...lames.map(([s, w], i) => plate(S, `${base}${S}Lame${i}`, s, [0, w], { mugen: r3(0.006 * B.k + i * step), crown: r3(0.006 * B.k), rim: { group: G({ colour: 'trim' }), at: 'low', ends: false },
        signature: { kind: 'studs', r: r3(0.005 * B.k), h: r3(0.003 * B.k), count: 1, from: -2, to: -2, m: 6, group: G({ colour: 'trim' }) } })),
      plate(S, `${base}${S}`, cuirass ? [0.46, 0.74] : [0.54, 0.84], [0, w(cuirass ? 0.3 : 0.34)], { ns: 8, mugen: r3(0.006 * B.k + lames.length * step), crown: r3(0.018 * B.k), keel: r3(0.01 * B.k), rim: { group: G({ colour: 'trim' }), at: 'both', ends: false },
        signature: S === (I.side ?? 'R') ? armourMotif(p, B, G) : { kind: 'motif', name: p.trim?.motif ?? p.motif ?? 'key', mode: 'border', w: r3(0.0025 * B.k), lift: r3(0.0004 * B.k), group: G({ colour: 'shade' }) } })]) }; } },
  // L6: what is CARRIED
  satchel: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G, I) => { const S = p.side ?? I.side ?? 'R';
    return { adorn: [{ id: `${p.id ?? 'satchel'}${S}`, mode: 'shell', part: 'pelvis', side: S, s: [0.8, 1.3], t: [1.6, 2.2], nt: 4, ns: 2, mugen: r3(0.02 * B.k), thick: r3(0.008 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.2 * B.k), h: r3(0.2 * B.k), d: r3(0.09 * B.k), lift: 0, chamfer: r3(0.03 * B.k), soft: true, group: G(p) } }] }; } },
  pack: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'pack', mode: 'shell', part: 'torso', s: [1.6, 2.6], t: [3.2, 4], nt: 4, ns: 2, mugen: r3(0.03 * B.k), thick: r3(0.01 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.36 * B.k), h: r3(0.38 * B.k), d: r3(0.16 * B.k), lift: 0, chamfer: r3(0.06 * B.k), soft: true, flap: 0.36, group: G(p) } }] }) },
  quiver: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'quiver', mode: 'shell', part: 'torso', s: [1.6, 2.6], t: [3.2, 4], nt: 4, ns: 2, mugen: r3(0.03 * B.k), thick: r3(0.01 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.12 * B.k), h: r3(0.45 * B.k), d: r3(0.1 * B.k), lift: 0, chamfer: r3(0.03 * B.k), soft: true, round: 2.4, sag: 0, flap: false, group: G(p) } }] }) },
});
export const OUTFIT_KIND_NAMES = Object.freeze(Object.keys(OUTFIT_KINDS));

/** a NECKLACE (a medallion's, a chain of office's): a beaded chain HUNG FROM THE NAPE. A chain on a neck hangs as one loop
 * in a tilted plane: highest behind the neck, falling steadily down both sides to its lowest point on the front of the
 * chest, the PENDANT hung there. Its curve is computed off the body's landmarks (the neck's root and radius, the top of
 * the shoulders, the chest's front) and LAID ON THE BODY: where the loop would pass inside the shoulders it rests on
 * their top, inside the chest on its front, and it is smoothed between, so it drapes with no corner. It is drawn as a tube
 * through that curve (the `polyline` signature: the body's rings cannot address a ring round the neck), its segments
 * alternating a bead and a link so it reads as a chain. `heavy` the chain of office's weight */
function necklaceOf(p, B, G, { r, heavy = 1 }) {
  const id = p.id ?? p.kind, k = B.k, nb = B.J.neckBase ?? [0, 0, B.top.z], n = B.neckSeg, rn = n ? rad(n.rA) : 0.1 * k;
  const T = B.top, top = T.z, tr = Array.isArray(T.r) ? T.r : [T.r, T.r], tyc = T.yc ?? 0;
  const bead = 0.011 * heavy * k, link = 0.0055 * heavy * k, clear = 0.01 * k + bead, N = 40;
  const zNape = Math.max(nb[2], top) + 0.05 * k, zFront = top - (p.drop ?? 0.17) * k * (0.9 + 0.1 * heavy);
  const yBack = nb[1] - rn * 1.15, yFront = B.front(zFront, top + 1) + clear, Rx = rn * 1.45 + 0.015 * k;
  // the loop in its tilted plane: a = 0 the front (lowest), a = π the nape (highest)
  let P = Array.from({ length: N }, (_, i) => { const a = 2 * Math.PI * i / N, c = Math.cos(a);
    return [Math.sin(a) * Rx, (yBack + yFront) / 2 + c * (yFront - yBack) / 2, (zNape + zFront) / 2 - c * (zNape - zFront) / 2]; });
  // laid on the body: lifted onto the shoulders' top where it would pass inside them, out onto the chest's front below it
  const lay = (q) => { let [x, y, z] = q; const inTop = (x / tr[0]) ** 2 + ((y - tyc) / tr[1]) ** 2 < 1;
    if (inTop && z < top + clear) z = top + clear;
    if (z < top && y > tyc) y = Math.max(y, B.front(z, top + 1) + clear);
    return [x, y, z]; };
  P = P.map(lay);
  for (let pass = 0; pass < 4; pass++) P = P.map((q, i) => lay(q.map((v, d) => (P[(i + N - 1) % N][d] + 2 * v + P[(i + 1) % N][d]) / 4)));   // smoothed, laid again
  const pts = [...P, P[0]].map((q) => q.map(r3)), bottom = pts[0];
  const rp = r3(r * k), cz = r3(bottom[2] - bead - rp * 1.05), cy = bottom[1], chainG = G({ colour: p.cordColour ?? 'accent' });
  const carrier = (sid, signature) => ({ id: sid, mode: 'shell', part: 'torso', share: true, s: [0.9, 0.95], t: 'wrap', nt: 8, ns: 1, mugen: 0, thick: r3(0.001 * k), group: chainG, ghost: true, stack: false, signature });
  return { adorn: [
    carrier(id, { kind: 'polyline', pts, r: pts.slice(0, -1).map((_, i) => r3(i % 2 ? link : bead)), sides: 6, group: chainG }),
    // the bail from the chain's lowest point down to the pendant, and the pendant facing out from the chest
    carrier(`${id}Bail`, { kind: 'polyline', pts: [bottom, [0, cy, r3(cz + rp * 0.95)]], r: r3(link * 1.3), sides: 6, group: chainG }),
    carrier(`${id}Pendant`, { kind: 'disc', c: [0, r3(cy + 0.004 * k), cz], n: [0, 1, 0.12], r: rp, h: r3(0.014 * k), m: 16, rim: 0.6, group: G(p) }),
  ] };
}
/** a MEDALLION MOUNTED on the harness: the boss where its straps cross on the chest */
function mountedOf(p, B, G, { r }) {
  const k = B.k, S = B.torso.stations, u = 1.9, i = Math.min(S.length - 2, Math.floor(u)), z = S[i].z + (S[i + 1].z - S[i].z) * (u - i);
  return { adorn: [{ id: p.id ?? 'medallion', mode: 'shell', part: 'torso', share: true, s: [0.4, 0.5], t: 'wrap', nt: 8, ns: 1, mugen: 0, thick: r3(0.001 * k), group: G(p), ghost: true, stack: false,
    signature: { kind: 'disc', c: [0, r3(B.front(z, z) + 0.05 * k), r3(z)], n: [0, 1, 0.1], r: r3(r * k), h: r3(0.016 * k), m: 16, rim: 0.6, group: G(p) } }] };
}

/** a BOARD: a flat cloth loft through `pts` [[y, z, half-width]] (a collar
 * standing up), `th` its half-thickness, flat at both ends */
function boardOf(name, pts, th, group, bind) {
  const stations = pts.map(([y, z, w]) => ({ at: [0, r3(y), r3(z)], r: [r3(w), r3(th)] }));
  return { name, kind: 'loft', stations, slots: 'ring12', caps: { back: stations[0].at, tip: stations[stations.length - 1].at }, group, mirror: 'plane', bind };
}

/** the body's shin by either name (the hero's shank, a creature's shin), or null */
const shinOf = (B) => (B.names.has('shank') ? 'shank' : B.names.has('shin') ? 'shin' : null);
/** a hem's height as an address on the leg: a word, or `low` (m) for a height read off the body (a hem above a tail) */
function hemAt(B, word, low = null) {
  const shin = shinOf(B);
  if (low !== null) { const seg = B.thigh, S = seg?.stations || []; const zs = S.map((st) => st.z), top = Math.max(...zs), bot = Math.min(...zs);
    if (S.length && low >= bot) return { part: 'thigh', run: r3(Math.max(0, Math.min(1, (top - low) / Math.max(1e-6, top - bot)))) }; }
  return { thigh: { part: 'thigh', run: 0.5 }, knee: { part: 'thigh', run: 1 }, calf: shin ? { part: shin, run: 0.3 } : { part: 'thigh', run: 1 }, shin: shin ? { part: shin, run: 0.4 } : { part: 'thigh', run: 1 },
    ankle: shin ? { part: shin, run: 0.88 } : { part: 'thigh', run: 1 } }[word];
}
const legsTo = (B, to) => ['pelvis', 'thigh', ...(to.part !== 'thigh' ? [to.part] : [])].filter((n) => B.names.has(n));

/** A GOWN, a ROBE, a TUNIC or a WIZARD'S ROBE: a BODICE fitted over the torso (its ease proportional to each ring's
 * radius, on dense, rounded rings: body-garment.js), SLEEVES if it has them (`sleeve`: 'none' | 'long' | 'bell', `bell`
 * the mouth's extra ease in m), a HOOD if asked (`hood`), and a SKIRT from the top of the hips to its hem: the garment kernel's `fit: 'skirt'`,
 * one hull round the hips and both legs in twenty directions (round, clear of the legs and of what is worn on them, never
 * narrowing below the hips), flaring by `flare` (m per m of fall), each point skinning as a skirt's does (the pelvis at
 * the waist, the leg it lies over below), so it follows a stride instead of passing through it. */
/** A designed piece's own TRIM (`trim: { hem?, cuffs?, chest?, motif? }`): a BINDING is a band of the secondary cloth
 * painted on the edge; EMBROIDERY the motif worked along the hem in the trim's thread; an EMBLEM the motif on the
 * bodice's front (as the outfit's own: outfit/expand.js). `parts` names the piece's hem part, its cuff parts and its
 * bodice part. Absent ⇒ nothing. */
function trimOf(p, B, G, parts) {
  const T = p.trim; if (!T || typeof T !== 'object') return {};
  const k = B.k, paint = [], adorn = [], cloth = G(p), band = G({ colour: 'secondary' }), thread = G({ colour: 'trim' }), motif = T.motif ?? 'vine';
  const worked = (id, part, s, mode, at) => ({ id, mode: 'shell', part, share: true, side: 'R', s, t: 'wrap', nt: 16, ns: mode === 'emblem' ? 6 : 2, mugen: 0, thick: r3(0.001 * k), rad: r3(0.01 * k), group: cloth, stack: false, ghost: true,
    signature: { kind: 'motif', name: motif, mode, ...(at ? { at } : {}), size: r3(0.1 * k), w: r3(0.006 * k), lift: r3(0.003 * k), group: thread } });
  if (T.hem && parts.hem) { if (T.hem === 'binding') paint.push({ part: parts.hem, run: [0.94, 1], group: band }); else adorn.push(worked(`${p.id ?? p.kind}HemWork`, parts.hem, [0.82, 0.97], 'border')); }
  if (T.cuffs === 'binding') for (const c of parts.cuffs || []) paint.push({ part: c, run: [0.9, 1], group: band });
  if (T.chest === 'emblem' && parts.bodice) adorn.push(worked(`${p.id ?? p.kind}Emblem`, parts.bodice, [0.5, 0.85], 'emblem', 'front'));
  return { ...(paint.length ? { paint } : {}), ...(adorn.length ? { adorn } : {}) };
}

function gownOf(p, B, G, { hem, flare, sleeve: sleeveOf = 'none' }) {
  const e = (p.ease ?? 0.018) * B.k, id = p.id ?? p.kind, to = hemAt(B, p.hem ?? hem), sleeve = p.sleeve ?? sleeveOf, ref = r3(0.1 * B.k);
  // SLEEVES (`sleeve`): 'long' to the wrist on the arm's own rings; 'bell' the same, widening from the elbow to an open
  // mouth at the wrist (a wizard's); 'none' bare. Worn over the cut, so they stand off the sleeves beneath
  const bell = sleeve === 'bell' ? r3((p.bell ?? 0.08) * B.k) : 0, elbow = bell ? r3(0.012 * B.k) : 0;
  const sleeves = sleeve === 'none' || !B.names.has('upperArm') ? [] : [
    { id: `${id}Sleeve`, part: 'upperArm', run: [0, 1], ease: r3(e), ...(elbow ? { flare: [0, elbow] } : {}), proportional: ref, dense: true, group: G(p) },
    ...(B.names.has('foreArm') ? [{ id: `${id}Cuff`, part: 'foreArm', run: [0, 0.92], ease: r3(e), ...(bell ? { flare: [elbow, bell] } : {}), proportional: ref, dense: true, group: G(p) }] : [])];
  const trim = trimOf(p, B, G, { hem: B.names.has('pelvis') ? `${id}Skirt_skirt` : null, cuffs: sleeves.length && B.names.has('foreArm') ? [`${id}Cuff_foreArmR`, `${id}Cuff_foreArmL`] : [], bodice: `${id}Bodice_torso` });
  return {
    garments: [{ id: `${id}Bodice`, part: 'torso', ease: r3(e), proportional: ref, dense: true, group: G(p) }, ...sleeves,
      ...(B.names.has('pelvis') ? [{ id: `${id}Skirt`, fit: 'skirt', part: legsTo(B, to), from: { part: 'pelvis', run: 1 }, to, ease: r3(e), flare: [0, r3(p.flare ?? flare)], group: G(p) }] : []),
      ...hoodOf(p, B, G, id, [60, 300], r3(e * 1.6))],
    ...trim,
  };
}

/** A BOW: a small knot shell, its loops (two short ribbons doubling back on themselves, locked) and its tails (two
 * ribbons hanging from it, flowing). Placed by `at` on the body's own landmarks: the BACK of the waist (the knot on the
 * spine, the tails down the seat), the COLLAR (the front of the neck's root, the tails down the chest), or both WRISTS
 * (the knot on the back of each forearm's end). `tails` the tails' length (m, at scale 1), `width`, `loops: false` a
 * scarf's knot (tails only). */
function bowOf(p, B, G) {
  const at = p.at ?? 'back', k = B.k, L = (p.tails ?? 0.22) * k, w = r3((p.width ?? 0.032) * k), th = r3(0.003 * k), g = G(p);
  const tail = (dir) => [[0, 0, 0], [0.012 * k, dir * 0.006 * k, -0.25 * L], [0.022 * k, dir * 0.01 * k, -0.6 * L], [0.03 * k, dir * 0.006 * k, -L]].map((q) => q.map(r3));
  const loop = (dir) => [[0, 0, 0], [0.03 * k, dir * 0.008 * k, 0.018 * k], [0.06 * k, dir * 0.012 * k, 0.004 * k], [0.035 * k, dir * 0.006 * k, -0.01 * k]].map((q) => q.map(r3));
  // the tails are LAID over what they hang across (station-loft-adorn.js ribbon `drape`): down a seat, over a bust, off a hand
  // (`beneath`: what each placement's tails hang across, the garments on them found by name)
  const ACROSS = { back: ['torso', 'pelvis', 'thighR', 'thighL', 'skirt', 'panel', 'outer', 'cape'], collar: ['torso', 'bustR', 'bustL', 'pectoralR', 'pectoralL', 'navel', 'pelvis', 'thighR', 'thighL', 'skirt', 'outer'] };
  const drapeOf = (S) => ({ drape: { len: r3(L), links: 6, clear: r3(0.026 * k), apart: r3(0.014 * k) }, beneath: S ? [`foreArm${S}`, `hand${S}`, `thumb${S}`, `thigh${S}`, 'pelvis', 'skirt'] : ACROSS[at] });
  let drape = drapeOf(null);
  const ribbon = (spine, extra) => ({ kind: 'ribbon', spread: [-1, 1], spine, width: w, thick: th, tip: 'swallow', group: g, ...extra });
  const knot = (id, place, dir, kj) => [
    { id, ...place, nt: 2, ns: 2, mugen: r3(0.008 * k), thick: r3(0.012 * k), rad: r3(0.03 * k), group: g, signature: p.loops === false ? ribbon(tail(dir), { ...kj, ...drape, rigidity: p.rigidity ?? 'flowing' }) : ribbon(loop(dir), kj) },
    ...(p.loops === false ? [] : [{ id: `${id}Tails`, ...place, nt: 2, ns: 2, mugen: r3(0.002 * k), thick: r3(0.004 * k), rad: r3(0.02 * k), group: g, signature: ribbon(tail(dir), { ...kj, ...drape, rigidity: p.rigidity ?? 'flowing' }) }])];
  const id = p.id ?? `bow${at[0].toUpperCase()}${at.slice(1)}`;
  if (at === 'wrists') return { adorn: ['R', 'L'].flatMap((S) => { drape = drapeOf(S); return knot(`${id}${S}`, { mode: 'band', part: `foreArm${S}`, share: true, s: [0.8, 0.88], t: 'wrap' }, -1, { k: 0, j: 1 }); }) };
  if (at === 'collar') { const top = B.uTop(B.torso); return { adorn: knot(id, { mode: 'shell', part: 'torso', side: 'R', s: [r3(top - 0.35), r3(top - 0.12)], t: [0, 0.35] }, 1, { k: 0, j: 1 }) }; }
  const s = B.ringAt(B.torso, B.waist).s;   // the back of the waist
  return { adorn: knot(id, { mode: 'shell', part: 'torso', side: 'R', s: [r3(Math.max(0, s - 0.15)), r3(s + 0.1)], t: [3.65, 4] }, -1, { k: 2, j: 1 }) };
}

/** a HOOD on a piece (`hood: true` or `{ open }`): the garment kernel's `fit: 'hood'`, rising from the shoulders over the
 * head's volume (bodyMap `head`), its foot on `around`, open at the face, locked to the head; none without a head */
function hoodOf(p, B, G, id, around, ease) {
  if (!p.hood || !B.head) return [];
  return [{ id: `${id}Hood`, fit: 'hood', part: ['torso', 'upperArm', 'neck'].filter((n) => B.names.has(n)), from: { part: 'torso', run: 1 }, head: B.head, around,
    ...(typeof p.hood === 'object' && p.hood.open !== undefined ? { open: p.hood.open } : {}), ease, thick: r3(0.006 * B.k), group: G(p) }];
}

/** A CLOAK: hung from the shoulders down the back and round the sides (`wrap`, the share of a turn it covers, 0.6 by
 * default: the back and the arms' outer sides) to the calf, or above a tail that must read: the garment kernel's
 * `fit: 'cape'`, one hull round the trunk, the arms and the legs, so it is round over the shoulders and the arms where a
 * board was flat, draping on the arms. It flows as a curtain (`rigidity`, soft by default). `hood: true` (or
 * `{ open }`, the face's opening in degrees each side of the front) raises a `fit: 'hood'` over the head. */
function cloakOf(p, B, G) {
  const to = p.tailClear && B.tail ? hemAt(B, null, B.tail + 0.05 * B.k) : hemAt(B, p.hem ?? 'calf');
  const arc = 360 * Math.max(0.2, Math.min(0.95, p.wrap ?? 0.6)), part = ['torso', 'upperArm', ...legsTo(B, to)].filter((n) => B.names.has(n)), id = p.id ?? 'cloak';
  const around = [r3(180 - arc / 2), r3(180 + arc / 2)], ease = r3((p.ease ?? 0.02) * B.k), thick = r3(0.006 * B.k);
  return { garments: [{ id, fit: 'cape', part, from: { part: 'torso', run: 1 }, to, around, ease, flare: [0, r3(p.flare ?? 0.12)], thick, group: G(p), rigidity: p.rigidity ?? 'soft' },
    ...hoodOf(p, B, G, id, around, r3(ease * 1.2))], ...trimOf(p, B, G, { hem: `${id}_cape` }) };
}

/** THE CUT on a creature: the outfit grammar the hero wears (outfit/expand.js: a top, a bottom, an outer layer, their
 * lengths on landmarks, ease, layering and edges, by principles.js) expanded over this body. The hero's shank is this
 * body's shin; its pelvis runs u 0…6 where this one runs 0…n−1, so pelvis windows are carried across by share. `colours`
 * names the palette role each cloth wears ({ Top, Bottom, Outer } → base | secondary | leather …). */
function cutOnCreature(cut, plan, B, pal) {
  const names = new Set(plan.segments.map((s) => s.name.replace(/[RL]$/, '')));
  const have = new Set([...names, ...(names.has('shin') ? ['shank'] : [])]);
  const role = (g, d) => pal[cut.colours?.[g] ?? d];
  const cloth = { Top: role('Top', 'base'), Bottom: role('Bottom', 'secondary'), ...(cut.language.outer ? { Outer: role('Outer', 'base') } : {}) };
  const out = expandOutfit({ type: 'outfit', style: { id: 'designed', language: cut.language, dials: cut.dials || {} }, ...(cut.detail ? { detail: cut.detail } : {}) }, { have, scale: B.k }, cloth);
  const pu = (B.pelvis.stations.length - 1) / 6, isPel = (n) => n === 'pelvis' || /_pelvis$/.test(n), ren = (n) => (n === 'shank' ? 'shin' : n.replace(/_shank([RL]?)$/, '_shin$1'));
  const su = (w) => w.map((x) => Math.round(x * pu * 1e6) / 1e6);
  const garments = out.garments.map((E) => { const parts = (Array.isArray(E.part) ? E.part : [E.part]).map(ren), pel = parts.length === 1 && parts[0] === 'pelvis';
    return { ...E, part: parts, ...(pel && E.u ? { u: su(E.u) } : {}), ...(pel && E.rings?.u ? { rings: { ...E.rings, u: su(E.rings.u) } } : {}),
      ...(E.from ? { from: E.from.part === 'pelvis' ? { ...E.from, u: E.from.u * pu } : { ...E.from, part: ren(E.from.part) } } : {}), ...(E.to ? { to: { ...E.to, part: ren(E.to.part) } } : {}) }; });
  const paint = out.paint.map((P) => { const ps = [P.part].flat(); return { ...P, part: Array.isArray(P.part) ? ps.map(ren) : ren(P.part), ...(ps.every(isPel) && P.u ? { u: su(P.u) } : {}) }; });
  const kit = out.kit.map((A) => ({ ...A, part: ren(A.part), ...(isPel(A.part) && A.s && !A.share ? { s: su(A.s) } : {}) }));   // a share window is alike on every body
  const tones = { ...out.tones, ...cloth, Trim: pal.trim ?? out.tones.Trim, Button: pal.trim ?? out.tones.Button, Buckle: pal.trim ?? out.tones.Buckle, Leather: pal.leather ?? out.tones.Leather };
  return { garments, paint, rows: out.rows, kit, tones, trace: out.trace };
}

/** WARP AND DISTORT (the design phase's fantasy proportions), over the adornment a piece compiled to. `intent.distort`
 * { amount 0–1, side: the dominant side, chunk ≥ 1, flare ≥ 1 } and a piece's own `scale`:
 *   exaggerate   a piece's `scale` grows its signature (the boss, the disc, the buckle, the studs) and its plate
 *   asymmetry    on the dominant side a paired piece grows by `amount`, on the other it shrinks: big against small
 *   chunk        rigid metal and plate thicken (they read at a distance)
 *   flare        a plate's free edge flares wider (its ramp), a strap broadens
 * Absent `distort` and `scale`, the adornment is untouched. */
const SIZE_KEYS = ['r', 'R', 'h', 'w', 'size', 'link', 'bar', 'd', 'chamfer'];
function distorted(A, p, D) {
  const S = A.side ?? (/[RL]$/.test(A.id) ? A.id.slice(-1) : null), a = D?.amount ?? 0;
  // (`lean: false`: a heightening that keeps a pair a pair, no side leading)
  const lean = D && D.lean !== false && S && (p.pair || ['pauldron', 'armRings', 'anklets', 'bracers', 'chestPlate'].includes(p.kind)) ? (S === (D.side ?? 'R') ? 1 + 0.4 * a : 1 - 0.25 * a) : 1;
  const f = (p.scale ?? 1) * lean, chunk = A.rigid || ['torc', 'armRings', 'anklets', 'tailRing'].includes(p.kind) ? 1 + ((D?.chunk ?? 1) - 1) * a : 1, flare = 1 + ((D?.flare ?? 1) - 1) * a;
  if (f === 1 && chunk === 1 && flare === 1) return A;
  const sig = { ...A.signature }; for (const k of SIZE_KEYS) if (Number.isFinite(sig[k])) sig[k] = r3(sig[k] * f);
  return { ...A, thick: r3(A.thick * f * chunk), mugen: r3(A.mugen * Math.max(1, f)), ...(A.width ? { width: r3(A.width * f * flare) } : {}), ...(A.ramp ? { ramp: r3(A.ramp * flare * Math.max(1, f)) } : {}), signature: sig };
}

/** ARMOUR'S ORNAMENT IN THE SURFACE (law 15): the focal plate's motif (or the one the detail spends on it, `trim.chest`) EMBOSSED (raised, in the trim's metal or the accent),
 * any other plate's ENGRAVED (cut in: a thin line in the plate's shade) */
/** the shoulder cap's window on the torso, off the body's own SHOULDER joint (a beast's torso is not a hero's): from the
 * joint to a little past halfway up the slope to the torso's top (a hero's: s 2.7 … 3.45) */
function capWindow(B) {
  const sh = Math.min(B.shoulder ?? B.top.z, B.top.z - 0.02 * B.k), top = B.top.z;
  return [r3(B.ringAt(B.torso, sh - 0.005 * B.k).s), r3(Math.min(B.uTop(B.torso), B.ringAt(B.torso, sh + 0.55 * (top - sh)).s))];
}
function armourMotif(p, B, G) {
  const name = p.trim?.motif ?? p.motif ?? 'knot';
  return p.role === 'focal' || p.trim?.chest ? { kind: 'motif', name, mode: 'emblem', size: r3(0.07 * B.k), w: r3(0.004 * B.k), lift: r3(0.0015 * B.k), group: G({ colour: 'accent' }) }
    : { kind: 'motif', name, mode: 'emblem', size: r3(0.06 * B.k), w: r3(0.0025 * B.k), lift: r3(0.0004 * B.k), group: G({ colour: 'shade' }) };
}

export function compileOutfit(plan) {
  const O = plan.outfit; if (!O) return plan;
  const B = bodyMap(plan), I = { symmetry: 'symmetric', side: 'R', ...(O.intent || {}) }, pal = I.palette || {};
  const G = (p) => { const role = p.colour ?? OUTFIT_KINDS[p.kind]?.colour ?? 'base'; return /^#/.test(role) ? role : COLOUR_GROUPS[role] ?? COLOUR_GROUPS.base; };
  const pieces = [...O.pieces].map((p, i) => ({ p, i, layer: OUTFIT_KINDS[p.kind]?.layer ?? 9 })).sort((a, b) => a.layer - b.layer || a.i - b.i);
  const garments = [...(plan.garments || [])], adorn = [...(plan.adorn || [])], segments = [...plan.segments], piecePaint = [];
  for (const { p } of pieces) { const K = OUTFIT_KINDS[p.kind]; if (!K) throw new Error(`outfit: '${p.kind}' is not a piece kind (have ${OUTFIT_KIND_NAMES.join(', ')})`);
    // a designed piece is worn ON TOP of the frame: it clears the fur, locks and scales pinned to its carrier
    const out = K.compile(p, B, G, I); garments.push(...(out.garments || [])); if (out.paint) piecePaint.push(...out.paint); adorn.push(...(out.adorn || []).map((A) => ({ ...distorted(A, p, I.distort), onTop: true }))); segments.push(...(out.segments || [])); }
  let palette = { ...(plan.palette || {}), ...Object.fromEntries(Object.entries(COLOUR_GROUPS).filter(([role]) => pal[role]).map(([role, g]) => [g, pal[role]])) };
  // the cut first (the cloth, L1–L3), then the worn pieces over it in their layers
  let paint = plan.paint, body = plan.body;
  if (O.cut) { const C = cutOnCreature(O.cut, plan, B, pal);
    garments.unshift(...C.garments); adorn.unshift(...C.kit); palette = { ...palette, ...C.tones };
    if (C.paint.length) paint = [...(paint || []), ...C.paint];
    if (C.rows.length) body = { ...(body || {}), rows: [...(body?.rows || []), ...C.rows] };
    // cloth hides what grows beneath it: fur tiles and locks on a part the cut covers end to end are not drawn (a ruff on
    // the neck still spills over the neckline)
    const whole = (E) => !E.t && !E.u && (!E.run || (E.run[0] <= 0.05 && E.run[1] >= 0.88));
    const covered = new Set([...C.garments.flatMap((E) => (E.fit === 'skirt' || whole(E) ? E.part : [])), ...C.paint.filter((P) => !/_/.test([P.part].flat()[0]) && whole(P)).flatMap((P) => [P.part].flat())]);
    const hidden = (D) => (D.parts || []).every((n) => covered.has(n.replace(/[RL]$/, '')));
    if (body?.tiles || body?.locks) { const keep = (L) => { const k = L.filter((D) => !hidden(D)); return k.length ? k : undefined; };
      const { tiles, locks, ...restBody } = body; body = { ...restBody, ...(tiles && keep(tiles) ? { tiles: keep(tiles) } : {}), ...(locks && keep(locks) ? { locks: keep(locks) } : {}) }; }
    // and a muscle swell (`volume`) on a part cloth lies over is the cloth's to carry: the swell would push the skin
    // through a garment fitted to the part's own rings (a thigh's belly through the breeches)
    const clothed = new Set(C.garments.flatMap((E) => [E.part].flat()).map((n) => String(n).replace(/[RL]$/, '')));
    if (body?.volume?.some((V) => clothed.has(String(V[0]).replace(/[RL]$/, '')))) {
      const volume = body.volume.filter((V) => !clothed.has(String(V[0]).replace(/[RL]$/, '')));
      const { volume: _v, ...restBody } = body; body = { ...restBody, ...(volume.length ? { volume } : {}) }; } }
  // ONE BUCKLE AT THE WAIST: where a belt is worn, a sash ties with a knot of its own cloth instead of a second buckle
  const waistBuckle = (A) => A.signature?.kind === 'buckle' && !/mantle|cloak/i.test(A.id);   // (a belt rides the pelvis or the cloth over it)
  if (adorn.filter(waistBuckle).length > 1) for (let i = 0; i < adorn.length; i++) { const A = adorn[i]; if (!waistBuckle(A) || !/sash/i.test(A.id)) continue;
    adorn[i] = { ...A, signature: { kind: 'boss', k: 0, j: 1, r: r3(0.022 * B.k), h: r3(0.012 * B.k), m: 10, rim: 0.75, group: A.group } }; }
  // the shade (a plate's inside, its liner): its own role if the palette names one, else the plate's colour in shadow
  if (!palette[COLOUR_GROUPS.shade] && adorn.some((A) => A.interior === COLOUR_GROUPS.shade || A.liner?.group === COLOUR_GROUPS.shade)) palette[COLOUR_GROUPS.shade] = shadeOf(palette[COLOUR_GROUPS.secondary] ?? palette[COLOUR_GROUPS.base] ?? '#6b6b6b');
  // a designed piece's own trim (its binding bands) after the cut's paint
  if (piecePaint.length) paint = [...(paint || []), ...piecePaint];
  const { outfit: _o, ...rest } = plan;
  return { ...rest, segments, ...(garments.length ? { garments } : {}), adorn, palette, ...(paint ? { paint } : {}), ...(body ? { body } : {}), outfitCompiled: true };
}

// ─── the laws of visual interest (the Dressing Bible's), advisory ───
/** how much of the outfit's area a kind covers, roughly (a skirt and bodice far more than a buckle) */
const AREA = { bow: 0.5, gown: 10, robe: 11, wizardRobe: 13, tunic: 7, mantle: 4, cloak: 5, collar: 1.5, harness: 1.4, torc: 0.4, armRings: 0.4, anklets: 0.3, tailRing: 0.2, chestPlate: 2.2, sash: 1.2, belt: 1, baldric: 1, wraps: 0.6, pauldron: 1.5, bracers: 0.8, chain: 0.5, medallion: 0.4, satchel: 1, pack: 2, quiver: 1 };
export const ARCHETYPE_SHAPES = { ruler: ['bell', 'column'], hero: ['wedge'], outlaw: ['wedge', 'needle'], caregiver: ['bell', 'barrel'], sage: ['bell', 'column'], magician: ['bell', 'needle'], explorer: ['wedge', 'column'], innocent: ['bell', 'barrel'], everyman: ['column', 'barrel'], jester: ['needle', 'wedge'], lover: ['needle', 'bell'], creator: ['column', 'barrel'] };

/** the cut's cloth as the laws count it: each layer a piece of its area in its colour role (a coat over a shirt shows
 * the shirt at its sleeves and front, so the covered layer counts less) */
function cutPieces(cut) {
  const L = cut?.language; if (!L) return []; const C = cut.colours || {}, out = [], long = ['knee', 'midi', 'maxi'];
  if (L.top) out.push({ kind: 'top', colour: C.Top ?? 'base', area: L.outer ? 2.5 : 6, why: 'the cut' });
  if (L.bottom) out.push({ kind: L.bottom.kind === 'skirt' ? 'skirt' : 'trousers', colour: C.Bottom ?? 'secondary', area: (L.bottom.kind === 'skirt' ? ({ maxi: 9, midi: 7, knee: 5 }[L.bottom.leg] ?? 5) : L.bottom.leg === 'knee' ? 3 : 5) * (long.includes(L.outer?.hem) ? 0.4 : 1), why: 'the cut' });
  if (L.outer) out.push({ kind: 'outer', colour: C.Outer ?? 'base', area: { waist: 3, hip: 5, tunic: 6, knee: 9, midi: 10, maxi: 12 }[L.outer.hem] ?? 6, why: 'the cut', long: long.includes(L.outer.hem) });
  return out;
}

export function outfitLaws(outfit, ctx = {}) {
  const I = outfit.intent || {}, pal = I.palette || {}, out = [], cloth = cutPieces(outfit.cut), P = [...cloth, ...(outfit.pieces || [])];
  const role = (p) => p.role ?? (OUTFIT_KINDS[p.kind]?.colour === 'accent' ? 'focal' : 'support');
  const colourOf = (p) => p.colour ?? OUTFIT_KINDS[p.kind]?.colour ?? 'base';
  const law = (name, ok, why) => out.push({ law: name, ok, why });
  const focal = P.filter((p) => role(p) === 'focal');
  law('one focal', focal.length === 1, focal.length === 1 ? `${focal[0].kind} leads` : focal.length ? `${focal.length} pieces claim the focal (${focal.map((p) => p.kind).join(', ')}): one leads, the rest support` : 'no piece leads: name one focal');
  const accent = P.filter((p) => colourOf(p) === 'accent' && role(p) !== 'focal');
  law('accent on the focal', accent.length === 0, accent.length ? `${accent.map((p) => p.kind).join(', ')} wear the accent too: spend it on the focal alone` : 'the accent is the focal\'s');
  // a beast's frame is the ground: its body the 60, what it wears the 30 and the 10
  const area = ctx.frame ? { frame: 12 } : {}; for (const p of P) { const c = colourOf(p); area[c] = (area[c] ?? 0) + (p.area ?? AREA[p.kind] ?? 1); } const total = Object.values(area).reduce((t, v) => t + v, 0) || 1;
  const share = (c) => (area[c] ?? 0) / total, dom = Math.max(...Object.values(area).map((v) => v / total));
  law('three values, unequal', dom >= 0.45 && share('accent') <= 0.15, `the largest colour covers ${Math.round(dom * 100)}%, the accent ${Math.round(share('accent') * 100)}% (aim 60 / 30 / 10)`);
  const Ls = ['base', 'secondary', 'trim', 'accent'].filter((c) => pal[c]).map((c) => [c, hexLch(pal[c])[0]]);
  const steps = []; for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) steps.push([Ls[i][0], Ls[j][0], Math.abs(Ls[i][1] - Ls[j][1])]);
  const flat = steps.filter(([a, b, d]) => d < 15 && !(a === 'trim' && b === 'accent'));
  law('clear value steps', !flat.length, flat.length ? flat.map(([a, b, d]) => `${a} and ${b} differ by ${Math.round(d)} L*`).join('; ') : 'every colour role a clear step from the others');
  // the trim's uses: a piece in it, and the small parts that carry it (a mantle's clasp, a sash's knot, a medallion's cord)
  // the cut's edges are the trim's field too (outfit/principles.js law 6): its hems and cuffs, at an ornament of 2 and up
  const edged = outfit.cut?.language && (outfit.cut.dials?.ornament ?? 1) >= 2 ? 1 : 0;
  // and the metal FITTINGS a piece carries in the trim (a bracer's studs, a plate's boss, a harness's ring)
  const fitted = P.filter((p) => ['bracers', 'chestPlate', 'harness', 'baldric'].includes(p.kind) || (p.kind === 'pauldron' && p.role !== 'focal')).length;
  const trimUses = edged + fitted + P.filter((p) => colourOf(p) === 'trim').length + P.filter((p) => (p.kind === 'mantle' && p.clasp !== false && (p.claspColour ?? 'trim') === 'trim') || (p.kind === 'sash' ? (p.knotColour ?? 'trim') === 'trim' : p.knotColour === 'trim') || p.cordColour === 'trim').length;   // a sash's buckle is the trim's metal
  law('repetition with variation', trimUses >= 2, `the trim appears on ${trimUses} piece${trimUses === 1 ? '' : 's'} (2 or 3 ties the outfit)`);
  const sided = P.filter((p) => ['satchel'].includes(p.kind) || (['pauldron', 'bracers', 'armRings'].includes(p.kind) && !p.pair && I.symmetry !== 'symmetric') || p.kind === 'baldric');
  if (ctx.order !== undefined) law('symmetry from order', ctx.order < 0.5 ? sided.filter((p) => p.kind !== 'baldric').length <= 1 : sided.length >= 1, ctx.order < 0.5 ? `a bound order: ${sided.length} one-sided piece${sided.length === 1 ? '' : 's'} (one note at most)` : `a free order: ${sided.length} asymmetric piece${sided.length === 1 ? '' : 's'} (at least one)`);
  if (ctx.archetype && I.silhouette) law('shape from the archetype', (ARCHETYPE_SHAPES[ctx.archetype] || []).includes(I.silhouette), `${ctx.archetype} reads as ${(ARCHETYPE_SHAPES[ctx.archetype] || []).join(' or ')}; the outfit aims for ${I.silhouette}`);
  if (ctx.mustSee?.includes('tail')) { const over = P.filter((p) => (['gown', 'robe', 'wizardRobe', 'skirt'].includes(p.kind) || (p.kind === 'outer' && p.long)) && !p.tailSlit); law('the must-see stays seen', !over.length, over.length ? `${over.map((p) => p.kind).join(', ')} would hide the tail: give it a tail slit, or a tunic` : 'nothing covers the tail'); }
  // restraint: the cloth's base counts once (a top and its bottom are one outfit's ground), its outer layer once more
  const count = (outfit.pieces || []).length + (cloth.length ? 1 : 0) + (cloth.some((p) => p.kind === 'outer') ? 1 : 0);
  law('restraint', count <= 6, `${count} pieces (six at most: each one has to earn its place)`);
  // scale contrast (the distortion's): the focal the largest-scaled piece
  if (I.distort) { const f = P.find((p) => role(p) === 'focal'), top = Math.max(1, ...P.filter((p) => p !== f).map((p) => p.scale ?? 1)); law('the focal the largest', !f || (f.scale ?? 1) >= top, f ? `the ${f.kind} at ${f.scale ?? 1}×, the rest at most ${top}×` : 'no focal'); }
  // a beast's frame is its costume: what it wears covers a small share of it
  if (ctx.frame) { const worn = P.reduce((t, p) => t + (p.area ?? AREA[p.kind] ?? 1), 0); law('the frame shows', worn <= 6.5, `the adornment covers ${Math.round(worn * 10) / 10} of a frame's 6.5: the body stays the show`); }
  const bare = P.filter((p) => !p.why); law('every piece has a reason', !bare.length, bare.length ? `${bare.map((p) => p.kind).join(', ')} name no reason` : 'each piece names its reason');
  return out;
}
