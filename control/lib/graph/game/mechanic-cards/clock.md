---
{ "id": "clock", "name": "The world's clock (emitter)", "summary": "Time of day on the bus: minute, hour and day, dawn at six and dusk at eighteen, seasons if asked. The sky reads it (night darkens the level; a season swaps its climate), cues read the hour (routines), crops grow at each dawn.", "when": "day and night, a day-night cycle, time passes, a clock, the hours, days go by, seasons change, a calendar, morning and evening" }
---

## Role

**emitter**. It emits `dawn`, `dusk` and `midnight`; it is what crops and routines need.

## Params

```json
{ "kind": "clock", "start": 8, "rate": 2, "seasons": 4, "climates": ["spring-blossom", "temperate", "autumn", "alpine"] }
```

- `start`: the hour the level starts at (8). `rate`: game minutes a real second (2: a day in twelve minutes).
- `seasons`: days a season lasts (none: no seasons); `climates`: the four seasons' climates (weather/weather.js).

## Lowers to

- world: vars `minute` (0 to 1439), `hour`, `day` (from 1), `season`; a heartbeat adding `rate` minutes; a watch per
  hour; `midnight` turning the day; the HUD's day and hour.
- the sky: a level with a clock has the weather channel (clear air when it names no weather): from 20:00 to 05:00 its
  light and sky darken, two hours of dusk and dawn either side; a season's turn swaps its climate.
