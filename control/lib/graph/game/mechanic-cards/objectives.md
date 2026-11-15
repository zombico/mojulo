---
{ "id": "objectives", "name": "Objectives: a level's tasks, done in order (terminal)", "summary": "A list of tasks, a section each: a task begins when its section is walked into (its own foes woken then, never before), is met by what its kind names (take, reach, clear, man, hold), and being met opens the way on and hands over to the next; the last one met wins. A mission's structure: the shooter's first level is laid on it.", "when": "a mission with objectives, tasks in order, clear the room then move on, a door that opens when the room is cleared, objective markers, hold the point for a time then extract, a briefing's list of things to do, room by room, a level with structure" }
---

## Role

**terminal** (ends in `success`). It owns no hp: compose it with `fail-on-death` (the level's hp) and `supplies` (what
lies on the floor).

## Params

```json
{ "kind": "objectives", "tasks": [
  { "id": "arm", "kind": "take", "text": "Take the rounds", "at": [6, 0, 0], "door": { "at": [10, 3.6, 0], "back": [8, 3.6, 0] } },
  { "id": "room", "kind": "clear", "text": "Clear the room", "zone": { "at": [17, 0, 1], "half": [6, 8, 3] }, "foes": ["foe-1", "foe-2"], "door": { "at": [24, -3.6, 0], "back": [22, -3.6, 0] } },
  { "id": "yard", "kind": "hold", "text": "Hold the yard", "zone": { "at": [35, 0, 1], "half": [10, 8, 3] }, "seconds": 40, "every": 10, "waves": [["foe-3", "foe-4"], ["foe-5", "foe-6"]], "door": { "at": [46, 3.6, 0], "back": [44, 3.6, 0] } },
  { "id": "out", "kind": "reach", "text": "Get out", "zone": { "at": [50, 0, 1], "half": [3, 8, 3] }, "at": [51.5, 0, 0] }
] }
```

- `tasks`: in the order they are done. Each has an `id`, a `kind` and the `text` the player is told.
  - `take` / `reach`: met by walking to `at` (`radius`: 1.4 for a take, 2 for a reach). What a take gives is the
    `supplies` mechanic's, laid at the same place.
  - `clear`: met when every one of its `foes` is down (the cast's `down`). The foes are minted dormant and woken as the
    task begins. `man`: a clear with a mounted gun to do it with (`gun`: its entity id).
  - `hold`: met when `seconds` have run from the moment it begins; its `waves` (lists of dormant foes) are woken one
    every `every` seconds, the first after a breath. What still stands at the end is left standing.
- `zone`: the section's box (`at` its centre, `half` its half-extents). Walking into it begins the task. Without one, a
  task begins the moment the one before is met; the first begins as the level starts.
- `door`: the way on (`at`), sealed until the task is met. A body that walks into it sealed is put back at `back`.
- A foe is woken once: an id may stand in one task only.

## Lowers to

- world: a var for the task in hand (`__<id>`, the count when all are met); per task a zone that begins it, its foes'
  `ctrl spawn`, a count of their `down`s with a watch (a clear), a clock with a timer and its waves on a sequence (a
  hold), a zone at its place (a take, a reach); a guarded hand-over; the `<id>-seal-<k>` marker and its zone at each
  door (`objective:sealed` and a `move` back while it is shut).
- events: `objective:begin { n, of, task, text }`, `objective:done { n, of, task }`, `objective:sealed { task }`,
  `wave { n, of }`, `objectives:done`.
- hud: the tasks met as a counter, a banner as each begins, a hold's clock.
- contract: `on: { "objectives:done": { end: "success" } }`.
- `audit`: none can fight, so it is not auto-auditable. Its proof is on the bus with each fall given
  (`gameworld/mission-proof.js` `proveMission`), and a player's on the runtime (`playMission`).
