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
- **The jet bridge** (`airport/jet-bridge.js`), at full scale in the hull kit's language and posed by the plan's stand:
  - the fixed glazed link from the pier to the rotunda's drum on its column;
  - two telescoping tunnel sections with window bands, sloping to the door's sill;
  - the lift columns on a wheeled bogie;
  - the cab square to the fuselage, its dark bellows at the door.

  The plan swings each bridge in from a rotunda 13 m along the pier, past the door's side, and gives none where the
  door is under a bridge cab's lowest (a turboprop or a bizjet boards by its own airstairs).
- **The wing at full scale** (`airport/wing.js`, `show: 'wing'`): one concourse of the same plan.
  - Its piers are in a modern pier's language: a concrete base and service doors, a full-height curtain wall (its
    mullions, transom and spandrel), a white roof slab proud of the glass on its fascia, a skylight and roof plant, a
    glazed tip.
  - The apron is concrete in 7.5 m slabs, with the taxilane's line and each stand's lead-in line, stop bar, painted
    number and red equipment line.
  - Each stand's aircraft is off the craft shelf in the form render, made, in an airline look the seed picks, with its
    jet bridge. At the stands `crews` busies (`busy`, `all`, `none`), its ground crew stands round it, all but the
    stairs, since the bridge has the door.
  - It is minted by the same door (`overrides: { mode: 'airport', show: 'wing', wing?, crews? }`).
