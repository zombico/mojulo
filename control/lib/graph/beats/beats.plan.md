# Mojulo Beats — authorable musical artifacts, wired to worlds

Status: B0–B3 built (kernel + patches + manifests + tests; create_beats /
get_beats_vocab + vocab cards + embeddings + player page + /beats route; the
`audio` world channel with soundtrack / beatsRef / wind / footsteps / bus-cue
SFX). B4 (CSS3D soundtrack, .wav export, CLAUDE.md entry, renderer-ladder
Phase 5 trim) remains. B5 (the groove-instrument elevation, from the Night
Bus sequencer spike of 2026-07-04): B5.0 + B5.1 built (composition swing,
filterEnv/detune, note-fraction fx times, sawStab patch; the beats-pattern
kind end to end — kernel patternEvents/startPattern, gesture-as-instrument,
chord contours, manifest, vocab card, player, world soundtrack, render mode;
exit met: Night Bus minted over MCP at /sketches/night-bus). B5.2 (macros +
grid player) and B5.3 (world bindings) remain.

This plan formalizes the audio spike of 2026-07-04 (two Tone.js artifacts:
"Night Circuit", a generative ambient loop, and "Buster Lab", a chiptune
charge-shot foley study) into a substrate primitive family. It absorbs and
supersedes **renderer-ladder.plan.md Phase 5 — deterministic ambient audio**;
that phase's constraints are carried forward verbatim as doctrine here. When
implementation lands, edit Phase 5 down to a pointer at this file.

## What the spike taught

Three distinct audio primitives fell out, and they are not the same shape:

1. **Ambient soundtrack** (Night Circuit) — a *generative loop recipe*:
   tempo, key, swing, a chord progression, and N channels each defined as
   `synth patch → effects chain → level`, plus dice (a probability-gated
   random-walk melody). Small recipe, endless non-repeating output. This is
   the world-presence primitive.
2. **Composition** — an *explicit score*: parts with literal note events
   `[time, note, duration, velocity]` against one transport. No dice.
   Deterministic by construction; the MIDI-shaped middle layer between
   "vibe recipe" and "sound design".
3. **Sound effect** (Buster Lab) — a *gesture, not a loop*: pitch-and-volume
   choreography fired by an event. The whole chiptune foley vocabulary
   reduces to four gestures the spike validated:
   - `sweep` — pitch ramp up/down over N ms (laser, jump, fall)
   - `flutter` — a 3-4 note pitch table retriggered at 20-30 Hz by a frame
     clock, with tiered table-swaps over hold time (charge-up)
   - `burst` — enveloped noise (impact, explosion, footstep scuff, hat)
   - `thump` — pitch-swept sine/membrane (kick, landing, heavy impact)
   Effects-as-composition: the era's trick, and ours — a "tier up" is a
   pitch-table swap, not a filter. This keeps SFX pure functions of
   (params, time).

Spike provenance (live demos, not doctrine — they use Tone.js, which the
substrate will not): https://claude.ai/code/artifact/93755fec-0368-45c7-9ce9-e327afa6bd49
(ambient), https://claude.ai/code/artifact/61c1e497-af9d-4816-a2ed-afc39649be6a (SFX).

## Doctrine (decided)

- **Synthesized, never sampled.** No media bytes, no network, per
  renderer-ladder Phase 5. Instruments are oscillator + envelope + filter
  math; anything that genuinely needs samples (piano, voice) is out of scope
  by design.
- **No Tone.js.** The spike used it; the substrate won't. Reasons: it is a
  ~340KB dependency against a required surface the spike proved is small
  (voice = osc+ADSR, noise voice, biquad filter, feedback delay, a cheap
  reverb, one lookahead scheduler); the graph substrate's precedent is
  dependency-free kernels emitted into pages via `.toString()`
  (physics-sim.js, controllable-world.js, event-bus.js); and we need seeded
  determinism, which means owning the scheduler and PRNG anyway. Target:
  a hand-rolled `beats-kernel.js` of roughly 400-600 lines.
- **Recipes, not renders.** A beats artifact persists as a tiny manifest and
  is re-synthesized per request, exactly like worlds/workbenches. No wav/mp3
  blobs on disk. (Offline export to .wav via `OfflineAudioContext` is a
  possible later follow-on, modeled on the .glb export path — export-only,
  never import.)
- **Seeded dice.** Generative recipes carry a `seed`; the kernel uses
  mulberry32, never `Math.random`. Same recipe + same seed = same
  performance. This is what makes "generative" compatible with the
  substrate's replay/capture doctrine.
