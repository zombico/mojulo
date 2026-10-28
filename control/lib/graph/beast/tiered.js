/**
 * THE BEAST-KIN ON THE TIERED BODY: a non-human people built on the hero's own game body (polygonizer/tiered-form.js), so
 * a bear-kin has a person's shoulders under its web and cone, bridged elbows and knees, hands and a rig every hero clip
 * plays on, where the sixth generation stood it on the creature biped (egocube/plan.js `biped`). A hero carries it as
 * `beast: { kin?, legs?, toes?, fingers?, claws?, clawTone?, arms?, wings?, tail?, abdomen?, mass?, hump?, keel?, hunch?, head?, cover?,
 * coat?, hair?, ridge?, ruff?, expression? }` (the hero door's field): its anatomy, each word over its kin's preset and the
 * neutral base (./cards.js), a beast with no kin its words alone; its legs ./legs.js; what its frame adds (the tail, the arm-wings, the second arms) ./topology.js;
 * its head ./head.js; its coat as a material ./cover.js; its detail as form (spines, a ruff) ./detail.js.
 *
 *   beastCard(hero)          → the anatomy a hero's beast resolves to: the base, its kin's preset over it, its own words
 *                              over both; null absent a beast (or a kin the presets do not hold)
 *   beastWords(spec)         → the hero's words for its kin, under the spec's own (the hero door records them at mint,
 *                              layered.js heroRecord, so an edit reaches them): bald, the body bare in its coat (one tone
 *                              over every group the body is painted in, the feet bare), its rest as the hero's gesture,
 *                              its idle breathing in it and its walk keeping the hunch
 *   beastFlesh(plan, hero)   → the hero's plan, before the tiered passes (so the joints' bridges and the shoulders' balls
 *                              are built on the body as it now is), each part family at the card's girth, the trunk's
 *                              waist a barrel or a wasp's by a smooth swell centred on it
 *   beastHands(plan, hero)   → the plan with the fingers the card keeps (the outer ones go, the rig whole, so every clip
 *                              still plays) and a hooked claw out of each digit's tip, fingers and toes, riding its last
 *                              bone; after the tiered passes
 *   beastErrors(spec)        → what the door refuses, as words
 *
 * Absent `beast`, every function returns what it was given. FORM ONLY: the head is the hero's (a beast's head on the
 * tiered neck is its own step), the coat one tone; cover (fur, scales, chitin) is the material's, not cards. Pure.
 */
import { BEAST_KINS, BEAST_KIN_IDS, BEAST_BASE, BEAST_COATS, BEAST_LEGS, BEAST_CLAWS, BEAST_FINGERS, BEAST_TOES, kinCoat } from './cards.js';
import { scaleRing, trunkCentre } from '../undead/tiered.js';
import { GAITS } from '../polygonizer/hero-gaits.js';
import { PALETTE as HERO_PALETTE } from '../polygonizer/hero-form.js';
import { BEAST_TAILS, BEAST_WINGS, BEAST_ARMS, BEAST_ABDOMENS } from './topology.js';
import { BEAST_RIDGES, BEAST_RUFFS } from './detail.js';
import { OUTFIT_WORDS, libraryFeet } from '../polygonizer/hero-dress.js';
import { isArmorBuild } from '../armor/expand.js';
import { beastHeadOf, BEAST_HEADS, isDesigned, designedHeadErrors } from './head.js';
import { coverErrors, coverQualities } from './cover.js';
import { beastOozeOf } from './ooze.js';
import { colorWords, COLOR_WORDS } from '../mutagen/push.js';
import { oozeErrors } from '../mutagen/compose.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scaleR = (r, s) => (Array.isArray(r) ? r.map((x) => r6(x * s)) : r6(r * s));
const rOf = (r) => (Array.isArray(r) ? r[0] : r);
const centre = (points) => { const P = Object.values(points); return [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length); };

