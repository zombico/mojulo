---
{ "id": "beats-field-orchestra", "name": "Field orchestra: the 32-bit strategy-RPG score", "summary": "A style manual for game music in the 32-bit strategy-RPG idiom: an orchestra written for a few voices that still reads as orchestral. An energy ladder from idyllic open country through adventurous fields to processional, march and battle, with a form and a mix for each step; one shared hall with the sustained sections wet and the percussion dry; layers that enter one at a time; the orchestra played as a band (low brass as kick, strings as hi-hat); loops that never close V–i; instrument families as dramatic tags. Composed with beats-composition; no new kind.", "when": "a strategy RPG or tactics game soundtrack, world map music, travelling across open country, the plains, a calm field theme, a pastoral woodwind melody, a village or shop theme, a forest or chapel theme, a dusty desert road in 6/8, adventurous field music, exploring dangerous country, the road gets dangerous, a field battle that is not a boss fight, an orchestral battle theme that loops for minutes, a military march, a processional, a fanfare, a brass call, a timpani pickup, music for prayer, a tavern or inn, night, sorrow, tension before a fight, a triumph outside battle, an ambush, a betrayal, a sacred or demonic scene, an orchestra that drives like a rock band, a whole game's field and battle music that should sound like one score" }
---

An orchestra written for a few voices: the sound of 32-bit strategy RPGs. It
reads as orchestral because of how it is played and arranged, not because of
how real each instrument is. A small, fixed set of timbres is the score's
signature.

## The principles

1. **Space before density.** Few lines, each exposed. Idyllic music has three
   at most (a melody, a drone or soft bass, one colour); a battle has two or
   three active lines in the middle register and the rest double or hold.
2. **Enter in layers.** One colour alone first, the ground under it a couple
   of bars later, the strings last. A drone under full held chords from bar 1
   sounds like an organ.
3. **One hall.** One shared `room`: sustained sections (strings, woodwinds,
   brass) wet, percussion and the bass dry. The `orchestra-*` bands do this.
4. **Played, not sequenced.** Delayed vibrato on held notes (`vibrato.delay`),
   hairpins and `swell` into downbeats, `legato` lines, `staccato` stabs, `hold`
   below 1 so held chords breathe.
5. **Answer, don't stack.** A woodwind phrase is answered by another
   instrument; a doubled line (the horns an octave down) is weight, not a new
   idea.
6. **The loop never ends.** No V–i at the seam: close on bVII–i, bVI–bVII–i,
   bII–i or plagally, or hold a `pedal` under the turnaround (card
   `beats-harmony`).
7. **Renew by gear change, not new themes.** The middle section a major third
   or a fifth up (`modulate`), home again for the loop; a meter change with it.
8. **Mode carries the danger.** Darkest first: Locrian, Phrygian (the bII),
   Aeolian, Dorian, Lydian. Major flashes (i–I) are adventure with a shadow.
9. **The orchestra as a band.** In battle, tuba and trombone on the downbeats
   are the kick, the snare and short chords on 2 and 4 the backbeat, an
   inner-string ostinato the hi-hat; the melody on top.
10. **One cue per dramatic function**, reused wherever that function recurs
    (the table below), so the score teaches the player what each sound means.

## The band

Woodwinds (`flute`, `oboe`, `clarinet`, `bassoon`) lead; `harp`; strings
(`violin-2`, `cello`, `contrabass`); brass (`french-horn`, `trumpet`, `tuba`);
`timpani`; `orchestral-perc` (concert bass drum, wire snare, suspended
cymbal, tam-tam, triangle). Keep this set for the whole game.

## The energy ladder

| step | bpm | harmony | texture | percussion | band |
|---|---|---|---|---|---|
| idyllic (open country, village, forest) | 70–100, often 6/8 (`lilt`) | major, Mixolydian (I–bVII–IV–I), Dorian, plagal | a woodwind melody, a `drone` or `pedal`, one colour; strings `upper` at pp–p | `travel` or none | `orchestra-pastoral` |
| adventurous (the road gets dangerous) | 100–120 | the tonic flip (i–I–bVII–bVI–iv), the Aeolian march (i–bVII–bVI–bVII), a Phrygian stretch | a light ostinato or riff, low brass on the half bar at mp, a brass call answered by a woodwind | `processional` / `march` at `vel` 0.4–0.6, rolls into sections | `orchestra-field` |
| processional (ceremony, the army in review) | 70–90 | minor, pedal-heavy | a `drone`, dotted brass, timpani into downbeats | `processional`, `long-roll` | `orchestra-processional` |
| battle (a fight that loops for minutes) | 130–160 | Phrygian bII, tonic pedal under inversions, gear changes a third up | the band roles (principle 9), brass doubling strings in parallel triads | `march`, timpani pickups | `orchestra-battle` |

Idyllic stays under mezzo forte with four parts at most; adventurous under
forte with five; loops run 45–90 s idyllic, 2.5–4 min in battle (or rotate
several themes).

## Dramatic tags

| scene | the family |
|---|---|
| prayer, mercy | harp with strings, a solo woodwind |
| ambush, threat | low strings and timpani, a bII |
| march, the army | snare, brass calls (`dotted`, fourths and fifths), timpani |
| sacred or demonic | organ, a held pad, low brass |
| betrayal, shock | a brass stab with a tam-tam (`orchestral-perc` 52), then silence |
| victory | the brass in major, a short fanfare, a crash |

