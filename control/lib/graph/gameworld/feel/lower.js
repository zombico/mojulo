/**
 * FEEL → THE GAME — a gameworld's `feel` names one of the action lab's templates (cards.js POLES), and its hero moves
 * by that template's card. The card is LOWERED into the rule the controllable runtime already plays (rules-platform.js:
 * the platform rule; combat-melee.js: the strike), laid over the hero's own (playscape/player.js), and what the runtime
 * does not carry yet is SAID, never dropped silently: the report is advice, as an intent's target is (intent.js).
 *
 *   feel: '<pole>' | { pole, variant?, toward?, t?, set?, takes? }
 *     pole     a template (POLE_IDS)
 *     variant  one of its variants (variantsOf), its first by default
 *     toward   a second template to tune toward, `t` how far (0 … 1, 0.5 when only `toward` is named)
 *     set      the card's own fields laid over the template's (objects merge, anything else replaces)
 *     takes    true: the hero plays its OWN jumps on the card's flight (TAKES): the standing jump, the jump forward out
 *              of a run, the double jump's second push for an air jump, each clip's gather, air and landing played on
 *              the runtime's own take-off, flight and touch-down, the landing held the card's `land` frames; and the
 *              card's moves: its wall, its dash, its sprint (Shift held) and its walk. Absent: the animation library's
 *              held leap, every byte as before
 *
 *   readFeel(v)       → the feel checked ({ pole, variant?, toward?, t?, set? }); throws, teaching
 *   feelCard(feel)    → the card the feel makes
 *   lowerFeel(card, { gear?, takes?, base? })   → { rule, lane, carried: [field], partly: [{ field, why }], lost: [{ field, why }] }
 *                       `rule` the platform rule's fields (speed, accel, decel, faceRate, jumpSpeed, gravity,
 *                       fallGravity, maxFall, coyote, buffer, jumpCut, airControl, jumpWindup, airJumps, airJumpMult,
 *                       strikeContact, combo, hitstop, guard; a card that sprints, `sprint` with its stamina: boostSpeed, boostMax,
 *                       boostRegen, overheatRegen, boostUnlockFrac); `lane` the card holds the hero to a line (the level's own); `gear` the
 *                       template's worn gear (the glider or the jetpack), said when it names one
 *   feelRule(feel)    → the rule a written feel lays over the hero's (its takes when it asks for them)
 *   TAKES             the hero's jumps the takes play (clip names: hero-jump.js), by the runtime's state
 *   feelReport(feel)  → { pole, name, after, variant?, toward?, t?, takes?, view, carried, partly, lost } the readout's
 *
 * Units: the card's frames at 60 fps become the runtime's seconds; its metres and m/s are the runtime's units. Pure.
 */
import { FPS, r4, POLES, POLE_IDS, variantsOf, poleCard, blendPoles, mergeDeep } from './cards.js';
import { jumpShares } from '../../polygonizer/hero-jump.js';
import { saberRule, SABER_COMBOS } from './saber.js';
import { DASH_DUST } from './round-look.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** A hero's STAMINA (the sprint's gauge), its defaults: seconds of sprint, seconds to refill from empty, and seconds to
 * refill when WINDED (run dry: no sprint until full again). A card says its own as `stamina: { seconds?, refill?, winded? }`. */
export const STAMINA = Object.freeze({ seconds: 6, refill: 4, winded: 6, dodge: 1 });
const FEEL_KEYS = ['pole', 'variant', 'toward', 't', 'set', 'takes'];
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
  if (F.takes !== undefined && F.takes !== true) throw fail('.takes is true (the hero plays its own jumps on the card\'s flight), or left out');
  return { pole: F.pole, ...(F.variant !== undefined ? { variant: F.variant } : {}), ...(F.toward !== undefined ? { toward: F.toward, t: F.t ?? 0.5 } : {}), ...(F.set !== undefined ? { set: F.set } : {}), ...(F.takes ? { takes: true } : {}) };
}

