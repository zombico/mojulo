/**
 * THE BEAST-KIN ON THE TIERED BODY: a non-human people built on the hero's own game body (polygonizer/tiered-form.js), so
 * a bear-kin has a person's shoulders under its web and cone, bridged elbows and knees, hands and a rig every hero clip
 * plays on, where the sixth generation stood it on the creature biped (egocube/plan.js `biped`). A hero carries it as
 * `beast: { kin, legs?, fingers?, toes?, claws?, tail?, wings?, arms?, head?, cover? }` (the hero door's field), its kin
 * a card (./cards.js); its legs ./legs.js; what its frame adds (the tail, the arm-wings, the second arms) ./topology.js;
 * its head ./head.js; its coat as a material ./cover.js.
 *
 *   beastCard(hero)          → the card a hero's beast stands for, its own words over the kin's, or null
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
import { BEAST_KINS, BEAST_KIN_IDS, BEAST_LEGS, BEAST_CLAWS, BEAST_FINGERS, BEAST_TOES, kinCoat } from './cards.js';
import { scaleRing, trunkCentre } from '../undead/tiered.js';
import { GAITS } from '../polygonizer/hero-gaits.js';
import { BEAST_TAILS, BEAST_WINGS, BEAST_ARMS } from './topology.js';
import { OUTFIT_WORDS, libraryFeet } from '../polygonizer/hero-dress.js';
import { isArmorBuild } from '../armor/expand.js';
import { beastHeadOf, BEAST_HEADS } from './head.js';
import { COVER_KINDS } from './cover.js';

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
// a claw's length and its root's radius, as shares of the digit's tip ring; its point's radius
/** a DIGITIGRADE kin's gaits (the hero's dials over the mint table, hero-motion.js stampHeroMotion): its knee rests bent
 * (some 75°, the hock raised behind it), so a person's stance bend and swing fold, added to it, folded the knee's bridge
 * shut (a jog's 115° swing tuck: the bridge's ring at 0.12 of its rest); the walk's lift and the run's tuck drawn in */
export const DIGITIGRADE_GAIT = Object.freeze({ walk: Object.freeze({ stanceKnee: 0, swingLift: 26 }), sprint: Object.freeze({ stanceKnee: 0, swingTuck: 50 }) });
const CLAW = { blunt: { length: 2.2, root: 0.8, curl: 0.35 }, long: { length: 4, root: 0.85, curl: 0.55 } }, CLAW_POINT = 0.12;

export function beastCard(hero) {
  const B = hero?.beast;
  if (!B || !BEAST_KINS[B.kin]) return null;
  const K = BEAST_KINS[B.kin];
  return { ...K, kin: B.kin, legs: B.legs ?? 'plantigrade', fingers: B.fingers ?? K.fingers, toes: B.toes ?? K.toes, claws: B.claws ?? K.claws };
}

export function beastErrors(spec) {
  const B = spec?.beast;
  if (B === undefined || B === null) return [];
  if (typeof B !== 'object' || Array.isArray(B)) return [`beast: { kin: ${BEAST_KIN_IDS.join(' | ')}, legs?, fingers?, toes?, claws?, tail?, wings?, arms? }`];
  const errs = [], WORDS = ['kin', 'legs', 'fingers', 'toes', 'claws', 'tail', 'wings', 'arms', 'head', 'cover'];
  for (const k of Object.keys(B)) if (!WORDS.includes(k)) errs.push(`beast.${k}: not a word of the beast (${WORDS.join(', ')})`);
  if (!BEAST_KINS[B.kin]) errs.push(`beast.kin: one of ${BEAST_KIN_IDS.join(', ')}`);
  if (B.legs !== undefined && !BEAST_LEGS.includes(B.legs)) errs.push(`beast.legs: ${BEAST_LEGS.join(' | ')}`);
  if (B.fingers !== undefined && !BEAST_FINGERS.includes(B.fingers)) errs.push(`beast.fingers: ${BEAST_FINGERS.join(' | ')} (the thumb among them)`);
  if (B.toes !== undefined && !BEAST_TOES.includes(B.toes)) errs.push(`beast.toes: ${BEAST_TOES.join(' | ')}`);
  if (B.claws !== undefined && !BEAST_CLAWS.includes(B.claws)) errs.push(`beast.claws: ${BEAST_CLAWS.join(' | ')}`);
  if (B.tail !== undefined && !BEAST_TAILS.includes(B.tail)) errs.push(`beast.tail: ${BEAST_TAILS.join(' | ')}`);
  if (B.wings !== undefined && !BEAST_WINGS.includes(B.wings)) errs.push(`beast.wings: ${BEAST_WINGS.join(' | ')} (the flight feathers trailing from the forearm and the hand)`);
  if (B.arms !== undefined && !BEAST_ARMS.includes(B.arms)) errs.push(`beast.arms: ${BEAST_ARMS.join(' | ')} (a second pair under the first)`);
  if (B.cover !== undefined && !COVER_KINDS.includes(B.cover)) errs.push(`beast.cover: ${COVER_KINDS.join(' | ')} (its coat carried as a material: relief, normal, occlusion and height)`);
  if (B.head !== undefined && !BEAST_HEADS.includes(B.head)) errs.push(`beast.head: ${BEAST_HEADS.join(' | ')} (the kin's own by default; 'person' keeps a person's head)`);
  else if (B.head !== undefined && B.head !== 'person' && spec.head !== undefined && spec.head !== 'none') errs.push(`beast.head: '${B.head}' is a beast's head; the hero's head: '${spec.head}' is a person's — name one (head: 'none' under a beast's, or beast.head: 'person')`);
  // (a paw on a raised hock takes nothing cut for a person's foot: a shoe was drawn over the metatarsus, an armour
  // build's sabatons refused its missing toes by a part's name)
  if (B.legs === 'digitigrade') {
    const words = (Array.isArray(spec.outfit) ? spec.outfit : [spec.outfit]).filter((w) => typeof w === 'string');
    const shod = words.filter((w) => libraryFeet([w]).length || (OUTFIT_WORDS[w]?.({ scale: 1, structured: true }) ?? []).some((piece) => piece.part === 'foot'));
    if (shod.length) errs.push(`outfit: ${shod.join(', ')} fits a person's foot; a digitigrade beast-kin stands on a paw on a raised hock, which wears no footwear yet`);
    if (isArmorBuild(spec.adorn)) errs.push("adorn: an armour build's greaves and sabatons are cut for a person's leg and foot; a digitigrade beast-kin wears no armour build yet");
  }
  if ((spec.form ?? 'tiered') !== 'tiered') errs.push("beast: the beast-kin stand on the tiered body (form: 'tiered')");
  if (spec.undead !== undefined && spec.undead !== null) errs.push('beast: a body is a beast-kin or undead, not both');
  return errs;
}

