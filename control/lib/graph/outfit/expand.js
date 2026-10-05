// outfit/expand — an OUTFIT BUILD on the hero's `outfit`, expanded on every read into garments, paint, body detail and
// adornment, by the passes in a fixed order (principles.js carries the laws they obey):
//
//   outfit: { type: 'outfit', style, dials?, language?, laws? }
//     style     a seeded sample name (styles.js) or an inline card
//     dials     { stylize 0–1, fit 0–1, coverage 0–1, ornament 0–3 } over the card's own
//     language  over the card's: { top: {…}, bottom: {…}, feet, tuck, focal } (a slot object merges over the card's)
//     laws      the version of principles.js the build was minted under (stamped by the hero record; absent → current)
//
//   1 CUT           the language and `coverage` → the pieces and their windows, lengths on landmarks (law 3)
//   2 FIT           each piece's ease from its family × fit × stylize, the hang flaring toward its free hem (laws 1, 2, 8)
//   3 LAYER         the order (tucked or worn out) and the outer layer's extra ease (law 4)
//   4 CONSTRUCTION  the family's honest parts: a woven top's placket (law 7)
//   5 ORNAMENT      the edge budget from the focal out (laws 5, 6): collar trim, buttons or the belt; then the cuffs,
//                   hems, ribs and waistband; then the seams
//   6 TONE          the card's tones over tones derived from Top and Bottom; the layers' value step checked (law 4)
//   7 LEDGER        the trace: style, dials, lengths, focal, pieces, the edges spent and the warnings
//
// The hero record stores the words; hero-dress.dressPlan calls `expandOutfit` with the body's parts and scale, and the
// garments (body-garment.js), the trims (body-paint.js, on the garment parts), the buttons (body detail rows) and the
// belt (an adornment) are built like any other. Pure and deterministic: no dice, fixed order.
import { OUTFIT_LAWS_VERSION, FAMILIES, outfitProportion, stepLength } from './principles.js';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';

export { OUTFIT_LAWS_VERSION };
export const isOutfitBuild = (o) => !!(o && typeof o === 'object' && !Array.isArray(o) && o.type === 'outfit');
const cardOf = (style) => (typeof style === 'string' ? SEEDED_OUTFITS[style] : style);
const DIALS = ['stylize', 'fit', 'coverage', 'ornament'];

