---
{ "id": "unseen", "name": "Stay unseen (fail terminal)", "summary": "Being seen loses the level. Any character with sight (rule.mind.perception) that newly sees its target says seen on the bus; the first sighting (or the alarms-th) ends the level in fail. Pair with reach-exit: the stealth level.", "when": "stealth, sneak past the guards, don't get spotted, stay out of sight, infiltrate, avoid detection, if they see you it's over" }
---

## Role

**terminal** (ends in `fail`). It cannot win a level: pair it with a success terminal (`reach-exit`).

## Params

```json
{ "kind": "unseen", "alarms": 1, "who": "guard-*", "text": "Spotted!" }
```

- `alarms`: how many sightings end the level (default 1, the first). Above 1 the HUD counts them.
- `who`: a glob over the watchers' ids (default every character with sight).
- `text`: the banner at the end (default "Spotted!").

## Lowers to

- world: a reaction on `seen` (the cast's fact: a character with `rule.mind.perception` newly sees its target, carrying
  `entity` and `target`) that emits `spotted`, or counts into `__seen_<i>` with a watch at `alarms`.
- contract: `on: { "spotted": { end: "fail" } }`.

Watchers need sight: `rule: { type: 'ai', mind: { motivation: 'guard', perception: 'sight' | 'memory' }, sightRange,
sightCone }`. A guard's `scan` (radians) sweeps its gaze at its post over `scanPeriod` seconds, so a sneak can time it.
Walls (the world's colliders) block sight.
