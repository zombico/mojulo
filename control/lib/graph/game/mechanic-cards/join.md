---
{"id": "join", "name": "Join: a faction joined where its contact stands (emitter)", "summary": "A side taken, by the player's say: its contact opens once its `after` flag is set (the first job done), asks as the player comes, and only the key (Y) there joins, while the player is with no one; that sets `flag-in-<faction>`. One faction at a time: it is left on the phone (`app:leave:<faction>`), its standing kept.", "when": "join a gang, pick a side, a faction to work for, gang affiliation, leave the gang, one faction at a time"}
---

## Role

**emitter**. Beside the faction's postings (`act`).

## Params

```json
{"kind": "join", "faction": "reds", "at": [10, 8, 0], "name": "The Reds", "says": "You ride with us now.", "others": ["dockers"], "after": "done-parcel"}
```

- `faction`, `name` — the side and what it is called; `at`, `radius` — where its contact stands.
- `others` — the other factions: joining needs every one of their flags down.
- `after` — the flag its contact opens on (the first job done); unsaid, open from the start. `key` — the key that joins (y).
- `ask` — what the contact asks.
- `says` — what the contact says.

## Lowers to

- world: `flag:<after>` → `join-open:<faction>` (a toast: they have heard of you); a zone at `at`, entered open and with no one → `join-ask:<faction>` (a toast: the key to join, or walk on); the key there → `join:<faction>`, `flag-in-<faction>` set; `app:leave:<faction>` clears it. `standing-<faction>` starts at 0 and is never cleared.
