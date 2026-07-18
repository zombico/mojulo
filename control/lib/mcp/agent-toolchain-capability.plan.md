# Agent toolchain capability — motion/keyframe hardening

> **Execution status (2026-07-14):** D1, D2, D3, D4, C2, C4 **landed + verified**
> (unit tests green: 239 across the affected suites; live re-run confirms the M3
> single think→point clip renders and the K1 keyframes scaffold renders as PNG,
> and `motion:'custom'` now rejects cleanly at mint). Remaining: **C1** (queryable
> capability gate) and **C3** (conformance smoke probe) — scheduled follow-ups;
> **C5** (stand up the local ComfyUI worker) — separate ops track; research-book
> validation (log the re-run, fix item 17 provenance in `res_9add895c8688`) —
> pending operator go-ahead (it mutates research data).


**Goal:** improve any host agent's (Codex, Claude Code) ability to drive the mojulo
motion/keyframe toolchain correctly, grounded in the paired word-to-action traces in
research book `res_9add895c8688` (items 15 = Codex, 17 = Claude Code) and a source-level
review of the failure sites.

**Framing:** the traces showed both agents route to the right motion family every time.
The friction is downstream — object-valued params that don't survive transport, invalid
enum-like strings that crash opaquely instead of rejecting cleanly, and impedance between
how an agent *describes* motion (prose) vs what the tool *wants* (numeric dials). Every
fix below is agent-neutral instrument hardening: it de-noises the toolchain, which is
simultaneously the fix for Codex capability AND for the research study's signal.

---

## What the source review changed vs the original trace assessment

| Finding | Original trace claim | After reading code | Impact on fix |
|---|---|---|---|
| M3 `create_figure` object motion rejected | "the validator rejects all object motion forms" | Validator (`figure.js:56-62`) **accepts** object motion; the `motion` param declares **no `type`** (`figure.js:222`) so a typeless object is serialized to a JSON string client-side and arrives as a non-object. Server does not coerce (`server.js:207`). | Schema type declaration + defensive parse. NOT a validator rewrite. |
| K1 `null 'spine'` scaffold crash | "custom keyframe scaffold path is broken" | `motion:"custom"` is an **invalid motion name**; passes the loose type check (`manifest.js:511`), stored verbatim (`:534`), then `sampleMotionPose` returns `null` for the unknown name (`figure-render.js:619`, `motionFn` `:605`) and `keyframe-emit.js:78-82` dereferences null. The `poses` field I sent is not in the schema and was silently dropped. | Validation hardening (reject unknown motion names; warn on unknown fields). NOT a renderer rewrite. |
| Deck rejects non-`sk_` refs | inconsistency between mint + deck | Confirmed: `SKETCH_REF_RE = /^sk_[a-z0-9]+$/i` (`stashes.js:37`) is stricter than the ref charset `create_sketch` accepts (`[A-Za-z0-9_-]{1,64}`). | Relax the stash sketch-item check to an existence check (or widen the regex). |

Net: two of three are cheaper and lower-risk than the trace implied — they are input-surface
defects, not rendering-engine defects.

---

## Defects & fixes (priority order)

### D1 — Typeless object params get stringified in transport  ★ highest leverage
**Site:** `control/lib/mcp/tools/figure.js:222` — `motion:` schema is `{ description }` only, no `type`.
**Root cause:** a schema-respecting MCP client serializes a value whose schema declares no
(or a scalar) type as a JSON string; typed-object params (`forge_motion.shot`) survive, typeless
ones do not. The handler validator is already correct, so the object never reaches it intact.
**Observed on:** Claude Code (M3). May not bite clients that always send raw JSON; the fix is
robust regardless of client.
**Fix (two-layer, defensive):**
1. Declare the union type so conforming clients send an object:
   `motion: { type: ['string','object'], description: '…' }`.
2. In `createFigureHandler`, before the line 56 validation, coerce a stringified object:
   ```js
   let motion = input.motion;
   if (typeof motion === 'string' && /^\s*[{[]/.test(motion)) {
     try { motion = JSON.parse(motion); } catch { /* leave as string; validator will reject */ }
   }
   ```
   Then validate/store `motion` (the local) instead of `input.motion`.
