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
import { hexLch } from './station-loft-shade.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
export const COLOUR_GROUPS = Object.freeze({ base: 'OutfitBase', secondary: 'OutfitSecond', trim: 'OutfitTrim', accent: 'OutfitAccent', leather: 'Leather' });

/** the body's landmarks, read off a creature plan: heights, the torso's and pelvis's rings by height, the size scale */
export function bodyMap(plan) {
  const J = plan.joints || {}, seg = (n) => (plan.segments || []).find((s) => s.name === n);
  const torso = seg('torso'), pelvis = seg('pelvis'), z = (n) => J[n]?.[2];
  const ringAt = (part, h) => { const S = part.stations; if (h <= S[0].z) return { s: 0, r: S[0].r, yc: S[0].yc ?? 0 }; for (let i = 0; i + 1 < S.length; i++) if (h <= S[i + 1].z) { const f = (h - S[i].z) / (S[i + 1].z - S[i].z), lerp = (a, b) => (Array.isArray(a) ? a.map((x, k) => x + (b[k] - x) * f) : a + (b - a) * f);
    return { s: i + f, r: lerp(S[i].r, S[i + 1].r), yc: lerp(S[i].yc ?? 0, S[i + 1].yc ?? 0) }; } const L = S[S.length - 1]; return { s: S.length - 1, r: L.r, yc: L.yc ?? 0 }; };
  // the natural WAIST: the torso's narrowest ring between the hips and the shoulders
  const waist = torso.stations.filter((st) => st.z > (z('hip') ?? 0) && st.z < (z('shoulder') ?? Infinity)).reduce((a, st) => (!a || rad(st.r) < rad(a.r) ? st : a), null) ?? torso.stations[1];
  const ankle = z('hock') ?? z('ankle') ?? z('toeBase') ?? 0;
  return { J, torso, pelvis, ringAt, shoulder: z('shoulder'), neck: z('neckBase') ?? z('neckTop'), waist: waist.z, hip: z('hip'), knee: z('knee'), ankle, k: (z('neckTop') ?? 1.6) / 1.6,
    thigh: seg('thighR') };
}

const shell = (id, part, s, extra = {}) => ({ id, mode: 'shell', part, s: s.map(r3), t: 'wrap', nt: 16, ns: 2, ...extra });

