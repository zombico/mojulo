/** hero-dress.js — the hero's BODY DETAIL and ADORNMENT as data over the dragon's passes (station-loft-body.js,
 * station-loft-adorn.js): the same operators, the hero's parameters. The hero is the passes' second body.
 *
 * `detail`: a preset word ('clothed'), 'none', or BODY DATA. `clothed` is a garment read, not anatomy: density at the
 * elbows and knees, masses a jerkin and trousers keep (chest, shoulder blades, seat, quadriceps, calves), cloth FOLDS
 * at the elbow and the knee standing at rest (a `floor`, since the rest pose barely bends), a QUILTED jerkin grown only
 * where the torso bone dominates (it broadens over the chest and narrows at the waist because the grid is the ring's),
 * a placket left bare down the front with a row of toggles on it, knee patches facing forward, cuffs at the wrists and
 * leg wraps at the ankles. No spurs, no spines: a human has none.
 *
 * `swimsuit` is the body BARE, to see its forms and mark its silhouette: every Top / Bottom / Shoes part is Skin and
 * swimwear is painted on the trunk's own faces (`bandGroups`), no part of its own: the adult male's trunks, the adult
 * female's two-piece (a band round the ribs under the bust, the breasts' lower poles its cups, the briefs high on the hip), and a child-coded
 * figure's rash vest and trunks (never bare-chested). Its tone is `Swim`, the operator's to name.
 *
 * `adorn`: a kit word ('ranger'), 'none', or a KIT (a list of adornments). `ranger`: a belt with an iron buckle, a
 * baldric across the chest from the right shoulder to the left hip with an iron ring, an archer's leather bracer on the
 * LEFT forearm, and ONE defended shoulder — an iron pauldron on the right with a bronze boss, the kit's single focal
 * accent. Worn in that order, so the pauldron stacks over the baldric. The kit suggests an earth palette beneath the
 * operator's own. Or an ARMOUR BUILD `{ type: 'armor', style, dials }` (armor/expand.js): the words are stored and the
 * kit is expanded from them on every read, so a dial patch restyles the suit in place; its card suggests the tones.
 *
 * Addresses are generated per register: the ring parameter `t` runs 0 (front) → H (back) and H is the ring family's
 * half (ring6 3, ring8 4), so a kit written as fractions of H sits in the same place in every register. Metres scale
 * with the cast. Tones that detail needs (folds, quilt, cuffs) are derived from the palette's own Top / Bottom / Shoes,
 * so a palette change carries them; any tone the operator names wins. */
import { SLOT_FAMILIES } from './station-loft-plan.js';
import { isArmorBuild, validateArmor, expandArmor, armorTones } from '../armor/expand.js';

export const DETAIL_WORDS = ['clothed', 'swimsuit', 'none'];
export const KIT_WORDS = ['ranger', 'none'];
const both = (xs) => xs.flatMap((n) => (/R$/.test(n) ? [n, n.replace(/R$/, 'L')] : [n]));

/** the register's ring halves: the torso's (`slots`) and the limbs' (`limbSlots`). On a plan with the structured core's
 * pelvis (hero-form.js HERO_CORES) also `pelvis: true` and `Hth`, the thigh's own half (it takes the trunk's ring family
 * there), so hip pieces hang from the pelvis and a thigh plate wraps the thigh it is drawn on; absent, as before. A dense
 * torso (its slots addressed by `slotT`) says `dense: true`; chest layers (hero-form.js CHEST_FORM) are `chest`. */
export function dressContext(style = {}, scale = 1, plan = null) {
  const half = (fam) => (SLOT_FAMILIES[fam] ?? SLOT_FAMILIES.ring8).length / 2;
  const ctx = { Ht: half(style.slots ?? 'ring8'), Hl: half(style.limbSlots ?? 'limb6'), scale };
  const segs = plan?.segments || [], thigh = segs.find((s) => s.name === 'thighR');
  if (segs.some((s) => s.name === 'pelvis')) Object.assign(ctx, { pelvis: true, Hth: thigh?.slots ? half(thigh.slots) : ctx.Hl });
  if (segs.find((s) => s.name === 'torso')?.slotT) ctx.dense = true;
  const chest = segs.filter((s) => /^(pectoral|bust)R$/.test(s.name)).flatMap((s) => [s.name, s.name.replace(/R$/, 'L')]);
  if (chest.length) ctx.chest = chest;
  return ctx;
}
/** Every piece worn on the torso stands off the chest's layers too (hero-form.js CHEST_FORM: the pectorals, the breasts),
 * which lie over it there. Absent layers, the kit as given. */