/** The card a feel makes: the template's (its variant, or blended toward another), its own fields over it. */
export function feelCard(feel) {
  const F = readFeel(feel), base = F.toward && F.t > 0 ? blendPoles(F.pole, F.toward, F.t) : poleCard(F.pole, F.variant ?? null);
  return F.set ? mergeDeep(base, F.set) : base;
}

// THE BUSTER's rounds (worlds/controllable/buster.js): a hero's blow (foes/vocab.js HERO.blow, the foes' health is counted
// in blows) and each level's share of it (the tap, the first charge, the full charge), and each level's colour (the
// hero juice's charge tiers, gameworld/feel/hero-juice.js: the tap a pale lemon, then green, then gold)
const BLOW = 20;
export const BUSTER_DAMAGE = Object.freeze([0.5, 1, 2.5]);
const BUSTER_COLOURS = Object.freeze([0xfff2a8, 0x5dff7a, 0xffd23a]);
// each round's HITBOX (its own, not its drawing: worlds/controllable/buster.js), shares of its size: the regular rounds
// tinier than they look (`r` the radius it meets a body with); the full charge (the last level) a TALL capsule, `tall`
// its half height over its centre, so it catches what stands anywhere in its height
export const BUSTER_HIT = Object.freeze({ tap: Object.freeze({ r: 0.75 }), level: Object.freeze({ r: 0.8 }), full: Object.freeze({ r: 0.75, tall: 1.1 }) });
// each round's LOW REACH (worlds/controllable/buster.js `low`): it meets a body down to this share of the hero's height
// under its muzzle, so a walker at the hero's knee falls to a tap, not to the tall full charge alone (the run and gun's
// low foe is shot standing, never crouched for)
export const BUSTER_LOW = 0.35;

