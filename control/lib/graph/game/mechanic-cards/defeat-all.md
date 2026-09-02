---
{ "id": "defeat-all", "name": "Defeat N enemies (terminal)", "summary": "The combat success terminal: counts enemy:down events to a target and ends the level in success. Deliberately split from HOW enemies go down — pair it with hp-pool (the declarative producer) and the count can be inferred from the entity list. Refused when nothing in the level produces enemy:down, so the portability report never claims a win that cannot happen.", "when": "defeat all enemies, kill N enemies, clear the arena, beat every opponent, kill target, last enemy standing ends the level, arena victory" }
---

## Role

**terminal** (ends in `success`). Satisfies the level's ≥1-success-terminal rule.

## Params

```json
{ "kind": "defeat-all", "count": 3, "label": "Defeated" }
```

- `count` — how many `enemy:down` events win. Omit it when a sibling `hp-pool` is declared:
  the count is inferred from that entity list ("all" means all of them).
- `label` — HUD label for the running count (default `Defeated`).
- `producer` — set `"runtime"` ONLY when hand-authored world reactions (outside `mechanics`)
  emit `enemy:down`. This is an explicit acknowledgment, not a loophole: without it, a level
  where no mechanic produces `enemy:down` is REFUSED at compose — a terminal nothing can
  trigger would assess clean and never be winnable.

## Lowers to

- world: a counter var (`__downs_<i>`, on the HUD), a reaction counting every `enemy:down`,
  and a watch `{ when: { var, gte: count } }` → `all:defeated`.
- contract: `on: { "all:defeated": { end: "success" } }`.

## Audit

None synthesized — nothing in the vocabulary can DEAL hits yet (`melee-strike` is future
vocabulary), so no completability recipe can drive a win. **Promotion stays manual**
(`allow_unaudited` or a hand-authored `motion_ref` that plays through the fight).
