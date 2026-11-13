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
- A set is a stored world, named once in `sets` and used by any scene's `set`.
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
