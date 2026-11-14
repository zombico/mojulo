---
{
  "id": "film-studio",
  "name": "Film studio (a film of scenes: its departments, boards, cut and Blender packs)",
  "family": "motion",
  "entry": "forge_motion",
  "summary": "A FILM of several scenes with one cast, its sets, its look and its edit, made the way an animation studio makes one: in departments and waves, each scene boarded and approved by the person, then cut as an animatic with its voices and dubs, then filmed in Blender scene by scene (resumable).",
  "when": "Reach for this on 'a short film in three scenes / an animated short with my characters / make the whole film / the edit / approve the boards / the animatic of the film / render every scene in Blender / an episode'. One scene alone is the scene-film card."
}
---

A film is a stored recipe (a sketch of kind `film`). Its page is its book: the departments' table, what to do next,
and each scene with its board strip, its script, its advice and its approval. Every scene is played by the same core
as one screenplay forged alone (`get_motion_vocab({ id: 'scene-film' })`), so a scene's words are that card's words.

## Write it

```
forge_motion({ film: { write: {
  title: 'The Key', look: 'anime',
  cast: { ada: { persona: 'sk_…' }, jon: { hero: 'sk_…', style: 'thespian' } },
  sets: { room: 'sk_…' },
  scenes: [
    { id: 'door', set: 'room', cast: { ada: {}, jon: {} }, script: 'ADA: You kept the *key*.\nJON (worried): I kept everything.',
      voice: { 1: '/abs/l1.wav' }, dub: { fr: { 1: { audio: '/abs/fr1.wav', text: 'Tu as gardé la clé.' } } } },
    { id: 'end', cast: { jon: {} }, script: 'JON: She never asked.' } ],
  edit: { order: ['door', 'end'] } } } })
```

- The cast is the film's. Each part plays from a `persona` or a `hero` (none: the default realistic hero, advised),
  with its `register`, `style`, `role` and `height`.
- A scene names who is in it. `cast: { <who>: { mark?, style?, role?, register? } }` gives the scene's words over the
  film's.
- A set is a stored world, named once in `sets` and used by any scene's `set`. A scene's `hour` is the time of day
  it is shot at there (the `scene-film` manual): one set, any hour.
- **A set can be asked for, with no world made first.** `sets: { lake: { words: 'a grassy field by a lake at dusk',
  seed? } }` says a land in words; `sets: { street: { cube: 'valley-morning', show: 'geotown', seed? } }` names a
  geocube preset and how it is laid (`path`, `trail`, `town`, `geotown`, `geocity`, `hall`; the presets and words are
  the geocube's: `get_sketch_vocab({ id: 'geocube' })`).
  - The film makes the place once, when it is written, and keeps its ref beside the words. The same words and seed
    are the same place.
  - Edit the film and the place is kept. Change the words and the same world is changed in place.
  - The readout's `sets` says what the words read; a word nothing read is advised (`words-unread`). A place is made
    of the land, what grows, the water, the sky and the hour: a thing or a person is not read (dress the scene with
    it, `props`).
  - A town or a city takes longer to make than a land, a city minutes.
- `look`: `film` | `anime`. `grade`, and `grain` (`twos`), cover the whole film.
- `render: { light: 'setups', dof, motion_blur, samples }` sets the Blender render for every scene (the `scene-film`
  card). The Look and light department owns it.
- `edit.order` is the order the scenes play in.
- Recordings are bound as they are written, so the row keeps no path.

Then edit in place: `film: { ref, patch: [{ op: 'set' | 'remove', path: '/scenes/1/script', value }] }`. A call
with only `{ ref }` reads.

## The departments, in waves

`script` and `edit` are the main agent's. The others can be a subagent's each, a wave at a time.

| Department | Owns | Answers |
|---|---|---|
| script | the scenes' words | a scene that does not play, no one moving, a slowed line |
| casting | who plays each part | a part with no body, a part in no scene |
| set | the worlds, the marks | a wall between a camera and the actors, speakers too far apart |
| performance | style, role, register | a speaker turned away, a speaking extra |
| camera | the coverage, the grain | a shot held too long, no close-up, a cross that flips the line |
| voice | recordings and dubs | a recording for other words, a dub running over, a half-recorded scene |
| look | look and grade | |
| edit | the order | |
| render | boards, cut, packs | an unapproved board, a scene changed since its approval |

The waves are script and look, then casting, set and edit, then performance and voice, then camera, then render.

## A cutscene made to order

Another studio (the game studio, for one) hands over what it already has and gets a cutscene back.

```
film: { order: {
  title: 'The meeting at the lake', from: '<the game\'s ref>', for: 'the prologue',
  cast:   { ada: 'sk_…', jon: 'sk_…' },            // its characters: a persona's or a hero's ref (or { persona | hero })
  places: { lake: 'sk_…', street: 'sk_…' },        // its geocubes, levels, rooms: the sets (or a place asked for:
                                                    //   { words } | { cube, show }, as a film's `sets`)
  events: [{ id: 'arrival', place: 'lake', who: ['ada', 'jon'], notes: 'Ada finds Jon waiting. He has bad news.' },
           { id: 'parting', place: 'street', notes: '…', script: 'ADA: …', props: { car: { thing: 'sedan', at: [3, 2] } } }],
  deliver: 'animatic' } }                            // or 'film': the scenes rendered in Blender
```

- **It writes a film**, kept like any other: the cast is the client's characters, each place a set, each event a
  scene in the order given. The brief is kept in the film (`order`) and shown at the top of its book.
- **An event is the client's notes on what happens.** Where the client wrote a `script`, the scene plays it as given.
  An event with notes only is `unwritten`: the script department is advised to write its screenplay from the notes
  (`film: { ref, patch: [{ op: 'set', path: '/scenes/<n>/script', value }] }`). It does not play until then.
- **The readout's `order`** says each event's state (`unwritten`, `written`, `boarded`, `approved`, `cut`, `filmed`,
  `rendered`), which events the client is still `waiting` for, and whether it is `ready`: every event cut into the
  animatic, or rendered where the order asked for the film.
- **`film: { ref, deliver: true }`** hands it back: the film's ref and book, the animatic (`animatic`, and
  `animatic_file` to copy), the rendered cut where there is one, and each event's state and board. An order not ready
  is handed back as it stands and says what is `waiting`. A change after the hand-back reads as not current.