/** THE CATALOGUE: each kind's layer, class, colour role and compile (piece, body, groupOf) → { garments?, adorn?, segments? } */
export const OUTFIT_KINDS = Object.freeze({
  // L2: a GOWN, a ROBE, a TUNIC: a fitted bodice and a skirt tailored from the waist to its hem
  gown: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G) => gownOf(p, B, G, { hem: 'shin', flare: 0.45 }) },
  robe: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G) => gownOf(p, B, G, { hem: 'ankle', flare: 0.25 }) },
  tunic: { layer: 2, cls: 'soft', colour: 'base', compile: (p, B, G) => gownOf(p, B, G, { hem: 'thigh', flare: 0.15 }) },
  // L3: a MANTLE over the shoulders
  mantle: { layer: 3, cls: 'loose', colour: 'secondary', compile: (p, B, G) => { const a = B.ringAt(B.torso, B.shoulder - 0.09 * B.k).s, b = B.torso.stations.length - 1.05;
    return { adorn: [shell(p.id ?? 'mantle', 'torso', [a, b], { nt: 16, ns: 3, mugen: r3(0.035 * B.k), thick: r3(0.016 * B.k), group: G(p), ...(p.clasp === false ? { signature: { kind: 'studs', r: r3(0.006 * B.k), h: r3(0.003 * B.k), count: 1, m: 6, group: G(p) } } : { signature: { kind: 'buckle', k: 0, j: 2, w: r3(0.05 * B.k), h: r3(0.04 * B.k), bar: r3(0.008 * B.k), standoff: r3(0.008 * B.k), group: G({ colour: p.claspColour ?? 'trim' }) } }) })] }; } },
  // L5: a SASH at the natural waist, a BELT on the hip line, a BALDRIC across the chest
  sash: { layer: 5, cls: 'soft', colour: 'trim', compile: (p, B, G) => { const s = B.ringAt(B.torso, B.waist).s;
    return { adorn: [shell(p.id ?? 'sash', 'torso', [Math.max(0, s - 0.2), s + 0.2], { mugen: r3(0.028 * B.k), thick: r3(0.012 * B.k), group: G(p), signature: { kind: 'buckle', k: 0, j: 1, w: r3(0.05 * B.k), h: r3(0.045 * B.k), bar: r3(0.009 * B.k), standoff: r3(0.009 * B.k), group: G({ colour: p.knotColour ?? p.colour ?? 'trim' }) } })] }; } },
  belt: { layer: 5, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [shell(p.id ?? 'belt', 'pelvis', [1.4, 1.85], { nt: 14, mugen: r3(0.02 * B.k), thick: r3(0.014 * B.k), group: G(p), signature: { kind: 'buckle', k: 0, j: 1, w: r3(0.06 * B.k), h: r3(0.05 * B.k), bar: r3(0.01 * B.k), standoff: r3(0.01 * B.k), group: G(p) } })] }) },
  baldric: { layer: 5, cls: 'stiff', colour: 'leather', compile: (p, B, G, I) => { const S = I.side ?? 'R', O = S === 'R' ? 'L' : 'R';
    return { adorn: [{ id: p.id ?? 'baldric', mode: 'strap', part: 'torso', path: [[3.6, 2.2, S], [3.2, 1.2, S], [2.5, 0.45, S], [1.9, 0.05, S], [1.4, 0.5, O], [0.8, 1.3, O], [0.4, 2.0, O]], width: r3(0.06 * B.k), thick: r3(0.01 * B.k), mugen: r3(0.03 * B.k), group: G(p), rad: r3(0.05 * B.k),
      signature: { kind: 'studs', r: r3(0.008 * B.k), h: r3(0.004 * B.k), count: 5, from: 2, m: 6, group: G({ colour: 'trim' }) } }] }; } },
  // L1: WRAPS at the wrists
  wraps: { layer: 1, cls: 'soft', colour: 'secondary', compile: (p, B, G) => ({ adorn: ['R', 'L'].map((S) => ({ id: `${p.id ?? 'wrap'}${S}`, mode: 'band', part: `foreArm${S}`, s: [1.25, 1.75], t: 'wrap', nt: 10, ns: 2, mugen: r3(0.008 * B.k), thick: r3(0.006 * B.k), group: G(p),
    signature: { kind: 'ribbon', k: 0, j: 1, spine: [[0, 0, 0], [0.01 * B.k, -0.02 * B.k, -0.04 * B.k], [0.015 * B.k, -0.03 * B.k, -0.09 * B.k]], width: r3(0.022 * B.k), thick: r3(0.002 * B.k), tip: 'swallow', group: G(p) } })) }) },
  // L4: ARMOUR pieces (rigid; one bone each)
  pauldron: { layer: 4, cls: 'rigid', colour: 'secondary', compile: (p, B, G, I) => ({ adorn: (I.symmetry === 'symmetric' || p.pair ? ['R', 'L'] : [p.side ?? (I.side === 'R' ? 'L' : 'R')]).map((S) => ({ id: `${p.id ?? 'pauldron'}${S}`, mode: 'shell', part: 'torso', over: [`upperArm${S}`], side: S, s: [2.55, 3.5], t: [1.1, 2.9], nt: 10, mugen: r3(0.014 * B.k), thick: r3(0.014 * B.k), group: G(p), rigid: true, rad: r3(0.09 * B.k), support: 3.5, ramp: 1.2,
    signature: { kind: 'boss', side: S, t: 1.5, tol: 0.2, r: r3(0.05 * B.k), h: r3(0.03 * B.k), m: 12, rim: 0.55, group: G({ colour: p.role === 'focal' ? 'accent' : 'trim' }) } })) }) },
  bracers: { layer: 4, cls: 'rigid', colour: 'leather', compile: (p, B, G, I) => ({ adorn: (I.symmetry === 'symmetric' ? ['R', 'L'] : [I.side ?? 'R']).map((S) => ({ id: `${p.id ?? 'bracer'}${S}`, mode: 'shell', part: `foreArm${S}`, s: [0.62, 1.2], t: 'wrap', mugen: r3(0.012 * B.k), thick: r3(0.01 * B.k), group: G(p), rigid: true,
    signature: { kind: 'studs', r: r3(0.008 * B.k), h: r3(0.004 * B.k), count: 3, m: 6, group: G({ colour: 'trim' }) } })) }) },
  // L7: a CHAIN OF OFFICE or a MEDALLION on a cord: a disc hanging at the chest, under the face
  chain: { layer: 7, cls: 'loose', colour: 'accent', compile: (p, B, G) => ({ adorn: [medallionOf(p, B, G, { links: 4, r: 0.055 })] }) },
  medallion: { layer: 7, cls: 'loose', colour: 'accent', compile: (p, B, G) => ({ adorn: [medallionOf(p, B, G, { links: 5, r: 0.05 })] }) },
  // L6: what is CARRIED
  satchel: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G, I) => { const S = p.side ?? I.side ?? 'R';
    return { adorn: [{ id: `${p.id ?? 'satchel'}${S}`, mode: 'shell', part: 'pelvis', side: S, s: [0.8, 1.3], t: [1.6, 2.2], nt: 4, ns: 2, mugen: r3(0.02 * B.k), thick: r3(0.008 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.2 * B.k), h: r3(0.2 * B.k), d: r3(0.09 * B.k), lift: 0, chamfer: r3(0.03 * B.k), group: G(p) } }] }; } },
  pack: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'pack', mode: 'shell', part: 'torso', s: [1.6, 2.6], t: [3.2, 4], nt: 4, ns: 2, mugen: r3(0.03 * B.k), thick: r3(0.01 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.36 * B.k), h: r3(0.38 * B.k), d: r3(0.16 * B.k), lift: 0, chamfer: r3(0.06 * B.k), group: G(p) } }] }) },
  quiver: { layer: 6, cls: 'stiff', colour: 'leather', compile: (p, B, G) => ({ adorn: [{ id: p.id ?? 'quiver', mode: 'shell', part: 'torso', s: [1.6, 2.6], t: [3.2, 4], nt: 4, ns: 2, mugen: r3(0.03 * B.k), thick: r3(0.01 * B.k), group: G({ colour: 'leather' }), signature: { kind: 'pack', w: r3(0.12 * B.k), h: r3(0.45 * B.k), d: r3(0.1 * B.k), lift: 0, chamfer: r3(0.03 * B.k), group: G(p) } }] }) },
});
export const OUTFIT_KIND_NAMES = Object.freeze(Object.keys(OUTFIT_KINDS));

