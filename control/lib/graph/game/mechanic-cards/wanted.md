---
{"id": "wanted", "name": "Wanted: the law answers mayhem (emitter)", "summary": "Stars, raised by mayhem (a street fight, a car taken from its driver, a crash into traffic, a police officer downed); each star brings more police near the player, who chase and strike. Clear of them and of trouble a while, a star fades; taken down by them, the player is busted: fined and set down at the start.", "when": "a wanted level, police chase, stars, cops come, heat, notoriety, busted, the law, crime has consequences, an open city with police"}
---

## Role

**emitter** (requires the bag when it fines). Laid by a city level whose world has `law` (gameworld/law.js), beside the police bodies it stands asleep.

## Params

```json
{"kind": "wanted", "police": ["police-1", "police-2", "police-3", "police-4"], "per": 2, "stars": 2, "calm": 12, "busted": 6, "fine": 20, "back": [0, 0, 0], "mayhem": ["encounter:torch"]}
```

- `police` — the bodies that come, minted asleep; the first `per` with the first star, the next with the second.
- `per`, `stars` — police a star brings; the most stars (to 5).
- `calm` — seconds with no mayhem and no police blow that take a star off.
- `busted`, `fine`, `back` — police blows that take the player down; the coin it costs (when held); where the player is set down.
- `mayhem` — events that raise a star, beside `mayhem:carjack`, `mayhem:crash`, `mayhem:runover` and `mayhem:assault` (the page presses them: a car taken, a crash into traffic, a passer-by run down or struck) and a police body's `down`.
- `ring` — how far from the player its police are set down, `[near, far]` m (`[14, 30]`).

## Lowers to

- world: each mayhem event and each police `down` → `raising:wanted`: `wanted` +1 (to `stars`), `wanted-calm` 0.
- a watch per star k: `wanted:k` (`wanted` ≥ k) spawns its police `near` the player; `unwanted:k` (`wanted` < k) vanishes them.
- a timer each second while wanted: `wanted-calm` +1; at `calm` a star off. A police `hit:<player>` (`by` one of them): `wanted-hits` +1, `wanted-calm` 0.
- `busted` (`wanted-hits` ≥ `busted`): wanted 0, the fine taken, the player moved to `back`. `wanted-lost`: shaken off.
- hud: `wanted` as stars, top right; toasts on the first star and when shaken off; a banner when busted.
