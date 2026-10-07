---
{ "id": "beats-robot-rock", "name": "Robot rock: the 16-bit action-game band", "summary": "A style manual for game music in the 16-bit action-platformer idiom: a rock band played by machines. One fixed band and one room for a whole game, a riff-and-bass engine where the bass answers the lead, an intensity ladder from stage select to final boss with a form per scenario, an element (water, fire, ice, machine) signalled inside the groove instead of by swapping the band, and an 8-voice discipline. Composed with beats-composition; no new kind.", "when": "robot rock, a 16-bit action game soundtrack, a run-and-gun or platformer stage theme, a boss battle theme, a fortress or final-castle stage, a grave dark final stage, a stage select screen, a victory jingle or item-get fanfare, retro action rock, synth rock with a slap bass, a game's whole stage set that should sound like one band, an underwater action stage, a fire stage, an ice stage, a factory stage, music for every level of my game" }
---

A rock band played by machines: the sound of 16-bit action games. It is a
style built from traits, with no fixed recipe. Write it as a `beats-composition`
(card `beats-composition`) with a chord chart (`beats-harmony`) and a kit
`groove` (`beats-grooves`).

## The principles

1. **One band per game.** Every piece in a game's set uses the same six roles
   and instruments. A stage changes tempo, key, lead colour and what is wet,
   never the band. The set reads as one soundtrack.
2. **One room per game.** One manifest `room` (a plate, decay about 2.2 s) is
   shared by every piece. A row joins it with `send`: lead, pad and colour are
   wet; kit, bass and rhythm guitar stay dry (`send: 0`).
3. **The riff and the bass are the engine.** The bass is never a root
   drone. It moves in 8ths or 16ths, slides or pops into the bar, and
   **answers the lead**: the lead calls for a bar or two, then rests, and the
   bass fills the rest. Every 8 bars the two play the answer in octaves.
4. **Melody first, short and singable.** A 2–4 bar hook, stated in the first
   8 bars of the loop and restated. Stepwise with one leap; held notes get
   `vib` with a delay.
5. **Loops, not songs.** A short intro or jingle (1–4 bars), then a loop of
   16–32 bars that returns without a seam. A loop closes on IV, V or ♭VII
   leading back to i. The ending is the loop.
6. **The element lives inside the groove.** Water is a sliding, popping bass,
   a dark pad and a wet bell or vibraphone figure over a dry kit; it is not an
   ambient bed. Fire is faster, with a driven lead and brass stabs. Ice is
   bright: a high bell colour and a sparse bass. Machine is a 16th grind and
   palm mutes. A per-stage **colour row** carries it, one row only.
7. **Contrast across the set.** Neighbouring stages differ in tempo band,
   mode and feel (laid-back vs driving), so a set never sounds like one track
   twelve times.
8. **Eight voices.** At most 8 notes sound at once: kit 1, bass 1, lead 1,
   colour 1, and 2 + 2 for pad, brass dyad or guitar root–fifth. Brass and
   guitar take turns rather than stacking. `players: 1` on every row.
9. **No drop, a ladder.** Intensity rises from piece to piece, not by cutting
   out mid-piece. A loop must survive minutes of play, so it stays at one level
   and varies colour, not loudness.

## The band

| Role | Instrument | Notes |
|---|---|---|
| Kit | `drum-kit-90s-rock` | a `groove` per section; `fills: 'every-8'` or `'every-4'`; `crash: 'section'` |
| Bass | `picked-bass` (driving) or `slap-bass` (laid-back, `art: 'pop'`) | figures written as events; `slide: {in: -2}` into a bar |
| Lead | `rock-lead` | `trim: -4`; `vib` on held notes; the hook |
| Rhythm | `rock-guitar` | `chordVoice: 'power'`, 8ths, `art: 'pm'` for drive; `trim: -3` |
| Brass | `fm-brass` | dyad stabs (`chordVoice: 'upper'` with a one-hit `rhythm`) or the B-section melody |
| Pad / colour | `string-machine`; per stage `vibraphone`, `organ`, `celesta`, `steel-drum` | pad held 2 bars, `tone` about 0.5 |

## The intensity ladder

| Scenario | Tempo | Groove | Bass | Harmony and feel |
|---|---|---|---|---|
| Title / select | 120–132 | `sixteen-beat`, vel 0.75 | 8ths | a bright minor or Mixolydian hook; stabs on the "and" of 2 and 4 |
| Stage (calm) | 136–150 | `sixteen-beat` | slap, slides | Dorian; laid-back; wet colour row |
| Stage (driving) | 150–160 | `rock-drive` | 8ths with octave pops | Aeolian i–♭VII–♭VI–V; brass answers |
| Fortress I | 145–155 | `rock-drive` | a march figure (root, fifth) | heroic and grave: i–♭VII–♭VI–V, a theme in long notes, a brass counter-line |
| Fortress II (grave) | 132–140 | `half-time`, then `rock-drive` | a 16th grind with ♭2 neighbours | Phrygian pull i–♭II, organ instead of pad, low brass swells, a 4-bar intro of organ and bass alone |
| Boss | 160–176 | `double-time-chorus` | a gallop (8th + two 16ths) | a short 16-bar loop; a chromatic ♭II stab; a 16th lead riff |
| Victory / item | 132–144 | written hits | held roots | 4 bars: I–♭VII–I, a rising arpeggio to a held tonic, a crash, then ring out |

Seriousness comes from **weight and subtraction**, not from speed. The grave
fortress is slower than the boss. It opens on organ and bass alone, holds
long lead notes over the machine, and swaps bright stabs for low brass swells.

## A set, worked

Five pieces, one band, one room: a select loop (B minor, 128), a boss (C minor,
168), Fortress I (D minor, 150), Fortress II (E, Phrygian pull, 138) and a
victory (G, 140). Each is a `beats-composition` under 40 bars. A recipe book
may carry them as ready-to-mint songs: find them with
`semantic_search({ kinds: ['beats_vocab'], query: 'robot rock' })`.

## Render cost

Keep `players: 1` and hold pads (a one-hit `rhythm` with `hold: 1`) rather
than retriggering chords. The amp guitar and the rock kit are the costly rows
in an offline render.