function medallionOf(p, B, G, { links, r }) {
  return { id: p.id ?? p.kind, mode: 'shell', part: 'neck', s: [0.05, 0.3], t: 'wrap', nt: 14, ns: 2, mugen: r3(0.012 * B.k), thick: r3(0.006 * B.k), group: G({ colour: p.cordColour ?? 'accent' }),
    signature: { kind: 'medallion', k: 0, j: 0, anchor: [0, 0.01, -0.01], links: p.links ?? links, len: r3(0.04 * B.k), clear: r3(0.05 * B.k), link: r3(0.005 * B.k), surfaces: ['torso'], out: [0, 1, 0], drop: r3(0.06 * B.k), dropClear: r3(0.06 * B.k), face: [0, 1, 0.15], r: r3((p.size ?? r) * B.k), h: r3(0.016 * B.k), m: 14, rim: 0.6, group: G(p), beneath: ['torso'] } };
}

/** A GOWN, a ROBE or a TUNIC: a bodice fitted over the torso and a SKIRT tailored from the natural waist to its hem.
 * The skirt is one loft round both legs: wide enough at the hips to clear them, flaring by `flare` toward its hem,
 * its hem FLAT (its tip cap on the hem ring's centre, not a point beyond it); it rides the pelvis at the waist and, down
 * its length, each side's points blend toward that side's thigh, so it follows a stride instead of passing through it. */
