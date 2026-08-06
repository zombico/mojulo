---
{ "id": "veh-wheel", "name": "Vehicle wheel (road wheels for the veh-* shelf)", "summary": "seeded road-wheel recipes for the vehicle designer: painted steelies with dome caps, five-spoke alloys, whitewall wire wheels with spinners, and heavy-duty deep-dish truck wheels — tire and rim as axle-axis lathes, spokes and lug nuts as shallow outboard extrudes, mounting via garage hub-mount hardpoints", "when": "make a car wheel / truck wheel / steelie / alloy wheel / five-spoke rim / wire wheel / whitewall tire / deep dish wheel / wheel and tire for a vehicle build", "tier": "recipe", "marks": ["lathe", "extrude"], "phase": "p1" }
---

Veh-wheel is the first part module of the vehicle-designer shelf
(see `lite-template/integration/plan-archive/vehicle-designer.plan.md`). It builds wheels as
workbench-valid parts, not baked concept art:

- the tire and rim barrel are `lathe`s revolved around the axle (local ±x)
- the rim face is a thin outboard lathe disc
- spokes, spinner ears, and lug nuts are shallow outboard `extrude`s

The wheel is authored resting on the grid: contact patch at z=0, hub at
z=radius. Local frame: axle along x (outboard face `+x`), `+y` forward of
travel, `+z` up.

## Families

| Family | Rim | Silhouette |
|---|---|---|
| `steelie` | painted steel + chrome dome cap | plain workhorse wheel |
| `fiveSpokeAlloy` | five chrome spokes, low-profile tire | sports/modern |
| `wireVintage` | eight wire spokes, whitewall, spinner | classic/vintage |
| `heavyDuty` | deep-dish barrel, six lug nuts, tall sidewall | truck/utility |

## Modules

- `rimStyle`: `steel`, `fiveSpoke`, `wire`, `deepDish`
- `size`: `compact`, `standard`, `tall`, `heavy` (radius 0.85 / 1.0 / 1.15 / 1.35)
- `sidewall`: `lowProfile`, `standard`, `tall` (rim radius as a fraction of tire radius)
- `hub`: `domeCap`, `centerNut`, `spinner`, `lugRing`
- `sidewallBand`: `plain`, `whitewall` (band takes the `trim` role color — a red `trim` makes a redline)

## Example Calls

```js
resolveVehWheelRecipe({
  family: 'steelie',
  palette: 'factorySteel',
  seed: 'axle-front-left',
});

resolveVehWheelRecipe({
  family: 'wireVintage',
  seed: 'sunday-cruiser',
  colors: { trim: '#ece6d6' },
});

resolveVehWheelRecipe({
  family: 'heavyDuty',
  palette: 'murderedOut',
  seed: 3,
  overrides: { hub: 'lugRing', sidewall: 'tall' },
});
```

## Generator Knobs

The wheel resolver is seed-stable. Use `randomize:true` for generated module
variation, and `colors` for role-level palette overrides:

```js
generateVehWheelVariants({
  count: 8,
  seed: 'wheel-rack-a',
  palette: 'chromeAlloy',
  randomize: true,
});
```

Color roles (shared across the whole veh-* shelf):

- `paint`
- `trim`
- `glass`
- `rubber`
- `chrome`
- `light`

A wheel uses `rubber` (tire), `chrome` (bright metal), `paint` (painted rim
surfaces), and `trim` (sidewall band, spoke accents); `glass` and `light` are
reserved for sibling modules so palettes stay interchangeable shelf-wide.

## Hardpoints

Every wheel records `garage.mountFamily: 'hub-mount'`:

- `hubCenter`: `[0, 0, radius]` — seat this on a chassis axle socket
- `contactPatch`: `[0, 0, 0]` — where the tire meets the ground

`garage.dims` carries `{ radius, width }` so socket math can place the wheel
without re-measuring geometry. Mount left-side wheels with `flip:'x'` so the
outboard face (spokes, hub cap) points away from the vehicle on both sides.

## Design Rules

- **Self-close every outward-visible lathe end** (taper to r≈0.05). The scene
  still drops flat end caps, so a near-constant-radius lathe reads as an
  open hoop head-on. A "disc" on this shelf is a short cone closing to the
  axis. This rule is shelf-wide — every veh-* module inherits it.
- Keep the rim face proud of the whitewall band and the band proud of the
  tire sidewall — the three read as separate materials from a ¾ view.
- `deepDish` is a proud chrome lip disc around a darker center plate — a
  recessed face would hide behind the closed tire drum.
- Don't model tread; `rubber` tint + silhouette carries the tire.
