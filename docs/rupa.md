# rupa: destructible physics

rupa is the internal name for matter that breaks by what it is made of, falls by what holds it up, burns or melts by
its heat, and ground that craters and digs. The person and the agent never see the word: they say "destructible
physics", "realistic destruction", "structural collapse", "craters", "destructible terrain", and the level says
`destruction: 'physical'`.

## Posture

Most games want walls that hold and objects that break, with the occasional breakable terrain. That stays the
default, and the `destruction` degrees (`none`, `objects`, `cover`, `world`) are unchanged. `physical` is the top
rung, taken only when a game asks for it: everything `world` breaks, broken by its matter instead of counted hits.
Without it nothing changes and every page keeps its bytes.

## The principles

Form is the block's box. The rest is the matter table, [`control/lib/graph/rupa/matter.js`](../control/lib/graph/rupa/matter.js),
in SI units. Steel and timber come from the strength sensor's table (`strength/materials.js`), so stiffness and
strength have one source.

| Principle | Field | What it decides |
|---|---|---|
| Cohesion inside | `tensile` | what holds the stuff together under a pull |
| Cohesion between blocks | `bond` (a block's `cohesion`) | mortar, a weld, one pour: what holds a lintel or a slab sideways |
| Rigidity | `E` | carried as data |
| Density / mass | `density` × volume × `fill` | weight on supports, momentum of debris |
| Brittleness | `strain` (< 0.05 brittle) | the cut: glass shatters, masonry blasts apart, metal and wood chip |
| Resistance | `toughness` (J/m³) | a block holds toughness × volume × fill joules: hit points, derived |
| Heat | `melt`, `soften`, `heat`, `fusion`, `ignite`, `burn` | melting, fire, and strength lost to heat |
| Bounce | `bounce` (restitution) | how much of a collision's closing energy is kept rather than dissipated |
| Soil | `c`, `phi`, `swell`, `dig` | slumping, cut faces, bulking, cratering |
| Plasticity | `yield` (Pa) | where it starts to flow and keep the shape a blow leaves: dents, holes, squashing |

Heat has its own numbers rather than being derived. Melting is cohesion again (heat breaking the bonds), but strength
tells nothing about it: steel is far stronger than concrete and loses half that strength by about 550 °C.

## A blow is joules, a block holds joules

- A swing (300 J) and a rifle round (2 kJ) at a person's power.
- A burst: its energy from its splash radius by cube-root blast scaling (W = (radius / 4)³ kg of TNT). It reaches a
  block by the solid angle the block's face fills from the burst, and a share (`heatShare`, 0.3) arrives as heat.
- A landing: ½mv² on the block and on what it lands on.
- The level's `matter: { power }` scales every blow: `human` 1, `heroic` 10, `super` 1e3, `titan` 1e5, `cosmic` 1e8.
  Powerscaling is a number measured against the landscape.

The order of magnitude, checked by a test: a 12-pound ball at 440 m/s (about 0.5 MJ) breaches a foot of concrete and
dents a foot of steel.

## Matter meets matter

A collision dissipates ½μv²(1 − e²) of the closing energy: μ is the reduced mass (the mover's own mass against
anything held in the structure or the ground), and e is the lower of the two bounces. Each side takes the energy
inversely to its stiffness, because both feel one contact force and store F²/2k. The softer side takes more: a steel
ball into brick puts 93% into the brick.

Density is the mass behind the speed. At the same size and speed, steel carries about 22 times what pine carries.
A target that breaks takes only the joules it had left, the mover pays only what that cost, and it carries on slower,
so a steel ball punches through course after course. A target that holds sends the mover back at e of its closing
speed. A pine ball thrown at a brick wall at 30 m/s breaks and the wall holds. A steel ball the same size goes through.

Landings use the same rule (a falling block on the block below, or on the floor, which takes a hit as concrete does).
So do bodies: matter thrown into the world with `throwMatter(state, { size, at, vel, ...blockMatter })`, such as a
cannonball, a hurled boulder or a falling girder. They are stepped finely enough not to pass through a block, and break
when their own joules run out.

## Distortion: plastic matter keeps the shape

`yield` is one dial across the table: the stress where a stuff starts to flow. A liquid's is 0, mud's and lava's is
their Bingham stress, and the solids run from dough (5 kPa, an impact's) and putty through lead to mild steel (235 MPa,
the strength table's own yield) and armour steel. A solid with a yield is plastic (`isPlastic`); brittle stuff (glass,
masonry, timber) has none and breaks as before. Distortion comes with destructible physics wherever a block's matter
has a yield: there is no word to ask for it.

- **A dent is a crater in a solid.** A blow's work W pushes aside V = W / H of the stuff, H its hardness (3 × yield,
  Tabor's constraint, × `heatFactor`: hot steel dents sooner). It's a paraboloid bowl as sharp as the blow (depth ÷
  radius: a round 1, a thrown body 0.5, a swing 0.25, a landing 0.15, a burst's dish 0.1), its contact no wider than
  what strikes (a round's 12 mm, a body's half-size), and its volume stands in a rim from a to 2a, a third of the depth
  high: none of it is lost, as in a crater (`dentOf` in the runtime's physics). The work comes off the block's joules,
  so the budget still decides whether it stands.
- **Orders:** a rifle round (2 kJ) leaves a dent about a centimetre deep in mild steel, a swing a few millimetres.
- **Through.** A bowl as deep as the stuff is thick (a shell's `wall`, fill × volume ÷ surface, else its box along the
  blow) is a hole. Only the plug's work, H·½π·a²·t, is spent, and the rest carries on: a round to the next block on its
  line, a swing into what stands behind, a thrown body on through, slower. A rifle round goes through a centimetre of
  mild steel and only dents armour; a thousand times it goes through armour too. A blow past twice a block's whole budget
  tears it apart outright (debris, as any break) and carries the rest the same way. Blows on one spot deepen one bowl,
  so focus fire holes a plate.
- **Squash.** A dent wider than the face it strikes flattens the whole block along the blow at constant volume (at most
  half a blow): shorter that way, wider the others, standing on what held it. A shell crumples instead, keeping its
  footprint. Its collider moves and what stood on it settles: a dropped lump of dough spreads.
- **Strip.** A plastic block hung by its side (`bond: 'lateral'`: a plate welded to a wall) whose joules run out comes
  off whole as a body (`how: 'strip'`), back toward the blow, instead of breaking into debris. Focus fire strips one
  plate and leaves its neighbours; the plate's budget is the HP that says whether it stays.

### The tool and the cut

A strike carries what it's struck with: a tool word on the striker's rule, `strikeTool` (`sword`, `axe`, `knife`,
`bat`, `metal-bat`, `hammer`, `fist`, or `{ is?, edge, stroke?, strength, force?, contact? }`, checked at mint by
`readTool`). A swing is a sword and a round a round unless the rule says otherwise; a burst, a landing and a thrown body
carry no tool, and their energy alone decides.

- **A tool can't press harder than it is strong.** Its `strength` (Pa) is the most pressure its face takes: a wooden bat
  (50 MPa) can't bite mild steel (hardness 705 MPa), a hammer (2 GPa) can. Its `force` (N, × the world's power) caps a
  bowl's radius at √(F / πH), and what the force can't press rings off unspent: a hammer barely marks a steel block.
- **Thin panels dish.** A panel thinner than the bowl would be wide, or one a soft tool can't bite, bends once the force
  passes its collapse load π·σy·t²/2 (a plate's yield-line load under a point): W = Pc·δ to δ = t, then it stretches as
  a membrane. The dish is broad and moves both faces, with no rim. A wooden bat's 15 kN dishes a millimetre of steel
  about 3 cm and leaves a centimetre plate whole (37 kN to bend it); at heroic power it dents that plate too.
- **An edge harder than the stuff cuts it.** Plastic matter and wood are cuttable (`kerfHard`: 3 × yield, or the wood's
  crushing strength; brittle stuff breaks as ever). The cut runs on the plane of the stroke where it lands, snapped to
  the block's axes (`level`: horizontal across a side; `chop`: vertical across it; from above, across the longer way),
  W / `kerfWork` square metres a stroke (`kerfWork` = fracture energy + yield or tensile strength × the 2 mm kerf), so
  it deepens by that over the block's width. Strokes in one place deepen one groove. The blow's work goes into the cut;
  the block's budget loses only what the kerf held.
- **Through a solid, the block parts in two** (cleave at run time): two blocks on the cut's plane (`<id>/a`, `<id>/b`,
  the break `how: 'cut'` with `into` and `plane`), each with the matter, heat and marks on its side and its share of the
  budget by volume. The held graph and the load pass decide what stands: the top of a post cut through rests on its
  foot, and the end of a beam chopped off past its post falls. Through a shell, it's a slit.

### Panels: metal on objects

An object that moves (a car, a mech, a locker on a cart, a drum) is not built of blocks, but its skin can be: an
entity's `panels` are thin metal plates in its own frame, each struck by the same law as a plastic block
(`rupa/panels.js`, the runtime's PANELS).

- **A panel** is `{ id?, face, at, size, wall?, matter?, color? }`: `face` is front, back, left, right, top or bottom
  (x along the entity's heading, y to its left, z up, from its transform's point); `at` is the middle of the plate's
  outer face; `size` is its width and height across the face; `wall` is its thickness (a car's body panel is about a
  millimetre, the default); `matter` is a metal that yields (steel unless said; glass, stone and wood are refused).
  `panels: true` on a box body plates every face but the floor in the body's colour.
- **The blows** are carried into the object's frame (its heading, and a flyer's roll and pitch). A round meets the
  nearest plate on its line: it holes a car-thin panel, leaving at least its own bore, and dents a thick one; a plate
  that stops it spares whatever stands behind. A blast is a load across the whole plate, so it dishes the plate in,
  as wide as the plate is, and only ever on its outer face (what is behind a plate is the object it skins). A swing
  strikes with the striker's tool: a bat dishes a millimetre sheet and rings off a centimetre plate. A plate is always
  struck on its broad face, never on its edge.
- **Worn out**, when its dents have spent its joules or a blow carries twice what it holds, a panel comes off as a body
  of its own, thrown away from the blow with the object's own motion.
- **On the page** each plate is the sheet it is, bent as one: a dish in where it was struck from outside and out where
  from inside, a dent the law's bowl and its rim, an opening where a hole is wider than the sheet's grid, and a round's
  smaller hole as its bore and petals. A box body plated on every face is drawn by its plates alone, so a dent goes
  in; any other body is drawn as well, and a dent deeper than the 2 mm the plate stands proud of it goes behind it.

### Felling

A level groove (a cut on a horizontal plane into a side) leaves what is above it resting on the uncut wood, the hinge.
A stack whose centre of mass hangs past the hinge's edge is held only by the hinge's tension, σt·b·h²/2 against the
weight's overhang; once the groove has thinned the hinge past that, it tips. A cut clean through leaves no tension: the
top tips only if its centre of mass is off its stump, so a block sawn level with its weight over its seat stands.

What tips fells: the block above the groove and everything it carries turn as one body about the hinge's edge under
gravity (θ'' = M·g·rc·sin(θ + φ0) / I, the stack's own inertia about the hinge), and a quarter turn on they land lying,
as boxes again, since a quarter turn keeps a box a box. They come down clear of the stump they hinged on, and the
fall's energy, the drop of their centre of mass, is spent on them as a landing. A felling breaks nothing, so it leaves
no debris. `state.rupa.fells: [{ ids, pivot, dir, theta, done }]` is what the page turns them by.

The notch decides the fall. A rooted oak 30 cm across with its crown leaning a quarter metre goes toward the side the
axe cuts away, at about sixty 300 J strokes, with a hinge of a centimetre or two; with no lean it still goes into the
groove, once the groove passes the trunk's middle. The axe is a level stroke, so it fells from the side and splits
across from above.

Each block keeps its dents (`b.rupa.dents`, merged where they overlap, at most 24) and a `form` count, and
its cuts (`b.rupa.cuts`); `state.rupa.dents` records each one. The page draws a marked block as its box subdivided
where its marks are: each bowl with its rim, a hole dark through to the far face where it petals out, a dish moving
both faces, a groove dark along its plane. A cut block's halves wear its skin, a block's drawing follows its box as it
falls, and a stripped plate falls with its body, tipping away from the wall. It's drawn only when a block's matter has
a yield or can be cut, so every other page keeps its bytes.
`strikeBlock(state, id, joules, how?, src?)` lands a blow by id (a script, a test; `window.__mojCtrl.strike` on such a
page).

## Liquids

In rupa a liquid is the end of the cohesion dial: its Mohr–Coulomb pair is `c` 0 and `φ` 0, so it has no shear
strength at rest. A heap of it goes flat (the same slump rule soils use), and its weight becomes pressure in every
direction, p = ρ·g·depth. Two numbers are its own:

- `viscosity` (Pa·s) sets how fast it flows: water 0.001, oil 0.08, honey 10, mud 50, lava 1,000. It's a rate, not a
  strength, so it's separate from cohesion.
- `yield` (Pa) is the stress below which a thick liquid holds a slope (a Bingham fluid: mud, lava). Water's is 0.

A liquid can't be a block (`blockMatter` refuses it). It lives in two places:

- **Outside, on the ground grid** ([`fluid.js`](../control/lib/graph/rupa/fluid.js)): a depth over each cell that
  flows by differences in surface height (the virtual-pipe shallow-water scheme). Viscosity drags a thin layer at
  3η/(ρd²); a Bingham liquid stops where ρ·g·d·slope falls under its yield. Heaps level, lakes find one level, rain
  pools in a crater's bowl and its rim dams a thin sheet. Volume is kept exactly. `pour`, `flow`, `drain`, `fluidAt`.
- **Inside, simplified:** tanks and tubs joined by pipes. A pipe's flow is the smaller of what viscosity lets through
  (Hagen–Poiseuille) and what its opening lets through (Torricelli), so water through a hose is opening-bound and honey
  is pipe-bound. Joined tanks meet at one level. A tank's wall bursts by the hoop stress at its foot (p·r/t against the
  wall matter's tension or bond), and what it held floods the ground grid. A pipe end can be a tank, a ground cell,
  the mains (`source`: a hydrant) or a `nozzle`; a pump adds pressure on the way. `stepVessels`, `jetOf`.

**Archimedes falls out** of the pressure on a body's faces: the bottom face's push beats the top face's by ρ·g·V under,
and the sides cancel. In a pool (a level's `matter: { pools: [{ min, max, liquid }] }`) pine floats 35% under, ice
91.7%, a steel shell with `fill` 0.02 floats 15.7% under (a ship), and solid steel sinks. A body moving through it also
feels drag (½ρ·Cd·A·v² and Stokes' 3πηDv), and a block standing in one weighs less on its supports.

**Spray:** a nozzle (`spray(state, { at, dir, speed, flow, seconds })`, the jet's speed and flow from `jetOf` or a
hydrant-pump-hose network) throws water in parcels under gravity and air drag. A parcel pushes on what it hits and cools
it: 4.19 kJ/kg a degree up to 100 °C, then 2.26 MJ/kg to boil off. A burning block drenched below its ignition goes out. A jet harms
what it strikes only when its stagnation pressure, ½ρv², passes the matter's strength: a hose at 10 bar (about 0.8
MPa at the face) never wears a log away; a cutting jet at thousands of bar would. A body crossing a pool's surface also
loses its heave to the waves it makes, so a dropped block settles at its draft in seconds.

## Air and wind

Air is matter too. It's in the matter table as `air`: a gas weighing 1.2 kg per cubic metre, about 800 times lighter
than water. Like water it has no strength of its own, so it can't hold a shape and nothing can be built from it. It's
simply what the world stands in.

### What still air does

Air does two things to anything in it, and both are small unless the thing is light or fast.

- **It holds things up, a little.** Anything in air is pushed up by the weight of the air it takes the place of
  (Archimedes, the same as in water). A 1 m block gets about 12 N of lift from air against 9,800 N from water. That's
  why balloons float and bricks don't notice.
- **It slows things that move through it.** Pushing air aside costs energy. A heavy block barely feels it. A light
  crate, a spray of water or a cloud of dust feels it a lot, which is why the hose's jet falls short of where it would
  land in a vacuum.

### What wind does

Wind is air that's moving. Everything above still applies, with one change: drag now pulls things *along with* the
air instead of only slowing them. So the wind carries light things and bends the hose's spray sideways.

Wind also pushes on whatever it hits. The push on each square metre of a face is ½ × air density × speed²:

| Wind | What it's like | Push on a wall |
|---|---|---|
| 15 m/s | a strong breeze | about 140 Pa |
| 40 m/s | a severe storm | about 960 Pa |
| 70 m/s | a strong hurricane | about 2,950 Pa |

Doubling the wind's speed quadruples the push. A block standing behind another block, out of the wind, gets no push.

### What wind knocks over

Wind can tip a stack over or slide it along. What holds a stack in place:

- **its weight.** A heavier, wider stack is harder to tip.
- **mortar, if its joints have it.** Masonry (brick, stone, concrete) is mortared by default, and the mortar's grip
  holds the joint closed. Everything else (timber, crates, metal) is dry-stacked and only its weight holds it.

If the wind's push beats what holds a stack, the stack leaves the structure and falls as loose pieces. In practice a
70 m/s gale tips a dry pile of pine blocks, while a mortared brick wall the same height stands. A 15 m/s breeze moves
neither.

### Shelter, leaves and the ground

- **A wall casts a wind shadow,** by the blocking law below: right behind a solid wall the air is still, and it
  recovers with distance as a wake does. A leaf falling behind a wall drifts much less than one in the open.
- **Thin things tumble.** A leaf or a sheet flutters as it moves, and a tumbling body shows the air on average a
  quarter of its surface (Cauchy's rule), whichever way it's going. That's why a leaf falls at about 2 m/s.
- **Wind moves what's lying on the ground** once its drag beats the friction holding it (half its weight). Leaves
  skitter along; a brick lying there stays. On the ground, things slide against friction rather than stopping dead.

### Drawing wind cheaply: the wind script

Simulating every leaf as a body is accurate but costs work every frame. For things light enough that the wind carries
them (leaves, litter, petals, ash), [`wind-script.js`](../control/lib/graph/rupa/wind-script.js) gives the same
motion as a formula of time, so a GPU can draw thousands of them for the cost of one number (the time) per frame.

It's exact enough because a leaf catches up with the air in about a quarter of a second, against seconds of falling.
So a leaf moves at the wind's speed while it sinks at its falling speed, and its path has a closed form:

- **height** drops at the falling speed, which comes from the same drag law the physics uses (about 2 m/s for a leaf);
- **drift** is the wind's speed summed over the fall, and the power-law rise with height sums exactly;
- **gusts** add their own exact sums;
- **behind a wall** the calm air's slowdown sums exactly too (it comes out as an exponential), so leaves still settle in
  the lee;
- **on the ground** a thing skitters once the wind beats its friction, which works out to √μ times its falling speed
  (about 1.4 m/s for a leaf), and after a rest it starts again from its release point, so the script loops on its own.

`scriptOf(wind, { kind, source, wakes, field })` turns a level's wind into the script's numbers; `leafAt(script, i, t)`
is the JavaScript reference; `GLSL` is the same formula for the GPU. Its tests hold it to the simulation: the same
falling speed, a landing point within 12% of a simulated leaf's in a steady wind, and less drift behind a wall.

### The wind solver: a whole scene at once

Instead of choosing a script for each element by hand, [`wind-solver.js`](../control/lib/graph/rupa/wind-solver.js)
reads each element's physics and decides how the wind shows it, with the reason in numbers:

| Decision | When | Examples |
|---|---|---|
| **drift** | a free thing that catches up with the air in under half a second (falling speed ÷ g) | leaves, petals, litter, ash, snow |
| **bend** | fixed at its foot and flexing: the wind loads it as a cantilever, its tip moving wL⁴/8EI + FL³/3EI along the beam's curve, swaying at its first mode | grass, reeds, saplings |
| **hang** | hanging from a point: it leans until drag meets weight, atan(q·Cd·A ÷ m·g), and swings as a pendulum | flags, banners, lanterns, hanging signs |
| **still** | the strongest gust can't move it: drag on the face the wind meets stays under friction, or it would bend or lean under half a degree | a brick lying on the ground, a steel signpost |
| **simulate** | too heavy to follow the air, yet moved by it, or snapped by it (the strongest gust stresses a rigid foot past its strength) | a hollow crate in a gale, a sapling that snaps |

The strongest gust is the wind at the element's height times (1 + gust), from the runtime's own wind, so a scripted
blade of grass and a simulated crate feel the same air. Elements of one kind become one batch: a meadow of 5,000 grass
blades is one GPU draw with one set of numbers. `solveWind(elements, wind)` returns the batches, the lists to still and
to simulate, and every reason. Each kind is a row in `KINDS`: a new kind is a row.

### Dust and smoke: puffs on the wind

Dust and smoke are drawn the way leaves are: each puff's path is a formula of time, worked out from the same wind and
the same air (`puffAt` in the runtime's physics, so a World page draws exactly what the tests check).

- **Drift.** A puff moves at the wind of its height (slower near the ground, as the wind is), plus the gusts' exact sums.
- **Smoke rises on its heat** by Briggs' plume rise: Δh = 1.6·F^⅓·t^⅔·u^(−⅓), with F = g·Q / (π·cp·ρ·T) the buoyancy
  of a fire giving Q watts, until it levels off at its final rise. A 600 kW fire's smoke rises about 15 m in a 5 m/s
  wind; a stronger wind holds it lower, and a bigger fire's goes higher. Calm air is taken at 1 m/s, since a plume stirs
  its own.
- **Dust settles** at its grains' speed (Stokes for the fine, Newton's drag for the coarse, the slower; the same law the
  debris uses): 10 µm grains sink at millimetres a second and hang for a minute, a millimetre grain at metres a second.
- **It spreads as the air mixes it**, σ = σ0 + i·u·t, the turbulence's intensity i rising with the ground's roughness
  (sea, open, city), and a rising plume is at least half as wide as it has risen.
- **It fades as it thins.** A puff shows by its optical depth, 1 − e^(−K·m/πσ²): the same mass spread wider is fainter,
  so smoke is as thick as the fire is big. Dust's mass deposits as it settles; steam's droplets evaporate within a couple
  of seconds. K is the stuff's mass extinction: soot about 8,700 m²/kg, a grain 3/(ρ·d).

**The smoke solver** ([`smoke-solver.js`](../control/lib/graph/rupa/smoke-solver.js), the wind solver's sibling) decides
each source by its physics, with the reason in numbers:

| Decision | When |
|---|---|
| **plume** | a fire: continuous and buoyant, a puff every half second while it burns, each the soot of that time (1.5% of the fuel burnt, a wood fire in open air), rising on its heat release |
| **puff** | a break's dust, a burst of steam: let go once; dust as a billow of five puffs in each size that hangs |
| **hang** | a size of dust settling slower than the air stirs it (i·u, u at least 1 m/s) |
| **fall out** | a size settling faster: it falls with the debris's spray at once, and isn't smoke |
| **skip** | nothing of it in sight: it starts too thin to see |

On the runtime the sources go on `state.rupa.smoke`: a break's dust (its grains below 2 mm in four sizes shared by the
break's Rosin–Rammler, its cloud starting as big as what broke), a burning block's plume from its top (its real heat
release: `fireTime` hastens how long a fire burns, not how big it is; the plume ends when the fire does), and the steam
a hose boils off a hot block. The page draws them as soft sprites from one pool: dust in the colour of what broke as the
scene lights it, wood smoke grey and paler as it thins (black smoke is an oil's or a tyre's), steam paler still.

### Describing a wind

A level sets it in its `matter` settings:

```js
matter: { wind: { speed: 25, dir: 90, terrain: 'city', gust: 0.3 } }
```

- `speed` is the wind at 10 m up, in m/s. Wind is slower near the ground and faster higher up.
- `dir` is the direction it blows toward, in degrees (0 is +x, 90 is +y), or an `[x, y]` vector.
- `terrain` sets how much the ground slows it: `sea` least, `open` (the default), `city` most, because buildings break
  up the air near the ground.
- `gust` (0 to 1) adds gusts: the wind rises and falls as gusts sweep downwind. They're seeded, so the same level
  always gets the same gusts at the same place and time.


### One wind

A level's `wind` (the one its trees, grass and hung cloth sway in, `vegetation/wind.js`: a speed at 2 m over a log
profile) is the air its physics feels ([`one-wind.js`](../control/lib/graph/rupa/one-wind.js)). Under `physical`, when
the level's `matter` names no wind, the blocks, dust, smoke and drifting leaves take it: its speed at 10 m is
u2·ln(10/z0)/ln(2/z0), and its power-law exponent α = ln(u10/u2)/ln 5, so the two profiles agree exactly at 2 m and at
10 m and within 2% between. The level's `matter.wind` still overrides it for the physics alone. A geocube's `wind` is its
outside levels' wind when the recipe names none, its specimen worlds' too (town, land, path). The cube's wind and its
dunes share their way: a dune field that names no wind of its own is laid across the cube's, and dunes that name one give
the cube's wind its direction when it names none (both read degrees from +x).

The wind solver reads plants by species: a pole by geometric similarity, its trunk a fixed share of its height and its
crown's frontal area a fixed share of its height squared (`PLANT_FORMS`: broadleaf, conifer, palm, culm, the culm
hollow). Its foot's stress grows as u² and its section and lever both as H³, so the wind that snaps it (`breakSpeed`) is
the same at every size: about 39 m/s at a broadleaf's crown, 31 for a conifer's denser crown on weaker wood. Storms break
trees of every size near 42 m/s (Virot et al. 2016). A geocube's trees are read by their biocube's leaf form
(`plantOfLeaf`: an evergreen spire a conifer, every other crown a broadleaf). A stand of a species stands still in a breeze, bends in a fresh
wind, and is handed to the physics when the strongest gust at its crown passes that speed.

**Trees on the page.** In a physical stage the trees built whole near the trail are blocks
([`tree-blocks.js`](../control/lib/graph/rupa/tree-blocks.js)); the stamped and far trees stay scenery. Each is a trunk
of green wood with its own cross-section (a square post of the same area) in courses up to its crown, and a crown resting
on it: leaves and twigs, 0.4% of the crown's box (a few kg a cubic metre) and 80% open to the wind. A tree on raised land
stands on a footing. Its faces go with the tree they stand by, so a broken trunk or crown disappears with its block. A
blast breaks it, fire burns it (the crown as fine fuel, the trunk as wood), an axe fells it as any block is felled, and a
storm throws it: when the gust at its crown passes its break speed (from its plant form at its height), it turns downwind
about its foot and lies along the wind, its crown beyond its trunk. The storm is a tree's only wind law: the stack
tipping that topples a loose pile never tips a trunk, which is one piece of wood on its roots. The minute-zero load
check counts the trees too.

**Rain and snow.** A physical level's weather, or one under a geocube's wind, leans its rain and snow along the wind's
way. Any other world keeps the seeded heading it always had, so its page is unchanged.
### Why air and water share their code

Water and air follow the same laws with different numbers: water is heavy and slow, air is light and fast. So both go
through the same functions in the runtime (`controllable/rupa.js`):

- `pressure(fluid, { depth, flow })` gives the pressure from a fluid's weight (ρ·g·depth: a tank's water on its base)
  plus the push of its flow (½ρv²: a hose's jet, the wind on a wall). `flowOf` turns a pressure back into a speed,
  which gives a nozzle's jet.
- `immerse(box, mass, velocity, fluid, flow)` gives a block's lift and drag in any fluid. A pool is a fluid with a
  surface; air is the fluid everywhere, and its `flow` is the wind. `stepIn` applies the result each step.

The tanks, pipes and nozzles (`fluid.js`), grain settling (`debris.js`), the pools, the hose's spray and the wind all
call these functions, so a fix to the physics reaches every fluid at once.

## Blocking: flow's opposite

A barrier is one number: its **porosity**, the open share of it (0 a solid wall, about 0.5 a hedge or a slatted fence,
1 nothing at all). Set it on a block with `{ matter, porosity }`. How any flow gets past a barrier follows from that
number by standard laws, never from a tuned "lets x% through":

- **Resistance:** a perforated barrier's loss coefficient, k = (1/(Cc·φ) − 1)², with Weisbach's contraction
  Cc = 0.62 + 0.38φ³. It's the pressure needed to push flow through, in units of ½ρu².
- **Bleed:** the share of the flow's speed that passes through, 1/√(1 + k). None passes a solid wall.
- **Drag:** what the barrier takes from the flow, Cd = 1.2·k/(1 + k): a solid fence's 1.2, nothing for an open one.
  The wind's push on a porous block scales by it, so a slatted fence stands where a solid one tips.
- **Wake:** behind a barrier the flow recovers as a plane wake does. Its slowdown is 0.98·√(Cd·2h/x) at x behind it
  (Schlichting; 2h is its height doubled by its mirror in the ground), capped close behind at what doesn't bleed
  through. A solid wall stills the air right behind it; a hedge shelters less deeply. Above the barrier's top the flow
  passes over. The runtime's wind, the wind script (whose leaves still have an exact formula: their time through the
  wake integrates exactly) and the wind solver all use this one law.

**Water** meets barriers on the ground grid (`barrier(field, { box, matter, porosity, thick })` in `fluid.js`):

- **Overtopping:** the barrier raises the ground it stands on, so water pools behind it and pours over its top when it
  rises past.
- **Seeping:** water passes through its open share by the same Bernoulli law as a pipe's opening.
- **Breaching:** every step the water's push, ½ρg·(d₁² − d₂²) sliding it and ρg·(d₁³ − d₂³)/6 tipping it, is weighed
  against the barrier's weight and its joint's cohesion. Where the push wins, that part breaches and the water floods
  through. A thin adobe wall gives way under 1.5 m of water; a thick concrete one holds.

## Debris

What a breaking leaves is deterministic in the force: the same blow on the same thing leaves the same debris, and a
harder blow leaves more, finer and faster pieces ([`debris.js`](../control/lib/graph/rupa/debris.js); the runtime runs
the same `fragments` on every break and puts it on the break record as `debris`).

- **Solids:** the breaking opens new crack surface, 1% of its joules over the matter's fracture energy (`frac`, J/m²:
  glass 8, concrete 100, timber 10⁴, steel 2×10⁵). The mean piece is 6V over all its surface, so the same joules
  shatter glass and only split timber, and ten megajoules into glass leave powder. Sizes follow Rosin–Rammler with the
  matter's `spread`; pieces under 2 mm are a dust cloud. Each piece takes the matter's `shape` (shards, chunks, splinters
  along the longest axis, torn plates, clods). A share of the joules flies (burst 0.3, round 0.15, swing 0.1, crush
  0.05), away from where the blow came from, smaller pieces faster, and their kinetic energy sums to that share exactly.
  A burn leaves ash; a melt its liquid.
- **Dirt:** a crater's ejecta as it flies (`dirtOf`): clumps, spray and dust. Each packet's speed comes from where it
  leaves the bowl, by the Housen–Holsapple ejecta law v = 0.6·√(gR)·(r/R)^(−1/μ), with μ the soil's (`mu`). Cohesion
  against the stress of being thrown decides how it flies. The share c ÷ (c + ½ρv²) holds as clumps: lumps from the
  rim, none from dry sand, more from clay than loam. A clump landing faster than √(2c/ρ) crumbles. The rest is spray,
  grains (`grain`) whose drag is g over their settling speed (Stokes or Newton, the slower), so sand and gravel fly far
  and silt slows at once. A share of the soil's `fines` hangs as a dust cloud and the rest falls with the spray. A harder
  charge throws faster and tears more of it. Clumps, spray and cloud weigh what the ejecta does, and their energy stays
  under a quarter of the charge's.
- **Splash:** a body meeting a liquid opens a cavity and splashes when Mundo's √We·Re^¼ passes 57.7 (surface tension
  `tension` and viscosity against inertia). How much flies scales with inertia over viscosity, so water splashes, honey
  gloops and lava plops. A body entering a pool on the runtime records its splash (`state.rupa.splashes`).

## Scars: cosmetic damage

A game whose map may not change (walls that hold, a floor that never craters) can still show its blows. A level's
`scars` (`true`, or `{ ground?, wall? }`, each a matter) keeps every collider, the floor and the footing exactly as
they were, and paints what each blow would have done, by the same laws as a physical world:

- **A burst near the floor** paints the crater it would dig: the energy that reaches the ground (less the higher it went
  off, none above its own radius) over the ground's `dig`, the bowl and the ring of thrown soil out to three radii. Its
  dirt flies as clumps, spray and a dust cloud (the Housen–Holsapple law above).
- **A fixed wall in a burst's reach** is scorched on the face toward the blast by its share of the energy. The blow
  crushes a bowl whose volume is its joules over the matter's crushing strength (V = E/σ, as a crater's is E over the
  soil's `dig`), a dish 0.4 as deep as it is wide; the soot covers the disc where the burst's radius meets the face. The
  bowl spalls off as fragments, a twentieth of the blow breaking it (the rest goes to heat, sound and the wave through
  the wall). A matter that yields (steel) dents by its yield strength instead and throws nothing.
- **A round** that stops on a wall chips it by the same law (a rifle round takes a few centimetres out of brick, less out
  of stone) and throws chips; one that stops on the floor leaves a pock.

Unnamed, the ground and the wall come from the world's geocube, else loam and brick. Outdoors the ground is the land's
own: its commonest ground off the path, from the cube's readout of what the land is (`era/substrate.js`: soil is loam,
sand sand, scree gravel, bare rock stone, wet ground clay); indoors it is the floor's matter; a cube that names its
`matter.ground` keeps it. The walls are the cube's wall role. A
floor that is no soil (flagstones) digs as its toughness allows and throws chunks. Scars go with any degree: crates
still smash under `objects` while the walls they stood by take scorch marks. A game's `mechanics.scars` is copied onto
every level it makes; a stage's words ("cosmetic damage", "scorch marks", "bullet holes", `SCARS_WORDS`) set it where
the recipe does not. The marks live on `state.rupa.scars.marks` (seq-keyed, the newest 96); the page paints each once
as a decal and flies its debris on sim time, seeded by the mark. Without `scars`, nothing is kept and the page carries
none of it.

