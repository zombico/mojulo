# K1 follow-up — the face expression layer (over keyframe cels)

Status: PIVOTED to full-render 2026-07-12 (operator call). Parent doctrine:
[animation-cheats.plan.md](../animation-cheats.plan.md) Addendum 4 — read
it first.

## THE PIVOT — full-render, not decals (operator call, 2026-07-12)

The sub-cel DECAL approach below (F1–F4: measure eye/mouth rects, paint the
feature, difference-key, overlay per frame) was BUILT and is SUPERSEDED. It
failed the way the parts-bank body-decal approach failed: a 2D patch has no
declared coordinates, so the eyes drift/drag frame to frame and the swap
does not register. We threw away the very primitive that locked the
character the first time.

**The primitive that works (the same one that made the six wave cels):**
- **meru guide** — the rig mannequin per pose, normalized into the canonical
  spine unit, between crown/ground register lines. It DECLARES scale + pose +
  placement. Paint over it, covering it.
- **identity reference** — the character's accepted render, conditioning every
  cel so it stays the same character.

So a face state is NOT a decal — it is a **whole meru-locked cel render** of
that pose with a different face (eyes closed, mouth open), gated by the SAME
meru audit as the body cels. The animation is full rasters selected per frame
on the seeded blink/speech schedule; nothing drifts because every frame is a
complete, unit-locked render. "Full raster of the shot, but we determine the
shot with meru scale."

**Built for the pivot (2026-07-12):**
- [face-composite.js](face-composite.js) (+ test, 8 green) — the pure schedule
  resolver, now SELECTING a whole cel per frame (`cel.png` or
  `face/<vocab>-<state>.png`) instead of overlaying a decal. Zero-generation
  re-render pinned (a new blink seed re-selects over the SAME rendered cels).
- [composite-face.mjs](composite-face.mjs) — keys + composites the selected
  full cel per frame → `motion-face.gif`.
