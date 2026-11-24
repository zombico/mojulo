// Re-pinned 2026-11-18 (the open city's shops and guns): every fixture that embeds the controllable runtime. A weapon
// may start with fewer rounds than it holds (combat-ranged.js `loaded`), the cast gains `repaint` (a respray), and a
// moveset's hero may carry its sidearm in a holster (combat-melee.js `holster`, its trigger in combat-ranged.js). Each
// is taken only by a weapon, an op or a rule that names it (no fixture's does): their worlds step as before.
// Re-pinned 2026-11-17 (the street's health): every fixture that embeds the controllable runtime. A police car's hold
// is its own count (rules-drive.js `chaser`: `helds`, `heldBy`) and the cast's facts raise it as `held:<id>` (cast.js
// castFacts: one field more per body), so a hold is no hit. A body that is never held raises nothing new.
// Re-pinned 2026-11-17 (the law's police cars): every fixture that embeds the controllable runtime. The drive builder
// gained the `chaser` rule (rules-drive.js), the cast its `dismount` op and a `near` spawn's car reset, the mount step its
// `eject` and a `carHull`'s place among the hulls, and the runtime keeps `posts`, `carBody` and `carHull` (two
// normalizers). Each is taken only by an entity or an op that names it (no fixture's does): their worlds step as before.
// Re-pinned 2026-11-17 (the open city's wanted level): every fixture that embeds the controllable runtime. The cast's
// `spawn` gained `near` and `ring` (worlds/controllable/cast.js: a body set down at a ring's distance from another, on
// one of its own `posts`, the law's police), a branch taken only by an op that names `near` (no fixture's does): their
// worlds step as before.
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
// Re-pinned 2026-11-20 (start screens, mana-ui's letters): `brawl`, `mission` and `holo`, the pages that embed the game UI
// runtime: its text takes `letters` (a display entering letter by letter) and its kernel source carries the split. No
// page here draws letters (their sheet, lettersCss, is laid only by the play shell's title and the board); they draw as before.
// Re-pinned 2026-11-18 (1116-rc's lens merged into Hijack City): `brawl`, `mission` and `holo`, the runtime they embed
// now carrying both the candidate's lens and this branch's "No ammo" word.
// Re-pinned 2026-11-18 (Hijack City, mana-ui's magazine): `brawl`, `mission` and `holo`, the pages that embed the game UI
// runtime whole. Its magazine says "No ammo" for a gun empty with none in reserve (kernel.js: one word, one condition).
// Re-pinned 2026-11-18 (the release candidate merged into gen 7's city): the candidate's pins moved by this branch's
// emission changes since the last merge: the passers-by drawn where seen and one mesh each (channels/walkers.js), the
// occlusion prepass's reach (channels/creases.js), the cab's sounds (channels/audio.js), the level's save and the event
// bus's city rows (channels/game.js), the walkers that react and the patrol (cab-pool.js). Nothing else moved.
// Re-pinned 2026-11-18 (gen 7's city frame, channels/creases.js OCCLUSION_FAR): `occlusion` only. A page with occlusion
// alone leaves a mesh wholly past 240 reaches of the camera out of the prepass; the creases' rows read the far and are
// unchanged.
// Re-pinned 2026-11-17 (a rider's footsteps): the audio channel's footsteps skip a body that rides (in a car, in a
// saddle) or is gone: a carried body was heard walking under its ride.
// Re-pinned 2026-11-17 (the release candidate merged into the open city): the candidate's pins moved by this branch's
// two changes below (the event bus's zone rule; mana-ui's map, now with a side's turf as a shape kind).
// Re-pinned 2026-11-17 (mana-ui's map): the game UI runtime and its sheet, which a page with a mana screen embeds whole,
// gained the `map` component (kernel.js: a catalogue row and its draw; css.js: its rules), the corner radar and the map
// screen idioms. The two fixtures that embed the runtime (brawl, holo) re-pinned; they draw as before.
// Re-pinned 2026-11-16 (the open city: a driver in a cab stands in zones where its car is): the event bus the page
// embeds reads a body sent away that rides in a cab as present (worlds/event-bus.js deriveZoneEvents: one line replaced),
// so an errand is done from a car. Every fixture that embeds the bus re-pinned; the pages draw and play as before.
// Re-pinned 2026-11-14 (the action RPG: foes that never lock blades, steps at their own level): the runtime's melee
// contact reads `rule.clash === false` on either body before a clash (combat-melee.js: one line replaced in place; a
// rule that says nothing clashes as before), and the audio channel plays a step at `footsteps.gain` (audio.js: one
// line replaced; no gain, a cue's own level as before). Every fixture that embeds the controllable runtime or the
// audio channel re-pinned with it.
// Then (the input map): the pilot scheme's pause legend gained a moveset's rows (schemes.js: its attacks, its
// sidearm, its specials, its guard; `fire` hidden beside them) and the legend's flags say `moveset` and `sidearm`
// (controllable/index.js: one line added); the same fixtures re-pinned again.
// Then (the special on Q): a moveset's special is read on its key beside the mouse and the pad, and its key never
// strafes (controllable/index.js: two lines replaced on a page with a moveset; any other page as it was); the
// scheme's legend says so. The same fixtures re-pinned again.
// Then (the HUD grammar): the radar's wrap carries a class a HUD can hide it by (controllable/index.js: one line
// replaced; it draws as before). The same fixtures re-pinned again.
// Then (one card lane): the guide gives what it says as data (guide.js `view()`) and stays down beside a HUD grammar
// (its `put` gained the data and the check). Any fixture with a guide re-pinned.
// Then (Esc asks for the menu): a level a shell plays tells it when Esc is pressed there or the captured mouse is
// let go (scene-three.js: a block added before the pause's listener, inert on a page with no parent). Every fixture
// re-pinned.
// Then (foes that are never floored): a knockdown on a living body whose `rule.topple === false` reels it
// (combat-hit.js armReaction: one line added); the same fixtures re-pinned again.
//
// Re-pinned 2026-11-07 (the action RPG: a hero's sprint on its stamina, the orbit camera): the runtime the page embeds
// gained the platform rule's `sprint` (the boost held as a walker's sprint on its gauge: rules-platform.js) and its
// `moveYaw: 'camera'`, and the follow rule's `orbit` (rules-basic.js). On the `controllable` fixture 35 lines are added
// and 9 replaced in place (each a `sprints`/`moveYaw` guard on an existing line); a rule with neither runs as before.
// Every fixture that embeds the controllable runtime re-pinned with it. Then (the controls): the sprint's own `sprint`
// clip on its `sprintStride` (the stride's line guarded) and the orbit's swing round a locked foe (`lockTrack`): a few
// more lines added, one replaced; the same fixtures re-pinned again.
// Then (2026-11-15, merged with the release candidate's stylish action rails): the candidate's style meter, loadout and
// switch cancel and this theme's runtime lines (the stagger, the clash opt-out, Esc's menu post) each change what a page
// embeds; neither side's snapshot holds the sum, so every fixture is re-pinned on the merged runtime.
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
// Re-pinned 2026-10-25 (battle city: the ball's air): the physics integrator the page embeds (worlds/physics-sim.js,
// inlined by source) gained the `aero` force rule (a sphere in real air: the drag crisis and Magnus lift, the flight
// model's curves; `on` the bodies it acts on; its spin decay in step). The six fixtures that embed the integrator
// (physics, physics-actions, events, events-hud, kitchen-sink, kitchen-sink-capture) re-pin with its source, additions
// only; a world with no `aero` force integrates every byte as before (physics-sim.test.js), and the other 65 pages are
// byte-identical.
// Pinned 2026-10-25 (battle city: the meet): the `meet` fixture joins the matrix (an athletic meet on a track: the meet
// block, inlining the contest kernel, the meet sim and the arena client, its own frame step `stepContest`, the camera
// owned). A new fixture only: every other page is byte-identical, and a page without a `meet` key emits no block.
// Pinned 2026-10-25 (battle city: the court): the `court` fixture joins the matrix (a net game on a court: the court
// block, inlining the ball's flight, the ball card, the swing system, the hit, the physics integrator, the contest
// kernel, the court mind, the match sim and the arena client, its own frame step `stepCourt`, the camera owned). The
// `meet` fixture re-pins with the kernel's source (its double-bounce rule: a ball bounced in and never returned is the
// striker's point, in the bounce and the out branches), additions only; every other page is byte-identical, and a page
// without a `court` key emits no block.
// Pinned 2026-10-25 (battle city: the turn sports): the `turns` fixture joins the matrix (a turn sport on a course: the
// turns block, inlining the same physics and hit modules, the kernel, the minds, the turn sim and its arena client, its
// own frame step `stepTurnSport`, the camera owned). The `meet` and `court` fixtures re-pin with the kernel's source (the
// turns shape joins the closure) and the court with the minds' (the turn mind and the positional mind join the court
// mind's module) and the hit's (the turn sports' verbs), additions only; every other page is byte-identical, and a page
// without a `turns` key emits no block.
// Pinned 2026-10-25 (battle city: the team game): the `pitch` fixture joins the matrix (a team goal game on a pitch:
// the pitch block, inlining the same physics and hit modules, the kernel, the minds, the team sim and its arena
// client, its own frame step `stepPitch`, the camera owned). The `meet`, `court` and `turns` fixtures re-pin with the
// kernel's source (a goal game's outs and offside join the match shape), the court and the turns with the minds' (the
// team mind joins the module) and the hit's (the kick's curl), additions only; every other page is byte-identical,
// and a page without a `pitch` key emits no block.
// Pinned 2026-10-25 (battle city: the door): the `meet`, `court` and `turns` fixtures re-pin for their arenas' rooms
// rounded up to even metres (the stage kind's one-metre grid, met when the first quick game minted one), which moves
// the page's own data (the room, the court's origin on the stage); the `pitch` room was on the grid already. Every
// other page is byte-identical.
// Pinned 2026-10-26 (battle city: the athletes): the `meet`, `court`, `turns` and `pitch` fixtures re-pin for their
// clients' source (each draws a slot's athlete in its own body when the arena carries bodies; the fixtures carry none,
// so no figure module is inlined). Every other page is byte-identical.
// Pinned 2026-10-26 (battle city: the holo lift): the `holo` fixture joins the matrix (a board game lifted into a
// hologram arena: the tabletop kernel and its mind from their closures and the arena's client in one block, its own
// frame step `stepHolo`, the camera owned). Every other page is byte-identical, and a page without a `holo` key emits
// no block.
// Re-pinned 2026-10-26 (battle city: the court's surface): the `court` fixture re-pins for the match sim's source (the
// floor reads the court's surface when the arena names one); a court without one plays as before. Every other page is
// byte-identical.
// Re-pinned 2026-10-26 (battle city: the stats): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because each
// contest block now inlines contest/contest-stats.js (the stats folded from the sim's calls) before the broadcast client,
// which gains the stats panel, and the page's data carries the coverage (`broadcast.stats`). Every other page is
// byte-identical.
// Re-pinned 2026-10-26 (tv animator: the broadcast package): the `meet`, `court`, `turns` and `pitch` fixtures re-pin
// because each contest block now inlines broadcast/broadcast.client.js before its arena client, the arena clients draw
// their overlay through it (the bug, the call plates, the closeup, the board) and the page's data carries the resolved
// package (`broadcast`: the card, the colours, the metals, the cues). Every other page is byte-identical.
// Re-pinned 2026-10-26 (arcade rules: the net family): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because
// the modules every contest block inlines by source changed: the kernel (the own-bounce serve, the box by the server's
// score, the two-bounce rule, a no-bounce rally's point called `down`), the ball card (the pickleball, the shuttle's own
// air), the hit (the underhand, clear and drop verbs, the aim through a ball's own air), the stats (`down` a winner)
// and the broadcast's words; the court block's sim, mind and client too (the raised bed, the body's scale, the
// no-volley foul, the slip, the ladder's scoreboard). Every other page is byte-identical.
// Re-pinned 2026-10-26 (arcade rules: volleyball): the `court`, `turns` and `pitch` fixtures re-pin because the minds
// (the side mind for a side of more than one) and the hit's verbs (the float serve) they inline changed, and the court's
// sim and client too (the players from the kernel's, the active player, the placed pass, the side's colours, bare
// hands). The meet inlines neither and is unchanged; every other page is byte-identical.
// Re-pinned 2026-10-26 (arcade rules: basketball): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because the
// kernel every contest block inlines reads a score fact's points, the broadcast client calls a basket by them and the
// stats count them, and the minds (the hands mind) the court, turns and pitch inline; the pitch block's sim and client
// too (the hoop, the hands, the hardwood). Every other page is byte-identical.
// Re-pinned 2026-10-26 (arcade rules: the carry games): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because
// the kernel every contest block inlines reads a carry game (its plays, tackles, downs, passes, try and conversion), the
// broadcast's cues and plates name its calls and the stats count its conversion, and the minds (the carry mind, its role
// lines) the court, turns and pitch inline; the pitch block's sim and client too (the carry mode, the field's lines, the
// posts, the line markers, the oval). Every other page is byte-identical.
// Added 2026-10-31 (broadcasting personas): the `broadcasts` fixture pins a persona's read on a screen in the world (the
// screens block, `stepBroadcasts`); every other fixture is as it was (the row is appended, zero bytes when absent).
//
// Re-pinned 2026-10-26 (arcade rules: the innings games): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because
// the kernel every contest block inlines reads an innings game (strikes, outs, the bases or the runs, the overs, the side
// retired), the broadcast's cues and plates name its calls and the stats fold counts them; the new `innings` fixture pins
// the field's page (the bat sim, the diamond and the oval). Every other page is byte-identical.
// Re-pinned 2026-10-26 (sport concept: the arena and the cast): the `pitch` fixture re-pins because the pitch client calls a
// hoop game's restart a tip-off or an inbound, never a kick-off. Every other page is byte-identical.
// Re-pinned 2026-10-26 (review fixes): the `meet`, `court`, `turns` and `pitch` fixtures re-pin because every contest
// block inlines contest/contest-stats.js by source, and a serve's speed and opening hit are now read from the hit before
// its call; the pitch block's sim leaves the rink's goal mouths open in its end boards. Every other page is
// byte-identical.

