# Soft ground: sand, snow and mud

An isolated follow-up on `1003-particle-vacuum`. A walker leaves footprints that persist, and a pushed crate plows the ground. It uses the same friction principles as the grain kernel in `../sand/`, with no physics library. One kernel covers sand, snow and mud, because they differ only in four physical properties. Nothing here registers a channel, kind, MCP tool or exporter. This is an optional layer for levels that need walkable soft ground.

## Why a depth bed, not grains

A level needs metres of ground. At grain scale that would mean millions of particles, so the bed stores an integer sand depth per grid point (2.5 cm spacing, 1 mm quanta) over a hard-ground base. The surface is base plus depth. Every operation moves whole quanta between points, so mass conservation is exact, not approximate.

## Rules

All four properties are parameters of one kernel, and `SOFT_GROUNDS` exports the presets:

| Ground | Sliding μ | Static μs | Cohesion | Compaction | Viscosity | What you see |
|---|---|---|---|---|---|---|
| Dry sand | 0.60 | 0.70 | 0 | 1 | 1 | Prints slump to soft dimples. All displaced sand forms the rim. |
| Damp sand | 0.65 | 0.80 | 4 cm | 1 | 1 | Print walls and rim crests stand. Drying it slumps them. |
| Fresh snow | 0.80 | 1.20 | 20 cm | 3 | 1 | Deep boot holes with vertical walls and a small rim. Repeat passes firm into a trail. |
| Mud | 0.35 | 0.70 | 3 cm | 1 | 0.04 | A thick squeezed-up rim, then the walls ooze back over about a second, leaving a softened dent. |

- **Cohesion (Mohr–Coulomb).** Shear strength is c + σ·tanφ, so a cohesive wall stands to a critical height whatever its angle. A column starts to flow only when its drop exceeds μs × distance + c. Once it has failed, cohesion is broken and it flows down to μ alone, which is residual strength.
- **Compaction.** A second integer layer holds packed material, and a packed quantum carries r loose quanta of mass. Mass is loose + r × packed and stays exact. A press on compressible ground first spills a small `spill` fraction of the cut to the rim. It then crushes r loose quanta into one packed quantum (the column drops by r − 1) until the sole height is reached, and spills anything it could not compact. Packed material bears load and never flows. A second pass therefore sinks only into the loose snow left beneath, and a third barely sinks at all, which is trail breaking. A plow that cuts packed material breaks it back into r loose quanta.
- **Viscosity.** A flowing column sheds viscosity × half its worst excess per tick. For granular sand that is the full half, so neighbours meet halfway at once. For mud it is a small fraction, so over-steep walls take seconds to settle.

- **Relaxation** uses the grain kernel's friction pair plus cohesion, over 8 neighbours with thresholds weighted by distance. A resting column starts to flow only when its drop to a neighbour exceeds μs × distance + cohesion. Once flowing, it keeps shedding while any drop exceeds μ × distance. Each step sheds half the worst excess, shared by excess, with the remainder going to the steepest neighbour.
- **Why prints persist:** their walls stay up until they pass the yield, and a wall that passes it slumps toward atan(μ). Wetting or drying sand re-tests every wall.
- **Sleep is sound:** a column's rule reads only its own top and its 8 neighbours', so a change at one point wakes exactly the 3×3 around it. A settled bed does zero work, and the verifier checks that waking everything moves nothing.
- **Foot plant (`press`):** the sole is a heel disc plus a forefoot ellipse, oriented by heading. It is lowered to the mean surface under it minus `sink`, with the heel deeper than the toe. All sand above the sole goes to a rim band around the print, weighted toward the `push` vector (travel direction × strength). The result is a dent with a lopsided lip.
- **Plow (`plow`):** a box with its bottom at a given height moves by (dx, dy). Sand above that bottom inside the box is carried to where its line of travel leaves the box. Relaxation turns that berm into a bow wave and side levees, and leaves a groove behind.

The kernel is one import-free closure, `buildSandBed`. The preview inlines `buildSandBed.toString()`, the same pattern as `terrainKernel` and `buildBus`, so the page runs exactly the code Node verifies.

## Preview

