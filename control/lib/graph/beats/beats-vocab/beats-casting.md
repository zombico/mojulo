---
{ "id": "beats-casting", "name": "Casting a score: who plays each job, for the feeling wanted", "summary": "How the agent chooses the instruments of a generated score (`score.cast`): the jobs a field or club score writes (colour, ground, lead, brass, pad, motion, kit), every instrument on the shelf by family with its range, envelope and what it conveys, and how to cast for a feeling (dark, bright, tense, heroic, intimate, alien, electronic). The generator still writes the notes; the cast picks the voices.", "when": "choose the instruments for a game's music, cast a soundtrack, which instrument sounds sad / heroic / eerie / magical / ancient / futuristic, make the score sound eastern / western / electronic / medieval, swap the melody to a flute, give the desert level an erhu, a darker bass, an electronic score for a sci-fi game, what instruments are there" }
---
# Casting a score

A generated score (`field:<mood>`, `{ score: { mood, ... } }`, `create_beats({ score })`) writes parts by JOB. The
game's identity picks a band (orchestral, folk, chamber, synth-era, silk-road) and a player per job by dice.
`score.cast` lets you choose instead, for the feeling the scene wants:

```js
audio: { soundtrack: { score: { mood: 'expedition', game: 4410,
  cast: { colour: 'shamisen', ground: 'contrabass-3', lead: ['erhu', 'flute-3'], pad: 'viola-3', kit: 'orchestral-perc' } } } }
```

- A job you leave out keeps the identity's player. Cast one job or all of them.
- The dice roll exactly as they would without the cast: same key, tempo, chords and tune, new voices. Change the
  cast and nothing else moves.
- Cast the game once: the same `cast` on every level keeps one sound. A level may swap one job for local colour
  (an erhu in the desert level).
- Refused: an unknown job or instrument, a kit on a pitched job, a pitched instrument as the kit.
- Advised (`cast_advice` in the reply): a bass that cannot reach the low notes, a pad that does not hold.

## The jobs

| job | what it plays | needs |
|---|---|---|
| `colour` | heard alone first, then under everything: an arpeggio, a roll, pizzicato | any pitched voice |
| `ground` | the bass: a drone, a pedal, roots, a walking line | a low end at D2 or under |
| `lead` | the melodies, two answering: `[first, second]` (one name plays both) | a melodic range |
| `brass` | a call in energetic moods, and the octave doubling of the last phrase | any melodic voice |
| `pad` | held chords far off in the B sections | a sustained sound |
| `motion` | the ostinato in energetic and battle cues | any pitched voice |
| `kit` | the percussion | a kit |

## The shelf, by family

- **Bowed strings** (sustain; warm and singing, grave low, yearning or tense high): `violin` `violin-2` `violin-3`
  `fiddle` `viola` `viola-2` `viola-3` `cello` `cello-2` `cello-3` `contrabass` `contrabass-2` `contrabass-3`;
  `erhu` (a two-string fiddle: nasal, keening, East Asian).
- **Brass** (sustain; noble, heroic, martial; soft horns distant and solemn): `trumpet` `trumpet-2` `trumpet-3`
  `french-horn` `french-horn-2` `french-horn-3` `trombone` `trombone-2` `trombone-3` `tuba` `tuba-2` `tuba-3`;
  `fm-brass` (80s, bright, stabby).
- **Woodwinds** (sustain; pastoral, airy, intimate): `flute` `flute-2` `flute-3` `clarinet` `clarinet-2`
  `clarinet-3` `oboe` `oboe-2` `oboe-3` `bassoon` `bassoon-2` `bassoon-3`; `harmonica` (lonesome, the road).
- **Plucked** (folk, intimate, travelling): `acoustic-guitar` `acoustic-guitar-2` `nylon-guitar` `nylon-guitar-2`
  `classical-guitar` `classical-guitar-2` `flamenco-guitar` `flamenco-guitar-2` `gypsy-jazz-guitar`
  `gypsy-jazz-guitar-2` `banjo`; `shamisen` (sharp, Japanese); `harp` `harp-2` (glistening, mythic, a memory).