**Blast radius:** audit every `registerTool` inputSchema for object/array-valued params that
declare no `type` (or a scalar type). Grep `control/lib/mcp/tools/**` for `motion:`, `animate:`,
`view:`, `mint:`, `params:`, `shot:` style properties. `animate`, `view`, `mint`, `intensity`-carrying
specs are candidates. Add explicit types; add the same defensive parse where an object is expected.
**Test:** unit test `createFigureHandler({ title, motion: '{"keyframes":[{"elbowR":20},{"elbowR":120}]}' })`
succeeds and stores an object motion; `motion: {keyframes:[…]}` succeeds; `motion:'walk'` still succeeds.

### D2 — Invalid keyframe motion name crashes opaquely instead of rejecting  ★ high
**Site:** `control/lib/graph/image-outcomes/manifest.js:508-513` (`normalizeKeyframeAnimationManifest`).
**Root cause:** the type check accepts any string; there is no whitelist against the known motion
vocabulary. Unknown names survive normalization and crash later at guide render
(`figure-render.js:619` → `keyframe-emit.js:82`) with `Cannot read properties of null (reading 'spine')`.
**Valid motion strings** (from `motionFn`, `figure-render.js:605-609`): `walk`, `wave`, `stretch`,
the emote names (`nod/headshake/bow/shrug/cheer/point/clap/think`), OR an object `{ keyframes:[pose,…], loop? }`.
**Fix:** when `input.motion` is a string, validate it resolves before storing:
```js
import { sampleMotionPose } from '../polygonizer/figure-render.js';
// …after the type check, when typeof input.motion === 'string':
if (sampleMotionPose(input.motion, 0) == null) {
  throw new Error(
    `keyframe-animation motion '${input.motion}' is not a known motion — ` +
    `use one of: walk, wave, stretch, an emote (nod/headshake/bow/shrug/cheer/clap/point/think), ` +
    `or an object { keyframes: [pose, …] } where each pose is create_figure joint dials (numbers, not prose).`
  );
}
```
(Alternatively export a `KEYFRAME_MOTION_NAMES` const from figure-render and check membership —
avoids a render call at validate time. Preferred.)
**Also:** the meru emitter should fail loudly, not on a null deref — add a guard in
`keyframe-emit.js:78`: `if (!pose) throw new Error(\`keyframe motion '\${motion}' produced no pose at key \${index}\`)`.
Defense in depth so any future null path is legible.
**Test:** `normalizeKeyframeAnimationManifest({ …, motion:'custom' })` throws the clear message;
`motion:'wave'` and `motion:{keyframes:[{elbowR:20},{elbowR:120}]}` pass.

### D3 — Unknown top-level manifest fields are silently dropped  ★ medium
**Site:** `normalizeKeyframeAnimationManifest` (and siblings) only copy known keys into `out`.
**Symptom:** I passed `poses:[…beats…]` — dropped without warning, so the "successful" mint was
semantically empty. An agent that mis-authors a field gets no signal.
**Fix (light):** after building `out`, compute leftover keys and attach an advisory to the
create_sketch response (not a throw): `unknownFields: ['poses']` with a hint. This preserves the
"tolerant input" posture while making silent drops visible. Apply the same to the other
image-outcome normalizers. (Do NOT hard-reject — that breaks forward-compat.)

### D4 — Deck/stash sketch-item ref check stricter than mint  ★ medium
**Site:** `control/lib/db/repositories/stashes.js:37,252`.
**Root cause:** `SKETCH_REF_RE = /^sk_[a-z0-9]+$/i` rejects custom refs that `create_sketch` mints
(`[A-Za-z0-9_-]{1,64}`), so `forge_motion` deck fails when handed a custom-ref slide.
**Fix (preferred):** replace the shape regex with an existence check —
`if (!SketchRepository.getByRef(meta.sketch_ref)) throw …` — the correct invariant is "resolves to a
real sketch", not "looks like sk_". Watch for a circular import between stashes and the sketch repo;
if present, inject the checker or widen the regex to `/^[A-Za-z0-9_-]{1,64}$/` as the minimal safe change.
**Test:** pin a custom-ref sketch into a stash; forge a deck over custom-ref slides.

