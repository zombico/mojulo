// outfit/expand — an OUTFIT BUILD on the hero's `outfit`, expanded on every read into garments, paint, body detail and
// adornment, by the passes in a fixed order (principles.js carries the laws they obey):
//
//   outfit: { type: 'outfit', style, dials?, language?, laws? }
//     style     a seeded sample name (styles.js) or an inline card
//     dials     { stylize 0–1, fit 0–1, coverage 0–1, ornament 0–3 } over the card's own
//     language  over the card's: { top: {…}, bottom: {…}, outer?: {…}, feet, tuck, focal } (a slot object merges over the card's)
//     laws      the version of principles.js the build was minted under (stamped by the hero record; absent → current)
//     detail    [{ prim, role, group? }]: DETAIL PRIMITIVES seated on the garment's ROLES (GARMENT_ROLES: where a detail can
//               sit on what is worn, the outermost layer first). Given, the list owns the bindings (the trims on hems,
//               cuffs and the collar) and the ornament budget spends the construction alone; absent, the budget spends
//               both, as before
//
//   1 CUT           the language and `coverage` → the pieces and their windows, lengths on landmarks (law 3)
//   2 FIT           each piece's ease from its family × fit × stylize, kept in the body's ratios; a hem falls away only
//                   where its cut says (laws 1, 2, 8)
//   3 LAYER         the order (tucked or worn out), the outer layer's extra ease (law 4), the drape panels over all
//   4 CONSTRUCTION  the family's honest parts: a woven top's placket (law 7)
//   5 ORNAMENT      the edge budget from the focal out (laws 5, 6): collar trim, buttons or the belt; then the cuffs,
//                   hems, ribs and waistband; then the seams
//   6 TONE          the card's tones over tones derived from Top and Bottom; the layers' value step checked (law 4)
//   7 LEDGER        the trace: style, dials, lengths, focal, pieces, the edges spent and the warnings
//
// The hero record stores the words; hero-dress.dressPlan calls `expandOutfit` with the body's parts and scale, and the
// garments (body-garment.js), the trims (body-paint.js, on the garment parts), the buttons (body detail rows) and the
// belt (an adornment) are built like any other. Pure and deterministic: no dice, fixed order.
import { OUTFIT_LAWS_VERSION, FAMILIES, SKIRT_CUTS, TROUSER_CUTS, outfitProportion, stepLength } from './principles.js';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';
import { MOTIFS } from '../polygonizer/station-loft-adorn.js';

export { OUTFIT_LAWS_VERSION };
/** THE GARMENT'S ROLES: where a detail sits. EDGE roles are lines (a hem, a cuff, an opening), FIELD roles areas, each
 * seated on the outermost layer that covers that place; a role nothing worn covers is absent */
export const GARMENT_ROLES = Object.freeze({ collar: 'edge', opening: 'edge', placket: 'edge', hem: 'edge', cuffs: 'edge', waist: 'edge', legHem: 'edge', skirtHem: 'edge',
  yoke: 'field', chest: 'field', back: 'field', sleeveBand: 'field', skirtField: 'field' });
/** THE DETAIL PRIMITIVES (phase 1: binding): each names the kinds of role it can sit on */
export const DETAIL_PRIMS = Object.freeze({
  binding: { on: ['edge'], group: 'Trim', what: 'a band of another cloth bound over an edge (piping, a bound hem, a cuff band)' },
  embroidery: { on: ['edge', 'field'], group: 'Trim', what: 'a motif worked in thread: a border along an edge or a band, an emblem on the chest or the back' },
});
export const MOTIF_NAMES = Object.freeze(Object.keys(MOTIFS));
export const isOutfitBuild = (o) => !!(o && typeof o === 'object' && !Array.isArray(o) && o.type === 'outfit');
const cardOf = (style) => (typeof style === 'string' ? SEEDED_OUTFITS[style] : style);
const DIALS = ['stylize', 'fit', 'coverage', 'ornament'];