## Triggered breaks

What a world can break, the game or the player can set off. A cue (a zone entered, a lever used, a timer, a boss's
fall, any event on the bus) has three effects for it, and two happenings to wait on
([`trigger.js`](../control/lib/graph/worlds/controllable/trigger.js), read in
[`playscape/ui/cast.js`](../control/lib/graph/playscape/ui/cast.js)):

- **`blast: { at, radius?, hurt? }`**: a charge at a place (a spot, an anchor, a point). It is a burst like a
  grenade's: under `physical` its energy comes from its radius by blast scaling and each block takes its share; under
  any other degree each block in reach takes one blow. `hurt` takes that much hp from each body inside it. Scars paint
  it on a map that may not change.
- **`collapse: group | { group, how?, storey?, stagger? }`**: a building comes down. `base` (the default) breaks what
  stands within `storey` metres (3) of its foot, and the rest falls on it by the world's gravity; under `physical` the
  landing breaks what it lands on, so a tower comes down by its own weight. `whole` breaks every block. `stagger` paces
  the blocks, bottom up, like a demolition's charges.
- **`break: id`**: one block, or each block of a group.
- **`when: { breached: group }`** fires when a group's first block breaks; **`when: { fell: group }`** when half of its
  blocks are broken or have fallen. Each fires once. `broke:<id>` still names a single block.

