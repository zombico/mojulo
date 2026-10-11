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

const sha = (s) => createHash('sha256').update(s).digest('hex');

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
