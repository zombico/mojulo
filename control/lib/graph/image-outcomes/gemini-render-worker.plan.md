# Gemini image render worker — build log & design

Status: **design / not yet built** (2026-08-14). A proposed THIRD rung on the
image-worker ladder ([docs/local-image-worker.md](../../../../docs/local-image-worker.md)),
for operators who are "Google-adjacent" — a Gemini-based driving agent, or any
agent plus a Google API key — and who want scaffold-preserving image renders
with **no local install and no GPU**.

This is a build log, not the catalyst. It records the doctrine fit, the verified
API facts, the catalyst outline, and the open questions to close **before**
writing `render-image-outcome-gemini.md`. Nothing here changes substrate code.

## Why — the gap on the ladder

The render seam ([render-handoff.js](../../mcp/tools/render-handoff.js), the
bicycle in [docs/bicycles.md](../../../../docs/bicycles.md)) is transport-agnostic
by design: `request → pull → submit → accept`, every render tagged with its
`source`. Today the pluggable-worker ladder
([render-image-outcome-locally.md](../../mcp/catalysts/render-image-outcome-locally.md))
has two rungs:

1. **Native** — the operator's driving agent has its own image gen; serves
   renders directly, no worker install.
2. **Local** — ComfyUI / Qwen-Image-Edit on the host: powerful and
   scaffold-preserving, but a ~31GB install and a capable machine.

There is a real hole between them: **an operator whose agent has no native image
gen AND who won't run a 31GB local backend has nowhere to go.** A Gemini rung
fills exactly that — a remote-API worker: zero install, native
scaffold-preserving editing. Two flavors, both landing on the same seam:

- Agent **is** Gemini (Gemini CLI / a Gemini host) → often native image gen
  already → effectively rung 1, no catalyst needed.
- Agent is something else but the operator **has a Google API key** → this
  rung, catalyst-driven, `source: 'gemini'`.

## Posture — the first REMOTE worker

Every existing worker rung is local/loopback. This is Mojulo's **first remote
image worker**, so two doctrine points must be explicit:

- **The substrate still never makes the call.** The *operator's driving agent*
  POSTs to Gemini with the *operator's own* `GEMINI_API_KEY`. Nothing lands in
  mojulo's DB or transport; the loopback-only MCP invariant is untouched. This
  is the same shape as "an image-capable ChatGPT plan serves renders directly."
- **Data egress is real and must be disclosed.** Scaffolds and prompts leave the
  host for Google. For the Google-adjacent segment this is a non-issue by
  definition, but per the [responsibility model](../../../../docs/responsibility-model.md)
  the catalyst + doc carry a plain one-line egress note (substrate composes the
  primitive; the operator owns where the bytes go). This is the one thing the
  local-worker doc never had to say.

## What Gemini's image API is (verified 2026-08-14)

- **Endpoint / auth:** `generativelanguage.googleapis.com` (v1beta), API key via
  the `x-goog-api-key` header. Trivial REST from any agent.
- **Editing IS native — this is the crux.** Nano Banana is an *editing* model:
  input images pass as **base64 inline** (`{ "type": "image", "mime_type":
  "image/png", "data": "<b64>" }`), **up to 14 reference images**, and it
  preserves the input's structure while you describe the change. That is exactly
  Mojulo's scaffold-preserving contract — the same shape as the local Qwen-Edit
  rung (image-in + instruction → paint-out, geometry held). Unlike Grok's
  generations endpoint (text-to-image only; editing on a separate/uncertain
  path), Gemini can serve **both** halves of the seam: pure-dream/concept AND
  the comic / keyframe / scene surfaces that the accept gate requires be
  `conditioned: 'scaffold'` (see [render-handoff.js](../../mcp/tools/render-handoff.js)
  ~L242 — keyframe/scene renders attesting `conditioned: 'prompt-only'` are
  refused).
- **Output:** base64 image bytes in the response — maps directly onto the seam's
  `submit_image_render({ image_base64 })` path; the worker needn't touch the
  filesystem.
