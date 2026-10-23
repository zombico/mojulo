/**
 * FEEL → THE GAME — a gameworld's `feel` names one of the action lab's templates (cards.js POLES), and its hero moves
 * by that template's card. The card is LOWERED into the rule the controllable runtime already plays (rules-platform.js:
 * the platform rule; combat-melee.js: the strike), laid over the hero's own (playscape/player.js), and what the runtime
 * does not carry yet is SAID, never dropped silently: the report is advice, as an intent's target is (intent.js).
 *
 *   feel: '<pole>' | { pole, variant?, toward?, t?, set? }
 *     pole     a template (POLE_IDS)
 *     variant  one of its variants (variantsOf), its first by default
 *     toward   a second template to tune toward, `t` how far (0 … 1, 0.5 when only `toward` is named)
 *     set      the card's own fields laid over the template's (objects merge, anything else replaces)
 *
 *   readFeel(v)       → the feel checked ({ pole, variant?, toward?, t?, set? }); throws, teaching
 *   feelCard(feel)    → the card the feel makes
 *   lowerFeel(card, { gear? })   → { rule, lane, carried: [field], partly: [{ field, why }], lost: [{ field, why }] }
 *                       `rule` the platform rule's fields (speed, accel, decel, faceRate, jumpSpeed, gravity,
 *                       fallGravity, maxFall, coyote, buffer, jumpCut, airControl, jumpWindup, airJumps, airJumpMult,
 *                       strikeContact, combo); `lane` the card holds the hero to a line (the level's own); `gear` the
 *                       template's worn gear (the glider or the jetpack), said when it names one
 *   feelReport(feel)  → { pole, name, after, variant?, toward?, t?, view, carried, partly, lost } the readout's
 *
 * Units: the card's frames at 60 fps become the runtime's seconds; its metres and m/s are the runtime's units. Pure.
 */
import { FPS, r4, POLES, POLE_IDS, variantsOf, poleCard, blendPoles, mergeDeep } from './cards.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const FEEL_KEYS = ['pole', 'variant', 'toward', 't', 'set'];
const fail = (m) => new Error(`gameworld: feel${m}`);

/** A gameworld's `feel` as written → checked. */
export function readFeel(v) {
  const F = typeof v === 'string' ? { pole: v } : v;
  if (!isObj(F)) throw fail(` is a template's name (${POLE_IDS.join(', ')}) or { ${FEEL_KEYS.join(', ')} }`);
  for (const k of Object.keys(F)) if (!FEEL_KEYS.includes(k)) throw fail(`.${k} is not part of a feel (${FEEL_KEYS.join(', ')})`);
  if (!POLES[F.pole]) throw fail(`.pole is one of ${POLE_IDS.join(', ')}`);
  const vars = variantsOf(F.pole);
  if (F.variant !== undefined && !vars.includes(F.variant)) throw fail(vars.length ? `.variant is one of ${vars.join(', ')}` : `.variant: ${POLES[F.pole].name} has no variants`);
  if (F.toward !== undefined && (!POLES[F.toward] || F.toward === F.pole)) throw fail(`.toward is another template (${POLE_IDS.filter((id) => id !== F.pole).join(', ')})`);
  if (F.t !== undefined && (F.toward === undefined || !(typeof F.t === 'number' && F.t >= 0 && F.t <= 1))) throw fail(F.toward === undefined ? '.t is how far toward `toward`: name it first' : '.t is a number from 0 (the pole) to 1 (toward)');
  if (F.set !== undefined && !isObj(F.set)) throw fail('.set is the card\'s own fields ({ ground?, jump?, air?, … }), laid over the template\'s');
  return { pole: F.pole, ...(F.variant !== undefined ? { variant: F.variant } : {}), ...(F.toward !== undefined ? { toward: F.toward, t: F.t ?? 0.5 } : {}), ...(F.set !== undefined ? { set: F.set } : {}) };
}

/** The card a feel makes: the template's (its variant, or blended toward another), its own fields over it. */
export function feelCard(feel) {
  const F = readFeel(feel), base = F.toward && F.t > 0 ? blendPoles(F.pole, F.toward, F.t) : poleCard(F.pole, F.variant ?? null);
  return F.set ? mergeDeep(base, F.set) : base;
}