// what the runtime does not carry yet, by the card's field (reported only when the card has it)
const LOST = Object.freeze({
  'jump.hang': 'the hang at the apex: the platform rule has none',
  'jump.heavy': 'the heavy landing\'s lag: the platform rule lands without one',
  'ground.steer': 'the steered run (a projectile\'s arc): the platform rule moves straight to the stick',
  dodge: 'the dodge roll: the runtime\'s dodge is mobile-suit-arena\'s acrobatics on a double tap, not this roll and its invincible frames',
  dash: 'the dash: the platform rule\'s boost is a held thrust on a gauge (mobile-suit-arena\'s), not this dash',
  cling: 'the wall slide and the wall jump',
  guard: 'the guard: the block, the parry and its window, witch time',   // (carried where the card has a block: lowerFeel)
  charge: 'the hold-release charge',
  pound: 'the stomp attack',
  'land.stomp': 'the stomp on a body\'s head (carried only where a level stands foes: gameworld/foes.js lays it on the hero there)',
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

/**
 * THE TAKES: by the runtime's state, the hero's jump it plays (hero-jump.js). `jump_up` a jump from standing (or a walk),
 * `jump_fwd` a jump out of the run, `jump_air` an air jump (the double jump's second push: its clip from the kick on).
 */
export const TAKES = Object.freeze({ jump_up: 'jump', jump_fwd: 'jumpForward', jump_air: 'doubleJump' });
/** A card's own takes (its `jumps`: { <state>: <hero-jump.js word> }, a run-and-gun hero's poised jump; `dash` its
 * dash's clip, played over the burst) over TAKES. */
export const takesOfCard = (C) => ({ ...TAKES, ...(C && C.jumps && typeof C.jumps === 'object' ? C.jumps : {}) });

/** The run button's build (`rule.sprint`): a held run gets to the card's sprint over a second of running, as a mascot
 * platformer's does (momentum earned, not a burst: the dash is that), and gives it back over half a second let go. */
export const SPRINT = Object.freeze({ build: 1, fall: 0.5 });

/** The platform rule's `takes`: each take's flight as shares of its clip, and the landing's seconds (the card's). */
function takesOf(J, look, T = TAKES) {
  const S = Object.fromEntries(Object.entries(T).filter(([state]) => state !== 'dash' && state !== 'hurt').map(([state, clip]) => [state, jumpShares(clip)]));
  const squash = look?.squash > 0 ? r4(look.squash) : 0;
  // (a card's own dash, `jumps.dash`: a move on the floor the runtime plays over the dash's burst, rules-platform.js)
  return { up: [S.jump_up.off, S.jump_up.on], fwd: [S.jump_fwd.off, S.jump_fwd.on], air: [S.jump_air.kick, S.jump_air.on], land: r4(Math.max(1, J.land ?? 0) / FPS), ...(squash ? { squash } : {}), ...(T.dash ? { dash: true } : {}), ...(T.hurt ? { hurt: true } : {}) };
}

/** A card → the platform rule's fields, and what is carried, partly carried and not carried. `takes`: the hero's own
 * jumps played on the card's flight (TAKES), the landing held the card's frames. */
export function lowerFeel(card, { gear = null, takes = false, base = null } = {}) {
  const rule = {}, carried = [], partly = [], lost = [];
  const C = card, Gd = C.ground, J = C.jump;
  const put = (field, k, v) => { rule[k] = v; carried.push(field); };
  const half = (field, why) => partly.push({ field, why });
  // the ground: the run, its acceleration both ways, the facing's turn
  put('ground.run', 'speed', Gd.run);
  if (Gd.accel > 0) put('ground.accel', 'accel', Gd.accel);
  if (Gd.decel > 0) put('ground.decel', 'decel', Gd.decel);
  if (Gd.turn != null) { rule.faceRate = Gd.turn === Infinity ? 60 : r4((Gd.turn * Math.PI) / 180); half('ground.turn', 'the facing\'s turn where the hero moves in the screen\'s frame or on a lane (faceRate); a tank-turned hero keeps its own'); }
  // THE SPRINT, by the game the template is (its `base`) and whether the hero plays its takes:
  //   with the takes, a PLATFORMER's hero (a mascot) runs on the run button (F held), its speed built up over SPRINT.build
  //   seconds of running (rules-platform.js `sprint`), unless the card dashes (a takes' dash keeps one speed, the run);
  //   with the takes, any other hero is a PERSON: the sprint held on Shift (`sprintSpeed`, never firing or aiming) and its
  //   walk (`walkSpeed`), a person's pace;
  //   without the takes, the sprint on the hero's STAMINA: the boost held, on its gauge (rules-platform.js `stamina`), the
  //   card's `stamina` its seconds of sprint, its refill and its winded refill (STAMINA the defaults), and the dodge on it
  const mascot = (base ?? POLES[C.pole]?.base ?? null) === 'platformer';
  if (takes && Gd.sprint > Gd.run && mascot && !(C.dash && C.dash.kind === 'dash')) { rule.sprint = { speed: Gd.sprint, ...SPRINT }; half('ground.sprint', `the run button (F held while running): the run built up to ${Gd.sprint} m/s over ${SPRINT.build} s, eased back over ${SPRINT.fall} s let go`); }
  else if (takes && Gd.sprint > Gd.run && mascot) half('ground.sprint', 'one speed, the run: the walk is the stick\'s share, the sprint is not carried');
  else if (takes && Gd.sprint > Gd.run) put('ground.sprint', 'sprintSpeed', Gd.sprint);
  else if (Gd.sprint > Gd.run) {
    const St = { ...STAMINA, ...(C.stamina ?? {}) };
    put('ground.sprint', 'stamina', true); rule.boostSpeed = Gd.sprint;
    rule.boostMax = St.seconds; rule.boostRegen = r4(St.seconds / St.refill); rule.overheatRegen = r4(St.seconds / St.winded); rule.boostUnlockFrac = 1;
    carried.push('stamina');
    // the DODGE, on the sprint's key (a double tap) and its stamina (`stamina.dodge` seconds of it, never the whole gauge):
    // the card's dodge as the runtime's dash (maneuvers.js): its frames, its speed, invulnerable throughout; a roll's own
    // tumble the body's clip where it has one
    if (C.dodge && C.dodge.speed > 0) {
      rule.dodge = true; rule.dodgeDur = r4(Math.max(6, C.dodge.frames) / FPS); rule.dodgeSpeed = C.dodge.speed;
      rule.dodgeBoostCost = St.dodge; rule.dodgeOverheat = false; rule.dodgeCooldown = 0.2;
      carried.push('dodge');
    }
  }
  if (takes && !mascot && Gd.walk > 0 && Gd.walk < Gd.run) put('ground.walk', 'walkSpeed', Gd.walk);
  // the jump: its speed from the height and the rise's gravity (as the runtime steps them), the fall's own, the windows in
  // seconds; the gather a half frame long so the take-off lands on the card's frame (the runtime counts the press's)
  const v0 = steppedSpeed(J.height, J.gRise);
  put('jump.height', 'jumpSpeed', v0); put('jump.gRise', 'gravity', J.gRise); put('jump.gFall', 'fallGravity', J.gFall);
  if (J.maxFall > 0) put('jump.maxFall', 'maxFall', J.maxFall);
  if (J.coyote != null) put('jump.coyote', 'coyote', r4(J.coyote / FPS));
  if (J.buffer != null) put('jump.buffer', 'buffer', r4(J.buffer / FPS));
  if (J.air != null) put('jump.air', 'airControl', J.air);
  // (a card with no gather says so: 0, never absent, or the hero's own wind-up, playscape/player.js, survives under it)
  put('jump.commit', 'jumpWindup', J.commit > 0 ? r4((J.commit + 0.5) / FPS) : 0);
  if (J.commit > 0 && J.cut < 1) half('jump.commit', 'a jump let go during its gather: the card\'s goes full height (the cut reads the rise), the runtime\'s is cut at once');
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
  // the SABER (a card's `blade: { kit: 'saber' }`, saber.js): its string on the fire press, in place, on the buster's scale
  // (`steel: true`: a sword of steel plays the string: no strand of light over it, its slash in steel)
  if (C.blade?.kit === 'saber') { Object.assign(rule, saberRule(C.blade)); carried.push('blade'); }
  // THE PAD (a card's `pad`: { <action>: [control, control] }, the controls schemes.js names): the pad's faces as the
  // card's game lays them, over the scheme's own (controls-kernel.js resolve's override; the legend relabels itself)
  if (C.pad && typeof C.pad === 'object') { rule.controls = { gamepad: Object.fromEntries(Object.entries(C.pad).map(([k, v]) => [k, [...v]])) }; carried.push('pad'); }
  // the hitstop: both bodies frozen on a melee connect for the card's frames (base + perMs a unit of the blow's shove, at
  // most max: combat-melee.js stepMelee), the runtime's melee only (a stomp's and a pound's are the lab's)
  if (C.hit?.hitstop && C.hit.hitstop.max > 0) { const H = C.hit.hitstop; put('hit.hitstop', 'hitstop', { base: H.base, perMs: H.perMs, max: H.max }); }
  // the lane: the level's own line (a side camera lays one); facing the foe is the fighter's
  const lane = !!C.lane;
  if (lane) half('lane', 'the hero held to the level\'s own lane (a side camera lays one)' + (C.lane.face ? '; facing the foe is the fighter\'s, not carried' : ''));
  // the rest, said
  const has = (path) => { const v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), C); return v != null && v !== false && !(isObj(v) && path === 'land.stomp'); };
  // the card's moves the takes carry (the runtime's: rules-platform.js): the wall slide and kick, and the dash (its
  // ground dash, air dash, dash jump and dash wall kick; a boost on a gauge is not this dash)
  const moves = new Set();
  if (takes && C.cling) {
    const K = C.cling;
    rule.cling = { slide: K.slide, toward: K.toward, kick: steppedSpeed(J.height * (K.up ?? 1), J.gRise), away: K.away, lock: r4(K.lock / FPS), coyote: r4(K.coyote / FPS) };
    carried.push('cling'); moves.add('cling');
  }
  // THE HANG, THE LANDING'S LAG AND THE STOMP ATTACK (rules-platform.js `hang`, `landLag`, `pound`), with the takes as
  // the wall is: the apex held while the jump is; a landing that lags by its fall (a heavy body's `landing` wins over the
  // jump's `heavy`, as the lab's kernel reads them); the attack pressed in the air turned downward
  if (takes && J.hang > 0) { rule.hang = r4(J.hang / FPS); carried.push('jump.hang'); moves.add('jump.hang'); }
  if (takes && (J.heavy || C.landing)) {
    rule.landLag = C.landing ? { by: { per: r4(C.landing.per / FPS), max: r4(C.landing.max / FPS) } } : { heavy: { fall: J.heavy.fall, lag: r4(J.heavy.lag / FPS) } };
    if (J.heavy) { carried.push('jump.heavy'); moves.add('jump.heavy'); }
    if (C.landing) { half('landing', 'the lag by the fall, the jump and the dash held in it; its crouch is the landing clip\'s, not deepened by the fall'); moves.add('landing'); }
  }
  if (takes && C.pound) {
    const P = C.pound;
    rule.pound = { kind: P.kind, back: P.stick === 'back', hang: r4((P.hang ?? 0) / FPS), speed: P.speed, lag: r4((P.lag ?? 0) / FPS),
      ...(P.kind === 'pound' && P.jump ? { jump: P.jump } : {}), ...(P.kind === 'bounce' ? { bounce: P.bounce ?? 0 } : {}) };
    half('pound', `the attack in the air${P.stick === 'back' ? ' with the stick held back' : ''} turned downward: held ${P.hang ?? 0} frames, dropped straight at ${P.speed} m/s, ${P.kind === 'bounce' ? 'sprung back up off the floor' : `${P.lag ?? 0} frames of lag on the floor${P.kind === 'pound' && P.jump ? ', a higher jump taken in it' : ''}`}; a body landed on takes the level's stomp (foe.js), not the ${P.kind}'s own blow${P.kind === 'plunge' ? ', and its shockwave beside a body is not struck' : ''}`);
    moves.add('pound');
  }
  // (the AIR DASH alone, a card's `dash.ground: false`: F in the air, the takes or not; on the ground F stays the
  // sprint's and the dodge's)
  if (!takes && C.dash && C.dash.kind === 'dash' && C.dash.ground === false && C.dash.air?.count > 0) {
    const A = C.dash.air;
    rule.dash = { ground: false, air: { count: A.count, speed: A.speed, time: r4(A.frames / FPS) } };
    half('dash', `the air dash on F in the air (${A.count} an airtime, ${A.speed} m/s for ${A.frames} frames, the fall stopped); on the ground F stays the sprint and the dodge${C.dash.iframes ? '; its invincible frames are not carried' : ''}`);
    moves.add('dash');
  }
  // (the GLIDE, worn when the template names the glider (`gear`) and holds it (`kind: 'glide'`): the jump held in the air
  // caps the fall at the card's `fall` (the runtime's glideFall), once the air jumps are spent; a paraglider opened and
  // folded by a press, and a float, are not carried)
  if (gear === 'glide' && C.glide && C.glide.kind === 'glide' && C.glide.fall > 0) {
    rule.glideFall = C.glide.fall;
    if (airJumps > 0) rule.glideSpent = true;
    half('glide', `the glide: the jump held in the air caps the fall at ${C.glide.fall} m/s${airJumps > 0 ? ', once the air jumps are spent (jump, jump, hold)' : ''}; its forward speed and its turn are the air's own, not the card's`);
    moves.add('glide');
  }
  if (takes && C.dash && C.dash.kind === 'dash') {
    const D = C.dash, A = D.air;
    // (a burst the card's frames long: a dash held longer is not carried, a dash is not a run)
    // (and its DUST where the card raises it: round-look.js DASH_DUST, the page's wisp off the feet on the ground)
    rule.dash = { speed: D.speed, time: r4(D.frames / FPS), ...(D.jump ? { jump: true } : {}), ...(D.wall ? { wall: true } : {}),
      ...(A && A.count > 0 ? { air: { count: A.count, speed: A.speed, time: r4(A.frames / FPS) } } : {}), ...(D.dust ? { dust: { ...DASH_DUST } } : {}) };
    half('dash', `the dash on F (a person's): the ground dash, ${A?.count ? 'the air dash, ' : ''}${D.jump ? 'the dash jump' : ''}${D.wall ? ', the dash wall kick' : ''}; a burst, the card's ${D.frames} frames whatever the button does${D.hold ? ' (its held dash is not carried)' : ''}${D.iframes ? '; its invincible frames are not carried' : ''}${D.cancel ? '; its cancel out of a move is not carried' : ''}`);
    moves.add('dash');
  }
  // the GUARD (combat-melee.js stepGuard; held: Shift, a pad's left shoulder): a blow from the front blocked (the card's
  // blockstun and push back, its stamina's cost; run dry, the guard breaks into a stagger), one met within the `parry`
  // seconds of the guard going up PARRIED (null: any guard parries), the attacker staggered open the `riposte` seconds;
  // the walk at the guard's share of the run. Every foe's blow is parryable (the zones are the lab's); the perfect
  // dodge's witch time is not carried
  if (C.guard && C.guard.block) {
    const G = C.guard;
    rule.guard = { move: r4(G.move ?? 0), push: r4(G.block.push ?? 0), stun: r4((G.block.stun ?? 0) / FPS), parry: G.parry == null ? null : r4(G.parry / FPS), riposte: r4((G.riposte ?? 0) / FPS),
      ...(G.stamina ? { stamina: { max: G.stamina.max, cost: G.stamina.cost, regen: G.stamina.regen, break: r4(G.stamina.break / FPS) } } : {}) };
    half('guard', `the guard held (Shift, the pad's left shoulder): the block from the front, the parry ${G.parry == null ? 'on any guard' : `within ${Math.round(G.parry)} frames of raising it`}, the riposte; every foe's blow parryable (the zones are the lab's)${G.perfect ? '; the perfect dodge\'s witch time is not carried' : ''}`);
    moves.add('guard');
  }
  // THE BUSTER (worlds/controllable/buster.js), a run and gun's: a charge of `kind: 'shot'` whose tap fires. The tap
  // shot on the press of fire (J, the pad's right trigger), at most the tap's `max` in flight; held, the charge builds
  // through anything, and let go it fires the highest level reached; every round straight from the chest along the
  // facing, its speed, size and life the card's (frames as seconds), its damage a share of a hero's blow by its level
  // (BUSTER_DAMAGE), a heavy round's impact a stagger. The charge's stance and its show frames are the page's juice
  if (C.charge && C.charge.kind === 'shot' && C.charge.tap && Array.isArray(C.charge.levels) && Array.isArray(C.charge.at)) {
    const K = C.charge, hit = (R, k) => { const H = k === 0 ? BUSTER_HIT.tap : k === K.levels.length ? BUSTER_HIT.full : BUSTER_HIT.level; return { r: r4(R.size * H.r), ...(H.tall ? { tall: r4(R.size * H.tall) } : {}) }; };
    const round = (R, k) => ({ speed: R.speed, size: R.size, life: r4(R.life / FPS), damage: r4(BLOW * BUSTER_DAMAGE[Math.min(k, BUSTER_DAMAGE.length - 1)]),
      impact: (R.tags ?? []).includes('heavy') ? 1 : 0, color: BUSTER_COLOURS[Math.min(k, BUSTER_COLOURS.length - 1)], hit: hit(R, k) });
    rule.buster = { max: K.tap.max ?? 3, chest: 0.7, low: BUSTER_LOW, tap: round(K.tap, 0), levels: K.levels.map((f, i) => ({ at: r4(f / FPS), ...round(K.at[i] ?? K.at[K.at.length - 1], i + 1) })) };
    half('charge', `the buster on fire (J, the pad's right trigger): the tap shot on the press (${rule.buster.max} out at most), the charge held through anything and let go at ${K.levels.map((f) => `${f}`).join(' or ')} frames; each round straight from the chest; its damage a share of a hero's blow by level (${BUSTER_DAMAGE.join(', ')})`);
    moves.add('charge');
  }
  for (const [field, why] of Object.entries(LOST)) {
    if (moves.has(field)) continue;
    // (the takes carry the look's squash and stretch on the hero's own jumps; its smears stay the renderer's)
    if (field === 'look' && takes && C.look?.squash > 0) { half('look', 'the squash and stretch on the take-off, the flight and the landing, with the hero\'s own jumps; the smears are not carried'); continue; }
    if (field === 'land.stomp') { if (C.land?.model === 'stomp') lost.push({ field, why }); continue; }
    if (field === 'moves.string.armor') { if (S?.some((m) => m.armor)) lost.push({ field, why }); continue; }
    if (field === 'armor') continue;
    if (field === 'jump.hang') { if (J.hang > 0) lost.push({ field, why }); continue; }
    if (field === 'glide' || field === 'jet') { if (gear === field) lost.push({ field, why }); continue; }   // worn only when the template names the gear
    if (carried.includes(field)) continue;   // (the dodge, carried with a sprint's stamina)
    if (has(field)) lost.push({ field, why });
  }
  // (a dodge carried as the runtime's dash: its roll's tumble is the body's clip, its i-frames the whole dash's)
  if (carried.includes('dodge') && C.dodge.kind === 'roll') partly.push({ field: 'dodge.kind', why: 'the roll plays as the runtime\'s dash, invulnerable throughout: a body with no roll clip dashes on its run' });
  // the takes: the hero's own jumps on this flight, the landing its frames (the card's `land`, at least one)
  if (takes) { rule.takes = takesOf(J, C.look, takesOfCard(C)); carried.push('jump.land'); }
  // THE FLINCH (a card's `hit.flinch` frames, with its takes' `hurt` clip: rules-platform.js `flinch`): a blow taken snaps
  // the hero into its hurt, the stick and the jump not its own until it passes
  if (takes && C.hit?.flinch > 0 && takesOfCard(C).hurt) put('hit.flinch', 'flinch', r4(C.hit.flinch / FPS));
  return { rule, lane, carried, partly, lost };
}

