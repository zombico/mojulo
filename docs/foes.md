# Foes: layer 0 and the shelves above it

A foe is one FRAME, its layer 0, with independent shelves of words over it. Every foe capability addresses layer 0 and
nothing else, so whatever is applied to it is carried by whatever is drawn over it. Nothing special-cases a foe and
nothing lists the foes a capability applies to.

This is composition over a base interface, not a class tree. `Zombie extends Skeleton` would multiply into a class per
combination of traits; here a flaming, armoured, cleavable charger is four words.

## Layer 0: the interface every foe implements

Layer 0 is the entity and its stick figure (the rig every humanoid body shares, `polygonizer/figure-vajra.js`). A
shelf may address only these:

| What | Where | Read by |
| --- | --- | --- |
| the entity, by id | `state.byId[id]` (the runtime), `window.__mojCtrl.bodies[id]` (the page: the body it is drawn as NOW) | everything |
| its bones, by name | the rig's bone ids (`pelvis`, `torso`, `head`, `upperArmR` …); each bone's parent read off the rest bones (`figures/rig-tpose.js` humanoidParents; a rig that is not a humanoid's falls back to the bone nearest its head) | the cuts, the shed |
| its height and hit shape | `body.egg` (`cz` its half height), `body.radius` | a state's fires, the cleave's plane |
| its health | `body.hp`, `e.hpMax` | modes, death |
| what it carries | `e.statuses` (a status and its look, `playscape/elements`), `e.element` | the page's looks, the fire channel, the systems |

The page reads the body a foe is drawn as at the moment it draws, never a figure by name: a mode swapped in is lit,
burned, charred and cut as the one before it was.

The bone names are a humanoid's. A beast's rig and a one-bone blob are other kinds of layer 0; a shelf that needs a
bone by name says what it does on a rig without it.

## The shelves

Each shelf is one table or one word on a bestiary entry (`gameworld/foes.js`), independent of the others. A new thing
on a shelf is a row, pointing at primitives that already exist.

| Shelf | What it says | The word | A new one is |
| --- | --- | --- | --- |
| Behaviour | how it moves and attacks | `class` (`foes/classes/`) | a class card |
| Skin | what it looks like | `skin` (a species, or a people: `egocube/ancestry.js` lineages) | a lineage or a card |
| Modes | the forms it is defeated through | `body.modes` (`worlds/controllable/vanish.js`) | a mode |
| States | what it is born under | `states` (`foes/states.js` FOE_STATES) | a row |
| Death | how layer 0 is destroyed | `vanish` (`gameworld/vanish.js`: `die`, `sever`, `by`, `inside`) | a row, or a foe's own `by` |

An entry reads as a recipe:

```js
{ class: 'charger', skin: { people: 'skeleton' }, states: { flaming: { color: 'blue', elemental: true } } }
```

### Modes: defeated, never destroyed, until the last

`body.modes: [{ figure, hp? }, …]`, the first the mode it starts in. A killing blow on a mode with another under it
DEFEATS it: it reels, sheds what its figure carries that the next lacks (`scene/rig-shed.js`, bone by bone) and resets
into the next mode's figure and health. Every mode is its own figure on the same stick figure, so the swap is the
runtime's variant swap and the walk carries across. Only the last mode, layer 0, dies.

### States: born under a status

A state is a status the body starts under (`body.born`, given at the first step), so the page draws its look on
whatever body the foe wears. `flaming` is a column of fires up the body, each a share of the foe's own height, and a
char on the body while it burns. `elemental: true` makes the state the foe's element (`e.element`); false is the look
alone.

### Death: only layer 0 is destroyed

`destroy` lets the killing blow choose from a default table (`BLOW_DESTRUCTION`: a strike cleaves, a round knocks some
of the head and limbs off, a burst tears every joint apart, a crush lets every joint go), which a foe maps over with its
own `by`. `dismantle` cuts the relations between its bones; `cleave` cuts it through by part, its cut capped in its
`inside`. The page plays the pieces (`scene/channels/wreck-channel.js`).

## Precedence

- An entry's own word beats its form's default (the undead's destruction by form), which beats the world's (the game
  type's death beat; a platformer's squash and a pinball's pop are the death beat itself and stand over a destruction).
- A state is carried through every mode.
- Only the last mode dies, and only it is destroyed.
- Interactions between shelves (an element meeting an element, a state meeting a death) belong in one table each,
  never in a foe or a pass.

## Rules that keep it sustainable

1. A new capability addresses layer 0, never a figure or a foe. Its test: it still holds after a mode swap.
2. A new thing on a shelf is a row, pointing at a primitive the page or the runtime already has.
3. Absent, it costs nothing: the page code is emitted only when a body asks for it, and every other page keeps every
   byte.
4. A page-only effect gets an engine mark (`scene/godot-marks.js`, `scene/roblox-marks.js`), so an export says what it
   leaves out.
5. Each shelf carries a law test that crosses a mode swap: the proof that layer 0 carries it, in place of a list of
   foes.

## The law tests

- `scene/channels/wreck-channel.test.js`: a dismantle's joints, a cleave's sides and caps, a destroy by each blow, a
  mode defeated and reset, a shed exactly what the next mode lacks.
- `foes/states.test.js`: a state born, carried by the runtime, drawn as fire up the body, charred only where asked.
- `scene/channels/status-channel.test.js`: a status look is rebuilt on the body a mode swap puts in, a rig body given
  the normals its coat needs; absent, the channel as it was.
- `scene/channels/controllable/target-rim.test.js`: the target rim on the bar's pick, on whatever body it wears.
