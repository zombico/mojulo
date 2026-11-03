### Destructible physics: matter that breaks by what it is made of (opt-in)

Walls hold and objects break stays the default; a game that asks for destructible physics now gets it.

- **`destruction: 'physical'`**, the top rung above `world`: everything `world` breaks, broken by its matter rather than
  counted hits. The words that ask for it ("destructible physics", "realistic destruction", "structural collapse",
  "craters", "destructible terrain") name it in a composed stage. Without it nothing changes: every page keeps its bytes.
- **Matter** (`lib/graph/rupa/matter.js`): concrete, reinforced concrete, brick, stone, sandstone, adobe, glass, ice,
  steel, sheet metal, timber, pine, drywall, and soils (sand, loam, clay, gravel, snow), each as density, stiffness,
  compressive and tensile strength, the bond between blocks, failure strain and toughness, from the strength table where
  the two overlap. A thing or a terrain ask takes `matter: '<id>'`; a class has a default (a wall is brick, a crate
  timber, glass glass).
- **A blow is joules, a block holds joules**: capacity is toughness × volume × fill. A swing, a round, a burst (its
  energy from its splash radius by cube-root blast scaling, reaching a block by the solid angle it fills) and a landing
  (½mv²) each spend it; a world's `power` tier (human, heroic, super, titan, cosmic) scales every blow by orders of
  magnitude, so a foot of concrete takes a cannonball and a foot of steel does not.
- **Brittleness picks the cut**: glass and ice shatter, masonry blasts apart, steel and timber chip.
- **What holds it up**: weight is carried down to the supports, and a block crushes past its compressive strength (less
  as it is damaged); a block hung sideways (a lintel, a slab's tiles) is checked in bending at its bonds, so an
  unreinforced overhang past its span snaps and falls.
- **Heat, its own numbers**: melting and softening points, specific and latent heat, and for what burns its ignition
  point and heat of combustion. A block warms by the joules it takes; at its melt it takes its latent heat and melts;
  past its ignition timber burns at the char rate (a world's `fireTime` compresses fire time), losing strength as its
  fuel goes, heating what it touches so the fire spreads, and ending as ash. Heat weakens: a block keeps half its
  strength at its softening point, so a steel frame in a fire comes down by the load. A burst's fireball heats what it
  reaches; `heatBlock` heats from a fire, a beam or a script.
- **Matter meets matter**: a collision dissipates the closing energy of the reduced mass, less what the lower of the two
  bounces (a new number per matter) keeps, and each side takes it inversely to its stiffness, so the softer takes more.
  Density is the mass behind the speed: at the same size and speed a steel ball punches through a brick wall and carries
  on slower, paying only what each block cost, while a pine ball breaks on it. Landings use the same rule instead of
  charging the full ½mv² to both blocks, and `throwMatter` puts bodies of matter into the world (a cannonball, a
  hurled boulder), stepped finely enough not to pass through a block.
- **Liquids are cohesion at its end**: water, seawater, oil, honey, mud and lava hold no shape at rest (cohesion and
  friction angle 0), so their weight is pressure in every direction; `viscosity` says how fast they flow and `yield`
  lets mud and lava hold a low heap. On the ground grid (`lib/graph/rupa/fluid.js`) a fluid layer flows downhill,
  levels, fills a crater's bowl and keeps every drop; inside, tanks and tubs are joined by pipes whose flow viscosity or
  the opening limits, joined tanks meet at one level, an overfilled masonry cistern bursts by the hoop stress at its
  foot and floods the ground, and a hydrant, a pump and a hose make a nozzle's jet. Archimedes falls out of the pressure
  on a body's faces: in a level's pools pine floats a third under, ice nine tenths, a hollow steel hull a sixth, and
  solid steel sinks. A spray (`spray`) throws water that pushes on what it hits and cools it by its heat and its boiling,
  so a hose puts out a burning block.
- **Debris, deterministic in the force** (`lib/graph/rupa/debris.js`; every break on the runtime carries it): a breaking
  opens new crack surface against the matter's fracture energy, so a harder blow leaves more, finer and faster pieces
  and more dust, the same joules shatter glass and split timber, and the pieces take the matter's shape (shards,
  chunks, splinters, torn plates, clods) and fly away from the blow with an exact share of its energy. A crater throws
  its ejecta as clods by the cratering ejecta law; a body meeting a liquid splashes by inertia against surface tension
  and viscosity, so water splashes and lava plops. A burn leaves ash, a melt its liquid.
- **Ground** (`lib/graph/rupa/ground.js`): a soil heightfield over bedrock: craters from energy, ejecta thrown into a rim
  with the volume kept, slopes that slump to their angle of repose while a cohesive soil holds a cut face up to its
  critical height, and dig, deposit and shovel. The kernel and its laws land here; the page's deformable floor is next.
- Internal name: rupa. Map: `docs/rupa.md`.
