---
{ "id": "beats-percussion", "name": "Percussion: drum machines, hands, orchestra, the arena kit", "summary": "Kits modeled from their circuits and hands: two drum machines plus a bright-hat variant, the acoustic kit with velocity-to-timbre, latin hand percussion, orchestral percussion (rolls, suspended cymbal, tam-tam bloom), and the stadium arena kit with its big shared room, parallel compression and a gated power-ballad variant. GM note maps, choke groups, a rock-drummer feel.", "when": "808-style / 909-style drum machine, a boom kick, handclap, cowbell, a drum machine groove, an acoustic drum kit that gets brighter when hit harder, congas / bongos / shaker / tambourine / guiro / cabasa, latin percussion, a snare roll, timpani and orchestral percussion, a gong / tam-tam, suspended cymbal swell, triangle, stadium rock drums, big arena drums, gated reverb drums, an 80s power ballad snare, open hat choked by the closed hat, a drum fill, a drummer who plays behind the beat, a tight bright 90s rock kit, a snare on a plate reverb, a whole drum part with fills in one line" }
---

Name a kit instrument on a part or track and play GM drum notes (C4 = 60
naming): C2 kick, C#2 rim, D2 snare, D#2 clap, E2 rimshot / 2nd snare,
F#2 closed hat, G#2 pedal hat, A#2 open hat, F2/G2/A2/B2/C3/D3 toms, C#3 crash,
D#3 ride, E3 china / tam-tam, F3 ride bell, F#3 tambourine, G#3 cowbell.
Hands: C4/C#4 bongos, D4/D#4/E4 congas (mute / open / low), F4 slap,
A4 cabasa, A#4 shaker, C#5/D5 guiro, D#5 claves, A5 triangle. Validation
names any note a kit doesn't map.

## Kits

- **`drum-machine-88`**: the analog machine (the 808 idiom). A bridged-T boom
  kick (the pitch drops ≥ 1 octave in < 60 ms, then a long decay), a two-mode
  snare plus snappy noise, a 4-burst clap, a two-square cowbell, rim, claves,
  long-glide toms.
- **`drum-machine-909`**: the punch machine (the 909 idiom). A sine + click kick
  through its own drive, a brighter snare, a 3-burst clap, noise hats.
- **`drum-machine-bright`**: the boom kick with bright, short hats (the 606 idiom).
- **`acoustic-kit`**: the fidelity kit with `velMap`. A harder snare hit is
  brighter, not just louder.
- **`latin-perc`**, **`orchestral-perc`** (concert bass drum, wire snare,
  suspended cymbal, a tam-tam that blooms after the strike, triangle).
- **`stadium-kit`** and **`stadium-kit-gated`**: see below.

Every piece has `vary` on, so no two hits share a noise waveform. Kits choke
their hats: normalize writes the kit's `choke` map onto the row (GM note →
group), and each note is cut at the next onset of its group.

## Timbre that follows the hit

**`velMap`** on any patch (usually via `patchParams`) maps velocity to params:
`{ "attackNoise.level": [-24, -8], "pitchDecay": [0.07, 0.04] }` (values at
vel 0 and vel 1). Use it on anything, not just drums.

## Feel

The **`rock-drummer`** feel preset puts kick and snare a few ms behind the
beat, accents the hats on the downbeat, rushes tom fills a hair and flams
them. Its fields are yours to write too: `laid` ({ GM note: seconds }),
`accent` ({ notes, pattern }), `flam` ({ notes, gap, vel }).

## Stadium rock (the arena)

The arena sound is a close kit into one huge room, compressed together. Big,
not just loud. `stadium-kit` is the close pieces:

- a kick with a velocity-bright beater click
- a modal-shell snare with long wires, and E2 as the rimshot
- toms tuned in fourths that bend down after the hit
- noise-excited crash and china, a ride bell

The instrument's chain is the kit bus: parallel compression under the dry kit,
then one room2 reverb (20 ms pre-delay) with a driven return. The row's
**`roomMix`** (0..1) is how big the stadium is. **`stadium-kit-gated`** sends
the same kit into a gated room (the 80s power ballad).

## Worked examples

- **The percussion lab**: two bars per kit on one groove, a 16-step velocity
  sweep on the acoustic snare, the orchestral roll
  `{ "art": { "type": "roll", "cresc": 3 } }`, and the arena kit's fill into
  the gated room.
- **Stadium rock at 120**:
  - a four-on-the-floor verse on `stadium-kit` (`roomMix` 0.4)
  - a one-bar tom fill down the fourths
  - a half-time chorus on `stadium-kit-gated`, crashes on the downbeats
  - `rock-guitar` and `rock-lead` on top
  - The ears question: arena, or just loud and reverby?

## The 90s rock kit and grooves (anthem styles)

`drum-kit-90s-rock` is tighter and brighter than the arena kit: the acoustic
kick and hats, the arena's cracking snare and bent toms, parallel compression,
the whole kit on a short plate, and the `rock-drummer` feel.

A kit part can take a `groove` instead of events: a named style over bars,
with seeded fills and section crashes (card `beats-grooves`).

## Brushes, the blues kit and palmas (roots styles)

- `brush-kit`: brushes on the snare (a swish with a soft onset), a soft kick,
  a rim click on the cross-stick (C#2), the ride and hats, a tambourine
  (F#3) and an acoustic cowbell (G#3). The `train` and `two-beat` grooves;
  write the tambourine and cowbell as a one-bar phrase placed by `form`.
- `blues-kit`: the acoustic kit, lightly compressed, in a small warm room. The
  `shuffle` and `shuffle-boogie` grooves.
- `palmas`: flamenco hand claps. D#2 is the sharp clap, E2 the muffled one
  (palmas sordas), C#2 the golpe (a knock on the guitar top). Write them as
  events on the 12-beat compás (accents on 3, 6, 8, 10 and 12).
