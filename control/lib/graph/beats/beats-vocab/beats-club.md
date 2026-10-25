---
{ "id": "beats-club", "name": "Club score: generated electronic game music", "summary": "The second generated score style beside the field orchestra: `club:<mood>` writes a 32-bar electronic loop. The soft end (ambient, chill lo-fi beats, lo-fi house) wears tape and dust, with jazzy sevenths and ninths; the driving end (drift, deep, drive, rave, peak) builds and drops with a kick on its own row and the bass, stabs and pad pumping under it. The game's own key and hall, voices castable by job.", "when": "electronic game music, lo-fi, lo-fi house, lo-fi hip hop beats, chillhop, chill beats to study to, ambient, an ambient soundtrack, drone, a cozy game, a cafe or apartment, rain, underwater, space ambience, techno, house, acid, trance, a rave, synth music for a sci-fi game, a cyberpunk or neon level, a lab or space station soundtrack, an alien world, music for a race or chase with a beat, a boss fight with a drop, four-on-the-floor, a 909, sidechain pumping in a game score" }
---
# Club score

`audio.soundtrack: 'club:drive'` (or `{ score: { style: 'club', mood: 'drive', game?, seed?, cast? } }`, or
`create_beats({ score: { style: 'club', mood } })` for a stored cue) generates an electronic loop. It is the field
score's sibling: the same seeds, the same game identity (its tonic and hall, so a game that mixes the two keeps one
key), the same cast jobs, and it ships to the World page and to Godot and Unity as a looped bed.

## The ladder

| mood | bpm | drums | the bass | for |
|---|---|---|---|---|
| `ambient` | 60–76 | none | a drone | space, underwater, a void, a puzzle, rest |
| `chill` | 80–92, swung | a crushed boom-bap | upright or round roots | a room, a cafe, rain, a study break |
| `lofi` | 116–122, swung | a soft four-on-the-floor, crushed | a round house line, a gentle pump | a rooftop, a city at dusk, a cozy hub |
| `drift` | 92–104 | half-time | long notes | exploring, night, a lab at rest |
| `deep` | 118–124 | house: open hats on the off-beat | a syncopated house line | a hub, a menu, a city at night |
| `drive` | 126–132 | techno: closed sixteenths | an acid line, accents deepening the sweep | a chase, a race, a run against the clock |
| `rave` | 136–140 | sixteenths and claps | off-beat bass | a fight, the arena |
| `peak` | 145–150 | sixteenths and claps | acid or reese | the boss, the finale |

## The soft end

`ambient`, `chill` and `lofi` don't build and drop. Their layers come and go over the 32 bars: the keys from the
start (in ambient, soft chords in two stretches from bar 8), the beat after a few bars, the bass after it, the pad
through the break and after, a sparse melodic chop (ambient: one bell every two bars through a long echo, a slow arp
in the middle). The chords are sevenths and ninths (ambient holds each two
bars). The colour is tape and dust: the keys, pad and bass through a tape wobble and a darker tone, the drums
bit-crushed, a vinyl crackle (or, under ambient, a soft air) every bar. Ambient has no beat at all, a drone under
pads that swell in and out every eight bars, in a long hall.

## The form (the driving end)

Eight four-bar groups, 32 bars: the intro (kick and hats), the build (the bass and the clap enter), drop A (stabs on
the off-beats and the arp, a crash), drop A again, the break (no kick: the pad and the arp, a riser), drop B (the
lead riff, a crash and an impact), and out. The bass riff repeats bar by bar and turns every fourth bar; the chart
is hypnotic (often one chord, or i–bVI–bIII–bVII) and never closes V–i, so the loop seam returns to the intro's kick.

## Casting

The jobs map onto the club parts: `ground` = the bass, `lead` = the riff, `colour` = the stabs, `motion` = the arp,
`pad` = the pad, `kit` = the drums (a drum machine: the kit must map the kick, clap and hats, notes 36, 39, 42, 46).
Each mood has its own shelf the game's dice pick from (an acid bass for `drive`, a supersaw for `peak`); cast over it
for the feeling wanted (card `beats-casting`).

## Choosing it

The suggestions (`compose_world`, `create_game`, `design_game({ quick: { music: 'auto' } })`) read the scene's words.
Three kinds of scene score electronic, each leaning to its own end of the ladder:
- tech (sci-fi, neon, cyber, lab, alien, space, robot …): drift, deep, drive, ambient;
- cozy (a cafe, coffee, an apartment, a bedroom, a rooftop, rainy, lo-fi …): chill, lofi, ambient, deep, drive;
- drifting (underwater, ocean, a reef, a void, the cosmos, zen, limbo …): ambient, drift, chill.

The energy the place and play reached picks the mood within it, a calm bed sitting a little calmer than the
orchestra would: a fight is a rave, the last fight the peak, a race a drive. `create_game` scores a whole game in
one style: electronic when most of its levels read so. Name the style to override: `{ score: { style: 'field' | 'club', mood } }`.

A club soundtrack's `sfx: 'auto'` takes the `synth` palette. The stingers are the field ones (`victory`, `defeat`);
cast them with synths for an electronic game.
