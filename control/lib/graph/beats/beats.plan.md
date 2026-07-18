# Mojulo Beats — authorable musical artifacts, wired to worlds

Status: B0–B9 built (2026-07-10 closes the plan's open items). B10 (the foley
spike, 2026-07-13) built: `grain` + `ring` gestures, `burst.lowpass`,
`flutter.jitter` — the sfx kind goes naturalistic (footsteps, creaks, glass,
fire); A/B refs foley-lab-1 / foley-lab-2. B11 (the armory pack, 2026-07-14)
added no kernel surface — a 14-cue weapon reference pack (ref `armory`:
gunfire / lock-and-load / energy weapons) built entirely from the B10 six
gestures. B0–B3: kernel +
patches + manifests + tests; create_beats / get_beats_vocab + vocab cards +
embeddings + player page + /beats route; the `audio` world channel with
soundtrack / beatsRef / wind / footsteps / bus-cue SFX. B4: .wav export landed
as B8; the remainder (CSS3D `/scene` soundtrack via emitSceneSoundtrackScript —
soundtrack + wind only, capture-safe; CLAUDE.md architecture-map entry;
renderer-ladder Phase 5 trimmed to a pointer) built 2026-07-10. B5.0 + B5.1
built (composition swing, filterEnv/detune, note-fraction fx times, sawStab;
the beats-pattern kind end to end; exit met: Night Bus at /sketches/night-bus).
B5.2 built: `transpose`/`tone` performance macros on every channel/part/track
(kernel setTranspose/setTone/setLevel + toneFreq, tone low-pass at the chain
head, transpose at schedule time, macro state survives stop/start), player
macro sliders, offline-render parity (macro-less renders stay byte-identical);
the grid player folded into B9.2 as planned. B5.3 built: `audio.bindings` —
sim-state selectors (depth / height / speed / proximity, camera or entity
subject) → channel macros, validated against the soundtrack at resolve time,
evaluated read-only per frame in the audio channel. B6.0/B6.2x built (B6.1
partially — instrument expansion shipped on all kinds; the remaining vocab
shelf work rides beats-instruments.md). B7.0 harmony bus + B8 WAV export
built. B9 built (first-class beats): `beats_revisions` + `beats_annotations`
tables + repos; get_beats / update_beats (full-manifest replace through the
create gate, revision snapshot per edit, pre-B9 heads backfilled, ?rev= plays
any revision) / annotate_beats / diff_beats (structured musical diff, ref@rev;
exit met: diffing the mute-bar-2-kick revisions reports exactly the kick-mask
change); update_sketch / diff_sketches teach on beats refs; exportsBaseDir
moved to tools/exports-dir.js; the `/api/beats/<ref>` namespace (player with
?rev=, `<ref>.wav`, /annotations GET, /meta, /diff) with the old
/api/sketches aliases intact; the `/beats/<ref>` studio (player iframe +
revision list with what-changed + read-only annotation panel + WAV export +
copy-revision-prompt); player grid + playhead + annotation markers for the
pattern kind; /maker/beats cards link to the studio; vocab cards carry the
macro + revise sections. Amendment (same day, operator call): annotation
WRITES stay MCP-only — annotate_beats is the single write surface; the studio
and player render marks read-only (the B9.2 annotate-here POST affordance was
removed after landing). Addendum (same day, operator call): **MIDI export**,
the musician handoff — `export_beats { format: 'midi' }` +
`/api/beats/<ref>.mid` (`?rev=`, bars/loops) render the SCORE as a format-1
SMF via [beats-midi.js](beats-midi.js), built on the same pure
renderBeatsPlan seam as the WAV (swing/feel/velocities/transpose travel;
timbre doesn't — pair with the .wav). GM program best-guesses per patch,
drum-shaped rows (membrane/noise patches, thump/burst gestures) on channel
10, pitched foley (sweep/flutter) skipped with a `skipped_gesture_hits`
count, beats-sfx refused (choreography, not a score). Export-only — MIDI
IMPORT stays deliberately out. Studio grew an Export .mid affordance.
Amendment (same day, operator call): beats are never LABELED sketches on the
surface — /sketches/<ref> redirects beats kinds to the studio, the
/maker/beats shelf speaks in "tracks" (sketchesIndex.beatsNoun overrides),
the studio carries its own breadcrumb trail, and tool copy says /beats/<ref>.
Rows stay in the sketches table; the sovereignty remains the domain layer.

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

---

## B6 — the instrument model (guitar spike, 2026-07-05)

A third spike: a plucked-string voice, worked up interactively from "can it
make guitar sounds" to acoustic + electric with strum and humanization. What
shipped: a `string` voice (Karplus-Strong) in playVoice; five `guitar*`
patches; two chain effects (`body` = parallel bandpass body resonators,
`drive` = computed soft-clip + cabinet lowpass); and `noteFeel`, a seeded
per-note performance layer applied in composition mode. All pure/seeded, 46
tests green, kernel still inside budget.

### What the spike taught

An instrument is not a monolith — it is a **stack of four orthogonal layers**,
and the guitar touched all four. Each is independently reusable and lives at
its own single dispatch point:

| layer | what it is | home | cost |
|-------|-----------|------|------|
| **voice** | excitation × resonator (the physics/topology) | a `playVoice` branch | **expensive** — kernel branch + realizer test |
| **patch** | timbre params over a voice | `PATCHES` data | cheap — pure data, validated by name |
| **color** | post-resonance shaping (body / drive / formant / filter) | a `buildChain` branch | cheap — composable, instrument-agnostic |
| **feel** | trigger + humanization (strum, jitter, articulation) | `noteFeel` (pure) | cheap — instrument-agnostic |

The load-bearing lesson: **most instruments need no new voice.** Guitar earned
one only because plucked-string physics was inexpressible by osc/fm/noise/
membrane. Bass, e-piano, Rhodes, pizzicato, clav, organ, synth leads/pads are
all reachable from *existing* voices + new patches + color + feel. The
expensive layer is the one to add most rarely and most deliberately — the
other three are where an instrument library should grow.

Second lesson: **color and feel are already instrument-agnostic and were built
that way by accident of good structure.** `drive` fattens a bass or a lead;
`body` warms any plucked/bowed voice; `noteFeel`'s strum/jitter is a property
of *performance*, not of guitars. They belong to the substrate, not to the
instrument — so the model must not let an instrument "own" them.

### Thesis

Do not accrete a monolithic instrument per instrument. Define a small
**excitation × resonator voice basis**, and make an instrument a *named
composition of the four layers* resolved at ONE point — the golden-rule
posture (converge on composition, never branch downstream) that
`buildDeploymentConfig` holds for bots and `getPatch`'s merge already models
in miniature.

```
Instrument (named, shelved data)
├── voice   : which playVoice topology
├── patch   : params for that voice (the timbre)
├── color   : default chain effects (body / drive / formant / filter)
└── feel    : default performance preset (strum, jitter, articulation)
```

A manifest part references `instrument: 'electric-guitar'` and gets the whole
stack; explicit `patch`/`chain`/`feel` on the part still work and *override*
the instrument's defaults (same merge as `getPatch(name, overrides)`). The
instrument is sugar that resolves to the existing primitives — it adds no new
runtime path, only a shelf lookup + merge. `resolveInstrument(name, overrides)
→ { patch, chain, feel }`, called once in the scheduler where `patches[...]`
is read today.

### The voice basis (the one expensive axis — plan it, don't accrete it)

Frame every voice as **excitation × resonator**. Today's five and the gaps:

- osc — oscillator, no resonator (additive-ish via unison). Reeds/leads/pads.
- fm — 2-op FM. Bells, e-piano, metallic — inharmonic.
- membrane — pitch-swept sine. Drums.
- noise — noise source. Percussion/breath/wind.
- string — impulse → waveguide (KS). Plucked/struck strings. **(B6 added.)**

Candidate new voices, in priority by **coverage per kernel branch**:

1. **modal** — a bank of N decaying sine partials (freq/decay/gain each). One
   topology unlocks a whole family: bells, mallets, marimba, vibes, glass,
   gongs, tines, and struck-metal — and sharpens piano (partly modal). Highest
   leverage; pure and seeded; the natural next voice.
2. **formant** — source (pulse/noise) through 3–5 formant band-passes. Voice,
   choir, vowel pads, and the "throat" of winds. Moderate.
3. **bowed / sustained-excitation** — continuous drive into a resonator.
   Bowed strings; with formant, brass/reed. Hardest (sustaining loop); last.

Explicitly *fold, don't fork*: a wind/brass **bore** is a KS cousin — extend
the `string` voice with a `boundary`/`loss` param, not a new branch. New
branches are for genuinely new topologies, not parameter variants.

Reachable NOW with zero kernel change (patch + color + feel only), so they
are B6 shelf work, not voice work: **bass** (string + finger/slap feel),
**e-piano/Rhodes/DX bells** (fm patches), **pizzicato** (string patches),
**organ/drawbar** (osc unison, or cleaner once `modal` lands), **synth
leads/pads** (osc/fm), **drum kit** (membrane+noise+gesture rack, per B5.1).

### Feel presets (articulation as named data)

`noteFeel` params are performance vocabulary, not per-part magic numbers.
Shelve named presets — `strum-down`, `fingerpick`, `alt-pick`, `ensemble`
(detune+timing spread for sections), `staccato`, `robotic` (the null feel) —
reused across instruments exactly like patches. An instrument's default `feel`
references a preset by name.

### Sustainability rules (carry the doctrine forward)

- **One dispatch point per layer.** Voices → `playVoice`; color → `buildChain`;
  feel → `noteFeel`; instruments → `resolveInstrument`. Every addition is one
  additive, localized clause that cannot break its siblings. No cross-layer
  special-casing.
- **Pure + seeded, always.** New voices join the realizer (untested by
  design); everything else (patch data, feel, instrument resolution) stays on
  the pure, unit-tested side. Determinism/replay is non-negotiable.
- **A card per primitive.** Each voice, color effect, feel preset, and named
  instrument earns a vocab card (the "new kind costs a card, not a
  registration" discipline) so intent → primitive routes via semantic_search
  and it is mintable, not just scratch-scriptable.
- **Kernel budget still binds.** The four-layer split is what *keeps* the
  budget: instruments are data, not code. If a voice is a parameter variant of
  an existing one, it is a param, not a branch.

### Phases

**B6.0 — the layered spike.** ✅ Built (working tree, uncommitted): `string`
voice, `guitar*` patches, `body`/`drive` chain effects, `noteFeel` +
composition-mode feel, tests. Not yet documented as vocab, not yet mintable
beyond patches/effects the existing kinds already accept.

**B6.1 — name the model + shelves.** `resolveInstrument` + an `INSTRUMENTS`
shelf (data), a `FEEL_PRESETS` shelf (data); manifest `instrument:` on a part
resolving to `{patch, chain, feel}` with part-level overrides merged; feel
applied in pattern mode too (composition-only today). Vocab cards for the
`string` voice, `body`/`drive` effects, feel presets, and the seed guitar
instruments. Exit: an agent mints an electric-guitar composition over MCP by
name, no scratch script; the null path is byte-identical to today.

**B6.2 — the modal voice.** ✅ Built. The `modal` voice in playVoice — a sum
of decaying sine partials ({ ratio, gain, decay } each), bypassing the ADSR so
each mode's own decay is the envelope and the note rings for its own length
(struck, not sustain-then-release). First instrument: `steel-drum` (patch
`steelpan`), tuned octave/twelfth/double-octave modes + bright inharmonic
modes that die fast. Composes with attackNoise (mallet tick), the chain
(reverb), harmony bus, and feel. Still to shelf on this voice: bells / marimba
/ vibes / glockenspiel / gongs — all now pure patch data (partial sets).

**B6.2b — keyboards shelf (2026-07-10).** ✅ Built. The keyboard family as
pure shelf data over three existing voices, exactly as §"Reachable NOW"
predicted: `rhodes` (fm tine + suitcase chorus), `harpsichord` (string,
`pick: 0` — the quill the guitars engineer away from), `clav`/`clavinet`
(string + light drive, staccato), `celesta` + `musicBox` (modal partial
sets), `organ` (gate-envelope triangle unison + rotary-ish chorus), and
`piano` — the modeled acoustic (doctrine holds: modeled, not sampled):
hammer-struck KS string + hammer-knock attackNoise + soundboard `body`
chain. One kernel param earned its keep (fold, don't fork): `velToFilter: k`
scales a patch's static filter cutoff by `(vel/0.8)^k` — velocity →
BRIGHTNESS, the piano's defining expressive axis; neutral at default
velocity, so the null path is byte-identical. One new feel preset: `keys`
(chord-roll whisper + touch jitter, which velToFilter turns into per-note
brightness variation). Character-preserving feels: harpsichord has no
velocity jitter (quills have no dynamics), music-box/organ stay `robotic`
(they are machines). Vocab card updated; shelf-integrity + keyboards tests
green. Piano refinement (same day): the amp spike's `pluckDetune` (two KS
strings a few cents apart) turned out to be exactly a piano unison course —
the slow beat between strings is the shimmer and the two-stage decay (unison
energy cancels fast = the bloom; the detuned residue rings on = the singing
tail). Adopted as pure patch data (`pluckDetune: 2.5`, `pluckDecay: 0.998`,
`maxRing: 6`) — no piano-specific kernel code. Still not pursued:
sympathetic resonance / per-register string counts (the sample-realism
slope §"Deliberately out" guards).

**B6.2c — amp voice (2026-07-10).** ✅ Spiked. Why `drive` reads as "a string,
slightly toasted": a string is a linear resonator whose identity is its decay
envelope; an amp is a nonlinear observer whose gain depends on level. You hear
a string while the output envelope tracks the string's decay; you hear an amp
once the clip stays saturated for most of the note's life and the envelope
decouples (loudness holds, *brightness* decays — distortion is a ferocious
compressor with harmonic exhaust). `drive`'s pre-gain tops out ~17dB — never
reaches that regime. Built: `amp` chain effect (gain STAGING in dB up to 50,
2–4 cascaded asymmetric clip stages via `ampCurve` — bias term recentered so
y(0)=0, sign alternating per stage for even harmonics — tighten-highpass +
mid pre-emphasis in, de-emphasis out, dc-block + interstage lowpass between
stages, cabinet as formant bank: 105Hz bump, presence peak, 24dB/oct cliff);
`pluckDetune` dual-pluck on the string voice (cents; intermodulation feed —
a lone harmonic string gives the clip nothing to growl with); `guitarAmp`
patch (new names — existing artifacts re-synthesize byte-identical);
negative-time clamp in beats-render (feel jitter at t=0: browser clamps,
OfflineAudioContext threw). Measured (A/B sk_fgq0cructm, held note over
1.5s): drive −3.6dB (string decay reads through) vs amp −1.3dB (envelope
decoupled). Riff comparison: sk_eyprci9g75 (drive) vs sk_21396htdo5 (amp).
Folded in (same day): shelf pair `rock-guitar` (guitarAmp + amp gain 42,
palm-mute — the rhythm wall) + `rock-lead` (guitarLead + amp gain 30
level −12 + 3/16 delay — same amp 12dB cooler so the lead keeps enough
envelope to phrase as a voice above the wall; settings proven in the Twin
Circuit two-guitar piece, sk_3scss1sljl). Vocab card updated (`amp` effect
row, shelf entries, metal/hard-rock routing phrases in `when`). Not yet:
power-amp sag (envelope follower on pre-gain), string↔amp feedback,
kill-switch/whammy gestures.

**B6.2d — instruments on ambient channels (2026-07-10).** ✅ Built. The last
kind without the instrument layer was `beats-ambient` — the world-soundtrack
primitive — so shelf instruments (piano first) couldn't join a world's
orchestra by name. Wired: ambient channels accept `instrument` (validate
teaches, normalize expands via the same `expandNode` as parts/tracks), and
the ambient scheduler applies `noteFeel` per note (the bar index folds into
the seed like pattern mode — humanization evolves per bar, replays
identically; a feel-less channel gets offset 0 / velScale 1, the pre-B6
path). Vocab: ambient + composition + instruments cards updated with
orchestra-member guidance (`{ role: 'harmony', instrument: 'piano' }`).
Null path untouched; 91 tests green.

**B6.3 — later.** formant voice (voice/choir/wind throat); bowed/sustained
voice; bass slap articulation; string-voice `boundary`/`loss` extension for
bores; per-instrument default color presets in the player UI.

### Deliberately out (B6)

- Sample import / multisampled realism (unchanged doctrine — acoustic piano,
  human voice stay out; the model closes the gap by *modeling*, not sampling).
- A voice per instrument. Instruments are compositions; a new voice must earn
  a genuinely new excitation×resonator topology, not a timbre.
- An instrument inheritance tree / class hierarchy — flat named data + a merge,
  not OO. If two instruments share color/feel, they reference the same shelf
  entry; they do not subclass.
- Audio-rate modulation, LFO matrices, effect automation (unchanged from B5).

---

## B7 — the harmony bus (house-sequencer analysis, 2026-07-06)

A fourth spike input: a matured, fully-featured house/UKG step sequencer
(descendant of the Night Bus artifact), all-synth, raw WebAudio, no Tone.js —
so it re-confirms the substrate's synthesis surface and doctrine while
demonstrating primitives B5/B6 lack. Analysis separated **substrate
primitives** (recipe-level, agent-authorable, deterministic) from **player/UI
affordances** (add/remove-from-catalog editor, drag-repitch, slots, project
file — beyond the "recipe is the author; the player performs + tweaks macros"
posture; a reference design, not substrate work).

The load-bearing find, spiked in B7.0: the **harmony bus** — author the chords
ONCE, and many instruments follow. Everything else the file showed (arrangement
scenes, send/master-bus routing, sidechain, formant/texture voices, .wav
export) is independent of each other and of this — a **menu**, not a sequence.
So B7.0 spikes the bus alone; the rest are pulled from B7.x by what's wanted.

### What the spike taught

- The file's real gift is not more voices (its ~20 CATALOG instruments map onto
  our 5 voices + patches) but **compositional/structural** primitives: a shared
  chord progression that any `chordVoice:true` track reads, chord-relative
  sequencing (arp = `chord[i%n]`, comp = `chord[⌊i/8⌋%n]`), per-step pitch
  offsets, A/B scenes, send/master buses, and sidechain ducking.
- Harmony was already half-present: `beats-ambient` has a `progression`, but
  only two hard-coded roles (harmony/roots) consume it, only in that kind. The
  generalization is "*any* instrument subscribes to a harmony layer" — which
  composes with the B6 instrument model (chord-following is a track behavior
  orthogonal to the instrument's sound).
- Doctrine flags for anything imported from the file: it uses `Math.random`
  freely (crackle grains, reverb impulse, clap timing) — every one must reseed
  through mulberry32; its MP3 export loads lamejs from a CDN — out (network
  dependency); `.wav` via OfflineAudioContext is clean and in-doctrine (B4).

### The primitive (B7.0, built — beats-pattern)

Harmony rides the pattern kind (its native fit — explicit steps make a per-step
chord schedule natural):

- Manifest gains `chords: { name: [notes] }` (a voicing dictionary) and
  `progression: [name, …]` (chord names). normalize **stretches** the
  progression across the loop (4 chords over 32 steps → 8 steps each) and
  stores it per-step — the stored manifest stays the explicit grid (B5.2).
- A track gains `chordVoice: 'chord'|'strum'|'block'|'arp'|'root'` (or `true` =
  chord). It ignores its note contour and derives notes from
  `chords[progression[step]]` via `chordVoiceNotes(mode, chord, step)` in the
  kernel (pure, tested): whole chord (feel strums it), one note walking up
  (arp), or the root (basslines). Composes with the B6 feel layer — a
  chord-following guitar + a strum feel = a rhythm guitar tracking the chart.
- `instrument:` now expands on pattern tracks too (the B6.1 loose end), so
  chord voices are authored by instrument name (`acoustic-guitar`, …).
- Determinism preserved; a pattern without `chords`/`progression` is
  byte-identical to before. Exit met: four instruments (strummed acoustic,
  arpeggiated electric, root bass, pad) follow one Am–F–C–G chart; changing
  ONLY the progression line moves the whole band (proven by test + two demos).

### The menu (B7.x — independent, pull by want)

- **Scenes / arrangement** — multiple named patterns in one artifact + a
  section order (verse/chorus). The A/B of the source file.
- **Send / master-bus routing** — shared delay/reverb sends + a master FX chain,
  so reverb isn't duplicated per part's `chain`. A routing model above per-part.
- **Sidechain / trigger-modulation** — one track's hits duck/gate a bus (the
  house pump). The intra-audio analog of the world `bindings` seam.
- **Formant voice** — the file's `vocalchop` (source → two formant bandpass) is
  the B6.3 `formant` voice, proven; folds into B6, not here.
- **Texture bed + filter-sweep gesture** — `crackle` (seeded stochastic grains)
  and `riser`/`downlift` (bandpass cutoff sweep, the filter cousin of the pitch
  `sweep` gesture). B6-adjacent voice/gesture work.
- **`.wav` export** — the file's `renderOffline` (repoint the graph at an
  `OfflineAudioContext`, re-run the voices, restore) is exactly B4's
  export-only render.

