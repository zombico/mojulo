---
{"id": "call", "name": "Call: the next job offered by phone (emitter)", "summary": "A job given by a giver already met: when its event comes (the job before it done) its flag is set, once, and the caller's words are said. Nothing is gone back to.", "when": "the contact calls with another job, a phone call offers the next mission, jobs come by phone after the first, the fixer rings when you are done"}
---

## Role

**emitter**. Beside the job it offers (its legs `after` its flag) and the job before it (whose `errand:done:<id>` it waits on).

## Params

```json
{"kind": "call", "id": "fare", "flag": "took-fare", "on": "errand:done:parcel", "from": "Dispatch", "says": "Fares are waiting."}
```

- `id`, `flag` — the job offered and the flag the call sets.
- `on` — the event the call comes on.
- `from`, `says` — who calls and what they say.

## Lowers to

- world: on `on`, the flag down → `call:<id>`, the flag set, `flag:<flag>` said, a toast `<from>: <says>`.
