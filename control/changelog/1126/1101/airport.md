### The airport: one plan, a miniature of the whole and a wing at scale

An airport planned at its real figures from the transport hub's grammar, drawn whole as a miniature on a plinth, and,
from the same plan, one wing at full scale for a level.

- **The plan in true metres** (`airport/plan.js`, `planAirport`): the transport hub's grammar re-laid at an airport's
  figures.
  - The terminal is linear (a processor along the frontage and its piers reaching airside) or radial (a rotunda and
    its arms).
  - Each pier is 20 m wide and hooks at its tip as the old grammar's do, in one rotational sense. Each top-level
    concourse is a wing, and its branches are the wing's.
  - The stands are nose-in along both flanks, sized to the craft shelf's liners (the bizjet up to the jumbo). They are
    filled by a weighted fleet, then by the largest class that fits, each tested against every pier and every other
    stand.
  - Each stand's jet bridge runs from a rotunda off the pier's face to the aircraft's first left door, at its sill.
  - The apron and its taxilane, a parallel taxiway and a 2.8 km runway sit at their separations, with their
    connectors. The tower is landside, the maintenance hangar at the apron's end, and a forecourt and car park
    landside.
- **The miniature** (`airport/miniature.js`): the whole plan as an architect's presentation model, 1:1000 by default
  (1:250 to 1:4000), on a walnut plinth on a gallery floor.
  - The ground is in printed layers: grass mown in bands, the apron's concrete, the asphalt with the runway's edges,
    centreline, thresholds and touchdown zones, and the yellow taxi and lead-in lines.
  - The terminal's long-span roof sits over glass, or a rotunda under its dome. The piers are glazed boxes under white
    roofs and skylights.
  - The jet bridges run from their rotundas to each door. The tower has a flared cab, and the hangar a vault and its
    doors.
  - The fleet is the registry's stylised nets at each aircraft's true length, each in a seeded livery.
- **Composable:** the `/world` kind `airport` (`show: 'miniature'`; an orbited object) is minted by the transport
  hub's door (`compose_world` base `transport-hub`, `overrides: { mode: 'airport', show: 'miniature', stands?, scale? }`).
  Without `show`, the airport mode is the CSS diorama it always was.