const overChest = (kit, ctx) => (!ctx.chest || !Array.isArray(kit) ? kit
  : kit.map((A) => (A.part === 'torso' || (Array.isArray(A.over) && A.over.includes('torso')) ? { ...A, over: [...new Set([...(A.over || []), ...ctx.chest])] } : A)));
/** A jerkin covers the chest's muscle: the clothed body drops the pectoral layers (its own volume is the chest under the
 * cloth, and its quilt is grown on the torso's faces), from the segments and every dial; a bust stays under the cloth */
function dropPectorals(plan) {
  plan.segments = plan.segments.filter((s) => !/^pectoral[RL]$/.test(s.name));
  for (const d of Object.values(plan.dials || {})) if (Array.isArray(d.parts)) d.parts = d.parts.filter((n) => !/^pectoral(\$S|[RL])$/.test(n));
}
/** On the structured core every piece that stands off the thighs stands off the pelvis between them too (a fauld, a
 * belt, an operator's own kit): the pelvis is the surface under the hips there. Absent a pelvis, the kit as given. */
const overPelvis = (kit, ctx) => (!ctx.pelvis || !Array.isArray(kit) ? kit
  : kit.map((A) => (Array.isArray(A.over) && A.over.some((n) => /^thigh[RL]$/.test(n)) && !A.over.includes('pelvis') && A.part !== 'pelvis' ? { ...A, over: [...A.over, 'pelvis'] } : A)));

/** BODY DATA for the clothed hero */
export function clothedBody({ Ht, Hl, scale: k, pelvis: structured = false, dense = false }) {
  const quilt = structured ? [1.3, 2.9] : [1.7, 3.2];   // the structured chest is rounder (less flat front per band): the panel runs longer and stops under the shoulder's turn, so its tiles keep their size
  // on the dense torso (hero-form.js DENSE_TRUNK) the front plane's slots split the panel's span: it reaches a little
  // wider either side so its tiles keep their size there too
  return {
    refine: [{ parts: both(['upperArmR', 'foreArmR', 'thighR', 'shankR']), slots: 'halve' }, { parts: ['torso'], slots: false }],
    volume: [
      ['torso', { 'front*': 0.8, front: 0.4 }, { st2: 0.6, st3: 0.25 }, 0.008 * k],   // chest under the jerkin
      ['torso', { 'back*': 0.8 }, { st2: 0.35, st3: 0.6 }, 0.006 * k],               // shoulder blades
      ...both(['thighR']).flatMap((p) => [[p, { back: 1, 'back*': 0.7 }, { st1: 1, st2: 0.45 }, 0.012 * k],   // seat
        [p, { front: 1, 'front*': 0.6 }, { st2: 0.5, st3: 1 }, 0.007 * k]]),                                  // quadriceps
      ...both(['shankR']).map((p) => [p, { back: 1, 'back*': 0.6 }, { st1: 1, st0: 0.3 }, 0.008 * k]),        // calf
    ],
    // folds at the elbows: broad and soft, a shade off the cloth, so they read as the sleeve gathering and not as
    // stitches. The knee's read is its patch; folds there too piled into knots (not wanted: the hierarchy stays quiet)
    creases: { joints: [['upperArmR', 'foreArmR', 'TopFold'], ['upperArmL', 'foreArmL', 'TopFold']], lift: 0.32, width: 0.5, floor: 0.6 },
    // quilted jerkin: a front panel either side of a bare placket and a back panel, the sides left plain under the arms;
    // front → frontR is the chest's front plane in every ring family (t 0 → 1), the back plane is H − 1 → H
    tiles: [{ id: 'quiltFront', parts: ['torso'], s: quilt, t: dense ? [0.15, 1.1] : [0.22, 0.96], grid: [4, 3], sides: 4, coverage: 0.93, inset: 0.2, height: 0.006 * k, lean: 0, group: ['Quilt'] },
      { id: 'quiltBack', parts: ['torso'], s: quilt, t: [Ht - 0.94, Ht - 0.1], grid: [4, 3], sides: 4, coverage: 0.93, inset: 0.2, height: 0.006 * k, lean: 0, group: ['Quilt'] }],
    pads: both(['shankR']).map((p) => ({ id: `patch.${p}`, part: p, s: 0.16, toward: { world: [0, 1, 0] }, r: 0.66, rim: 0.05, floor: 0.08, m: 8, groups: ['PatchSeam', 'Patch'] })),
    rows: [{ part: 'torso', t: 'front', s: [1.75, 3.1], step: 0.3, shape: 'stud', r: 0.011 * k, h: 0.007 * k, m: 8, group: 'Toggle' }],
    collars: [...both(['foreArmR']).map((p) => ({ id: `cuff.${p}`, part: p, at: 'st1_st2_50', height: 0.16, width: 0.5, group: 'Cuff' })),
      ...both(['shankR']).map((p) => ({ id: `wrap.${p}`, part: p, at: 'st1_st2_50', height: 0.14, width: 0.7, group: 'Wrap' }))],
  };
}

