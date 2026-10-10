---
{ "id": "beats-weather", "name": "Weather sound (a sky, rolled from principles)", "summary": "The sound of a world's weather: a bed, a rain of small events and rare big ones (thunder), rolled from the sky's state, its surface and two dice, lowered onto the sfx gestures. Not a kind: a world's audio.weather.", "when": "rain, a storm, wind, snow hush, thunder; making a world's sky sound like itself; 'the weather should sound different on tin, leaves, water'; how far thunder is" }
---

## Shape

Weather sound is a switch on a world that already has weather (manifest.weather, see the world weather in the gameworld bible and the World page):

```json
{
  "weather": { "climate": "monsoon", "surface": "tin" },
  "audio": { "weather": true }
}
```

`audio.weather` is `true` or `{ level?: 0…1 (a gain on it all), surface? }`. The surface is the weather's own (`weather.surface`) unless named here: leaf, stone, tin, water, sand, snow. Nothing is recorded: every sound is rolled on the page from the sky's look, so the sound follows the fog and the fall as they change.

## The principles

A weather sound is three layers.

- **Bed**: continuous texture, a dense train of tiny noise grains in a band (the hiss of rain, the roar of a gale). Wind is the same bed with its density swelled by two incommensurate slow LFOs: gusts.
- **Grains**: the drops, a Poisson-like rain of small events; where the surface rings (tin, water), a modal strike.
- **Punctuation**: rare big events. Thunder.

Rules that make them read as weather:

- **Intensity is rate.** A heavier fall is more drops a second, never louder drops.
- **Size is band.** Bigger drops sit lower and ring longer: a downpour's band is lower than a drizzle's.
- **The surface is resonance.** Leaf soft and high, stone a dry click, tin rings, water plinks, sand a hiss with the drops thinned, snow nothing but hush (no drops, a closed bed).
- **Distance is lowpass, delay and length.** Thunder near is a crack and a thump; far off it is only a rumble, darker and longer, arriving distance / 343 s after the flash.
- **Two dice.** The world's (its seed) picks each parameter's centre inside its range: this world's rain. The event's (the slice's number, the kernel's per-hit variant) jitters round that centre. So two storms sound alike and never the same, and two worlds' rain differ.

## Sound banks

Each weather state names its bank (`weather/weather.js` SOUND_BANKS): still, breeze, drizzle, rain, downpour, storm, hush (snow), gale (blizzard, dust storm), dust, rustle (petals, leaves). Two states in a blend share the sound at their shares.

## Gates

Machine: plans are deterministic per seed; two worlds differ in centre and two events in jitter; every plan lowers to kernel ops; the page's scheduler plays a slice each tick and each thunder once. Ears: never claimed. Listen, and say what you heard.
