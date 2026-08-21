---
{ "id": "sequence-diagram", "name": "Sequence diagram", "summary": "actors + time-ordered messages → auto-laid-out lifelines, stacked messages, activation bars; you write the spec, the tool lays it out", "when": "an interaction over time between a few participants — a request path, an API/protocol handshake, who-calls-whom in order, a message flow", "marks": ["line", "rect", "text"], "phase": "p1" }
---

A sequence diagram is a `kind:'sequence'` manifest — you author a compact
`{ actors, messages }` spec and the tool lowers it to lifelines, stacked
messages, and activation bars (no coordinates by hand). This is a diagram KIND,
not a marks recipe: don't compute x/y yourself.

## Manifest shape
```json
{
  "kind": "sequence",
  "title": "Mint request path",
  "actors": [
    { "id": "agent", "label": "Agent" },
    { "id": "mint",  "label": "mint_diagram" },
    { "id": "db",    "label": "SQLite" }
  ],
  "messages": [
    { "from": "agent", "to": "mint", "label": "mint_diagram(manifest)", "activate": true },
    { "from": "mint",  "to": "db",   "label": "INSERT sketch" },
    { "from": "db",    "to": "mint", "label": "ref", "kind": "return" },
    { "from": "mint",  "to": "agent","label": "{ ok, ref, url }", "kind": "return" }
  ]
}
```

## How it lays out
- **actors** — evenly spaced across the top, each a header box + a dashed lifeline.
- **messages** — stacked top→down **in array order** (order IS the timeline).
- **`kind`** — `sync` (default, solid arrow) · `async` · `return` (dashed).
- **`activate: true`** — opens an activation bar on the receiver that closes at its
  next outgoing message (its response). Mark the calls that do work.
- **self-message** (`from === to`) — draws a loopback (a participant acting on itself).

## Notes
- No `viewBox` needed — it's computed from the number of actors/messages.
- Keep labels short; the message row height is fixed.
- `frames` (alt/loop/opt boxes) are not yet supported — model a branch as separate
  messages for now.