/** the swimwear's tone per figure, beneath the operator's `Swim` */
export const SWIM_TONES = Object.freeze({ male: '#24476b', female: '#a83a4c' });
/** the SWIMSUIT cut, per part: which bands are swimwear, by the band's middle in `u` (the station parameter) and in `t`
 * (0 front → 1 back, a share of the ring half, so a cut reads the same in every register). The pelvis and the thigh
 * per core: on the structured core the pelvis is the basin (u 0 the crotch, 4 the iliac rim) and the thigh starts at the
 * socket; on the streamlined core the thighs carry the hips (u 0 the crest, 1 the hip ring) */
const SWIM_CUTS = {
  male: { pelvis: (u, _t, structured) => !structured || u < 5, thigh: (u, _t, structured) => u < (structured ? 1.6 : 2) },
  // the cups the breast's lower three quarters (`n` its stations): its upper pole stays skin, so where it melts into the
  // chest skin meets skin and the cup's top edge is a clean level line; on the torso only the strap round the sides and
  // back (the breast lies over its front there). The briefs run up to the hem (the pelvis's rings below the one it tucks
  // under the torso with), so the line where the torso meets the pelvis is the waistband's edge, never a seam on skin
  female: { pelvis: (u, _t, structured) => !structured || u < 5, thigh: (u, _t, structured) => !structured && u < 1, torso: (u, t, structured) => u >= 1.5 && u < 2 && (!structured || t > 0.3), bust: (u, _t, _s, n) => u / (n - 1) < 0.72 },
  child: { pelvis: (u, _t, structured) => !structured || u < 5, thigh: (u, _t, structured) => u < (structured ? 1 : 2), torso: (u) => u < 3.5 },
};
/** The swimsuit on a plan: the body's clothing groups become Skin, the cut's bands `Swim` (figure: { female, child }) */
export function swimsuit(plan, { female = false, child = false } = {}) {
  const fams = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) }, structured = plan.segments.some((s) => s.name === 'pelvis');
  const cut = SWIM_CUTS[child ? 'child' : female ? 'female' : 'male'];
  for (const seg of plan.segments) {
    // the streamlined bust's mounds are the cups whole; the structured breast (a rings part) takes the cut below
    if (['Top', 'Bottom', 'Shoes'].includes(seg.group)) seg.group = /^bust[RL]$/.test(seg.name) && seg.kind !== 'rings' ? 'Swim' : 'Skin';
    const test = cut[seg.name.replace(/[RL]$/, '')]; if (!test || !Array.isArray(seg.stations)) continue;
    const f = seg.slots ?? plan.style?.[seg.kind === 'trunk' ? 'slots' : 'limbSlots'] ?? (seg.kind === 'trunk' ? 'ring8' : 'limb6'), F = typeof f === 'string' ? fams[f] : f, half = F.length / 2;
    const T = F.slice(0, half + 1).map((sl, k) => seg.slotT?.[sl] ?? k), H = T[half];
    const U = seg.stations.map((st, i) => st.u ?? i), ids = seg.stations.map((st, i) => st.id ?? `st${i}`);
    const bands = {};
    for (let i = 0; i + 1 < ids.length; i++) {
      const row = T.slice(0, half).map((t, k) => (test((U[i] + U[i + 1]) / 2, (t + T[k + 1]) / (2 * H), structured, ids.length) ? 'Swim' : 'Skin'));
      if (row.includes('Swim')) bands[`${ids[i]}-${ids[i + 1]}`] = row;
    }
    if (Object.keys(bands).length) seg.bandGroups = { ...(seg.bandGroups || {}), ...bands };
    // a cap closes a swimwear band: the thigh's top inside the hip, the pelvis's at the crotch
    const caps = { ...(bands[`${ids[0]}-${ids[1]}`] ? { back: 'Swim' } : {}), ...(bands[`${ids[ids.length - 2]}-${ids[ids.length - 1]}`] ? { tip: 'Swim' } : {}) };
    if (Object.keys(caps).length) seg.capGroups = { ...(seg.capGroups || {}), ...caps };
  }
  return plan;
}

