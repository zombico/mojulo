# Game audio

A game's audio is two pages of its book, owned by two departments.

- **The sound** (the play department's `sound` chapter): which sound on the SFX shelf plays each thing the game
  does. [sfx-shelf.md](sfx-shelf.md) has the shelf and the sound sheet.
- **The score** (the music department's `score` chapter): the game's music, by request.

The music department also owns **the audio direction**, the game's taste in sound. Both pages read it.

Code: [control/lib/graph/gameworld/](../control/lib/graph/gameworld/): `audio-direction.js`, `cue-sheet.js`,
`sound-sheet.js`, `sound-book.js`.

## The recipe

```js
music: {
  direction: { style?, identity?, cast?, sfx?, space?, ui? },
  cues: { '<request id>': '<mood>' | { mood, style?, seed?, cast? } | false },
}
sound: { style?, slots?, on?, weapons?, moves?, guns?, foes?, run?, ride?, bed?, vary? }
```

A game with neither key builds the levels it built: nothing is laid behind its back. `sound` puts a game on the
sound sheet; `music` (even `music: {}`) puts it on the cue sheet and gives its levels a space on the mixer.

A run and gun (a feel whose template's charge is a shot: Galaxy Boy's) hears its own events too, `run`: the buster's
tap, its charged round and the full charge's (energy, synthesized: the arm cannon set, `sfx-shelf/sets/buster.js`), the charge held as a hum that rises as it fills; the hero's dash, wall kick,
slide down a wall and a blow taken; a foe's round leaving, a robot struck, a heavy's armour glancing a round off, a
wreck, a boss blown apart; a thrown rock heaved, flying, landing or shot apart; the boss room's shutter coming down; a
boss's treads as a held engine by its speed and its exhausts' steam as a held hiss; a foe stomped on. Each foe also
sounds by what its kind does (`run.foes`, by its class: a robot sparks on as it first comes into the frame, a creature
the shelf voices calls, a hopper springs, a charger revs as it braces and slams into what stops it, a swooper swells
as it dives, a turret fires its own round, a heavy turret a cannon). Each is a shelf word (`RUN_SOUNDS` in `gameworld/sound-sheet.js`, a game's
`sound.run` over it, `false` for none) played by the page's run channel (`scene/channels/run-audio.js`). A foe is
heard while it is on the screen, a little past its edges, never across the level. A hero with no buster (Zero Boy's
saber) keeps the rest and swings with the sheet's blade. The rail writes `sound: {}` and an electronic score for a side
scroller, so its first level is heard from the first build.

A side map's boss has its own piece: the cue sheet asks for it (`boss:<level>`, an electronic game's `peak`), and the
level changes to it on the bar line, for good, once the boss's room has shut behind the hero (the level's audio
`boss`, beside its `combat`); the fights before it come in with the tension as any level's do.

## The audio direction

What the art direction is to the picture. Solved from the game's words where the game writes none.

| field | what it is | when unwritten |
|---|---|---|
| `style` | `field` (the orchestra) or `club` (electronic) | the orchestra, unless the game's words say electronic |
| `identity` | the seed of the score identity: key, hall, motif, palette | the game's own, from its ref |
| `cast` | who plays each job across the game's cues | the identity's players |
| `sfx` | the SFX shelf style the sound sheet speaks | `mouth` |
| `space` | the mixer space every level is heard in | each level's place (a cave a cavern, a room an interior, else open) |
| `ui` | the interface's sound set | one that sits with the score's style |

**Taste is advice.** The department says where the sound sheet sits badly with the score (`tasteNotes`: chiptune
effects under an orchestra). It is shown in the sound book. It never refuses a sound or changes one: play decides.

## The cue sheet

Every department that needs music asks for it; the music department answers each request with a cue on the game's
one identity, in the direction's style and cast (`cueSheet`).

| who asks | the request | its id |
|---|---|---|
| the flow | the title, the menus, the credits (the screens the game's flow has) | `title`, `menu`, `credits` |
| the levels | each level's place | `level:<id>` |
| the foes | a level's fights, a level's boss | `fight:<id>`, `boss:<id>` |
| the story | each cinematic the flow plays | `cinematic:<scene>` |
| the build | a level won, a level lost | `victory`, `defeat` |

An answer is a mood of the field score or the club score. A level's place is read as a quick game's `music: 'auto'`
reads it (`beats/score-suggest.js`); a fight is `battle` (or `rave`), a boss `boss` (or `peak`). `music.cues` names
another mood for a request, or `false` for silence. An id nothing asked is listed (`unasked`).

**Where it plays today.** A level's cue is its soundtrack, and its fight or boss cue comes in with the tension
(`levelScore`, the adaptive music), on every level the game builds. A quick game's own `quick.music` still wins.
The outcomes' stingers play when a level is won or lost: a game's shell plays stored beats sketches, so a run mints
each as a step of the score's chapter (`cue-victory`, `cue-defeat`, at `<ref>-cue-<id>`) and the game names them
(`music.victory`, `music.defeat`). A changed answer remakes its cue in place. The screens' score is the title cue
(else the menus'), minted the same way (`cue-menu`) and named `music.menu`: the play shell loops it while a screen is up
(the title, the menus, the results between levels), stops it as a level launches and holds it under a stinger. A
browser lets it start only once the player has pressed something, so the first title is silent until then. The
credits' and the cinematics' cues are on the sheet and not yet played.

**A level is heard on the keys.** A level's sound starts on the player's first press: a click on the page, a key, or
the game shell's word that sound is on (the shell's frame delegates autoplay, so a key pressed on the title is enough).
A game played on the keys in the shell was silent before.

**Stand-ins.** The generators have no title theme and no cue that ends. Until they do, the title, the menus, the
credits and the cinematics are answered by the nearest mood that exists, marked `stand-in` and listed as owed.

## Where a person listens, and what an agent is told

- **The sound book** (`/api/sketches/<ref>/bible?book=sound`): every sound, its shelf word and why, each playable.
- **The score book** (`/api/sketches/<ref>/bible?book=score`): the direction, every request, who asked, the cue and
  why, each playable. A level's cue plays the tune its made level plays.
- **`design_game`'s readout** suggests a `sound` and a `music` to a game that writes neither (a `next` step each,
  with its patch, its book and its card). Suggested, never laid: each changes every level's bytes.
- **The cards** `gameworld-sound` and `gameworld-music` (`get_game_vocab`) are the manuals a department is handed
  with the `sound` and `audio-direction` chapters.

## Gates

Machine: every request has an answer, a silence or an owed line; every cue of a game carries one identity; a game
with no `music` builds byte-identical levels. Ears: whether a cue fits its place and the cues sound like one score
is the creator's to hear. Never say it passed.
