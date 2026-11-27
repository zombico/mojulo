---
{ "id": "grade", "name": "Grade: a medal for how the level was won (emitter)", "summary": "A level's medal, gold, silver or bronze, read off what it kept when it is won: a time, the seconds flown out of a band, a landing's sink rate. Each criterion has its bounds; the worst one sets the medal. Kept and shown by its name, the best remembered.", "when": "medals, bronze silver gold, grade the lesson, score the run, a time to beat for gold, a landing graded by how soft it was, star ratings, how well did I do" }
---

## Role

**emitter** — requires nothing, ends nothing. Compose it with the terminal it grades (`objectives`, read at its
`objectives:done`).

## Params

```json
{ "kind": "grade", "criteria": [
  { "var": "__obj_time", "best": "low", "gold": 120, "silver": 180, "bronze": 300 },
  { "var": "__obj_slip", "best": "low", "gold": 4, "silver": 10, "bronze": 25 }
] }
```

- `criteria` — each a var the level keeps and the bounds that earn each medal. `best: 'low'` (a time): at or under a
  bound earns it, `gold ≤ silver ≤ bronze`. `best: 'high'` (a score): at or over, `gold ≥ silver ≥ bronze`. Past bronze
  earns none. `label` keeps the var on the result too.
- `on` — the event it is read at (default `objectives:done`).

## Lowers to

- world: `__grade` (0 none, 1 bronze, 2 silver, 3 gold), set to 3 at `on`, then each criterion read in turn (its own
  event) and capping it; then `grade:gold | grade:silver | grade:bronze | grade:none` and a toast.
- keep: `{ var: '__grade', label: 'Medal', best: 'high', names: ['no medal', 'bronze', 'silver', 'gold'] }`.

## Composition

- A flight lesson (gameworld/flight-goal.js `grade`): `objectives` (its time, its bands' slip, its landing's sink) and
  `grade` over them.
