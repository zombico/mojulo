# Local Render Worker — a diffusion backend behind the same seam

Status: **L0–L2 built and proven live** (2026-07-11/12). L0 install doc +
script (docs/local-image-worker.md, control/scripts/
install-local-imagegen.sh; run on the operator's M1/64GB — ComfyUI 0.27 +
SDXL base + Animagine XL 3.1 + scribble ControlNet under
~/mojulo-imagegen). L1 local-render-params.js (pure mapping:
preset/camera/preserve/viewBox → promptFragments/negative/strength/size;
unit tests) exposed as `localParams` on get_image_render_packet. L2
comfyui-workflow.template.json + the render-image-outcome-locally
catalyst. **L2 exit met**: the driving agent (Claude, no native image
capability) took sk_jxubfy2vdj (Manga Signal Page, 4 panels) from packet
→ ComfyUI → audit → bind_image_render → /final.png composite, zero human
file copying. L3 unbuilt.

## L2 live retrospective (2026-07-12, first ComfyUI run — doctrine input)

1. **The scaffold-echo failure mode has a backend edition.** A ControlNet
   traces the control diagram literally: labels became pseudo-text in the
   art, dashed bubble boxes became painted dashes. Fix landed in the
   substrate: scaffold.js grew a `control` variant (geometry only) served
   as `?control=1` on the png route and `scaffold.controlPngUrl` in the
   packet. The labeled default remains the LLM-worker payload.
2. **Guided/loose forms must be ABSENT from the control scaffold, not
   de-emphasized.** A rectangular guided skyline band survived as a
   literal painted rectangle through stroke removal AND fill-only (a fill
   is still a luminance step) at every strength tried. Control variant now
   renders strict forms + figures + frame only; guided/loose content is
   prompt territory. Strict forms whose polygons look like the object
   (walls, roof edge, device) condition beautifully.
3. **The strength window is ~0.5–0.6.** ≥0.8 traces wireframe; ≤0.4 loses
   staged figures entirely (the p4 hero shrank to a speck). Defaults
   re-tuned in local-render-params.js (strict 0.6 / guided 0.5 / loose
   0.35), template end_percent 0.8 → 0.55, cfg 7.5.
4. **The audit gate earns its keep**: 4 panels took 8 generations (p1×2
   after label-echo, p2×2 — retry regressed, first kept, p4×3 — rectangle
   + lost figure + pose drift). ~60–90s/generation on M1-class MPS.
   Per-target regeneration is cheap; this is the per-panel strategy's
   argument made concrete.
5. **Pose fidelity is the weakest surface** (p4 crouch took prompt
   emphasis + a negative to approximate). The known upgrades: rig-backed
   scaffolds for key poses, and L3's IP-Adapter/pose-ControlNet stack.
6. **Seeds recorded at bind time** (411003 p1/p2/p3-set, 411008 p4;
   checkpoint animagine-xl-3.1 throughout — chosen by the agent for the
   manga register despite no Style Lock preset on this manifest; the
   preset→checkpoint routing rule stands).
image-outcomes.plan.md; changes NOTHING in the packet/bind contract —
this is a new consumer of the existing `get_image_render_packet` →
`bind_image_render` / `bind_character_sheet` seam, coexisting with the
Codex worker (renders record `source`, so both can serve the same fleet
of refs).

## The idea

The image-outcomes doctrine says the renderer is a pluggable worker, not
a build-time dependency. Today the only worker is a natively
image-capable agent (Codex/GPT). This plan adds the second worker shape:
**the operator's driving agent (Claude) + a local diffusion backend it
calls over HTTP.** The agent is the brains — it pulls the packet,
distills the brief, invokes the backend, audits the result by *looking
at it*, and binds. The local install is only the hands: one diffusion
server, no LLM, no VLM.

Decided against (operator, 2026-07-11): an Ollama layer for brief
distillation or render audit. The driving agent already reads images
natively and writes prompts better than a small local model — augment
the agent, don't duplicate it.

## Doctrine

- **Optional install, never eager.** Operators whose agent has native
  image generation (Codex, big ChatGPT plans) never need this. The local
  stack must not ride `npm install`, the control-plane build, or any
  scaffold default — the fetch-embed-model precedent (explicit/lazy
  script, gitignored weights, no postinstall). The control plane gains
  ZERO new dependencies; the backend is a sibling process the agent
  talks to, like flyctl or docker.
