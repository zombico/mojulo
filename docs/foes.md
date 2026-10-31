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
| Relations | the other foes whose fate it shares | `summons`, `pair` (`gameworld/foes.js`, played by `worlds/controllable/summon.js`, `pair.js`) | a row of what happens to them when it is reeling or down |

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

An entry names its next mode as another entry, `becomes: '<id>'` (a chain, no loop, at most four): each mode is that
entry's own skin, class and bar (an armoured knight becomes its bare bones; a shelled koopa its shell-less, quicker
self), laid as `body.modes: [{ figure, hp?, rule? }, …]`, the first the mode it starts in; its death is the last's. A killing blow on a mode with another under it
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

### Skin: a person dressed as a crew

`skin: { people: 'human', dress: { faction, kind?, colourway?, body? } }` dresses a person as one of a crew
(`foes/dress.js`). The faction is one of the comic hero pack's grunt factions (`GRUNT_STYLES`: private military,
corporate security, a cult, a street gang …), and its kind (a rifleman, a sentry, a breacher …) gives the build, the
clothes, the headgear and the gear. The colourway is the crew's colours, so a bestiary dressed in one colourway reads as
one crew. Such a person is made through the hero door (`foes-<id>`, with its reactions), not the egocube's loop, and
stands on the library as any made person does. Only a person is dressed (a people of another lineage wears its own
roll), and its dress names its build and age: its `facets` name only its pole. The pack's western stop bakes its own
golden light into a hero; a foe stands in its world's light, so that cube is left off. `body: 'realistic'` draws it on
the realistic body.

Every body an entry stands wears the entry's one figure, so a squad of one entry is one soldier repeated; two entries
of one faction and colourway are two soldiers of one crew.

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

`bound: false` summons fight on when it falls. Awake, the summons hunt as one pack (`group.js`: their sight shared, as
many pressing in at a time as may be up). A summoner does not call a summoner.

### Relations: a pair

`pair: { foe, cover?, down?, swap? }` stands another entry beside it, two foes as one encounter, each its own bar
(Scylla and Charybdis, the twin princes). The two share a fate by rows:

| When one… | the other… |
| --- | --- |
| reels (`cover`, on by default) | goes to its side and stands over it (the mind's escort) until it is up |
| falls (`down: 'enrage'`, the default) | enrages: relentless, quicker, powered up for good |
| takes a killing blow (`down: 'revive'`) | keeps it from dying while it stands: the blow fells it (knocked down, up at half its health, as a mode's defeat), and only both felled together finishes them, each falling once |
| drops under its `swap` share | holds the field alone while the other leaves in smoke and comes back, as hurt as it left |

### Win conditions: the encounter has no bar

Each foe keeps its own bar; the encounter has a way to be won. `levels.<id>.foes.win`: `exit` (the default: reach the
exit, the foes in the way) or `clear` (won when every foe stood on the stage is down, a summoner's summons counted, those
it never called dropped as it falls: `game/mechanics.js` `defeat-all` over the cast's own falls).

### Death: only layer 0 is destroyed

`destroy` lets the killing blow choose from a default table (`BLOW_DESTRUCTION`: a strike cleaves, a round knocks some
of the head and limbs off, a burst tears every joint apart, a crush lets every joint go), which a foe maps over with its
own `by`. `dismantle` cuts the relations between its bones; `cleave` cuts it through by part, its cut capped in its
`inside`. The page plays the pieces (`scene/channels/wreck-channel.js`).

## The cast sheet: the world's foes on one page

A world's foes are read onto one book, the cast sheet (`/bible?book=foes`, `gameworld/foe-cast-html.js`), beside the
world, character and feel books. It reads only what the shelves already say (`gameworld/foe-cast.js` `foeCastOf`):

- **The lineup.** Every foe drawn at the stature it reads at in the game (its class's presence grown by its rank; a
  person at its height), beside the hero, on a metre rule. A flier is held off the ground.
- **Where they stand.** A level's foes stand on a walk's trails or in a building's rooms (each room between the way in
  and the goal a beat). A building stands `ROOM_FOES` of its rooms when its level names no count, spread from the way
  in to the goal, and the walker or the hero in it takes their hits as on a trail.
- **The tiers.** A tile per foe by rank: its portrait once a run has made its figure (`made['foes-<id>']`), else its
  lineup silhouette, its threat, its element, its modes and relations, the levels it stands on.
- **The cards.** One per foe, said to a player first: what it does (its class's `reads`), how to beat it, and what it
  costs. "How to beat it" is rows (`COUNSEL` in `gameworld/foe-cast.js`): a line for each word the foe carries that a
  player can answer (its attack, its tell's seconds, its stomp, its sight and gaze, its memory, cover, a pack, a
  duelist's switches, its modes, its summons or its pair, a state), never a line written for one foe. Then who it is,
  its numbers and its attack, its shelves and where it stands; its mind as the Mind facet resolves it (each situation),
  what each engine keeps and its gate are folded away, for the designer.
- **The photographs.** A foe a run has made is photographed as the table game's book photographs its cast (its World
  page in headless Chromium, a figure and a bust framed by its own body, kept per its revision:
  `lib/mcp/tools/foe-portraits.js`), and shown on its tile and its card, a downloaded sheet included. A foe not made yet,
  or with no browser at hand, keeps its silhouette, which also stands in for a photograph that fails to load. The lineup
  and the level strips stay silhouettes: they are a scale drawing, each foe at its height in the game.
- **In the world's bible.** The world bible carries the cast too: a Foes section (the lineup and the tiles, each linking
  to its card on the cast sheet) and, on each level, who stands on it. A world that fields none carries none of it. The
  dashboard's rail for the world has a Foes outcome (the cast sheet's parts to approve) and a way to the cast sheet.

It is drawn in its world's colours, as the world's bible is: the lineup stands on the world's own sky and ground (its
kit's colour key), the page's accent is the kit's paint, and its parts are the bible's own blocks: the cover with its
strip of the levels in the order they are played, an article for each role the casting call would cast, the ledger of
what it read.

Two tables adapt it to the game, rows rather than code: `STAT_WORDS` says the numbers the way the game's flavor does
(a platformer counts the bops to down a foe and the hearts a touch costs; a realistic game shows health and damage),
and `REGISTER_WORDS` names the sheet and its tiers in the game's register (anime or western). The flavor and register
are the juice's (`gameworld/juice.js`), written or what `juice: 'auto'` would lay.

The sheet is a gate like the other books: `foes:cast` and `foes:<id>` are parts with prints, approved through
`design_game`. They never hold a run back.

### The casting call: a cast proposed, never written

A world that fights and keeps no bestiary is proposed one (`gameworld/foe-casting.js` `castingCall`). The cast is
roles (`ROLES`): a grunt, a harrier that hurts from where the grunt cannot, an elite and a boss. Each role takes the
class that scores best against the world:

- its mind against the intent cube's Mind values (motivation, aggressiveness, perception, pathing, a pack's squad);
- its attack against the cube's combat;
- its toll against the flavor (a platformer's foe is touched and stomped; a realistic game's is not a touch);
- whether the world's people can play it, and what the intent's target engine carries.