/** The rule a written feel lays over the hero's platform rule: its card lowered, with its takes when it asks for them. */
/** The combo manifest a feel's moveset is lowered from (combos.js: its moves and its strings, written), or null where its
 * card strikes no string: what a tech tree (trees/techs.js) builds its strings on. */
export function feelCombos(feel) {
  const C = feelCard(feel);
  return C.blade?.kit === 'saber' ? structuredClone(SABER_COMBOS) : null;
}

export function feelRule(feel) {
  const F = readFeel(feel);
  // (the template's worn gear with it: a glider it holds is carried, lowerFeel)
  return lowerFeel(feelCard(F), { gear: POLES[F.pole]?.gear ?? null, takes: !!F.takes, base: POLES[F.pole]?.base ?? null }).rule;
}

/**
 * A card's dash and jetpack as the tuning of a hero's vayo moves (rupa/vayo-move.js), for a hero that has one: the dash's
 * peak its speed, its push a third of its frames (at most a tenth of a second) and its carry the rest of the ground it
 * covered at that speed, its invincible frames kept as frames; the jetpack's rise the flight's climb, the time its thrust
 * takes to reach it the flight's rise, its fuel the meter a second it drains; its air jump the vayo jump's height and
 * count; its dash's `air` the air dash; its jetpack the vayo jetpack too (its thrust over the card's gravity, its delay the
 * startup). A card with none of them: null. A hero without
 * vayo moves never reads this, so it lowers as it did.
 */