- **`film: { ordered_by: '<the client\'s ref>' }`** lists every film that client ordered and how far each has got.
  This is how the client finds its cutscenes.
- **A game plays it.** A game's flow takes the film as a cutscene: a cinematic step `{ kind: 'cinematic', film:
  '<the film\'s ref>', next }`, or a slot of the default flow, `cinematics: { opening | prologue | ending: { film } }`.
  The game keeps the ref; the video is found each time the game is served or exported (the scenes rendered in Blender
  where they are, else the animatic), so a cutscene made again is the one that plays. `export_game` copies it into
  `assets/cutscenes/`. A film with no video yet is passed over and named in `cutscenes_missing`.
- Everything else is the film's own: its departments advise, its boards are approved by the person, its runs are the
  same.

## Approve, then run

- **`film: { ref, run: 'storyboard' }`**: every scene's board in seconds, with no actor minted. The run's page is the
  film's book with each scene's panels.
- **`film: { ref, approve: { <scene>: 'board' } }`**: the person's call, made after they have looked. It is stamped
  with what the board was drawn from, so a later edit reads as `stale`. `null` withdraws it.
- **`film: { ref, run: 'animatic' }`**: ONE cut (`motion.mp4`), every scene's panels on one clock.
  - Its voice track is the scenes' recordings laid end to end.
  - Each dub is its own track. A scene with no dub falls back to its own voice.
  - Captions are joined the same way, and each language is a tagged audio track and subtitle track.
- **`film: { ref, run: 'blender' }`**: each scene's Blender film pack under `scenes/<id>/blender/`, plus `cut.py`,
  which joins the scenes' renders in order, picture and sound.
  - Minting is minutes per scene, and each hero is minted once a call. The call works until its budget
    (`MOJULO_RUN_BUDGET_MS`, else 300 s) and returns `pending`. Call it again: scenes already made at their current
    stamp are kept.
  - **The render worker renders it, on a machine with Blender:** `node scripts/render-film.mjs <the run's folder>
    --preset final [--budget-min 60]`.
    - Each pack is built once and rendered chunk by chunk, a chunk never crossing a cut, then encoded with its voice.
      `cut.py` then joins the scenes.
    - It is resumable: frames on disk are never rendered again, and running it again goes on.
    - Its `render.json` is what the readout shows: each scene's frames done and whether it is encoded. The next move
      names the command.
  - The tool never launches Blender.

`scenes: [<id>]` limits any run to those scenes. Rendering unapproved boards is allowed, and the readout says so: the
gate advises and never refuses.

## Not yet

- Cuts only: `edit.cuts` is kept but the cut joins scenes with cuts. There is no music or SFX bed yet.
- Panel edits are written as script and coverage changes in words; a panel cannot be dragged.
