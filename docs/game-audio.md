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
sound: { style?, slots?, on?, weapons?, moves?, guns?, foes?, ride?, bed?, vary? }
```

A game with neither key builds the levels it built: nothing is laid behind its back. `sound` puts a game on the
sound sheet; `music` (even `music: {}`) puts it on the cue sheet and gives its levels a space on the mixer.

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
(`music.victory`, `music.defeat`). A changed answer remakes its cue in place. The flow's cues (title, menus,
credits, cinematics) are on the sheet and not yet played: the play shell scores no flow step.

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
