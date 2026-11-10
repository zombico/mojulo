# voice-sfx.plan.md — the mouth-foley spike (voice as a sound-effect synthesizer)

**Status:** SPIKE, rounds 1–5 rendered (round 5, 2026-11-10: swishes, swooshes and
sword swings, on branch `1110-simulated-sfx`). Round 5 ears gate (2026-11-10): the operator passed the
audition `spike-sfx/r5/AUDITION-round5.wav` except ビュン byun (heavy). Nothing wired into `create_voice` / the MCP surface yet;
all artifacts are disposable renders under `~/mojulo-voicegen/spike-sfx/`.

## The principle

Vocal sound-effect performers make machine-gun, siren, and gadget sounds *with
their mouths*. The spike: Kokoro is a controllable mouth. Give
it a syllable that already sounds like the object, pick a voice whose phonetics
sharpen it, then point a DSP rack at the render to warp it the rest of the way.

Three sub-principles, in order:
1. **Syllables that sound like the object.** Onomatopoeia is the raw material.
2. **The right voice sharpens it.** Deep male + a click/affricate-heavy language.
3. **DSP knobs finish it.** sample / layer / replicate / space-echo.

**Canonical target:** the tongue-click "tchk tchk" warped into a **weapon reload**.

## Metaprinciple (validated, round 1)

"Deep male voice from a language with STRONG tchk emphasis." Objectively true so
far — crest factor (peak/RMS = transient sharpness) of the raw seeds:

| language / voice        | best seed        | crest |
|-------------------------|------------------|-------|
| Japanese `jm_kumo`      | カチッ kachi'    |  9.9  |
| Mandarin `zm_yunjian`   | 咔嚓 kāchā       | 10.5  |
| English `am_onyx`       | "tch" / "ka-chak"| 5.5–6.0 |

English deep-male is muddy for clicks; the click-language voices are ~1.7× sharper.

**Japanese wins twice**, and is the pick:
- Its onomatopoeia (擬音語) is a *grammaticalized* syllable→object system — the
  deepest well of sub-principle #1 in any language.
- The **sokuon っ** (geminate) natively produces the sharp stop-before-affricate
  that *is* a mechanical "tchk".
- `misaki[ja]` G2P is installed and routes for `j*` voices (the phoneme alphabet
  Kokoro was trained on); Mandarin only has espeak G2P here, so onomatopoeia
  control is fuzzier despite the marginally sharper affricate.
- Direct hit: **チャキ (chaki)** is *literally* the anime gun-cock/ready sound.
- Constraint: `jm_kumo` is the ONLY Japanese male in the bin. If we need timbre
  range we blend it with a non-J male embedding (G2P still routes JA on the
  dominant weight — see speak.py:77-89), or fall to Mandarin's 4 males.

## Architecture — the one-sentence spike

**Voice phoneme (Kokoro CLI) → the beats DSP rack → warped sample.** The "knobs"
the operator asked for already exist as the beats effect kernel; this points them
at a voice WAV instead of a synth source. Reuses beats' own
`node-web-audio-api` `OfflineAudioContext` + `encodeWavPcm16` render seam. This is
the first concrete voice↔beats bridge (`voice-worker.plan.md` V3 territory), built
as a throwaway first.

- Seed render: `spike-sfx/render-batch.py` (loads Kokoro once, renders the
  onomatopoeia matrix; mirrors `speak.py` G2P routing).
- Warp: `spike-sfx/warp.mjs` (the DSP rack; parameterized knobs = candidate
  canonical knobs; output filenames record the chain).

## The first canonical knobs (candidates, discovered by building)

Named in `warp.mjs` PRESETS. These are the hypothesis to confirm by ear:

1. **gate** — silence floor as a fraction of peak. Carves gaps between bursts,
   sharpens the attack. (The geminate っ already pre-carves; the gate deepens it.)
2. **drive** — waveshaper amount. Metallic grit / mechanism friction.
3. **tone** — bandpass {freq, Q}. Carves voice formants toward "metal" (~1.6–2.2kHz).
4. **layers** — pitched copies summed in: `rate<1` = mechanical weight (deeper
   body), `rate>1` = metallic tick. (playbackRate shifts pitch+time together.)
5. **echo** — space echo {time, feedback, wet}. 45–60ms slapback = a chamber
   reflection; feedback→ the "in a room" tail.
6. **reps** — extra onset offsets. The "tchk tchk" rhythm / a two-stage reload
   (rack pull → seat), e.g. `reps:[0.11]`.

