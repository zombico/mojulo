---
{
  "id": "weather",
  "name": "Give a world weather: rain, snow, fog, storms, a sky that changes (and how it sounds)",
  "summary": "A climate for a world's sky: states (clear, fog, rain, thunderstorm, snow, blizzard, dust storm, petals…) rolled on a dice from the seed, played as moving fog, a fall round the camera, landings and lightning, drawn in the art style's own air. Cues can force a state; audio.weather rolls the sound.",
  "when": "\"make it rain\", \"a snowstorm in the pass\", \"fog rolling in every few minutes\", \"a dust storm\", \"a thunderstorm with lightning\", \"a misty morning\", \"a monsoon coast\", \"petals drifting down\", \"weather that changes over time\", \"the world should have a stormy sky\", \"rain on a tin roof\", \"thunder that arrives after the flash\"",
  "entry": "compose_world",
  "form": "world"
}
---
→ `compose_world({ base, overrides: { weather: '<climate>' | { climate, dwell?, blend?, start?, surface?, air? }, audio: { weather: true } } })`. Climates: `temperate`, `monsoon`, `alpine`, `desert`, `spring-blossom`, `autumn`, `storm-coast`, or weights over states `{ rain: 3, fog: 1 }`. Colour is the style's (its kit or look), tuned by `weather.air`. A cue forces a state: `then: { weather: { is: 'blizzard', for: 90 } }`. Manual: `get_view_vocab({id:'weather'})`; sound: `get_beats_vocab({id:'beats-weather'})`. The world's other tools: `get_creative_toolset({ form: 'world' })`.