// what the runtime does not carry yet, by the card's field (reported only when the card has it)
const LOST = Object.freeze({
  'jump.hang': 'the hang at the apex: the platform rule has none',
  'jump.heavy': 'the heavy landing\'s lag: the platform rule lands without one',
  'ground.steer': 'the steered run (a projectile\'s arc): the platform rule moves straight to the stick',
  dodge: 'the dodge roll: the runtime\'s dodge is mobile-suit-arena\'s acrobatics on a double tap, not this roll and its invincible frames',
  dash: 'the dash: the platform rule\'s boost is a held thrust on a gauge (mobile-suit-arena\'s), not this dash',
  cling: 'the wall slide and the wall jump',
  guard: 'the guard: the block, the parry and its window, witch time',
  'hit.hitstop': 'hitstop: the freeze on both bodies at a blow',
  charge: 'the hold-release charge',
  pound: 'the stomp attack',
  'land.stomp': 'the stomp on a body\'s head',
  armor: 'offense armor on the moves',
  'moves.string.armor': 'offense armor on the moves',
  glide: 'the glider (a power\'s `glideFall` is the runtime\'s nearest: a capped fall)',
  jet: 'the jetpack',
  boost: 'the boost on its gauge (the platform rule has one, mobile-suit-arena\'s: lowered with the mech, later)',
  quickBoost: 'the quick boost',
  chargeJump: 'the stop-and-charge jump',
  gait: 'the heavy gait (the footfall\'s dip)',
  landing: 'landings that lag by the fall',
  size: 'a grown body',
  loadout: 'the loadout: the runtime\'s own weapons, from the game\'s equipment',
  hurt: 'what a hit does to the hero: the game\'s own hp and its mechanics',
  maneuver: 'maneuver armor',
  runner: 'the runner\'s treadmill',
  look: 'the look (squash and stretch, smears): the renderer\'s, with the clips',
});

/**
 * The launch speed that rises `h` metres under `g` AS THE RUNTIME STEPS IT (rules-platform.js: each frame the gravity,
 * then the move), not v²/2g: the frames lose half a frame's rise, so the continuous speed peaks short (5 % on a 1.3 m
 * jump). Solved by bisection on the runtime's own sum.
 */
export function steppedSpeed(h, g, dt = 1 / FPS) {
  const apex = (v) => { let z = 0; for (let k = 1; v - k * g * dt > 0; k++) z += (v - k * g * dt) * dt; return z; };
  let lo = 0, hi = Math.sqrt(2 * g * h) * 2 + g * dt;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (apex(m) < h) lo = m; else hi = m; }
  return r4(hi);
}

