# Particle vacuum: isolated level carrier spike

Branch: `1003-particle-vacuum`. This is a computational authoring experiment, not a physical assertion that particles are stationary waves. Nothing registers a new kind, channel, MCP tool, level schema, or event-bus verb.

## What the source says

- `lib/graph/polygonizer/wave-field.js`: a sampled 2D displacement surface over four corners. Suitable for continuous surfaces; it does not own particle identity, time, or contact.
- `lib/graph/polygonizer/wave-manji.js`: closed vector polylines about a singularity. This supplies a compact, localized particle carrier. The spike uses its actual mandala printer, not an independently drawn imitation.
- `lib/graph/landscape/fluid-view.js`, `water-pressure`: hydrostatic pressure and Torricelli jet velocity produce ballistic tracer paths. These are the closest source example found to the described dam experiment. No supplied dam recipe was available to confirm it is the same experiment.
- `lib/graph/worlds/event-bus.js`: physics contact/rest/enter facts already have a deterministic reaction layer. Particle activation should consume these facts rather than invent a second production event system.
- `lib/graph/game/level-contract.js`: the level contract describes game-store outcomes. Individual carrier contacts belong inside the world, with only meaningful aggregated outcomes crossing the contract.

Here “level” assumes a game world, rather than architectural `levels[]` storeys.

## Working abstraction

A carrier has a stable id, an anchor, and a reusable wave template. The vacuum is the collection and its event history; “vacuum” does not yet mean a physical field. Frozen state means phase and center do not advance. Contact is an authored event `{id,time,center,radius,impulse}`. Test current centers against the radius, scale by linear falloff, and activate only intersecting carriers.

The impulse produces analytically integrated exponentially decaying displacement. Activation advances phase, rotates and pulses the template, then freezes after five seconds at the displaced center. This separates identity, vector geometry, and event response. It needs no per-frame random sampling and supports arbitrary seeking. Repeated contacts superpose responses; they do not exchange momentum with other particles.

The same closure executes in Node verification and the browser. Geometry is z-up in metres. Canvas only projects world vectors for a dependency-free preview; the 3D data remains explicit polylines. The probe ring indicates the horizontal cross-section of a spherical contact volume.

## Run from control/

```sh
node scripts/spikes/particle-vacuum/verify.mjs
node scripts/spikes/particle-vacuum/preview.mjs /absolute/output/particle-vacuum.html
```

Open the HTML, click Contact at probe, and observe the amber carriers moving while cyan carriers remain fixed. Move the probe or radius and fire additional events. Seek backward and forward to inspect replay. Drag to orbit; Reset clears the log.

Machine checks pass: frozen stasis, future-event isolation, local response, displacement, settling, contacts evaluated at current position, arrival-order-independent replay, frame-independent seeking, finite geometry, invalid input rejection. The existing wave-manji, wave-field, and fluid-view suites also pass (84 tests). Browser interaction and human visual acceptance remain unverified: automated file URL opening was blocked by the browser policy.

## What this establishes and what it does not

The existing vector primitive can depict frozen carriers and event-driven activation without modification. It does not establish emergent wave dynamics: rotation/pulsation are response rules around a wave-manji shape, not a solved wave equation. This prototype has no collision detector, particle-particle coupling, pressure, gravity, conservation law, or real vacuum fluctuations. Drag removes energy by design. Settling has a small cutoff at five seconds. The runtime replays histories on each sample; long logs need incremental state and spatial indexing before integration. Equal-time events use stable id order, so this is deliberately sequential rather than simultaneous physical interaction.

## Suggested integration boundary after review

An opt-in world-local carrier channel can hold pool/template references, seeded placement, and explicit response parameters. Let existing physics emit contact facts; adapt those to carrier excitation through the existing bus. Keep a lightweight center/collider distinct from visible vector geometry. Separate placement, response and depiction so a loop, localized packet, tracer or mesh can depict the same identity. Preserve absent-channel bytes and define exporter behavior before adding a production schema.

The next experiment should compare the same events across a point tracer, a closed wave carrier, and a localized wave packet. That will reveal whether the wave representation adds useful authoring behavior or only changes appearance. Decide whether carriers exchange energy, merge into a continuous field, or remain independently addressable before choosing a solver.