const sha = (s) => createHash('sha256').update(s).digest('hex');

// Re-pinned 2026-10-24 (local multiplayer phase 2: the controller seams): the pilot scheme the page embeds binds a pad
// to reverse view (D-pad down) and the watch controls (RB or D-pad right, A), and the runtime reads them on their press
// edges through `__padNow` (the pilot's pad, else the first connected). On the `controllable` fixture 2 lines are
// replaced (the scheme's JSON, the mapping comment) and 17 added; every fixture that embeds the runtime re-pinned with it.

// Re-pinned 2026-10-24 (local multiplayer phase 2: versus through the controls kernel): the `versus` fixture alone. Its
// embedded runtime now leads with the controls kernel, the keyboard and gamepad families and the `versus` scheme
// resolved for each player (player two's keyboard an override), and `rawInput` reads through them, a player's pad kept
// by its Gamepad.index; the hand-written key lists and button numbers are gone.

// Re-pinned 2026-10-24 (local multiplayer phase 3: the seats): the `versus` fixture alone. Its runtime leads with the
// seats kernel beside the controls kernel, the second keyboard's override is gone, and `rawInput` reads each player's
// seat (a controller each, polled from menuInput); the arena client's pause is the seat's that opened it.

// Re-pinned 2026-10-24 (pilots, phase 1: the sim seats): the runtime the page embeds reads `spec.seats` (absent here) into
// `seatOf`, hands each body its own seat's input through `seatInput`, and the rules' "is this input mine" tests and the
// mind's target add a seated body (`seated`, `nearestPilot`); a 'seats' pre-step. On the `controllable` fixture 15 lines
// are replaced by their seat-aware forms and 56 added; every fixture that embeds the runtime re-pinned with it. A world
// without seats steps as before (worlds/controllable/seats.test.js, and every sim suite unchanged).

// Re-pinned 2026-10-24 (pilots, phase 2: the group frame): the side and overhead cameras the runtime embeds hold the
// group of playing seats (`groupFrame`) when a world seats more than one, and a 'group-leash' world pass keeps them inside
// the frame's reach. On the `controllable` fixture 4 lines are replaced (the two cameras' framing) and 40 added; every
// fixture that embeds the runtime re-pinned with it. One seat, or none: the cameras frame their target as before.

// Re-pinned 2026-10-24 (pilots, phase 4: the lowering): the runtime the page embeds keeps a seat's `floor` (a seated body
// below it comes back above seat 1, in the 'seats' pre-step) and its suit swap skips a seated body. On the `controllable`
// fixture 5 lines are replaced (the seats comment, the swap's list, the pre-step's close) and 14 written in their place;
// every fixture that embeds the runtime re-pinned with it. A world without seats steps as before.

// Re-pinned 2026-10-25 (lives per seat): the runtime the page embeds counts a world's seat lives (`seats.lives`, `pool`)
// and moves a seated body's fall from the 'seats' pre-step into a 'seat-falls' world pass (back beside a playing seat, a
// life spent, a seat out at none), and its shared camera frames a lone playing seat that is not its target. On the
// `controllable` fixture 11 lines are replaced and 48 written in their place; every fixture that embeds the runtime
// re-pinned with it. A world without seats steps as before.

// Pinned 2026-10-25 (live light, phases 1 and 2: actor shadows, the hour's map): three new rows (`live-shadows-actors`,
// `live-shadows-hour`, `live-shadows-both`) and no existing hash moved. A face's `sunShare` is packed, and the live
// shadow block written, only when a world's `shadows` asks for `actors` or `hour`.

// Pinned 2026-10-25 (live light, phase 3: occlusion on the shared prepass): two new rows (`occlusion`,
// `occlusion-creases`) and no existing hash moved. Without `occlusion` the creases' block is the one it was.
// Re-pinned 2026-10-25 (live light, the probe binding): `occlusion` and `occlusion-creases` only. The occlusion block
// binds the shared __mojLight probe as __crLight, since the live light's script declares __mojLight on the same page.

// Re-pinned 2026-10-25 (live light, the actors' box at the feet): `live-shadows-actors`, `live-shadows-hour` and
// `live-shadows-both` only. The actors' box follows a focus the pass before every render asks (captures included), its
// default span is 12 m (was 30), its bias a contact's 5 mm (was 2 cm), and an adopted subtree casts both its sides; the
// hour-only row moves with the span in its config and the seam's no-op `focus`. No other hash moved.

// Re-pinned 2026-10-25 (live light, cutouts in the occlusion prepass): `occlusion` and `occlusion-creases` only. The
// prepass draws an alpha-tested mesh (a leaf card, a grass clump) with an override that samples its map's alpha and
// discards under its alphaTest, so its transparent texels no longer occlude as a rectangle. The creases' own block
// (creases without occlusion) is unchanged.

// Re-pinned 2026-10-26 (live light defaults): `live-shadows-actors`, `live-shadows-hour` and `live-shadows-both` only.
// The actors' box is 16 m by default (was 12), led 8 m ahead along the camera's ground with one focus (`lead`); the
// hour's map reads its receiver's slope into its bias (`csLitR`: no moire under a low sun), and the `hour` seam's comment
// says the sun does not move. The occlusion rows are unchanged (the half tier's strings are written only with a tier),
// and so is every other hash: the defaults resolve in world-scene, never in the emitter.

// Re-pinned 2026-10-29 (merge fixes: no plan citations in tracked code): every fixture that embeds the controllable
// runtime. Three comments inside its serialized rules (core.js SEATS, rules-basic.js THE GROUP FRAME and SEAT FALLS)
// cited a plan file, which CLAUDE.md forbids; on `kitchen-sink` the diff is those three comment lines and nothing else.
// Re-pinned 2026-10-28 (the prepass sees the wind): `creases`, `creases-outline`, `occlusion` and `occlusion-creases`
// only. The prepass draws a material that moves its vertices (a plant's wind, a spray's growth) by the vertex shader it
// names (`userData.prepass`), so its occlusion and ink fall where the frame draws it, not beside it where it would
// stand still. A page without such a material draws every mesh as before.
// Re-pinned 2026-11-01 (game breakers): `court`, `turns`, `pitch`, `meet`, `innings`, `versus` and `holo` only. Each
// arena's client posts its outcome with the wire's `contractVersion`, which the play shell requires to apply it (it
// refused every match's outcome before); the contest kernel the court, turns, pitch, meet and innings inline takes a
// ladder's `tiebreak` (tennis's set at six all). No other page inlines an arena client or the kernel.
// Re-pinned 2026-11-02 (the book tells the truth): every fixture that embeds the controllable runtime, and every capture
// page. The follow camera's pull-in (follow-pull-in.js, inlined by its source) stands the eye half a metre off a wall
// instead of the 3 m stand-off, never farther out than the open line (with nothing in the way it frames as before); a
// capture page's view() hands out the level's background colour and its controllable bodies (the first-frame gate reads
// both). A live page with no follow camera is unchanged.
// Re-pinned 2026-11-02 (the manual manipulator's controllers: poses are input): `xr` and `walk-xr` only. The headset's
// driver (controls/xr-driver.js, inlined by its source on a page with `xr`) reads the poses OpenXR names beside the
// sticks (`xrPoses`, `poseToWorld`, `turn`): additions only. No other page carries the driver; neither fixture has a
// pilot, so neither carries the game-in-the-headset branch (channels/xr.js `ctrl`).
// Re-pinned 2026-11-02 (the manual manipulator's controllers: a shot from the hand): every fixture that embeds the
// controllable runtime (the 16: controllable, its lock, shadows, smoke, figure and hangar, cast-shadows, the two
// live-shadows with actors, fx, shoot-live, the two toon-ink, capture-controllable and both kitchen sinks), for the
// ranged weapon's opt-in `input.aim` (combat-ranged.js stepWeapon: a headset's held muzzle or controller ray, the round
// leaving from it along it): additions only, and an input without `aim` fires as before.
// Re-pinned 2026-11-02 (the world clock): `shoot-live` only. A live plan's camera gizmos take no raycast (shoot.js
// `__shOver`): the controllable's ground probe raycast the whole scene and threw on the frustum's lines before its camera
// was posed, stopping a live world with a shoot plan on its first frame. A plan that is not live emits as it did.
// Re-pinned 2026-11-03 (the controllers merged over the world clock): `shoot-live` only, for the two above together (it
// embeds the controllable runtime, so it carries the ranged weapon's opt-in aim and the gizmos' raycast skip at once).

