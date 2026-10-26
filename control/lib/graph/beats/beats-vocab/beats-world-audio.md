---
{ "id": "beats-world-audio", "name": "World audio channel (a world's or level's music and sound)", "summary": "The manifest `audio` key every world base takes: a soundtrack (a field mood, a stored beats row or an inline recipe), bus-event SFX, footsteps, wind, weather, thruster, jump, dodge, weapon and melee sounds, the beat on the bus, and bindings from play to the music. Live /world only; captures stay silent and byte-identical.", "when": "give this world or level music, a soundtrack for a game level, sound effects on game events, a pickup / door / goal sound, footsteps, jump and land sounds, weapon or sword sounds, wind or weather sound, music that follows the player (height, speed, depth, proximity), a rhythm level on the beat, what can a world's `audio` hold" }
---
# World audio channel

`manifest.audio` on any world base (compose_world `overrides.audio`, a level, a game's levels). Every key is
optional; leave `audio` out and the page carries no audio bytes. It plays on the live World page after the
first click (the browser's autoplay rule) and in exported games; muted capture runs never emit it.

```js
audio: {
  soundtrack: 'field:forest',                  // or { score: { mood, seed?, game? } }, { beatsRef }, an inline recipe
  sfx: { cues: { ding: [{ type: 'sweep', wave: 'square', from: 'E5', to: 'B5', dur: 0.08 }] },
         on: { 'pickup:*': 'ding', 'goal:reached': 'ding' }, vary: true },
  footsteps: true,                             // or { step, jump, land } gesture lists
  wind: true,                                  // or { level (dB), freq (Hz), vary }
}
```

## soundtrack

- `'field:<mood>'` or `{ score: { mood, seed?, game? } }`: a generated field score (`beats-field-orchestra`). With no
  `seed` the world's own ref seeds it; compose_world stores a fresh one. Share one `game` across a game's levels so
  they sound like one score. The moods are the field-score moods (plains, forest, desert, town, tavern, chapel,
  night, tension, triumph, battle, boss …); `create_beats({ score })` lists them. `victory` and `defeat` are
  stingers that play once when a level ends (a game's `music.victory` / `music.defeat`), refused here.
- `'club:<mood>'` or `{ score: { style: 'club', mood } }`: generated electronic music (drift, deep, drive, rave, peak;
  card `beats-club`), on the same game identity.
- `{ beatsRef: '<ref>' }`: a stored beats row (ambient, composition or pattern), inlined at resolve time.
- An inline beats recipe (`beats-ambient`, `beats-composition`, `beats-pattern`).
- Which mood: `compose_world` and `create_game` suggest one from the place (base, theme, kit, title, time) and the
  play (a fight is battle music, the last fight the boss; a sneak toward tension, a race driving), with a `why`.
  `create_game`'s reply carries each unscored level's update_sketch call; `design_game({ quick: { music: 'auto' } })`
  writes it at mint.
- A composition always loops here, at the next bar line. Engine exports (Godot, Unity) render the same
  soundtrack as a looped WAV bed. Godot also plays the level's sounds and its `combat` change (see the end).

## sfx

`sfx: 'auto'` (or `{ auto: 'arcade' | 'foley' | 'orchestral' | 'synth', cues?, on?, beatsRef?, vary? }`) gives a level
its action sounds from one word:
- a palette of the same named cues in four voices (jump, land, step, pickup, door, goal, lose, hit, down, death,
  alarm, checkpoint, beat-hit, beat-miss, wave, chime, thud, shoot, reload, swing, strike, dodge). `'auto'` picks
  the one the soundtrack's identity implies (an orchestra, a folk band, a synth; arcade with no field score).
- in the score's key: the game's tonic transposes every pitched gesture.
- wired only to the events the level's mechanics emit (`collect` → `pickup:*`, `door` → `door:*`, `hp-pool` →
  `hit:*` and `enemy:down`, `unseen` → `spotted`, `laps`, `waves`, `on-beat` …).
- with footsteps, weapon, melee and dodge sounds from the same palette, unless the spec names its own.
- what the spec writes wins: its `on` rows first, its cues over a stored pack's over the palette's. `vary` is on
  unless `false`. The same cue fires at most once every 60 ms.

Written by hand instead:
`cues` (inline, the `beats-sfx` shape) and/or `beatsRef` (a stored `beats-sfx` row; inline cues win on a clash).
`on` maps a bus event glob to a cue id: it hears every event the level's bus drains, the incoming facts and the
events reactions emit (`pickup:*`, `door:*`, `goal:reached`, `checkpoint`, `lap`, `hit:*`, `enemy:down`, `wave`,
`beat:hit` …). `vary: true` makes each hit a fresh variant.

## gait, body and weapon sounds

These read the controllable entity's state and never write back.

- `footsteps`: `step` on each half gait, `jump`, `land`. `true` takes chiptune defaults.
- `jump`: `{ charge: { level }, release: { level }, land: [gestures], landRef }`, the stop-and-charge jump.
- `dodge`: one gesture list fired per roll.
- `weapon`: `{ shot, hit, reload }` gesture lists.
- `strike`: `{ swing, hit }` gesture lists (melee).
- `thruster`: `true` or `{ level }`, a roar that swells with boost.

## ambience

- `wind`: `true` or `{ level, freq, vary }`; night defaults quieter and darker.
- `weather`: `true` or `{ level (0..1), surface }`, the manifest's `weather` rolled to beds, drops and thunder.

## music that follows play

- `combat`: a second score (any soundtrack form: `'field:battle'`, `'club:rave'`, `{ score }`, `{ beatsRef }`) the level
  changes to when its tension rises, and back when it settles. The change waits for the playing piece's bar line and
  crossfades over one bar; both pieces play in the soundtrack's identity, so the key carries across. The cues,
  footsteps and wind stay at a steady level throughout. Needs `soundtrack`; can't be combined with `beat`.
- `tension`: `{ on?: { '<event glob>': weight 0..1 }, enter? (0.6), exit? (0.25), hold? (2 bars), decay? (6 s) }`. The
  meter rises with the level's own events (by default the dangers its mechanics raise: hits and enemies falling,
  being spotted, a wave, a leak) and leaks back toward calm. Combat comes in at `enter`; it leaves only after the
  meter has stayed under `exit` for `hold` bars, so it never flaps.
- The suggestions write it for a fight: the scene's own score as `soundtrack`, battle (the boss on the last level;
  rave or peak when electronic) as `combat`.
- `bindings`: `[{ source, range: [from, to], target: { channel, macro, range: [from, to] }, entity?, point? }]`.
  `source` is depth, height, speed, proximity (needs `entity` or `point`) or `tension` (the meter, 0..1: fade a layer
  in as the danger rises); `macro` is tone, level or transpose on a soundtrack row.
- `beat`: `true` or `{ lead }` puts `{ type: 'beat', n }` on the bus `lead` seconds (default 0.15) before each beat
  of a steady-tempo soundtrack: the clock a rhythm level plays to.

## in Godot

`export_game({ target: 'godot' })` carries the level's sound as data its kernel plays: every cue the level sounds
renders to `audio/sfx/` (three takes each when `vary`, never the same twice in a row), fired by the same bus events
and hero moves as the page; `combat` renders beside the soundtrack and changes on the bar line by the page's own
meter; the game's `music.victory` / `music.defeat` play once as a level ends. The pack's buses are Music, SFX and
UI, and the sounds duck the music. Unity carries the explore score only.
