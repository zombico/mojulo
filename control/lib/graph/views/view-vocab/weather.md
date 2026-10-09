---
{
  "id": "weather",
  "name": "World weather (a sky that changes)",
  "family": "world",
  "entry": "compose_world",
  "summary": "Weather for ANY /world: a climate (what the sky does here and how often), played as moving fog, rain, snow, dust or petals round the camera, storms with lightning, drawn in the art style's own air. Rolled on a dice from the seed: the same sky at every moment.",
  "when": "Reach for this on framing like 'make it rain / a snowstorm / fog rolling in / a dust storm / a thunderstorm / a misty morning / a monsoon / petals drifting / weather that changes / a stormy highland / the sky should do something', and for how it sounds ('rain on a tin roof', 'thunder')."
}
---

Weather is a kind-generic channel: pass it to `compose_world` as `overrides.weather` (any base), or set `weather` on a stored world's recipe. Nothing here is a render or a recording: the recipe names a climate and a seed, and every moment of the sky is a pure function of the world clock.

## Spec shape

```
weather: '<climate>' | '<state>' | {
  climate:  '<climate>' | { <state>: weight, … },   // what the sky does here, and how often
  dwell?:   [lo, hi],      // seconds one state holds (each slot rolls its own); default 90–240, 5 or more
  blend?:   seconds,       // how long a change takes (0 to the shortest dwell)
  start?:   '<state>',     // what the world opens in (else the dice)
  surface?: 'leaf' | 'stone' | 'tin' | 'water' | 'sand' | 'snow',   // what the fall lands on (impacts and sound)
  air?:     { hue?, shade?, depth?, cast?, body?, steps?, skyFollow?, states? }   // tune the style's air (below)
}
```

- **States** (designed in values, never hue): clear, haze, overcast, mist, fog, drizzle, rain, downpour, thunderstorm, snow, blizzard, dust, duststorm, petals, leaves.
- **Climates** (presets): temperate, monsoon, alpine, desert, spring-blossom, autumn, storm-coast. A bare state name is a climate of that one state.
- The same `seed` gives the same sky at every moment; a world's `seed` (else its ref) seeds it.

## The air is the style's

Colour is never in the weather. The style guide owns an air card per kit (`airOfKit`, era/air.js): the fog's hue, the world's SHADE (the style's ambient, never black), how the fog is drawn (smooth, banded in flat planes for a cel look, dithered for a pixel look), what a dust storm or a blizzard is in that style, and how strong cast shadows are. A kit comes from the recipe's `kit` (a stage kit) or `look` (a sixth-gen look); with neither the air is made of the world's haze. `weather.air` tunes any of it: `shade` and `depth` (the world's shadow tone), `cast` (shadow strength, 0 to 1), `body` and `steps` (how the fog is drawn), `skyFollow` (how far the sky gives way to the fog), `states: { dust: { hue: '#c8a060' } }`.

## Cues, sound

- A cue forces the sky: `play.cues: [{ id, when: { enter: … }, then: { weather: { is: 'blizzard', for: 90, blend: 6 } }, until: { leave: … } }]`; `when: { every: 300 }` is a heartbeat ("every five minutes the fog rolls in"). One weather a cue; the sky eases back to its schedule when it ends.
- Sound: `overrides.audio = { weather: true }` (or `{ level, surface }`): a bed, drops and thunder rolled from the sky, nothing sampled. Manual: `get_beats_vocab({ id: 'beats-weather' })`.

## Gates

Machine: the schedule is deterministic per seed; the page's fog, fall and lightning run from it; an absent weather adds not a byte. Eyes and ears: yours, never claimed.