function gownOf(p, B, G, { hem, flare }) {
  const e = (p.ease ?? 0.018) * B.k, wz = B.waist, w = B.ringAt(B.torso, wz), hz = B.hip, hr = B.ringAt(B.pelvis, Math.min(hz, B.pelvis.stations[B.pelvis.stations.length - 1].z));
  const hemZ = { thigh: hz - 0.5 * (hz - B.knee), shin: B.knee - 0.35 * (B.knee - B.ankle), ankle: B.ankle + 0.12 * (B.knee - B.ankle) }[p.hem ?? hem];
  // wide enough at the hips to clear the thighs (their outer surface, a little ease beyond)
  const legX = Math.abs(B.J.hip?.[0] ?? 0.1) + rad(B.thigh?.rA ?? 0.1) * 1.05, f = p.flare ?? flare;
  const hipR = [Math.max(hr.r[0] + e, legX + e), Math.max(hr.r[1] + e, rad(B.thigh?.rA ?? 0.1) * 1.4 + e)];
  const stations = [
    { at: [0, r3(w.yc), r3(wz)], r: [r3(w.r[0] + e), r3(w.r[1] + e)] },
    { at: [0, r3(hr.yc), r3(hz)], r: hipR.map(r3) },
    { at: [0, r3(hr.yc + 0.005), r3((hz + hemZ) / 2)], r: hipR.map((x) => r3(x * (1 + f * 0.45))) },
    { at: [0, r3(hr.yc + 0.01), r3(hemZ)], r: hipR.map((x) => r3(x * (1 + f))) },
  ];
  const n = stations.length, sideOf = (sl) => (/R$/.test(sl) ? 'R' : /L$/.test(sl) ? 'L' : null);
  const slots = ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'];
  const blend = { back: { pelvis: 1 }, st0: { pelvis: 1 }, st1: { pelvis: 1 } };
  for (let i = 2; i < n; i++) { const t = (i - 1) / (n - 1); for (const sl of slots) { const S = sideOf(sl); blend[`st${i}.${sl}`] = S ? { pelvis: r3(1 - 0.6 * t), [`thigh${S}`]: r3(0.6 * t) } : { pelvis: 1 }; } }
  return {
    garments: [{ id: `${p.id ?? p.kind}Bodice`, part: 'torso', ease: r3(e), group: G(p) }],
    segments: [{ name: `${p.id ?? p.kind}Skirt`, kind: 'loft', stations, slots: 'ring12', caps: { back: [0, r3(w.yc), r3(wz + 0.02 * B.k)], tip: [0, r3(hr.yc + 0.01), r3(hemZ)] }, group: G(p), mirror: 'plane', bind: { bone: 'pelvis', blend } }],
  };
}