/** the digits a hand keeps by the card's count, the thumb always (a weapon's grip is the thumb's), the outer ones go first */
export const KEPT_FINGERS = Object.freeze({ 3: ['thumb', 'index', 'middle'], 4: ['thumb', 'index', 'middle', 'ring'], 5: ['thumb', 'index', 'middle', 'ring', 'little'] });
const FINGERS = KEPT_FINGERS[5];
const TOES = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'];
// the waist's swell: its half span up and down the trunk, metres at a 1.8 m hero
const WAIST_SPAN = 0.17;
/** the hump (a card's `hump`, 0 … 1, at its full): its centre over the shoulder joint and its half height (metres at a
 * 1.6 m trunk top), the depth it adds behind and the width it adds across, of the station's own; at the neck's root, the
 * trapezius' place (one at the shoulder blades folded the back in a sprint, the arm's cone swung into it) */
const HUMP = Object.freeze({ over: 0.09, span: 0.05, depth: 0.7, width: 0.06 });
/** the keel (a card's `keel`, 0 … 1): its centre under the shoulder joint and its half height (metres at a 1.6 m trunk
 * top), the depth it adds in front, of the station's own; long, a prow from the throat to the belly (a short one read
 * as a bust in profile) */
const KEEL = Object.freeze({ under: 0.17, span: 0.17, depth: 0.32 });
/** the hips' own mass (`mass.hips`): its centre over the hip joint and its half height (metres at a 1.6 m trunk top) */
const HIPS = Object.freeze({ over: 0.04, span: 0.12 });
// a claw's length and its root's radius, as shares of the digit's tip ring; its point's radius
/** a DIGITIGRADE kin's gaits (the hero's dials over the mint table, hero-motion.js stampHeroMotion): its knee rests bent
 * (some 75°, the hock raised behind it), so a person's stance bend and swing fold, added to it, folded the knee's bridge
 * shut (a jog's 115° swing tuck: the bridge's ring at 0.12 of its rest); the walk's lift and the run's tuck drawn in */
export const DIGITIGRADE_GAIT = Object.freeze({ walk: Object.freeze({ stanceKnee: 0, swingLift: 26 }), sprint: Object.freeze({ stanceKnee: 0, swingTuck: 50 }) });
/** a coil's gaits (./serpent.js): the hips held at their height, a person's run lowering and driving them (its knee's
 * bend, its flight, its lean, a long stride's vault) squeezed the coil's upright length into a kink; the walk's stride stands
 * (the ground speed's), the run's is half a sprinter's */
export const SERPENT_GAIT = Object.freeze({ walk: Object.freeze({ stanceKnee: 0, swingLift: 0 }),
  sprint: Object.freeze({ strideLength: 0.32, stanceKnee: 0, swingTuck: 0, hipDrive: 0, flightLift: 0, lean: 0.12, spineGive: 0 }) });
const CLAW = { blunt: { length: 2.2, root: 0.8, curl: 0.35 }, long: { length: 4, root: 0.85, curl: 0.55 } }, CLAW_POINT = 0.12;

const colourWordsOf = (L, coat) => {
  const W = colorWords(coat), word = (c) => (COLOR_WORDS.includes(c) ? W[c] : c);
  return { ...L, ...(L.claw ? { claw: { ...L.claw, color: word(L.claw.color) } } : {}), ...(L.spines ? { spines: { ...L.spines, color: word(L.spines.color) } } : {}),
    ...(L.eyes ? { eyes: { ...L.eyes, color: word(L.eyes.color) } } : {}), groups: Object.fromEntries(Object.entries(L.groups).map(([g, v]) => [g, { ...v, color: word(v.color) }])),
    push: L.push.tints ? { ...L.push, tints: L.push.tints.map((t) => ({ ...t, color: word(t.color), ...(t.lightColor ? { lightColor: word(t.lightColor) } : {}) })) } : L.push };
};