/** Validate a build → error strings naming the choices */
export function validateOutfitBuild(build) {
  if (!isOutfitBuild(build)) return ["outfit: { type: 'outfit', style, dials?, language?, pieces?, intent? }"];
  const errs = [], style = build.style ?? 'casual';
  if (typeof style === 'string') { if (!SEEDED_OUTFITS[style]) errs.push(`outfit.style: '${style}' is not a sample (${Object.keys(SEEDED_OUTFITS).join(', ')}); or pass an inline card`); }
  else errs.push(...validateOutfitCard(style));
  const d = build.dials || {};
  if (typeof d !== 'object' || Array.isArray(d)) errs.push(`outfit.dials: { ${DIALS.join(', ')} }`);
  for (const k of Object.keys(d)) if (!DIALS.includes(k)) errs.push(`outfit.dials.${k}: not a dial (${DIALS.join(', ')})`);
  for (const k of ['stylize', 'fit', 'coverage']) if (d[k] !== undefined && !(Number.isFinite(d[k]) && d[k] >= 0 && d[k] <= 1)) errs.push(`outfit.dials.${k}: a number 0–1`);
  if (d.ornament !== undefined && !(Number.isInteger(d.ornament) && d.ornament >= 0 && d.ornament <= 3)) errs.push('outfit.dials.ornament: an integer 0–3');
  const card = cardOf(style);
  if (build.language !== undefined && card && !validateOutfitCard(card).length) errs.push(...validateOutfitCard({ language: languageOf(card, build.language) }, 'outfit').filter((e) => e.includes('language')));
  if (build.detail !== undefined) { if (!Array.isArray(build.detail)) errs.push('outfit.detail: a list of { prim, role, group? }');
    else build.detail.forEach((D, i) => { const at = `outfit.detail[${i}]`;
      if (!D || typeof D !== 'object' || !DETAIL_PRIMS[D.prim]) { errs.push(`${at}.prim: one of ${Object.keys(DETAIL_PRIMS).join(', ')}`); return; }
      if (!GARMENT_ROLES[D.role]) errs.push(`${at}.role: one of ${Object.keys(GARMENT_ROLES).join(', ')}`);
      else if (!DETAIL_PRIMS[D.prim].on.includes(GARMENT_ROLES[D.role])) errs.push(`${at}: a ${D.prim} sits on an ${DETAIL_PRIMS[D.prim].on.join(' or ')} role; '${D.role}' is a ${GARMENT_ROLES[D.role]}`);
      if (D.group !== undefined && !(typeof D.group === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(D.group))) errs.push(`${at}.group: a palette group name`);
      if (D.motif !== undefined && !MOTIFS[D.motif]) errs.push(`${at}.motif: one of ${MOTIF_NAMES.join(', ')}`);
      if (D.motif !== undefined && D.prim !== 'embroidery') errs.push(`${at}.motif: an embroidery's`); }); }
  // the DESIGNED pieces worn over the cut (polygonizer/outfit-plan.js: mantle, pauldron, sash, bracers …) and the intent
  // they were designed under (its palette's roles, symmetry, side, distortion): the kinds are judged where the hero is
  // dressed (layered.js validateHeroSpec), the shape here
  if (build.pieces !== undefined && !(Array.isArray(build.pieces) && build.pieces.every((P) => P && typeof P === 'object' && !Array.isArray(P) && typeof P.kind === 'string'))) errs.push('outfit.pieces: a list of { kind, role?, colour?, scale?, … } (the outfit catalogue\'s pieces)');
  if (build.intent !== undefined && !(build.intent && typeof build.intent === 'object' && !Array.isArray(build.intent))) errs.push('outfit.intent: { palette: { base, secondary, trim, accent, leather? }, symmetry?, side?, distort? }');
  if (build.intent !== undefined && build.pieces === undefined) errs.push('outfit.intent: the intent of designed pieces; give outfit.pieces with it');
  for (const k of Object.keys(build)) if (!['type', 'style', 'dials', 'language', 'laws', 'detail', 'pieces', 'intent'].includes(k)) errs.push(`outfit.${k}: not a build field (type, style, dials, language, laws, detail, pieces, intent)`);
  if (build.laws !== undefined && build.laws !== OUTFIT_LAWS_VERSION) errs.push(`outfit.laws: ${build.laws} is unknown — this kernel carries outfit laws ${OUTFIT_LAWS_VERSION}`);
  return errs;
}
// a slot of another KIND (a skirt for trousers) replaces the card's, never merges with it: a trouser's fit or cut is no
// skirt's word
const slot = (a, b) => (b === false ? false : b === undefined ? a : a && b.kind !== undefined && (a.kind ?? 'trousers') !== b.kind ? { ...b } : { ...(a || {}), ...b });
export function languageOf(card, own = {}) { const L = card.language || {}, out = { ...L, ...own, top: slot(L.top, own.top), bottom: slot(L.bottom, own.bottom) };
  if (L.outer !== undefined || own.outer !== undefined) out.outer = slot(L.outer, own.outer); return out; }

