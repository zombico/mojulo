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

## Round 6 — the principle beyond the swing (`round6-*.py|mjs`, `r6/`)

Round 5 left a principle and a prediction. **Principle:** find a generator that
already performs the gesture (Kokoro saying a sound word), keep the gesture,
strip the generator's identity (the vowel, the pitch), trace what is left into a
recipe. **Prediction:** it works where the target's physics is turbulent air,
which is what a fricative is, and fails where the target's identity is a tone,
since the voice's pitch leaks (round 5's heavies read as lightsabers), *unless*
the voice is the point: a creature.

Twenty-two recipes in three groups, each rendered, traced (`trace.js`, voicing kept
only for creatures) and measured beside the shelf row it would voice:

- **noise** (devoiced): footsteps on gravel ザッ / ジャリッ, snow ザクッ, grass サッ;
  an arrow's flyby ヒュッ / ピュッ; wind ヒューッ / フゥーッ; steam シュー; a slide
  ズザーッ; cloth ガサッ; a breath ハァ; fire flaring ボッ and crackling パチパチ;
  a splash バシャッ. New chains: `step` (air from 500 Hz, 3 ms attack, 55 ms decay,
  220 ms cap), `flyby` (a narrow sweep 7.5 → 1.4 kHz panned hard across), `gust`
  (stretched, a band up then down), `hiss`, `slide`, `flare` (a band rising),
  `crackle` (an expander keeping the pops), `splash`.
- **control:** a drip ポチャ (a tone): predicted to fail.
- **creature** (the voice kept): growl グルルル (also raw, pitched only), snarl
  ガルルッ, roar ガオーッ, grunt ヌッ, an English `grrrr`. Chains `growl` / `roar` /
  `grunt`: pitched to 0.48–0.7x (a bigger throat), a seeded ~28 Hz flutter and a soft
  clip (the rattle), the breath 6–14 dB under.

**Machine gate.** Every trace renders back within 0.8–2.0 dB (energy-weighted
miss) at 0.4–12 KB of numbers. Against the shelf:

