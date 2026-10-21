---
{ "id": "geocube", "name": "A geocube — one style, the levels it makes, and domain expansion", "summary": "a geocube is a level's look as data (light, palette, register, contrast, surfaces) plus its ingredients (terrains, interiors, structures, settlements); its `domains` compose them into the levels it makes, and `domain` expands one into a stage, a specimen, a level or a game's level, always in the cube's one style", "when": "someone wants several levels in one look: a game whose levels differ in land but share a style; a cove at dusk and a crag at noon from one cube; a town, a summit shrine or a temple hall in the same art style; choosing which of a cube's levels suits a task; domain expansion", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A cube is two things: its STYLE, the same in every level it makes, and its INGREDIENTS, the places and things that
style is applied to. A DOMAIN is one level the cube makes: a composition of its ingredients. Expanding a domain lowers
it, in the cube's style. A different style is a different cube (`{ from: <preset>, …changes }`), never a domain.

## The style (never a domain's)

`light`, `colour` / `palette`, `register`, `contrast`, `grit`, `surfaces`, `era`, `target`, `materials`, `why`, `avoid`.

## The ingredients

- **Terrains** (`outside.terrains: { <name>: { reads?, base?, tiers?, island?, land?, relief?, ground?, crystals?, colour? } }`):
  a whole land each, or a few changes to the cube's own (named by `outside.terrain`, `default` unless named).
- **Interiors** (`inside.interiors: { <name>: { reads?, bones?, size?, accentWall? } }`): rooms, over the cube's own
  (`inside.interior`, `room` unless named). Terrains and interiors share one set of names.
- **Structures** (`structures: { <name>: [<structure>…] }`): fractal structures (`get_view_vocab({ id: 'structures' })`),
  each standing `at: [x, y, z?]` or `on: 'summit'` (the climb's top; `at` is then an offset). Painted from the cube's
  ramps unless one names its own `palette`, lit by the cube's key at the domain's hour. They stand on a climb, never on
  a trail.
- **Settlements** (`settlements: { <name>: { town?, houses?, enter?, doors?, anchor? } }`): a town plan and how much of
  its street stands (`houses` 1–12) and is walked into (`enter` 0–4), in the cube's builders' language unless `anchor`
  names another. A town walks on a trail.

## The domains

```
domains: {
  'crag-path':    { reads: 'The crags in the hard clear light', structures: 'shrine' },
  'cove-dusk':    { reads: 'The cove at dusk', terrain: 'cove', hour: 'dusk' },
  'harbour-town': { reads: 'Up the street of the harbour town', terrain: 'cove', settlement: 'harbour' },
  'temple-hall':  { reads: 'Into the temple hall', interior: 'hall' },
}
```

A domain is outside (a terrain, the cube's own when none is named; `hour` 0–24 or a word on the dial; `structures`;
`settlement`) or inside (an `interior`). Each `reads` line is how the domain is chosen: write it for the task it suits.
A cube that names no domains offers one per terrain and one per interior.

## Domain expansion

`domain` is one key on the doors that take a cube:

- the `geocube` kind: `{ cube, domain }` shows the domain (its room, its land, or its street); `show: 'trail'` walks
  an outside domain's island, every way up drawn; `show: 'town'` a micro-town (a few houses of its street, or a
  hamlet's) and `show: 'city'` a micro-city (the smallest city plan, in the cube's paint and builders' language),
  each walked by a stand-in at eye height to review the architecture, seen first from a person's eye before a house
  or down a sidewalk; `hour` and `clouds` set an outside's sky (the city's too: past dusk its windows lit). A gritty
  cube's street is painted from relief as its rock is: stone walls ashlar, plaster a lime render broken to the stone;
- a `stage`: `{ geocube, domain }` alone is the whole level: an island, a street on a trail (a domain with a town), or
  a room. Your `meru`, `trail`, `rooms`, `hour` or `town` win over the domain's;
- a level: `{ geocube, domain, nodes }` paints every section, and lays a domain's street on its first trail;
- a game: `style.domain` on the world or on a level. A level on a cube that names domains and asks for none takes its
  heartbeat's, else the cube's first outside. Composed worlds lend the cube's domains to their walks, the ones the
  prompt names first.

Ask for a domain three ways: by name (`'cove-dusk'`), as a change of one (`{ from: 'cove-dusk', hour: 'night' }`), or
composed from the cube's ingredients (`{ terrain: 'cove', structures: 'shrine', hour: 'golden' }`). The answer
(`painted`, the level's `paint`, the specimen's `geocube`) says which domain it got, from whom (the level, the
heartbeat or the cube), and what the cube offered. `terrain: 'x'` is `domain: { terrain: 'x' }`.

## Choosing

Read the cube's offer (the specimen lists its domains with their `reads`) and pick the one whose line fits the level
the task needs: a climb for a summit, a street for a town, a room for an interior. Compose one when none fits, from
the cube's own ingredients. Need a land, a room or a landmark the cube lacks? Add it to the cube (a variant with
`from`), then expand.
