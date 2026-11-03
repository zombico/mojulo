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

## One fluid law: water and air

Air is a matter in the same table (`air`, family `gas`: density 1.204 kg/m³, viscosity 1.81×10⁻⁵ Pa·s), and every
fluid, liquid or gas, goes through the same three functions in the runtime's physics. Nothing about water is
special-cased:

- `pressure(medium, { depth, flow, cp })` = ρ·g·depth + Cp·½ρv². The first term is a tank on its foot, a pool on a wall
  and the pipes' heads (`fluid.js` uses it); the second is a hose jet on a log and the wind on a wall. `flowOf` is its
  inverse (Bernoulli, √(2p/ρ)), which gives a nozzle's jet and a pipe opening's flow.
- `immerse(box, mass, vel, medium, flow)` lifts a box by the fluid it puts aside and drags it toward the medium's own
  flow. A pool is a medium with a surface; the air is the medium everywhere. `stepIn` applies it implicitly. The same
  call floats pine in a pool, carries a light shell on the wind and slows the hose's spray (a parcel is a slug of the
  breaking jet, `drop` 0.16 m across).
- Grain settling in `debris.js` reads the same air from the table.

**Wind** is the air moving: a level's `matter: { wind: { speed, dir, terrain?, gust?, seed? } }`. Its speed is given at
10 m and rises with height by a power law (α: sea 0.11, open 0.14, city 0.3, where buildings slow the air near the
ground). Gusts are three travelling waves of seeded phase, so the same wind blows the same way at the same place and
time. Its pressure Cp·½ρu² (Cp 1.3) loads each exposed face; a block whose upwind face touches another is sheltered.
At each joint a stack is tipped by the wind's moment and slid by its push. It's held by its weight and, at a mortared
joint, by the joint's cohesion. A block's `joint` is `mortar` for masonry and `dry` for everything else. A stack that
goes leaves the structure as falling bodies (`how: 'topple'`). A 70 m/s gale tips a dry pine pile; a mortared brick
wall stands.

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

## Skin and matter

A thing's skin is how it looks (its texture and fill, set by the stage); its matter is what it is made of. Nothing ties
the two today: a thing's matter is its own word or its class's (`CLASS_MATTER`), and the skin comes from wherever it was
drawn. They should agree, so the material reads accurately: a marble-skinned tomb is stone, and if it is to dent like
steel it should wear steel. Distortion makes a mismatch visible, because dents are drawn in the thing's own skin. When
you give a thing a matter, read its skin; when you change a skin, check its matter.

## Where it plugs in

- `breakability.js`: the `physical` degree; under it, each breakable carries `blockMatter` numbers and its matter's cut.
  A thing's own `matter` and `fill` win over its class's (`CLASS_MATTER`).
- `terrain.js`: an ask's or a box's `matter` gives its blocks their numbers.
- `world-scene.js`: under `physical`, `payload.rupa` is the level's `matter` read by `readMatterSpec`.
- `compose.js`: `EMISSION_OPT_IN.rupa`, composed onto a page only when its blocks carry matter.
- `era/compose.js`: `DESTRUCTION_WORDS.physical`, the words that ask for it.
- Engines: the `rupa` page key is marked as the web's (the engines hold breakables whole today).

## Not yet

- Reading a thing's matter from its skin (a marble surface is stone, a riveted plate steel), or flagging where they
  disagree.
- Distortion's wobble (jelly's elastic jiggle), dents on minted solids, holes the walk and the shot can pass through
  (the collider stays the block's box), work hardening and how fast a blow lands (strain rate).
- Cuts on any plane (they snap to the block's axes, so the halves stay boxes), a groove weakening the load pass before
  it goes through, a round's own tool word (rounds are steel-cored), and a cut half's own pre-cut pieces when it later
  breaks (it vanishes in its flash).
- Ground on the page (a deformable floor, craters from bursts, the shovel as an action).
- City and structure buildings emitting courses, slabs and columns, so whole buildings take part.
- Per-entity power (a hero's tier apart from the world's), and heat from beams and fire sources by element.
- Engine export of breakables and their matter.
