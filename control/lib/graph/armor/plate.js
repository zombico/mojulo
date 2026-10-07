// armor/plate — the PLATE family: a pauldron (the focal piece) and a suit grown out from it by `coverage` (law 9),
// as an adornment kit for the hero (station-loft-adorn.js modes). Pure data out; no dice.
//
// Every address is a carrier fraction: torso stations `s` 0 (hips) → 4 (neck), the ring parameter `t` in the register's
// halves Ht (torso) and Hl (limbs), metres × the cast scale k.
import { armorProportion } from './principles.js';

const lerp = (a, b, t) => a + (b - a) * t;
export const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** law 11: a ROLLED EDGE — a narrow strap along a shell piece's edge (addresses across its t window at the edge's s),
 * worn after the piece so it is lifted onto the rim. A tight `rad` keeps it on the rim (with a shell's 5 cm it took
 * the max over the whole cap). The id keeps the carrier's name, so it stacks over the piece. */
export function edgeTrim(A, { at = 'low', w, thick, group, minF }) {
  const s = at === 'low' ? A.s[0] + 0.02 : A.s[1] - 0.02, side = A.side || 'R', n = 6;
  const path = Array.from({ length: n + 1 }, (_, i) => [r4(s), r4(A.t[0] + (A.t[1] - A.t[0]) * (0.03 + 0.94 * i / n)), side]);
  const carrier = A.id.includes(A.part) ? A.id : `${A.part}-${A.id}`;
  return { id: `${carrier}-trim${at === 'low' ? '' : 'Top'}`, mode: 'strap', part: A.part, path, width: r4(Math.max(minF * 1.5, w)), thick: r4(thick), mugen: 0.0005, rad: r4(Math.max(minF, 0.008)), group,
    signature: { kind: 'studs', count: 1, r: r4(minF * 0.5), h: r4(minF * 0.3), m: 6, group } };
}

/** the pauldron as kit entries on `side`. variants: 'spaulder' (an anchor on the torso + lames down the upper arm) or
 * 'bell' (an anchor + one deep skirt shaped on the arm and pinned to the torso). `rank`: 'focal' | 'partner' */
