---
{"id": "request", "name": "Request: a constituent's infra request, done by the player in a city worker's ID (emitter)", "summary": "A constituent's request in a played city (gameworld/municipal.js): taken on the 311 app, approved by a work order from City Hall's clerk desk (carried in the bag), its material had at the works yard and its spots fixed in the engine at the real place (a pothole, a broken fence, a park's litter: F held, then tapped). Every spot fixed: the order and the material used, the pay into the bag, the constituent's thanks.", "when": "pothole, fix the fence, public space, city worker, 311, constituent request, infra request, work order, city hall, municipal, fix a street, maintenance job"}
---

## Role

**emitter**. Beside the task that gives it (its `after` the task's flag). Its pay is a grant into the bag.

## Params

```json
{"kind": "request", "id": "pothole-elm", "job": "pothole", "name": "the pothole", "from": "Mrs. Henderson", "says": "My cat lives in it now.", "where": "the convenience store", "spots": [{"at": [461, 199, 5]}], "yard": {"at": [16, 347, 25], "half": [16, 19]}, "material": {"item": "cold-patch", "name": "bag of cold-patch asphalt"}, "order": {"item": "work-order", "name": "work order"}, "reward": [{"item": "coin", "n": 40}], "after": "took-pothole-elm", "done": "Pothole filled", "thanks": "The cat has moved out."}
```

- `spots` — where it is fixed; the page says each (`request:fix:<id>:<k>`: scene/channels/fix-sites.js, F held then tapped).
- `yard` — where its `material` is had, taken, with a work order (`order`) in the bag and none had yet.
- `from`, `says`, `thanks`, `where`, `name`, `done` — the words: the letter as it is taken, the card when done.
- `reward`, `after` — what it pays; the flag taking it sets (its task's, lowerTask).

## Lowers to

- world: the yard's zone entered, taken and not done, the material not yet had: with a work order → the material into the bag, `flag:picked-<id>`; without → a word of where one is had. `request:fix:<id>:<k>` with the material had → `flag:fixed-<id>-<k>` once. Every spot fixed → the material and the work order out of the bag, the reward in, `flag:done-<id>`, `request:done:<id>`, a banner.
