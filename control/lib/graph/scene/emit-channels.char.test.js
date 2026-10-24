import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { EMIT_FIXTURES } from './emit-fixtures.js';
import { emitThreeWorld } from './scene-three.js';

// ── characterization net (renderer-emitter.plan.md E2a) ────────────────────────────
// Hash-pins emitThreeWorld's emission for the whole fixture matrix. The E2b registry
// refactor must keep every hash IDENTICAL — that is the proof it is byte-pure. A hash
// here may only change when a plan step SAYS emission changes (and then the step's
// notes must name the fixtures it touched). To inspect a mismatch, dump both sides:
//   node -e "import('./lib/graph/scene/emit-fixtures.js').then(async ({EMIT_FIXTURES}) => {
//     const {emitThreeWorld} = await import('./lib/graph/scene/scene-three.js');
//     const fx = EMIT_FIXTURES.find(([n]) => n === '<name>');
//     process.stdout.write(emitThreeWorld(fx[1]));
//   })" > /tmp/emission.html
// and diff against the same dump from a clean checkout.
//
// The `versus` fixture (a side-view fight on an arena) embeds lib/graph/versus's pure modules and browser clients
// whole: a change to any of them re-pins that fixture alone, and every other page stays as it was.
//
// Re-pinned 2026-10-07 (playscape: movers run rails and ride drives): the controllable runtime the page embeds gained
// the mover's `path` / `drive: 'ride'` branch and the carry pass's `_ridden` mark. The diff on the `controllable` fixture
// is additions only (85 lines, none removed); every fixture that embeds the controllable runtime re-pinned with it.
//
// Re-pinned 2026-10-07 (playscape: the catapult): the runtime gained the `launcher` rule, its `launch` world pass and
// `launch-lock` pre-step. On the `controllable` fixture 62 lines are added and 2 replaced: the rule registry names
// `launcher`, and the platform rule's jump cut skips a rider a launcher threw (`!e.launchedBy`, unset without one).
//
// Re-pinned 2026-10-07 (playscape: the ladder): the runtime gained the `climb` body owner (a platform body takes hold of
// a `climbable` entity, climbs it, mounts its lip, kicks off it). The diff on the `controllable` fixture is additions
// only (80 lines, none removed); a world without a climbable never takes hold.
//
// Re-pinned 2026-10-07 (playscape: breakable terrain and its gravity): the runtime gained the `breakables` state init,
// the `break` world pass (after the projectiles: hits, then the held set, the falls and the landings) and
// `breakBlock`. The diff on the `controllable` fixture is additions only (117 lines, none removed); a world without
// `breakables` keeps no breakable state and the pass returns at once.