### Deliberately out (B7)

- The full grid editor (catalog add/remove, drag-repitch, slots, project file)
  — player affordances, not substrate; the recipe stays the author.
- Chord *theory* helpers (progression generation, voice leading) — the agent's
  job at authoring time; the substrate stores the chosen voicings (B0 doctrine).
- MP3 export / any CDN dependency (unchanged doctrine).

---

## B8 — WAV export: the sound-sample seam (2026-07-09)

Status: B8.0 + B8.1 built. This is B4's export leg (and the B7 menu's
`renderOffline` row) executed — elevated from "player button someday" to the
seam that lets OTHER mojulo things consume a sound.

### Doctrine

- **A "sample" in mojulo is a beats ref.** The recipe stays the only source of
  truth; the WAV is a derived render, regenerated on demand, never stored and
  never imported back (export-only, the .glb posture exactly). If something
  needs a new sound, it mints a recipe, not uploads bytes.
- **One realizer, no drift.** The offline render replays the kernel's OWN
  `createEngine()` against an `OfflineAudioContext` from `node-web-audio-api`
  (a native dep, lazy-imported so create_beats and the player never load it;
  registered in next.config.mjs `serverExternalPackages` per the landmine
  rules). No second synthesis path to diverge from the browser player.
- **Deterministic bytes.** The kernel has no unseeded randomness, so the same
  manifest + options render the same PCM — verified byte-for-byte in tests.