/** the RANGER kit: belt, baldric, archer's bracer on the left, one pauldron on the right (the focal accent) */
export function rangerKit({ Ht, Hl, scale: k, pelvis: structured = false }) {
  const cap = structured ? [2.55, 3.45] : [2.8, 3.8];   // the structured torso's shoulder ring over the arm's cap, a trapezius ring above (plate.js pauldron)
  return [
    { id: 'belt', mode: 'band', part: 'torso', over: ['thighR', 'thighL'], s: [0.12, 0.44], t: 'wrap', nt: 12, ns: 2, mugen: 0.004 * k, thick: 0.01 * k, rad: 0.05 * k, group: 'Leather',
      signature: { kind: 'buckle', k: 0, j: 1, w: 0.028 * k, h: 0.022 * k, bar: 0.0055 * k, standoff: 0.006 * k, group: 'Iron' } },
    { id: 'baldric', mode: 'strap', part: 'torso', path: [[3.55, 0.5 * Ht, 'R'], [3.1, 0.25 * Ht, 'R'], [2.55, 0.06 * Ht, 'R'], [2.05, 0.18 * Ht, 'L'], [1.5, 0.4 * Ht, 'L'], [1.0, 0.55 * Ht, 'L'], [0.6, 0.62 * Ht, 'L']],
      width: 0.045 * k, thick: 0.007 * k, mugen: 0.004 * k, rad: 0.05 * k, group: 'Leather',
      signature: { kind: 'buckle', w: 0.033 * k, h: 0.028 * k, bar: 0.007 * k, standoff: 0.006 * k, group: 'Iron' } },
    { id: 'bracer', mode: 'shell', part: 'foreArmL', s: [0.72, 1.36], t: 'wrap', nt: 10, ns: 2, mugen: 0.003 * k, thick: 0.006 * k, rad: 0.03 * k, group: 'Leather', rigid: true,
      signature: { kind: 'buckle', side: 'L', t: 0.5 * Hl, tol: 0.6, w: 0.027 * k, h: 0.023 * k, bar: 0.0065 * k, standoff: 0.004 * k, group: 'Iron' } },
    // the pauldron caps the shoulder: the torso's slope from the yoke toward the neck, front to back round the side,
    // lifted over the arm's cap beneath it (`over`), snug at the top and flaring at its lower edge. It rides the torso,
    // so the arm moves beneath it: the dragon's rule on a human shoulder
    { id: 'pauldron', mode: 'shell', part: 'torso', over: ['upperArmR'], side: 'R', s: cap, t: [0.24 * Ht, 0.76 * Ht], nt: 8, ns: 4, mugen: 0.008 * k, thick: 0.014 * k, rad: 0.05 * k, support: cap[1], ramp: 1.2, group: 'Iron', rigid: true,
      signature: { kind: 'boss', k: 'mid', j: 1, r: 0.041 * k, h: 0.022 * k, m: 10, rim: 0.5, group: 'Bronze' } },
  ];
}
const KIT_PALETTES = { ranger: { Top: '#56683f', Bottom: '#4a3f33', Shoes: '#3a2a1e' } };

