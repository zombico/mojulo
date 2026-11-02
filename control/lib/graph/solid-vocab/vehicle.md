---
{
  "id": "vehicle",
  "name": "Vehicle (preview), named by the vehicle registry",
  "family": "vehicle",
  "entry": "mint_solid",
  "summary": "Preview one VEHICLE on the workbench's measured studio grid, orbitable at /world, named by the vehicle registry (`vehicle`: any word it names, at a `tier`: toy, stylised, realistic) + optional decoration, or a race machine (a cartoon racer or a supercar) wearing a THEME — a starter, a variation of one, or a card of the user's own.",
  "when": "Reach for this on framing like 'preview / show a plane / bus / car', 'show me a pickup truck', 'a tram at the stylised tier', 'try the teal livery on a widebody', 'render a sedan in crimson', 'show me a steampunk racer', 'design my own kart theme', 'try a candy supercar', 'eyeball a vehicle candidate before committing it to a fleet library or a race'."
}
---

Preview one VEHICLE on the workbench's measured studio grid — orbitable at `/world`. The substrate stores ONLY the tiny recipe (`manifest.kind === 'vehicle-instance'`) and regenerates the vehicle deterministically on render. To DROP vehicles into a populated world, use the transportation-hub composer; to RACE them, the quick race (`racers`, `supercars`, `series`).

## Name it by the registry

Every vehicle is a row of the vehicle registry, under the words people say (`get_solid_vocab({ id: 'vehicles' })` lists them by realm, with what each is drawn as at each tier). Name it by `vehicle`: `{ vehicle: 'tram' }`, `{ vehicle: 'a business jet' }`, `{ vehicle: 'kart', tier: 'toy' }`. The row's build at the tier (or its first build the grid shows) is what is drawn, and the readout's `registry` says the row, the build, every build it has and what it needs to be drawn realistic. A row the grid cannot show yet (a tank, a sailing ship: a concept only) is refused with its builds. The field's vehicles are rows too: `{ vehicle: 'jeep' }` is the military utility 4x4, drawn realistic from the military hull kit (flat plates with rolled edges, welds, bolts, an open tub and a roll bar, in matte field paint) on lugged cross-country wheels, carrying its kit (a spare on the bonnet, racked jerry cans, a shovel and an axe, a whip antenna, D-rings and a pintle, a rolled tarp); its paint is a `livery` beside the word: a camo (`woodland`, `desert`, `tiger`, `winter`, `urban`, `digital`) or `mono`, or `{ pattern, colours, scale, angle, marks }` (a stencilled number and a chevron by default), cut into the body as geometry, and a quick game's field vehicle is painted in its setting's camo unless `quick.livery` names one; its history is a `wear` beside the word (`pristine`, `used` by default, `battered`, or `{ level, soil }`): caked mud cut low and round the arches, chips on its edges and handles, dust and grounding, its soil the setting's; in a world it is lit by that world's own sky (dim and cool at night, warm and low at dusk) and wet in its rain; `{ vehicle: 'canvas truck' }` is the six-wheeled cargo truck (a conventional cab, a plank bed and a canvas tilt sagging over its bows); the APC is named, and drawn as a concept until its body is built. In a game, a quick ride takes the same words: an assembled ride (car, coupe, van) or any row with a realistic loft by its id (`ride: 'pickup'`), drawn at the game's `tier`, read from what the game says (a realistic hero, the juice's form render) and stamped when the world is made. The families below are the builds' own words, kept so a stored instance regenerates as it was minted; a `type` that is not one of their keys is read as a registry word. A new vehicle is a registry row first, never a new key in a family's table.

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

- `vehicle` (string) — any word the vehicle registry names (`'pickup truck'`, `'tram'`, `'widebody'`); `tier` (toy | stylised | realistic) picks its build. Or, the builds' own words:
- `type` (string) — a scenery preset (`airliner`, `widebody`, `sedan`, `cityBus` …). Or:
- `racer` (object) — a racer's recipe, as above. Or:
- `supercar` (object) — a supercar's spec, as above.
- `decoration` (object) — for a `type` only: aircraft `{ scheme }`, cars `{ paint, hull }`.
- `pose` (object) — for a `type`: `{ scale?, heading? }` (heading in radians).
- `viewBox` (object) — optional render viewBox `{ width, height }` (default 900×900).

Orbit-only — no preset CSS-3D scene shots. Returns `{ ok, ref, worldUrl, url, stats }` (a race machine's stats: its parts, the laws it was left advised on, its measures).

## Worked examples

```
{ kind: 'vehicle', title: 'teal widebody candidate', spec: { vehicle: 'widebody airliner', decoration: { scheme: 'teal' } } }

{ kind: 'vehicle', title: 'a tram', spec: { vehicle: 'streetcar' } }

{ kind: 'vehicle', title: 'my brass kart', spec: { racer: { archetype: 'explorer', theme: { from: 'steampunk', palette: { body: '#20304a' }, finish: { trim: 'copper' } } } } }

{ kind: 'vehicle', title: 'neon razor', spec: { supercar: { preset: 'razor', theme: 'neon' } } }
```