A group is a block's id or its building's: the id before its last `:`. A fractal structure is `structure:<id>` (or its
own id); a shell house is its id (or its anchor's, `house-<id>`). The builder is composed only onto a page whose cues
use these, so every other page keeps its bytes. The breaks run inside the world's own step, at frame grain, seeded, so
the same triggers give the same world.

## Effects on the flow (rupa-vayo)

The game's juice (its blasts, its power-ups) can move the way the world's air moves them, opt-in on a composed effect
style: `fxStyle: { flow: true, … }` (any look or flavor). A style without `flow` keeps every byte.

Nothing is simulated on the page. When an effect goes off, [`rupa/vayo.js`](../control/lib/graph/rupa/vayo.js)
presolves the air round its spot once (`vayoEnvelope`), and every tracer's path is then a formula of time
(`vayoPoints`), the way the wind script and the smoke puffs already work:

- **The envelope**: about thirty rays from the spot against the world's boxes and its floor give the open ways and the
  face each way meets. A wall shuts half the sky, a corridor opens two ways, a ceiling flattens the dome. What a way's
  face stops slides along it and never past any face it runs toward. The envelope also holds the floor, the world's one
  wind (its physics' own when the level names one) and the medium: water when the spot is in a pool.
- **The laws**, as shapes and scalings (the time stretched for the eye, as anime holds a frame):
  - the front races out and slows (r ∝ t^⅖, Sedov–Taylor);
  - the hot core lifts on its heat (√(g·R), less in thin air, a pulsing bubble in water) and rolls into a ring vortex, so a cap curls over into a mushroom without a stem;
  - swirl is a real vortex, fast at its core (Lamb–Oseen);
  - smoke climbs as a plume (Δz ∝ t^⅔) and leans with the wind of its height;
  - a charge draws in on a log spiral.

[`rupa/vayo-fx.js`](../control/lib/graph/rupa/vayo-fx.js) reads each part of an explosion for what it is and gives it
its flow:

- the fire's body is the core, fewer and larger puffs (a bold shape), with its glow as the white-hot heart;
- the stem goes (the roll makes the cap);
- the smoke is the plume;
- the chips are debris thrown along the open ways;
- the sparks become embers, a third as many, cooling white to red to dark;
- the ground ring becomes the dust skirt the blast runs along the ground; a ring of air stays as a thin haze.

A power-up's aura (its onions and rings of spikes) gives way to flame tongues rising and turning round the body, with a
white-hot core, motes drawn in on a spiral, pebbles lifting off the ground, and a gust of dust pushed out along it. The
combat page's bursts (a grenade's, a death's, a scripted blast's) go off as the flow's blast instead of additive
spheres, and a hit is a soft flash and a ring of air (sprites) instead of a sphere, a torus and a star of lines.

The look is the register's lens over the motion: the isekai look's glow, the cel look's bands (a cel fire is its core on
the flow, not spirit onions), the material look's smoke. It follows what the anime games from Dragon Ball FighterZ on
do:
- limited animation: fewer frames, each a pose (Guilty Gear Xrd's pipeline, which FighterZ shares);
- a white-hot core in a saturated shell;
- a blast in stages that contrast in time: a flash, a fireball that grows fast and holds, smoke billowing out, then
  dissipation;
- bold, solid shapes rather than a cloud of dots;
- a power-up as flame tongues round the silhouette, motes drawn in, pebbles lifting and dust pushed out along the ground.

### A blast's air on the world's fires

On the flow, a blast's air is felt by what burns as well as drawn
([`worlds/controllable/vayo-air.js`](../control/lib/graph/worlds/controllable/vayo-air.js), emitted only when the world is
on the flow and has fires):

- **The blast's wind.** A burst's charge (its kilograms of TNT, from its splash radius as above, × the world's power) gives
  an overpressure that falls with the scaled distance Z = d / W^⅓ (Kinney–Graham). The air behind the front moves at
  u = 5p·c₀ / (7·Mₛ) with Mₛ = √(1 + 6p/7) (Rankine–Hugoniot, γ 1.4). A kilogram's is about 300 m/s at 2 m, 60 at 5,
  23 at 10 and 10 at 20. A wall between the burst and a fire shelters it, and a third of the wind gets round.
- **A fire's limit.** The air that strips a flame from its fuel grows with the flame's size, since a bigger flame keeps
  its gas longer: u_bo = 3 m/s × (D / 1.2 cm)^0.7 for a fuel bed D across. A candle's is 3 m/s, a torch's 10, a
  campfire's 43, a metre-wide block's about 70.
- **Three zones.**
  - Under half the limit the fire is **fanned**: it burns faster by the bellows' own law (× (1 + 0.07·u)), its bed
    stoked for a couple of seconds after a blast, and its flame leans away and flares.
  - From half to the whole of it, the fire is **straining**: its flame lifts off its bed and gutters, the sign it is
    about to go.
  - Past it, the fire is **blown out**.
- **Inside the fireball the heat wins.** What a burst's fireball reaches catches by the blows' heat, and no air is
  reckoned there. So a grenade lights the crates it engulfs and puts out the torches a few metres off.
- **A burning block blown out:**
  - it stops burning (`blowout` on its hits, `by` the blast or the wind), and its plume ends;
  - its face is cooled to just under its ignition, so a neighbour still burning relights it within a second or two,
    and a lone one cools out;
  - its hot bed smoulders a wisp of smoke for a couple of seconds (a smoulder's heat, a tenth of its flame's, at a
    smoulder's soot yield), and its bed glows dull red on the page while it is hot.
- **A fire the physics does not hold.** A torch, a candle or a brazier is blown out by the same law and stays out.
- **The world's wind** fans and strains a block's fire the same way, a few times a second, and a gale past a fire's
  limit blows it out.

The page draws a fire's air as its wind plus each recent blast's: outward, held for the eye over half a second, at most
20 m/s for the look. The physics reckons with the blast's true speed.

## What holds it up

The basic break pass ([`rules-basic.js`](../control/lib/graph/worlds/controllable/rules-basic.js)) still decides what
is held: the floor, a fixed collider, a held block under it, or a held block beside it for a `bond: 'lateral'` block.
rupa adds the load ([`controllable/rupa.js`](../control/lib/graph/worlds/controllable/rupa.js)):

- **Crushing:** weight and everything a block carries goes down to its supports, split by contact area. A block crushes
  past its compressive strength × what it has left (damage and heat both reduce it).
- **Spans:** a group of blocks held only sideways is checked in bending at the bonds that hold it: M = W·lever for a
  cantilever, W·lever / 4 when held on both sides, against cohesion × Σ b·t²/6. Take one jamb from under a long brick
  lintel and it snaps.

## Heat

Each block has a temperature, starting where it was built (an ice block below freezing). Heat raises it by
Q / heat capacity. At `melt` the joules go to latent heat, and once that is spent the block melts. Past `ignite`, a
combustible block burns: its fuel goes at the char rate (Eurocode 5's ~0.65 mm/min into each face), scaled by
`fireTime` (60 play-to-fire seconds by default), and its strength goes with it. A solid chars into its faces; a shell
(a crate's planks round air, a crown's needles) is solid wood charring on both faces of its walls, so it flares in
minutes where a log burns for hours. It ends as ash. Heat weakens: a block keeps `heatFactor` of its strength,
whole where it started, half at `soften`, none at `melt`, so a steel frame in a fire comes down by the load pass.
A block that isn't burning cools back (`cool`, 120 s). `heatBlock(state, id, joules)` is the entry point for a fire,
a beam or a script.

### Combustion: how a fire's heat leaves it

A burning block's flame stands Heskestad's L = 0.235·Q^⅖ − 1.02·D tall (Q its heat release in kW, D its top's
equivalent diameter; `flameOf`): a pine log's under a metre, a burning crate's about two. Its heat leaves three ways:

- **into what it touches**, a tenth of it, by its flame;
- **by radiation**: χr = 0.3 of it from mid-flame, as a point source, reaching each block by the solid angle its facing
  area fills (absorbed 0.9). A crate a metre off a burning log catches in about twelve seconds; one five metres off
  warms and never gets there;
- **up its plume**: the rest rises, heating what hangs over the fire by the share of its footprint covered, fading to
  nothing at twice the flame's height, so a beam over a fire catches in a few seconds, before anything beside it.

`fireTime` hastens how long a fire burns, not how big it is: its flame, its light and its smoke are its real heat
release's.

### The flame

What can burn carries its own flame from the flame library (`fire/fire.js` `blockFires`; the World page's fire
channel): marched flamelets that puff and lean in the air, embers and light, sized from the block's heat release by
the same law, as many narrow tongues as its breadth gives (a log's seven, a campfire's), its light and embers by the
square root of its heat against a campfire's (light held at 30, so a big fire lights farther without whiting out
what stands by it). It is off until the runtime has the block catch; then it kindles over a couple of seconds, rides
the block, leans in the level's wind (destructible physics' own, where there is no terrain wind) and dies back when
the block is doused or burnt out. It has no smoke of its own: its smoke is the plume above. A page whose blocks can't
burn carries none of this.

## Ground

[`control/lib/graph/rupa/ground.js`](../control/lib/graph/rupa/ground.js): a soil heightfield over bedrock.

- **Crater:** the volume thrown out is energy over the soil's `dig`; the bowl is a paraboloid 0.4 as deep as its radius.
  It stops at bedrock.
- **Ejecta:** the volume out, bulked by `swell`, falls in a rim from R to 3R, thinning as (r/R)⁻³. None of it is lost.
- **Slump:** Mohr–Coulomb. A face stands up to the critical height 4c/γ·tan(45° + φ/2); past it, soil runs down to the
  angle of repose. Clay holds a trench wall, and sand doesn't.
- **Dig, deposit, shovel:** a scoop out (to bedrock), a pile at the angle of repose, or both (`hand`, `bucket`,
  `excavator`, or cubic metres).

### The land as ground, on the page

A physical stage's land is that ground ([`ground-grid.js`](../control/lib/graph/rupa/ground-grid.js), dug by the runtime's
GROUND pass in [`controllable/rupa.js`](../control/lib/graph/worlds/controllable/rupa.js)): the stage hands over its
landform grid (the heights it drew its land from) and, facet by facet, what its ground is (`era/substrate.js`). Each
ground is a soil over bedrock: soil is loam 1.5 m deep, sand 3 m, scree gravel 1 m, wet ground clay 1.5 m, a path packed
gravel 1 m, bare rock none (`DEPTH`).

- **A burst near the land** digs the crater its energy would in the soil where it went off, less the higher it went
  off and none above its own radius; the bowl stops at bedrock, the bank thrown into a rim bulked by its swell, and the
  faces slump by their soil (the weaker of two neighbouring grounds deciding). The same laws as `ground.js`, on the
  grid's points. A charge on bare rock digs nothing.
- **What stood on it comes down:** a footing (a building's, a tree's roots) whose land went drops to the new surface,
  and what it carried settles onto it. The world's colliders keep only their boxes, so the physics finds its footings
  by their place among the level's own colliders.
- **The page** sinks and rises what the stage laid on its land (its ground, trail, scree, cliff, tufts and stones: every
  isekai group but its sky, water and trees) with the grid: the dug depth at each point is a small texture, read in those
  meshes' vertex shaders and added to each vertex's height (an instanced blade by its root). The ground probe adds the
  same depth where it lands on the land, so a walker stands in the crater. A page whose world has no ground carries none
  of it.

- **Dirt:** a crater on the land throws its dirt by the dirt law above, from its own soil: clumps from loam and clay,
  none from dry sand, spray and a hanging dust cloud, its mass the bank it dug, seeded by the crater. The page flies it on
  the world's clock and lands it on the dug ground.
- **The shovel:** a cue's `dig: who | { who? | at, to?, scoop? }` takes a scoop (`hand` 10 L, `bucket` 0.8 m³,
  `excavator` 2 m³, or cubic metres) out of the ground 1.2 m in front of a character (or at a place), down to bedrock,
  and piles its loose soil 1.4 m to their right (or at `to`) as a cone at the soil's angle of repose, slumped. A scoop
  smaller than the grid's cell is spread over one at the same volume, so dig after dig the hole deepens. A level binds it
  to a key the way it binds anything (`events.inputs` and a cue on the key's event). Water finds the hole.

### The stage's water, on the ground

A physical stage's still water (its lake, its sea: the water hazards `era/out-water.js` marks, each a box whose top is
its level) lies on the same grid ([`ground-grid.js`](../control/lib/graph/rupa/ground-grid.js) `waterBodies`, the
runtime's WATER pass): a depth at each point, the land under the level filled to it, and the same water as the physics'
pools, so what falls in floats or sinks, splashes, and is doused in it. A river's level falls along it, so it is not still
water and waits.

- **At rest until moved.** The water is laid level and stays so. A crater dug at its edge, a levee broken, or rain sets
  it moving, and it runs by `fluid.js`'s virtual pipes (flux driven by ρg·Δs through a face as deep as the water
  upstream, held to what a point holds, never made or lost) until it is still again. A crater at the shore floods.