const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** law 2: the ring radius (m at scale 1) at which a piece's ease is as its family gives it; thinner rings take less */
const REF_RADIUS = 0.1;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h, f) => `#${hex(h).map((x) => Math.max(0, Math.min(255, Math.round(f < 1 ? x * f : x + (255 - x) * (f - 1)))).toString(16).padStart(2, '0')).join('')}`;
/** CIE L* of a '#rrggbb' */
const lightness = (h) => { const [r, g, b] = hex(h).map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

/** Expand a (valid) build → { garments, paint, rows, kit, tones, trace }. `ctx`: { have: Set of body part base names,
 * scale } (hero-dress.lowerOutfit's), `palette`: the colours the derived tones read (the figure's, the card's, the
 * operator's over them). */
export function expandOutfit(build, { have, scale: k = 1, drawn = null }, palette = {}) {
  const errs = validateOutfitBuild(build); if (errs.length) throw new Error(`Invalid outfit build:\n- ${errs.join('\n- ')}`);
  const card = cardOf(build.style ?? 'casual');
  const dials = { stylize: 0, fit: 0.5, coverage: 1, ornament: 1, ...card.dials, ...build.dials };
  const lang = languageOf(card, build.language), law = outfitProportion(dials), structured = have.has('pelvis');
  // law 10: on a figure DRAWN anime, a top or trousers with no `fit` word of their own lie close: knit a second skin,
  // woven fitted (the outer layer, a skirt and trousers cut `straight` or `wide` keep their own: they are cut to stand
  // off and hang)
  const drawnFit = (S) => (S && typeof S === 'object' && S.kind !== 'skirt' && S.fit === undefined && !['straight', 'wide'].includes(S.cut) && drawn === 'anime' ? { ...S, fit: (S.family ?? 'knit') === 'knit' ? 'skin' : 'fitted' } : S);
  if (lang.top) lang.top = drawnFit(lang.top); if (lang.bottom) lang.bottom = drawnFit({ family: 'woven', ...lang.bottom });
  const top = lang.top || null, bottom = lang.bottom || null, feet = lang.feet ?? 'none', tuck = !!lang.tuck;
  const focal = lang.focal ?? (top?.family === 'woven' ? 'placket' : 'belt'), orn = dials.ornament, warnings = [];
  // law 6 + 8: the finished edges' depth (torso and pelvis stations; a cuff a share of its piece), broader with stylize
  const EDGE = { hem: r6(0.16 * law.trim), waistband: r6(0.35 * law.trim), cuff: r6(0.07 * law.trim) };
  const easeOf = (fam) => FAMILIES[fam ?? 'woven'].ease * law.ease * k, hangOf = (fam) => FAMILIES[fam ?? 'woven'].ease * law.hang * k;

  // ── 1 CUT + 2 FIT: the pieces, their windows on landmarks, their ease and hang
  const tops = [], bottoms = [], shoes = [], lengths = {};
  if (top) {
    const fam = top.family ?? 'knit', e = easeOf(fam), h = hangOf(fam);
    const sleeve = lengths.sleeve = stepLength('sleeve', top.sleeve ?? 'short', dials.coverage), hem = lengths.hem = stepLength('hem', top.hem ?? 'hip', dials.coverage);
    // the finished edges carry rings of their own (law 6): the neckline's rib and, where the torso is the hem, the hem
    const tail = structured && (hem === 'hip' || hem === 'tunic'), t0 = hem === 'crop' ? 1.4 : 0;
    tops.push({ id: 'top', part: 'torso', ...(hem === 'crop' ? { u: [1.4, 4], flare: [h * 0.5, 0] } : {}), ease: e, over: ['pectoral', 'bust', 'navel'], drape: r6(1.2 / law.hang), ...(tail ? {} : { rings: { u: [t0 + EDGE.hem] } }), group: 'Top' });
    if (tail) tops.push({ id: 'topTail', part: 'pelvis', u: [hem === 'tunic' ? 1.5 : 4, 6], ease: e, flare: [tuck ? 0 : h * 0.5, 0], rings: { u: [(hem === 'tunic' ? 1.5 : 4) + EDGE.hem] }, group: 'Top' });
    const arm = { cap: [0, 0.25], short: [0, 0.5], elbow: [0, 1], threeQuarter: [0, 1], long: [0, 1] }[sleeve];
    const fore = sleeve === 'threeQuarter' || sleeve === 'long' ? [0, sleeve === 'long' ? 0.92 : 0.5] : null;
    if (arm) tops.push({ id: 'topSleeve', part: 'upperArm', run: arm, ease: e, ...(arm[1] < 1 ? { flare: [0, h] } : {}), ...(fore ? {} : { rings: { run: [arm[1] - EDGE.cuff] } }), group: 'Top' });
    if (fore) tops.push({ id: 'topCuff', part: 'foreArm', run: fore, ease: e, ...(sleeve === 'long' ? {} : { flare: [0, h] }), rings: { run: [fore[1] - EDGE.cuff] }, group: 'Top' });
    if (top.collar) tops.push({ id: 'topCollar', part: 'neck', run: [0, 0.35], ease: e * 1.6, flare: [0, e * 0.8], rings: { run: [0.25] }, group: 'Collar' });
  }
  const skirt = bottom?.kind === 'skirt', dress = !!lang.dress && skirt;
  if (skirt) {
    // a skirt: one hull round the hips and both legs, from the waist to its hem on a landmark (law 3), widening by its cut
    const fam = bottom.family ?? 'woven', leg = lengths.skirt = stepLength('skirt', bottom.leg ?? 'knee', dials.coverage);
    const to = { micro: { part: 'thigh', run: 0.2 }, mini: { part: 'thigh', run: 0.45 }, knee: { part: 'thigh', run: 1 }, midi: { part: 'shank', run: 0.5 }, maxi: { part: 'shank', run: 0.9 } }[leg];
    bottoms.push({ id: 'skirt', fit: 'skirt', part: ['pelvis', 'thigh', ...(to.part === 'shank' ? ['shank'] : [])], from: structured ? { part: 'pelvis', u: 6 } : { part: 'thigh', u: 0 }, to,
      ease: easeOf(fam) * (tuck ? 1.25 : 1), flare: [0, r6(SKIRT_CUTS[bottom.cut ?? 'aline'] * (1 + 0.5 * dials.stylize))], group: dress ? 'Top' : 'Bottom', ...(bottom.rigidity !== undefined ? { rigidity: bottom.rigidity } : {}) });
  } else if (bottom) {
    // law 2: the leg TAPERS with the body unless its CUT says otherwise (TROUSER_CUTS: the ease's share and the hang's
    // share at its hem: skinny close and straight down, tapered the default, straight and wide falling away)
    const fam = bottom.family ?? 'woven', cut = TROUSER_CUTS[bottom.cut ?? 'tapered'], e = easeOf(fam) * cut.ease, h = hangOf(fam) * cut.hang, leg = lengths.leg = stepLength('leg', bottom.leg ?? 'long', dials.coverage);
    if (structured) bottoms.push({ id: 'bottomSeat', part: 'pelvis', ease: easeOf(fam) * Math.min(1, cut.ease) * (tuck ? 1.25 : 1), rings: { u: [6 - EDGE.waistband] }, group: 'Bottom' });
    const thigh = { brief: structured ? null : [0, 0.25], short: [0, 0.45], knee: [0, 1], capri: [0, 1], long: [0, 1] }[leg];
    const shin = leg === 'capri' || leg === 'long' ? [0, leg === 'long' ? 0.94 : 0.55] : null;
    // a wide leg falls from the hip: its thigh carries half the hang to the knee, so the shin's flare continues it
    if (thigh) bottoms.push({ id: 'bottomLeg', part: 'thigh', run: thigh, ease: e, ...(h > 0 && leg !== 'brief' ? { flare: [0, thigh[1] < 1 ? h : h * cut.thigh] } : {}), ...(shin ? {} : { rings: { run: [thigh[1] - EDGE.cuff] } }), group: 'Bottom' });
    if (shin) bottoms.push({ id: 'bottomShin', part: 'shank', run: shin, ease: e, ...(h > 0 ? { flare: [h * cut.thigh, h] } : {}), rings: { run: [shin[1] - EDGE.cuff] }, group: 'Bottom' });
  }
  // a WAISTCOAT over the shirt (and its tie) and the trousers' waist, under the jacket: close woven cloth from the chest
  // to below the waist, a little over the top's ease; worn without a belt (braces under it)
  const vest = lang.waistcoat && top ? (lang.waistcoat === true ? {} : lang.waistcoat) : null, vests = [], vestEase = vest ? easeOf('woven') * 0.5 : 0;
  if (vest) {
    const e = easeOf(top.family ?? 'knit') + vestEase;
    vests.push({ id: 'vest', part: 'torso', ease: e, over: ['pectoral', 'bust', 'navel'], group: 'Waistcoat' });
    if (structured) vests.push({ id: 'vestTail', part: 'pelvis', u: [4.6, 6], ease: e * 1.1, rings: { u: [4.6 + EDGE.hem] }, group: 'Waistcoat' });
  }
  // an OUTER layer over both (law 4): more ease than what it covers; to the hip or the tunic's length it is a body and a
  // tail, longer a coat whose skirt is one hull round the legs; open, the opening and its edges are painted (below)
  const outer = lang.outer || null, outs = [];
  if (outer) {
    const fam = outer.family ?? 'woven', e = easeOf(fam) * 1.5 + (top && top.fit !== 'skin' ? easeOf(top.family ?? 'knit') : 0) + vestEase, h = hangOf(fam);   // over a second skin, nothing to clear
    const sleeve = lengths.outerSleeve = stepLength('sleeve', outer.sleeve ?? 'none', dials.coverage), hem = lengths.outerHem = stepLength('coat', outer.hem ?? 'hip', dials.coverage);
    outs.push({ id: 'outer', part: 'torso', ...(hem === 'waist' ? { u: [1.4, 4] } : {}), ease: e, over: ['pectoral', 'bust', 'navel'], drape: r6(1 / law.hang), ...(hem === 'waist' ? { rings: { u: [1.4 + EDGE.hem] } } : {}), group: 'Outer' });
    if (structured && (hem === 'hip' || hem === 'tunic')) outs.push({ id: 'outerTail', part: 'pelvis', u: [hem === 'tunic' ? 1.5 : 4, 6], ease: e * 1.25, flare: [h, 0], rings: { u: [(hem === 'tunic' ? 1.5 : 4) + EDGE.hem] }, group: 'Outer' });
    const to = { knee: { part: 'thigh', run: 1 }, midi: { part: 'shank', run: 0.5 }, maxi: { part: 'shank', run: 0.9 } }[hem];
    // over a skirt, the coat's skirt clears it: its flare at least the skirt's and its ease beyond the skirt's (two hulls
    // that coincide shimmer through each other)
    const under = bottoms.find((E) => E.fit === 'skirt'), coatFlare = SKIRT_CUTS[outer.cut ?? 'aline'] * (1 + 0.5 * dials.stylize);
    if (to) outs.push({ id: 'outerSkirt', fit: 'skirt', part: ['pelvis', 'thigh', ...(to.part === 'shank' ? ['shank'] : [])], from: structured ? { part: 'pelvis', u: 6 } : { part: 'thigh', u: 0 }, to,
      ease: r6(e * 1.3 + (under ? under.ease * 2 + 0.012 * k : 0)), flare: [0, r6(under ? Math.max(coatFlare, under.flare[1]) * 1.15 : coatFlare)], group: 'Outer' });
    const arm = { cap: [0, 0.25], short: [0, 0.5], elbow: [0, 1], threeQuarter: [0, 1], long: [0, 1] }[sleeve];
    const fore = sleeve === 'threeQuarter' || sleeve === 'long' ? [0, sleeve === 'long' ? 0.9 : 0.5] : null;
    if (arm) outs.push({ id: 'outerSleeve', part: 'upperArm', run: arm, ease: e, ...(arm[1] < 1 ? { flare: [0, h] } : {}), ...(fore ? {} : { rings: { run: [arm[1] - EDGE.cuff] } }), group: 'Outer' });
    if (fore) outs.push({ id: 'outerCuff', part: 'foreArm', run: fore, ease: e, ...(sleeve === 'long' ? {} : { flare: [0, h * 0.6] }), rings: { run: [fore[1] - EDGE.cuff] }, group: 'Outer' });
    if (outer.collar) outs.push({ id: 'outerCollar', part: 'neck', run: [0, 0.4], ease: e * 1.5, flare: [0, e], rings: { run: [0.3] }, group: 'Outer' });
  }
  // DRAPE PANELS (law 2's other half: the flow is in pieces cut to hang, not in loose tubes): open cloth hung from the
  // waist over everything else, its arc round the hull named by `at` and `width`, its length a skirt's word, flowing
  // on a strand (`rigidity`, soft by default); `split: 2` is two tails side by side with a gap between (a tailcoat's)
  const AT = { front: [0], back: [180], sideR: [90], sideL: [270], sides: [90, 270] }, panels = [];
  (lang.panels || []).forEach((Q, i) => {
    const fam = Q.family ?? 'woven', len = stepLength('skirt', Q.length ?? 'knee', dials.coverage), arc = 180 * (Q.width ?? 0.33), split = Q.split ?? 1, gap = split > 1 ? Math.min(8, arc * 0.15) : 0;
    const to = { micro: { part: 'thigh', run: 0.2 }, mini: { part: 'thigh', run: 0.45 }, knee: { part: 'thigh', run: 1 }, midi: { part: 'shank', run: 0.5 }, maxi: { part: 'shank', run: 0.9 } }[len];
    const w = (arc - gap) / split, names = ['', 'R', 'L'];
    AT[Q.at].forEach((c, ci) => { for (let k = 0; k < split; k++) { const a0 = c - arc / 2 + k * (w + gap);
      const id = `panel${i}${AT[Q.at].length > 1 ? names[ci + 1] : ''}${split > 1 ? String.fromCharCode(97 + k) : ''}`;
      panels.push({ id, fit: 'panel', part: ['pelvis', 'thigh', ...(to.part === 'shank' ? ['shank'] : [])], from: structured ? { part: 'pelvis', u: 6 } : { part: 'thigh', u: 0 }, to,
        around: [r6(a0), r6(a0 + w)], ease: r6(easeOf(fam) * 1.5), flare: [0, r6(SKIRT_CUTS[Q.cut ?? 'aline'] * (1 + 0.5 * dials.stylize))], group: 'Panel', rigidity: Q.rigidity ?? 'soft' }); } });
  });
  // ── 2b FIT BY ZONE (law 2): a slot's own `fit` word over the dials. SKIN is a second skin, painted on the body's own
  // faces (body-paint.js: leggings, tights, a close undershirt), no thickness and no flare; FITTED follows the body in at
  // the waist (no drape) with a little ease and no hang at its hems; EASED keeps the dials' ease but still comes in to
  // the waist (a drape four times as steep: it never bridges chest to hip); LOOSE stands off more and falls straight
  // from the chest. A skirt and a coat's skirt keep their cut's flare: they hang by their nature
  const skinPaint = [], fitSlot = (list, f) => { if (!f) return list;
    if (f === 'eased') return list.map((E) => (E.drape ? { ...E, drape: r6(E.drape * 2) } : E));
    if (f === 'skin') { for (const E of list) if (!E.fit && E.part !== 'neck') skinPaint.push({ part: [E.part, ...(E.over || [])].flat(), ...(E.u ? { u: E.u } : {}), ...(E.run ? { run: E.run } : {}), group: E.group }); return list.filter((E) => E.fit || E.part === 'neck'); }
    return list.map((E) => { if (E.fit === 'skirt') return E; const { drape, flare, ...rest } = E;
      return f === 'fitted' ? { ...rest, ease: r6(E.ease * 0.45) } : { ...rest, ease: r6(E.ease * 1.5), ...(drape ? { drape: r6(drape * 0.3) } : {}), ...(flare ? { flare: flare.map((x) => r6(x * 1.5)) } : {}) }; }); };
  const tops2 = fitSlot(tops, top?.fit), bottoms2 = skirt ? bottoms : fitSlot(bottoms, bottom?.fit), outs2 = fitSlot(outs, outer?.fit === 'skin' ? 'fitted' : outer?.fit);
  tops.splice(0, tops.length, ...tops2); bottoms.splice(0, bottoms.length, ...bottoms2); outs.splice(0, outs.length, ...outs2);
  // GIRTH TARGETS: a slot's `girth` (cm of girth over the body at its landmarks, at scale 1) on each copy piece of it; the
  // kernel finds each landmark on the body's own rings and ignores those a piece's part has not (body-garment.js)
  const withGirth = (list, S) => (S?.girth ? list.map((E) => (E.fit ? E : { ...E, girth: Object.fromEntries(Object.entries(S.girth).map(([w, c]) => [w, r6(c / 100 * k)])) })) : list);
  tops.splice(0, tops.length, ...withGirth(tops, top)); if (!skirt) bottoms.splice(0, bottoms.length, ...withGirth(bottoms, bottom)); outs.splice(0, outs.length, ...withGirth(outs, outer));
  const toes = ['toes', 'hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
  if (feet === 'boots') shoes.push({ id: 'bootShaft', part: 'shank', run: [0.45, 1], ease: 0.008 * k, flare: [0.004 * k, 0], group: 'Shoes' }, { id: 'boot', part: 'foot', fit: 'shoe', ease: 0.006 * k, over: toes, group: 'Shoes' });
  else if (feet === 'shoes') shoes.push({ id: 'shoe', part: 'foot', fit: 'shoe', ease: 0.005 * k, toe: 0.9, over: toes, group: 'Shoes' });
  // ── 3 LAYER: tucked, the top first and the bottom over its tail; worn out, the bottom first; shoes over both
  const keep = (E) => { const ps = (Array.isArray(E.part) ? E.part : [E.part]).filter((n) => have.has(n)); return ps.length ? [{ ...E, part: ps, ...(E.over ? { over: E.over.filter((n) => have.has(n)) } : {}) }] : []; };
  // every copy piece keeps the body's ratios (proportional ease) on a dense, rounded ring (body-garment.js)
  const garments = [...(tuck ? [...tops, ...bottoms] : [...bottoms, ...tops]), ...vests, ...outs, ...panels, ...shoes].flatMap(keep).map((E) => ({ ...E, ease: r6(E.ease), ...(E.flare ? { flare: E.flare.map(r6) } : {}), ...(E.fit ? {} : { proportional: r6(REF_RADIUS * k), dense: true }) }));
  const worn = new Set(garments.map((E) => E.id)), on = (id, part) => `${id}_${part}`;

  // ── 4 CONSTRUCTION + 5 ORNAMENT: the edges, spent from the focal out
  const paint = [...skinPaint.flatMap((P) => { const ps = (Array.isArray(P.part) ? P.part : [P.part]).filter((n) => have.has(n)); return ps.length ? [{ ...P, part: ps }] : []; })], rows = [], kit = [], spent = [];
  const wovenTop = top && (top.family ?? 'knit') === 'woven', knitTop = top && !wovenTop;
  const hemPiece = worn.has('topTail') ? { part: on('topTail', 'pelvis'), u: lengths.hem === 'tunic' ? [1.5, 1.5 + EDGE.hem] : [4, 4 + EDGE.hem] } : worn.has('top') ? { part: on('top', 'torso'), u: lengths.hem === 'crop' ? [1.4, 1.4 + EDGE.hem] : [0, EDGE.hem] } : null;
  const sleeveEnd = worn.has('topCuff') ? on('topCuff', 'foreArm') : worn.has('topSleeve') ? on('topSleeve', 'upperArm') : null;
  const legEnd = worn.has('bottomShin') ? on('bottomShin', 'shank') : worn.has('bottomLeg') ? on('bottomLeg', 'thigh') : null;
  if (wovenTop && !dress && worn.has('top')) { paint.push({ part: on('top', 'torso'), t: [0, 0.09], group: 'Placket' }); if (worn.has('topTail')) paint.push({ part: on('topTail', 'pelvis'), t: [0, 0.09], group: 'Placket' }); spent.push('placket'); }
  const edges = {
    // a collar: the woven collar's band; a knit neckline its RIB, a band of its own round the neck's root (law 7), over the top
    collar: () => { if (worn.has('topCollar')) { paint.push({ part: on('topCollar', 'neck'), run: [0.75, 1], group: 'Trim' }); return true; }
      if (!worn.has('top') || !have.has('neck')) return false; const fam = top.family ?? 'knit';
      garments.push({ id: 'topRib', part: ['neck'], run: [0.1, r6(0.1 + 0.16 * law.trim)],   // from where the neck leaves the top's yoke
        ease: r6(easeOf(fam) * 1.3), proportional: r6(REF_RADIUS * k), dense: true, group: 'Trim' }); worn.add('topRib'); return true; },
    buttons: () => { if (!wovenTop || !worn.has('top')) return false; if (!structured) { warnings.push('buttons: the streamlined torso has no front slot to set them on; the placket alone'); return false; }
      // (down the top's own window: a cropped top's starts at 1.4 of the torso, and a button below it had no cloth to sit on)
      rows.push({ part: on('top', 'torso'), t: 'front', s: [lengths.hem === 'crop' ? 1.85 : 0.45, 3.6], step: r6(0.55 * law.buttonStep), shape: 'stud', r: r6(0.0045 * law.button * k), h: r6(0.0028 * law.button * k), m: 8, group: 'Button' }); return true; },
    belt: () => { if (!bottom || vest || ((bottom.family ?? 'woven') !== 'woven' && focal !== 'belt')) return false;   // law 7: a knit waist is elastic, no loops; a waistcoat over braces
      if (worn.has('skirt')) { kit.push({ id: 'belt', mode: 'band', part: 'skirt_skirt', s: [0.15, dress ? 0.75 : 0.9], t: 'wrap', nt: 16, ns: 2, mugen: r6(0.002 * k), thick: r6(0.006 * k * law.trim), rad: r6(0.05 * k), group: 'Leather',
        signature: { kind: 'buckle', k: 0, j: 1, w: r6(0.026 * k * law.trim), h: r6(0.02 * k * law.trim), bar: r6(0.005 * k), standoff: r6(0.004 * k), group: 'Buckle' } }); return true; }
      const seat = worn.has('bottomSeat') ? on('bottomSeat', 'pelvis') : structured && bottom?.fit === 'skin' ? 'pelvis' : null;   // over second-skin legs, on the body
      if (!seat) { if (bottom) warnings.push('belt: the streamlined core has no pelvis to belt'); return false; }
      const over = [...(!tuck && worn.has('topTail') ? [on('topTail', 'pelvis')] : []), ...panels.filter((Q) => worn.has(Q.id)).map((Q) => `${Q.id}_panel`)];
      kit.push({ id: 'belt', mode: 'band', part: seat, over, s: [5.2, 5.85], t: 'wrap', nt: 12, ns: 2, mugen: r6(0.003 * k), thick: r6(0.008 * k * law.trim), rad: r6(0.05 * k), group: 'Leather',
        signature: { kind: 'buckle', k: 0, j: 1, w: r6(0.03 * k * law.trim), h: r6(0.024 * k * law.trim), bar: r6(0.006 * k), standoff: r6(0.005 * k), group: 'Buckle' } }); return true; },
    cuffs: () => { if (!sleeveEnd) return false; paint.push({ part: sleeveEnd, run: [0.998, 1], group: 'Trim' }); return true; },   // the last band: from the cuff's own ring to the end
    hem: () => { if (!hemPiece || dress) return false; paint.push({ ...hemPiece, group: 'Trim' }); return true; },
    waistband: () => { if (worn.has('skirt') && !dress) { paint.push({ part: 'skirt_skirt', u: [0, 0.6], group: 'Waistband' }); return true; } if (!worn.has('bottomSeat')) return false; paint.push({ part: on('bottomSeat', 'pelvis'), u: [6 - EDGE.waistband, 6], group: 'Waistband' }); return true; },
    legHem: () => { if (!legEnd || (bottom.family ?? 'woven') !== 'knit') return false; paint.push({ part: legEnd, run: [0.998, 1], group: 'Trim' }); return true; },
    skirtHem: () => { if (!worn.has('skirt')) return false; paint.push({ part: 'skirt_skirt', u: [10.6, 11], group: 'Trim' }); return true; },
    // the outer layer's own edges: open, the opening down the front shows what is beneath; its hem and cuffs
    outerOpen: () => { if (!outer?.open || !worn.has('outer')) return false; const under = top ? 'Top' : 'Skin', legs = bottom && !skirt ? 'Bottom' : skirt ? 'Bottom' : under;
      paint.push({ part: on('outer', 'torso'), t: [0, 0.08], group: under });
      if (worn.has('outerTail')) paint.push({ part: on('outerTail', 'pelvis'), t: [0, 0.08], group: legs });
      // (a coat's skirt is a hull whose bands turn ring to ring: painted, its opening stairsteps, so the skirt hangs closed)
      return true; },
    outerHem: () => { if (worn.has('outerSkirt')) { paint.push({ part: 'outerSkirt_skirt', u: [10.6, 11], group: 'Trim' }); return true; }
      if (worn.has('outerTail')) { const u0 = lengths.outerHem === 'tunic' ? 1.5 : 4; paint.push({ part: on('outerTail', 'pelvis'), u: [u0, u0 + EDGE.hem], group: 'Trim' }); return true; }
      if (worn.has('outer')) { paint.push({ part: on('outer', 'torso'), u: lengths.outerHem === 'waist' ? [1.4, 1.4 + EDGE.hem] : [0, EDGE.hem], group: 'Trim' }); return true; } return false; },
    outerCuffs: () => { const end = worn.has('outerCuff') ? on('outerCuff', 'foreArm') : worn.has('outerSleeve') ? on('outerSleeve', 'upperArm') : null; if (!end) return false; paint.push({ part: end, run: [0.998, 1], group: 'Trim' }); return true; },
    panelHem: () => { const ps = panels.filter((Q) => worn.has(Q.id)); for (const Q of ps) paint.push({ part: `${Q.id}_panel`, u: [10.6, 11], group: 'Trim' }); return ps.length > 0; },
    seams: () => { if (!worn.has('top')) return false; paint.push({ part: on('top', 'torso'), t: [0.4, 0.6], u: [0.3, 3.4], group: 'Seam' }); return true; },
  };
  // ── 5b THE ROLES and the DETAIL seated on them: each role on the outermost layer that covers its place
  const torsoTop = worn.has('outer') ? on('outer', 'torso') : worn.has('top') ? on('top', 'torso') : null;
  const sleeveTop = worn.has('outerSleeve') ? on('outerSleeve', 'upperArm') : worn.has('topSleeve') ? on('topSleeve', 'upperArm') : null;
  const outerEnd = worn.has('outerCuff') ? on('outerCuff', 'foreArm') : worn.has('outerSleeve') ? on('outerSleeve', 'upperArm') : null;
  const outerHemSeat = worn.has('outerSkirt') ? { part: 'outerSkirt_skirt', u: [10.6, 11] } : worn.has('outerTail') ? { part: on('outerTail', 'pelvis'), u: lengths.outerHem === 'tunic' ? [1.5, 1.5 + EDGE.hem] : [4, 4 + EDGE.hem] }
    : worn.has('outer') ? { part: on('outer', 'torso'), u: lengths.outerHem === 'waist' ? [1.4, 1.4 + EDGE.hem] : [0, EDGE.hem] } : null;
  const roles = Object.fromEntries(Object.entries({
    collar: worn.has('outerCollar') ? { part: on('outerCollar', 'neck'), run: [0.75, 1] } : worn.has('topCollar') ? { part: on('topCollar', 'neck'), run: [0.75, 1] } : null,
    opening: outer?.open && worn.has('outer') ? { part: on('outer', 'torso'), t: [0, 0.08] } : null,
    placket: wovenTop && !dress && worn.has('top') && !(worn.has('outer') && !outer?.open) ? { part: on('top', 'torso'), t: [0, 0.09] } : null,
    hem: outerHemSeat ?? (hemPiece && !dress ? hemPiece : null),
    cuffs: outerEnd ? { part: outerEnd, run: [0.998, 1] } : sleeveEnd ? { part: sleeveEnd, run: [0.998, 1] } : null,
    waist: worn.has('skirt') && !dress ? { part: 'skirt_skirt', u: [0, 0.6] } : worn.has('bottomSeat') ? { part: on('bottomSeat', 'pelvis'), u: [6 - EDGE.waistband, 6] } : null,
    legHem: legEnd ? { part: legEnd, run: [0.998, 1] } : null,
    skirtHem: worn.has('skirt') ? { part: 'skirt_skirt', u: [10.6, 11] } : null,
    yoke: torsoTop ? { part: torsoTop, u: [3.2, 4] } : null,
    chest: torsoTop ? { part: torsoTop, u: [2.2, 3.3], t: [0, 0.45] } : null,
    back: torsoTop ? { part: torsoTop, u: [1.2, 3.3], t: [0.6, 1] } : null,
    sleeveBand: sleeveTop ? { part: sleeveTop, run: [0.18, 0.32] } : null,
    skirtField: worn.has('outerSkirt') ? { part: 'outerSkirt_skirt', u: [4, 9] } : worn.has('skirt') ? { part: 'skirt_skirt', u: [4, 9] } : null,
  }).filter(([, v]) => v));
  // the WORKED seat of each role (embroidery's): a window as shares of the garment part (the shell's `share` measure,
  // alike on every body), the band an edge's motif runs in and the way it runs, or a field's emblem
  const SH = 6, ST = 4, idOf = (part) => part.replace(/_[^_]+$/, ''), groupOf = (part) => garments.find((E) => E.id === idOf(part))?.group ?? 'Top';
  const lowBand = (seat) => { if (seat.run) return [0.8, 0.97]; const u0 = seat.u[0], n = /_pelvis$/.test(seat.part) ? SH : /_skirt$/.test(seat.part) ? 11 : ST;
    return u0 <= 0.05 ? [0.02, Math.min(0.3, 0.6 / n)] : [r6(Math.max(0, u0 / n)), r6(Math.min(1, (u0 + 0.6) / n))]; };
  const worked = (role) => { const seat = roles[role]; if (!seat) return null;
    if (role === 'opening' || role === 'placket') return { part: seat.part, s: [0.06, 0.94], t: [0, 0.1], sides: ['R', 'L'], mode: 'border' };
    if (role === 'collar' || role === 'cuffs' || role === 'legHem') return { part: seat.part, s: role === 'collar' ? [0.4, 0.95] : [0.72, 0.97], t: 'wrap', mode: 'border' };
    if (role === 'hem' || role === 'skirtHem') return { part: seat.part, s: /_skirt$/.test(seat.part) ? [0.82, 0.97] : lowBand(seat), t: 'wrap', mode: 'border' };
    if (role === 'waist') return { part: seat.part, s: /_skirt$/.test(seat.part) ? [0.01, 0.07] : [0.82, 0.97], t: 'wrap', mode: 'border' };
    if (role === 'chest' || role === 'back') return { part: seat.part, s: [0.5, 0.85], t: 'wrap', mode: 'emblem', at: role === 'chest' ? 'front' : 'back' };
    if (role === 'yoke') return { part: seat.part, s: [0.8, 0.92], t: 'wrap', mode: 'border' };
    if (role === 'sleeveBand') return { part: seat.part, s: [0.18, 0.32], t: 'wrap', mode: 'border' };
    if (role === 'skirtField') return { part: seat.part, s: [0.5, 0.6], t: 'wrap', mode: 'border' };
    return null; };
  const detailed = Array.isArray(build.detail), seatedDetail = [];
  build.detail?.forEach((D, i) => { const seat = roles[D.role];
    if (!seat) { warnings.push(`detail: no ${D.role} on this outfit for the ${D.prim}`); return; }
    if (D.prim === 'binding') paint.push({ ...seat, group: D.group ?? DETAIL_PRIMS.binding.group });
    if (D.prim === 'embroidery') { const W = worked(D.role);
      // a limb's garment is a part a side (`…_upperArmR`, `…_upperArmL`): the work goes on both
      const parts = /_(upperArm|foreArm|thigh|shank|shin|meta)$/.test(W.part) ? [`${W.part}R`, `${W.part}L`] : [W.part];
      // the ground a near-flush shell of the garment's own cloth; the motif on it in thread
      for (const part of parts) for (const side of W.sides ?? ['R']) kit.push({ id: `emb${i}${D.role}${W.sides ? side : ''}${parts.length > 1 ? part.slice(-1) : ''}`, mode: 'shell', part, share: true, side, s: W.s, t: W.t, nt: W.t === 'wrap' ? 16 : 3, ns: W.mode === 'emblem' ? 6 : W.sides ? 10 : 2,
        mugen: 0, thick: r6(0.001 * k), rad: r6(0.01 * k), group: groupOf(W.part), stack: false, ghost: true,
        // the thread drawn to read: two pixels wide at a third-person 1080p figure (≈ 5 mm a pixel), lying just proud of the cloth
        signature: { kind: 'motif', name: D.motif ?? 'vine', mode: W.mode, ...(W.at ? { at: W.at } : {}), size: r6(0.1 * k), w: r6(0.006 * k), lift: r6(0.003 * k), group: D.group ?? DETAIL_PRIMS.embroidery.group } }); }
    seatedDetail.push(`${D.prim}${D.motif ? `(${D.motif})` : ''}@${D.role}`); });
  // with a detail list, the bindings are its own: the budget's trim edges stand down (the collar keeps its rib)
  const BINDINGS = new Set(['cuffs', 'hem', 'legHem', 'skirtHem', 'outerHem', 'outerCuffs', 'panelHem']);
  if (detailed) { const rib = edges.collar; edges.collar = () => (worn.has('topCollar') || worn.has('outerCollar') ? false : rib()); for (const b of BINDINGS) edges[b] = () => false; }
  const focalEdge = focal === 'collar' ? 'collar' : focal === 'placket' ? 'buttons' : 'belt';
  // the budget's tiers: the focal (1), every other edge (2), the seams (3); an edge with nothing to sit on is skipped.
  // An open outer layer's opening is its construction, spent with the focal (an open coat is open at any budget)
  const budget = [[focalEdge, ...(outer?.open ? ['outerOpen'] : [])], ['collar', 'buttons', 'belt', 'cuffs', 'hem', 'waistband', 'legHem', 'skirtHem', ...(outer ? ['outerHem', 'outerCuffs'] : []), ...(panels.length ? ['panelHem'] : [])].filter((e) => e !== focalEdge), ['seams']];
  for (let tier = 0; tier < Math.min(orn, 3); tier++) for (const e of budget[tier]) if (edges[e]()) spent.push(e);
  if (orn >= 1 && !spent.includes(focalEdge)) warnings.push(`focal: '${focal}' could not be set on this body or outfit (law 5)`);

  // ── 6 TONE: the card's over the derived, and the layers' value step
  const T = { ...(card.tones || {}), ...palette };   // `palette`: the figure's, the card's and the operator's, in that order
  const tones = { Trim: shade(T.Top ?? '#888888', knitTop ? 0.8 : 0.86), Placket: shade(T.Top ?? '#888888', 0.93), Button: '#efe9dc', Seam: shade(T.Top ?? '#888888', 0.78), Collar: shade(T.Top ?? '#888888', 1.06),
    Waistband: shade(T.Bottom ?? '#555555', 0.84), Leather: '#5a3a22', Buckle: '#b8b2a6', ...(card.tones || {}) };
  if (top && bottom && T.Top && T.Bottom && Math.abs(lightness(T.Top) - lightness(T.Bottom)) < 12) warnings.push(`value step: Top and Bottom differ by under 12 L* (law 4) — the layers may read as one`);
  if (outer && top && T.Outer && T.Top && Math.abs(lightness(T.Outer) - lightness(T.Top)) < 12) warnings.push(`value step: Outer and Top differ by under 12 L* (law 4) — the layers may read as one`);
  if (outer) tones.Outer = T.Outer ?? shade(T.Top ?? '#888888', 0.62);
  if (panels.length) tones.Panel = T.Panel ?? tones.Outer ?? shade(T.Bottom ?? T.Top ?? '#888888', 0.7);
  // (a waistcoat the suit's cloth, a three-piece, unless the card names its own)
  if (vests.length) tones.Waistcoat = T.Waistcoat ?? tones.Outer ?? shade(T.Bottom ?? T.Top ?? '#888888', 0.9);

  // ── 7 LEDGER
  const trace = { style: typeof build.style === 'string' || build.style === undefined ? build.style ?? 'casual' : card.id || 'inline', dials, lengths, tuck, feet, focal, ...(dress ? { dress } : {}), ...(outer ? { outer: { open: !!outer.open } } : {}),
    ...(drawn ? { drawn, fits: Object.fromEntries(['top', 'bottom', 'outer'].filter((s) => lang[s] && lang[s].kind !== 'skirt').map((s) => [s, lang[s].fit ?? 'eased'])) } : {}), pieces: garments.map((E) => E.id), ...(panels.length ? { panels: panels.map((Q) => Q.id) } : {}), edges: spent, laws: build.laws ?? OUTFIT_LAWS_VERSION, ...(detailed ? { roles: Object.keys(roles), detail: seatedDetail } : {}), ...(warnings.length ? { warnings } : {}) };
  // the jacket's FRONT words, for the tailor on the realistic body (body-relational-wear.js): absent, nothing
  const tailored = outer && worn.has('outer') && (outer.front !== undefined || outer.lapel !== undefined || outer.buttons !== undefined);
  // (its lapels the jacket's facing: the card's `Lapel` tone, else a shade off the jacket's own)
  // (and a tie on the shirt, the card's `Tie` tone, else a deep red)
  const tie = lang.tie === true && worn.has('top');
  // (its shape words, the shoulder and the waist, beside them or alone)
  const shaped = outer && worn.has('outer') && (outer.shoulder !== undefined || outer.waist !== undefined), shape = shaped ? { ...(outer.shoulder ? { shoulder: outer.shoulder } : {}), ...(outer.waist ? { waist: outer.waist } : {}) } : {};
  // (and a waistcoat's front, its V and its buttons, made before the jacket's over it)
  const vestFront = worn.has('vest') ? { front: vest.front ?? 'single', buttons: vest.buttons ?? (vest.front === 'double' ? 3 : 5) } : null;
  const tailoring = tailored || shaped || tie || vestFront ? { ...(vestFront ? { vest: vestFront } : {}), ...(tailored || shaped ? { outer: { ...(tailored ? { front: outer.front ?? 'single', lapel: outer.lapel ?? (outer.front === 'double' ? 'peak' : 'notch'), buttons: outer.buttons ?? (outer.front === 'double' ? 3 : 2), open: !!outer.open } : {}), ...shape } } : {}), ...(tie ? { tie: { group: 'Tie' } } : {}) } : null;
  if (tailored) tones.Lapel = card.tones?.Lapel ?? shade(T.Outer ?? tones.Outer ?? '#444444', 1.12);
  if (tie) tones.Tie = card.tones?.Tie ?? '#5b1f2b';
  return { garments, paint, rows, kit, tones, trace, ...(tailoring ? { tailoring } : {}) };
}

/** The palette a build suggests beneath the operator's own */
export const outfitTones = (build) => { const c = isOutfitBuild(build) ? cardOf(build.style ?? 'casual') : null; return c && typeof c === 'object' ? { ...(c.tones || {}) } : {}; };

/** The readout for the hero's dress: the trace of the build as this body wears it (style, dials, lengths, focal,
 * pieces, the edges spent, any warnings). `plan`: the hero's plan (its parts and scale are read as the dress read them). */
export function outfitReadout(build, plan, { drawn = null } = {}) {
  const have = new Set((plan?.segments || []).map((s) => s.name.replace(/[RL]$/, '')));
  return expandOutfit(build, { have, scale: 1, drawn }, plan?.palette || {}).trace;   // the trace reads no metres
}