Preset ladder rendered: `reload-A-slap` (gate+drive+slap), `reload-B-layered`
(+pitch layers), `reload-C-full` (+deeper echo + second stage). Objective read:
A *sharpens* (crest 9.9→14.4 on kachiQ), B *enriches* (more bursts), C *washes*
(denser, chamber tail). Which reads as "reload" is the operator's call.

## Open questions for after the ears-gate

- Which raw seed is the best "tchk"? (kachiQ / gacha / kachakon / chaki, JA vs ZH.)
- Which knobs actually did the work → prune the canonical set (likely gate +
  drive + one down-layer + slapback; echo/reps may be genre dressing).
- Does a jm_kumo × non-J-male *blend* widen usable timbre without breaking G2P?
- Is the SFX recipe a new `create_beats` kind (beats-sfx already exists!) fed a
  voice seed, or a new voice-register mode? Beats-sfx is the more natural home —
  it already owns the DSP vocabulary.

## Round 2 — the "Kah-tsdchdjuch" cocking cluster (`cluster-batch.py`)

Target: a two-part gesture (sharp grab + vowelless ratchet) at slide-rack tempo.
Metric shifted from crest (single-click sharpness) to **ratchet density**
(bursts/sec — the grind's teeth). Findings:

- **Kana clusters dominate.** カッチュヂュチ (kaQchudjuchi, the literal
  "Kah-tsdchdjuch") = 27.6 bursts/s; ガチャチャチャ (gachachacha) = sharpest
  ratchet (crest 10.6). The geminate っ + devoicing + speed 1.5–1.6 grinds.
- **espeak SMEARS vowelless clusters — hypothesis refuted.** Feeding the literal
  "kah tsdch juch" to `am_onyx`/`zm_yunjian` gave 1.3–1.4s, crest 5.3–6.4, low
  density — espeak inserts vowels/pauses instead of grinding. The dense-consonant
  path is Japanese kana + geminate, NOT literal rom123 clusters. Reinforces the
  metaprinciple: it's the *language's* cluster phonotactics, not the spelling.
- Winners warped: `cl-ja-kaQchudjuchi`, `cl-ja-gachachacha`. New `cock-tight`
  preset (hard drive + 2.6kHz metal band + one 0.7× weight layer + 30ms slap +
  a single 0.13s forward-slam rep) models a slide rack (one motion), vs the
  reload presets' two-stage pull-and-seat.

## Substrate limit: no Korean (round 4)

Kokoro `voices-v1.0.bin` has **no Korean voice** (no `k*` ids) and the model isn't
trained on Korean. misaki *ships* a Korean G2P (`ko`, `hangul_*`, `hanja_tools`)
but it needs the uninstalled `g2pk2` dep — and even wired up it would emit
phonemes this model can't voice. No system espeak-ng either. So "real Korean" is
a **separate-backend follow-up** (a Korean-capable TTS / Kokoro Korean pack), not
this spike. The workable substitute for the Korean hard-stop *flavor* is the
Japanese phoneme route (カ/ガ + ヂュ + geminate っ), which is what round 4 used.

Round 4 also proved the **"other pole"** works for SFX: a female-low voice is the
voice-register *depth axis* (jf_* blended toward the jm_kumo anchor), and a
geminate-closed syllable + tail-gate + drive + metal ring = a passable mechanical
**latch** (`ka-djuck-latch.py`). "volumize" decomposed into: body layer (pitch
down) + soft-clip drive + hot normalize; "latch" into: hard tail-gate on the
final snap + a decaying resonant ring.

## Round 5 — air: swishes, swooshes and sword swings (`round5-*.py|mjs`, `r5/`)

Target: the shelf's air sounds. Unlike rounds 1–4 (clicks: the transient is the
sound) the sound here is the *fricative*, and the vowel after it is what gives a
mouth away. Seeds: Japanese manga sound words on `jm_kumo` (シュッ shu', シュン,
スッ, ヒュッ, ヒュン, ヒューン, ビュン, ブン, ブォン, ザシュッ, ズバッ, スパッ,
シャキーン, シャッ, キーン), three on `jf_alpha`, Mandarin 嗖 / 唰 / 呼 on
`zm_yunjian`, English swish / swoosh / whoosh / shing on `am_onyx`. The bar is the
shelf's own `katana-*`, `blade-swing`, `swing` and `net-swish`, rendered by
`renderSound` and read with the voice warps on the same yardstick (`measureSound`).

