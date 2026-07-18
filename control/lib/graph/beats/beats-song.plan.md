# beats-song.plan.md — the singing layer (the Max Rebo Band)

**Status:** LEAVING SPIKE, 2026-07-15. The full pipeline was proven end-to-end —
English lyrics → katakana → aligned score → pitch/time/formant DSP → sung WAV —
across **10 throwaway scripts** under `control/scripts/`.

**Engine decision (taken 2026-07-15):** ship the **parametric formant synth**
(the locked-voice fork) as the L3 voice engine, but **build the engine-independent
layer first** to de-risk the pivot. Rationale: the fork's "cost" (synthetic vowels,
cruder consonants, retro-vocaloid timbre) IS the stated aesthetic — a deliberately
synthetic vocaloid, not human realism — so it aligns with the goal rather than
fighting it; it's the only method that reaches "one singer by construction"; and it
fits beats doctrine (deterministic, measurable, byte-identical, no Kokoro-drift
dependency for the sung tone). The baked-register vocoder stays a **replaceable L3
rung** behind the same seam — if parametric disappoints, it swaps in with L4–L6
untouched. See "The parametric fork" below.

**Progress:**
- **L5 authoring — LANDED as a real module.** `beats-song-lyrics.js` (+ 16 tests):
  `transliterate` / `applyReplacers` / `elongateKata` / `authorSyllable` /
  `authorScore`. Pure text transforms, no audio/IO/ONNX — the recipe half. Extracted
  verbatim-in-behaviour from the sing spikes. The override/replacer tables are data
  so a song recipe can extend them.
- **Shared DSP — LANDED.** `beats-song-dsp.js` (+ 20 tests): `noteHz`, `mulberry32`,
  `noiseSrc`, `readWavMono`, `trim`, `resampleTo` (the squisher), `detectF0`, the
  biquad family (`bandpass`/`highpass`/`biquad`/`lowpass1`/`preEmph`), `normalizePeak`.
  Engine-independent primitives both L3 engines build on.
- **Parametric engine (the locked-voice fork) — DIRECTION CONFIRMED by ear.**
  `beats-song-voice-parametric.js` (+ 8 tests): Klatt-style glottal source
  (`glottalSource`, Rosenberg pulse + delayed vibrato) → cascaded time-varying
  formant resonators (`resonatorTV`) at fixed female F1/F2/F3 vowel targets
  (`FEMALE_VOWEL_FORMANTS`); `renderParametricNote` / `renderParametricSong` consume
  the L5 `authorScore` output directly. NO Kokoro — one vocal tract by construction,
  deterministic, byte-identical. Operator confirmed the synthetic timbre is
  on-aesthetic; the ask is ENUNCIATION clarity.
- **Enunciation layer — LANDED.** `beats-song-phonemes.js` (+ 8 tests):
  `romanizeKata` decomposes the katakana into a mora sequence `{cons, vowel, coda,
  geminate}` (the 50-on grid + irregular sh/ch/ts/f rows, small-vowel merge, yōon,
  moraic-nasal coda, sokuon). The parametric engine now articulates a consonant at
  EVERY mora by class — fricatives as spectrally-shaped noise, stops as a closure
  gap + burst, nasals/codas as a low murmur, glides as a formant locus morphing into
  the vowel (`CONSONANTS` table = the tunable enunciation knob) — with formant/gain
  steps smoothed into glides. "star" reads `s-t-aaaa`, "twin" `t-wi-n`, not vowels
  with a hiss. Rendered v2 for the operator's ears.