- **Electric guitars**: `electric-guitar` `electric-clean` `muted-guitar`; country and roots `twang-guitar`
  `crunch-guitar` `pedal-steel`; high gain `distorted-guitar` `rock-guitar` `rock-lead` `lead-guitar` `drop-guitar`.
- **Bass guitars** (a band's low end): `picked-bass` `slap-bass` `upright-bass`.
- **Keys**: `piano` `grand-piano` `grand-piano-2` `grand-piano-3` `harpsichord` (intimate, reflective; a harpsichord
  courtly); `rhodes` `clavinet` `fm-keys` (mellow, funky, glassy 80s); `organ` `organ-rotary` `fm-organ` (sacred,
  gospel, a rock swirl; they hold).
- **Mallets and bells** (innocent, magical, toy-like; bells sacred): `celesta` `music-box` `glockenspiel`
  `xylophone` `marimba` `vibraphone` `tubular-bells` `crotales` `steel-drum` `fm-bell`.
- **Synths** (electronic): pads `poly-strings` `string-machine` (wide, nostalgic); short and bright `trance-pluck`
  `rave-stab` `orchestra-hit`; huge and driving `supersaw-lead` `hoover`.
- **Synth basses**: `acid-bass` (squelch) `reese-bass` (growl) `wobble-bass` `fm-bass` (round).
- **Timpani**: `timpani` (ceremony and threat).
- **Kits**: `drum-kit` `drum-kit-90s-rock` `acoustic-kit` `stadium-kit` `stadium-kit-gated` `brush-kit` `blues-kit`
  `orchestral-perc` `latin-perc` `palmas`; machines `drum-machine-88` `drum-machine-909` `drum-machine-bright`.

## Casting for a feeling

The mood already sets the mode, tempo and density; the cast sets the colour. Rules of thumb:

- **Dark, heavy, grave**: low bowed strings (`cello-3`, `contrabass-3`), soft horns, `bassoon-3`, `timpani`; a
  `tuba-3` ground. Keep the leads in their low half (a clarinet, a viola).
- **Bright, open, hopeful**: `flute-3`, `oboe-3`, `trumpet-3`; `harp-2`, `celesta` or a guitar for colour.
- **Tense, uneasy**: a low ostinato (`cello-3` motion), `erhu` or `oboe-3` lead, `vibraphone` or `harp-2` colour,
  no kit or `orchestral-perc`.
- **Heroic, martial**: `french-horn-3` and `trumpet-3` leads, a `tuba-3` ground, `timpani`, `orchestral-perc`.
- **Intimate, nostalgic**: a guitar or `grand-piano` colour, `clarinet-3` lead, `poly-strings` or `viola-3` pad.
- **Magical, childlike**: `celesta`, `music-box`, `glockenspiel` colour; `flute-3` lead; `harp-2`.
- **Sacred**: `organ` pad, `tubular-bells` colour, `french-horn-3` lead.
- **A place**: East Asia `erhu`, `shamisen`; Spain `flamenco-guitar`, `palmas`; the frontier `harmonica`, `banjo`,
  `pedal-steel`; the Caribbean `steel-drum`, `latin-perc`; a court `harpsichord`.
- **Alien, sci-fi, 80s**: `fm-bell` or `trance-pluck` colour, `poly-strings` pad, `fm-bass` ground,
  `drum-machine-88`.
- **Electronic dance**: the voices alone do not make it; the writing does. A field score cast with a 909 and a
  supersaw is still an orchestral form. Use the club style (`club:<mood>`, card `beats-club`) for four-on-the-floor,
  riffs, the pump and the drop; cast its jobs the same way.

Two leads that answer should differ in colour (a flute answered by an oboe, a horn by a clarinet). The ground and
the pad should not both be low strings in a calm cue: it reads as an organ.