- **Levees.** A block standing on the land is ground raised to its top: water pools behind it and pours over it when it
  rises past. Twice a second the water's push across its thinner side, ½ρg(d₁² − d₂²) a metre of its width, is weighed
  against its weight's friction (μ 0.6; it stands on the land unmortared): a board goes, a concrete wall holds. Broken,
  it lets the water through.
- **Rain** falls on the land at the weather's rate (drizzle 0.5 mm/h, rain 5, downpour 25, thunderstorm 50: `E.rupaRain`,
  read from the page's weather as its sky blends), times the level's `matter.rainTime` (1 is real time, so real rain
  fills a crater by a few millimetres an hour; 3600 an hour a second).
- **Rivers** are moving water. The stage hands over each river's course (its line, its half-width and its level down
  it); the river is laid at its levels and its two ends are held there, fed in upstream and let out downstream, so it
  runs and never settles. A dam across it ponds the water behind it; a crater in it fills from it. Only the wet part of
  the grid flows, so a river costs its own points.
- **The page** draws the water where it is not as the stage drew it (new water, or a lake's or a running river's own
  where it moved 5 cm or more), one surface over the grid riding the dug ground. A lake that drains keeps its drawn
  surface.

## Skin and matter

A thing's skin is how it looks (its texture and fill, set by the stage); its matter is what it is made of. Nothing ties
the two today: a thing's matter is its own word or its class's (`CLASS_MATTER`), and the skin comes from wherever it was
drawn. They should agree, so the material reads accurately: a marble-skinned tomb is stone, and if it is to dent like
steel it should wear steel. Distortion makes a mismatch visible, because dents are drawn in the thing's own skin. When
you give a thing a matter, read its skin; when you change a skin, check its matter.

