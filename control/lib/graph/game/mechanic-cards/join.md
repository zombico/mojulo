---
{"id": "join", "name": "Join: a faction joined where its contact stands (emitter)", "summary": "A side taken: coming to a faction's contact while with no one sets `flag-in-<faction>`. One faction at a time: it is left on the phone (`app:leave:<faction>`), its standing kept.", "when": "join a gang, pick a side, a faction to work for, gang affiliation, leave the gang, one faction at a time"}
---

## Role

**emitter**. Beside the faction's postings (`act`).

## Params

```json
{"kind": "join", "faction": "reds", "at": [10, 8, 0], "name": "The Reds", "says": "You ride with us now.", "others": ["dockers"]}
```

- `faction`, `name` — the side and what it is called; `at`, `radius` — where its contact stands.
- `others` — the other factions: joining needs every one of their flags down.
- `says` — what the contact says.

## Lowers to

- world: a zone at `at`; entered with every faction's flag down → `join:<faction>`, `flag-in-<faction>` set, a toast; `app:leave:<faction>` clears it. `standing-<faction>` starts at 0 and is never cleared.