- **MP3 stays out** (unchanged). WAV imports everywhere; the earlier ban's
  substance was the CDN-loaded encoder, but nothing has earned compression yet.

### Shape

```
beats-render.js        renderBeatsPlan (PURE: manifest → absolute-time schedule
                       entries + duration, reusing ambientBarEvents /
                       compositionEvents / patternEvents / cuePlan / noteFeel
                       exactly as the live transport applies them; unit-tested)
                       + renderBeatsOffline (realizer → WAV Buffer)
                       + encodeWavPcm16 (plain-JS 16-bit RIFF, no deps)
                       + MAX_RENDER_SECONDS = 300 (a sample, not an album side)
```

Duration per kind (loops/scores have no intrinsic file length): composition =
its own flattened duration; ambient = `bars` (default one progression cycle);
pattern = `loops` (default 2, so the per-loop evolving feel is audible); sfx =
one `cue` per render (defaults when there is exactly one). All renders append
`tail` seconds of ring-out (default 2).

Three consumption tiers, outermost thinnest:

1. **The seam** — `renderBeatsOffline(manifest, opts)` in beats-render.js:
   what server-side mojulo subsystems (a game build step, a publication cook)
   import directly.
2. **The URL** — `GET /api/sketches/<ref>/beats.wav?bars|loops|cue|tail`:
   regenerates deterministically per request (the model.glb pattern); anything
   page-shaped points an `<audio src>` at it.