// Re-pinned 2026-10-08 (UI controls: the pilot scheme): the pause sidecar's `__controlRows` hands a piloted world's
// legend to the controllable channel (`__ctlLegend`), so every fixture re-pinned with that one region. Pages with the
// controllable runtime also embed the controls kernel, the pilot scheme and the device families they drive (`__CTL`,
// `__SCHEME`, `__DEV`, `__BIND`) and read keys, pad buttons and mouse buttons through it in place of literals, plus
// look keys (unbound by default); the input a world receives from the default bindings is unchanged. The pad's printed
// layout (Xbox, PlayStation, Nintendo) is read by the kernel's `padLayout`, and the weapon selector's glyphs follow it.
// Re-pinned 2026-10-08 (world events): the event bus and the controllable engine ship in the page, and both grew the
// cast — the bus's `ctrl` verb and syncToCtrl's hand-off, the engine's cast builder (ops, facts, the walk owner) and
// walk bodies giving way to solid ones — and the walk rule's tank turn flipped so A turns left. A world without cues
// on its characters runs the same; the controllable trace pins hold except the walk world's (the turn).
// Re-pinned 2026-10-11 (buildings as game levels; game buildings): the walk rule the page embeds gained two opt-ins, a
// mouse-look walker that still turns on the keys (`keyTurn`) and a body the world's colliders stop (`collideRadius`,
// `collideHeight`, `step`). Additions only (6 lines, none removed); a walker without them moves as before.
// Re-pinned 2026-10-12 (storeys): the walk rule the page embeds gained `probe`, the ground looked for from that high
// over the feet (a stair's treads climbed, the floor of the storey above never stood on). Two comment lines added and
// the ground hook's argument chosen by it; a walker without it casts from its eye, as before.
// Re-pinned 2026-10-08 (interaction): the pilot scheme gains `interact` (live in `reach`), and the controllable runtime
// reads it as a counted press edge, keeps it from strafing in reach (window.__mojReach), takes no input while a menu is
// up (window.__mojMenuOpen) and labels a control for the device last used. Events pages without menus or usable places
// are unchanged; the menu runtime moved to interact-channel.js and reads the menu scheme.
// Re-pinned 2026-10-08 (places): the bus's zone step skips a character asleep or sent away (`gone`), now that a cue's
// zone may watch the cast; the engine's body step gains box bodies (`body.collide.box`). Worlds without them move the
// same: the controllable trace pins hold.
// Re-pinned 2026-10-08 (elements): the engine's cast gains the `status` and `lift` ops and the `faded` fact (statuses
// on the world clock). Events pages are unchanged unless their cues put a status on someone (then the status channel
// and the bodies map ride along); the controllable trace pins hold. The status op keeps a burning element's colorant
// name (fire/fire.js carries a body's fire to its body; pages without one are unchanged).
// Re-pinned 2026-10-08 (transitory): the engine's cast takes spawn / vanish `with` (a transit the page plays), and the
// transfigure and puff ops. Pages whose cues use none of them carry no transit code; the controllable trace pins hold.
// Re-pinned 2026-10-08 (weather): the engine's puff stands at a character's feet and keeps its kind, colour and shake,
// and a `shake` op puts down a camera moment. Pages whose cues puff or shake nothing carry no moment code; the
// controllable trace pins hold.
// Re-pinned 2026-10-08 (beams): the engine's cast takes the `beam` op (an attack's moment, its impact and shake at the
// landing) and castFacts the `struck` fact; a moment may wait for a later t0. Pages whose cues fire no beam carry no
// beam code; the controllable trace pins hold.
// Re-pinned 2026-10-08 (explosions): the engine's puff carries an explosion's parts (a chain is several, scattered by
// seeded dice and staggered) and a scale, and a beam's impact may be one. Pages that set none off are unchanged in
// their moment code; the controllable trace pins hold.
// Re-pinned 2026-10-11 (the mind): the arena's ai brain left the mobile-suit pack and joined the engine as
// controllable/mind.js (the same rule, its helpers named by situation, its difficulty tiers built from skill ×
// aggressiveness, plus an opt-in per-character `rule.mind`). Only the embedded engine source moved: every one of the 13
// fixtures that embeds it was emitted before and after with that source cut out, and the rest is byte-identical. The
// controllable trace pins hold, the three arena bouts included.
// Re-pinned 2026-10-11 (the maneuvers): the pack's other behavior module, its maneuvers (dodge, tackle, loadout
// cycling, boost inertia), joined the engine as controllable/maneuvers.js, ahead of the mind; EMISSION is now the engine
// alone. Same proof: the 13 fixtures emitted before and after with the engine source cut out are byte-identical.
// Re-pinned 2026-10-11 (guards and prey): the mind gains two motivations on `rule.mind` — a guard engages only near
// its post and walks back to it, prey flees a threat inside its fear radius. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (the commander): the mind reads a posture's spacing off the rule's own `approach` when the
// weapon slot names none, so a commander's posture spaces the whole body. The commander itself is page-only and gated
// on a `rule.commanded` body, which no fixture holds. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (boss phases): the mind gains a duelist's health phases and adapting ledger, both gated on
// `rule.mind` (rank boss, authored phases, or adapt). Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (pathfinding): the engine gains nav.js (a walk grid from the colliders, A*, a string pull)
// ahead of the mind, which walks it only on `rule.mind.pathing: 'navmesh'`. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (perception): the mind can be limited to what it sees and remember where it last saw a
// target, both gated on `rule.mind.perception`. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (idle motion): the mind's idle by motivation (wander, graze, escort, the territorial warning)
// and a `food` entity tag, all gated on `rule.mind` or the tag. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (behaviour poses end): a warning, a search, grazing and a boss's phase beat hand the clip back
// when they end (found playing the Mind demo headless). Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (predators): prey run from the nearest hunting mind as well as the pilot; a blade-only body
// closes to its reach; an opt-in `strikeLunge` carries a strike forward. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (groups): the engine gains group.js after the mind (slots from traversal patterns, shared
// sight, attack tokens; a no-op without `rule.mind.group`), and a lunge stops at half its reach. Same proof, same 13
// fixtures.
// Re-pinned 2026-10-11 (herds): a group of kind 'herd' keeps cohesion and breaks together at an alarm, and prey
// in a herd run on the alarm. Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (the rule facade's clock): `world.time` reaches the rules, so a mind's sightings, memory,
// regrowth and a group's shared sight read the real time (they read 0). Same proof, same 13 fixtures.
// Re-pinned 2026-10-11 (the hit loop): melee's contact test is lifted out of stepMelee as meleeContacts (it reads, the
// apply loop writes, in the same order), and castFacts counts a body's hits as `hit:<id>` facts (what hp-pool reads).
// A page reads the facts when its cues reach the cast or a reaction listens for a hit; no fixture's does newly. Same
// proof, same 13 fixtures; the controllable trace pins hold.
// Re-pinned 2026-10-11 (cameras): two camera rules (`eye`, `overhead`), `walk` lookPitch and `platform` move: 'world',
// each gated on its own key, so the controllable trace pins hold. With the embedded engine source set aside, all 64
// fixtures are byte-identical to before: the first-person body-hiding splice is gated at emit time. Same 13 fixtures.
// Re-pinned 2026-10-11 (side camera): the `side` camera rule, `platform` move: 'lane' and core `laneNear`, each gated on
// its own key; the trace pins hold and, with the engine source set aside, all 64 fixtures are unchanged. Same 13.
// Re-pinned 2026-10-11 (power moves): `platform` airJumps and glideFall, each gated on its own key; the trace pins hold
// and, with the engine source set aside, all 64 fixtures are unchanged. Same 13.
// Re-pinned 2026-10-11 (merge of the hit loop with the cameras): both changes to the embedded engine source at once.
// Re-pinned 2026-10-11 (scene layer): the `shot` camera rule and the cast's shot / unshot / finish ops, each reached
// only by a scene; the trace pins hold and, with the engine source set aside, all 64 fixtures are unchanged. Same 13.
// Re-pinned 2026-10-11 (scene conditions): the `shot` rule frames places (`at`) as well as characters, reached only by
// a scene; the trace pins hold and, with the engine source set aside, all 64 fixtures are unchanged. Same 13.
// Re-pinned 2026-10-11 (story cascade): the `shot` rule keeps the camera's side of the line and searches for a clear
// view as it cuts, the cast's shot op resets both; reached only by a scene. With the engine source set aside, all 64
// fixtures are unchanged; the trace pins hold. Same 13.
// Re-pinned 2026-10-13 (driving primitives D5): the drive rule's opt-in physics (grip through the driven wheels, brakes
// and steering capped by grip, surface grip, the weather, flight, a two-wheeler's lean) and the racer's ramps, and the
// world's `surface` hook beside `ground`; reached only by a vehicle class's rule. With the engine source set aside, all
// 64 fixtures are unchanged. Same 13.
// Re-pinned 2026-10-14 (merge of 1012-consolidate into the racer line): the drive rule's engine source (D5) meets the
// shoot plan's and game audio's fixtures; with the engine source set aside, all 68 fixtures are byte-identical to
// 1012-consolidate's. The same 13, and the shoot plan's shoot-live.
// Re-pinned 2026-10-14 (skyscape: flight in play): the fly rule's opt-in dials (engine, lever, gravity, lift,
// launchSpeed, bound), the follow rule's opt-in `rollFollow`, and one line in the page's camera drive that rolls a
// follow camera about its view axis when it carries a roll (never set without rollFollow). On the `controllable`
// fixture 11 lines are replaced (the fly rule's own, each now reading its dial) and 25 added; nothing else moves. A page
// with a flying body also gets the flight HUD; no fixture flies. The same 13, and shoot-live.
// Re-pinned 2026-10-14 (skyscape: landing, crashes, assist): the fly rule's opt-in `assist` ('arcade' never stalls and
// levels the wings faster, 'sim' holds the bank). On the `controllable` fixture 2 lines are replaced and 5 added, all
// the rule's own; nothing else moves (the flight block's touchdown, roofs and respawn are emitted only with a flying
// body, which no fixture holds). The same 13, and shoot-live.
// Re-pinned 2026-10-14 (skyscape: space): the fly rule's bound takes `hz` (above and below, the turn-back's nose toward
// the centre's height) and the lever a `leverStart`; on the `controllable` fixture 3 lines are replaced and 2 added, all
// the rule's own, every one reading an absent key the old way. The same 13, and shoot-live.
// Re-pinned 2026-10-14 (skyscape: the trench): the fly rule reads its ground without gravity when `space` is set (a
// station's surface, a trench's walls); on the `controllable` fixture 1 line is replaced, the rule's own. The same 13,
// and shoot-live.
// Re-pinned 2026-10-14 (skyscape: air combat): the mind's space seek keeps `rule.clearance` over the ground (read under
// it and ahead); on the `controllable` fixture 13 lines are added and none changed, gated on the key. The same 13, and
// shoot-live.
// Re-pinned 2026-10-14 (skyscape: missiles, boost, roll): the weapon system's opt-in `rule.missiles` (a lock, homing
// rounds, flares; `noGround` and `hitsAs` on a round), the fly rule's opt-in `boost` and `roll`, the input's `missile`
// and `flare` (and the pilot scheme's two vehicle actions for them). On the `controllable` fixture 7 lines are replaced
// (the input's zero, thrust, tilt, the ground test, a burst's hit count, the exports, the scheme) and 101 added; every
// replaced line reads an absent key the old way. The same 13, and shoot-live.
// Re-pinned 2026-10-15 (follow camera: the subject's own stand-off): the page's wall pull-in reads its stand-off and
// floor off the followed body (controllable/follow-pull-in.js, inlined by source) in place of a fixed 3 m and 0.15, so
// a small hero's camera never ends inside it. On every one of the 14 fixtures that embed the controllable runtime the
// diff is that region alone, the same 2 lines replaced and 11 added; a person's and a suit's framing is unchanged.
// Re-pinned 2026-10-15 (first-frame checks): a CAPTURE page's bridge gained `view()` (the camera as rendered: eye,
// direction, fov, aspect), which the first-frame check reads (lib/graph/game/first-frame-check.js). Emitted only when
// `capture` is set: the five capture fixtures (capture-bare, capture-controllable, kitchen-sink-capture, fog-effects,
// shoot-set-capture) gain 6 lines and change none; every live page stays byte-identical.
// Re-pinned 2026-10-19 (more than meets: forms): the engine gains controllable/forms.js (a body with `forms` and the
// transform beat, after the maneuvers), the input's zero its `transform`, and the pilot scheme its `transform` action
// (B, the pad's L3) and two legend rows. Everything else the page does with forms (the press edge, the clip of each
// form, a flying form's attitude, the fly HUD for a jet form) is gated on an entity or figure that carries `forms`,
// which no fixture holds. Proof: the 14 fixtures that embed the runtime, emitted before and after with the engine
// source and the pilot scheme cut out, are byte-identical.
// Re-pinned 2026-10-19 (city hunter: the wall): the controllable runtime the page embeds gained the `wall` builder
// (worlds/controllable/wall.js: a platform body with `rule.wall` holds any collider's face, crawls it, rounds its
// corners, mantles onto its roof, jumps or launches off it; the `wall-pose` pass), and normalizeColliders keeps a box's
// `hold: false`. On the `controllable` fixture 1 line is replaced (the collider record, the same without `hold`) and
// 176 added. The same 14 fixtures that embed the runtime re-pinned with it; no page asks for the wall yet.
// Re-pinned 2026-10-19 (city hunter: the swinger): the runtime gained the `swing` builder (worlds/controllable/swing.js:
// a platform body with `rule.gear` casts the swinger's line to a face above and ahead, swings under it, zips to it; the
// `gear-pose` pass). On the `controllable` fixture 158 lines are added and none changed; the page's line drawer is
// emitted only where a body has a gear, so no fixture carries it. The same 14 re-pinned.
// Re-pinned 2026-10-19 (city hunter: indoors): the swinger also casts to a box's underside over the hero (a ceiling, a
// beam), aimed where its ideal ray meets that plane, its clearance shrinking with the room and no line shorter than the
// hero; the wall holds the head under a lid (a ceiling) as it climbs. On the `controllable` fixture 5 lines replaced
// (each reads the same with no gear or wall) and 32 added. The same 14 re-pinned.
// Re-pinned 2026-10-19 (city hunter: the reach): the wall and the gear hand their dials to the reach solver
// (E.wallDials, E.gearOf: game/reach.js), and the swinger's line is reeled in at `reel` from the cast's length instead of
// snapping to its own across the gap. On the `controllable` fixture 3 lines replaced (each the same with no gear) and
// 7 added. The same 14 re-pinned.
// Re-pinned 2026-10-20 merging 1019-city-hunter over more-than-meets and the resolution lock: the runtime carries the
// forms and the runner beside the wall and the swinger; each side's own re-pin above says what it adds and that no
// fixture asks for it.
// Re-pinned 2026-10-22 (ground acceleration): `platform` accel / decel (the drive) and the 'drive-stop' suppressed tick,
// gated on `accel`; the controllable trace pins hold. 14 of the 69 fixtures (the controllable pages) change, and every
// changed line is the platform rule's own source; the other 55 are byte-identical.
// Re-pinned 2026-10-23 merging 1018-consolidated into 1021-action-game-unification (1023-consolidated): the runtime
// carries both sides' additions (the forms, the wall, the swinger, the runner; the drive and 'drive-stop'), each side's re-pin
// above says what it adds and that no fixture asks for it; the versus channel's page carries the lock supers' source.
// Re-pinned 2026-10-23 (fight kinds): the `versus` fixture alone, its embedded versus-core gaining the gatling and the air
// actions (airdash, airjump: rules-gated, no fixture switches them on), readRules' `kind`, and the runtime client's swing
// trails (drawn only with a kind's look, which no fixture names), the reset system and its banner, and iron's systems
// (limbs, strings, bound, sidestep) with the sidestep's pose and the bound's spark; every other page is unchanged.

