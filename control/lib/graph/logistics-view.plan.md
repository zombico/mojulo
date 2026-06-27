# logistics-view.plan.md

Design note for a proposed data-driven spatial-logistics primitive. Status: **speculative** —
this is the proposed layer, not sealed reality. Written to be evaluated, not yet built.

## The one idea

`logistics-view` is not a solver and not a simulator. It is a **renderer for a recommendation the
agent already made.** It sits in mojulo's standing grain: **mojulo recommends, the operator executes.**
The optimization lives in the agent's reasoning (and in any solver the agent chooses to call as one more
MCP tool); this primitive's only job is to make that recommendation *visible enough to judge*.

This reframes the earlier "the renderer can't optimize" objection. That was a category error — it held
the renderer to a job the architecture deliberately puts elsewhere. The renderer never needed to own
optimization. It needs to render the answer the operator's agent produced, well enough that the operator
can own the consequence.

## Why this is in-grain, not a new paradigm

The "scientific" primitives already prove the engine has a fully data-driven lane — distinct from the
seed-driven decorative lane (`fractal-city`, `transportation-hub`). Every one of them reads **real domain
data**, applies a **real domain placement rule**, and lowers to a three.js world:

- `atom-view.js` — element symbol → periodic table lookup → aufbau/Hund rules → orbital geometry.
- `molecule-view.js` — caller-supplied atoms `{symbol, pos}` + typed bonds `{order:1|2|3}` → PCA framing
  → ball-and-stick. **This is already a node/edge graph at arbitrary 3D coordinates with typed edges.**
- `orbit-view.js` — real Kepler elements → equal-time sampling (bodies visibly accelerate).
- `mechanics-view.js` — Newtonian presets → RK4 integration → equal-time trajectory.
- `scene-planetary.js` — real coastline + DEM data, geo-locked to an ISO instant (frozen or live).

`logistics-view` is the same scaffold pointed at a new domain. No new renderer, no new walker.

## The scaffold (lifted verbatim from the science lane)

```
tiny recipe  →  domain data table  →  domain placement rule  →  three.js world
```

- **Recipe (persisted, deterministic):** `{ kind:'logistics-view', site, asOf?, layers? }`. Small and
  stable, like `{element:'C'}`. Geometry is regenerated on render, never stored.
- **Domain tables (hand-authored, the way `ELEMENTS` / `CELL_TYPES` / `ORGANELLE_INFO` are):**
  `SITE_GEOMETRY` (bounds, rack rows, dock doors, staging zones), `RACK_TYPES` (dims, capacity),
  `UNIT_CLASSES` (pallet/container dims + color-by-fill ramp).
- **Placement rules (pure functions, like `electronConfig(Z)` / `shellRadius(n)`):**
  `placeUnits(site, state)` → coordinates; `occupancyTint(fill)` → color; `replayPath(waypoints, t)` →
  equal-time samples (borrow `mechanics-view`'s sampler directly).
- **Backend:** `emitThreeWorld` faces payload — same as every science primitive. Free-coordinate
  (NOT cardinal-locked; that constraint is the polygonizer lane's, not this one).

## What each existing primitive donates

| Logistics need | Borrowed from | Mechanism |
|---|---|---|
| Network of nodes with **typed edges** (route w/ capacity/cost) | `molecule-view` | atoms→nodes, bonds(order)→typed edges at arbitrary coords |
| **Occupancy / heat** coloring (rack fullness, dwell time) | `atom`/`cellular` tints | scalar → color ramp |
| **Replay over time** (truck on route, throughput over a shift) | `mechanics`/`orbit` | equal-time sampling of a *given* trajectory |
| **State "as of" a timestamp** (yard at 2pm; live) | `scene-planetary` geo-lock | freeze to ISO instant, or `live:true` re-resolve per render |
| **Domain vocabulary** (rack, dock, container) | `atom`/`cell` data tables | author the table; the seam is proven |

## The recommend → execute loop (the actual product)

```
agent reasons out a layout / route / slotting          ─┐
  (heuristic, OR by calling a real solver MCP tool)     │  RECOMMEND  (mojulo + agent)
  → emits a logistics-view recipe (nodes+edges, paths)  ─┘
        ↓
  create_logistics_view renders an inspectable 3D world
        ↓
operator reviews the world, owns the call, iterates      ─  EXECUTE  (operator)
```

Each turn is one optimization step. The "0 → 1" jump — spreadsheet + gut feel → a concrete, defensible,
*seeable* layout with reasoning attached — is the highest-leverage optimization in the workflow, and the
one this loop is built for. Exact/provable optimization, where contractual money rides on the last 2%, is
not excluded: the agent calls a solver as another tool, then renders the certified answer. mojulo stays
the deliberation anchor and audit trail around the whole loop.

## Honest edges (so the operator owns the call with eyes open)

- The agent's recommend is **heuristic unless it calls a solver.** Good 40-stop route, not certified
  shortest. Fine for 0→1; name it when penalty money rides on optimality.
- **Garbage data in → a convincing, wrong picture.** Suitability of the input is the operator's
  judgment (per TERMS.md / responsibility-model), not the renderer's.
- Replay is **single-trajectory playback, not interacting multi-agent sim.** Forklift-dodges-forklift is
  pre-computed upstream, then played. No emergent behavior, no collision solving in the renderer.

## Open questions before building

1. Table-authoring cost: how much of `SITE_GEOMETRY` is hand-authored vs. imported (DXF/CSV/WMS export)?
   `molecule-view` takes arbitrary caller coordinates today — an import adapter may be most of the work.
2. Edge semantics: do we render edge *properties* (capacity/cost as width/color/label), or just topology?
   `molecule-view` renders bond *order* as parallel rods — a precedent for encoding an edge scalar visually.
3. Scope of `asOf`: snapshot only, or scrubable timeline? Geo-lock gives snapshot cheaply; a timeline is
   the `forge_motion` deck path over a sequence of states.