/** A card → the platform rule's fields, and what is carried, partly carried and not carried. */
export function lowerFeel(card, { gear = null } = {}) {
  const rule = {}, carried = [], partly = [], lost = [];
  const C = card, Gd = C.ground, J = C.jump;
  const put = (field, k, v) => { rule[k] = v; carried.push(field); };
  const half = (field, why) => partly.push({ field, why });
  // the ground: the run, its acceleration both ways, the facing's turn
  put('ground.run', 'speed', Gd.run);
  if (Gd.accel > 0) put('ground.accel', 'accel', Gd.accel);
  if (Gd.decel > 0) put('ground.decel', 'decel', Gd.decel);
  if (Gd.turn != null) { rule.faceRate = Gd.turn === Infinity ? 60 : r4((Gd.turn * Math.PI) / 180); half('ground.turn', 'the facing\'s turn where the hero moves in the screen\'s frame or on a lane (faceRate); a tank-turned hero keeps its own'); }
  if (Gd.sprint > Gd.run) half('ground.sprint', 'one speed, the run: the walk is the stick\'s share, the sprint is not carried');
  // the jump: its speed from the height and the rise's gravity (as the runtime steps them), the fall's own, the windows in
  // seconds; the gather a half frame long so the take-off lands on the card's frame (the runtime counts the press's)
  const v0 = steppedSpeed(J.height, J.gRise);
  put('jump.height', 'jumpSpeed', v0); put('jump.gRise', 'gravity', J.gRise); put('jump.gFall', 'fallGravity', J.gFall);
  if (J.maxFall > 0) put('jump.maxFall', 'maxFall', J.maxFall);
  if (J.coyote != null) put('jump.coyote', 'coyote', r4(J.coyote / FPS));
  if (J.buffer != null) put('jump.buffer', 'buffer', r4(J.buffer / FPS));
  if (J.air != null) put('jump.air', 'airControl', J.air);
  if (J.commit > 0) { put('jump.commit', 'jumpWindup', r4((J.commit + 0.5) / FPS)); if (J.cut < 1) half('jump.commit', 'a jump let go during its gather: the card\'s goes full height (the cut reads the rise), the runtime\'s is cut at once'); }
  rule.jumpCut = J.cut >= 1 ? v0 : r4(v0 * J.cut);
  if (J.cut < 1) half('jump.cut', 'the runtime caps the rise at a release where the card scales it: a tap hops within a few per cent of the card\'s shortest hop, a release late in the rise is cut less');
  else carried.push('jump.cut');
  // (a count blended between two templates is rounded: half an air jump is none or one)
  const airJumps = Math.round(C.air?.jumps ?? 0);
  if (airJumps > 0) { put('air.jumps', 'airJumps', airJumps); put('air.mult', 'airJumpMult', r4(steppedSpeed(J.height * (C.air.mult ?? 1), J.gRise) / v0)); }
  // the strike: the contact window's shape on the swing clip, a string as the runtime's two-hit combo
  const S = C.moves?.string;
  if (S?.length) {
    const m = S[0], total = m.startup + m.active + m.recovery;
    rule.strikeContact = [r4(m.startup / total), r4((m.startup + m.active) / total)];
    if (S.length > 1) rule.combo = 1;
    half('moves.string', `the contact window's place in the swing (${m.startup} of ${total} frames to the first active); its frames are the swing clip's until the clips are fitted to the card${S.length > 2 ? `; a string of ${S.length} plays as the runtime's two-hit combo` : ''}`);
  }
  // the lane: the level's own line (a side camera lays one); facing the foe is the fighter's
  const lane = !!C.lane;
  if (lane) half('lane', 'the hero held to the level\'s own lane (a side camera lays one)' + (C.lane.face ? '; facing the foe is the fighter\'s, not carried' : ''));
  // the rest, said
  const has = (path) => { const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), C); return v != null && v !== false && !(isObj(v) && path === 'land.stomp'); };
  for (const [field, why] of Object.entries(LOST)) {
    if (field === 'land.stomp') { if (C.land?.model === 'stomp') lost.push({ field, why }); continue; }
    if (field === 'hit.hitstop') { if (C.hit?.hitstop && C.hit.hitstop.max > 0) lost.push({ field, why }); continue; }
    if (field === 'moves.string.armor') { if (S?.some((m) => m.armor)) lost.push({ field, why }); continue; }
    if (field === 'armor') continue;
    if (field === 'jump.hang') { if (J.hang > 0) lost.push({ field, why }); continue; }
    if (field === 'glide' || field === 'jet') { if (gear === field) lost.push({ field, why }); continue; }   // worn only when the template names the gear
    if (has(field)) lost.push({ field, why });
  }
  return { rule, lane, carried, partly, lost };
}

/** What a gameworld's feel makes of its hero, for the readout: the template, its viewer (advice), and what is carried. */
export function feelReport(feel) {
  const F = readFeel(feel), P = POLES[F.pole], L = lowerFeel(feelCard(F), { gear: P.gear ?? null });
  return {
    pole: F.pole, name: P.name, after: P.after, ...(F.variant ? { variant: F.variant } : variantsOf(F.pole).length ? { variant: variantsOf(F.pole)[0] } : {}),
    ...(F.toward ? { toward: F.toward, t: F.t } : {}), view: P.view.camera,
    carried: L.carried, partly: L.partly, lost: L.lost,
  };
}
