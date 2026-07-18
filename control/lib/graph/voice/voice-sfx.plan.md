# voice-sfx.plan.md — the Winslow/Laravell spike (voice as a sound-effect synthesizer)

**Status:** SPIKE, round 1 rendered. Awaiting the operator's ears-gate on the raw
seed + warp ladder. Nothing wired into `create_voice` / the MCP surface yet;
all artifacts are disposable renders under `~/mojulo-voicegen/spike-sfx/`.

## The principle

Michael Winslow ("Larvell Jones", *Police Academy*) made machine-gun, siren, and
gadget sounds *with his mouth*. The spike: Kokoro is a controllable mouth. Give
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

## Next steps

1. Operator listens to `spike-sfx/`, picks seed + closest warp.
2. Collapse knobs to the canonical set on the chosen seed; A/B a tight grid.
3. Decide the home: extend `beats-sfx` to accept a voice-seed source, vs. a
   voice mode. Then it stops being a spike.
