# The practice room: a game's swings, strings and weapons, tried on one foe that never dies

The single-foe practice mode of a stylish action game is the whole game's engine: one foe, a bare room, every swing,
string, weapon, guard and parry tried on it. This room is the game minus its level, on the runtime the game ships, so
what is tuned here is what every level plays. A spike: nothing registers a kind, a door, a tool or a recipe field.

```sh
# from control/, with the data directory a game was made in (docs/examples/the-old-keep/README.md: Rebuild it)
export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…
node scripts/spikes/practice-room/measure.mjs                    # the sword templates measured headless (machine gate)
node scripts/spikes/practice-room/measure.mjs --page <level.html> --feel '<the game feel>'   # a built game's own pilot
node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--cdn]  # the room page
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

Keys: P the foe's AI on and off, R the foe set back (and stood up), H the HUD. The HUD (top left) reads the live world
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