3. **The tool** — `export_beats { ref, bars?, loops?, cue?, tail?, write? }`:
   the export_model contract — writes `control/data/exports/<ref>[.cue].wav`
   (or `$MOJULO_EXPORTS_DIR`), returns `{ ok, url, path, bytes, duration_s,
   sample_rate }`. TOOL_INDEX row beside the beats mints.

### Deliberately out (B8)

- Sample import / a samples table (a sample IS a beats ref).
- MP3 or any compressed format (nothing has earned the encoder yet).
- Stems / per-channel export (cheap follow-on if a consumer wants it).
- Loudness normalization / mastering — the master-bus compressor is the sound;
  the file matches the player.
- Embedding WAV bytes into deployed artifacts by default — worlds/games keep
  live kernel synthesis; the seam exists for surfaces that can't run it.
- The player-page "Export WAV" button (browser OfflineAudioContext) — nice
  later, not substrate.

---

## B9 — first-class beats: identity, editing, annotations (2026-07-10)

Status: planned. B0–B8 built the *sound*; B9 builds the *practice* — the
loop a composer or enthusiast actually lives in: listen → mark what's wrong
→ revise → compare → listen again. Today that loop is impossible: beats is
a tenant of the sketch tool, and the tenancy shows exactly where iteration
should happen.