// the hero's gaits as the kin walks them: the walk always (tilted by the hunch), a digitigrade kin's every walk and run
// with its knee dials; the operator's own dials over them
function beastMotion(motion, card) {
  const own = (g) => (g && typeof g === 'object' ? g : {}), digi = card.legs === 'digitigrade';
  const out = { ...(motion ?? {}), walk: { ...(card.rest.hunch > 0 ? { tilt: Math.min(35, card.rest.hunch) } : {}), ...(digi ? DIGITIGRADE_GAIT.walk : {}), ...own(motion?.walk) } };
  if (digi) for (const [name, g] of Object.entries(out)) { const M = GAITS[name]?.motion; if (name !== 'walk' && M && g) out[name] = { ...DIGITIGRADE_GAIT[M], ...own(g) }; }
  return out;
}

/** the rest the card stands in, as the hero's pose words: the hunch a hinge over the hips, the knees given, the arms hung
 * a little forward and out, the neck and the head lifted back against the hunch so the eyes look ahead */
export function beastRest(card) {
  const { hunch, crouch, arm } = card.rest;
  return { hinge: hunch, crouch, armR: { ...arm }, armL: { ...arm, x: -arm.x }, elbowR: 'slight', elbowL: 'slight', neck: { pitch: r3(hunch * 0.3) }, head: { yaw: 0, pitch: r3(hunch * 0.35) } };
}

export function beastWords(hero) {
  const card = beastCard(hero);
  if (!card) return hero;
  const coat = hero.palette?.Skin ?? kinCoat(card.kin), G = beastRest(card), worn = beastHeadOf(hero);
  const idle = [{ ...G }, { ...G, crouch: r3(Math.min(1, G.crouch + 0.04)), head: { ...G.head, pitch: r3(G.head.pitch * 0.8) } }];
  return {
    // (a beast's own head in place of a person's: the hero's head none, so no hair or face words; a person's head bald)
    ...hero, ...(worn ? (hero.head === undefined ? { head: 'none' } : {}) : { hair: hero.hair ?? 'none' }), detail: hero.detail ?? 'none',
    // (one coat over every group the body is painted in: its skin, the top and bottom its clothes would be, its feet, the
    // brows the landmark head builds; the claws their own)
    palette: { Top: coat, Bottom: coat, Shoes: coat, Hair: coat, Brow: coat, Claws: card.claw, ...(hero.palette ?? {}), Skin: coat },
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

export function beastFlesh(plan, hero) {
  const card = beastCard(hero);
  if (!card) return plan;
  const M = card.mass, torso = plan.segments.find((s) => s.name === 'torso' && s.kind === 'trunk');
  // the trunk's scale at height z: the card's trunk, the waist's swell on it centred on the waist (the torso's narrowest
  // section), falling off up the chest over WAIST_SPAN and down to nothing by the hip joint, so a barrel rounds and a
  // wasp's waist pinches without a shelf, and the seat stands behind the lower back as the person's does
  const top = plan.joints?.headBase?.[2] ?? 1.6, hip = plan.joints?.hip?.[2] ?? 0.9, span = WAIST_SPAN * (top / 1.6);
  const zw = torso ? torso.stations.reduce((b, st) => (rOf(st.r) < rOf(b.r) && st.z < (top + hip) / 2 ? st : b), torso.stations[0]).z : 1;
  const kAt = (z) => M.trunk * (1 + (M.waist - 1) * Math.exp(-(((z - zw) / (z >= zw ? span : Math.max(1e-3, (zw - hip) / 2))) ** 2)));
  const segments = plan.segments.map((s) => {
    // (a barrel's depth swells forward: its back held where the trunk's scale puts it, the centre brought forward, so the
    // lower back never stands out past the seat; a pinch draws in all round)
    if ((s.name === 'torso' || s.name === 'pelvis') && s.kind === 'trunk') return { ...s, stations: s.stations.map((st) => {
      const k = kAt(st.z); if (k <= M.trunk || !Array.isArray(st.r)) return { ...st, r: scaleR(st.r, k) };
      const back = st.r[1] * M.trunk, deep = st.r[1] * k;
      return { ...st, r: [r6(st.r[0] * k), r6(deep)], yc: r6((st.yc ?? 0) + deep - back) };
    }) };
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
