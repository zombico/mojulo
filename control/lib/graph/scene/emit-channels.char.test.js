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
// Re-pinned 2026-11-07 (the action RPG: a hero's sprint on its stamina, the orbit camera): the runtime the page embeds
// gained the platform rule's `sprint` (the boost held as a walker's sprint on its gauge: rules-platform.js) and its
// `moveYaw: 'camera'`, and the follow rule's `orbit` (rules-basic.js). On the `controllable` fixture 35 lines are added
// and 9 replaced in place (each a `sprints`/`moveYaw` guard on an existing line); a rule with neither runs as before.
// Every fixture that embeds the controllable runtime re-pinned with it. Then (the controls): the sprint's own `sprint`
// clip on its `sprintStride` (the stride's line guarded) and the orbit's swing round a locked foe (`lockTrack`): a few
// more lines added, one replaced; the same fixtures re-pinned again.
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
