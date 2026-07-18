# Mojulo Voice — the voice primitive + speech synthesis behind a render-handoff-shaped seam

Status: **V0 built and proven live** (2026-07-13): both backend rungs
speaking (English + Japanese), the voice-register primitive landed
(voice-register.js, 10 unit tests), blends proven live, calibration sweep
rendered awaiting the operator's ears. Nothing in this plan changes the
image seam — voice gets its own loop that *rhymes* with it.

## The primitive: voice-register (the beats posture, transposed)

Mojulo Voice is a primitive family akin to Mojulo Beats: **tiny
deterministic recipes for how a voice sounds**, with WAVs as disposable
derived renders. The domain layer is
[voice-register.js](voice-register.js); it is pure math, no audio, no
ONNX — the worker seam does the rendering.

- **A bank** is a calibrated voice space for one language/register family.
  The concept is language-agnostic; `jp-female` is merely the first
  implementation. A bank pins **poles** (stock Kokoro embeddings assigned,
  by the operator's ears, to axis ends) and a **depth anchor** (a
  cross-gender embedding with a bounded ceiling share).
- **The axes** are operator-framed knobs (the chihaya–misaki–motoko
  framing):
  - `confidence` ∈ [0,1] — meek → authoritative; a lerp between the poles.
  - `depth` ∈ [0,1] — native timbre → the depth-anchor ceiling (0.3 for
    jp-female; past it identity breaks — a listening-derived bound).
- **Resolution** (`resolveVoiceRegister`) emits `{ weights, voiceArg,
  speed }` — `voiceArg` is the backend CLI's blend syntax
  (`jf_alpha:0.595,jf_nezumi:0.255,jm_kumo:0.15`). Same manifest → same
  string → same waveform. No seed exists because nothing is random: the
  seeded-dice rule is trivially satisfied by having no dice.
- **Speed** couples to confidence by default (`suggestedSpeed`: meek 0.90
  → authoritative 1.03); an explicit `speed` wins. `direction` carries the
  agent's text-performance notes (punctuation is a real Kokoro control).
- **Why blends are legitimate recipes:** Kokoro's voices are points in one
  learned style space; a convex mix is a valid voice (proven live — the
  50/50 nezumi/alpha blend even interpolates *pacing*: 7.79s vs 9.37s /
  6.91s for the poles on the same line). The weights are the recipe; no
  cloning, no fine-tuning, no per-voice downloads — all 54 embeddings ship
  in `voices-v1.0.bin`.

