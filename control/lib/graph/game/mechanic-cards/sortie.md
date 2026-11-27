---
{ "id": "sortie", "name": "Sortie: a mission's goals together, its craft arriving (terminal)", "summary": "A space-combat sim's mission: goals met in no order (craft destroyed, craft protected, seconds survived), won when all are met and lost when a protected craft goes down; its flight groups minted asleep and brought in after a time, or once others are down, with a transit.", "when": "a mission with several goals, destroy the bombers and protect the transport, survive until help comes, reinforcements arrive, a second wave jumps in when the first is destroyed, a space combat mission, flight groups" }
---

## Role

**terminal** — ends `success` (every goal met) and `fail` (a protected craft down). Requires nothing. It needs the
craft it names in the level, the ones that arrive minted dormant (`dormant: true`).

## Params

```json
{ "kind": "sortie",
  "goals": [
    { "destroy": ["bomber-1", "bomber-2"], "say": "Bombers destroyed" },
    { "protect": ["freighter-1"], "say": "The freighter is lost" },
    { "survive": 120 }
  ],
  "arrivals": [
    { "craft": ["bomber-1", "bomber-2"], "after": 20, "with": "jump", "say": "Bombers arriving" },
    { "craft": ["raider-3", "raider-4"], "down": ["raider-1", "raider-2"], "after": 5 }
  ] }
```

- `goals` — `destroy` every craft named down; `protect` none of them down (one down fails the mission); `survive` the
  seconds flown. At least one destroy or survive goal (a mission is won by a goal met). `say` is what the comms say
  when the goal is met (for `protect`, when it fails).
- `arrivals` — craft brought in `after` seconds into the mission, or once every craft in `down` is down (both: the
  seconds counted from then), each spawned with its transit (`with`), `say` said as they arrive.

## Lowers to

- world: a count of each destroy goal's downs and a watch on it; a timer sequence for each survive goal and each
  arrival's wait; `ctrl spawn` of each arriving craft; a reaction on each protected craft's `down`.
- events: `sortie:goal { n, of }` as each goal is met, `sortie:won` when all are, `sortie:lost { goal }` when a
  protected craft goes down, `arrival { n }` as each group comes in. The HUD counts the goals met.

## Pairs with

- `fail-on-death` `{ of: 'body' }`: the pilot's own craft down loses it too.
- A cockpit level (airspace `cockpit: true`) lays it from its `sortie` goal (gameworld/flight-goal.js).