- **Audio is presentation, not simulation.** In worlds it reads sim state
  (bus events, gait phase) and never feeds back. A recipe with `audio`
  omitted emits byte-identical HTML to today. Muted capture runs stay
  byte-identical. `payload.nonBakeable` — live `/world` path only; `/svg`
  and `/scene` stills ignore it.

## Architecture

```
control/lib/graph/beats/
  beats-kernel.js      dependency-free WebAudio kernel, emitted via .toString()
                       - mulberry32 PRNG
                       - voice(patch): osc + ADSR (+ per-voice biquad)
                       - noiseVoice(patch): buffer-sourced white noise + ADSR
                       - fx: feedbackDelay, pingPong, cheapReverb (generated
                         impulse into ConvolverNode — computed, not sampled)
                       - transport: lookahead scheduler (~25ms tick, 100ms
                         horizon), bpm/swing, bar/step callbacks
                       - gesture player: sweep | flutter | burst | thump
  audio-patches.js     named pure param sets (pure fn of (params, time)):
                       pad, bassMono, sinePluck, fmBell, kick, hat, laser,
                       burst, thump — theme-pack spirit, one file
  beats-manifest.js    validate/normalize the three manifest kinds
  beats-player.js      emitBeatsPlayer(manifest) → self-contained player page
                       (the spike page distilled: transport button, channel
                       strips w/ chain labels + mutes, oscilloscope canvas)
  beats-vocab/*.md     vocab cards (JSON frontmatter), one per kind + one per
                       gesture family; loader.js mirroring sketch-vocab
```

### Manifest kinds (all rows in the existing `sketches` table)

The family is a `manifest.kind` discriminator, not a new table — recipes are
small and deterministic, which is exactly what the sketches table holds.

- `beats-ambient` — `{ kind, title, bpm, swing, key, seed,
  progression: [{chord:[notes], root}], channels: [{ name, patch,
  role: harmony|roots|melody|pulse, chain: [fx...], level,
  sequence?: generative rule (randomWalk table + probability gate) |
  step table }] }`
- `beats-composition` — `{ kind, title, bpm, swing, parts: [{ name, patch,
  chain, level, events: [[bar:beat:sixteenth, note|chord, dur, vel]] }] }`
- `beats-sfx` — `{ kind, title, cues: { <cueId>: [gesture...] } }` where a
  gesture is `{ type: sweep|flutter|burst|thump, ...params }`; flutter
  carries `{ rateHz, tiers: [{ at, table }] }` (the Buster tier model).

Ref prefix: rides sketch ref generation (caller-suppliable). URL:
`/sketches/<ref>` with a new `sketchRenderMode` branch `beats` →
`<iframe>` of a new route `control/app/api/sketches/[ref]/beats/route.js`
returning `emitBeatsPlayer(manifest)` as `text/html` (mirrors the
`/world` route exactly).

### MCP surface

One dispatcher mint, not three tools (create_view precedent — new kinds cost
a vocab card, not a registration):

- `create_beats` — input `{ kind: beats-ambient|beats-composition|beats-sfx,
  title, ...recipe }`, per-kind handler map, hand-validated with teaching
  errors, returns `{ ok, ref, url }`.
- `get_beats_vocab` — list/read vocab cards; cards embedded under a new
  `meta_embeddings` `source_kind = 'beats_vocab'` (CHECK-rebuild migration,
  the `migrateStashItemTypeCheck` idiom) and wired into
  `embeddings.js reindexAll`, so `semantic_search({ kinds: ['beats_vocab'] })`
  routes intent → kind card.
- Registration: `registerBeatsTools()` in a new
  `control/lib/mcp/tools/beats.js`, imported in `ensureToolsRegistered()`
  next to the visual-mint cluster (compose_world → create_view → workbench →
  motion → **beats**). Both tools get `TOOL_INDEX` rows (the context.test.js
  registry sweep enforces this) under the illustration ring. Posture matches
  sketches: scratch-adjacent, no `forward_context` routing rows for now —
  worlds reference beats, not the other way up.

### Wiring to worlds (the goal)

`audio` becomes an opt-in manifest channel mirroring `fog` end to end:

1. **Resolve** — additive block in `resolveWorldScene()`
   (world-scene.js, beside the fog block at ~191-197):
   `manifest.audio = { soundtrack?: <inline beats-ambient recipe> |
   { beatsRef }, wind?: true, sfx?: { <cueId>: gesture[] | patchId },
   bindings?: {...} }` → `payload.audio`, `payload.nonBakeable = true`.
   `beatsRef` resolution follows the workbench `sketchRef` wrap-texture
   precedent (world-kinds.js `resolveWrapTextures`): fetch the beats row,
   inline its recipe into the payload — the emitted page stays
   self-contained, the ref is authoring-time indirection only.
