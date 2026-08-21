---
{ "id": "gantt-schedule", "name": "Gantt / timeline", "summary": "tasks as bars on a value→x scale with a tick axis; you write { scale, tasks } and the tool positions everything", "when": "a schedule or timeline — project phases/tasks over weeks or sprints, a roadmap, start/end per item, a plan on a time axis", "marks": ["rect", "line", "text"], "phase": "p1" }
---

A Gantt chart is a `kind:'gantt'` manifest: author a numeric `scale` and a list of
`tasks`, and the tool draws one row per task with a bar positioned on a value→x
scale plus a tick axis. This is a diagram KIND — don't compute bar geometry.

## Manifest shape
```json
{
  "kind": "gantt",
  "title": "Diagram surface schedule",
  "scale": { "start": 0, "end": 6, "unit": "wk" },
  "tasks": [
    { "label": "Extract diagram-core", "start": 0,   "end": 1 },
    { "label": "Kernel mint tool",     "start": 1,   "end": 2.5 },
    { "label": "Patterns spike",       "start": 3,   "end": 5 },
    { "label": "Formalize P0/P1",      "start": 4.5, "end": 6 }
  ]
}
```

## How it lays out
- **`scale`** — a NUMERIC domain `{ start, end, unit? }`. Map real dates to numbers
  yourself (week index, sprint number, day-of-month); `unit` is just the tick-label
  prefix (`wk0`, `wk1`, …). Date-string parsing is not built in.
- **`tasks`** — one bar per task; `x` from `start`/`end` on the scale, one row each in
  array order. `end` must be ≥ `start`.
- axis ticks are auto-generated across the domain (coarser as the span grows).

## Notes
- `viewBox` is computed from the task count + scale.
- `task.lane` is accepted but not yet used for grouping (rows stay in array order).
- Dependencies-as-arrows are not modeled — sequence the rows to imply order.