### The problem, precisely

Beats owns its kernel, manifest validation, vocab, render seam, and
world-audio resolver. Everything *composer-facing* is borrowed:

- **Storage/identity** — rows in `sketches` with `sk_` refs; kind lives
  inside `manifest_json`; bucket derived by `classifyBucket` in
  *sketch*-manifest.js.
- **URLs** — `/sketches/<ref>` page, `/api/sketches/<ref>/beats(.wav)`
  routes hanging off the sketch tree; `/maker/beats` is a `SketchGallery`
  with a beats bucket filter.
- **No read tool** — there is no `get_beats`; an agent cannot read a recipe
  back to modify it.
- **No edit path** — `update_sketch` *rejects* beats manifests
  (`validateSketchManifest` demands `viewBox` + `stations`), and its bucket
  gate doesn't accept `'beats'`. The only way to change one note is to
  re-mint the whole artifact under a new ref, orphaning its history.
- **No musical diff** — `diff_sketches` is SVG-geometry diffing; two beats
  refs produce a meaningless picture.
- **No annotation surface** — nothing in the substrate attaches commentary
  to a beats ref (`ops-tags` member kinds exclude sketches; stash items can
  hold an `sk_` ref + body but have no musical anchor and no player
  presence).
- **Shared plumbing** — `export_beats` imports `exportsBaseDir` from
  `tools/sketches.js`.

### Thesis

Sovereignty is a **domain layer, not a table migration**. What makes beats
"its own thing" to a composer is refs that resolve to a *musical* surface:
tools that read/edit/diff/annotate in musical terms, a revision history,
and a studio page where listening and marking happen. None of that requires
moving rows. The sketches table is the substrate's universal recipe store
(worlds, games, views all ride it — "a kind costs a card, not a table"),
and `beatsRef` world resolution, stash sketch-items, and folders all lean
on it. So: **keep storage where it is; build the beats domain on top.**
New mints keep `sk_` refs (refs are opaque; identity comes from kind and
from the surfaces a ref resolves to). Revisit only if a concrete constraint
bites (e.g. SQL-side filtering on bpm/key for a large library) — the domain
layer built here is exactly the facade that would make a later migration
cheap.

### The iteration loop (the point of B9)