- **Enunciation tuning round 1 (legibility).** Operator: consonants too weak. A
  measured diagnostic proved raw amplitude was a DEAD lever — a global
  `normalizePeak` divided the consonant boost right back out (top-transient RMS
  0.857→0.846 across gain 2.5→6; the operator couldn't hear a difference). Real fix,
  three structural changes: (1) **decoupled mix** — normalize the voiced VOWEL body
  to a fixed 0.62, add consonants at absolute level, soft-limit with tanh (so a loud
  burst rounds off instead of ducking the vowel; `consonantGain` is finally a real
  ratio control); (2) **vowel-onset duck** — the vowel ramps up over ~35ms after a
  consonant so it doesn't mask it; (3) **aspiration + longer consonants** — voiceless
  stops get a `tʰ`/`kʰ` puff, fricatives lengthened (brief stops were the hardest to
  hear). NOTE: automated consonant/vowel-ratio metrics measure vowel peaks, not the
  brief consonants — this tuning is ear-only. v3 rendered for A/B against v2.
- **Enunciation tuning round 2 (the R tap).** Operator: the ラ行 /r/ "doesn't get
  pronounced at all." Diagnosed as TWO stacked causes, both fixed: (1) /r/ was modelled
  as a smooth approximant glide (formant locus → vowel) with a FLAT amplitude — but a
  Japanese /r/ is an alveolar TAP whose defining cue is a brief near-closure. Added a
  `dip` amplitude V-notch through the glide hold (r=0.28 deep, w/y=0.72 mild) so the tap
  reads as a constriction, not a vowel slur. (2) The deeper cause: a voiced onset
  consonant lives in the glottal tract, so — unlike a fricative/stop, which is spliced on
  top and escapes the envelope — it rides UNDER the per-note attack ramp (~30ms) and gets
  masked. Fricatives/stops read fine for exactly this reason; voiced glides/nasals don't.
  Fix: snap the attack short (≤6ms) when a note LEADS with a glide/nasal, so the consonant
  is articulated at onset instead of ramped away. Measured: the R-articulation window now
  carries ~0.56 of the vowel energy (was ~0.39). A/B rendered (ラリルレロ + orite/nari/keri)
  for the operator's ears. Ear-only from here.
- **Next:** continue ear tuning if needed, then the L6 `beats-song` sovereign kind +
  the voice-worker render seam (mirrors voice-worker.plan.md V1). Baked-vocoder stays
  a swappable L3 rung.

## The enunciation principle — "emphasis by decoupling" (LOCKED)

The controlling idea, proven by the M fix (operator-approved). A single peak-normalize
divides the whole note by its loudest sample, so boosting a consonant just ducks the
vowels — amplitude was a dead lever. The fix:

1. **Fix the vowel body first** — `normalizePeak(voiced, 0.62)` before any consonant
   energy exists.
2. **Place every consonant so it escapes that normalize:**
   - **Unvoiced** (fricative noise, stop burst + aspiration) → *added on top* as
     absolute-level noise events (`amp × emph`).
   - **Voiced** (nasal murmur, glide transition, coda) → the region is *boosted
     after* the normalize (`voicedBoosts`, `region × emph`).
3. **One knob per consonant** — a per-consonant `emph` scalar (`CONSONANTS[x].emph`,
   overridable live via `opts.emphasis = { m: 3, ... }`), tuned by ear.
4. **Soft-limit only the overshoot** (knee 0.72) so boosts never muddy the vowel.

Calibration pass done against M=2.0: weaker cue → higher emph (sibilants s/sh lowest
~1.2; non-sibilant fricatives f/h, voiced stops g/d/b, nasals, glides highest ~1.7–2.0).

## The choir — de-locking the locked voice (from the full GITS score)

The "Making of a Cyborg" score is an SSAA divisi women's choir + sleigh bells, homophonic
(all parts, one lyric/rhythm, block harmony), G minor ♩=42, ties + a swell hairpin. The
lesson: the whole effort LOCKED one voice by construction, but a CHOIR is many
slightly-DIFFERENT voices — so a section is rendered by DE-LOCKING that one voice a little
per singer. Engine gained two levers on `renderParametricNote` / `renderParametricSong`:
- `detuneCents` — re-pitch the whole note (chorus/beating between unison parts).
- `formantScale` — re-size the vocal tract (bigger = lower formants → alto vs soprano).
Plus per-voice timing offset + vibrato phase, mixed in the harness. First choir rendered
(`scripts/render-cyborg-choir.mjs`, 4 parts, open fifths+octaves). Next levers the score
implies: intra-note pitch motion (the "ma-e-ba" melisma), the sleigh-bell shimmer as a
beats backing track (song × beats mix), and per-note seeded humanize (timing/pitch drift).

## The goal (stated, so we build toward it)

Mojulo's beats primitive is a synthesized-never-sampled band. It has no singer.
The goal is a **vocaloid** singer — deliberately synthetic, NOT a human
impersonation — living natively inside that band. The name puns on Jabba's
palace's **Max Rebo Band**: a scrappy ensemble of odd synthetic performers.

- NOT climbing toward human realism. The synthetic quality is the aesthetic.
- A singer is another **performer on the beats transport**; the vocal part is a
  beats channel; the band can have several singers.
- The vocal layer is a **shelf of characterful synthetic voices**, parallel to
  the patch/instrument shelf (`audio-patches.js` / `instruments.js`).

Doctrine (beats.plan.md): recipes not renders; synthesized never sampled; seeded
determinism; audio is presentation, never simulation.

## The ladder (worked backwards)

`[have]` in-tree · `[built]` proven in the spikes · `[wall]` hit a hard limit · `[missing]`

- **L6 — Song (the recipe).** Sovereign kind (`beats-song`) on the `sketches`
  table like beats/voice. `[missing]`
- **L5 — Vocal score + authoring.** Score at the **English-syllable level**:
  `[syllable, note, beats]`. `[have]` — landed as `beats-song-lyrics.js`
  (`authorScore` et al., 16 tests). The reuse insight holds: a song is a
  beats-composition part whose events carry syllables.
- **L4 — Performance/expression.** Vibrato (delayed-onset LFO) + mid-note swell
  (belt/power arc) built and measured. Portamento/legato/breaths `[missing]`.
  Mirrors beats' `noteFeel`. `[built]` (partial)
- **L3 — The note engine.** `(syllable, pitch, duration, expression) → audio`.
  Multiple engines built (the shelf, below). `[built]`
- **L2 — Phonation source (Kokoro seam).** `[have]` speak.mjs (EN, float32) /
  speak.py (JA via misaki, int16), 24 kHz. **Hard constraint confirmed:** Kokoro
  is a closed box — no internal pitch/formant params, and it **will not insert
  pauses** on demand (see the wall). All L3 work is analysis-resynthesis on output.
- **L1 — Render seam + timeline.** `[have]` OfflineAudioContext +
  `encodeWavPcm16`; `noteHz`. All spikes render beside the sealed kernel.

## L5 — the authoring layer (built, and genuinely good)

This is the part that worked cleanly and is worth keeping conceptually. Pipeline:
**lyrics → transliterate → replacers → align → elongate/squish → note engine.**

- **Katakana-English transliteration** (the Hatsune-Miku technique). English is
  routed through the Japanese voice as katakana ("twinkle"→トゥインカ). Why: the
  Japanese path is the ONLY one whose vowels elongate cleanly (see multilingual
  finding). The resulting "Engrish" accent is ON-aesthetic for a vocaloid.
  Implemented as an OVERRIDE table + rough rule fallback (real auto EN→katakana
  is a bigger NLP job; table+rules is the practical shape).
- **REPLACERS** — ordered post-transliteration polish (loanword normalization),
  each `[from(str|regex), to]`. Tuned by ear over several rounds:
  `v→ブ`; `-kle/-tle → single カ/タ` ("twing-ka", drops a mora); final voiceless
  stop → sokuon (`what` ワット→ワッ); `how→ハオ`, `up→アブ`. Two jobs at once:
  crisper diction AND fewer moras → tighter timing. Honest floor: Japanese
  phonotactics can't do bare consonant clusters, so leading `ス` in star/sky
  can't be removed (Kokoro devoices it, softening only).
- **Nucleus-aware elongation** — sustain the syllable's OPEN NUCLEUS vowel by
  repeating its vowel kana (NOT the chōonpu ー, which Kokoro relaxes toward a
  schwa "-yu" tail). Diphthongs hold the nucleus and keep the glide last:
  `ハイ`→`ハアアアイ` ("haaai", not "hayu"). Fixed the "stayu/hayu/skayu" artifact.
- **The squisher** — because the vocoder/PSOLA take only the modulator's
  ENVELOPE (pitch is the carrier's / set by re-spacing), a syllable render can be
  time-scaled freely with **zero chipmunk**. Multi-mora syllables squish to fit
  short notes; held notes elongate; every note is force-fit to its exact beat.
  This is why transliteration's mora-expansion (bells→be-ru-zu) doesn't wreck
  timing. `resampleTo(x, targetLen)` is the whole trick.

## Multilingual finding (decisive)

Probed empirically. **Vowel elongation by letter/kana repetition:**
- **English fails** — repeating letters caps voiced length ~0.6 s and *corrupts
  the vowel* (way→waaay shifts the vowel quality; centroid 2198→4250 Hz).
  English orthography breaks it.
- **Japanese works** — か + N あ ≈ `0.26 + 0.082·N` seconds, near-linear, **no
  ceiling through 2.2 s** (24 あ). Native long vowels via misaki.

⟹ The Japanese voice is the primary singer for ALL languages, reached through
katakana-English. This is the single most important architectural finding.

## L3 — the voice engines (the shelf, and the consistency arc)

Each engine is `(syllable audio, note pitch, duration) → sung note`. Built in
order; each fixed a flaw the last exposed.

| engine | file | idea | verdict |
|---|---|---|---|
| **vocoder / saw** | spike-sing.mjs | saw carrier × syllable formant envelope | consistent register (one saw) but buzzy/robotic; brightness 0.28→0.10 warmed |
| **PSOLA natural** | spike-sing-natural.mjs | keep her real voice, re-pitch by TD-PSOLA (formants preserved) | natural timbre BUT 42 separate renders = "turntable cacophony" (register wander CV **0.241**) |
| **baked register** | spike-sing-baked.mjs | ONE sustained あ = the carrier, re-pitched per note; syllables supply only formants | register wander CV **0.113** (half). Fixed a real carrier bug (grain-cycling broke phase → notes fell to wrong octaves). Best so far. |
| **inventory** | spike-sing-inventory.mjs | bake the FORMANTS too — one utterance of all syllables, segment it | **FAILED**: Kokoro won't pause (≤60 ms even on 。), so a multi-syllable utterance can't be segmented. Approach is unbuildable on this TTS. |

Expression (L4) rides on top of any engine: delayed-onset **vibrato** (pitch LFO,
blooms after ~0.35 s straight tone) and mid-note **swell** (crescendo to ~65%,
the belt/power arc) — both built and measured in spike-carol.mjs.

## The consistency wall (the honest blocker)

Goal: one singer, not "a man, a woman, a child at different times."

- Baking the **carrier** (pitch + glottal source) to one あ fixed pitch/register
  consistency (CV 0.241→0.113) and a nasty octave-dropping bug.
- But the **word formants** still come from per-syllable Kokoro renders, and
  Kokoro's formant scale drifts call-to-call. The two ways to bake the formants
  both dead-end on this TTS:
  1. One-utterance-then-segment → **Kokoro won't pause** (measured ≤60 ms), so no
     segmentation.
  2. Per-syllable formant-scale normalization → the scale cue is confounded with
     phonetic content (a bright vowel *should* be bright); normalizing erases the
     vowels.
- **Meta-limit:** this quality is subjective and holistic; it can't be tuned
  blind by measurement. It needs the operator's ears in a tight loop, or a method
  that's consistent *by construction*.

## The parametric fork (the path to a locked voice)

The only method that **guarantees** a single voice is to stop sampling Kokoro for
the sung tone and use **parametric formant synthesis** (Klatt-style): fixed
`F1/F2/F3` targets per vowel = one vocal tract by construction, exciting the baked
glottal carrier. Set the values female/high explicitly. Consistent, verifiable by
measurement.

- **Gain:** impossible to sound like different people; register is a parameter.
- **Cost:** a real pivot — vowels become synthetic formant tones (retro-vocaloid,
  very Max Rebo), consonants (t/w/k/s) get cruder, and Kokoro's clean articulation
  is lost for sung parts. The enunciation we polished softens.

Decision deferred deliberately (better than another blind build). When taken:
keep the entire L5 authoring layer (translit/replacers/elongation/squish) and the
baked carrier — only the formant SOURCE changes from "Kokoro samples" to "formant
targets."

## The spike inventory (10 scripts, all throwaway)

pitch/scale: `spike-kokoro-solfege.mjs`, `spike-kokoro-do-re-mi.mjs` ·
vocoder proof: `spike-kokoro-vocoder.mjs`, `spike-vocoder-word.mjs` (words +
noise-carrier sibilance + clarity bypass) · full songs: `spike-carol.mjs`
(Jingle Bells, articulation split + vibrato + swell), `spike-carol-elong.mjs`
(Kaeru no Uta, JA elongation) · katakana-English: `spike-sing.mjs` (Twinkle,
translit + replacers + squisher) · voice shelf: `spike-sing-natural.mjs` (PSOLA),
`spike-sing-baked.mjs` (baked register), `spike-sing-inventory.mjs` (failed
formant-bake). All: outside the sealed kernel, reuse `encodeWavPcm16` +
OfflineAudioContext, seeded (mulberry32), read Kokoro WAVs from `~/mojulo-voicegen`.

## When this leaves spike

- Decide the voice engine: **parametric formant synth** (locked voice, pivot) vs.
  **baked-register vocoder** (Kokoro formants, accept some drift).
- L6 `beats-song` sovereign kind; L5 score as a beats-composition part + lyric
  line; worker render; mix under a beats backing track.
- Doctrine watch-list: no media bytes inside `buildBeatsKernel` (vocal synth
  lives beside it or as an explicit `voice:'buffer'` source — deliberate);
  recipes not renders; seeded dice only; byte-identical determinism.
- L2 stays a **replaceable capability rung** (voice-worker "Codex rung" pattern):
  a real singing-voice model swaps in under L3–L6 untouched, ceiling rises free.
```

## L6 build plan — singing as a beats INSTRUMENT (not a sovereign kind)

**Status:** LEFT SPIKE — **S0 landed** (a `patch: 'voice'` composition part sings through
`renderBeatsOffline`; see the S0 entry under Slices). The engine question is decided
(parametric, operator-approved by ear), every layer is built and tested (`beats-song-lyrics.js`
+ `beats-song-dsp.js` + `beats-song-phonemes.js` + `beats-song-voice-parametric.js`, 52 tests
+ the S0 render wiring), and the whole pipeline is proven end-to-end on THREE real songs — Twinkle
(katakana-English), Row Your Boat, and Making-of-a-Cyborg (native JA, Hooktheory-imported
melody sung as a 4-part de-locked choir). This section supersedes the old "When this
leaves spike" bullets.

### The framing decision: a voice is an instrument, a song is a composition

Reconsidered (operator pushed back on a sovereign `beats-song` kind, rightly): **a singing
voice is just another instrument, and a song is a `beats-composition` whose voice part's
events carry syllables.** This is not a new sovereign kind. Reasons it's the right call:
- Beats already has a **voice × patch × color × feel** instrument shelf (B6). A singing
  timbre plugs into that shelf; it does not need a parallel universe.
- The plan already said it — "a song is a beats-composition part whose events carry
  syllables." The only genuinely new *data* is **lyrics as a field on events** — an
  additive extension to the beats manifest, not grounds for a new kind.
- The kernel invariant already RESERVED this: "no media bytes inside `buildBeatsKernel`
  — vocal synth lives beside it as a `voice:'buffer'` source, deliberate." The singing
  engine is meant to be a render-time emitter beside the kernel, exactly like a patch.
- Folding in reuses beats WHOLESALE: manifest, offline render (`renderBeatsOffline`),
  revisions, `/beats/<ref>` studio, `create/update/diff/export_beats`, MIDI export, the
  worlds `audio` channel. And "mix under a beats backing track" DISSOLVES — the backing
  is just other parts (piano, bells) in the same composition.

`voice-register` (the spoken-voice recipe) stays correctly sovereign — but that's a
different thing: a reusable recipe for HOW a voice sounds, not a composition. Singing is a
composition → an instrument, not a peer of `voice-register`. No conflict.

### The decisive architectural shift (why this is self-contained)

The parametric fork **removed the Kokoro dependency for the sung tone** — a singing part is
pure in-process synthesis. So a singing `beats-composition` renders OFFLINE exactly like
any beats (`renderBeatsOffline`); the manifest is the artifact, the WAV is a derived render
regenerated per request via the existing `/beats/<ref>.wav` route. No external voice
worker, no `~/mojulo-voicegen`, no render handoff. The voice-worker seam (Kokoro) stays a
SEPARATE capability for *spoken* voice; singing needs nothing. Bank this simplification.

### What a "song" is, concretely

A `beats-composition` (existing kind) with one or more **voice parts**:
```
{ kind: 'beats-composition', title, bpm, key?,
  parts: [
    { name: 'lead', patch: 'voice',              // the singing instrument on the shelf
      voice: { formants?, formantScale?, register?, ensemble? },  // patch config
      lyrics: [syllable, ...],                    // 1:1 with this part's non-rest events
      emphasis?: { m: 2.0, ... },                 // per-consonant knobs (default table)
      events: [ [time, note, dur, vel], ... ] },  // beats events, unchanged
    { name: 'bells', patch: 'sleighBell', ... },  // backing = just another part
  ] }
```
- `patch: 'voice'` selects the parametric singing emitter.
- `lyrics` aligns 1:1 to the part's non-rest events (warn + pad/truncate on mismatch,
  never crash). Authoring text→syllables is a preprocessing helper (below).
- `voice.ensemble: { voices: [{ detuneCents, timeMs, formantScale, vib }] }` = the CHOIR:
  the render seam renders N de-locked copies of THIS part and mixes them. Omit = solo.
- Backing tracks, harmony parts = ordinary beats parts. Nothing special.

### The work (small — mostly wiring, not new surface)

1. **`syllable`/`lyrics` on beats events** — additive in `beats-manifest.js`
   (`normalizeBeatsManifest`). A part gains optional `lyrics` + `voice`/`emphasis`;
   events are unchanged. Zero impact on non-voice parts.
2. **Register the singing emitter** — the parametric engine
   (`beats-song-voice-parametric.js`) as a `voice` patch in the instrument shelf, invoked
   by the render seam (`beats-render.js` / player) when a part is `patch:'voice'`. The
   kernel stays media-free (it schedules events); synthesis happens at render, beside it —
   the reserved `voice:'buffer'` source. A voice part's events → mixed audio buffer.
3. **The L5 authoring helper** — `authorLyrics(text | syllables, opts) → syllable list`
   (translit/replacers/elongation already built in `beats-song-lyrics.js` +
   `beats-song-phonemes.js`). Produces the `lyrics` array a voice part needs.
4. **Choir in the emitter** — fold `render-cyborg-verse-choir.mjs`'s de-locking into the
   voice emitter, driven by `voice.ensemble`. Solo is `ensemble` absent.
5. **Melody import** — `beats-song-melody.js`: `parseHooktheory` (from
   `render-cyborg-melody.mjs`) + `parseMidi` → beats events. A SHARED beats importer
   (useful for any composition, not just voice), so it lands in the beats melody path.
6. **forward_context framing** — a `sing`/`song` FORM in `get_creative_toolset` that
   routes to `create_beats` with a voice part. Framing WITHOUT a new kind, new bucket, new
   studio, new tools, or new `BODY_CEILING` pressure. Add voice presets / choir templates
   / the emphasis knobs to the existing `beats-instruments` vocab.

Explicitly NOT built: `beats-song-manifest.js`, `beats-song-render.js`, a `beats-song`
table bucket, `create_beats_song` tools, a `/songs/<ref>` studio, `/api/songs` routes.
All of that is beats' already.

### Slices

- **S0 — a voice part sings** (the real de-spiking) — **LANDED.** `patch: 'voice'` on a
  `beats-composition` part now sings through the offline render path.
  - `beats-manifest.js`: `VOICE_PATCH` + `checkVoicePart` — a voice part bypasses the
    synth-patch whitelist and instead validates optional `lyrics` (string[]), `voice`
    ({ formantScale, detuneCents, register, ensemble }), and `emphasis` (per-consonant
    numbers). Additive; non-voice parts untouched, unknown non-voice patches still rejected.
  - `beats-render.js`: `renderBeatsPlan` splits voice parts from instrument parts (instruments
    still go through `kernel.compositionEvents` unchanged), and `voiceEntriesInto` lowers each
    voice event to a `sing` plan entry on the beats grid (timeToSeconds + swing parity), aligning
    `lyrics` 1:1 with events in DECLARED order (padded with "la" / truncated on mismatch → a
    `meta.warnings` note, never a crash). `renderBeatsOffline` realizes a `sing` entry by
    authoring the syllable (`authorSyllable`) and synthesizing it at the CONTEXT rate
    (`renderParametricNote({ sr: sampleRate, ... })` — no resample), spliced in as a buffer
    source into the part's chain — the reserved `voice:'buffer'` seam beside the kernel.
  - Tests: `beats-song-render.test.js` (8) — validation accept/reject, sing-entry alignment +
    padding, mixed voice+instrument unchanged, deterministic finite/audible offline render.
    Full beats suite green (168). Verified end-to-end: "Twinkle" (7-syllable voice part + sine
    pad) renders a 5.6s WAV through `renderBeatsOffline`. `create_beats` accepts it (same
    validate→normalize gate), so `/beats/<ref>.wav` sings with no new route.
  - Deferred to later slices as planned: choir/`ensemble` de-locking (S2), the browser player's
    live voice emitter (S0 is offline-render only), `transpose` on voice parts, the `authorLyrics`
    text→syllable helper + melody import (S1).
- **S1 — author + import**: `authorLyrics` helper + melody import (hooktheory/midi → beats
  events) so you can give words + a tune. Re-prove Cyborg/Twinkle through the beats path.
  **Melody-import half LANDED (2026-07-17):** [beats-song-melody.js](beats-song-melody.js) —
  `parseHooktheory` + `fromRows` + the degree math (`degreeSemitone` minor/major with stacked
  accidentals, `midiNoteName`), extracted from the cyborg spike line and tested. Still open:
  `parseMidi`, the `authorLyrics` text→syllable helper, and lowering imported melodies to
  beats-grid `events` (today the consolidated song script places absolute onsets itself).
- **S2 — choir + expression**: `voice.ensemble` de-locking in the emitter — **LANDED.** A
  `part.voice.ensemble.voices: [{ detuneCents?, formantScale?, timeMs? }]` renders the syllable
  once per de-locked singer (each nudged off the base voice + seeded off the event) and mixes
  them in `renderSingMono` (solo when absent; `1/√N` level trim). Validated in `beats-manifest.js`,
  tested in `beats-song-render.test.js` (deterministic, thicker-than-solo). Proven through the
  REAL path: `renderBeatsOffline` sings a 3-voice choir WITH echo via a `delay` chain on the voice
  part (echo folds back to beats effects — no new code). Still ahead: vibrato/swell as first-class
  voice-patch feel, `beats-instruments` vocab entries (voice presets, choir templates, emphasis).
- **S3 — consumers** (each its own slice): worlds `audio` channel already resolves beats —
  a singing composition just works as a soundtrack; `cook` publications / `stitch_film`
  read-aloud; bot spoken replies (conversation data still never moves control-side).
- **S4 — realism ceiling** (ear-gated): intra-note pitch motion (the melisma — an engine
  change, notes are fixed-pitch today); per-note seeded humanize (timing/pitch drift);
  real multi-part SATB harmony (actual part pitches / MIDI, not the open-fifth guess);
  portamento/legato/breaths (L4 `[missing]`).

### Consolidation (2026-07-17) — "Birth of a Cyborg" becomes the base capability

The eight `render-cyborg-*` iterations (native-JP solo → Hooktheory melody →
SSAA choir → verse choir → phrasing → arrangement → choir-echo → full
production) were consolidated: everything reusable moved into the substrate,
and the locked production survives as ONE canonical harness.

- [beats-song-melody.js](beats-song-melody.js) — the S1 melody-import seam (above).
- [beats-song-choir.js](beats-song-choir.js) — the locked **descratch3** choir
  capability: `tieredConsonantEmphasis` (sustained pushed 3.0× / stops 1.2× /
  other 1.1×), `DESCRATCH3_VOICES` (3 de-locked singers: detune / stagger /
  tract / vibrato phase), `renderChoirAbsolute` (absolute-onset placement —
  sync-safe against a gridded bed; phrase-tuning stretches SUSTAIN only, via
  `holdFactor`), `feedbackEcho` + `DESCRATCH3_ECHO` (the dark damped echo).
- `writeWavMono` joined [beats-song-dsp.js](beats-song-dsp.js) (the writer
  `readWavMono` round-trips).
- [scripts/render-birth-of-a-cyborg.mjs](../../../scripts/render-birth-of-a-cyborg.mjs)
  is the surviving script: song DATA only (the Hooktheory verse rows, the
  incantation syllable×weight groups, the taiko/bell/drone bed manifest) over
  the modules. **Proven byte-identical** to `render-cyborg-production.mjs`'s
  output before the eight spike scripts were deleted (their findings live in
  the Principles below and the modules above).

### Principles (folded back from the cyborg-verse iteration)

Durable lessons from tuning the GITS verse by ear — each is now either code or doctrine.

1. **Voiced onset consonants must escape the attack ramp.** A fricative/stop is spliced on
   top as noise and escapes the amplitude envelope, so it reads fine; a VOICED consonant
   (a ラ行 tap, a leading nasal) lives in the glottal tract and rides UNDER the per-note
   attack ramp — so it gets masked and "vanishes." Fix (in `renderParametricNote`): snap
   the attack short (≤6ms) when a note LEADS with a glide/nasal. This is why R specifically
   was inaudible while s/t/k were clear.
2. **A Japanese /r/ is a tap, not a glide.** Its cue is a brief amplitude near-closure, not
   a smooth formant slur. Glides carry a `dip` (an amplitude V-notch through the hold): deep
   for `r` (a flap), mild for `w`/`y` (approximants). The formant excursion alone was inaudible.
3. **Phrase tuning nudges the real music; it never replaces it.** An imported melody's note
   durations / pitches / rests ARE the song — where the notes and lines are actually sung.
   A phrasing intention (per-syllable "hold weight") is applied as a BOUNDED multiplier on
   each real note (clamped, e.g. ±20%), so held syllables sing a touch longer and crisp ones
   tighter, but the real melody always dominates. Re-timing from scratch (weight → absolute
   duration) discards the song and is the wrong layer. STRENGTH=0 → the untouched melody.
4. **The choir is an OPTIONAL register — the locked voice, de-locked.** One vocal tract by
   construction is the identity; a section is that SAME voice de-locked per singer (detune /
   formant-tract size / timing / vibrato). Solo is the default; `voice.ensemble` opts in. A
   choir is not a new voice — it's N nudged copies of the one voice, mixed (`1/√N` trim).
5. **Space is a beats effect, not a voice feature.** Echo/reverb on a voice ride the part's
   existing beats `chain` (`delay`/`pingpong`/`reverb`) — a singing part is a beats part. Do
   not build a bespoke voice echo; wet-level etc. are chain params. (Verified: a `delay` chain
   on a `patch:'voice'` part gives a tuned echo through `renderBeatsOffline`.)

### Doctrine watch-list

- **Reuse beats, don't duplicate it.** The whole point of this reframing: no parallel
  manifest/render/studio/tools. Singing is a patch + a lyric field.
- **Recipes not renders.** The composition manifest is the artifact; WAV/MIDI regenerate
  per request and carry no authority (beats precedent).
- **Seeded dice only** (`mulberry32`, never `Math.random`); **byte-identical determinism**
  (same manifest → same WAV; the choir's de-locking is fixed per-voice params, not dice).
- **No media bytes in `buildBeatsKernel`.** The voice emitter renders beside the kernel,
  invoked at render — the reserved `voice:'buffer'` source.
- **The locked voice, de-lockable.** One vocal tract by construction is the identity; the
  choir is that identity deliberately de-locked per singer (detune/formantScale/timing/
  vibrato) — first-class `voice.ensemble` fields on the part, same knobs opposite direction.
- **Singing is self-contained.** Renders offline; do NOT reintroduce a Kokoro/worker
  dependency for the sung tone. L2 stays a replaceable rung for a future singing-voice
  model (swaps under L3–L6), but the default ships needing nothing.
- Single-user, self-hosted, localhost — no multi-tenant assumptions.

### Open questions (decide during S0/S1)

- Does the voice patch's `voice.register` reference a `voice-register` recipe, or hold
  inline formant config? Probably inline for now (singing formants ≠ Kokoro-blend spoken
  register); wire a reference later if the register shelf earns it.
- How much of L5 authoring belongs to beats vs. stays a voice-only helper? The
  translit/phonemes are voice-specific → keep in the `beats-song-*` modules, imported by
  the emitter; only the `lyrics`/`voice` fields touch `beats-manifest.js`.
- Harmony for S4: per-voice ensemble offsets (current) vs. explicit multi-part beats
  voice-parts vs. chord symbols. Real SATB → explicit voice parts (which beats already
  supports — several `patch:'voice'` parts in one composition).
