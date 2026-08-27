---
{
  "id": "hydro",
  "name": "Hydroelectric power (multi-arc)",
  "family": "science",
  "entry": "create_view",
  "summary": "Mint one arc of a MULTI-ARC hydroelectric explainer — dam → penstock → turbine → generator → whole plant → night spillway — every arc quoting the same energy chain.",
  "when": "Reach for this on framing like 'how hydroelectric power works / how a dam makes electricity / show me a dam / water turbine / how a generator works / hydro power explainer'."
}
---

Mint one arc of a MULTI-ARC science explainer for HYDROELECTRIC POWER, rendered in the traversable three.js World. Six arcs, each a scenario of this one kind, all quoting the SAME numbers from one pure energy chain, so a sequence of mints tells one consistent story: 'dam' (the reservoir stores HEAD — hydrostatic pressure grows with depth on the dam face, P = ρgh, and the deep outlet jets at v = √(2gh), Torricelli — fluid-view's water-pressure principle scaled to a gravity dam); 'penstock' (the fall converts PE → KE — water accelerates down the pipe as flowing particles, Bernoulli holds z + P/ρg + v²/2g = H, pressure arrows grow with the drop, the nozzle trades pressure for speed); 'turbine' (the MACHINE principle — the jet's momentum turned by Pelton buckets is a FORCE F = ρQ(v−u)(1−cosθ), the force at radius R is a TORQUE, the runner SPINS live at maximum power transfer u = v/2); 'generator' (spin → electricity — red/blue magnet poles sweep past copper stator coils, the flux through each coil changes, Faraday's ε = −dΦ/dt draws the gold EMF wave, f = p·n/60 lands on the grid); 'plant' (the whole chain in one world — reservoir → penstock → runner → generator → transmission wire, water tracers riding the water path and gold power pulses riding the line, P = η·ρ·g·Q·H ≈ homes powered); and 'spillway' (the plant's NIGHT FACE shedding the flood — a gate count set by the design discharge, a white veil falling through EACH bay under warm crest lights, the reservoir standing AT HEAD behind the wall on a boundary-masked water sheet, and a tailrace where every gate mouth is a coherent ripple source so the churn downstream IS their interference fan — the double-slit move scaled to a dam, with a snow-capped ridge behind). Visual scale is compressed for a watchable world; every readout and CLICK-pick quotes the real SI numbers. Served as a live, traversable three.js World at `/api/sketches/<ref>/world` (drag to ORBIT, scroll to zoom); CLICK the dam / runner / rotor / pylon for facts. You pass a tiny recipe (an arc + head + flow); the substrate stores ONLY the recipe (`manifest.kind === 'hydro-view'`, no geometry) and regenerates on render. ORBIT-ONLY object study: no CSS-3D `/scene` form; open the worldUrl. For the full explainer, mint the arcs in order — dam → penstock → turbine → generator — then 'plant' as the closing wide shot and 'spillway' as the night finale.

## Parameters

Pass these in `create_view`'s `params` object. `title`, `viewBox`, `scene`, `ref`, `folder_ref` are top-level `create_view` params and may be omitted from `params`.

- `title` (string) — Title for the resulting sketch artifact.
- `scenario` (string) — Which arc (default 'dam'): 'dam' (stored head + hydrostatic pressure + Torricelli outlet), 'penstock' (PE → KE, Bernoulli down the pipe), 'turbine' (Pelton runner — momentum → torque → spin), 'generator' (Faraday — poles sweep coils, EMF wave), 'plant' (the whole chain in one world), 'spillway' (the night flood-discharge face — gates, veils, interference tailrace).
- `head` (number) — Gross head H in metres (default 60, clamped 5–300). Drives EVERY number in the chain: toe pressure, jet speed v = √(2g·ηH), runner rpm, grid frequency, output MW.
- `flow` (number) — Design discharge Q in m³/s (default 40, clamped 1–600). Scales jet force and output power.
- `scale` (number) — Overall size multiplier (default 1).
- `viewBox` (object) — Optional render size { width, height } (default 1120×780).
- `scene` (object) — Optional scene options, e.g. { bg: "#9cc4e8" }. Outdoor arcs (dam/penstock/plant) default to daylight; machine arcs (turbine/generator) default dark.
- `ref` (string) — optional stable sketch ref.
- `folder_ref` (string) — optional sketch folder to file under.

## Worked example

```
{ kind: 'hydro', title: 'the dam stores head', params: { scenario: 'dam', head: 80, flow: 55 } }
```