```
mint (create_beats)
  → listen at /beats/<ref> (studio: player + grid)
  → mark it: annotations anchored to bar/track/step, dropped at the
    playhead in the studio or via annotate_beats over MCP
  → operator copies the studio's revision prompt into their host agent
  → agent: get_beats (recipe + open annotations) → update_beats
    (validated, note-carrying) → new revision, annotations resolved
  → compare: diff_beats ref@3 ref@4; play any revision (?rev=)
```

The dashboard stays a deliberation surface, not a chat: the studio renders
state (player, grid, revisions, annotations) and offers copy-starter-prompt
affordances; authoring stays with the host agent. Annotation capture from
the player is state-writing, not conversation — same posture as plan mode.

### Shape

**Two new tables** (migrations in db/index.js, repositories beside the
sketch repo):

- `beats_revisions (id, ref, rev INTEGER, manifest_json, note, created_at)`
  — `create_beats` writes rev 1; every `update_beats` appends. The
  `sketches` row always holds the head manifest (world `beatsRef`
  resolution, player, export all keep working unchanged); revisions are
  history, not the live pointer.
- `beats_annotations (id, ref, rev, anchor_json, body_md, author
  ('operator'|'agent'), status ('open'|'resolved'), resolved_rev,
  created_at)` — anchor is a small union:
  `{ scope: 'artifact' } | { scope: 'track', track } |
  { scope: 'time', bar, step?, track?, timeSec? } | { scope: 'cue', cue }`.
  Time anchors are meaningful even for generative ambient because
  performances are seeded — bar N is reproducible.

**Four new MCP tools** (in tools/beats.js, TOOL_INDEX rows beside the
existing three; `update`/`annotate` earn a `forward_context` routing row —
"edit/revise/tweak the tune → update_beats" — because unlike minting,
revision is a user-initiated flow):

- `get_beats { ref, rev? }` → `{ manifest, kind, title, revisions:
  [{rev, note, created_at}], annotations (open first) }`. The
  read-modify-write anchor.
- `update_beats { ref, manifest?, title?, folderRef?, note?,
  resolveAnnotations?: [ids] }` — full-manifest replace through the same
  `validateBeatsManifest`/`normalizeBeatsManifest` gate as create (teaching
  errors), snapshots a revision with `note` as the commit message. No
  patch-op language: the agent reads, edits the JSON, writes — manifests
  are small and the grid representation is exactly what makes "mute bar 2's
  kick" a legible JSON edit (the B5 thesis paying off).
- `annotate_beats { ref, action: add|resolve|list, anchor?, body?, ids? }`
  — the agent-side counterpart of studio marking; `add` defaults
  author='agent'.
- `diff_beats { refA, refB }` (accepting `ref@rev`) → structured *musical*
  diff, plain data + text: tempo/swing/key deltas, tracks/parts/channels
  added/removed, per-track patch/instrument/macro changes, pattern grids
  compared cell-wise ("kick: bar 2 steps 12,14 removed"), progression
  changes. No SVG; the diff is a report, not a picture.

**Guard rails in the sketch tools**: `update_sketch` on a beats-kind ref
returns a teaching refusal pointing at `update_beats` (today it half-works
for title-only edits and hard-fails confusingly on manifests);
`diff_sketches` likewise points at `diff_beats`. `exportsBaseDir` moves to
a small shared module both tool files import.

**Routes — beats' own namespace**, thin handlers over the same emitters:

- `/beats/<ref>` — the **studio page** (new, `control/app/beats/[ref]/`):
  player iframe + revision list (play any rev) + annotation panel + WAV
  export affordance + copy-revision-prompt. `/maker/beats` gallery cards
  link here; `/sketches/<ref>` keeps working for beats kinds (it's the
  generic artifact frame) but the studio is the canonical home.
- `/api/beats/<ref>` (player HTML, `?rev=`), `/api/beats/<ref>.wav`,
  `/api/beats/<ref>/annotations` (GET; POST from the studio/player —
  localhost-only like everything else). Existing
  `/api/sketches/<ref>/beats(.wav)` stay as aliases; nothing breaks.

**Player growth** (folds in the remaining B5.2 grid work): render the grid
with playhead sweep; annotation markers on the timeline/grid at their
anchors; an "annotate here" affordance that captures the current
bar/step/track and POSTs. Macro sliders stay performance-only — a macro
position worth keeping is submitted as a *proposed annotation* ("suggest
tone 0.4 on stab"), which the agent applies via `update_beats`. The recipe
remains the only author.

### Phases

**B9.0 — read + edit.** `get_beats`, `update_beats`, `beats_revisions`
table + repo, revision snapshot on create/update, `?rev=` on player + .wav
routes, sketch-tool guard rails, shared `exportsBaseDir`. Exit: an agent
minted-then-revised a pattern over MCP in two calls ("mute bar 2's kick"),
both revisions play at their URLs, `update_sketch` on the ref teaches.

**B9.1 — annotations.** `beats_annotations` table + repo, `annotate_beats`,
annotations in `get_beats`, `/api/beats/<ref>/annotations` GET/POST. Exit:
agent adds a track-scoped note, resolves it via `update_beats
resolveAnnotations`, list round-trips.

**B9.2 — the studio.** `/beats/<ref>` page (player + revisions +
annotations + export + copy-revision-prompt), player grid/playhead +
annotate-here + markers, `/maker/beats` links through. Exit: the full loop
runs without touching an `sk_` URL: listen → mark at playhead → copy
prompt → agent revises → resolved marker on the new revision.

**B9.3 — musical diff.** `diff_beats` with `ref@rev`, wired into the studio
revision list ("what changed"). Exit: diffing the B9.0 exit's two revisions
reports exactly the kick-mask change and nothing else.

**B9.4 — paperwork.** CLAUDE.md architecture-map entry for beats (it has
none today), context.js routing rows, vocab card cross-links
("revise with update_beats"), STATUS.md.

### Deliberately out (B9)

- **Moving storage.** Rows stay in `sketches`; the domain layer is the
  sovereignty. Revisit trigger: needing SQL-side musical metadata queries.
- **A DAW / grid editor in the browser** (unchanged since B0). The studio
  marks and performs; the agent authors.
- **Direct macro-writes from the player** — propose-as-annotation instead;
  keeps "recipe is the only author" intact.
- **Patch-op edit language** in `update_beats` — full-manifest replace is
  enough while manifests are grid-legible; revisit if manifests outgrow it.
- **Annotation threads / multi-author identity** — single-user substrate;
  `author` distinguishes operator vs agent, nothing more.
- **Embedding beats artifacts in semantic search** — sketches are
  deliberately off the index; a library-search story is its own decision.
- **MIDI or audio import** (unchanged doctrine — export-only).

---

## B10 — the foley spike: naturalistic SFX (2026-07-13)

Status: spiked + folded (working tree). The B0 gestures were validated on
chiptune (Buster Lab); this spike asked how far they stretch toward
*naturalistic* foley — footsteps on materials, doors, water, glass, fire,
cloth — and added the minimum that closes the gap.

### Method

Two artifacts, A/B'd through the render seam (no ears needed — per-frame RMS
envelope + zero-crossing rate read the character):

