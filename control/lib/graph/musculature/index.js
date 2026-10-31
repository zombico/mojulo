/** musculature — THE MUSCLE SHIRT: a flat body puts it on and its muscles show up. The fourth wearable library, built as
 * footwear, handwear and plating are (docs/plating.md): a CARD (cards.js: a tree of muscle masses by group and level),
 * the PASSES that lay it (passes.js: densify, seat, articulate, displace), the LAWS they obey (principles.js: the
 * definition dial, form to detail) and an ADAPTER per body (adapters/loft.js: the lofted hero body).
 *
 * `muscleShirt(recipe, spec)` returns the recipe with its body's skin re-sampled at the shirt's grain and carried out to
 * the muscles: the wearer's frame and proportions kept, its rig, its bind's shares and its dials carried, the pectoral
 * layer taken off, the hands scaled about the wrists and the feet about the ground under the ankles to follow the limbs
 * (their joints with them), the nipples drawn when asked, and nothing else touched (the head, the clips). Pure and
 * deterministic. */
import { MUSCLE_CARDS, MUSCLE_CARD_NAMES, validateMuscleCard } from './cards.js';
import { densify, grainOf, frames, seatMass, displace, symmetrize, mirrorPart, mirrorEgg, girthOf, handsScaled, feetScaled, nipplesOn, activeMass, offsetsOf, domeKeys } from './passes.js';
import { HAND_SHARE, FOOT_SHARE, NIPPLE, ACTIVITY_JOINTS } from './principles.js';
import { skinOf, sideOf, TAKEN_OFF, TUCK, DOMES, UNDER, handParts, handJoints, handRamp, footParts, footJoints } from './adapters/loft.js';

export { MUSCLE_CARDS, MUSCLE_CARD_NAMES, validateMuscleCard } from './cards.js';
export { FORM_GAIN, DETAIL_GAIN, BLEND, presence, articulation } from './principles.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;

/** the spec resolved: { card, word, definition, groups, nipples, activity } (a word, or an object of SPEC_KEYS) */
export function resolveMuscleShirt(spec) {
  const s = typeof spec === 'string' ? { card: spec } : spec ?? {};
  const word = typeof s.card === 'string' || s.card === undefined ? (s.card ?? 'saikyo') : null;
  const card = word ? MUSCLE_CARDS[word] : s.card;
  return { card, word, definition: s.definition ?? 0.5, groups: s.groups ?? {}, nipples: s.nipples === true, activity: s.activity !== false };
}

/** a spec's keys: the card, its definition (0 form … 1 detail), a group's own, the nipples (off unless true) and the
 * muscles' activity (their squash and stretch as the joints close: on unless false) */