New knobs (the air needs different ones from the clicks):
- **devoice**: a frame autocorrelation voicing mask (70–400 Hz) gates the voiced
  frames out, then a 1.5 kHz high-pass. Before the high-pass, the vowel residue
  still put 50–80 % of the "air" energy under 500 Hz; after it, the air sits in
  mid/high like a real fricative.
- **passby**: a band gliding 5.2 → 1.1 kHz, a swell-then-fall envelope, a pan
  sweep, a 0.65× body copy under it.
- **heavy**: the opposite: keep the voiced hum, pitch it to 0.55×, sweep it low,
  lay the devoiced air on top (ブン / ビュン / ブォン).
- **reverse**: a reversed swish into a short forward one (the swell-in).
- **ring**: the swish exciting a four-mode metal resonator, or the mouth's own
  キーン pitched 2.6× into a whine.
- **hybrid**: the voice swoosh 6 dB under the shelf's synthesized katana swing,
  peaks aligned.

Machine findings (measured before the ears gate):
- **Kokoro is deterministic.** The same text, voice and speed render byte-identical
  audio in one session and across a fresh model load (sha256 equal, max diff 0, on
  this Mac). So a recipe of `{ text, voice, speed, chain }` regenerates its sound,
  which is what lets voice foley keep "recipe, not render". Not yet checked
  across CPUs or onnxruntime versions; expect "equal within tolerance" there, like
  the kernels across Node majors.
- **The air is short.** Usable unvoiced air per seed (audible, not voiced) runs
  0–160 ms: 呼 hu 157, シャキーン 155, whoosh 139, ビュン 118, スパッ 116, ザシュッ
  109, スッ 101. ズバッ and `jf_alpha`'s ヒュン have none. By energy the air is only
  1–15 % of a seed: Kokoro voices fricatives quietly next to their vowels. The shelf's
  katana swing is 227 ms, so one seed's air covers a quick swing, not a long whoosh.
  Longer would need a stretch (granular), not a slower `speed`.
- **Voice alone is all top.** Devoiced swooshes have no energy under 500 Hz; the
  synth katana puts 25 % in the sub band (the push of air). The heavy chain is the
  complement (sub+low ≈ 0.9). One mouth sound does not cover the band; two do.
- **The hybrid is the measurable win.** Laying the voice under the synth fills the
  mid band the synth leaves almost empty (mid 0.12 → 0.13–0.43) and raises the
  heard spread (`heard` 1.75 → 1.80 / 1.84 / 1.91 for ヒュン / 呼 / スッ) while keeping
  the synth's attack (centroid 8290 → 8220 for ヒュン). Voice as a *layer* of a
  realistic cue, not a replacement, is the shape this points to.
- 47 of 64 warps clear the register's heard (1.31) and crest (8 dB) floors; the
  thin ones are the narrow-band swoosh sweeps (唰, ヒュン alone, `jf_alpha`).
- The blade chains run long (0.7–1.2 s to −40 dB) against a 0.23 s swing: the
  resonator tail wants a harder cut if it survives the ears.

Which sounds look worth it, by the numbers so far: a voice layer in the realistic
katana / blade swings (hybrid), the heavy swings (voiced hum), and the clicks of
rounds 1–4 (reloads, latches). Long whooshes and the basketball swish look like
the synth's to keep.

**Ears gate (operator, 2026-11-10).** Every sound in the round 5 audition sounds
good except **ビュン byun, heavy chain** (`w-ja-byun--heavy`), which is dropped. The
heavy swing keeps ブン bun and ブォン buon. So the ears passed the hybrids (ヒュン,
呼, スッ, whoosh under the synth katana), the voice-only swooshes (シュッ, ザシュッ,
唰, シュン, ヒューン, `jf_alpha` シュッ, English swish), the heavy swings bun and
buon, the three blade-ring versions, the reversed swells (スッ, 唰) and スパッ's air
next to the net swish. That is wider than the numbers predicted: the voice-only
swooshes and the net swish passed by ear too, so "keep the synth's" no longer
holds for them.

## Next steps

1. ~~Operator listens to round 5~~ done: all but ビュン byun pass.
2. Collapse knobs to the canonical set on the chosen seed; A/B a tight grid.
3. Decide the home: extend `beats-sfx` to accept a voice-seed source, vs. a
   voice mode. Then it stops being a spike.
