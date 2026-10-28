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
| Skin | what it looks like | `skin` (a species, a people: `egocube/ancestry.js` lineages, or a model made elsewhere: `foes/model.js`) | a lineage, a card, or a bound model |
| Modes | the forms it is defeated through | `body.modes` (`worlds/controllable/vanish.js`) | a mode |
| States | what it is born under | `states` (`foes/states.js` FOE_STATES) | a row |
| Death | how layer 0 is destroyed | `vanish` (`gameworld/vanish.js`: `die`, `sever`, `by`, `inside`) | a row, or a foe's own `by` |
| Relations | the other foes whose fate it shares | `summons` (`gameworld/foes.js`, played by `worlds/controllable/summon.js`) | a row of what happens to them when it is reeling or down |

Every hostile is stood through ONE step, `standFoe` (`gameworld/foes.js`): the bestiary's foes, a shooter's hunters
and a sneak's guards alike. It lays the class's mind and attack and layer 0's whole package (the hit egg and health,
the death in the game's register, the base states, the target rim and bar); a game type passes only its own few numbers
over the class's (a `tune`: a shooter's gun and health, a sneak's unhittable watchers), never a mind of its own. How a
mind sees is said in words on the class (`mind/vocab.js`): `sight` narrow | wide | keen, `gaze` still | sweep, `cover`.

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

### Skin: a model made elsewhere

`skin: { meshRef, height? }` wears a rigged humanoid `.glb` (a Mixamo, VRM, Unreal or Rigify export) bound onto that
sketch (`bind_mesh_render`), stood `height` metres (1.8 absent). `scene/rig-import.js` reads it into the same pack our
own foes are: its joints by name to the hero's bone ids, its rest skinned once by its own weights, turned into the native
frame by its own body (head up, right leg on +x, face to +y) whatever the file's, each triangle on the bone that moves it.
It plays the clip library's states as any person on the field does, and every shelf above takes it unchanged. Not read:
its own clips, its non-base-colour maps, a JPEG without the optional `sharp` worker (its material's colour then). A model
with no skin, or missing a humanoid bone, is refused naming what is missing. Rigid per bone on the page, as every rig foe
is; a heavy model is drawn at its own triangle count, so keep a crowd's under budget (principle 8).

### Relations: a summoner and its summons

A relation is between foes, not inside one: each body stays its own layer 0, and the relation reads only the contract
(health, down, reeling, where it stands). The first is the summoner's. `class: 'summoner'` is behaviour only: it keeps
its place and calls. What it calls is a word on its entry, `summons: { foe, count?, bound? }`, naming any other entry of
the bestiary, so a summons is a skeleton, a zombie, a model or a foe with modes, and takes every shelf with it.

| When the summoner… | its summons… |
| --- | --- |
| has a hero near | wake from sleep (minted with it, `dormant`), a few at a time on its wind-up, arriving in smoke |
| is reeling | stand slack, if bound, until it recovers |
| is down | if bound, are cut: destroyed where they stand, every joint letting go; those never called are dropped |

`bound: false` summons fight on when it falls. An encounter has win conditions, not a bar: each foe keeps its own
(a dropped summons is down, so a win that counts the fallen counts it). A summoner does not call a summoner.

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

## Making a foe type's defaults

A foe TYPE (a zombie, a skeleton, a knight, a slime) is a form: the defaults its entries get on each shelf when they
name none. The discipline for adding one:

1. **Humanoid first.** If the thing can stand on the humanoid stick figure, it does: every shelf has its full range
   there (bones by name, the walks, the cuts, the shed). A beast rig or a one-bone blob is chosen only when the
   silhouette cannot be a humanoid's, and the form says what each shelf does on it (a cut that needs a head falls back
   to the bone nearest the head; a shelf that cannot apply leaves the foe as it was, never fails).
2. **One default per shelf, from the canon of its name.** A default is the least surprising reading of the word: a
   skeleton falls apart, a zombie is hacked, a slime pops. If you cannot point at where the genre already does it,
   it is not a default; it is an entry's choice.
3. **Defaults live on the form, never on an entry.** One table per form (the undead's destruction by form is the
   pattern); an entry that wants otherwise says the same word over it. A default that only code can express is a
   missing word.
4. **A form never combines shelves.** "Flaming zombie" is not a form; it is a zombie with `states: { flaming }`. Two
   shelves meeting (fire on an ice foe) is a row in the one table for that meeting, never a form.
5. **Rows, not primitives.** A form's defaults point at primitives layer 0 already has. A default that needs a new
   primitive is a layer-0 capability first, built for every foe and tested across a mode swap; only then does the form
   point at it.
6. **Measure in the foe's own body.** Positions, sizes and lifts are shares of its height or its hit egg, never metres,
   so a default holds on a child, a giant and a body drawn by someone else.
7. **Every default tells the player something.** A gait says what it is, a telegraph says what it will do, a death
   says how it was hit, a mode says how far there is to go. A default that reads as nothing in play is cut.
8. **Sized for a crowd.** A default is costed as one of many on a stage: its triangles per bone, its fires, its
   pieces when it breaks. The page's budget is the stage's, not the foe's.
9. **Seeded, and absent is free.** A form's variation is rolled from the world's seed and the entry's id, never from
   the clock or `Math.random`; a world that does not field the form carries none of its bytes.
10. **Anything drawn over layer 0 is a skin, whoever made it.** Our figure, a people's roll, or a model made elsewhere:
    it is matched to layer 0's bones, measured by its height, and gets every shelf from that. It is never a foe of its
    own with its own rules.
11. **Proved once per procedure.** A new form adds a law-test case only where it runs a procedure no form ran before
    (a new rig, a new cut); otherwise the shelf's existing tests already cover it. No test lists the forms.

## The law tests

- `scene/channels/wreck-channel.test.js`: a dismantle's joints, a cleave's sides and caps, a destroy by each blow, a
  mode defeated and reset, a shed exactly what the next mode lacks.
- `foes/states.test.js`: a state born, carried by the runtime, drawn as fire up the body, charred only where asked.
- `scene/channels/status-channel.test.js`: a status look is rebuilt on the body a mode swap puts in, a rig body given
  the normals its coat needs; absent, the channel as it was.
- `scene/channels/controllable/target-rim.test.js`: the target rim on the bar's pick, on whatever body it wears.
- `gameworld/stand-foe.test.js`: the sight words lowered, refused by name; layer 0 laid by the stand step with a game's
  numbers last; a shooter's foes stood as hunters.
- `worlds/controllable/summon.test.js`: the call (near, capped, its wind-up broken by a blow), the slack while it reels,
  the strings cut on its fall and the uncalled dropped, an unbound summons fighting on; absent, no code.
- `scene/rig-import.test.js`: a model's bones by each convention's names, its frame its body's whatever the file's, each
  triangle on its bone, and the cuts and the shed taking it as our own.