## In the geocube

A physical world asked of a geocube breaks by what the cube's style says its things are made of. The cube's `matter`
facet gives a matter by role (`wall`, `floor`, `accent`, `trim`, `roof`, `ground`, `wood`, `metal`, `glass`). A role it
leaves out is read off its own look ([`look-matter.js`](../control/lib/graph/rupa/look-matter.js)), in order:

1. its surfaces' tiles (a stone-brick wall, a flagstone floor and rock are stone; wood is timber);
2. its interior kit (gothic stone and catacomb are stone; a research lab is concrete and steel);
3. its settlements' material words (ashlar and rubble stone, hand-brick and wire-brick brick, adobe, boards and thatch
   pine, slate stone, precast and stucco concrete);
4. the defaults (wood timber, metal steel, glass glass).

`cubeMatter(cube)` gives each role with its reason. `breakablesOf` hands a class the role's matter (walls and
pilasters the wall's, set pieces and boulders the accent's, doors the wood's, lockers the metal's) and keeps the class's
own fill, so a steel locker stays a steel shell; other props keep their class's matter.

### Whole buildings

Under `physical` the big things break too ([`shell-blocks.js`](../control/lib/graph/rupa/shell-blocks.js)), not only a
level's walls and props:

- **A fractal structure.** It takes the cube's `structure` role: the cube paints its landmarks from its stone ramp, so
  they are stone unless the cube's `matter.structure` says otherwise. Its solid tiers, plinth steps and column shafts are cut into courses no wider or taller than
  3 m (a sixth of a wider one), each flat on the course under it. Its hollow tiers and ring beam are filled from their
  outlines with cells as wide as the wall, so neighbours share faces and hold each other; where two cells meet only at a
  corner, the cell beside them bridges it. A ring beam is hung across its columns. A capital has faces but no collider,
  so the shaft under it is raised to meet the beam, never by more than a third of its own height.