- **Capability ladder, resolved by the driving agent.** The worker
  catalyst instructs, in order: (1) if your harness has native image
  generation, use it (the existing path); (2) else probe the local
  backend (ComfyUI default `http://127.0.0.1:8188`); (3) else stop and
  point the operator at the optional install step. Mojulo never detects
  or configures capability itself — the assessment belongs to the agent
  in the seat (responsibility-model posture).
- **The mapping is deterministic where it can be, agentic where it
  must be.** Style Lock presets/dials → prompt fragments + negatives +
  ControlNet strength is closed-vocabulary data and belongs in a pure
  module beside styles.js. Freeform panel beats and mood language are
  distilled by the driving agent at render time. The module emits
  params, the agent finishes the prompt.
- **Audit is the driving agent's eyes.** The scaffold-echo, geometry
  drift, and bubble-painting failure modes are all visible in a single
  Read of the generated PNG against the scaffold. Until I4's formal
  audit tables land, the local loop's acceptance is the agent comparing
  render to scaffold before binding — recorded in the bind call's
  provenance when I4 arrives.

## Stack (target hardware: Apple Silicon, 64GB unified)

- **Backend: ComfyUI headless** — HTTP API, workflow-as-JSON, the
  cleanest automation seam. The worker POSTs a template workflow with
  slots filled (prompt, negative, scaffold path, strengths, seed).
- **Workhorse: SDXL + ControlNet.** The scaffold's graphic language
  (flat polygons, stick figures, dashed zones) maps onto the
  scribble/lineart ControlNets; preserve levels map onto conditioning
  strength (strict → high, loose → low). Manga presets (`gpen-shonen`,
  `shojo-soft`) get purpose-built checkpoints (Illustrious/Animagine
  class); painterly/period presets ride style LoRAs.
- **Identity: IP-Adapter.** The bound character-sheet PNG
  (`boundSheet.path`) is the reference image — a direct local
  implementation of workerProtocol step 0's "fetch, don't regenerate".
- **Quality tier (later): Flux via mflux/MLX** for presets where anime
  checkpoints are the wrong register (`photo-realism`, `louvrijks`).
  Slower (minutes/panel on M1-gen); not the default.
- **Seeds:** the backend takes an explicit seed per call. Recipes stay
  timeless; the seed is render-event provenance (alongside `source` and
  `conditioned` in the I4 sidecar), never manifest data.

## Phases

### L0 — the optional install step

An explicit setup document + script (`docs/local-image-worker.md` +
`control/scripts/install-local-imagegen.sh` or equivalent): install
ComfyUI, fetch the pinned checkpoint/ControlNet/IP-Adapter set into
ComfyUI's own model dirs (nothing lands in this repo; nothing is
committed), start it headless on 8188. The worker catalyst's ladder rung
(3) points here. Exit: a fresh operator can go from "no backend" to a
responding `GET /system_stats` by following one page, and an operator
who skips it loses nothing else in mojulo.

### L1 — the mapping module

`local-render-params.js` beside styles.js: pure
`buildLocalRenderParams(manifest, target)` → `{ promptFragments,
negative, controlnet: { kind, strength }, reference?, size }` derived
from the closed vocabularies (preset + dials, cameras, preserve levels,
viewBox/bounds). Unit-tested like the rest of the module family
(deterministic: same manifest → same params). Exposed in the render
packet as an optional `localParams` block per target so ANY
backend-driving agent gets the distillation head start, not just this
stack.

### L2 — the drive loop, proven live

A workflow template (checked in as JSON beside the module — templates
are recipes, weights are not) + the worker catalyst grown with the
local-backend rung: pull packet → params + agent-distilled beat prompt →
POST to ComfyUI → poll → Read the PNG against the scaffold (the
three failure modes are the checklist) → `bind_image_render`. Exit:
the driving agent takes a minted sequential-art ref to a composited
`final.png` end-to-end with no native image capability in its harness
and no human file copying — the I3 exit criterion, second worker shape.

### L3 — the preset shelf (later)

Per-preset tuning: checkpoint/LoRA routing table keyed by Style Lock
preset, dial → LoRA-weight mappings, and the Flux quality tier. Gated on
L2 retrospective — which presets actually drift out of register decides
where tuning effort goes.

## Out of scope

- Any LLM/VLM in the local stack (decided against, see above).
- Durable request rows / `pull_agent_task` branch — that's I3-durable in
  the parent plan; this worker drives interactively until it lands.
- Multi-backend abstraction (Draw Things, diffusers scripts). One
  backend contract (ComfyUI's) until a second consumer exists.