- `foley-lab-1` — nine everyday cues built best-effort from the four
  existing gestures.
- `foley-lab-2` — the same targets rebuilt on the spike's additions.

### What Lab I proved (the gaps, measured)

- **Granular textures don't exist.** Gravel and fire hand-authored as
  stacked bursts merge into one white hiss (ZCR pinned at 8–11 kHz, no
  grain separation, no body) — and the "crackle" is byte-identical
  choreography every play. flutter is periodic *tones*, not noise grains.
- **No modal ring.** Glass faked as a flat sweep (from == to) reads as a
  beep with a linear fade, dead at 200 ms — no inharmonic partials, no
  fast-dying brights over a singing fundamental.
- **No stick-slip.** A 13 Hz sawtooth flutter is a perfectly periodic buzz;
  a creak is *irregular* in both timing and pitch.
- **Noise has no material body.** burst's only filter is a highpass —
  everything noise-shaped is hiss.

### What was added (all plan-time, all seeded)

The design move: every addition is a **pure `gesturePlan` expansion to
existing op kinds**, so the realizer is almost untouched and everything is
unit-testable on the pure side.

- **`grain`** — a seeded stochastic noise-grain train: `{ grains, over,
  decay: s|[min,max], band: {lo,hi}, vol, spread, seed }` → lowers to
  `noise` ops via mulberry32(hashSeed(seed, grains)). Gravel, crackle,
  rustle, rain, debris. Same seed = the same grit (determinism holds:
  re-render is byte-identical).
- **`ring`** — a modal material strike: `{ note|hz, material:
  glass|metal|wood | partials: [{ratio,gain,decay}], decay, vol }` →
  lowers to flat `thump` ops (from == to), one per partial — **zero
  realizer change**; the material presets carry inharmonic ratios with
  brights decaying first. The computed cousin of the B6.2 modal voice.