// Re-pinned 2026-11-02 (book powers): every fixture that embeds the controllable runtime, and those only. The cast's
// beam (worlds/controllable/cast.js) takes `to: { nearest: { range?, cone? } }` (the nearest standing foe in front of
// its caster) and `hurt` (the hp it takes as it lands, in castFacts beside the struck fact), so a power's attack lands;
// a beam with neither plays as before.
// Re-pinned 2026-11-02 again (book powers), the same fixtures: a beam's `hurt` may be `{ by: 'power', per, base }`, its
// caster's power stat as it fires (the stats bound to its body) × per, or base where it has none, so an attack follows
// the power stat as the levels raise it; a number plays as before.
// Re-pinned 2026-11-03 (fighter wiring): `versus` only. Its page inlines versus-compile.js by its source, which gains a
// character's own strikes (`compileHeroNormal`, a normal `{ hero: track }`) and a fighter's own guard (`recipe.guard`):
// additions only, and a fighter naming neither compiles as before.
// Re-pinned 2026-11-04 (fighter wiring: the real models in the arena): `versus` only. Its page inlines
// versus-arena.client.js and versus-compile.js by their source: a character played in its own body (makePlayed,
// playedClip, placePlayed, its body's pack `played`) and each own strike's frame naming its clip's moment (`u`).
// Additions only: the fixture's fighters are stick figures, drawn as before. Re-pinned again the same day (the ring):
// a played body lit (its normals, its relief, a lit material, the fighters' lights) and an arena's `set: 'ring'` built
// on its floor with its veil and its nearer camera; the fixture names no set and no lit body. And again (bodies drawn
// apart): a played knockdown's root slide taken off (PINNED) and a body held in a throw drawn where the push boxes touch
// (drawnAt); drawing only, the fight's state unchanged. Its versus-compile.js: a fighter in its own guard (`recipe.guard`)
// pushes with its legs too; the fixture's fighters name no guard. And again (every style on its own body): a played
// body the fight poses where it has no clip (placeFromPose: the figure's segments onto its bones, its hands its guard's),
// a character's recipe pushing with its legs (`bodyPush`), the watch's CPUs at the picks' level (`cpu`); the fixture's
// fighters are no characters and name no level; its versus-react.js, a body out cold lying on its back (LIMP), which
// the fixture's fight draws only at a knockout; and the arena's fight read off the page's clock in milliseconds (it had
// read them as seconds, six fight frames a drawn frame).
// Re-pinned 2026-11-07 (1107-fg-remake: a fight on any level, by its lane): `versus` only. Its page inlines
// versus-arena.client.js by its source, which now draws the whole fight in the lane's frame (versus/versus-lane.js): a
// group set at the lane's centre on its floor and turned by its heading, every fight object in it, the camera, the
// overlay's projection and the lit bodies' key mapped through it, a lane's `back` capping the camera. The fixture's
// arena names no lane: its plane at heading 0, the group only lifting the fight where it always stood.
// Re-pinned 2026-11-08 (1107-fg-remake: the anime register in the fight): `versus` only. Its page inlines
// versus-arena.client.js by its source, which gains a TOON body (versus-character.js toonBody: a character drawn in the
// character light, its lit and shade tones baked per corner), stepped by the arena's key in a toon material so both
// fighters are lit from the camera's side. The fixture's fighters are stick figures, drawn as before.
// Re-pinned 2026-11-05 (1105-rpg-slice: a packed page packs its plain groups): `live-shadows-actors` only, the one
// fixture laid with `pack: true`. Its plain groups ride their positions on a uint16 grid and their colours as sRGB bytes
// (packGroupArrays), decoded by the page to the same Float32Arrays; every fixture without `pack` is unchanged.
// Re-pinned 2026-11-05 (1105-rpg-slice: no NUL byte in a page): `events`, `events-hud`, `shoot-live`, `kitchen-sink`
// and `kitchen-sink-capture`, the fixtures that inline the event bus. Its saga key joined an id and a scope with a raw NUL
// byte written into the source (event-bus.js), so every page carrying the bus held a NUL, and an artifact host refused
// it; it is written `'\x00'`, the same string at run time.
// Re-pinned 2026-11-05 (1104-vayo-effects: natural knockback): every fixture with a controllable world (`controllable`,
// `controllable-lock`, `-shadows`, `-smoke`, `-figure`, `-hangar`, `cast-shadows`, `live-shadows-actors`, `-both`, `fx`,
// `shoot-live`, `toon-ink-controllable`, `toon-ink-fx`, `capture-controllable`, `kitchen-sink`, `kitchen-sink-capture`).
// The combat builders the page inlines by their source gain the knockback seams (combat-ranged.js, combat-melee.js,
// cast.js: a burst's splash share and its knock on the record, a shot's, a swing's and a beam's push), each a no-op
// without the knock builder (worlds/controllable/knock.js), which none of these fixtures emits: their worlds step as before
// (knock.test.js steps one byte for byte against the engine without it).
// Re-pinned 2026-11-05 (1105-platformer-lv0-spike: the hero's own jumps): every fixture that embeds the controllable
// runtime. The platform rule gained its `takes` (a feel's: the hero's jumps played on its flight, their squash and
// stretch); on the `controllable` fixture 2 lines are replaced (the air jump marks itself) and 57 added. Absent `takes`
// the branch never runs, and the renderer's squash is emitted only for a rule that carries one (no fixture does).
// Re-pinned 2026-11-05 (1105-platformer-lv0-spike: the card's wall and dash): the same fixtures. The platform rule gained
// the wall kick (before the air jump), the dash on a person's F, the kick and the dash owning the horizontal step, the
// wall slide off the blocking pass's push-out, and gravity held on the wall and in an air dash. Absent `cling` and `dash`
// every branch is skipped: the replaced line is the vertical integrate, its gravity now the last of three arms.
// Re-pinned 2026-11-05 (1105-platformer-lv0-spike: a 3D platformer's chase): the same fixtures. The follow camera gained
// its `steer` (its own yaw, trail or orbit, and a vertical deadzone), the world its `cameraYaw` getter, and the platform
// rule `move: 'camera'`. Absent `steer` the chase reads the heading and the target's height as before.
// Re-pinned 2026-11-05 (1105-platformer-lv0-spike merging 1104-vayo-effects' knockback): the same fixtures, their
// emission the two re-pins above together (the platform rule's takes, wall, dash and camera move; the combat builders'
// knockback seams), each a no-op without its own opt-in.
// Re-pinned 2026-11-05 (1105-rpg-slice: the pixel budget): the 14 fixtures that embed the controllable runtime, every
// page played live. Their density line becomes the budget's (capped at 1.5, the frame's time stepping it a quarter, the
// `__budget(t)` call after each render); nothing else in them moved. No fixture's figure is a plain rigid rig, so none
// carries the merged builder (merged-figure.js, its own tests).
// Re-pinned 2026-11-06 (1105-rpg-slice: rays by grid): the 16 fixtures that embed the controllable runtime (the 14 played
// live and the two captures). Their ground hook gains the grid raycast (ground-grid.js, by its source, its own tests) and
// hands every big static mesh to it at the first probe; nothing else in them moved.
// Re-pinned 2026-11-06 (1105-rpg-slice: grass out of the prepass): `creases`, `creases-outline`, `occlusion` and
// `occlusion-creases`, the fixtures that carry the creases' prepass. Its solid test skips a mesh marked `blades`
// (stage-grass.js marks its fields, tufts and cards), so a meadow is not drawn a second time; nothing else moved.
// Re-pinned 2026-11-06 (1105-rpg-slice: a party's footsteps): the 16 fixtures that embed the controllable runtime. Its
// minds (worlds/controllable/mind.js, inlined by its source) gained an escort that walks its ward's footsteps
// (`rule.trail`, `rule.flank`); no fixture's escort takes it, so nothing they play moved.
// Re-pinned 2026-11-06 (1105-rpg-slice: a walk compiled draws nothing): every fixture. The capture bridge every page
// carries steps without drawing when asked (`draw: false`: the walk compiler's legs, and a replay that keeps no
// frame), keeping the scene's transforms as a draw would; the bridge asks it, nothing a page plays moved.
// Re-pinned 2026-11-06 (1105-platformer-lv0-spike: a side camera on a course): the 16 fixtures that embed the controllable
// runtime. The side camera gained `band` (its height eased while the hero stands, held through a jump) and `ends` (the
// frame held in from the lane's ends), each a no-op absent; the i-frame shimmer dims a merged figure's one skin, not its
// bones, and the target rim (where a page carries it) draws a merged foe's on its skin, bound to its skeleton.
// Re-pinned 2026-11-06 (1105-platformer-lv0-spike: the dash a burst): the same 16 fixtures. The platform rule's dash is
// the card's frames long whatever the button does, up to its speed and eased back to the run's, a lunge for its pose
// (no strides), the air dash's fall stopped only while it is at speed; the held dash's branch is gone. Absent `dash`,
// nothing in it runs.
// Re-pinned 2026-11-06 (1105-platformer-lv0-spike: F is the feel's): the 16 controllable fixtures, and `versus`, `xr`
// and `walk-xr`, which embed the controls kernel. A rule with a feel's dash or run button (`sprint`, its build) owns F
// whatever its walk pace (a side lane's hero has none), never the thrusters; the pause legend's rows say the dash and
// the run, its `unless` taking a list; no radar under a side camera. Absent `dash` and `sprint`, F boosts as it did.
// Re-pinned 2026-11-06 (1105-platformer-lv0-spike: the side camera's ends on the chord): the 16 controllable fixtures.
// `ends` holds the frame along the lane's chord and turns the camera square to it near an end; absent `ends`, as it was.
// Re-pinned 2026-11-06 (1105-platformer-lv0-spike merging 1105-rpg-slice's pixel budget): the same fixtures, their
// emission the re-pins above together (the platform rule's takes, wall, dash and camera move; the knockback seams; the
// pixel budget of a page played live, one draw a figure).
// Re-pinned 2026-11-07 (1107-action-rpg merging 1105-rc): every fixture, the re-pins on both lines together (each line
// had already moved every fixture's bytes; the 19 that embed the controllable runtime or the controls kernel move
// again here); the
// action hero's sprint keeps its own word in the platform rule (`stamina`, beside the run button's `sprint`), and its
// orbit is the platformer's steered chase (rules-basic.js `steer: 'orbit'`), the lock-on swinging its yaw.
// Re-pinned 2026-11-07 (1107-action-rpg: the first look): the 16 fixtures that embed the controllable runtime. The follow
// camera gained `vista` (a level's opening: for its first seconds the chase stands high and looks at the place the level
// is about, eased back down), a no-op absent; no fixture's camera takes it, so nothing they play moved.
// Re-pinned 2026-11-08 (1107-action-rpg: the game look): the 16 fixtures that embed the controllable runtime. The pilot's
// hp panel and its gauge carry class names a HUD look restyles (mana-ui/theme.js gameHudCss), and the stamina gauge's
// dressing reads the platform rule's `stamina` (the merge had renamed it from `sprint`); nothing they play moved.
// Re-pinned 2026-11-08 (1107-action-rpg: combat): the 16 fixtures that embed the controllable runtime. The platform
// rule gained `combat` (a foe near, a lock or a blow: the guard's walk and its weapon drawn, else sheathed), a no-op
// absent; no fixture's rule takes it, so nothing they play moved.
// Re-pinned 2026-11-08 (1107-action-rpg: the wall's hold): the 16 fixtures that embed the controllable runtime. The wall
// (worlds/controllable/wall.js) reads `ground: false` as a leap since the body last stood, not merely a frame off the
// ground; no fixture's rule takes the wall, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the moveset): the 16 fixtures that embed the controllable runtime. The
// melee strike gained the moveset (gameworld/combos.js: a combo's beats chained at each move's cancel, its travel), the
// dodge rolls along the stick under world movement, and the pilot scheme names light, heavy and special in its `melee`
// context; no fixture's rule takes a moveset or moves on the world's frame, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the footwork): the 16 fixtures that embed the controllable runtime. A
// moveset's move plays its own clip (`mv_<id>`, or `_still` where its travel does not fit before the body ahead), its
// travel waits out the blend into it and a lunge's comes in two pieces (hero-swing-body.js travelAt); a moveset's hero
// idles in combat in its fighting stance (`idleClip`); no fixture's rule takes a moveset, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the weapons): the 16 fixtures that embed the controllable runtime. The
// moveset steps through `r.weapons` on the cycle (its stance, its figure, its reach), the combat stance shows a weapon's
// sheathed figure, and the pilot scheme binds the mouse's back button to the cycle; no fixture's rule takes weapons or
// a moveset, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the sidearms): the 16 fixtures that embed the controllable runtime. A
// ranged weapon may refuse an early release (`early: 'none'`, the bow) and never run dry (`infinite`, the pistols); a
// charged lob deals its charged damage; a moveset's S fires its weapon's sidearm, aimed at the locked or front foe
// (`mvAim`) and walking slower while it draws (`aimMove`). No fixture's rule takes a moveset, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the sidearms seen): the 16 fixtures that embed the controllable runtime. A
// moveset's S says the aim the page plays (`mvPose`: its clip, the draw's share), its sidearm's hand and pairing ride
// `mvRanged`, and the combat figure shows the sheathed hero while an aim is up; the page's aim layer, props and arrows
// are emitted only for a moveset. No fixture's rule takes a moveset, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: the aim on the target): the 16 fixtures that embed the controllable
// runtime. A moveset's sidearm aims at the foe's chest, not its middle; the page's aim layer (a moveset's only) turns the
// body onto the target. No fixture's rule takes a moveset, so nothing they play moved.
// Re-pinned 2026-11-08 (1108-practice-room: guard and parry): the 16 fixtures that embed the controllable runtime. A
// rule's `guard` (a feel card's, lowered) is held up against a blow from the front, a blade's or a foe's touch: blocked,
// or parried within its window, the attacker staggered for the riposte; the guard's walk and its pose. No fixture's rule
// takes a guard, so nothing they play moved.
// Re-pinned 2026-11-09 (1108-practice-room: no spamming): the 16 fixtures that embed the controllable runtime. A
// moveset's move keeps its `cooldown` before it opens a string again, and its `rest` holds every string after a
// finisher. No fixture's rule takes a moveset, so nothing they play moved.
// Re-pinned 2026-11-09 (1108-practice-room: a jump carries its takeoff): the 16 fixtures that embed the controllable
// runtime. A hero sprinting on its stamina keeps its sprint through the air (`airPace`) where the run's pace braked it;
// no fixture's rule sprints on a stamina, so nothing they play moved.
// Re-pinned 2026-11-09 (1108-practice-room: a jump held is one jump): the 16 fixtures that embed the controllable
// runtime. The jump buffer remembers a press's first frame (`jumpWas`) and a launch out of the gather consumes it, so a
// jump held through the gather no longer launches twice; the runtime they embed changed, their worlds as they were.
// Re-pinned 2026-11-09 (1108-practice-room: the launcher and the juggle): the 16 fixtures that embed the controllable
// runtime. The moveset reads back + heavy, an air tree, a rise and the air's hang and kick; a combo's juggle may recover
// in the air; a rise is not cut by the jump's release. All of it reads a moveset or a combo's `recover` no fixture
// names, so the runtime they embed changed, their worlds as they were.
// Re-pinned 2026-11-09 (1108-practice-room: a launcher easy to land): the 16 fixtures that embed the controllable
// runtime, and `court`, `turns` and `pitch`, which inline the swing system (hero-swing.js). The swing system gains a verb
// (`upswing`, a moveset's `up` swing only) and the runtime reads back against the engaged foe and holds a moveset move's
// facing; no fixture names a moveset, and no contest swings the new verb, so the sources they carry changed, their play
// as it was.
// Re-pinned 2026-11-09 (1108-practice-room: air moves facing the foe): the 16 fixtures that embed the controllable
// runtime. In the air a moveset's move plays its own clip, and a launch's thrown foe (`mvThrown`) turns the airborne hero
// to it; both read a moveset no fixture names, so the runtime they embed changed, their worlds as they were.
// Re-pinned 2026-11-09 (1108-practice-room: the sword arts): `court`, `turns` and `pitch`, which inline the swing system
// (hero-swing.js). The upswing (a moveset's launcher only) chambers its blade higher, off the floor under a body's crouch;
// no contest swings it, so the source they carry changed, their play as it was. The runtime is untouched.
// Re-pinned 2026-11-09 (1108-practice-room: the templates' kits): the 16 fixtures that embed the controllable runtime,
// and `court`, `turns` and `pitch`, which inline the swing system (hero-swing.js). A move's `arc` and `spin` (the spin
// attack: its blow all round, the body turned through it), the swing system's `around` (a moveset's level sweep, baked as
// a move's clip only), and the hitstop keeping the pilot's presses through its own freeze; no fixture names a moveset or
// taps through a freeze, so the sources they carry changed, their play as it was.
// Re-pinned 2026-11-08 (1107-fg-remake merging 1105-rc): `versus` only, its emission the re-pins above together (the
// candidate's runtime changes, and this branch's lane frame and toon body).
// Re-pinned 2026-11-08 (1107-fg-remake: the training ground): `versus` only. Its page inlines versus-arena.client.js by
// its source, which frames a level whose view is `near` (versus-levels.js, the training ground's) as it frames the ring;
// the fixture's arena names no view and is framed as before.
// Re-pinned 2026-11-08 (1107-fg-remake: priority, joint limits, the body kept out of itself): `versus` only. Its page
// inlines versus-core.js (a trade won by the higher priority), versus-rig.js (a pose held within RIG_LIMITS as it becomes
// joints), versus-figure.js (FIG_LIMITS and FIG_BULK in the round) and the runtime's PRIORITY flash.
// Re-pinned 2026-11-08 (1107-fg-remake: the fight's register): `versus` only. Its page inlines versus-arena.client.js,
// which lights every body one way under a register (a rig whose key casts, the renderer's shadows on); the fixture's
// arena names no register and lights its bodies as before.
// Re-pinned 2026-11-08 (1107-fg-remake: the fight's effects): `versus` only. Its page inlines versus-fx.js (the cards,
// the elements), versus-fx.client.js (drawn in the round under a register), versus-core.js (a blow's place, weight, limb
// and kind on its events; the spark system) and the runtime's sparks standing down where the arena draws them; the
// fixture's arena names no register and draws its sparks as before.
// Re-pinned 2026-11-08 (1107-fg-remake: the figure coated): `versus` only. Its page inlines versus-arena.client.js, whose
// register materials carry a fresnel coat (bodyCoat) the effects drive; the fixture's arena names no register.
// Re-pinned 2026-11-09 (1109-flow-runner, phase 2: the flow's sidecars): `game`, `kitchen-sink` and
// `kitchen-sink-capture`, the fixtures that embed the game channel. A hosted level says when its first frame is drawn
// (`game-shown`, two frames after ready) and when its end card is read (`game-card-done`: its time, a press after its
// first moment, or at once with no card), so the play shell's flow goes on by events. Additions only: 14 lines each,
// none removed.
// Re-pinned 2026-11-09 (1109-flow-runner, phase 3: the stage): `game`, `kitchen-sink` and `kitchen-sink-capture`, the
// fixtures that embed the game channel. Hosted, a level's scenes wait for the shell's params (`__mojWaitInit`, set as it
// says ready, cleared as it starts), and a stage the shell's flow asks for (`params.__stage`) is handed to the scene
// channel, or said missing at once by a level with no scenes. Additions only: 11 lines each, none removed.
// Re-pinned 2026-11-09 (1107-fg-remake: non-human fighters): `versus` only. Its page inlines versus-arena.client.js, whose
// posed character body is drawn in the register under one (the rig's material, its shadows, its coat, no ink hull), and
// versus-figure.js, whose face bones (lids, lips, brows, ears, a snout, horns) ride the head and a serpent's coil its
// hips then the ground (a `ground` segment, planted); the fixture's fighters are no characters and its arena names no
// register.
// Re-pinned 2026-11-09 (1107-fg-remake: a snout carried low): `versus` only. Its page inlines versus-rig.js (stoopPose),
// versus-compile.js (a stance's `stoop` sinking its rests) and versus-figure.js (a head posed over its own carriage, a
// beast's crown forward of its base kept); the fixture's fighters name no stoop and are no characters.
// Re-pinned 2026-11-09 (1107-fg-remake: the fight's sounds): `versus` only. Its page inlines versus-runtime.client.js,
// whose blows play the SFX shelf's cues where the page's audio channel carries them (fightCue, fightSound; the beep
// where it does not), and versus-arena.client.js, which starts the sound on a first key or touch; the fixture's arena
// names no register, carries no audio and beeps as before.
// Re-pinned 2026-11-09 (1107-fg-remake: the move primitives): `versus` only. Its page inlines versus-library.js (the
// overhead families, the traversal, charge and rekka specials, the airblock system), versus-compile.js (command normals,
// a charge's motion, a rekka's stages, a move that passes through or strikes nothing), versus-input.js (a command normal
// off the stick, a charge's hold) and versus-core.js (the charge kept, a rekka's next stage, the push boxes off while a
// body passes through, a block in the air) and versus-movelist.js (a fighter's moves as its player reads them); the
// fixture's fighters take none of them and fight as before.
// Re-pinned 2026-11-09 (1107-fg-remake: the lab): `versus` only. Its page inlines versus-arena.client.js (the lab's
// strips and its move list from the pause, under a register; the pause's items), versus-runtime.client.js (training's
// panel under the lab) and versus-core.js (a rekka's next stage on its motion's last direction and a button, typed
// through hitstop); the fixture's arena names no register and carries no lab.
// Re-pinned 2026-11-09 (1109-cosmos-contraction merging 1108-practice-room): `game`, `versus`, `kitchen-sink` and
// `kitchen-sink-capture`, the four whose pins both lines had moved: each side's pin held its own change alone (the flow
// runner's sidecars and stage, the screenplay scenes on one; the practice room's moveset runtime, its RPG channel on
// mana-ui and the fighter's lab on the other), and the merged page carries both. No fixture takes a moveset, a script or
// a flow, so the sources they carry changed, their play as it was.
// Re-pinned 2026-11-09 (1108-practice-room: Fallen Angel's air): the 16 fixtures that embed the controllable runtime. An
// air dash alone (`dash.ground: false`, F on the ground left to the sprint) and a glide held once the air jumps are spent
// (`glideSpent`); no fixture's rule names either, so the runtime they embed changed, their worlds as they were.
// Re-pinned 2026-11-09 (1108-practice-room: the modifier and its specials): the 16 fixtures that embed the controllable
// runtime. The moveset's specials on the modifier held (`mod`), the MP pool, a move's `reach` and a `dash` travel, and the
// sidearm silent under the modifier; no fixture names a moveset, so the runtime they embed changed, their worlds as they
// were. (The page's moveset input reads the modifier only on a moveset's page: no fixture has one.)
// Re-pinned 2026-11-09 (1109-cosmos-contraction merging 1108-practice-room again: Fallen Angel's air, the modifier and
// its specials): `kitchen-sink` and `kitchen-sink-capture`, the two that carry both the controllable runtime those
// commits changed and the game channel the flow runner did; each line's pin held its own change alone. No fixture names
// a moveset, an air dash or a flow, so the sources they carry changed, their play as it was.
// Re-pinned 2026-11-09 (1109-gen-bodywork: timed states and the desperation, shared with the brawler): `versus` only. Its
// page inlines versus-library.js (the STATES shelf, the install super, the whirl), versus-compile.js (a super's
// `install` and `nohit`, a special's `around` and `price`) and versus-core.js (a state granted, run down and read: damage,
// speed, iron; a price paid the first time a move lands); the fixture's fighters take none of them and fight as before.
// Re-pinned 2026-11-09 (1109-gen-bodywork: the street's things): `versus` only. Its page inlines versus-library.js, whose
// WEAPONS gain the pipe (a brawler picks it up off the street; any fighter may hold it); the fixture's fighters hold none.
// Re-pinned 2026-11-09 (1109-gen-bodywork merging 1108-practice-room): the fixtures both lines moved, together (the
// practice room's controllable runtime, swing system and mana-ui HUD look; this line's fight, its states and its
// things), and mana-ui's sheet and kernel as the two met (the trunk's dials and the practice room's `hud`, passing
// anchors and text entry side by side); no fixture's play changed by the meeting itself.
// Re-pinned 2026-11-09 (1109-gen-bodywork: the practice yard plays its characters by their clips, in its register's look):
// `brawl` only. Its page inlines the yard's client, which gains the register's rig and the played body; the fixture's
// yard carries neither, so its play is unchanged.
// Re-pinned 2026-11-09 (1109-gen-bodywork: the brawler's jump on the face's west, as the operator asked): `brawl` only.
// Its page carries the brawl scheme's bindings: the jump on a pad's X and the keyboard's J, the attack on A and K.
// Re-pinned 2026-11-09 (1109-gen-bodywork: the brawler's strong, on the face's north): `brawl` only. Its page inlines
// the brawl's moves, core and practice (the strong blows and their cooldown) and the scheme's strong (Y, I).
// Re-pinned 2026-11-09 (1109-gen-bodywork: the brawler's dashes, its air split, through-moves): `brawl` only. Its page
// inlines the brawl's core, moves, pose, crowd and practice: the run and the back-step, the air punch, the flying kick,
// the stomp and the dive kick, a roll's way through a crowd.
// Re-pinned 2026-11-09 (1109-gen-bodywork: foes are bodies): `brawl` only. Its page inlines the brawl's moves (a body's
// tune) and crowd (each type's tune and plays).
// Re-pinned 2026-11-09 (1109-gen-bodywork: the boss a body as every other): `brawl` only. Its page inlines the crowd
// (the boss's tune and its plays between its CPU's own).
// Re-pinned 2026-11-09 (1109-gen-bodywork: the armed brawler): `brawl` only. Its page inlines the brawl's core (blades
// that clash, a body keeping its own weapon) and the yard's client (a held blade drawn).
// Re-pinned 2026-11-09 (1109-gen-bodywork: the armed crowd and the armed boss): `brawl` only. Its page inlines the crowd
// (the sword, the spear, the axe, the staff; a boss's weapon).
// Re-pinned 2026-11-09 (1109-gen-bodywork: the weapon arts): `brawl` only. Its page inlines the brawl's moves (each
// weapon's own chain).
// Re-pinned 2026-11-08 (1108-realism-combat-tester, phase 4: the gaps the combat tester measured): the fixtures that
// embed the controllable runtime. The platform rule gained a person's sprint (`sprintSpeed`, held on `input.sprint`);
// the weapon its spread's and recoil's `wait` (settling once the trigger rests: `restT`, kept only with one) and a
// round's `blow` and `pellets`, carried on the shot's record. On the `controllable` fixture 22 lines are added and 6
// replaced (the spread and recoil records, their settling, the two shot records), each as before without its opt-in.
// Re-pinned 2026-11-08 (1108-realism-combat-tester: a shooter's hero over the shoulder, drawn and framed): the same
// fixtures. The body builder's loadout branch (a body per slot's figure) runs only when a slot names a figure; a carried
// kit's slots name none, and the body is its own figure (before, a hero carrying `arms` had no body). The wall pull-in
// passes the camera rule's opt-in `standOff` to followPullIn, whose wall skin now applies only at a wall (the default
// 3 m stand-off was always the larger cut in the open, so every default camera stands where it did). On the
// `controllable` fixture 5 lines are replaced and 3 added; absent `standOff` and a figure-less loadout, as before.
// Re-pinned 2026-11-08 (1108-realism-combat-tester: small arms drawn as small arms): the same fixtures. A weapon's
// opt-in `round` (gameworld/rounds.js, kept by initWeapon) draws its shot in the sim register (__spawnRoundFx: a hand's
// length of flash, a wisp, a one-pixel streak, dust), from a carried gun's own muzzle where the gunplay view gives one;
// and the converge crosshair is searched from the shooter's depth along the camera's ray (a wall at its back caught it
// and sent the round backwards). On the `controllable` fixture 4 lines are replaced and 61 added; a weapon without a
// round draws as before.
// Re-pinned 2026-11-09 (1108-realism-combat-tester, the artillery range's phase 2: a shell's flight): the same fixtures.
// A travelling round takes an opt-in `projectileDrag` (initWeapon keeps it, the launch carries it, stepProjectiles sheds
// the speed along the velocity), and a lobbed round leaves through its weapon's seeded cone when it has one. On the
// `controllable` fixture 2 lines are replaced and 6 added; a round without drag or a cone flies as before.
// Re-pinned 2026-11-10 (1109-cosmos-contraction merging 1108-realism-combat-tester): the 16 fixtures that embed the
// controllable runtime, which both lines moved. This line's moveset, its specials palette, the
// pose layers and the sheathed body's figures; that line's turret view, boat water, the figure-less loadout, a round's
// drag, the person's sprint on Shift and its walk, over-the-shoulder rounds. The merged page carries both, each still
// behind its own opt-in; no fixture's play changed by the meeting itself.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the pages' own house): `board` and `holo` only. The board
// page says its grid-to-world point, its bus push and its banner once and hands them to the tower defence and the
// skirmish (they were written twice, the banner three times); a tower defence's letters are its own, so S sells and no
// longer pans the camera too. The holo's promotion picker is put away by a press on the board or by Escape (it had no
// way out). No other page inlines the board page or the holo's client.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the table's parts): `brawl` only, the one fixture that
// inlines the game UI runtime's kernel. The kernel gains three components (a card, a log, a small series), `why` on a
// disabled button, slot, row and cell, and their words; the brawler's yard uses none of them and draws as before.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the table on it): `brawl` again, for the sheet it carries.
// A card in a grid keeps its face (it was drawn bare there), and a face-down card's count wraps inside its back. The
// yard draws no card.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the board on it): `board` only. The board page takes the
// board's UI as two more trailing arguments (the tower defence's and the skirmish's pattern), says what a control
// means once (`intent`, which its own keys now go through), and back from an aim returns the keys to the action menu
// (they stayed with the cursor). A skirmish under the UI keeps its orders on its own keys, so the page's keys pass in
// that mode. A board without `ui` carries no runtime; the fixture gains the hooks' lines alone.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the holo arena on it): `holo` only. The arena's client asks
// whether the block was given the arena's UI (holo-ui.js) and, with one, hands it the overlay's words, the picker and
// the cursor's cells; with none it draws its canvas as before. An arena without `ui` carries no runtime: the fixture
// gains the hooks' lines alone.
// Re-pinned 2026-11-10 (battle city on the game UI runtime, the default): `holo` only. An arena is drawn by the game UI
// runtime unless it says `ui: false`, so the fixture (which names no `ui`) now carries the runtime, its sheet and its
// page beside the arena's client. The `board` fixture hands the page its data without the scene's reader, so it
// stays the board with no `ui`.
// Re-pinned 2026-11-09 (1109-run-and-gun: the range): `brawl` only. Its page inlines the guns, the gunner's reader, the
// shooting crowd, the range's practice and the yard's client (rounds in flight, a foe's warning, the gun in the hand;
// special in play no longer opens the move list).
// Re-pinned 2026-11-09 (1109-run-and-gun: a rifle held; shot sounds, impact frames, poise): `brawl` only. Its page inlines
// the guns (their sounds, hitstop, freeze, impact), the core's poise and the client's sounds and impact frames.
// Re-pinned 2026-11-09 (1109-run-and-gun: the wave tester): `brawl` only. Its page inlines brawl-waves.js and the range's
// waves (the practice's wave run, the wave meter, the Waves setting).
// Re-pinned 2026-11-09 (1109-run-and-gun: entrances, hiding, cover): `brawl` only. Its page inlines the core (enterBody,
// the hide state, cover stopping rounds), the things' cover, the crowd's and the waves' entrances and ambushes, the poses
// and the client's cover, dust and sounds; the brawler yard's own waves (practice.waves, its Waves setting).
// Re-pinned 2026-11-09 (1109-run-and-gun: mounted foes): `brawl` only. Its page inlines the things' mounts, the core's
// ride (the ram, knocked off, the wreck), the crowd's and the waves' riders, the rider's pose and the client's mount drawn
// under it, its wreck and its crash.
// Re-pinned 2026-11-10 (the cast channel: versus): `versus` only. Its page inlines the arena's client, whose fight rig
// is the cast rig's (one key, the sky and the rim in the bodies' own shader: versus-arena.client.js fightRig); the fixture
// names no register, so it carries no rig and no kit, only the client's new source.
// Re-pinned 2026-11-10 (the cast channel: brawl): `brawl` only. Its page inlines the yard's client, whose rig is the cast
// rig's (one key, the sky and the rim in the bodies' own shader: brawl-yard.client.js yardRig); the fixture names no
// register, so it carries no rig and no kit, only the client's new source.
// Re-pinned 2026-11-10 (1110-battle-city-mana-ui-integration merging 1105-rc): `brawl`, `holo` and `board`, the three
// fixtures this line moved. `brawl` was moved by both lines (the candidate's range and guns in its page; here the game
// UI runtime's kernel and sheet it inlines, which gained a table's parts): the merged page carries both. `holo` and
// `board` are this line's alone, as noted above. No other fixture differs from the candidate's pin.
// Re-pinned 2026-11-10 (1110-cast-channel merging 1105-rc): `brawl` only, moved by both lines (the candidate's game UI
// runtime in its page; here the yard client's cast rig): the merged page carries both. No other fixture differs from the
// candidate's pin.
// Re-pinned 2026-11-11 (1111-design-code-rail-alignment: a killing blow floors a body with no poise): every fixture that
// inlines the controllable runtime (combat-hit.js armReaction), sixteen. A body that carries no poise (a hero whose hp
// the stats bind) taken to 0 by a blade or a round is now downed, as the ranged path's own comment meant; before, it was
// left standing at 0 and its level never failed. No fixture without the runtime moves.
// Re-pinned 2026-11-13 (the handshake's grace): `game`, `kitchen-sink` and `kitchen-sink-capture`, the three whose page
// carries the game channel. The 1.5 s a hosted level waits for its shell is counted in time the shell could have
// answered in (channels/game.js awaitShell, inlined in place of the one-line timer), so an answer queued behind the
// level's own build is never beaten by the presets. Every other fixture stays as it was.
// Re-pinned 2026-11-14 (mana-ui's pictograms, mana-ui/icons.js): `brawl` and `holo`, the two whose page inlines the game
// UI runtime's kernel. An icon, a counter's icon and a prompt's glyph now carry `data-icon` (the name a theme's sheet
// finds its pictogram by); every other fixture holds byte for byte.
// Re-pinned 2026-11-14 again (mana-ui's layout that adapts): `brawl` and `holo`, for the same reason. The kernel holds
// the frame it is drawn in (`rt.frame`, the `frame` binding, a mount's own measure) and a stack's `fit`; a spec that
// names neither draws as it did, and every other fixture holds byte for byte.
// Re-pinned 2026-11-14 (a street fought down, brawl/brawl-street.js): `brawl`, the one fixture whose page inlines the
// brawl's client and modules. The page may now play a STREET in the yard's place (`brawl.street`: its waves a held
// screen, read by the brawler's own reader, its screen and its read inlined beside the yard's); a yard plays as it did.
// And again the same day (the brawler's sound sheet, brawl/brawl-sfx.js BRAWL_SOUNDS): `brawl`. The client sounds a blow
// thrown, a jump and the bodies' voices off the street's state, and counts what it asked for (window.__mojBrawl.heard).
// And once more (a street in a game's shell): `brawl`. A hosted street says it is ready, takes the focus, and sends its
// end up the level wire in place of its own end screen.
// And for its rank and the keys handed back (`brawl`): a cleared street is ranked by the health left, sent with its end;
// the frame gives the focus back to the shell as it ends, and takes it again when the shell says go.
// And for the crowd's faces (`brawl`): a street's `cast` draws its crowd and its boss as roster characters.
// And for its variety (`brawl`): a cast's kind may name several characters, taken in turn body by body.
// Re-pinned 2026-11-14 (the holo arena's `ready`, tabletop/holo-arena.client.js): `holo`. Its probe says whether a
// person's click would be taken now (in play, their turn, no beat on stage or waiting), so a driver waits on the page and
// not on a clock; the arena plays as it did.
// Re-pinned 2026-11-14 (the street's own angle, brawl/brawl-belt.js): `brawl`. Its page inlines the belt, whose angles
// gain `street` and each the height it looks at (`look`); the fixture's `classic` looks at a body's chest as before.
// Re-pinned 2026-11-14 (the street's breakables as skandart's vessels, brawl/brawl-yard.client.js): `brawl`. Its page
// inlines the yard's client (a box drawn as its vessel where the page carries one, its wreck left where it broke) and
// the things' table (a steel drum); the fixture lays no box, so its page carries no model.
// Re-pinned 2026-11-14 (a belt that rises, brawl/brawl-belt.js `rise`): `brawl`. Its page inlines the belt (its floor's
// height along it, the camera rising with it) and the yard's client (every thing the simulation places drawn that much
// higher); the fixture's belt is flat, so its floor is 0 everywhere and its page plays as it did.
// Re-pinned 2026-11-14 (a belt that turns, brawl/brawl-belt.js `turn`): `brawl`. Its page inlines the belt, whose
// camera is turned down the street by the belt's turn where it stands; the fixture's belt has none, so its camera is as
// it was.
// Re-pinned 2026-11-14 (a belt that drifts, brawl/brawl-belt.js `drift`): `brawl`. Its page inlines the belt (the
// band's slide across it, the camera following) and the yard's client (every thing the simulation places drawn that
// much across); the fixture's belt is straight, so its drift is 0 everywhere and its page plays as it did.
// Re-pinned 2026-11-14 (the player's line on a drifting belt, brawl/brawl-yard.client.js): `brawl`. The line lies
// along the band's diagonal where the player stands; the fixture's belt is straight, so its line lies as it did.
// Re-pinned 2026-11-14 (the game turn's pick screen, mana-ui/idioms-front.js): `brawl` and `holo`, the two whose page
// inlines the game UI kernel. A mount on an element with no box of its own (a bare div its root is laid out of) measures
// its root's, so the frame is known there too, and the runtime's words gain `choose` and `choices`; a page that mounts
// on a sized element and says neither word draws as it did, and every other fixture holds byte for byte.
// Re-pinned 2026-11-14 again (the game turn, played through): `brawl` and `holo`, for the same reason. A `when` or an
// `unless` on a param a def was not given is a condition not met, where it was no condition at all (the play shell's
// loading screen drew its failure's Retry and Quit while it loaded); a def given every param it tests draws as it did.
// Re-pinned 2026-11-14 (the touch controller drawn by mana-ui): `brawl` and `holo`, the two whose page inlines the game
// UI kernel and its sheet. The `touchpad` takes what the touch layer knows (`lane`, `held`, `down`), a stick at rest is
// seen through, and the pad is as wide as its frame allows; neither page draws a touch pad, and every other fixture
// holds byte for byte (a level with no mana-ui HUD emits the touch layer it did).
// Re-pinned 2026-11-14 again (the touch controller's look): `brawl` and `holo`, for the same reason. A pad's pictogram
// stands inside its round, the pads fill from the screen's edge, the HUD's bottom corners stand over a pad, a region
// whose every part is gated off draws no plate, and a glass theme no longer blurs behind a bare region; neither page
// draws a touch pad or an empty region, and every other fixture holds byte for byte.
// Re-pinned 2026-11-19 a seventh time (1117-cinematic-action-game: a guard's reach at arm's length): the seventeen
// fixtures whose page embeds the controllable runtime. A mind's perceive (mind.js) takes an opt-in `rule.near`: a body
// within its reach is seen whatever way it faces, unless square behind it while it walks (and all round while a patrol
// looks round, foe.js `patrol.look`). No fixture's mind carries `near`, so every sight is the cone's as it was; only the
// runtime's text moved. foe.js's look round is emitted only where a world stands a foe, and no fixture does.
// Re-pinned 2026-11-19 (1117-cinematic-action-game: crawling under things): `mission` only. The world's veils may carry a
// crawl space (veil.js `under`, a box with no patch's middle and radius), so the radar's plan (gameworld/radar.js
// planSvg, inlined by the page) draws tall grass from the patches alone. The fixture has no veils: its plan is as it was;
// only the inlined source moved.
// Re-pinned 2026-11-19 a sixth time (1117-mana-ui-talking-heads merged into 1117-cinematic-action-game): the fixtures
// whose page inlines text either side had moved since (that side: the talk box on mana-ui and its talking faces, a game
// UI's root laid in the scene's frame, the radar's plan at the floor a level stands on, every shooter's HUD; this side:
// the world's rays and the ground's index, the follow camera's clear line, the minimap translucent, tall grass). The
// radar's plan takes either side's word (a floor height, or the options with `z` among them). Twenty fixtures moved
// from that side's pin: the seventeen that inline the controllable runtime, and `brawl`, `holo` and `mission` (the game
// UI's styles and the radar's plan); every other fixture holds that side's pin byte for byte. The merged text is
// neither side's pin; no fixture's behaviour is claimed changed.
// Re-pinned 2026-11-19 a fifth time (1117-cinematic-action-game: the grid for meshes of two hundred triangles and the
// camera's first ray): the same seventeen; the grid's threshold and one line before the camera's drive.
// Re-pinned 2026-11-19 a fourth time (1117-cinematic-action-game: the grid for every big mesh): the same seventeen. The
// ground grid's raycast takes a mesh placed by a transform (the ray carried into its own frame) and one of several
// materials (each face its group's side), where three's own raycast took them triangle by triangle; what a ray finds is
// what three finds (tested ray by ray). Emission changes by that function alone.
// Re-pinned 2026-11-19 a third time (1117-cinematic-action-game: the ground's index): the same seventeen. The ground
// probe reads the surfaces over its own cell (controllable/ground-index.js, baked with the grid and again when the
// scene's surfaces change, a surface that moves tested wherever it stands) instead of a ray through the whole scene; what
// it finds is what that ray found.
// Re-pinned 2026-11-19 again (1117-cinematic-action-game: what a frame costs, by side): the same seventeen. The page
// keeps window.__mojCost, the game's logic, its rays and the render call's time a frame, each a running mean, and each
// big mesh a ray has tested triangle by triangle (the grid's slow path, named); the frame loop times its step and its
// render where a page has controllable bodies. What runs and what it draws are as they were.
// Re-pinned 2026-11-19 (1117-cinematic-action-game: the world's rays made cheap): the seventeen fixtures whose page
// embeds the controllable runtime. Every ray through the world (the ground probe, the camera's pull-in and its clear line,
// a gun's sightline) now tests the scene's children but the bodies (`__rayRoots`), whose hits each ray threw away after
// testing their every triangle (a skinned body's each corner posed by its bones first); and the ground grid indexes again
// whenever the scene's top changes and every 120 probes, so a mesh built after the first probe (a gen-7 land's) takes the
// grid. What each ray finds is as it was; emission changes by those lines alone.
// Re-pinned 2026-11-18 a third time (1117-cinematic-action-game: the minimap translucent): `brawl`, `holo` and `mission`,
// the three fixtures whose page inlines the game UI's styles. A scope's face is now a third of the panel's colour at its
// middle (it was seven tenths) and the map under it at 0.55 (0.8): the world is seen through it. Emission changes by
// that stylesheet alone; every other fixture holds.
// Re-pinned 2026-11-18 again (1117-cinematic-action-game: the radar's map topographical): `mission` only, the one fixture
// that inlines the radar's plan (gameworld/radar.js planSvg), which takes `relief` (the land's contours) and `trail` (the
// way walked) where a level's `radar.map` is 'topo'. The fixture asks for neither, so its map draws as it did.
// Re-pinned 2026-11-18 (1117-cinematic-action-game: the map under the radar): `brawl`, `holo` and `mission`, the three
// fixtures whose page inlines the game UI kernel and its styles. The kernel's minimap takes an optional `plan` (a picture
// of the place laid under it, its point at the middle, turned about it), and `mission` also inlines the radar's plan,
// which now draws a land's things by their own heights and its tall grass where asked. No fixture's minimap carries a
// plan and no plan asks either, so each draws as it did; only the inlined text moved. Every other fixture holds.
// Re-pinned 2026-11-17 a fifth time (1117-cinematic-action-game: tall grass as cover): the seventeen fixtures whose page
// inlines the controllable runtime. The engine's step hands a world's `veils` to its minds (core.js, one spread in the
// world record: none, none handed), and a mind's sight asks them (mind.js perceive: a line lost in tall grass,
// worlds/controllable/veil.js, the opt-in module that answers). No fixture's world carries veils, so every sight is the
// colliders' as it was; only the runtime's text moved. Every fixture with no controllable runtime holds byte for byte.
// Re-pinned 2026-11-17 a fourth time (1117-cinematic-action-game: a watcher's sight on the radar): `brawl`, `holo` and
// `mission`, the three fixtures whose page inlines the game UI kernel and its styles. The kernel's map draws a marker's
// `fan` as a wedge under it (what a watcher sees, gameworld/radar.js), and `mission` also inlines the radar's marks,
// which now carry that fan for a watcher whose rule shows its sight. No fixture's marker carries one, so each map
// draws as it did; only the inlined text moved. Every other fixture holds byte for byte.
// Re-pinned 2026-11-17 a third time (1117-cinematic-action-game: a cued shot keeps its caller's clock): `shoot-live`
// only, the one fixture whose plan carries a cue. The shoot channel's cue block gains `cueAt` (a cued shot's seconds
// said by who fired it: a ride's own clock, so its camera and its deck stay together when the world is slowed). Nobody
// calls it in the fixture, so its cue runs on the page's clock from the moment it fires, as it did; only the block's
// text moved. Every fixture without a cue holds byte for byte.
// Re-pinned 2026-11-17 again (1116-rc merged into 1117-cinematic-action-game): the fixtures whose page inlines text
// either side had moved since (the candidate: the camera's moves and shake, the sea, the street; this side: the mission
// and damage-ring channels, the aim held's chase). The merged text is neither side's pin; no behaviour is claimed changed.
// Re-pinned 2026-11-17 (1117-cinematic-action-game-ui merged into 1117-cinematic-action-game): the fixtures whose page
// inlines the controllable runtime or the game UI kernel, and the two fixtures the UI branch added (`mission`,
// `damage-ring`), written here for the first time. Each side had moved the runtime's and the page's text (this side:
// the chase's pull-in on an aim-held page, the lying body's whole-body turn; that side: the ladder's hold, a mind's
// ledges and flight, the HUD), so the merged text is neither side's pin. No fixture's behaviour is claimed changed.
// Pinned 2026-11-15 (1115-shooting-rails: a mission's briefing, HUD, pause and debrief on mana-ui): the new `mission`
// fixture only (the mission channel's block: mana-ui, the controls host and the mission's runtime in a scope of their
// own). Every other fixture carries no `mission` and keeps its bytes: the channel adds nothing where it is absent.
// Re-pinned 2026-11-15 (1115-shooting-rails: the damage ring): `mission` only. Its runtime reads the pilot's hits and
// marks where each came from on mana-ui's ring, its bearing inlined beside it.
// Re-pinned and pinned 2026-11-15 (1115-shooting-rails: the damage ring as its own concept): `mission` (its runtime
// steps the shared tracker, inlined beside it) and the new `damage-ring` fixture (the ring's own channel, for a page whose
// HUD is its own). No other fixture carries either.
// Re-pinned 2026-11-15 (1105-rc merged into 1115-shooting-rails): `mission` only. Its page inlines the game UI kernel,
// which the candidate changed (pictograms, the frame, the touchpad, the pick screen), as `brawl` and `holo` were re-pinned
// for there; the mission's own block is as it was.
// Re-pinned 2026-11-15 (1115-shooting-rails: a ladder climbed by holding jump): the seventeen fixtures whose page
// inlines the controllable runtime (`controllable`, `controllable-lock`, `action-hero`, `controllable-shadows`,
// `cast-shadows`, `live-shadows-actors`, `live-shadows-both`, `controllable-smoke`, `controllable-figure`,
// `controllable-hangar`, `fx`, `shoot-live`, `toon-ink-controllable`, `toon-ink-fx`, `capture-controllable`,
// `kitchen-sink`, `kitchen-sink-capture`). The climb's owner (worlds/controllable/rules-basic.js) reads a climbable's
// opt-in `hold` and `holdReach`: stood under it, holding jump takes hold and goes up while it is held. No fixture
// carries a climbable that asks, so every one plays as it did (the runtime's trace holds); only the runtime's text
// moved. Every fixture with no controllable runtime holds byte for byte.
// Re-pinned 2026-11-15 again (1115-shooting-rails: a mind's path kept to its ground): the same seventeen, for the same
// reason. The pathfinder (worlds/controllable/nav.js) takes an opt-in `ledges`: a cell with no ground at the body's
// height is shut as a wall is, asked of the ground a cell at a time as a path reaches it; a mind asks with
// `rule.navLedges`. No fixture's mind asks, so every path is the colliders' as it was; only the runtime's text moved.
// Re-pinned 2026-11-15 a third time (1115-shooting-rails: a wave crosses a building's storeys): the same seventeen,
// for the same reason. A mind's flight (worlds/controllable/mind.js floorWay) takes an opt-in `way`, its points from the
// foot up, walked a point at a time (a switchback's legs and landing). No fixture's flight carries one, so every walk
// is foot to top as it was; only the runtime's text moved.
// Re-pinned 2026-11-16 (1115-shooting-rails: a radar and a map): `mission` only. Its page's HUD carries the radar and
// its screens the map (gameworld/radar.js, inlined beside the mission's runtime), and each task that is a place to go
// its place. Every other fixture holds byte for byte.
// Re-pinned 2026-11-16 again (1115-shooting-rails: a mission fills its window): `mission` only. A mission's page fills
// its window where its game names no screen. Every other fixture holds byte for byte. (The gunplay view's own changes
// of that day, the gun drawn after the world's glass and lit by the form render, moved no fixture: none carries it.)
// Re-pinned 2026-11-17 (1115-shooting-rails: every shooter wears the HUD): `mission` only. The mission's page gained a
// plain form (no order, briefing or debrief, for a shooter with no mission), its order stands only where there is one,
// its health falls back to the pilot's own body where the bus keeps none, and its map is drawn at the floor the pilot
// stands on and boxed on the ground a level says it is fought on. No other fixture moved.
// Re-pinned 2026-11-17 again (1115-shooting-rails: orders are spoken): `mission` only. Its HUD carries a line for the
// order as it is given (mana-ui's subtitles, who gives it and what is said), each task its line. No other fixture moved.
//
// Re-pinned 2026-11-15 (the switch cancel): the runtime the page embeds gained the moveset's `swap` (combat-melee.js
// stepMoveset: the weapon cycle pressed mid-swing held to the live move's switch point, the next weapon's string
// opened on the press that was waiting, the string's count carried on). Five places in that one function: a block
// added before the cycle, the cycle's own line guarded on `swap`, a guard on the chain at the cancel, the buffer's
// hold, and the opener's count. A moveset that says no `swap` runs as before: the cycle mid-swing is dropped. Every
// fixture that embeds the controllable runtime re-pinned with it.
//
// Re-pinned 2026-11-17 (the race's HUD on mana-ui): `brawl` and `holo`, the two whose page inlines the game UI runtime.
// Its minimap gains a `route` (a way drawn as a dotted line under its markers, gameworld/race-hud.js's track map): one
// prop, its draw and two sheet rules; a minimap that names no route draws as it did. Every other page byte-identical.
//
// Re-pinned 2026-11-17 (boost pads on a street circuit's alley): the drive rule gains an opt-in boost read through the
// world's `padAt` (rules-drive.js: a wheel on a pad lights a boost, its top and pull past the kart's own while it
// lasts), the core passes the hook into the world, and the page wires it when its drive surface lays pads. A world with
// no pads has no `padAt` and drives as before. Every fixture that embeds the controllable runtime re-pinned with it.
//
// Re-pinned 2026-11-17 (a race's held item on the pause sheet): the pilot scheme the page carries gains its `useItem`
// action (controls/schemes.js: F, right Shift, the pad's left face, in a vehicle) and the sheet's two rows for it, and
// the pause legend's flags gain `items` (a race whose boxes hand out items). A page with no item boxes shows no row.
// The sheet's thrusters row is hidden in a vehicle too (the thrusters were never a vehicle's; a kart's F is its item).
// Every fixture that embeds the controllable runtime re-pinned with it.
//
// Re-pinned 2026-11-18 (a race's held item as one large slot): mana-ui's `slot` draws its pictogram (its icon carries
// `data-icon`, as an icon's and a counter's do) and takes a `size` (l: a slot read at a glance), and the sheet sizes it.
// `brawl` and `holo`, the two whose page inlines the game UI runtime; a slot of the size unsaid draws as it did.
//
// Re-pinned 2026-11-18 (screen effects): mana-ui gains its `effect` layer (confetti, streamers, sparkles, burst, petals,
// a flash: pure CSS over everything, catching nothing) and the sheet its rules and motions. `brawl` and `holo`, the two
// whose page inlines the game UI runtime; a HUD that lays no effect draws as it did.
//
// Re-pinned 2026-11-15 (the release candidate merged into the side-scroll starter): `brawl`. Its page carries both
// sides' changes at once (the belt's bends and the yard's client from the one, the game UI kernel and its sheet from the
// other); each is said above, and neither changes how the fixture plays.
// Re-pinned 2026-11-15 (a street in a game's turn, brawl/brawl-street-read.js): `brawl`. Its page inlines the
// street's read (its session: who plays and how hard, as a turn's picks say) and the yard's client (a hosted street
// reads it when the shell starts it); the fixture is a practice yard on no shell, and plays as it did.
// Re-pinned 2026-11-15 (a street's scenes, brawl/brawl-scenes.js): `brawl`. Its page inlines the scenes' kernel and the
// yard's client (a scene the game's turn stages plays with the fight held, its end told before the outcome); the
// fixture is a practice yard with no scene, and plays as it did.
// Re-pinned 2026-11-15 (a street played as a run & gun, brawl/brawl-play.js): `brawl`. Its page inlines the core (a
// gun to take up, taken in a gunner's stride), the crowd (a street's gunner, a wave fought on the move), the street's
// read (the gun held, the rounds tallied) and the yard's client (a street's play: the gunner's buttons); the fixture is
// a brawler's practice yard with no gun on it, and plays as it did. Again the same day (the fight measured,
// brawl/brawl-measure.js): the core (a player's round breaks a box open), the street's read (the difficulty tiers)
// and the crowd (a boss of the crowd's own kind); and the yard's client (cover drawn as the dress's own piece, a
// band's models' colours brought to linear light). Again (a boss's phases, a second seat taken mid-street): the
// crowd, the street's read and the yard's client; the fixture is a yard, with neither. Again (the street's seats):
// the street's read (a gun's letters) and the yard's client (each seat's quarter).
// Re-pinned 2026-11-18 (1116-rc merged into 1117-kart-improvements): the fixtures both lines moved, together. The
// seventeen that embed the controllable runtime (this line's boost pads and its use-item key in the pilot scheme, over
// the candidate's), and `brawl`, `holo` and `mission`, whose pages inline the game UI runtime (this line's slot, effect
// layer and minimap route merged with the candidate's peril, scope and magazine). Nothing else moved.
//
// Re-pinned 2026-11-18 (the lens, mana-ui's screen layer): `brawl`, `holo` and `mission`, whose pages inline the game UI
// runtime. The runtime gains the lens's part (a spec's `lens`, drawn apart and mounted beside the canvas) and its
// `strike`; a HUD that lays no lens draws as it did, and no pinned page lays one.
//
// Re-pinned 2026-11-18 (the lens for still figures): `brawl`, `holo` and `mission`, whose pages inline the game UI
// runtime. A strike's row may name its own kind, and its description speaks of a turn-based fight's figure; the level
// HUD lays no lens again. Nothing else moved.
//
//
// Re-pinned 2026-11-19 (a move's PLANT, gameworld/combos.js: the feet split in place through a cut): the runtime the
// page embeds (combat-melee.js stepMoveset) plays a plant chained into from another plant on its `_on` clip, begun split.
// One place: where a move's clip is chosen. A moveset with no plant plays its clips as before; every fixture that embeds
// the controllable runtime re-pinned with it.
// Re-pinned 2026-11-19 (a card's own dash, feel/lower.js `takes.dash`): the runtime the page embeds (rules-platform.js)
// plays a body's `dash` clip over its dash's burst, on the ground and in an air dash, where its takes name one; a rule
// whose takes name none holds the running jump's gather as before. One place, where the dash's pose is chosen; every
// fixture that embeds the controllable runtime re-pinned with it. (The dash's dust is a block of its own, gated on a
// rule's `dash.dust`: no fixture has one, and none emits it.)
// Re-pinned 2026-11-20 (the wall slide faces out, rules-platform.js): the runtime the page embeds turns a body caught on
// a wall to face out from it, where the stick moves it in the world's frame, and the stick no longer turns a clinging
// body. A rule with no `cling` steps as before; every fixture that embeds the controllable runtime re-pinned with it.
// Re-pinned 2026-11-20 (a foe's rounds travel, combat-ranged.js): a weapon may say `noGround` (its round flies on over
// and under z = 0) and `passTeam` (its round passes through its own team's bodies), carried onto the round it launches
// and read by the contact sweep; a weapon that says neither launches and sweeps as before. Every fixture that embeds the
// controllable runtime re-pinned with it. (The page's foe-round look and the boss room's shutter are blocks of their
// own, gated on a foe weapon's `foeRound` and a side-map zone's `shut`: no fixture has either, and none emits them.)
// Re-pinned 2026-11-21 (the audio channel unlocks on a key and on the game shell's word that sound is on): a game played
// on the keys, or hosted in the shell's frame, was never clicked and stayed silent. The fixtures that carry `audio`
// (audio, kitchen-sink) re-pinned with it; every other fixture keeps every byte.
// Re-pinned 2026-11-21 (the platform rule's FLINCH, rules-platform.js `flinch`, opt-in: a blow taken holds a run-and-gun
// hero in its hurt; the buster's tap held while it flinches): a rule without `flinch` steps as before; every fixture
// that embeds the controllable runtime re-pinned with it. (The side map's shutter wall and its room put back after a
// fall are the side-map runtime's, emitted only under a side map's camera: no fixture has one.)
// Re-pinned 2026-11-21 (the game-params seam reads a light shell's turn pick, params.__picks.pilot, as its pilot: a co-star's
// level stands two heroes in the player's seat): a level with no pick pilots as before; every fixture that embeds the
// controllable channel re-pinned with it.
//
// Re-pinned 2026-11-21 (1116-rc merged into 1117-side-scroller-galaxy): the fixtures both lines moved, together. Those
// that embed the controllable runtime (this line's buster, flinch and co-star pick over the candidate's talking jaw and
// bare fists), those whose pages inline the game UI runtime and the HUD host (this line's side map's HUD over the
// candidate's race, radar and talk box), and those that carry `audio` (this line's unlock and run voices over the
// candidate's ambience and cab). Nothing else moved.
// Re-pinned 2026-11-18 (the chase in a tall room): the runtime the page embeds gained the follow rule's `tall` branch
// (rules-basic.js: in a room over seven metres the chase stands back and up, as far as the room allows, and its look
// lifts). A block added before the chase's distance, that line and the height's taking its terms, and one line after
// the first look keeping the camera under the ceiling; a rule with no `tall` runs as before. Every fixture that embeds
// the controllable runtime re-pinned with it.
// Re-pinned 2026-11-19 (a weapon held as its own item, and a move's knockback): the runtime the page embeds gained the
// platform rule's `combat.held` (rules-platform.js: a weapon held as its own item shows its own hero in combat while it is
// up, the line choosing the figure guarded by it) and a moveset move's `knock` carried onto its blow (combat-melee.js
// stepMoveset: one field spread in). A hero with no held weapon and a move with no knock run as before. Every fixture that
// embeds the controllable runtime re-pinned with it.
// Re-pinned 2026-11-21 (1116-rc merged into 1115-stylish-action-rails): the fixtures both lines moved, together; the
// runtime the page embeds carries this line's clang, combat run and held weapon beside the candidate's, and the game UI
// runtime's HUD host this line's style meter and vitals beside the candidate's talk box and pilot strip.
// Re-pinned 2026-11-22 (the clang lands; a guard never struck comes down): the runtime the page embeds (combat-melee.js)
// lands a clanging hero's blow on a foe mid-swing (the spark kept, no lock, no block: the foe is not defending), and a
// guard raised before its first block comes down when let go (`blockT` unset read as none). A hero without `clang` and a
// guard that has blocked run as before; every fixture that embeds the controllable runtime re-pinned with it.
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
//
// Re-pinned 2026-11-17 (1116-rc merged into 1115-shooting-rails): the fixtures whose page inlines the controllable runtime
// (the seventeen named above, with the candidate's own that carry it) and `mission`. Each page carries both sides' changes
// at once: the candidate's (the switch cancel, the street, the sea) and this branch's (a climb held by jump, a path kept
// to its ground, a flight's way, the mission's HUD); each is said above, and neither changes how a fixture plays.
// Re-pinned 2026-11-17 (1115-shooting-rails: one radar): `mission` only. Its sheet puts the page's own round radar away
// (the controllable runtime's, by the class the candidate gave it) wherever the shooter's HUD stands, so a shooter has
// one radar, the HUD's scope. No other fixture moved.
// Re-pinned 2026-11-17 again (1115-shooting-rails: the radar a minimap): `mission` only. The scope is larger, reaches
// 40 m, and carries the level's plan under its marks, turned so ahead is up. No other fixture moved.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: a hero's power): `brawl` only. Its page inlines the brawl's core, crowd,
// practice and client, and now the powers shelf (brawl-powers.js): a power's stock spent and filled at a fall, a special's
// round carrying its knock, a special's round drawn (it was not) and a power's burst. The fixture's fighters have no power:
// it plays as it did. Re-pinned again the same day for a power DESIGNED (brawl-powers.js: a kind's dials, read back as
// written): `brawl` only, the shelf's lines alone.
// Re-pinned 2026-11-18 (1117-reactive-z-layer merged into 1117-hero-beat-em-up): `brawl` only. Its page carries both
// sides' runtime at once: the lens's still-figure runtime (that branch's) and the powers shelf (this one's).
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: a power's super beat): `brawl` only. Its page inlines the core (a power
// holds the street still as it starts, and is told for a body with no stock too), the shelf (each card's beat) and the
// client (the lens's host and its strikes, laid only where the street's spec carries a lens). The fixture has no power.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: rupa's knockback on a power's blow): `brawl` only. Its page inlines the
// kinetics (brawl-kinetics.js: the law, a body's mass, the throw, the slide), the core's use of it on a blow that carries
// energy and the client's dust ring at an impact. The fixture's blows carry none: it plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: an earth power's slab): `brawl` only. Its page inlines the core's walls
// (raised, stood as cover, shoved, crumbling: a state key only while one stands), the slab's law in the kinetics, the
// moves' second press and the client's slab and its dust. The fixture raises none: it plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: floating and a gale): `brawl` only. Its page inlines the air's laws in the
// kinetics (a floater's drift, a wind's drag), the core's drift in place of the walk for a floating body and its gusts
// (a state key only while one blows), and the client's hover and the gale's streaks. The fixture floats and blows
// nothing: it plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: a floating body's hover): `brawl` only. Its page inlines the pose's hover
// (one knee drawn up, the other leg hanging, toe pointed; never the stride). The fixture floats nothing: it plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: loose hair and cloth in the air): `brawl` only. Its page inlines the sway
// (brawl-sway.js: the air a body feels, the hang, the spring, the bend) and the client's bend of a character's long hair
// and loose cloth, a cape kept off the arms, and the hover in the comics' pose of power (the knee up, its shin tucked,
// the fists at the waist). The sim never reads any of it: the fixture plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: the foe shelf's idioms on the street): `brawl` only. Its page inlines the
// crowd's summoner and its summons (a pool held offstage, called a few at a time, cut down with it), a pair (one down, the
// other enraged), a boss's form at a stage, the caster, drone and blaster crowd types, and the client's dust, flashes and
// banner for them. The fixture's street says none of them: it plays as it did.
// Re-pinned 2026-11-18 (1117-hero-beat-em-up: the review's fixes): `brawl` only. Its page inlines the sway keeping each
// region's own rest positions (no copy of a part's buffer), and a boss stage's form read as any fighter's recipe. The
// fixture plays as it did.
// Re-pinned 2026-11-22 (1122-sim-fixing: the ground grid and index sized to their meshes): the fixtures that embed the
// controllable runtime. The ground grid's `gridFit` coarsens within 16 cells and 32 listings a triangle, the ground index's
// `indexBuckets` within 64 cells and 256 listings an item, and the grid raycast first tests the mesh's bounding sphere as
// three's own does: a flight's land and a race's backdrop no longer exhaust the page. Each only chooses which surfaces a
// ray tests, so what every fixture plays is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: flight goals and the craft as its airframe): the fixtures that embed the
// controllable runtime or the event bus. The bus's zone pass reads a `gauge` source too (a fact of a pilot's in a range:
// worlds/event-bus.js); the fly rule writes `agl`; the flight HUD's tick waits for the world to be published. No fixture
// has a gauge or a flight, so what each plays is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: Wolf Squadron's rail): the fixtures that embed the controllable runtime or the
// event bus. The page's controllable block treats a rail pilot as a vehicle (scene/channels/controllable/index.js); the
// bus's gauges read `along`; a hazard's hp stops at zero, as a hit's does (game/mechanics.js hazard-damage). The rail
// rule and its foes on station are opt-in, emitted only into a page with a rail pilot. No fixture has a rail, a gauge on
// `along`, or a hazard taking its hp past zero, so what each plays is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: the cockpit core): the fixtures that embed the controllable runtime. A space
// mind leads a travelling round in three dimensions, and a mind hunting the other side passes over a body asleep or
// gone (mind.js); a ship's shields are asked first by the shield absorption (combat-hit.js). The starfighter, its
// cockpit and its HUD are opt-in, emitted only into a page whose pilot is one. No fixture has a space mind with a
// travelling round, a sleeping body hunted, or a ship, so what each plays is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: fighters fly passes): the fixtures that embed the controllable runtime. A space
// mind with `rule.passes` flies down its nose, runs in, breaks and extends (mind.js); no fixture's mind has it, so what each
// plays is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: shields on a plan): the fixtures whose page carries mana-ui (brawl, holo,
// mission). Its kernel gains the `shields` component (a craft's shields read off its plan) and its sheet that
// component's rules; no fixture draws one, so what each shows is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: a craft's own blast): the fixtures that embed the controllable runtime. A death
// burst takes a body's `blast` (its size, marked a craft's) and a body with one is gone in it (combat-match.js); a ship's
// shield records where it took a round (rules-starfighter.js). No fixture's body has a blast or a ship, so what each plays
// is as it was.
// Re-pinned 2026-11-23 (1122-sim-fixing: power redirection): the fixtures whose page carries mana-ui (brawl, holo,
// mission). Its kernel gains the `power` component (a generator and its feeds) and its sheet that component's rules
// and beats; the shield plan's spent-side and low-hull rules now name its own parts. No fixture draws either, so what
// each shows is as it was.
// Pinned 2026-11-23 (1122-sim-fixing-mana-ui: the holo briefing): the `briefing` fixture joins the matrix (a space
// mission's briefing over its level: campaign/briefing-page.js's block in a scope of its own, the table's client, mana-ui
// and the controls host, the mission held on the pause sidecar until Launch). Every other page is byte-identical, and a
// page without a `briefing` key emits no block.
// Re-pinned 2026-11-23 (1122-sim-fixing-mana-ui: beacons): the fixtures that embed the controllable runtime, and
// `briefing`. A mission's beacon (gameworld/flight-sortie.js) is a mesh body the page draws as a lit core in turning
// rings (its own branch of the body builder and of the entity sync), and the starfighter's targeting computer holds one
// as a goal, never a hostile. No fixture carries a beacon, so what each shows is as it was. The briefing's labels size to
// their words.
// Re-pinned 2026-11-23 (1122-sim-fixing-mana-ui: the mission designer): `briefing` only. The table's client gives the
// editor its handle (a place moved with its name, post and ring; everything shown; the camera's turn held); the page over
// a level carries no editor, so what it shows is as it was.
// Pinned 2026-11-24 (1122-sim-fixing: Pilot School on mana-ui): the `lesson` fixture joins the matrix (a flying lesson's
// brief over its level: gameworld/lesson-brief.js's words, scene/channels/lesson-brief.js's block in a scope of its own,
// mana-ui and the controls host, the lesson held on the pause sidecar until Start). Every other page is byte-identical,
// and a page without a `lesson` key emits no block.
// Re-pinned 2026-11-24 (1122-sim-fixing: Wolf Squadron's stages): the `briefing` fixture's level page takes the keys
// as its briefing mounts (window.focus), so a pilot steps the table from the game's shell without clicking into it.
// Every other page is byte-identical.
// Re-pinned 2026-11-24 (1122-sim-fixing: Wolf Squadron's ground stages): the holo table's client draws a ground stage's
// land (theatre.terrain, its heights stretched by theatre.vertical, the colony's masses); a mission's table, with neither,
// draws as it did. Every other page is byte-identical.
