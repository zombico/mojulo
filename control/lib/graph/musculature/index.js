/** musculature — THE MUSCLE SHIRT: a flat body puts it on and its muscles show up. The fourth wearable library, built as
 * footwear, handwear and plating are (docs/plating.md): a CARD (cards.js: a tree of muscle masses by group and level),
 * the PASSES that lay it (passes.js: densify, seat, articulate, displace), the LAWS they obey (principles.js: the
 * definition dial, form to detail) and an ADAPTER per body (adapters/loft.js: the lofted hero body).
 *
 * `muscleShirt(recipe, spec)` returns the recipe with its body's skin re-sampled at the shirt's grain and carried out to
 * the muscles: the wearer's frame and proportions kept, its rig, its bind's shares and its dials carried, the pectoral
 * layer taken off, the hands scaled about the wrists to follow the arms (their joints with them), and nothing else
 * touched (the head, the feet, the clips). Pure and deterministic. */
import { MUSCLE_CARDS, MUSCLE_CARD_NAMES, validateMuscleCard } from './cards.js';
import { densify, grainOf, frames, seatMass, displace, symmetrize, mirrorPart, mirrorEgg, girthOf, handsScaled } from './passes.js';
import { HAND_SHARE } from './principles.js';
import { skinOf, sideOf, TAKEN_OFF, TUCK, DOMES, handParts, handJoints, handRamp } from './adapters/loft.js';

export { MUSCLE_CARDS, MUSCLE_CARD_NAMES, validateMuscleCard } from './cards.js';
export { FORM_GAIN, DETAIL_GAIN, BLEND, presence, articulation } from './principles.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the spec resolved: { card, word, definition, groups } (a word, or { card, definition, groups }) */
export function resolveMuscleShirt(spec) {
  const s = typeof spec === 'string' ? { card: spec } : spec ?? {};
  const word = typeof s.card === 'string' || s.card === undefined ? (s.card ?? 'saikyo') : null;
  const card = word ? MUSCLE_CARDS[word] : s.card;
  return { card, word, definition: s.definition ?? 0.5, groups: s.groups ?? {} };
}

