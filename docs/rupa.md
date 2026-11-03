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
`fireTime` (60 play-to-fire seconds by default), and its strength goes with it. A tenth of its heat goes into each
block it touches, so fire spreads, and it ends as ash. Heat weakens: a block keeps `heatFactor` of its strength,
whole where it started, half at `soften`, none at `melt`, so a steel frame in a fire comes down by the load pass.
A block that isn't burning cools back (`cool`, 120 s). `heatBlock(state, id, joules)` is the entry point for a fire,
a beam or a script.

## Ground

[`control/lib/graph/rupa/ground.js`](../control/lib/graph/rupa/ground.js): a soil heightfield over bedrock.

- **Crater:** the volume thrown out is energy over the soil's `dig`; the bowl is a paraboloid 0.4 as deep as its radius.
  It stops at bedrock.
- **Ejecta:** the volume out, bulked by `swell`, falls in a rim from R to 3R, thinning as (r/R)⁻³. None of it is lost.
- **Slump:** Mohr–Coulomb. A face stands up to the critical height 4c/γ·tan(45° + φ/2); past it, soil runs down to the
  angle of repose. Clay holds a trench wall, and sand doesn't.
- **Dig, deposit, shovel:** a scoop out (to bedrock), a pile at the angle of repose, or both (`hand`, `bucket`,
  `excavator`, or cubic metres).

This lands as a tested kernel. The page's deformable floor and its ground probe reading the field are next.

## Where it plugs in

- `breakability.js`: the `physical` degree; under it, each breakable carries `blockMatter` numbers and its matter's cut.
  A thing's own `matter` and `fill` win over its class's (`CLASS_MATTER`).
- `terrain.js`: an ask's or a box's `matter` gives its blocks their numbers.
- `world-scene.js`: under `physical`, `payload.rupa` is the level's `matter` read by `readMatterSpec`.
- `compose.js`: `EMISSION_OPT_IN.rupa`, composed onto a page only when its blocks carry matter.
- `era/compose.js`: `DESTRUCTION_WORDS.physical`, the words that ask for it.
- Engines: the `rupa` page key is marked as the web's (the engines hold breakables whole today).

## Not yet

- Ground on the page (a deformable floor, craters from bursts, the shovel as an action).
- City and structure buildings emitting courses, slabs and columns, so whole buildings take part.
- Per-entity power (a hero's tier apart from the world's), and heat from beams and fire sources by element.
- Engine export of breakables and their matter.