export function pauldron(variant, dials, { Ht, Hl, k = 1, height = 1.75, pelvis: structured = false }, { side = 'R', groups = {}, eye = [0.8, 0.5, 0.25], rank = 'focal' } = {}) {
  const law = { ...armorProportion(dials) }, minF = law.minFeature * height;
  if (rank !== 'focal') { law.focal = 1 + (law.focal - 1) * 0.35; law.standoff *= 0.7; law.flare *= 0.7; }   // law 9: the partner keeps below the focal's rank
  const G = { plate: 'Plate', trim: 'Trim', rivet: 'Rivet', accent: 'Accent', ...groups };
  const S = side, arm = `upperArm${S}`;
  const thick = Math.max(minF, 0.0045 * k * law.thick);
  const orn = dials.ornament ?? 1;
  const rivetSig = (n, j) => ({ kind: 'studs', j, count: Math.max(1, Math.round(n * law.lames)), r: r4(Math.max(minF * 0.6, 0.0045 * k * law.rivet)), h: r4(Math.max(minF * 0.4, 0.003 * k * law.rivet)), m: 8, group: G.rivet });
  const kit = [];
  // the lames first, farthest from the anchor first: true stacking lifts each over the one before, so the stack
  // shingles DOWN (the upper lame outside the lower) and the anchor, worn last, lies over them all (law 8). The ids
  // carry the carrier's name, which is what stacks them.
  let lames = 0;
  if (variant === 'spaulder') {
    lames = Math.max(1, Math.round(4 * law.lames * (rank === 'focal' ? 1 : 0.5)));
    const s0 = 0.08, cover = lerp(0.75, 1.0, dials.stylize ?? 0) * law.focal ** 0.25, step = cover / lames, len = step * 1.45;
    for (let i = lames - 1; i >= 0; i--) {
      const a = s0 + i * step, low = i === lames - 1;
      kit.push({ id: `${arm}-lame${i}`, mode: 'shell', part: arm, side: S, s: [r4(a), r4(a + len)], t: [r4(0.12 * Hl), r4(0.88 * Hl)], nt: 8, ns: 2,
        mugen: r4(0.004 * k * law.standoff), thick: r4(thick * 0.85), rad: r4(0.03 * k), support: r4(a), ramp: r4(low ? law.flare * 0.9 : 0.4), group: G.plate, rigid: true,
        signature: rivetSig(2 + orn, -1) });   // law 11: rivets along the lame's lower edge
    }
  } else {
    // bell: one deep skirt, SHAPED on the upper arm and PINNED to the torso (the arm moves beneath it); the skirt
    // carries the flare, downward over the arm, never sideways out of the armpit
    const len = lerp(0.8, 1.05, dials.stylize ?? 0) * law.focal ** 0.2;
    kit.push({ id: `${arm}-skirt`, mode: 'shell', part: arm, side: S, s: [0.02, r4(0.02 + len)], t: [r4(0.08 * Hl), r4(0.92 * Hl)], nt: 10, ns: 3,
      mugen: r4(0.005 * k * law.standoff), thick, rad: r4(0.03 * k), support: 0.02, ramp: r4(law.flare), group: G.plate, rigid: true, pin: [3.5, r4(0.5 * Ht), S, 'torso'],
      signature: rivetSig(3 + orn, -1) });
    lames = 1;
  }
  // the anchor caps the shoulder from the yoke toward the neck, over the arm and the lames; snug at the top, a modest
  // flare. On the structured core (ctx.pelvis) the torso's shoulder ring sits over the arm's cap and a trapezius ring
  // slopes to the neck, so the cap is s 2.7 … 3.45 (the armpit to halfway up the slope), not the old flat yoke's 3.0 … 3.8;
  // flare (a torso window flares SIDEWAYS out of the armpit). The focal's boss faces where the eye comes from (law 6)
  const half = Math.min(0.46, 0.27 * law.focal ** 0.3);
  const anchor = { id: `torso-pauldron${S}`, mode: 'shell', part: 'torso', over: [arm], side: S, s: structured ? [r4(lerp(2.7, 2.55, Math.min(1, law.focal - 1))), 3.45] : [r4(lerp(3.0, 2.85, Math.min(1, law.focal - 1))), 3.8], t: [r4((0.5 - half) * Ht), r4((0.5 + half) * Ht)], nt: 14, ns: 6,
    mugen: r4(0.006 * k * law.standoff), thick, rad: r4(0.05 * k), support: structured ? 3.45 : 3.8, ramp: r4(0.8 + 0.25 * (law.flare - 0.8)), group: G.plate, rigid: true,
    signature: rank !== 'focal' ? rivetSig(2 + orn, 0)
      : { kind: 'facing', dir: eye, r: r4(0.03 * k * law.focal), h: r4(Math.max(minF, 0.016 * k * law.focal ** 0.7)), m: 14, rim: 0.5, group: G.accent } };
  kit.push(anchor);
  // law 5 + 11: the ornament budget spends on the FOCAL's edges first — a rolled edge on the anchor (≥ 1), then on its
  // lames (≥ 2); a partner stays plain
  if (rank === 'focal' && orn >= 1) kit.push(edgeTrim(anchor, { at: 'low', w: 0.016 * k * law.rivet, thick: thick * 2.2, group: G.trim, minF }));
  if (rank === 'focal' && orn >= 2) for (const A of kit.filter((e) => /-lame\d+$/.test(e.id))) kit.push(edgeTrim(A, { at: 'low', w: 0.012 * k * law.rivet, thick: thick * 1.8, group: G.trim, minF }));
  return { kit, trace: { variant, lames } };
}

