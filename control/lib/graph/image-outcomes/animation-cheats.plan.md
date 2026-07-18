# Animation Cheats — piecewise characters, declared coordinates, and the cheat shelf

Status: proposed (2026-07-12). The top-down reconceptualization of the
pan-cel pipeline, designed in conversation with the operator. Supersedes
pan-cel-motion.plan.md's "Promotion path (M0+)" sketch — promotion now
routes through this plan. Builds on: the pan-cel spikes 1–2 and their
retrospectives (acetate contract, registration, gait lock, the sub-cel
full-frame-edit lesson), image-outcomes I0–I3-read (closed vocabularies,
render packet), and the local render worker L0–L2 (ComfyUI + SDXL +
scribble ControlNet, proven live 2026-07-12). Nothing here is built.

## The pivot

The pan-cel spikes proved the pipeline with the CHARACTER as the
generative unit: one painted cel per pose. This plan drops the unit one
level: **characters become part libraries, not cels.** The torso at a
closed set of key angles is the absolute anchor (the "held" element, the
talking-head's held cel promoted to the whole body); limbs, head, and
facial features are separate pieces with declared pivots. Pose becomes a
deterministic ASSEMBLY — mojulo pivots and places parts against the
torso — and the image model's remaining generative job is
**compilation**: a full-frame harmonization pass over the mechanical
composite so joints, overlaps, and lighting read as one drawn figure.

This generalizes, rather than replaces, the sub-cel discovery. The
talking-head retrospective found both halves the hard way:

- *Held base + swappable regions on independent schedules* — mouth/eyes
  were sub-cels of the face; limbs are sub-cels of the torso. Same
  primitive, one level up, plus rotation (limbs pivot; mouths swap).
- *"Never ask the model to paint a small canvas that must match existing
  pixels — give it nothing to match (acetate) or everything (full-frame
  edit)."* The parts bank is the acetate half; the compile pass is the
  full-frame-edit half. The pivot is that retrospective sentence promoted
  to architecture.

Economics: the parts bank IS the model sheet, amortized across every
shot. A new pose costs zero part generations; the walk cycle's six cels
collapse into torso + limb schedules; and the cheat shelf (§ principle 3)
makes most SHOTS cost zero generations outright.

## The principles (first principles for the motion layer)

### 1. Piecewise characters — torso absolute, limbs as parts, model compiles

The generative surface per character is a **parts bank**: the torso
rendered at a closed vocabulary of key angles (reusing facings.js's
closed-vocab discipline), plus limbs/head/features as acetate pieces
with declared pivot points. Mojulo owns assembly (rotation, placement,
z-order, schedule); the model owns paint (the bank) and fusion (the
compile pass). Partial schedules fall out for free: any part group can
hold while others cycle.

**The harvest inversion (design decision, 2026-07-12).** Parts are
HARVESTED from full-figure renders, never generated in isolation. Asking
the model for a standalone forearm is exactly the small-canvas
anti-pattern the sub-cel round killed. Instead: generate the whole
character once per key angle (rig-scaffold-conditioned, identity-locked),
and — because the render conformed to the declared rig geometry —
mojulo cuts the parts deterministically along declared joint boundaries.
Principle 2 is load-bearing for principle 1: declared coordinates are
what make the bank harvestable.

**The compile pass.** The raw mechanical assembly (paper-doll register)
is a legitimate output tier; the compile pass is the quality tier: one
full-frame harmonization per UNIQUE assembled configuration, cached by
configuration hash — never per frame (per-frame compilation reintroduces
boil, the failure whole-frame generation had). On the local worker this
is img2img at low-mid denoise over the composite, with the assembled rig
scaffold as ControlNet and the character sheet as the IP-Adapter
reference. The denoise window is the L2 strength-window discipline
transposed: enough to fuse joint seams, not enough to move anatomy off
the declared anchors.

### 2. Declared coordinate contracts — scaffold → pixel, never pixel → scaffold

Every anchor the pipeline depends on — limb pivots (shoulder, hip,
elbow, knee, neck) and facial landmarks (eye centers, mouth box) — is
DECLARED in the manifest/scaffold in scaffold coordinates, projected from
the rig's real geometry (the figure rig + face-mesh know where these
sit; the scaffold emitter projects, never invents). The render owes the
manifest those coordinates; downstream layers trust them absolutely:
sub-cel rects, part cuts, pivot points, and mouth-flap overlays are all
COMPUTED from declared anchors, never measured off a render.

