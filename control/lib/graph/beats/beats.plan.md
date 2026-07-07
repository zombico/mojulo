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