// ORDER (law 9): the partner pauldron arrives at 0.5 as a LESSER piece, so below 0.5 the suit is asymmetric. Each row:
// [threshold, slot, who]; `fn` is the arm that carries function (a bow arm takes the first bracer).
export const PLATE_ORDER = Object.freeze([
  [0.0, 'pauldron', 'focal'], [0.15, 'cuirass', null], [0.25, 'vambrace', 'fn'], [0.35, 'gorget', null],
  [0.5, 'pauldron', 'partner'], [0.5, 'vambrace', 'other'], [0.6, 'greave', 'both'], [0.7, 'couter', 'both'], [0.7, 'poleyn', 'both'],
  [0.8, 'rerebrace', 'both'], [0.8, 'fauld', null], [0.8, 'tasset', 'both'], [0.9, 'cuisse', 'both'], [1.0, 'gauntlet', 'both'], [1.0, 'sabaton', 'both'],
]);
// WEAR ORDER (inner → outer): true stacking lifts each over what is worn before it on the same carrier names
const WEAR = ['cuirass', 'fauld', 'tasset', 'gorget', 'rerebrace', 'vambrace', 'couter', 'gauntlet', 'cuisse', 'greave', 'poleyn', 'sabaton', 'pauldron'];

/** a plate suit at `dials.coverage` as one kit. opts: focalSide, fnSide, variant ('spaulder' | 'bell') */
export function plateSuit(dials, ctx, { focalSide = 'R', fnSide = 'L', variant = 'spaulder', groups = {} } = {}) {
  const { Ht, Hl, k = 1, height = 1.75 } = ctx; const c = dials.coverage ?? 0;
  // the thigh's own ring half (the structured core's thigh takes the trunk's family), and whether a pelvis carries the hips
  const Hth = ctx.Hth ?? Hl, onPelvis = ctx.pelvis === true;
  const law = armorProportion(dials), minF = law.minFeature * height, orn = dials.ornament ?? 1;
  const G = { plate: 'Plate', trim: 'Trim', rivet: 'Rivet', accent: 'Accent', strap: 'Leather', ...groups };
  const thick = Math.max(minF, 0.0045 * k * law.thick), mug = (m) => r4(m * k * law.standoff);
  const other = (S) => (S === 'R' ? 'L' : 'R');
  // a secondary piece's signature: its edge rivets (law 11), floored by law 4
  const rivets = (n, j = -1) => ({ kind: 'studs', j, count: Math.max(1, Math.round(n * law.lames)), r: r4(Math.max(minF * 0.6, 0.004 * k * law.rivet)), h: r4(Math.max(minF * 0.4, 0.0028 * k * law.rivet)), m: 8, group: G.rivet });
  const plate = (o) => ({ mode: 'shell', nt: 12, ns: 3, thick, rad: r4(0.03 * k), group: G.plate, rigid: true, ...o });
  const SLOTS = {
    // law 12: a breastplate and a backplate, each two halves meeting on the midline, strapped at the sides under the
    // arms (a wrapped cuirass is entered by the hanging arms). The front seam carries a ridge: law 11's one line
    cuirass: () => { const out = [];
      for (const S of ['R', 'L']) out.push(plate({ id: `torso-breast${S}`, part: 'torso', side: S, s: [1.05, 3.1], t: [0, r4(0.36 * Ht)], nt: 6, ns: 4, mugen: mug(0.006), support: 3.1, ramp: 0.3, signature: rivets(1 + orn, 0) }));
      for (const S of ['R', 'L']) out.push(plate({ id: `torso-back${S}`, part: 'torso', side: S, s: [1.05, 3.1], t: [r4(0.64 * Ht), Ht], nt: 6, ns: 4, mugen: mug(0.006), support: 3.1, ramp: 0.3, signature: rivets(1 + orn, 0) }));
      out.push({ id: 'torso-ridge', mode: 'strap', part: 'torso', path: [[1.1, 0.03, 'R'], [2.1, 0.03, 'R'], [3.05, 0.03, 'R']], width: r4(Math.max(minF * 2, 0.014 * k)), thick: r4(thick * 1.6), mugen: 0.001, rad: r4(0.05 * k), group: G.plate, signature: rivets(1, 0) });
      for (const S of ['R', 'L']) for (const sz of [1.15, 1.45]) out.push({   // below the hanging arm (it lies along the torso to the waist)
        id: `torso-strap${S}${Math.round(sz * 10)}`, mode: 'strap', part: 'torso', path: [[sz, r4(0.3 * Ht), S], [sz, r4(0.5 * Ht), S], [sz, r4(0.7 * Ht), S]], width: r4(0.022 * k), thick: r4(0.004 * k), mugen: 0.001, rad: r4(0.05 * k), group: G.strap,
        signature: { kind: 'buckle', w: r4(0.012 * k), h: r4(0.01 * k), bar: r4(Math.max(minF * 0.5, 0.0025 * k)), standoff: r4(0.003 * k), group: G.rivet } });
      return out; },
    // the pelvis bone's territory is torso s < 1: the fauld rides it
    fauld: () => [plate({ id: 'torso-fauld', part: 'torso', over: ['thighR', 'thighL'], pin: [0.5, 0, 'R', 'torso'], s: [0.05, 0.95], t: 'wrap', nt: 16, ns: 2, mugen: mug(0.007), support: 1.05, ramp: r4(0.6 * law.flare), signature: rivets(2 + orn, -1) }),
      // on the structured core the hoops carry on down the pelvis from the hem over the crest (they ride the basin), so
      // the hips are plated under the breastplate instead of left bare between the fauld and the tassets
      // (they stop under the torso's own fauld at the crest and stand off the torso too, so a broadened chest closes over them)
      ...(onPelvis ? [plate({ id: 'pelvis-fauld', mode: 'band', part: 'pelvis', over: ['thighR', 'thighL', 'torso'], pin: [4.2, 0, 'R', 'pelvis'], s: [3.0, 4.7], t: 'wrap', nt: 16, ns: 3, mugen: mug(0.005), support: 4.7, ramp: r4(0.3 * law.flare), signature: rivets(1 + orn, 0) })] : [])],
    gorget: () => [plate({ id: 'neck-gorget', mode: 'band', part: 'neck', over: ['torso'], pin: [3.95, 0, 'R', 'torso'], s: [0.0, 0.6], t: 'wrap', nt: 12, ns: 2, mugen: mug(0.004), support: 0.95, ramp: r4(0.8 * law.flare), signature: rivets(1 + orn, 0) })],
    rerebrace: (S) => [plate({ id: `upperArm${S}-rerebrace`, part: `upperArm${S}`, s: [0.95, 1.75], t: 'wrap', mugen: mug(0.003), signature: rivets(1 + orn, -1) })],
    vambrace: (S) => [plate({ id: `foreArm${S}-vambrace`, part: `foreArm${S}`, s: [0.35, 1.7], t: 'wrap', mugen: mug(0.003), support: 0.35, ramp: r4(0.5 * law.flare), signature: rivets(1 + orn, -1) })],
    couter: (S) => [plate({ id: `upperArm${S}-couter`, part: `upperArm${S}`, over: [`foreArm${S}`], side: S, s: [1.6, 2.0], t: [r4(0.5 * Hl), r4(1.0 * Hl)], nt: 8, ns: 2, mugen: mug(0.005), support: 1.6, ramp: r4(0.6 * law.flare), signature: rivets(1, 0) })],
    gauntlet: (S) => [plate({ id: `hand${S}-gauntlet`, part: `hand${S}`, s: [0.3, 1.3], t: 'wrap', nt: 10, ns: 2, mugen: mug(0.003), signature: rivets(1 + orn, 1) }),
      plate({ id: `foreArm${S}-cuff`, part: `foreArm${S}`, s: [1.45, 1.85], t: 'wrap', nt: 12, ns: 2, mugen: mug(0.006), support: 1.85, ramp: r4(law.flare), signature: rivets(1 + orn, 0) })],
    tasset: (S) => (onPelvis
      // on the structured core the tasset hangs from the pelvis's crest over the hip to the trochanter, riding the basin
      // (a spine curl leaves it on the hip), standing off the thigh it covers so a wider stance does not close on it
      ? [plate({ id: `pelvis-tasset${S}`, part: 'pelvis', over: [`thigh${S}`], side: S, s: [1.1, 3.6], t: [r4(0.1 * Ht), r4(0.62 * Ht)], nt: 8, ns: 3, mugen: mug(0.012), support: 3.6, ramp: r4(0.25 * law.flare), pin: [2.6, r4(0.36 * Ht), S, 'pelvis'], signature: rivets(1 + orn, -1) })]
      : [plate({ id: `thigh${S}-tasset`, part: `thigh${S}`, side: S, s: [0.1, 1.4], t: [r4(0.02 * Hl), r4(0.62 * Hl)], nt: 8, ns: 2, mugen: mug(0.02), support: 0.1, ramp: r4(0.4 * law.flare), pin: [0.4, r4(0.2 * Ht), S, 'torso'], signature: rivets(1 + orn, -1) })]),
    // law 8: plate stays off where the thighs touch — the cuisse covers the front and outside only
    cuisse: (S) => [plate({ id: `thigh${S}-cuisse`, part: `thigh${S}`, side: S, s: [1.6, 3.3], t: [0, r4(0.6 * Hth)], nt: 8, ns: 3, mugen: mug(0.004), signature: rivets(1 + orn, -1) }),
      plate({ id: `thigh${S}-cuisseM`, part: `thigh${S}`, side: other(S), s: [1.6, 3.3], t: [0, r4(0.18 * Hth)], nt: 4, ns: 3, mugen: mug(0.004), signature: rivets(1, -1) })],
    poleyn: (S) => [plate({ id: `thigh${S}-poleyn`, part: `thigh${S}`, over: [`shank${S}`], side: S, s: [3.45, 4.0], t: [0, r4(0.55 * Hth)], nt: 8, ns: 2, mugen: mug(0.006), support: 3.45, ramp: r4(0.5 * law.flare), signature: rivets(1, -1) }),
      plate({ id: `thigh${S}-poleynM`, part: `thigh${S}`, over: [`shank${S}`], side: other(S), s: [3.45, 4.0], t: [0, r4(0.4 * Hth)], nt: 6, ns: 2, mugen: mug(0.006), support: 3.45, ramp: r4(0.5 * law.flare), signature: rivets(1, -1) })],
    greave: (S) => [plate({ id: `shank${S}-greave`, part: `shank${S}`, s: [0.2, 1.8], t: 'wrap', nt: 12, ns: 3, mugen: mug(0.004), support: 1.8, ramp: r4(0.4 * law.flare), signature: rivets(1 + orn, -1) })],
    sabaton: (S) => [plate({ id: `foot${S}-sabaton`, part: `foot${S}`, over: [`toes${S}`], s: [0.45, 2.0], t: 'wrap', nt: 10, ns: 3, mugen: mug(0.003), signature: rivets(1 + orn, -1) })],
  };
  const pieces = []; const worn = [];
  for (const [th, slot, who] of PLATE_ORDER) {
    if (c < th - 1e-9) continue;
    const sides = who === 'both' ? [focalSide, other(focalSide)] : who === 'fn' ? [fnSide] : who === 'other' ? [other(fnSide)] : who === 'focal' ? [focalSide] : who === 'partner' ? [other(focalSide)] : [null];
    for (const S of sides) { worn.push(`${slot}${S ? ':' + S : ''}`);
      if (slot === 'pauldron') { const rank = who === 'focal' ? 'focal' : 'partner'; pieces.push({ slot, rank, entries: pauldron(variant, dials, ctx, { side: S, rank, groups }).kit }); }
      else pieces.push({ slot, entries: SLOTS[slot](S) }); }
  }
  pieces.sort((a, b) => WEAR.indexOf(a.slot) - WEAR.indexOf(b.slot) || (a.rank === 'focal') - (b.rank === 'focal'));
  return { kit: pieces.flatMap((p) => p.entries), trace: { worn, pieces: pieces.length, focal: `pauldron:${focalSide}` } };
}