export function beastCard(hero) {
  const B = hero?.beast;
  if (!isPlain(B) || (B.kin !== undefined && !BEAST_KINS[B.kin])) return null;
  // (the neutral base, the kin's preset over it, the hero's own words over both: a beast with no kin is its words alone)
  const K = { ...BEAST_BASE, ...(B.kin !== undefined ? BEAST_KINS[B.kin] : {}) }, own = (k) => B[k] ?? K[k];
  // (an OOZE over all of it, the animal door's compositions lowered onto the anatomy (./ooze.js): it grows the masses, adds
  // a crest or a ruff, styles the cover and tones the claws; a word the hero names itself stands)
  // (an ooze's colour words, the coat's own: mutagen/push.js colorWords, against the hero's coat or its kin's)
  const L0 = beastOozeOf(B), L = L0 && colourWordsOf(L0, hero.palette?.Skin ?? kinCoat(B.kin)), cover = isPlain(B.cover) ? B.cover.kind : B.cover ?? (L?.smooth ? 'none' : K.cover);
  const mass = { ...K.mass, ...(B.mass ?? {}) };
  if (L) for (const [k, v] of Object.entries(L.mass)) mass[k] = Math.min(2, Math.max(0.5, Math.round((mass[k] ?? 1) * v * 1000) / 1000));
  return { ...K, kin: B.kin, legs: own('legs'), fingers: own('fingers'), toes: own('toes'), claws: own('claws'), claw: B.clawTone ?? L?.claw?.color ?? K.claw,
    tail: own('tail'), abdomen: own('abdomen'), ridge: B.ridge ?? (L?.ridge ? 'spines' : K.ridge), ruff: B.ruff ?? (L?.ruff ? 'ruff' : K.ruff), hair: own('hair'),
    // (its cover a kind, or a kind with its qualities: cover.js COVER_STYLE; an ooze's qualities under its own)
    cover, coverStyle: { ...(L && cover !== 'none' ? coverQualities(cover, L.cover) : {}), ...(isPlain(B.cover) ? (({ kind: _k, ...q }) => q)(B.cover) : {}) },
    coat: BEAST_COATS[own('coat')] ?? null, rest: B.hunch !== undefined ? { ...K.rest, hunch: B.hunch } : K.rest,
    // (its masses DESIGNED: the operator's or the sheet's girths over the card's, its hump and keel its own)
    mass, hump: own('hump'), keel: own('keel'), ...(L ? { ooze: L } : {}) };
}

/** the beast's words, each a part of its anatomy (cards.js names the principle behind each) */
export const BEAST_WORDS = Object.freeze(['kin', 'legs', 'fingers', 'toes', 'claws', 'clawTone', 'tail', 'abdomen', 'wings', 'arms', 'ridge', 'ruff', 'head', 'hair', 'cover', 'coat', 'expression', 'mass', 'hump', 'keel', 'hunch', 'ooze', 'seed']);
/** the hunch's range, degrees the trunk hinges forward over the hips (the walk's tilt is capped there too) */
export const BEAST_HUNCH = 35;

