---
{"id": "offer", "name": "Offer: a job taken from someone, where they stand (emitter)", "summary": "A job's start: coming to its giver sets the job's flag, once, and their words are said. The job's legs and its hand-in wait on that flag (`after`), and its quest begins on it.", "when": "a quest giver, talk to someone to start the job, a job offered by a person, take the job from the contact, meet the fixer, an NPC gives a task"}
---

## Role

**emitter**. Beside the errand's legs (`trade`, `deliver`), which name its flag in their `after`.

## Params

```json
{"kind": "offer", "id": "parcel", "at": [10, 8, 0], "flag": "took-parcel", "says": "The shop is waiting on this."}
```

- `id` — the job's name; `flag` — the flag taking it sets (`flag-<flag>` on the bus).
- `at`, `radius` — where its giver stands and how near is near.
- `says` — what the giver says as it is taken.

## Lowers to

- world: a zone at `at`; entered with the flag down → `offer:<id>`, the flag set, `flag:<flag>` said, a toast of `says`.