- **Models + paid pricing (per 1K image, standard / batch):**
  - `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) — ~$0.034 / $0.017.
    Google's recommended cheap default; ~4s text-to-image.
  - `gemini-3.1-flash-image` (Nano Banana 2) — ~$0.067 / $0.034. Workhorse.
  - `gemini-3-pro-image` (Nano Banana Pro) — ~$0.134 / $0.067; up to 4K.
  - `gemini-2.5-flash-image` (legacy GA) — ~$0.039 / $0.020. Conservative pin.
- **No free tier for the API.** AI Studio's *playground* generates images free
  interactively, but the *API* image models bill on the paid tier. Do NOT sell
  this rung on a free tier (earlier assumption, corrected against the live
  pricing page). It is a paid, per-image cloud worker — the trade vs. the local
  worker's $0 marginal cost is speed + no install + no GPU.

## Catalyst design — `render-image-outcome-gemini.md`

Mirror [render-image-outcome-locally.md](../../mcp/catalysts/render-image-outcome-locally.md)
(JSON frontmatter, `category: substrate`, `writeTarget: none`, `ref` param).
Written to be **drivable cold by a foreign operator** (bicycle property 4). The
loop, once per target:

1. `packet = get_image_render_packet({ ref, target })` — `localParams` is the
   deterministic head start (`edit.instructionFragments` + preserve tier,
   `promptFragments`, `size`); character sheets in `characterSheets[]` come
   first, same as the Qwen loop.
2. Fetch the CONTROL scaffold PNG (`packet.scaffold.controlPngUrl` — geometry
   only) and base64-encode it as the first inline reference image. When the
   target has a bound character sheet, pass it as a second reference image and
   name the character in the instruction (Gemini's multi-image editing replaces
   the IP-Adapter / `image2` rig).
3. Build the instruction: `localParams.edit.instructionFragments` +
   `promptFragments` + the agent's own compact distillation of the beat/subject.
   No lettering text, ever — the composite overlay owns borders/bubbles/text.
   Map `localParams.size` → the aspect-ratio/resolution knobs. Model id is an
   **operator-overridable parameter** (default the cheap Lite id; this space
   moves fast — 2.5→3.1 inside a year — so never hardcode).
4. POST; read the base64 image from the response.
5. **AUDIT — actually look at it** beside the scaffold. Same failure modes as
   the Qwen loop: surviving diagram language (edit models keep what you didn't
   tell them to replace → strengthen the repaint clause), geometry/camera drift,
   bubble-zone violations, any readable text. Regenerate with a sharpened
   instruction on failure — the instruction is the knob.
6. `submit_image_render({ request_id, image_base64, source: 'gemini',
   worker_audit: { conditioned: 'scaffold', invoked_generator: true,
   scaffold_echo: false, model, notes } })`. Record the model id as provenance
   (the recipe stays timeless; model/seed are render-event provenance). A
   separate agent runs the accept gate — no self-accept.

Keep the "What you DON'T do" section verbatim from the local catalyst (no text
in the generated layer, don't bind unaudited, binds are append-only, don't
expose/install unprompted) — plus one new line: **don't send scaffolds to Gemini
without the operator having opted into cloud egress.**

## Rollout

1. Close the open questions below (one live-doc pass).
2. Write `control/lib/mcp/catalysts/render-image-outcome-gemini.md`.
3. Write `docs/gemini-image-worker.md` — sibling to `docs/local-image-worker.md`,
   opening with the same "Who needs this: nobody by default — reach for it when
   [no native image gen + no local install + Google-adjacent + OK with cloud
   egress]" framing, the paid-per-image cost table, and the egress note.
4. Optional: a thin `control/scripts/gemini-render.mjs` for operators who'd
   rather run a script than have their agent hand-roll the HTTP.
5. Link the new doc from the catalyst ladder and CLAUDE.md's image-outcomes
   architecture line.

## Open questions — close before writing the catalyst

- **Exact request body.** The live docs surfaced two shapes — a newer
  `v1beta/interactions` surface (`interaction.output_image.data`) and the
  classic `v1beta/models/{model}:generateContent` with `inline_data` parts /
  candidate `inline_data` output. Confirm which is current+stable and pin ONE in
  the catalyst with a real, copy-pasteable curl.
- **Default model id.** Recommend `gemini-3.1-flash-lite-image` (cheap, fast,
  Google-recommended) with `gemini-2.5-flash-image` as the conservative-stable
  fallback — but confirm both are still listed at write time.
- **Aspect-ratio / resolution knobs.** Confirm the parameter names and how
  `localParams.size` maps (does the model honor an explicit size, or only
  aspect-ratio buckets? matters for the MERU/stage machine gates that check
  exact dimensions).
- **Geometry fidelity for the strict surfaces.** Empirical: does Gemini's edit
  preserve a strict-form scaffold well enough to pass the MERU cel gate and the
  scene stage gate? If not, Gemini stays the concept/comic rung and the local
  Qwen worker keeps the keyframe/scene surfaces. One test render each settles it.

## What this explicitly does NOT change

The seam, the accept gate, `config-builder`, `local-render-params`, the manifest
model. Purely additive: one catalyst, one doc, an optional script. Existing
renders and both existing rungs are untouched; a Gemini render is distinguished
only by its `source`.
