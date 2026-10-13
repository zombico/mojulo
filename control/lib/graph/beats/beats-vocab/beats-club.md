---
{ "id": "beats-club", "name": "Club score: generated electronic game music", "summary": "The second generated score style beside the field orchestra: `club:<mood>` writes a 32-bar electronic loop that builds and drops (intro, build, drop A, the break, drop B, out) with a kick on its own row, the bass, stabs and pad pumping under it, hats on the off-beats, a riff, an arp, a riser and impacts. Five moods on an energy ladder (drift, deep, drive, rave, peak), the game's own key and hall, voices castable by job.", "when": "electronic game music, techno, house, acid, trance, a rave, synth music for a sci-fi game, a cyberpunk or neon level, a lab or space station soundtrack, an alien world, music for a race or chase with a beat, a boss fight with a drop, four-on-the-floor, a 909, sidechain pumping in a game score, electronic battle music" }
---
# Club score

`audio.soundtrack: 'club:drive'` (or `{ score: { style: 'club', mood: 'drive', game?, seed?, cast? } }`, or
`create_beats({ score: { style: 'club', mood } })` for a stored cue) generates an electronic loop. It is the field
score's sibling: the same seeds, the same game identity (its tonic and hall, so a game that mixes the two keeps one
key), the same cast jobs, and it ships to the World page and to Godot, Unity and Unreal as a looped bed.

## The ladder

| mood | bpm | drums | the bass | for |
|---|---|---|---|---|
| `drift` | 92–104 | half-time | long notes | exploring, night, a lab at rest |
| `deep` | 118–124 | house: open hats on the off-beat | a syncopated house line | a hub, a menu, a city at night |
| `drive` | 126–132 | techno: closed sixteenths | an acid line, accents deepening the sweep | a chase, a race, a run against the clock |
| `rave` | 136–140 | sixteenths and claps | off-beat bass | a fight, the arena |
| `peak` | 145–150 | sixteenths and claps | acid or reese | the boss, the finale |

## The form

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

The suggestions (`compose_world`, `create_game`, `design_game({ quick: { music: 'auto' } })`) read the scene: words
that say the future, a machine, a screen or a dance floor (sci-fi, neon, cyber, lab, alien, space, robot, rave …)
score it electronic, and the energy the place and play reached picks the club mood (a fight a rave, the last fight
the peak, a race a drive). `create_game` scores a whole game in one style: electronic when most of its levels read
so. Name the style to override: `{ score: { style: 'field' | 'club', mood } }`.

A club soundtrack's `sfx: 'auto'` takes the `synth` palette. The stingers are the field ones (`victory`, `defeat`);
cast them with synths for an electronic game.