- [bicycle.mjs](bicycle.mjs) `face` — emits the full-render JOB-FACE.md (render
  each pose's expression cel over its guide + identity ref), MERU-AUDITS each
  expression cel (height/ground vs the unit, RETRY on violation), composites by
  selection, records the `face` status section. Nera's handoff written; loop
  verified (0/12 pre-render, base cycle composited).
- RETIRED (decal machinery): `face-subcels.js` (outline-seal + difference-key +
  interior audit), `face-render.mjs` (crop-img2img local rung),
  `comfyui-workflow-face.template.json`, and the per-key `face-regions.json`
  (placement is the guide's job, not a measured rect).

**To close:** Codex renders the 12 expression cels (eyes-half + eyes-closed ×
6 poses) into `keys/<k>/face/`, `bicycle face` re-run meru-audits + composites
the real `motion-face.gif` (wave + blink, scale rock-steady). Combined
channels (eyes AND mouth on one frame) need a combined render — a documented
follow-up; v1 prioritizes the blink.

---

## Original decal plan (SUPERSEDED by the pivot above — kept for the record)

This plan built the HALF of the Addendum-4 architecture that hadn't run yet:
body animation renders whole cels (done — K1/k2); face animation was sub-cel
swaps, reserved for the ONLY regions where swaps are legitimate.

**F1 complete (2026-07-12, [face-subcels.js](face-subcels.js) +
[face-subcels.test.js](face-subcels.test.js), 6 tests green).** The
outline-seal law is executable: `auditOutlineSeal` floods fill-pixels from
the rect border and passes a region only when a closed outline loop walls
off an enclosed cavity the flood can't reach (eyes-open, open/mid mouth) —
rejecting a gapped ring, accepting a real ring, accepting Nera's eyes.
Nera's regions measured off key-0 and verified sealed on ALL six keys
(eyes enclosed 1.56–2.77%; same rect serves every key — the head barely
moves), written to `keys/key-<i>/face-regions.json`. **Doctrine earned:
the enclosed-pocket test, not core-component containment** — on a real
anime cel hair/brows/eyes are one connected dark mass, so "feature stroke
must not touch the border" mis-fires; the swappable *cavity* is the right
invariant. **And the relaxed CLOSED mouth is a stroke, not a sealed island
— it is EXEMPT** (base state, painted into the held cel, never swapped IN;
only its non-base open/mid states must seal — `baseExempt: true`). This
sharpens the plan's law: the audit qualifies the SWAP-IN states, and the
closed-mouth base rides along in the held cel.

**F2–F4 built (2026-07-12), the deterministic spine proven end-to-end; real
paint pending Codex.** F3 ([face-composite.js](face-composite.js) +
[composite-face.mjs](composite-face.mjs), 7 tests) composites the face layer
over the MOVING wave cycle — per-key overlay into each key's own rect, on
twos, looped, blink seeded across the timeline + speech spans in seconds —
and the zero-generation re-render claim is pinned as a test (a new blink seed
reschedules over the SAME painted states; `requiredStateFiles` is identical).
Proven live: synthetic eyelid stills composited cleanly at the correct per-key
eye rect with the rest of the face pixel-identical (placeholders discarded;
the mechanism is what's proven). F2 has two rungs: local
([face-render.mjs](face-render.mjs) + [comfyui-workflow-face.template.json](../comfyui-workflow-face.template.json),
crop→upscale→img2img→downscale→difference-key) and native (Codex full-cel
edits). The shared machine gate is `differenceKeyStill` + `auditStillInterior`
in face-subcels.js (the change must stay INTERIOR to the rect — works for both
line and pocket states, 8 tests total). F4 folds it into the bicycle:
`node bicycle.mjs face <dir> [--blink-seed] [--speech] [--cycles]` emits
JOB-FACE.md (the native handoff), ingests `keys/<k>/face-edits/<state>.png`
full-cel edits (crop + diff-key + interior audit → `keys/<k>/face/`),
composites `motion-face.gif`, and records a `face` status section (per-state
`pass|leak|empty|missing`, `done`). Nera's JOB-FACE.md is written and the loop
verified (0/12 pass pre-paint, base cycle composited).

**LOCAL-RUNG FINDING (do not re-litigate):** naive crop-img2img on a tiny
isolated face region does NOT converge — SDXL returns misaligned color noise,
not a clean aligned closed eye (denoise 0.4 tag-prose → iris recolor only;
0.62 danbooru tags → rainbow artifacts). Reliable local paint needs an SDXL
inpaint checkpoint + the masked compile template + a ControlNet eye scribble.
The **native rung (Codex) is preferred and is how Nera gets her real states** —
Codex painted the body cels cleanly and rides the JOB-FACE.md loop.

**Remaining to CLOSE:** Codex paints the 12 blink edits (+ mouth if speech),
`bicycle face` re-run turns them into the seamed swap + the real
`motion-face.gif`; success criteria 3 (reads as one animation) + 5 (both
rungs) then close. Criteria 1, 2, 4 are met and tested.

## The law this plan implements

**A swappable asset must terminate in its own outline.** Eyes and
mouths are outline-sealed islands in the flat-cel language — a swap's
seam IS a drawn line, so it is invisible. This is why the pan-cel
talking head worked and why limb swaps never did (Addendum 4). The
corollary is the sub-cel AUDIT: a region qualifies for swapping only if
its boundary is closed by outline pixels in the held cel.

## What exists (do not rebuild)

- **Finished keyframe cycles to layer onto**: k1-nera-wave (Codex-painted,
  front + back facings) and k2-lio-wave (local-worker-painted), each
  with per-key `cel.png`, `nodes.json`, audit-passed, GIFs in
  `composite/`. All under
  `lite-template/integration/0712/spike-output/animation-cheats/`.
- **The sub-cel machinery from the pan-cel spike**
  ([pan-cel-spike/sub-cels.js](../pan-cel-spike/sub-cels.js) +
  `compositeHeldFrames` in
  [pan-cel-spike/compositor.js](../pan-cel-spike/compositor.js)):
  closed vocabs `mouth` (closed|mid|open) and `blink` (open|half|closed),
  deterministic tracks — `speech` spans (mouth cycles closed→mid→open→mid
  at an fps-quantized flap rate) and seeded `blink` (mulberry32, mean
  gap, half→closed→half envelope). Its retrospective doctrine (parent
  plan, sub-cel rounds): base states live IN the held cel; non-base
  states are FULL-FRAME EDITS of the held cel (never small patches);
  **rects are MEASURED from the accepted cel, never authored blind**.
- **The bicycle** ([bicycle.mjs](bicycle.mjs)): init/render/audit/status;
  two worker rungs (native = Codex edits, local = ComfyUI via
  [local-render.mjs](local-render.mjs)); JOB.md auto-generated; audit
  auto-normalizes pure scale violations. Extend it, don't fork it.
- **Rig head landmarks**: [openpose.js](../openpose.js) leaves eye/ear
  keypoints null by design — the rig's head geometry
  ([figures/face-mesh.js](../../figures/face-mesh.js), head nodes in
  figure-vajra) can PROJECT face-region priors, but the sub-cel doctrine
  says the accepted PAINT is the rect authority (measure, don't derive).

## The work

### F1 — region measurement + the outline-sealed audit

For a chosen base cel (start: k1-nera-wave key-0, her fullest front
face), measure the eye and mouth rects off the accepted cel (the agent's
eyes; record to `keys/key-0/face-regions.json` as
`{ eyes: {x,y,w,h}, mouth: {x,y,w,h} }` with generous margins).
Implement the qualifying audit: flood from the rect border inward over
NON-outline pixels — if the flood escapes the rect, the region is not
outline-sealed and fails (report which edge leaks). Pure module +
fixture test; this audit is the law made executable.

### F2 — state generation (both worker rungs)

Non-base states per region: mouth `mid`, `open`; eyes `half`, `closed`.
Contract per the sub-cel retrospective: **full-frame edits of the held
cel** — the worker re-emits the whole cel with ONLY the feature changed;
mojulo crops to the measured rect and difference-keys against the base.
- Native rung: JOB-FACE.md (generate from a template, bicycle-style):
  "edit this cel: eyes closed, everything else pixel-identical" etc.
- Local rung: masked img2img (the compile template's mask slot) over the
  measured rect at high denoise with state-specific prompt tokens
  (`closed eyes`, `open mouth`) — small masks over a held base are safe
  HERE because the region is outline-sealed (the P0 "never small
  canvases" rule was about UNSEALED paint; state it in the code comment).
Audit per state: nothing changed outside the rect (difference vs base
cel ≤ threshold outside), state legible at composite scale, outline
seal still holds.

### F3 — tracks + composite over a MOVING cycle

The pan-cel sub-cel compositor ran over ONE held cel. Here the base is a
K-frame CYCLE: the face rect moves with the head per key. v1 scope
decision (keep it honest): measure `face-regions.json` PER KEY (the head
barely moves in the wave cycle — K rect measurements, cheap), swap
states into each frame's own rects. Blink track seeded across the full
timeline (not per key); speech spans in seconds against the composite
fps. Extend `composite-keys.mjs`: after the on-twos frame list is built,
apply sub-cel overlays per frame from the tracks, then encode. New flags:
`--blink-seed N`, `--speech "0.5-1.5,2.0-3.0"`.
Deliverable: `composite/motion-face.gif` — Nera waving, blinking, and
(if speech spans given) talking. Re-render with a new seed/spans must
touch ZERO generations (the strongest claim of the architecture — test
pin it).

### F4 — fold into the bicycle

`bicycle face <dir>` subcommand: measure-prompt (or read
face-regions.json) → generate states (ladder: native JOB-FACE.md / local
masked img2img) → audit states → composite with tracks. status.json
grows a `face` section (`regions`, `states: {eyes/half: pass|retry...}`,
`tracksApplied`). JOB-FACE.md carries the same two-gate discipline
(machine: outside-rect stability + seal; eyes: state legibility).

## Success criteria

1. The outline-seal audit correctly REJECTS a deliberately unsealed
   region (fixture) and accepts Nera's eyes/mouth.
2. All face states pass the outside-rect stability audit (the held body
   never flickers).
3. `motion-face.gif`: the wave cycle with blinks reads as one animation
   — no seam, no popping outside the face.
4. Re-dialogue/re-blink with zero new generations (byte-diff the
   regenerated GIF differs ONLY where tracks differ).
5. Both worker rungs can produce the states (Codex edit + local masked
   img2img), gated by the same audits.

## Out of scope (v1)

- Vowel-shaped mouth flaps / text→syllable compiler (v2 of the speech
  track, unchanged from the pan-cel plan).
- Eyebrow/expression channels beyond blink (same machinery, add after
  the audit proves out).
- Head-turn sub-cels — facing changes are KEYFRAME territory, not swaps
  (Addendum 4).
- The facing marker on guides and the bicycle→catalyst promotion are
  SEPARATE queued items (parent plan open items), not this plan.
