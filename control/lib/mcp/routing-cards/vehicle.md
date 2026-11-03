---
{
  "id": "vehicle",
  "name": "A vehicle by name, from the vehicle registry",
  "summary": "Any vehicle named the way people say it (a sedan, a tram, a tank, a business jet), read through the one vehicle registry to the build its row has at a tier: toy, stylised or realistic.",
  "when": "\"show me a pickup truck\", \"a city bus I can look around\", \"what vehicles are there\", \"a business jet in a teal livery\", \"the kart from my race on its own\", \"can this car be drawn realistic\", \"give my game a tram\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'vehicle', spec: { vehicle: '<word>', tier?, decoration? } })`: the registry reads the word to its row and shows the row's build at the tier on the studio grid; the readout's `registry` names the row, every build and what it needs to be drawn realistic. A motorcycle, scooter or bicycle is a cycle shelf machine; `look` dresses it. An excavator, a crane, a roller is a construction shelf machine; `pose` ('dump', 'rigged', or joint values), `tool`, `height` pose and fit it. In a game the same words go to `design_game`'s quick `ride`, `vehicle` and `craft`; a civilization's vehicles are its technology. The old tables (the city's nets, the fleet, the rides, the race machines, the craft shelf) are builds behind the registry, never doors of their own. Every vehicle by realm: `get_solid_vocab({ id: 'vehicles' })`; minting: `get_solid_vocab({ id: 'vehicle' })`. Full family → `get_creative_toolset({ form: 'object' })`.