- **A town's shell houses.** Each is wall panels, no wider or taller than 3 m, from its footing to its eave (the lowest
  face that looks up above its first storey), and a roof on them up to the ridge. They break as the settlement they were
  built from (the world's readout names it): the words of the style it is built in, a named style resolved
  (`settlementMatter`), its walls by their facade (`punched`, else plaster, stone or banding), its roof by its roof word,
  at a roof's fill (0.15: rafters and tiles, mostly air). A settlement with no style of its own is dressed from the cube's
  ramps, so its houses take the cube's wall.
  Houses entered by a door, and walked-in buildings, keep their colliders for now.
- **Footings.** A group on raised land stands on fixed footings under its lowest blocks, so it stands at minute zero
  instead of dropping to the level's floor. A block with nothing at all under it, within a storey of its foot, reaches
  down to the foot.
- **Faces.** Every face goes with the block that holds its middle (else the nearest of its building), named by it and
  drawn in its break group, so the page hides what broke.
- **Pieces.** Blocks of one size and cut share one set of pre-cut pieces (`piecesOf(…, { share: true })`); the page
  takes the first's in each block's own colour. An arena's pieces go from 1.7 MB to under 100 KB.

**The load at minute zero** (`loadAudit`) runs the page's own settle and load pass on what was built: what falls at once
(`loose`), what is crushed by what it carries (`crush`), and a hung run its bonds cannot carry (`span`). It stamps the
world's payload (`rupaAudit`, with each building's block count); it advises and never refuses. Every structure preset
stands. The load pass finds supports through a grid over the blocks' footprints, so its answers are the whole list's in
the same order. A structure of a few hundred blocks steps in about a tenth of a millisecond at rest; a blast or a fall
costs one settle, tens of milliseconds, so structures do not yet need to sleep.