**Calibration protocol** (pending, operator's ears): listen to
`~/mojulo-voicegen/calibration/` — five stock voices on one line + the
axis demos — and pin the jp-female poles (which jf_ is meek, which is
authority). Provisional pins: meek=jf_nezumi, authority=jf_alpha,
`calibrated: false` until confirmed. Manifest-level pole overrides are the
calibration workflow, not an escape hatch.

**MCP + UI landed (2026-07-13, same day):** `create_voice` / `get_voice` /
`get_voice_vocab` in [../../mcp/tools/voice.js](../../mcp/tools/voice.js)
(rows ride `sketches` as kind `voice-register`, beats-sovereignty pattern:
own `voice` bucket, `update_sketch`/`diff_sketches` refuse and reroute);
forward_context kept tight — ONE routing row + a `voice` FORM in
`get_creative_toolset` + the `voice.md` routing card; key capabilities
live behind `get_voice_vocab`, never in the always-paid body (BODY_CEILING
re-pinned 11000 → 11200 for the new form's segmented-index row). UI: the
**Voice** tile in the Studio nav group → `/maker/voice`, a bespoke shelf
(no in-plane render exists — the card shows the recipe: axis bars,
weight chips, copyable voiceArg / speak command / starter prompt); i18n
keys in en.json (`home.tiles.voice`, `maker.voice.*` — run /sync-locales
before release). Proven live over the HTTP MCP transport: minted
`sk_xu6uysqzje` ("Misaki", confidence 0.65 / depth 0.4 → the same blend
proven by ear), read back, listed at `?bucket=voice`, page 200.

**Playable, tunable-to-the-edges samples (same day):**
`bind_voice_sample` binds a worker-rendered WAV onto a register —
append-only AXIS-STAMPED slots in
`data/outcomes/<ref>/voice-sample-c<cc>-d<dd>-<n>.wav`
(voice-sample-store.js, the render-store posture: derived render with a
provenance sidecar `{axes, text, source, n}`, never required). Served at
`/api/sketches/<ref>/voice-sample.wav?c=&d=` — the NEAREST rendered
point answers (euclidean in axis space; `X-Voice-Sample-Axes` header
names which point spoke); `/voice-samples` is the JSON point index.
RIFF/WAVE magic checked at the door (the machine half; V1 grows
duration + non-silence here).

The /maker/voice card is TUNABLE: the axes are sliders that re-resolve
the blend live in the browser (pure math, same module as the mint —
weights / voiceArg / speed update per drag; the stored register is never
edited from the dashboard), green marks show the audible points, and the
player follows the nearest rendered sample edge to edge. Copy affordances
carry the TUNED point's voiceArg/command back to the host agent. Proven
live: five points rendered by the local backend and bound via MCP for
Misaki — chihaya edge (0,0), center (0.5,0), motoko edge (1,0), deep
motoko (1,1), and her home point (0.65,0.4), same line throughout (edge
pacing spread 6.08s → 3.97s: the axis is audible); nearest-point lookup
verified ((0.9,0.1) → the (1,0) render).

**Next slices for the primitive:** named register presets
(`misaki-chihaya`, `misaki-motoko`) once poles are calibrated, more banks
(en-female, zh-female for the local-help bot), `update_voice` with
revision snapshots if registers start iterating, reindex embeddings so
the routing card enters `semantic_search({kinds:['routing']})`, and the
V1 seam carrying `voiceArg` in the speech-brief packet.

## Why this exists

Mojulo designs speech (a bot's reply, a world's narration line, a
publication read aloud) but cannot speak it. Same posture as
image-outcomes: **the voice is a pluggable worker, not a build-time
dependency.** Two worker shapes are planned from day one:

1. **Local backend** — Kokoro-82M via ONNX (`kokoro-js`), a sibling
   install the driving agent invokes. First, because it proves the seam
   with zero external capability assumptions.
2. **Natively voice-capable agent** — Codex / ChatGPT harnesses that can
   synthesize speech themselves. Second, because the seam must already
   exist for them to serve it (renders record `source`, both coexist —
   exactly the image precedent).

The build order is deliberate: get Kokoro speaking (V0), wire the durable
seam with Kokoro as the test rider (V1), then the Codex rung is just a
capability-ladder entry in the catalyst (V2) — no seam changes.

## Seam analysis — what the image worker actually consists of

The image render handoff decomposes into five separable layers. Each has
a voice analogue; none of them require sharing code with images yet.

| Layer | Image implementation | What it provides | Voice analogue |
|---|---|---|---|
| **1. The brief (packet)** | `get_image_render_packet` — instructions, workerProtocol, scaffold URLs, `localParams` | Everything a cold worker needs; the pull payload IS the packet | A speech packet: text/script, voice id, pacing, language, register notes; `localParams` = deterministic Kokoro args |
| **2. Durable rows** | `image_render_requests` table, `RenderRequestRepository` (`irq_` ids), pending → in_flight → submitted → accepted/rejected; idempotent per (ref, target, manifestHash); atomic `claimNext` | Survives restarts; concurrent workers can't double-claim; the request outlives the session | Same lifecycle verbatim, own table (`voice_render_requests`, `vrq_` ids) |
| **3. Append-only artifact store** | render-store: `data/outcomes/<ref>/render-<target>-<n>.png`, `n` from disk never the clock | Snapshots, never edited in place, never required | `render-<target>-<n>.wav` in the same outcome folder (or a generalized ext param on render-store) |
| **4. Two-gate audit** | Machine gate at submit (PNG magic; MERU / STAGE deterministic audits), eyes gate at accept (separate author; no self-accept) | The tool never claims the eyes gate passed | Machine gate: RIFF/WAV magic, duration > 0, sample-rate sanity, non-silence RMS. Eyes gate = **ears gate**: the accepting agent listens (or later, transcript alignment) |
| **5. Capability ladder** | Catalyst resolves: native image gen → local ComfyUI probe → point at optional install. Mojulo never detects capability itself | Responsibility-model posture: the assessment belongs to the agent in the seat | Native TTS (Codex) → local Kokoro probe → point at `install-local-voicegen.sh` |

Cross-cutting properties worth preserving (the bicycle doctrine,
docs/bicycles.md): every response names the next action; the loop is
drivable cold; state is re-readable; retries are per-unit and per-gate.

**Generalize-vs-duplicate decision:** duplicate now, extract later. The
image rows carry image-specific gates (PNG magic, MERU, STAGE) and the
repo doctrine is explicit — one contract until a second consumer exists.
Voice IS the second consumer, but the extraction (a `medium` column or a
shared handoff module) should be cut from two *proven* loops, not one
proven and one speculative. V1 mirrors; a later refactor merges if the
mirror stays exact.

## Doctrine (inherited from local-render-worker.plan.md, restated)

- **Optional install, never eager.** No new control-plane dependency, no
  postinstall, no weights in the repo. Kokoro lives in a sibling dir
  (`~/mojulo-voicegen`) with its own `node_modules` and model cache —
  the Ollama/ComfyUI shape. Operators whose agent speaks natively never
  install it.
- **The agent is the bridge.** Mojulo never starts, probes, or configures
  the backend. The driving agent pulls the brief, invokes `speak.mjs` (a
  CLI, not a server — Kokoro is fast enough per-utterance that a daemon
  earns nothing yet), and hands the WAV back.
- **Deterministic where it can be, agentic where it must be.** Voice id,
  speed, language are closed-vocabulary packet data. Register/emphasis
  distillation (how a line should *land*) stays with the driving agent.
- **Recipes not renders.** The speech brief is the artifact; WAVs are
  render events with provenance (`source`, voice, model tag), same as
  seeds in the image loop.

## Stack — two rungs, one install dir, one CLI contract

Both rungs are Kokoro-82M on ONNX and print the identical one-line JSON
handback (`{ ok, path, bytes, seconds, sample_rate, rms, voice, speed,
model }`), so anything above them — the driving agent today, the V1
submit gate later — is rung-blind.

- **Rung 1, English fast path: `kokoro-js` (npm, v1.2.1)** —
  `@huggingface/transformers` + `phonemizer`, pure Node, no venv. q8
  weights ~92MB, fetched lazily into the install dir's own cache
  (the fetch-embed-model precedent). `speak.mjs`. English-only by
  construction: its phonemizer has no non-English G2P — forcing a `jf_`
  voice hard-crashes (proven 2026-07-13).
- **Rung 2, multilingual: `kokoro-onnx` (pip, 0.5.0) + `misaki[ja]`** —
  a venv inside the same sibling dir (the ComfyUI shape, venv and all),
  fp32 v1.0 model + full 54-voice bin (~340MB, pinned GitHub release
  download). `speak.py`. Japanese text routes through misaki's JA G2P
  (the phoneme alphabet Kokoro was trained on — espeak's ja tables are
  not it; misaki 0.7 returns the phoneme string directly, not an
  `(phonemes, tokens)` tuple); other languages ride kokoro-onnx's
  espeak G2P keyed off the voice-id prefix. Installed by the `--ja`
  flag, proven live same day (`jf_alpha`, 5.4s utterance).
- **Voices:** the id prefix is a closed two-letter vocabulary,
  `<lang><gender>_<name>`: `a`merican/`b`ritish English (28, the only
  ones rung 1 sees), `j`apanese (jf_alpha, jf_gongitsune, jf_nezumi,
  jf_tebukuro, jm_kumo), `z`h Chinese (4f+4m — relevant to the
  Chinese-language local-help bot), `e`s/`f`r/`h`i/`i`t/`p`t. 54 total —
  a natural closed vocabulary for the packet's `localParams`, and the
  prefix doubles as the rung-routing key.
- **Output:** mono WAV 24kHz (Kokoro native; rung 1 writes Float32,
  rung 2 Int16 PCM). Post-processing (loudness, format transcode) is
  out of scope until a consumer needs it.

## Phases

### V0 — Kokoro running, one basic thing (this diff)

- `control/scripts/install-local-voicegen.sh` — mirrors
  install-local-imagegen.sh: `--dir` (default `~/mojulo-voicegen`),
  creates the sibling package, `npm install kokoro-js`, copies the
  checked-in `voicegen-speak.mjs` in as `speak.mjs`, optional `--warm`
  to pre-fetch weights by synthesizing a test phrase.
- `control/scripts/voicegen-speak.mjs` — the CLI template (checked in:
  templates are recipes, weights are not). `--text | --file`, `--voice`,
  `--speed`, `--out`, `--list-voices`. Pins the model cache under the
  install dir. Prints a JSON result line (path, bytes, seconds, voice,
  model) so a driving agent can parse the handback.
- `docs/local-voice-worker.md` — the operator page, L0-style.
- Exit: a fresh operator (or agent) goes from nothing to a playable WAV
  with two commands, and an operator who skips it loses nothing.

### V1 — the durable voice seam

- A speech-brief artifact kind (likely a `voice-outcome` sketch kind so
  refs, `manifestHash` idempotency, and the sketches surface all reuse):
  script segments as targets (the panel analogue — per-line
  regeneration is cheap, the per-panel argument made audible).
- `voice_render_requests` + repository (mirror of render-requests.js),
  and the four tools: `request_voice_render` → `pull_voice_render` →
  `submit_voice_render` (machine gate: WAV magic, duration, non-silence)
  → `accept_/reject_voice_render` (ears gate, no self-accept).
- render-store grows an extension parameter (or a sibling voice-store).
- Exit: the I3 criterion transposed — a foreign agent takes a minted
  speech ref to accepted WAVs cold, Kokoro as the hands.

### V2 — the Codex rung

- The worker catalyst gets the capability ladder: (1) native TTS in your
  harness → use it; (2) probe `~/mojulo-voicegen` → drive `speak.mjs`;
  (3) stop and point at the install doc. Submissions record `source`.
- Exit: the same parked request set served by either worker shape with
  no seam change.

### V3 — consumers (each its own slice, gated on V1)

- **Bots:** spoken replies as an opt-in protocol layer (WAV alongside
  the text turn; conversation data still never moves control-side).
- **Worlds:** narration/dialogue cues on the manifest `audio` channel
  beside beats bindings (beats-world.js resolves; voice stays
  synthesized-never-sampled *upstream* but a rendered WAV is a bound
  asset like any accepted render).
- **Publications/films:** read-aloud tracks for `cook` outputs and
  `stitch_film` voiceover.

## Out of scope

- Any daemon/server wrapper around Kokoro (CLI per utterance until a
  latency-sensitive consumer exists).
- STT / transcription audit (a whisper-based machine gate is a known
  upgrade, not a V-anything commitment).
- Voice cloning or sampled voices — Kokoro's shipped embeddings only.
- Generalizing the image request table before both loops are proven.
