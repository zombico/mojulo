---
{ "id": "erd-entity", "name": "ERD / UML entity", "summary": "entity boxes (title + divider rule + field rows) joined by typed relationship ends with cardinality labels", "when": "a data model or class diagram — tables/entities with fields and 1:N / N:M relationships, a schema, a domain model", "marks": ["line"], "phase": "p1" }
---

An entity is an ordinary `station` dressed as a record: a `db_row` station with a
title `label`, a `divider: true` rule under the title, and its fields in `items`.
Relationships are `edges` carrying the typed ends + cardinality labels from the
`edge-notation` card.

## Entity (station)
```json
{ "id": "user", "kind": "db_row", "label": "User", "divider": true,
  "items": ["id: pk", "email", "name"],
  "x": 40, "y": 90, "w": 160, "h": 108 }
```
- `divider: true` draws a rule between the title and the fields.
- `items` are the field rows (bulleted). Put the type/key inline in the string
  (`"user_id: fk"`) — there is no separate type column yet.
- Size `h` to fit the fields (~26px per row + header).

## Relationships (edges — see `edge-notation`)
```json
"edges": [
  { "from": "user", "to": "order", "head": "crowsfoot-many", "tail": "crowsfoot-one", "fromLabel": "1", "toLabel": "0..*" },
  { "from": "order", "to": "item", "head": "crowsfoot-many", "tail": "crowsfoot-many", "fromLabel": "1..*", "toLabel": "1..*" }
]
```
- `crowsfoot-one` / `crowsfoot-many` are the ERD "one" / "many" ends.
- `fromLabel` / `toLabel` pin the multiplicity at each end.
- For UML class inheritance use `head: "triangle-open"`; aggregation/composition
  use `diamond` / `diamond-filled`.

## Layout
Lay entities out in a row/grid with room between for the relationship labels
(~130px horizontal gap reads well). Use `grid-layout` if you want cell placement
instead of absolute coords.