const SPEC_KEYS = Object.freeze(['card', 'definition', 'groups', 'nipples', 'activity']);
/** a spec's errors (empty = valid) */
export function validateMuscleShirt(spec, label = 'muscleShirt') {
  if (spec === undefined || spec === null) return [];
  if (typeof spec === 'string') return MUSCLE_CARDS[spec] ? [] : [`${label}: one of ${MUSCLE_CARD_NAMES.join(', ')}, or { card, definition, groups }`];
  if (typeof spec !== 'object' || Array.isArray(spec)) return [`${label}: a card word (${MUSCLE_CARD_NAMES.join(', ')}) or { ${SPEC_KEYS.join(', ')} }`];
  const errs = [];
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k)) errs.push(`${label}.${k}: not a muscle shirt key (${SPEC_KEYS.join(', ')})`);
  if (spec.nipples !== undefined && typeof spec.nipples !== 'boolean') errs.push(`${label}.nipples: true (drawn on the chest) or false (none, the default)`);
  if (spec.activity !== undefined && typeof spec.activity !== 'boolean') errs.push(`${label}.activity: true (the muscles bunch and stretch as the joints close, the default) or false (held as at rest)`);
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
  const { card, word, definition, groups: own, nipples, activity } = resolveMuscleShirt(spec);
  const F = frames(recipe.rig), skin = skinOf(recipe), grain = card.grain ?? 0.011;
  // 1. DENSIFY the midline parts and the right limbs (their left partners mirrored at the end)
  const dense = {};
  // (only the shells a group wears: one no muscle reaches keeps its authored rings, the shoulder's cone among them, which
  // the smooth cage folded in places over its turning rings)
  const wornParts = new Set(card.groups.flatMap((g) => g.parts));
  for (const n of [...skin.mid, ...skin.right]) if (wornParts.has(sideOf(n).base)) dense[n] = densify(recipe.parts[n], { ...grainOf(recipe.parts[n], grain), grain, domes: DOMES[sideOf(n).base] ?? [] });
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
  const out = {}, raw = {}, moved = {}, held = {};
  const displaced = (n, worn) => {
    const { base } = sideOf(n), ds = [...new Set(worn.map((e) => e.d))], d = ds.length === 1 ? ds[0] : definition;
    // (each group at its own definition: the union's blends read the group's, so a part's masses are displaced together
    // at the definition of the most of them; a part worn by groups at different definitions takes the shirt's)
    return displace(dense[n], worn, d, TUCK[base] ?? 0, null, UNDER.includes(base));
  };
  for (const n of Object.keys(dense)) {
    const { side } = sideOf(n), { part, moved: k, capped } = displaced(n, (side ? masses : both).filter((e) => e.parts.includes(sideOf(n).base)));
    raw[n] = part; out[n] = side ? part : symmetrize(part); moved[n] = k; held[n] = capped;
  }
  // SQUASH AND STRETCH (a group's `act`): per joint, its flexors bunched and its extensors stretched (activeMass) on the
  // right side, the parts they are worn by displaced again, and the difference worn as a CORRECTIVE on the rest, driven
  // by the joint (principles.js ACTIVITY_JOINTS); the left side's the mirror. Hands and feet and bridges a scale moves
  // after are not in it
  const correctives = [];
  const actOf = Object.fromEntries(card.groups.map((g) => [g.id, g.act ?? []]));
  // (a joint that REVERTS, `revert`: near it the active skin eased back to the wearer's own, wholly within `near` of the
  // half biacromial of the joint and none past `far`: the arm raised overhead folded the deltoid's bulk at its root, on
  // weights shared across the joint, into holes, where the flat body's own shoulder raises clean)
  const reverted = (A, D, { near, far }) => {
    const J = (F.limb.upperArm?.h) ?? [0, 0, 0], a = near * F.W, b = far * F.W;
    const ease = (p) => { const x = (Math.hypot(p[0] - J[0], p[1] - J[1], p[2] - J[2]) - a) / (b - a); const y = x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); return 1 - y; };
    const lerp = (p, q, w) => (w <= 0 ? p : [0, 1, 2].map((k) => r6(p[k] + (q[k] - p[k]) * w)));
    return { ...A, stations: A.stations.map((x, i) => ({ ...x, points: Object.fromEntries(A.slots.map((sl) => { const q = D.stations[i].points[sl]; return [sl, lerp(x.points[sl], q, ease(q))]; })) })), ...(A.caps ? { caps: Object.fromEntries(Object.entries(A.caps).map(([k, p]) => [k, D.caps?.[k] ? lerp(p, D.caps[k], ease(D.caps[k])) : p])) } : {}) };
  };
  for (const [joint, driver] of activity ? Object.entries(ACTIVITY_JOINTS) : []) {
    const swap = new Map();
    for (const e of masses) { const a = actOf[e.group].find((x) => x.joint === joint); if (a) swap.set(e, activeMass(e, a.role)); }
    if (!swap.size) continue;
    const touched = [...new Set([...swap.keys()].flatMap((e) => e.parts))].flatMap((b) => [b, `${b}R`]).filter((n) => dense[n] && !/^wristBridge/.test(n));
    const right = {}, left = {}, cap = joint[0].toUpperCase() + joint.slice(1);
    for (const n of touched) {
      // (the right side's masses active, the left's as they were: a midline part takes the right arm's or leg's alone)
      const { base, side } = sideOf(n);
      const set = masses.map((e) => swap.get(e) ?? e), worn = (side ? set : [...set, ...masses.filter((e) => !e.mid).map(mirrorEgg)]).filter((e) => e.parts.includes(base));
      // (a point held at the move's cap at rest or active, its ray grazing a mass, keeps its rest place: posed, such rays
      // swung out in shards; a joint that reverts eases every point back, the held ones too, or they stood out in frills
      // round the skin it eased)
      const { part: act, capped } = displaced(n, worn);
      const keep = driver.revert ? [] : [...held[n], ...capped, ...(driver.domes ? [] : domeKeys(dense[n]))];
      const o = offsetsOf(n, raw[n], driver.revert ? reverted(act, dense[n], driver.revert) : act, side ? `${base}L` : n, new Set(keep));
      Object.assign(right, o.R); Object.assign(left, o.L);
    }
    const swapD = (D) => ({ ...D, joint: D.joint.replace(/R$/, 'L'), to: D.to.replace(/R$/, 'L'), ...(D.bend ? { bend: D.bend.replace(/R$/, 'L') } : {}) });
    const { revert: _r, domes: _d, ...drv } = driver;
    if (Object.keys(right).length) correctives.push({ id: `muscle${cap}R`, driver: drv, d: right });
    if (Object.keys(left).length) correctives.push({ id: `muscle${cap}L`, driver: swapD(drv), d: left });
  }
  // the NIPPLES (`nipples: true`): marks on the chest the muscles made, seated on it and worn after them under their own
  // tight blend (the chest group's definition)
  if (nipples && out.torso) {
    const marks = nipplesOn(out.torso, F, card.nipple ?? NIPPLE.on, NIPPLE), dc = own.chest ?? definition;
    if (marks.length) { out.torso = symmetrize(displace(out.torso, marks, dc, 0, NIPPLE.k).part); moved.nipples = marks.length / 2; }   // (the marks a side: the areola and the papilla)
  }
  for (const [rn, ln] of Object.entries(skin.left)) if (out[rn]) out[ln] = mirrorPart(out[rn], typeof recipe.parts[ln].bind === 'string' ? { ...recipe.parts[ln], bind: { bone: recipe.parts[ln].bind } } : recipe.parts[ln]);
  // the recipe: the skin replaced, the pectoral layer off, the dials' station blends carried by u (as the form field's
  // slice carries them), the body's rounding dropped (the shirt's grain is its own rounding)
  const worn = Object.fromEntries(Object.entries(recipe.parts).filter(([n]) => !TAKEN_OFF.test(n)).map(([n, p]) => [n, out[n] ?? p]));
  // 5. THE HANDS after the arms: about each wrist by the card's `hands`, else HAND_SHARE of the forearm's growth in girth
  const fore = recipe.parts.foreArmR && out.foreArmR ? girthOf(out.foreArmR) / girthOf(recipe.parts.foreArmR) : 1;
  const hands = r6(typeof card.hands === 'number' ? card.hands : Math.max(1, 1 + HAND_SHARE * (fore - 1)));
  const H = handsScaled(worn, recipe.rig, hands, handParts, handJoints, handRamp);
  // 6. THE FEET after the legs: about the ground under each ankle by the card's `feet`, else FOOT_SHARE of the shank's
  // growth in girth (the sole stays on the ground)
  const shank = recipe.parts.shankR && out.shankR ? girthOf(out.shankR) / girthOf(recipe.parts.shankR) : 1;
  const feet = r6(typeof card.feet === 'number' ? card.feet : Math.max(1, 1 + FOOT_SHARE * (shank - 1)));
  const { parts, rig } = feetScaled(H.parts, H.rig, feet, footParts, footJoints);
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
    recipe: { ...rest, parts, dials, rig, ...(correctives.length ? { correctives: [...(recipe.correctives ?? []), ...correctives] } : {}) },
    report: { card: word ?? 'own', definition, masses: masses.length, missed, moved, hands, feet, nipples, correctives: correctives.map((c) => `${c.id}:${Object.keys(c.d).length}`), points: Object.values(out).reduce((a, p) => a + p.stations.length * p.slots.length, 0) },
  };
}