export function compileOutfit(plan) {
  const O = plan.outfit; if (!O) return plan;
  const B = bodyMap(plan), I = { symmetry: 'symmetric', side: 'R', ...(O.intent || {}) }, pal = I.palette || {};
  const G = (p) => { const role = p.colour ?? OUTFIT_KINDS[p.kind]?.colour ?? 'base'; return /^#/.test(role) ? role : COLOUR_GROUPS[role] ?? COLOUR_GROUPS.base; };
  const pieces = [...O.pieces].map((p, i) => ({ p, i, layer: OUTFIT_KINDS[p.kind]?.layer ?? 9 })).sort((a, b) => a.layer - b.layer || a.i - b.i);
  const garments = [...(plan.garments || [])], adorn = [...(plan.adorn || [])], segments = [...plan.segments];
  for (const { p } of pieces) { const K = OUTFIT_KINDS[p.kind]; if (!K) throw new Error(`outfit: '${p.kind}' is not a piece kind (have ${OUTFIT_KIND_NAMES.join(', ')})`);
    const out = K.compile(p, B, G, I); garments.push(...(out.garments || [])); adorn.push(...(out.adorn || [])); segments.push(...(out.segments || [])); }
  const palette = { ...(plan.palette || {}), ...Object.fromEntries(Object.entries(COLOUR_GROUPS).filter(([role]) => pal[role]).map(([role, g]) => [g, pal[role]])) };
  const { outfit: _o, ...rest } = plan;
  return { ...rest, segments, ...(garments.length ? { garments } : {}), adorn, palette, outfitCompiled: true };
}

// ─── the laws of visual interest (the Dressing Bible's), advisory ───
/** how much of the outfit's area a kind covers, roughly (a skirt and bodice far more than a buckle) */
const AREA = { gown: 10, robe: 11, tunic: 7, mantle: 4, sash: 1.2, belt: 1, baldric: 1, wraps: 0.6, pauldron: 1.5, bracers: 0.8, chain: 0.5, medallion: 0.4, satchel: 1, pack: 2, quiver: 1 };
export const ARCHETYPE_SHAPES = { ruler: ['bell', 'column'], hero: ['wedge'], outlaw: ['wedge', 'needle'], caregiver: ['bell', 'barrel'], sage: ['bell', 'column'], magician: ['bell', 'needle'], explorer: ['wedge', 'column'], innocent: ['bell', 'barrel'], everyman: ['column', 'barrel'], jester: ['needle', 'wedge'], lover: ['needle', 'bell'], creator: ['column', 'barrel'] };

export function outfitLaws(outfit, ctx = {}) {
  const P = outfit.pieces || [], I = outfit.intent || {}, pal = I.palette || {}, out = [];
  const role = (p) => p.role ?? (OUTFIT_KINDS[p.kind]?.colour === 'accent' ? 'focal' : 'support');
  const colourOf = (p) => p.colour ?? OUTFIT_KINDS[p.kind]?.colour ?? 'base';
  const law = (name, ok, why) => out.push({ law: name, ok, why });
  const focal = P.filter((p) => role(p) === 'focal');
  law('one focal', focal.length === 1, focal.length === 1 ? `${focal[0].kind} leads` : focal.length ? `${focal.length} pieces claim the focal (${focal.map((p) => p.kind).join(', ')}): one leads, the rest support` : 'no piece leads: name one focal');
  const accent = P.filter((p) => colourOf(p) === 'accent' && role(p) !== 'focal');
  law('accent on the focal', accent.length === 0, accent.length ? `${accent.map((p) => p.kind).join(', ')} wear the accent too: spend it on the focal alone` : 'the accent is the focal\'s');
  const area = {}; for (const p of P) { const c = colourOf(p); area[c] = (area[c] ?? 0) + (AREA[p.kind] ?? 1); } const total = Object.values(area).reduce((t, v) => t + v, 0) || 1;
  const share = (c) => (area[c] ?? 0) / total, dom = Math.max(...Object.values(area).map((v) => v / total));
  law('three values, unequal', dom >= 0.45 && share('accent') <= 0.15, `the largest colour covers ${Math.round(dom * 100)}%, the accent ${Math.round(share('accent') * 100)}% (aim 60 / 30 / 10)`);
  const Ls = ['base', 'secondary', 'trim', 'accent'].filter((c) => pal[c]).map((c) => [c, hexLch(pal[c])[0]]);
  const steps = []; for (let i = 0; i < Ls.length; i++) for (let j = i + 1; j < Ls.length; j++) steps.push([Ls[i][0], Ls[j][0], Math.abs(Ls[i][1] - Ls[j][1])]);
  const flat = steps.filter(([a, b, d]) => d < 15 && !(a === 'trim' && b === 'accent'));
  law('clear value steps', !flat.length, flat.length ? flat.map(([a, b, d]) => `${a} and ${b} differ by ${Math.round(d)} L*`).join('; ') : 'every colour role a clear step from the others');
  // the trim's uses: a piece in it, and the small parts that carry it (a mantle's clasp, a sash's knot, a medallion's cord)
  const trimUses = P.filter((p) => colourOf(p) === 'trim').length + P.filter((p) => (p.kind === 'mantle' && p.clasp !== false && (p.claspColour ?? 'trim') === 'trim') || p.knotColour === 'trim' || p.cordColour === 'trim').length;
  law('repetition with variation', trimUses >= 2, `the trim appears on ${trimUses} piece${trimUses === 1 ? '' : 's'} (2 or 3 ties the outfit)`);
  const sided = P.filter((p) => ['satchel'].includes(p.kind) || (['pauldron', 'bracers'].includes(p.kind) && !p.pair && I.symmetry !== 'symmetric') || p.kind === 'baldric');
  if (ctx.order !== undefined) law('symmetry from order', ctx.order < 0.5 ? sided.filter((p) => p.kind !== 'baldric').length <= 1 : sided.length >= 1, ctx.order < 0.5 ? `a bound order: ${sided.length} one-sided piece${sided.length === 1 ? '' : 's'} (one note at most)` : `a free order: ${sided.length} asymmetric piece${sided.length === 1 ? '' : 's'} (at least one)`);
  if (ctx.archetype && I.silhouette) law('shape from the archetype', (ARCHETYPE_SHAPES[ctx.archetype] || []).includes(I.silhouette), `${ctx.archetype} reads as ${(ARCHETYPE_SHAPES[ctx.archetype] || []).join(' or ')}; the outfit aims for ${I.silhouette}`);
  if (ctx.mustSee?.includes('tail')) { const over = P.filter((p) => ['gown', 'robe'].includes(p.kind) && !p.tailSlit); law('the must-see stays seen', !over.length, over.length ? `${over.map((p) => p.kind).join(', ')} would hide the tail: give it a tail slit, or a tunic` : 'nothing covers the tail'); }
  law('restraint', P.length <= 6, `${P.length} pieces (six at most: each one has to earn its place)`);
  const bare = P.filter((p) => !p.why); law('every piece has a reason', !bare.length, bare.length ? `${bare.map((p) => p.kind).join(', ')} name no reason` : 'each piece names its reason');
  return out;
}
