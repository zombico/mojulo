# Set pieces

A set piece is the cinematic action game's signature moment: an insane run or stunt the player plays through while the
camera is directed like a film. The rooftops give way, a blast throws dust across the frame, the camera swings round
in front of the hero to show what chases them, and at the one beat a body cannot do on the stick alone, a prompt asks
for a single press. Lost Nomad is the rail that makes them (`gameworld/rails.js`, after Uncharted).

It is one recipe of data (`gameworld/set-piece.js`), lowered onto parts the runtime already has:

| part | where | what it does |
|---|---|---|
| the chase line | `worlds/controllable/chase-line.js` | the way through the level; while it holds the hero the stick is read along it, never the camera |
| the track camera | the same file, the camera rule `track` | the camera keyed by where the hero is along the line |
| the prompts | `worlds/controllable/prompt.js`, drawn by `scene/channels/prompt-mana.js` | one button in a window, and what a miss costs |
| the beats | the level's cues (`playscape/ui/cues.js`) on the line's marks | the world's own verbs: a blast, a shake, an explosion, a spawn |
| the pursuers | the chase line | bodies that run the line behind the hero and catch one who stops |

```js
setPiece: {
  id: 'rooftops', line: [[0, 0], [38, 0], [38, 34]], half: 2.6, z: 6,
  cams:    [{ at: 0, frame: 'chase' }, { at: 7, frame: 'lead', fov: 68 }, { at: 17, frame: 'low', cut: true }],
  beats:   [{ at: 31, id: 'blast', do: [{ explode: { at: [36, -6, 6] } }, { shake: 0.9 }] }],
  prompts: [{ at: 22.5, id: 'grab', says: 'Grab', slow: 0.3 }],
}
```

The stunt room (`gameworld/stunt-room.js`, the practice door's `stunt`) lays one on greybox rooftops for a world on Lost
Nomad's feel, so the set piece is played before there are levels.

## The principles

- **The stick follows the way, not the lens.** The camera is free to turn round in front of the hero only because the
  controls do not turn with it: up always runs down the line. Never ask a player to steer toward the camera.
- **The camera swings round the hero, never through them.** Between two keys it orbits the hero at their distance;
  going from behind to ahead it passes beside them. A `cut` is a cut and holds the line of action.
- **Key it from the start, in more than one frame.** A set piece is directed: `lead` to show what is behind, `low` to
  make a jump tall, `wide` to make a blast big, `profile` to show speed. One frame all the way is a corridor.
- **Every beat lands in frame.** Put the camera key that shows a beat a little before it, so the frame has settled when
  it goes off.
- **Few prompts, and only where the stick cannot do it.** The run carries the set piece. A prompt is for the grab at the
  far edge, the climb as the roof tips, the struggle: one every 15 m at most. A vault, a jump or a sprint is the
  stick's, never a prompt.
- **Told, fair, one thing, recoverable** (the prompt's laws, held by its reader). It is shown before it opens (at least
  0.35 s), open long enough to answer (at least 0.4 s on the screen's clock, however slow the world), asks for one
  button, and says what a miss costs. The default miss puts the hero back on the line a few metres before it, to run
  at it again.
- **Readable at the hero's pace.** Each prompt is over before the next one comes, at the speed the hero runs.

The laws (`setPieceLaws`) are advice, never a refusal: on the line, directed, few, readable.

## Gates

- **Machine:** the stick runs the same way under any camera (`chase-line.test.js`); the track camera keeps the hero in
  frame at every step and cuts only on a cut key; a prompt hits on its window's middle and misses a frame after it
  closes (`prompt.test.js`); the stunt room is played in headless Chrome, a bot clearing it on the windows' middles and
  put back by a late press (`stunt-room.live.test.js`).
- **Eyes:** whether the camera reads as directed and each prompt feels earned is the person's to play.

## Where it is laid

- **A designed game's level**: `levels.<id>.setPiece`, laid on the level's first stage (its chase line, camera,
  prompts, the world clock's moments, its pursuers' bodies and its beats as the level's cues); a level without one is
  byte for byte the level it was.
- **The stunt room**: the practice door's, for a world on Lost Nomad's feel.

## Pursuers

`pursuers: [{ id?, figure?, gap?, catch?, pace?, speed?, back? }]` run along the line behind the hero while it holds
them: held `gap` metres back behind a hero who runs faster than their `pace`, closing on one who slows or stops. Within
`catch` the hero is caught, put back down the line and the bus hears `chase:<line>:caught`. Key a `lead` frame where they
should be seen: it stands ahead of the hero looking back, so they are in it.

## Not yet

- A collapse in the stunt room: a `collapse` beat breaks a level's breakable things (a stage's buildings, its walls
  and set-piece things under a `destruction` degree), and a practice room lays none; its beats are shakes, dust and an
  explosion.
- A vehicle chase (the `crewed` package): the line is what a vehicle would drive.