export function beastErrors(spec) {
  const B = spec?.beast;
  if (B === undefined || B === null) return [];
  if (!isPlain(B)) return [`beast: { kin?: ${BEAST_KIN_IDS.join(' | ')}, ${BEAST_WORDS.slice(1).map((w) => `${w}?`).join(', ')} } (a kin is a preset; every word stands over it)`];
  const errs = [], WORDS = BEAST_WORDS, preset = BEAST_KINS[B.kin] ?? {}, word = (k) => B[k] ?? preset[k] ?? BEAST_BASE[k];
  for (const k of Object.keys(B)) if (!WORDS.includes(k)) errs.push(`beast.${k}: not a word of the beast (${WORDS.join(', ')})`);
  if (B.kin !== undefined && !BEAST_KINS[B.kin]) errs.push(`beast.kin: one of ${BEAST_KIN_IDS.join(', ')} (a preset; none: the beast its words alone)`);
  if (B.legs !== undefined && !BEAST_LEGS.includes(B.legs)) errs.push(`beast.legs: ${BEAST_LEGS.join(' | ')}`);
  if (B.fingers !== undefined && !BEAST_FINGERS.includes(B.fingers)) errs.push(`beast.fingers: ${BEAST_FINGERS.join(' | ')} (the thumb among them)`);
  if (B.toes !== undefined && !BEAST_TOES.includes(B.toes)) errs.push(`beast.toes: ${BEAST_TOES.join(' | ')}`);
  if (B.claws !== undefined && !BEAST_CLAWS.includes(B.claws)) errs.push(`beast.claws: ${BEAST_CLAWS.join(' | ')}`);
  if (B.tail !== undefined && !BEAST_TAILS.includes(B.tail)) errs.push(`beast.tail: ${BEAST_TAILS.join(' | ')}`);
  if (B.wings !== undefined && !BEAST_WINGS.includes(B.wings)) errs.push(`beast.wings: ${BEAST_WINGS.join(' | ')} (the flight feathers trailing from the forearm and the hand)`);
  if (B.arms !== undefined && !BEAST_ARMS.includes(B.arms)) errs.push(`beast.arms: ${BEAST_ARMS.join(' | ')} (a second pair under the first)`);
  if (B.abdomen !== undefined && !BEAST_ABDOMENS.includes(B.abdomen)) errs.push(`beast.abdomen: ${BEAST_ABDOMENS.join(' | ')} (an insect's, on the tail's bones)`);
  else if (word('abdomen') !== 'none' && word('tail') !== 'none') errs.push("beast.abdomen: an abdomen rides the tail's bones; a kin carries a tail or an abdomen (tail: 'none', or abdomen: 'none')");
  if (B.ridge !== undefined && !BEAST_RIDGES.includes(B.ridge)) errs.push(`beast.ridge: ${BEAST_RIDGES.join(' | ')} (a crest of spines down the back and the tail)`);
  if (B.ruff !== undefined && !BEAST_RUFFS.includes(B.ruff)) errs.push(`beast.ruff: ${BEAST_RUFFS.join(' | ')} (heavy tufts round the neck's root)`);
  if (B.mass !== undefined) {
    if (!B.mass || typeof B.mass !== 'object' || Array.isArray(B.mass)) errs.push(`beast.mass: { ${BEAST_MASS_KEYS.join(', ')} }, each a girth against a person's (0.5 … 2)`);
    else for (const [k, v] of Object.entries(B.mass)) if (!BEAST_MASS_KEYS.includes(k)) errs.push(`beast.mass.${k}: not a mass of the beast (${BEAST_MASS_KEYS.join(', ')})`); else if (!(Number.isFinite(v) && v >= 0.5 && v <= 2)) errs.push(`beast.mass.${k}: a girth against a person's, 0.5 … 2`);
  }
  if (B.clawTone !== undefined && !(typeof B.clawTone === 'string' && /^#[0-9a-f]{6}$/i.test(B.clawTone))) errs.push('beast.clawTone: the claws\' tone, a #rrggbb colour');
  if (B.hair !== undefined && typeof B.hair !== 'boolean') errs.push('beast.hair: true when its head keeps a person\'s hair (false: bald under its coat)');
  if (B.coat !== undefined && !Object.keys(BEAST_COATS).includes(B.coat)) errs.push(`beast.coat: ${Object.keys(BEAST_COATS).join(' | ')} (where its coat lies: the whole bare body, or below the waist only)`);
  if (B.hunch !== undefined && !(Number.isFinite(B.hunch) && B.hunch >= 0 && B.hunch <= BEAST_HUNCH)) errs.push(`beast.hunch: 0 … ${BEAST_HUNCH}, degrees the trunk hinges forward over the hips`);
  for (const k of ['hump', 'keel']) if (B[k] !== undefined && !(Number.isFinite(B[k]) && B[k] >= 0 && B[k] <= 1)) errs.push(`beast.${k}: 0 … 1 (the ${k === 'hump' ? 'upper back\'s mass under the neck' : 'chest\'s front swelling forward'})`);
  if (B.expression !== undefined && !(B.expression && typeof B.expression === 'object' && !Array.isArray(B.expression) && Object.values(B.expression).every((v) => Number.isFinite(v) && v >= -1 && v <= 1))) errs.push("beast.expression: the library head's expression controls, each −1 … 1 ({ browRaise, browFurrow, sneer, earAttitude, lidClose, cornerRetract … }: station-loft-head.js)");
  errs.push(...coverErrors(B.cover), ...oozeErrors(B.ooze, 'beast.ooze'));
  if (B.seed !== undefined && !(Number.isInteger(B.seed) && B.seed >= 0)) errs.push('beast.seed: a non-negative integer (it places its oozes\' dice)');
  if (isDesigned(B.head)) errs.push(...designedHeadErrors(B.head));
  else if (B.head !== undefined && !BEAST_HEADS.includes(B.head)) errs.push(`beast.head: ${BEAST_HEADS.join(' | ')}, or a head designed from one ({ from, moves?, eye?, regions?, ornaments?, palette? }: creature-heads/derive.js) (the kin's own by default; 'person' keeps a person's head)`);
  if (B.head !== undefined && B.head !== 'person' && spec.head !== undefined && spec.head !== 'none') errs.push(`beast.head: '${isDesigned(B.head) ? `designed from ${B.head.from}` : B.head}' is a beast's head; the hero's head: '${spec.head}' is a person's — name one (head: 'none' under a beast's, or beast.head: 'person')`);
  // (a paw on a raised hock takes nothing cut for a person's foot: a shoe was drawn over the metatarsus, an armour
  // build's sabatons refused its missing toes by a part's name)
  const legs = word('legs');
  if (legs === 'digitigrade') {
    const words = (Array.isArray(spec.outfit) ? spec.outfit : [spec.outfit]).filter((w) => typeof w === 'string');
    const shod = words.filter((w) => libraryFeet([w]).length || (OUTFIT_WORDS[w]?.({ scale: 1, structured: true }) ?? []).some((piece) => piece.part === 'foot'));
    if (shod.length) errs.push(`outfit: ${shod.join(', ')} fits a person's foot; a digitigrade beast-kin stands on a paw on a raised hock, which wears no footwear yet`);
    if (isArmorBuild(spec.adorn)) errs.push("adorn: an armour build's greaves and sabatons are cut for a person's leg and foot; a digitigrade beast-kin wears no armour build yet");
  }
  // (a coil takes nothing cut for legs: no trousers, no footwear, no greaves)
  if (legs === 'serpent') {
    const words = (Array.isArray(spec.outfit) ? spec.outfit : [spec.outfit]).filter((w) => typeof w === 'string');
    const legged = words.filter((w) => libraryFeet([w]).length || (OUTFIT_WORDS[w]?.({ scale: 1, structured: true }) ?? []).some((piece) => /^(thigh|shank|foot|knee|hip)/.test(piece.part ?? '')));
    if (legged.length) errs.push(`outfit: ${legged.join(', ')} dresses a person's legs; a snake-kin stands on a coil, which wears none`);
    if (isArmorBuild(spec.adorn)) errs.push("adorn: an armour build's greaves and sabatons are cut for a person's legs; a snake-kin wears no armour build yet");
  }
  if ((spec.form ?? 'tiered') !== 'tiered') errs.push("beast: the beast-kin stand on the tiered body (form: 'tiered')");
  if (spec.undead !== undefined && spec.undead !== null) errs.push('beast: a body is a beast-kin or undead, not both');
  return errs;
}

// the hero's gaits as the kin walks them: the walk always (tilted by the hunch), a digitigrade kin's every walk and run
// with its knee dials; the operator's own dials over them
function beastMotion(motion, card) {
  const own = (g) => (g && typeof g === 'object' ? g : {}), D = card.legs === 'digitigrade' ? DIGITIGRADE_GAIT : card.legs === 'serpent' ? SERPENT_GAIT : null;
  const out = { ...(motion ?? {}), walk: { ...(card.rest.hunch > 0 ? { tilt: Math.min(BEAST_HUNCH, card.rest.hunch) } : {}), ...(D ? D.walk : {}), ...own(motion?.walk) } };
  if (D) for (const [name, g] of Object.entries(out)) { const M = GAITS[name]?.motion; if (name !== 'walk' && M && g) out[name] = { ...D[M], ...own(g) }; }
  return out;
}

/** the rest the card stands in, as the hero's pose words: the hunch a hinge over the hips, the knees given, the arms hung
 * a little forward and out, the neck and the head lifted back against the hunch so the eyes look ahead */
export function beastRest(card) {
  const { hunch, crouch, arm } = card.rest;
  return { hinge: hunch, crouch, armR: { ...arm }, armL: { ...arm, x: -arm.x }, elbowR: 'slight', elbowL: 'slight', neck: { pitch: r3(hunch * 0.3) }, head: { yaw: 0, pitch: r3(hunch * 0.35) } };
}

/** the masses a card names and a beast may design (cards.js `mass`) */
export const BEAST_MASS_KEYS = Object.freeze(['trunk', 'waist', 'hips', 'neck', 'upperArm', 'foreArm', 'hand', 'thigh', 'shank', 'foot']);
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function beastWords(hero) {
  const card = beastCard(hero);
  if (!card) return hero;
  const coat = (card.coat ? hero.palette?.[card.coat[0]] : hero.palette?.Skin) ?? kinCoat(card.kin), G = beastRest(card), worn = beastHeadOf(hero);
  const idle = [{ ...G }, { ...G, crouch: r3(Math.min(1, G.crouch + 0.04)), head: { ...G.head, pitch: r3(G.head.pitch * 0.8) } }];
  return {
    // (a beast's own head in place of a person's: the hero's head none, so no hair or face words; a person's head bald)
    ...hero, ...(worn ? (hero.head === undefined ? { head: 'none' } : {}) : card.hair ? {} : { hair: hero.hair ?? 'none' }), detail: hero.detail ?? 'none',
    // (one coat over every group the body is painted in: its skin, the top and bottom its clothes would be, its feet, the
    // brows the landmark head builds; the claws their own)
    // (a kin whose coat is its own groups' only, the lamia's, keeps a person's skin and hair over them)
    // (bare above its coat: its top the skin it has, the cast's when it names none)
    palette: card.coat ? { Top: hero.palette?.Skin ?? HERO_PALETTE.Skin, ...Object.fromEntries(card.coat.map((g) => [g, coat])), Claws: card.claw, ...(hero.palette ?? {}) }
      : { Top: coat, Bottom: coat, Shoes: coat, Hair: coat, Brow: coat, Claws: card.claw, ...(hero.palette ?? {}), Skin: coat },
    // (the kin's frame as tune words under the operator's: a tune of its own words over them; a move or a list is the
    // operator's whole tune and stands as given)
    ...(hero.tune === undefined || isPlain(hero.tune) ? { tune: { ...(card.frame ?? {}), ...(hero.tune ?? {}) } } : {}),
    gesture: hero.gesture ?? G,
    clips: { idle, ...(hero.clips ?? {}) },
    motion: beastMotion(hero.motion, card),
  };
}

// a part family by its name: the side's letter off, a toe or a finger by what it is
const familyOf = (name) => {
  const n = name.replace(/[RL]$/, '');
  if (FINGERS.includes(n) || n === 'hand') return 'hand';
  if (TOES.includes(n) || n === 'foot' || n === 'toes') return 'foot';
  return n;
};
const LIMBS = new Set(['upperArm', 'foreArm', 'hand', 'thigh', 'shank', 'foot']);

export function beastFlesh(plan, hero, card = beastCard(hero)) {
  if (!card) return plan;
  const M = card.mass, torso = plan.segments.find((s) => s.name === 'torso' && s.kind === 'trunk');
  // the trunk's scale at height z: the card's trunk, the waist's swell on it centred on the waist (the torso's narrowest
  // section), falling off up the chest over WAIST_SPAN and down to nothing by the hip joint, so a barrel rounds and a
  // wasp's waist pinches without a shelf, and the seat stands behind the lower back as the person's does
  const top = plan.joints?.headBase?.[2] ?? 1.6, hip = plan.joints?.hip?.[2] ?? 0.9, span = WAIST_SPAN * (top / 1.6);
  const zw = torso ? torso.stations.reduce((b, st) => (rOf(st.r) < rOf(b.r) && st.z < (top + hip) / 2 ? st : b), torso.stations[0]).z : 1;
  // (and the hips' own on it, `mass.hips`: the pelvis and the belly over it full, fading out up to the waist)
  const kAt = (z) => M.trunk * (1 + (M.waist - 1) * Math.exp(-(((z - zw) / (z >= zw ? span : Math.max(1e-3, (zw - hip) / 2))) ** 2))
    + ((M.hips ?? 1) - 1) * Math.exp(-(((z - hip - HIPS.over * (top / 1.6)) / (HIPS.span * (top / 1.6))) ** 2)));
  // THE HUMP: the back of the trunk under the neck swelling out behind, its front held (the centre taken back by what the
  // depth gains), and the slope to the neck filling across, about a height just over the shoulder joint
  const hump = card.hump ?? 0, sh = plan.joints?.shoulder?.[2] ?? (hip + 0.75 * (top - hip)), sc = top / 1.6;
  const zh = sh + HUMP.over * sc, hg = (z) => Math.exp(-(((z - zh) / (HUMP.span * sc)) ** 2));
  const humped = (st) => {
    const g = hump * hg(st.z); if (g < 1e-4 || !Array.isArray(st.r)) return st;
    const gain = st.r[1] * HUMP.depth * g;
    return { ...st, r: [r6(st.r[0] * (1 + HUMP.width * g)), r6(st.r[1] + gain)], yc: r6((st.yc ?? 0) - gain) };
  };
  // THE KEEL: the chest's front swelling forward about the breastbone's height under the shoulder, its back held
  const keel = card.keel ?? 0, zk = sh - KEEL.under * sc, kg = (z) => Math.exp(-(((z - zk) / (KEEL.span * sc)) ** 2));
  const keeled = (st) => {
    const g = keel * kg(st.z); if (g < 1e-4 || !Array.isArray(st.r)) return st;
    const gain = st.r[1] * KEEL.depth * g;
    return { ...st, r: [st.r[0], r6(st.r[1] + gain)], yc: r6((st.yc ?? 0) + gain) };
  };
  const segments = plan.segments.map((s) => {
    // (a barrel's depth swells forward: its back held where the trunk's scale puts it, the centre brought forward, so the
    // lower back never stands out past the seat; a pinch draws in all round)
    if ((s.name === 'torso' || s.name === 'pelvis') && s.kind === 'trunk') return { ...s, stations: s.stations.map((st) => {
      const k = kAt(st.z); if (k <= M.trunk || !Array.isArray(st.r)) return { ...st, r: scaleR(st.r, k) };
      const back = st.r[1] * M.trunk, deep = st.r[1] * k;
      return { ...st, r: [r6(st.r[0] * k), r6(deep)], yc: r6((st.yc ?? 0) + deep - back) };
    }).map((st) => (s.name === 'torso' ? keeled(humped(st)) : st)) };
    if (s.name === 'neck') return s.kind === 'loft' ? { ...s, stations: s.stations.map((st) => ({ ...st, r: scaleR(st.r, M.neck) })) } : { ...s, rA: scaleR(s.rA, M.neck), rB: scaleR(s.rB, M.neck) };
    const fam = familyOf(s.name);
    // (the chest's rings thin or swell about the trunk they lie on, so they stay on it)
    if (s.kind === 'rings' && torso && !LIMBS.has(fam)) return { ...s, stations: s.stations.map((st) => { const z = centre(st.points)[2]; return { ...st, points: scaleRing(st.points, kAt(z), trunkCentre(torso, z)) }; }) };
    const k = LIMBS.has(fam) ? M[fam] : null;
    if (!k || k === 1) return s;
    if (s.kind === 'segment') return { ...s, rA: scaleR(s.rA, k), rB: scaleR(s.rB, k), ...(s.rMid ? { rMid: scaleR(s.rMid, k) } : {}), ...(s.shape ? { shape: s.shape.map((x) => ({ ...x, r: scaleR(x.r, k) })) } : {}) };
    if (s.kind === 'loft') return { ...s, stations: s.stations.map((st) => ({ ...st, r: scaleR(st.r, k) })) };
    if (s.kind === 'rings') return { ...s, stations: s.stations.map((st) => ({ ...st, points: scaleRing(st.points, k) })) };
    return s;
  });
  return { ...plan, segments };
}

// a hooked claw out of a digit's tip: a loft from inside the tip cap, along the digit, curling toward `curlTo`
function clawOf(digit, bone, curlTo, how, groupTone) {
  const last = digit.stations[digit.stations.length - 1].points, c = centre(last), tip = digit.caps?.tip ?? c;
  const r = Math.max(...Object.values(last).map((p) => Math.hypot(...sub(p, c)))), u = unit(sub(tip, c)), n = unit(sub(curlTo, mul(u, curlTo[0] * u[0] + curlTo[1] * u[1] + curlTo[2] * u[2])));
  const L = how.length * r, root = add(tip, mul(u, -0.6 * r));
  const mid = add(add(tip, mul(u, L * 0.45)), mul(n, L * how.curl * 0.25)), end = add(add(tip, mul(u, L * 0.85)), mul(n, L * how.curl));
  return { name: `${digit.name.replace(/R$/, '')}ClawR`, kind: 'loft', slots: 'limb6', mirror: 'name', group: 'Claws', tint: groupTone,
    stations: [{ at: root.map(r6), r: r6(how.root * r) }, { at: tip.map(r6), r: r6(how.root * r * 0.85) }, { at: mid.map(r6), r: r6(how.root * r * 0.5) }, { at: end.map(r6), r: r6(CLAW_POINT * r) }],
    bind: bone };
}

export function beastHands(plan, hero) {
  const card = beastCard(hero);
  if (!card) return plan;
  const keep = new Set(KEPT_FINGERS[card.fingers]), gone = new Set(FINGERS.filter((f) => !keep.has(f)));
  const cut = (name) => gone.has(name.replace(/(\$S|[RL])$/, ''));
  let segments = plan.segments.filter((s) => !cut(s.name));
  const dials = Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: d.parts.filter((p) => !cut(p)) } : d]));
  if (card.claws !== 'none') {
    const how = CLAW[card.claws], by = Object.fromEntries(segments.map((s) => [s.name, s])), RJ = plan.rig?.joints ?? {};
    const at = (n) => RJ[`${n}$S`]?.at ?? RJ[`${n}R`]?.at;
    // the palm's side: across the knuckles × along the middle finger, turned to face the body's midline (a hand at rest
    // hangs palm in), so a claw hooks the way the fingers close
    const a = at('indexMcp') && at('littleMcp') ? sub(at('indexMcp'), at('littleMcp')) : [0, 1, 0], d = at('middleTip') && at('middleMcp') ? sub(at('middleTip'), at('middleMcp')) : [0, 0, -1];
    let palm = unit(cross(a, d)); if (palm[0] > 0) palm = mul(palm, -1);
    const claws = [];
    for (const f of KEPT_FINGERS[card.fingers]) if (by[`${f}R`]?.stations) claws.push(clawOf(by[`${f}R`], `${f}3R`, palm, how, card.claw));
    for (const t of TOES) if (by[`${t}R`]?.stations) claws.push(clawOf(by[`${t}R`], 'toesR', [0, 0, -1], how, card.claw));
    segments = [...segments, ...claws];
    // (the claws ride the dials their digits do: the bulk with the hands, the stance with the feet, the lean with the arms)
    for (const d of Object.values(dials)) if (Array.isArray(d.parts)) {
      if (d.parts.includes('index$S')) d.parts = [...d.parts, ...KEPT_FINGERS[card.fingers].map((f) => `${f}Claw$S`)];
      if (d.parts.includes('foot$S')) d.parts = [...d.parts, ...TOES.filter((t) => by[`${t}R`]?.stations).map((t) => `${t}Claw$S`)];
    }
  }
  return { ...plan, segments, dials, palette: { ...(plan.palette ?? {}), Claws: plan.palette?.Claws ?? card.claw } };
}