`preview.mjs` writes one self-contained page. three.js is inlined through the World page's own `inlineImportmap()`, so no CDN is needed. Controls: WASD or arrows walk, Shift runs, drag orbits the camera, and walking into the crate pushes it. Other options in the page:
- Ground type: dry sand, damp sand, fresh snow or mud. Switching between the two sands re-tunes the live bed, so existing prints hold or slump. Any other switch lays fresh ground.
- Foot sink depth, which defaults per ground.
- An auto-walk figure-eight, for a trackway without a keyboard.
- Smooth the bed.

How the page drives the bed:
- **Foot plants:** these come from gait half-cycles, the same edges `audio.js` uses for footsteps. Each plant lands half a stride ahead of the body, offset left or right.
- **Sand clock:** the bed advances on a fixed 60 Hz tick, independent of frame time.
- **Mesh updates:** only the rows a tick changed are re-uploaded.
- **Light:** a low sun gives grazing light, so 2–3 cm prints read clearly. Churned material is tinted slightly darker, packed snow faintly blue, and mud gets a wet sheen.

`window.__sandBed` exposes the state for capture and debugging.

## Run from control/

```sh
node scripts/spikes/sand-bed/verify.mjs
node scripts/spikes/sand-bed/preview.mjs /absolute/output/sand-bed.html
```

## Verification

Machine checks pass (see the verify output for measured values):
- Prints conserve mass, and the heel sits deeper than the toe.
- The rim is heavier toward the push.
- A print settles within a few ticks, and a settled print stays byte-identical for 2,000 ticks with zero checks.
- Waking every cell moves nothing.
- Damp sand keeps more of the print volume than dry.
- Re-tuning damp to dry slumps every wall under its yield, with mass exact.
- Snow compacts: a deep hole that holds, a rim made only of the spill, and mass exact with packed quanta counted at the compaction ratio.
- Snow trail breaking: each pass in the same print sinks less.
- A plow through packed snow breaks it back to loose, with mass exact.
- Mud oozes back over at least ten times as many ticks as sand and still keeps a dent.
- With cohesion and compaction at their defaults the kernel is byte-identical to the sand-only version: the same scripted walk and plow hash the same.
- The plow leaves a groove at its bottom, a bow wave and levees, with mass exact.
- A scripted walk replays byte-identically.
- Inputs are validated.

On the full 400×400 bed, 60 prints at one per 16 ticks averaged about 0.01 ms per tick in Node, with a worst tick around 1.5 ms. That figure excludes mesh upload and rendering.

The agent ran the page module headlessly against real three.js with a stubbed renderer. It walked, pushed the crate, auto-walked and switched between all four grounds, with zero mass drift. The agent also inspected hillshade renders of the resulting bed. Nobody has yet watched it in a browser; that eyes gate is still open.

## Limits

- **Faceted mounds:** the 8-neighbour stencil faces large mounds, such as a long plow berm, as octagons. A 16-neighbour (knight-move) stencil would round them, at about twice the cost per check and a 5×5 wake.
- **Single-valued surface:** there are no overhangs or tunnels.
- **No airborne grains:** a kick sends nothing into the air; the grain kernel in `../sand/` is the piece that would supply that.
- **One ground per bed:** each bed has a single ground type and one moisture setting; there is no per-cell moisture field or snow-over-mud layering.
- **Repeat steps in sand and mud sink again:** only snow firms under repeated steps. Sand and mud have no densification memory.
- **Simple foot-plant geometry:** feet are placed from the gait signal and heading, not from rig ankles.
- **Simple crate:** it is an axis-aligned square pushed along the contact normal, with no rotation or physics body.
- **Page only:** there is no Godot, Unity or Unreal leg.

## Toward a mojulo level

The cheapest path into a real world:
- **Channel wiring:** add an opt-in `sand` channel as a bespoke conditional block in `scene-three.js`, in the style of `terrain` or `crystalLight`, so absent pages keep their bytes. It would inline this kernel, build the sand mesh that the existing raycast `__ground` hook already walks on, and step on a fixed tick.
- **Player plants:** read foot plants from controllable entities' `gaitPhase`, `moving` and `grounded`.
- **Pushed bodies:** plow with physics bodies or crates.
- **Recipe and minting:** the recipe would carry the bed size, depth, a `SOFT_GROUNDS` preset or its five properties, and the sink depth. `compose_world`'s controllable whitelist would need the key.
- **Tests:** add an emit fixture for the new block.
- **Before committing:** decide the replay contract. The live loop is variable-dt while capture steps at 1/24, so the sand tick has to be driven from a fixed accumulator in both.
