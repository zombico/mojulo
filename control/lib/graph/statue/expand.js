// statue/expand — a STATUE BUILD on the hero's `statue`, expanded on every read over the hero's plan and recipe, by the
// passes in a fixed order (principles.js carries the laws they obey):
//
//   statue: { type: 'statue', style, material?, crop?, lose?, base?, dials?, laws? }   (or a style word)
//     style     a seeded card name (styles.js) or an inline card
//     material  a material word over the card's (law 1)
//     crop      a format word over the card's: full | bust | herm | torso (law 4)
//     lose      a list of loss words: head, handR, forearmL, armR, footL, shankR, legL, … (law 5)
//     base      a base word over the card's and the format's (law 7)
//     stand     standing | seated, over the card's (law 9): seated sits it on a throne, the hands on the knees
//     dials     { wear 0–1 } (law 8)
//     laws      the version of principles.js the build was minted under (stamped by the hero record; absent → current)
//
//   1 POSE     the card's stand when the hero names no gesture; the idle, walk and wave clips off (a statue is still)
//   2 DRAPE    the card's drapery (an outfit card per silhouette) when the hero names no outfit; its hair at mint
//   3 CUT      the format and the losses: parts removed with everything they carry, the bust's torso and the study's
//              thighs cut to a sealed ring (laws 4, 5)
//   4 CARVE    the bare body's zones become skin; every group of every part takes the material: blank eyes, carved
//              hair (laws 1, 2, 3), or the painted
//              tones (law 6); wear dulls it (law 8)
//   5 SURFACE  the faces carry the material's surface for the exports: stone, or a metal in its patina's colour (law 1)
//   6 BASE     the base the World page and the exports stand it on, built at read time under the posed figure (base.js)
//   7 LEDGER   the trace: the card, period, material, format, the parts lost, the base, wear, basis, the caption
//              derived work carries ("inspired by …"), and warnings
//
// Passes 1 and 2 run on the hero before its plan (`statueHero`); 3 to 5 on the expanded recipe (`statueRecipe`); 6 at
// read time. Pure and deterministic: no dice, fixed order.
import { STATUE_LAWS_VERSION, STATUE_MATERIALS, MATERIAL_WORDS, CROP_WORDS, LOSSES, LOSS_WORDS, BASE_WORDS, CROP_BASE, METAL_BASE_MATERIAL, STAND_WORDS, SEATED_POSE, PAINT_TONES, BUST_FROM_U, BUST_ARM_KEEP, TORSO_THIGH_KEEP, NECK_KEEP, BODY_ZONES, weatherTone, bronzeAge } from './principles.js';
import { SEEDED_STATUES, STATUE_STYLES } from './styles.js';
import { validateOutfitCard } from '../outfit/styles.js';
import { resolveMetalSurface, metalShelfRow } from '../materials/metal-surface.js';

