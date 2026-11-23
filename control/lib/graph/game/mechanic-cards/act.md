---
{"id": "act", "name": "Act: a faction's posting, finished by something done (emitter)", "summary": "A job that is an act, not a delivery: taken on the faction's board, and done when its event comes (`act:<verb>:<id>`), paid once in money and standing. With `fight` it is an encounter in free roam: its foes wake when the player comes with it taken, and the last one down is the act done.", "when": "a gang mission, a bounty board job, beat up the rival crew, a fight on rival turf, clear them out, an action mission, a hit, send a message"}
---

## Role

**emitter** (requires the bag when it pays). Beside its faction's `join`, and its foes' bodies when it is a fight.

## Params

```json
{"kind": "act", "id": "torch", "faction": "reds", "verb": "torch", "flag": "took-torch", "done": "done-torch", "reward": [{"item": "coin", "n": 50}], "standing": 1, "fight": {"foes": ["foe-docker-torch-1", "foe-docker-torch-2"], "at": [40, 0, 0], "back": [5, 5, 0]}}
```

- `id`, `faction`, `verb` — the posting, who posts it, what is done.
- `flag`, `done` — the flags taking it and finishing it set.
- `reward`, `standing` — what it pays: into the bag, and onto `standing-<faction>`.
- `fight` — `{ foes, at, radius?, back?, hp?, hits? }`: the bodies fought (the cast's ids, minted dormant), where, where the hero is put after going down, the hero's health for it and a hit's cost.

## Lowers to

- world: `app:take:<id>` sets the flag; `act:<verb>:<id>` with it taken and not done → paid, `errand:done:<id>`, `flag:<done>`.
- with `fight`: a zone at `fight.at`; entered with it taken → `encounter:<id>`, each foe `ctrl spawn`; each `down` counted, the last raises `act:<verb>:<id>`; `hit:<player>` off its health while it is on; at none `encounter-lost:<id>`: each foe `ctrl vanish`, the counts zeroed, the hero moved to `back`.
