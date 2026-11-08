# The practice room: a game's swings, strings and weapons, tried on one foe that never dies

The single-foe practice mode of a stylish action game is the whole game's engine: one foe, a bare room, every swing,
string, weapon, guard and parry tried on it. This room is the game minus its level, on the runtime the game ships, so
what is tuned here is what every level plays. A spike: nothing registers a kind, a door, a tool or a recipe field.

```sh
# from control/, with the data directory a game was made in (docs/examples/the-old-keep/README.md: Rebuild it)
export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…
node scripts/spikes/practice-room/measure.mjs                    # the sword templates measured headless (machine gate)
node scripts/spikes/practice-room/measure.mjs --page <level.html> --feel '<the game feel>'   # a built game's own pilot
node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--combos my.json] [--cdn]  # the room page
```

## The measures (`measure.mjs`)

A game's melee played headless on `stepWorld` (scripted presses at 60 Hz, as `gameworld/feel/reach.js` measures a jump)
against a dummy that never dies, each number beside what the feel card asks for: carried, partly or lost. Press to
contact, the swing to rest, when the next press is taken, the string (mashed, and with its sides alternated), the
hitstop, the foe's stun and the advantage, the lunge, the reach, the dodge's frames and invincible frames, the guard.
The rule is a template's (`--feel`, the held weapon's `--class`) or a built level's pilot, byte for byte (`--page`).

## The room (`room.mjs`)

A `controllable` manifest resolved by `world-scene.js` and emitted as `export_game` emits a level: a 24 m ring of 1 m
tiles in two greys (distances read off the floor), a low wall, four pillars and a ledge (`hold: false`). The hero is the
game's first level's pilot (its rule, its figures, its orbit camera, its lock-on); the foe is that level's first foe
(`--pack n` for several), never dying and standing still until its AI is switched on.

Inputs: L light (left click, a pad's left face), H heavy (right click, its top face), S the weapon's sidearm (the
mouse's forward button, its right face; held: the bow draws and looses on release once ready, the pistols fire while
held), the weapon cycle (R, the mouse's back button, the right shoulder), jump on the bottom face. Keys: P the foe's AI
on and off, K the foe set back (and stood up), H the HUD. The HUD (top left) reads the live world
each frame: the last move's clip, press to contact, the swing to rest, when the next press was taken, the hitstop, the
foe's stun, the advantage and the string's count, each beside the card's number; and the presses, each taken or dropped
with its reason (the first click takes the mouse, mid-swing, cooling down, not ready, in the air, dodging).

Checked headless (software rendering, about 10 frames a second, so its frame counts are coarse): the page is up in a
second and a half with no error, the AI starts off, real clicks strike, the foe takes its hits and stands, the log says
why each click was dropped. Nobody has played it; the eyes gate is the operator's.

## What the measures found (The Old Keep's sword, the three templates)

Every template swings the held weapon's 0.5 s whatever its card asks (cards of 23 to 27 frames play as 33 to 36), so
the stylish game, the adventure and the knight swing alike. The next press is taken only once a swing has ended; a
string is the opener and one follow-up in another direction, then 2.5 s locked. The hitstop is carried; the lunge, the
card's hitstun and the guard and parry are lost; the dodge is invincible all through. Each is the room's next fix, one
a step, each moving its number.

## Combos (`lib/graph/gameworld/combos.js`)

The room plays a combo manifest, every combo unlocked, and writes it beside the page (`combos.json`): the list a game's
director takes, the progression laid over it later. Inputs: L the left click (the pad's left face), H the right click
(the top face), S the mouse's forward button (the right face).

```json
{
  "timing": { "buffer": 12, "late": 14, "pause": [16, 50] },
  "moves": {
    "cut-1": { "swing": "neutral", "role": "opener", "frames": 24, "cancel": 15, "travel": { "kind": "step", "m": 0.25 } },
    "cut-2": { "swing": "left", "role": "filler", "frames": 24, "cancel": 15, "travel": { "kind": "step", "m": 0.25 } },
    "cleave": { "swing": "back", "role": "finisher", "frames": 44, "travel": { "kind": "lunge", "m": 0.8 }, "damage": 2, "impact": 3, "topple": true }
  },
  "combos": [{ "id": "three-cuts", "name": "Three cuts", "beats": ["L", "L", "L"], "moves": ["cut-1", "cut-2", "cleave"] }]
}
```

A move: `swing` (neutral, forward, back, left, right: the held weapon's swings), `role` (opener, filler, finisher,
launcher), `frames` and `cancel` (60 fps), `travel` (none, step, lunge, and its metres), `damage`, `impact`, `topple`,
`launch`. A combo: its `beats` (L, H, S, and `.` a pause) and one move a press. Combos that share an opening are one
string that forks. A press with a move to chain into is held to the live move's cancel; any other press is remembered
`buffer` frames; a press up to `late` frames after a move still chains; a pause beat is a press `pause` frames after.
Held (`L+`) and mashed (`L*`) beats are named and not played yet.
