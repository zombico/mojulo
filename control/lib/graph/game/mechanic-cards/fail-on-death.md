---
{ "id": "fail-on-death", "name": "Fail on death (terminal)", "summary": "hp reaching 0 ends the level in failure. A fail-terminal lethality opt-in, split from hazards so ANY level can be lethal independently. Owns the hp var; pair with a success terminal (a fail-only level can't be won).", "when": "die when health runs out, game over on death, hp reaches zero, make the level lethal, permadeath in a level, lose if you take too much damage" }
---

## Role

**terminal** (ends in `fail`) — requires a `character` slice. Does NOT satisfy the
success-terminal rule; always pair it with `reach-exit` or `survive`.

## Params

```json
{ "kind": "fail-on-death", "startHp": 100 }
```

- `startHp` — the in-level starting hp (default 100). If `hazard-damage` also sets `startHp`, the
  values must MATCH (they share the `hp` var; a conflict is a resolve error).

## Lowers to

- world: the `hp` var + a watch `{ when: { var: "hp", lte: 0 } }` that emits `dead`.
- contract: `on: { "dead": { end: "fail" } }`.

## Composition

- With `hazard-damage`: hazards drain hp, hp≤0 → fail. A lethal dungeon.
- With `survive`: outlast the clock without dying — a lethal arena.
- The **fall** policy's respawn floors hp at 1, so falling NEVER trips this — fall damage can never
  end the run, only hazards/combat can.
