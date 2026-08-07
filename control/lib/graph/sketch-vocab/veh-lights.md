---
{ "id": "veh-lights", "name": "Vehicle lamps (head/tail light pairs for the veh-* shelf)", "summary": "seeded lamp recipes for the vehicle designer: round or rectangular head/tail light pairs with chrome bezels and self-closing lens domes, or a single light bar — placed on the body shell's headlight/taillight hardpoints", "when": "make headlights / tail lights / a light bar / lamps for a vehicle build", "tier": "recipe", "marks": ["lathe", "extrude"], "phase": "p1" }
---

Veh-lights (`vehicle-designer.plan.md` V5) mints a PAIR (or bar) facing
`+y`: chrome bezel ring + self-closing lens dome per side. Families
`roundDuo` / `rectDuo` / `barSingle`; modules `shape`, `spread`, and
`function` (`head`/`tail` — tail is the smaller lens, never randomized).

Both head and tail lamps take the `light` role — the shelf keeps six roles;
a red-lens look is a palette/livery choice, not a seventh role.

Placement: no chassis socket — superpose at the body's `headlightMount`
(as-is) or `taillightMount` with `flip:'y'` so the lenses face rearward.

```js
resolveVehLightsRecipe({ family: 'roundDuo', palette: 'vintageCream', seed: 'lamps-01' });
resolveVehLightsRecipe({ family: 'roundDuo', seed: 'lamps-01', overrides: { function: 'tail' } });
```