A class the cube's own `mind.foes` names is cast before any other. The world's era rolls one people for the whole cast
(`ERA_PEOPLES`, seeded by the world), worn by every class that stands on two legs; a platformer's and a pinball table's
cast stays on the stand-in beasts. A cast of people is dressed as one crew (`ERA_DRESS`): its faction by era (a
soldier's for a game whose minds are soldiers': a shooter, a stealth game), its colourway rolled, each role the kind its
class reads as by what the kind carries (a class on watch, a kind whose arms are stowed; one that fires, a long gun at
the ready; the boss or a heavy class, the heaviest build). The grunt and harrier stand on every walk or building, the elite from the middle
on, and one boss alone on the last, won by clearing it. `design_game`'s `foes` step carries the proposal and the patch that
writes it; the agent writes it only once the creator has seen the sheet.

### Variants: a beast grown by oozes

A beast grown by oozes (`skin: { species, ooze, stylism? }`, the animal door's words) is a VARIANT of a beast of the same
class on the same species grown by none: the same foe in another coat, as a game swaps a palette. The cast sheet reads
each ooze at its strength, draws a variant in its ooze's own colour (its row's tint) outlined in its tier's, and names
the two to each other. An ooze grows a beast's shape and its look, never its stature, which is its class's presence and
its rank's. In play an ooze is a look: only a state (`flaming`) gives a foe an element.

The casting call grows a beast cast by the world's oozes (`ELEMENT_OOZE`: the character book's leading and supporting
elements; `ERA_OOZES`: its era's), at most `MAX_VARIANTS`: a variant of each beast role per ooze, met from the second
level on, and the boss grown itself (`BOSS_OOZE`, dire, with the world's first). A growth whose body no longer fits its
class is left off and said.

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
- `worlds/controllable/pair.test.js`: the cover and its end, the enrage, the revive's felling and both felled together,
  the swap and the return; absent, no code.
- `worlds/controllable/summon.test.js`: the call (near, capped, its wind-up broken by a blow), the slack while it reels,
  the strings cut on its fall and the uncalled dropped, an unbound summons fighting on; absent, no code.
- `foes/dress.test.js`: a dress's words refused by name, its hero-door order in its kind's dress and crew's colours,
  the pack's light left off, the realistic body on its word.
- `worlds/controllable/foe.test.js`: a patrol walks its round unseen, a hero in its sight is the mind's, one behind a
  wall is not, and calm, it walks its round again.
- `gameworld/foe-cast.test.js`: the cast read for a beast, a people, a model, a mode chain and a summoner; the numbers in a
  counting flavor and a health flavor; the gate's parts going stale; the casting call adopted as written, the intent's
  own classes first, a people's era and a platformer's beasts; absent, nothing.
- `scene/rig-import.test.js`: a model's bones by each convention's names, its frame its body's whatever the file's, each
  triangle on its bone, and the cuts and the shed taking it as our own.
