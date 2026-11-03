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
