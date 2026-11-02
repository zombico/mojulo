---
{ "id": "bounty", "name": "Bounty: a foe's fall drops its proof (emitter)", "summary": "A wanted foe: each fall of a foe matching `who` drops its proof (a pelt, a badge, a head) into the bag, to hand in at a bounty board (deliver) for its reward. Dead is the default; alive is a variation of fetching (the captive carried as cargo). An errand's leg.", "when": "a bounty, a wanted poster, hunt the dire wolf and bring its pelt, kill the bandit leader for a reward, bring proof of the kill, a bounty board, slay five rats and return their tails, a contract on a target" }
---

## Role

**emitter** (requires the bag). Beside the foes that fall (the world's `foes`, or an `hp-pool`).

## Params

```json
{ "kind": "bounty", "item": "pelt", "who": "dire-wolf-*", "n": 1 }
```

- `item` — the proof a fall drops; `n` how many (1).
- `who` — a glob over the foes whose fall counts (the cast's `down`). Absent, each `enemy:down` (an `hp-pool`'s) counts.

## Lowers to

- world: a fall (`down` matching `who`, or `enemy:down`) → `bounty:<item>`, the proof moved nowhere → bag
  (`in:bag:<item>:<n>` for the store), a toast.
- contract: `produces` grant into the bag. Its reward is the giver's (`deliver`'s `reward`).