**A geocity's ring.** A geocube's `show: 'geocity'` takes play, and under `physical` its buildings within a city
block of where the walk starts (100 m, the nearest two dozen: `RING`, `RING_MAX` in `geocity/scene.js`) are shell houses
too: each mass as the city laid it (its footprint, foot, eave and top), claiming only its own faces, breaking as its finish
is drawn (wire-brick brick, sawn-stone stone, precast concrete; a glass tower or a skyline slab its concrete frame), a flat
roof a slab of its walls, in coarse panels (a quarter of a side and a sixth of its height at least) so a tower stays a few
hundred blocks. The rest of the city stays massing, as decided with the operator: physical near the player, scenery
beyond.

This is phase 2 of bringing rupa to the geocube. The way on: one wind for the flora, the ground grid from the substrate,
the cube's water as the fluid layer, then the geocity's physical ring near the player.

## Where it plugs in

- `breakability.js`: the `physical` degree; under it, each breakable carries `blockMatter` numbers and its matter's cut.
  A thing's own `matter` and `fill` win over its class's (`CLASS_MATTER`).
- `terrain.js`: an ask's or a box's `matter` gives its blocks their numbers.
- `world-scene.js`: under `physical`, `payload.rupa` is the level's `matter` read by `readMatterSpec`.
- `world-scene.js`: with `scars`, `payload.rupa.scars` is the level's `scars` read by `readScarsSpec` (any degree).
- `compose.js`: `EMISSION_OPT_IN.rupa`, composed onto a page only when its blocks carry matter.
- `era/compose.js`: `DESTRUCTION_WORDS.physical`, the words that ask for it.
- `rupa/panels.js` and `world-scene.js`: under `physical`, an entity's `panels` resolved to plates and their metal's
  numbers; the page draws them only when an object carries them.