export { STATUE_LAWS_VERSION, STATUE_STYLES };
export const isStatueBuild = (s) => !!(s && typeof s === 'object' && !Array.isArray(s) && s.type === 'statue');
/** a style word is the build of that card */
export const normalizeStatue = (s) => (typeof s === 'string' ? { type: 'statue', style: s } : s);
const cardOf = (style) => (typeof style === 'string' ? SEEDED_STATUES[style] : style);
const BUILD_FIELDS = ['type', 'style', 'material', 'crop', 'lose', 'base', 'stand', 'dials', 'laws'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

/** Validate an inline card → error strings */
export function validateStatueCard(card, at = 'statue.style') {
  if (!isObj(card)) return [`${at}: a card { material?, crop?, base?, gesture?, hair?, drape?, paint? }`];
  const errs = [];
  if (card.material !== undefined && !MATERIAL_WORDS.includes(card.material)) errs.push(`${at}.material: one of ${MATERIAL_WORDS.join(', ')}`);
  if (card.crop !== undefined && !CROP_WORDS.includes(card.crop)) errs.push(`${at}.crop: one of ${CROP_WORDS.join(', ')}`);
  if (card.base !== undefined && !BASE_WORDS.includes(card.base)) errs.push(`${at}.base: one of ${BASE_WORDS.join(', ')}`);
  if (card.stand !== undefined && !STAND_WORDS.includes(card.stand)) errs.push(`${at}.stand: one of ${STAND_WORDS.join(', ')}`);
  for (const k of ['hair', 'drape']) if (card[k] !== undefined && !(isObj(card[k]) && Object.keys(card[k]).every((s) => s === 'male' || s === 'female'))) errs.push(`${at}.${k}: { male, female }`);
  for (const s of ['male', 'female']) { const d = card.drape?.[s]; if (d !== undefined && d !== null) errs.push(...validateOutfitCard(d, `${at}.drape.${s}`)); }
  if (card.paint !== undefined) { const sets = isObj(card.paint) && (card.paint.male || card.paint.female) ? [card.paint.male, card.paint.female].filter(Boolean) : [card.paint];
    if (!sets.every((t) => isObj(t) && Object.values(t).every(isHex))) errs.push(`${at}.paint: { group: '#rrggbb' }, or { male, female } of them`); }
  return errs;
}

/** Validate a build → error strings naming the choices. `hero`: the spec it is worn on (its head, core and gear). */
export function validateStatueBuild(input, hero = {}) {
  const build = normalizeStatue(input);
  if (!isStatueBuild(build)) return [`statue: a style word (${STATUE_STYLES.join(', ')}) or { type: 'statue', style, material?, crop?, lose?, base?, dials? }`];
  const errs = [], style = build.style ?? 'classical';
  if (typeof style === 'string') { if (!SEEDED_STATUES[style]) errs.push(`statue.style: '${style}' is not a card (${STATUE_STYLES.join(', ')}); or pass an inline card`); }
  else errs.push(...validateStatueCard(style));
  if (build.material !== undefined && !MATERIAL_WORDS.includes(build.material)) errs.push(`statue.material: one of ${MATERIAL_WORDS.join(', ')}`);
  if (build.crop !== undefined && !CROP_WORDS.includes(build.crop)) errs.push(`statue.crop: one of ${CROP_WORDS.join(', ')}`);
  if (build.base !== undefined && !BASE_WORDS.includes(build.base)) errs.push(`statue.base: one of ${BASE_WORDS.join(', ')}`);
  if (build.stand !== undefined && !STAND_WORDS.includes(build.stand)) errs.push(`statue.stand: one of ${STAND_WORDS.join(', ')}`);
  if (build.lose !== undefined) {
    if (!Array.isArray(build.lose)) errs.push(`statue.lose: a list of loss words (${LOSS_WORDS.join(', ')})`);
    else for (const w of build.lose) if (!LOSS_WORDS.includes(w)) errs.push(`statue.lose: '${w}' is not a loss word (${LOSS_WORDS.join(', ')})`);
  }
  const d = build.dials ?? {};
  if (!isObj(d)) errs.push('statue.dials: { wear }');
  else { for (const k of Object.keys(d)) if (k !== 'wear') errs.push(`statue.dials.${k}: not a dial (wear)`);
    if (d.wear !== undefined && !(Number.isFinite(d.wear) && d.wear >= 0 && d.wear <= 1)) errs.push('statue.dials.wear: a number 0–1'); }
  for (const k of Object.keys(build)) if (!BUILD_FIELDS.includes(k)) errs.push(`statue.${k}: not a build field (${BUILD_FIELDS.join(', ')})`);
  if (build.laws !== undefined && build.laws !== STATUE_LAWS_VERSION) errs.push(`statue.laws: ${build.laws} is unknown — this kernel carries statue laws ${STATUE_LAWS_VERSION}`);
  // the bodies a statue is carved from: the landmark head (blank eyes, carved hair) or the blank trunk
  if (hero.head === 'anime') errs.push("statue: the anime head's graphic face is not carved yet; wear head 'landmark' (the default) or 'none'");
  if (hero.gear && Object.keys(hero.gear).length) errs.push('statue: held gear is not carved yet; remove gear (an armour build in adorn is carved with the figure)');
  const crop = build.crop ?? cardOf(style)?.crop ?? 'full', stand = build.stand ?? cardOf(style)?.stand ?? 'standing';
  if (stand === 'seated' && hero.gesture !== undefined) errs.push("statue.stand: a seated statue's stand is the seat (the hands on the knees); remove gesture, or stand it ('standing')");
  if (stand === 'seated' && (crop === 'bust' || crop === 'herm')) errs.push(`statue.stand: a ${crop} has no lap to sit on; stand it ('standing') or crop it 'full' or 'torso'`);
  if ((crop === 'bust' || crop === 'herm') && Array.isArray(build.lose) && build.lose.includes('head')) errs.push(`statue.lose: a ${crop} is a head; it cannot lose it`);
  return errs;
}

/** The build's resolved words: the card's beneath the build's own, the format's base beneath both */
export function statueWords(input) {
  const build = normalizeStatue(input), card = cardOf(build.style ?? 'classical');
  const crop = build.crop ?? card.crop ?? 'full', material = build.material ?? card.material ?? 'marble';
  const base = build.base ?? (build.crop !== undefined ? CROP_BASE[crop] : card.base ?? CROP_BASE[crop]);
  return { card, crop, material, base, stand: build.stand ?? card.stand ?? 'standing', lose: [...(build.lose ?? [])], wear: build.dials?.wear ?? 0 };
}

// ── 1 POSE + 2 DRAPE ────────────────────────────────────────────────────────
const HAND_KEYS = ['wristL', 'wristR', 'fingersL', 'fingersR'];
/** a seated figure's drapery (law 9): a skirt longer than the knee is cut at the knee — a skirt is a tube about the
 * hips, and a long one would stand open in front of the lap (a drape over the lap is not carved yet) */
const LONG_SKIRT = new Set(['midi', 'maxi']);
const seatedDrape = (d) => (d?.language?.bottom?.kind === 'skirt' && LONG_SKIRT.has(d.language.bottom.leg) ? { ...d, language: { ...d.language, bottom: { ...d.language.bottom, leg: 'knee' } } } : d);
/** a card's stand for the cast: its own, or the { male, female } entry */
const castGesture = (g, female) => (isObj(g) && Object.keys(g).length && Object.keys(g).every((k) => k === 'male' || k === 'female') ? g[female ? 'female' : 'male'] : g);
const dropHands = (g) => (Array.isArray(g) ? g.map(dropHands) : isObj(g) ? Object.fromEntries(Object.entries(g).filter(([k]) => !HAND_KEYS.includes(k))) : g);
/** The hero with the card's stand, stillness and drapery beneath its own words (`structured`: its hand has digits, so
 * the card's hand words stand; on the streamlined mitten they are dropped). Absent statue ⇒ the hero itself. */
export function statueHero(hero, { female = false, structured = true } = {}) {
  if (!hero?.statue) return hero;
  const { card, crop, stand } = statueWords(hero.statue), out = { ...hero };
  // a bust or a herm is cut above the hips: it stands at rest (a stance would only lean the cut), unless the hero says;
  // a seated figure takes the seat (law 9)
  const stance = stand === 'seated' ? { ...SEATED_POSE } : crop === 'bust' || crop === 'herm' ? 'rest' : castGesture(card.gesture, female);
  if (out.gesture === undefined && stance !== undefined) out.gesture = structured ? stance : dropHands(stance);
  if (out.clips === undefined) out.clips = { idle: false, walk: false, wave: false };
  const drape = card.drape?.[female ? 'female' : 'male'];
  if (out.outfit === undefined && drape) out.outfit = { type: 'outfit', style: stand === 'seated' ? seatedDrape(drape) : drape };
  return out;
}
/** The card's hair for the silhouette (set at mint, when the hero names none), or undefined */
export const statueHair = (input, { female = false } = {}) => statueWords(input).card.hair?.[female ? 'female' : 'male'];

// ── 3 CUT ───────────────────────────────────────────────────────────────────
const mean = (ps) => ps.reduce((a, p) => [a[0] + p[0] / ps.length, a[1] + p[1] / ps.length, a[2] + p[2] / ps.length], [0, 0, 0]);
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const ringOf = (part, st) => part.slots.map((s) => st.points[s]);
const baseName = (n) => n.replace(/^.*_/, '').replace(/[RL]$/, '');
/** a part (or a garment copied from it: `<piece>_<part>`) is named `name` (with its side) */
const isPart = (n, name) => n === name || n.endsWith(`_${name}`);
/** keep a ring part's stations from `keep` (ids), its cap a short step past the cut ring; its bind's blends kept for the
 * stations kept. `end`: which end is cut ('back' the first ring, 'tip' the last). */
function cutRings(part, keep, end) {
  const stations = part.stations.filter((st) => keep.has(st.id)); if (stations.length < 2 || stations.length === part.stations.length) return part;
  const edge = end === 'back' ? stations[0] : stations.at(-1), next = end === 'back' ? stations[1] : stations.at(-2);
  const c = mean(ringOf(part, edge)), n = mean(ringOf(part, next)), step = [c[0] - n[0], c[1] - n[1], c[2] - n[2]];
  const cap = [0, 1, 2].map((k) => r6(c[k] + 0.12 * step[k]));   // nearly flat: a sealed cut, not a dome
  const bind = part.bind?.blend ? { ...part.bind, blend: Object.fromEntries(Object.entries(part.bind.blend).filter(([k]) => k === 'back' || k === 'tip' || keep.has(k))) } : part.bind;
  return { ...part, stations, caps: { ...part.caps, [end]: cap }, ...(bind ? { bind } : {}) };
}
/** the parts the format and the losses remove, and the parts they cut, on an expanded recipe */
function cutRecipe(recipe, plan, crop, lose) {
  const parts = { ...recipe.parts }, gone = new Set(), headParts = Object.keys((plan.include || []).find((i) => i.name === 'head')?.parts || {});
  const drop = (name) => { for (const n of Object.keys(parts)) if (isPart(n, name)) gone.add(n); };
  const words = new Set(lose);
  // the formats' arms: a bust keeps a stump of each upper arm (cut below), a herm and a torso study none
  if (crop === 'bust') for (const S of ['R', 'L']) words.add(`forearm${S}`);
  else if (crop !== 'full') for (const S of ['R', 'L']) words.add(`arm${S}`);
  if (crop === 'torso') { words.add('head'); for (const S of ['R', 'L']) words.add(`shank${S}`); }
  for (const w of words) { if (w === 'head') { headParts.forEach(drop); continue; } const S = w.slice(-1); for (const b of LOSSES[w.slice(0, -1)]) drop(`${b}${S}`); }
  if (crop === 'bust' || crop === 'herm') {
    // law 4: the torso (and what is copied from it) from the chest up; every other part below the cut goes
    const T = plan.segments.find((s) => s.name === 'torso'), from = T?.stations.find((st) => (st.u ?? 0) >= BUST_FROM_U);
    if (from) {
      const keep = new Set(T.stations.filter((st) => st.z >= from.z).map((st) => st.id));
      for (const n of Object.keys(parts)) if (isPart(n, 'torso') && parts[n].layer === 1) parts[n] = cutRings(parts[n], keep, 'back');
      for (const [n, p] of Object.entries(parts)) if (p.layer === 1 && !headParts.includes(n) && !isPart(n, 'torso') && !isPart(n, 'neck') && !/upperArm[RL]$/.test(n) && mean(p.stations.flatMap((st) => ringOf(p, st)))[2] < from.z) gone.add(n);
    }
  }
  if (crop === 'bust') for (const S of ['R', 'L']) for (const n of Object.keys(parts)) if (isPart(n, `upperArm${S}`) && parts[n].layer === 1 && !gone.has(n)) {
    // law 4: the upper arm (and its sleeve) from the shoulder for its share: the bust's rounded shoulder
    const P = parts[n], k = Math.max(2, Math.ceil(P.stations.length * BUST_ARM_KEEP)); parts[n] = cutRings(P, new Set(P.stations.slice(0, k).map((st) => st.id)), 'tip');
  }
  if (words.has('head')) for (const n of Object.keys(parts)) if (isPart(n, 'neck') && parts[n].layer === 1) {
    // law 4: the neck a lost head leaves, cut flat (a torso study's a short stump)
    const P = parts[n], k = Math.max(2, Math.round(P.stations.length * NECK_KEEP[crop === 'torso' ? 'torso' : 'head'])); parts[n] = cutRings(P, new Set(P.stations.slice(0, k).map((st) => st.id)), 'tip');
  }
  if (crop === 'torso') {
    // law 4: each thigh (and what is copied from it) kept from the hip for its share
    for (const S of ['R', 'L']) for (const n of Object.keys(parts)) if (isPart(n, `thigh${S}`) && parts[n].layer === 1) {
      const P = parts[n], k = Math.max(2, Math.ceil(P.stations.length * TORSO_THIGH_KEEP)); parts[n] = cutRings(P, new Set(P.stations.slice(0, k).map((st) => st.id)), 'tip');
    }
  }
  // a pinned part goes with its parent
  for (let grew = true; grew;) { grew = false; for (const [n, p] of Object.entries(parts)) if (!gone.has(n) && p.pin && gone.has(p.pin.parent)) { gone.add(n); grew = true; } }
  for (const n of gone) delete parts[n];
  const dials = {};
  for (const [k, d] of Object.entries(recipe.dials || {})) {
    if (Array.isArray(d.parts)) { const ps = d.parts.filter((n) => !gone.has(n)); if (ps.length) dials[k] = { ...d, parts: ps }; }
    else if (typeof d.part === 'string') { if (!gone.has(d.part)) dials[k] = d; }
    else dials[k] = d;
  }
  return { recipe: { ...recipe, parts, dials }, lost: [...gone].sort() };
}

// ── 4 CARVE + 5 SURFACE ─────────────────────────────────────────────────────
/** law 1: the bare body's zones as skin — on every part that is not a garment, its zone groups (BODY_ZONES) that no
 * second skin painted become 'Skin', so the painted figure's flesh is flesh and the carved one smooths as skin does */
function bodyAsSkin(parts) {
  const zone = (g, keep) => (BODY_ZONES.includes(g) && !keep.has(g) ? 'Skin' : g);
  return Object.fromEntries(Object.entries(parts).map(([n, p]) => {
    if (p.layer !== 1 || p.garment) return [n, p];
    const keep = new Set(Array.isArray(p.painted) ? p.painted : Object.keys(p.painted || {}));
    return [n, { ...p, ...(p.group !== undefined || !keep.has('Body') ? { group: zone(p.group ?? 'Body', keep) } : {}),
      ...(p.bandGroups ? { bandGroups: Object.fromEntries(Object.entries(p.bandGroups).map(([k, v]) => [k, v.map((g) => (g ? zone(g, keep) : g))])) } : {}),
      ...(p.capGroups ? { capGroups: Object.fromEntries(Object.entries(p.capGroups).map(([k, v]) => [k, v ? zone(v, keep) : v])) } : {}) }];
  }));
}
/** every palette group a recipe's parts draw (layeredFaces' lookup: the part's per-face groups, its bands and caps,
 * its group, else 'Body') */
function groupsOf(recipe) {
  const out = new Set(Object.keys(recipe.palette || {}));
  for (const p of Object.values(recipe.parts)) {
    out.add(p.group ?? 'Body');
    for (const v of Object.values(p.groups || {})) out.add(v);
    for (const v of Object.values(p.bandGroups || {})) for (const g of v) if (g) out.add(g);
    for (const v of Object.values(p.capGroups || {})) if (v) out.add(v);
  }
  out.add('Swim');   // the swimsuit's cut panels read palette.Swim
  return [...out].sort();
}
/** The material's tone, the surface its faces carry, and the painted tones (law 6) for a silhouette */
export function statueMaterial(material, { wear = 0, card = {}, female = false } = {}) {
  // law 6: paint lies over the card's own stone (an Egyptian card's limestone or granite), else over marble
  const ground = STATUE_MATERIALS[card.material], M = material === 'painted' && ground && !ground.metal && !ground.paint ? { ...ground, paint: true } : STATUE_MATERIALS[material];
  if (M.metal) {
    // the colour is the metal surface's at its age (metal-surface.js: a bronze's patina from brown to verdigris by wear,
    // gilding the gold's own); the faces carry it as a shelf metal of that colour (metallic, a patina's roughness, a
    // burnished gilding's shine) rather than the live metal channel, whose film reads as interference colour, not patina
    const tone = metalShelfRow(resolveMetalSurface({ metal: M.metal, ...(M.metal === 'bronze' ? { film: { age: bronzeAge(wear) } } : {}) })).base;
    return { tone, surface: { preset: M.metal === 'bronze' ? 'bronze' : 'gold', base: tone, specular: M.metal === 'bronze' ? 0.35 : 0.6 }, paint: null };
  }
  const own = card.paint && (card.paint.male || card.paint.female) ? card.paint[female ? 'female' : 'male'] : card.paint;
  return { tone: weatherTone(M.tone, wear), surface: M.surface, paint: M.paint ? Object.fromEntries(Object.entries({ ...PAINT_TONES, ...(own || {}) }).map(([g, h]) => [g, weatherTone(h, wear)])) : null };
}

/** Passes 3–5 on an expanded hero recipe: the cut, the carve and the surface, and the ledger. `plan`: the plan the recipe
 * expanded from (the torso's stations, the head's parts). → { recipe, trace } */
export function statueRecipe(recipe, plan, input, { female = false } = {}) {
  const { card, crop, material, base, stand, lose, wear } = statueWords(input), warnings = [];
  const { recipe: cutParts, lost } = cutRecipe(recipe, plan, crop, lose), cut = { ...cutParts, parts: bodyAsSkin(cutParts.parts) };
  const { tone, surface, paint } = statueMaterial(material, { wear, card, female });
  const palette = Object.fromEntries(groupsOf(cut).map((g) => [g, paint?.[g] ?? tone]));
  const { emissive: _glow, ...rest } = cut;
  if (paint) warnings.push('painted: the polychromy is a reconstruction — ancient colour survives in traces; these tones are conjecture (law 6)');
  const build = normalizeStatue(input);
  const trace = { style: typeof build.style === 'string' || build.style === undefined ? build.style ?? 'classical' : card.id || 'inline', period: card.period ?? null, ...(card.years ? { years: card.years } : {}),
    material, crop, ...(lose.length ? { lose } : {}), lost: lost.map(baseName).filter((n, i, a) => a.indexOf(n) === i), base, ...(stand === 'seated' ? { stand } : {}), wear, basis: card.basis ?? 'unverified', after: card.after ?? [],
    // the card is drawn from the general record of its type, not from sources read for this kernel: derived work says so
    caption: `inspired by ${(card.after || []).join('; ') || 'the period'}`, laws: build.laws ?? STATUE_LAWS_VERSION, ...(warnings.length ? { warnings } : {}) };
  return { recipe: { ...rest, palette, surfaces: { '*': surface } }, trace };
}

/** The base the read path builds (base.js): its word, and its stone (a metal figure stands on limestone, law 7) */
export function statueBaseOf(input) {
  const { base, material, wear, stand } = statueWords(input), M = STATUE_MATERIALS[material];
  const stone = M.metal ? METAL_BASE_MATERIAL : material === 'painted' ? 'limestone' : material;
  return { kind: base, tone: weatherTone(STATUE_MATERIALS[stone].tone, wear), surface: STATUE_MATERIALS[stone].surface, ...(stand === 'seated' ? { seated: true } : {}) };
}