/** '#rrggbb' scaled toward black (< 1) or white (> 1) */
export function shade(hex, f) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); const s = c.map((x) => Math.round(f < 1 ? x * f : x + (255 - x) * (f - 1)));
  return `#${s.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`; }
/** the tones detail and adornment need, derived from the figure's own Top / Bottom / Shoes */
export function dressTones(p) {
  return { TopFold: shade(p.Top, 0.84), BottomFold: shade(p.Bottom, 0.8), Quilt: shade(p.Top, 1.1), Cuff: shade(p.Top, 0.78), Toggle: '#d6c9a8',
    Patch: shade(p.Bottom, 1.28), PatchSeam: shade(p.Bottom, 0.75), Wrap: '#7d6547', Leather: '#6a4327', Iron: '#8d9197', Bronze: '#b98a44' };
}
/** the palette a kit suggests beneath the operator's own (an armour build suggests its card's tones) */
export const kitPalette = (adorn) => (typeof adorn === 'string' ? KIT_PALETTES[adorn] || {} : isArmorBuild(adorn) ? armorTones(adorn) : {});

/** Error strings for the door's `detail` / `adorn` (form only; the plan grammar judges the data). */
export function validateDress({ detail, adorn } = {}) {
  const errs = [];
  if (detail !== undefined && !(typeof detail === 'string' ? DETAIL_WORDS.includes(detail) : detail && typeof detail === 'object' && !Array.isArray(detail))) errs.push(`detail: ${DETAIL_WORDS.map((w) => `'${w}'`).join(' | ')} or BODY DATA { refine, volume, creases, tiles, pads, rows, collars }`);
  if (isArmorBuild(adorn)) errs.push(...validateArmor(adorn));
  else if (adorn !== undefined && !(typeof adorn === 'string' ? KIT_WORDS.includes(adorn) : Array.isArray(adorn))) errs.push(`adorn: ${KIT_WORDS.map((w) => `'${w}'`).join(' | ')}, an armour build { type: 'armor', style, dials? } (armor/expand.js), or a KIT [{ id, mode, part, …, signature }]`);
  return errs;
}

/** Put `detail` / `adorn` on a hero plan: `plan.body`, `plan.adorn`, and the palette (the kit's suggestion beneath the
 * operator's colours, then the derived tones beneath any the operator names). Absent or 'none' changes nothing. */
export function dressPlan(plan, { detail, adorn, operatorPalette = {}, scale = 1, figure = {} } = {}) {
  const wantDetail = detail !== undefined && detail !== 'none', wantAdorn = adorn !== undefined && adorn !== 'none';
  if (!wantDetail && !wantAdorn) return plan;
  const errs = validateDress({ detail, adorn }); if (errs.length) throw new Error(`hero dress: ${errs.join('; ')}`);
  if (detail === 'clothed') dropPectorals(plan);
  const ctx = dressContext(plan.style, scale, plan);
  if (detail === 'swimsuit') swimsuit(plan, figure);
  else if (wantDetail) plan.body = typeof detail === 'string' ? clothedBody(ctx) : detail;
  // an armour build expands on every read into a kit (armor/expand.js), from the register's ring halves and the scale
  if (wantAdorn && isArmorBuild(adorn)) { const A = expandArmor(adorn, ctx); plan.adorn = overChest(overPelvis(A.kit, ctx), ctx); if (A.emissive.length) plan.emissive = [...new Set([...(plan.emissive || []), ...A.emissive])]; }
  else if (wantAdorn) plan.adorn = overChest(overPelvis(typeof adorn === 'string' ? rangerKit(ctx) : adorn, ctx), ctx);
  // the kit's suggestion is already beneath the operator's colours in plan.palette (humanoidPlan builds the head with it)
  const base = { ...plan.palette, ...(detail === 'swimsuit' ? { Swim: SWIM_TONES[figure.female && !figure.child ? 'female' : 'male'] } : {}), ...operatorPalette };
  plan.palette = { ...base, ...dressTones(base), ...operatorPalette };
  return plan;
}
