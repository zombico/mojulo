# CAD aid — hardening the steps and seams of the physical-object pipeline

Status: analysis + roadmap (2026-08-30). Phases 0 + 1 and the
housekeeping items LANDED same day (see the phase notes); phases 2–4
open. Sibling of [edit-3d-recipes.plan.md](../../../../lite-template/integration/plan-archive/edit-3d-recipes.plan.md)
(which owns the solids edit-path documentation gap; phase 3 here leans
on it).

## Why

Mojulo's positioning already claims the CAD-aid role: the agent-driven
UPSTREAM that feeds the tools professionals use — Blender, the slicer —
never a fidelity rival, never a kernel. The substrate backs the claim with
the right bones: deterministic recipes as the sovereign artifact, mint-time
validation, `translate_modeler_lingo`'s three-level honesty tags
(`native | partial | handoff`), and the bicycle doctrine
([docs/bicycles.md](../../../../docs/bicycles.md)) naming exactly the
loop shape a CAD handoff needs — self-documenting, two-gate (machine +
eyes), resumable cold.

What's missing is not modeling features. The doctrine is explicit that
booleans/B-rep/NURBS belong to the DCC
([face-ops.js:24-28](../../graph/polygonizer/face-ops.js) — "the honest
moment to export and reach for Blender"). What's missing is that a few
STEPS of the existing pipeline are soft where CAD use needs them hard,
and one SEAM stops one instantiation short of general.

## The pipeline as it stands (the steps)

1. **Intent → recipe.** `mint_solid` workbench: six monomers (lathe with
   harmonics, extrude with taper/shell, sweep, drape, relief, shells) +
   stacking assembly, lowered to face lists. The semantic face selector
   ([face-select.js](../../graph/polygonizer/face-select.js)) is the
   CAD-grade asset here: index-free feature selection, refused at mint
   when it matches nothing.
2. **Machine gate (advisory).** The closure lint
   ([face-closure.js](../../graph/polygonizer/face-closure.js)) is a real
   manifold audit — but per-monomer, mint-time, workbench-only, never
   gating. `stats.parts[]` gives per-part bounds; `verify_machina` gives
   feasibility margins but takes typed numbers, not measured geometry.
3. **Eyes gate.** Turntable + multi-view studies.
4. **Export.** `export_model` → GLB / binary STL
   ([sketch-model-export.js](sketch-model-export.js)), with the honest
   in-band "not guaranteed manifold" note.
5. **External refinement.** Blender / slicer — the `handoff` tier of
   `translate_modeler_lingo`.
6. **Bind back.** `bind_mesh_render`: full geometry decode at the door,
   append-only slot + sha256 sidecar, placement by `meshRef` — geometry
   never enters the manifest.
7. **Keep + iterate.** BROKEN for solids: no revisions, `diff_sketches`
   is visual-only, `save_recipe` refuses solids
   ([save-recipe.js:108-112](save-recipe.js)) — while beats has all
   three.

## The seams, ranked by CAD readiness

- **The Blender worker contract**
  ([bake-world-gi.py](../../../scripts/bake-world-gi.py)) — one
  config.json, GLB in / GLB out, exit code; deliberately a "dumb,
  deterministic executor." The most swappable seam in the repo and the
  template for any future CAD worker. Its gear-adapter pattern
  (`{match, source, bind}`) is proven with two adapters.
- **`bind_mesh_render`** — the inbound door; works today for Blender,
  works for FreeCAD via glTF export. GLB-only (no STEP/STL/OBJ readers
  exist), decode deliberately lossy, provenance is a free-text `note`
  (the image seam records `source` structurally; the mesh seam doesn't).
- **The render-handoff queue** ([render-handoff.js](render-handoff.js)) —
  structurally a generic durable job queue (manifest-hash idempotency,
  atomic claim, two audit blobs, no-self-accept), semantically hardwired
  to PNGs. House precedent is copy-the-pattern-per-media (the voice plan
  plans a sibling table), not generalize-the-table.
  [interchange.plan.md](../../../../lite-template/integration/plan-archive/interchange.plan.md)
  pins the graduation trigger: "the durable queue graduates only if
  unattended workers ever show up."
- **Catalysts / mcp-orbit** — fully generic over operator MCPs, audit-only,
  and today DISJOINT from the geometry seam: a bound slicer MCP has no
  path into the render queue, and export never consults the inventory.

## Invariants (unchanged by everything below)

- No CSG kernel, no B-rep, no NURBS, no constraint solver, no native
  STEP/IGES. Booleans and repair live across the seam, forever.
- Recipes stay sovereign; anything inbound is a bound derived artifact
  with provenance, append-only under `data/outcomes/<ref>/`.
- Machine gate and eyes gate are never conflated; advisory checks report,
  they do not refuse (livability-check posture).
- Claim "print-ready STL at true scale", never "guaranteed watertight
  manifold" ([context.js:232](context.js)).

## Phase 0 — true scale is structural; the floor stays home ✅ landed

Two export defects, one phase. As built: `measuredFloor` stamps
`studio: true` on its plate + grid (grounds propagate the tag through
`assembleBoxCityScene`); `isPrintableFace` in scene-stl.js drops them
from the STL while the GLB keeps the scale cue. `deriveStlScale`
(sketch-model-export.js) maps declared `units` → mm when `scale` is
omitted; explicit always wins; unknown/absent units keep scale 1 with an
in-band nudge. City grounds carry no tag and still print. Tests:
scene-stl.test.js (studio exclusion), export-model.stl.test.js
(derivation, floor absence, explicit-wins); the world-kinds
characterization snapshot moved for exactly workbench / assembler /
vehicle-instance, nothing else.

**(a) Studio-floor contamination — confirmed in code, one live export
verification owed.** The workbench's measured grid lines are plain faces
with no filter marker
([workbench.js:189](../../graph/worlds/workbench.js), merged into the
payload at :243); `solidPositions` filters only
`water` / `decal:'shadow'` / `decal:'ink'`
([scene-stl.js:38-41](../../graph/scene/scene-stl.js)). So
`export_model({format:'stl'})` on a workbench ships the measuring grid as
zero-thickness quads — exactly the slicer poison scene-stl's own header
warns about. Fix: tag studio-furniture faces at the source
(`decal:'studio'` or a `studio:true` flag on `measuredFloor` output) and
add it to the STL filter — GLB keeps the floor (it is the scale cue for
DCC round-trips), STL drops it. Decide grounds' treatment in the same
pass.

**(b) `units` → scale wiring.** `manifest.units` is a decorative string;
STL `scale` is a bare multiplier defaulting to 1; nothing connects them.
"True scale" currently rests on the agent doing arithmetic. Fix: when
`format:'stl'` and `scale` is omitted, derive it from declared units
(`cm`→10, `mm`→1, `in`→25.4; edifice `ft`→304.8 — surely a
`scale`-required refusal instead for building-sized refs), echo the
derivation in `result.note` and the export README. Explicit `scale`
always wins.

Tests: `scene-stl` export of a minted workbench asserts zero
floor/grid triangles and the derived mm scale; a `units:'cm'` lathe of
known height exports at 10× coordinates.

## Phase 0b — print profiles: discriminate what an STL *is* ✅ landed

Follow-up to phase 0, same posture (advisory, never a gate — suitability
belongs to the operator; any kind with geometry still exports). Every
STL now carries a **print profile** driving the scale strategy and the
honesty note (`PRINT_PROFILES` / `printProfileFor` in
sketch-model-export.js):

- **literal** (workbench, assembler, carved-solid, css3d-turntable,
  vehicle-instance) — a true-scale part; `units` derivation as phase 0.
- **maquette** (fractal-city, condo/school-complex, edifice, dungeon,
  transportation-hub, subway-*, floorplan, restaurant,
  painted-landscape, planetary, controllable, koenigsberg,
  math-structure) — a miniature; **fit-to-size**, never units (a stray
  `units:'ft'` on an edifice must not print a building at building
  scale).
- **study** (figure, manji-tree) — open shells by construction; closure
  audit skipped with a solidify-in-DCC pointer (absorbs the old
  `CLOSURE_SKIP_KINDS`).
- **ornament** (the science/math views + unknown-kind fallback) — scale
  is meaningless, not merely unknown. Behaves like maquette except in
  the note, so a misclassified future kind is cosmetic.

Precedence everywhere: explicit `scale` > `target_mm` (fit longest
printed dimension, default 120mm for non-literal) > profile default.
`facesToStl` now returns post-scale `bounds`; results carry
`print_profile` + `size_mm` and the README's Print notes name the
profile. GLB stays undiscriminated on purpose — the depiction capture
is honest for every kind; the only GLB gate remains "no geometry at
all". Tests: export-model.stl.test.js (profile map, target_mm fit,
size readout), scene-stl.test.js (bounds).

## Phase 1 — whole-object closure audit at export ✅ landed

As built: `auditStlClosure` (sketch-model-export.js) runs on every STL
export over the printable set (base faces + repeat templates, template
holes counted once per instance); verdict rides `result.closure`, the
in-band note, and a "## Print notes" README section. Advisory, never
gating. `CLOSURE_SKIP_KINDS` = figure / manji-tree (surface studies,
says so in the verdict); every other kind is audited — assembler and
carved-solid included, per the paragraph below.

The manifold lint runs at the wrong grain (per-monomer) and the wrong
moment (mint). Add an export-time pass in `exportModelHandler`
(format `stl` only): run `findOpenBoundaries` / `auditClosure` over the
final unioned face soup (post-repeat-expansion, post-floor-filter), and
stamp the verdict — hole count, widest hole in declared units — into
`result.note` and the export README. Advisory, never gating: the point is
that the machine gate travels WITH the artifact instead of evaporating at
mint. This is the submit-time machine gate a future CAD bicycle (phase 4)
will reuse verbatim.

Extend the same audit to the kinds that today have none where it is
meaningful (assembler, carved-solid); skip figure/manji-tree (surface
studies, not print candidates — say so in the note).

## Phase 2 — `measure_solid`

`measure_view` refuses solids by design — the honesty posture is right,
the coverage is the gap. Add a `measure_solid` sibling that reads back,
deterministically from the resolved face list, in declared units:

- bounding box + per-part bounds (promote `stats.parts[]` to a channel),
- point-to-point / feature-to-feature distances using the existing
  semantic face selectors as the addressing scheme,
- enclosed volume + centroid where closure permits (divergence theorem
  over the soup; report alongside the closure verdict so an open shell's
  volume is labeled as such, never silently wrong).

Non-goals: GD&T, tolerances, drawings, inertia tensors. The bar is "the
numbers an agent needs to sanity-check a part before export," not
metrology. Feeds `verify_machina` (measured masses from volume × a
declared density would close its supply-the-numbers gap — optional
stretch).

## Phase 3 — the solids revision lane

Sovereignty parity with beats, so the iterate step stops leaking state
into sibling refs:

- `save_recipe` solids lane (the refusal at
  [save-recipe.js:108-112](save-recipe.js) already names this as owed —
  "solids / motion join by the same lane pattern").
- A structured recipe diff for solids — parameter-level ("lathes[0]
  profile changed, height +2cm"), the shape `diff_beats` already proves;
  `diff_sketches` stays the visual sibling.
- Revisions ride on edit-in-place, which is
  [edit-3d-recipes.plan.md](../../../../lite-template/integration/plan-archive/edit-3d-recipes.plan.md) phase 2's territory
  (document the existing `update_sketch` path first); a
  `sketch_revisions` table mirroring `beats_revisions` is the natural
  landing, decided there, consumed here.

## Phase 4 — the CAD bicycle (gated on an unattended worker)

Do NOT build ahead of the trigger. When an unattended geometry worker
materializes (headless FreeCAD/OpenSCAD doing booleans/fillets/repair, or
an unattended slicer), graduate the mesh seam to a durable queue:

- a `mesh_op_requests` sibling of `image_render_requests` (house
  precedent: sibling table, shared pattern — not a generalized table),
- the pull packet carries a job config in the bake-worker's contract
  style (one JSON, GLB in / GLB out),
- phase 1's closure audit is the submit-time machine gate; accept/reject
  with `accept_audit` is the eyes gate (the bake seam's known gap — eyes
  never recorded — gets fixed by construction here),
- add a lease/expiry column at design time (the image queue's
  `STALE_IN_FLIGHT_SECONDS` is "a READING, never a transition" — fine for
  minutes-long renders, wrong for hour-long CAM/FEA jobs),
- STEP/3MF enter mojulo only as worker OUTPUTS bound with provenance,
  never as native readers.

Until the trigger: the agent-driven synchronous path (export → drive the
tool → `bind_mesh_render`) is the supported story. A cheap bridge that
can land any time: a `print-object` catalyst walking export_model →
operator's slicer MCP (composed via `bind_primitives`) → bound report —
the first thread connecting the catalyst seam to the geometry seam.

## Housekeeping (independent, small) ✅ landed

- [catalysts/design-object-workbench.md](../catalysts/design-object-workbench.md)
  promises "a watertight, 3D-printable mesh" — contradicts the pinned
  doctrine ([context.js:232](context.js)) and the export note. Reword to
  the honest claim.
- Field-kind count drift: code has nine
  ([fields.js:24](../../graph/polygonizer/fields.js)), the synthesis doc
  says eight, the manji-tree vocab card says three. Reconcile toward the
  code.
- `bind_mesh_render` sidecar: add a structured `source` field (which
  tool produced this mesh) matching the image seam's provenance shape.

## Non-goals

*Amended 2026-09-05 (field-solids.plan.md D0, decided by the maintainer):
"CSG/booleans in-substrate" is narrowed to MESH-ON-MESH CSG kernels.
Field-space composition (the workbench `fields` monomer — `subtract` /
`intersect` / `stroke`, polygonized by the surface net, edges rounded to
about a grid cell) and the Manifold export pass (`export_model union:true`,
interchange-seams seam 4a) are IN. Sharp machined booleans in the recipe
remain seam 4b's question.*

Mesh-on-mesh CSG kernels in-substrate, B-rep/half-edge topology, NURBS, a 2D
sketcher, constraint/mate solving, feature trees, GD&T/tolerances,
dimensioned drawings, native STEP/IGES/3MF readers or writers, mesh
repair. Every one of these is either the DCC's job across the seam or a
fidelity claim the doctrine forbids.

---

## Corral — the open concern ledger (2026-08-31)

Everything CAD-shaped that is still open, gathered from this plan, the code,
and the sibling ledgers, so the reforge starts from one list instead of six.
Verified against the tree at `283d5c2` + working tree.

### Settled — do not re-litigate

Phases 0, 0b, 1 and the housekeeping items landed. The doctrine holds:
recipes sovereign, no mesh-CSG/B-rep/NURBS in-substrate (field-space
composition excepted — D0, 2026-09-05), advisory-never-gating,
"print-ready STL at true scale" and never "guaranteed watertight manifold"
([scene-stl.js:24](../../graph/scene/scene-stl.js) states the honest claim
in its own header). The non-goals list at the foot of this plan stands.

**Residuals from the landed work:**

- **R1.** Phase 0(a) recorded "one live export verification owed" — a real
  `export_model({format:'stl'})` on a minted workbench, eyeballed in a
  slicer. Unit tests cover the filter; no eyes gate is recorded.
- **R2.** Field-kind drift is reconciled in the code (nine in
  [fields.js:24](../../graph/polygonizer/fields.js)), in
  POLYGONIZER-SYNTHESIS, and in the manji-tree card — but `CLAUDE.md:9`
  still says "the seven field kinds". One-line fix, cosmetic.

### C1 — The measurement gap (phase 2, unstarted)

`measure_solid` does not exist; `measure_view`
([measure-view.js:134](measure-view.js)) refuses solids by design. There is
today **no way to read a number back off a solid** — no bbox, no per-part
bounds as a channel, no feature-to-feature distance, no enclosed volume or
centroid. `stats.parts[]` holds bounds but is not a read-back channel.

Consequence: the agent cannot sanity-check a part before export, and
`verify_machina` ([machina.js](machina.js)) still takes typed numbers rather
than measured geometry — its supply-the-numbers gap is unclosed.

### C2 — The sovereignty gap (phase 3, unstarted)

Solids are second-class against beats on all three counts:

- `save_recipe` refuses them by lane
  ([save-recipe.js:108-112](save-recipe.js) — the refusal string names the
  debt: "solids / motion join by the same lane pattern").
- No structured parameter-level diff. `diff_sketches` is visual-only;
  `diff_beats` proves the shape that is owed.
- **No revision table.** `lib/db/index.js:648` has `beats_revisions` and no
  sibling. Iteration on a solid therefore leaks state into sibling refs or
  is destructive in place.

Ordering dependency: revisions ride on edit-in-place, which belongs to
`edit-3d-recipes.plan.md` phase 2 (document the `update_sketch` path first).

### C3 — The seam gaps

- **Inbound is GLB-only and lossy by design.** `bind_mesh_render` has no
  STEP/STL/OBJ reader. FreeCAD reaches mojulo only via a glTF export. That
  is doctrine-compatible (STEP/3MF enter as worker OUTPUTS, never native
  readers) but it is also the whole inbound surface — worth naming as the
  single point of contact.
- **The durable queue is hardwired to PNGs.** `render-handoff.js` is
  structurally generic (manifest-hash idempotency, atomic claim, two audit
  blobs, no-self-accept) and semantically image-only. House precedent is
  sibling-table-per-media, not generalization.
- **No lease/expiry.** The image queue's `STALE_IN_FLIGHT_SECONDS` is "a
  READING, never a transition" — correct for minute-long renders, wrong for
  an hour-long CAM/FEA job. Design-time column, not a retrofit.
- **Catalysts and geometry are disjoint.** A slicer MCP bound through
  `bind_primitives` has no path into the export path, and `export_model`
  never consults the meta-context inventory. No thread connects the two
  seams today.

### C4 — Where the gates are thin

- The closure audit travels with the artifact now, but it is **advisory and
  kind-skipping**: figure / manji-tree are exempted as surface studies. That
  is correct posture and it means a study-profile STL ships with no machine
  gate at all.
- The **eyes gate is structurally unrecorded** on the mesh seam, exactly as
  on the bake seam. Phase 4 would fix it by construction; until then nothing
  captures "a human looked at this print."
- Print profiles discriminate scale strategy but nothing verifies the
  outcome — no test or check asserts that a maquette actually landed near
  `target_mm` on a real export.

### C5 — Gated, deliberately not built

Phase 4 (the CAD bicycle) waits on an unattended geometry worker
materializing. Do not build ahead of the trigger. `interchange.plan.md`
pins it: "the durable queue graduates only if unattended workers ever show
up."

### Cheap bridges available before any of the above

- A **`print-object` catalyst** walking `export_model` → the operator's
  slicer MCP (composed via `bind_primitives`) → a bound report. This is the
  first thread between the catalyst seam and the geometry seam, and it needs
  no new table.
- **R1 + R2** are hours, not phases.

### The reforge questions

1. Does `measure_solid` (C1) come before the revision lane (C2), or does the
   `update_sketch` documentation debt in `edit-3d-recipes.plan.md` gate both?
2. Is the `print-object` catalyst the right next artifact — a seam thread
   with zero schema cost — or does it front-run the measurement channel that
   would make its report worth reading?
3. C4's thin gates: accept as posture, or does the study profile deserve
   *some* machine gate (a stated open-shell verdict rather than a skip)?