/** a spec's errors (empty = valid) */
export function validateMuscleShirt(spec, label = 'muscleShirt') {
  if (spec === undefined || spec === null) return [];
  if (typeof spec === 'string') return MUSCLE_CARDS[spec] ? [] : [`${label}: one of ${MUSCLE_CARD_NAMES.join(', ')}, or { card, definition, groups }`];
  if (typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a card word (${MUSCLE_CARD_NAMES.join(', ')}) or { card, definition, groups }`];
  const errs = [];
  for (const k of Object.keys(spec)) if (!['card', 'definition', 'groups'].includes(k)) errs.push(`${label}.${k}: not a muscle shirt key (card, definition, groups)`);
  if (typeof spec.card === 'string' && !MUSCLE_CARDS[spec.card]) errs.push(`${label}.card: one of ${MUSCLE_CARD_NAMES.join(', ')}`);
  else if (spec.card !== undefined && typeof spec.card !== 'string') errs.push(...validateMuscleCard(spec.card, `${label}.card`));
  const inUnit = (x) => Number.isFinite(x) && x >= 0 && x <= 1;
  if (spec.definition !== undefined && !inUnit(spec.definition)) errs.push(`${label}.definition: 0 (form: a few key shapes, exaggerated) … 1 (detail: every muscle separated)`);
  const { card } = resolveMuscleShirt(spec), gids = (card?.groups ?? []).map((g) => g.id);
  if (spec.groups !== undefined) {
    if (typeof spec.groups !== 'object' || Array.isArray(spec.groups)) errs.push(`${label}.groups: { <group>: definition } (${gids.join(', ')})`);
    else for (const [g, v] of Object.entries(spec.groups)) {
      if (!gids.includes(g)) errs.push(`${label}.groups.${g}: not a group of the card (${gids.join(', ')})`);
      else if (!inUnit(v)) errs.push(`${label}.groups.${g}: a definition, 0 … 1`);
    }
  }
  return errs;
}

/** THE MUSCLE SHIRT PUT ON: `recipe` a lofted hero's (its rig's joints, its body's closed lofts), `spec` as above.
 * Returns { recipe, report: { card, definition, masses, missed, moved, points } } */
export function muscleShirt(recipe, spec) {
  const errs = validateMuscleShirt(spec); if (errs.length) throw new Error(`musculature: ${errs.join('; ')}`);
  const { card, word, definition, groups: own } = resolveMuscleShirt(spec);
  const F = frames(recipe.rig), skin = skinOf(recipe), grain = card.grain ?? 0.011;
  // 1. DENSIFY the midline parts and the right limbs (their left partners mirrored at the end)
  const dense = {};
  for (const n of [...skin.mid, ...skin.right]) dense[n] = densify(recipe.parts[n], { ...grainOf(recipe.parts[n], grain), grain, domes: DOMES[sideOf(n).base] ?? [] });
  // 2 + 3. SEAT each mass on the dense skin, articulated at its group's definition
  const masses = [], missed = [];
  for (const g of card.groups) {
    const d = own[g.id] ?? definition, finest = Math.max(...g.masses.map((m) => m.level));
    for (const m of g.masses) {
      const e = seatMass(m, g, F, dense, d, finest);
      if (!e) { missed.push(m.id); continue; }
      masses.push({ ...e, d, parts: g.parts, mid: !!m.mid });
    }
  }
  // 4. DISPLACE each part by the masses its group wears it by (a midline part both sides', a right limb's its own)
  const both = masses.flatMap((e) => (e.mid ? [e] : [e, mirrorEgg(e)]));
  const out = {}, moved = {};
  for (const n of Object.keys(dense)) {
    const { base, side } = sideOf(n), worn = (side ? masses : both).filter((e) => e.parts.includes(base));
    // (each group at its own definition: the union's blends read the group's, so a part's masses are displaced together
    // at the definition of the most of them; a part worn by groups at different definitions takes the shirt's)
    const ds = [...new Set(worn.map((e) => e.d))], d = ds.length === 1 ? ds[0] : definition;
    const { part, moved: k } = displace(dense[n], worn, d, TUCK[base] ?? 0);
    out[n] = side ? part : symmetrize(part); moved[n] = k;
  }
  for (const [rn, ln] of Object.entries(skin.left)) if (out[rn]) out[ln] = mirrorPart(out[rn], typeof recipe.parts[ln].bind === 'string' ? { ...recipe.parts[ln], bind: { bone: recipe.parts[ln].bind } } : recipe.parts[ln]);
  // the recipe: the skin replaced, the pectoral layer off, the dials' station blends carried by u (as the form field's
  // slice carries them), the body's rounding dropped (the shirt's grain is its own rounding)
  const worn = Object.fromEntries(Object.entries(recipe.parts).filter(([n]) => !TAKEN_OFF.test(n)).map(([n, p]) => [n, out[n] ?? p]));
  // 5. THE HANDS after the arms: about each wrist by the card's `hands`, else HAND_SHARE of the forearm's growth in girth
  const fore = recipe.parts.foreArmR && out.foreArmR ? girthOf(out.foreArmR) / girthOf(recipe.parts.foreArmR) : 1;
  const hands = r6(typeof card.hands === 'number' ? card.hands : Math.max(1, 1 + HAND_SHARE * (fore - 1)));
  const { parts, rig } = handsScaled(worn, recipe.rig, hands, handParts, handJoints, handRamp);
  const gone = Object.keys(recipe.parts).filter((n) => TAKEN_OFF.test(n)), done = Object.keys(out);
  const dials = structuredClone(recipe.dials || {});
  for (const dl of Object.values(dials)) {
    if (Array.isArray(dl.parts)) dl.parts = dl.parts.filter((p) => !gone.includes(p));
    if (dl.blend && dl.parts?.some((p) => done.includes(p))) for (const pn of done) for (const s of parts[pn].stations) if (dl.blend[s.id] === undefined) {
      const lo = dl.blend[`st${Math.floor(s.u)}`] ?? 0, hi = dl.blend[`st${Math.ceil(s.u)}`] ?? 0, t = s.u - Math.floor(s.u);
      dl.blend[s.id] = r6(lo * (1 - t) + hi * t);
    }
  }
  const { smoothBody: _s, ...rest } = recipe;
  return {
    recipe: { ...rest, parts, dials, rig },
    report: { card: word ?? 'own', definition, masses: masses.length, missed, moved, hands, points: Object.values(out).reduce((a, p) => a + p.stations.length * p.slots.length, 0) },
  };
}