## Never the same score twice

The principles are the rules; everything inside them should differ from game
to game, or every game sounds alike.
- **A fresh seed per game and per cue.** Never 1, 7 or 42: a large number
  of your own. The same seed always replays the same music.
- **A game identity, chosen once and kept:** a home key; a palette flavour
  and its instruments per role (orchestral; folk: guitars, banjo, fiddle,
  harmonica; chamber: marimba, vibraphone, music box, celesta; synth-era:
  fm-bell, trance-pluck, rhodes, poly-strings; silk-road: shamisen, erhu);
  one hall (`room`); a motif rhythm that opens every phrase. Two games differ
  at the root; one game's cues sound like one score.
- **Per cue, roll inside the mood:** the mode (the same tonic, a different
  mode per mood), tempo within the step's band, meter, a progression from
  the mood's harmony family, a new melody (chord tones on strong beats, steps
  between, rests), which instrument enters first, the gear-change interval.
- The set below is one roll each, a worked example, not a template.

**Calling it.** You don't have to roll the dice by hand. The generator takes
a mood (the field moods, the towns and interiors, the story cues below):
- A world: `audio: { soundtrack: 'field:plains' }`. `compose_world` stores
  a fresh `seed` in the recipe (as `{ score: { mood, seed } }`): keep it to
  keep the tune, delete it to reroll.
- A stored cue: `create_beats({ title, score: { mood } })`. It returns the
  `seed` and `game` it rolled.
- A whole game: pass that one `game` to every cue and every world's
  `score`. The tunes differ; the key, palette, hall and motif stay.
- `role` records the cue's job: field, travel, town, interior or story.
  Battle is not a field role.

When `compose_world` mints a world with no music, its reply carries a
`music` suggestion: the mood that fits the place, why, and the `audio` line
to add. Offer it; the operator decides.

## More than fields

The same principles write the rest of a game's music outside battle. Each
mood is a set of leanings the dice roll within; the game identity stays the
same.

| Mood | Energy | Role | The leanings |
|---|---|---|---|
| plains, desert, forest | idyllic | field | open country, as above |
| night | idyllic | field | the slowest tempo, lydian or aeolian, a drone and a glint, no kit |
| highlands, expedition | adventurous | field | as above |
| wayfarer | adventurous | travel | a bright walking tune |
| village | idyllic | town | a homely chart over a walking bass |
| town | idyllic | town | a busy square: walking bass, festive or plagal, a light kit |
| tavern | idyllic | interior | a quick 6/8 or 3/4 reel on folk instruments in any game |
| shop | idyllic | interior | short and light: intro, A, B, A, no kit |
| chapel | idyllic | interior | slow and plagal over a pedal, the pad always there |
| ceremony | processional | story | stately 4/4, a brass lead, processional drums, no key change |
| prayer | idyllic | story | a slow plagal chorale, the pad always there |
| sorrow | idyllic | story | a slow aeolian lament over a drone |
| tension | adventurous | story | before the fight: a low staccato cello ostinato, phrygian or tritone, no kit |
| betrayal | adventurous | story | a phrygian shock that lifts a semitone mid-cue |
| triumph | processional | story | a triumph outside battle: brass lead, processional drums, a lift and home |

The `processional` energy has adventurous space (five parts, two leads,
forte) without the motion floor: a procession walks. Battle itself is not
here.

## A set, worked

Seven field cues, each a short `beats-composition` loop:
- **plains** (idyllic): 6/8 at 84, D, `I bVII IV I` over a cello `drone`; a
  harp on `lilt` alone, then the drone, a flute phrase answered by the oboe,
  strings `upper` swelling in late; `travel`.
- **desert** (idyllic): 6/8 at 108, G minor, roots a tritone apart
  (`i bVI bV`), the chorus sliding (`i bVI bV bIV7`); a nylon guitar alone, a
  cello `pedal`, a low clarinet; a short dry room, no strings.
- **village** (idyllic): 100, F, `I IV ii bVII7`; a pizzicato `root-fifth`
  contrabass, a pizz chick on the backbeat, a clarinet tune answered by the
  bassoon, the flute's long notes on the last pass.
- **forest** (idyllic): 72, E Dorian `i IV`; a harp in 8ths alone, a soft
  pedal, a flute, distant strings, two glockenspiel glints.
- **highlands** (adventurous): 104, D minor, `i I bVII bVI iv` then
  `i bII i bVII`; a cello riff (`octaves`, staccato 8ths) alone, a clarinet
  tune, the oboe through the Phrygian stretch, horns doubling the tune an
  octave down on its return.
- **expedition** (adventurous): 112, E minor `i bVII bVI bVII`; staccato
  string 8ths alone, tuba on the half bar, a dotted horn call answered by the
  oboe, the middle a major third up, a `long-roll` into each section.
- **wayfarer** (adventurous): 120, G Mixolydian; a pizzicato boom-chick
  alone, a light `march` at `vel` 0.4, a dotted tune passed flute → trumpet →
  clarinet → flute with the horn doubling, the middle a fifth up.