2. **Emit** — `audio = null` joins `emitThreeWorld`'s destructure
   (scene-three.js ~2156); a new `audioChannelScript(audio)` emits
   `beats-kernel.js` + patches via `.toString()` alongside the other channel
   blocks (~2741-2748); stepped from `__mojStep`, honoring `__mojClock`
   (capture runs force mute).
3. **Unlock** — resume the AudioContext on the existing canvas
   click / pointer-lock entry (scene-three.js ~1197/1722) — the gesture is
   already there. A small speaker toggle in the HUD; default on after
   unlock.
4. **SFX triggers** — two already-earmarked seams, zero new sim state:
   - **Event bus**: reactions/inputs gain an optional `sound: <cueId>`
     field; when the event drains in `stepEvents`, the audio channel fires
     the cue's gesture (`pickup` dings, `hitConfirm` thumps, door `toggle`
     creaks-as-sweep).
   - **Gait**: footsteps off the controllable channel's existing
     `e.gaitPhase` zero-crossings, `e.landed` → thump, `e.jumped` → sweep
     (controllable-world.js ~154-162 computes these today).
   - **Wind/ambience**: filtered noise shaped by the sky/atmosphere settings
     the recipe already carries (Phase 5's model, unchanged).
5. **CSS3D `/scene` path** — soundtrack-only follow-on (a plain kernel
   `<script>` works in the dependency-free page; there is no bus or gait
   there, so no SFX). Not in the first cut.

## Phases

**B0 — kernel.** `beats-kernel.js` + `audio-patches.js` + node tests:
scheduler emits deterministic event times for a fixed (recipe, seed);
patches are pure functions of (params, time); gesture player produces the
four gesture envelopes. No UI, no MCP.

**B1 — standalone artifacts.** `create_beats` + `get_beats_vocab` + vocab
cards + embeddings migration + `beats` render mode + `/beats` API route +
`emitBeatsPlayer`. Exit: an agent mints all three kinds over MCP and each
plays at its `/sketches/<ref>` URL; context.test.js sweep green.

**B2 — soundtrack in worlds.** The `audio` channel: resolve → emit →
unlock → HUD toggle; inline recipe and `beatsRef` both work. Exit: a
composed world hums its authored ambient loop after first click; a recipe
without `audio` is byte-identical to today.

**B3 — SFX in worlds.** Bus `sound:` cues, gait footsteps, wind. Exit
(inherits Phase 5's): walk mode in a dungeon has footsteps and wind; an
action world's pickup dings; muted capture byte-identical.

**B4 — later.** CSS3D soundtrack; `OfflineAudioContext` .wav export
(export-only); composition→ambient interop (a composition as a world
soundtrack); doc entry in CLAUDE.md architecture map + trim
renderer-ladder Phase 5 to a pointer.

## Deliberately out

- Sampled audio of any kind (breaks zero-asset; the `mediaRef` seam exists
  if a future plan ever revisits this deliberately).
- Vendoring Tone.js (rejected above; revisit only if the kernel's scope
  creeps past ~2× its target size).
- A timeline/DAW editor UI — recipe stays the only source of truth; the
  player page renders state and mutes channels, it does not author.
- Music-theory helpers in the kernel (progression generation, voice
  leading) — that is the agent's job at authoring time; the substrate
  stores what was decided.

---

## B5 — the groove instrument (Night Bus spike, 2026-07-04)

A second spike: "Night Bus", a UK garage × deep house step sequencer built
against raw WebAudio — 8 tracks × 32 swung sixteenths, per-track pitch/tone
effects, live grid editing. Spike provenance (live demo, not doctrine):
https://claude.ai/code/artifact/d6c5b6b1-ceef-44f1-a4d7-8f947bbb02cf
(a standalone copy was also saved locally as a single self-contained HTML
file — the whole instrument fits in ~23KB with zero dependencies, which is
itself evidence the kernel budget below is honest).

### What the spike taught

Today beats is a *playback recipe*: mint it, it plays, done. Night Bus showed
the shape the primitive wants: a *groove instrument* — authored as a pattern,
performed through a few macros, modulated by the world it's embedded in.
Concrete findings against the B0–B3 kernel:

- The signature deep-house/garage stab needs a **filter envelope** (cutoff
  2200→420Hz over ~200ms) and **detuned unison saws** (±6 cents). playVoice's
  per-patch filter is static and there is no detune — the kernel cannot voice
  the genre.
- The drum kit **is** the sfx gesture vocabulary: kick = thump, clap = three
  staggered bursts, hats = highpass bursts. It exists, walled off inside
  `beats-sfx`, unusable as instruments by the musical kinds.
- **Bug**: `beats-composition` validates and normalizes `swing` but
  `compositionEvents` never applies it — swung sixteenths on an explicit
  score is silently straightened.
- The natural authoring shape was neither an ambient recipe nor
  `[bar:beat:sixteenth, …]` tuples but a **pattern**: tracks × 32 cells of
  velocity, with a per-step *note-contour array* separate from the activation
  mask (any toggled step stays musical). Ambient `pulse` is hard-capped at 16
  steps / 1 bar; the groove lived in the 2-bar variation — the broken bar-2
  kick *is* the garage.
- Two per-track macros — **transpose** (semitones, applied at noteHz time)
  and **tone** (a low-pass at the chain head, with fx sends tapped *after* it
  so delay tails darken with their source) — turned playback into
  performance for near-zero code.
- **Musical time must survive tempo**: the dotted-eighth delay locked to bpm
  was essential; the kernel's seconds-based fx `time` drifts out of the
  pocket at any other tempo.

### Thesis

Make the pattern the center of gravity, not a fourth bolt-on kind. The three
existing kinds are views of one thing: ambient = pattern + seeded dice,
composition = pattern flattened to events, sfx = the instrument rack the
pattern triggers. Converge the kernel's separate scheduling paths on one
event-derivation core whose native input is the pattern. A 32-cell mask is
diffable and legible in a way event tuples never are — `update_sketch`-style
edits become "mute bar 2's kick, add a ghost hat" instead of tuple surgery.

### Moves

1. **Gestures become the instrument rack.** A track's instrument is a patch
   *or* a gesture cue (`sweep|flutter|burst|thump` or a named cue list). The
   highest leverage-to-code ratio in B5: the drum kit already exists, it is
   just quarantined in the foley kind. One synthesis vocabulary for all kinds.
2. **Earn the genre with two patch fields.** `filterEnv: { from, to, decay }`
   and `detune`/`unison` on patches. Deliberately stop there — no LFO matrix,
   no wavetables. Smallness is the kernel's identity; these two fields buy
   disproportionate territory (house stab, garage organ, acid line).
3. **Performance macros as manifest fields — the world-modulation seam.**
   Per-channel `transpose` and `tone` (beside the existing level/mute),
   exposed as sliders on the player page, *and* bindable from the world
   `audio` channel's `bindings` block: sim state → macro, read-only, one
   direction. Depth rolls the soundtrack's tone down; sprint raises the hats'
   level; combat proximity opens the stab's filter. Beats joins the world's
   atmosphere model the way the lighting layer did — and stays inside "audio
   is presentation, not simulation" because the flow never reverses.
4. **Musical time as a contract.** Apply swing in composition mode (bug fix);
   accept note-fraction fx times (`time: '3/16'`) resolved from bpm at
   chain-build time. A recipe that says "swung, dotted-eighth delay" stays in
   the pocket at any tempo.

Plus one near-free presentation payoff: **the player page renders the grid.**
The manifest already is the grid — show it (playhead sweep, mutes, macro
sliders). Read-only playhead, not a DAW: the recipe stays the only author,
but every beats artifact becomes self-explanatory at a glance.

### Phases

**B5.0 — kernel truth.** ✅ Built. Composition-swing bug fix; `filterEnv` +
`detune`/`unison` in playVoice (and the `sawStab` shelf patch exercising
both); note-fraction fx times (`fxTimeSeconds`). Pure additions, tests
extended.

**B5.1 — the pattern kind.** ✅ Built. `beats-pattern` manifest (tracks × N
steps, velocity mask + optional note contour — an entry may be a chord
array; N in [8, 64]; instrument = patch | gesture | cue), kernel
`patternEvents` + `startPattern` (gesture instruments scale by step
velocity via playCue's velScale), vocab card (embeddings pick it up on next
reindex), player + render mode + world-soundtrack acceptance. Exit met: the
Night Bus groove minted over MCP as `beats-pattern` ref `night-bus`, plays
at /sketches/night-bus.

**B5.2 — macros + grid player.** `transpose`/`tone` per channel in all
kinds; player page grows the grid view and macro sliders. Exit: the minted
pattern is performable in the browser — retune the kick, darken the stab —
and the manifest round-trips the macro values.

**B5.3 — world bindings.** `audio.bindings`: sim-state selectors → channel
macros (depth/speed/proximity to level/tone/transpose), evaluated in the
audio channel step, never feeding back. Exit: a dungeon world whose
soundtrack tone follows player depth; muted capture stays byte-identical.

### Deliberately out (B5)

- Sample import of any kind (unchanged doctrine).
- A timeline/DAW editor — grid playhead is read-only; the recipe authors.
- Audio-rate modulation routing / LFO matrices.
- Kernel growth past ~2× its B0 size — if a move breaks the budget, the
  move shrinks, not the budget.