/** Validate a build → error strings naming the choices */
export function validateOutfitBuild(build) {
  if (!isOutfitBuild(build)) return ["outfit: { type: 'outfit', style, dials?, language? }"];
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
  for (const k of Object.keys(build)) if (!['type', 'style', 'dials', 'language', 'laws'].includes(k)) errs.push(`outfit.${k}: not a build field (type, style, dials, language, laws)`);
  if (build.laws !== undefined && build.laws !== OUTFIT_LAWS_VERSION) errs.push(`outfit.laws: ${build.laws} is unknown — this kernel carries outfit laws ${OUTFIT_LAWS_VERSION}`);
  return errs;
}
const slot = (a, b) => (b === false ? false : b === undefined ? a : { ...(a || {}), ...b });
function languageOf(card, own = {}) { const L = card.language || {}; return { ...L, ...own, top: slot(L.top, own.top), bottom: slot(L.bottom, own.bottom) }; }

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h, f) => `#${hex(h).map((x) => Math.max(0, Math.min(255, Math.round(f < 1 ? x * f : x + (255 - x) * (f - 1)))).toString(16).padStart(2, '0')).join('')}`;
/** CIE L* of a '#rrggbb' */
const lightness = (h) => { const [r, g, b] = hex(h).map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

/** Expand a (valid) build → { garments, paint, rows, kit, tones, trace }. `ctx`: { have: Set of body part base names,
 * scale } (hero-dress.lowerOutfit's), `palette`: the colours the derived tones read (the figure's, the card's, the
 * operator's over them). */
export function expandOutfit(build, { have, scale: k = 1 }, palette = {}) {
  const errs = validateOutfitBuild(build); if (errs.length) throw new Error(`Invalid outfit build:\n- ${errs.join('\n- ')}`);
  const card = cardOf(build.style ?? 'casual');
  const dials = { stylize: 0, fit: 0.5, coverage: 1, ornament: 1, ...card.dials, ...build.dials };
  const lang = languageOf(card, build.language), law = outfitProportion(dials), structured = have.has('pelvis');
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
    tops.push({ id: 'top', part: 'torso', ...(hem === 'crop' ? { u: [1.4, 4], flare: [h * 0.5, 0] } : {}), ease: e, over: ['pectoral', 'bust', 'navel'], ...(tail ? {} : { rings: { u: [t0 + EDGE.hem] } }), group: 'Top' });
    if (tail) tops.push({ id: 'topTail', part: 'pelvis', u: [hem === 'tunic' ? 1.5 : 4, 6], ease: e * (tuck ? 1 : 1.25), flare: [tuck ? 0 : h, 0], rings: { u: [(hem === 'tunic' ? 1.5 : 4) + EDGE.hem] }, group: 'Top' });
    const arm = { cap: [0, 0.25], short: [0, 0.5], elbow: [0, 1], threeQuarter: [0, 1], long: [0, 1] }[sleeve];
    const fore = sleeve === 'threeQuarter' || sleeve === 'long' ? [0, sleeve === 'long' ? 0.92 : 0.5] : null;
    if (arm) tops.push({ id: 'topSleeve', part: 'upperArm', run: arm, ease: e, ...(arm[1] < 1 ? { flare: [0, h] } : {}), ...(fore ? {} : { rings: { run: [arm[1] - EDGE.cuff] } }), group: 'Top' });
    if (fore) tops.push({ id: 'topCuff', part: 'foreArm', run: fore, ease: e, flare: [0, sleeve === 'long' ? h * 0.4 : h], rings: { run: [fore[1] - EDGE.cuff] }, group: 'Top' });
    if (top.collar) tops.push({ id: 'topCollar', part: 'neck', run: [0, 0.35], ease: e * 1.6, flare: [0, e * 0.8], rings: { run: [0.25] }, group: 'Collar' });
  }
  if (bottom) {
    const fam = bottom.family ?? 'woven', e = easeOf(fam), h = hangOf(fam), leg = lengths.leg = stepLength('leg', bottom.leg ?? 'long', dials.coverage);
    if (structured) bottoms.push({ id: 'bottomSeat', part: 'pelvis', ease: e * (tuck ? 1.25 : 1), rings: { u: [6 - EDGE.waistband] }, group: 'Bottom' });
    const thigh = { brief: structured ? null : [0, 0.25], short: [0, 0.45], knee: [0, 1], capri: [0, 1], long: [0, 1] }[leg];
    const shin = leg === 'capri' || leg === 'long' ? [0, leg === 'long' ? 0.94 : 0.55] : null;
    if (thigh) bottoms.push({ id: 'bottomLeg', part: 'thigh', run: thigh, ease: e, ...(thigh[1] < 1 && leg !== 'brief' ? { flare: [0, h] } : {}), ...(shin ? {} : { rings: { run: [thigh[1] - EDGE.cuff] } }), group: 'Bottom' });
    if (shin) bottoms.push({ id: 'bottomShin', part: 'shank', run: shin, ease: e, flare: [0, h * (leg === 'long' ? 0.5 : 1)], rings: { run: [shin[1] - EDGE.cuff] }, group: 'Bottom' });
  }
  const toes = ['toes', 'hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
  if (feet === 'boots') shoes.push({ id: 'bootShaft', part: 'shank', run: [0.45, 1], ease: 0.008 * k, flare: [0.004 * k, 0], group: 'Shoes' }, { id: 'boot', part: 'foot', fit: 'shoe', ease: 0.006 * k, over: toes, group: 'Shoes' });
  else if (feet === 'shoes') shoes.push({ id: 'shoe', part: 'foot', fit: 'shoe', ease: 0.005 * k, toe: 0.9, over: toes, group: 'Shoes' });
  // ── 3 LAYER: tucked, the top first and the bottom over its tail; worn out, the bottom first; shoes over both
  const keep = (E) => { const ps = (Array.isArray(E.part) ? E.part : [E.part]).filter((n) => have.has(n)); return ps.length ? [{ ...E, part: ps, ...(E.over ? { over: E.over.filter((n) => have.has(n)) } : {}) }] : []; };
  const garments = [...(tuck ? [...tops, ...bottoms] : [...bottoms, ...tops]), ...shoes].flatMap(keep).map((E) => ({ ...E, ease: r6(E.ease), ...(E.flare ? { flare: E.flare.map(r6) } : {}) }));
  const worn = new Set(garments.map((E) => E.id)), on = (id, part) => `${id}_${part}`;

  // ── 4 CONSTRUCTION + 5 ORNAMENT: the edges, spent from the focal out
  const paint = [], rows = [], kit = [], spent = [];
  const wovenTop = top && (top.family ?? 'knit') === 'woven', knitTop = top && !wovenTop;
  const hemPiece = worn.has('topTail') ? { part: on('topTail', 'pelvis'), u: lengths.hem === 'tunic' ? [1.5, 1.5 + EDGE.hem] : [4, 4 + EDGE.hem] } : worn.has('top') ? { part: on('top', 'torso'), u: lengths.hem === 'crop' ? [1.4, 1.4 + EDGE.hem] : [0, EDGE.hem] } : null;
  const sleeveEnd = worn.has('topCuff') ? on('topCuff', 'foreArm') : worn.has('topSleeve') ? on('topSleeve', 'upperArm') : null;
  const legEnd = worn.has('bottomShin') ? on('bottomShin', 'shank') : worn.has('bottomLeg') ? on('bottomLeg', 'thigh') : null;
  if (wovenTop && worn.has('top')) { paint.push({ part: on('top', 'torso'), t: [0, 0.09], group: 'Placket' }); if (worn.has('topTail')) paint.push({ part: on('topTail', 'pelvis'), t: [0, 0.09], group: 'Placket' }); spent.push('placket'); }
  const edges = {
    // a collar: the woven collar's band; a knit neckline its RIB, a band of its own round the neck's root (law 7), over the top
    collar: () => { if (worn.has('topCollar')) { paint.push({ part: on('topCollar', 'neck'), run: [0.75, 1], group: 'Trim' }); return true; }
      if (!worn.has('top') || !have.has('neck')) return false; const fam = top.family ?? 'knit';
      garments.push({ id: 'topRib', part: ['neck'], run: [0.1, r6(0.1 + 0.16 * law.trim)],   // from where the neck leaves the top's yoke
        ease: r6(easeOf(fam) * 1.3), group: 'Trim' }); worn.add('topRib'); return true; },
    buttons: () => { if (!wovenTop || !worn.has('top')) return false; if (!structured) { warnings.push('buttons: the streamlined torso has no front slot to set them on; the placket alone'); return false; }
      rows.push({ part: on('top', 'torso'), t: 'front', s: [0.45, 3.6], step: r6(0.55 * law.buttonStep), shape: 'stud', r: r6(0.0045 * law.button * k), h: r6(0.0028 * law.button * k), m: 8, group: 'Button' }); return true; },
    belt: () => { if (!bottom || ((bottom.family ?? 'woven') !== 'woven' && focal !== 'belt')) return false;   // law 7: a knit waist is elastic, no loops
      if (!worn.has('bottomSeat')) { if (bottom) warnings.push('belt: the streamlined core has no pelvis to belt'); return false; }
      const over = !tuck && worn.has('topTail') ? [on('topTail', 'pelvis')] : [];
      kit.push({ id: 'belt', mode: 'band', part: on('bottomSeat', 'pelvis'), over, s: [5.2, 5.85], t: 'wrap', nt: 12, ns: 2, mugen: r6(0.003 * k), thick: r6(0.008 * k * law.trim), rad: r6(0.05 * k), group: 'Leather',
        signature: { kind: 'buckle', k: 0, j: 1, w: r6(0.03 * k * law.trim), h: r6(0.024 * k * law.trim), bar: r6(0.006 * k), standoff: r6(0.005 * k), group: 'Buckle' } }); return true; },
    cuffs: () => { if (!sleeveEnd) return false; paint.push({ part: sleeveEnd, run: [0.998, 1], group: 'Trim' }); return true; },   // the last band: from the cuff's own ring to the end
    hem: () => { if (!hemPiece) return false; paint.push({ ...hemPiece, group: 'Trim' }); return true; },
    waistband: () => { if (!worn.has('bottomSeat')) return false; paint.push({ part: on('bottomSeat', 'pelvis'), u: [6 - EDGE.waistband, 6], group: 'Waistband' }); return true; },
    legHem: () => { if (!legEnd || (bottom.family ?? 'woven') !== 'knit') return false; paint.push({ part: legEnd, run: [0.998, 1], group: 'Trim' }); return true; },
    seams: () => { if (!worn.has('top')) return false; paint.push({ part: on('top', 'torso'), t: [0.4, 0.6], u: [0.3, 3.4], group: 'Seam' }); return true; },
  };
  const focalEdge = focal === 'collar' ? 'collar' : focal === 'placket' ? 'buttons' : 'belt';
  // the budget's tiers: the focal (1), every other edge (2), the seams (3); an edge with nothing to sit on is skipped
  const budget = [[focalEdge], ['collar', 'buttons', 'belt', 'cuffs', 'hem', 'waistband', 'legHem'].filter((e) => e !== focalEdge), ['seams']];
  for (let tier = 0; tier < Math.min(orn, 3); tier++) for (const e of budget[tier]) if (edges[e]()) spent.push(e);
  if (orn >= 1 && !spent.includes(focalEdge)) warnings.push(`focal: '${focal}' could not be set on this body or outfit (law 5)`);

  // ── 6 TONE: the card's over the derived, and the layers' value step
  const T = { ...(card.tones || {}), ...palette };   // `palette`: the figure's, the card's and the operator's, in that order
  const tones = { Trim: shade(T.Top ?? '#888888', knitTop ? 0.8 : 0.86), Placket: shade(T.Top ?? '#888888', 0.93), Button: '#efe9dc', Seam: shade(T.Top ?? '#888888', 0.78), Collar: shade(T.Top ?? '#888888', 1.06),
    Waistband: shade(T.Bottom ?? '#555555', 0.84), Leather: '#5a3a22', Buckle: '#b8b2a6', ...(card.tones || {}) };
  if (top && bottom && T.Top && T.Bottom && Math.abs(lightness(T.Top) - lightness(T.Bottom)) < 12) warnings.push(`value step: Top and Bottom differ by under 12 L* (law 4) — the layers may read as one`);

  // ── 7 LEDGER
  const trace = { style: typeof build.style === 'string' || build.style === undefined ? build.style ?? 'casual' : card.id || 'inline', dials, lengths, tuck, feet, focal,
    pieces: garments.map((E) => E.id), edges: spent, laws: build.laws ?? OUTFIT_LAWS_VERSION, ...(warnings.length ? { warnings } : {}) };
  return { garments, paint, rows, kit, tones, trace };
}

/** The palette a build suggests beneath the operator's own */
export const outfitTones = (build) => { const c = isOutfitBuild(build) ? cardOf(build.style ?? 'casual') : null; return c && typeof c === 'object' ? { ...(c.tones || {}) } : {}; };

/** The readout for the hero's dress: the trace of the build as this body wears it (style, dials, lengths, focal,
 * pieces, the edges spent, any warnings). `plan`: the hero's plan (its parts and scale are read as the dress read them). */
export function outfitReadout(build, plan) {
  const have = new Set((plan?.segments || []).map((s) => s.name.replace(/[RL]$/, '')));
  return expandOutfit(build, { have, scale: 1 }, plan?.palette || {}).trace;   // the trace reads no metres
}