- **`burst.lowpass`** (+ grain's `band.hi`) — the one realizer change
  (~3 lines): noise ops chain highpass → lowpass, giving noise a body.
- **`flutter.jitter`** (0–1, + `seed`) — fold, don't fork: seeded timing
  (±40% of period) and pitch (±80 cents) wobble per retrigger. jitter 0 is
  bit-identical to the pre-spike path; ~0.8 at rateHz 13 is a door creak.

Validation teaches per gesture (GESTURES + material/partials/band/jitter
checks in beats-manifest.js); the sfx vocab card documents all six gestures
plus layering recipes (footstep = thump + grain scuff; slam = thump +
lowpassed burst + latch ring). 108 tests green (grain determinism/sorting/
band, ring lowering + custom partials, jitter seeding + null path).

### A/B (25 ms frames, RMS dB + ZCR)

- gravel: merged hiss → thump body then separated grit, ZCR evolving
  2.8→5.3 kHz. glass: linear fade → exponential modal decay, fundamental
  singing past 500 ms. creak: flat periodic → −33..−76 dB frame-to-frame
  stick-slip gapping with pitch wander. fire: continuous hiss → sparse
  irregular pops over a low band-limited bed.

Addendum (same day, operator call): **foley-lab-2 is a standing reference
pack, not scratch.** Each cue carries a cue-scoped annotation (usage seams +
re-voicing recipes — the annotations are standing metadata, deliberately left
open); foley-lab-1 carries an artifact-scope "historical baseline, don't use"
mark. Discovery path: the sfx vocab card grew a reference-pack table (cue →
use → seam) and the audio-beats routing card grew foley recognizer phrases,
so intent → `semantic_search` → card → `get_beats { ref: 'foley-lab-2' }` →
copy the cue into the world/game's own mint. Beats artifacts stay off the
semantic index (B9 doctrine) — the CARD carries the pointer.

### Deliberately out (B10)

- **A `creak` gesture** — flutter + jitter covers it; a dedicated gesture
  must earn a genuinely new shape, not a preset.
- **Pitched/wavetable grains** (grain stays noise-only; pitched scatter is
  flutter's territory).
- **Velocity/round-robin variation per trigger** — world SFX fire cues
  deterministically; per-hit variation should come from the *caller* seam
  (e.g. gait phase → seed offset) if a world ever wants it, not from
  unseeded dice.
- **Convolution/spatial foley (room, distance)** — the world's atmosphere
  model owns space; cues stay dry.

## B11 — the armory pack: weapon foley (2026-07-14)

Status: minted + folded (working tree). A second themed reference pack beside
`foley-forest`, on the same spike-to-pack convention B10 established — but
this one added **zero kernel/gesture surface**: the B10 six gestures already
reach the whole weapon domain, so B11 is a pure vocabulary build (recipes +
annotations + card/routing/plan doctrine).

### The pack — ref `armory`, 14 cues, three groups

- **Ballistic:** `gunshot`, `shot-suppressed`, `shotgun-blast`, `dry-fire`.
- **Handling (lock and load):** `rack-slide`, `bolt-action`, `pump-shotgun`
  (the "chk-chk"), `mag-insert`, `mag-eject`, `shell-drop`, `safety-click`.
- **Energy (sci-fi/fantasy):** `laser-pew`, `charge-beam`, `plasma-bolt`,
  `overheat-vent`.

Each cue carries a cue-scoped annotation (usage seam + re-voicing recipe),
same standing-metadata discipline as `foley-lab-2` / `foley-forest`; the sfx
vocab card grew an `armory` reference-pack table and the audio-beats routing
card grew weapon recognizer phrases. Off the semantic index (B9 doctrine) —
the card carries the pointer.

### Gesture mapping (why no new gesture earned its place)

- `burst` (highpass→lowpass body) + `thump` = the report + punch; the
  gunshot/shotgun mass is `lowpass` + `decay`, not a new op.
- a highpassed `burst` = every mechanical clack — slide, bolt, mag clunk,
  casing ping, selector detent. Two clacks at offset `at`s = the back/forward
  two-stroke of a rack/bolt. (See the metal-clack correction below — the clack
  is NOT `ring`.)
- `grain` = the action grit / friction draw / steam vent.
- `sweep` (down) = blaster/plasma bolt; `flutter` (jittered tiers) = the
  charge wind-up, released by a `sweep`+`burst` discharge.

### Method — objective A/B, no ears (as B10)

Every cue rendered through the render seam and read by per-25ms-frame RMS(dB)
+ zero-crossing rate. Confirmed the shapes: gunshot a −17.7dB transient dead
in ~100ms; shotgun fatter/lower (7 frames, 140Hz body) vs the rifle crack;
bolt-action's two clacks gapped by a low-ZCR grain draw; shell-drop three
descending metal pings; charge-beam 44 frames of rising-ZCR flutter (160→
1000Hz as tiers climb) then a −16.6dB release sweep; overheat-vent 20 frames
of high-ZCR steam (3.8–5.4kHz) thinning out. All 14 valid + audible.

### Doctrine (carried on the cues + card)

- **One cue = one shot.** Full-auto fire is the caller retriggering `gunshot`
  on a cadence timer with a varied grain `seed` — never an "auto" cue (the
  same call the forest pack makes for birdsong).
- **A reload is a cue sequence,** not one cue: `mag-eject` → `mag-insert` →
  `rack-slide`.

### Correction — metal is noise, not `ring` (operator's ears, rev 3)

First voicing leaned on `ring material:'metal'` for the slide/bolt/casing
clacks and voiced them low (A3–E4) for "heaviness." The operator heard it
straight: *"nothing sounds like metal in the rack — it all sounds like bongo
taps."* Measured (spectral centroid over the 12ms attack, node render):

- `ring material:'metal'` at E4 → **509Hz centroid = bongo.** The ring was
  *dragging brightness down*. A pure sine stack can't be metallic — even at A6
  it only reaches ~1900Hz.
- A short highpassed `burst` (≈4kHz hp) alone → **~7.5kHz = metal.** The bright
  noise transient IS the metallic character.

Fix (recipe-only, no kernel change): all mechanical cues rebuilt
**noise-forward** — the clack is a highpassed `burst` that leads, `ring` is
demoted to a quiet HIGH shimmer (≥A6, vol ~0.15), and the body `thump` is quiet
and a hair late so the bright contact leads the attack. Result: mechanical
onsets moved 509Hz → **2.8–4.0kHz** (metal). rev 3 rebuilt rack-slide /
bolt-action / pump-shotgun / mag-insert / mag-eject / shell-drop / dry-fire /
safety-click / shot-suppressed; card carries the "metal is noise" recipe note.

**Kernel finding (deferred):** the `ring material:'metal'` preset (4 sine
partials, ratios ≤ 8.93×) does not earn its name at usable pitches — it's a
tuned-mallet timbre, fine for a high glass/wood tink but not for metal. A
proper fix (denser + higher inharmonic partials, or an intrinsic noise
excitation in the `ring` op) is a kernel spike affecting glass/wood too; left
for later since the recipe-level noise-forward path fully covers armory.

### Deliberately out (B11)

- **A continuous held beam / weapon hum** — the one real gap surfaced. `sweep`
  is a one-shot ramp and `flutter` is retriggered grains, so neither sustains
  smoothly; a held beam belongs to a looped `beats-ambient` bed, not a cue.
  A dedicated sustained-tone sfx gesture (osc + tremolo/vibrato, held for a
  `dur`) would be the shape to earn — deferred until a world actually needs
  a held beam a soundtrack loop can't cover.
- **Explosions/grenades** — a big lowpassed `burst`+`thump` reaches a small
  one, but a proper blast wants a longer body + debris tail; left for a
  demolition-themed pass if asked.
- **Spatial/distance modeling (a shot echoing down a canyon)** — the world's
  atmosphere model owns space; cues stay dry (B10 call, unchanged).
