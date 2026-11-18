---
{"id": "mission", "name": "Mission: a story job with ways to fail (emitter)", "summary": "A job told as a story mission: it starts as the job is taken (its name as a banner, a clock when it has time), its goods can bring stars from the law, and it fails when the player is wasted, busted or out of time: MISSION FAILED, then it starts again a few seconds later. Done, MISSION PASSED; the story's last ends the game.", "when": "a story mission, a timed job, mission failed, retry, a heist, lose the cops before the drop, the last mission, the story's end, GTA missions"}
---

## Role

**emitter**. Laid beside a job's legs where its errand says `mission` (gameworld/errand.js), with the law's `wanted` and the street's `vitals`.

## Params

```json
{"kind": "mission", "id": "heist", "flag": "took-heist", "name": "The jeweller", "time": 120, "heat": 2, "hot": "had-diamonds", "final": true}
```

- `id`, `flag`, `name` — the job, the flag taking it sets, what it is called.
- `time` — seconds from taking it; `heat`, `hot` — the stars its goods bring and the flag having them sets.
- `again` — seconds after a failure before it starts again (5); `final` — the story's last.

## Lowers to

- world: `flag:<flag>` → `mission:<id>` (on, the clock set and shown); `flag:<hot>` while on → `raising:wanted` × heat; a timer each second while on takes the clock down, at none `mission-failed:<id>`; `wasted` / `busted` while on → failed; `again` seconds after → `mission:<id>` again; `errand:done:<id>` while on → `mission-passed:<id>`.
- hud: its name as a banner, its clock top centre while on, MISSION FAILED / MISSION PASSED banners.