export function feelVayo(card) {
  const D = card && card.dash, J = card && card.jet, out = {};
  if (D && D.speed > 0 && D.frames > 0) {
    const T = D.frames / FPS, rise = r4(Math.min(0.1, T / 3));
    out.dash = { speed: D.speed, rise, carry: r4(Math.max(0.5, D.speed * T - 0.55 * D.speed * rise)), ...(Array.isArray(D.iframes) && D.iframes[1] > D.iframes[0] ? { iframes: { frames: [D.iframes[0], D.iframes[1]] } } : {}), air: !!D.air };
  }
  // the card's air dash (its dash's `air`), as a vayo air dash: its speed, push and carry as the dash's, and its count
  if (D && D.air && (D.air.speed > 0 || D.speed > 0)) {
    const sp = D.air.speed > 0 ? D.air.speed : D.speed, T = (D.air.frames > 0 ? D.air.frames : D.frames > 0 ? D.frames : 12) / FPS, rise = r4(Math.min(0.1, T / 3));
    out.airDash = { speed: sp, rise, carry: r4(Math.max(0.5, sp * T - 0.55 * sp * rise)), count: Math.max(1, Math.round(D.air.count ?? 1)) };
  }
  // the card's air jump, as a vayo jump's height and count (its multiple of the ground jump's height)
  const A = card && card.air, Jg = card && card.jump;
  if (A && A.jumps >= 1 && Jg && Jg.height > 0) out.jump = { height: r4(Jg.height * (A.mult ?? 1)), count: Math.round(A.jumps) };
  if (J && J.rise > 0) {
    const a = J.thrust > 9.81 ? J.thrust - 9.81 : 0;
    out.flight = { climb: J.rise, ...(a > 0 ? { rise: r4(J.rise / a) } : {}), ...(J.fuel > 0 ? { drain: r4(FPS / J.fuel) } : {}) };
  }
  // the card's jetpack, as a vayo jetpack: its thrust over the card's gravity, its delay the startup, its fuel's seconds
  const gJ = Jg && Jg.gRise > 0 ? Jg.gRise : 9.81;
  if (J && J.thrust > 0) out.jetpack = { thrust: r4(Math.max(1.05, J.thrust / gJ)), ...(J.delay > 0 ? { startup: { frames: Math.round(J.delay) } } : {}), ...(J.fuel > 0 ? { fuel: r4(J.fuel / FPS) } : {}) };
  return out.dash || out.airDash || out.flight || out.jump || out.jetpack ? out : null;
}

/** What a gameworld's feel makes of its hero, for the readout: the template, its viewer (advice), and what is carried. */
export function feelReport(feel) {
  const F = readFeel(feel), P = POLES[F.pole], L = lowerFeel(feelCard(F), { gear: P.gear ?? null, takes: !!F.takes, base: P.base ?? null });
  return {
    pole: F.pole, name: P.name, after: P.after, ...(F.variant ? { variant: F.variant } : variantsOf(F.pole).length ? { variant: variantsOf(F.pole)[0] } : {}),
    ...(F.toward ? { toward: F.toward, t: F.t } : {}), ...(F.takes ? { takes: true } : {}), view: P.view.camera,
    carried: L.carried, partly: L.partly, lost: L.lost,
  };
}