- Footsteps are the right length (60–215 ms against the shelf's 93–114) but their
  centroids scatter: gravel 2.4–2.9 kHz against the shelf's 5.7, snow 7.1 against
  3.2. The words carry a step's timing, not its ground.
- The arrow flybys land on the shelf's own centroid (5.1–5.6 kHz against 5.3),
  a little long (208–314 ms against 166).
- Wind is short (0.8 s against the shelf's 2 s gust) and darker (1.1–1.8 kHz
  against 2.5): one seed's air again (round 5: 0–160 ms of it per seed).
- The splash is a third of the shelf's length (177 against 636 ms) and darker.
- **The tracer loses sustained tails:** steam 331 → 63 ms, the drip 377 → 92.
  A long, quiet, steady hiss falls under the refine's 60 dB floor or the
  tracer's onset trim; the swells and decays survive.
- Creatures trace within 1.4–2.0 dB, at the most bytes (6–12 KB): every frame
  carries a pitch and voicing lane.
- No realistic cue to compare for `breathing` and `fire-burning` (held voices).

**Ears gate, first pass (operator, 2026-11-10)** on `r6/AUDITION-round6.wav` (per
sound: the shelf's own, the mouth, the mouth traced):

- Gravel ザッ / ジャリッ and snow ザクッ: **fail.** As the numbers said, the word
  carries a step's timing, not its ground.
- Grass サッ: **ok.**
- The arrow: the shelf's flyby is not bad; the mouth's alone is hard to read.
- The rest: undecided alone. A lone sound is ambiguous; it needs to be heard held
  or repeated where it makes sense.

**The context audition** (`round6-context.py`, `r6/CONTEXT-round6.wav`, 117 s): each
sound in its scene, the shelf's first where it has one. Repeats are varied as the
kernel varies a hit (seeded: rate ±5 %, gain 0 to −3 dB, timing ±20 ms); sustains
loop a sound's middle with 60 ms crossfades. Scenes: a grass walk (shelf, mouth),
through brush (サッ steps, ガサッ every other), a run into a slide, wading (shelf
`step-water`, mouth バシャッ), the arrow loosed → flying past → landing (shelf
flyby, ヒュッ, ピュッ, and the shelf flyby with ヒュッ 6 dB under it), wind as a bed
of overlapping gusts, steam held 3 s, fire flaring then crackling on, running
breaths, cave drips (the control), a creature's held growl → snarl → roar (with and
without the rattle), an English growl held, and a grunt with each katana swing.
The scenes use the mouth WAVs, not the traces: the question is whether the sound
works at all; the tracer's lost tails (steam, drip) are a separate fix.
**Ears gate on the scenes (operator, 2026-11-10):**

- **Pass:** the grass walk (サッ), wading (バシャッ), the arrow (loosed, flying past,
  landing). Heard in its scene, the flyby the ears could not read alone works.
- **Weird:** wind (the overlapping gusts), steam held, the running breaths, the cave
  drips (the control, failing as predicted).
- **Fire:** can work, with a different modulation.
- **Growls:** need spikes of intonation: the held growl is too level.

So the context did what the word alone could not: three noise sounds passed
in their scenes. The sustained ones (wind, steam, breath) failed: a loop of one
mouthed breath is heard as a loop, which is the long-air limit of round 5 again.

**Round 6b** (`round6b.py`, `r6/CONTEXT-round6b.wav`, 65 s), on those notes:

- *Fire.* The repeated パチパチ carries the word's own rhythm (pa-chi, pa-chi), which a
  fire has not. Its five pops are cut out one by one and scattered as a Poisson
  crackle (seeded; each its own pitch ±, level, pan), alone, over a flickering bed
  (ボッ's breath slowed to half, darkened, swelled by seeded random flicker), and
  with ボッ flaring into both.
- *Growls.* Surges: seeded events that spike the pitch +5..7 (or +8..11) semitones
  in 40 ms and fall back over 220 ms, the voice louder, its rattle faster and deeper
  and its breath up on each. Pitch and pace move together (a varispeed: a throat,
  not a pitch shifter). Beside them, Kokoro's own intonation from punctuation
  (グルル、グルルッ！), alone and with surges; a snarl ガルルルッ！ on hard surges; a
  roar ガオォーッ！ along an arc (+7 semitones at a third, −5 at the end). The held
  growl is now one long word (グルルルルルル), not a loop.

**Ears gate on 6b (operator, 2026-11-10):** the blowing in the fire (the bed, the
flare) sounds odd: dropped. The growls need other words and another intonation:
the syllables sit apart (GRRRR wants them attached closer); for snarls, roars and
the animal sounds, cut the gaps between syllables and let the pitch ride up and
down. The surges (spikes) were the wrong shape: a glide, not a jab.

**Round 6c** (`round6c.py`, `r6/CONTEXT-round6c.wav`, 37 s), growls only:

- *Close:* the dips between syllables (10 ms frames 12 dB under the voice's body)
  spliced out, 5 ms kept each side, 10 ms crossfades. It cuts 15–32 % of a word:
  English `grrrrrr` 2.8 → 2.1 s.
- *Ride:* a smooth contour of two slow seeded swings (about 1.5 and 3.5 Hz, ±5
  semitones), louder and rougher as it rides up; a roar rides an arc (−3 → +6 → +3
  → −6 semitones) with a ±2.5 wobble.
- *Words:* continuous letters, the long-vowel mark carrying the voice: ウゥゥーーッ
  (the manga dog's growl), ヴゥゥーーッ, ングルルルーッ, グルルルルルル; snarls
  ガルルルルッ, ガァァーッ; roars グオオオオーッ, ガアアアアーッ. And the operator's
  example step by step: `grrrrrr` as said, closed, closed and riding.

**Ears gate on 6c (operator, 2026-11-10):** still enunciated: a person saying
"ge re re". Closing the gaps does not hide that each mora is spoken. The
operator's design for 6d: **one syllable, one cut, no rolling;** extend it and
layer copies of itself at different modulations: in theory the throat, the
diaphragm and the mouth working together.

**Round 6d** (`round6d.py`, `r6/CONTEXT-round6d.wav`, 53 s), that design built:

- *One syllable:* Kokoro says グ, ウ, ゴ, ガ or ア once; the steady vowel (the middle
  60 % of its voiced run, 84–177 ms) is cut out, and the first 30 ms kept as the
  onset.
- *Extended:* a granular hold: 60 ms Hann grains read at random (seeded) from the
  vowel every 15 ms, so the pitch stays and the length is free.
- *Layered*, each a copy of the one held vowel: the **throat** (an octave and a fifth
  down, rattled at 25–35 Hz), the **voice** (the animal's pitch, a light rattle), the
  **mouth** (a detuned copy through a band that opens and closes: the formant
  moving). The **diaphragm** is the pressure behind them all: seeded pushes at
  2–4 Hz; on each push every layer is louder, the pitch lifts a few semitones and
  the throat rattles harder. Snarls and roars add the **breath** (ハッ's air, held
  the same way, riding the pressure).
- The audition builds グ up layer by layer (throat, + voice, + mouth, + diaphragm),
  then growls from グ / ウ / ゴ, snarls from ガ / ア (higher, the mouth fast and open,
  quicker pushes), roars from ガ / ゴ / ア (low, one push on an arc, the mouth opening
  wide then closing), and two encounters.

**Ears gate on 6d (operator, 2026-11-10):** the held growl works, and so do the fire,
the hard surges and the snarl (read as: 6d's layered グ held; 6b's scattered pops,
6b's hard surges, the snarl). Next: roars, from the two principles together.

## The principle, distilled (round 6)

Mouth foley in seven rules, each one paid for by an ears gate:

1. **The word is the score, not the sound.** A manga sound word (シュッ, ザッ,
   グオオ) says which sound, in what order, how long: a recipe compressed into
   letters. Read it for the source and the shape; never play it as spoken.
2. **Keep the gesture, drop the person.** For air (swishes, steps, flybys) that means
   devoicing: the breath kept, the vowel and its pitch cut (rounds 5–6). For a voice
   that is the point (a creature), it means rule 3.
3. **One syllable is the source.** Enunciation gives a mouth away: two morae in a row
   are a person saying "ge re re" (6c), however close the gaps. Cut one syllable's
   steady vowel; get a sequence by morphing held vowels, never by speaking them.
4. **The effect owns the time.** Length and arc belong to the body making the sound,
   not to the speaker: hold the one syllable (a granular hold keeps the pitch and
   frees the length) and modulate it over the effect's own period.
5. **One source, many modulations, is one body.** Layer copies of the same held
   sound as its parts: the throat (an octave and a fifth down, rattled), the voice,
   the mouth (a moving formant), the breath; one pressure, the diaphragm, behind
   them all, its pushes lifting pitch, level and rattle together. Hard surges (a fast
   jump of 8–11 semitones, falling back) are pushes too.
6. **Break the word's rhythm.** A repeated word repeats its own rhythm (パチパチ's
   pa-chi): cut its parts and scatter them, seeded (the fire).
7. **Judge in the scene.** A lone sound misleads the ears (the flyby, the steps); a
   walk, a shot, a fire decides it.

Where it fails: anything held from one breath and looped (wind, steam, breathing:
heard as loops), a tone (the drip), and a word asked to carry a surface it does not
know (gravel and snow steps: the timing right, the ground wrong). Every random
choice is seeded, and what passes traces into the kernel's `trace` gesture.

**Round 6e: roars, the rules together** (`round6e.py`, `r6/CONTEXT-round6e.wav`,
47 s). The word is the score (rule 1): ガオー is a then o, グオオ u then o, ゴアア o
then a, ウオオ u then o, ギャオ the bright a then o, グワァ u, a, o. Each vowel is
one syllable cut once (rule 3: ガ / ア / ギャ for a, オ for o, グ / ウ for u), held
and layered as one body (rules 4–5), every vowel's body on the same pressure and
pitch curve, and the roar's 2.2 s arc owns the time: the first vowel held, then
an equal-power handover to the next, the mouth's band moving with the vowel (a
open, o rounded, u nearly closed). Hard surges (+10 semitones at the onset, +6 at
55 %) ride the diaphragm. Also ガオー without the surges, short (1.2 s) and long
(3.2 s), 6d's one-vowel roar as the baseline, and two encounters: the passed held
growl → the passed snarl → a roar.

**Ears gate on 6e (operator, 2026-11-10):** they all still growl rather than roar:
the "grr" quality (the rattle, the throat) without the "a" opening at the end. And
the two encounters' snarl was 6b's spoken ガルルルッ！, not built by the system:
a slip. The operator's rule for roars, by the system: **a roar is a first vowel
opening into A** (oa, ua, ea, ia), and the first vowel decides how the A is
intoned: a lion oa / ua, a bear ea, a giant monster ia.

**Round 6f** (`round6f.py`, `r6/CONTEXT-round6f.wav`, 45 s). The A leads: it is the
loudest and longest part; the rattle is light (depth 0.12–0.32, against 6d's
0.45–0.9) and the throat a plain sub-octave, so nothing says "grr". Every part is
one syllable (オ ウ エ イ ア), held and layered, one pressure behind it. The first
vowel hands the A three things: its **pitch** (after o / u the A starts low and
rises; after e level; after i high and falling), its **formant** (the mouth's band
starts on the first vowel's and opens into the A's: o 650 → 1250 Hz, i 2600 →
1250) and its **timing** (i holds longest, the screech, with an upper copy at 1.5x
fading with it). Measured: the lion's centroid rises into the A (oa 614 → 972 Hz,
ua 542 → 709), the bear's sits mid (1314 → 1550), the giant monster's falls (1454 →
897). Takes: an A alone (the baseline), lion oa and ua, bear ea, giant monster ia,
a short lion, and three encounters with the system's own growl and snarl (6d's グ
and ガ, the 6e slip fixed).

**Ears gate on 6f (operator, 2026-11-10):** the pitch curves were wrong. A roar
rises: **low to high** (oa, ua, ea), and **ia is the special one: it starts high and
ends higher.** 6f let every roar fall at the end and the giant monster fall into
its A. Next: barks.

**Round 6g** (`round6g.py`, `r6/CONTEXT-round6g.wav`, 65 s): the roars re-rendered
on that rule (lion oa / ua and bear ea rising to their end, the giant monster ia
from +5 to +11 semitones), then **barks**, the operator's comparison: the Japanese
syllable against "kar", on a dog's intonation and timing. Sources: ワ (one
syllable), ワン as a score (wa, the mouth closing on the moraic n at the end) and
"kar" said once (am_onyx: the k's burst, capped to 45 ms, for the attack; the a
held; the r's colour as it closes). One bark shape for all: a 4 ms attack, the
pitch an arch (+5 semitones at a fifth, below its start by the end), the level
falling fast after its peak, a huff of breath, a sub and a light rasp. Three dogs
by size (small 1.25x / 110 ms, medium 0.9x / 160 ms, big 0.6x / 240 ms), heard
alone, as wan-wan pairs (the second lower and softer, 0.28 s after) and as an alert
series of five (0.36–0.5 s apart, each varied, seeded).

**Ears gate on 6g (operator, 2026-11-10):** the bear (ea) **sounds like gargling**.
And everything after it, every bark from every source, **sounds like punches and
kicks from kung fu movies, a staff whipped through the air, nunchaku**. Not dogs.

**Why (measured, `round6h-why.py` on the 6g clips against the shelf's swings):**

| clip | above −20 dB | attack | harmonicity | centroid start → peak → end | under 200 Hz |
|---|---|---|---|---|---|
| bark ワ | 110 ms | 25 ms | 0.26 | 791 → 4227 → 1620 | 48 % |
| bark ワン | 145 ms | 15 ms | 0.30 | 377 → 3728 → 2367 | 45 % |
| bark kar | 140 ms | 25 ms | 0.34 | 1965 → 3562 → 2963 | 49 % |
| shelf swing | 65 ms | 5 ms | 0.16 | 2226 → 2974 | 5 % |
| shelf katana swing | 95 ms | 20 ms | 0.38 | 3104 → 11496 | 56 % |
| shelf arrow flyby | 130 ms | 5 ms | 0.48 | 3325 → 7009 → 4706 | 0 % |

- **Length.** A bark ran 110–145 ms. That is a swing's length (65–130 ms on the
  shelf), not a voice's. Under ~150 ms the ear stops asking *who* made a sound and
  hears *what moved*.
- **No voice left in it.** Harmonicity is 0.26–0.34, as low as the katana. The arch
  climbs 5 semitones in the first ~35 ms, and the granular hold's 60 ms grains are
  longer than the climb, so the pitch smears. What reaches the ear is a sweep, not a
  note. That is rule 2 (keep the gesture, drop the person) happening by accident.
- **The centroid rises, then falls.** The huff (breath highpassed at 1500 Hz, at the
  onset) and the arch put the brightness up and bring it back down. That is the shape
  of air passing the ear: a whoosh.
- **Half the energy is under 200 Hz.** The sub, at half pitch through tanh, is a
  thump. Whoosh plus thump is the film punch: the swing and the body hit in one sound.
- **The timing.** A pair 0.28 s apart is a one-two. A series of five, 0.36–0.5 s apart
  and varied in pitch and level, is a combo.

**Why the bear gargles (hypothesis, A/B in 6h):** the bear has the deepest rattle of
the roars (rasp 0.32 against the lion's 0.18), at 28 Hz with a wandering rate. That
is the irregular bubbling of a gargle. It sits on a mid vowel (E, band 1500 Hz) under
the loudest breath (−4 dB against −8). A gargle is just that: a held voice with air
bubbling through it. 6h renders the bear without the rattle, and with the lion's
breath level, to find out which one it is.

**The finding, as a rule:** a voiced syllable, held under ~150 ms, with a fast pitch
arch, a bright onset huff and a sub, is no longer a voice. It is motion, a strike
through the air. That is a recipe for martial-arts foley (punch, kick, staff,
nunchaku), and it is round 6h.

**Round 6h** (`round6h.py`, `r6/CONTEXT-round6h.wav`, 51 s): the accident on purpose,
as a `strike`. The bark's body (a held syllable, the arch, the huff, the sub), set by
kind:
- **punch:** 130 ms, the bark's arch, a firm sub.
- **kick:** 220 ms, lower, the sub up.
- **staff:** 380 ms. The air leads, the pitch goes up then down (a passby's Doppler),
  the band sweeps 1200 → 3200 → 1400 Hz, and it pans across.
- **nunchaku:** 120 ms whips in a figure-eight, eight at 0.115 s, panned left and
  right in turn.

Each one is heard from ワ (the found source) and from its own word as the score:
シュッ for the punch, ブン for the kick, ヒュン for the staff and the nunchaku. That
compares shape against source. Then a one-two-kick, a staff twirl, the nunchaku and
a short fight.

Machine gate: the punches and kicks land on the bark's numbers (105–185 ms above
−20 dB, harmonicity 0.20–0.40, the centroid up to 3–4.8 kHz and back, 34–68 % under
200 Hz). The staff is airier, like the katana (220 ms, 31 % over 4 kHz).

The bear A/B: as 6g, without the rattle, with the lion's breath, and with neither.
**The measure cannot see the gargle.** Harmonicity stays at 0.29–0.31 with or without
the rattle; the lion is 0.37. If "neither" still gargles, the rattle and breath are
cleared. The next suspect is the held エ itself: a short vowel read at random in
60 ms grains, which bubbles.

**Ears gate on 6h (operator, 2026-11-10): all pass.** The punches, kicks, staff,
nunchaku, the one-two-kick and the fight all pass, from ワ and from the words. One
note: the staff twirl still has too much human in it. Make it "whop whop". The
operator made **the strike the approach for a while**: short syllables (under ~150 ms)
as motion and impact, not as voices. Next: "ch" sounds.

**The strike approach (round 6h on):** a syllable, cut once, held under ~150 ms. A
fast pitch arch takes the voice out, the onset's air gives the motion, and a sub gives
the body. The kind sets the length, the arch, the levels and the sweep. The word picks
the syllable (rule 1); the shape makes the effect.

**Round 6i** (`round6i.py`, `r6/CONTEXT-round6i.wav`, 60 s), the strike approach
continued.

*The whop.* 6h's staff kept a person in it: the formants above the first. A whop is
round and low: the w's swell, the o's one low resonance, the p's stop. So the voice is
cut under 500 Hz, which keeps the first formant and drops the person above it. The air
carries the motion through a narrow band swept 300 → 650 → 350 Hz. The level swells
and stops short, with a sub under it. Sources: ブン (the heavy swing; ブンブン is
twirling) with a little voice, ブン as air and sub only, and ウォ. Each twirls at 3.5
a second, plus one speeding up from 3 to 6. Measured against 6h's ヒュン twirl: the
centroid drops from 4.7 kHz to 0.4–0.6 kHz, with nothing above 1 kHz. Harmonicity
*rises* (0.38–0.66). That is the single low resonance, the o, not a voice; the ears
decide.

*The ch sounds.* The affricate is already a strike: a stop's burst and a hiss, under
100 ms. Each word is the score, its syllables cut once:
- the ch burst: the attack of チャ, チ, チュ or チョ, highpassed;
- a k or p click;
- a short voiced tick where the word has one;
- a ring (warp's modal resonator) where the thing is metal.

The words: チャキッ (a sword's guard, a gun handled), カチャ (a latch), ガチャ (a
heavy latch, armour), チャリン (a coin), チュン (a ricochet), パチッ (a spark, a
switch), バチバチ (crackling electricity: scattered パチッ over a low hum), ピチャ (a
drip), チョキン (scissors) and カチカチ (ticking). Then in use: a catch then the
guard, coins dropped, ricochets each way, a switch, drips, snips, armour.

Machine gate: everything but the coin's ring lands at 50–185 ms above −20 dB. The
centroids are high (3–9 kHz) and the metal rings measure tonal (0.56–0.85).

**Ears gate on 6i (operator, 2026-11-10): all pass.** The whop twirls and all ten ch
sounds pass, alone and in use. Next: annotate the library so it can be searched by
intent, and fold the round 6 passes into the shelf.

## Next steps

1. ~~Operator listens to round 5~~ done: all but ビュン byun pass.
2. Collapse knobs to the canonical set on the chosen seed; A/B a tight grid.
3. ~~Decide the home~~ done: traced into recipes (the `trace` gesture, the shelf's
   `mouth` style), never sampled.
4. Operator listens to round 6; what passes becomes rows' mouth voices (and, for
   creatures, the first voiced traces on the shelf).
