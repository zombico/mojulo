---
{ "id": "typed-events", "name": "Typed events (the whole mutation vocabulary)", "summary": "The eight typed events — grant, consume, setStat, levelUp, setFlag, promote, recruit, dismiss — are the ONLY way store state changes. Reducers are generated from the schema at build time; there is no user reducer code, ever.", "when": "how game state changes, outcome envelope events, what a level is allowed to write back, store mutations, reducers" }
---

## The vocabulary

| Event | Slices | Params |
|---|---|---|
| `grant` | inventory | `item`, `count?` (default 1) |
| `consume` | inventory | `item`, `count?` — checked against the save; overdraw rejects the whole envelope |
| `setStat` | character, party | `stat`, `value` XOR `delta`; party needs `id` |
| `levelUp` | character, party | `by?` (default 1), `xp?`; party needs `id` |
| `setFlag` | flags | `key`, `value?` (default true) |
| `promote` | progression | `ref`, `result?` (default success) |
| `recruit` | party | `member: { id, name?, level?, stats?, tags? }` |
| `dismiss` | party | `id` |

Every event carries `slice` (the declared slice NAME, not kind).

## The contract discipline

A level's `game.produces.events` whitelists `{ type, slice, max? }` pairs — the
outcome envelope may carry ONLY those, at most `max` each. Envelopes apply
ATOMICALLY: one invalid or disallowed event rejects the whole envelope and the
store is untouched. Mid-session state (current HP mid-fight) never becomes an
event — one envelope per session, at level exit.

If a game seems to need an event outside this table, that is either a new slice
kind (a card + kernel entry, a deliberate substrate extension) or authoring-time
logic the agent bakes into level parameters — never runtime code in the store.