- Engines: the physics is the web build's. The engine handoff (`export_model { engine }`) carries a level's models and
  its layout; its breakables travel whole, as solid colliders.

## Not yet

- Reading a thing's matter from its skin (a marble surface is stone, a riveted plate steel), or flagging where they
  disagree.
- Distortion's wobble (jelly's elastic jiggle), dents on minted solids, holes the walk and the shot can pass through
  (the collider stays the block's box), work hardening and how fast a blow lands (strain rate).
- A felled stack at rest at an angle (it lands lying flat, a quarter turn on, clear of its stump), a hinge that tears
  as it turns, tipping of stacks that were never cut (only a groove's hinge and a cut's seat are checked), and trees
  from the vegetation library as rupa blocks (a tree here is a trunk and a crown built as blocks).
- Cuts on any plane (they snap to the block's axes, so the halves stay boxes), a groove weakening the load pass before
  it goes through, a round's own tool word (rounds are steel-cored), and a cut half's own pre-cut pieces when it later
  breaks (it vanishes in its flash).
- The stamped and far trees as blocks (they stay scenery), trees in the form render (gen-7 draws its own), a tree
  that snaps partway up its trunk instead of throwing its root plate, weather leaning with a level's own wind outside
  physics (it keeps its seeded heading, so old pages stay as they were), and the level's plants taking a physics-only wind.
- One flame per burning block, from its top (not on each burning face), no charred skin, no smouldering, and no air to
  run short of in a room.
- Dust and smoke held by walls and ceilings (a puff passes through them; smoke doesn't yet pool under a vault or fill
  a room), shelter for puffs behind a barrier (the leaves have it), a fuel's own smoke yield and colour (every fire is a
  wood fire, flaming), smouldering, and a GPU path for puffs (the page places at most 480 sprites on the CPU).
- A drained lake's drawn surface going with it, a river's drawn surface where it runs dry, snow as a source, water
  soaking into soil, and boats.
- Ground and water in the
  geocity and terrain worlds (stages only), the geocity's evoked detail blocks (their facades are not yet shells), the live grass channel riding the ground on a world that has one only
  when its blades are instanced, and a crater's bowl drawn finer than the stage's land grid.
- Scars on what is not a box (a minted solid, a tree), and marks that fade or are cleared.
- Panels on a minted solid's or a figure-rig's own surface (a panel is a plate laid over the body), a crash's impact on
  them, a round through a panel carried into the body behind it (it is reported, not carried), and heat on a panel.
- City buildings, houses entered by a door and walked-in buildings as blocks (structures and shell houses are), and
  the base settle on the grid (it searches every block when something falls).
- Per-entity power (a hero's tier apart from the world's), and heat from beams and fire sources by element.
- On the flow: the beam's charge (its gather sprites), beam impacts that are preset puffs rather than explosions, a
  muzzle's blast and a landing's dust; the envelope's ground is the floor under the spot (a slope is not traced), and
  it is presolved once, so a wall broken mid-blast opens no new way.
- A blast's air on fires: the power-up's gust does not yet fan a fire a hero walks past, a blast's air does not push
  the dust and smoke already drifting, and a fire's limit is a starting tune for the eyes gate to move.
- Engine export of breakables and their matter (the handoff carries them whole).
