---
{
  "id": "vehicle",
  "name": "Vehicle instance (preview)",
  "family": "vehicle",
  "entry": "mint_solid",
  "summary": "Preview a single VEHICLE family instance on the workbench's measured studio grid, orbitable at /world: a registered type + optional decoration, or a race machine (a cartoon racer or a supercar) wearing a THEME — a starter, a variation of one, or a card of the user's own.",
  "when": "Reach for this on framing like 'preview / show a plane / bus / car', 'try the teal livery on a widebody', 'render a sedan in crimson', 'show me a steampunk racer', 'design my own kart theme', 'try a candy supercar', 'eyeball a vehicle candidate before committing it to a fleet library or a race'."
}
---

Preview one VEHICLE family instance on the workbench's measured studio grid — orbitable at `/world`. The substrate stores ONLY the tiny recipe (`manifest.kind === 'vehicle-instance'`) and regenerates the vehicle deterministically on render. To DROP vehicles into a populated world, use the transportation-hub composer; to RACE them, the quick race (`racers`, `supercars`, `series`).

## The families

The vehicle family layer binds four facets per family: a frame (a net, or a grammar), its types, its decoration and how it is sampled.

- **fixed-wing-aircraft** — `type`: `airliner` | `widebody` | `regional` | `bizjet`; decoration `{ scheme }` by livery name (classic / teal / crimson / forest / ember / royal / sky / sand) or index.
- **ground-car** — `type`: `sedan` | `suv` | `taxi` | `opsWagon`; decoration `{ paint: '#hex', hull }` (hull: standard / coupe / chopped / wide / narrow / lowered / lifted).
- **ground-box** — `type`: `cityBus` | `boxTruck` | `streetcar` | `beltLoader` …; baked livery, no scheme (decoration ignored).
- **racer** — a cartoon racer: its machine solved from the parts library round its driver. `racer: { archetype?, build?, age?, brief?, seed?, parts?, shade?, theme? }`.
- **supercar** — a composed supercar. `supercar: { preset?, seed?, surface?, theme? }` (preset: razor / strada / endurance / touring; surface: paint, livery, cabinStyle, headlightStyle, ventStyle, spoilerStyle, line).

## Themes (the race machines' styling)

A theme is what a racer or a supercar is painted, finished and dressed in. The machines are templates: a theme is how a user makes them their own.

- **A starter by name:** `candy`, `steampunk`, `neon`, `military`, `royal`, `heritage`.
- **A variation of one:** `{ from: 'neon', variant: 3 }` — the hues turned within the theme's spread, its livery in turn (variant 0 is the theme itself). A race's `series` gives each car the next one.
- **A card of one's own** (or over a starter: `{ from: 'steampunk', palette: { body: '#20304a' } }`):
  - `palette` — `{ body, skin, trim, accent, frame, glass, seat, tyre, suit, helmet }` as `#rrggbb` (body the primary, skin the secondary of a two-tone or a stripe, trim the bright metal, accent the hero piece).
  - `finish` — `{ paint: gloss | satin | matte | metallic | pearl | candy, trim: alloy | chrome | brass | gold | copper | gunmetal | black, glow: [accent, skin] }`: the material rows the seventh-generation render lights (a pearl's colour shifts with the angle; a colour that glows shines in its own colour: the accent's hero piece, the skin's stripe).
  - `livery` — `mono` | `two-tone` | `striped` | `numbered`.
  - `shape` — the racer's facets the theme leans it to: `{ silhouette, stance, cockpit, engine, era, motif }`.
  - `prefer` — racer parts it reaches for first, `{ family: id | [ids] | null }` (a family: body, wheel, engine, exhaust, aero, nose, lamps, tail, seat, steering, cockpit, fender, booster, hero; null leaves an optional one off). A pin in `parts` still wins.
  - `supercar` — the supercar's words: `{ preset?, cabinStyle?, headlightStyle?, ventStyle?, spoilerStyle? }`.
  - `vary` — how a series varies it: `{ hue: 0–180 degrees, livery: [ … ] }`.

The grid draws the machine with its light painted in; its finish shows when it races (the form render lights the material rows).

## Spec shape

`title`, `ref`, `folder_ref` are top-level mint params; everything else goes in `spec`.

- `type` (string) — a registered vehicle preset (`airliner`, `widebody`, `sedan`, `cityBus` …). Or:
- `racer` (object) — a racer's recipe, as above. Or:
- `supercar` (object) — a supercar's spec, as above.
- `decoration` (object) — for a `type` only: aircraft `{ scheme }`, cars `{ paint, hull }`.
- `pose` (object) — for a `type`: `{ scale?, heading? }` (heading in radians).
- `viewBox` (object) — optional render viewBox `{ width, height }` (default 900×900).

Orbit-only — no preset CSS-3D scene shots. Returns `{ ok, ref, worldUrl, url, stats }` (a race machine's stats: its parts, the laws it was left advised on, its measures).

## Worked examples

```
{ kind: 'vehicle', title: 'teal widebody candidate', spec: { type: 'widebody', decoration: { scheme: 'teal' } } }

{ kind: 'vehicle', title: 'my brass kart', spec: { racer: { archetype: 'explorer', theme: { from: 'steampunk', palette: { body: '#20304a' }, finish: { trim: 'copper' } } } } }

{ kind: 'vehicle', title: 'neon razor', spec: { supercar: { preset: 'razor', theme: 'neon' } } }
```