This inverts the sub-cel round-1 failure ("rects guessed before the face
existed" → patched by measuring the accepted cel). Rect calibration
demotes from a pipeline stage to an audit measurement: verify compliance,
don't reverse-engineer placement.

Enforcement by worker:
- **Local diffusion**: near-construction — anchors/landmarks drawn into
  the control-variant scaffold are literal ControlNet conditioning. L2
  lesson 1 applies: marks must be geometry that LOOKS like the feature
  (eye shapes, a mouth line), never symbolic annotation, or they echo
  as painted marks. The rig goes further: it emits an OpenPose-format
  skeleton image directly from its 3D joints — the exact input the pose
  ControlNet was trained on (attacks L2's stated weakest surface, pose
  fidelity, with the substrate's strongest asset).
- **LLM image worker**: an instruction clause + an audit check —
  "features centered at declared points ± tolerance," measured on the
  returned PNG.

The contract carries a stated TOLERANCE, not pixel-exactness (diffusion
won't hit a point dead-on); the tolerance is what makes the machinery
safe — declared rects carry enough margin that a within-tolerance render
still swaps cleanly. A render outside tolerance is rejected — the
overlay-re-imposes-truth rule, extended from ground lines to anatomy.

### 3. The cheat shelf — shots designed around zero-generation motion

A closed vocabulary of limited-animation economies. Every entry is a
deterministic operator over stills that already exist — zero new
generations, byte-stable for free. The structural move: **shot design
becomes vocabulary selection.** A shot manifest names its cheat; the
cheat dictates framing preconditions, generation targets, which
schedules exist, and where its legibility breaks. The validator refuses
a shot whose framing contradicts its cheat (feet in frame on a waist-up
hold, an eased pan on a constant-cadence cycle). Each entry states its
economics — *what this makes free* — and its boundary conditions.

Three families:

**Camera cheats** — transforms on existing pixels (the pan-cel window
machinery, named as shot kinds):
- `zoom-approach` — "walking towards" as per-frame scale-up of the same
  cel (+ window counter-move). The shot that's genuinely hard to paint
  (foreshortened stride) is the one the cheat makes free. Precondition:
  cel generated oversized (the plate's ≥1.5× headroom doctrine, applied
  to cels). Boundary: max zoom before resolution boil.
- `camera-as-subject` — the actor is the window path: POV drift,
  look-around, reveal-by-pan. Zero character cels; the plate is the
  whole budget.
- `cel-slide` — manual cel translation for glides, knockbacks, hover,
  conveyor moments. Boundary condition is the gait lesson inverted: the
  slide is legitimate exactly where there is no stride to contradict it.

**Body cheats** — partial schedules over the parts bank:
- `waist-up-hold` — framing excludes the legs by design; motion is a
  torso/upper-body sub-schedule (bob, breath, gesture) on a held base.
- `shinobi-run` — torso + arms one held configuration (arms swept back),
  only the leg parts cycle. A schedule mask over the bank. Gait still
  governs the pan (legs cycle → stride → pan rate); the arms opt out.
  Reads FASTER than a real run — the convention outperforms the
  simulation.
- `lightning-blows` — held body + a small set of fist parts ghosted at
  scheduled anchor positions + speed lines. The flurry is depicted, not
  animated: three fist stills on a fast swap schedule read as twenty
  punches.
- `full-body-action` — the reserve currency: complete pose-cycle
  animation (the spike-2 pipeline), spent only when the shot demands it.
  The shelf exists so most shots never draw on it.

**Effect cheats** — symbolic vector layers replacing representational
content. The only place mojulo draws FINISHED visible art rather than
scaffolds — and it can, because these are flat graphic conventions the
pure-vector substrate produces natively (glyph-sfx's kokusen sprite is
already this convention, built for game juice):
- `speed-line-hold` — the plate replaced by a seeded deterministic
  speed-line field (radial or directional; mulberry32, beats doctrine);
  a held cel over it sustains a beat for arbitrary duration. Zero
  generations for the background AND the duration — the sub-cel "time
  lives in the schedule" economy with the plate budget deleted too.
- Impact flashes, dust puffs, drawn smears — same family, same
  discipline; enumerate as the shelf grows, card per entry.

Compounding: parts bank + declared anchors + cheat shelf means a scene's
generation budget collapses to plate + bank + a handful of compile
passes; the entire shot list rides transforms, schedules, and vector
effects.

## Doctrine (carried forward + new)

- **The model paints stills; mojulo paints time** — unchanged, now with
  a smaller "stills" surface: plate, parts bank, compile passes.
- **Recipes not renders**: the manifest (bank spec + anchors + shot list
  with cheats + schedules + window paths) deterministically regenerates
  every scaffold, instruction, cut geometry, assembly, and effect layer.
  Generated PNGs are externally-authored artifacts, audit-gated,
  snapshot into the outcome folder. Given (manifest, accepted renders),
  every composite is byte-stable.
- **Coherence by construction**: background by cropping, registration by
  ground-line pinning, part placement by declared pivots, feature
  position by declared landmarks. Audited surfaces shrink to: the plate,
  the bank renders (identity + anchor compliance), and compile passes
  (anchor compliance + seam quality + identity vs. bank).
- **Never ask the model to match existing pixels from a small canvas**:
  acetate (nothing to match) or full-frame edit (everything). Harvest,
  don't generate parts.
- **Geometry the manifest states is re-imposed at composite time, never
  requested from the model** — ground lines, pivots, landmarks.
- **Seeds are render-event provenance, never manifest data** (local
  worker doctrine, unchanged).
- **Compile per unique configuration, cached by configuration hash;
  never per frame.**

## The spike (local-worker-first)

The local backend changes the spike's economics and enforcement story:
iteration is free and seeded (~60–90s/target, audit-gated retries proven
at L2), declared coordinates become ControlNet conditioning instead of
instructions, identity rides IP-Adapter instead of prompt conditioning,
and the compile pass has a native implementation (img2img). The spike
should therefore produce NUMBERS (landmark error px, seam width,
identity drift) — the loop is cheap enough to earn measurement, not
eyeballing.

### Backend deltas before P0

- Add the **OpenPose ControlNet** to install-local-imagegen.sh's pinned
  set (scribble alone won't carry pose); extend
  docs/local-image-worker.md.
- **Verify the IP-Adapter files actually landed** — the L0 doc lists
  them; L2 only exercised scribble.
- A second workflow template beside the txt2img one:
  **img2img + ControlNet + IP-Adapter + optional mask** (the
  compile/edit shape).
- A rig → OpenPose skeleton-image emitter (the rig's joints rendered in
  the OpenPose color/limb convention). Chroma keying needs nothing new
  (spike 2's worker self-keyed path).

### P0 — the parts contract (the load-bearing unknown)

One character, one facing (three-quarter-left). Steps:
1. Full-figure render: rig scaffold (OpenPose + control-variant
   geometry) + IP-Adapter identity from the spike-1 character sheet +
   acetate contract.
2. Harvest: cut torso/head/limb parts along declared joint boundaries
   (alpha-aware cuts with stated overlap margins at joints).
3. Reassemble into a pose NEVER rendered — the rig supplies the new limb
   configuration; mojulo pivots/places parts by declared anchors.
4. Compile: img2img denoise sweep (0.25 / 0.4 / 0.55) over the raw
   assembly, assembled-pose ControlNet + IP-Adapter, same seed
   discipline.
5. Measure: identity vs. the source render; anchor compliance after
   compile (landmark/pivot pixel distance ± tolerance); joint-seam
   quality; the raw paper-doll register documented as its own tier.
6. Run the naive alternative (one limb generated in isolation) ONCE, to
   put its failure on record beside the doctrine.

Exit: a compiled never-rendered pose that holds identity and anchors;
the denoise window written down; harvest cut-margins written down.

### P1 — declared landmarks on the face

Re-run the talking head under principle 2: eye/mouth landmarks projected
from the rig head into the control scaffold as FEATURE-SHAPED geometry
(L2 label-echo lesson). Measure landmark compliance on the held cel.
Then drive the sub-cel machinery entirely from declared rects — no
calibration stage. Mouth/blink states as full-frame img2img edits at
very low denoise, masked to the declared rect.

Exit: a talking-head loop where every rect came from the manifest, zero
measured-after-the-fact geometry; compliance tolerance written down.

### P2 — the cheat shelf, composed

A short multi-shot sequence over the P0 bank, one cheat per family:
1. `camera-as-subject` — establishing pan over the plate (reuse a
   spike-1/2 plate if register allows; else one new flat-cel plate).
2. `zoom-approach` — the character walking toward camera as a scale ramp
   on one oversized compiled cel.
3. `shinobi-run` — legs-only cycle from the bank under a held
   torso+arms configuration; gait-locked linear pan (the spike-2
   measured-stride pipeline, applied to a partial schedule).
4. `speed-line-hold` (+ `lightning-blows` if time allows) — held cel
   over a seeded vector speed-line field; fist parts on a swap schedule.

Stitch through the existing framePngs → encodeGifBuffers path. Keep a
**generation ledger** per shot — the exit is economic: most shots cost
zero generations, and the ledger proves it.

### P3 — the re-render proof (cheap, doctrinal)

From the same bank and accepted renders, with zero new generations:
a new assembled pose; a new blink seed + new speech spans; a 6→8 fps
retime; a cheat swap (the zoom-approach shot re-rendered as a
camera-as-subject shot). All four re-composite deterministically.

Exit: the plan gains a retrospective section quoting what held and what
drifted — that retrospective gates promotion.

## P0 retrospective (2026-07-12 — first full run, local worker)

Backend deltas all landed and proven: OpenPose ControlNet + IP-Adapter
(plus CLIP-ViT-H + the IPAdapter_plus node pack) fetched by the extended
install script; ComfyUI restarted with the nodes live; the rig→OpenPose
emitter ([openpose.js](openpose.js), over the new
`renderFigureWithArmature` / `balancedArmature` exports in
figure-render.js) verified pixel-aligned against the mesh (armature nodes
sit on the flesh centerlines to ≤0.03 STAND); the compile template
([comfyui-workflow-compile.template.json](comfyui-workflow-compile.template.json))
drove every generation in the spike. Spike files:
parts-bank-spike/{bank,key,harvest,assemble}.js +
parts-bank.spike.gen.test.js (stages A/B/C), output under
lite-template/integration/0712/spike-output/animation-cheats/p0/.
11 bank generations + 5 compiles + 1 naive control, ~90s each.
**The full chain ran end-to-end: bank render → flood-key → harvest →
never-rendered passing pose assembled → compile pass healed it into one
drawn figure with identity held.** What it cost in doctrine:

1. **Anchor compliance is TOPOLOGY, not placement — and not per-limb
   angles.** The OpenPose ControlNet (xinsir, strength 0.8→1.0) followed
   stance but re-scaled/re-framed the figure to fill the canvas (rounds
   2–3), and mirrored the declared arm swing (round 9). In pure PROFILE
   the skeleton is near-degenerate (limbs overlap, tiny lateral extent) —
   weak signal. Consequences wired in: (a) **render re-registration** —
   the render is similarity-normalized into declared space off its keyed
   alpha bbox (spike-2 feet-pinning one level up; declared geometry stays
   authoritative, paint is normalized INTO it); (b) **joint calibration
   is a bank pipeline stage** — harvest cuts are placed by joints the
   agent MEASURES off the accepted render (the sub-cel "measured rects"
   doctrine at joint granularity); target placement stays declared. L3's
   per-preset pose stack is the known upgrade for closing this gap.
2. **The chroma-green contract is wrong for diffusion workers.** Every
   green element — weighted green prompt, green-recolored id-ref, green
   base — fought the model's prior and eventually bled INTO the subject
   (rounds 6–7 painted the coat itself green/translucent). The local
   acetate contract is: **plain uniform background in the model's own
   register** (pale blue — far from skin/coat/boot colors), keyed by
   **border flood-fill + enclosed-background drop + erode/label/dilate
   largest-component** ([key.js](parts-bank-spike/key.js)). Flat-cel
   outlines seal the figure so the flood can't leak; the enclosed-bg drop
   kills the outlined shadow ellipse the model paints even against
   `(no shadow:1.4)` (its fill IS background color, outline-sealed);
   erosion breaks the boot-heel-touches-shadow contact. Background color
   choice is a CONTRACT variable: cream collided with anime skin tone and
   the enclosed-bg drop ate the face (round 9→10's lesson).
3. **The harvest pose must give separation INSIDE the model's prior.**
   Explicit A-poses ("arms held straight out", trench coat, profile)
   collapsed the render (rounds 4/6) — out-of-distribution. The pose that
   separates limbs AND stays in-prior is the WALK CONTACT itself: arms
   swing clear, legs split, and "walking, mid-stride" was the phrasing
   behind every good render. The bank pose IS a cycle pose.
4. **Far limbs: harvest what's visible, duplicate what isn't.** In
   profile the far arm is a hand-sized paint fragment — harvesting it by
   anatomical joints stole chin/collar pixels (the far-shoulder capsule
   crossed the face). Contract: occluded far limbs are NOT harvested
   (their remnant stays baked in the torso); the assembly's far limb is
   the near part placed on the far target segments, darkened (the cut-out
   puppet convention). Both LEGS harvested individually — the
   walk-contact bank splits them clear of each other.
5. **The compile pass heals SEAMS but preserves HOLES.** Compile round 1:
   leg joints, boot seams, torso fusion — healed beautifully at d0.40–
   0.55, identity held via IP-Adapter on the bank render. But the arm
   crater (background showing through where the harvested arm had been)
   was RATIONALIZED, not healed — painted as a scarf/drape (the model
   keeps large color regions; it can't know the hole is "coat behind").
   Fix wired in: **mojulo pre-fills enclosed craters deterministically**
   (`fillEnclosedHoles` — border-connected transparency is background and
   stays; enclosed holes get iterative dilate-averaged local color)
   before the compile base is flattened. Compile round 2 integrated the
   filled crater as coat material (one blue streak residue at d55 —
   fill-seed purity is a tunable).
6. **The compile denoise window: 0.40–0.55.** Measured (stage C, vs the
   mechanical assembly): d25 moves 2.1% of pixels (too timid to heal),
   d40 3.9% (mild assemblies), d55 8.8% (integrates craters + repaints
   far-arm duplicates into real sleeves; the winner for heavy
   assemblies). Above that lurks the pose-drift cliff (unexplored).
7. **The naive control confirmed the harvest inversion.** Asked for "a
   single isolated forearm, disembodied, elbow to fingertips only", the
   model painted a complete figure (renders/naive-forearm.png). Parts
   cannot be generated; they can only be harvested.
8. **IP-Adapter is the identity + BACKGROUND channel.** The id-ref's
   background color drives the render's background through IP-Adapter
   more strongly than prompt words (cream id-ref → cream bg over an
   explicit blue ask; recoloring the id-ref background to pale blue
   fixed it in one round). Recolor the id-ref background to the contract
   color as a standard packet-prep step.

### Addendum — the PARTS SHEET (operator direction, 2026-07-12)

The bank's durable form is a **laid-out parts sheet**, not a stacked
figure: torso+head in one cell, each limb part in its own cell, on one
canvas — so parts are individually addressable and the model can refer to
them. Probed both routes:

- **Prompt-only fails.** "Paper doll sheet / detached limbs laid out"
  from prompt + IP-Adapter alone painted the plain single figure twice
  and left the parts region empty — single-subject prior wins
  (renders/parts-sheet-{a,b}.png).
- **Mechanical layout + repaint succeeds.** Mojulo composites the sheet
  deterministically from harvested parts (alpha-trimmed, placed in
  declared cells; layout recorded in
  assembly/parts-sheet-layout.json), then ONE img2img pass (d0.5, sheet
  as its own base, bank render as id-ref) repaints it into clean drawn
  parts — sleeve gained real buttons/strap detail, fist and boots
  refined, cells stayed put (renders/parts-sheet-repaint-d50.png). The
  same mojulo-does-geometry / model-does-paint split as the compile
  pass, applied to the bank itself.

What the sheet buys, doctrine-grade: (1) **cells replace capsules** —
re-harvest from the repainted sheet is a rect crop in declared
coordinates, no capsule labeling, no crater risk, no far-limb occlusion;
(2) **automatic joint measurement** — a limb alone in a cell yields its
axis endpoints from the alpha (PCA), retiring the eyeball-calibration
stage; (3) **the sheet is the compile pass's reference** — feeding it as
the IP-Adapter image lets the model consult clean parts while fusing an
assembly; (4) it IS the mintable character-bank artifact A4 wants (one
PNG + one layout JSON per character per scene-light). Pipeline becomes:
figure render → harvest once → mechanical sheet → sheet repaint →
re-harvest by cell → assemble → compile. Crater healing belongs in the
sheet-repaint pass (masked higher denoise on the torso cell), not
downstream.

### Addendum 2 — front-view bank + armless torso (operator direction, 2026-07-12)

The profile view was the wrong working view for this primitive. Bank v2
(probed live, renders/front-*.png):

- **The working view is FRONT.** Front is the OpenPose ControlNet's
  strongest domain: the A-pose full-figure render followed the declared
  skeleton almost exactly (overlay evidence) — declared-coordinate
  harvest works WITHOUT the eyeball-calibration stage that profile
  forced. And the front A-pose ("arms held slightly out") is the
  production-standard reference pose, squarely in-prior — no round-4/6
  collapse.
- **The outfit is explicitly part of the split**: sleeve+hand = the arm
  part, coat body + skirt = torso, boots = leg parts. Parts follow
  garment boundaries, not just anatomy.
- **The torso is ALWAYS ARMLESS in the working view; limbing happens at
  assembly.** Asked-for armlessness fails — "no arms" + armless skeleton
  + negatives still painted arms (anatomy prior + id-ref win;
  renders/front-armless.png). Manufactured armlessness works:
  masked img2img over the DECLARED arm capsules (A-pose arms are clear
  of the body, so fat masks are safe) repainted the arms away
  (renders/front-armless-inpaint.png — one side perfect, one side left
  a sleeve stub + hand remnant + a residue cloud; refinements: per-arm
  passes, background-only prompt inside the mask). The armless torso
  never has a crater by construction — nothing was ever cut from paint
  we keep.

Bank v2 pipeline: front A-pose render (pose-compliant) → limbs harvested
by declared capsules → armless torso via declared-mask inpaint of the
SAME render → mechanical parts sheet + repaint (Addendum 1) → assembly
"limbs" the torso at target poses → compile. Profile/other facings enter
later as additional bank views over the same contract.

**Bank v2 run (2026-07-12, spike-output/animation-cheats/front/ +
parts-bank-front.spike.gen.test.js + parts-bank-spike/front.js).** The
full front pipeline ran: A-pose bank (seed 800001) → per-arm chained
background inpaints (armless manufacture; one targeted repair pass for a
painted artifact) → flood-key + registration → measured-capsule harvest
(4 arm segments + 2 legs, all real parts, no duplicates — front view
shows everything) → armless-torso parts sheet (7 cells + layout.json) →
WAVE assembly (parent-anchored) → compile at d45/d55 fused it into one
coherent waving character. New doctrine from the run:

- **Pose asks are bounded by the outfit's prior**: 35° A-pose is both
  in-prior and CN-followed; a 55° retry was flatly ignored (arms painted
  hanging, coat went floor-length). Don't fight the outfit.
- **Registration normalizes scale, not asymmetry**: bbox-centering is
  thrown by one extended sleeve, and painted shoulders sit narrower
  than the mannequin's — measured joints were still needed at part
  granularity (MEASURED_FRONT_NODES; the sheet-cell re-harvest retires
  this).
- **Limb placement is PARENT-ANCHORED, socketed in paint**: rotation and
  scale come from declared bank→target segments, but translation chains
  through the transformed parent (shoulder rides the torso transform,
  forearm rides the placed upper arm), anchored at the part's own
  painted root pixel — declared-joint anchoring left the raised arm
  floating off the body (three failures on the way to this rule).
- **Contamination is THE remaining quality ceiling**: every compile
  blemish (navy-wrapped hand = bag-strap sliver in the arm capsule;
  knee-high boots = skirt slivers in the leg cells) traces to capsule
  contamination, not to assembly or compile. Next lever: the sheet
  REPAINT pass cleans parts per cell before re-harvest + assembly —
  Addendum 1's route, now with measured sockets recorded per cell.

### Addendum 3 — the MERU LOCK (operator direction, 2026-07-12)

The remaining fundamental defect after bank v2 + the Codex bank (Lio):
**asset placement — scale, height, position** — was being patched after
paint (bbox registration, then per-character joint measurement), and the
patch chain is fragile: a change to the declared A-pose shifted the
registration frame and silently invalidated Lio's calibration (audit:
coverage 0.73, round-trip IoU 0.69). The fix moves the meru principle
BEFORE paint:

- **The meru guide** ([front.js](parts-bank-spike/front.js)
  `meruGuideSvg`, emitted as `meru-guide-apose.png`): the vajra mannequin
  rendered at declared scale/position between crown/ground register
  lines, on the exact canvas. The bank render is an EDIT of this image —
  the character painted OVER the mannequin, covering it ("skin the
  mannequin", the gait-preview move applied to the bank). Scale, height,
  and joint positions are then inherited by construction: no
  registration, no joint calibration. HANDOFF-CODEX.md rewritten to this
  contract.
- Emitting the guide exposed a latent armature bug: **DOF signs are
  absolute, not per-side mirrored** — the A-pose's same-sign yaws
  abducted one arm and folded the other behind the torso, and that
  asymmetric scaffold bbox was the silent driver of every registration
  drift to date. APOSE is now shL +35 / shR −35 (symmetric, verified
  visually).
- **The success test is codified** (run-front-bank.mjs → audit.json):
  (1) connectivity — each part's largest connected component ≥95% of its
  mass (chopped parts fail); (2) coverage — parts+torso over the keyed
  figure; (3) **round-trip IoU** — reassembling at the bank pose itself
  must reproduce the original render. "The asset keeps its scale, stays
  connected, and is not chopped up" is now a number, not an eyeball.
  Old-pipeline baseline (Lio, stale calibration): 0.73/0.69. Meru-locked
  banks should audit ≥0.95 with DECLARED joints only.
- **The compliance gate closes the worker loop.** First meru bank (Nera,
  Codex): pose and arm angles followed the mannequin well, but the
  character overflowed the span — 1.254× the crown-ground unit, soles
  103px below ground (audit.meru). Under --meru the runner skips
  registration (bbox alignment would shrink legitimate hair/boot
  overflow), measures crown/ground compliance, and on violation emits
  `bank/RETRY.md` (exact pixel targets) + `assembly/meru-overlay.png`
  (skeleton + register lines over the paint) — the worker redoes the
  bank from its own numeric feedback. Audit at 1.254× oversize: 0.86
  coverage / 0.80 IoU, no chopped parts — degradation is graceful, but
  the gate holds until compliant.

### Addendum 4 — REVISION: rigging with static assets was a mistake
### (operator direction, 2026-07-12; supersedes principle 1's application to bodies)

Two banks (trench-coat, Lio) plus the meru lock produced working
puppets, but every fix in the chain — measured sockets, parent
anchoring, capsule tuning, sheet repaint, compliance gates — was
fighting the same truth: **2D limbs change silhouette as they move;
they must be REDRAWN, not rotated.** A rotated static part keeps its
one silhouette forever, cloth doesn't follow, overlaps don't resolve,
and the result reads as cut-out puppetry however well it is socketed.
The piecewise principle is hereby DEMOTED from bodies to faces:

- **Sub-cel swaps are reserved for eyes and mouths** — and the reason
  is now stated precisely: *a swappable asset must terminate in its own
  outline*. Eyes and mouths are outline-sealed islands in the flat-cel
  language, so a swap's seam IS a drawn line and is invisible. A limb
  is open paint — any cut edge shows. This is the general law behind
  the talking-head success and the parts-bank struggle. (Sub-cel audit:
  the region must be outline-enclosed in the held cel.)
- **Body animation renders every necessary frame of the cel** — the
  spike-2 model (the gait walk, still the best motion produced by this
  plan) promoted from exception to THE path. Each frame is a whole
  character painted at once: silhouettes, cloth, and overlaps are the
  model's job, which is what it is good at.
- **Keys, then inbetweens, then cheats** — the animation discipline
  organizes generation cost:
  - KEY FRAMES: the distinct poses at the motion's beats, one meru
    guide per key (the per-cel mannequin scaffold — everything built
    for the bank survives per-frame: guide, register lines, compliance
    audit, RETRY loop, identity conditioning on the character key).
  - INBETWEENS: generated like keys when the shot warrants; or faked —
    holds (shoot on twos/threes), WHOLE-CEL transforms (translate/
    rotate/scale an intact cel is safe; only cutting is not), sub-cel
    motion (face), and the effect cheats. Mechanical interpolation of
    paint is NOT attempted in v1.
  - MOTION CHEATS: the shelf (camera / body / effect families) is
    unchanged — its whole purpose was always to reduce how many frames
    must exist.
- **What retires from the body path:** harvest capsules, the parts
  sheet as a body bank, armless-torso manufacture, parent-anchored
  assembly (run-front-bank.mjs et al. remain as the recorded
  investigation; the paper-doll register may return for game-UI
  puppets, not for character animation).
- **What survives everywhere:** the meru guide + compliance gate (now
  per-cel), the flood/enclosed-bg keyer, the acetate contract, the
  identity key, registration doctrine, the audit-gate worker loop, and
  the whole cheat shelf.

Next spike (K1): a keyframe walk/wave — rig emits per-key meru
mannequin guides for K poses of one motion; the worker (Codex) paints K
whole cels over them; mojulo audits each (meru compliance + identity),
composites on twos with holds, and adds the face sub-cel layer on top.
Success: the cycle reads as drawn animation, zero part seams, and the
per-cel audit replaces every socket/calibration mechanism.

**K1 round 1 (2026-07-12, k1-nera-wave/):** the meru-per-cel contract
WORKS — all six worker cels audited at height ratio 1.00–1.01, ground
delta 0, first try, no calibration anywhere (emit-keys.mjs normalizes
every key into the canonical spine unit; composite-keys.mjs audits and
composites on twos). But the round exposed the complementary audit gap:
the cels were geometrically perfect **vector tracings** of the
mannequin in the character's palette — the I3 "traced, not generated"
failure mode, invited by a handoff missing the WORKER_PIPELINE
anti-tracing block. Doctrine: **geometric compliance and register
compliance are separate gates** — the meru audit is deterministic; the
register gate is the driving agent's eyes (an identity-match audit vs
the character key is the eventual automation). RETRY-STYLE.md issued.

**K1 COMPLETE (2026-07-12, three rounds).** The retry loop converged one
gate per round without regressing prior fixes: round 1 geometry ✓ /
register ✗ (vector tracing), round 2 register ✓ / facing ✗ (all six
painted from behind — the mannequin's face side is ambiguous at guide
resolution), round 3 all gates ✓ (ratio 1.00–1.03, ground delta ≤1px,
painted anime register, front-facing, identity consistent across six
cels). Both facings kept as SEPARATE clips — the "wrong" round-2 cycle
is a legitimate turnaround asset (walks-away-waving shots):
composite/wave-front-6fps.gif + wave-back-6fps.gif. This is the first
true keyframe animation of the Addendum-4 architecture: whole cels, no
parts, no seams, no calibration — declared coordinates + the meru gate
carried everything. Emitter TODO from round 2: mark the guide's facing
unambiguously (face-side tint or an out-of-figure FRONT marker the
worker removes).

**The BICYCLE (2026-07-12).** The K1 loop, packaged as a self-drivable
protocol for any image-capable worker agent
([keyframe-spike/bicycle.mjs](keyframe-spike/bicycle.mjs)):
`init <dir> --character <charDir> [--motion] [--k]` emits the guides
AND auto-generates JOB.md (the handoff — character description pulled
from the character dir's DELIVERED.md, identity-ref path, the six rules,
and the loop instructions with runnable commands) + status.json;
`audit <dir>` runs the geometric gate, writes per-cel RETRY.md files,
composites passing cels on twos, and updates status.json (`pass` /
`retry` / `missing` per cel, `done` when all pass). The worker drives:
paint → audit → read retries → repaint → audit → done. The two-gate
doctrine is embedded: gate 2 (scale) is machine-audited; gates 3–4
(register, facing) are the worker's own eyes against JOB.md's checklist
— K1's three rounds showed both gate types firing. Promotion path: this
becomes a mojulo CATALYST (the render-worker workflow shape) once the
I3 durable seam lands — JOB.md's content is the packet, status.json is
the request-row state, bicycle audit is the bind-time audit.

**The bicycle is TWO-WORKER (2026-07-12, k2-lio-wave ridden to done by
the local rung).** `bicycle render <dir>` is the local-backend rung
([keyframe-spike/local-render.mjs](keyframe-spike/local-render.mjs)):
img2img over each meru guide (the mannequin under the paint carries
scale + pose — keys 0–4 came out compliant with NO registration) +
per-key OpenPose skeletons (now emitted by emit-keys) + IP-Adapter
identity, with `--only key-N / --seed / --denoise / --cn / --ip /
--tags / --neg` retry knobs. JOB.md carries the capability ladder
(native gen → local backend → stop). k2 findings: (a) identity is the
local rung's weak gate — key-5 flipped character/gender across three
rolls (the checkpoint's 1girl prior; danbooru gender tags via --tags/
--neg are the lever, plus seed rolls — eyes-gate every cel); (b) the
audit now AUTO-NORMALIZES pure scale violations (a whole-cel similarity
onto the unit — never a cut — marked `normalized` in audit.json), which
healed key-5's 1.4× roll to ratio 1.0 and took k2 to done. Both worker
shapes have now ridden the same loop to a finished animation.

The K1 follow-up — the face sub-cel layer (eyes + mouths over the
finished keyframe cycles, the outline-sealed law made executable) — is
minted as its own plan for a fresh agent:
[keyframe-spike/face-subcels.plan.md](keyframe-spike/face-subcels.plan.md).

The second K1 follow-up — the STAGE layer (multi-clip scenes over
depth-anchored plates: the finished cycles composed as a meru-locked cast
at depth, with a keyframed camera + cuts + one clock, zero generations
over the clips and plates) — is minted as its own plan:
[keyframe-spike/scene-staging.plan.md](keyframe-spike/scene-staging.plan.md).
It is the "orchestrate scenes, not side-scroll" direction: the pan-cel
manifest is a single SHOT; scene-staging is the missing layer above it.

**Open items for P1/M-phases:** fill-seed purity (exclude halo pixels
from crater fill); the small orphan-fragment sweep (a ~30px chip rode
along); torso z-order for far-leg-behind-skirt edge cases; compile-pass
anchor audit (measure landmark drift d40 vs d55 — needs P1's declared
landmarks); per-preset checkpoint/pose-stack routing (L3).

## Promotion path (sketch; re-plan after the spike — absorbs pan-cel M0+)

- A0 — pure modules: `parts.js` (bank spec, harvest cuts, assembly),
  `anchors.js` (declared coordinate contracts + tolerance audit),
  `cheats.js` (the shelf as a closed vocabulary with preconditions +
  validators), effect-field emitters (speed lines etc., seeded); window
  resolver + compositor promoted from the pan-cel spike. Byte-stability
  tests; no Date/Math.random.
- A1 — mint via `create_sketch` kind `motion-outcome/v1` (the pan-cel
  manifest grown with `bank`, `anchors`, and per-shot `cheat` fields);
  vocab cards (motion-outcome + a cheats card); `/sketches/<ref>` shows
  scaffolds, bank state, and composite preview.
- A2 — render targets ride the image-outcomes I3/I4 seam (`plate`,
  `bank_<angle>`, `compile_<hash>` targets; durable request rows, the
  two-layer audit; new checks: `anchor_compliance`, `identity_match`,
  `seam_quality`). A motion-outcome composites only when every target
  has an accepted render.
- A3 — `forge_motion` fifth subject family (`subject.motion_outcome_ref`)
  so composites land as normal mo_ outcomes and stitch.
- A4 — the character bank as a standalone mintable artifact (the
  `character-key` idea from pan-cel M-path, now with parts): reusable
  across shots AND by sequential-art panels — the identity-persistence
  seam the comics plan deferred. Re-key per scene: re-render the bank's
  key angles conditioned on the new plate's light.

## Out of scope (recorded so they aren't re-litigated)

- Per-frame compilation — reintroduces boil; compile is per unique
  configuration, cached.
- Rotation/turnaround mid-shot, true dolly, multiplane parallax — still
  the plate primitive's v2 (unchanged from pan-cel).
- Local light sources / re-lighting mid-shot — v2, per-region light
  zones on the plate.
- Vowel-shaped mouth flaps and a text→syllable→span compiler — v2 of the
  speech track (unchanged).
- Smear FRAMES as generated art — drawn smears enter as effect-cheat
  vector shapes first; generated smears only if the vector register
  fails.
- Ollama/VLM in the local stack; multi-backend abstraction (unchanged
  from the local-worker plan).
- Sound — beats bindings ride the existing audio channel work when
  long-form output makes it worth it.