const sha = (s) => createHash('sha256').update(s).digest('hex');

// Re-pinned 2026-10-24 (local multiplayer phase 2: the controller seams): the pilot scheme the page embeds binds a pad
// to reverse view (D-pad down) and the watch controls (RB or D-pad right, A), and the runtime reads them on their press
// edges through `__padNow` (the pilot's pad, else the first connected). On the `controllable` fixture 2 lines are
// replaced (the scheme's JSON, the mapping comment) and 17 added; every fixture that embeds the runtime re-pinned with it.

// Re-pinned 2026-10-24 (local multiplayer phase 2: versus through the controls kernel): the `versus` fixture alone. Its
// embedded runtime now leads with the controls kernel, the keyboard and gamepad families and the `versus` scheme
// resolved for each player (player two's keyboard an override), and `rawInput` reads through them, a player's pad kept
// by its Gamepad.index; the hand-written key lists and button numbers are gone.

describe('emitThreeWorld characterization (byte-level pin over the fixture matrix)', () => {
  it.each(EMIT_FIXTURES.map(([name]) => name))('%s emits byte-identically', (name) => {
    const [, opts] = EMIT_FIXTURES.find(([n]) => n === name);
    expect(sha(emitThreeWorld(opts))).toMatchSnapshot();
  });

  it('emission is deterministic (two calls, same bytes) for every fixture', () => {
    for (const [name, opts] of EMIT_FIXTURES) {
      expect(emitThreeWorld(opts), name).toBe(emitThreeWorld(opts));
    }
  });
});