---

## Capability improvements (not bugs — legibility & prevention)

### C1 — Make the keyframe-animation capability gate queryable, not prose
Today the "needs an image worker" ride-check lives only in the `get_sketch_vocab` card body, so an
agent can't deterministically decide whether it qualifies (Codex's trace never attempted K1).
- Have `request_image_render` / the keyframe mint surface a structured
  `capability_required: ['image-generation']` and a `worker_present: <bool>` derived from `list_daemons`
  (empty on this host today) so the agent gates on a value, not a paragraph.
- Consider extending `get_mcp_capabilities` with an `image_worker: { present, kind }` field.
This plays to the contract-making strength both agents already have.

### C2 — Encode the hard-won failure vocabulary into the motion routing card
Put the recovery knowledge into the card the agents actually read (`semantic_search kind:'routing'`
motion card + `get_sketch_vocab keyframe-animation`), so the next agent doesn't rediscover by crashing:
- `emote_figure` returns a sketch ref + GIF url, **not** a `mo_` — you cannot `stitch_motion` emotes; to
  sequence think→point author `create_figure motion:{keyframes:[pose,…]}` (numeric dials).
- keyframe `motion:{keyframes}` poses are **create_figure joint dials, not natural-language beats**.
- `materialize` loops dissolve to empty at both ends — inspect a **mid** frame, never frame 0
  (`frame_zero_false_blank`).
- deck slides must be existing sketch refs (post-D4, any ref that resolves).

### C3 — Ship a toolchain conformance smoke probe
A `verify_machina`-style probe that exercises one fixture per motion family (deck / materialize /
figure keyframes / keyframe-animation guide) with known-good inputs and reports which paths are green
on this host. Turns "discover D2 by hitting it inside a real task" into "known-red before you start."
Also the natural home for D1's param-type audit as a regression guard.

### C4 — Codex-side AGENTS.md nudge (behavioral, targets the observed gap)
The book notes Codex compresses to an executable contract fast and can stop at the first rejection
(item 15 halted at the `stitch` symptom; Claude isolated the underlying validator). Add to
`AGENTS.md`: *"When a mojulo tool rejects an input the schema appears to permit, isolate the constraint
with a minimal probe before falling back — do not treat the first rejection as the tool's true limit."*
Converts fast-contract style from a liability on an edge-y toolchain into diagnostic behavior.

### C5 — Stand up the local image worker (unblocks the whole K1 arm)
`list_daemons` is empty, so K1 is dead for every agent regardless of the above. Register the local
ComfyUI rung (SDXL + OpenPose ControlNet + IP-Adapter) as a daemon, or wire an image-gen-capable
worker. Only then does item 16's intended evidence surface (identity drift / pose discontinuity /
scaffold noncompliance across cels) become reachable — currently it cannot be measured at all.

---

## Sequencing
1. **D1** (param-type audit + defensive parse) — unblocks continuous figure motion for the whole fleet; broadest reach.
2. **D2 + D3** — kill the opaque keyframe crash and the silent-drop footgun; small, well-scoped.
3. **D4** — deck ref consistency.
4. **C2** (routing-card enrichment) — cheap, high-leverage for both agents; do alongside D1–D3 so the card matches the fixed behavior.
5. **C1, C3** — infrastructure; schedule after the bug fixes land.
6. **C5** — separate track (ops/worker provisioning); prerequisite for any real K1 comparison.
7. **C4** — one-line AGENTS.md change; independent.

## Validation
- Unit tests per D1–D4 (noted inline).
- Re-run the M3 + K1 legs from the trace against the fixed toolchain: M3 should produce a single
  continuous think→point clip via `motion:{keyframes}`; K1 mint should reject `motion:'custom'` with the
  D2 message and accept `motion:{keyframes}` (still worker-gated by C5).
- Record the re-run as a new, correctly-attributed item in `res_9add895c8688` (and fix the item 17
  provenance label: it is the Claude Code run, currently titled "Codex").

## Out of scope
- The item 17 provenance mislabel and the "no worker present" note are data-integrity items for the
  research book, tracked here only as validation follow-ups — not code changes.
- No new motion families; this is hardening the existing surface only.
