---
{ "id": "respawn", "name": "Respawn after a crash (emitter)", "summary": "A crash (the page's: a rock flown into, a touchdown off every pad) brings the craft back at a set point, flying or on the ground, and may cost hp. For a flight that is not a race; a race's respawns ride on laps.", "when": "come back after crashing, respawn the ship, reset the plane after a crash, crashing costs health, dogfight respawn" }
---

## Role

**emitter** — requires nothing. Ends nothing: pair it with a terminal (`defeat-all`, `survive`) and, for the hp it
takes, `fail-on-death`.

## Params

```json
{ "kind": "respawn", "at": { "spot": [0, -1300, 80], "heading": 1.57, "aloft": 1 }, "hurt": 25 }
```

- `at` — where a crash comes back: `{ spot, heading?, aloft? }` (or a bare `[x, y, z]`); absent, the level's spawn.
  `aloft: 1` comes back flying at cruise (a space craft, a glider), else on the ground at rest.
- `hurt` — hp a crash costs (fail-on-death's `hp`); absent, a crash costs nothing but the time.
- `touchdown` — `'land'` lets the craft set down; absent, a touchdown after flying (the page's) is a crash too: in a
  fight there is nothing to land on.

## Lowers to

- world: on `crash`, emit `respawn:0` carrying `spot`, `heading` and `aloft` (the page's flight block reads them off
  that reaction and puts the craft back); with `hurt`, `hp` less that much; a `touchdown` re-emitted as a `crash`
  (unless `touchdown: 'land'`); a `crashed` toast.

## Composition

- The dogfight (quick `shoot` with a `craft`): `fail-on-death` + `respawn` + `defeat-all` on the wing's downs.
- In a race, `laps` takes `respawn` itself (one point per stretch, the last gate passed): use that, not this.
