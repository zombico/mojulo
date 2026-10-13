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
  night, tension, triumph …); `create_beats({ score })` lists them.
- `{ beatsRef: '<ref>' }`: a stored beats row (ambient, composition or pattern), inlined at resolve time.
- An inline beats recipe (`beats-ambient`, `beats-composition`, `beats-pattern`).
- Which mood: `compose_world` and `create_game` suggest one from the place (base, theme, kit, title, time) and the
  play (a fight darker and driving, a sneak toward tension, a race driving, the last level lifted), with a `why`.
  `create_game`'s reply carries each unscored level's update_sketch call; `design_game({ quick: { music: 'auto' } })`
  writes it at mint.
- A composition always loops here, at the next bar line. Engine exports (Godot, Unity, Unreal) render the same
  soundtrack as a looped WAV bed.

## sfx

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

- `bindings`: `[{ source, range: [from, to], target: { channel, macro, range: [from, to] }, entity?, point? }]`.
  `source` is depth, height, speed or proximity (proximity needs `entity` or `point`); `macro` is tone, level or
  transpose on a soundtrack row.
- `beat`: `true` or `{ lead }` puts `{ type: 'beat', n }` on the bus `lead` seconds (default 0.15) before each beat
  of a steady-tempo soundtrack: the clock a rhythm level plays to.
