# hydro-view — a multi-arc science explainer for hydroelectric power

One explainer, told in five arcs. Each arc is a scenario of the single `create_view` kind
`hydro` (`manifest.kind: 'hydro-view'`), and every arc quotes the SAME numbers from one pure
energy chain — so a sequence of mints (dam → penstock → turbine → generator → plant) tells one
consistent story instead of five disconnected pictures.

## What this is

- **Arc 1 `dam`** — the reservoir stores HEAD. Hydrostatic pressure arrows on the upstream face
  grow + darken with depth (P = ρgh; tips land ON the face), and a deep outlet jets at
  v = √(2gh) — the Torricelli/water-pressure principle from fluid-view, scaled up to a gravity
  dam with a tailrace. Nothing spins yet: this arc is stored energy.
- **Arc 2 `penstock`** — PE → KE. Water strands ride equal-time-resampled tracers, so the flow
  VISIBLY accelerates down the pipe; wall-pressure arrows grow with the drop; the nozzle necks
  down and trades pressure for speed. Bernoulli (z + P/ρg + v²/2g = H) anchors the readout.
- **Arc 3 `turbine`** — the machine principle. A Pelton runner (disc + 14 buckets, authored
  centred on the origin) spins live on the windmill's `spin` mover; the jet flies free from the
  nozzle to the wheel's tangent point, splits into the two-sided bucket spray, and a gold force
  arrow carries F = ρQ(v−u)(1−cosθ). Real rpm/torque quoted; render rate clamped watchable.
- **Arc 4 `generator`** — spin → electricity. An N/S pole drum (alternating red/blue faces)
  spins inside a ring of copper stator coils; Faraday's ε = −dΦ/dt is drawn as a gold EMF sine
  beside the machine with a pulse riding it at the pole-pass rate; f = p·n/60 lands on the grid.
- **Arc 5 `plant`** — the whole chain in one world: reservoir → dam → penstock → powerhouse
  (cutaway, runner + generator on one shaft via twin same-ω spin movers) → tailrace, plus a
  pylon and sagging wires with a gold power pulse. The readout totals P = ηρgQH ≈ homes.

## Architecture

- Physics: [physics/hydro.js](../../physics/hydro.js) — `planHydroChain({ head, flow })`, pure
  closed-form couplings (Torricelli, Pelton u = v/2, stage-efficiency powers, synchronous pole
  count). No dice, no integration; same spec → byte-identical chain.
- Depictor: [hydro-view.js](hydro-view.js) — `planHydroScene` (faces/picks/movers/tracers/field
  + bounds + stats) and `assembleHydroScene` (cameras per arc; outdoor arcs daylight
  `#9cc4e8`, machine arcs dark `#0b0f16`; glow off; orbit-only, no CSS-3D /scene form).
- MCP: [tools/hydro-view.js](../../../mcp/tools/hydro-view.js) (`mintHydroView`), registered in
  [create-view.js](../../../mcp/tools/create-view.js) as kind `hydro` (born inside create_view,
  no retired alias).
- World: [world-kinds.js](../../worlds/world-kinds.js) `'hydro-view'`, and
  [sketch-manifest.js](../../sketch/sketch-manifest.js) `OBJECT_RENDER_KINDS`.
- Vocab: [view-vocab/hydro.md](../view-vocab/hydro.md).
- Renderer note discovered en route: the face mesh triangulates QUADS only
  (`TRIS = [[0,1,2],[0,2,3]]` in figures/face-mesh.js), so n-gon drum caps must be fanned into
  quads (`capQuads`) — a bare polygon cap renders as a sliver.

## Knobs

- `scenario` — `dam` (default) | `penstock` | `turbine` | `generator` | `plant`.
- `head` (m, 5–300, default 60) / `flow` (m³/s, 1–600, default 40) — drive every number in the
  chain (toe pressure, jet speed, rpm, Hz, MW, homes).
- `scale`, `viewBox`, `scene.bg`, `ref`, `folder_ref` — the standard view fields.

## Verified

- `physics/hydro.test.js` (Torricelli, P = ρgh, ordered/taxed power chain, linearity in H and
  Q, Pelton u = v/2 + τ = P/ω, momentum-turn jet force, f = p·n/60 near 50/60 Hz across heads,
  clamps, determinism, real-plant sanity band) — green.
- `hydro-view.test.js` (determinism per arc, dam-fallback, world registration, the
  one-chain-five-arcs consistency check, scaling, per-arc derivations: monotone pressure
  arrows, accelerating tracers, spin-mover shape + origin-authored runner, alternating pole
  fills, EMF sine + riding pulse, twin same-ω movers in the plant, wire sag, cameras/bg/glow)
  — green. `create-view` suite green (vocab card count re-pinned 59 → 60).
- End-to-end: all five arcs assembled through the real `assembleHydroScene` → `emitThreeWorld`,
  screenshotted headless (scripts/_hydro-proto.mjs, untracked). Eyes-gate pass: dam pressure
  gradient + jet read; penstock pipe + growing wall arrows read; turbine disc + buckets + jet
  read; generator poles/coils/EMF wave read; plant chain + pylon + power pulse read. Paired
  late frames differ for turbine/generator/plant — the movers and tracers animate.

## Known follow-ups (want a human eye)

- The dam/plant wedge is a clean gravity profile but reads austere — a crest road, spillway
  gates, or abutment banks would sell it (aesthetic only).
- Turbine pedestals read as one slab from dead-front; a slight camera yaw or slimmer pedestals
  would separate them.
- Pressure arrows render as thin field arrows; at wide framing they are subtle until you zoom.

## Not done (possible extensions)

- `measure_view` sampler (the chain is real SI; a per-station table — reservoir / nozzle /
  runner / generator with head, v, P, ω, f — would fit the honesty tiering, but no existing
  landscape/machine view registers one yet).
- A Francis/Kaplan runner variant (reaction turbines) beside the Pelton impulse wheel.
- A `spillway` arc (open-channel flow / energy dissipation) if the explainer wants a flood
  chapter.
