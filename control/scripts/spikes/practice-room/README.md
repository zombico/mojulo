# The practice room: a game's swings, strings and weapons, tried on one foe that falls and comes back

The single-foe practice mode of a stylish action game is the whole game's engine: one foe, a bare room, every swing,
string, weapon, guard and parry tried on it. This room is the game minus its level, on the runtime the game ships, so
what is tuned here is what every level plays. The room itself is now the recipe's (`lib/graph/gameworld/practice-room.js`,
its page `practice-room-page.js`), served by a gameworld as `bible?book=practice` and linked from design_game's readout
(`practiceRoom`) as soon as the world writes a feel that fights hand to hand; `room.mjs` is its CLI and `measure.mjs`
the measures, still a spike.

```sh
# from control/, with the data directory a game was made in (docs/examples/the-old-keep/README.md: Rebuild it)
export MOJULO_DATA_DIR=… MOJULO_OUTCOMES_DIR=…
node scripts/spikes/practice-room/measure.mjs                    # the sword templates measured headless (machine gate)
node scripts/spikes/practice-room/measure.mjs --page <level.html> --feel '<the game feel>'   # a built game's own pilot
node scripts/spikes/practice-room/room.mjs --game keep-hero --out /abs/dir [--pack 3] [--kit fallen-angel] [--combos my.json] [--hero anime] [--cast female] [--strings 2.5] [--cdn]  # the room page
```

## The measures (`measure.mjs`, over `lib/graph/gameworld/feel/measure.js`)

The feel chapter's machine gate, carried by design_game's readout as `feel.measured` (a loss is a `feel` step in
`next`). The room's hero, armed as the page arms a held blade, played headless on `stepWorld` (scripted presses at
60 Hz, as `gameworld/feel/reach.js` measures a jump) against a dummy that never dies, each number beside what was asked:
carried, partly or lost.

- **The kit:** every ground combo of every weapon played as written, each press early (held to the live move's
  cancel), on a dummy just inside the weapon's reach. For each move: its contact inside its window; the frame the next
  beat is taken at against its cancel (the last move's length against its frames), less the frames its own hitstop
  froze it; and the ground its travel covers, on a dummy out of the way.
- **The card:** the hitstop of the first blow (inside the card's base to max), the foe's stun (where the card asks the
  rule's), the dodge's frames and invincible frames, and the guard's parry window.
- **Not measured:** the air strings (they start from a jump) and the sidearm's press are named, not played.

`--feel` one template's room, `--game` a stored game's, `--page` a built level's own pilot, byte for byte.

## The room (`room.mjs`)

A `controllable` manifest resolved by `world-scene.js` and emitted as `export_game` emits a level, built from the
gameworld alone, no level needed: the feel template's own stage (`feel/cards.js` STAGES, the floor the stick view plays
on) in 1 m tiles of two greys (distances read off the floor), its blocks and a low wall round it (`hold: false`; the
24 m ring with four pillars and a ledge where a template has no stage). The hero is the game's own where the run has
made it (its sketch and its sheathed twin), else a stand-in on the template's body (`--cast`, `--hero` another body),
the world's blade in its right hand and on its back out of a fight; on the feel's rule, the orbit camera and the
lock-on, and the arsenal (the world's `arsenal`, else its template's kit, else the basic one). The foe is the
bestiary's first, its sketch where the run made it, else a person of its class standing in (`--pack n` for several),
standing still until its AI is switched on, two metres ahead of the hero. Its hp is `--strings` (2.5) of the hero's first
combo, measured on the resolved hero and foe headless (the runtime's own blows, its combo scaling and all); felled, it
plays its fall and comes back where it stood, whole, three seconds on.

Inputs: L light (left click, a pad's left face), H heavy (right click, its top face), S the bow, the loadout's one
sidearm whatever is in hand (the mouse's forward button, its right face; held, it draws, and looses on release once
ready; the hero takes the archer's aim, the blade on its back, and can walk with it up), the weapon cycle (R, the mouse's back button, the right shoulder), the guard held (Shift, the left shoulder: from the
front a blow is blocked, or parried when it comes within the window of raising it), jump on the bottom face. Keys: P the foe's AI
on and off, K the foe set back (and stood up), H the HUD. The HUD (top left) reads the live world
each frame: the last move's clip, press to contact, the swing to rest, when the next press was taken, the hitstop, the
foe's stun, the advantage and the string's count, each beside the card's number; and the presses, each taken or dropped
with its reason (the first click takes the mouse, mid-swing, cooling down, not ready, in the air, dodging).

Checked headless (software rendering, about 10 frames a second, so its frame counts are coarse): the page is up in a
second and a half with no error, the AI starts off, real clicks strike, the foe takes its hits and stands, the log says
why each click was dropped. Nobody has played it; the eyes gate is the operator's.

## What the measures found (the templates' rooms, 2026-11-10)

Every template that fights hand to hand carries its kit: every contact lands in its window, every string chains at its
cancel, and every finisher plays its length and every travel its metres. Fallen Angel is 39 carried and 2 partly;
Fable of Artesia is 23 and 2. Two numbers of the card fall short on every template that asks them:
- **The stun:** the foe reels 13 or 14 frames where the card asks 27 or 30. The card's hitstun is not lowered onto the
  foe.
- **The dodge:** it is invincible all through (24 of 24 frames) where the card opens a window (13).

The first measures, before the moveset (every swing the held weapon's 0.5 s, the next press only at its end), are in the
git history of this file.

## The game's arsenal (`lib/graph/gameworld/arsenal.js`)

What the room settles reaches the game through its `arsenal` key: a template's kit by name (`'fallen-angel'`), the kit
with edits over it (`{ from: 'fallen-angel', timing: { buffer: 16 }, weapons: [{ id: 'sword', moves: { stinger: { frames:
28 } } }] }`: moves merged move by move, a weapon or a combo `{ id, drop: true }` dropped, a move `null` dropped),
`'auto'` (the feel template's kit), or a whole arsenal. Every level lays it on its hero that strikes (a right-hand blade):
the weapons, the moveset, the sidearm, and the juggle's rules on the foes. The room plays the game's arsenal when it
writes one (`--kit` over it). design_game's readout suggests `'auto'` for a striking hero whose feel's template has a kit;
it is never laid unasked.

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
