# The play runtime

Every game mojulo makes plays on its own runtime. It is a game engine in the ordinary sense: a deterministic world
step, collision and character controllers, an event bus the game's logic runs on, a UI runtime, sound and input, drawn
by three.js on WebGL and written into each exported page. `export_game` ships it as a folder or a desktop app, and
nothing else is needed to play.

It is made for the games its rails make, not as a general-purpose engine, and it does not compete with Unreal or
Unity on fidelity. No outside engine runs a game's rules: a team's engine gets a handoff of the levels, assets,
markers and contract (`export_model { engine }`, [tech-requirements.md](tech-requirements.md#engine-handoff-godot-unity-unreal-blender)),
and the play is rebuilt there if the team wants it there.

## One source, two places

The runtime is a set of builder closures composed over one namespace
([worlds/controllable/compose.js](../control/lib/graph/worlds/controllable/compose.js)): `EMISSION_ENGINE` is the core
every page carries, and the opt-in builders join only when a world asks for them. Each builder is import-free inside
its function, so the page runs the same source the Node tests run (`toString()` into the page). The event bus and the
rigid-body integrator follow the same rule. Determinism is the contract: seeded dice, no clock, the same inputs giving
the same world, which is what lets a level be replayed and walked headless.

## The layers

| Layer | What it does | Where |
|---|---|---|
| World step and collision | blocking against colliders on foot and in 3D, sight and shots against the same boxes, bodies against bodies, riding what moves, frame-rate-independent smoothing | [core.js](../control/lib/graph/worlds/controllable/core.js) |
| Character controllers | one rule a way of moving: on foot, the platform rule (gravity, variable jump, coyote time, buffering, a faster fall, air control), driving, flying, hovering, boats | `rules-*.js` beside it |
| Feel | a game's feel template lowered onto the platform rule's numbers; what the rule does not carry yet is reported, never dropped | [gameworld/feel/lower.js](../control/lib/graph/gameworld/feel/lower.js), the templates `POLES` in `cards.js` |
| Rigid bodies | mass, bounce, friction and spin on a fixed step, wind, drag and attractors | [physics-sim.js](../control/lib/graph/worlds/physics-sim.js) |
| Destructible matter | matter, heat and ground that break, burn and fall (opt-in) | [rupa/](../control/lib/graph/rupa/), [rupa.md](rupa.md) |
| Game logic | a declarative bus: facts become events, reactions guarded by the world's variables, watches, timers and sequences; each mechanic is a lowering onto it, never runtime code of its own | [event-bus.js](../control/lib/graph/worlds/event-bus.js), `MECHANIC_KINDS` in [game/mechanics.js](../control/lib/graph/game/mechanics.js) |
| Minds and navigation | foes' and guards' behaviour; A* on a grid baked from the colliders, string-pulled | [mind.js](../control/lib/graph/worlds/controllable/mind.js), [nav.js](../control/lib/graph/worlds/controllable/nav.js), [foes.md](foes.md) |
| Combat and bosses | hits, melee, ranged, turrets, attack timelines with their tells | the combat builders beside core.js, [boss-fights.md](boss-fights.md) |
| Interface | title, set-up, pause, results, HUD, touch pad | [mana-ui.md](mana-ui.md) |
| Rendering | three.js (vendored, inlined by default), the scene's channels: land, sky, sea, light, effects, figures | [scene-three.js](../control/lib/graph/scene/scene-three.js), [scene/channels/](../control/lib/graph/scene/channels/) |
| Sound | synthesized effects and score, recorded lines where a game has them | [game-audio.md](game-audio.md), [sfx-shelf.md](sfx-shelf.md) |
| Input | keyboard, mouse with pointer lock, gamepads, touch, a headset | `scene/channels/controllable/`, `controls/` |
| Flow, store and saves | what plays when, the store that carries a game's state between levels, a long level's own save | [game-flow.md](game-flow.md), `game/game-shell.js`, `game/level-contract.js` |

The rails are where this shows: one jump carries every feel template, so a stealth hero at near-real gravity with
almost no air control and a stylish-action hero who falls fast and steers in the air are the same rule with different
numbers. A new move on that rule reaches every game that uses it.

## What sits on top

An engine leaves the game's design to whoever uses it. Mojulo carries that layer as words bound to code, and compiles
it down to the runtime: a rail (a game type, [zero-to-level-one.md](zero-to-level-one.md)), the Game Brief's
motivations and labours (`gameworld/gmn.js`: what a game is about and how it is shaped), structures such as the
[walled-core dungeon](walled-core-dungeon.md), the [quest open world](quest-open-world.md) and errands
(`gameworld/errand.js`), and work as Shovels & Buckets cards (`worksim/card.js`). Each lowers to mechanics, and the
mechanics to the bus.

## Where an agent extends it

From the lightest to the deepest:

1. The recipe's own words: a rail's template, its feel, a brief's mix, a structure's parts. Recipes are starters,
   edited in place.
2. A level's own `events` block, merged with the mechanics' on the same bus (`worlds/world-scene.js`).
3. A new mechanic: a lowering onto the bus, with its contract and its audit hint. No runtime change.
4. A new move on a controller: a phase on the platform rule's registry (maneuver, equip, act, dash, claim).
5. A new builder: runtime code, held to the builder contract and the byte pins.

Geometry has a program door (a recipe carrying code run at render, [code-realm.js](../control/lib/graph/polygonizer/code-realm.js));
game logic does not yet.

## What it does not do yet

Said so a promise is never made past them:

- **Collision shapes.** Bodies, spheres, planes and boxes; no triangle-mesh colliders, joints, constraints or ragdolls.
- **Navigation across floors.** One floor at a body's height; stairs and multi-level floors are out of `nav.js`'s scope.
- **Moves.** Each feel template's lowering names what the platform rule does not carry yet (`feelReport`): wall cling
  and wall jump, the held charge, the ground pound, a mech's boost gauge and heavy landing among them.
- **Positional sound.** Sound is not placed in the world.
- **A program door for play.** Logic beyond the bus's verbs is a change to the runtime, not to the recipe.
- **One thread.** No work is moved off the page's main thread.
- **Proof.** The machine gate walks a level whose goal is to reach, survive or escape; other goals are left to the
  person who plays them ([bicycles.md](bicycles.md)).
- **By scope, not by gap.** The web and the desktop only (no native mobile or console build); local multiplayer only;
  no editor or debugger, where conversation, the game's books and the headless playtests do that work.

## Saying it

- Say: the games run on mojulo's own engine, made for the games its rails make, in the browser or as a desktop app.
- Say: it does not compete with Unreal or Unity on fidelity; a team's engine gets the levels, assets and design.
- Never: "the same game in every engine", "a general-purpose engine", or "just an exporter".
- To the person, the README's register holds: what they get (a game they can play and share), not how it is built.
