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
- A composition always loops here, at the next bar line.

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

`mix` (opt-in, on either form) puts the level's cues through the SFX mixer: `{ space?, send?, voices?, distance? }`.
`space` is `open`, `interior`, `hangar`, `cavern` or `vacuum` (no air: no space, the sound dulled as it comes
through a hull), or `{ decay, predelay?, damp?, level? }`. `send` (0..1) is how much of a cue reaches the space where
its layers name none. `voices` caps the cues sounding at once (a quieter new cue is dropped, a louder one steals the
quietest). `distance` (on unless `false`) places a combat cue by its source's distance from the pilot: duller and
roomier the farther it is, as well as quieter. A cue's `duck` gesture dips the score under it. Layers, ducks and
spaces are in `get_beats_vocab({ id: 'beats-sfx' })`.

## gait, body and weapon sounds

These read the controllable entity's state and never write back.

- `footsteps`: `step` on each half gait, `jump`, `land`. `true` takes chiptune defaults.
- `jump`: `{ charge: { level }, release: { level }, land: [gestures], landRef }`, the stop-and-charge jump.
- `thruster: { level, voice? }` and `jump.charge.voice`: a held voice (`get_beats_vocab({ id: 'beats-sfx' })`,
  "Held voices") played in place of the channel's own synth, driven by the thrust or the charge.
- `dodge`: one gesture list fired per roll.
- `weapon`: `{ shot, hit, reload, switch? }` gesture lists (`switch` when a gun is drawn); a weapon's own
  `sfx: { shot, hit, reload, draw }` wins over them.
- `burst`: a gesture list played where a travelling round (a rocket, a grenade) bursts.
- `strike`: `{ swing, hit }` gesture lists (melee).
- `moves`: an action game's moveset (combos, a guard, a bow) by the ids of its `sfx.cues`: `swing` and `hit` as
  `{ <weapon>: { light, heavy?, finisher? } }` (a heavy is a move its H beat took), and one cue each for `block`,
  `parry`, `break`, `draw`, `loose`, `arrow` (a foe struck by no blade), `felled`, `cycle`, `foeSwing`, `hurt`. Name
  the cues from the SFX shelf by word (`katana-swing`, `blade-hit`, `block`, `blade-clash`, `bow-shot`…).
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

## in an engine

The web build is the game, and plays all of this. A team's engine takes a level's assets, animation and markers
(`export_model({ engine: 'godot' })`), not its rules: the level's sound is the web build's, and the handoff carries no
audio yet (its soundtrack and cues as files beside it are to come).
