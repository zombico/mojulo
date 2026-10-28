# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
[CHANGELOG-3.1.md](CHANGELOG-3.1.md).

## [Unreleased]

### Foe classes: the hostile encounter primitive

A game fights things, and mojulo had seven separate notions of a foe: the quick goals' battle, shooter and defence
tables, the level goal's boss, the party battle's `FOE_PRESETS`, the strategy board's tower-defence, tactics and
skirmish units, and the dogfight's wing. Each one has its own stats, placement and escalation, and they share no words.
The platformer, the runner and the dungeon have no foes at all: the platform rule has no contact damage, no stomp and
no patrol. No beast can strike, and a beast foe cannot be oozed. This theme builds the concept layer every action game
fights through. A **foe class** says how a hostile thing moves, how it attacks, how it decides (the Mind gem's matrix:
motivation and aggressiveness, with rank and skill applied on top) and what body it needs (measured from the body, never
authored). It names no species, skin or clip, so a goomba and a level-one foot soldier are one class dressed two ways.
Rank is not a class: any class can be a minion or a boss. Non-human foes come first, and the dressing layer (skins
through the character designer, clips fitted to the class's timing, factions) is later work.

- **The shelf** (`lib/graph/foes/`). A class is a row (`classes/<id>.js`), checked as it loads against the vocabulary
  (`vocab.js`):
  - MOVES: hold, pace, chase, hop, drift, dive, rush, lurk, swarm.
  - ATTACKS: contact, strike, shot, lob, spray, charge, none, each strike timed in the action lab's words (startup is
    the telegraph).
  - A stomp's effect: blow, hurts or bounce.
  - PACES: speed as a share of the hero's run.

  There are ten classes: walker, hopper, charger, swooper, turret, lobber, swarm, lurker, brute and stalker. Each names
  the bodies it fits (support, size class, gaits, wings), measured from a fauna species (`fit.js`), and a stand-in
  species it plays on until it is skinned. `resolveFoe({ class, rank?, skill?, skin? })` (`resolve.js`) gives:
  - the controllable `ai` entity it plays as;
  - the mind resolved on that entity (`mind/resolve.js`), so the mind reports an attack the body cannot carry out;
  - its toll in the hero's frame (hp from its downs × the rank's × a blow, damage from its harm × a hit). Every rank
    lands on the mind's typical health, so no resolved foe draws the mind's advisory.

  A skin that does not fit is refused, with the reason.
- **The Mind facet's `foes` setting** (`cosmos/facets/mind.js`, read by `foes/cosmos.js`). Each class is a value.
  Its status and its Godot and Roblox marks are found from its move and its attack, never written by hand. Built
  today: turret, lobber, brute and stalker. Partial: lurker. Absent: walker, hopper, charger, swooper and swarm, each
  waiting on the touch, the pace, the hop, the dive or the charge. Those gaps are the `hostile-encounters` package (L).
  On the regenerated hill-climb page it lifts 41 of 500 rolled worlds, the most of any package. The rest of the page
  moved because a new setting changes the rolls.

  Machine gate: the laws (one class per procedure: a blade, a weapon, no verb yet, a pack, a flier, rank, pace, fit)
  and the deep sweep (every class at every rank on its stand-in, every class against the fauna roster) pass, as do the
  registry and sweep suites. Nothing reaches a world yet, so no pin moved. Eyes gate: nothing to see.
- **A gameworld fields its foes** (`gameworld/foes.js`). The world keeps a bestiary, `foes: { <id>: { class, rank?,
  skill?, skin?: { species?, ooze?, stylism? } } }`, each entry read at once: a bad word, or a skin that does not fit
  its class, is refused, naming it. A level stands them with `foes: true | { from?, count? }`. It puts one foe on each
  free beat of a trail stage (the trailhead and the exit stay clear), cycling the bestiary; `count` stands more, round
  the beats. A swarm stands a pack of three sharing one group. With `true` and no bestiary, every class stands on its
  stand-in. Each foe stands as its class resolves: the `ai` entity on the foes' side, hittable, its health its rank's
  and its collision and hit volume its grown body's. Where they stand, the hero is hittable and its hp takes their
  hits: the level goal's own hp when it has one, otherwise a fail-on-death laid before the goal's terminal. The run
  mints one beast per entry a level fields, at `<ref>-foes-<id>`, through the animal door with its skin's oozes.
  - **An ooze grows the body a fit is measured on** (`foes/fit.js bodyOf`). A dire wolf's size class is the wolf's
    × 1.45, and the mythical ooze's own stylism heightens it further. A growth past what a class fits is refused.
  - **A battle's or a quick game's beast foe may be grown.** `battles.foe` and `quick.foe` take
    `{ species, ooze?, stylism? }` (`readBeastFoe`), and the figure is minted with what grows it. A species alone
    orders as it did, print for print.
  - **The rail card `gameworld-foes`** (get_game_vocab) is generated from the shelf. It lists each class with what
    does not run yet, the moves, the attacks and the stomp words. The game-design routing card points at it, and a
    routing-eval row asks for foes in colloquial words.

  A world without `foes`, and a bestiary no level stands, lays and mints as before: the runner's prints are unchanged.
  Not yet carried: each class's own harm (every hit costs the level goal's one hit), the moves and attacks the shelf
  marks absent (a walker stands and wanders; nothing hurts by touch), and foes in buildings, cities and runs. Machine
  gate: the shelf's laws and the gameworld's (the bestiary, placement on a stage's beats, the hits, a bestiary that
  moves no print, a level that does, a grown battle foe) pass. Eyes gate not
  run: no level with foes has been played.
- **The foes' own moves and the hero body to body with them** (`worlds/controllable/foe.js`, an opt-in builder). A
  body whose rule carries `foe` (laid by the resolver) runs its own move in place of the mind:
  - **pace:** walks its stretch, turning at an end, at a wall and at a ledge, so it never walks off its floor;
  - **hop:** the same stretch in hops, travelling only in the air;
  - **dive:** a flier weaves round its perch, braces for a hero inside its radius, dives at where the hero stood and
    climbs back;
  - **rush:** turns to the hero, braces, charges its locked line, and is stunned by a wall;
  - **lurk:** lies still until a hero comes near, then hands over to the mind for good.

  After every step each pilot meets each foe it overlaps. Falling onto its head is a stomp: a blow of the hero's and
  a bounce (higher with the jump held), the stomper hurt instead on a spiny foe, only bounced on a big one. Any other
  overlap with a foe that hurts by touch (a charger only while it charges) is a hit on the hero: counted on the bus's
  `hit:<pilot>`, which the level's hp takes, knocked back, then spared for its mercy. The hero's stomp numbers are its
  feel card's when that card stomps, else the action lab's platformer card's (0.6 m, 1.8 m held, a second's mercy). They
  are laid only where foes stand.
  - **The mind learns the touch** (`mind/`). A body that hurts by touch is measured to have `contact`, so `close-in`
    and `brawl` take it, and a new strike, `touch`, runs into the target. A pacer or a hopper is `ambient`: it never
    engages, it is in the way. A touch closes to the body (a short `standoff`), not to a gun's.
  - **Every class is now built on the web:** walker, hopper, charger, swooper, swarm and lurker join turret, lobber,
    brute and stalker. No engine kernel plays a foe's own move yet: those classes are absent in Godot and Roblox, and
    the export says so. The `hostile-encounters` package has no gaps left, and the regenerated hill-climb page lists
    every class built.

  The builder wraps the `ai` rule and `stepWorld`, as the hitstop does, so the pinned pipeline order is untouched. It
  is emitted only into a page whose world stands a foe; a world without one steps byte for byte as the engine without
  it. Machine gate: the runtime's laws drive each move and each meeting through the real engine, with every foe
  resolved from the shelf (a pacer's end, ledge and wall; a hopper off the ground; a rusher's brace, charge and wall
  stun, hurting only while it charges; a diver's brace, dive, climb and perch; a lurker's wake; a touch and its mercy;
  a stomp's blow and its held bounce; a spiny stomp; a big one's bounce), plus a world without a foe stepping
  identically and the opt-in's emission. Eyes gate not run: no foe has been watched moving.
- **What a first render found** (a five-class demo world made with design_game, exported as a World page and played
  in headless Chromium):
  - **The run could not record a foe's beast.** `made.js` refused the `foes-<id>` key, so the first entry's mint broke
    the run's record. It now keeps it.
  - **A foe with a blade was not drawn.** The World page draws a body with a loadout as its slots' figures, one per
    weapon, and a blade slot naming none left the brute, the stalker and the lurker invisible. A foe's slot now names
    its own figure.
  - **The stand-ins were at life size,** a 25 cm guinea pig hidden in the grass. A class now has a **presence**, its
    body's size (its longest extent) as a share of the hero's height (1.7 m), grown by rank (an elite ×1.15, a
    miniboss ×1.4, a boss ×1.8). The resolver gives the `stature` the foe reads at and the `scale` that draws the
    grown body there; the level draws it at that scale (`body.scale`, the page's own opt-in) and sizes its collision
    and hit volume to match. The class decides the read and the animal the look: a walker is about a metre long
    whatever plays it, a brute about 2.4 m.

  After the fixes, the stomp lands in the page: a walker dropped on goes from 20 hp to 0 and topples, and the hero
  bounces at 4.9 m/s. Eyes gate, as seen in still frames (no one has played it):
  - the five read as five animals, and the dire bear reads as a brute;
  - a frog hopper is green in green grass and nearly vanishes, and a long, low walker sinks into a kit's knee-high
    grass. Both are silhouette and value, for the read's pass.
- **A foe's hp bar only while the hero targets it, and never over its body** (the operator's note on the first
  render). A level lays `body.hpBar: 'target'` on its foes. The World page then shows one bar at a time: over the
  pilot's lock target, else over the foe nearest the way the pilot faces (within that foe's width and 30 m; a ground
  hero aims where it faces). The bar sits above the drawn model's top, measured once from its mesh against its own
  group, or under its feet when the top would leave the screen. Every other enemy bar keeps its rule. A page whose
  bodies ask for no foe bar is byte for byte as it was (the code is spliced only when one does).
- **The foes in their world's look** (the operator's second note: what gets pulled in matches the world's style guide
  and its colour theorist).
  - The run hands each bestiary beast its world's setting (`settingOfGame`): its tradition's light (the anime
    world's character light, the same register as its hero), and what an ooze makes dressed from the kit's ramps
    (the colour theorist's, when the world names a palette).
  - **The animal door's `coat: 'world'`** (opt-in, with a `setting`; `mutagen/setting.js dressCoat`) takes an
    animal's own colours (its coat and markings, not its face's details) to the hue and chroma of the nearest stop of
    a ramp of its hue and value, at its own value, so its light and dark markings keep their contrast. A colour no
    stop is near keeps its own, and so does a whole coat in a world too far from it (a dark bear in a pastel world).
    Colours only: the body, its rig and its rid are the species'.
  - Where the world has ramps, a foe asks for its coat in them. In the meadow demo the guinea pig's orange coat
    becomes the world's warm timber brown, its white socks and belly the world's cream, its markings kept.

  Machine gate: the coat's laws (its own value, the face kept, nothing near ⇒ its own), the door's (it dresses and
  says which moved; refused without ramps or with another word), the page's splice (only when a body asks), the
  gameworld's (the beast step carries the setting and the coat; a foe lays its bar). In the page (headless Chromium):
  aiming at one of two foes shows its bar alone, above it, and facing away shows none. Eyes gate, as stills: the bar
  stands clear above the guinea pig, the boar and the bear.
- **A game's animals in the hero's light** (the operator: the bear's light was not the hero's, nor the world's). Two
  causes, both fixed:
  - **A moving animal packed plain.** The World page packs an animal with motion through its fauna rig, and that call
    took no character light. Under one, the smoothing is off too, so a game's animal was the Lambert bake, faceted,
    while its hero was cel-lit and inked. Under a character light a moving animal (fauna or bug) now packs as a hero
    does: the same lit pieces (the step, the shades, the split) and the ink. An animal with motion minted with a
    game's setting draws differently from now on, as its light always asked.
  - **Its key was its own.** A built animal with a game's default light (`toon.light: true`) was lit as a still's
    creature, by `CREATURE_KEY` (the character key turned 35° for a creature standing square to the camera) and a
    softer step. In a game it stands beside the hero and turns as the hero does, so it now takes the hero's key and
    step (the default character light), keeping the creature's shades by value so a dark coat's form still reads. A
    drawn creature, and any animal named its own light, is as it was.
- **A quiet coat keeps its hue family.** `coat: 'world'` took a dull brown (chroma 10, below the neutral line) to
  any quiet stop nearest in value, and the demo's boar came out teal from the foliage ramp. A coat colour now takes
  only a stop of its own hue family, unless it is a true grey (chroma under 4). The boar keeps its brown.

  Machine gate: the setting's light test (a game's animal is lit by the hero's key and step and keeps shades by value),
  the coat's (a quiet brown never becomes a teal). In the page: the bear's 23 parts now pack character-lit with ink,
  as the hero's 59 do. Eyes gate, as stills beside the hero: the bear and the boar read two-tone and inked in the
  hero's light, no longer faceted.
- **A beast deals its blow** (`fauna/behavior/strike.js`). A new one-shot clip, `strike`, is built from the body's
  own solved poses, the same way its reactions are. It passes through three poses:
  - stand: where it starts;
  - windup: a body on legs crouches, head down, drawn back a twelfth of its length; a legless body rears into its
    strike coil;
  - blow: a body on legs springs forward a fifth of its length; a legless body darts three head lengths the way its
    head points.

  A swimmer has no strike yet. The timing is the attack's own `{ startup, active, recovery }` in frames at 60 Hz: the
  startup gathers and holds the windup (the telegraph), the active frames hold the blow, and the recovery eases home.
  `strikeWindow(timing)` gives the blow's share of the clip.
  - The animal door takes `'strike'` among its motion words, or `{ strike: { startup, active, recovery } }`. Its result
    reports the clip's `seconds` and the `blow` window. Without it, the motion is as it was.
  - A foe whose attack is a blade (brute, stalker, lurker) is minted with its strike at its class's timing
    (`resolveFoe().strike`, `foeLook`, the runner's beast step). Its figure plays that strike for every swing
    direction. Its blade slot's `strikeContact` is now the blow's window, so the hit lands where the clip shows the
    blow. Before, the stock window (0.28 to 0.62) let a brute's hit land in the middle of its windup.

  Machine gate: the strike's laws (it starts and ends on the stand; on legs the windup's snout is lower and behind the
  stand and the blow's reaches past it; a legless body rears and then darts; a swimmer refuses; the frames are
  deterministic), the door's words and refusals, the gameworld's blade foe (its beast is minted with the strike, its
  figure maps the swing to it, its contact window is the blow's), and a non-striking foe's motion keeps its word form.
  In the demo page the dire bear's swing played under its own mind: crouched and drawn back through the startup,
  sprung into the hero on the blow, with the impact landing inside the window (t 0.52 to 0.61), then home. Eyes gate:
  the operator's to judge.
- **A downed foe goes as its game's style guide says** (`gameworld/vanish.js`, `worlds/controllable/vanish.js`). Before,
  a killed foe lay where it fell for good. Now it lies a moment, then fades away; no carcass is kept. There are five
  ways it can go, each played by the page on a ghost of its body (beside the cast's transits in `status-channel.js`):
  - `fade`: it fades where it lies;
  - `sink`: it sinks into its own ground as it fades;
  - `motes`: it dissolves from the ground up into glints that drift up, sized to the body;
  - `blink`: it blinks out, faster and faster;
  - `smoke`: it goes in a puff.

  The game's juice picks one (the world's word, else what `juice: 'auto'` would lay):
  - a platformer goes in a puff and a pinball table blinks, both at once;
  - an isekai look dissolves into motes, coloured by the world palette's accent (else the element's colour, else the
    power colour);
  - a cel look blinks;
  - a material look sinks in a realistic game and fades otherwise.

  How long it lies first is the game type's (`LINGER`). A bestiary entry may name its own: `vanish: <kind>` or
  `{ is?, linger? }`. The runtime piece is an opt-in builder, emitted only into a page with a body carrying
  `body.vanish`. The page emits each fade's code only when the world names it, so every other page keeps every byte.

  Machine gate: the table's reads (one per branch), the entry's word over the world's, the motes' colour, the fielded
  foe carrying its way out, the runtime's lie-then-go (and a body without one staying down), the opt-in's absence, and
  each fade's code absent unless named, with the old transits byte-identical. In the demo page the five foes, one way
  each, were killed and filmed: each fell, lay 1.4 s, then went as named. Eyes gate: the operator's to judge.
- **A foe dies in its game type's animation register** (the operator: "different games deal with death and disposal in
  the animation registers native to their style"). Each game type (`DEATHS`, read from the juice's flavor) now says how
  the foe dies and how long it lies, not only how it fades:
  - platformer: squashed flat with a bounce, then a puff, at once (`squash`);
  - pinball: swollen under a white flash, then burst into glints, at once (`pop`);
  - action: thrown back along the killing blow and off the ground (`die: 'launch'`, run by the vanish builder), lying
    0.7 s from where it lands;
  - realistic: falls on its own fall clip and lies 1.4 s.

  After an action or realistic death, the look's fade plays (motes, blink, sink or fade). An entry may name
  `die: fall | launch`. A squash or a pop named alone plays at once, as in its own game type. The page emits both new
  kinds only when they are named.
- **A foe no longer explodes when it dies.** The engine's death burst (`combat-match.js`) is a mecha suit's: every
  downed unit threw a fireball and a splash stagger. It had been doing this to every foe since they were first
  fielded. A body that vanishes now latches it off (the vanish builder sets `deathBurstDone` before each step). The
  engine's source is unchanged, so every other page keeps its bytes.

  Machine gate: the death table by game type, a named beat playing at once, the launch's flight (off the ground,
  along the blow, landing, then lying), the burst withheld from a vanishing body and kept for one without, and the new
  kinds absent unless named (old transits byte-identical). In the demo page, one foe per register was killed and
  filmed with the page clock stepped by hand: the frog squashed and puffed, the bug swelled, flashed and burst, the
  swooper was thrown and faded, the rodent fell and sank, the bear fell and dissolved. Eyes gate: the operator's to judge.
- **Human and humanoid foes** (`foes/people.js`; the operator: "extend this to human and humanoid foes"). A bestiary skin
  may now be a people instead of a species: `skin: { people: 'human' | <lineage>, facets? }`. The lineages are the
  egocube's: orcish, undead, infernal, draconic, dwarven, sylvan, feline, lupine, ursine, avian and insectoid.
  - A people is measured as a two-legged, wingless body at its own stature, and its class checks it as it checks a
    beast. Walker, charger, turret, lobber, brute and stalker take one. Swooper (wings), hopper (hops), swarm (small
    bodies) and lurker (four legs or none) refuse it, saying why.
  - It fights in its class's role (`peopleRole`): a shot is ranged; a lob or a spray is a caster's; an opportunist, a
    lurker or a pack is a flanker; a blade, a touch or a charge is frontline.
  - It stands at its own height, grown only by its rank; a class's presence is a beast's word.
  - The run rolls its sheet in the game's setting on the entry's own seed (`foes-<id>-sheet`, an egocube), then makes
    the character from it (`foes-<id>`, `create_character { egocube }`). The sheet's humanity picks its door: the hero
    door, or the creature loop below `DOOR_H`. The egocube manifest takes a new `moves: true`, so a lone sheet gets its
    moves (a swing by role, the stagger, the knockdown and getup) as a cast member does.
  - On the field it plays those moves as `casting.js` `fieldOf` draws them, with a person's body for collision and
    hits. It dies and goes by the world's disposal like any foe.

  Machine gate: a people's body, fit, role and stature; the steps, their keys and the sheet's roll; a people on each
  door drawn with its moves on the field; a lone sheet's `moves`; beasts unchanged. In the demo page the bestiary
  stood a dire bear, an orc brute, a human bandit, an undead walker, an insectoid charger (on the creature loop) and a
  human gunner, all in the world's colours. The orc and the insectoid, struck down, played their knockdown, lay, and
  dissolved into the world's motes. Eyes gate: the operator's to judge.
- **Undead forms: zombies and skeletons** (`lib/graph/undead/`; the operator: "core models for enemies we didn't have
  before … we focus on form"). These are new bodies, not paint: creature-loop ring plans built on the creature biped
  and rigged by its own rig, so each is minted, animated and fielded as any creature is. Each variation is a card
  (`undead/cards.js`) whose words the passes apply (`undead/passes.js`). The egocube build picks the variation.
  - Zombies: shambler, gaunt, bloated, hulk, fresh. Their flesh is wasted or swollen, they are hunched, the head hangs
    and cocks, the jaw is slack, the arms reach out. One arm may be swollen and the other withered (each side authored
    on its own), and a seeded loss can take a forearm or a hand (its bones stay in the rig, so every clip still plays).
  - Skeletons: soldier, slender, squat, giant, knight. The trunk is replaced by its frame: a spine, curved ribs (the
    low ones floating), a breastbone, collarbones, a sacrum with hip blades and an arch. Every long bone is a shaft
    with knobbed ends, and the bones' weights scale by the card.
  - The arms are built in their posture: each arm's joints are turned about its shoulder to where the rest pose holds
    it, and the rest asks for that direction turned by the lean. A rest pose that swung an arm far from its build had
    stretched the shoulder's skin into spikes.
  - Two derived heads (`creature-heads/derive.js`), both from the bear's skull by moving its rows: a human `skull`
    (narrower, a round dome, a flat face, open dark sockets, small teeth) and a `gaunt` dead face (the same shape, with
    sunken eyes, a small nose and ears). A form's head is never drawn below half scale, since its sockets miss when
    projected onto a smaller skull.
  - The lineages `zombie` and `skeleton` (`egocube/ancestry.js`) carry the `form`, which the creature door hands to the
    library. A bestiary skin is then `{ people: 'skeleton', facets: { build: 'brute' } }`. The egocube exports `biped`
    and `dialsAndRig` for it; any other creature builds as before.

  Machine gate: the frame's parts, the knobbed bones, waste, bloat and the heavy arm, a seeded loss that keeps the plan
  building, the arms built forward with their rest, and both lineages on the creature door building a valid plan
  deterministically, with a bestiary standing one. All ten variations built across seven seeds. Eyes: all ten were
  minted and rendered from the front, three-quarter and side (no shoulder spikes left), the two heads were turned, and
  a zombie and a skeleton played their walk. Eyes gate: the operator's to judge.
- **The skeleton's skull is its own bones, its jaw a separate bone** (`undead/skull.js`; the operator: "improve the
  skull, give it anatomical jaw separation"). A head card's rows are sections taken front to back, which can't raise a
  mandible's ramus to its hinge, so the skeleton's skull is now built from body parts, as its ribs and pelvis are:
  - a domed braincase, widest at the temples;
  - a face under the forehead: the brow, the orbits, the cheeks, the upper jaw;
  - cheekbone arches from the cheek back to before the ear;
  - dark round openings for the orbits and the nose;
  - an arc of upper teeth on the face;
  - a mandible whose halves each rise from a condyle under the arch, run down the ramus to the angle, then forward to
    the chin, carrying their own lower teeth.

  The mandible and its teeth ride the rig's jaw bone, hinged at the condyles, so the jaw opens away from the skull. A
  skeleton's rest hangs it a few degrees open (the card's `jaw`), so the separation shows. The rig's head bone points
  at the face, as a head card's points to its snout; aimed at the crown, the rest pose had turned the skull face-down.
  The derived `skull` head card stays in the library for any creature that wants it; the skeleton no longer wears it.

  Machine gate: the skull's parts, the jaw's parts on the jaw bone and the rest on the head, the condyle under the
  arch, the ramus's fall, the halves meeting at the chin, and the rig's hinge at the condyle with the head bone toward
  the face. Eyes: the skull rendered alone closed and with the jaw dropped 22°, and on all five skeletons, facing
  forward with the jaw hanging slightly open. Eyes gate: the operator's to judge.
- **The skull's profile, made accurate** (`undead/skull.js`; the operator: "from the side the skull looks too weird").
  Seen from the side, the face hung under the braincase like a box, the jaw was two sticks, and the orbits stuck out
  past the brow. Now:
  - the braincase is long, its back full behind the ear;
  - the face is deep enough front to back to carry a full upper row of teeth, incisors, canine, premolars and
    molars, set along the arch back toward the ramus, with the lower row just inside them;
  - the brow and the band under the orbits stand forward, the nasal bones project from between the orbits, and the
    outer orbit rim is a ridge from the brow to the cheek;
  - the cheekbone and its arch are plates standing on their edge, running back to just before the ear opening, with
    the mastoid behind it;
  - the orbits are a little wider than tall, look slightly outward and sit behind the rims; the nasal opening is a
    tall pear;
  - the mandible is a plate: a broad, near-upright ramus from the condyle to a sharp angle, a coronoid process rising
    in front of the condyle under the arch, and a tall body running forward to the chin.

  A loft could not hold a plate on a level, turning run: its rings took their front from +y off the axis, so on a jaw
  turning toward its chin the tall radius swung sideways. Lofts now take an opt-in `frame: 'up'`
  (`station-loft-plan.js` `ringFront`). On any mostly level run, the front is +z off the axis, kept on the side of
  the previous ring; a steep run takes +y. Lofts without it are unchanged, byte for byte.

  Machine gate: the ramus's fall from condyle to angle, the jaw's body taller than it is thick, the teeth running
  back from the incisors to the molars, and every byte pin the loft change reaches. Eyes: the skull alone from the
  side, three-quarter and front, closed and with the jaw dropped 22°. Eyes gate: the operator's to judge.
- **A cleaner orbit, and a segmented spine** (`undead/skull.js`, `undead/passes.js`; the operator: "clean it up so
  there's less elements around the eye orbit. give the spine segmentation").
  - The orbit: the separate outer rim and the cheekbone's body under it are gone, so from the side the brow, the
    socket and one cheekbone remain. The cheekbone is a single plate on its edge from under the orbit's outer
    corner back along the arch to the ear.
  - The spine: vertebrae up the column by arc length along the spine's own joints: five lumbar, twelve thoracic and
    six cervical. Each is a broad, short body, thin up the column, drawn back to its spinous process. The lumbar
    processes are short and level, the thoracic long and angled down, the neck's short. A slim core runs through
    them, standing for the discs. The old spine segments stay as that core, so the rig binds and the lean dial
    hinges by them as before. The lowest two vertebrae ride the pelvis, the neck's ride the neck and the rest ride
    the torso.

  Machine gate: each run's vertebrae, rising in order, broader than the core, each process behind its body, the
  bones they ride, the thoracic in the lean. Eyes: the skull alone from three views; the soldier and the giant from
  the front, three-quarter and side. Eyes gate: the operator's to judge.
- **The skeleton's neck, shortened** (`undead/passes.js`; the operator: "neck is a bit too long"). The cervical run is
  now 0.6 of the living biped's, so the skull sits low on its six vertebrae. The neck's top is moved in place, so the
  rig's head bone and the skull read the same point. Machine gate: the neck's length against the body's height,
  under 0.7 of the living biped's. Eyes: the soldier and the giant from three views. Eyes gate: the operator's to
  judge.
- **Undead layers, and the first: shreds of cloth** (`undead/shreds.js`, `UNDEAD_LAYERS` in `undead/cards.js`; the
  operator: "add variations where there's shreds of cloth hanging from it"). A lineage can now lay layers over its
  form's card (`layers`). The new `ragged` lineage is the skeleton with `['shreds']`, so a bestiary asks for
  `{ people: 'ragged' }`. A custom lineage may combine any layers over any form; an unknown form or layer, or
  layers without a form, is refused.
  - Shreds are what the card's clothes left, as torn cloth ribbons (`rings` parts, broad across the body and thin
    off it, facing outward at any angle). They hang from bands round the shoulders front and back, the hip crest
    and the upper arms. Every strip of a band is a piece of its hem, wide enough at the top to overlap its
    neighbours, so the band reads as one torn cloth. With the card's odds a strip runs long below it, falling
    straight clear of the widest girth under the band and tapering to a torn end. A sleeve's rags hang from the arm
    where the rest holds it.
  - Each card says what it wore (`shreds { chest, back, hips, arms, length }`): the soldier a tabard and belt, the
    slender skeleton a shroud, the squat one a loincloth, the giant a loincloth and a few rags, the knight a long
    surcoat. The zombies' cards carry specs too, for a lineage that dresses them.
  - Binding: the hip strips over the front and sides follow their thigh down their length; the chest's ride the
    torso and the sleeves their upper arm. The chest's and the arms' hinge with the lean; the hips' stay with the
    pelvis.
  - The rags are their own group (`Cloth`), a dull shade under the bone: form only, one tone.
  - A layer rolls on its own seeded stream: the body under it is the bare form's, byte for byte, and with no layer
    nothing is added.

  Machine gate: every band hung (on a seed whose odds leave each something), each strip falling ring below ring,
  ribbon-flat, its binds and its place in the lean; the bare body unchanged under the layer; the lineage's sheet
  carrying form and layers and its plan building; the lineage validation. Eyes: the soldier, the knight and the
  squat ragged from three views. Eyes gate: the operator's to judge.
- **Decayed: gaunt rotted flesh back on the bone** (`undead/decay.js`, the `decayed` layer; the operator: "add
  'decayed' which puts gaunt rotted flesh on top of these variations"). The dead between the zombie and the bare
  skeleton, laid over any skeleton card:
  - a sheet of flesh shrunk inside the rib cage's girth, so the ribs and the spine's processes stand through it, its
    front rotted open by the card's `decay.open` (the breastbone and the front ribs bare), the belly sunk under it;
  - wasted sinew over part of each long bone, seeded per limb and per side, so some limbs are bone and the knobbed
    ends always show;
  - a withered throat in front of the neck's vertebrae;
  - a cap of dried skin over the crown, pulled back off the brow.

  Each card says how it rotted (`decay { open, limbs, neck, scalp }`). The flesh is its own group (`Flesh`), a dried
  shade darker than the bone. The layer lies over bone only: on a zombie it is refused. The new `decayed` lineage is
  the skeleton with `['decayed', 'shreds']`, the flesh first so its rags hang clear of it; a custom lineage may lay
  `decayed` alone. The shreds' bands no longer count the collarbones, so a tabard hangs from the cage and not out at
  the shoulders, and a hem's short pieces end torn square instead of in points.

  Machine gate: the chest sheet narrower than the ribs reach and behind the breastbone's front; a limb's sinew
  thicker than its shaft and thinner than its ends; rot uneven across seeds; the body under the layer the bare one;
  refused over a zombie; the lineage's sheet carrying both layers and its plan building. Eyes: the soldier, the
  knight and the giant decayed, and the soldier ragged, from three views. Eyes gate: the operator's to judge.
- **A decayed body's rags hang from its trunk, not its arms** (`undead/shreds.js`; the operator: "identify the issue
  that makes this so wide"). The bands the rags hang from were fit to every part in the trunk's groups. The decayed
  layer's limb sinew shares the `Flesh` group with the chest's sheet, so the forearms' sinew, hanging at hip height,
  widened the hip band to the arms' span: a half width of 0.5 m against the hip blades' 0.2 m. The upper arms did
  the same to the chest. A part now counts toward a band only when it rides the trunk (the pelvis, the torso, the
  neck). Machine gate: across seeds, the decayed skeleton's rags no wider than the bare one's; the check fails on the
  old fit (0.418 against 0.293). Eyes: the decayed soldier and giant before and after. Eyes gate: the operator's to
  judge.
- **Bared: a gaunt corpse with parts gone back to bone** (`undead/bared.js`, the `bared` layer; the operator: "a
  decayed flesh style where they are essentially gaunt humans with certain parts replaced with skeletons"). The
  inverse of `decayed`: the zombie's body, its flesh drawn in further (the trunk × 0.9, the limbs × 0.86), and a
  seeded few of its parts bone again, each on a side of its own. The card says how many and which
  (`bared { count, parts }`):
  - `skull`: the head as the skeleton's skull, its jaw its own bone, on the neck drawn in and lengthened a little;
  - `arm`: a whole arm, or `foreArm`: the forearm and its hand from the elbow;
  - `thigh`, or `shin`: the shin and its foot from the knee;
  - `ribs`: four to six of one side's ribs broken through the chest, from the flank round to the front, lying on the
    flesh's own boxy section.

  A bared limb is authored on its own side, so the other keeps its flesh, and keeps its rig: its bones are the flesh
  limb's. Its radii are the skeleton's own: the bone pass's per-limb radii now live in `boneLimb` (`undead/passes.js`),
  shared by both, and every skeleton and zombie body is byte-identical through the move. A skull hangs from its base,
  so its head drop is a third of the card's, which would otherwise swing it into the chest. The bared parts are their
  own groups (`Bone`, and the skull's), toned as the skeleton lineage's bone. The layer lies over flesh only: on a
  skeleton it is refused. The new `rotting` lineage is the zombie with `['bared']`.

  Machine gate: every word on a card's list coming up across seeds, within its count; a bared limb the skeleton's
  bone on its side only; the flesh left narrower; a bared skull as the head (no head card, the jaw hinged, in the
  lean); the ribs on one side, bound to the torso; refused over bone; the lineage's sheet building; the bodies
  without the layer unchanged (hashed). Eyes: all five rotting builds from the front, three-quarter, side and back.
  The hulk's skull still sits low under its hunched shoulders. Eyes gate: the operator's to judge.
- **The zombie stands on the tiered body** (`undead/tiered.js`; the operator: "are you using the tiered body? I notice
  there's no shoulders", then "move them onto the tiered body"). The undead were built on the creature biped, a box of
  a torso with tubes for arms; the zombie is now a hero on the tiered game body, with its shoulders, hips, bridged
  joints, hands and landmark face. The skeleton and the layered variations follow in their own steps; until then they
  stay on the creature door.
  - The door: a hero takes `undead: { form, build, seed, layers? }`, and an undead lineage's sheet writes it on a hero
    spec (`create.as: 'hero'`). It is refused off the tiered body or for an unknown form or layer.
  - Its words, recorded at mint under the spec's own, so an edit reaches them: bald, the body bare to its own skin
    (the feet bare), one tone over every group it is painted in (the brows too), a gaunt face (the cheeks hollow under
    standing cheekbones, the face and the jaw narrow, the brow heavy), the jaw slack and the lids heavy. Its rest is
    the hero's gesture: the card's hunch as a hinge over the hips, the knees given, each arm held out its own way, the
    head hung and cocked. The idle breathes in that rest, and the walk keeps the hunch as its tilt.
  - Its flesh: the card's waste and bloat on the hero's parts before the tiered passes, so the joints are bridged and
    the shoulders balled on the body as it now is. Each kind of part thins about its own axis: trunk sections, limb
    radii, loft stations, rings point by point (the chest's about the torso it lies on).
  - Even, whatever the silhouette (the operator: "these middle guys are proportioned weird; even it out regardless of
    what silhouette it has"): the trunk's scale never stands from the limbs' past 1.15 either way. Past it both are
    drawn to their geometric mean, so a swollen corpse's limbs swell with its trunk and its overall size holds. A
    bloated belly is a smooth swell centred on the waist (each section deeper, wider and brought forward, falling off
    above and below) on rounded sections, where the creature card's gut, pushed on one band of front slots of the
    squared tiered torso, had read as a box.

  Machine gate: the lineage reaching the hero door with its form; the words recorded, the operator's own over them;
  the wasted card thinner than the living hero, the bloated one wider and its waist forward; the plans building with
  their bridges and shoulder balls; the trunk-to-limb ratio within 1.15 on the swollen and the most wasted card, the
  size the card's; refusals; a hero without `undead` unchanged. Eyes: all five zombies from the front, three-quarter
  and side, and the bloated one before and after evening. Eyes gate: the operator's to judge.
- **The skeleton stands on the tiered body** (`undead/hero-bones.js`). A skeleton's card replaces a tiered hero's flesh
  with its bones, every one laid from the hero's own landmarks, so it stands in a person's proportions and rides the
  hero's rig:
  - the spine: a slim core up the hero's back line, from the hip by the navel to the neck's hub and the head's base,
    with its vertebrae on it;
  - the ribs: an egg, each rib a share of the chest's width, narrow at the top, widest at the lower chest, in again at
    the floating ribs, falling well toward the front, rather than the torso's own width at its height, which is the
    shoulders' at the top and had stacked them like slats;
  - the breastbone down the chest's front; the collarbones from its top to each shoulder, on the hero's clavicle;
  - the pelvis fit to the hip's section: the sacrum, each blade's rim over the crest, the arch and the seat;
  - every limb its bone on the hero's joints (the bone pass's `boneLimb`), the foot's and the hand's, and each
    finger's three phalanges on the rig's finger joints, each riding the hero's own bone;
  - the skull on the head's base, its jaw on the hero's jaw bone, the rig's head and jaw joints the skull's.

  No bridges and no shoulder balls, since a bone joint is its knob; the head card and its dial are gone. The card's
  bone weights read on the hero (the giant's femur half again the slender's), and its jaw hangs in the idle (a clip
  key's `jaw`). `heroMeasures` reads the yoke and the hips off a trunk and a loft only, so a skeleton's readout
  measures none instead of failing. The skeleton lineage reaches the hero door; the layered variations (ragged,
  decayed, rotting) stay on the creature door until theirs.

  Machine gate: the lineage at the hero door; the rest and the jaw from the card; no flesh part and no head card; the
  spine, the vertebrae, the egg of ribs falling forward, the pelvis, the limb and finger bones on the hero's bones, the
  jaw hinged at the skull's condyles; the dials over the skeleton's own parts; the plan building; the bone weights.
  Eyes: all five skeletons from the front, three-quarter and side, then the soldier and the giant after the hands and
  the ribs. Eyes gate: the operator's to judge.
- **The layers, the loss and the heavy arm on the tiered body; the creature-door undead retired**
  (`undead/tiered-layers.js`). Every undead lineage now reaches the hero door:
  - `shreds` hangs from the hero's trunk, a skeleton's or a corpse's. The bands read the hero's trunk (its Top and
    Bottom groups, its lumbar bone).
  - `decayed` lays its gaunt flesh on the hero's skeleton, its sinew on the hero's own limb bones (the shin is the
    hero's shank).
  - `bared` lays a limb's bones on its side, each its own unmirrored part on that side's joints and riding that side's
    bone, and cuts that side's flesh from the expanded recipe. The cut takes the limb's bridges and its shoulder's
    ball, and the parts pinned to them, and prunes the dials, so the rig stays whole and every clip still plays. A
    bared skull replaces the head include and its dial, and the rest hangs it a third as far.
  - The card's seeded loss takes one side's hand, or forearm and hand, from the skin in whatever shape that side has
    them (flesh, a skeleton's bones, a bared arm's bones), the rig whole.
  - The hulk's heavy arm swells its side and withers the other, ring by ring on the expanded recipe, so a bridge and
    the limb end it meets stay matched.

  One seeded pick (`undeadPicks`: the loss, then what is bared) is read by the plan that lays the bones and by the
  recipe that cuts the flesh. The creature-door undead went with the move: `formCreature`, `undeadBody`, the creature
  passes, the creature `bared` and the zombie's gaunt head card on the creature biped. The library keeps what the
  hero uses: the cards, the rest, `boneLimb`, the ribs and vertebrae, the skull, `shreds`, `decay` and `pickBared`.

  Machine gate: shreds on a skeleton and a corpse, the hip rags from the hips; decayed flesh inside the hero
  skeleton's cage, its sinew on the hero's bones; a bared limb's bones on its side alone, that side's flesh cut and
  the other side whole, the dials over what remains; a bared skull as the head; the loss on one side for a corpse and
  a skeleton; the heavy arm's ratio the card's k²; every lineage at the hero door; a layer on its own dice (the body
  under it byte for byte). Eyes: the ragged, decayed and rotting from the front and three-quarter. Eyes gate: the
  operator's to judge.
- **The armed and the adorned undead** (`undead/armour.js`, the `armed` and `adorned` layers; the operator: "create
  variations where they are adorned and arm them"). Two layers, each card saying what it carries and what it wore, and
  two lineages that ask for them: `revenant` (the skeleton with `['adorned', 'armed', 'shreds']`) and `risen` (the
  zombie with `['adorned', 'armed']`).
  - `armed`: the card's weapons are the hero's gear, recorded under the spec's own: the soldier a sword and shield,
    the knight a greatsword, the giant a club (a staff with the brutal style's mace head), the slender a bow, the
    squat a hammer and shield, the zombies a dagger, a club or a sword. Gear hangs on the rig, so a skeleton's bone
    hand holds it as a hand does. A weapon in a hand the card's loss took moves to the free hand, or is dropped.
  - `adorned`: what is left of the armour, sized to the living body and hanging on the body it is now. The hero's
    armour builds address the flesh torso's stations and the head's cranium, which a skeleton has not, so these are the
    undead's own pieces: a kettle helm over the crown, a cuirass round the chest (on a skeleton a hollow shell clear of
    the ribs), one pauldron or both, bracers, greaves, each rigid on its bone, in its own group (`Metal`). Each piece
    rolls the card's odds on its own dice, the knight wearing nearly all of it. A skeleton's armour is sized to the flesh
    plan it was built from. A cuirass counts as trunk for the rags, which hang over it. A zombie can still wear the
    hero's own armour builds through `adorn`.

  Machine gate: the armed card's gear on the hero, the operator's own over it, a lost hand's weapon moved; the adorned
  skeleton's pieces, its cuirass clear of the ribs, each piece on its bone; both lineages at the hero door with their
  layers, their plans building. Eyes: the revenant soldier, knight, giant and slender and the risen shambler and
  soldier, front and three-quarter, before and after rounding the armour's rings. Eyes gate: the operator's to judge.
- **The rotting corpse's open flesh, in layers** (`undead/tiered-layers.js`; the operator: "replace more segments with
  pieces that are part bone showing; open flesh should be layered with at least meat and skin differentiation").
  - Half-bone limbs: four new bared words, `halfForeArm`, `halfUpperArm`, `halfThigh`, `halfShin`. Each lays the
    limb's bone its whole length and a sleeve of its flesh over one end (seeded: the joint's end or the far one,
    for a seeded share of the limb). The sleeve's torn edge is layered: the skin ends, the meat under it, narrower,
    runs on past it onto the bone, the bone thinner still. Its own flesh and the bridges at its ends are cut from
    the recipe; the hand or the foot beyond it stays flesh.
  - Torn edges: wherever a whole bared limb leaves the flesh (the shoulder, the elbow, the hip, the knee), a collar
    of meat sits on the bone past the skin's end. Under a bared skull, the neck's top is torn the same way.
  - Bared ribs show through an open wound: a patch of meat down that flank under them, flush with the skin.
  - More of each corpse is bone: the zombie cards bare two to five pieces (the fresh one one or two), drawing on the
    half words. The bared pick claims each stretch of a limb (the upper arm, the forearm, the thigh, the shin), so a
    whole and a half word never bare the same one.
  - The open flesh's layers are their own groups and tones: `Skin` the body's own, `Meat` a dark red, `Bone`.

  Machine gate: a half word's bone, skin sleeve and meat, nested (the meat narrower than the skin and longer, the bone
  thinner than the meat); a whole limb's torn edges as collars of meat tapering onto the bone; the wound on the ribs'
  side; the plans building. Eyes: the rotting shambler, bloated one and hulk from the front, three-quarter, side and
  back. Eyes gate: the operator's to judge.
- **Spots: a corpse's flesh gone in patches** (`undead/spots.js`, the `spots` layer; the operator: "intensify by adding
  more cow spot areas of flesh disappearance; consider partial in the face and skull"). The rotting lineage now lays
  `['bared', 'spots']`. Each patch is a thin plate whose rim is projected onto the surface it lies on (the torso's
  section, a limb's tube, the skull's own rows, the head's own cranium points), so it hugs the body. Its outline is
  a ragged blob, two and three lobes at seeded phases.
  - On the body: patches of meat where the skin went, on the torso and the limbs the corpse still has the flesh of
    (none on a limb gone to bone); a seeded share are deep, the bone showing in the meat.
  - On a corpse's own head: patches of bare bone in a rim of meat (a cheekbone, the brow, a temple, the jaw), lying
    on the cranium itself.
  - On a bared skull: what is left of the face, patches of skin on a rim of meat over the scalp, a temple, a cheek,
    on the braincase's rows or the face's.

  Each zombie card says how many and how deep (`spots { count, deep, face }`): the gaunt one most, the fresh one
  fewest. The layer lies over flesh only.

  Machine gate: the body's patches of meat on flesh alone, hugging the torso's section, some deep to the bone; the
  face's bone on a flesh head and the skin left on a bared skull; refused over bone; absent, no patch; the rotting
  lineage laying it. Eyes: the rotting shambler, bloated one and lithe one, front, three-quarter, side and back, the
  patches ragged after the first round (which had read as targets) and the face's bone on the real cranium after the
  second (which had sunk inside the head). Eyes gate: the operator's to judge.
- **The attack skeleton** (`undead/hero-bones.js` `segmented`, `limbColumn` in `undead/passes.js`, the `attack`
  layer and the `ravager` lineage; the operator, from a reference: "make some attack skeletons; notice how the segments
  are in more than just the spine").
  - Every long bone is a column of segments as the spine is: each segment a short drum, broad across and thin along
    the limb, with a short ridge to one side, laid by the vertebrae's own rule along the limb's joints (`limbColumn`,
    the spine's builder generalized). The forearm and the shin each carry a second, slimmer column beside the first,
    as their two bones lie. The long bones' shafts thin to a core under their columns, the knobbed ends kept.
  - Each finger's last bone is drawn out to a hooked claw.
  - Its stand is a crouch to strike: a hunch over the hips, the knees given, both clawed hands up and forward with
    the elbows well bent, the head up and watching, the jaw dropped.
  - The layer lies over bone only.

  Machine gate: each long bone's column climbing it in order and riding its bone, the twins on the forearm and the
  shin alone, the shafts thinned; a claw on each finger's last bone; the stand's hinge and bent elbows and the dropped
  jaw; refused over flesh; the lineage at the hero door; a skeleton without the layer unchanged. Eyes: the soldier, the
  giant and the slender ravager, front, three-quarter and side, after the first round (long spiked ridges that read as
  saw blades, the arms thrust straight out) was cut to drums and a guard. Eyes gate: the operator's to judge.
- **The undead's walks** (`undead/gaits.js`, `UNDEAD_GAIT` and `undeadGait` in `polygonizer/figure-posing.js`, the
  `unbound` factor in `polygonizer/figure-vajra.js`; the operator: "come up with unique stick figure animation walk
  patterns for undead. being 'hobbled' is optional", then "give skeletons exaggerated movements that are
  unconstrained by joints").
  - Each undead card walks a walk of its own, a word over the walk's dials: the shambler shambles (arms reaching, the
    trunk swaying, the steps stumbling), the gaunt creeps (deep-kneed, the head thrust out), the bloated waddles on
    a wide base, the hulk drags a dead leg, the fresh stumbles, the soldier and the knight march, the slender
    clatters, the squat trundles, the giant lumbers and the attack skeleton scuttles. The hero carries it as its
    `motion.walk`, under the operator's own dials.
  - A walk may be HOBBLED: one leg stiff and swung round, its foot dragged, the trunk listing over it, its step short.
    The walk's own odds decide on the hero's dice (the hulk always, on its club's side), or `undead.hobble: true |
    false` says.
  - The new dials (hobble, stiff, drag, hitch, shortStep, lurch, stagger, jerk, armReach) are walk dials the door
    takes; absent, a walk is byte for byte the walk it was.
  - A skeleton's walk is UNBOUND: no flesh holds its bones to a person's ranges. `unbound` lifts every joint's range
    by a factor and lets the elbows and knees bend the wrong way; over it the arms are flung past the swing and out
    on the back swing (`flail`), the skull lolls and turns half round (`loll`), the hips and shoulders wrench round
    (`swivel`), the bearing knee snaps back (`snap`) and the jaw clatters (`chatter`). Without `unbound` a pose is
    the bounded one, byte for byte.
  - Fixed on the way: the hero door gave a new hero the calibrated walk before the undead's words were laid, so an
    undead walked the stock walk; its words now come first.

  Machine gate: the walk unchanged without the dials and the articulation without `unbound`; a hobble's knee barely
  bending on its side alone; a skeleton's shin folding forward and its hip past the 62° cone; the door's dials; the
  card's walk stored at mint, the hobble's override and odds; every variation's walk baked on its rig. Eyes: stick
  figures of every walk, plain and hobbled, side and front, and the minted heroes walking, side and front (the hitch
  softened after the first strip). Eyes gate: the operator's to judge.
- **Destruction: the undead come apart** (`die: 'dismantle' | 'cleave'` and `sever` on a foe's `vanish`,
  `gameworld/vanish.js`; the page's wreck, `scene/channels/wreck-channel.js`; the operator: "for these elements can we
  also add destruction … dismantle and cleave … might be interesting seeing that on these types of enemies").
  - A downed foe may be DESTROYED rather than fall: `dismantle` cuts the relations between its bones, never a face.
    Each bone's rigid mesh is a block, its parent the rig's own (`figures/rig-tpose.js` humanoidParents, read off the
    rest bones), and `sever` says which joints go: `all`, `limbs` (the head and the limbs, the trunk one piece),
    `head`, or `some` (two or three of those, on its dice). The small bones ride their hand or foot.
  - Each group still joined falls as one rigid piece where the body stood: thrown off the blow, spun, landing on its
    corners with restitution and friction, tipping onto a face and coming to rest. The pieces lie at least
    `WRECK_LINGER` seconds, then fade (or sink, a `sink` going); no transit plays. Fixed-step and seeded, so a replay
    falls the same.
  - `cleave` cuts by part instead: at mint each wrecked figure is sliced through its trunk by a seeded slash (tilted
    20 to 50 degrees off level, `scene/rig-cleave.js`), each bone above or below the cut kept whole and each it crossed
    split into two halves, every loop of the cut capped in the inside (`inside`, a corpse's meat). On the blow the
    halves swap in, a streak of light runs along the cut for a breath, the side above slips off down the cut and the
    side below gives way.
  - `destroy` lets the killing blow choose, by a default table (`BLOW_DESTRUCTION`) a foe maps over with its own `by`:
    a strike cleaves, a round knocks two or three of the head and limbs off, a burst tears every joint and throws the
    pieces hard (away from where it went off), a stomp or a tackle lets every joint go. The runtime reads the blow off
    what the hits already record (the striker's strike or shot at it, a burst over it, a stomp on it); with none
    known, the body's own way.
  - The skeleton is layer 0 under every foe, and only it is destroyed (a mode above it is defeated). The undead are
    destroyed so by default, by their people's form, wherever the world lets a foe fall or be thrown: by the blow, a
    skeleton cleaved through its ribs and spine to its marrow as readily as a corpse to its meat; with no blow, a
    skeleton comes apart at every joint and a corpse is cut through. An entry's own `die`, and a platformer's squash or
    a pinball's pop, stand over it.
  - A page with no destroyed body carries none of it.

  Machine gate: the words and the undead's defaults; the groups each `sever` makes on a hero's bones; a slash's sides
  (the head above, the feet below, the trunk cut), each half on its own side capped in the inside, the same cut for the
  same seed; a dropped bone settling flat; the runtime marking the body the frame it goes down and handing it to no transit; a destroy dying as each blow says (a strike, a shot, a burst away from it, none); each function the
  page runs evaluating from its own source alone; no wreck on a page without one. Eyes: each undead struck by a strike,
  a round and a burst on the demo level, filmed close (the rounds recorded in the plan). Eyes gate: the operator's to
  judge.
- **Modes: a foe defeated, not destroyed, until its last** (optional; `body.modes` in `worlds/controllable/vanish.js`,
  `scene/rig-shed.js`; the operator: "armored mode is one layer, unarmored mode is another … it can only be
  cleaved/destroyed at the lowest level, it's just defeated and resets until that").
  - A body may carry `modes: [{ figure, hp? }, …]`, the first the mode it starts in. While a mode is left under the one
    it is in, a killing blow DEFEATS it: it is knocked down (combat-hit's `noDestroy`, the practice rule) and rises
    reset into the next mode, its figure and its health; only the last mode, layer 0, dies, and is destroyed by the
    blow as above. A body without modes is as it was.
  - Every mode is its own figure on the same stick figure, built up front as a loadout's are, so the swap is the
    runtime's own variant swap and the walk carries across.
  - What a defeated mode SHEDS is what its figure carries and the next lacks, bone by bone (`shedParts`, laid on the
    figure at mint): an armoured skeleton's helm, cuirass, pauldrons, bracers and greaves torn off where they were
    worn and thrown off the blow while the bare skeleton reels (a stagger, never the knockdown) and fights on.
  - The worked example: an armoured skeleton (the `adorned` layer) whose modes are itself and the bare skeleton of the
    same seed. The first killing blow tears its armour off; the second destroys it.

  Machine gate: a mode defeated resets into the next (figure, health, its shed marked) and is never destroyed, the
  last destroyed; a mode's shed is exactly what the next lacks, the bone's own triangles left; a figure diffed with
  itself sheds nothing. Eyes: the armoured skeleton struck twice on the demo level (the first round's defeat floored it
  and it was still down at the second blow: a defeat now reels). Eyes gate: the operator's to judge.
- **The active target's rim** (`body.targetRim`, `gameworld/foes.js` `targetRimOf`; the page's `foeRim` in
  `scene/channels/controllable/index.js`; the operator: "next do active target fresnel/rim light").
  - The foe the hero targets (the foe bar's own pick: the lock's target, else the foe it faces) is lit at its edges: a
    fresnel shell, brightest where its surface turns from the eye, pulsing, in the world's accent (its juice's trail
    palette; a warm white without one). Every gameworld foe carries it.
  - The rim is laid on the bone meshes of whatever body the foe is drawn as now, so it lights the outermost mode a
    foe wears and follows a mode swapped in; smooth normals are worked out once per bone mesh for it.
  - A page whose bodies ask for no rim carries none of it.

  Machine gate: the rim emitted only where a body asks for it, on the bar's pick; the accent's colour. Eyes: a skeleton
  and a corpse side by side, the rim and the bar moving from one to the other as the hero turns (the first round too
  faint on pale bone: a stronger falloff and a slight tint). Eyes gate: the operator's to judge.
- **Foe base states: flaming** (`foes/states.js`, a bestiary entry's `states`; the operator: "add some primitives to the
  skeleton … base states that can be carried by all layers above it … in the future enemies can carry this regardless,
  without having to list every enemy").
  - A foe may be BORN in a state, `states: { flaming: true | { color?, elemental?, char? } }`. A state is a status the
    body starts under, carried by layer 0 and so by every mode above it: whatever draws its look on a body draws it on
    this one, whichever figure it wears now. A new state is a row (`FOE_STATES`), never a list of foes.
  - `flaming` is the `blaze` look as a COLUMN of fires up the body (`fires`, each standing a share of the foe's own
    height up it, read off its hit egg): a small lick at the legs, the widest at the chest, a narrower peak round the
    head that leaves the head seen. Each is the fire channel's flames on the body, lighting the world around it,
    carried as it moves. `color` is a flame's colour, a plain word (blue, green, red, crimson, purple, orange, yellow), a colorant of
    the fire kernel's, a mix or a hex; absent, the element's own. The body chars as it burns (`char`: the share of its
    own colour it keeps, 0.35 by default), darkened on whatever body it is drawn as now and put back when the fire goes
    out.
  - `elemental: true` makes the state the foe's ELEMENT (`e.element`, the affordance a system reads: what its blows
    carry); `false`, the default, is the look alone. No system reads the element yet.
  - Any body born under a status burns in the fire channel if its look burns (`bodyFires` reads `e.statuses` as it
    reads the cues), and a page with no charring source carries none of the char code.

  Machine gate: a state's status from the clock's start, its element only when elemental; the words refused by name;
  a body born alight is one fire it carries, charring only where asked; no char code without a charring source; the
  runtime giving the birth at the first step. Eyes: a skeleton in its element's flame and a corpse in blue, side by side
  on the demo level (the first round burned nothing: the runtime builds an entity from its known fields, so the birth
  now rides the body, `body.born`; the next two whited the bodies out under a fire wider than them: a body-width
  campfire from the feet). Eyes gate: the operator's to judge.
- **Layer 0, written down** (`docs/foes.md`; the operator: "from a class based programming perspective is this pattern
  sustainable … let's proceed"). The contract every foe implements (the entity, its bones by name, its height and hit
  shape, its health, what it carries) and the shelves over it (behaviour, skin, modes, states, death), each a row, with
  the precedence between them and the rule that every shelf carries a law test crossing a mode swap. Composition over
  a base interface, not a class tree.
  - The one place the contract was broken: a status look (a coat, ice, water) was laid once on the body a foe wore
    and stayed on it when a mode swapped in, and never reached a rig foe at all (its bone meshes carry no normals). On
    a page with layer-0 foes (a body with modes, or born in a state) a look is rebuilt on the body the foe wears now,
    and a rig body's bone meshes are given smooth normals once; a status a foe is born under is drawn in its look as a
    cue's would be (`events.born`). A page with no layer-0 foe carries none of it.

  Machine gate: the channel rebuilding a look on the body a swap puts in and giving a rig body its normals, as it was
  without a layer-0 foe; the engines' marks for the new events keys. Eyes: a flaming armoured skeleton defeated into the
  bare one, still burning.
- **A model made elsewhere, worn as a foe** (`skin: { meshRef, height? }`; `scene/rig-import.js`, `foes/model.js`; the
  operator: "an affordance to be able to 'import models' to use as enemies"). A rigged humanoid `.glb` bound onto a
  sketch (`bind_mesh_render`) is read into layer 0's own pack: its joints to the hero's bone ids by name (Mixamo, VRM, the
  Unreal mannequin, Rigify, a 3ds Max Biped; the file's own VRM map when it has one; the spine counted up from the hips),
  its rest skinned once by its own weights (the armature's scale and turn in it), turned by its own body into the native
  frame, scaled to `height`, each triangle on the bone that moves it, coloured by its material (factor, vertex colour, a
  PNG here and a JPEG through the optional `sharp`) and shaded by the studio key. It stands on its own ref (no step makes
  it), fits classes as a person on two legs, and plays the clip library's states; the cuts, the shed, the states and the
  target rim take it unchanged. A model with no skin, or missing a humanoid bone, is refused naming what is missing.
  Not read: its own clips, its other maps.

  Machine gate: each convention's names, a turned file read as the same body, the height it is stood at, each triangle on
  its bone, the same bytes twice, a dismantle, a cleave and a shed on it; the bestiary's word made by no step, at its
  height, refused by name. Eyes: two Mixamo models from the three.js examples (a robot in its materials' colours, a
  textured soldier, flaming) standing beside a zombie on the demo level, on the library's idle; a burst tearing the
  robot apart at every joint, a strike cleaving the other through, the soldier cleaved with its legs still burning. Eyes
  gate: the operator's to judge.
  - A level its foes stand on is re-made when a bestiary entry changes: its print now carries the bestiary (the cast is
    a function its args' JSON left out, so a changed `vanish`, `states` or `skin` kept the level as first made). A
    level no foe stands on prints as before.
- **A foe type's defaults, disciplined** (`docs/foes.md`; the operator: "come up with principles so that we have good
  discipline when it comes to making new enemy type defaults"). Humanoid first; one default per shelf from the canon of
  its name, on the form and never on an entry; no form that combines shelves; rows over primitives layer 0 already has;
  measured in the foe's own body; sized for a crowd; seeded, and free when absent; anything drawn over layer 0 is a
  skin, whoever made it; proved once per procedure. A one-layer zombie checked against every layer-0 capability first:
  its joints, each dismantle, the cleave, a mode over its own skeleton (shedding all its flesh into the same bones), a
  flaming column by its own height and a skeleton's walk all hold.

### Carved glyphs: the letter primitive grows up

The glyph carver (`lib/motion/glyph-carver.js`) is the letter primitive of the pre-three renderer: any character a
font covers, styled and extruded. Its legacy stack (materials, a bevelled carve, inner glow, the outer form-effects,
the materialize reveals) reached the page only in part. This theme brings the primitive's pieces up first, then
spreads carved letters to where the page draws words.

- **The shelf's display face ships with the repo.** Archivo Black (SIL OFL 1.1) is vendored at
  `lib/graph/image-outcomes/fonts/archivo-black.ttf`, its license text beside it and its notice in `NOTICE`. The shelf
  says a recipe names a face by key "so a cover carves identically on any host", but no face was ever vendored: the
  key fell back to whatever the host had (Arial Black on a Mac, DejaVu Sans Bold on Linux), so the same cover carved
  in a different face per machine. A cover or title naming the default face now carves in Archivo Black everywhere:
  on a host that fell back, its letters change once, to the face the recipe always meant. The other shelf faces (IM
  Fell English, Great Vibes, Inter) stay unvendored until something carves in them. Machine gate: the cover suites
  pass on the vendored face; eyes gate not run.
- **`material` on a title row: what the carved letters are made of** (`game/title-material.js`). A title's letters
  took the register's paint (anime cel bands, western lambert and a glint) in the title's colour; the carver's legacy
  material shelf (the `carved-solid` wordmark's `material`) never reached them. A row may now name one. A **metal**
  (`chrome`, `gold`, `silver`, `copper`, `bronze`, `brass`, `steel`, `titanium`, `aluminium` … and the shelf's
  `gunmetal`, which reads as steel) is the chrome logo: each letter's face and bevel reflect the studio sweep the
  broadcast's metal reflects (`metalStops`: the softbox, the dark horizon under the middle, the floor's bounce, in the
  metal's measured reflectance), drawn from a two-column texture by the vertex's height in the line, so every letter
  shares one horizon; three hard bands in the anime register; the walls the metal's middle, lit. A **finish** (any other
  shelf row or its alias: `stone`, `wood`, `plastic`, `glass`, `neon`, `marble` …) shades by its row (cel bands, a glint,
  emission, glass's opacity, held through the entrance's fade) in the row's colour, or the row's own when it names none.
  The material's colours are decoded from sRGB as the world's baked colours are. The idiom `title(…)` and a `play.parts`
  banner pass it; card `hud-title`. No theme names a material, and a world whose titles name none emits the title block
  byte for byte as before (the material code is spliced only when a title names one). Machine gate: the title layer's
  suite drives a metal, a finish and glass through the emitted page against stubs; a bad word fails the gate with the
  shelf's words. Eyes gate not run: the author's own renders (chrome, gold, copper, marble, glass, neon titles in
  headless Chromium) showed the sweep reading as chrome and gold; glass reads murky, its walls and a glow edge showing
  through.
- **`block` on a title row: the depth made to show.** A title's letters face the screen, so the carve's depth was a sliver
  and they read as a raised face. A row may name a block (`title-channel.js`, only spliced when a title names one):
  `drop` pulls each letter's back ring deep, down and to the right (the comic and cartoon block letter), `perspective`
  pulls it toward a vanishing point under the word (the action-movie logo), `stack` stands six receding copies behind
  it in alternating shades (the comic masthead's construction, `comicWordmark`'s block copies, now in 3D). The face and
  its bevel keep their look (paint or material); the sides take `blockColor` or the face's hue darkened, lit by the way
  each wall faces (the right side bright, the underside dark), two flat tones in the anime register, shading toward the
  back in the western. A block is the drop, so it replaces a `shadow` edge; the ink hull outlines the whole block. The
  idiom, `play.parts` banners and card `hud-title` take it. A world whose titles name no block emits the title block
  byte for byte as before. Machine gate: the title layer's suite checks the face unmoved and uncoloured, the drop's back
  ring moved by one offset, the perspective's back narrower than its face, the stack's steps and their fade, and the
  closed words. Eyes gate not run: the author's renders of each block over a walk stage read as block letters once the
  drop copy was taken off a blocked title (it stood in front of the sides).

### Superheroic pieces: belts, pouches and jackets as cards

- The outfit catalogue's belt takes three dials (`outfit-plan.js` OUTFIT_KINDS `belt`): `buckleColour` (a colour role or
  hex the buckle wears instead of the band's: a gold buckle on a leather belt), `buckleScale` (× the buckle's face, an
  emblem buckle) and `width` (× the band's height and thickness, a power belt). `pouches` takes `at: 'waist'` (a UTILITY
  BELT: the belt at the waist and `count` pouches, 2, 4 or 6, ringing it just under its line, hung on the pelvis's top by
  shares) and `size`; the belt's dials pass through to its band. A new kind, `thighPouch`: a holster rig strapped round
  the thigh, the pouch on its outer side (one on the intent's side, `pair` both, `size`). Absent, every dial contributes
  nothing: a row without them is byte for byte what it was.
- The comic hero pack's piece cards (`cosmos/packs/comic-hero/pieces.js`): belts (the emblem belt, the power belt, the
  utility belt and the full one, the sash), pouches (the duty belt, the thigh rig and its pair, the chest rig, the
  harness, the bandolier) and jackets (the bomber, the moto jacket, the duster, the armoured jacket, the hooded jacket, each
  the language's `outer` in its own `Outer` colour), worn over a role suit by `withPieces` (a waist belt replaces the
  suit's, never stacks) and by `memberOrders(id, look, { pieces })`; a word-list outfit (the Movie era's plating suits on
  the realistic body) takes none and the call says so.

### Headgear spike: masks, visors and helmets

- The `cast` signature (`station-loft-adorn.js`): a mask CAST from the face, not built over the head's bounds. An
  outline drawn in the eyes' frame (the cranium's eye row, between its inner and outer corner slots), wrapped round the
  head on a cylinder, a grid over it cast inward onto the skin, its depth smoothed and never below the cast, lifted,
  thickened and walled. `outline`: `domino` (almond eye holes, over the brows and the bridge, a notch above the nose,
  points swept up at the temples), `band`, or a polygon with holes. The pack's tiered domino is now this cast.
- The cast is the MASK BUILDER's primitive, every look words: the outline's dials (`CAST_DIALS`: bridge, cheek, brow,
  notch or a widow's `peak`, the temples' `wing` and `wingRise`, a `fang` down each cheek, `round` curved or angular), the
  `eyes` (almond, slit, angular or round; open holes, `lens` covers domed over the eyeball, or `none`), and relief (a
  raised `rim`, a `ridge` down the middle, panel `seams` by word or line), each face coloured by its triangle so a lens
  or a rim follows its shape. A plate is a second cast over the first. It reads the anime head's face and pupils too.
- The pack's builder (`headgear.js` `maskKit({ outline, eyes, detail, plate })`, its words in `MASK_OUTLINES`,
  `MASK_EYES`, `MASK_DETAIL`) and its variations: pointed, raptor, technical, tactical, hunter, lens, blank and goggle
  masks. On the anime head the default eyes are opaque covers (its eyes are too large and too drawn to frame), and an
  open-eyed mask wears covers in its eye shape unless the eyes say `anime: 'open'`.
- The `cowl` signature: the cast over the whole head, out from its middle on a map laid round the crown, down to an edge
  set by the head's own heights (`mouth: 'show'` a U under the nose round the mouth and the chin, `'cover'` to the chin
  over the lips, `'none'` smooth over them: a mask with no mouth), the jaw at the sides and the nape behind; the eyes the
  cast's, carried onto the map; the ears raised under it; `hair` the hero's hair flowing out of the back in its own
  colour. The cast and the cowl share one head reader and one grid mesher.
- The pack's `cowlKit({ hair: 'cover' | 'flow', mouth, domino, eyes, detail })`: the cowl with a domino laid over it by
  default (a mask's words, or false), the two sharing one eye treatment so their holes meet; the hair hidden under it
  either way (flowing, its length from the hero's own style); and its variations: the domino, flowing, lens, covered,
  bare and technical cowls, the full mask and the faceless mask.
- ORNAMENTS on the cowl, composed with the face as a whole: the eyes are its focus and the domino frames them, so every
  ornament rides a FACE PATH that carries the domino's own line on over the head (`COWL_PATHS`: brow, echo, temple,
  parietal, sagittal, cheek, jaw; `align` the domino's dials). Spikes (`bat`, its broad face to the front; `fin`; `cone`;
  in a row by a profile) and lines (embroidery as stitches, a cord or a double cord). The pack's ornament words
  (`COWL_ORNAMENTS`: bat ears, a bat crest along the sides, fins, a crown crest, brow, echo and cheek stitches, temple
  cords, a crown stripe) and compositions (`COWL_DRESS`: gothic, nocturne, aviator, stitched, crowned, owl).
- The cast's W: the outline's `arm` and `valley` dials raise the domino's points into arms with a dip before the brow, and
  `sweep` carries the cast off the skin past the head from the temples, so the arms sweep out beyond its silhouette. The
  owl's W and its variations: the owl, horned owl, barn owl, great owl and night owl cowls, the owl full mask and the owl
  mask alone, each with its own colours.
- The `mouthpiece` signature: the lower face's cast, the domino's counterpart, from under the eyes past the chin, its
  edges set against the head's own heights (`nose`, `mouth`, `chin`, with an offset or a share: 'chin-0.2'), the cloth
  HANGING straight down below the chin where the skin runs out; `taut` bridging the features (a cloth drawn over them),
  `bulge` a cup over the mouth, `fold` crisp folded planes (a mecha's plate), a `mouth` cut (a slot, the oni's snarl) with
  `teeth` and `fangs`, `vents` cut along a polyline, a dark MAW behind every cut, the oni's `wrinkles`, and `fittings`
  (filters, grilles, ribbed tubes, valves, straps).
- The pack's mouthpieces (`MOUTHPIECES`, `mouthpieceKit`): the ninja and wraith wraps, the bandanna, the oni mouth, the gas
  and twin filters, the tube, slatted and mecha masks and the rebreather; and FACE SETS, a cowl with a mouthpiece laid over
  it in its own colour (`MaskMouth`): the shinobi, the revenant, the oni warrior and the wastelander.
- A mouthpiece takes a polygon outline (`outline.poly`, its heights words) and vents in any direction (each slot square to
  its path). The PANELLED mouthpiece (`panelledKit`, `PANELLED.kombat`): the fighting ninja's three panels cast tight on the
  face, a flat centre with horizontal vents and the sides angled back to the cheekbones and the jaw, a thin dark backing
  under them so the gaps read as panel lines; in four colourways (frost, venom, ember, jade).
- EYEGEAR: everything worn over the eyes as one family on the cast, the dominoes its first kind. The cast gains eyegear
  outlines (`goggles`: two rings and a bridge; `shield`: one wide lens with a nose notch; `visor`: a narrow band), one lens
  filling the outline (`eyes.shape: 'shield'`), a flat `front` standing off the face (a headset's box), a `strap` cast round
  the whole head, and `fittings`, now shared with the mouthpiece (`castFittings`), with earpieces, antennas, forward
  scopes, small lenses and arms. The pack's `EYEGEAR` words and `eyegearKit`: ski, moto and lab goggles, night vision and
  quad vision, a VR headset, a cyber visor (a glass band, a silver headband, earpieces, antennas, cables) and a spider visor
  (a lens cluster held on arms from the earpieces); the domino mask cards are eyegear too.
- The cast's `front` takes `curve` (a curved shield at one distance from the head's axis) and `shell` (the piece a sheet
  standing off the face: a visor); the fittings' discs are flat-topped with a bevelled edge (no pointed centre), and an
  earpiece or an antenna stands `out` past the cast, over the hair. The ski goggles are a riot-shield visor standing off
  the face, the VR headset narrower, the cyber visor bolder; and two visors: the engineer's (a gold band wrapped temple to
  temple, ridged across) and the optic visor (a dark band with one ruby lens strip across both eyes).
- HELMETS on the cowl: `pad` (padding under a hard shell), `shell` (its surface bridged round and taut), a `window` (an
  eyegear outline: the face opening, a visor by `eyes.treat`), `mouth: 'open'` (the whole face shown) and `fittings` on
  the shell, with a `peak` (a brim). The pack's `HELMETS` and `helmetKit`: the biker's full-face helmet (a smoked visor, a
  racing stripe), the motocross helmet (an open window, a peak), the jet helmet, the pilot helmet (a jet shell, a dark
  shield visor standing off, an oxygen mask and its hose, composed from the eyegear and the mouthpiece), the tactical bump
  helmet and the space helmet.
- The peak fitting curves (`span`): a strip across the shell's front just over the window, each column standing off along
  the shell's own outward line, sloping down and lipped up at its edge (it was a flat board standing high on the dome).
  The motocross helmet is the base of a family built from its dials (`MOTO`: the peak, the window, the chin bar's vents,
  a visor, a crest, stripes): the enduro, downhill, adventure, BMX, desert and raider helmets.
- The cast takes a `shift` (its outline moved: goggles pushed up on the forehead, a visor's housing over the brow). The
  JET PILOT family (`pilotKit`: an open-face shell, a visor housing, the visor down or up, earcups, an oxygen mask and its
  hose, a boom mic, stripes): the fighter, top, test and helicopter pilots, the aviator's leather cap with goggles up,
  and the display pilot. The ASTRONAUT family (`astroKit`: a great padded shell, its window a clear, gold or glowing
  visor, a gold visor shell standing off over it, headlamps, valves, antennas, a crest): the moon, spacewalk, soft,
  fishbowl and sci-fi space helmets. And sci-fi helmets on the full-face shell: the hunter's (a T visor, a rangefinder),
  the trooper's (angled eye lenses, a mouth grille), the spartan's (a gold visor, a crest) and the synth's (a glowing strip).
- The FACELESS helmet: the cowl's `blank` face is one smooth egg, fitted to enclose the whole face (brow, nose and lips)
  and blended into the skull, so no feature shows through it. Heights on a blank face are read on the egg. Its shell takes
  panel lines (`panels`, fine cords that stay crisp at any grid; `windowSeam` one round a faceplate). Painted eyes
  (`eyes.treat: 'paint'`) are flat decals laid on the smoothed shell. `decals` (slots, dots, polys in the eyes' frame)
  lay paint or, rimmed, cutaways: vents and slots. `facelessKit` composes five optional word libraries (`FACELESS`):
  - panels: ribbed, plated, kabuto, split, brow band, cheek, jaw plate;
  - adorn: fins, horns, a crest fin, crown spikes, a ridge, ear discs, antennae;
  - details: one or two glowing eyes, a grille, hoses, filters, studs;
  - cuts: a mouth slit, mouth, cheek and temple vents, eye slits, a mono slot, a brow slot;
  - paint: fox, kabuki, tears, oni, stripes, kintsugi, a third eye, a blush, lips.

  Cards built from it:
  - segmented: the cyborg ninja, the vented ninja, the hunter, titan and warlock guardians, the ronin and the mono-eye;
  - porcelain: the fox, kabuki, noh, oni and kintsugi masks.
- Skulls, gladiators, peaked helms and T-visors on the same builder. The cowl gains:
  - decal `layer`s, paint over paint, and a `decalLift` for a contoured hood;
  - `dents`: the shell sculpted, sockets and hollows pressed in, a brow or a chin swelled out;
  - a `crest` ornament along any path: a blade, or a horsehair plume, rounded and swelling;
  - a `brim` fitting: a flange round the head, swept up over the face, or behind only as a neck guard;
  - a `peak` on an open face's edge (a point over the nose), and `openCurve` (how long the edge holds over the eyes).

  Fixes in the same work: height words in a cowl's stroke paths are resolved (they were dropped), a poly window is
  resampled before it is carried onto the shell (its straight sides cut chords across the polar map: the hunter
  helmet's T visor arched over the brow), and large decals are subdivided by their size. New words:
  - `sculpt`: sockets, nasal, cheeks, temples, brow, chin;
  - paint: skull, skullFace, skullJaw, sugar, cracks;
  - cuts: grille, eyeHoles, chinVents, teeth;
  - adorn: band, comb, griffin, plume, transversePlume, brim, neckGuard, templeFlares, rangefinder;
  - panels: teardrop, sideBands.

  Cards:
  - skulls: bone skull, painted skull, skull balaclava, sugar skull, skull knight;
  - gladiators: the fish, griffin and chaser gladiators, the hoplite and the legion helms;
  - peaked helms: peaked, iron and crowned;
  - T-visors: the T-visor helm, bronze, night and heavy.
- Structured masks: the face in flat planes. Two new cowl dials:
  - `facets`: planes given by azimuth and elevation, each fitted to just clear the face, the shell riding the solid they
    bound; `nose` leaves the nose out of the fit, so it stands sculpted out of the plates;
  - `front`: the shell over the face only, from a hairline down to the edge and back to the ears, worn over the hair.

  A front mask's lines stop at its edge. `structuredKit` and `FACETS` (iron, respirator, skull) dress them with the
  faceless builder's words, plus new ones:
  - cuts: barredMouth, triGrille, chinVent, visorSlit, lensEyes;
  - details: rivets, scopeEye, hinges;
  - panels: tusks, plates.

  Cards (the mask family):
  - the iron and gilded tyrants;
  - the dark and chrome-lined respirators;
  - the clockwork skull and the whaler mask.
- Ensembles: the body that answers a head. Three changes make a suit harmonize with the headgear:
  - **Layering:** an armour build takes `with`, a kit worn over the suit, and a head piece in it (on the cranium) takes
    the suit's helm's place. Before this, a headgear card on an armoured suit replaced the whole `adorn` and the
    armour was lost.
  - **The hardsuit's archetype words**, each absent the piece as before (the armour pins hold), documented in the door's
    manual:
    - `pauldron` `lames` | `none`, and `pauldronSide`;
    - `chest` `plates` | `box` | `bands` | `none`;
    - `arms` `manica` | `gadget` | `none`;
    - `legs` `greaves` | `ocrea` | `none`;
    - `skirt` `pteruges` | `tassets`;
    - `pack` `jet`;
    - `glow` `lines`;
    - `collar` `high` | `none`;
    - `fnSide` and `leadSide`.
    - `cut` `fitted` | `yoke`: under the fitted cut the chest and back plates end under the collarbone and off the
      sides, the pauldrons sit on the shoulder's point, and the collar is a gorget at the neck's base, so the torso never
      wraps the shoulders. Fitted is the default from **armour laws 2** (`ARMOR_LAWS_VERSION`). A build stamped under
      laws 1 keeps the yoke, pinned by the char test's `LAWS_1`, and the validator accepts any known version.
    - `build` `plates` | `cylinders`: under cylinders the arms and shins are rigid tubes (the `volume` signature),
      cuffed in the trim, their girth leaning a little on mass. The thighs keep plates (law 8).
    - `pack` `tanks`: a back unit, capped at the shoulders' breadth, with two exhaust stacks.
    - `helm` `shell`: a helm cast over the whole head from the card's `language.helmet` (the cowl's words). A shell helm
      over visible hair warns, as the kabuto does.
  - **Cards recompose by law:** a card's `byLaws` lays its later composition over it from an armour law on. grim-scifi
    is recomposed as the heavy suit: cylinders, a tank unit, tassets, a gorget, ornament 1, and a shell helm with two
    round amber lenses and a breathing canister. fantasy-space is the light trooper: chest plates, caps and greaves,
    and a white shell helm with angled dark lenses, a grille and cheek lines. Both pin anew at laws 2, and laws 1
    keeps them as they were.
  - **The shoulder is not the torso's** (**hero laws 18**, `tieredKit`): this was the yoke on every armour family on
    the tiered body.
    - The tiered body's shoulder balls stand out of the torso's widest rings, and every torso plate stood off them, so
      a breastplate reaching the shoulder line wrapped the shoulder.
    - Above the ball's lowest point, a trunk plate that is not a shoulder piece now keeps inside the ball's inner edge.
      A front or back plate is cut in under the arm by a new shell `armhole` (its side edge eased in above a station),
      and a wrap ends under the arm.
    - Pauldrons, pinned pieces and the neck's gorget stand as before.
    - A mantle is a shoulder piece too, so it keeps its drape over the shoulder rather than being cut to a chest band,
      and the cut never ends a plate above its own start.
    - Heroes stamped 1 to 17 keep their fit (the adult-form chibi's pins hold).
  - **`comic-hero/ensembles.js`:** the ensembles, each an undersuit and its cloth plus the hardsuit in those words
    (or the lamellar ronin, or the themed death knight). Each is coloured from the headgear card's palette: the shell
    becomes the plates, its trim the trim, its seams the undersuit, its glow the lights. A group left `skin` is bare.
    The ensembles are cyborg, hunter, titan, warlock, ronin, gladiator, hoplite, legion, regal, bounty hunter, tyrant,
    dark lord, assassin, reaper, death knight, operator and shinobi.
    A cowl carried in an armour's `with` presses the ears flat as a worn cowl does.

  `HARMONY` names the ensemble each head calls for; `memberOrders(id, look, { headgear, ensemble: 'auto' | id })`
  wears it in place of the costume (tiered body).

- `cosmos/packs/comic-hero/headgear.js`: the domino (a second-skin paint band across the landmark head's eyes; the
  dermis's war paint `mask` on the realistic head), the cowl (the half-cape's hood drawn close, both bodies), the visor
  band and the visor (an `adorn` kit on the cranium), and four helms through the armour's `helm` signature (open, trooper,
  faceplate, band), each dropping the hair. The realistic armour fit leaves every head piece off the relational head, so a
  visor or a helm fits the tiered body only and `fitted(id, body)` says so. Worn by `memberOrders(id, look, { headgear })`.

### The half-cape to the hip, and its hood, are worn

- `hem: 'hip'` was no cloak hem word (`outfit-plan.js` hemAt: thigh, knee, calf, shin, ankle), so a cloak asking for it
  threw inside the piece sorter and was dropped as "not worn" with the throw's message for a word: the street suit's
  hooded half-cape never rendered, and no hood ever showed. `hip` is now a hem word (the cape ends at the structured
  pelvis's top, at the thigh's top on a body without one; `HEM_WORDS` names them), and an unknown word is refused by
  name. A cloak at another hem is byte for byte what it was.

### A leg's cloth stays on its own side

- A limb's cloth field (`body-relational-garment.js` `fieldGarment`) was read by `|x|`, the right limb's field mirrored for
  both sides. With the legs together at rest the thighs' fields meet at the midline, so a ray from an inner slot never left
  its own limb, ran on through the mirrored one and landed on its far side: a spike of trouser cloth up to 9 cm across the
  midline at the inner thigh and the inner shin, which a stand carried out with the leg as a flap bridging the two legs,
  the cape and the background showing through the openings it left. A left segment now reads the field reflected, a right
  one as it is; a point that never crossed the midline is byte for byte what it was. The trousers test holds every leg
  piece to its own side; the byte pins the module reaches hold (no pinned figure had its limbs touching).

### Realistic laws 6: the crotch on every build

- The realistic body finds the crotch no lower than 0.6 W under the hip's joint and draws the pelvis's rings under it
  in to a cone, on EVERY build (`REALISTIC_LAWS_VERSION` 6, stamped on a new hero's `physique`; laws 5 is the
  head's relief in the normal bake). Laws 1 to 5 did so
  only under a physique with a dial set; the athletic base (the build itself, byte for byte, and what a hero gets with
  no physique named) scanned the midline two widths down, found the thighs touching to the knees, and hung the pelvis
  between them, so a skin-fit bottom's seat copied a web of cloth down between the legs with a hole at the crotch and
  the top's hem caught in it. A stored hero keeps its laws and its body.

### The belt's buckle sits on the centre line

- A belt's buckle on a shell or a band (the outfit piece, the word outfits' and the outfit build's belts, the egocube
  plan's) is seated where the belt's outer skin faces the body's front (station-loft-adorn.js `buckle` → `seatOf`),
  not at grid row zero, which turns with the ring's own origin and had left the buckle beside the waist's centre. A
  seat named by row, parameter or `dir` still wins; a mascot's belt and the armour's straps are as they were. The
  buckle sits on the band's own middle station (the lowest row of a pelvis band juts forward at the pubis) and its
  plate stands upright. The outfit's `belt` piece takes `at: 'hip'` (the pelvis, as before) or `at: 'waist'` (the
  torso's narrowest ring between the hips and the shoulders, where a hero's belt over the trunks sits); at the waist
  the band lies on the top's cloth (a stand-off of the cloth's thickness, not the hip belt's two centimetres, which at
  the body's narrowest ring stood the band off it like a hoop) with a belt's proportions.

### Hair frames the face: the grown fall as the mint's default, beside the cheek and never on it

- A new hero's fall (long, wavy, layers, angled, curtains; a ponytail or a braid) hangs by the spine law by default:
  the hero door stamps `hair.spine: 'elastica'` on the landmark head's hair where the recipe is written
  (`withGrownFall`), so the fall is draped off the head's own skin and frames the face; a hero stored without the word
  keeps the bytes it was minted with, and a cap, a bun or `none` is left as given. The anime head's hair is its own.
- The frame principle's other half (hair-spine.js `keepOut`, humanoid-hair.js `fallGuide`): a hairline root that
  faces forward (the temples, the slots beside the face) is combed sideways and back and leans out, so the fall STARTS
  beside the face; and where the head's skin faces forward and has a side to it (a cheek, a temple) a lock is pushed
  sideways and kept the face's gap off, a lock's own radius (10 mm), not the scalp's 3 mm; the lift is capped at three
  times the shortfall and finished over passes, so no chord is pulled back through the head. Held by test on both
  presets: a grown long or wavy fall puts no surface sample within 8 mm of the face forward of the ears, and the
  legacy fall, which has no collider at all, does; a curled fall still never passes into the skull.

### Comic hero pack: the first tesseract, a pack of game cubes

- Planned. A tesseract is a library of cosmos cubes with the look that suits them, shipped as data a creator can
  write: genre cubes `intent.from` reads as it reads the core fixtures, geocube looks on one dial from cel-and-ink to
  the realistic hero, and resonance laws that advise a look from the gameplay. The comic hero pack is the first. Six
  probe cubes dry-run against the registry today: four makeable, two with gaps the core already names
  (`space.topology=open`, `soul.contest=versus`); the comic look itself is the first gap, with no value to probe yet.
- The pack's gaps are priced so the sweep ranks them: `planned` rows on the facets, each in its work package
  (`cosmos/packages.js`). The look: `reality.look=comic-day` and `comic-night` (`comic-look`: a sixth-gen look on the
  geocube's `cel` register with an ink outline and a bold palette). The blows: `power.mechanics=knockback`, `throw`
  and `power.rules=super-jump` (`comic-blows`), `power.mechanics=destructible` (`comic-street`). The dress:
  `soul.equipment=cape` (`cape`, a garment that trails, not a held item). The shot: `time.shots=panel`
  (`comic-panel`, a beat held as a still with a border and a caption). Every one is absent today and says so; a cube
  that names one dry-runs `blocked` naming it. The hillclimb page is regenerated.
- The pack itself, as data (`lib/graph/cosmos/packs/comic-hero/`): six cubes in registry words, each a genre row with
  the words a brief uses and the planned values it `wants` (`cubes.js`); one look dial from the comic page to the
  realistic hero, every stop a geocube the tree reads today (`from` a sixth-gen preset, the `cel`, `ink-wash` or
  `continuous` register over it) with the hero direction that goes with it, its two ends the tree's own `banded` and
  `material` poles (`looks.js`); five resonance laws in the facet law shape, advice from the gameplay to the look and
  never a verdict (`resonance.js`); `packReport` dry-runs the cubes and reads each want's status (an unknown want is
  reported, never thrown) and `qaOrders(look)` sets the table for the eyes gate at one stop: a `create_sketch` of the
  example gameworld with the pack cube as its intent, the look's direction and a downtown painted by the look's
  geocube, and the hero at that pole (`pack.js`). Nothing reads the pack yet: the loader seam is next.
- Every look carries its air: the geocube's `light` (how thick the outside's air is, the sky's fog colour) and the
  city paint's `hour` and `clouds`, which the QA city is lit and hazed by (city/plan/look.js). A fifth look,
  `gritty-night`, at the realistic stop: a storm night under a low key, the light shaped in the vertex
  (`contrast: 'wii'`), the walls dressed from relief at `grit` 0.8 and aged old, the air thick enough to swallow the far
  towers. Gritty is the material pole with the atmosphere as the light, not another stop of the dial.
- The pack's characters: a cast of six asks in the egocube's words (an archetype, a role, a build, an age, a motivation
  and an order, with a brief; the rival the hero's archetype in shadow), five suits as cards built from the hero door's
  own words (a catsuit and gloves, a cloak hung from the shoulders with a chest emblem, a belt, a field-painted star or
  diamond, the armored-hero hardsuit, biker leathers), each with a fragment per pole since the realistic body refuses
  paint and detail, and a compiler (`memberOrders(member, look)`) that rolls the sheet, reads it into a hero plan by the
  egocube's own compiler, replaces the sheet's cut with the suit, puts the realistic body on at the material pole, and
  asks the toon the stop wants: the character light with its ink at the comic stop (the silhouette hull the character
  book never asks for), ink alone at the painted stop, none at the material pole. Every member validates at both poles.
  The vibe rides inside the spec, since `mint_solid` hands its handler the spec alone and drops a key beside it
  without a word (the character book's own hero order puts its toon beside the spec, so a gameworld hero minted
  through `mint_solid` never gets its character light: found, not fixed here). The pack's heroes are never cel shaded:
  the world walks the registers (cel, ink-wash, continuous), the hero is the western tradition at every stop with no
  character light and no ink, the standard tiered body shaded smooth at the comic and painted stops and the realistic
  body at the realistic stop; the suits are cards per body, not per pole.
- Three costume eras as principles (`costumes.js`), each a card over the role suits: the Silver Age (the classic
  hero before the dark knight: primaries, a cape, one big emblem, a belt at the waist, flat colour), the Modern (the
  nineties to now: a dark panelled suit with one accent, a chevron, bracers and kneepads, the cape short or gone) and
  the Movie Hero (tactical armour over an undersuit, muted metals, no cape: the plating library by word on the
  realistic body, the hardsuit at low mass over a tactical outfit on the tiered one). `costumeOf(role, era, body)`
  resolves a costume in the door's own words; every role in every era validates on both bodies. The eras tie to the
  look dial: each stop suggests one (the page the Silver Age, the cover the Modern, the film the Movie Hero) and a
  member's order takes another by name.

### Battle city: sports as a contest over the movement stack

A sports game is two things: what is happening at the ball, and what the game state is. The first is the movement
stack the action games already play (the platform rule, the feel cards, the hero library's clips) with a free body; the
second is rules, deterministic as a board game's. A CONTEST is the rules layer: who may stand where, who has the ball,
the clock and its stoppages, the score, the fouls and the restart each one triggers. The agent composes the contest
recipe; a World page channel draws the kernel's state as the scoreboard, the lit zones and the referee's calls; the
kernel calls every point, never the agent. Two shapes of contest, one kernel: a MEET (lanes, a start, a measure,
attempts: the athletic events) and a MATCH (sides, a ball, possession, zones whose legality depends on the state). The
register ladder from a simulation to an arcade game (a tennis to a cartoon tennis) is the feel card's axis on the body
and a ball card's on the ball. Planned, in order:

- **The registry sees sport**, built: probes for an athletics meet, a net game, a turn sport and a team goal game in
  the cosmos fixtures, and the facet values they ask for (the `meet` and `contest` mechanics as the mechanics table's
  planned values, a `team` party, a `court` level form, a `position` motivation), each absent and priced as one
  package, so the hill-climb page records the gap and the move: every probe reads blocked, naming the values it waits
  on, and the package ranks first of the priced packages by worlds lifted per effort. Each probe is a genre with the
  words a brief uses for it (a sport named is its shape's: "tennis" the net game, "football" the team game, "golf" the
  turn sport, "hurdles" the meet; "race" stays the car's), raises its concerns (a court with its lines mirrored for the
  other side and a broadcast camera; room for a side), and plays in the realistic flavor until the operator's word moves
  it toward the arcade.
- **The contest kernel** (`lib/graph/contest/contest-kernel.js`), built: one self-contained closure (`buildContest`),
  pure and seeded as the board kernel is, a contest as data. A MATCH: a court of named regions (a rectangle or a
  circle in metres, the net at the middle) written for one side and mirrored for the other, half-turn or reflected, or
  shared; a ladder of scoring units, the lowest first (a unit won at `to` ahead by `by` resets and adds one to the next;
  tennis's game is four by two named 0 15 30 40, and the scoreboard says deuce and advantage; a unit with no `to` is the
  clock's); a serve (into a region, or regions cycled by the game's points; so many faults lose the point; a let off the
  cord; the serve changing hands by the game, by points, or on a side-out, each side's servers rotating) or a kickoff;
  the rally's rules (where a bounce is in, how many bounces a side, how many touches, the same player twice); a clock
  of periods with overtime or a draw; fouls that cost a serve fault, the point, a free restart for the other side, or a
  warning; rally or side-out scoring. A MEET: lanes, the set, a gun on the kernel's seeded delay, a false start that
  disqualifies or warns once, a race measured from the gun, or attempts measured in metres with fouls, placings by the
  best. The kernel reads FACTS the movement layer saw (a touch by whom and where, a bounce where, the ball on the cord,
  the ball out, a foul, a goal, the clock's tick, the restart taken; a runner's press, finish or mark) and answers what
  each player may do now (its regions, whether it may touch, whether it serves), the phase, the score, the clock and
  every call (a point and why, a fault, a let, a game, a set, a period, the gun, a false start, the end). A fact the
  rules do not care about changes nothing. It never integrates a body or a ball, and the agent never adjudicates.
  Fixtures in the data alone, one per procedure and not in the book: singles tennis, volleyball, a goal game on a
  clock, a sprint, the long jump. The tests hold the concept on them (the diagonal serve into the box the point names,
  the fault and the double fault, the let, the volleyed serve, reaching over, the ladder to a set and a match, three
  touches and the side-out rotation, kickoff and the free, the periods and the draw and overtime, the gun's clock, a
  disqualification, the best of three attempts), that the same seed and facts are the same contest to the byte, that
  the closure runs from its own source with no imports, and that it never mutates a state. A published game asked for
  by name is written out from the rules the person explains, as the tabletop kernel's rule already says; tiebreaks,
  possession by carry and offside wait on the team game.
- **The ball and the hit**, built, with a recorded stopping point:
  - **Real air on the live ball.** The physics property's integrator (`worlds/physics-sim.js`) gained the `aero` force
    rule: drag with the drag crisis and Magnus lift saturating with the spin ratio, the spin-aware flight model's own
    curves and constants (`physics/flight.js`, the oracle it is held to), the air's density and a spin decay in flight,
    `on` the bodies it acts on. On the model's free-kick launch the live ball lands within half a per cent of the
    oracle's range, apex and curl at the oracle's step, within one at the page's; no crisis flies farther, no spin flies
    straight, no air is the parabola; a body the rule is not on keeps every byte. Every page that embeds the integrator
    re-pins with the rule's source (additions only; a world without an `aero` force runs as before).
  - **The ball card** (`lib/graph/contest/ball-card.js`): the sports' balls (soccer, tennis, volleyball, basketball,
    golf, table tennis: mass, size, the rebound each sport's rule allows as a restitution, the aero curve where one is
    cited, soccer's otherwise and said so), and a card per register, the feel cards' own names: realistic flies the
    sport's ball in real air; action drops the air and grows the rally a share a clean hit to a cap (the cartoon tennis)
    with a livelier bounce; the platformer's ball is slow and floaty under lighter gravity; pinball's never stops
    gaining and bounces lossless. A card makes the sim's body, its force rules and its gravity; the report says what it
    leaves out (a bounce that gives back more than it got is the hit's to add: the table keeps a contact lossless at most).
  - **The hit** (`lib/graph/contest/hit.js`): the join of the swing and the ball. The hit is live through the swing
    system's contact window and lands on its strike phase, on the game type's timeline where one re-times it; a ball
    inside takes a velocity whose direction is the body's facing turned by the stick within the register's spread and
    the verb's arc lifted by the stick, whose speed is the register's base plus its gain on the swing's real tip speed by
    the verb's power (realistic is the tip alone), grown by the ball card's rally, and whose spin is the verb's (topspin
    about up × the heading, backspin the other way, sidespin about the vertical), scaled by the register. The result is
    the sim's own impulse and the contest kernel's `touch` fact.
  - **The forehand, the backhand and the bat** in the swing system (`hero-swing.js`): a level arc on the right side
    taken back and out and carried across the body, the same from the other side, and the two-handed level swing; each
    through every gate the swing system holds on both casts at every class (solvable at mint, the item clear of the head
    and above the floor, the elbow at the shoulder line, the strike on its key). Until a racquet and a bat are gear items
    they swing the hand's gear whatever it is.
  - **Not built, said where it is asked for:** the overhead serve and spike (they lift the elbow over the head, which
    the swing system's law forbids: an overhead clip family is a later step), the volleyball's bare-handed bump and set
    (the swing door needs an item in the hand), the kick (a leg clip from the vault's solve), the throw, the catch and
    the putt. Each is a hit verb already (its arc, spin and power hold) whose window says no clip plays it yet.
- **The meet**, built as a track the World page plays, with a recorded stopping point:
  - **The meet sim** (`lib/graph/contest/meet-sim.js`): an athletic event as a pure function of the lanes' pads at
    60 Hz, in versus's shape, the contest kernel its referee (the set after the marks, the gun on the kernel's seeded
    delay, the race clock from the gun, a press before it a false start on that frame, the finish and the marks its
    facts, its calls the sim's). Each lane is a body on a line whose sprint is the motion flavors' own top speed and
    build-up, register for register (held equal by the test), driven as the register drives it: the realistic register
    holds the run and a press on the footfall's beat lifts the form while one off it drops it (the beat never narrower
    than a frame and a half of stride); the arcade registers mash, the press rate the speed and the full rate the top.
    The hurdles are flights at the 110 m spacing: a hop begun in the approach band clears one and keeps most of the
    speed (the realistic register takes it on the stride itself, the others on the press), a flight met on the ground
    clips the runner into a stumble no pad drives. The long jump takes off on the press in the runway's last metres,
    flies the arc of its speed and the register's angle on the register's gravity, is marked from the board, a
    take-off past the board or a run through it a foul, the runner back for the next attempt until the kernel says
    they are spent. A lane with no pad is run by a seeded computer that never jumps the gun. The same context and
    pads are the same meet to the byte.
  - **The meet arena** (`meet-arena.js`): the venue as a stage recipe, the versus arena's sibling: one long open room
    on a stage kit, the lanes along it, the stands behind them, a broadcast camera, and the `meet` key (the event, the
    lanes, the players, the register, the distance, the attempts, the seed, the kit, the crowd), checked and
    teaching; the track in the stage's frame (each lane's line, the start, the finish, the flights, the board); the
    page's data with the contest compiled and the level wire's names.
  - **The meet on the World page** (`scene/channels/contest.js`, `meet-arena.client.js`): a channel on a world's
    `meet` key that inlines the kernel, the sim and its client by source and owns the camera; up to four players on one
    keyboard or the gamepads by index, the other lanes the computer's; the runners stick figures posed from the sim's
    stride, the air and the stumble (a first drawing); the lane lines, the flights and the board on the floor; a
    broadcast side camera that follows the field; the banners (ON YOUR MARKS, SET, GO, a false start), each lane's
    clock or best, the placings; the hosted wire (READY, the meet INIT brings, the OUTCOME when the placings are in:
    success when a player's lane placed first, or an exhibition). The page's probe runs an exhibition to the placings
    the same meet reaches in Node, frame for frame (the e2e suite, in a real browser). The `meet` fixture joins the
    emission matrix; a page without the key emits no block.
  - **Not built, said:** the quick game's `meet` goal (the arena plays on its own and hosted; the game shell's level
    is the next step), the hero library's clips on the runners (the stick figure stands in), the throws (a javelin or
    a shot is not a sphere, and the flight model is sphere-only by design).
- **The net game**, built as a court the World page plays, with a stopping point: `lib/graph/contest/sports.js` (the
  book of sports: tennis's spec for the kernel beside its dials, the ball, the strokes, the net, where the server and
  the receiver stand; a sport asked for by a name the book lacks is refused by name); `contest/match-sim.js` (the match
  as a pure function of two pads at 60 Hz: the body held to the motion flavors' sprint and build-up register for
  register, the ball the physics property's sphere on its card, the serve from the hand into the box the point names,
  the swing's strike window from the swing system, the floor and the cord as the kernel's bounce, net and out facts,
  the point, game and set the kernel's; in the arcade registers the aimed shot, the arc that lands at the depth the
  stick asks, lifted over the cord, the speed given up for it; the realistic register is never aimed);
  `contest/contest-mind.js` (the court mind at the mind's four tiers: it reads the ball's way on the ball's own
  physics, runs to where it crosses its depth after its reaction, swings in reach at the depth its stick says, serves
  across into the box after its wait; plain, seeded, bounded); `contest/match-arena.js` (the venue a stage recipe with
  the stands behind the far baseline and a broadcast camera, `matchArenaData` the page's data, `graphSource` a module
  inlined by source), `match-arena.client.js` and the `court` channel (`scene/channels/contest.js`: WASD and F or
  Space, the arrows and the right Shift or the keypad 0; the court's lines from the kernel's regions, the net, the
  players, the ball and its shadow, the scoreboard in the kernel's words, the hosted wire), hooked up as the meet is
  (world-scene, channels/index, scene-three, the `court` emit fixture pinned, the engines' marks, test-changed's
  readers), the e2e `court-page.live.test.js` (the page's exhibition equals Node's frame for frame). What building it
  corrected: the kernel's double-bounce rule (a ball bounced in and never returned is the striker's point, in the bounce
  and the out branches; before, the out went to the side that failed to return it), the hit's azimuth (the stick right
  aims right), the aimed elevation's cord check (a cord past the landing is no cord), the racquet on the player's
  right. Stopping point: the quick goal `contest` (the shell's level, as `meet`'s), the hero library's clips on the
  players (stick figures stand in), racquet gear items, the realistic register's depth (a flat forehand at the
  realistic speed carries past a close target, so the mind's lift sits on the cord's floor; depth there is spin and
  pace, which the mind does not yet modulate), volleyball and pong on the same sim, no bus emit; no split screen. The
  eyes gate is open: nobody has watched a rally yet.
- **Turn sports and the positional mind**, built as a course the World page plays, with a stopping point: the kernel's
  third shape, `turns` (seats played hot-seat in order, rounds each seat plays in turn, one shot at a time and the
  ball's rest the shot's end; `strokes`: the tee, the lie, a rest in the water or out of bounds a stroke from the last
  lie, the cup the round's end, the pick-up, the fewest strokes; `pins`: tenpin's frames, strikes and spares, the tenth
  frame's fill, its card with running totals; `lieOf` the region a point lies in; the kernel still calls every
  round); golf and bowling in the book (`sports.js`: three stadium holes as courses of regions with par and the ground's
  rolling resistance by the lie, the clubs by the lie and the distance left; the lane, the gutters, the pit, the ten
  pins on their spots, the hook), the drive, the iron and the roll as hit verbs, the bowling ball on the ball card;
  `contest/turn-sim.js` (the match sim's shape for one pad: the stick turns the aim about the line to the target across
  the sport's spread, a press runs the meter up and back (the action lab's hold-and-release) and its release strikes at
  the meter's share of the club's tip speed; the ball on the physics property's integrator in its register's air over
  the course's ground (the lie's resistance, the cup that takes a slow ball, the water and the out where it went in, the
  gutter to the pit, the pins as spheres that fall when moved from their spots, racked again as the kernel says);
  `probeShot`, a shot tried on a copy); the turn mind in `contest-mind.js` (it plans on the sim's own probe, never a
  guess: the meter bisected until the shot rests at the distance left, the aim bisected until the roll crosses the pin
  line at the pocket, the level's wobble on each); the positional mind there too (`fieldTarget`: a role presses the ball
  near it, stands goal-side of its mark, else holds its home region, always inside the kernel's legal shapes: the seed
  of the team game's teammates); `contest/turn-arena.js` and `turn-arena.client.js` with the `turns` channel (the
  arrows or WASD aim, Space or F charges, Enter again; the course from the kernel's regions, the flag, the pins, the
  aim line, the meter, the card, the camera behind the ball following the shot, the hosted wire), hooked up as the
  court is, the `turns` emit fixture pinned (`meet` and `court` re-pinned for the kernel's, the minds' and the hit's
  source), the e2e `turns-page.live.test.js`. Stopping point: the quick goal `turns` (the shell's level, as `meet`'s
  and `contest`'s), the hero library's clips on the golfer and the bowler (nobody is drawn yet: the ball, the aim and
  the card are the play), the golf ball's own aero constants (it flies on soccer's curves and the card says so), a pin
  that topples (a sphere sweeps instead), the oil pattern (the lane's friction is one number), curling and billiards on
  the same shape, no bus emit. The eyes gate is open: nobody has watched a hole or a frame yet.
- **The team goal game**, built as a pitch the World page plays, with a stopping point: the kernel's goal game
  gained its outs (`outs`: a throw-in for the other side where the ball crossed the touchline; over an end line a
  corner when the defenders touched it last, else a goal kick; without them a free) and offside against the ball
  (`offside: 'ball'`: a pass received by a teammate who stood past the ball's line in the other half when it was
  played, a `touch` fact carrying where the toucher stood at its side's last touch, is a free where it was received);
  soccer (five-a-side, two halves, throw-ins and corners, offside) and hockey (four-a-side on a rink with boards,
  three periods and overtime, no outs; the blue-line offside is not the ball rule and is left out, said so) in the
  book with the puck on the ball card; `contest/team-sim.js` (the match sim's shape for two pads in the screen's
  directions: each pad drives its side's player nearest the ball, a tap passes along the ground, a hold shoots, aimed
  by the stick; a player running at a slow ball carries it; the others hold their role's home and the nearest presses,
  the keeper across its line with a save on a ball coming at it; a goal between the posts under the bar the kernel's
  score, the ball over a line its out, a charge from behind into the carrier a foul, the clock ticking while live; a
  restart placed where the kernel says and taken by the first touch, or by the sim after three seconds); the team mind
  in `contest-mind.js` (the computer side's player at the ball chases, shoots in range, passes to the teammate
  furthest ahead, else carries on) over the positional mind's roles; `contest/team-arena.js`, `team-arena.client.js`
  and the `pitch` channel (WASD and F or Space, the arrows and the right Shift or the keypad 0; the lines, the boxes,
  the goals with nets or the rink's boards, the players as capsules in their side's colour with the one at the pad
  ringed, the scoreboard and the clock, the referee's banners, the hosted wire), hooked up as the court is, the
  `pitch` emit fixture pinned (`meet`, `court` and `turns` re-pinned for the kernel's, the minds' and the hit's
  source), the e2e `pitch-page.live.test.js`. Stopping point: the second local pilot in the controllable runtime (the
  plan's route to the hero body on the pitch) is not taken: the team game plays on the contest pages' own bodies, as
  the court and the course do, so no hero library clip kicks yet and the controllable pins stand untouched; the quick
  goal (phase 7); a tackle (the only challenge is the press and the keeper's save); the second-last-defender offside
  (the ball rule stands in); a wall at a free kick; restarts that walk the players home; the kick's curl one number.
  The rink's end boards stand either side of the goal and over it, its mouth left open, so a puck is scored between
  the posts and never by passing through a board.
  The eyes gate is open: nobody has watched a match yet.
- **The door and the distilled rulebook**, built: no new listed tool. Two quick goals (`design_game({ quick })`):
  `meet` (the event, the lanes, the players, the register, the distance, the attempts) and `contest` (the sport, the
  players or the seats, the register, the computer's level, the sets, the rounds, the periods and seconds), each read
  by its arena with its own refusals; a sport's quick game is one level, the arena as a stage carrying the play and a
  hosted level's contract (the page posts READY, takes INIT, posts the OUTCOME), and the game that plays it in the
  shell, with no hero, trail or camera of its own (`gameworld/quick.js` readSport and sportArenas, `runner.js`). The
  genres: a meet the athletics meet's, a contest its sport's shape (`intent.js` contestGenre), so the registry's
  probes read makeable and the four sport values (`power.mechanics` meet and contest, `space.levelForm` court,
  `mind.motivation` position, `soul.party` team) read built, each lowering to its module; the hillclimb page
  regenerated. The game vocab's quick cards for both goals; routing rows for a race, a tennis game, mini golf and
  five-a-side, the `game-design` card naming the sport goals. A contest's `seconds` are its periods', read with its
  sport (the survive goal's 5 to 600 is not theirs). **A sport written out** (`sports.js` resolveSport): the
  contest goal's `sport` may be the book's name or an object `{ id, shape: match | turns | team, words, spec, omits?,
  …the shape's dials }`, the spec the contest kernel's own data (its read the gate), the dials the shape's sim reads
  (their presence checked, their values the sim's to refuse), `omits` the rulebook's sentences the primitives do not
  carry, by name; the three arenas resolve either, so a distilled rulebook plays on the court, the course or the pitch
  with no code change (pickleball and mini golf in the test). **The `distilled-rulebook` catalyst**
  (`lib/mcp/catalysts/distilled-rulebook.md`): the transcriber, not the referee: find the rules (the operator's
  words, a document, a search MCP), name the shape or say it is not one the sims play, distil the kernel's data field
  by field with the source's sentence beside each, distil the dials from the book's nearest sport, write `omits`,
  mint and read the kernel's calls off an exhibition; register is simplification by name, never a second kernel;
  the kernel's read is the gate and the agent never adjudicates. Stopping points: the engines' kernels carry no
  contest (every sport value is `absent` on Godot and Roblox, the page's own simulation); the shapes the sims lack
  (a hoop, a wicket, a wall game) are refused by name, not approximated.
- **The athletes: a sport played by characters**, built: the stick figures and capsules give way to characters made
  with create_character, each slot (a lane, a side's player, a seat) in its own body on the arena's page.
  - **The arenas carry their athletes** (`contest/athletes.js`): `athletes` on a `meet`, `court`, `turns` or `pitch` key is a
    character's ref per slot in the sim's order (null a slot's stick figure), cycled when shorter. The arena stores the
    refs, never the bodies: the World page packs each character's rig bones and rigid parts where it is served
    (`world-scene.js`, versus's `characterBody`), so a sport follows its characters' edits as a versus roster does. A
    ref the store has lost, or a rig the figure cannot stand up, is the stick figure; absent, nothing is added anywhere.
  - **The pose** (`contest/athlete-pose.js`, pure): the sports already pose a stick (the meet's stride, the court's
    swing); a character takes the stick's directions on its own lengths (the trunk turned rigidly onto the stick's,
    each limb laid along its stick bone, each foot turned with its shin), stands on its lowest sole and rises by the
    stick's air, and each bone rides its segment through versus's figure (`figureSegments`), so the chain closes
    everywhere. `strideStick` runs a body the sim keeps as a point and a velocity (the pitch's players, the stride on
    the ground they cover) and `swingStick` addresses a ball (golf's hands on the club, bowling's arm). The tests hold
    the concept on a small rig: lengths kept, directions followed, the sole on the ground, the right side on the right,
    the chain closed.
  - **On the page** (`contest/athlete.client.js`): one geometry per character shared by its slots, relit by the stage's
    key and inked as the versus arena draws a fighter. The meet's runners, the court's players (the racquet in the
    athlete's own hand), the pitch's players (the one at the pad still ringed) and the seat to play on the course (it
    stands to the ball, takes the club or the arm back with the meter, holds its finish while the ball runs; nobody was
    drawn there before). The channel inlines the figure only when the arena carries bodies, so a sport without athletes
    emits what it did; each probe counts its athletes, and `athletes-page.live.test.js` plays all four in a real browser.
    Corrected on the way: the meet's title read `[object Object]` when the track had none.
  - **The quick goals roll them** (`quick.athletes` on `meet` and `contest`, `runner.js`): absent, the athletes are
    rolled in the game's setting (`cast-setting.js`: the kit's tradition draws them anime or western, its era, the
    `meet` and `contest` genres leaning to athletic builds in their prime), a person a slot up to four and cycled; a
    team's sides each a rank of up to three faces in one uniform, the shirt the side's colour. They wear the sport's
    kit whatever the world's wardrobe (a new `athlete` quick figure): on the authored body the paint words on the bare
    body (a vest or a shirt, shorts, socks, white shoes), on the realistic body the `athlete` outfit card. Given, a list of
    `{ ref }` (a character the operator made, adopted as it stands) or hero-door specs (made by the run), cycled over the
    slots; `false` keeps the stick figures. The run's readout says what the setting rolled. Each athlete is a hero step
    (`athlete`, `athlete-2` …) that design_game makes and remakes as it does a guard.
  - **Not built, said:** the hero library's clips (the bodies are posed from the arena's own procedural stick, not the
    character's walk, sprint or swing clips), a kick, a header or a tackle on the pitch (the stride carries the ball),
    a racquet or a club as gear, the realistic body's outfit on the page's rigid parts (the card is chosen, not looked
    at). The eyes gate is open: the frames looked at were machine screenshots of exhibitions, not play.
- **Sport kits: the character designer's shortcut**, built: `kit` on the hero door (create_character, update_character,
  any hero-door spec), a sport's kit in a few words, lowered on every read into the dress the body already has
  (`lib/graph/sportswear/kits.js`, a card per sport and a row per pattern, no geometry anywhere).
  - **The words:** `kit: 'soccer'`, or `{ sport?, colours?: [main, second?, trim?], pattern?, trim?, socks? }`. The
    cards: soccer, keeper (long sleeves and gloves), hockey (long sleeves, pants to the knee, gloves), tennis (whites),
    track (a singlet), basketball (a vest and long shorts), volleyball, golf (a polo and trousers), bowling (a yoke).
    The patterns over the shirt in the second colour: plain, hoops, stripes, band, sleeves, yoke, sides. The trims in
    the third: collar, cuffs, hem, a stripe down the shorts. Socks to the knee, at the ankle, or none.
  - **How it lowers:** on the authored body, the bare body (`detail: 'swimsuit'`) with the card's paint words (a tee,
    a tank or long sleeves; bike shorts carried down the leg; the shoes with their collar cut low; gloves) and paint
    entries on the parts every core has, each pattern band painting only where the shirt is (`only: ['Top']`), so a
    scoop's skin and a sleeve's end hold. On the realistic body, the athlete's outfit card in the kit's colours. The
    kit's colours sit beneath the operator's palette and the operator's paint comes after the kit's; the record keeps
    the words alone (`kittedHero` in `layered.js`, applied where the plan is made and the body expanded), so patching
    `/hero/kit` re-dresses a character in place. A hero without a kit is unchanged to the byte.
  - **The athletes wear them:** a rolled athlete is dressed in its sport's kit (a meet's the track's, a book sport's
    its own, one written out its shape's), the roll's own shirt colour its kit's main, so a field of runners is a field
    of colours; tennis keeps its whites and takes the player's colour as the trim. A team's sides each wear one kit in
    the side's colours, and a keeper (the role named so) a kit of its own: the soccer keeper's, or the sport's in a
    keeper's colour. `quick.kits` (a kit's words each, cycled over the sides or the athletes) chooses the colours and
    the patterns; the quick cards name it.
  - **Held:** the words read and refused by name; the card's defaults; the lowering by role; the operator's own words
    over the kit's; one pattern per procedure painted on the anime body and the streamlined core; the rolled athletes'
    kits, the keepers, the whites, the kits' words. Looked at in machine screenshots (eight kits on two heads, a derby
    in hoops against stripes, a court in whites); the eyes gate is open.
  - **Not built, said:** numbers and names on the back (a decal, not a band), halves and sashes (the paint's window is
    up the trunk and around it, symmetric), a pattern on the realistic body's garments (the outfit card takes the colours
    only), helmets and pads.
- **The holo lift: a board game in a hologram arena**, built for the games of moves, with a stopping point. Battle
  city run back to the tabletop: Duelist Kingdom's way of showing a simple game, the duelists on podiums at either
  end and the board projected between them, every piece a hologram and every event of the game staged. The lift is
  optional and depiction only: the tabletop kernel stays the referee, and the same game still plays as its own page.
  - **The arena** (`tabletop/holo-arena.js`): `readHolo` (the tabletop manifest's game, a book game or one written
    out, the seat player 1 holds, players 0 an exhibition, 1 against the computer or 2 hot-seat, the computer's
    level, the seed, the stage kit), `holoBoard` (the lattice at a cell sized to the arena, floating over the floor,
    a podium behind each side), `holoManifest` (the venue as a stage recipe carrying the `holo` key, a camera behind
    player 1's podium) and `holoArenaData` (the game dealt, each kind's body resolved from the meeple shelf, its value,
    the duelists and their lights, the level wire). A euro, tile, card or round game is refused by name: it plays on
    its own page.
  - **The page** (`holo-arena.client.js`, `scene/channels/holo.js`): one block inlining the kernel and the mind from
    their closures and the client. A projector disc with lit rings and beams, the board as panes of light with lit
    edges and a scan sweeping across, each duelist's podium in its colour (the side to move brighter). Each piece is a
    hologram of its body (a cut-out, a turned profile, a box, a group as real geometry): a translucent body lit at its
    rim with scan lines, its edges in light, a glow under it. What the kernel says is staged as BEATS, played one after
    another while the state is already ahead: the opening summon (the army out of beams of light, about two seconds), an
    attack (the attacker turns and a beam crosses to its victim), a destroy (the victim shatters into light), a move
    (a glide, a leap higher, a castling partner beside it), a promotion (a pillar of light, the piece remade), a flip
    (a convert), CHECK and the end on the banners. LIFE POINTS on the overlay fall with the destroy beat by the piece's
    share of the army; mate takes the loser's to zero. The camera stands behind the person's podium, swings to whoever
    is to move in hot-seat, sways in an exhibition and leans toward each beat. Click a piece, then a lit cell (a
    capture red); a promotion or a drop with a choice asks which. The hosted wire as the sports' (READY, INIT,
    OUTCOME). The probe (`__mojHolo`) runs plies at once, names the beat on stage and the beats seen, and clicks a
    cell as the pointer would.
  - **The door** (`design_game({ quick: { goal: 'tabletop', game, players?, level?, human?, lift: 'holo' } })`): one
    level, the arena in the play shell, its quick card, a line on the tabletop card, the registry's lattice note; the
    `game-design` routing card names it, with its routing-eval row.
  - **Held:** the minds' duel in the page is Node's move for move (checkers and chess, `holo-page.live.test.js`); a
    capture stages attack, destroy, move in that order; a person's seat waits for them and two clicks play a move; a
    page without the key emits no block (the `holo` emit fixture pinned, every other page byte-identical).
  - **Not built, said:** the euro, tile, card and round families (the dice as a shaker reveal and the card duel with
    summons, spells and responses, the tabletop kernel's own Duel Monsters shape, are the next lifts), characters as
    pieces (the athletes' bodies on the board), sound. The eyes gate is open: the frames looked at were machine
    screenshots of exhibitions and one scripted move, not play.
- **The stadium: the Mojulo Olympics' venues**, built, with a stopping point. A sport is played inside a place, never
  against a flat dark colour, and tennis is no longer held to the town square unless the game asks for it. A venue is
  composed from the building designer's parts and recomposed by its words: a patron of sport and the arts builds them
  in every degree of realism.
  - **The bowl** (`stadium/bowl.js`): the seating as one round form, all polygons. A ring that follows a superellipse
    (an ellipse up to a rounded box), sized so the field's corners sit on it; a pitch wall of boards, raked tiers
    two rows to a step with aisles, a concourse with a band of glass boxes, an upper tier, a parapet; the outer wall
    in a facade card (glass, brick, metal) between pilasters, or an amphitheatre's storeys of arches with cornices;
    a roof (a canopy with its truss and rafters, the canopy hung from a ring of masts by stays, or a dome of ribs to
    an open eye); open sides left out and their ends capped; screens on the rim; a landmark (the cauldron on its
    pylon, an arch sprung over the far stand); the infield in the field's surface, the apron (a running track's
    lanes), the plaza outside. A full house is a MOSAIC of colours on the treads, never figures: the crowd costs
    nothing past the steps it sits on. Every face is wound to the side it is seen from, so the hour's relight reads it.
  - **The venue** (`stadium/stadium.js`, the `stadium` kind and a `compose_world` base): the field, the bowl in a
    livery (its colour set, any colour over it), floodlight masts (the track's set piece), a skyline of the fractal
    structures' lean towers past the rim, hazed into the sky, on ground that reaches past them, and the race's hours
    (day, golden, dusk, night; after dark the masts and the cauldron light the field). Presets: `olympic`,
    `centre-court`, `football`, `colosseum`, `patron-dome`, `arcade`, `anime`, `municipal`, each named for the games it
    suits; any word over one moves that part alone. The look is the degree of realism: shaded, anime (banded) or
    voxel. The manual is the `stadium` view-vocab card; the `world` routing card names it, with its routing-eval row.
  - **A game's venue** (`stadium/venue.js`): the court, the pitch, the meet, the course and the holo arena each take
    `venue`, a preset or a stadium's words. The arena's room becomes the field, its camera and its channel stay its own,
    and the bowl's camera side stands back until the camera is inside the pitch wall. Without the word an arena mints
    its stage recipe as before. The quick goals take `venue` and default a meet to `olympic`, a net game to
    `centre-court` and a team game to `football`; a course and a board game keep their stage, and `venue: false` keeps
    any stage.
  - **Held:** the same words are the same stadium; refusals teach; the ring passes through the field's corners at any
    shape; an open side leaves nothing standing there; the skyline stands on the ground; each arena stands in a venue
    by its word with its camera and channel, and without it stays a stage.
  - **Not built, said:** a roof over a field that closes, banners and sponsors' boards, crowd motion (a wave, the
    mosaic flickering), an athletics stadium's field events laid in the infield, sound. The eyes gate is open: the
    frames looked at were machine screenshots of each preset from inside and outside, and of a court, a pitch, a
    rink, a meet and a holo duel in their venues.
- **Chibi and mascot athletes**, built: a sport's players may be super-deformed chibis or cartoon mascots, each
  dressed in the sport's kit as far as its shape allows.
  - **A mascot's kit** (`sportswear/mascot-kit.js`): the hero door's kit words lowered onto a mascot's own parts as
    paint, as the hero's are on the bare body (the shirt the trunk's upper part and the upper arms, the shorts its lower
    part and the thighs, the socks the shins, the gloves the hands, the patterns and the trims). An orb wears a band low
    round its middle, clear of its face, and its shorts on its legs. A new kit replaces the old; none takes it off, the
    colours it covered restored. `create_character { as: 'mascot', spec: { kit } }`.
  - **The quick sports** take `athletes: 'chibi'` (each rolled person on the hero door's chibi build under an anime
    head grown to 1.6) or `athletes: 'mascot'` (each a mascot rolled in the game's setting, a side's in the side's kit, a
    keeper in its own), and a list mixes `{ mascot, kit? }` with people and refs.
  - **At a player's stature** (`contest/athletes.js` `atStature`): an athlete shorter than a grown player is drawn at
    1.5 m, scaled whole about its feet (its proportions its own), and a round one only as wide as a broad player, so a
    racquet meets the ball the sim swings at and an orb keeps to its lane. A grown body is drawn as it is.
  - **Held:** a kit names only the parts the mascot has and its plan still expands; re-kitting equals kitting the bare
    mascot and taking the kit off gives the mascot back; a small body grows to the stature, a round one to the width,
    a grown one is untouched; the quick words roll and refuse as said.
  - **Not built, said:** a mascot's own sport clips (it plays on the sim's stick, its own idle aside), numbers on a
    mascot's back, a chibi's own swing timing. The eyes gate is open: the frames looked at were machine screenshots of
    kitted mascots and chibis standing, and of a court, a pitch, a rink and a meet played by them.

### TV animator: the broadcast package over the contest pages

The battle city pages each drew their own overlay: flat black boxes and outlined words. They are now covered as
television covers a sport, by one sport-blind package (`lib/graph/broadcast/`, [docs/broadcast.md](../docs/broadcast.md))
that every contest page draws through. The arena hands it a feed (what the scoreboard says) and the kernel's calls
(what the referee said). Built:

- **The package** (`broadcast-package.js`): four looks as cards (`network`, `stadium`, `arcade` and `clean`). Each sets
  type, glass, rim and accent metals, an easing curve, durations, slant, corner, ink and letterbox. The register picks
  one when the recipe does not (realistic → network, action → stadium, platformer and pinball → arcade).
  - Colour theory on `dmath`: the kits are kept apart in OKLab, and again under deutan and protan simulation; a
    clash wears its alternate.
  - The ink on a colour is chosen by WCAG contrast; every default kit reads at 4.5:1 or more.
  - Each kit is an OKLCH ramp clamped into gamut, and a kit lost in the glass is keylined.
  - Lanes and seats default to the Okabe–Ito set.
  - The metals are a bevel reflecting a studio sweep, weighted by the metal's measured reflectance
    (`materials/metal-surface.js`); cel packages band them hard.
  - A cue for every call the contest kernel makes, or a silence by name; the referee's reasons in broadcast words.
- **The client** (`broadcast.client.js`, inlined before each arena client):
  - The open, then the bug. Its rows roll a changed value and flash the row's colour; the hot column sits on the
    accent metal; the clock and period, and the tab, sit beside and beneath it.
  - The call plate. One holds the frame by weight: a weightier call takes it, an equal one once read, a lighter one
    waits, and nothing goes up over the open. A plate drops below the bug rather than cross it.
  - The lower third, the meter, and the results board with gold, silver and bronze medals (the bug steps aside for it).
  - The director's closeup, laid over the arena's own shot and given back, letterboxed, with a slow push and a held
    camera's drift. The graphics run on their own frame count and never touch the game.
- **The four pages draw through it.** The players' kits are the broadcast's colours. The closeups:
  - the court: on the point's winner in the dead ball, with a lower third at a game and the match;
  - the meet: on the winner or a jump's landing once no player's lane still runs;
  - the course: on the cup when the ball is holed; a strike or a spare names the bowler without a cut (the deck after
    a roll is an empty pit);
  - the pitch: on whoever touched the ball last before a goal, from a high angle over the players between; an own goal
    is named so.
- **The `broadcast` key** on the four arenas (`readBroadcast`: a package's name, or `{ package?, sides?, names?,
  closeups?, accent? }`), carried into each page's data, and a lever on the `meet` and `contest` quick goals and their
  cards. A sport written out with the distilled-rulebook catalyst is broadcast with no code; the catalyst says so.
- **The board games** (`broadcast-dom.js`: the same package as CSS on the tabletop pages):
  - Seat plates replace the status line and clocks. Each shows the kit's chip, the name, the pieces taken, the score on
    the inlay (points, or material by the pieces' values in a game of moves) and the clock. The seat to play is lit,
    and a score that rose pops.
  - Calls hang under the plates over the board's top edge: check, promotion, a multiple capture, the dice, a new
    round, the end.
  - A results board with medals follows the end ("See the board", "Play again"), and the last move's cell flashes.
  - The board games default to a new `table` package, akin to the game rather than to television: plates of the page's
    own materials (the board's wood, the card table's felt), scores on the light inlay, brass fittings, a book face in
    mixed case, the board's red and green for its tones, quiet fades, no sheen and no cuts.
  - `tabletop.broadcast` names a TV look instead, and the pieces take the kits' colours so chip and piece agree.
- **Guards:** a kernel call kind with no cue fails `broadcast-package.test.js`. A `*-arena.client.js` that does not
  inline and draw through the client fails `broadcast.client.test.js`.
- The `meet`, `court`, `turns` and `pitch` emit fixtures re-pin for the inlined client and the page's `broadcast` data;
  every other page is byte-identical. The contest pages' live probes still equal Node's frame for frame.
- Stopping point: no replay (a replay wants a buffer of the sim's frames), no sound, no web font (the type is the
  system's condensed face, falling back per package). The eyes gate is open: screenshots were taken while building
  (the open, the bug, the calls, the closeups, the boards, in each package), and nobody has watched a broadcast yet.

### Sports, native: each sport's stats and presets

- **The stats solver** (`contest/contest-stats.js`), built: a sport's stats folded from the log its sim already keeps
  (the kernel's calls and the sim's events, frame-stamped), the kernel the referee and nothing judged anew. A net game:
  points won, aces, double faults, 1st serve in, winners, errors, longest rally, fastest serve. A goal game: goals,
  shots, on target, possession, passes, corners, fouls, offsides, saves (a shot is a kick the team sim now marks
  `goalward`: struck at the goal from the attacking half; the sim's physics untouched). Golf: to par, putts, fairways,
  greens in regulation, penalties. Bowling: pinfall, strikes, spares, open frames, ball speed. A meet: time, place,
  hurdles hit, a jump's best, fouls and run-up. Inlined into each contest page and run in Node alike.
  A net game's serve is read from the stroke that struck it, the hit just before the serve's call, so a drop serve's
  speed counts and the rally the serve opens counts it as its first hit.
- **The broadcast shows them** (`broadcast/`): the stats panel (`tvPanel`, head to head, the lead lit in its side's
  colour) at the sport's breaks (a tennis changeover, half time, after every hole and every third frame), the stats on
  the lower thirds that speak to them and beside each place on the results board; each contest's coverage
  (`STAT_COVERAGE`), and `broadcast.stats` on the recipe (`false`, or the rows and the break). A hosted level's OUTCOME
  carries `stats.contest`.
  - **Held:** each fold on a written-out call log (what each stat counts); a real game's goals equal the kernel's
    score and every goal and save is a shot on target; the panel draws and goes, and never over the board; every
    contest page folds and shows them; the emit pins of the four contest pages re-pinned, every other page identical.
  - **Seen, said:** the tennis minds rarely return a serve (about seven points in ten end with the receiver never
    touching the ball, in both the realistic and the action registers): the stats show it, the sims are not retuned here.
- **The court's surface** (`contest/match-arena.js` `COURT_SURFACES`), built: `surface: clay | hard | grass` on a court,
  how the floor meets the ball (the physics' contact takes the lower restitution and the root of the frictions). Grass
  keeps the ball low and lets it skid, a hard court plays true, clay grips and keeps the ball's own bounce, which is how
  every court has played until now: a court without the word replays to the byte. A court in its stadium stands on its
  surface, the clay a terracotta.
- **The sports' own presets** (`contest/sport-presets.js`), built: each book sport's native presentations, a starting
  set of its arena's words (the venue, the surface, the broadcast and the stats it leans on, the register, the rules'
  length) laid under the words given. Tennis: grass, clay, hard, indoor, arcade. Soccer: league, derby, final,
  five-a-side. Hockey: arena, pond. Golf: tour, arcade. Bowling: league-night, tv-final. The meet: olympic-final,
  indoor, school-sports. Quick `preset` on the contest and meet goals, and `surface` on a net game.
  - **Held:** a court without a surface plays as before and clay is that court; grass is lower and slicker than hard;
    a preset lands on its arena and any word given wins over it; the refusals teach; every preset of every sport reads
    and mints its level (`sport-presets.deep.test.js`).
  - **Seen, said:** the surfaces move the exhibitions' points, aces and winners a little; the rallies stay short on
    every surface while the minds rarely return a serve.

### Arcade rules: the ball games distilled to modules

The ball games at the level an arcade plays them, each a CARD of modules (its court, its score, its serve, its rally,
its ball, its body) that its family composes into a sport the book resolves by name and the shape's sim plays. A
variant is a word over a card (`{ id, from: <card>, …a module's words }`), so "ping pong to twenty-one" is not a
rulebook; a rulebook the modules cannot say stays the distilled-rulebook catalyst's, written out whole. Every card
names what the full rules say that the arcade leaves out (`omits`). Built, by family: the net games, then
volleyball's sides of more than one, basketball's hoop, the carry games (rugby, American football), the innings
games (baseball, cricket).

- **The kit and the net family** (`contest/arcade-rules.js`), built: the net family's modules and three cards on the
  court sim. Table tennis: the table a raised bed, the serve bounced on its own half first, to eleven by two, two serves
  each. Pickleball: the underhand serve into the diagonal box past the kitchen, the two-bounce rule, a volley from the
  kitchen the point, to eleven by two, the rally's winner serving. Badminton: the shuttle, which never bounces, the low
  serve, to twenty-one by two. The arcade rules' card, `get_game_vocab({ id: 'contest-arcade' })`, names the modules
  and every card; the contest card names the sports from the book's lists and points at it.
  - **The kernel's words** (`contest-kernel.js`): `serve.bounce: 'own'` (the serve's own bounce first), `serve.by:
    'score'` (the box by the server's own score, even then odd), `rally.mustBounce` (the first returns off the bounce),
    and a point where no bounce is let is called `down` (the broadcast's IN), not `double-bounce`; each absent on the
    book's sports, which read as before.
  - **The court sim's dials** (`match-sim.js`), each absent on tennis: a raised bed (the court a slab at its height, the
    room's floor below it, the players kept to its ends, no stroke from under it), the body scaled to the game's size, a
    no-volley region (a volley struck from it is the foul of its name), and an arcade serve that must bounce at home
    first, aimed by flying it on a copy of the sim's own physics (the realistic mind finds its lift the same way). A
    card's `cpu.slip` is the computer's unforced error, so a small court's rally ends.
  - **The ball card** (`ball-card.js`): the pickleball and the shuttle, whose air is its own on every register (its
    drag, a terminal speed near 6.3 m/s); the arcade aims a ball with its own air through that air (`hit.js`,
    the midpoint rule over the flight), and the hit's verbs gain the underhand serve, the clear and table tennis's
    drop serve.
  - **The page** (`match-arena.client.js`): the table drawn with its lines and net on top, the camera nearer and
    lower for a small court, the scoreboard's columns and straps from the ladder (SETS GAMES PTS for tennis, GAMES PTS
    for a rally game), the paddle as short as the reach, the ball in its colour.
  - **Held:** the new words on a small court each (the own bounce and its fault, the box by the score, the two-bounce
    rule); a card composes to a sport the kernel reads, a variant moves one word, the refusals teach; every card, in
    a short variant, plays an exhibition to its end (the deep sweep); the bed's slab and net, every stroke over the
    bed and every arcade serve home first; the realistic table serve lands; the kitchen's foul and its absence off the
    bounce; the slip ends a table's rally that otherwise never does; the shuttle's aim lands where it aims in its air;
    each new court plays in the page to the state the same match reaches in Node.
  - **Seen, said:** the minds rarely play the kitchen (they stay back), so its foul comes from a player at the pad;
    the receiver's returns on the court sim remain the weak point the tennis stats showed.
  - **Refused:** a card's `noVolley` names a region its court lays, and its foul there is `'point'` (a free ball or a
    warning would leave the rally dead and the match frozen).
- **Volleyball on the court** (`arcade-rules.js` `volleyball`, `match-sim.js`), built: beach volleyball, two a side,
  three touches a side and never twice in a row, the ball never down, rally points to twenty-one, the rally's winner
  serving (a float serve). The court sim takes a side of more than one (the kernel's `players`): each player at its home
  across the side, the pad on the side's ACTIVE player (the one to play the ball: never the last to touch it, else the
  nearest), its teammates the minds'. The card's `assist: 'pass'` places the side's touches before its last for a
  teammate in every register (the bump to the setter's spot by the net, the set to the attacker's), and its last goes
  over as the register strikes it; a body reaches as high as its `up` (a jump's); bare hands draw no racquet. The side
  mind runs the active player to where the ball comes down (its own physics on a copy) and the others to the set and
  the attack. A tennis court replays as before (one a side, the same minds and seeds).
  - **Held:** the players and minds from the kernel's, across the side; every touch inside the rally's rule; each
    placed pass played next by the teammate it was placed for; a bump, a set and an attack in one rally; the pad on
    side a's active player; the page plays it to the Node state.
  - **Seen, said:** in the realistic register the minds rarely return a float serve (the body's realistic build-up is
    slow for a court of eight metres): an ace is most points there; the arcade registers rally.
- **Basketball on the pitch** (`arcade-rules.js` the goal family and its `basketball` card, `team-sim.js`), built:
  full-court basketball three a side, four quarters, two points inside the arc and three beyond it. The goal family
  composes a team game from its modules (the court and its key, the goal a mouth or a HOOP, the score's unit and clock,
  the roles' homes, the play by foot or by HANDS, the ground, the outs). The pitch sim's hoop is a ring of the physics'
  spheres and a backboard over each end, so a shot rattles in or out by the physics; a basket is the ball dropping
  through the ring, its points the shot's (the kernel's score fact now carries `points`, a goal as ever without them).
  The hands: the ball caught (never as it leaves the hand, a shot only on its way down), held and dribbled at the
  holder's side inside the lines, a tap passes to the teammate along the stick (led by the pass's flight), a hold
  shoots on a steep arc at a speed found by flying the ball alone in the sim's own physics, the charge off its sweet
  spot, the range and a defender's hand its miss; an opponent at the ball long enough steals it. The side with the ball
  takes its roles' spots in the attacking half and the other marks its man; the hands mind drives, works the ball and
  shoots in range from in front of the ring. The page lays the hardwood, the key, the arcs, the rings, their nets and
  boards; the broadcast calls a basket by its points (THREE!), and the stats count them. Soccer and hockey replay as
  before; the arcade rules' card is now an index (`contest-arcade`) and a card per family (`contest-arcade-<family>`).
  - **Held:** a score's points in the kernel; a shot at the sweet spot drops through for two inside and three beyond,
    off it no basket; the catch, the dribble at the side, the pass caught by its teammate, the steal; the stats' points;
    every card's short variant to its end (the deep sweep, now on both shapes); the page plays it to the Node state.
  - **Seen, said:** an exhibition scores about seven points in two minutes with about half the shots made; the
    blocks, the shot clock, travelling and free throws are the card's omissions.
- **The carry games: rugby and American football** (`arcade-rules.js` the carry family, `contest-kernel.js` `carry`,
  `team-sim.js`), built: five a side on a short field. The kernel's carry module: possession and plays (the line of
  scrimmage where each starts), a tackle ending one, the ball kept for so many tackles (rugby league's six, then the
  handover) or downs to gain the next first down (four to gain ten yards), a pass forward never fair or fair once a
  play from behind the line, a dropped ball and a ball out each a down or a turnover, a try (or touchdown) its points
  and then the conversion kicked from in front for its own, no play restarted on a try line. The pitch sim's carry
  mode: each play the side with the ball in its formation round it and its first role holding it, live at once; an
  opponent kept at the carrier a moment tackles it; over the line a try; the conversion kicked at the posts, through
  between the uprights over the bar or not; a pass tells the kernel where from and to; a carrier a step slower than its
  chasers. The carry mind: the quarterback drops back and throws to the most open receiver once the routes have run,
  the rugby carrier passes back to a teammate in space when a tackle comes, the carrier runs for the line away from the
  nearest defender; the role players run support lines and routes, a man each and a deep zone, and pursue on a
  cut-off angle, converging on a pass's receiver while the ball flies. The page lays the field's lines, the in-goals
  in the sides' colours, the H posts, the line of scrimmage and the line to gain, an oval ball; the tab reads
  "2nd & 6" in yards or "tackle 3 of 6"; the broadcast calls TRY!, TOUCHDOWN!, the conversion, FIRST DOWN, HANDOVER,
  TURNOVER ON DOWNS, INTERCEPTED, KNOCK-ON and FORWARD PASS, and the stats count the conversion's points.
  - **Held:** the kernel's six tackles to the handover, a first down for the gain and the turnover on downs, the
    forward pass once and its second the down lost, never in rugby, the knock-on, the try and its conversion; the
    play's formation and the snap, the tackle where it was made, the try over the line and the conversion good at the
    sweet spot and no good off it; the plates; every card's short variant to its end; the page at the Node state for a
    game of tackles and one of downs.
  - **Seen, said:** the arcade football scores high (about a touchdown a minute between two computer sides, as an
    arcade football game does); the rugby is tight. The ruck, the scrum and the lineout, kicking in open play, eleven a
    side, punts and penalties are the cards' omissions.
- **The innings games: baseball and cricket** (`arcade-rules.js` the innings family, `contest-kernel.js` the `innings`
  shape, `bat-sim.js`, `innings-arena.js`), built: one side bats, the other fields, a ball at a time. The kernel's new
  shape: strikes and outs (a foul never the third strike), three outs the side retired, a hit moving every runner so
  many bases and the ones home scoring; or a game of runs: a ball missed a dot, six balls an over, the overs a side's
  innings, a boundary four or six; the second side ahead after the first's last innings does not bat, and the chase or
  the walk-off ends the game the ball it leads. The bat sim: the pitch through the zone or the ball bowled at a length,
  the swing timed against the ball's arrival (early or late a strike, inside the window the contact's quality and its
  spray off the stick), the struck ball flown on the physics and its end read ahead on a copy of it the moment it is
  struck (over the fence or the rope on the full, a foul outside the lines, caught where a fielder reaches the landing
  in the ball's hang time, else fielded and thrown out at first or the bases the runner makes before the throw, the
  runs the batters cross); a ball let go is a strike in the zone and pitched again out of it, a dot or bowled into the
  stumps. The page lays a diamond (the infield, the bases, the mound, the foul lines, the fence) or an oval (the square,
  the pitch, the stumps, the rope), the fielders at their spots and the camera behind the batter; the broadcast calls
  STRIKE, FOUL BALL, STRUCK OUT, CAUGHT, OUT AT FIRST, BOWLED, SINGLE to HOME RUN!, FOUR!, SIX!, SIDE RETIRED and the end
  of the over, and the stats count runs, hits, home runs and strikeouts or runs, fours, sixes and wickets. The quick
  goal takes `sport: 'baseball' | 'cricket'` with `innings` and `overs`, in the football stadium; the kits gain a
  baseball uniform and cricket whites. The distilled-rulebook catalyst names the shape.
  - **Held:** the kernel's strikes, outs, bases, runs, overs, the side, the second side not batting and the chase's
    end; the swing's window one unbroken run of frames, a press early a strike; a ball let go in a game of runs never a
    strike; every struck ball ruled once; an exhibition of each to its end, the same pads the same game to the byte;
    the plates and the stats; every card's short variant to its end (the deep sweep, now on three shapes); the page of
    each at the Node state.
  - **Seen, said:** between computer sides the baseball is home runs, singles and outs (the fielders reach the gaps,
    so a double or a triple is rare), about four runs in three innings; the cricket's boundaries are mostly sixes. The
    walk, the catcher, stolen bases and force plays, leg before wicket, the wide and the no ball, run outs and nine or
    eleven a side are the cards' omissions.

### Sport concept: the player's idea on top of the rules

When a player makes a sport game, the players are characters, the arena is a venue round the play, the player's own
idea is laid over the sport's rules, and one style holds across the kits, the graphics and the shell; each is said back
in `design_game`'s readout. An audit through the real path first (each arcade card minted by `design_game`, opened in
the game shell through the dashboard's server): every card already minted characters (six faces cycled over a large
side) and stood in a lit stadium, with no page error and no black frame; the shell was the stock beige; a level's first
open resolves its arena and bodies for about twenty seconds on a blank loader, cached after; basketball's tab said
KICK-OFF.

- **The concept** (`gameworld/sport-concept.js`, `quick.concept` on the contest and meet goals), built: a few words
  ("cats vs dogs at night", "red robots vs blue knights, retro arcade") read against a lexicon into the quick words
  around the rules, laid under the creator's own as a sport preset's are (their word always wins; a venue's and a
  broadcast's word by word, the teams side by side): the sides about a "vs" (a name each, a colour word its shirt, an
  animal its players that animal's mascots), colour words for the sides' shirts, an animal for every side, the venue's
  light (night, dusk, golden, day), its house (colosseum, arcade, municipal, olympic, the patron's dome), its livery,
  its land and a roof, the drawing tradition (anime, western), chibi or mascot bodies, the register and the broadcast
  package. The rules are the card's: a number or a rule word is never read and is said back, and so is a word nothing
  reads. A course keeps its stage and its seats (said back as `left`). The readout's `concept` gives each word read
  and what it decided.
  - **`teams`** on a two-sided contest: `[{ name?, colour?, mascot? }]` × 2, a side's broadcast name, its shirt (the
    kits', the graphics' and the shell's) and the brief its players are rolled from as mascots.
- **One style** (`gameworld/runner.js`): a sport game's shell is themed by the color theorist round its sides'
  colours in its venue's light (night and dusk a low key, noon a high one) where it was the stock skin; a one-a-side
  court's players wear their side's colour (a game played in whites, its trim), as a team's always did, so the kits
  and the graphics agree; the athletes take the concept's drawing tradition.
- **The machine gate, said** (`design_game`): the sport game's step carries three laws, `cast` (a character in every
  slot, the faces counted; `athletes: false` the stick figures, advised), `arena` (the stadium round the play, at its
  time; a bare stage said) and `style` (one palette over kits, graphics and shell, one drawing; a western cast in an
  anime stadium advised); when they hold the readout says them as the game's `checked`.
- **Exposed**: the contest card names the bat-and-ball sports, `concept` and `teams`, and a sport's answer (the
  characters, the venue, the laws) in place of the levers a sport refuses; the meet card takes `concept`; the
  game-design routing card names the concept, with two routing rows for concept-shaped asks. Basketball's tab calls
  its restart a tip-off, then an inbound.
  - **Held:** the reader's laws (the sides, colours, an animal, the venue's nesting, a later word winning, the rule
    words, the refusals), the concept under the creator's words, a course keeping its stage, the arena carrying the
    teams; the run's mascots per side and the side colour on the kits; the three laws and the shell's theme; the same
    concept running the same steps; a concept game through `design_game` (its readout, its stadium at night, six
    bodies on the page, the checked laws).
  - **Seen, said:** two concept games opened in the shell through the dashboard's server: cats and dogs as mascots
    under a night stadium, the CATS and DOGS names on the board, the front screen dark in the game's palette; robots
    and knights in the candy arcade stadium on a light front. "Robots" is not a mascot word, so that side is people
    (said back). A level's first open still takes about twenty seconds on the shell's loader; not addressed here.

### No flat building polygons: a building's seen edges have thickness

Walls and roofs read paper-thin: a building's outer wall was one skin with its way out punched through it, and every
roof a single sheet, its overhang a knife edge from below. Now a solid building (`era/solid.js`) has thickness wherever
its edge can be seen.

- **Roofs are slabs.** A pitched roof's covering, an underside a roof's thickness below it, and a band down every edge
  no other slope shares (the fascia at the eaves, the verges at a gable); a stage building's flat roof the same. A town's
  flat cap stands its parapet a wall's thickness, its inner face and its coping laid.
- **Doorways are cut through the wall.** A stage building's way out has its two jambs, its head and its threshold from
  the outer face to the inside's.
- **Who is solid:** a recipe that says `solid: true`, and every world read in gen-7 (the form render). A new world that
  builds (a stage's `buildings` or `town`, the geocube kind's town, a composed game's levels with buildings) is stamped
  `solid: true` at mint, so a world minted from now is solid and a row minted before keeps its bytes; `solid: false`
  keeps the skin. Not solid, every face as it was.
- **A town law** (`solid`, read only on a solid town): every pitched roof a closed slab, no edge of it open.

### Gen 7: form, not light

The seventh generation is a render, not an edit: the same recipe read in `gen-6` or `gen-7` is two renders of one world,
the era a choice of the read and the export as the engine is. Gen-7 is the form render (a surface carries its material
and its form, never light, and the renderer lights it); gen-6 is paint (the light held in the colour).

- **The era is the read's.** `resolveWorldScene(sketch, { era })`, the World page's `?era=gen-7` and
  `export_game { era }` read a world in another era than its cube's, the recipe untouched (its bytes never depend on the
  era it is drawn in). Absent, the cube's own era, every byte as it was. The engine packs refuse an era (they carry the
  recipe's surfaces as they are until the form render gives them materials), as does a 2D game's single page.
- **Each era names its surface model** (`era/eras.js`: `paint` for gen-6, `form` for gen-7).
- **Gen-7 no longer means live light over paint.** The live light's gen-7 defaults (actor shadows, the hour's shadow map,
  occlusion) are now the light a form render's surfaces are drawn under while it draws them as paint; their reason in
  `liveLightDefaults`'s `from` reads `form`. A hero's level keeps its actor shadows, and any gen-6 recipe can still ask
  for the live light with `shadows` and `occlusion`.
- **The era marks** (`era/era-marks.js`): what each era gives every World page input, in the engine marks' words. Gen-6
  draws every input as built; gen-7 marks each surface input (the faces' vertex light, painted tiles, ramps, live grass,
  the rock fabric, baked occlusion, the live light itself) `approximated`, drawn as paint, and every other input
  neutral. `eraReading(payload, era)` lists what a payload's era drew short of built, and `export_game { era }` answers
  with it (`era_marks`). A guard holds the marks to the page's own inputs: a new input is classified before it passes.
- **The first material: relief read as an engine reads it** (`form/relief-material.js`). A dressed face's relief (the
  height field the matte painter already builds) read into glTF's metal-rough set: base colour (the paint's colour pass
  under no light), a tangent-space normal from its slope (the glTF / OpenGL convention), occlusion from its hollows and
  roughness polished on its crests packed in one texture, and the height kept. `dressedMaterial(cfg)` reads the modern
  cuts so (the wire-cut brick first); any other cut says it is still drawn as paint. The paint's own tiles are as they
  were, byte for byte.
- **The bond as polygons** (`form/bond.js`): a brick wall's courses lowered to geometry from the same numbers the paint
  reads (its courses, bricks a course, its half bond, `BRICK`'s joint and mortar depth, now exported from
  `matte-paint/dressed.js`): each brick a face and four returns standing proud of a mortar plane, so it casts into its
  joints under a real sun.
- **The brick wall three ways** (`scripts/spikes/form/brick-three-ways.mjs`): one tile painted (gen-6), as material lit
  live, and as polygons with the material's fine relief, under one sun the page moves; `window.measure()` reads the
  mortar under a brick against the brick's face (a side sun at 25°: material 1.74, polygons 1.26, the polygons'
  joints shadowed).

### Geocube scenes: a place to walk, not a game, on the geocube

A request that asks only for a place (its look, its land, what grows, the sky, the hour) and nothing of a hero, rules,
levels, story or minds is a scene, not a game. It lands on the geocube, and what it needs is added to the geocube itself,
so a game's levels on the cube get it too.

- **An open trail** (`trail.ground.cliff: false`): no far cliff. The land is open on both sides of the walk, the meadow's
  trees, grass and flowers growing on both, no scarp and no geology laid. The stage stands an `overlook` camera, a
  raised eye off the walk's open side, in place of the cliff-top. A trail with no `cliff`, or one with settings, is the
  card's far cliff as before.
- **The cube's far cliff** (`outside.cliff`, and a terrain's own): `false` or the cliff's settings, laid on every trail
  the cube paints unless the trail names its own: a scene's path and a game's levels alike, with no game-side setting.
- **The geocube kind shows the path** (`show: 'path'`): the way through the cube's land, a trail stage on its terrain
  with no town and nobody on it, walked by the stand-in and seen from its overlook. It takes `seed`, `biocube`, `path`
  (the trail's dress), `hour` and `clouds` as the other shows do, and the cube's `snow`. `show: 'trail'` keeps its
  meaning: the cube's island walked.
- **The routing**: a new `scene` routing card sends a walkable scene, a landscape or a nature scene to the geocube's
  path, with the words a place is asked in mapped onto the cube (an open field to `outside.cliff: false`, wildflowers
  to the biocube's, the time of day to `hour`). The scene-illustration card keeps illustrations of things (portraits,
  structural drawings) and no longer sends landscapes to the painted landscape, whose rows render as before. The world
  and geocube cards point at the scene. Routing-eval rows carry the phrasing "Create a walkable scene of a colorful
  grassy field in the daytime".
- **A scene asked in words** (the geocube kind's `words`): `{ kind: 'geocube', words: 'a colorful grassy field in the
  daytime' }` is read at mint into the cube, `show: 'path'`, `hour`, `clouds` and the path's own `trail` (its dials,
  mounds, rocks), with the game's own word table: what a word decides for a game's cube it decides for a scene's. A key
  written beside the words is kept; new words on an edit read again, a key the edit changed stands, and the same cube
  keeps the colours it was stamped with. The `brief` says what each word decided, what a game's word gave way to (a hero,
  a goal, a castle to raise) and what went unread. A path draws its own seed at mint, as a trail and a town do.
- **New words, read by a game and a scene alike**: field, plain, prairie, steppe, grassland, savanna lay the cube open
  (no far cliff) unless a word names a cliff, a face or beds (plains under basalt cliffs keep them) or the next word is a
  machine (field cannon); colorful, flowers, flowery, wildflowers, floral, blooming put wildflowers in its grass (the
  cube's biocube); grassy and grass name the meadow; snowy and snow lay the cube's snow beside the alpine weather;
  daytime, midday and daylight light it at noon. A composed world that says them lays them on its cube, so its levels
  take them; one that says none composes as before.
- **The palette** of a scene's cube: `cube.palette: { heat, weight, activity }` (pick_palette's axes) over the cube's own
  character, solved by the color theorist and checked by the cube's laws, as any cube's.
- **Water on the cube's land** (`outside.water`, a terrain's own, a trail's `ground.water`): a lake beside the walk (a
  basin off it, its water just under the lowest of its shore, a sand shore round it); a coast (the open side runs on
  past the site's edge and falls through a beach to the sea, which runs to the horizon, the far ridges sinking under it
  on that side, shells and driftwood on the beach); a river beside the walk (its channel cut, its water falling with the
  land and climbing no more than a step, shingle on its banks); the falls (a brook along the cliff top, the fall down
  the face in white water, a pool at its foot, the crossing's stream rising from it). Cut after the walk is laid, so no
  water moves the walk; drawn in the cube's `colour.water`, a surface, not physics. Laid on every trail the cube paints,
  a game's levels as well as a scene's path; a trail's own form wins and its `water: false` refuses the cube's. Each body
  is an anchor and a water hazard on its trail and adds a still (`lake`, `shore`, `river`, `falls`). No grass, tree or
  boulder stands in it. A trail with none builds as before, to the byte.
- **The falls draw**: a land's `landmark: falls` (waterfall, falls, cascade) was a named gap since the land merge; it
  now lowers onto the trail's `ground.water.falls`. A fall keeps the cliff it drops from: an open word gives way to it.
- **Biomes**: coast, alpine and desert, each a biocube preset (low wind-bent trees and marram; conifer stands, short
  grass and a few flowers; a lone low tree and sparse needlegrass) and, laid on a cube by its word, the color theorist's
  own preset for such a place as the palette's character (coastal-noon, alpine-dawn, desert-haze), a desert's sandstone
  ground weathering to sand, a coast's sea.
- **New words**, read by a game and a scene alike: lake, lakeside, pond, tarn; beach, ocean, shore, sea (the coast's
  water); coast, coastal, seaside (the coast biome); river, riverside, stream, brook, creek; cascade; alpine, desert,
  dunes, arid (their biomes); pine, conifer, spruce, fir (conifer stands on the meadow). A world that says none composes
  as before.
- **The painted landscape's glyphs as words**: each glyph card's aliases are read where the shared table reads nothing,
  and what a card decides is derived from its own numbers: a heartbeat the trail's heartbeat and bumpiness, a scene the
  cube's flora (conifer stands, a grove or a meadow, an upland with its rocks), a sky the hour and the land's cloud form,
  a splatch the palette's character as the theorist's axes (heat, weight, activity) read off its seeds, never its
  colours, and a camera the still the geocube kind is first seen from (the kind's new `camera`: low, overhead, wide,
  close; a scene's, never a game's). Aliases a sentence uses for other things (water, open, warm…) are no glyph's.

### Normal bake: the realistic head's relief from its own field, in the engine export

- **The bake** (`polygonizer/normal-bake.js`): `bakeFieldNormals` takes a light mesh with its UVs and a signed-distance
  field, and for every texel of every chart triangle finds its point on the mesh, steps it onto the field's surface and
  writes the field's own normal there, in the mesh's tangent space, as an RGB8 map. The tangents (`meshTangents`) are
  built the MikkTSpace way and ride beside the map, so an engine shades in the basis the map was baked in. Where two
  charts overlap a texel goes to the triangle the chart sees most face-on; a texel turned far from the mesh's normal (a
  lid's margin) is supersampled so it does not alias into sparks; the charts are dilated, so an engine's mips never pull
  the background into a seam. Deterministic: a fixed texel order, no dice, dmath's trigonometry. Its gates: a sphere's
  field on a flat-faced icosphere and a torus's on a coarse grid shade to the analytic normal within a degree.
- **The realistic head carries it.** The one-skin head is its field netted and simplified; the map puts back what the
  simplification spent: the lids' crease, the lips' line, the nostrils' wings, the ears' folds
  (`epidermis/dermal-relief.js`). It is baked on the head's own skin chart (the atlas the base colour already uses), at
  a size set by the skin's own rung (its target): 512 texels across the head's page, 256 at L1, 128 at L0. The body, the
  hands and what the hero wears stay flat on the map (their vertex normals shade them as before).
- **It rides the lit skinned GLB** (`export_model { skinned: true, lit: true }`, and the Godot and Unreal packs under
  their lit option): the figure's material gains `normalTexture` and its primitive `TANGENT`; the engine skeleton export
  (the T-pose, `humanoid`) turns the normals and tangents with the mesh. Godot imports the map onto the figure's
  material and the kernel leaves it there. The Unreal importer binds the map Interchange imports to a lit master of its
  own (`M_MojuloLitRelief`, written only for an asset that carries one; its green flipped to Unreal's convention).
  Unity's glTFast and Blender read a glTF normal map as they import the GLB, but the Unity pack ships figures as rigid
  parts without their atlas, so its ledger says the map stays behind; the Blender pack ships no figure skinned.
- **Who gets it:** a realistic hero minted from now (realistic laws 5, stamped at mint: its head's fit keeps the neck's
  column the skin was joined to, so the field can be rebuilt). A hero minted before keeps the bytes it exported; every
  other form, every unlit or rigid export and the World page are as they were. **The World page looks as before:** its
  fills are unlit (the light is baked into the vertex colour), so a normal map has nothing to shade there until the page
  lights a figure live.
- The GLB reader (`scene-gltf-read.js`) now carries a normal map that rides with its tangents and TEXCOORD_0
  (`normalMaps`, `ledger.maps_carried`) instead of counting it dropped. The seventh generation's `relief-in-normal` is
  `partial`: built for the realistic head in an engine export; the body's lofts, the hands, the armour and the page are
  still to come.

### Land in the level: the composer's land forms drawn

- **A world's land now reaches its levels.** A gameworld's `style.land` (and a level's, over it) names land forms,
  each a variant and a step from little to many: landscape, rock, strata, face, cloud, landmark. The composer has
  always written them from words ("misty", "rocky", "a waterfall", "rolling hills") and the bible drew them, but no
  stage read them: "add a waterfall" changed the recipe and remade nothing. `resolveLevel` now lowers them, through
  one function (`landToLevel`, gameworld/nature.js, the other way round from `landOfKit`), onto the settings a walk's
  stages already draw by, so the level recipe carries them and the existing builders draw them:
  - landscape: the trails' mounds (`trail.ground.bump`, height and size) and the climb's plain (`meru.relief`);
  - rock: how many boulders a trail strews (`trail.rocks.boulders`);
  - strata: the trail cliff's beds (`trail.ground.cliff.bed`, and `dip` when tilted);
  - face: the trail cliff's joints (`trail.ground.cliff.joint`, and `pattern`: columnar, blocky, slabby);
  - cloud: the level's sky (`clouds` on the level recipe, laid on every stage its geocube paints, as `hour` is);
  - landmark: a monolith is the trail's landmark stone, at its height (`trail.rocks.landmark`).
- **What a stage cannot draw is a named gap, never faked geometry.** A tor, a sea stack, a hoodoo, a balanced rock;
  graded, folded or unconformable beds; fluted or craggy faces; lenticular clouds; an arch, a spire, a butte, a split
  rock, a landmark's company; terraces on a trail; a sky on a level no cube paints. **A waterfall is one of them:** the
  only water on a walk is a crossing's stream, fording flat ground, and nothing falls from a cliff. `design_game`'s
  readout says each gap under `advice.land`, naming its levels, and the bible's land section says, under "In the
  level", what each form became on each level and what it could not.
- **Compatibility, said plainly:** composed worlds, and the example worlds that name land (MEADOWMARK among them), lay
  different levels on their next run: the recipe always said it, and the level now honors it. There is no flag to
  keep the old levels. What a world's land leaves out stays the kit's own, and a setting a trail or a climb names
  itself (its bumpiness, its own ground, rocks or relief, the level's ground tune) is kept over the land's. A world
  with no land emits the bytes it did.
- New settings, each the card's own number where left out, on readers that already drew the thing: a trail's `rocks`
  (`boulders` 0 to 24, `landmark` metres), its ground's `cliff` `bed`, `dip`, `joint` and `pattern`, and a level
  recipe's `clouds` (refused without its geocube).
- A climb after a trail under a level's clouds opens on its own. The level named its painted look without the clouds,
  and a climb's `after.kit` (the look the trail before it is drawn in) took that name, but each stage registers the look
  with them: in a fresh process (an export, the World page) the climb was refused ("after.kit … is not an isekai kit").
  The level now lowers its look under its clouds, as its stages do. A level with no clouds is unchanged.

### One name: a 3D compiler for agents

- Every surface says the same thing: the README, the npm README, `package.json`, the Claude plugin, `glama.json`,
  `server.json`, `CLAUDE.md`, the agent reference, and the agent-facing `initialize` preamble and `get_substrate`
  drawer, which said "a 3D factory with a media studio".
- The README's first screen leads with what a user gets from a sentence (a room, a chest of drawers, a printable part,
  a city: source, a model for Blender or Godot, print files at true size, a cutting plan) and shows the dresser's shop
  sheet; the host list and the footprint move below it.
- Stale claims swept: local apps and MCP workflows (retired from the listed surface in 3.1.0) left the README's
  "also in the box"; the tour is labelled as the 2.0.4 page it is; CONTRIBUTING's "Unreal is aligned-for and not
  built" now names the Unity and Unreal legs; the install map's always-present packs drop the retired office packs;
  the substrate no longer tells an agent to clone the deprecated external recipe book.

### Rail fixes: what the level demo found

- **A design run that fails partway keeps the record of what it made.** `design_game` `run: true` makes each ready
  step through the real handlers and records it in the world's `made`; a step that threw left the steps made before
  it written as rows with no record saved, so the next run read them as edited by hand (`edited`) and left them unless
  forced. The run now saves the world with the record of the steps that succeeded before it rethrows, and the error
  reaches the caller as it was; the next run keeps or remakes those steps as usual. A failure before anything was made
  writes nothing.
- **Night, and any hour, from a gameworld's style.** A world's or a level's `style.hour` (a level's over the world's,
  read by the cube's own `readHour`: dawn, morning, noon, afternoon, golden, dusk, night, or 0 to 24) lowers onto each
  stage its level's geocube paints, the trails and the climb, as the stage's `hour`, over its domain's own; until now
  night was reachable only through a cube domain's hour. The level recipe takes `hour` beside its `geocube` (refused
  without one), and a painted stage's `painted` readout names the hour it got. A stage no cube paints (a section in its
  own kit, a level with no cube, a building, a city, a track) is lit as before and says so as advice on its step in the
  run (`hour: … is not on one`), never a refusal. The composer reads an hour word (dawn, sunrise, morning, afternoon,
  sunset, dusk, twilight, evening, night, moonlit) into `style.hour`, unless the cube is lit at that hour already, so
  "a gothic night" composes as it did and "a sunny island at night" is the island at night. A world with no hour emits
  the bytes it did. The world card's style line names it.

### Level edit demo: a level made and changed by conversation

- A structure a cube raises `on: 'summit'` stands on a terraced mountain's crown. The climb a level walks up from its
  trail (the `terraced-mountain` preset) ends in a lookout tier with no height of its own, so the summit came out
  with no height and the stage was refused; it now stands at the tier's top. A cube whose summit tier has a height
  places it as before.

### Title cards: the carved letters come back as the game's words

- **`as: 'title'` on a HUD banner row** carves the row's words into 3D letters and puts them on the screen when its
  event fires, the way a game announces a round, a K.O., a clear, instead of a plate with words on it. The letters are
  the glyph carver's (`lib/motion/glyph-carver.js`, the letter primitive of the pre-three renderer, until now reached
  only through the `carved-solid` wordmark and cover titles) extruded with the bevelled carve kernel and tessellated
  into a GLYPH ATLAS the page lays out by advance, so a `{score}` substituted at play time still carves (the digits
  ride along with any placeholder). `look` is the entrance and its exit: `slam` (scaled down with an overshoot and a
  settling tilt; a flash, a jolt and sparks on landing; leaves growing), `rise` (letter by letter from below, stretched,
  squashing as each lands; leaves falling) or `stamp` (punched in from the eye with a bounce; leaves scattering, each
  letter on its own line and spin). `style` is the carve: `heavy`, `blocky`, `slick`, `thin`, `italic`. The look is the
  game's: the composed juice floor's register bakes anime cel bands with an ink hull behind each letter, or western
  metal with a glint and a drop copy, into vertex colour, unlit, so the scene's lights do not matter. Everything plays
  on the frame clock from the firing, every number of chance hashed from the firing's count: a capture draws the same.
  Card `hud-title`; idiom `title(…)`; a `play.parts` banner passes `as`, `look` and `style` through.
- **Themes: the design styles game titles are set in.** A title row names a `theme` or takes the one its game
  implies (the juice floor's register and game type: anime action → `cel`, western action → `arcade`, a platformer →
  `cartoon`, a realistic game → `cinematic`, a western pinball or racer → `speed`; no floor → `arcade`). Each is a
  whole — the carve, the entrance, the case, the tracking, the size, what stands behind the letters (an ink hull, a
  drop copy, both, a glow, nothing), a lean, how hard the landing hits, sparks or a halo, the colour token and how long
  it stands — modelled on the fighting game's announcer, the 8-bit cabinet, the anime cut-in, the platformer's cheer,
  the prestige card and the racer's readout. Two entrances join for them: `fade` (in slowly, nothing else) and `slide`
  (in from the right, stretched, streaks behind, out to the left). A dial a row names itself (`look`, `style`,
  `caps`, `edge`, `color`, `ttl`) wins over the theme's.
- **The cascade: a play direction dresses its titles.** A world whose play block carries a settled UI direction
  dresses its title rows from the register the parts are dressed from: `type` ⇒ the carve and the case (system slick,
  display heavy in capitals, period thin in capitals; a pixel tuning blocky with an ink edge), `frame` ⇒ what stands
  behind the letters, `motion` ⇒ the entrance, its tempo (the dial's frames against ease's) and its steps (a stepped or
  mechanical entrance plays in that many held drawings, as the UI's own moves do). Precedence per dial: the row's word
  > the register (a pin the operator set counts as theirs) > the theme the game implies > the default. The UI board
  draws a title part as the page would carve it, flat, in every state, in values and dressed, under a line naming
  the layer that set every dial (`titleDials` with `explain`); a host with no face shows the words. While the
  direction is proposed the page draws the title in the greybox tokens with the theme's own dials.
- **Words in the player's language.** A HUD row's `text` may name a word instead of spelling it (`'@fight'`,
  `'@round'`, `'@gameOver'`, …: the `gameTitles` namespace of the dashboard's own locale catalogs, added to every
  shipped language), read in the world's top-level `locale` (a shipped code; absent ⇒ `en`). A new language reaches
  the games and the dashboard at once through `/sync-locales`.
- **Absence degrades, never breaks.** A title the host cannot carve stays a banner (the browser spells it) and the
  world's events say why under `titlesFallback`: no face parsed, `opentype.js` absent (an optional dependency), a
  script that needs a shaping engine (Arabic, Hebrew, Thai, the Indic scripts), a character no face on the host covers.
  The letters follow the host's faces (`MOJULO_TITLE_FONT` first, then the system's bold display faces, a CJK face
  after a Latin one); vendor a face to pin them. The engines take a title as a banner in `score.json` (ledger
  `titles_as_banners`). A world without a title row emits byte-identical pages.

### Resonance: the compiler checks that a composition's combined outcomes are laid

- When values in two or more of the cube's facets are set together, an outcome exists that neither says alone: the
  seats, the frame and the camera make a co-op screen; a watcher's perception and an unseen goal make a sneak; a party
  and the escort motive make companions who follow. A RESONANCE names such an outcome (`gameworld/resonance.js`), and
  the compiler checks itself against it: for a composition, which resonances it opens, whether its steps LAID what
  each needs, and whether the laid level HOLDS its law. Internal: nothing in the agent's tools or cards, no refusal.
- **The table and the check.** `RESONANCES` (`{ id, name, of, when, outcome, lowers, laid, law?, voiced? }`, `when`
  ANDed across its keys, `a|b` inside a key ORed), `resonancesOf(cube)`, `resonanceCheck(cube, orders)`. The first
  rows are what the compiler already lays: `co-op-screen`, `watched-sneak`, `escorting-party`.
- **The compiler checks itself.** A design run checks, after its steps, what its cube opens: an opened resonance its
  steps did not lay, or laid and does not hold, comes back with the run as `resonance` (`compilerGaps`), absent when
  there is none; nothing refuses. A gate (`resonance.gate.test.js`) makes worlds the ways a creator does (words
  composed, a quick game) and FIRES on a new gap; its ledger of known gaps only shrinks (a gap filled fails until its
  line goes). It found three at once: the composed co-op platformer lays no hero per seat on its side camera, the
  composed stealth game lays no watchers, and the quick sneak lays guards who see where its cube asks for memory. The
  last is settled the other way: guards stay goldfish, simple and local, so the stealth probe now asks for sight.
- **The one field the agent reads: `intent.latent`.** The design readout's intent names the outcomes a user voices that
  the cube is one move from (`latentOf`: it holds some of the row's keys and lacks keys in one facet only), with what it
  lacks: a side-on platformer is one move from a couch co-op screen (`soul.seats`, `soul.frame`). Absent when there is
  none; the `gameworld-intent` card names it in one line.
- **Guards as a level goal.** A level's `goal` takes `guards: true` (`LEVEL_GOAL_PARTS`): the quick sneak's guards on
  each stage's beats, watching by sight, and the `unseen` mechanic that loses the level when one sees the hero; one
  figure stands for them all, rolled in the game's setting at `<ref>-guard`. The composer reads guard, sentry, stealth
  and sneak words into it, so a composed stealth game lays its watchers, and the gate's ledger loses that gap. A level
  without it lays as before.
- **The form, before the run.** A row now names what a world must hold before a run can lay it (`form`): each field
  filled by the composer, which can fill it from the cube, or by the creator (the hero, chosen, never defaulted).
  `formGaps(world, cube)` says which fields are empty and who fills them; the design readout puts them first as its
  `form` step (`asks`), and a run's `resonance` gap names the empty fields that left it unlaid. The co-op screen is the
  first: words that name a couch co-op platformer now write the side camera and lay walks a side camera runs (no
  climb), and the readout asks for the hero; until there is one the world is walked first person, its camera kept for
  the run that has its hero. With a book, the composed co-op platformer seats every player on the shared side camera,
  and the gate's last known gap is gone. The gate's co-op case runs the loop as a creator does: compose, the book the
  readout asks for, the run.

### Live light defaults: a hero's level, the seventh generation, the tier

The live light below, on by default where it pays, under a budget a phone can carry. The sun does not move: a level is
lit at one hour, its light baked and its static shadow map drawn once at load; nothing here moves the sun.

- **A hero's level takes actor shadows by default.** A world with a pilot that has a body (a pilotable entity whose
  body is not `none`; a spectated battle has no pilot) gets `shadows.actors`, so the hero, the seats' bodies, walkers,
  cars and fauna cast live shadows over the baked sun. Indoors that is the contact blob. The recipe keeps the last
  word: `shadows: false` (none), `shadows: true` or a blob's tuning (the suit's blob, as asked), `shadows.cast`, or
  `shadows: { actors: false }` keep the page it had. A stage's bake keys alone (`torch`, `sun`, `cells`) say nothing
  about the page, so the default goes beside them. **Hero levels change on their next render**: their page gains the
  actors' map and the bake writes each corner's sun share.
- **A spectated battle's fighters cast too** (`spectate: true`, no pilot): its entities with a body take
  `shadows.actors` by default, as a hero does, the recipe's own word kept the same way.
- **A world whose geocube names the seventh generation turns the live light on** (`geocube: { from, era: 'gen-7' }`,
  or a gameworld's `style.geocube`, which reaches every level). It gets `shadows: { actors, hour }` and `occlusion`,
  each the recipe's own where it names it (`hour: false`, `occlusion: false`, ...). gen-6, the default, adds nothing.
  `geocubeEraOf(manifest)` (era/geocube.js) reads the era of the cube that paints a world.
- **The quality tier** (`light: { tier: 'auto' | 'off' | 'half' | 'full' }`). Auto reads the screen the game is made
  for (`screen`): a phone gets half with no default occlusion, a tablet half, a screen (or none named) full. `half`
  draws the shadow maps at 1024 and the occlusion at a quarter of the frame (alone, its prepass at half the frame;
  beside the creases, the prepass whole and its pass at a quarter); `full` is 2048 and half the frame, as built. `off`
  drops the live light: the defaults and the recipe's own asks. A world's `mapSize` still wins. Only `light.tier` is
  the live light's; other keys of a world's `light` stay their kind's.
- **The budget probe**: a page given a tier counts what it draws. `__mojLight.budget()` returns the tier, the last
  frame's renders, shadow passes, shadow maps drawn and shadow draws, and the shadow maps' and the live passes' render
  targets' sizes. The machine gate holds them in Chrome on a quick game's level: a gen-6 hero, one render and one
  shadow pass a frame (2 shadow draws), one 2048 map; gen-7, three renders (the prepass, the occlusion, the frame),
  one shadow pass a frame, the hour's map drawn once in five frames, two 2048 maps, the prepass at the frame's size and
  the occlusion at half; gen-7 on a tablet, two 1024 maps, the prepass at half and the occlusion at a quarter; on a
  phone, one render a frame and two 1024 maps; `off`, no live light on the page. Counts, not milliseconds.
- **Every outdoor kit writes the sun's share** when the page takes actor shadows: the isekai island, nature and jungle
  bakes, as the stage and the meru already did. The island's pixel-locked faces take theirs from their band (a lit
  band shares what its tile's value loses to the shade band's; a shaded band none), its material faces and its
  realistic ground from their light with and without the sun. The city's faces take their key's share by their normal
  (the city's light is its key's Lambert, with no baked shadow to double); at night the key is the moon, so a moonlit
  trail, climb or city shares the moon's. Lit windows, signs and shops carry none. Colours are unchanged by it. A city
  and a geocube specimen take `shadows`, `occlusion` and `light` as world channels, so a city level can opt out.
- **The hour's map no longer lays moiré on wide terrain.** Under a low sun the static world shadowed itself across the
  map's own steps: in Chrome on a 600 m rolling terrain with nothing standing on it, 68 % of the ground darkened by
  over 4 % under a 25° sun and 99.9 % under 15°. The receive patch now reads the receiver's slope in the map from the
  fragment's own derivatives and adds the depth it climbs across a texel and a half to the bias, capped at eight times
  the map's own (`receiverBias` in scene/live-light.js mirrors it): 0.01 % and 0.02 % after, and a 12 m tower's shadow
  still lies on the ground.
- **The actors' box covers what is near the hero where the frame looks**: 16 m by default (was 12), led 8 m ahead along
  the camera's ground with one focus (`shadows.lead`, 0 for none; seats still grow the box round their spread). Before,
  half of the 24 m box round the hero lay behind the camera, and nothing more than 12 m ahead of the hero cast. Measured in
  Chrome on a standing figure: the shadow's edge 6 mm past the leg (as before) and a 3.8 cm penumbra (3 cm before).
- The `__mojCast.hour` seam says what it is: it draws the static map for a recipe's hour once at load, and is not a
  clock. The sun does not move, live or within a level.
- The cosmos registry: the seventh generation's world note says what naming it turns on; it stays partial (lightmaps
  and light probes, normal maps on the world, HDR, IBL and height fog planned; a moving sun is not). The hill-climb page
  is regenerated. The Godot and Roblox legs mark `lightTier` absent.
- Pins: the three live-shadow emit rows moved (the box, its lead, the hour's bias); every other emit pin is unchanged.

### Live light: actor shadows, the hour's shadow map, occlusion

What does not move stays baked; what moves gets live light on the World page. Each piece is opt-in. A world that asks
for none of them emits the same bytes as before.

- **Actor shadows over the baked sun** (`shadows: { actors: true }`, beside `cast`). Only what moves casts: the pilot,
  the seats' bodies, walkers, cars, fauna on the ground, and any subtree a channel hands to `__mojCast.adopt`. The
  static world only receives. The shadow box follows the pilot, or the centre of the seated pilots when seats play.
  Where the stage bake lights a world by the sun (a stage kit under the sun, and a meru outside, whose land is baked
  the same way), it writes each corner's share of its light that comes straight from the sun (`sunShare`; 0 where
  the baked sun is already shadowed or the face looks away). The page carries the share as a vertex attribute. An
  actor's shadow darkens a fragment by that share, so it takes a lit floor down to the baked shade beside it and never
  doubles a baked shadow. A world whose bake writes no share (the island's, a city's, a world with no baked sun)
  darkens by the cast's `alpha`, as `shadows.cast` does. Leaves, grass and far flora never cast. `cast` with `actors`
  or `hour` is refused, with a message that says why.
- A stage's `shadows` takes the page's keys (`cast`, `actors`, `hour` and the cast's tuning) beside its bake's
  `torch`, `sun` and `cells`; before, they were refused. On a geocube, a recipe's `shadows` that names only page keys
  keeps the cube's bake shadows under them.
- **The hour's shadow map** (`shadows: { hour: true }`). The static world is drawn into its own shadow map once at
  load, and again only when the hour changes (`__mojCast.hour([x, y, z])`, the direction toward the sun). It is never
  drawn per frame. With `actors`, the actors' map is drawn each frame and the receive patch reads both. The baked
  per-vertex sun stays the fallback and the light the captures use. The page's probe counts it: `__mojLight.hourMaps`
  (the times it was asked for) and `hourDraws` (the renders that drew it), beside `frames`. For the one frame the
  static map is drawn, the actors' map keeps its last frame.
- **Occlusion on the shared prepass** (`occlusion: true` or `{ strength, reach, samples }`). Live contact shadowing:
  a hero's feet on the floor, a prop on the ground, what no bake knows. Static occlusion stays baked. The creases'
  prepass also writes normals when occlusion is on (two render targets in one render). A half-resolution pass then
  samples a hemisphere (`samples`, 6 to 16) out to `reach` metres, and the composite blurs it on the surface (it never
  bleeds across an edge) and lays it under fog, as the creases are. A world with both creases and occlusion draws one
  prepass. The page's probe counts it: `__mojLight.prepassCalls`, `prepasses` (the renders into the prepass target)
  and `aoPasses`. With occlusion on, the prepass skips the shadow maps, which the frame's own render draws. A camera
  that is not perspective hides it. `__mojOcclusion.set(on)` turns it off and on. The unshaded export drops it. A
  world with creases and no occlusion keeps the creases' block as it was.
- The Godot and Roblox legs mark `occlusion` absent. Neither draws it yet.
- The cosmos registry says the seventh generation's world is partial, no longer absent (`reality.era=gen-7`,
  era/eras.js). Its built pieces are the opt-ins above, which a world asks for itself: naming the era does not turn
  them on yet. Still planned: lightmaps and light probes, normal maps on the world, HDR, IBL and height fog. A world
  asking for gen-7 now reads as one with a gap, not a blocked one; the Godot and Roblox legs still mark it absent, so
  those worlds now count as losing it there. The hill-climb page is regenerated.
- A world with live shadows and occlusion together no longer dies on load: the live light's script and the occlusion
  block both declared `__mojLight` on one page (a SyntaxError). The occlusion block binds the shared probe under its own
  name; the two occlusion pins moved, nothing else.
- An actor's shadow meets its feet. The operator's look found a wide soft smudge that began away from the hero's feet on
  the trail valley: until the pilot first stepped, and in every capture (which never steps), the actors' box covered
  the whole stage (550 m across there, a 27 cm texel), and a single-sided caster drew its back faces, so a sole's depth
  was the floor's own and the contact was lost. The controllable now hands the live light a focus (`__mojCast.focus`)
  that the pass before every render asks, so the box sits round the pilot from the first frame; the default span is
  12 m (a box 24 m across round one hero, a centimetre's texel; seats still grow it), the bias a contact's 5 mm, and an
  adopted subtree casts both its sides. Measured in Chrome on a standing figure: the shadow's edge 6 mm past the leg's
  face and a 3 cm penumbra (5 cm and 11 cm in the old fit box); on the quick game's hero, 1 mm and 3 to 4 cm.
- Occlusion no longer lays square halos round grass clumps. The prepass drew every solid with one override material,
  so an alpha-tested card (a grass clump, a leaf card) occluded as its whole rectangle. A cutout is now drawn with an
  override that samples its map's alpha and discards under its alphaTest, so it occludes and receives by its blades
  (the costlier of the two options, one override per class and map: leaving cutouts out of the prepass would have let
  the floor's contact shadow show through the blades in front of it). Measured in Chrome on a half-transparent card:
  0.17 darkening at the opaque half's foot, 0 at the transparent half's (0.17 at both before).
- Indoors the hour's map no longer dims the whole room. An interior (a world that declares itself one, `sky.preset
  'interior'`: the gothic-stone rooms of a quick game's crypt or tavern) bakes no sun and records no sun share, so every
  receiver fell back to the cast's alpha under the outdoor sun's map, roof and all: 60,000 to 100,000 pixels of an
  800 by 500 frame darker in the crypt and tavern. There is no sun for the hour to move there, so it is dropped: an
  interior asking for `hour` emits the page it would without it (`__mojCast.hour` is a no-op), and renders the same
  pixels. Outdoor pages are unchanged byte for byte.
- Indoors an actor lays a soft contact blob under it instead of a shadow off the outdoor sun, still under `actors`.
  The actors' map is drawn from below, straight up, so each texel holds the lowest surface of what moves above it; a
  receiver darkens by how much of a small disc round it has something standing within 12 cm, 45 cm and a metre above it
  (and nothing below), darkest under the feet and fading as the actor leaves the floor. Measured in Chrome: 0.32
  between a standing figure's feet (the alpha's 0.38 at most), nothing half a metre out, nothing where the outdoor sun
  would have thrown its shadow, nothing under a box hung 2.2 m up.
- `export_model` exports a building level. A stage's `program` is its building program (`{ use, seed }`), and the
  exporter read it as the code kind's, so every quick game's building level was refused ("program.source must be a
  non-empty string") while the game page played it. Only a workbench's `program` is code now (`hasCodeProgram`).
- The README capture helper (`docs/images/src/lib/browser.mjs`) runs on Linux: off macOS it routes GL through
  SwiftShader, which current Chrome builds gate behind `--enable-unsafe-swiftshader`; on those, without the flag, the
  World page never became capture-ready. It passes the flag, as the scene renderer's own launch does.

### Written intent: compose and quick write the game they are

- A quick game writes its `intent` (`{ from: <genre> }`) when its goal has a genre and the caller wrote none: the genre
  the world's cube was already read from (a race against rivals a kart race, a shooter with a craft a dogfight), now
  said in the recipe where the creator can see and change it. The cube does not change, so its concerns, levels and
  effects lay as before.
- A composed world writes its `intent` when the prompt's words name one genre clearly (its words matched two at least,
  and more of them than the next genre's), as it already writes the `feel` they name. One word ("towers", "map") says
  too little. The words go into the brief's `read`
  (`intent.from=<genre>`). A tie or no genre writes none, and `design_game` still asks for one with its suggestions.
  The intent is written before the levels are laid, so the composer's self-check sees the levels the genre's concerns
  lay: a newly composed world whose prompt names a genre is laid for it.
- A quick game whose goal is patched afterwards to read as another genre keeps the written one: its readout carries
  `intent.drift` (`{ written, goal }`) and `design_game` names an `intent` step for it. Said, never rewritten.
- The `gameworld-intent` card says both.
- Stored worlds are untouched: nothing rewrites a recipe already minted.

### Local multiplayer: playing together, as settings of the soul facet

- Several players at one machine, on one shared screen: seats (a controller each: a pad, or the keyboard) that take
  a game's bodies, and settings of the cosmos cube's `soul` facet (`seats`, `contest`, `dependence`, `frame`, `input`,
  `pool`, `join`) that a game composes, each built once for every composition that asks for it. A cooperative kitchen,
  a party mash, brothers on a quest and a shared bullet hell are its reference points, not its products. The
  principles are in `docs/local-multiplayer-principles.md`. A game that asks for no seats is byte for byte as before.
- **The settings, in the cube.** `soul` holds `seats` (one, two, four), `contest` (co-op, versus, teams,
  free-for-all), `dependence` (parallel, roles, handoff), `frame` (follow-all, fixed, scroll, split), `input`
  (real-time, window, turns), `pool` (shared, own) and `join` (drop-in, lobby). One seat is built; what the versus
  fighter already does (two seats, versus, real time, a fixed stage, its select screen) is partial, said in its note;
  everything else is absent and priced, the seats kernel and a pilot per seat as packages (`packages.js`). Seven genre
  probes are reference points of them: a co-op kitchen, a party mash, a co-op platformer, a co-op street brawler, a
  co-op scrolling shooter, a driver and gunner, and a split-screen deathmatch, each with the words a brief uses for it
  (`gameworld/intent.js`), so the hill-climb page names what each waits on.
- **A setting may be given another.** The six settings after `seats` mean something only for a game that seats more
  than one, so the sweep rolls and nudges them only then (a setting's `given`, `registry.js`), and a facet's odds count
  its settings that are not given. Without it, half of soul's rolls asked for multiplayer and the ranking of everything
  else moved.
- **The pad does what the keyboard does in the pilot scheme.** Reverse view takes the D-pad's down, and a spectator
  watches the next fighter on RB or the D-pad's right and locks the camera on A, each on its press edge; the pad legend
  names the reverse view. What a pad already says another way stays so: the left stick strafes under mouselook, the RB
  chord selects a weapon, kneel descends a glide. A test holds every other pilot action to a pad binding.
- **Versus reads its players through the controls kernel.** A `versus` scheme (controls/schemes.js: a stick and the
  input grammar's five buttons, light, medium, heavy, special and throw) holds the bindings the runtime had written by
  hand. The runtime client comes with the kernel
  wherever it is inlined (the page, the arena channel, the action lab), and a player's pad is kept by its
  `Gamepad.index`: a pad that leaves no longer hands its player's place to the other.
- **The action lab reads through the controls kernel too.** An `action` scheme holds the verbs of the action-game
  kernel (move, jump, attack, dodge, dash, lock, guard, shoot, switch, sprint) with the keys and pad buttons the lab had
  by hand; the lab's stick stays analog past its dead zone, the D-pad winning while pressed, and a test holds the lab's
  old keys and buttons to the scheme. The play itself now reads through the kernel in the pilot runtime, versus and the
  lab; the shells' menu pollers (play-front, play-shell, game-shell, the rpg and interact channels, the pixelizer's
  brickster shell) still read button numbers, and move with the seats.
- **The seats kernel** (`controls/seats-kernel.js`, emitted from its own source as the controls kernel is). A seat is a
  player position bound to one controller: a pad by its `Gamepad.index`, the keyboard with its mouse (one controller
  however many keyboards are plugged in: a browser cannot tell them apart), or the touch pad. A controller sits down in
  the lowest free seat, once; a lost pad keeps its seat, away, until the same pad is back; a leave frees the number for
  the next to join, and seat numbers never move. Each seat has its four-port colour (P1 red, P2 blue, P3 yellow, P4
  green). `drop-in` seats at any time, `lobby` only while it is open.
- **Versus plays on the seats.** Each player sits down with start or light on their own controller (the keyboard's
  Space too) and reads only it; the pause menu is the seat's that opened it, its panel naming the seat. **Two players
  on one keyboard is gone**: the keyboard is one controller, so player two takes a pad (the arrows now move the
  keyboard's own player). The registry says so: two and four seats and drop-in joining are partial, the versus fighter
  only.
- **The action runtime takes a seat per body** (the first step of a pilot per seat). A world's `seats: { bodies, drop? }`
  names the bodies seats 2 to 4 take; each runs its pilot rule on its own seat's input (`input.seats[n]`), and a seat with
  no player leaves its body to its AI (`drop: 'ai'`) or holds it (`'pause'`). The AI hunts the nearest seated pilot. A
  world without seats steps as it did; a gameworld lays them (below).
- **A shared camera frames every seat.** With more than one seat playing, the side and overhead cameras hold the
  players' centre and stand back until their spread fits the view (50° with 2 m round it), never nearer than their own
  distance and never past 2.2 × it; past that a world pass holds the leader back and brings the straggler in, so nobody
  leaves the shot. One seat, or none, and the cameras frame their target as they did.
- **The World page seats its players.** A world with seats emits the seats kernel beside the controls kernel: any press
  of a controller (a key, a button, a stick past half; start stays the shell's pause) sits it down, the first to press
  being seat 1, the world's pilot, which then reads only its own controller; seats 2 to 4 read theirs through the pilot
  scheme onto `input.seats`. A ring in the seat's colour stands under each seated body and a strip at the top names who
  is in. Tested in headless Chrome with two stubbed pads (`seats.live.test.js`, e2e). The target lock, the tutorial,
  the runner and the suit swap stay seat 1's; a world without seats emits as it did.
- **A gameworld seats its players from its cube.** A world whose intent says `soul.seats` two or four (`intent: { from:
  'co-op-platformer' }`, or its own `cube.soul`) lays, on every stage the hero walks, a hero per extra seat (`hero-2`…)
  beside the spawn: the hero itself, dressed as the goal dressed it, on the hero's rule, all on one side. While its seat
  is empty it follows the hero as a party member does; a seated hero that falls off the world comes back above seat 1;
  the suit swap never jumps onto another player's body. A ride, a flight, first person, building and city levels seat
  one. In the cube, `soul.seats` two and four, `contest=co-op`, `dependence=parallel`, `frame=follow-all` (the side and
  top-down cameras; a third-person camera follows seat 1), `input=real-time` and `join=drop-in` are built, on the web;
  the co-op platformer and the co-op street brawler now wait only on `pool=own` (each seat its own lives).
- **Four seats, and the audits with seats.** Four pads take four seats in the order they press, each driving its own
  body under its own colour (`seats.live.test.js`). A two-seat co-op game made through `design_game` is audited with
  seat 1, the audit's own pilot, while the empty seat's hero follows; its run and its verdict are the ones the same level
  without seats gets (`design-game.seats.test.js`, e2e). Godot and Roblox exports name the seats among what they leave.
  Found on the way, not from the seats: a quick side-on level is never proved beatable by the automatic audit, whose
  walker seeks the exit in a straight line, which a lane does not run.
- **Lives per seat.** A world whose cube says `soul.pool` gives its seats lives (`seats.lives`, `pool`): `own`, three
  for each seat, or `shared`, three a seat in one count. A fall off the world costs one and brings the player back beside
  a seat still playing (else where they started); a seat with none left sits out, and the level is lost when no seat is
  left playing. The strip shows each seat's hearts, or the shared count. A shared camera whose own target is out frames
  the seats still in. Falls only: a hit is still seat 1's hp, and the score stays one count. `soul.pool` own and shared
  are built (web); the co-op platformer and the co-op street brawler probes are makeable.
- **The pause is the seat's that opened it.** In both shells (the play shell and the game shell) any pad's start opens
  the pause and only the same pad's start closes it; the on-screen button still works for anyone. A level with seats
  tells the shell who sits where (a new `game-seats` sidecar message, level to shell), and the pause panel names the
  owner's seat in its colour ("paused · P2"). Tested in Chrome with two stubbed pads (`pause-owner.live.test.js`).
- **A facet may hold laws over the cube.** `dryRun` returns `advice` when one fires, absent otherwise, and never
  changes the verdict: a first-person camera seating several players needs `frame: split` (a view each), and a seat
  setting without the seats says so.

### Unreal takes assets: characters and solids, not games or levels

What reaches Unreal is a GLB's surface: geometry, vertex colour and painted textures travel; the materials and the look
mojulo draws on the web (its tone, ink, grass, sway, glow, sky, water, effects) do not, and a game's behaviour stayed in
a kernel of five mechanics. A game or level in Unreal was that surface with nothing mojulo does on it. A character, a
prop, a building, a robot or anything assembled in mojulo is different: as an asset, its geometry and colour are what
it is. So Unreal is an asset target now.

- **`export_model { ref, format: 'unreal' }`** writes an asset pack for any row that resolves to a model, beside
  Blender's `format: 'blender'`: the GLB, the recipe, an editor Python importer, its guide and README. `lit: true`
  hands the lighting to Unreal; `humanoid: false` keeps a humanoid figure on its flat skeleton.
  `node scripts/export-unreal.mjs --ref <ref>` writes the same pack and runs the advisory gate when `MOJULO_UNREAL`
  names an editor. A game is refused with the move: export its characters and solids by their refs.
- **The importer brings in one asset**, under `/Game/Mojulo/<ref>/`:
  - its meshes on mojulo's vertex-colour material (unlit, or lit under `lit`);
  - its own lights;
  - a preview map with a floor and a day light rig to look at it in.
- **A character arrives as a character.**
  - A rigged layered figure ships as one skinned mesh with its clips and face morphs: a SkeletalMesh and an
    AnimSequence per clip, its clip looping in the preview.
  - A humanoid one ships as the engine skeleton (VRM-named joints at the T-pose rest), turned to the world's facing.
  - Its IK Rig (`IK_Mojulo_<figure>`: the hips its root, one chain per limb named as Unreal's mannequin rig names its
    chains) comes with it, plus an IK Retargeter from the mannequin when the project holds the mannequin's rig (the
    Third Person template's `IK_Mannequin`, or `MOJULO_SOURCE_IK_RIG`), so the project's own animation plays on the
    figure. A re-import rebuilds both in place.
- **Verify** checks the preview map, the imported asset, its materials, its lights, each skinned figure's mesh and clip,
  and its retarget rig. With a skinned figure, `mojulo-gate.json` also carries a `diagnostics` block, facts not
  verdicts: the clips' asset names, the meshes' bones, where each mesh hangs in the actor tree, and each import step
  and whether it held. Every IK Rig and Retargeter call is tried and logged, since Unreal's Python API for them moved
  between 5.2 and 5.6.
- **Gone:**
  - `export_game { target: 'unreal' }`, the game and level packs (the menu and per-level maps, the promoted ground,
    the colliders and the PlayerStart);
  - the `MojuloKernel` C++ plugin;
  - the Night Run worked example, a game played in Unreal.

  The engine registry marks Unreal an art pass, as Blender is.
- **A placed engine skeleton stands where its entity stands.** A humanoid figure exported as the engine skeleton (a
  scene root in the VRM space, beside the z-up root) took its entity's z-up placement as is: about a metre off its spot
  and tipped over. It now takes the placement said in the VRM space, turned half a turn since the VRM front is the
  figure's back, the world's unit scale applied, and lands where the flat skeleton lands. This applies to every engine
  and to `export_model { humanoid: true, rest: 'tpose' }`. Only humanoid exports with a placed figure change.
- Not yet run in Unreal: the importer's run and the eyes gate are the operator's. The clips' asset names are read by
  exact name, else by the one asset that contains it, and the first gate run pins them.

### Chatbot sweep: what the chatbot factory left behind

- The chatbot factory left in 3.0.0. Its leftovers go:
  - The "nothing came back" guards: a server boot in a child process, and nine absence checks.
  - The 2.x upgrade shims, the moved notice above all. A removed bot tool or pack name is now an unknown tool,
    `mojulo install chatbot` an unknown pack (exit 1), and a `chatbot` token in `MOJULO_PACKS` is skipped as any unknown
    token is. `recommend_catalysts`' deployed-bot arguments, the `artifact_materialization` commit type and the `bot`
    worked example fall to their tools' ordinary refusals, and a catalyst's `requires.protocols` is no longer read.
  - The bot runtime's LLM helpers nothing called: the vision and per-model protocol gates and `generateSummary`
    (`lib/llm-providers.js` keeps the provider table, the model tiers and `generateStructured`).
  - The server instructions and `get_substrate` no longer carry the chatbot paragraph, and code and tests no longer tell
    the factory's history in their comments.
- Kept:
  - The retired-shelf prune of the semantic index, which drops any routing card or catalyst a release deletes.
  - A 2.x install's data stays readable: its documents, its stash bindings to a bot, its meta-context bot rows.

### Test tiers: the tests a change reaches, the whole suite in CI

- **`npm run test:changed`** runs the tests a change needs, picked off the import graph of control's own sources
  (`scripts/test-graph.mjs`, read statically in under half a second). It runs:
  - the test files that import a changed module (one hop; `--depth 2` adds its importers' tests, a branch's check
    before a merge), and a changed test itself;
  - every byte pin (`*.char` / `*.trace`) the change reaches at any depth;
  - its deep sweeps under the deep config.

  A source a module reads as text (inlined into a page, scanned for its keys) counts as a change to that reader. A
  changed data file runs the tests beside it, and a changed config runs the critical tier. Prose runs nothing. The
  e2e suites the change reaches are named, not run. `--since <ref>` adds a branch's commits, `--depth` reaches
  further, `--files` replays a change, `--list` shows the pick. A guard test fails when a module starts reading files
  beside it without being declared a reader of code or of data, so a hidden dependency cannot slip past the graph.
- **CI runs the whole suite, sharded**, three ways on each leg of the matrix, the e2e tier two ways, and the deep
  sweeps and the book once a leg. It runs on pull requests, on pushes to `main` and the release-candidate branches
  (`*-consolidated`), and on demand.
- `test:changed` runs every tier it picked even when an earlier one fails.
- The e2e job gives its test workers a 6 GB heap. `design-game.quick.test.js` was the worker that died on the macOS
  legs, out of V8's default heap; it ran there until the e2e tier moved to its own job.
- A stage's ends memo (`stageEnds`, `gameworld/levels.js`) no longer keeps each stage's whole face list: its height
  lookups keep the matching faces' corners only, about 8 MB a stage where it was about 29 MB. It keeps the last 16
  stages, the oldest dropped first, where it kept up to 64 and then cleared. A long-running server that made many
  games could hold gigabytes in it. Output is unchanged.

### Weapon swing styling: a swing drawn in the game's look, timed by its game type, fed to each action game

- **Mojulo Fighter hosts kinds of fighting game.** A versus game's rules may name a `kind` (`versus-kinds.js`): street
  (Street Fighter), anime-air (Guilty Gear), iron (Tekken), tag (Dragon Ball FighterZ) or platform (Smash). Each is
  data: its systems and dials under the game's own (the game's systems are added, a dial it sets wins), its input
  grammar, how its combos are built, its plane, and the look and game type its effects are drawn in. What versus does
  not run yet of each kind is said (`kindReport(kind).lacks`), never dropped. Four new versus systems, each off
  unless switched on (anime-air switches on all four):
  - `gatling`: a connected normal, on hit or block, cancels into a stronger one of its stance (L → M → H; air into air).
  - `airdash`: forward or back twice in the air flies level for `airDashDist` over `airDashFrames`.
  - `airjump`: up again, a fresh press, jumps again at `airJumpVy` % of the ground jump.
  - `reset`: the Roman cancel. L + M + H together during a move spends `resetCost` of meter and ends the move at once:
    on the ground the fighter stands, in the air it floats free; the page flashes RESET in the fighter's colour.
- **Iron, the Tekken-like kind.** It switches on four more versus systems:
  - `limbs`: four buttons, a limb each (L the lead hand, M the rear hand, H the lead leg, S the rear leg). Every
    player plays the limbs scheme, and each limb has its own normal at each ground stance: the recipe's `limbs`, else
    the first family of its tradition that strikes with that limb (jab, straight, front kick, roundhouse, and the
    crouching four).
  - `strings`: a fighter's strings, each press of the next following on in order, on hit, block or whiff, up to ten.
    Defaults over the limbs: 1,2; 1,2,4; 1,1,2; 3,4; and a ten-hit string.
  - `bound`: normals juggle a falling body, and a heavy blow on one slams it so it bounds back up, once a combo.
  - `sidestep`: a tap of up steps aside. Strikes and shots pass through for `sidestepInvuln` frames; a throw still
    catches. In 2D it is a dodge; tracking moves and circling are listed as lacks.

  A game's page fills in the limbs and strings a fighter's recipe lacks when its rules need them (`kindRecipe`).

  The air dash and the air jump share `airActions` per jump. Kombat is left out for now. An armed fighter's swing
  leaves a trail on the versus page in its kind's look, in the fighter's colour: flat hard bands held on twos (cel:
  anime-air, tag), an added glow with a white cutting edge (isekai: platform), or a faint short sheen (material: street,
  iron). A game without a kind draws none.
- **The held strike.** A gameworld hero who holds a blade or a staff in its right hand now swings it when the game's feel
  carries a string (the rule's contact window), where before it had no melee at all. A platform body playing the hero
  whose rule has a contact window and no strike of its own is armed with what it holds:
  - The runtime's five swing directions are the hero's own swing verbs: neutral its own word (else the chop), forward
    the thrust, back the cleave (the runtime's topple), and the rising diagonal to either side.
  - Each verb plays at the item's class, fitted so the strike lands as the window opens, at the world's game type when
    it names one, and knows its blow (`move` with its tip).
  - The rule takes the item's reach and the class's swing seconds and damage (any the rule names stand).

  A hero holding nothing, or a rule with no window, is as before (`hero-swing.js` HELD_SWINGS, `fitSwing`,
  `swingClipKeys`).
- **Hitstop, live.** A gameworld feel whose template freezes on a blow (`hit.hitstop`: frames at 60 fps, `base` plus
  `perMs` for each unit of the blow's shove, at most `max`) now carries it onto the hero's strike. Before, the readout
  listed it as not carried. A melee connect freezes the striker and the struck for those frames: no timer, rule,
  reaction or clip advances, then both play on. The blow's own frame plays out for both bodies, so both hold the same
  frames whichever comes first in the step. It is an opt-in runtime builder (`hitstop.js`, composed only into a page
  whose world has a body with a hitstop), so every other page keeps every byte. Godot and Roblox name it as not carried.
- **The blow flashes.** Under a composed juice floor, a melee connect throws a short flash at the contact in its spark
  colour. It lights the world (with the effect light), and the struck body's rim field flashes with it.
- **A swing knows its blow.** A hero's swing clip carries its contact data when packed (`move` on the clip, the GLB's
  `moj:move`): its word, hand and class, the impact's phase and the contact window as shares of the clip, its game type
  when timed, and the blade's tip (the item's point at rest on the hand's bone, which carries it rigidly), so an engine's
  hit test or trail can put a locator there. The tip, ridden by the packed hand frames, stays within a millimetre of the
  posed blade point at every frame. The phases a swing reports (`swingKeys`, the hero readout's `gear.<hand>.swing`) now
  fall where the player puts its keys: a normal swing strikes at 0.5, a light at 0.4, a heavy at 0.571. They used to read
  about 7 % of the cycle early.
- **The default swing, timed by its game type.** A hero's swing word (chop, thrust, cleave …) plays in a world at that
  world's game type: a composed floor's flavor (`fxStyle`, a gameworld's `juice`) re-times the swing's own keys when the
  World packs the hero (`hero-swing.js` `swingTiming`). Each role of the swing (the wind-up, the strike, the
  follow-through, the recovery) is scaled; an action game holds a heavy weapon's cock before the strike cracks, and a
  platformer's swing is short throughout. The strike and its contact window are re-read on the new timeline. The poses are
  the swing's own, and the rig's ease runs within each key. Realistic, the plain floor, or no floor leaves the pack as it
  was. The proving ground's swing takes play at their cell's game type.
- **The swing trail.** A composed floor (`fxStyle`, a gameworld's `juice`) draws a weapon's swing as its look draws
  it: isekai a bright glow ribbon shedding glints, cel flat hard-banded smear sheets held on twos, material a short faint
  sheen; the game type sets how long it lingers and how fast the blade must move to leave one. The page samples each
  hand's blade tip (the farthest point of what the hand holds) every frame and draws the swept blade. Its colour is a
  source: the weapon's element, the hero's power colour, the world's palette, a colour, or a function a caller passes
  (`resolveTrailColor`), by default the element, else the power colour, else the palette's accent. A gameworld's
  juice reads them off the game (`trailContext`: the hero's first power's element, else the direction's leading
  element; the character palette's first colour; the world palette's accent), its `trailColor` word or a source passed
  to `juiceOfGame(G, { trailColor })` choosing among them. The proving ground's `swing` and `swing-greatsword` takes
  (with `--rig`) loop a sword hero's swing in place.

### Juice styling: the effects drawn in the game's register, timed by its game type

- **The effects' floor is a composition.** `fxStyle: { register, look?, flavor, …dials }` composes the floor every beam,
  explosion and puff is raised to from two halves. The REGISTER is the art direction, anime or western, and sets
  the look. Anime is the contemporary anime game's (the gacha action RPG's effects): no ink line, a white-hot core
  into saturated ribbons in a near hue, soft trails, glints for sparks, a halo ring where a blow lands and glints
  drifting up after it, and smoke kept short and tinted toward the effect's own colour. Western is material: no ink
  line (an attack's own black edge becomes its glow), one colour, motion blur, streaks and chips, grey smoke that
  lingers and more light thrown on the world. The FLAVOR is the game type's animation (the animation selector's
  four: realistic, action, platformer, pinball) and sets the time: playback rate, anticipation, squash and stretch,
  arcs, echoes, the shake and the impact's flash, and a slight change of shape (round sparks and motes in a
  platformer, streaks at speed). Dials (JUICE_DIALS) pin any one number over both: among them `fps`, which holds an
  effect on its drawings (the page draws that only when an effect carries it), and `comic`, the manga ink burst.
  What stays global holds in every cell: an attack lands on its target (its landing re-read), a line stays a line,
  a laser one beam, a warm bolt burns and a pale ray crackles. A composed floor also styles the preset puffs it can,
  a beam's preset impact, the camera's shakes and a party battle's juice (its attacks, its holds and flashes at the
  game type's pace). `fxStyle: true` is the floor as it was, byte for byte.
- **Full anime, cel-shaded: a second anime look.** A register is drawn in one of its looks (`look`): anime's
  `isekai` (the contemporary anime RPG's, its default) or `cel` (full anime, the anime fighter's: the isekai look's
  high-res colour drawn in hard painterly shapes), western's `material`. Cel lays flat colour in hard bands round a
  hard white core across every strand, with companions in an accent hue, smears its afterimages, draws its sparks as
  speed lines, throws dark debris specks and a swirl ring from the blow, draws a blast's fire as spirit onions (below)
  and its smoke as a few bold flat puffs tinted its colour, glows as hard three-band discs, has no outline and no grey,
  and holds on twos. The page emits its bands and its cel glyphs only where a cel effect is. A gameworld's anime
  fighter or brawler is drawn cel unless it names a look.
- **Spirit onions: the form of a power-up.** `playscape/elements/aura.js`: overlapping onion shells round a centre,
  each a ring of flat cel petals along an onion's profile (a round bulb rising to a point), each spinning its own way
  at its own rate, and rings of spikes round them turning at their own intervals; each petal is shaded flat by how it
  faces the eye. A look wears one as its `aura` layer (the `power-up` look: a fast gold rim, the aura, sparks rising),
  and the cel look draws a blast's fire as one (the `burst` aura, sized to the fire, blooming and fading as it burns)
  in place of a spray. The page draws an aura only where a look or a blast carries one.
- **The characters' rim light: an effect expressed on the bodies it plays among.** `scene/effect-rim.js`: a composed
  floor gives every character a FIELD, a smooth shell a little off its body (its faces' corners welded where they meet
  and their normals averaged, so it is smooth over the whole model whatever its faces are; pushed out by the look's
  gap), its back faces only and kept off the body by the stencil the body marks, so it is one field round the whole
  silhouette, never an outline round each piece. It is drawn purely by its fresnel, in the colour of the effects round
  it (a beam's head going by, a charge at the hand, a blast beside it), falling off with distance. The look decides how
  (isekai a soft halo with a small gap, cel a hard band with the widest, material a hairline) and the game type how
  strongly (action strongest, realistic least); a status's coat takes the look's rim too (a cel band on a cel look). The
  `rim` dial sets it (0: none). It reads the effect light's lights of the frame, gathering them even where the world is
  not lit by them (`fxLight` off), follows the bodies only while a light is live, and exposes the characters' bodies only
  where it is on. The proving ground's `--rig` stands the caster and target up as live characters and
  `--close caster|target` frames one.
- **A gameworld's `juice`.** `juice: 'auto' | false | { register?, look?, flavor?, …dials }` lays the composed floor on
  every level as `fxStyle`. The register comes from the game's tradition: the character book's direction, else the
  kit's pole as the colour theorist leaves it. The game type comes from the feel's template, else the genre's. A
  composed world writes `'auto'`; design_game's readout reports the floor a world lays, or suggests one (a `juice`
  step) for a world that writes none. A world without the word is drawn as it always was. The drawer card is
  `gameworld-juice`.
- **The juice board.** The effects proving ground takes `--juice <register>:<flavor>` and `--board` (every cell of an
  effect, side by side); `juice-sheet.mjs` steps each cell in headless Chrome into a contact sheet. These are the eyes
  gate's material, not its verdict.

### Game feel: the lab's templates in the game loop

- **A gameworld's `feel`.** A game names one of the action lab's templates (`feel: { pole, variant?, toward?, t?, set? }`)
  and its hero moves by that template's card: the run, the ground's acceleration, the jump's height and its gravity
  up and down, coyote time and the jump buffer, the shortest hop, air control, the jump's gather, air jumps, the 2D
  lane. The card is lowered into the platform rule the runtime already plays, laid over the hero's own; what the
  runtime does not carry yet (hitstop, the parry, the hold-release charge, offense armor, a roll's invincible frames,
  the runner) is said in the game's readout, never dropped silently. The cards and templates moved from the lab into
  `lib/graph/gameworld/feel/`, so the card a game is made from is the one the lab plays and holds to its laws.
- **The feel book: sample a made game's controls.** A world that writes a feel has a third book beside its world
  and character bibles (`/api/sketches/<ref>/bible?book=feel`, a `feel` exit on its project page): the action lab's
  stick view locked to the game's own card, on its template's stage and viewer, to run, jump and strike as the game
  will. Each template shows only what it is about (its `demo`: Galaxy Boy the run, the jump, the wall kick, the dash
  and the buster; the runner its lanes, the jump, the roll and the boost): those keys, buttons, dials, readouts and
  strip colours, and only their buttons answer; no prose, the demo speaks for itself (the dials try changes on the
  page only). The gameworld bible names the feel and links to it. The stick view's kernel, page, takes and the hero library's flavors moved
  from the spikes into `lib/graph/gameworld/feel/` (the lab and the animation spike re-export them), and the takes bake
  only the game's base feel on one body, once per process.
- **Genre defaults, suggested and written.** A world that writes no feel is suggested one in `design_game`'s readout
  (a `feel` step with its reason): from the brief's words ("souls-like", "mega man", "endless runner"), from a
  deathmatch's shooter pole, or from its genre (a collectathon plays Jumping Giuseppe, a metroidvania Galaxy Boy, an
  arena shooter Infinity Crisis, a brawler Fallen Angel; a genre off its feet suggests none). A world composed from a
  prompt that names a template has it written. Nothing is laid behind the recipe's back: a world plays the feel it
  writes, so games already made move as they did. The shooter pole is one dial with the feel (Conscription toward
  Infinity Crisis), and a written feel wins over a quick game's own feet. Each genre's card names its feel.

### Action game unification: one feel for the button, the body and the clip

- **A lab, nothing registered** (`scripts/spikes/action-lab/`). The animation-games spike retimed a take on its own
  clock; a game runs on the player's. Measured on the spike's registers, the press waits for the clip: the action
  register's jab is its slowest (14 frames to contact against realistic's 11) and every register's jump waits 10 to
  30 frames for the clip's gather. The lab makes the press the beat. A *feel* card (realistic, action, platformer,
  pinball) says what each button does: ground acceleration and turning; the jump's commit, buffer, coyote time, cut,
  rise and fall gravity and hang; a dodge with invincible frames; a three-move string with startup, active,
  recovery, cancel and buffer; hitstop on both bodies; hitstun by its source; knockback by the force model; what a
  wall does. One pure step function plays the card at 60 Hz in node and in the page, over a *body* (the character's
  reach, real blow and strides), so the same card on the female cast reaches shorter. The hero library's clips are
  fitted to the frames it decides, so the fist meets its contact point on the card's startup frame, and realistic's
  card is the take's own time. `verify.mjs` is the machine gate over scripted pads. It holds on both casts: buffer
  and coyote windows to the frame, apex to the millimetre, hitstop on both bodies, a chained hit's advantage equal to
  the printed frame data, invincible frames, no body through a wall at 20 m/s, every press acted on or dropped with
  its reason, byte-identical traces. `lab.mjs` writes a playable page (keyboard, gamepad, touch) with the feel
  switch, the dials, a frame bar, the event log, frame data and a recorder whose runs become fixtures. The eyes gate
  is open.
- **Jumping on a body, in the lab** (the card's `land`). Bodies no longer pass into each other. Realistic and action
  slide off a body's top into open space; action adds the enemy step (a jump pressed in the air touching a body is a
  fresh jump). Platformer stomps (the body squashed and stunned, the bounce 0.6 m or 1.81 m with the jump held), and
  pinball's spinning body bounces off like a bumper while the body ricochets. A short critter (0.8 m) gives every
  feel something to land on. The gate holds 79 laws on both casts, with a recorded stomp among its fixtures.
- **Game templates in the lab: the poles, each in its own viewer.** Eleven templates, the sane defaults a game starts
  from and the poles its movement is tuned between: Fallen Angel (DMC), Ebon Spirits (GoW, Souls), Cogs of Combat
  (Gears), Infinity Crisis (arena and hero shooters), Conscription (the contemporary FPS), Steel Serpents (Metal Gear),
  Vigilante Justice (superhero games), Mech Battle Kai (mobile-suit-arena), Jumping Giuseppe (the mascot platformer),
  Isekai Party (the RPG) and Mojulo Fighter (the 2D fighter: mojulo's versus loop). Each is a base feel
  with its movement and animation fields, a viewer, a stage and the primitives it still needs; any two blend. The page
  opens each in its own viewer, after mojulo's gameworld cameras: third person, over the shoulder, first person (an arm
  that bobs, dips, reaches and kicks, and a crosshair), the mech's chase, isometric, overhead and side, alongside the ¾
  follow. A lane rule holds the 2D games to their plane, the fighter facing its foe. The gate holds 326 laws on both
  casts.
- **Mojulo Fighter is mojulo's versus loop, in the lab.** The template no longer approximates a fighter with a lab
  card on a lane: the page inlines versus (its pure modules and runtime) and steps a real match, you as P1 on the
  lab's keys (J K L light, medium, heavy, U the special, Q or I the throw, as versus's own page), the CPU or versus's
  training dummy as P2, your fighter, the opponent, the control scheme and your super picked in the header. The lab's
  tools read it from outside: every press acted (the move, the frames it waited) or dropped with the state it met,
  the clock stopped through hitstop as versus keeps a press made then; the frame strip, the frame-data card and
  versus's boxes. The bodies are the lab's sticks on versus's rig, side or ¾. Blended toward another template it
  becomes a lab card made from Kata's own numbers (held equal to `compileFighter`), which leaves the floor, peaks and
  lands its light on versus's frames. `stepMatch` takes the pads a host read itself (`versus-runtime.client.js`).
- **Two more templates in the lab: Galaxy Boy and Commuter Rail Runner.** Galaxy Boy (Mega Man X) is the platformer's
  X movement with a run-and-gun's buster: the attack's tap is a small shot from anything but a hurt, a few out at
  most, and the same press charges. Commuter Rail Runner is the infinite runner on pinball's body, a new `runner`
  rule: the track comes at the hero faster and faster, seeded rows of barriers to jump, overheads to roll under,
  trains to dodge and coins to gather, a stumble and then the end; its variants are the rails (three lanes) and the
  slope (the ball steering free), and any template may now carry variants. The runner draws as a scrolling track to
  the horizon behind the hero.
- **Supers that lock, in versus** (`lib/graph/versus`: a super's `lock`). The first blow that lands catches; the rest
  is a script: a blow every few frames, each its share of the super's damage scaled once by the combo it caught, both
  bodies untouchable and unthrowable, then the finish, a knockdown or a launch. Two kinds: the **hit-combo super**
  plays in the fight with the clock running, the **cutscene super** stops the clock while the page cuts away (closer
  in, darkened and letterboxed). Blocked it is one blocked blow; whiffed, a whiff. Versus's shelf ships one of each
  (`super-chain`, `super-cutscene`), any fighter takes one by `super`, and a recipe's own super takes a `lock`. A caught
  body replays the impact on each blow (`versus-react.js`). Fighters without one fight as before.
- **The heavy-robot rules and the mech, in the lab.** mobile-suit-arena's movement (mojulo's controllable rules) split
  into rules that overlap, each a card field any feel may carry alone: the boost (an instant held thrust on a gauge
  that overheat-locks, its jump and turn costs, an inertia skid), the hover cushion under it, Armored Core's quick
  boost, the stop-and-charge jump, a heavy gait that dips at each footfall, landings that lag by the fall, a grown
  body. The mech is one composition of them laid over any card as a mount (its combat kept, its movement the
  mech's), so it is its own game or a thing to ride in another; one weight knob blends MSA's heavy suit into a swift
  Armored Core frame, and the glider and jetpack ride along. The page draws it heavy (thick limbs, a boxed head,
  footfall shake, a lean and a flame on the boost) with a boost gauge. The gate holds 322 laws on both casts, with
  recorded heavy and swift runs among its fixtures.
- **The loadout, in the lab: mobile-suit-arena's weapons** (the card's `loadout`). Lifted from mobile-suit-arena,
  whose weapons are mojulo's controllable rules, with their field names and meanings: the switch's ready time
  (re-armed each switch, a slot's own winning), the cooldown (auto at a rate of fire, semi with a committed burst), a
  magazine or an energy pool that overheat-locks, a charge shot, the auto-reload that runs for stowed weapons too, and
  the sight, area (assist ring) and lob (gravity, splash, proximity fuze, arm time, fuse) classes. Shooting no longer
  ends a jetpack flight. Realistic carries MSA's machine gun, long rifle and grenade, action a mobile suit's beam rifle,
  hyper bazooka, head vulcan and V78 energy rifle, the platformer a buster and a special weapon; pinball none. What
  would rework the lab rather than add to it stays out (the targeting cones, spread and recoil, damage and poise, melee
  slots). The gate holds 297 laws on both casts, with recorded runs of a switch and a jetpack gun run.
- **The glider and the jetpack, in the lab** (the card's `glide` and `jet`, chosen as gear). Either takes the jump in
  the air once the air jumps are spent, held past the apex or pressed. Realistic's glider is a paraglider opened from
  a height with a stamina limit and its jetpack a slow thrust on a small tank; action glides and hovers; the
  platformer floats for a second and its jetpack is a strong short burst; pinball glides from a slow start into a wall
  grab and flies by flapping until it tires. A hit, a move, a dash or a wall ends a flight; with no gear nothing
  changes. The gate holds 269 laws on both casts, with a recorded glide, jetpack burn and flight among its fixtures.
- **Ranged attacks, in the lab: the enemy's patterns by genre, what a hit does, maneuver armor.** The dummy turns
  shooter and fires its genre's patterns after a telegraph: realistic's are the FPS's, hitscan (a rifle burst whose
  aim trails the target by a reaction, a marksman whose aim locks before the shot), denied by cover or by moving
  across the aim rather than dodged; action's arena fires orbs, fans, a low ring and homing shots, its brawler set a
  low knife and a gun that knocks down; the platformer's and pinball's shots are slow (spreads, aimed shots, a lob
  that bursts, a weaving shot, a bouncing ball). What a hit does is the card's: realistic flinches (control kept, the
  run slowed), the others are knocked back and stunned, then invincible for a mercy (none in the FPS), out of the
  charge or not as the card says. A hit takes life: health, or pinball's rings (all scattered, the next hit the end),
  or one-hit; out of life the body is down, then up again. Maneuver armor cuts a hit's stun and knock while the body
  moves in the card's ways: action's dash and sprint shrug the stun off, the platformer's dash halves it, pinball at
  speed keeps going. The gate holds 247 laws on both casts, with recorded runs of a rifle burst and a marksman's miss,
  a perfect-dodged orb and a shot passing through the mercy among its fixtures.
- **Offense armor, in the lab: what it takes to interrupt an attack.** Every hit is tagged (light or heavy, and its
  kind: shot, stomp, launcher) and every attack may carry armor through its startup and active frames: none (any hit
  interrupts it), interrupted only by hits with certain tags (heavy attacks only, or a trigger such as a shot), by its
  nth hit (poise), or hyper armor (nothing interrupts it). A hit the armor holds against clanks: no stun, no push, the
  attack goes on. The dummy's jab stops at any hit, its hook only at a heavy or a shot, its perilous blow never;
  realistic's charged haymaker shrugs off one light hit, action's heavy every light one, its launcher everything. The
  page draws a halo on an armored body and the frame data gains an armor column. The gate holds 212 laws on both
  casts, with a recorded run of the dummy's three attacks among its fixtures.
- **Hold and release, in the lab: the charge** (the card's `charge`; every feel). The attack's press still acts at
  once, so the tap is never delayed; holding on charges it, and the release fires the charged attack on its own frame
  at the level the hold reached (a release short of the first level fizzles). Realistic and action charge a heavy in a
  slow stance (action's second level a launcher), the platformer charges Mega Man X's buster and fires a shot from
  anywhere while it runs and jumps, and pinball revs Sonic's spin dash, aimed by the stick. A hit taken loses the
  charge. The heavy's rows join the frame data. The gate holds 198 laws on both casts, with a recorded launcher and a
  recorded full-charge shot among its fixtures.
- **Guard and parry, in the lab: the attack's arc and its zones** (the card's `guard`; realistic and action). A held
  guard blocks a hit from the front, with a blockstun and a push back. Every enemy attack swings across an arc drawn
  on the floor through its telegraph, red with an orange segment: a hit met in orange by a guard pressed in time is
  parried (the attacker staggers open for a riposte), met in red it is only blocked, and some attacks are all orange
  or all red and unblockable (dodge those). The sparring dummy cycles a jab, a sweeping hook and a perilous blow.
  Realistic's guard spends stamina and breaks when it runs out; action's perfect dodge slows the attacker to half
  speed. The gate holds 171 laws on both casts, with a recorded parry and riposte among its fixtures.
- **Lock-on, in the lab** (the card's `lock`; realistic and action). A lock button takes the dummy as the target in
  range and lets it go on the next press or when it walks out of range. Locked, the body faces the target, the stick
  strafes, attacks go at it, and the rolls circle it: a side roll arcs round the target at its distance, forward
  closes, back opens. The page's camera swings behind the hero to the target and reads the stick against it. The gate
  holds 151 laws on both casts.
- **Two getaways, in the lab: the directional roll and the dash.** The dodge button is now a directional roll: it
  goes the way the stick points while the body keeps its facing (a roll forward, to either side, or a hop back, each
  its own clip), and with the stick at rest it is a shorter backstep. A new dash button carries the dash and all of
  Mega Man X's moves; action gains a quick ground dash, and realistic, which steps rather than rolls, has none. No
  feel rolls in the air. The gate holds 139 laws on both casts.
- **The dashes, in the lab** (Mega Man X; the card's `dodge`). On the three non-realistic feels: an air dash with
  gravity off, once an airtime (landing and walls give it back); the dash jump, a jump inside a ground dodge that
  leaves on the press and keeps the dodge's speed through the air; and the dash wall jump, which kicks at the dash's
  speed and keeps it. The platformer's dash is X's, lasting while the button is held. The gate holds 127 laws on both
  casts.
- **The air jump and the wall, in the lab** (Mega Man X; the card's `air` and `cling`). On the three non-realistic
  feels, a jump in the air is an air jump while one is left, and falling against a wall with the stick into it slides
  down it at a constant speed. A jump on the wall kicks off it up and away, the stick locked out for the kick's frames,
  and the wall's coyote time keeps the kick a few frames after leaving. Holding back toward the wall, action and
  platformer climb one wall kick by kick; pinball cannot, its kick outrunning its air control. Landing and walls give
  the air jumps back, and the arena gains a tower to climb. The gate holds 112 laws on both casts.
- **The stomp attack, in the lab** (the card's `pound`): an attack in the air turned downward, dropped in a straight
  line. Action's plunge (back + attack) launches a body it lands on or hits one beside it with a shockwave, then lags.
  Platformer's ground pound flips in place, drops, stomps harder and always bounces high, and a jump in its lag is the
  higher ground-pound jump. Pinball's bounce attack rebounds off the floor or a body. Realistic has none. The gate
  holds 92 laws on both casts. The page's spin poses (the flip, pinball's spin jump) drew nothing until now: they
  turned about a joint the drawing does not carry.
- **Ground acceleration in the platform rule** (`rules-platform.js`, opt-in `accel` and `decel`). The first of the
  lab's pieces in the live rules. The body carries a planar drive that builds toward the stick at `accel` and sheds
  at `decel` (default `accel`). In the air both rates scale by `airControl`, and an unpushed body keeps its drive, so
  momentum carries through a jump. A root (charge, kneel, swing, dodge, tackle) stops it at once. A boost sets it to
  the dash, so letting go of F sheds the dash; with `boostInertia` the skid owns the release instead. A wall takes the
  part of the drive that went into it and the body slides on, a lane keeps it on its tangent, and a body a reaction
  owns stops driving (the `drive-stop` suppressed tick). Absent `accel`, the direct step runs byte for byte: the
  controllable trace pins hold, and the 14 controllable pages' emission pins move only by the rule's own source. The
  Godot kernel runs it too (`rules.gd`, held by a new `platform-accel` conformance scenario); Roblox leaves it to the
  Humanoid's own feel. The `controllable` vocab card names it.

### Trademark policy

- **`TRADEMARKS.md`** says how the mojulo name may be used: fork freely under your own name; "powered by
  mojulo" as a description, never in a product, package, domain or handle. The README, `NOTICE` (shipped in the
  package), `TERMS.md` and `CONTRIBUTING.md` point to it. The code stays Apache 2.0.

### Animation games spike: one take, four flavors

- **A research spike, nothing registered** (`scripts/spikes/animation-games/`). A *flavor* renders a take the hero
  library already solves (a strike, a jump, a reaction) for the kind of game it plays in. It keeps the take's poses and
  changes its timing, how far it winds up and follows through, its holds, squash and smears, and the force a blow hands
  on (the *powerscale*: the victim's change of speed against a body on earth's). The four flavors are `realistic`
  (the take as solved, a blow's real momentum), `action` (a deep wind-up, a snap, both bodies frozen for a hitstop that
  grows with the blow, the victim thrown), `platformer` (quick starts, squash and stretch at take-off and landing, a blow
  is a boop) and `pinball` (the take plays faster the faster the body travels, smeared, a hit ricochets). Every cosmos
  genre picks one, and the operator's word overrides it. `verify.mjs` is the machine gate. Contact lands on its point in
  every flavor, realistic is the take frame for frame, and renders are byte-identical. `preview.mjs` writes a
  side-by-side player and filmstrips for the eyes gate, which is still open. The README's findings name the integration
  costs: the 12-key linear packing smears holds and snaps, and hitstop, knockback and rate by speed belong in the live
  rules, not in the clip.
- **Motion: running, then jumping** (`motion.mjs`). A run-up from a jog, the running jump, the landing and a run-out,
  with the body travelling through the world, in the same four flavors. Each flavor sets how fast speed builds and how
  high it tops out, whether the stride keeps pace with the ground (planted feet) or outruns it (pinball's wheel of legs,
  never under four frames a stride), the take-off contact, and the arc: the clip's own on earth's gravity, a hang, or
  the platform rule's rise on 20 and fall on 34. Pinball flies a tucked spin (the forward roll's tuck, whole turns as
  a ball of it would roll, never under 8 frames a turn) in place of the leap. The clip's take-off and landing are the
  flight's ends in every flavor. `motion-verify.mjs` is the machine gate. `motion-preview.mjs` writes follow-camera players and a
  chronophotograph. The findings: the jog → sprint blend slides a planted foot (worse the faster speed builds), the
  platform rule has no acceleration on the ground, and the library has no start from standstill.
- **Collision: walking or running into a wall or another body** (`collision.mjs`), in the same four flavors. The
  flavor decides what the impact does to each body: real momentum, the change shown ×3 with the charger driving
  through, a fixed bonk or boop, or a bumper that gives back more than it got. One shared ladder of the library's
  responses (`hitHigh`, `stagger`, the `knockedOut` collapse, pinball's tuck) picks the reaction from the change shown.
  No trunk passes the wall or the other body. `collision-verify.mjs` is the machine gate, and `collision-preview.mjs`
  writes a player and strobes. The findings: the library has no clip that braces a hand against a surface (the forward
  hand passes 11–26 cm through), and the charge is a flavor rule, not physics.
- **The wall's property** (collision): a non-realistic wall is bouncy (tunable: a restitution, or a fixed rebound and
  hop), a treadmill (the gait goes on in place), or sticky (the body turns onto it and walks up, or climbs it hand over
  hand). The climb is built from the rig's own leg solve and `reachArm`, since the library has no climbing clip. Its
  palms meet the wall within 1.5 mm and its holds hold. A realistic wall refuses a property. A walk into a bouncy wall,
  or into a body, now walks in place instead of freezing as a block.
- **Weapons** (`weapon.mjs`): the hero library's swings (chop, thrust, rising, the two-handed cleave) at each item class,
  in the four registers. Realistic is the rig's own swing. The others show the weight more or less: action charges a
  heavy blade, draws a trail, and freezes longer for a heavier weapon; platformer flattens every weapon to one snappy
  swing. The blade's tip lands on its contact point in every register, and the blow is the body's real tip speed times
  the weapon and arm. The finding: `swingKeys` reports the strike about 7 % of the cycle earlier than the rig's player
  plays it.
- **Combos and hitstun** (`combo.mjs`): strings of 3 and 5 hits (fists, a sword) cancelled one into the next against a
  simulated victim. Hitstun is one law in every register (the next hit links if it lands inside the last hit's stun,
  and a free victim blocks), with a stun from four sources:
  - realistic: the body's reaction time
  - action: the game's combo rule, decaying, ending on a launching finisher
  - platformer: none, with mercy invincibility instead
  - pinball: none, since the ricochet takes the victim out of reach

  The findings: a realistic jab string sits within a frame of the reaction time; action's decay drops a sword
  string's finisher by a frame; strings need a step-in the library lacks.
- **Two views:** every player draws each pane from the side and from a ¾ overhead camera over a floor grid.
- **One review page** (`viewer.mjs`): every part's player, strobes and machine gate on tabs, for the artifact host.

### The man walks his own wider base

Both casts walked the one calibrated walk (figure-posing.js WALK_MINT under hero-gaits.js HERO_WALK), its feet on a
narrow base (`stepWidth` 0.05). On the man that read as a catwalk: his ankles came onto one line as they passed, and
his legs ran 6 cm through each other but for the swing going round the planted leg (the pass, below), a circumduction
a man's walk does not show.

- HERO_WALK_POLE (hero-gaits.js) is a walk by the hero's silhouette, over HERO_WALK. The man's is `stepWidth` 0.16:
  his feet land 10 to 11 cm apart (men's heels about 10 to 13), his legs clear each other on their own (by 9 mm on the
  game body, 23 mm on the realistic) and the swing goes straight through, nothing for the pass to solve. The woman, a
  child and a chibi keep the narrow walk.
- It is stamped with the walk at mint (motion-stamp.js stampHero reads the adult cast's silhouette, stampHeroMotion
  `pole`), so a hero stored before keeps the walk it was written with, and a creator's own `stepWidth` stays theirs.

### The realistic body rounded out

REALISTIC LAWS 4 (body-relational-builds.js `ROUND_OUT`, read by layered.js realisticBuild). Read off each limb's rings
and the body's CT stack (horizontal cuts every centimetre, the front and side silhouettes and each contour's peaks),
the athletic builds read as an action figure's in their limbs: each joint pinched between its bellies (the man's thigh
5.3 cm of girth under his knee just above it, hers 4.2), the wrist half the forearm's belly (14.3 cm against 29; people
about 0.6), the forearm dropping from its belly to the wrist in a step (2.4 cm of girth per cm), a knot of the
adductors' origin under the groin, and every limb mass joined in a tight crease.

- The limbs' masses re-proportioned, data only, by mass id: the blend between a limb's masses widened (× 1.35); the
  forearm's bone fuller at the wrist and its bellies reaching toward it; the outer quadriceps and the hamstrings reaching
  nearer the knee, the knee's knob slimmer; the adductors' origin a long flat sheet into fuller adductors; the calf's
  outer head higher and reaching up to the knee, its inner head lower and fuller, the soleus less wide.
- The rhythm the bellies had is kept, not made a cylinder: the thigh's outside still peaks high (0.45 of the thigh) and
  its inside low over the knee (0.81), the calf behind at a third of the shank, its inner head the lower.
- Measured on his limbs: the pinch over the knee 1.8 cm (was 5.3), the wrist 18.7 cm against a 30 cm belly (0.62), the
  forearm's steepest fall 1.5 cm per cm (was 2.4), the pinch under the knee 0.6 cm (was 1.4); hers 2.5 at the thigh's
  top (was 4.2 over her knee), the wrist 0.59 of her forearm.
- The knee and the elbow STITCHED (body-relational.js formSlice `stitch`): the upper segment's last ring and the lower's
  first are one ring at the joint's plane, the same points (the shank rung 32 round, as the thigh), so the two shells
  are one surface and the shading welds across it. Handed over by overlapping across the plane, the upper's skin tucked
  3 mm inside past it, the two skins crossed nearly flat with each its own facets, and every knee and elbow wore a
  jagged line in the light; a steeper tuck did not clear it (the rings stand 1.4 to 2 cm apart, so the crossing is a
  facet wide wherever it falls). The stitched end's cap turns back into its own segment. The shared ring keeps the
  segment's end address (the upper's last station, the lower's first), so dress and armour addressed up to a limb's end
  (an elbow's plate) still land on it. The gi's sleeve, copied off the arm, stretches 4.8 cm over a sprint's bent elbow
  (3.2 under the round-out alone, the sleeve smooth there): its test's bound is 5 cm, a spike still tens of centimetres.
- Not yet: a knee bent past about 100° (the sprint's) folds behind, the thigh's skin passing through the calf's (the
  blend of the hinge's bones, as before, where the overlap hid a little more of it): a flexion corrective, as the
  shoulder's, is the fix. The wrist's, the shoulder's and the hip's handovers keep their own seams.
- A realistic hero stored before keeps its laws and its limbs.

### The game body's head seated on its neck

HERO LAWS 16 (hero-form.js `CERVICAL_LEAN`, tiered-form.js `TIERED_OCCIPUT`, humanoid-head-fit.js's `occiput` move).
Read on the game body's midline silhouette, the landmark head stood over the body where a person's does (its ear over
the shoulder joint), but its neck rose all but upright (3°) under the back of the head, and the man's fitted skull was
short behind the ear (18.5 cm long, the ear at 0.41 of its length from the back; people about 0.45): his skull's back
stood 2.2 cm behind his nape (people 4 to 5), so in profile his head read hung forward off the neck. The anime heads
were left as they are.

- The landmark head's neck leans forward up to the skull, as the cervical column runs from C7 up into the skull's
  base: 6° for the woman, 5° for the man (on every game body that wears the landmark head, the child forms' too).
- The man's skull is deeper behind the ear (the fitted head's `occiput` feature, set by the tiered face): the points
  behind the ear root move back, fading out at the ear and below it toward the jaw's angle, so the back of the skull
  stands out and his hair follows it. The face moves no more than about a millimetre, where the fitted surface's
  triangles over the crown and the cheek span both halves.
- Measured on the midline: his skull now stands 4.2 cm behind his nape (was 2.2), his jaw 4.7 cm past his throat (was
  4.9); hers 5.1 cm (was 4.3) and 6.0 cm (was 6.4).
- A statue minted now leans its neck the same way (its carved figure is a landmark hero); the realistic body keeps its
  own neck (realistic laws 3: `heroPlan({ seat: false })`).
- A hero or a statue stored before keeps its laws, its neck and its skull.

### The realistic neck leans up into the skull

REALISTIC LAWS 3 (body-relational-builds.js `CERVICAL_NECK`, read by layered.js realisticBuild). Measured on the
midline skin, the realistic hero's head stood where a person's does over the body (the ear over the shoulder joint; C7
at the cervicale's height, 0.85 of the stature, the craniovertebral angle about 60°, people 50 to 55), but sat forward
on its own neck: the neck's mass rose straight from the trunk's top, so the nape stood under the back of the skull
(the woman's occiput 2.8 cm behind it, people 4 to 5) and her jaw jutted 7.2 cm past the throat (people 5.5 to 6.5).
In profile the head read as hung off the front of a post.

- The neck's column now leans forward from its root up to the skull, as the cervical spine runs from C7 up and forward
  into the skull's base, and is a little fuller under it. The head stays where its fit sets it; the column's top comes
  forward under it, by the build's own `lean` (hers further: her jaw had jutted the more). The one skin's seam and the
  column it blends into the skull follow the neck's rings, so the head's own neck comes with it.
- The woman's occiput now stands 4.0 to 4.3 cm behind her nape and her jaw 5.5 cm past her throat. The man's occiput
  3.7 to 3.9 cm behind his nape (it was 3) and his jaw 4.7 cm past his throat (it was 6): a compromise, his jaw already
  in range before.
- A realistic hero stored before keeps its laws and its neck.
- Fixed: the head's piercings, scalp hair and face hair were kept (layered.js) by the head's fit alone, though they are
  pinned to faces of its skin, which also moves with the neck it is cut on and the rung it is netted at. A hero minted
  after another of the same face under other laws or another target could wear the other's pins, and fail to compile.
  They are now kept by the head they were grown on.

### The legs pass each other: the walk's swing goes round the planted leg

The hero's calibrated walk (the door's default, figure-posing.js WALK_MINT and hero-gaits.js HERO_WALK) sets the feet
on a narrow base, about 5 cm apart, and swings each leg straight forward in its own plane. On every body the swing
leg's calf ran through the planted one for about a third of each step (measured on the legs' own girths: up to 58 mm
deep on the realistic woman, 52 mm on the realistic man, 57 mm on the game body's woman), the fuller thighs and the
wider hips reading it worst.

- THE PASS (hero-stride.js, heroLocomotion). People keep that line without tripping because the swing leg goes AROUND
  the stance leg: the foot leaves its line after the lift-off (a little hip abduction, circumduction), passes wide at
  mid-swing with the knee bent and the thigh already ahead of the upright stance thigh, and comes back onto the line
  only late in the swing, past the planted foot, landing in front of it, the weight over the planted foot the while.
  The walk now does that: `swingBump` times the excursion (out over the swing's first third, held through the pass,
  in over its last), and heroLocomotion solves its size, the least that keeps the legs `swingClear` apart (8 mm) at
  every phase of the swing, on the legs' capsules (`legGirths`, `legClearance`: each leg's radius by its bone's share,
  read off the body's own rings; the inner thighs' contact under the groin is the body's, never a collision). On the
  realistic woman the foot goes about 8 cm out at the pass and the legs keep the gap at every phase.
- A walk minted now carries the dial (HERO_WALK `swingClear`, stamped with the walk) and the body's girths ride its
  recipe's `locomotion` (layered.js), so the World page, the export and every reader compile the same walk; the solve
  is kept per rig and body (a page compiles its clips on every read). A walk stored before passes straight through,
  as it did.

### The cervical chain: a head aim within the neck's range

HERO LAWS 15 (hero-form.js; the rig's `cervical`, figure-vajra.js `CERVICAL_CAP`). A `head` pose word aims the skull's
axis, atlas to crown, and the vajra swung the skull ALONE at the atlas in a 45° cone, the neck's column still. The
form's own wave aimed that axis 72° forward on one key, as if it were a gaze, so every hero's wave nodded the skull the
whole 45° at the atlas and snapped back on the next key: the neck craned down and the face looked up out of it.

- The head and the neck are posed as the CERVICAL SPINE, each segment within its own range, asymmetric as the anatomy
  is: the neck's column (C2–C7, bending at its root) flexes 35°, extends 55° and bends 35° to the side; the skull on the
  atlas (occiput–C1) nods 12° forward, 20° back and 6° to the side. Together about 47° of flexion, 75° of extension
  and 41° of side bend, an adult's cervical range. The axial turn keeps its split (C1–C2 carries most of a glance).
- A head aim alone is the whole chain's: held to the chain's range in its direction and shared by each segment's share
  of it, so a nod bends the neck more than the atlas, never the atlas alone. A neck and a head both named are each held
  to their own. The chain reads AIMS (a direction: the words a clip or an agent writes); raw angles (`{ yaw, pitch,
  turn }`) stay each joint's own channel, for a solver that splits the neck and the head itself (hero-aura.js's gaze),
  so the aura's poses and every statue carve as they did.
- The form's wave holds a small look while the hand waves: the skull tilted about 7° toward the raised hand and about
  5° back. Laws 1 to 14 keep their wave and the cones, byte for byte; every other figure keeps the cones.
- The layered vocabulary says what `head: {x,y,z}` is (the skull's axis, not the gaze), and `/hero-live`'s takes say
  their looks in it.

### The realistic head as one skin

- REALISTIC LAWS 2: A HERO MINTED NOW WEARS ITS HEAD AS ONE SKIN (hero-one-skin.js). The relational head's field is
  netted whole, globes and ears left out, in place of the pieces the head was cast in (the cranium, the jaw, the visage,
  the nose, the eyes), whose hand-overs read on the World page as torn sclera at the lower lid, patches at the nose and
  the lips, and a crescent under each eye. The skin is joined smoothly to the neck and cut off on the neck's seam ring,
  every seam point a point of its rim. It is netted along its surface (skin-net.js `netSkin`), made sound where the net
  pinches (`soundMesh`, `closeHoles`), and quadric-simplified (`simplifyMesh`). The eyes, the nose and the mouth keep
  more of the faces. A layer-1 part may now be given as a mesh (station-loft.js `meshPart`), bound per point and shaded
  by its own normals. A hero stored under laws 1 keeps its pieces, byte for byte.
- THE LIPS are cut exactly on their line: each face across it is split there and the points on it doubled, the upper
  lip's the head's and the lower's the jaw's, so the jaw bone parts them. Each lip is turned in along the cut, and a
  closed mouth bag sits behind them (`mouth`). A collapse never carries a point across the line, and a point is bound
  by its side of the cut.
- THE EYES: each globe is its own closed part (`globeR`, `globeL`), built as rings about its gaze set on its field. The
  pupil's and the iris's edges are rings of their own, so they read crisp at any count. The skin texture paints the
  whole skin, and the eyes' paint no longer takes the lids' margins (where the crescents came from).
- THE FACE RIG on one skin (`oneSkinFollow`): each action moves the rest skin's own points, never re-nets it, so its
  faces stay. The muscles' beads carry the face. The lids turn about the globe's centre as far as the eye rig's own
  margins moved: a blink shuts them over the globe, a raised brow lifts the upper lid, a smile's squint the lower. The
  hair, the brows, the lashes, the beard and the piercings ride the skin (pinned to its faces).
- A PIPE, NOT A SET OF HEADS: rolled faces no eye has seen (both poles, populations the composer reads differently)
  each pass the machine gates unattended (hero-one-skin.deep.test.js). The skin, the mouth and the globes are sound,
  the rim lies on the seam ring, the lips are doubled along the cut, the budget is held, and the head has two open rims
  and no others. The sweep found what the hand-picked faces hid, now fixed. A rim the net's pinches left touching
  itself (at the nostrils, the canthi, the sockets) was traced wrong, so its hole stayed open or its fan laid a third
  face on an edge; it is split into simple loops now (skin-net.js `boundaryLoops`). Crossings near the mouth's
  corners landed on one spot (welded now). A collapse could leave a face flat against the seam ring's straight front
  (refused now).
- The face roll's hairline is held to the skin's own range (face-compose.js): the male band reached under the dermis's
  0.8, and a face rolled there was refused at mint. The dice are drawn as before, so every other face is as it was.
- THE HEAD'S BUDGET BY ITS SIZE ON SCREEN (laws 2). The hero's `target` sets the head's rung (a head 200 px tall and
  over L2, 80 and over L1, under that L0), and the whole head follows it, not just the scalp's blades. The skin is
  simplified to 30k, 18k or 8k faces (hero-one-skin.js `ONE_SKIN_RUNGS`), and the globes are lighter at L0. The coats
  under the scalp's blades and the beard's are simplified to the rung's count (hero-head-layers.js `HEAD_BUDGET`). The
  beard is on the scalp's own rung, not one finer, and the brows are shorter blades, with fewer hairs and no twins at
  L0. A bearded head drawn for 1080p third-person falls from 124k faces to 51k, and an untargeted one from 191k to
  118k. A hero drawn for no target keeps its skin whole (the eyes gate's). The hair is lit as one volume about the skin
  it rides: the one skin has no cranium, and the hair had been lit facet by facet. The scalp's strips lose their faces
  without area (a blade's segment of no length), so the hair passes its audit. The skin's count rides the head's fit,
  so what is pinned to it is never worn on another count's faces.
- THE LIDS' CREASE AND THE BLINK. The upper lid's fold is thinner than a 1.5 mm cell, and the net pinched it into a
  ragged crease. The skin is now netted at 1 mm (1.2 at L1; L0's head is too small to show it). To afford that, the
  rim's untangle reads only the faces about the seam ring: it had read the whole head, smoothing the nostrils and
  the sockets that rightly face its middle. The simplifier also solves its quadric inline. A lid is now its margin's
  by the distance ALONG the skin from the margin (`oneSkinFollow`'s `faces`): over the lid, into its crease and out
  over the fold that distance only grows, where the elevation and the radius fold back. The lid turns over the globe
  and slides under the fold, which stays. The lower lid is held to its margin's radius, so the cheek in front of it is
  never swung up across the eye. A lid's points are the lid's for every action, so a smile's beads never draw the
  upper lid down. The beads carry what the lids leave (the fold follows a raised brow, with no tear), and the settle
  reaches a tenth as far in the eye's footprint, where the fold's layers lie closer than its reach.
- A clip's keys on the realistic hero carry the face as the landmark head's do (`face: 'smile'`, a word or its
  channels, and the key's `jaw`), with `head: 'relational'` named or not. They export as morph weights in the clip
  beside its bones, so a wave can smile and a start can raise the brows on the same beat. Before this, a named relational
  head refused the key, and its tracks resolved through the anime head's words.
- THE LASHES CLOSE WITH THE LIDS (relational-face-rig.js `lashBlades`, `turnLashes`). A lash rode the skin by the same
  Gaussian carry as the brows, and its root's nearest carriers were the fold's: the lid's margin lies within the globe's
  radius of its centre, where the socket's still points carry nothing. So a blink left the lashes standing up through
  the shut lid. Each lash is now turned about its eye's centre as its root on the margin turns (the root riding the
  face's own points), so a shut upper lash points down and out with its lid. The face store's version is 2, so a rig
  solved before is solved again.
- THE SHUT LID SHADED AS A LID (scene-gltf.js, the skinned export under the lit handoff). A morph target carried its
  positions alone, so the skin a blink rolls out from under the fold over the eye kept the normals it had there, facing
  down and in, and the shut lid read as a dark band across the eye (a ray from the front meets the skin everywhere
  across the shut eye: the lid was there, shaded as the fold). Every target now carries its NORMAL: the smooth normals
  of its shape at full weight less the rest's, sparse, the correctives' too (a reader takes a target's missing NORMAL
  for the rest's). The unlit export writes what it wrote. Still open: the skin's colour near the margin is stretched
  across the shut lid, and a fleck of the iris shows at the lower margin.
- `/hero-live`'s ambient blink keeps the wall clock: on a slow frame rate a blink stretched over as many frames as it
  spanned, and the eyes read shut through a take.
- `/hero-live`: the hero played as an engine gets it. Each variant (bare, an armour style, a round of its words) is
  minted through the door and exported as the skinned GLB with every clip, then played in a three.js page beside the
  mint's read: orbit, the takes, a scrubber, every morph channel live or held by hand, wireframe, bones. `shot.mjs` tiles
  frames at set moments into a sheet for an agent to read; `--publish` packs the page for an artifact host.
- Still open: the shut lid ripples a little; a full smile's cheek stands over the lower iris, as the face's field
  draws it.

### The realistic hero's face: rolled, bounded, aimed

- A REALISTIC HERO WEARS A COMPOSED FACE (face-compose.js, from face harmony): `face: { seed?, ethnicity?, want?,
  character?, accent?, nose?, beauty?, age? }` on the realistic body's relational head. Minted with no face, it ROLLS
  one: the seed, the ethnicity (every base population and the mixed) and, with no `cast`, the sex, stamped into the
  record so it rebuilds as it was (layered.js `withRolledFace`). Named words BOUND the roll (an ethnicity, a list of
  them for a mix, a cast) and the rest TUNE it. The baseline is HEROIC (`HERO_FACE`): the face drawn toward its
  population's harmonious mean (beauty 0.75), at prime age. A remake keeps its stamped face unless the order names one.
- AIMED: `want: { feature: shape }` takes the shapes named in place of the roll's (composeFace's new `want`); every
  feature still rolls, so the rest of the face is the seed's and a face liked can be kept and aimed piece by piece.
- On every read the face's relations and eyes shape the relational head (on the pole's own tune: solving one per face
  costs most of a minute), and its skin lies under the hero's own `skin`: the ancestry's tone, undertone and hair
  colour, the hairline, marks, a beard, the years. The face rides `recipe.headFit`, so an export's skin charts the head
  the face shaped. The readout's `hero.realisticFace` says what was rolled (the picks, the character, the ancestry).
  The composed cut, brows, lashes and piercings are read there but not yet grown on the hero. A hero without a face, and
  every other form, is as it was.

### The tiered game body: the default at mint

- THE GAME BODY IS THE TIERED FORM: a hero minted with no `form` is stamped `form: 'tiered'` (motion-stamp.js
  `withDefaultForm`, beside the calibrated walk), at the door, on a design run's remake of a new figure, and on a world's
  new inline hero; every build and cast takes it (heroic, brute, lithe, stout, canonical, child, chibi, both poles). A
  hero stored without a form keeps the body it was minted on, byte for byte, and a remake keeps the stored hero's form.
  The body before it is a word now, `form: 'classic'`, and is deprecated with the streamlined core: still read, and a
  hero on it (named, or stored without a form) is told so on its readout's warnings.
- THE TIERED BODY IS SHADED SMOOTH wherever it is drawn: under the character light too (the anime head's look), at the
  tiered crease (`TIERED_SMOOTH_CREASE`: the skin and the body's colour groups blend across 70°) where it took the
  35° default and showed its limbs' eight facets; one helper (tiered-form.js `heroShade`) gives the World and the body
  study the same crease and head ellipsoid. The anime head's body is the tiered form at mint, as every new hero's is.
- THE ROUND CHILD (hero laws 14, anime-looks.js `CHILD_FACE.round`, tiered-form.js `CHILD_SHADE`): the child's
  jaw and chin rounder, and its figure shaded round so its facets don't read as folds. The chin is broader, shorter
  and set back, the jaw broad with its corner high, and the lower cheeks full over the jaw line. The boy's chin is no
  longer narrowed, which drew it to a point under laws 13. Its body and clothes blend across 85° (the tiered body's
  70°), and its anime face leans 0.85 of the way toward the head's capsule (0.5 on any other face), so the cheeks and
  the jaw take the light as one round form. Laws 13 children are as they were. The body study frames a large head
  (the chibi's or the child's) by its own height.
- THE CHILD FORM (hero laws 13, hero-form.js `CHILD_FORM`; anime-looks.js `CHILD_FACE`): the child drawn as the anime
  child reads, on the chibi form's base. Its limbs are cylinders, it has no pectoral, mitten hands, round shoes and a
  short neck. It is rounder: a barrel torso (the waist as wide as the chest, each section toward round) and fuller
  arms. Its shoulders are narrower, and with a larger head on shorter legs it stands about three and three-quarter
  heads tall. Its anime face is the child's, under any look or the hero's own words: a short lower face, full cheeks,
  a small set-back chin, a button nose, a broader head, and eyes set lower, opened taller and with larger irises, a
  narrower mouth and a thinner brow. On the boy, the male base's long jaw and forward chin are brought toward the
  female base's. The bare `child` word is now the child build, as `chibi` became the chibi build under laws 6, and a
  child minted without a head wears the anime head, as a chibi does. Its dress is the chibi's few pieces.
- THE ADULT-FORM CHIBI, PINNED (`chibi-adult-form.char.test.js`): the laws 12 chibi's record, plan and recipe, bare,
  in the ranger kit and in the knight's plate, byte for byte; laws 13 builds it the same.
- THE CHIBI FORM (hero laws 12, hero-form.js `CHIBI_FORM`): the chibi reads as simple solids, not a small adult.
  Its limbs are cylinders: no muscle shaping, each limb's rings drawn most of the way to their mean radius, the ankle
  as full as the calf and the knee as full as the thigh. Its chest has no pectoral layer. Its head is larger and its
  legs, arms and neck shorter, so it stands about two and a half heads tall with its hands at its hips. Its hands are
  small mittens and its shoes short and round. Another cast is as it was.
- THE CHIBI'S DRESS (hero laws 12, hero-dress.js `CHIBI_DRESS`): a body that small cannot carry every piece, so the
  chibi wears only the pieces that say what it is. The ranger kit is its belt and its bossed pauldron, drawn bolder
  and thicker. An armour build keeps each family's own few pieces (plate: the pauldrons, the breastplate, the greaves;
  lamellar: the dō and the greaves; the hard-suit: the cuirass, the pauldrons, the boots), never a helm over the face,
  with fewer, larger lames and no ornament. The build's own dials still win. The plan says `style.body: 'chibi'`, so
  what it wears reads it; no other plan says it, and every other kit and suit is as it was.
- THE CHIBI'S CHEST (hero laws 11, hero-form.js `CHIBI_CHEST`): the chibi's chest is wider (×1.25 over the build's)
  and deeper (×1.3). It meets the shoulder's ring, which the shoulders' span sets, where laws 6 to 10 stepped out to
  it in a shelf two centimetres tall, front and back. It stands as deep as the belly under it, where it was pinched
  behind the shelf. Another cast is as it was.
- A CHIBI WEARS THE ANIME HEAD at mint (motion-stamp.js `withDefaultForm`): a chibi minted on the tiered body without
  a head of its own is stamped `head: 'anime'`. It keeps the landmark head when it says a word only that head reads
  (`face`, `hair`, `expression`, `headPreset`, a clip's `face`). A stored chibi keeps its head.
- THE WEB'S ARMPIT (hero laws 10, tiered-form.js `WEB_ARMPIT`): the fold under a raised arm closed. The web's
  under-arm slots (its side, back and front toward the trunk) follow the arm more than the rest of their ring, so a
  raised arm stretches that side instead of folding it back behind the armpit. The cone's slots turn half a slot, off the fold's own axis, where its front and
  back slots creased. It reaches less far toward the neck, and its weights hand the collarbone to the fold over its
  length rather than at once. Its rings past the ball turn the in-ball ring onto the arm's way, so it does not twist
  where it enters the arm, and sit a little inside the arm. Its upper slots stay with the trunk over the chest, and
  its base sits deeper in the torso. Measured on the male with both arms up and forward: no face of the cone or the
  web folds over, where laws 9 folded one. Laws 9 rows are as they were.
- THE SHOULDER CONE (hero laws 9, tiered-form.js `SHOULDER_CONE`): the web's inner fairing, in its group and skinned as
  it is (the collarbone at its base, the fold at the ball), its rings square to the way from the ball toward the neck's
  root: from one hidden in the ball to a wide, flattened base held inside the torso's own section. Its upper half rides
  just over the torso's skin where it would sink under it, so the torso's faceted shoulder corner (the pectoral's top,
  the trapezius' slope, the shoulder blade) runs into the ball closed; its sides stay under the skin and its underside
  draws in toward its centre, so it never spans the armpit. Past the ball it runs on INTO THE ARM, round the arm's own
  axis inside the web at rest, to inside the arm's belly ring, its weights handing the fold to the arm more slowly than
  the web's: a raised arm's root, which pulled away from the torso's shoulder corner in a V, stays joined to it. The
  ball is drawn in under the web and the cone (its centre kept), so a raised arm no longer shows it as a jagged band;
  and the web hugs the arm before it ends (its last ring before the arm's on the arm's own way down) where it met the
  arm at an angle and showed the meeting as a crease. A small fold remains behind a raised arm's armpit.
- THE SHOULDER WEB (hero laws 8, tiered-form.js `SHOULDER_WEB`): a sleeve of skin in the arm's own colour group (the
  top's tone under a shirt, the skin on a bare arm) over the tiered shoulder's ball, from inside the torso's shoulder
  through the ball's equator to the arm's own belly ring, where it ends on the arm's points and welds into one surface
  with it. It rides the collarbone, the shoulder's fold and the arm by ring, so it stretches as the arm swings, and it
  splits with the arm's chain at a target that splits the arm. The ball reads as the deltoid's swell instead of a knob;
  a tiered hero stamped before keeps its ball bare.
- THE TIERED LIMB END (hero laws 7, tiered-form.js `tieredJoints` `respace`): a lofted limb stopped short of its bridge
  (the thigh, at the knee) carries its shaping rings with its end, each by its share of the run, so its last span keeps
  its length. Laws 1 to 6 left them, and the man's thigh ended in a centimetre-long span: a knight's knee guard built
  over it splayed past half a metre on the default body. A tiered hero stamped before keeps its thigh.
- THE TIERED FORM HOLDS THE BUST'S CEILING (hero-form.js `bustCeilingError`): it builds its plan bare and profiles the
  bust after, so a runaway `body.bust` passed it silently; it is refused by the same words heroPlan says. And its plan
  carries no −0 (a stored plan reads it back as 0, so a regenerated plan matched the stored one only by its bytes).
- `core: 'streamlined'` IS DEPRECATED: still read on a hero that names it (the classic body carries it; a new hero that
  names it is not stamped tiered), and said on its readout's warnings; drop `/hero/core` for the game body.
- A FLAT CAP CLOSES ITS PART (station-loft.js): each cap now winds against the ring edges it shares with the bands, the
  bands alone judged by their geometry. A cap whose point sits on its ring's own plane (the tiered form's joints and
  bridges, where each limb ends on the ring the bridge begins on) had been wound by a coin toss, eight to sixteen faces
  wound against their neighbours on the upper arms, forearms, thighs, hands and every bridge; every pointed cap winds as
  it did.
- A HEELED STANCE PASSES THE RIG GATE (station-loft-rig.js `auditRig`): the planted toe is read on the shoe's forepart
  sole, `stance.toe` up, where the solver stands it; a footwear card with a heel on the game body (pumps, stilettos)
  was refused at mint with a planted drift of exactly that lift.
- THE CHIBI (hero laws 6, hero-form.js `CHIBI`, `lawCast`): the bare `chibi` word reads as the chibi build on the male
  pole (its child radii), with the head larger (`headScale` × 1.15 over the build's), the arms thinner (× 0.9 over the
  build's radius) and the neck that carries the head fuller (× 1.45). Laws 1 to 5 stood the bare word on the adult
  radii, a man's arms and a head no bigger than his; a chibi stamped under them keeps it.

### Realistic catch-up: adults only, one set of primitives, the realistic body's gaps

The realistic body depicts adults; the wearable libraries and the tailor share one set of primitives; the realistic
body catches up to what the authored one wears, and its principles are shared back.

- ADULTS ONLY: a child-coded hero asked of the realistic body (a child or chibi figure cast, or the anime 'kid' look)
  is that cast's stylized western figure instead (`adultsOnly`, the first step of `validateHeroSpec` and `heroRecord`):
  its colours keyed the same (the realistic skin's colour, as the dermis reads its tone, the palette's `Skin` unless the
  palette names one; every palette key as given), the realistic body's own keys left off, its dress as asked.
- ONE SET OF PRIMITIVES: the tailor re-exports the footwear library's `soleSlab`, `strapBand`, `buckleOn` and
  `bindNearest` (its own copies had drifted from them; the library's are the superset, its `buckleOn` now taking a
  slot's name as the tailor's did); both byte pins unchanged.
- docs/realistic-body.md says what the body wears and still refuses as the tree has it.
- HANGING PIECES OVER THE TAILOR'S CLOTH: a panel (coat-tails, a tabard's apron), a cape and a hood on the realistic body
  hang over the cloth the tailor made, not the skin under it. A hull piece takes `over` (more parts it hangs over beside
  what is worn on its body parts; absent, as before): the realistic path hands a panel the trunk's and the legs' cloth,
  a cape and a hood the sleeves' too, and keeps those names where it had filtered `over` to the skin's parts (a cloak had
  shown the jacket through at the shoulder and the elbow). A jacket cut at the waist (a tailcoat's, a spencer's) raises
  its stance till its last button is 3 cm over the hem: below the cloth the front had no surface, and its lapel and
  button were thrown a metre out. The authored pins unchanged.
- THE WAISTCOAT: the outfit language's `waistcoat: true | { front: single | double, buttons: 3–6 }` puts a waistcoat
  between the shirt (and its tie) and the jacket, from the chest to below the waist, the jacket eased over it, worn
  without a belt; a `Waistcoat` tone (the jacket's unless the card names one). On the realistic body the tailor gives it
  its V (narrower than a jacket's, so it shows between the lapels), its buttons down the middle (two rows,
  double-breasted) and its ARMHOLES, painted the shirt's and laid on the shirt slot by slot (`armholes`): taken in under
  the shirt they had stood out as shards, laid on a reach measured over a window of heights they had creased the jacket
  over them. The jacket's V walls over it read as the waistcoat. A seeded card `threepiece`. Cards without the word
  byte-identical (both pins unchanged).
- STATUES ON THE REALISTIC BODY: `statue` is no longer refused there. Every card and format carves: one material over
  every group, no dermis (stone is not skin), a lost head (and a torso study) taking the realistic head's own parts with
  it (the face and the nose, bound to the head beside the plan's head parts), a bust without the upper arms' stumps
  (the torso carries the shoulder; a stump cut from the deltoid's rings stood out as a disc). `detail` stays refused,
  its refusal now saying an outfit dresses this body. The authored statues unchanged.
- docs/realistic-body.md said no exporter carried the correctives and the body had no UVs; both have been in place
  (the skinned GLB's corrective morph targets with their weights baked per clip key, the skin's UV atlas). It says so
  now, and what is still missing: an engine-side driver, so a pose the engine makes itself gets the correctives.
- THE OUTLINE READ ON BOTH BODIES: the dressed outline (dress-outline.js: the family against the bare body's, each half's
  fit, the returns, the divisions, the flair, the advice in each canon) is read for the authored game body's heroes too,
  in the hero's readout beside its ring-for-ring silhouette; a figure it cannot read goes without it, never refused.
- THE LANDINGS MEASURED ON THE GAME BODY: the stylism's proportion stage judged every length word by where it lands on
  the realistic body. Measured on the authored game body (`GAME_LANDINGS`), a top's and a coat's hems from the waist to
  the tunic land 4 to 5 hundredths lower (its trunk is longer for its height), enough that under the anime canon's leg
  line a top worn out at the hip, kept on the realistic body, is moved on the game body; the stage now judges by the
  body the hero is on. Down the leg the bodies agree within about two hundredths. The measuring found a cropped woven
  top refused on the game body (its buttons placed below its window); its row now starts on it.
- ONE CANON ACROSS THE WEARABLES: the footwear, handwear and plating libraries' principles each end on the same law, the
  canon is the outfit's (the dressed outline's western | anime): no library carries a canon of its own, and what each
  canon asks of its pieces is the garment principles' (a boot, a gauntlet's cuff, plates standing out among the anime
  flair pieces; the feet in the value gradient). The outline read measures that gradient now (`values: { chest,
  feet }`, the shoe's L* against the chest's front) and the anime canon reads it (`gradient`: dark shoes under a light
  chest).
- WHAT THE GAME BODY WEARS, SAID: the authored body wears the handwear library's gloves (its own adapter) and every
  footwear card as plain boots, shoes or sandals; the tailoring words, the plated suits and the footwear cards' own cut
  are the realistic body's. The hero readout now says so (`realisticOnly`) where it had worn them plain or dropped them
  in silence; nothing refused.
- FOOTWEAR CARDS ON THE GAME BODY: every footwear library card past the plain boots, shoes and sandals is the library's
  on the authored body's structured core too, through an authored foot adapter (`footwear/adapters/authored.js`). The
  plan keeps the bare foot (hero-foot.js, the same proportions) under the card (`heroPlan({ feet: 'bare' })`); the
  library reads it up to the toe base, the five toes as one block from that ring on, the leather stood off past the bare
  foot near each ring; a heeled card stands the rig in its stance, as on the realistic body. A closed shoe's foot is not
  drawn (the game foot's boxy sections stood past the toe cap the library tucks the leather under); a sandal's straps and
  sole are on the bare foot. The library takes an adapter's `facets` (a share of its reference resolution: sole and
  heel outlines, the toe cap, the wraps), the game body's half; absent, as drawn, the realistic pins unchanged. The
  plain words and the outfit cards' `feet` keep the kernel's shoe, byte for byte; the streamlined core keeps the plain
  base, said in the readout.

### Unified character: the face harmony's work in the realistic character depictor

- PIERCINGS ON THE HERO (polygonizer/hero-head-layers.js `heroJewellery`): a realistic hero's composed face's piercings
  (face-compose.js's roll) are grown on its head: the head rebuilt from its fit, pierced on its own chart
  (epidermis/dermal-jewel.js), mapped into the hero's frame and carried as a pinned part on the visage (`jewel`; the
  lower lip's labret and lip ring `jewelJaw`, on a face the jaw alone carries, so they follow it), each piece's group its
  metal's or its gem's (`JewelGold`, `GemRuby` …) with its colour in the palette under the hero's own. A hero with no
  face, or a face that rolled none, wears none. The readout's `realisticFace.shown` names what the hero wears of its
  face (its hair, brows, lashes, a styled beard, its piercings); `notYet` is gone, everything it listed now grown.
- THE SCALP ON THE HERO, A GRASS HAT (hero-head-layers.js `heroHair`; dermal-hair.js `grassHat`, `bladeOf`,
  `GRASS_HAT`): the stylized meadow's way (vegetation/grass.js) on a head. The scalp is planted as a lawn, a blade from
  a root every few millimetres (growScalp's strands at that gap: combed down the head, cut by the stylist, hung by
  their weight, a curl's wound by the lock's keratin hand), each blade a wedge tapering to a point that keeps its
  strand's shape over the top of the skull and thins along its fall. Dense at the roots, the blades overlap into one
  dark mass, and their ends read as the strands; coloured up a ramp root to tip (`HairRoot`, `HairShade`, `Hair`,
  `HairTip` from the hair's colour as the eye averages it), a streak's blades `HairStreak`. Open, double-sided strips,
  pinned to the visage where the head alone carries it. The cut the face rolled, else its ancestry's with the face's
  hint over it; a buzz grows none (the painted scalp is the hair). A hero with no face wears none.
- THE TUFT'S BASE, A COAT (hero-head-layers.js `HAT_CAP`; dermal-hair.js `partDistance`): under the blades, the skin
  coated half a millimetre deep in the hair's root colour wherever the dermis grows scalp hair (`hairCap`, `HairRoot`:
  the hairline, a peak and a loss its edge, a bald crown left bare), the groom's part left open so it reads; under a
  styled beard the same where its locks grow (`hairBeardCoat`, the chin's `hairBeardCoatJaw`, `BeardRoot`). As a
  tuft's base reads solid, no scalp shows between the blades on a head that has not lost its hair, on any renderer
  (the coat is geometry in the hair's colour, so it holds where a renderer draws no skin texture).
- THE HAIR'S DEPICTION AND ITS SCORE (new epidermis/hair-depict.js `depictHair`, `stripMesh`, `capMesh`; new
  epidermis/hair-score.js `scoreHair`, `rasterize`, `strandMesh`): the grass hat's blades and its coat as plain meshes
  in the chart's frame, which the hero pins (hero-head-layers.js `pinMesh`) and the depiction solver measures: on the
  head it grows on, from the front, the lateral, the back and the top, its COVERAGE (the hair-bearing scalp seen bare),
  its BLADES' own cover (where the coat alone shows, the hair reads painted), its OUTLINE against the study's strands
  (IoU) and its faces. A buzz is now the coat (it grew nothing on the hero before). The dermis study's
  `hair-sweep.mjs` scores every style and draws them as a contact sheet.
- THE FACE IN PLAY (worlds/world-kinds.js; channels/rig-preview.js; channels/controllable/index.js; world-scene.js
  `stateFace`; relational-face-rig.js `MOVES`): the realistic hero's face blinks and acts on the World page and in a
  level, where it rode an export alone. The page's pack carries the face's rows (16-bit steps of each part's own scale,
  about a micron, `quantMorph`; an export keeps its floats) and its tracks; the clip preview and the controllable player
  build morph targets on the faced bone meshes (the neutral face, each target's offsets, as the GLB writes them) and set
  their weights each frame from the playing clip's facial track, the ambient blink (the authored face with its own
  blinks) over the clips that hold the face, on the page's clock or the world's. A hero in a level plays each state's
  clip's track under the state's name. A point no target moves 0.1 mm carries no row (the scalp's far hair), which trims
  the export too. A page or a level without a realistic hero emits none of it, byte-identical; one with it resolves the
  face's rig on its first build (a minute or two, once per head) and carries its rows.
  The hero in a level wears its skin too (the controllable player draws a painted body's parts on its atlas, texel ×
  its lit colour, as the World page draws it), where it played flat grey.
  What a clip acts reaches the face (relational-face-rig.js `relationalWeights`; hero-react.js `act`; hero-face-action.js
  `react`): the realistic face reads the brow an acted take draws (its tilt: set, the brows drawn down and together;
  worried, lifted), so a strike's kiai or a jump's effort shows on it, where only its lids moved; and a blow taken acts a
  face, a wince or a grit a frame after the impact, the lids squeezed to the half lid at most, back on the authored face
  as the body gives back (every hero's reactions, the anime and landmark heads' too). In play each one reaches the
  state that plays it (a swing, a stagger, a jump).
  The face's rig is solved once per machine (new polygonizer/relational-face-store.js; hero-relational-head.js
  `faceOnly`; scripts/mojulo-paths.mjs `MOJULO_FACE_RIG_DIR`): its builds make the face alone (the cranium and the jaw,
  which it keeps as stored, are no longer cast five times over), its rows byte-identical, and a head's solved shapes
  are kept on disk under the mojulo home (keyed on the face the figure carries, the package version and a store
  version; the newest two dozen kept), so a realistic hero's page or level after a restart reads them back in a blink
  where it rebuilt them for most of a minute.
- THE REALISTIC FACE AS BLEND SHAPES (new polygonizer/relational-face-rig.js `relationalFaceRig`, `relationalWeights`,
  `RELATIONAL_FACE_TARGETS`; hero-relational-head.js `relationalHeadRecipe`'s `actions` and `fit`; head-relational.js
  ACTIONS' `smileEyes`): the realistic hero's face rides an export as morph targets an engine plays, as the anime and
  the landmark heads' do: `blink`, `blinkLeft`, `blinkRight`, `smile`, `browRaise`, `browLower`, each the head rebuilt
  at its own fit with one of its actions at full (the lids, the zygomaticus, the frontalis, the corrugator) less the
  head at rest; the face alone rebuilt (the visage, the nose, the eyes), the cranium and the jaw under it as stored.
  What rides the face moves as the skin under it moves (a Gaussian of the face's points near each, `CARRY`), not as the
  one face it is pinned to tilts: a blink carries its lashes, a raised brow its hairs, a smile the beard on the cheeks,
  and the scalp's hair stays. A blink also sinks the globe behind the shut lid; the smile keeps a seventh of the head's
  squint (`smileEyes`). The weights are the western expression channels' (the door's `expression`, a clip key's words,
  the tracks), so the realistic hero blinks and acts as the landmark hero does; the jaw opens by its bone. A rig costs
  a few head builds (~2 min, once per head; the World page never asks: it plays no face morphs yet).
- THE EYE'S SURROUND (hero-relational-head.js `eyeGlobeIn`, `eyeDeflate`, `eyeAround`; the relational head re-pinned):
  within an eye's footprint the visage and the nose are held `eyeSink` behind the globe's front as the eye's own look
  sees it, easing back out to the skin, and the cranium let down further about each globe. The lower lid is a ledge
  over the globe, and the face sheet, cast along the face's look, landed now on the ledge's front, now on the globe
  behind it: its faces bridging the two cut in front of the eye as spikes along the lower lid (on every face, worse in
  a smile, hiding the iris), and the cranium showed through at the lid's crease and the inner corner.
- A REALISTIC HERO DRAWN FOR A TARGET COMPILES (layered.js `targetPlan`): the target's density split (era/cast-density.js
  `densityPlan`, halving a part's slots where its outline misses) is not laid on the realistic body, whose rings give
  every point themselves: the halved slots named points no ring carried, and any `target` failed at compile
  (`torso/st0.h0R missing`). Its rings are its own; its target reads the hair's rung, as it did.
- THE LIGHT TONES AS FAIR SKIN (dermal-map.js `toneAlbedo`'s light knee, `LIGHT`; dermal.test.js re-pinned): the
  lightest Monk swatches photograph near-white and grey-yellow (MST 1 … 3 at a luminance of ~0.81 … 0.86, paper's),
  and were taken as the skin's albedo as they are, so a fair hero read as plaster. Above MST 5's luminance a swatch's
  rise is now pressed to 0.15 of itself (MST 1 … 4 at ~0.56 … 0.58, measured fair skin's ~0.5 … 0.6) and its colour
  drawn toward a measured fair albedo's red slope (`#dfb8a0`'s) as it nears white, the swatches' order kept; a hex tone the same. MST 5
  down to the deep knee are their swatches, as before. Every realistic hero of a light tone, a minted one too (its
  skin regenerates), reads darker and warmer: the default presets' MST 3 among them.
- THE SKIN ON THE WORLD PAGE (worlds/world-kinds.js; dermal-hero.js `heroSkinPaint`'s `light`): the realistic hero's
  dermal skin (the body's and the head's maps on one atlas) was an export's alone; the page drew one flat skin colour.
  The page now wears it too, on its static faces (each lit by its fill over the skin's flat colour, so the texel's
  colour is lit, not tinted twice) and on its clips' pack, at the page's own sizes (`PAGE_SKIN`: the body's page 1024
  a side, the head's 2048, so a mole or a birthmark reads at a face's distance; the export's own unchanged; the atlas as
  wide as its wider page, a narrower one beside white): the skin's tone and grain, the lips, the marks, the painted hair and
  stubble, and age's fine lines. The atlas's corners are written to a tenth of a texel. A realistic hero's page
  takes a few seconds more to resolve once (the World page caches it) and carries the atlas and its corners.
  The body study's `world-skin.mjs` photographs the page itself, the face close and the whole figure.
- THE BROWS AS A FINE LAWN (hero-head-layers.js `BROW_BLADE`): every brow hair its own thin blade (0.5 mm at its root
  to a point; the cards gathered hairs 2.5 mm apart into boxes 1.2 mm wide, read as bars), REPEATED once by a seeded
  die (a twin a fraction of a millimetre across, lifted, shorter) so the brow reads full; its root darker down the
  hair's ramp (`BrowRoot`, `Brow`), its colour the hair's with its grey, lit as the hair is, as one volume. The lashes
  a fine open blade each where they were boxes, paying for it: the brows and lashes together cost fewer faces than
  before (the brows ~12,000, the lashes ~1,400, where they were ~4,900 and ~9,200).
- THE CRANIUM UNDER A DEEP-SET EYE (hero-relational-head.js; the relational head re-pinned): under the visage the
  cranium is let down from the deeper of the bare head and the face itself. A rolled face whose eyes sit deeper than
  the bare head's reach had the cranium stand in front of the globe, a pale sheet over a shut-looking eye.
- THE HAIR LIT AS ONE VOLUME (station-loft-shade.js `volumeNormals`, a part's `volume: { heart, up }`; the hero's
  hair, its coat, the beard and the beard's coat: hero-head-layers.js `HAIR_VOLUME`): each corner's shading normal bent
  out from the head's centre (the cranium's, where it stands) and a fifth toward the sky, the grass's way
  (vegetation/grass.js volumeLit), so the blades shade as one soft mass, both sides alike, where each lit by its own
  facing read as flakes. The hair's ramp root to tip gentler (`HAIR_RAMP` 0.7 … 1.12, from 0.45 … 1.3): the bands no
  longer interleave into a patchwork across the blades. A part without a `volume` is lit as it was.
- THE BEARD GREYS AT THE ROOT (hero-head-layers.js `BEARD_ROOT`): the beard's root and its coat are its tip's colour,
  the grey in it, darkened (0.7), where they were the un-greyed colour (×0.6): an old beard read as grey flecks on
  black.
- THE DEPICTION SOLVER (new epidermis/hair-solve.js `solveClass`, `candidatesFor`, `prepareCase`; hair-depict.js
  `hairClass`, `HAIR_DEPICTION`, `depictionOf`): how a groom is cut into the hat's blades is a CLASS's, never a style's
  own: `rope` (locs, rows), `tied` (a tail, a braid, a bun), `coil`, `standing` (gel, a crest), `cropped`, `short`,
  `long`. The solver scores each candidate (the blades' width, the turn a kept point needs, how flat a short blade
  lies, the most spans a blade keeps) on every style of the class and keeps the one every style passes on (no bald
  spot; the outline within a point of the rung's own) that reads best for its faces; its rows are `HAIR_DEPICTION`,
  which the hero's hair wears, and a new style is covered by its class's row. The dermis study's `hair-solve.mjs` runs
  it over the catalog; `hair-sweep.mjs --raw` draws the rung without it.
- THE BLADE'S RULES (dermal-hair.js `bladeOf`'s `lie`, `cap`, `rope`; `hatStrands`, `hatBlades`, `ROPE_TAILS`): a
  short blade LIES along the comb, its rise off the head pressed into the head's tangent, its length kept, fading out
  over 6 … 12 cm (a standing short blade showed its edge: a crop read stippled); a loc's, a row's and a braid's
  blades are ROPES, as wide to their last span as at the tie; a coil's blade keeps at most `cap` spans. The hat's
  strands grow once (`hatStrands`) for every way of cutting them (`hatBlades`); a gathered strand names its tail.
- THE HAT'S LADDER, THE GRASS'S TRICK (dermal-hair.js `HAIR_LADDER`, `hairLevel`; layered.js `heroHairLevel`): fewer
  blades the smaller the head stands on screen, the survivors wider so the cover holds, as a tuft thins: `L2` every
  blade (a close-up), `L1` a third of them rooted 1/√⅓ as far apart and wider again (a sixth of L2's faces, the
  default), `L0` one broad wedge a comb guide (the outline). The rung is the head's height in pixels under the hero's
  `target` (era/target.js), L1 for a hero drawn for none; the beard a rung finer than the scalp. The readout's
  `realisticFace.hairLevel` says which.
- THE FACE'S HAIR ON THE HERO (hero-head-layers.js `heroFaceHair`): a styled beard's locks (dermal-hair.js
  growBodyHair) as a lawn as the scalp's, a wedge a few millimetres apart (`BeardRoot`, `Beard`), those under the lip
  line on a face the jaw alone carries (`hairBeardJaw`), the moustache's and the cheeks' the head's (`hairBeard`); the
  brows and the lashes (see THE BROWS AS A FINE LAWN) from the epidermis, its grooms the ancestry's with the
  composed face's over them; `Beard` (its grey a third again), `Brow`, `Lash`. Stubble stays the skin's paint. The
  layers' colours lie over the plan's defaults and under the hero's own `palette` (a named `Hair` wins).
- THE FACE'S OWN FIT (layered.js `withFaceFit`, the mint's; hero-relational-head.js `relationalHeadRecipe`'s `tune`):
  the mint solves the realistic face's own tune for its composed relations (head-relational.js `solveTune`, ~45 s,
  once) and stamps it beside its words, `face.fit: { tune, of }` (`of` the relations' fingerprint), so the hero's head
  is the face the studies show, not the face on its pole's tune. It rides `headFit.tune`, so the skin (dermal-hero.js),
  the piercings and the hair chart the same head. A face whose words change since reads a stamp not its own and wears
  the pole's tune until it is minted again (the readout's `realisticFace.fit` says which). A hero minted before keeps
  the pole's tune, byte for byte, until reminted.
- dermal-hair.js `growScalp`'s `strands: false`: the guides and their cards alone, without the strands a render draws
  (the ladder's outline rung).
- dermal-jewel.js: each face of the mesh names its piece (`mesh.piece`); the wires are capped and the balls fanned to a
  single pole point, so every piece is a closed solid with no collapsed face (the hero's audit).
- dermal-hero.js: what the head wears of its own (`jewel`, `jewelJaw`, the hair to come) never counts as a garment over
  the body's skin.

### Face harmony: the female differentiated, the look standard, the lips' grain

- The dermis study's lineup takes subjects of its own (`--faces '[{ label, sex, relations, eyes }]'`, the wave's tune
  solved for each relation set), so a spike's relation sets read side by side, textured and lit; `--lineup-crop face`
  frames the face from the brow to the chin. The first study: the relational head's female pole differs from the male
  in the jaw's width and little else (the nose's root and dorsum, the chin's shape, the eyes' size are the male's), and
  relations alone move the eyes, the lips and the brow but cannot reach the nose's width, the chin's point or the lower
  face's taper.
- The relational head's HARMONIC SHAPES, relations the canon's ratios did not reach (head-relational.js `RELATIONS`):
  `chinWidth` and `chinRound` (the chin's width and its point), `dorsum` (the nose's bridge and root), `gonionDrop`
  (the jaw's corner), `cheeks` (the cheek's fullness), `lowerCheek` (the lower cheek bowed out over the jaw's body: a softer outline from
  the cheekbone to the chin), `masseter` (the jaw's muscle), `forehead` (the frontal bulb).
  Each is an offset from the canon, 0 the canon's own: a face moves from a natural one and never starts from a carved
  one (no hollowed cheek by default), and both poles' heads are byte for byte as pinned.
- face-harmony.js: `dimorphRelations(d)`, the relations `d` of the way from the male canon (0) to the female pole (1),
  −0.25 … 1.5 (a Nordic heroine's bone part of the way, her features the female's); `harmonyMeasures(head)`, calipers
  on the skin for the chin's width and its fall 10 mm out, the bridge's and the root's width, and the lower face's
  taper (the width at the mouth and at the gonions over the zygions'). A reading, never a refusal.
- THE FEMALE POLE moved (approved on the eyes gate): beyond the canon's sex cues, a shorter, less projected nose with a
  finer bridge and a narrower base, larger eyes, fuller and more forward lips over a finer philtrum, a lighter brow, a
  narrower jaw and a narrower, pointed chin that no longer recedes, the cheeks fuller and the lower cheek bowed out (a
  soft outline). Its tune re-solved; the female head re-pinned, the male's unmoved. The hero's eye part closes its
  outer rings in where they would cast past the face's side (a wider eye on a narrower face), eased over its neighbours.
- THE FACE COMPOSER (face-compose.js `composeFace({ sex, bucket, seed, character?, accent? })`): many faces that each
  hold together, never one face under different hair. Per harmonic feature (the chin, the nose, the lips, the cheeks,
  the outline, the eyes) a few named shapes (`FACE_SHAPES`), each offsets to the relations over the sex's pole and a
  point on two character axes (soft ↔ angular, delicate ↔ strong); a face rolls its point and takes the shapes near it,
  each pushed a seeded share, and may carry one accent taken from far off (a strong jaw under fine features). A bucket
  (`FACE_BUCKETS`) names the egocube ancestries its tone and hair are rolled from; `western` first. The dermis study's
  `--faces` subjects may name an ancestry and a seed.
- The composer's PROPORTIONS (`FACE_PROPORTIONS`): what differs person to person whatever the character, rolled after the
  shapes about the face's own values: the skull's length and breadth, the vault's height (the face's share of the head),
  the face's, the jaw's and the mouth's widths.
- The composer's EYE REGION: the eyes' shapes carry the lids (the eye rig's channels: open, large, almond, deep, hooded,
  soft), a brows feature takes the epidermis cube's groom words (natural, straight, arched, thick, thin), and the eyes'
  spacing, height, size and tilt are rolled per face; `composeFace` returns `eyes` and `epidermis` with its relations.
- THE ASIAN BUCKET (East and Southeast Asian ancestry): a bucket's `base` is the population's mean morphology, set before
  the rolls and measured against what the pole already does (after published East Asian anthropometry: a rounder vault,
  the inner canthi wider apart, a wider nasal base, a lower and flatter root, a broader bridge, a lighter brow ridge, a
  rounder forehead, the cheekbones forward). Its LID COVER is rolled per face (monolid, in-fold, parallel, hooded, by the
  egocube's weights) and owns the fold's channels (`LID_FOLD`) over the character's eye shape; never a slant. Shapes
  weigh per bucket. `FACE_LIMITS` holds a composed face inside the head's working range, measured by the tune's solve
  (the nose's projection, the cephalic index): a face asked past it is drawn at it.
- The composer's GROOMS (`FACE_GROOMS`): the brows' thickness and density and the lashes' density and length rolled per
  face as shares of their shape's numbers, after its face (a seed keeps its relations); a bucket may carry its own.
- THE NOSE'S AXIS (`FACE_NOSE`): one roll per face from a short, flat nose (less projected, shorter, smaller, its root
  lower, its base wider) to a long, pointed one, each bucket setting where its people sit on it and how widely they spread
  (`nose: { mean, spread }`: the western a little toward long, the asian toward short and flat, both reaching both
  ends); `composeFace`'s `nose` sets it. The relational head's `noseSize` (0 the canon's) scales the nose's own parts and
  their places with it, so a small nose is a smaller nose, not the canon's parts crowded; `TUNE_LIMITS` holds the tune's
  subnasale lift to the poles' own range (chased further, the nose's base rose ~18 mm and drew the upper lip into a snout;
  the miss is reported instead). Both poles' heads and tunes are unchanged; the head's floor on the nose's projection
  falls from ~0.265 to 0.2.
- MORE BUCKETS, from the same principles: `east-asian` (the bucket first built as `asian`), `south-asian` (a longer
  vault and a narrower face, the root higher than the East Asian, the base moderately wide, the eyes a little larger, the
  rig's creased lid or a hooded one, the brows and lashes rolled heavier), `southeast-asian` (Filipino and maritime
  Southeast Asian: a rounder vault, a low broad root and a wider base, the nose leaning short and flat, fuller lips, the
  lid a parallel crease or the rig's), `latin` (Mexican mestizo: a broader face, high forward cheekbones, the nose spread
  wide on its axis), `african` (sub-Saharan: a longer vault, a rounder forehead, a much wider base on a low broad root,
  fuller, taller, more forward lips). A BLEND bucket is one of its buckets per face (`asian`: East or South Asian); a MIX
  bucket is one, or one with a share of a second, their bases and leanings mixed by the share (`equatorial`: South Asian,
  Southeast Asian and Mexican, and the faces between them; `mixed` names both and the share). A lid roll may name `none`,
  the rig's own lid; a bucket may carry its grooms' ranges and hold its TONES to its intent within its ancestries'
  (`tones`, on the Monk scale: `equatorial` is brown, MST 6–8), the ancestry still giving the hair, the undertone and the eyes.
- THE GEO-ETHNIC CATALOGUE widened: `north-asian` (Mongolia, Korea, northern China, Siberia: a broad round short vault,
  high flat forward cheekbones, the eyes wide apart under a low flat root, a light brow, thinner lips, the lid most often
  a monolid or an in-fold), and `asian` the asiatic look pinned on it (North 2 : East 1); `east-asian` East Asian alone.
  South Asia as its cline: `indo-aryan` (northern India and Pakistan: a long narrow face, a high root, the nose leaning
  long and aquiline, large deep-set eyes, MST 3–7) and `dravidian` (southern India and Sri Lanka: a wider base, fuller
  lips, MST 5–9), `south-asian` the mix along it. MENA: `levantine` (a long oval face, a long high-bridged nose, large
  deep-set eyes, MST 2–6) and `south-mediterranean` (the Maghreb and coastal Egypt: a long narrow face, a straight to
  aquiline nose, almond eyes, fuller lips, MST 3–7), `mena` the mix between them. A mix may hold its own tones over its
  buckets' (the equatorial's brown is the mix's, its buckets keep their own).
- THE HAIR'S CUTS by region (`FACE_HAIR`): a woman's hair texture is rolled from her ancestry's and cut from her bucket's
  pool for it, as a stylist there would cut it (the Levant and the Maghreb: long blow-dried waves, long defined curls,
  layered curls, half-up; South Asia: long hair, braided, put up; Mexico: layered curls, a curly crop, a high bun;
  sub-Saharan Africa: the short afro, the high bun, braids, the bun, the curly crop, the big round afro rare); a texture a
  pool leaves out keeps the ancestry's own style. The widow's peak's centre part goes only on cuts it suits (a part, no
  ties, to the shoulder or longer). New cuts (dermal-hair.js): `curly-crop` (~9 cm on top, tapered at the nape and round the ears) and `high-bun` (the hair
  smoothed up into a top-knot high on the crown).
- HYBRIDS (`hybridOf`, `HYBRID_TRAITS`): a person of two lineages composed trait by trait, not averaged. Each trait group
  (the skull, the eyes with their lid cover, the nose with its axis, the cheeks, the lips, the skin's tone, the hair's
  ancestry and its region's cuts) comes from one parent (the likelier the larger its share) or is blended between them;
  the face names its sources (`hybrid: { of, with, share, traits }`). `mixed` seeds one from any two base buckets;
  `composeFace({ parents: { a: w, b: w } })` makes any face one. A cline (`mix`: the South Asian, the equatorial, MENA)
  still interpolates its neighbours.
- THE HAIRLINE as dermis dials (dermal-map.js, each absent 0, every map as it was): `round` (the front straight across …
  rounded), `temples` (the corners fuller … receded), `peak` (a widow's peak), `sideburn` (its foot), `nape` (the line
  behind), and `bald`, 0 … 1, hair loss by the sex's pattern (a man's temples, then the crown from the back, then the
  front, to the horseshoe; a woman's front kept, the crown and the part thinned): the scalp's region, so the skin and the
  hair it grows follow together. The composer rolls them last of every face (`FACE_HAIRLINE`), a man's loss far more
  often than a woman's and scaled by the bucket's prevalence (`bald`); `composeFace({ bald })` sets it. A face rolled a
  widow's peak (nearly half) carries its groom's hint, `scalp`: a centre part over any style that has a
  part (the peak is where the hair parts of itself), with the groom's `framed-layers` move (dermal-hair.js, the
  Rachel's principles): a smooth crown, the front cut shortest and layered longer toward the back, the ends flipped out so
  the width sits at the sides at mid-length (the back hanging straight: the groom's `flipBack`, the flip's share behind
  the ears, absent the whole flip all round), in pieces, within the style's own length. A `blowout` move (the roots lifted
  well off the scalp, the sides held out, the ends turned out) is there to ask for; the rolls do not. The dermis study's `--lineup-all` adds the lateral and the back.
- THE MALE POLE (head-relational.js `RELATION_POLES.male`, empty until now; approved by the operator's eyes): the
  female's principles at the male's character. The cheeks full and the lower cheek filled (volume, never a hollowed
  default), a broader, rounder chin that no longer recedes over a wider jaw and a heavier masseter, a shorter nose with a
  finer bridge and a wider base, fuller lips, the eyes a little more open; `HEAD_TUNES.male` re-solved for it and the
  male head re-pinned. The male dermis's hairline sits lower (0.88) with a widow's peak (5 mm). The sex axis
  (`dimorphRelations`) now runs between the two poles. The composer rolls a man about his pole: his hairline lower, the
  widow's peak more often and more marked and without the women's centre-parted groom, his brows taller and fuller
  (`FACE_GROOM_SEX`); a woman's rolls are byte-identical.
- PAINTED SHADING, opt-in (dermal-map.js `shade`, 0 … 1, absent nothing): the occlusion read at a face's reach (the
  sockets, the hollow under the cheekbone, beside the nose, under the lip and the jaw), multiplied into the colour as a
  game paints its light in (dermal-texture.js `finishPages`; the head chart's `occlusionAt`). For targets without their
  own occlusion; an engine that adds its own wants it absent.
- THE SKIN IN A GAME'S ART DIRECTION (color-theorist/adapters.js `skinDirection(contract, shading)`): the game's solved
  palette and a shading word (`SKIN_SHADINGS`: painted, cel, graphic, none) read into the character's `shade` (as deep as
  the key is low and the palette heavy, its colour the palette's fill, banded by the shading) and a light (the palette's
  key, fill and rim, an exposure by the key). `shade` takes `{ amount, colour, steps }` as well as a number. The dermis
  study lights a subject by its `light`, so one face reads in each game's light and shade.
- THE DEEP CURVE (`shade.curve: 'deep'`, the `chiaroscuro` shading): the shade as before until the skin is enclosed
  deepest, then a near-black in the shade's hue: the nostrils, the mouth's line, the sockets' inner corners, the ear's
  folds (the knee at 0.9 of the occlusion, the darkest a tenth of the shade's colour: a tight band, tightened at the
  operator's ask). A near-black only that deep, and only by asking for it.
- THE WORLD'S SKIN, as data (gameworld/hero-looks.js `worldSkin`): a world with a palette hands its characters the shade
  its art direction paints (`skinDirection`, the default light kept), `characters.direction.shading` naming how
  (painted when absent). The composed hero carries it as `skin`; the mint takes it only on a realistic hero, under its
  own shade, so every hero a world mints today mints as it did.
- The dermis study's sheen reads the relief layer: each relief class's slopes (its pores and grain, finer than a pixel)
  widen the highlight, Toksvig's way, so the skin reads satin rather than plastic (`--flat-sheen` for the old lobe).
- THE SCALP'S STRANDS, finer (dermal-hair.js; the operator's eyes): a drawn strand stands for a ribbon `strandGap` wide,
  `strandWidth` of it drawn; by the hair's type now (`HAIR_TYPES` `strand`): straight and wavy 1.5 mm and 0.4 (~4.5 hairs a
  strand, between a lash and a card; were 3 mm and 0.75, ~18), curly 2 mm and 0.5, coily 2.5 mm and 0.6 (a curl keeps its
  locks' weight). Every scalp's strands change; a groom's own `strandGap` / `strandWidth` still wins.
- A CURL'S KERATIN (`HAIR_TYPES` `chiral`, hair-spine.js `coilOffsets` `flips` / `taper` / `scale`): curly and coily locks
  twist each their own way: a share left-handed, the radius ± per lock, the twist reversing along the lock (a kink, as a
  phone cord's: a few a metre in curls, many in coils), and the hair's weight drawing the coil open toward the root. A
  coil that names none of these is as it was.
- THE BEARD'S STYLES (dermal-map.js `beardStyle`, `BEARD_STYLES`: stubble, short-boxed, full, goatee, van-dyke,
  chin-strap, moustache): a barber's lines over the beard tract (which zones grow: the moustache, the corners, the chin, a
  soul patch, the cheeks or a strap along the jaw; the cheek line lowered; the neckline under the jaw) and a length a zone.
  A beard of 6 mm and more grows as LOCKS (dermal-hair.js): ribbons of hair at the hair type's strand, a little coarser,
  falling under their weight and curling by the man's hair type a step tighter (a coil curling back toward the skin), each
  lock its own keratin twist (`growBodyHair`'s `type`). Absent, the tract and `stubble` as they were.
- The beard grows on the whole upper lip (dermal-map.js): the nose's region, whose reach round the columella spans the
  philtrum, cleared the beard there, so every moustache and every stubble bared the upper lip's middle; the nose now clears
  the beard only on itself, above its base. Every male skin's upper lip changes.
- The moustache is trimmed at the lip line, as it usually is: a hair above the upper lip grows no longer than its way down
  to the lip's border, so none hangs over the lip (a beard of strands, 1.5 mm and longer; the painted shadow as it was);
  a style may let it over (`overLip`, none does yet).
- A styled beard is fuller (dermal-map.js `BEARD_ZONES`, the operator's eyes): denser and lifted off the skin by zone, the
  moustache thickest (2.4 × the tract's hairs, lifted most), the chin and the cheeks full; its locks closer and a little
  wider where it is denser, and a style long anywhere grows all of itself as locks (its trimmed moustache among them).
- Under a styled beard the skin is painted in the hair's colour (dermal-texture.js), as the scalp's is under its groom, as
  much as the hair covers it (the longer and the denser, the more; faded in with the beard's region, so no line marks the
  style's edge): the gaps between locks foreshortened toward the eye read as beard, not as the shaven shadow's grey. The
  dermis study shades a beard matte and darker within (coarse hair), and sizes its views with a loop (a head's hair now
  runs to more points than a call's arguments hold).
- THE MEN'S PARITY across the buckets (face-compose.js): a man draws his cut from his region's barbers
  (`FACE_HAIR_MALE`: a default pool for every texture, the MENA, South Asian, Latin and African pools; a curly-haired
  western man no longer rolls a TWA), his facial hair (`FACE_BEARD`: a style by the bucket's weights, clean the shaven
  shadow, and the tract's fullness in the bucket's range; East and Southeast Asian beards sparser and more often shaven,
  after published density; every style reachable everywhere), and the shapes by his sex's weights
  (`FACE_SEX_WEIGHTS`: the thin and high-arched brow, large eyes, the heart's chin and outline rarer on a man) with
  shorter lashes. A woman's every roll is byte for byte as it was.
- A man's loss ends in a HORSESHOE (dermal-map.js): as the front's recession meets the crown's, what is left is a band round
  the sides and the back, its top level about the parietal ridge and dipping to the sideburn in front; no wedge left at the
  temple, and no island of hair left by a widow's peak once the front has receded. What the loss leaves a barber keeps
  short (dermal-hair.js): no lock from the band's top laid over the bald crown. The MENA men's wavy pool crops instead of
  standing in a curly crop's spikes.
- THE MEN'S CUTS by culture (dermal-hair.js `SCALP_STYLES`, the cuts a barber in each place would name): the fade, the
  Caesar, the French crop, the two-block, the pompadour, the slick-back, the high-top, the top-knot; drawn by region
  (face-compose.js `FACE_HAIR_MALE`: East Asia's two-block and French crop, the Levant's slick-back, the Latin and the
  Black barbershop's fade and Caesar, South Asia's neat side part; a bucket's `hairMale`). A cut from 2 cm is grown as a
  cut (its taper, shelf and fringe shape it: a fade fades, a crop is no bowl; a buzz still lies as body hair), and a
  style may carry its own lock edits.
- THE BEARD'S GROWTH DIRECTION (dermal-map.js `beardFlow`): the sideburn straight down, the cheek down and toward the chin
  (the more the lower), the chin down and gathering, the moustache out from the philtrum (flatter toward the corners),
  under the jaw back toward the throat, the neck down toward its middle about a whorl either side. The beard WRAPS the
  jaw: under the ear's lobe it reaches back past the sideburn's line, and the neck's top carries it on round.
- The dermis study's SPLAT (`.claude/skills/dermis-study/splat.mjs`): the skin map's regions as points on the head's
  surface net, orthographic from any azimuth, the far side culled by the normals, a pale grey where no region weighs;
  where a region lies, in seconds, before a lit render's minutes.
- LOCS and CORNROWS, anyone's (dermal-hair.js, the tie's new tails `loc` and `row`): locs, the hair matted into ropes, one
  from each section of a grid over the scalp, twisting round its rope and hanging to the shoulder; cornrows, plaited flat
  in rows from the hairline over the crown to the nape (a root joins its nearest row where it is nearest, the scalp parted
  bare between), a short braid on past it. In the women's and the men's pools of the African groups, and the Latin coily.
- THE ERAS' CUTS: the mohawk, the fauxhawk (a `strip` cut: the band down the middle kept and standing, the rest clipped),
  the broccoli (the 2020s' perm), the mullet, the '90s curtains and bowl, the 2000s' emo fringe; some in the men's pools
  now and then. A style with ties is grown with its ties at any length. The fauxhawk is the 2000s–2010s gelled one:
  textured spikes worked up, back and in to a ridge (a groom's `gel`, 0 … 1: what stands is turned from the scalp's
  normal toward that ridge, not fanned out); `spiky` its whole-top variation (a Kisame's), and the SPIKED FADE family:
  the spiked fade, the high one, the spiked quiff fade and the burst fade's band of spikes. The bowl is clipped short
  beneath (a root a shelf or a strip clips stays clipped under a line cut).
- ASYMMETRY (head-relational.js, 0-centred, absent byte-identical): the left eye's, brow's and mouth corner's height, the
  nose's lean, the left jaw's and cheekbone's width. The composer rolls each face its own (`FACE_ASYMMETRY`, ~1–1.5 mm),
  never none: a mirror reads uncanny.
- BEAUTY (face-compose.js `composeFace`'s `beauty`, 0 … 1, `FACE_BEAUTY`): averageness and symmetry, the attractiveness
  research's steadiest findings: the proportions' and the nose's reach and the shapes' spread drawn toward the bucket's
  mean, the asymmetry toward slight. The default (0.5) leans to it: most faces typical, the median rather than the
  extremes; every composed face, women's and men's, changes with it.
- THE SKIN'S MARKS (dermal-map.js `marks`, `MARK_KINDS`): moles, a beauty mark, birthmarks (a café-au-lait patch, a
  port-wine stain) at mm on the head, painted into the skin's colour, a stain's edge wandering; the composer rolls up to
  three moles a face, a beauty mark in its classic places now and then, a birthmark rarely (`FACE_MARKS`).
- HAIR STREAKS (dermal-hair.js scalp key `streaks`, `STREAK_KINDS`, `STREAK_DYES`): the money pieces framing the face,
  a chunk at a clump's seat, the under layer, the tips (ombré, from a share along the strand), a scatter of babylights;
  each strand and card in one carries its `streak` (the dye, linear, and where along it the dye starts). The hair grows
  exactly as without; absent, no field. A buzz under 2 cm takes none.
- PIERCINGS (new epidermis/dermal-jewel.js `pierce`, `readPiercings`, `PIERCING_SITES`): the lobe and the upper lobe, the
  helix, the tragus, the nostril, the septum, the brow, the bridge, the labret, a lip ring, the monroe and the medusa,
  each placed from the head's landmarks and settled on its surface by the field (the ear's sites from the ear's own
  samples), in a kind the site takes (stud, a gem set; hoop through its hole, hanging off the tissue's edge; barbell;
  drop) and a metal; out, the pieces and one mesh (balls, rings, wires) in the chart's frame with its materials.
- ADORNMENTS in the composer (`FACE_ADORN`), rolled after the marks: each site at its chance by sex (the lobes on most
  women, few men, every other site rare; a nose stud common in the South Asian buckets), one metal a face; now and then
  streaks, mostly the salon's lightened dyes, sometimes a fashion colour, as a scalp hint. The rolls before them keep
  their dice.
- THE YEARS ON THE SAME ROLL (face-compose.js `composeFace`'s `age`, years 16 … 85, `FACE_AGE`): the rolled face is the
  person at their prime (28; absent or 28, the face as rolled, byte for byte); other ages keep every roll and the
  person's styling (the cut, the streaks, the piercings, the marks, the beard's style) and move the years' signs. Older:
  the soft tissue descends (the jowl and the fold, the cheek's fat from the cheekbone to the jaw, thinner lips set back,
  a longer nose and ear, hooded lids, the outer canthus down), the skin's `age` and `lines` rise, the hair greys from
  its onset, a man's temples recede and his loss advances by its destiny, a woman's crown thins late. Younger, to 16:
  fuller cheeks and lips, a smaller nose, a softer jaw, a man's brow ridge not yet grown, the skin younger. Its own dice
  (`face-age`): the rate the person ages at, the greying's onset by the ancestry's mean, the loss's destiny, the same at
  every age of one seed.
- THE FACE'S LINES AS FOLDS (dermal-map.js `dermalDetail`, dermal-texture.js `FOLD_INK`): each line a tapered polyline
  painted at two scales, a thin dark core inside a broad smooth shade (`crease`, `soft`), with a faint lift on the roll's
  lit lip (`lift`), in the skin's own warm shadow rather than grey; broken along its length, wider as it deepens, the
  crow's feet curved and more of them with depth. The lines no longer read as pencil strokes. Absent `lines`, nothing.
- THE WRINKLE MAP (dermal-texture.js the FOLD page, `FOLD_SLOPE`; dermal-map.js `FOLD`, `dermalDetail`'s `slope`): the
  same folds as SHAPE, a narrow valley and the broad roll of skin on its lit side, baked as the height's slope over the
  head's mm (R toward the figure's right along the chart's `tr`, G up the head along its `ta`, 128 flat; B the valley's
  cavity), so the light draws a fold and it answers the light's direction: an engine's wrinkle normal map. Only where
  the face has lines (absent, no page). The dermis study bends its shading by it; `--key` moves the key light (a raking
  side light shows the folds turn with it). A normal map shades; it casts no shadow and leaves the silhouette smooth.
- THE FOREHEAD'S FURROWS AS SHAPE (head-relational.js `furrows`, 0 … 1, absent byte-identical): an old forehead's three
  deep folds cut into the skin, each a tube laid along the forehead by the landmarks, sunk along the skin's normal so a
  shallow sliver cuts (~0.8 mm at 1), thinning to nothing at its ends, its edge blended soft: real shape, so an engine's
  light casts it and the profile carries it, under the same lines the paint and the wrinkle map draw. The composer cuts
  them from the late fifties at the person's rate.
- THE FOLDS' PAINT BY THE ART DIRECTION (dermal-texture.js `FOLD_INK.lit`): where the light draws a fold (the realistic
  register, no painted `shade`), the painted core and shade at a little over half; whole where an art direction paints
  its light in.
- THE CLOSED MOUTH'S SEAM, EVEN (head-relational.js `SEAM`; the relational head re-pinned): a closed mouth's lip line
  is cut to one depth all along the lips (~1 mm under the less prominent lip's front, the lips' fronts probed across
  the mouth, fading at the corners) in place of the lip-line carve, whose depth swung from ~0.6 to ~2.4 mm and, where
  thin lips parted from it, left a groove under the surface net's cell: drawn as a row of dark notches along the lips,
  plainest on the men and the old. An open mouth keeps its carve.
- GREY BROWS AND LASHES (epidermis.js `hair.grey`): the brows' hairs silver at 0.7 of the scalp's share, the lashes' at
  0.3, each by its own die; the composer passes the years' `grey` on. Absent, none.
- GREY HAIR (dermal-map.js `grey`, 0 … 1, `GREY_HAIR`, `hairMeanOf`): a share of the strands silver, each by its own die
  (salt and pepper, not a tint), the beard's sooner and the body's later, carried as a strand's `streak` (`grey: true`);
  the texture's painted hair at the mean colour. A dyed strand keeps its dye. Absent, the hair as it was.
- THE LOWER LASHES over a full cheek (epidermis.js): a lash heading down onto skin that faces up is pushed forward off it,
  not up, so the lower lashes point down on the full-cheeked poles (both had them tipping up since the cheeks filled).
- THE DEEP TONES' ALBEDO (dermal-map.js `toneAlbedo`, which `dermisAt` and `skinBase` now read): an MST swatch is skin
  as a camera saw it, and the deepest two photograph near-black and grey (less red over blue than MST 6), so MST 9 and 10
  rendered as dark grey under a white sheen. Below MST 8's luminance a tone is lifted (by a square root under that knee,
  its order kept) and holds MST 8's red slope, the way measured deep skin stays a red-sloped few percent; the melanin
  measure (the blood shown, the palms) still reads the swatch. MST 1 … 8, and any hex tone at or above the knee, are
  byte-identical.

### Body-part map: dress tailored to the body, not the segment

- The realistic body's skin labelled by BODY PART (chest, abdomen, flank, upper and lower back, seat, hip, groin, neck,
  shoulder cap, armpit, upper arm, elbow, forearm, thigh, knee, shin, calf …) and by the MUSCLE most under each point,
  from the form field's own blend (each mass's share of the skin there), the deep base masses read by position:
  `bodyPartMap(recipe, R, build)` (body-relational-map.js); body-study `--map` colours the skin by part. The ground for
  dress tailored to the parts it covers, one piece across segments.
- Under the iliac crest (a hand over the hip's joint) the trunk is the seat behind, the hip at the side, the groin in
  front; a limb's bands by where a point lies down its bone (the shoulder's cap over the upper arm's top, the elbow, the
  knee, the wrist, the ankle about their joints); the armpit's fill above the hollow the shoulder's cap. A point inside
  another part's skin (the pelvis under the crotch, the arm's top under the cap) is `hidden`, for dress to leave alone.
  The labels eased over each grid (a point of a part fewer than three of its eight neighbours share takes theirs).
- THE FIELD GARMENT, the tee first (body-relational-garment.js `fieldGarment`, `FIELD_GARMENTS`): a piece names the body
  parts it covers, and on each segment that carries them the rings they mostly cover are its (down a limb to its
  `limit`); its surface one CLOTH FIELD, the body's own blended three times looser and eased out, each point cast onto
  it along the skin's own ray, then pulled TAUT along the piece (each slot's distance over the piece's length raised to
  its upper hull: from the bust's apex straight down, no ledge) and over its rings' hollows, at most 40 mm off. On the
  skin's grid, so it takes the skin's bind and correctives; its ends closed beyond its end rings. A realistic hero's
  `outfit: ['tee']` wears it in place of the segment tee. The envelope gains `taut`.
- SKIN-FITTING SHIRTS, outfit words `fittedTee` and `fittedShirt` (its sleeves to the wrist): close to the skin yet
  hiding the musculature and the joints' formations as a shirt does, cloth under tension spanning the GROOVES (the
  abdomen's lines, the cleft between the pecs, the deltoid's border, the spine's furrow, the elbow's hollows) and
  following the FORMS (the chest, the waist's taper, the arm's swell). On the realistic body a field garment: the cloth
  field blended half again looser, eased 2.5 mm, over each ring's hollows and pulled straight over any dip shorter than
  9 cm along the piece (the envelope's `span`: the grooves, the fold under the bust, not the waist's taper), by a SOFT
  cap (the envelope's `soft`: the lift saturating toward 45 mm, no ledge where it binds). Half of it lies within a
  centimetre of the skin (the tee: four). On every other body, segment pieces eased 3 mm. A field garment takes its
  envelope from its word (`looser`, `ease`, `reach`, `taut`, `span`, `along`, `soft`); the tee's as it was. body-study
  `--dress` draws the garments in cloth blue over the clay body.
- TROUSERS on the realistic body as a field garment, at the skin-fitting shirt's thickness (its cloth, so a shirt and
  trousers read as one fidelity): the waist, the hip, the groin, the seat, the thighs, the knees, the shins and the
  calves (`on`: the abdomen's and the back's names counted on the pelvis alone, so the trousers reach the waist and stop
  there). The seat starts where the pelvis's rings rise (`floor`: its lowest rings lie flat at the crotch, widening at
  one height, and cloth copied from them wound inside out), its cap closing between the legs; the trunk's cloth takes
  the thighs in (`join`), so the seat wraps their tops; the seat and the legs CROSS a few centimetres over the crotch
  (under it the seat let down under the legs, over it the legs under the seat), so the seat's edge leaves no lip.

### The tailored suit: a jacket's front and lapels

A suit read as a suit on the realistic body: its front, its lapels and its buttons as words on the outfit card, made
by the tailor. Cards without them unchanged, byte for byte.

- THE WORDS (`outfit/styles.js`): `outer.front` `single` | `double`, `outer.lapel` `notch` | `peak` | `shawl` | `none`,
  `outer.buttons` 1–3; any of them gives the jacket a tailored front (single with a notch lapel and two buttons, double
  with a peak and three rows, unless named). The expander carries them as the build's `tailoring`, beside its pieces;
  the lapel's facing a `Lapel` tone (the card's, else a shade off the jacket's). The authored game body's jacket is
  unchanged by them.
- THE FRONT (`body-relational-tailor.js`): `cutV`, the jacket's V from its top button up to the collar, taken in under
  the shirt, its edge carried onto the roll lines and its walls painted as the shirt (on cloth whose points sit 2 cm
  apart a V cut by them alone is a ragged slit); `lapelBand`, the lapels and the collar one band along the roll lines
  and round the back of the neck, its width the lapel's shape (the notch's step at the gorge, the peak's corner carried
  up and out, the shawl's one curve), the collar falling down over the shoulders, its inner edge rolled over the V's;
  `buttonOn`, a disc on the cloth. The wear adapter places them: the stance by the button count (two a little above the
  waist, one under it, three higher), the roll lines to the side of the neck, one row of buttons or two; a lapelled
  jacket wears no stand collar. Each part closed and wound once; a stride stretches no edge of it past 5 mm.
- CLOSED, ONE SIDE OVER THE OTHER: a closed tailored jacket's right front lies over the left, its edge a band standing
  on the left front from the top button to the hem. A single front is cut away below its last button (the quarters,
  `cutOpening`, opening on the trousers, the left front's edge come out from under the right); a double front is square
  to the hem, its edge past the left row of buttons, its left lapel going down under the right front so the two cross
  above the buttons.
- THE TIE (`language.tie: true`): a blade on the shirt from its collar to the belt (`bladeOn`: the knot a block, the
  blade widening to its point), the jacket carried out over it (`clearOver`) and showing it in the V; a card's `Tie`
  tone, else a deep red.
- Two business cards: `business` (navy, single-breasted, two buttons, notch lapels, a burgundy tie) and
  `doublebreasted` (charcoal, peak lapels, three rows of buttons, a navy tie over a pale blue shirt).
- OPEN, THE LAPELS TO THE HEM: an unbuttoned jacket's fronts hang a little apart from the top button down, its lapels
  carried on down each front's edge to the hem as the facing turned back (its buttons on the front under's edge).
- A WOMAN'S SUIT closes her way, left front over right (the hero's sex handed to the tailor with the front's words),
  every overlap, edge, crossing and button mirrored. A skirt's waistband is a layer under a jacket worn over it, and
  the jacket is carried out over the skirt at its own height (the skirt's rings filled in between, so a ring reads the
  skirt where it is, not 2 cm lower); every garment's trunk clears the trunks worn before it below the waist (close cloth
  over a woman's hips had lain inside the trousers' seat, which bridges from hip to hip, showing them through a
  jacket). Two cards: `skirtsuit` (navy, one button, notch lapels, a pencil skirt to the knee, a white blouse) and
  `trousersuit` (black, double-breasted, peak lapels, gold buttons, wide trousers, an ivory blouse).
- THE SHOULDER AND THE WAIST: `outer.shoulder` `natural` | `structured` and `outer.waist` `suppressed` | `straight`,
  alone or beside the front's words. Structured, the jacket's shoulders squared on a pad (`squareShoulders`: above its
  widest ring each ring's reach to the side carried out to the straight line from the neck's point at 18°, 4 mm past
  the widest, square from there down to it; a centimetre had stood the shoulder out past the sleeve's head). Suppressed,
  the waist drawn in toward what the jacket is worn over (`takeIn`, eased over 11 cm either side); straight, a sack's
  fall from the chest to the hip, the waist's hollow bridged (`fallStraight`). The collar now falls at the back and
  not at the sides of the neck, where over a squared shoulder it had stood out as wings, and is a little narrower. The
  suits wear them: `business`, `doublebreasted` and `trousersuit` structured, `skirtsuit` natural, all suppressed.
- THE LAPEL ALONG THE CLOTH: its outer edge measured along the jacket (`clothWalker`: round the ring at its height, up
  or down the cloth), not stepped out sideways and dropped back onto it, which had stood its top out off the shoulder
  in the air; its section six points across, so over a bust no chord of it dips under the cloth, and its rings twice as
  close along the roll line. A closed front's V is off the middle and a face's paint is mirrored, so the cut's walls
  are painted as the shirt only where both sides are cut (a one-sided wall's paint had laid a strip of white shirt on
  the jacket beyond the lapel); the quarters' paint the same. The belt is made before the jacket's front, the waist
  suppressed onto it and the ridge it leaves eased into the cloth 6 cm above and below (`bridgeRun` now takes a range,
  along the run only, and points to hold); a skirt reads what is under it within 1 cm of each ring (`clearanceOver`
  takes its window), so it no longer flares out too soon into a shelf under a jacket.

### The garment designer: silhouette principles over tailoring primitives

Garments on the realistic body as data over a small set of construction primitives, and the principles
that make a silhouette read as measures with bands, so a garment is chosen and checked rather than designed by hand.

- THE TAILOR (`polygonizer/body-relational-tailor.js`): the realistic body's construction in one place, each a pure
  function that knows no garment: runs (`oneTube`), profiles (`drapeRun`, `clearanceOver`), edges (`fallToFloor`,
  `turnHemIn`), trims (`bandAt`, `strapBand`, `sashOn`, `strip`, `ribbon`, `soleSlab`, `buckleOn`) and binds
  (`bindNearest`, `bindRibbon`, `ringW`). The trousers, the gi and the footwear are each their choice of them. Moved byte
  for byte (`body-relational-tailored.char.test.js`, out of the critical tier: each case mints a realistic body), but
  for one fix: a strap is now the one band, its caps riding with their ring as a cuff's do.
- THE PRINCIPLES (`docs/garment-principles.md`): what makes a dressed silhouette read, each as a measure of the dressed
  figure with a starting band in two styles, western (fashion and tailoring) and anime/game (character costume):
  silhouette families and their shift from the bare body, waist suppression, fit class, return points for loose cloth,
  the dominant division on thirds and never at halves, the leg line, a hem off the limb's widest, the shoulder line,
  fabric stiffness, the flair budget, readability at a thumbnail, and rules for dressing each body type. Every source
  so far seen only in search results, and said so.
- THE DRESSED OUTLINE READ (`polygonizer/dress-outline.js`): the realistic body's outline sliced off the compiled mesh
  against the bare body under it (a tenth of a second): the family, each half's fit, where loose cloth returns to the
  body (by its standoff each side, so layers at a belt count as a return), the divisions (only where a garment spans the
  body and does not go on below), the leg line, a hem's place on the limb, the flair pieces, and advice in each style.
  In the realistic hero's readout as `dress.outline`; `/body-study --outline` draws it. It found the gi's belt a cone up
  to its blouse (the gi now cinched past the belt) and advises the gi's skirt off the thigh's widest.
- OUTFIT CARDS ON THE REALISTIC BODY (`polygonizer/body-relational-wear.js`): the outfit expander's pieces (a card's,
  a stylism's, an outfit word's) worn by the tailor instead of the authored body's ring copies baked on the realistic
  envelope (a cropped top, rippled shoulders, belt shards). The expander still makes every design choice; the adapter
  only makes them: each garment one cloth block over its windows (the trunk's `u`, a limb's `run`), each layer standing
  off the one under it, a limb's two pieces one tube faired over the elbow or the knee, a top's tail and body one; a
  knit or fitted top's second-skin paint made close cloth worn first; a sleeve or leg stopping short of the hand or the
  foot turned back in to the limb; a collar a stand collar up the neck (`collarOn`); boots and shoes the footwear
  primitive; the belt a band with its buckle at the front. Each authored part name a worn piece had is an ALIAS for the
  cloth it became (its `u` shifted where pieces were merged), and the cloth is in the body the dress is made on, so
  what the expander placed on a piece lands on it: trims and an open front painted on its faces, rows of buttons,
  embroidered emblems, pauldrons. Still the authored kernel's: hanging panels, capes, hoods. New tailor primitives:
  `flareRun`, `fairRun`, `collarOn`, a buckle at a named slot.
- STYLISM ON THE REALISTIC BODY: no longer refused. A genre, a register and a target outline lower to an outfit build,
  worn as above. `/body-study --palette` shows a figure in its palette's colours, face by face.
- THE DESIGNER: the stylism given the principles (`stylism/proportion.js`), opt-in, nothing moving without it.
  `stylism.canon: 'western' | 'anime'` names the principles an outfit is designed to: the lengths the solver chose (a
  coat's, a top worn out, a skirt's, a trouser leg's) are judged where they land on the figure, measured on the
  realistic body for each length word, and moved to the nearest word that lands well (never at halves, never on the
  thigh's top or the calf's belly, the leg line kept), the hero's own lengths and a card it named standing; each move a
  note in the stylism's ledger, and the outline read advises in that canon. `stylism.silhouette: 'balance'` picks the
  outline the figure is dressed toward by the canon's rules for its cast and physique (a jacked western male a column, no
  padding; a heavy figure one long vertical run; a drawn female an X), with why. The outline read's calf is the bare
  leg's now, the knee not counted.
- THE PROOF, by data alone: a long coat, a gown, a structured jacket and `balance`, each a stylism with a canon, on
  male and female, athletic and heavyset; every one made without new garment code. What the run found and fixed: a waist
  wrap built for the authored body's girth cut through a heavy figure's coat (now a band, or a sash, made by the tailor
  on the outermost cloth at its height); loose sleeves swelled into balloons (loose cloth past 14 mm of ease now hangs,
  the tailor's fall down the limb, a sleeve narrowing to its cuff); the read judged a hem just under the knee as on the
  calf (now a good landing, as the stage holds); the family cut-offs re-centred on this body as it is read (a gi and a
  straight coat H, a long coat and a gown A, a cinched bodice over a flared skirt X).
- THE REALISTIC REGISTER: the realistic body's cloth cut as a character designer of the seventh console generation
  cuts it (close, with a real wearing ease; the silhouette from the cut, the belt, the coat's skirt and the layers, not
  from volume), where the expander's eases were tuned on the game body. Every garment the close cloth now, its ease
  compressed toward its role's ceiling (a shirt 12 mm, trousers 14, a coat 22: a coat still looser than a jacket, a
  jacket than a shirt) and held no farther than 15 mm past it (`fieldGarment`'s new `stand`: the trunk's cloth no longer
  carried out over the arms at the armpit). A COAT'S SKIRT, or a skirt's own, is the tailor's now (`carrySkirt`): carried
  down from the garment's body, close at the waist, falling from the hips' widest without following the legs back in,
  the hollows bridged, an A by the expander's flare over its drop compressed the same way, its hem turned up inside so
  it opens beneath; a skirt with no body hangs from a waistband of the close cloth, its belt on that. The authored skirt's
  name is an alias for it (turned: its hem the lowest `u`), so a trim painted on its hem lands there. Measured per side
  over the bare body: a long coat's chest about 10 cm → 6, its waist 9–12 → 4, its knee 11 → 7. Also fixed: a stand
  collar with no neck above the garment's top (a heavy figure's shirt) is left off instead of built inside out; the
  martial trousers' shin piece no longer carries a negative flare the authored body refused. SLEEVES are their own
  now: at their own pieces' ease, closer than the body's, a layer out only over the sleeves under them (not the
  trousers), bridged over the arm's hollows (the tailor's `bridgeRun`), and hanging only when the cut itself is loose,
  where every jacket's sleeve used to fall straight from the shoulder (a jacket sleeve 2.4 cm off the arm → 1.0–2.0). A
  jacket worn over the trousers' belt clears it; an open front painted on a jacket whose body and tail are one tube
  is each piece's own again (the tail's paint, in the trousers' colour, had covered the whole front).
- `/garment-design <brief>`: the designer as a skill. The brief in stylism words or a card, the rationale principle by
  principle, the mint and the read, the words adjusted at most three times, the sheet shown; the eyes gate the
  operator's.

### The gi: a wrapped jacket over the martial artist's trousers

A jacket that goes over the wide trousers, on the outfit word `gi` (`polygonizer/body-relational-gi.js`; the authored
body wears a wide top, sleeves to the forearm and a hem over the hips):

- The BODY one tube from the collar to its hem: close over the shoulders, hanging below the chest (the slack eased in,
  so the back has no step), BLOUSED over the belt it is cinched under, then a SKIRT carried straight down past the hip,
  every ring clear of the trousers under it; the skirt's weights the pelvis's, the thigh's shared in toward each side.
- The WRAP: a V from the collar to the crossing, the cloth inside it taken under the skin, which shows; one COLLAR band
  lying on the cloth, up the right edge, standing round the back of the neck, down the left edge and over the crossing to
  the right waist (left over right); the over-panel's edge on down the skirt. Both in `TopFold`, the jacket's own shade.
- WIDE SLEEVES draped as the trousers' legs are, one tube from the shoulder to the forearm, flaring to the hem.
- TURNED HEMS: the skirt's and the sleeves' cloth folded back up inside, so they open as cloth does instead of closing
  with a lid (the loft winds such a tube only from the collar down, its cap's pole back toward the opening).
- The BELT is the jacket's (band, knot, tails); the trousers' sash is left off under a gi. The drape's sash takes a
  station and a name, and its legs an optional `flare` (absent, the trousers are unchanged).
- Machine gate (`body-relational-gi.test.js`): closed and wound once, the skirt outside the trousers from the belt to the
  hem, no jacket over the chest's middle in the V, each sleeve wider than the arm and its hem turned in, no edge grown
  more than 3 cm in a stride or a sprint (a ribbon's corners take one station's weights).

### Loose cloth that falls: the martial artist's wide trousers

Everything the realistic body wore was FITTED: the cloth field close over the forms. Loose cloth now hangs
(`polygonizer/body-relational-drape.js`), on the outfit words `martialPants` and `wideTrousers`:

- The DRAPE: the trousers' leg rings re-made hanging, each slot's radius the widest of its own (and a slack) and the
  ring above's let down slowly (`taper`), so the cloth falls from the seat and the thigh past the knee instead of
  following it in; vertical folds round the ring, deeper toward the hem.
- ONE TUBE A LEG: the thigh's and the shank's rings one piece (no edge across the knee), the shank's taken round at the
  thigh's slots, every point's weights mixed from its own piece's, so a stride carries the cloth with the leg.
- The MIDLINE: each leg's inner side held off the body's middle plane, so the two legs never cross (at the crotch,
  where the thigh's skin reaches the plane, the plane wins).
- The HEM: `martialPants` blouses over a cuff gathered at the ankle (a wrapped band, its caps weighted as its rings,
  so a bent knee carries the whole cuff); `wideTrousers` falls open to just above the ground, over the foot.
- A SASH at the waist, a knot at the front and two tails hanging. Tones `Sash` and `Cuff`.
- Machine gate: closed and wound once, the legs apart at the midline, wider than the calf, the cuff with the ankle in a
  stride and whole on its ring, the open hem never under the ground (`body-relational-drape.test.js`).

### Armour fitted to the realistic body

In progress. An armour build (`adorn: { type: 'armor', style }`) on `form: 'realistic'` was the authored body's kit baked
on the realistic body's envelope: plates sampled 6 × 4, the breast and back windows open at the flanks, the fauld two
coarse wraps crumpling over the belly, the pauldron's anchor folding over the shoulder's turns. Now
(`polygonizer/body-relational-armour.js`, the style still naming every piece, its window and its ornament):

- Every plate sampled as densely as the realistic skin under it and made the kit's own hollow plate (a wall rolled at
  its edges, faired over the forms beneath: `fitPlates`).
- The CUIRASS (the kit's breast and back plates) and the FAULD made field shells round the trunk over their windows
  (a field garment at a plate's clearance, taut over the forms; `fieldGarment` takes a `window` in the segment's
  stations), worn on the body the rest of the kit is baked over, so a tasset or a strap stacks over them.
- The PAULDRONS a JOINT CAP each (`jointCap`): a dome over the shoulder from a centre deep in it, the farthest of the
  skin and the cuirass under each direction faired and held clear, its outer and inner walls rolled at the rim,
  carried by the clavicle; the kit's lames down the arm under it.
- The GORGET optional: the realistic body wears it only when the build names it (`wear: ['gorget']`, armor/expand.js
  validates the word). The authored body's armour byte for byte.
- By ROLE, not by name (`roleOf`: a piece's carrier, its window, whether it wraps, what it spans), so every family is
  fitted alike and a style the fit has never seen is fitted by what its pieces cover: the trunk's panels front and
  back one CUIRASS (the knight's breast and back, the hardsuit's chest, back and abdomen plates); every wrap round the
  trunk a field HOOP over its window, each over the one before in the kit's stacking (a fauld's lames, a belt, the
  lamellar rows), the lowest carried down to a skirt's hanging plates when no cuirass meets them; a pinned panel hangs
  (the lamellar skirt) and keeps its kit shape; a shoulder's anchor a CAP; a foot's wrap a BOOT; a neck's wrap the
  optional gorget; the HEAD's pieces (a helm, a neck guard hung from it) left off, not fitted to the relational head
  yet. A strap hugs what lies under it (its lift read within 2 cm). Plate, lamellar and hardsuit styles mint on the
  realistic body (a lamellar suit refused before: its neck guard's address fell off the realistic neck).
- The SABATONS boots (the realistic foot turns from the ankle to the sole, which folds a plate): the footwear
  primitive's, below. The realistic foot's rings carry the authored foot's `u` (a share of its span), so an address
  made for the authored foot lands on the same share of the realistic one.
- THE PLATES LIE ON THE BODY, THE ARMS OUTSIDE THEM (body-relational-armour.js `PLATE_STAND`, fieldGarment `stand`,
  `shoulders`, `under`). A trunk plate was cast out to where the trunk's field ends, and that field runs on over the
  arms hanging beside the chest and the deltoids blended into it: the cuirass was a barrel half again the chest's width
  (0.25 m from the midline at the chest, the skin at 0.12 to 0.2), the arms inside it from the waist to the shoulder.
  A trunk plate now stands at most its clearance and 2 cm past the skin; the cuirass's field leaves the deltoids out,
  and it is worn under the upper arm: within 2.5 cm of the arm (its armhole, and over the shoulder's ball, where the
  pauldron's cap sits) it eases down onto the skin at its clearance, after the envelope's lift. The arm hangs over its
  edge, its lames and rerebrace their own. Other garments write what they wrote (the options are off by default).
- The read judges what the body wears (`dressReadout`). The realistic knight's read had judged every piece of the kit
  as planned: the breast and back plates, the faulds, the sabatons, the pauldron's facing and the gorget, worn as its own
  shells or left off, each "does not read" at exposure 0, 12 of its 70 warnings. They are now `dress.unworn`, named and
  not judged. What remains is real: the straps' buckles buried under the cuirass, the vambraces that never read, and
  the shells that replaced the kit's pieces carry no signature of their own (the focal pauldron's facing among them).

### Footwear: a solver library, an adapter per body's foot

In progress (the library and the realistic body's adapter first; heels, laces and the other bodies' feet next).
`lib/graph/footwear/`, on the armour and outfit pattern: footwear in THREE LAYERS (`principles.js`), the SOCK (the
protosock, the shoe's close outer layer and its bottom colour: a height and a thickness, none for a sandal), the SOLE
(its layers stacked from the floor up, each with its own thickness, welt and group: an outsole, a midsole, a stripe; a
layer's patterns: `pod` an air window at the heel, proud of its wall; `heel` a block under the print's rear, a dress
heel on the still-flat foot; `lugs` tread round its edge) and the ADORNMENT the solver lays over them
(`ADORN_PRIMS`: `strap` with a `buckle`, `band` (gilding), `cuff` at the sock's collar, `toeCap` (a quarter egg over the
toes, mapped from the toe base to the frontmost toe with a toe allowance past it (`room`), the leather under it tucked
inside, `rivets` round its back edge, small and dark a brogue's perforations; in the leather's own group a sleek toe);
`panel`, a pattern piece on the upper as a cobbler cuts it (`cobbler.js` COBBLER_REGIONS in the sock's own
coordinates, along the foot and round from the instep's centre line: the `tongue` (standing above the collar by its
`rise`), the `eyestay`s, the `vamp`, the `quarter`s, the `counter`, the `foxing`; or an inline region), a MATCHING PAIR,
lateral and medial, where the piece has two sides; `laces` criss-cross between the eyestays over the tongue; any of
them in a `group` of its own). Composed by CARDS (`styles.js`, pure data: a new look is a card), each annotated
with its `family` (shoe, boot, sandal, sneaker, dress); a card EXTENDS another (`from`: its sock merged, `adornPlus`
appended, its tones merged), and wears any COLOURWAY (`skin`: `SKINS` tripleBlack, tripleWhite, volt, navy, oxblood,
tan, or its own tones by group), the pieces' groups being roles (Overlay, Counter, Eyestay, Midsole …); by passes in a fixed order (`expand.js`: sock, sole, adorn, tone; tones
only for the groups laid), refused by name (`validateFootwear`). Worn on any body through its FOOT ADAPTER (`adapters/`:
which parts are the foot, the toes and the shank, the rig's ankle, toe base and toe tip, the bare skin a sandal is worn
on, the body's own way to lay the sock, and how a share along a segment names its stations): a card's places are shares
of a segment, so it reads on any body. `wearFootwear(adapter, card)`.
The realistic body (`adapters/realistic.js`; `polygonizer/body-relational-footwear.js` re-exports it): the sock a field
garment, close over the foot's forms (`boot`: up the shank as a shaft, the foot's leather tucked under it round the
ankle; `shoe`: from a collar below the ankle; its `thick` the leather's ease). The words on the realistic body: `boots`,
`shoes` (new), `sandals` (new; on the authored body a low close shoe), `workBoots` (a steel toe, riveted),
`adventurerBoots` (a thicker sock, a deep sole, a cuff, a gilt band, a buckled strap), `sneakers` (a court shoe: a white
cupsole on a gum outsole, a rubber toe bumper) and `runners` (a foam midsole with an air pod, a contrast stripe), both
cut as sneakers are: tongue, eyestays, laces, matching quarter overlays, the heel counter. SPORTS varieties over them:
`highTops` (over the ankle, a padded collar, an ankle strap, a deep cupsole on air), `skateShoes` (a vulcanized sole, a
suede vamp, a side stripe), `trailRunners` (a lugged outsole, a toe guard). DRESS shoes (a sleek sock, a leather sole on
a welt, a stacked heel): `oxfords` (cap toe, closed lacing), `brogues` (perforated round the cap), `derbies` (open
lacing over a tongue), `loafers` (a saddle strap), `monkStraps` (two buckled straps), `chelseaBoots` (elastic gussets,
a pull tab). BOOTS cut as a cobbler cuts them: a region's `shaft` carries its piece on up a boot's shank (the quarters past the
ankle, wrapping round to meet at a back seam; the tongue up the front, standing above the top; the eyestays beside it,
the laces on up between them, `shaftRows`; where the foot's piece begins below the ankle, a bridge on the foot's
leather cut round as the shaft's, so no plain leather shows between them), so any boot-height card is cut up the leg
and a shoe is not. Cards
`hikingBoots` (lugged, a padded collar, a toe guard), `combatBoots` (laced to mid-calf), `chukkas` (suede, a crepe
sole), `cowboyBoots` (pull tabs, a stitched band, a cuban heel the body stands on, a long toe), `ridingBoots` (a tall
plain shaft, a low heel); `workBoots` laced. FANTASY, DRAMA AND HISTORY (`fantasy.js`): primitives the cobbler's pieces do not make, composed by cards like any
other: `toePoint` (the toe drawn out past the toes, tapering, curled up by its degrees, a `bell` on its tip), `wrap` (a
ribbon spiralled up the leg, on the leather or the bare leg above a short boot; `cross` a second the other way),
`flare` (a funnel rising from a boot's top and opening out), `buttons` (a row up a boot's side), `spur` (a neck from the
heel and a star rowel), `wings` (a fan of feathers at each side of the ankle), `jewel` (a stone on the toe, the instep or
the ankle), `fur` (a shaggy ruff round the collar, or round the leg at a share: tufts and a drooping fringe of seeded
lengths); the heel kind `teeth` (a board on two teeth, the foot raised level when the toes stand as high as the heel).
Families `historic` and `fantasy`. Cards `poulaines`, `jesterShoes`, `persianSlippers`, `romanCaligae` (hobnailed),
`gladiatorSandals`, `vikingWraps`, `cavalierBoots`, `buttonBoots`, `geta`, `elvenBoots`, `talaria`, `furBoots`, `barbarianBoots`. On the authored body
a card wears its boot, sandal or shoe by its sock. HEELS (`heels: { height, toe, shank, kind: stiletto | kitten | block | wedge }`) change the mechanics: the foot is
tipped about the toe base and the body risen on them, as the RIG'S STANCE (`rig.stance: { rise, toe, pitch }`,
`station-loft-rig.js`: every pose stands in it, the root `rise` higher, each planted foot's toes `toe` up and its
metatarsus `pitch` degrees heel-up, or the pose's own heel where it lifts further, a free foot's toes turned down by the
pitch; absent, nothing changes), solved from the foot's own heel-to-ball length so the legs keep their length; the soles
and the heel cut against where the ground will be under that pose, rigid on the foot's and the toes' bones, the heel
leaned in the bind so it stands plumb when worn, a slender heel's foot under the back of the seat. Cards `pumps`,
`blockHeels`, `wedges`, `platforms`; `chelseaBoots` on a low block heel. A tone may be `{ of: <group>, shade }` (that
group's colour darkened or lightened, read after the palette: `readTones`), so recolouring `Shoes` carries the pieces
cut from it; the dress cards use it. A card's or its skin's named tones stand over the palette's defaults, the
operator's palette over all. body-study `--dress` paints the shoes in their own colours; a rig with a stance stands the
bind in it; `--crop shin` frames a tall boot whole. On the
authored body the library's other words are its boot, its sandal or its shoe by the card's family, for now. `boots`, `shoes` and `sandals` are pinned byte for
byte as the primitive first made them (`footwear.char.test.js`). `fieldGarment` takes `covers: null` (every ring of the
segments it is `on`). body-study `--dress` colours each footwear group by its tone.

### Handwear: a solver library, an adapter per body's hand

The footwear library's sibling for the hands (lib/graph/handwear): a CARD (pure data, a family, `from` its kin, `skin` a
colourway, `adornPlus`) worn through a HAND ADAPTER by passes under laws, the gloves the way the shoes are made.
- THE PROTOGLOVE: the palm's and the digits' own rings stood off by the leather's thickness, a digit cut at its middle
  joint or at its knuckle where the card's `fingers` (and `thumb`) say, its end closed inside the finger; the cuff up
  the forearm by its share (the realistic adapter's close leather, a field garment); a glove with no cuff tucks its
  first ring under the forearm's skin. `glove: false` lays the adornment on the bare hand.
- THE GLOVER'S CUT (cutter.js): pieces in the hand's design coordinates (the plating library's fitted shell: along the
  segment, round it from the back of the hand, the thumb's side +, the palm ±1), named `back`, `palm`, `heel`,
  `knuckles`, `fingerBacks`, `fingerPads`, `thumb`, or `{ seg, t, s }`.
- ADORNMENT PRIMITIVES (`ADORN_PRIMS`): a piece, the points stitched down a dress glove's back, a cuff, a strap (a snap
  or a buckle on its back), a flared gauntlet cuff from the wrist, a hard knuckle guard, studs, a knight's lames, rings
  with stones, a stone on the back or the knuckles, claws curled toward the palm (each rigid on its last phalanx), fur, a
  fighter's crossed wraps. Each takes its surface's weights.
- CARDS by family: glove (`gloves`, `suitGloves`, `fingerless`, `mitts`), dress (`dressGloves`, `operaGloves`,
  `drivingGloves`), work (`workGloves`, `weldingGloves`, `gardenGloves`), sport (`bikerGloves`, `cyclingGloves`,
  `goalkeeperGloves`, `fightGloves`, `skiGloves`, `handWraps`), historic (`cavalierGloves`, `falconryGlove`,
  `knightGauntlets`, `bishopGloves`), fantasy (`clawGloves`, `sorcererGloves`, `furGloves`, `gemGauntlet`); colourways in
  `SKINS`; a piece's tone may be OF the leather's.
- SPORT AND DRESS VARIETIES, skinnable as the shoes are: sport `battingGloves`, `golfGloves`, `liftingGloves`,
  `receiverGloves`, `racingGloves`, `hockeyGloves`, `tacticalGloves`; dress `kidGloves`, `walkingGloves`, `winterGloves`, `eveningGloves`, `mousquetaireGloves`,
  `bridalGloves`, `ceremonialGloves`, `perforatedDrivers`, most a variety of their kin (`from`). Primitives `buttons`
  (a row at the wrist's opening, up the inner forearm along a long cuff) and `perf` (a grid of perforation over a
  region, on each digit of a digits one). Colourways for sport (`tripleWhite`, `infrared`, `royal`, `hiVis`, with
  `volt`, `navy`) and for leather (`cognac`, `chocolate`, `dove`, `burgundy`, `ivory`, with `tan`, `oxblood`): a
  leather colourway carries every piece whose tone is OF the leather. The knight's and the stone gauntlet are the
  `gauntlet` family's.
- THE MITTEN SHELL (a card's `mitten: { pad, grip, thumb }`): one closed padded form over the palm and the four fingers
  in place of their gloves, made round the gloved hand as spheres (the palm's surface, each digit's bones sampled
  along) sliced from the wrist on past the fingers, each slice read out from its middle, its front rounding off where
  the spheres end. With a `grip` (a hand word: a boxing glove's `fist`) the shell is made round the closed hand, rigid
  on the hand bone, and the body HOLDS THE GRIP AT REST (station-loft-rig.js `holdGrip`: the hand's joints and every
  part riding the digits' bones turned into it by the rig's own curl), so the bind, every pose and an export keep the
  fist inside it; without one the shell bends with the fingers inside it, each point taking its nearest skin's
  weights. `thumb: 'apart'` keeps the thumb in its own sheath. Words `boxingGloves` and `sparringGloves` (a fist, its
  thumb sewn to its side), `mittens` (knit, the thumb apart).
- FANTASY AND HISTORIC MITTENS on the shell. `mitten.free` leaves any digits outside it in their own sheaths (a
  trigger finger); a piece aimed at a digit inside the shell skips it, and claws grow from the bare tips through it. The
  primitive `ribs` lays bands across the shell, spaced by its length (lames, scales, trim, cracks). Historic
  `mailMittens` (a mail muffler), `mittenGauntlets` (Gothic, steel lames to the fingertips, the thumb's own),
  `lobsterGauntlets` (blued, lames from the back of the hand), `triggerMittens`, `arcticMittens` (sealskin, trim, fur);
  fantasy `bearPaws`, `pincerGauntlets`, `golemFists` (a stone fist held closed), `dragonClaws`.
- Every card is an outfit word, worn on either body through its adapter (its parts riding their segments' dials, its
  tones under the operator's palette). THE AUTHORED BODY wears them too (adapters/authored.js): the same hand as the
  realistic body's, its glove's cuff new rings sampled round up the authored forearm's few coarse ones, their weights
  mixed from the rings either side. A mitten's grip marks the hand `held` (station-loft-rig.js): a pose's own fingers
  no longer curl it on past its glove's fist (a guard's fist had curled the thumb out through the shell); its wrist
  still turns. body-study paints its groups, a palette's colour
  first.
- The fitted shell reads a coarse ring (the hand's eight points, a digit's six) as it is, unsmoothed: easing toward
  neighbours that far round had lifted the flat back of the hand about 7 mm off it.

### Wearables sized to the body: no one wears the same size shoe

The footwear and the handwear libraries' cards were drawn on the realistic man (every sole, heel, welt, strap, cuff,
claw and mitten's padding in his metres), so the realistic woman, the tall and the short builds wore his sizes. Now each
is worn at the body's size: an adapter reports its body's foot (heel to toe tip along the foot: `footLength`) or hand
(the wrist to the middle finger's tip: `handLength`), and where it differs from the reference the cards were drawn for
(`FOOT_REFERENCE`, `HAND_REFERENCE`, the realistic man's), the body is carried to the reference's size, the card worn
there unchanged (its lengths, the library's defaults and its tolerances alike), and every piece carried back, a heel's
stance with them; the adapter's own close-fit distances (the leather's ease, the envelope's reach) take the scale too.
The reference body is worn as it was, byte for byte (its pins hold). Both libraries' realistic adapters and the
authored hand adapter report their size; the plated suit's feet and hands, being these libraries' cards, follow.

### Plating: segment-paneled armour on the realistic body

In progress (the realistic body first; joint caps, glow seams and the other bodies next). `lib/graph/plating/`, a module
of its own beside the armour (it leaves `armor/` and the realistic fit untouched; the hard-suit can adopt it): a powered
suit as TWO LAYERS, an undersuit (a close field garment over the trunk and the limbs) and PLATES over it, each a REGION
of one segment in that segment's own coordinates (`regions.js` PLATE_REGIONS: along it, round from its front line;
chest, abs, flank, back, lumbar, belt, hip, shoulder, bicep, triceps, gauntlet, thigh, thighOuter, hamstring, shin,
calf; or an inline region), cut from the suit's own grid and standing off it by its `lift` (footwear/cobbler.js
`panelOn`), never across a joint; split into `rows` whose gaps are the PANEL LINES; a matched pair where the region has
two sides; a REACTOR disc on the sternum in a rim, its group rendered full-bright (`emissive`). Composed by SUIT cards
(`styles.js`, pure data; `from`, `platesPlus`, a `skin` colourway), refused by name (`validatePlating`). Outfit words on
the realistic body: `powerSuit` (red and gold), `stealthSuit` (black, wide panel lines), `heavySuit` (gunmetal, far
standoff, more rows), `sleekSuit` (white, few plates); on the authored body none yet. body-study `--dress` paints a
suit's groups in their own colours.
FITTED SHELLS (the layout of a powered suit as a supercar's body is laid out, `shell.js`, `layouts.js`): a segment faired
into one smooth shell (`fairShell`: its grooves bridged), cut along DESIGN LINES in its own coordinates (`t` down it,
`s` round it, + its lateral side) into panels (`shellPanel`) fitted across narrow seams, bevelled down into them, domed
where they cap, stacked by LAYER (an underplate, a trim strip, the overplate, a cap, a light), so the overplates'
windows show the metal beneath; a mirrored panel's pair on the other side. Its lines run STRAIGHT and JOG (`stepped`:
straight runs joined by short straight diagonals, neighbours sharing their jogs so they fit along them), each kink a
sharp corner (a panel takes a section at every kink of its edges).
MUSCLE-MAPPED SHELLS (`muscles.js`): on a muscled segment the body draws the lines. The realistic body's muscle map
(body-relational-map.js) gathered into PLATE GROUPS per segment (`MUSCLE_GROUPS`: the pectoral, the sternum, the collar,
each row of the rectus, the oblique, the lat, the trapezius, the spine; the deltoid, the biceps, the triceps; the
brachioradialis, the extensors, the flexors; the rectus femoris, the vasti, the adductors, the hamstrings, the knee),
each plate's edges the boundaries between its muscle and its neighbours' (at the half-slot between them, so neighbours
share them), STRAIGHTENED (`straighten`: held straight, jogging only where the groove moves and holds), so the seams fall
in the grooves in the stepped style; each group its layer and colour role, an underplate under each segment. A suit's
`muscles: { on, only?, bulk?, seam? }`. The suit `markSuit`: the trunk, the arms and the thighs cut by their muscles, the
greaves, knee caps and sabatons below, a reactor on the sternum. The JOINTS banded (`joints`: two narrow articulated
bands at the shoulder, the elbow, the wrist, the waist, the hip and the groin, the back of the knee; the armpit a banded
group), the grooves wider (14 mm), the calf cut by its muscles (the gastrocnemius's two heads and the soleus, under the
greave's front, `greaveFront`); the labels eased before the cut (a point takes the group most of its neighbours share);
a point inside another part's skin (`hidden`) left out, and each segment's underplate and joint bands kept to the stretch
of it that shows, so the inner of two overlapping skins does not poke through. Where the muscles interleave too finely
to cut by (the lower back, the pelvis, the thigh toward the groin), a DESIGNED cut instead: `spine` (a dark channel down the back, a column of
vertebrae, a sacrum ending in a chevron; a design line may run through the back, `s` past ±1), `lumbar` (stepped plates
either side of the spine), `hips` (seat and hip plates, a codpiece, a low-abdominal plate), `thighs` (a quadriceps plate narrowing to the knee in a chevron, a
trim strip down the outside, a side plate, an adductor plate inside, a teardrop over the vastus medialis, hamstring plates
either side of a back seam); and SERVOS (`servos`: a hub at
the outer and the inner side of each knee and elbow, a disc, a domed core and a light; a panel may be a `circle` sized in
metres). `markSuit` cut by its muscles where they are clear and by design where they are not. Layouts `greave` (a chevron shin plate, side
plates sweeping to the ankle, windows with trim strips, calf plates over them, a cuff, vents), `kneeCap`, `sabaton`. A
suit names its `shells` (with a `bulk`), its undersuit's segments (`suit.on`) and its `feet` (a footwear card: its sole,
its quarter-egg toe). The suit `markBoots`. The footwear library's toe cap is allowed on a bare foot.
GAUNTLETS: the hand and its digits are plating segments (a layout panel's `seg: 'fingers'` lays it on the four), and a
suit names its `hands` (a handwear card: the glove the hand's plates are laid on, in the suit's group). Layouts
`vambrace` (the forearm by design: a top plate over the extensors with a vent, a trim strip down the radius, a flexor
plate, an ulnar plate across the back line, a cuff proud over the wrist), `gauntlet` (an underplate, a stepped back
plate, a blade down the little finger's edge, a domed knuckle cap, a repulsor in the palm, a lame a phalanx on each
finger and the thumb, low), `gauntletHeavy` (a studded knuckle bar, a thumb guard), `gauntletSleek` (one plate with a
light line), `vambraceHeavy` (a ridge, a flared cuff). A shell may be laid on some of its segments (`{ layout, on }`).
Suits `markGauntlets`, `heavyGauntlets`, `sleekGauntlets`, `bracers`; `markSuit` wears the vambraces and the gauntlets.
A plate takes the weights of its surface's nearest point or, where the surface blends by ring (a digit's), its ring's,
so a finger's lames curl with it.
THE PARADIGM CLOSED OUT: a layout is data a card can carry. A shell entry is a layout's name or `{ layout | panels,
drop?, plus?, name?, on?, bulk? }` (a layout of its own, named; or a named one with panels dropped by id and others
added), a variety adds shells to its kin's (`shellsPlus`), and every panel is checked by name (`validatePanel`) before
it is cut. The laws carry it (a layout is data; the extremities are their own libraries' cards), and docs/plating.md
sets out the card, the passes, the laws and the adapter the three wearable libraries share.

### The hero's skin: a part of the character, shown where it shows

- `skin` on the hero door (`form: 'realistic'`): the dermis's dials (dermal-map.js DERMIS_DIALS but `sex`, the cast's:
  tone as an MST swatch or a hex, undertone, age, flush, freckles, oil, lines, dirt, war paint, hair colour …),
  refused by name. `palette.Skin` is its tone when `skin` names none (both, differing: refused). The recipe carries the
  resolved dermis (`recipe.dermis`), which the export paints, and the palette's Skin becomes its base colour
  (dermal-map.js `skinBase`), so the page, a face no texture covers and the texture agree.
- An OUTFIT takes the realistic body's suit off: the trunk and the limbs (painted Top and Bottom) are Skin under a
  garment, so what it leaves bare is skin; the feet keep their shoes. Undressed, the suit as before.
- COVERED skin off the atlas (epidermis/dermal-hero.js `coveredSkin`): a body skin point under a garment or an armour
  (a ray out along its normal meets one carried by its bone or one within two joints, so a hand at the thigh is not
  covered by the trousers). The body's islands (dermal-body.js `bodyChart` `shown`) are each part's runs of rings that
  show (a sixteenth of a ring at least, a ring either side), each ring addressed on its whole part; a face off them,
  and a part painted another group (the suit, the shoes), takes the base colour, no texel. Dressed in the fitted shirt
  and the trousers the atlas went from 2048 × 3072 to 2048 × 2048 and the lit export from 33 s to 17 s.
- The skin in the UNLIT export too (an export asks; the World page does not): its texel times the corner's baked light.
- The BAKE (surface-bake.js, opt-in `bake`) on the realistic hero: its head's layers let down under one another and its
  eyes' globes cast no occlusion (dermal-hero.js `heroHidden`; `bakeChannels` `hidden`), its surface's normals the
  field's (`normals`), so a seam between two parts of one skin reads as none; the globes wear a new `eye` finish (a
  wet, lit globe: the socket's shadow falls above the eye, on the lids, not in it) unless the bake names them. Every
  other figure's bake as before.
- The realistic hero's unlit GLB welded as its lit one is (the figure's `weld`): 17.4 MB → 4.0 MB, drawn the same.

### The realistic hero at the door

- `form: 'realistic'` on the hero door (`create_character`, `mint_solid` via 'hero'): the hero's body re-sampled onto
  the form field (body-relational.js `formSlice`) once its plan is a recipe, the build by the cast's pole (male: norrin,
  female: shalla), with a `physique` (a word, `athletic | skinny | heavyset | jacked`, or `{ from?, bulk, tone, weight,
  height }`), stored with the slice's laws. Absent `form`, every hero as it was.
- The plan is laid out with the hero's tune times the build's (the build's shoulders, the physique's stature and
  shoulders), so the door's athletic Norrin is the body study's slice byte for byte. A slice takes 6 s (male) to 10 s
  (female, jacked) on the first expansion; slices are kept by their inputs (the expanded recipe and the build), so the
  same body again (a world's inline hero each render, an edit that leaves the body) is a tenth of a second.
- What the realistic body does not wear yet refuses by name: `outfit`, `adorn`, `paint`, `detail`, `statue`, `stylism`
  (fitted to the authored body's rings, which the slice re-samples), `body` and `girth` (the physique dials those), a
  cast other than 'male' / 'female', a head other than landmark or none, the streamlined core. The words agents guess
  (`bulk`, `muscle`, `tone`, `weight`, `fat`) point to `physique`; the layered card teaches it.
- The form field split by job, the slice byte for byte: `body-relational-builds.js` (the builds, the physique),
  `-field.js` (the distances, the fields, the crossing and the projection), `-resample.js` (a part re-sampled),
  `-correctives.js` (`correctiveRest`, the shoulder's blend), `-vec.js`; `body-relational.js` keeps `formSlice` and
  re-exports the rest. The sliced recipe's contract (its parts, station ids, slots, rig additions and correctives) is
  `docs/realistic-body.md`, held by hero-realistic.test.js.
- Dress on the realistic body (in progress): the bare body is sliced (kept by what the slice reads, so a dress edit never
  re-slices), the plan expanded again on it (`expandPlan`'s `body`), the outfit, the kits, the armour and the paint made
  on its ENVELOPE (body-relational-envelope.js: each ring over its convex hull, the hollows along the part filled, at
  most 15 mm off the skin) and the skin put back under them, a pinned piece's offsets carried into the skin's frame; a
  garment's points take the body's correctives. The sliced parts keep a `slotT` in the authored part's terms and their
  band paint by position. `detail`, `statue` and `stylism` still refuse. Open: on a physique the pelvis's rings hidden
  under the crotch's level are drawn in to a cone, and a trouser seat fitted on them folds (the male skinny and heavyset,
  the female heavyset); body-study `--hero` renders the door's own hero.
- The female's WAIST drawn in against her hips (body-relational-field.js `waist`, the build's `{ t, w, pinch }`: the
  trunk's field read narrower across about a height on the torso bone, eased out either side, its depth as built). On
  the hero's masses her waist measured 0.67 of her hips' width from the front and his 0.72, so the two read alike; with
  a tenth's pinch hers is 0.61 (21.8 cm against 23.8). His, and every build without `waist`, byte for byte.
- The realistic hero's head is the RELATIONAL head by default (`head` absent on `form: 'realistic'`; `'landmark'` and
  `'none'` still name theirs; a record stores its head, so a hero minted before keeps its own). The hero routing card
  names the realistic form (`form: 'realistic'`, `physique`, the fitted outfit words) and a phrasing that reaches it;
  the layered vocab card's paragraph says what the realistic body now wears.
- The whole loop under test (export-model.realistic.test.js, the E2E tier): a realistic hero minted by the character
  door with the fitted shirt and the trousers, exported as the lit skinned GLB, read back by glTF-Transform: one skinned
  mesh on the rig's joints, the idle, walk and wave clips, the correctives as morph targets by name, the normals, the
  weights summing to one, and the skin: a texture coordinate on every corner and the dermis's atlas as the base colour,
  the head's page in it.
- Fixed: a DRESSED realistic hero lost its face. The plan's body hook (station-loft-plan.js) took in only the parts the
  plan had a name for, so the relational head's visage and nose (the face's own parts) were dropped and the cranium,
  let down under them, showed as a smoothed mask. The hook now takes every part the body brings. An undressed hero is
  byte for byte as it was.
- The realistic hero's GLB WELDED: its pack writes a corner a triangle, so a grid point went out once per face round
  it; corners alike in every attribute and every target's row are now one vertex (scene-gltf.js `weldCorners`, under the
  lit export of a pack carrying its normals), a UV seam's or a crease's two sides apart. The dressed female's lit GLB
  went from 304k vertices and 23.7 MB to 51k and 5.2 MB (16-bit indices), drawn the same. Every other figure's export
  byte for byte.
- The realistic FEET lighter: the foot 36 rings × 48 round (was 45 × 72), the toes 21 × 48 (was 31 × 64), about 5.3k
  triangles a side for 10.4k; the toes, the heel and the ankle read as before (the operator's eyes), the sole's flat
  cut a little coarser.
- The relational head's FIT on the recipe (`recipe.headFit`: `{ sex, k, ty, men }`, the scale and the offsets that seat
  the head on the neck), so an export can read the hero's head back into the head's own frame and chart it.

### Realistic body: correctives posed and exported

In progress. The realistic body's correctives (`recipe.correctives`, docs/realistic-body.md) outside the body study:
- Posed: `poseLayered` (hero-gesture.js) skins the rest with the correctives the pose drives (`correctiveRest`), so a
  standing hero's solid and the door's gesture gates carry them. A recipe without correctives poses byte for byte.
- Packed: `packLayeredRig({ correctives })` (station-loft-rig.js) carries each corner's rows as the face's are
  (`corrective` on a part), the pack's `correctives` (each target's id, driver and weight at rest; each driver joint as
  the bone carrying it and its offset from that bone's head) and every clip's `cw` (each key's weights, by
  `correctiveWeight`, correctiveRest's formula). The layered world resolve asks for them only when the export asks for
  blend shapes (`ctx.face`: the skinned GLB, the Godot pack's figure); the World page's payload is as before.
- Exported: the skinned GLB writes one sparse POSITION target per corrective after the face's, named by its id, its rest
  weight in `mesh.weights`, `mesh.extras.correctives` the drivers and joints for an engine that drives them, and every
  clip a LINEAR weights channel with the weights its poses drive (merged with the face's STEP track, each drawing held
  to a millisecond before the next), so Godot, Blender and Unity play them with the clips. The T-pose (engine skeleton)
  export leaves them out. Without correctives every byte is as before.
- Lit: under the lit GLB (`lit: true`) the realistic body's pack carries the studio weld's normals per corner and no
  baked shade (`packLayeredRig({ engineLit })`), and the skinned writer writes those normals, so the engine shades one
  smooth skin, once (it had the facets' normals and the bake's shade under its own). Every other figure as before.

### Realistic body: the feet on the form field

- The realistic body's feet (`footR/L`, `toesR/L`) re-sampled onto the form field: the foot and the toes are limbs of
  the builds (body-relational-builds.js `foot`, `toes`: the heel, the arch's two columns, the midfoot and the instep,
  the ankle's two bones, the ball; the big toe and the four), on one field with the shank's own skin, so the ankle
  flows out of the shank's last skin with no step. New module `body-relational-feet.js`.
- The sole is flat on the ground the authored shoe stood on (the masses set so their lowest sinks past the rim's
  rounding, then cut), so the gaits plant it where they did; the medial arch stands off it.
- The foot is re-sampled as a SOCK: level rings round the ankle turning down the instep to stand square to the foot,
  the heel the bend's outside; the toes in planes along the toe line, the big toe's tip on the field. The shank's skin
  shows over a level `0.25 W` over the ankle's joint, the foot's under it, crossing there as the knee's chain does.
- The bind: the foot's points near the shank's skin, or over the level, carry the shank's own shares at their height,
  so the two skins move as one through a gait; the toe base is a hinge band (the foot's bone and the toes').
- The physique reaches the feet barely: bulk and weight grow the foot's soft masses by a twenty-fifth at the dials'
  ends; height scales them with the rest.
- Every other part of the slice is byte for byte as before (norrin and shalla, athletic and jacked); the dials gain the
  feet's new station ids. A slice costs about 2 s more.

### Realistic body: the relational head

- `head: 'relational'` on the realistic hero (`form: 'realistic'` only): the relational head (head-relational.js) worn
  as recipe content, fitted to the landmark head it replaces (vertex to menton, the ear canal at its depth), sampled by
  rays from one centre into two parts that share the mouth's ring (`jaw` and `cranium`, their caps the mouth), sealed
  to the neck: the neck ends on a ring wholly under the head and the jaw part starts on that ring. The lower face is
  bound to the rig's jaw bone, its hinge moved to the head's condyles, so the mouth opens. Bald.
- The face sampled from its own direction: rays from one centre grazed the nose, the lips and the lids, and the face
  read stair-stepped. The cranium and the jaw are now sampled on the head's BARE field (head-relational.js `bare`: the
  skin wave without the nose, the lips, the eyes or the ears), let down under the face. The face is parts cast along
  its own look onto the whole field (the dermis study's graft read through the same grid): the `visage`, rings about
  the mouth (the lips run along them); the `nose` and the eyes (`eyeR/L`), rings following the nose's outline and each
  eye's opening, so the wings' creases and the lids' margins run along the rings, not across them; each sunk under the
  next where they hand over (the body's handover), the eyes painted. The ears are their own parts, a tube up each ear
  on the ear's field (`earFields`). About 19k vertices for the head; the swap takes about 50 s once (then kept).
- The head shades by its FIELD, not its facets: each part's stations carry `normals` (every point's unit gradient of the
  field it was sampled from), and the shading takes a part's authored normals where it has them, carried onto a posed
  face by that face's own rotation (station-loft-shade.js `authoredNormals`; the world, the lit export and the lit
  pieces all read `layeredShadingNormals`). Where the parts hand over, each let down under the other by a slope, they
  shade as one skin (the lines round the nose and under the eyes read as wrinkles at full-figure scale); the lids' and
  the nose's wings' blends, finer than the rings, read smooth. A part without `normals` shades as before, every byte.

### Realistic body: the dermal skin on the body

The lit GLB of a realistic hero (`export_model`, `format: 'glb'`, `lit: true`) carries its albedo as the base colour;
the other maps (roughness, translucency, hair) stay on the dev path.
The dermal texturizer's maps on the realistic body (`form: 'realistic'`, docs/realistic-body.md), so its head and its body
wear one skin. `epidermis/dermal-body.js`:

- The body's UVs from its own grids: each skin part (the re-sampled torso, neck, pelvis and limbs; the authored hands,
  fingers, feet and toes) unrolled from its stations × slots into an island at its true size, one texel density over the
  body, v down the rings' centroids (the caps' poles past the ends), u the arc round each ring from its SEAM, where an
  artist cuts: the trunk, the neck and the pelvis down the back, the arms and the legs down the inside, the hands and
  the feet along the inner edge. Each grid point's address is its slot's turn (`front` anterior, the left limb the
  right's mirror, slot for slot) and its station's run; packed by the head's packer (`packRects`, shared out of
  `layoutDermis`).
- The maps painted by the head's painter (`paintIsland`, shared out of `paintDermis`, the head's maps byte for byte):
  albedo, roughness, translucency, hair density and flow, fuzz, the relief tiles' index and the occlusion each part's
  own folds cast (broad, gentle and eased over each point's neighbours, the cage being coarse), written by
  `dermalPngs`. The inner arm's pale skin turns from anteromedial to the forearm's flexor side across the elbow, so the
  two parts meet in one colour. The palms and soles glabrous; the body's terminal hair sparse by default (the
  male's at half the preset's), its tracts the pole's (the forearms, the shins, the chest, the axillae); the neck's
  beard, the chest's patch and the belly's trail fade in with their regions instead of starting at a line, and a body's terminal tract blends across its edge.
- The neck meets the head: its top eased over its upper third toward the tone of the relational head's lowest skin
  (`neckTone`).
- The body-part map (body-relational-map.js) read in: each point of the chart carries its `bodyPart`
  (`bodyDermis`'s `partMap`), and the limbs' seams run through its `hidden` patches (the skin inside the trunk's), so
  the cut is where nothing shows; the study draws the parts on the skin.
- For the export: `bodyDermis(mesh, recipe, { dermis, sex, page, neck, partMap })` → `{ chart, layout, uv: { faceUV, corners,
  vertex }, maps, dermis }`, and `unweldSeams(faces, corners)` to split the seams into one UV a vertex.
- In the export (`epidermis/dermal-hero.js`): `heroDermis(mesh, recipe)` charts the hero's whole skin, the body's
  page and the head's, the minted head read back by `recipe.headFit` and charted on its sphere with its marks
  (`dermal-head.js` `headChartOf`, whose `shownAt` keeps the layers let down under the face from casting occlusion);
  `heroSkinPaint` composes the two albedos on one atlas, the body's over the head's, and hands the figure's pack the
  paint skin-paint.js hands it (each skin face's corners on the atlas, every other face on a white texel, its colour as
  before). The world kind wears it on the realistic hero's lit pack. A garment, an eye's globe and the mouth keep their
  colours.
- The eyes lane: `/dermis-study --body [male] [female] [--physique <word|json>] [--body-page N]`: the realistic body
  textured and lit with the relational head grafted on it (its own atlas and hair), its map's kinds, its channels on the
  shape, the neck close, and the body's atlas pages.

### Dermal texturizer: skin and hair laid out on the realistic register's body

In progress (a dev path: no minted hero changes, no tool surface). The epidermis cube carried from the head to the
body: the skin's layout and the hair it grows, read from an ADDRESS so the shape stays separate. `epidermis/dermal-chart.js`
is the shape's contract (a canonical part, `along`, `around` anatomical, the tangents), with the hero's cage and any
ring-stack body as adapters; `dermal-map.js` lays regions, the painter's colour zones, roughness, translucency, Langer's
lines and hair tracts by a few dials over the egocube's tones; `dermal-texture.js` bakes them to a per-part atlas (seams
on the hidden side, the face weighted up, the scalp paint and the stubble's follicles) with tileable relief tiles;
`dermal-hair.js` grows body hair lying on the skin and scalp locks as clumps on the elastica's guides (curl types
straight to coily, the coil's shrinkage, frizz, ragged tips, flyaways, cards). The realistic head is its shape:
`dermal-head.js` charts the relational head (its field surface-netted and welded, the globes off the skin) and hands
its relations to the map as marks, so the hairline, the nose, the lids, the cheeks, the lips and the beard's line are
laid from the trichion, the nasion and pronasale, the canthi, the cheek points, the stomion and the porion. The ear is its own feature: no beard or hair
grows on it. The scalp is COMBED: one smooth comb over the head (never across the part, which runs over the top only),
guides walked along it lifted off the skull for volume and hung by the elastica where the head turns away, waved in
phase along the flow so a type's crests run across neighbouring locks as bands, and every strand interpolated from its
nearest guides on its own side of the part, so strands run parallel. The CUT is the stylist's: a perimeter line (a
level the head's relations name, the jaw, the shoulder, the collarbone, cut blunt, a-line, stacked, v or u) where each
lock is combed down, cut where it crosses, regrown at that length and cut again so its end lands on the line; a clipper's
taper by the root's rise over the hairline; a shelf (an undercut); layers (no lock longer than this from its root);
point cutting off the line. The library's cuts: buzz, crop, short (tapered), undercut, bob, angled, shoulder, long,
layers. EDITS BY CLUMP NAME: the anime figure's clumps (fringe-1…7, the temples, back-1…11, the crown) as addresses on
the scalp, each edit (`length`, `sweep`, `lift`, `over`, `stand`) reaching the guides about its seat with a soft falloff
so the comb stays one field; the anime traits ported as MOVES over a groom (sleek, voluminous, messy, heavy-, short- and
swept-bangs with the fringe's own cut line, peekaboo, side-parted, flipped, ahoge, chunky). CREATOR LOOKS (`dermal-looks.js`): the realistic head stylized as
a game's character creator draws one, as data over the existing readers: `GAME_FACE` relations (a firmer skin wave, a
heavier brow, cheekbones forward, a squarer jaw, deeper-set eyes) and archetype presets (warrior, shieldmaiden, scholar,
rogue, elder). The dermis takes the creator's sliders: `lines` (the forehead's, the frown, crow's feet, the nasolabial
fold, under the eyes), `dirt` (grime in the cavities and in blotches) and `paint` (war paint: eyes, stripes, band, chin,
mask, in woad, soot, ochre, chalk or blood), painted per texel from the face's landmarks. The atlas bakes OCCLUSION read
from the mesh (`meshOcclusion`, any shape) into the skin's colour. The relational head's chart is spherical about a
centre at the ear's height (`headSphere`), so its undersides keep texels of their own, and what the head closes over (the
teeth, a nostril's inside) is marked `enclosed`: no hair, no bake. PEOPLE OF THE EGOCUBE'S ANCESTRIES
(`readAncestry`): rolled inside each ancestry's own ranges (tone, undertone, hair colour, texture), the texture worn as
the scalp's type in a style that suits it, the eye note through the ancestry's own derive (`sculpt.lidCover +`: the
lid's cover, rolled among `EYE_SHAPES`: an in-fold crease tapering into the inner corner, a monolid, a parallel crease, a
hooded lid; never a slant), the face's structure the
individual's. AFROS: a `stand` dial (the root leaves the scalp toward its normal) with coily hair's spring and shrinkage,
an `envelope` cut rounding it to an ellipsoid, a nape taper; `twa` close to the head; `curls` hanging in ringlets. The hair
shader's highlight scatters with a coil's roughness and its mass shadows itself (a coil's interior dark); the skin
reflects 4 % at every tone, so a deep skin's sheen carries its form. TIES: a tie anchored on a clump's seat (or an azimuth
and a rise) gathers every root, the top section or those within a radius of it; each gathered lock is combed taut over
the head to the tie and arrives at its own slot round the band (the side it came from), so nothing crosses; one bundle
hangs from the tie (the elastica's lock, flaring then tapering, its ends ragged), a bun coils it about the tie, a braid
plaits it in three (each bundle a figure of eight across the braid a third of a turn apart, bound, a brush past the
band). Styles: ponytail, high-ponytail, bun, braid, half-up; the move `temple-braids` (the Nordic braids). The relational eye rig takes
the eye's cover as channels: `creaseHeight`, `creaseShape` (parallel … tapered into the inner corner), `epicanthus` (the
upper lid's skin laid over the inner corner) and `fullness`; each at rest leaves the eye as it was. THE EYES' BASELINE re-measured against the adult norms
(Farkas; MRD1, MRD2): they sat close (the inner canthi 27 mm apart, the pupils 55) and stared (the upper lash line 7.9 mm
over the pupil, 2 mm of white above the iris, the lower lid over its foot). The rule of fifths now reads against the face's
width (`fifths` 0.215) with the inner canthi a little wider apart than an eye (`intercanthal` 1.12): en-en 33.0 / 32.3 mm,
ex-ex 92 / 90, the pupils 62.6 / 61.2, an eye 31 mm wide. The fissure is split at the pupil by a relation (`lidSplit`
0.32 of `fissure` 0.036 above it), so the upper lash line rests 4.4 to 5 mm over the pupil, over the iris's top, and the
lower 5.3 mm under it at its foot: a neutral eye. The relational head is a dev path (no minted row reads it); a lash whose
root cannot be laid within 2 mm of its lash line is dropped. The bands
are returned for drawing. Seen through `/dermis-study --look`, `--ancestry` and `--lineup`.

### Realistic register: a stronger body for the hero

The third point on the hero's style gradient (anime → cartoon → realistic), as western games draw a person: accurate
shape generated relationally (the relational head's method carried to the body), depicted through the hero's cage so
every reader of its stations, slots and body chart keeps working, with the relational head joined on at the neck.
Opt-in and versioned: a default hero keeps its bytes.

- **The stretch audit** (`hero-stretch.js`, `scripts/hero-stretch.mjs`). The hero's shell read ring by ring through
  the studied gaits (walk, jog and sprint over their cycles) and the stand's gestures, against its bind: each closed
  part's station is a ring of its slots, measured for its area and its narrowest slot (a joint's collapse), its twist
  away from its heaviest bone (the blend lagging the bone), and the BAND of skin from it to the next ring, slot by slot
  (a crease's compression, the far side's stretch, folds through itself). Each ring keeps its worst frame, and the knee,
  elbow, hip and shoulder are gathered as regions. The bands carry the read: the hero binds its knee and elbow rings
  rigidly to fold bones, so a ring keeps its area however far the joint bends, and the joint gives in the skin between
  rings. The baseline, male (female alike within a few hundredths), on the gaits as minted now (the swing foot
  following its leg, below): the hip's band stretches to 2.5× its rest length in the sprint and compresses to 0.67 in
  the walk, the knee's to 2.15× and 0.65, the elbow's to 1.6× and 0.75 in the guard; the shoulder's top ring loses a
  quarter of its area in the sprint and twists 9° off its bone in the relaxed stand; the foot's rings keep a third of
  their area and the ankle's ring twists 21° (male) to 39° (female) off the shank at the sprint's curled foot. The SEAMS, where one part's tube is tucked into the
  next (the groin, the armpit, the elbow, the knee, the neck), read whether the child's end ring stays inside its
  parent: the groin and the armpit hold through every frame (the hip's and the shoulder's give is all in their bands),
  while the elbow's and the knee's open: at the hand-on-hip's bent elbow the forearm's tucked slots come 41 mm out of
  the upper arm, and at the sprint's knee, folded as far as the gait means it to (130°), the shank's top comes 41 mm
  out of the thigh.
- **The swing foot follows its leg.** In a hero's walk, jog and sprint the foot in its swing was held level with the
  floor (the toe placed, the ankle rebuilt at the standing heel), so as a run's recovery folded the knee the toes
  pointed forward, and as the knee drove through they were pulled up against the shin. With the hero dial `swingFoot`
  (stamped on every hero gait minted now, the walk's `HERO_WALK` and the run's new `HERO_RUN`; a hero stored before keeps
  its level foot, byte for byte) the swing foot rides its shank at the ankle's standing angle, square to it, eased in
  over the first 30% of the swing and handed back to the flat landing over the last quarter: the tucked foot points out
  behind, and comes round under the knee as it drives through. The rig takes a new channel, `toeTurnL` / `toeTurnR`
  (degrees the toes turn about the ball with a targeted foot; absent, level as a push-off needs), so the swing foot's
  toes turn with it, never hooked back level, cut short where their tip would dip under the floor. The recovery now
  folds as far as the gait means it to (the sprint's `swingTuck`: the level foot had held the knee shallower). Through
  the sprint and the jog the swing ankle stays within 3° of its standing angle; no toe goes through the floor, and each
  gait's speed is unchanged.
- **The shoulder line, hero laws 2.** The hero's shoulders read shrugged: its girdle already declines (8° male, 11°
  female, the casts' `shoulderDrop`), but the trapezius met the neck's side 8 cm over the shoulder joint and the neck rose
  out of it like a post, plainest from behind. Hero laws 2 (`HERO_LAWS_VERSION` 2, hero-form.js `SHOULDER_LINE`) lifts
  the torso's top ring, the neck's root, at its sides and back (its front stays at the sternal notch; the top cap's tip
  rises with it, the cage staying closed on every cast), so the trapezius
  climbs the neck in a concave curve and falls to the acromion at about 27° (male) and 34° (female) from the neck's side.
  Every hero on the structured core reads it, so every one minted now is stamped `laws: 2`; a row minted before (stamped
  laws 1, or unstamped, as a world's inline hero re-recorded on each render is) builds its plan and recipe byte for
  byte, pinned. Garments that reach the shoulders follow the new line on a hero minted now (the outfit laws' ring pins
  re-pinned as a body change; their expansions unchanged). The legacy vajra figure's girdle (figure-vajra.js `CLAVICLE_DECLINE`) and its body chart are left as
  they are: the hero reads neither. `body-study` takes `--laws` to render a hero as minted under an earlier version.
- **The leg set, hero laws 3.** In profile the hero's thighs stood forward of the trunk and its seat out behind: the hip's
  joint sat 2 cm under the groin's skin (the femur's head sits 5 to 6 cm deep, a little forward of the pelvis's middle).
  Hero laws 3 (`HERO_LAWS_VERSION` 3, hero-form.js `LEG_SET`) turns the leg back about the ankle: the hip's joint set back
  into the pelvis by 3.5 % of its height (3 cm on the male) and the knee by its share of that, so the knee keeps its bend
  off the line from the hip to the ankle. The bend stays because the motion reads it as the leg's slack: set straighter
  (the knee to the line's share of a plumb thigh), the leg came within 1 mm of its full reach and the feet's IK clamped,
  planted feet slid in the jumps and rolls, a stop overran, a cloak met an arm. Every hero on the structured core is now
  stamped `laws: 3`; a row stamped 2 or 1 builds byte for byte, pinned (the gesture, the shading and the anime pins each
  keep their laws-2 values beside the new ones); the outfit laws' rings and the statues re-pinned as a body change.
- **The leg length, hero laws 4.** Measured against the body's own ratios (ANSUR II), the hero's hip's joint stood at
  0.49 of its stature (the body's 0.52), the femur at 0.23 (0.245) and the trunk from the shoulder's joint to the hip's
  at 0.30 (0.28): short legs under a long lower trunk. Hero laws 4 (`HERO_LAWS_VERSION` 4, hero-form.js `LEG_LENGTH`)
  lengthens the leg by 5.5 % of the hip's height over the ankle (55 % of it in the femur, the rest in the shank) and
  shortens the lumbar by the same run, so the hip's joint comes up 4 to 5 cm while the navel joint, the shoulders, the
  neck, the head and the stature stay. On the hero proportions' adult casts only: a child's and the anime and herobot
  casts' proportions are their own. Every structured-core hero is now stamped `laws: 4`; a row stamped 3, 2 or 1 builds
  byte for byte.
- **The arm length, hero laws 5.** Read in Leonardo's figures (the body lane's `--vitruvian`), the hero reached 1.08 to
  1.09 of its stature fingertip to fingertip (Leonardo's 1, the body's about 1.03) and its fingertips passed his circle by
  7 to 10 cm. Not the trunk's breadth nor the thighs (the shoulder's joints 0.20 of the stature apart, the femur 0.245,
  as the body's): the humerus stood at 0.189 of the stature from the shoulder's joint to the elbow (the body's about
  0.165) and the forearm at 0.161 (0.146). Hero laws 5 (`HERO_LAWS_VERSION` 5, hero-form.js `ARM_LENGTH`) shortens the
  upper arm's dial by 0.88 and the forearm's by 0.91 on the casts the leg length takes: the span 1.01 and 0.99 of the
  stature on the realistic slice's builds, the middle fingertips on the circle with the arms raised to the head's top.
  A row stamped 4 or before builds byte for byte; the anime wave's raised elbow reads its drop as a share of the humerus.
- **The moves follow the body they were built on.** The leg set and the arm length moved joints the vaults and the guards
  were tuned on. A step vault's trailing foot, its leg set back by laws 3, dragged over the far edge (a male's clearance
  lift 0.091 m, the law 0.08); a guard's hilt, placed in fixed metres off the trunk, sat past the reach of an arm
  shortened by laws 5, the wrists bent past their ease. A hero stamped laws 3 or later vaults on the step vault's own
  `legSet` words (the trailing knee tucked 125° where it was 115°: lift 0.040 m), and one whose arm took laws 5 holds
  every guard drawn in toward the shoulders by its arm's shortening (hero-form.js `takesLegSet`, `takesArmLength`,
  `armReach`, which `heroPlan` itself reads). A hero minted before them, as everything 3.1.1 shipped was, gets
  neither: its clips as they were.
- **A boot under a skirt.** A garment piece is lifted over every garment already worn on its part, and a skirt (a hull
  round the hips and both legs) counts as worn on the shank: a boot's shaft worn after it was lifted round the skirt's
  whole hem, a ring 21 cm across round both legs (the operative's card read as a bell for it). A piece on a shank, a foot,
  a forearm or a hand now goes under a hull hung round several parts (body-garment.js); a piece on the trunk still
  clears it.
- **The body lane** (the `body-study` skill). The hero's body as an engine gets it, the skinned cage shaded smooth,
  from the front, the front ¾, the lateral, the back and below; rows posed at the bind, a gait at a phase, a stand
  gesture or a raw rig pose; crops at the torso, shoulder, hip, knee, hand, foot and the neck's seam, framed on the
  posed joints; and at the bind a sections panel (the trunk cut level at the neck, chest, waist and seat, the right
  limbs square to their bones) with each girth as a tape reads it, and a measures table (stature, heads tall, the
  shoulders' and hips' breadths, the girths). `--tint` colours each part its own (which shell shows where two hand
  over), `--parts` keeps only the parts a pattern names, and `--vitruvian` adds Leonardo's two figures, the front large
  in its square (the arms level: the span against the stature) and its circle as his note sets it on the figure's own
  joints (the legs opened to an equilateral triangle, the figure lowered his 1/14, the arms raised till the middle
  fingertips are level with the head's top; the circle on the navel, its radius the standing navel's height), with what
  each reads in the margin. The eyes gate beside the stretch audit's numbers: the sprint's knee crop
  shows the shank's top out of the thigh where the audit measures it. Baseline, male and female: stature 1753 and
  1664 mm, 7.15 and 6.79 heads tall; chest 107 and 88 cm, waist 84 and 64, seat 86 and 90.
- **The form field, a vertical slice** (`body-relational.js`; seen through `body-study --form`, not yet on the door).
  The body read the way the relational head is: bone where it shows (the ribcage's egg, the clavicles, the spine's
  column) and the muscle masses (trapezius, deltoid's three heads, pectoral, rectus abdominis in its segments, the
  obliques, serratus, latissimus, infraspinatus, erector spinae, sternocleidomastoid; biceps, brachialis, triceps,
  the forearm's flexors and extensors) placed from the hero's REST JOINTS in units of its half biacromial, so the field
  rides any cast and tune, summed into one skin (log-sum-exp: where two masses meet, a groove). The torso, the neck and
  the arms are re-sampled onto it, denser than authored (the torso 48 slots round, 37 rings), each slot on a ray through
  the authored cage's point, then relaxed onto the field (the neighbours' mean, projected back down its gradient) where
  a ray crossed a pocket; the bind follows the authored shares (per slot, and by zone on a hard limb), so the rig poses
  it unchanged, and the pectoral and bust parts give way to the field. The armpit is filled (the hanging arm covers it);
  the deltoid is shared by the torso and the arm and handed over along one cone above the armpit (the torso's skin the
  shoulder's cap, the arm's below it, set a few millimetres under the cap where it reaches in), so the arm grows out of
  the shoulder with no ledge; under the bust the rays come down from above to meet the fold. Two builds, a Silver Surfer-like body: `norrin` (male, lean and sculpted, the
  shoulders 10 % closer by the hero's own tune, the neck thin and flaring into the trapezius, the pectorals defined: the
  sternal head thickest at its lower border under its own tight blend, meeting its partner over the sternum) and `shalla`
  (female, the definition softer; the bust the hero's own breast field laid over the summed skin as a displacement, so
  its upper pole is the pectoral's slope, read as the Female Titan's in Attack on Titan: firm and high, set apart over
  the sternum, the apex rounded, the lower pole full over a clean fold; her torso on a finer cage, 64 by 49, for it). Every re-sampled part closes on both builds; deterministic. The lane wears
  the RELATIONAL head on it (head-relational.js, meshed and fitted vertex to menton, carried by the head bone), bald, in
  a matte silver-grey. The pelvis and the legs are on the field too: the SEAT, one mass round the pelvis (the operator's
  upside-down heart, seen from the front and from behind; a teardrop from the side): two lobes low on the hip's joints
  wrapping the hip from the front round to the glutes, the cleft and the crotch the dip between them, and a taper up
  the middle to the heart's point under the navel and on the sacrum, squashed front to back to the belly's depth, so
  the trunk is widest at the hip's joints and narrows steadily to the waist (a basin, a flank and separate glutes had
  made a shelf at the iliac crest); and the pubis. The SPINE'S CURVE (a build's `spine`): the back's surface carried
  forward at the lumbar curve and back at the thoracic, a warp of the field over the back half only, so in profile the
  lower back sinks in above the seat and the upper back rounds out (the trunk had stood as a straight column). The
  thigh (rectus femoris, vastus lateralis and the medialis's teardrop, the adductors, the hamstrings, the
  patella, and the SWEEP, the operator's: one mass spiralling round the femur from the hip's side under the glute, down
  behind the thigh and in to the knee's inside, the hamstrings and the adductor magnus as one form, so the thigh's back
  rises into the seat in profile and its inside reads full and tapering from the front; a limb's mass may be a `chain`
  of round cones bead to bead) and the shank (both heads of the gastrocnemius, the soleus, the tibialis anterior, the Achilles, the ankle).
  A limb's two segments share one field and hand over by the plane through the joint (each segment's own knee had met
  the other's in a step); the torso and the pelvis hand over by height. THE HIP'S JOIN: the pelvis ends at the crotch,
  and about one level a little over it the thigh samples the pelvis's own field (the body with the thighs' masses, cut
  at the midline), so the two skins meet on one surface; under the level the thighs take the seat's fold, the crotch
  and the groin, and the seat runs on round into the thigh (it had ended at the fold in a flat ring over the narrower
  thigh, and the seam had wandered in teeth across the thigh's front and hemmed the seat in a jagged line). Every
  handover is one crossing: each skin fades in from its line, a ring or so, with no gap between the two fades (a gap
  had left both on one skin, in a sawtooth at the waist, the elbow and the knee). The thigh is rounder and finer than
  the other limbs (32 round, 33 rings). THE LOWER TRUNK ON THE ANATOMY (a build's `lower` frame, bodyFrame): the
  rig's navel joint is a joint of the spine at the ribs' lower edge, and the slice had hung the belly from it, so the
  navel stood 7 to 9 cm high and the crotch hung 11 cm under the hip's joint: navel to crotch ran 0.225 of the stature,
  the body's own 0.125 (ANSUR II). Under the chest's middle every height is now laid by three knots, the navel 30 % of
  the way from the hip's joint to the shoulder's and the seat carried over the hip's joint, so the lower trunk rides
  the leg wherever it is; a mass's height stretches with the frame. The rectus abdominis re-laid for it, three
  segments down to the navel and one long sheet under it to the pubis. Navel to crotch is now 0.139 and 0.134 of the
  stature (norrin, shalla), the crotch 8 cm under the hip's joint. THE LIMBS' VOLUME (a build limb's `thick`): every
  girth had stood 10 to 28 % under ANSUR II's means (the calf and the upper arm most), the bellies ballooned off a slim
  bone; each limb is thickened across, not lengthened (the bone's cone and the bellies' round and out radii, the joints
  as they were, which thickened stood out as knobs), so the upper arm, forearm, thigh, knee and calf read 0.188, 0.167,
  0.335, 0.222 and 0.210 of the stature on norrin and 0.177, 0.147, 0.340, 0.216 and 0.207 on shalla. THE DELTOID RIDES
  THE ARM: the torso's cap over the deltoid had been bound to the trunk and the collarbone and the arm's top half to the
  collarbone, so a raised arm swung up out from under its own deltoid and left the cap hanging at the side like a pad.
  A point's share of the upper arm's bone is now how near it lies to the deltoid's heads, read the same by the cap and
  by the arm's top under it, so the two move as one; none under the armpit, whose folds follow the arm and whose flank
  does not. THE GIRDLE RIDES THE COLLARBONE: the rig lifts the collarbone with a raised arm (the shoulder's joint 5 cm up
  at the arm level, 6.4 overhead), but the torso had given it half a share or less in one band of rings, so the joint
  rose under a shoulder that stayed down. The skin over the girdle (the collarbone, the acromion, the trapezius's fall,
  the scapula's top) is now bound to it by its nearness to the bone, none inside the bone's sternal pivot (rising, it
  turns that side down, and the neck's root split): a raised arm levels the shoulder's top from the neck to the arm.
  The deltoid's share of the arm's bone runs by how far down the humerus a point lies too, none above the joint (the
  deltoid's origin on the acromion and the collarbone stays with the girdle): the whole cap on the arm's bone had swung
  its top in and down about the joint and its side up, a trough over the collarbone and a hump over the arm, against
  the level line of Leonardo's figure. THE ARM IN: the body's breadth is the build's own (`frame`), so the hero's
  `shoulders` tune brings the arm in over a body that stays, the masses it hangs from (the girdle, the collarbone, the
  trapezius's fall, the armpit, the pectoral's tendon: `joint`) drawn in with it. Norrin's arms 20 % in over a body 10 %
  narrower than the hero's, shalla's 8 % over her own: the shoulder's joints 0.205 and 0.194 of the stature apart
  (0.231 and 0.211 before; the body's about 0.20), the deltoids 0.283 and 0.269 across, the pectoral running into the
  shoulder with no ledge between. THE GROIN STRETCHES: a point's share of the thigh's bone by how far down the femur
  it lies (none at the hip's joint, the groin, the crotch and the seat's fold; through the rig's hip fold bone, which
  turns half the leg's swing; wholly a hand's breadth down), read the same by the pelvis and the thigh's top, so an
  opened leg stretches one skin (the thigh's top had been its bone's from the first rings: opened, its root swung away
  from the pelvis in a notch at the crotch, the seat's edge left a shelf); and the adductors' origin, a mass high on
  the thigh's inside, gives the stretch its stuff (the inner thigh's top had pulled across the crotch in a thin web).
  THE KNEE AND THE ELBOW BEND AS ONE SKIN: across a band either side of the joint, the upper segment's and the lower's
  points alike take the upper bone, the rig's fold (turned half the bend) and the lower bone by where they lie, so the
  two shells handed over at the joint's plane move together (the sprint's deep knee had swung the thigh's end out from
  under the shank behind the knee, a lobe with an edge); the shoulder's share of the arm's bone eases over a wider
  band (one narrower folded a ring at the joint's height in the arm's fore-and-aft swing) and the collarbone's fades in
  further off the neck (a swinging arm opened a notch at the neck's root). Read by the stretch audit (hero-stretch.mjs
  `--form`) against the authored hero over the stand, the gaits and the gestures: the elbow's seam opens 11 to 15 mm at
  worst (the authored 20 to 41), the groin's not at all; the knee's back pinches to 0.6 of its ring in the sprint, where
  the authored hero's seam opened 36 mm. THE DEEP HINGE'S CORRECTIVE: beside each knee's and elbow's fold, which pushes
  its head to the bend's outside to keep the kneecap's and the elbow's point, a crease bone turned the same half the
  bend and pushed not at all takes the bend's inside (a point's middle share split between the two by its side of the
  limb, eased round it), where the fold's push had drawn the skin in toward the bone: the sprint's knee pinches to 0.82
  of its ring at worst, and the bent elbow's inside stays full. The rig carries the two helpers (`kneeCrease<S>`,
  `elbowCrease<S>`) as bones an engine skins with. THE NECK STANDS ON THE SHOULDERS, not on a pyramid: the core's
  column and the ribcage's dome had reached 6 cm up inside the neck, and the base's wide blend filled from them to the
  neck in a tent, the neck's silhouette widening from under the jaw straight down to the shoulder at 40 degrees; the
  column now ends at the thoracic inlet and the dome under it, and the upper trapezius leaves the neck's side lower
  (it had begun at the jaw's height), so the neck is a column to its root and the trapezius falls from it at about 30
  degrees to a shoulder that stands where it stood (the collarbone was already nearly level: the slope was the fill).
  THE RAISED ARM LEAVES THE SHOULDER ROUND: a fold at the shoulder (the rig's helper turned half the arm's swing, as the
  hip's, `shoulderFold<S>`) carries the arm's own top from the collarbone to the arm's bone, where it had gone straight
  from one to the other and a raised arm's root pinched to a point at the armpit (its ring 0.55 of its rest, now 0.84;
  its band 0.09, now 0.53; its folds gone); and a skin share that would make a fifth bone on a vertex now drops the
  weakest instead of the share, which had vanished for one ring of the torso under the arm and come back on the next,
  a step where the deltoid's ramp was meant. Hands behind the head is hittable: the forearms reach behind the skull
  on the shoulder's roll (the elbow's hinge alone folds them forward, across the face). The stretch audit takes
  `--poses` (rig poses, `--only` for those alone). THE ELBOW NEVER TWISTS: the forearm is framed from the upper arm's
  frame by the elbow's bend alone (a rig bone's `parent`: its frame the parent's, then the shortest turn from its rest
  line carried there to its posed line), where each had taken the shortest turn to its own line and the two disagreed
  about their roll by as much as the arm had swung: forearms behind the head wrung the elbow 47 degrees (now 14) and
  pinched its ring to 0.51 (now 0.59, the deep bend's own), the arm's creased edges in that pose 306, now 162. Framing
  the arm by the shoulder's roll instead was tried and left: blended skin could only lose a roll of up to 110 degrees
  in a candy wrapper at the shoulder or a spiral down the humerus. THE SHOULDER ROUNDS INTO A RAISED ARM: the torso's
  cap over the deltoid follows the arm's own top (from the collarbone through the shoulder's fold to the arm, by how far
  down the humerus it lies), where it had gone to the arm's bone outright and a raised arm folded it up beside the arm's
  root in a horn, the shoulders square with both arms overhead. THE BICEPS AND THE TRICEPS LINK INTO THE SHOULDER AND
  THE ELBOW: each a chain where each had been an egg at mid-arm, the biceps from the socket's front under the deltoid to
  its peak low on the arm and its tendon into the elbow's crease, the triceps' long head from the shoulder blade behind
  the joint, fullest high on the arm's back, to its tendon at the elbow's point (the arm's front had dipped under the
  deltoid and the back fallen away from mid-arm; the girth now 31.8 cm a tenth down the arm, 29.4 before, the most 33.7).
  THE SHOULDER GIRDLE IS A MECHANISM: a scapula (the acromion and the blade's two angles, `scapula<S>`) the vajra turns
  upward by the scapulohumeral rhythm (past the first 30 degrees of raise one degree to the humerus's two and a half, at
  most 60, about the blade's own normal through the middle of its spine; `SCAPULA_POINTS`), the glenoid riding it, so the
  shoulder rises because the blade turns and the collarbone's lift follows; a rig without a blade lifts the shoulder by
  the collarbone alone, as before, to the byte. At 170 degrees of raise the humerus stands 115 in its socket (the body's
  most is about 120), where it had stood the whole 170 in a socket that never turned. The arm's root and the shoulder's
  fold turn from the blade, over a band 8 cm down the humerus (16 before): raised overhead, the arm's upper third had
  sagged off its bone by up to 4.5 cm, now 1.0; the arm's root ring 0.84 of its rest, now 0.93. body-study `--bones` draws
  the spine, the collarbones, the blades, the humeri and the forearms over the shell. THE PAULDRON: what a raised arm
  bunches over the shoulder, masses of the form field like the rest (the build's `pauldron`, in stages: a water bag
  over the blade, narrow at its top and full at its foot, so it hangs as the trunk stands; the trapezius's cap over the
  shoulder's top, a plate a third as deep as it is wide, so the front and the back see it and the profile hardly does;
  the deltoid's top bunched over the joint, late in the raise, sampled into the arm's top too, the corner a raised arm
  leaves by the head), never in the bind: the torso (and the arm) sampled again with each, the same rings and slots, the
  difference a corrective per side (`recipe.correctives`, an offset per point at full weight, the weight by the arm's
  raise between the stage's own degrees) that `correctiveRest` adds to the rest
  before the skin poses it, an engine's morph target (its export to come); the body study and the stretch audit pose
  through it. The skin over the shoulder's point and over the blade rides the blade, the collarbone its own inner run
  in front: all of it on the collarbone, a raised arm's shoulder top had floated over the acromion under it. Shalla
  wears the hero's pauldron, its masses 0.85 of his; her bust's fold is filleted in the field (`fold`, bust radii: the
  height eases in from flat, the apex kept at its projection), the fold's wall a corner the rings crossed on the slant
  in stair-steps. Only the feet are still the authored cage. THE PHYSIQUE: four dials over a build, each −1 to 1, 0 the
  build as authored (the athletic base, the build itself to the byte): `bulk` the muscles across and how proud they
  stand (the bones and the joints as they are; on the plus side the arms set out with the shoulders' muscle, the
  pauldron grown faster, the calf fuller, longer and higher over a soleus hardly grown (a high diamond over a long taper to a slim ankle), the thigh eased off toward the knee and its front and outer heads set higher (widest up top, not a barrel over the knee), the forearm full down to a wrist the size of hands a tenth bigger),
  `tone` the blends tighter or looser and the abdomen's and the serratus's relief, `weight` a layer of fat over the
  whole skin (thinning down the limbs to none at the wrist, the ankle and the head's base, and eased out between the
  legs, where it fused the thighs), the belly forward, the flanks, the seat behind, the neck; `height` the stature a
  tenth either way, by the hero's own tune. Words for points in it (`PHYSIQUES`): athletic, skinny, heavyset, jacked;
  `physique(build, word | dials)`, body-study `--physique`. Under a physique the crotch is sought no lower than 0.6 W
  under the hip's joint and the pelvis's rings hidden inside the thighs drawn in to a cone round it (thighs that nearly
  meet had folded them in a zigzag). Shalla's calf bellies run a third longer, one form from behind where they had stood
  as two beads. THE SHOULDER BLENDED OVERHEAD, with the pauldron: a raised arm had crumpled the torso's skin round its
  root into folds, and the torso's cap, a few millimetres over the arm's top at rest, stood through the arm's skin in a
  sawtooth of spikes. The slice is posed in two stages, the arms level and the arms overhead, each over the one before:
  there the torso's skin round the shoulder (by its share of the arm's and the girdle's bones, or its nearness to the
  arm) is smoothed over its grid (Taubin's two steps, no shrinking), a point on or through the arm's skin sunk under it,
  and the change carried back to the rest through each point's own skinning map (linear blend skinning is linear in the
  rest point), a corrective per side and stage (`shoulderLevel`, `shoulderOverhead`) over the raise. The shares round
  the arm's root are eased over the grid as well. The edge where the arm leaves the torso is one curve now; a few slivers
  stay deep in the overhead armpit, and the level arm's own root still pinches to a point under it. THE SLICE FASTER, to
  the byte: an athletic slice took 54 s (Norrin) and 94 s (Shalla), now 9.4 s and 12 s, the recipe the same byte for
  byte. The field's masses read without arrays (the same arithmetic in the same order; the allocations were most of the
  cost); the march reads a sample only where the field has not settled it (a sample `f` leaves the skin at least
  |f| / 8 away, so the nearer samples' signs are known: the same samples decide); the crossing within the step found
  by false position (Illinois), a handful of reads where halving took thirty; and a pauldron's stage casts again only
  the rays its mass reaches, the relaxing run over them and a margin round them (`resamplePart` `reuse`); the shoulder's
  blend finds the arm's nearest vertex from a grid, not every vertex; the field's sums read into kept buffers. Then
  faster again, a few points moving: 5 s (Norrin) and 7.7 s (Shalla). The relaxing's projections read the field's
  gradient forward from the value, three reads where centred took six (centred still for a ray's fallback and the
  pelvis, where at the crotch's level the skin's two walls stand close and the cheaper read settled rings on the other
  wall); the march's slope bound 4 (at 2 the shank's masses broke it); a pauldron's stage relaxes a band narrower each
  iteration; the shoulder's blend compiles the torso and the upper arms alone. Of Norrin's 9,428 points 4 moved over
  0.1 mm (0.11 the most); of Shalla's 11,316, 22, and 2 over a millimetre, in the fold under the bust, where a point
  settles a few millimetres along the crease either way (the fold reads the same).

### Science worlds: a demo composed from laws, not authored per experiment

- `create_view` gains three kinds that compose a demo from a closed table of laws instead of
  one hand-authored experiment per kind: `classical` (Newtonian laws, body scale to orbits), `microscopic` (cells
  down to molecules; DNA is the floor) and `quantum` (states in concept space, faithful to the model and claiming
  nothing about reality; it supersedes `atom` for new asks). Chemistry goes to the scale its explanation needs.
  A recipe has two halves: a `model` that is dimension-checked, machine-gated and measurable through
  `measure_view`, and a `dress` that only sells the picture, light and explorable on the interactive page,
  choreographed with timed callouts on film. Every exaggeration is a declared liberty the page shows. A law the
  table lacks is named as a gap, never approximated silently.
- **The classical solver** (`lib/graph/science-worlds/`). A table of
  laws (uniform and universal gravity, springs, rods and ropes, linear and quadratic drag, buoyancy, Coulomb, the
  Lorentz force, planes with restitution and friction, sphere collisions) composes a model; the solver picks velocity
  Verlet or RK4 and a step from the fastest motion, runs it, and checks it: energy conserved (or never gained when
  something loses it), momentum and angular momentum where nothing outside acts, rods held, no tunnelling, and the
  textbook answer wherever one exists (a projectile's apex and range, a spring's and a pendulum's period at any
  amplitude, a Kepler orbit, a cyclotron turn, terminal speed, a slide down a ramp, a head-on collision). Two regime
  checks say when a model has left Newton's ground: near light speed, or a wavelength as large as the path. Units are
  read with their dimension, so a mass in m/s is an error. `machina/quantities` gains charge, temperature and amount,
  and the units the sciences use.
- **`create_view({ kind: 'classical' })`**: the solver as a door. The recipe (`params: { model, dress?,
  liberties? }`) is stored as given and solved again on every render; the mint returns every gate with what it wanted
  and what it saw, and says nobody has looked yet. The page plays the run on equal-time samples (bodies, their trails,
  optional velocity and acceleration arrows, rods, ropes and springs as bars, surfaces as patches) with a system
  readout (the model's own clock, kinetic and potential energy and the total, momentum when nothing outside acts, the
  speeds asked for) and a **What's real · what's drawn** panel: the laws, the checks and their numbers, what the model
  leaves out, and every liberty, the drawing's own included (a scale other than a metre per unit, a body drawn larger
  to be seen, time sped up or slowed). The readout and panel are a new opt-in page block (`scene/channels/science.js`)
  that adds nothing to a page without it. `measure_view` reads a classical world at tier `si`: every body's samples
  and the system's energy, momentum and angular momentum. The `classical` vocab card prints the law and closed-form
  tables from the code (`node scripts/science-cards.mjs`; a test fails when they drift), and its worked examples are
  tested to hold. The same setups composed from the table agree with the mechanics kind (a projectile, a wide
  pendulum, a spring, a rough ramp) and the orbit kind (an ellipse's period and apsides) to a thousandth.
- **The film.** A classical world proposes its own film when its recipe has no shoot plan: a wide shot of the run,
  a close replay of the key moment slowed down (the sharpest change in motion, such as a bounce or a collision, else
  the fastest moment), and an end card that is the honesty panel held on the last frame; `forge_motion` with
  `shot: { motion: 'plan' }` renders it to MP4 or GIF. The film dress (`dress.film`) adds callouts on the model's own
  clock (a caption, or one pinned beside a body), picks the replay's moment and speed, or drops the replay and the
  card. Slow motion is tagged on screen while it plays and listed on the end card; the interactive page never shows
  the film dress, and the film never shows the panel. Any world kind may now propose a film (`defaultShoot` on its
  payload); a recipe's own shoot plan always wins.
- **A shot's `speed`.** Shoot plans gain a time stretch per shot (`speed`, 0.05 to 4): `{ span: [2, 3], speed: 0.25 }`
  is a four-second slow-motion replay of one second of the world, on the World page and in renders alike;
  `set_shot { speed }` edits it. A plan without one is unchanged, byte for byte.
- **`create_view({ kind: 'microscopic' })`**: cells down to molecules, composed from a table of laws (Brownian
  motion with Stokes–Einstein diffusion, drift from a flow or a force, partially permeable membranes, reactions by
  mass action drawn exactly by Gillespie's algorithm in a well-mixed volume). A model is a box, its species (by count
  or concentration; each sphere may stand for many molecules, and the page says what that does to the noise) and
  their laws, run with seeded dice. It is checked: the spread grows as 6·D·t, a drift carries the cloud at v·t, a
  reversible reaction settles at its equilibrium constant, what no reaction can change stays exactly as it began, a
  species that crosses a membrane evens out in proportion to the volumes while one that cannot never crosses; and it
  says when counting stops standing for the volume (reactions outpace mixing) and when a model leaves the scale
  (inertia that lasts, a radius smaller than an atom, flow fast enough for wakes). Statistical checks allow four to
  five standard errors, so a sound run passes for any seed. An enzyme is two reaction rows (E + S ⇌ ES → E + P); an
  unknown law names its scale or what to compose instead. The page draws every shown molecule (up to 300) walking
  its recorded path, changing colour when it reacts, inside a see-through box with each membrane a lattice, counts
  in the readout; its film replays the first reaction slowed. `measure_view` reads every species' count, its count
  on each side of a membrane and its spread at tier `si`. The science readout became rows, shared by both scales,
  and the page helpers moved to `science-worlds/page.js`. `machina/quantities` gains concentration, rate constants,
  diffusivity and the small units.
- **`create_view({ kind: 'quantum' })`**: states and the rules they follow, faithful to the model and claiming
  nothing about reality. A world is one system: a particle on a line (an infinite well, a harmonic well, a
  rectangular barrier, a step, summed into one potential) stepped by Crank–Nicolson; the hydrogen atom's orbitals
  as the exact functions, each drawn as a cloud of points sampled from |ψ|² and coloured by the wavefunction's sign;
  spin-½ atoms through a chain of Stern–Gerlach magnets, each outcome drawn with its odds; unstable nuclei with a
  half-life. It is checked: the total probability and the energy stay as they began, a well's and an oscillator's
  levels, a two-level beat, a displaced packet swinging like a classical mass, a free packet's spreading, a
  barrier's or step's transmission averaged over the packet, an orbital's nodes, norm and mean radius and a χ² that
  its cloud follows |ψ|², each magnet's counts against cos²(θ/2), the measured half-life; and it advises when the
  waves are tiny next to the features, so a classical world would do. Every row carries its sources and the date it
  was last reviewed, and the page lists them. A quantum word that is not a row (tunnelling, superposition, bond)
  comes back as a gap naming the row that is or why there is none. `measure_view` reads each system back. It
  supersedes the curated `atom` kind for orbitals at the door (the routing cards and the atom card point there);
  the `atom` kind still renders. An atom's proposed film circles one orbital, or sways across the front of several. The science readout gains a femto
  prefix and a page without a clock; `machina/quantities` gains eV, Å, pm, fs, ps and the atomic mass unit.
- **Docs.** `docs/AGENT-REFERENCE.md` describes the science worlds (the model and dress split, gaps, the science block,
  the proposed film, the generated cards); the `get_substrate` drawer says in one line that a composed science view
  returns its solver's gates and that its page says what is the model and what is drawn. The `tools/list` payload pin
  rises by 200 bytes for the three new `create_view` kinds (no new tool).
- **The `physics-demo-for-a-class` catalyst**: a teacher's ask to a checked interactive demo and a film. It decides
  the scale first, writes the claim as a measured quantity, keeps exaggerations out of the model, reads the gates,
  measures what the lesson cites, captions from measured numbers, and reports that the eyes gate is the teacher's.
- The ready-made views a composed kind overlaps say when to compose instead, as atom, black-hole and double-slit do:
  mechanics (a demo whose bodies, springs or start are the teacher's → `classical`), orbit (bodies the teacher sets →
  `classical`; an orbit that turns because spacetime curves → `relativistic`) and wavepacket (a well, step or barrier
  the teacher sets → `quantum`). Each keeps its ready-made picture.

### Science worlds further: spacetime, volumes and settings

- **What it is.** Raymarched depictions where a mesh cannot show the model, and science worlds placed in any world.
  The law always lives in JS where the gates run; a shader is generated from the same numbers and held to them by
  a shader conformance gate in headless Chrome ("not run" without a browser). A setting is dress: anything a body
  touches is a law in the model, a gate advises when a body passes through scenery no law covers, and the world
  never changes the physics silently. In order: a fourth scale, `relativistic` (Schwarzschild spacetime: light
  bent round one mass, orbits on geodesics, clocks), a `science` world channel that stands a science world in any
  world, quantum orbitals as volumes and the two-slit plane, and classical field lines and field volumes.
- **The shader conformance gate** (`science-worlds/shader.js`, `conformance.js`). A shader-drawn science page is
  written once as GLSL that defines the picture (`sciImage`, the colour along a ray) and the model quantity it
  computes (`sciValue`); one source makes both the page's full-frame `effects[]` layer and a probe shader, with the
  model's numbers declared once as uniforms. On a capture run the science channel adds a probe bridge that evaluates
  `sciValue` at given inputs into a float target and reads a rendered frame back; an ordinary page carries none of
  it, byte for byte. The gate (`shader-conformance`) compares both with JS: values at probe points, and features
  measured on frames (a dark disk's radius) against their projection. It advises; without a browser it is "not
  run", never a pass. The mint never launches a browser: the e2e tier and `node scripts/science-conformance.mjs
  --selftest` run it, and the self-test holds that a faithful shader agrees and a shader with a hand-typed factor
  in its GLSL disagrees. Shader pages ride the normal World page, so the readout, the honesty panel and film
  capture come with them.
- **`create_view({ kind: 'relativistic' })`**: a fourth scale, the spacetime round one non-rotating mass
  (Schwarzschild), composed from a table of laws with their sources and review dates. One system per world:
  - `light`: what an observer held still sees, drawn by a shader that traces each pixel's light back with the JS
    scheme step for step. You get the shadow (seen at Synge's angle), the photon ring, the sky bent round the mass
    (a grid every 15° or stars), and a thin disk's direct and lensed images, shifted by g (Doppler and gravitational
    together) and brightened by g⁴. Its film swings the eye toward the disk's plane.
  - `orbit`: test bodies on geodesics (RK4 in their own time, played on the far clock's).
  - `clocks`: clocks held at radii or let fall.

  It is checked against the closed forms: the shadow's edge at 3√3/2 Rs by bisection, the bending of light against
  the exact orbit integral, the drawn step against both, the perihelion advance against its elliptic integral each
  lap, each body's fate against its effective potential, the innermost stable orbit at 3 Rs, and a falling clock's
  own time against the cycloid. Mercury comes out at 43″ a century, and the GPS clocks 45.7 µs a day apart. The
  light shader agrees with JS at every probe in Chrome, and one that bends light 3% too little does not.
  `measure_view` reads orbits and clocks back in SI. Lengths may be given in Schwarzschild radii (`'20 Rs'`);
  `machina/quantities` gains `M☉`, `ly`, `pc` and `c`. Relativity, lensing, time dilation and precession now name
  this scale as gaps elsewhere. A spinning hole, gravitational waves and special relativity are gaps saying they
  are not in the table yet. The curated `black-hole` kind keeps its picture, and its card points at this one.
- **A science world in any world**: the `science` world channel (`compose_world` `overrides.science`, or `science`
  on a stored world's recipe; manual: the `science-setting` card) stands a composed demo in any world kind. How it
  stands:
  - A classical demo drawn at one metre per unit stands 1:1 at `at`, turned by `yaw`. Its readout and its "what's
    real · what's drawn" panel ride the world page, the page opens on its camera, and its film is moved into the
    world.
  - Anything else (a microscopic box, an orbital, an orbit or clocks world round a black hole, a solar system drawn
    shrunk) is a bench prop in a glass case, its true magnification on the panel in place of its own scale. A
    light world cannot stand in a world: its shader fills the frame.

  The setting is dress, and what a body touches is a law:
  - `ground: 'from-world'` makes the world's own surface under `at` a plane law at its height, and the panel says
    so.
  - `scenery-clear` checks every body's recorded path against the world's faces near the demo and names any surface
    one passes through that no law covers.
  - `setting-agrees` holds the model's g to the setting's (Earth, Moon, Mars, from the same table as the classical
    frame's presets), and `setting-air` advises on drag where there is no air.

  `compose_world` solves the demo at mint (a bad model refuses the mint) and stamps the setting from the theme
  (`mars-colony` is Mars). The world's surfaces are checked when it renders. Each scale's card gains "In a world",
  and the classical, microscopic, quantum and relativistic assemblers take a plan they were handed. Absent, every
  world is byte-identical.
- **Orbitals as a volume** (`dress.render: 'volume'` on a quantum atom world). Each orbital is ray-marched as a
  density, gold where ψ is positive and blue where it is negative, several side by side in one shader, for every
  orbital up to n = 7. The GLSL is generated from the orbital's own numbers (its Laguerre polynomial's coefficients
  and its real solid harmonic as a polynomial in x, y and z), so nothing in it is a hand-typed twin of the JS. The
  points stay the default, since they are the picture the χ² checks; the volume is a second picture of the same ψ,
  and the panel says which checks are of what. `exposure` sets how strongly it glows. A volume is refused off an
  atom world and in a setting. Its conformance probes are ψ at points of each orbital's cloud against the exact
  function, within a thousandth of the orbital's brightest |ψ|; the worst in Chrome is about 2e-7 of it, out to
  n = 7, and a shader whose ψ falls off 2% too slowly disagrees. `node scripts/science-conformance.mjs --examples`
  runs it, and `--ref` takes a stored volume.
- **The two-slit plane** (the quantum `plane` system and its `slits` row). A packet on a plane, ψ(x, y, t), stepped
  by split-step Fourier, meets a wall with one to six slits. The plane's edge is an absorbing rim whose take is
  counted as it is taken, so what is on the plane and what was taken add to one to round-off. The far field is read
  from the passed wave's transform, zero-padded 4× and integrated along each direction over the packet's spread of
  wavenumbers. Detections are drawn from it one at a time (seeded), and a χ² holds them to it. The checks:
  - fringes against the thin-screen pattern of the grid's own slits, within 3%, with the textbook λ/d beside them
    (two slits come out 0.211 against 0.212, λ/d 0.217; three slits 0.284 against 0.286);
  - `wall-opaque`: the wall struck head on by a packet at the same energy, on the same grid and step;
  - `far-field-settled` and `edges-quiet`: the far field is read once the wave has come through and before the rim
    takes it;
  - `grid-resolves`.

  What the build found:
  - A wall sharp to the cell lets the wave through by the split step's own error: 1e-4 at 20 eV, rising with the
    wall's height, far above its tunnelling. That wave is as wide as the plane and floods the centre of the pattern
    with a spike or a dip. The wall's edges now rise over two cells, which cuts the leak about a thousandfold.
  - A slit in a wall is a short channel, not a thin screen, so one slit's central band comes out 11 to 26% wider than
    λ/w gives. No zero is claimed for it: its `envelope` gate allows up to 35% wider and says why.

  The page plays |ψ|² on a sheet from the solver's own frames (48 frames, 64 cells a side, four to a texel of a float
  texture) through a shader drawn over the page's meshes. A depth prepass keeps the far screen in front of it. The
  wall is a raised slab, and dots arrive at a far screen one at a time over the run's second half, each at its
  detection's angle. The shader conformance gate holds the sheet to the frames (worst 9e-8) and the wall to the
  model's either side of every slit edge. A shader that plays the frames backward between samples and drops the wall
  disagrees. A solve takes about 1.3 s at 128 cells a side; the work is capped at 128² × 1500 grid-steps. `measure_view`
  reads the run, the far field and the detections back. A plane cannot stand in a world. Interference, the double
  slit, diffraction and gratings now name the slits row, and the curated `double-slit` card points here. Whether the
  plane supersedes `double-slit` or `wavepacket` at the door is left to the routing eval.
- **Shader pages over meshes.** `shaderPage` gains `output: 'layer'` (premultiplied, over the page's meshes),
  `dataTextures` (float RGBA, into both the image and the probe shader) and `depthClip` (`sciSceneDistance`, from the
  page's depth prepass). A page without them is byte-identical.
- **Classical fields drawn** (`dress.field` on a classical world). The electric field the `coulomb` and `lorentz`
  rows make, read off the same model at any moment of the run (`classical/field.js`), drawn three ways:
  - `'lines'`: field lines traced by RK4 from the charges where the run starts, as many from each as its share of
    the largest charge, in the charges' plane when they lie in one. Each ends on a charge of the other sign or leaves
    the frame, and a negative charge adds only the lines it still lacks. A uniform E or B is drawn as even lines.
  - `'volume'`: the field's strength glowing on a log scale (from its median in the region to its 99th
    percentile), warm where the potential is positive and cool where negative.
  - `'shells'`: the potential's shells where its size doubles.

  The volume and the shells are a shader layer over the meshes. It reads the charges' paths from a float texture on
  the movers' own clock and interpolation, so the field moves with the bodies. A drawn field adds two gates to the
  page and the mint:
  - `gauss`: the flux through a sphere round each charge is q/ε₀, and none through one round no charge, by a
    Gauss–Legendre surface integral of the field drawn (worst about 4e-16 on the coulomb row's example);
  - `field-lines`: no line stops short, and each charge carries lines in proportion to its charge, within one line
    or a fifth.

  The shader's E and V agree with JS at 48 points and moments through the run as the charge orbits, and one whose
  field falls off as 1/r disagrees. The solver never sees the dress, and a world without a field is byte-identical.
  A volume or shells cannot stand in a world; lines can.
- **Docs.** `docs/AGENT-REFERENCE.md` states the shader rule (the law in JS, the shader generated from the same
  numbers and held to them) beside the setting rule and the channel, and says a page drawn by a shader cannot stand
  in a world. `docs/raymarch-effects-layer.md` gains the science pages as a worked example: the four shader pages,
  the pattern for a picture a gate has to vouch for, and two gotchas: a probe must run on the page's own inputs,
  and a Chrome test that finds no browser passes without proving anything (`MOJULO_CHROMIUM`). The
  `physics-demo-for-a-class` catalyst's scale table names the two-slit plane, orbital volumes and drawn fields, and
  its last step says which demos can stand in a world. The `get_substrate` sentence already named the fourth
  scale. The routing eval that would decide whether `relativistic` supersedes `black-hole`, or the plane supersedes
  `double-slit`, at the door was not run: the curated kinds keep the door, and their cards point at the composed
  ones.

### City hunter: the swinger in a district

- **In progress, nothing built yet.** The city-stalker open world as a primitive: a third-person hero in a city
  district (one `city` segment played as a level). The hero:
  - sticks to any building's wall and launches from it;
  - swings on a gear whose directions its profile constrains (the swinger first: a line to a face above and ahead);
  - fights with the controllable engine's combat.

  Other parts of the theme:
  - **Progression:** gear upgrades open districts, and the reach of the gear is measured against the city's roofs.
  - **Distance:** a planned air (height-aware haze, street smog, a cloud deck, a skyline past the plan) carries the
    city past the district's edge.
  - **Characters** plug into the hero's slot; each new movement state falls back to one every model already has.

  Every key is opt-in; absent, every city level and game renders as before.
- **The probe.** The capability registry (`lib/graph/cosmos`) names the genre, so the hill-climb page measures what it
  waits on:
  - A **City stalker** fixture.
  - `space.levelForm=city`: a city segment played as a level, which is built today (first person, no roofs).
  - Four planned gaps, priced: `power.gear` (a new setting: `none`, built, and `swinger`), `space.traversal=wall`,
    `power.idiom=city-stalker-like` (it requires the swinger and the wall), and `reality.look=city-night`.

  The probe reads blocked on exactly those four. Its Godot export would lose the city level, which no Godot fixture
  plays yet.
- **The district as a stage.** A city segment can be played by a hero, third person (`level.hero: { ref?, gaits? }` on
  a city level; a gameworld's `city.stalker: true` names the world's hero on every segment).
  - **The hero** is the player slot every game uses: the platform rule, a figure-rig body and its clips. It is tuned in
    metres (`CITY_HERO`) and turned into the city's units once (`ruleInUnits`). With no `ref`, a stand-in box plays it.
  - **Roofs are ground.** A lot's box top is ground on the page and in the headless sim alike.
  - **The edges rise to the sky:** over the tallest mass in reach, so only a street leads out.
  - **The camera** chases the hero. The page's own wall pull-in keeps towers out of the frame: its stand-off is read off
    the hero's capsule, so it holds in the city's units.

  One engine addition, opt-in: a rig body's `body.scale`. The page draws the body at that scale, and the code is emitted
  only when some body carries one.

  Without `level.hero`, the walker plays the segment as before.
- **The wall.** A platform body with `rule.wall` holds any collider's face (`worlds/controllable/wall.js`, a body
  owner beside the ladder's climb). Nothing is authored: a box's side is a plane with a known normal.
  - **Taking hold:** pressing forward into a face, in the air, or from the street when the face stands higher than the
    body. A low box, a narrow one (a tree's trunk) or a box marked `hold: false` (a hero level's edge) is not held.
  - **The crawl:** up and down the face, and across it with A / D. It rounds an outside corner onto the box's next
    face, unless another box stands there. A face of stacked boxes climbs as one.
  - **The top:** up past it, the body mantles over the lip onto the roof. Down at the foot it lets go.
  - **Off the wall:** a tapped jump is a wall-jump, out and up. A held jump is a wall-launch, its speed growing to
    twice the jump's.
  - **Between holds:** standing still at a roof's lip is a perch; falling fast off a roof is a dive.

  The wall's defaults are in metres, scaled by the rule's `metre` (world units per metre), so `wall: true` holds in a
  city level's units too.
  - **The city hero** has the wall unless `level.hero.wall: false`. Each of its new states (`wall_crawl`, `mantle`,
    `perch`, `dive`) plays the figure's first fallback clip it has (`TRAVERSAL_FALLBACK` in `playscape/player.js`).
  - **Godot and Roblox** name the wall lost.
  - **The registry** marks `space.traversal=wall` built on the web. The City stalker probe now waits on the swinger,
    the idiom and the look.
- **The swinger.** A platform body with `rule.gear: 'swinger'` casts a line to a building's face and swings on it
  (`worlds/controllable/swing.js`, a body owner after the wall). A gear is a set of direction constraints on where
  its line lands; the swinger's are a face above and ahead.
  - **The anchor** is found for the hero, never aimed. It is the face point nearest an ideal one (55° up, out along
    the heading), within reach, at least 25° up, inside a 75° cone either side of the heading, with a clear line.
    With no face in reach (an open plaza, a park) there is no line. A `hold: false` box takes none.
  - **The swing:** the gear's key (`boost`, F) held in the air. The line cannot stretch; gravity pulls the body; A / D
    steer and forward pumps. Its pivot is the anchor drawn three quarters of the way toward the hero's own line, so
    the arc runs down the street rather than into the wall the line is on. Its length keeps the arc's bottom clear of
    the street.
  - **Letting go:** the key let go, a jump (with a lift), a box across the line, a box met (the wall then takes the
    body), or the ground. The body flies on with the swing's speed.
  - **The zip:** the key pressed on the ground pulls the hero straight to the face, where the wall takes hold.

  Supporting pieces:
  - **The page** draws the line from the hand to the anchor, emitted only where a body has a gear.
  - **The new states** (`swing`, `swing_release`, `zip`) fall back to the leap.
  - **The city hero** carries the swinger unless `level.hero.gear: false`, and its controls legend names F.
  - **Godot and Roblox** name the gear lost.
  - **The registry** marks `power.gear=swinger` built on the web. The City stalker probe now waits on the idiom and
    the look.
- **The air: distance and scale.** A hero's district is a few hundred metres across; from its tallest roof the city
  goes on for kilometres. The stalker's eye (`city/plan/eye.js`) plans the air that carries it past the edge, on the
  pilot's eye's law (`skyscape/map.js`): fog opaque where ρ·d reaches 1.978, its density thinning with height.
  - **The plan:** from the street the hero sees the district and the 140 m ring of real masses round it; from the
    tallest roof, out to a skyline past the plan's edge.
  - **The far ring:** the rest of the plan stands round the district as massing, one instance a lot (two instanced
    meshes in all), lit as the city is and tinted with each lot's own colours.
  - **The skyline band:** seeded cards past the plan's edge, so the city never visibly ends.
  - **The page** thins the haze with the camera's height (`hazeHeight`), composed with any other writer of the fog
    (the weather), and emitted only where a world asks.
  - **A cloud deck** over the district by default (`clouds`: the recipe's own wins), dark by night.
  - **The city kind** now honours `fog` (street smog, clipped to the level) and `clouds`. Both were accepted in a
    recipe before and silently dropped.
  - **The `city-night` look:** concrete, asphalt and neon under a glowing night sky, no sun, so the windows light.
    Its reference card is Midnight Club II. A `city-night` geocube preset carries its colours, buildings and palette.
    The registry marks `reality.look=city-night` built.
  - **Godot and Roblox** name the height thinning lost.

- **Indoors: a warehouse, a dungeon.** The wall and the swinger play under a roof, in any gameworld level.
  - **A hero's starting moves:** `characters.hero.actions.moves: ['wall', 'swinger']` (`HERO_MOVES` in
    `gameworld/actions.js`) puts them on its platform rule in every level it plays: a trail, a building, an inside
    behind a door. Its clips fall back for their states, and F is named on its controls.
  - **Ceilings as colliders:** a building level such a hero plays lays each room's ceiling as a collider
    (`ceilings: true` on a stage; `stageColliders` in `era/anchors.js`). They are never laid over a room a stair rises
    out of, nor under an open sky.
  - **The swinger indoors** also casts to a box's underside over the hero (a ceiling, a beam), aimed where its ideal
    ray meets that plane. Its arc's clearance shrinks with the room under the pivot, and no line shorter than the hero
    casts (a low room swings nothing).
  - **The wall indoors** keeps the head under a lid (a ceiling, a tower's setback) as it climbs.
  - **A warehouse** is a barn with a great floor: `building: { use: 'barn', rooms: { floor: { w: 30, d: 20, h: 12 } } }`.
  - **A dungeon:** a crypt's chain of rooms plays with the moves, and so does a tower up its storeys, its stair rooms
    left open overhead.

- **The reach: progression the map measures.** `game/reach.js` works out which surfaces a hero's moves carry it to: the
  grounds, and every box top with room to stand. It reads the engine's own dials (the platform rule's run and jump,
  the wall's, the gear's).
  - **Its moves:** walk, jump (air jumps added), drop, the wall (a holdable face up to its top, stacked boxes as one)
    and the swing (across a gap under an anchor the line can take, rising a jump and the gear's clearance).
  - **Each law is held to the engine's own runs:** the hero climbs the tower the wall reaches; it swings across the
    gap the line crosses and lands on the far roof; a street swing rises past the law's bound.
  - **What it answers:** `reachUpgrades` says what each move opens; on a district the wall opens every roof. The
    solver is analytic, a law per move: a move it allows the engine makes, and one it refuses a player's skill may
    still find.
  - **The moves as powers:** `wall` and `swinger` are moves a power gives (`TRAVERSAL_MOVES`), so a map world can hide
    them and gate by them. The level contract takes a grant of `true` or a preset's name. The page draws a granted line
    (the drawer is emitted where a grant carries a gear), and the pilot's figure plays the moves' fallback clips.
  - **Keys in a city:** a map world may lay a key in a city level. It lies on the segment's tallest roof the hero's
    own moves reach, by the solver, and is taken only up there. A power found there gives its move in the city's
    units. City levels refused keys before.
  - **The idiom** `city-stalker-like` ("the gear's reach gates the city", an unlock system) is built. **The City
    stalker probe is makeable.**
  - **The swinger's line** is now reeled in at `reel` (20 m/s) from the cast's length. Before, it snapped to its own
    length across the gap, a 12 m jump on the first step.

  The City stalker probe now waits on the idiom alone, and a brief's words find it (`gameworld/intent.js`: rooftops,
  swinging between skyscrapers, a superhero). A hero level with a made character (`level.hero.ref`) now
  draws: the plan read off the lowered level no longer takes the level's `figures` as a city setting.

### Biocube fauna: what lives in a level, beside what grows

A biocube said what grows in a level. It now says what lives there too (`fauna`, beside `flora`). Fauna are never
enemies: an animal that hunts is a game's foe. There are two tiers. UNIT fauna take up room (a sheep, a deer); FIELD
fauna are scenery that is never in the way. Not every level wants fauna: a biocube grows none unless asked, and every
preset's is none, so the geocubes that grow `meadow`, `upland` or `grove` are byte for byte as before.

- **Size classes** (`fauna/size-class.js`): `mini` (insects), `smol` (a mouse to a pet), `chonky` (to a person or
  cattle), `behemoth` (a hippo, a rhino), `gargantuan` (an elephant and up). Measured, never tagged: a bug by its
  bauplan's length, an animal by its skeleton's longest extent, so a new species gets its class from the bones it
  builds.
- **The document** (`era/biocube-fauna.js`): a preset (`summer-day`: butterflies, gnats, a flock crossing;
  `summer-night`: fireflies, a few gnats), a document `{ swarms: { <kind>: true | { …settings } | null } }`, or
  `{ from, swarms }` kind by kind. Every setting is on its rail and told when it is off. Each field kind stands for an
  animal in the rosters, takes its size class, and keeps to its grounds of the substrate map (`faunaOn`).
- **The field on a stage** (`placeFauna`, an isekai stage's `biocube.fauna`): gnat clouds over the grass near the way,
  fireflies by the trees, butterflies over the grass, all on their own ground, off the way and off claimed ground, by
  the site's dice. The colours are the world's ramps: the soil's darkest for gnats, the gold for fireflies, the gold,
  violet and fruit for butterflies, the rock's darkest for birds.
- **The page draws them** (`scene/channels/fauna.js`, `emitThreeWorld({ fauna })`). Each kind is a closed form of the
  clock, so a pinned frame is reproducible:
  - gnats are dark specks jittering in a swaying column;
  - fireflies are glowing points drifting and blinking, a hard core with a soft halo;
  - butterflies are two wing cards beating along a wandering loop above the grass;
  - birds are a loose V of beating and gliding silhouettes crossing high overhead every `every` seconds, each pass its
    own heading, height and count.

  Absent fauna, not one byte. Godot and Roblox mark it absent.
- **Herds: the unit tier** (`fauna.herds`: `{ <species>: true | { groups, size: [lo, hi] } | null }`; presets
  `pasture`, sheep in two flocks, and `woodland`, deer and rabbits). Any species of the encyclopedia that can walk a
  level (`unitOf`): a bug is refused (a mini animal is a swarm), as are an animal of the water and a body with no stride
  on land, each saying why.
  - The stage places each herd's ground on the soil off the way, its animals round it, none on a trunk.
  - Each animal is an `ai` body walking on its species' own gait at that gait's speed (`fauna/rig.js` `gaitStride`), so
    its feet keep to the ground. Its mind is passive: a grazer crops the grass laid round its herd (`food`), every other
    animal wanders. No weapon and no side, whatever the species: a wolf in a pasture only wanders.
  - The world builds each species' rig once from its plan (`worlds/fauna-units.js`), with no stored sketch: its gait
    plays the runtime's walk, its eating the graze.
  - A level whose only minds are its fauna shows no AI-attack button.
- **Killable and pettable herds** (a herd's `killable: false | true | { hp }` and `interact: null | 'pet'`).
  - Killable: its body takes hits (`hp`, by its size unless named: a rabbit about 25, a sheep about 50, an elephant about
    180), its rig carries its flinch, fall and rise as the runtime's stagger, topple and getup, and it lies where it
    falls. It never strikes back. A `defeat-all` that names its foes never counts it (its ids begin `fauna:`).
  - Petted (`scene/channels/fauna-pet.js`, emitted only when an animal may be): the walker, or the pilot in a game, in
    reach of one sees the interact key and "pet". The press holds it (the cast's hold: its mind waits), turned to the
    petter, playing its relax loop under a rising heart for 3 s; then it goes back to grazing. A game's bus hears
    `petted` { entity, species }. `pasture`'s sheep may be petted.
  - Petting is the World page's: Godot plays the herds and their hits, not the petting.
- **Water, indoors and the gargantuan.**
  - Ducks (`ducks`, a mallard's stand-in): floating on a stage's streams (`era/out-trail.js` `streamSheets`, the water a
    trail's crossing lays, now shared with what floats on it), paddling, bobbing, tipping up to feed. Preset `brook`.
  - Indoors (`roaches`, `mice`, preset `cellar`): a room stage lays a biocube's fauna along its rooms' walls
    (`placeIndoorFauna`; each storey's on its own floor), each critter still a while, then a dash. Nothing grows under
    a roof: a room stage lays no flora. The kinds keep to their side: herds and outdoor kinds are refused indoors, the
    indoor kinds outdoors, each saying why.
  - A biocube of fauna alone (`{ fauna }`) lays no flora of its own: the kit grows its own, byte for byte.
  - The gargantuan is a rock's or a pillar's scale (an elephant, a giraffe, up to a Gundam's), never a mountain's. A
    body standing 4 m or more is gargantuan whatever its length (a giraffe). A gargantuan unit is solid and holds
    (`body.collide`, heavy: a game's player walks round it), stands long between slow wanders, and one past 20 m is
    refused as a landmark, not fauna. The walk page's eye is no body: it passes through, as through any.
  - Herds keep to the valley's side of the cliff, as the trees do.
### Snow: a cube's land under snow, bare trees and footprints

A cube can name its snow (`snow`, `era/snow.js`), and its trail's stage lies under it: snowcapped crags over a line, a
winter cover or deep snow over the whole land. A biocube's trees can go bare for the season, and the walker leaves
footprints. A cube that names no snow, and a biocube that names no season, are drawn as before.

- **Where it lies**: over its `line` (metres over the land's lowest ground; absent, everywhere), its edge wandering and
  held lower on the side turned from the sun (`lee`), on ground level enough to hold it (`hold`: steeper rock stands
  bare, a cliff's ledge takes it whole), opened in patches by the wind (`drift`). The lying ground is cut where its
  field crosses, as sand and pavement are; boulder caps take it; the rock flora is buried; a grass lip on a snowy cliff
  is gone. Gritty, it is laid with the sand's cut, the wind's crust.
- **Its colour** is the theorist's (`snowRamp`): near-white, cool in its shade (the sky's hue), warm in its light (the
  sun's), quiet in chroma since the bake blues its shade; it takes the hour as the land does.
- **The trail** goes trodden snow, packed and greyed, the soil showing through as far as the snow is shallow; its
  fringe the snow's, no dirt patch over it.
- **The far ridges** are capped over the line (the whole ridge but its foot without one), the line wandering down the
  gullies, hazed into each ridge's far stop; the skirt's near bands go white with it.
- **Under it**: the grass stands through a dusting, thins under a cover and is gone under deep snow (`grassUnder`); a
  leaf turned up carries it, more of them and further down the deeper it lies (`capOf`), so bushes become mounds; a
  limb's top takes it too.
- **The season** (`flora.trees.season: 'bare'`, `era/biocube.js`): what has a fall drops its leaves, every tree and
  bush its limbs and twigs (a tree with no kind grown as a spray's); the evergreens keep their crowns: the new `spire`
  form (a cone of near-level tiers in flat drooping fans to a leader: firs, pines), evergreen unless a kind says
  otherwise, and any kind with `evergreen: true`. The far woods go to the bark's grey-brown.
- **Footprints** (`scene/channels/snow-prints.js`, a stage's `snowPrints`): the beach's footprint bed
  (`materials/soft-ground.js`) on its fresh-snow ground, in a window round the walker on the snow; a foot packs the
  powder and pushes a rim. Only what a foot touched is drawn, a few centimetres nearer the eye along its own ray, so
  no window shows. The beach's own channel is unchanged. Engines mark it not drawn.

The gallery: `scripts/spikes/geotown/snow.mjs` (none, snowcapped, a cover, deep, deep winter with bare trees and firs, a cover by
night, a quiet cube, a fir wood; the clump, the trail to the crags, from above, footprints up the trail). The manuals: the
`geocube` card (`snow`) and the `biocube` card (the season).

### Flora at night: what is drawn in a ramp's stops comes down with the hour

A cube lowered at an hour bakes its land under the hour's light, but a gritty crown's chips and cores, the live grass's
windows and the rock flora are drawn in a ramp's stops rather than baked, so at dusk and night they kept their noon
colours over a darkened land. They now come down the ramp by the hour.

- **Measured against the cube's own light**: a cube lowered at an hour keeps its reference's light beside the hour's
  (`ownLight` on the look's card, `era/geocube.js`); the shift (`hourShift`, `era/isekai.js`) is where the bake lands the
  foliage under the hour's light against where it lands under the cube's own, in stops, never above 0. A cube at its own
  hour (a night palette under its own moon, a day cube at noon) and a kit's card move by none.
- **What moves**: chips and cores by the world foliage's shift, every picked foliage the same stops; the live grass's
  lit and shade windows; the rock flora down its ramps as far as the foliage dims (`hourDim`), so a bright gold comes
  as far down as a dark fern; a gritty cube's leaf card tile its window of the foliage moved by the shift; the
  swatch-coloured flora (shrubs, ikebana solids) dimmed by the same share.
- **Unchanged**: a cube lowered with no hour, and a kit, are byte-identical. A cube lowered at its own hour draws the same
  colours, but its look's card carries a new key, so the look's id changes.

The gallery: `scripts/spikes/geotown/night.mjs` (a cube's own palette at noon, dusk and night, and a night palette
altogether at its own hour).

### Bushes and shrubs: composed in sections, blocking or walked through

A biocube composes a level's bushes (`flora.bushes`, `era/thickets.js`): tree kinds with the trunk taken away (a few
thin stems from the foot, splayed, finer limbs, a low wide crown), drawn through the trees' own leaf-branch path, chipped
on a gritty land and plain on a quiet one.

- **Sections**: patches of one kind each, off the trail and clear of the rocks, the trees and each other, mounding
  toward the middle; no grass grows up through a bush (an avoided thing's own `clearR`, the grass's fixed reach
  absent it).
- **Walk**: a kind's `walk: 'block'` stops a walker on the page and is a collider for an engine; `walk: 'through'` is
  drawn in soft groups (`flora:brush`, `flora:brush-chips`, `flora:brush-wood`) the walker passes through.
- **In a clump**: an arranged clump's role can be cast as a bush (`clump.hikae: { bush: 0 }`, `filler: { bush: 1 }`), and
  takes its role's harmony colour as a tree does.
- **Cost**: a bush's lobes are coarse and it draws no twigs: about 930 faces a bush on a gritty land.

The galleries: `scripts/spikes/geotown/bushes.mjs` (sections) and `clump-harmony.mjs clump-bushes` (clumps grounded on
shrubs); the manual, the `biocube` card.

### Composed clumps: an ikebana clump cast and coloured by role

An arranged clump (`compose: 'ikebana'`) placed its trees in roles but drew them all one kind and one colour. Now a
biocube casts them and the colour theorist colours them:

- **The cast** (`flora.trees.clump: { shin, soe, hikae, filler }`): each role's kind by its place in `kinds`, so a clump
  can contrast a line, a mass and a mound.
- **The harmony** (`flora.trees.harmony`, `era/flora-colours.js`): the clump's colours by role, solved from the world's
  foliage: `analogous` (the hue stepping cool to warm), `value` (dark behind to light in front), `accent` (one note
  turned on the anchor), `season` (the clump turning). The theorist's law: each role steps from the one behind it (an
  accent stands out), every role off the grass. A role's harmony colour wins over its kind's `leaf`.
- **Shares** (a kind's `share`): the level's kinds in proportion, a dominant, a subordinate, an accent.
- **Each stamp its own value**: a kind's stamped trees each a little darker or not, by their own dice
  (`TREE_BANDS.vary`).

No new geometry: a template for each kind and crown colour the stock takes. The gallery:
`scripts/spikes/geotown/clump-harmony.mjs`; the manual, the `biocube` card.

### Far grass: the meadow out past the field

The live grass stood only round the walker: past about 13 m its cover fell away and past its radius it was gone, so
open meadow was turf with tussocks on it and the grass grew in as the walker came close. Now the meadow has a far grass
of its own (`scene/channels/stage-grass.js`, opt-in on a card's `live.far: { density, width }`, the meadow's on):
clumps over every cell grass may stand in, the field's own simplest tuft drawn wider and sparser, in the same locked
ramp and the same wind. Each clump stands by the cover the field has lost at its distance (`farShare`: none near the
eye, all of it past the field, rising as the field thins), worked in its vertex shader each frame, so walking in, the
field takes over clump by clump, and walking out the clumps stand back up. A recipe's `grass.far: false` turns it off.
On the meadow it is about 3,400 clumps, 94k triangles: about an eighth of the field's own budget. The walk in, off and
on: `scripts/spikes/geotown/far-grass.mjs`.

### Leaf forms: a gritty crown grown as leaf branches

A gritty crown can grow as LEAF BRANCHES instead of one heap of balls: the trunk forks into limbs, the limbs throw leaf
branches, and each ends in a lobe, an ellipsoid shaped and turned by the form so the leaf pattern reads as the plant's
own (`era/leaf-forms.js`). Each lobe is cored and chipped as the painted crown is, the chips grained along its length
and leant as the form holds its leaves; far, the lobes' cores alone carry the tree, coarser.

- **The forms**: `spray` (lobes strung along twigs, the leaves fanned along them), `plate` (flat level discs in tiers
  round the trunk), `weep` (long drops hanging from arching limbs), `tuft` (small upright brushes at bare limbs' tips),
  `whorl` (a ring of level spokes round each limb's end); the gallery is `scripts/spikes/geotown/leaf-forms.mjs`.
- **A level's trees are kinds it composes**, not species looked up from nature. A biocube's `flora.trees.kinds` lists
  1 to 6: a form's name, or `{ form, scale, trunk, girth, spread, density, stems, splay, branch, split, leaf, bark,
  barkForm }` (`TREE_KIND_KEYS`): the silhouette, how tall it stands against the level's heights, where its crown
  starts, its trunk's girth, its crown's spread, its limbs against the form's, how many stems rise from its foot and
  how far they lean out (two a V), its limbs' thickness and how often each forks again (finer branching), the colours
  it picks and its bark's marks. Each clump is one kind, by its dice; a cube carries
  the kinds it wants in its own biocube. On a gritty land each tree grows its kind's crown: a hero whole, the stock
  stamped from a template for each kind and variant, a far tree its cores coarse and no twigs. A quiet land keeps the
  balls, and a level that names no kinds is as it was.
- **The colour theorist offers the trees their colours** (`era/flora-colours.js`): from the world's own foliage, grass,
  rock and soil, three more foliage colours (deep, young, turned toward the accent or autumn's warm), each kept apart
  from the grass and from each other, and four barks (warm from the soil, pale from the rock, a cool near-black, and a
  near-white, a birch's).
  A kind's `leaf` and `bark` pick from the offer (0 the world's own); which tree takes which is the composition's. Its
  crown's core and chips stand in the picked foliage, its wood is baked from the picked bark and locked to its ramp.
  The level side by side, with the offer as swatches: `scripts/spikes/geotown/kinds.mjs`.
- **Bark's marks** (`matte-paint/dressed.js` BARK_FORM_IDS, the bark cut's `form`): `furrowed` (plates between furrows,
  as it was), `smooth`, `banded` (dark dashes round the trunk and a few scars, a birch's), `plated` (broad plates parted
  by deep cracks) and `peeling` (patches in three tones). The tile is a grey the bark's colour multiplies, so a white
  bark with `banded` marks is a birch. One kind at a time, with its bark close: `scripts/spikes/geotown/tree-kinds.mjs`.
- **The manual**: the `biocube` sketch-vocab card (`get_sketch_vocab({ id: 'biocube' })`): where a biocube goes, its
  presets and blocks, the tree kinds and their settings, the theorist's offer and some silhouettes people ask for (a
  birch, a V, a clump, an umbrella grove); the geocube card points to it from its ingredients.

### Faster gritty builds, and the tests that build them

Byte-identical output throughout: the same stages, faces and texture bytes, checked by hash before and after.

- **The sun's shadow test** (`era/sun.js`) works what a triangle and the sun fix (its edges, `L × ac`, `1/det`) once
  per triangle, and a query's arithmetic in scalars in the same order, so it allocates nothing. A gritty stage builds
  in about 60% of the time it took; every sunlit world shares it (stages, jungle, local meru, the road looks).
- **A detail tile is painted once while it is in use** (`matte-paint/detail.js`): its texels and its shown tile are
  kept for the few keys in use, and a scree's dice for its levels (`era/scree-tiles.js`), so the page's resolver, the
  sand and turf cutouts and the scree's levels stop repainting the same 512-texel tile. A gritty stage's textures
  resolve in under half the time.
- **The era tests share their builds within a file**: a stage or a street several tests read is built once, the
  determinism rebuilds left to the suites that own that law, and a street read only for the stage it lowers to is not
  built at all.

### Creases: the vgl rule as a shader in the World

The vgl rule inks a concave crease (a wall's foot, a tier on the one below, a column on its plinth) and never a convex
edge or a silhouette. Until now it was baked geometry for box massings only: the stepped pyramid's hairlines and the
city's `creaseSeams` feather. It is now a pass in the World page over the scene's depth, for any geometry the builders
mark angular, with a falloff that blends from the corner out. Opt-in: a world that does not ask emits the same bytes.

- **`creases` on any world manifest** (`true`, or `{ ink, line, wash, reach }`). Built for the outcomes outside the game
  loop: the fractal city (its metro profile too), the city plan, edifices, historic places, the transit kinds and the
  building interiors. The exported unshaded base drops it, as it drops the other baked shading. `compose_world` takes
  it as `overrides.creases` on any base, and a stored world takes it by patch (`set /creases true`); the manual is the
  `creases` view-vocab card. Engines do not draw it yet (marked absent).
- **How it draws** (`scene/channels/creases.js`). One prepass draws every solid's linear depth and an angular mask
  into a float target. A pass then reads each pixel's neighbours against its plane: a small disc for the line, a disc
  of the world reach for the blend. Only rises taller than two pixels count, and the ink fades where the reach spans
  only a few pixels, so a far facade's window reveals are not hatched. A depth-aware 4x4 composite blends the sampling
  jitter out.
- **Only angular surfaces take ink.** A face marked `organic` (the city's trees) is drawn black in the crease mask, so
  neither it nor the ground at its foot is inked; figures, walkers, cars, water and the sky are never inked.
- **The colour register** (`era/colour-register.js`). A geocube's `register` was the tone's bands and key; it can now be
  a NAME that renders the world as a drawing: `cel` (three bands along each ramp, an outline round every form, crisp
  creases), `ink-wash` (a broad wash pooling in every corner, a fine outline), `wii` (soft creases, the light shaped in
  the vertex) and `continuous` (the light alone). `{ from, …changes }` varies one; its terms are `steps`, `key`,
  `outline`, `creases` and `contrast`, and a name keeps the key the cube had or the palette solves. The colour theorist
  inks it: the outline in the stone's hue and the creases in the shade's, both under every ramp's darkest stop, checked
  by a cube law, `register-ink`. A world painted by the cube (a stage's `geocube`, the geocube kind, a city plan's
  `paint.geocube`) draws the register's creases and outline; the world's own `creases` wins, and `false` turns them off.
  A register's `contrast` is lent to a cube that names none of its own. A cube whose register is `{ steps, key }`
  reads, lowers and renders as before.
- **The outline** is a term of the crease pass (`creases.outline`): a line round every silhouette, where a pixel's
  neighbours find the sky or a surface well behind it. The toon dial's ink hull stays the figures' outline.
- **Land.** A face may be `organic: 'land'`: inked only where something built meets it, and outlined against what lies
  behind it but not against the sky at the world's edge. When a world draws creases its land and plant pools take their
  class from their groups (`scene/crease-roles.js`: the polygon land, a terrain's bake, rocks; the plant pools'
  species), so nothing is threaded through the land's builders. A gritty land's foliage is organic too: a crown, its
  core and chips, blossom, grass and the drapes over a cliff's edge, the strand's wrack, a rock's moss, the clouds and
  the stage's flora (`flora:*`); a trunk and a bamboo's culm are built, so a tree is grounded. A gritty cube whose register
  names no creases now draws the `wii` register's soft ones (its rooms and its town's stone panel-lined, its foliage
  left alone); `register.creases: false` draws none. A water sheet hides the bed under it from the pass, and
  the sky dome is no surface behind anything. The scene's fog takes the ink as it takes the surface under it.
- **Fixed: vertex contrast in a world not measured in metres.** The contrast's foot and its drift are metres; a city
  plan's unit is 3.66 m, so the foot covered a whole storey. The payload now carries the world's unit to it.

### Micro matte painting: surfaces painted from relief

Every surface mark becomes relief, painted from a light: an element's face is a seeded height field, lit from a
chosen direction with its own shadows and hollows, painted by sampling the cube's ramps at the values the light gives,
and cut to the element's outline as a PNG. No line is drawn; a crack is a groove whose lip catches the light. The
light is baked into the paint, the house era's way; no normal maps. First stone blocks, then cliffs and rocks painted
on the road. Existing tiles are untouched: a cube, stage or road that does not ask for it emits the same bytes.

- **The painter** (`lib/graph/matte-paint/`): `paintSurface({ outline, ppm, grit, seed, light, relief, paint })` paints
  one face and cuts it to its outline as an RGBA PNG, in about a tenth of a second for a 1.2 m block at 256 px/m.
  The relief comes in layers. `form` makes the chamfered, slightly pillowed face with a ragged arris. `rough` adds
  undulation and grain, and `tool` the finish's marks (tooled ridges, or a pitched face of tilted facets). `spall`
  breaks the arrises back along curved fracture planes; where a break falls deep enough the stone is gone and the
  outline follows. `groove` cuts cracks as tapered V-grooves that wander and fork, and `pit` adds round craters. The
  light gives each texel a value from its normal, a self-shadow marched over the height field, and darkening in
  hollows, held at a mean of 1 so the World's vertex light still does the large shading. The paint picks each texel's
  stop on the material's ramp by that value, then lays on its other layers: patches of a second ramp, mineral flecks,
  damp at the foot, dirt in the hollows and toward the foot, and moss on what faces up (opt-in). `grit` moves every
  layer together, and a layer set to `false` adds nothing. Seeded dice only, over the integer-exact noise
  (`noise/noise.js`), and pinned. Nothing uses it yet: the stone-block wall is next.
  `scripts/spikes/matte/sheet.mjs` paints a sheet of one block from a cube's ramps.
- **A rock can be a dressed block.** The rock field (`polygonizer/rock-fracture.js`) takes `base: 'box'`: a box's six
  faces are the block in place of the random fracture planes round an ellipsoid, so its faces stay whole and the chips
  find its arrises and corners, breaking along the minerals' cleavage. `chipScale` (0–1) shrinks every fracture level,
  so a dressed block chips by the centimetre. Both are opt-in; a rock that names neither is the same field.
  `scripts/spikes/matte/rock-compare.mjs` sets the matte painter beside faces traced from the rock field.
- **A gritty style's rock takes pixels, near the eye.** "Rock takes no pixels" (the polygon land) now holds for a style
  that is not gritty. A geocube takes `grit` (0–1), which lowers into its land's `shading.grit`. At `GRIT_PIXELS` (0.35)
  or over, the land's faces stay exactly the quiet style's, so the polygons carry the far view, and the page is handed
  the rock's own FABRIC (`matte-paint/fabric.js`). That is its joint sets as planes in world space, read from the joints
  the landform broke the cliff on (the island's granite: two vertical sets along its strike at the card's spacing,
  each with minor joints at a third of it; basalt three sets sixty degrees apart; slate a dipping cleavage), and the
  landform's beds when it has strata. The page's channel (`scene/channels/fabric.js`) draws where those planes cut each
  cliff face. A joint is a groove whose lips the key light finds; it wanders a little, holds for a stretch and stops.
  Each block between joints is its own plane, a soft bed is recessed, and the grain shows at its own size. The relief
  is shaded as a ratio to the face's own light, so where it draws nothing the baked light is untouched. A face along a
  joint set shows none of it, a face across it shows its lines, the beds stay level round the cliff, and joints fade on
  slopes gentler than the landform's own joint band. THE VISUAL DOMAIN: each layer fades in once its feature spans a
  few pixels, and a pixel covering more than the coarsest feature's share does no work, so the detail is a sphere round
  the eye that ends at the grain. Under the threshold, or with no `grit`, nothing is emitted. The boulders stay polygon
  for now. `landform.js` records the joints it lays (`s.joints`); its output is unchanged.
- **A rock's skin.** The land's shading takes `skin` (with `grit`): `true` for the rock's own, or one of `ROCK_SKINS`
  (`fluted`, `sculpted`, `slabs`, `bedded`; granite's blocky joints give sculpted, basalt's columns fluted, slate's
  cleavage slabs, a stone with strata bedded). The page then draws the near rock in its CHUNKS rather than its joints'
  grooves: Voronoi regions in 3D, warped by noise and laid in the fabric's own frame (along the joint strike, across it,
  up), so the chunks are the blocks the joints bound and every face through one agrees. Each chunk stands proud or sits
  back by its own dice, its edge rounded into a recess, and one sample toward the sun casts its shadow into the recess
  beside it. The height bumps the face's light by screen-space derivatives, and the chunks read only on the steep faces
  the landform broke. A skin's chunks read from farther than a groove, so the visual domain grows to them. Without
  `skin`, the page's fabric is byte for byte as pinned.
- **Rock formations.** `skin` also names a formation (`ROCK_FORMATIONS`: `flagstone`, `limestone`, `sandstone`).
  The page then draws the cliff as erosion leaves it instead of as chunks laid on it. The rock is units up the face, each
  either a thick bed or a packet of thin ones, and each with its own hardness; the joints cut a run of units into
  blocks. A soft bed wears back. A hard block holds an overhang over it up to what its hardness and thickness bear,
  then sheds slabs, and the block above, now undercut, follows; the page traces this four units down. Some blocks fall
  on their own and leave an irregular scar. The face is broken small by terraced noise: ledges along the beds and
  steps up the joints, never a network of cells. A few samples toward the sun cast the ledges' shadows. The rock is
  weathered with a tint for each bed, darker soft beds, warm fresh scars, lichen near the eye, streaks under a proud
  block, and the land's grass hung over a flagstone's ledges. Every step blends over the pixel's own footprint, so no
  edge aliases. A face turned from the sun keeps its relief soft, and the light ratio is held closer than a skin's, so
  a lit ledge is a highlight rather than a glare. The boulders are drawn in the same rock. The formations were found
  on a CPU study of whole cliffs generated by erosion (`scripts/spikes/matte/cliffs.mjs`). Up close the rock has
  DEPTH: where a pixel spans under a formation's `near` metres, the view ray is marched into the structure (the blocks'
  retreat and the soft beds' wear), so a recess is seen into and its far wall hides its floor. The broken small detail
  goes on in finer octaves down to a few centimetres, with a mineral grain under a centimetre, each layer drawn once
  it can be seen. Without a formation, the page's fabric is byte for byte as pinned.
- **Broken edges.** A gritty style's boulders break at their edges, so no long edge reads as a ruled line against the
  sky. Each boulder's sides and cap are refined into one grid of shared vertices, so it stays closed, open only at its
  sunk foot. Each vertex is pushed into the rock by a chip field of stepped dice in 3D cells at two sizes: blocky
  breaks, never a wobble. The chips are strongest on the real edges (the rim, the corners between sides, a ring's bend
  by its angle) and fade inside them, and the flats undulate a little. The land's shape is otherwise the quiet
  style's; its baked light differs only where the broken boulders cast their shadows. `boulderFaces` takes `broken`;
  without it a boulder is byte for byte as it was.
- **Broken rims and strewn stones** (`local-meru/broken-land.js`). A gritty island's cliff rims break the same way.
  Each vertex where a cliff face meets the land above it is pushed back into the land, and down a little, by stepped
  chip dice. The move depends on the vertex alone, so the cliff and the ground beside it keep one corner. Small stones
  lie about: a few on each boulder's top, pebbles along the paths, and scree fallen out at the cliffs' feet (never in
  the sea). Each stone is a boulder of a few sides, drawn in the rock's own skin.
- **A second rock.** The land's shading takes `rocks` (with `skin`): the boulders' own skin or formation, beside the
  cliff's, drawn by a program of its own. Without `rocks`, a formation takes the boulders too.

### Dressed rooms: the room's stone painted from relief

- **A dressed-stone tile** (`gen: 'dressed'`, `matte-paint/dressed.js`). Ashlar painted by the matte painter as a room
  tile: courses of big blocks in a running bond, each block its own relief (a pillowed, chamfered form, a tooled face or
  a pitched rock face, spalls at its arrises, pits), set in recessed mortar, lit from above (a wall's light is the
  sky's and the lamps'), each block its own tone, mottle and weather. Seamless by construction (whole courses, blocks
  laid whole and wrapped, the light's march and cavity wrapped: `lightRelief`'s new `tile`). 512 texels a side; its
  scale is part of its family, and unset it is painted at the metres the kit lays it at. `stone-brick` is untouched.
- **Pillars, never coursed.** A stage recipe (and a geocube's `surfaces.pillar`) names its pillars' own surface: the
  pilasters and the engaged columns' shafts, which otherwise draw in the kit's trim. Group `stage:pillar`; the trim's
  laying, cells and value band; the grime and the nave's moss as on trim; the column's base block and abacus stay trim.
  A pillar is a shaft, never stacked like a wall: dressed stone's `cut` is `fluted` (vertical channels between narrow
  fillets, `flutes` a repeat, the arrises nicked here and there) or `shaft` (a plain monolith, its grain up it), both
  weathered in streaks running down and lit from the upper left so a flute is found. Laid upright: on an engaged column
  the flutes stand up the shaft. A dressed family draws two variants, not four (every block is its own stone already),
  halving its bytes. Without a pillar surface a room is byte for byte as it was.
- **Floors, paths and baseboards.** Dressed stone's `face: 'floor'`: lit from nearly overhead (a floor has no up), each
  slab dished a little where it is walked and polished on its crests, the dirt in its joints. A floor laid a tile a bay
  is painted at the bay's metres. Two more surfaces of their own, as the pillars are: the `plinth` (the baseboard along
  the walls' feet, in the trim's laying; a course of long blocks with no bed joint across it) and the `path` (the nave's
  runner, in the floor's laying, still floor to the tone and the dirt). A geocube's `surfaces.plinth` reaches the room.
  Without them a room is byte for byte as it was.
- **A gritty cube dresses its room.** At `grit` from `GRIT_PIXELS` (the island's own threshold, now in
  `matte-paint/fabric.js`), a geocube's room is dressed as its outside's rock is drawn near: the wall's stock
  stone-brick becomes ashlar and the floor's flagstone worn slabs, in the colours they named; the pillars fluted and the
  plinth a course of long blocks unless the cube names its own; grit sets how much is broken, pitted and worn (a rock
  face from 0.85). Its tone's `detail` rises with grit (0.45 + 0.45 × grit), so the stone's own light and dark read
  through the ramps. A surface named in another generator is kept; a quiet cube's room is as it was. `limestone-crags`
  is the first.

### Forest: hollow crowns, clumps arranged, the hero near and the stock far

A gritty crown no longer builds the parts of itself buried inside its other lobes or its neighbours'. A forest's trees
can stand in arranged clumps, tallest at the back and open toward the trail, and be built by how near the trail they
are: whole close by, stamped from a few templates further off, a cheap shell far away.

- Every gritty crown is hollowed (`era/isekai.js` `hollowed`): a lobe face whose corners all lie inside another lobe,
  its own tree's or a neighbour's, is not built, tested against that lobe's own facets. Crown faces fall by about a
  quarter on a meadow and two fifths in a grove; nothing seen changes. An emission change for every gritty land.
- Clumps arranged (`trees.compose: 'ikebana'`, `era/nature.js` `arrangedClump`): an odd count of trees, the tallest at
  the back away from the trail, the next two stepping 0.75 and 0.56 of it out to the sides, fillers lower round the
  back, the trail's side left open; neighbouring clumps alternate hands.
- Trees banded by the trail (`trees.bands`, `treeBands`): within `hero` m of the trail's edge (and the named hero)
  built whole; to `far` m stamped from a few templates as the page's instanced repeats, each template built off the map
  through the same light, lock and detail and lifted out, a shade tint where the sun misses its crown, casting as its
  shell; past `far` a shell, each crown mass one coarse lumped blob, no leaf cards.
- A `forest` biocube preset (era/biocube.js) turns both on: denser, taller clumps.
- Leaf chips (`era/leaf-chips.js`): a crown as its masses' dark core with rounded cupped chips over it, each low, mid
  or high in the foliage ramp by the clump's light and the sun's reach; a gallery spike
  (`scripts/spikes/geotown/chips.mjs`) settles their count, size and cup.
- Every gritty land's trees are chipped (`era/isekai.js`): a blob crown's masses its core, hollowed across the clump,
  casting the crown's shadow and drawn in its two darkest stops by the sun; the chips over it lit by the stage's own
  sun and shadow, those buried in a neighbouring core left out; leaf cards only on bushes now. With the bands, the hero
  and the stock templates are chipped and a far tree is its core alone. The horizon's clumps keep two flat stops (the
  gritty leaf texture on crowns is retired). Quiet lands' crowns stay the sixth-gen balls, byte for byte.
- The page draws a repeat whose template is wholly textured (it was dropped), and a texture only a repeat's template
  uses is resolved (`scene-three.js`, `worlds/world-scene.js`).

### Rock ground: bare rock and scree drawn, and what grows on them

A cube that names its rock now draws its bare rock and its scree as rock: a limestone cube's pavement in its stone,
jointed, its scree in loose stones, each meeting the turf in a curve. Lichen crusts the rock, cushion plants and
stonecrop root in its joints, small ferns in the shaded ones. The gap report ranks what is missing by how much of a
level its ground covers. A cube that names no rock is drawn as before.

- A land whose shading names a formation (`skin`: limestone, flagstone, sandstone) draws its ground by it
  (`era/isekai.js` `formationGround`): limestone's and flagstone's turned bedrock as pavement (`isekai:pavement`) in the
  rock's colour, the talus apron as loose stone (`isekai:talus`) in the rock's leaned to the soil, each line with the
  turf cut through the cells where its field crosses. No grass on either. `limestone-crags` is the first.
- Gritty, the pavement is laid with the new `karst` cut: clints in courses parted by deep grikes, some only cracks,
  weathered rough, the odd pan and crack (`matte-paint/karst.js` the joints); the talus with the `scree` cut, angular
  stones lying over one another.
- The rock flora (`era/rock-flora.js`): `lichen-crust` (crusts on the clints, the boulders' and stones' caps and the
  talus, grey-green or gold), `cushion-plant` (flowering domes), `stonecrop` (mats of fleshy rosettes), `crevice-fern`
  (in the shaded joints), in the kit's own ramps. The clumps root in the joints the karst tile draws: the placer reads
  the same joints (`gritty-flora.js` `pavementJoints`).
- Scree in variety (`matte-paint/dressed.js` `SCREE_FORMS`): blocks, plates, cobbles and rubble, by the rock
  (`gritty-flora.js` `TALUS_CUTS`: limestone in blocks, flagstone in plates, sandstone in cobbles), and coarse patches
  of rubble (`isekai:rubble`) wandering through a talus.
- A gritty talus's edge is its stones thinning out (`isekai.js` `TALUS_EDGE`): within a metre either side of its line
  the ground is turf and over it a cutout of the scree's own tile keeps fewer of its stones band by band
  (`era/scree-tiles.js`, whole stones, shaded as the scree is), from nearly all inside to a few strays out on the grass.
  Where a trail's verge runs beside a talus, the verge's outer bands carry the scree the same way instead of turf
  (`trail-dress.js` `screeBands`); the stage's own trails keep clear of a talus today.
- The gap report weighs each gap by the ground it would cover (`measuredShares`, over the cube presets' stage land) and
  shows the shares and scores; bedrock's cover and clump and scree's cover are no longer empty.

### Sand: the ground drawn as sand, and what lies on it

Where a level's ground is sand, the stage now draws sand there, in the cube's own sand colour, with no grass on it and
wind ripples on a gritty cube. A new library of what lies on sand (shells, driftwood, sea pebbles) and a dune grass
fill the gap report's sand row. A land with no sand is drawn as before.

- A sandstone cube's flats are sand on its stage (`era/substrate.js` `turnField`, the formation's turn as a field): the
  line between sand and turf is cut through the land's cells where the field crosses, not along the grid; no tufts,
  field or live grass stand on it. A gritty land lays it with the new `sand` cut (`matte-paint/dressed.js`): wind
  ripples wandering across fine grain, a bright fleck here and there.
- The strand (`era/strand.js`): `shells`, `driftwood` and `sea-pebbles`, each a row and a builder of small faces in the
  kit's own ramps (a shell the sand's light end or, a mussel, the rock's dark; driftwood the rock's light end bleached
  toward the sand; a pebble the rock's). Shells only where a shore says the tide reaches.
- `marram` joins the grasses (`vegetation/grass.js`): stiff grey-green tufts with a pale spike.
- Inland sand is dressed: pebbles in drifts, driftwood now and then, marram in sparse clumps in the kit's grass leaned
  to its sand. A gritty island's beach takes shells along its tide line, driftwood and pebbles above it, and its line
  with the turf is cut through the cells at the beach's height (`cutFace`) rather than stepping round them. The sand cut
  is laid in one variant, so its ripples run on across the faces.
- The gap report reads the strand and the ground cuts (`strand:`, `cut:` refs); the sand's cover is no longer empty.

### The substrate map and the flora gap report

The geocube now says what its ground is (bedrock, scree, soil, sand, wet ground, the path), cell by cell, from what
its land already knows and its rock's formation; and a generated report sets the flora library against what belongs on
each, so its gaps are named. Nothing drawn changes yet.

- **The substrate map** (`era/substrate.js` `substrateMap`, `era/substrate-of.js` `substrateOf(manifest)` for a stage
  recipe). Every land cell is one of `SUBSTRATES` (bedrock, scree, soil, sand, wet, path), by rules in order: the trail
  and its fringe are path; within a stream's reach the ground is wet; a face past the land's rock slope is bedrock;
  the talus apron is scree; the rest soil, which the formation turns in patches (`FORMATION_TURNS`: limestone to bare
  pavement, sandstone's flats to sand, flagstone's slabs through the turf). A geocube's street reads out its ground's
  shares (`geocube.substrate`).
- **What belongs where** (`era/substrate-flora.js`). `SUBSTRATE_FLORA`: per substrate, per role (cover, clump,
  accent, interspacing, canopy) the kinds that belong there and the climates they suit, each a ref into the library
  (read off its own registries: grasses, wildflowers, species, the flora forms, the trail's patches and stones) or a
  wanted kind not yet built (`WANTS`, each with its read). `floraGaps()` ranks the wanted kinds by the ground and
  climates each opens and the empty slots it fills.
- **The gap report**: [docs/flora-gaps.md](../docs/flora-gaps.md), generated by `npm run flora-gaps`
  (`scripts/flora-gaps.mjs`), kept current by a test. The spike `scripts/spikes/geotown/substrate.mjs` draws a stage's
  ground from above in its substrates' colours.

### Trail dress: rubble at the edge, patches on the dirt, and paved trails

A gritty dirt trail is strewn at its edges with the mountain's rubble and worn in patches along it, in its own colours.
A trail can also be paved, in the same material words the town's streets are dressed in. A quiet trail is drawn as
before.

- **The dress** (`era/trail-dress.js`, a stage's `trail`, the geocube kind's `path` for the trail a street lies on):
  `surface` a ground word, `rubble` and `patches`, read and refused by name in the trail grammar.
- **Rubble at the edge** (`local-meru/broken-land.js` `strewEdge`). The stones a gritty island strews on its boulders'
  tops and at its cliffs' feet, heaped in clumps along both sides of a dirt trail: thickest at its edge, thinning out
  across the fringe onto the land, a few smaller ones in on the trail, as many as the grit says. None on ground a town
  has claimed. `rubble: false` for none.
- **Patches** (`trailPatches`). Blobs on a gritty dirt trail, laid on its ribbon's own heights a hair over it, each
  the trail's colour a shade off with a relief of its own, feathered at its edge into the trail's colour: `worn` (lighter, packed smooth), `damp` (darker, smooth),
  `gravel` (stones close in a bed of grit: a new `gravel` cut in `matte-paint/dressed.js`), `crown` (a strip of turf
  down the middle, the cart track's), `puddle` (a darker core with no relief in a damp ring). The default is worn, damp
  and gravel; `patches` names the kinds, `false` none.
- **The edge blended** (gritty dirt). The trail met its verge on a ruled line, a step in colour along it. Now the verge
  lanes start in the trail's own colour at its edge and fade to the land's across their width (`verged`), and the
  trail's dirt spills over the edge (`edgeSpill`): blobs of its own colour and path relief straddling the edge every
  metre or so a side, reaching out over the verge, each feathered to what lies under its rim, so the edge is ragged.
- **Paved trails.** `surface`: the dirt (`earth`) by default; the outdoor ones laid in the dirt, `stone-road` (field
  stones with earth between them: the rooms' rubble floor, `art-direction.js` RUBBLE's `stone-brick` bond) and `gravel`;
  and the made ones, `flags`, `setts`, `pavement`, `asphalt` and `brick-paving` (the rooms' herringbone floor brick,
  BRICK_FLOOR's bond). `stone-road`, `brick-paving` and `gravel` are ground words added to `MATERIAL_WORDS`. A paved
  trail's lanes lean to its word's colour (a stone word without one to the kit's rock), on a gritty land laid with its
  word's tile for the path's, one tile across the lanes so its joints run on (`matte-paint/detail.js` lays a
  `stone-brick` spec as a detail, painted in greys under the word's colour; `landscape/surface-textures.js`
  `bondedBrickTile` its texels). A made one keeps its own edge: its fringe turf to its edge, with no rubble, patches or
  pebbles. An outdoor one leans part of the way and keeps the dirt trail's edge (the verge from the dirt, a narrower
  spill, the rubble beside it and more of it in on its border), and its border has sand worked into it (`sandBands`):
  seven bands along each edge over a metre, each a cutout of the road's own tile (`era/sand-tiles.js`: a share of its
  cracks in broken runs, then all of them, then broken patches over the stones), the sand coming in a crack at a time
  from furthest in to mostly sand at the edge, so the road reads its whole width and shows through beneath the sand
  with no line where the sand begins.
- **The verge's outer edge** (any gritty trail in the dirt), done the same way (`turfBands`): seven bands of the land's
  own turf tile cut to its blades, a share of them furthest in on the verge, then all, then patches of sward, a little
  past the edge onto the land, in the land's colour, so the verge meets the land with no line.
- The geocube vocab card names the glazings (arabesque, ornamental, stained) and the trail's dress. Tests:
  `trail-dress.test.js`. The study spike `scripts/spikes/geotown/trail.mjs` frames one stretch of a stage trail on a
  cube, per dress.

### Window glazing: stained glass, ornament and arabesque, by the style

A style's lights took one of five glazings (diamond lattice, sash, casement, plate, none). Three more now, each tied to
the style that speaks it: an arabesque star screen from the in-house pattern library, leaded ornament, and stained
glass in the style's own colours.

- **Arabesque** (`moorish-medina`). A screen of the khatam star field (octagons and their gap squares,
  `polygonizer/arabesque.js` at its own contact angles) over the glass. Drawn as bars, a screen is hundreds a light, past
  a house's whole triangle budget, so the budget sent it into the tile, which the town stage never draws. It is one
  cutout card a light instead (`era/screen-tiles.js`: the field painted white on clear, one cell a tile, the card's own
  trim colour multiplying it), carried beside the house's faces (`speak`'s `screens`) and stood by the town stage as
  `town:screen`. A screen whose light went into the tile goes with it. Renderers that draw no textures leave the glass
  clear.
- **Ornamental** (`art-deco`). Leading: a border a hand in, a roundel at the head (an arch's spring, three quarters up a
  square light), a sunburst of rays from it to the border, and two uprights under it, darker than the frame.
- **Stained** (the new `gothic-parish` starter: coursed stone, a steep slate roof, tall arched lights). Panes behind
  the lattice's cames, cut to the light's clear, each on the paint's ramp or the lens's by its ring out from the light's
  heart, its value its own. A tall light's diamonds are sized up to it (some three dozen panes a light, a hand at
  least). The style's surfaces take the paint the panes use. The house budget sheds panes after cames, so a light keeps
  its colour longest.
- The glazing rail names all eight; the existing five glazings are unchanged. Tests: `out-openings.test.js`. The close
  spike (`scripts/spikes/geotown/close.mjs`) frames the front light square on.

### Gritty flora: the cube's grit draws what grows in detail

A geocube's grit already says how finely its rooms, streets and rock are drawn; the biocube says what grows. Grit now
reaches the flora too: on a gritty cube the crowns, the trunks, the path and its edge, the grass's light and the
clouds take detail in the cube's own colours, stronger with more grit. A quiet cube is drawn as before.

- **Leaves and bark** (`era/gritty-flora.js`). On a gritty polygon land the crowns take the `leaves` cut (leaves over
  one another, now gathered into masses that read from afar, thin and dark between them), a crown's top laid as a
  floor and its sides as a wall, and the trunks take `bark` up them: grey relief over each face's own colour
  (`matte-paint/detail.js` layDetail), its strength the land's grit.
- **The path and its edge.** The trail takes a new `path` cut (packed earth, crumbs, faceted stones pressed into it,
  worn hollows), the ground and its talus `turf`, and the trail's fringe lanes a new `verge` cut laid across the lane:
  earth and stones at the path's side giving way to turf at the land's, so path and land meet in a band, not a line
  (`withGrittyGround`). A town's street keeps its own edge, its kerbs and walks: the land wholly under its paving goes
  with the trail under it (`stage-buildings.js`), so no blend runs under the street; the trail beyond the town blends as
  before. The same band laid across a walk is the shape a later street wear would take (water at the kerb, rubble at
  a derelict wall's foot).
- **The grass's light.** A gritty land's live grass takes the material light (its ramp read smooth, not banded), the
  roots darker and the light through the blades stronger as the grit rises (`ao` 0.6 to 0.3, `back` 0.6 to 1); no dry
  tips, a hue the cube's ramps do not hold.
- **Crowns in lobes, not domes.** A gritty land's crown masses are each three overlapping lobes, every vertex pushed by
  a lumpy noise (more with grit), so a crown's outline breaks into clumps, and a face's tint darkens by how deep in
  the crown it lies: the dark core between the clumps, in the foliage ramp's own stops.
- **Leaf cards on the crowns' outline.** A gritty cube's look carries the leaf card's tile on its own foliage ramp, and
  its land stands the kit's leaf cards out of each crown mass (as the realistic pole does), each its band's tile drawn
  hi-def in the foliage's stops: a crown's edge is leaves, not a dome's curve.
- **Bushes the same.** A gritty land's bushes are lumped about their own middles as a crown's lobes are and stand leaf
  cards like a crown's mass. (The lobes are coarse, twenty facets: the cards carry the outline; a gritty grove town is
  about 64,000 faces against a quiet one's 50,000.)
- **The clouds, heaped.** A gritty land's cumulus cards are drawn hi-def (`era/isekai-tiles.js`, a key's `+hd`): the
  kit's own drawing in its own stops, smoothed and painted at twice the size, each texel between its two nearest
  stops, the cutout's edge kept whole, and its outline broken further (small heads on the heads, wisps pulling off the
  upper edge, the base's line bumped; the big shape the same). Each cloud is a heap of three cards, two smaller set
  behind it and to a side, one mirrored, so it has depth and shifts as the eye moves.

### The biocube: a level's flora as data

A geocube holds a level's one look; what grows there was each kit card's own numbers. A biocube holds it as data, a
sibling of the geocube: which trees, in what clusters, how dense the grass, which shrubs and flowers, in the kit's own
vocabulary so a stage reads it by merging. Fauna later.

- **The card** (`era/biocube.js`). `flora`: `trees` (`clusters` groves of `perCluster` trees `spread` metres round,
  their `heights`, clear of the trail and the cliff, a `crown`, a `hero` or none), `grass` (tussock `clusters` of
  `perCluster` tufts, a `scatter` share, the fringe's `fringeEvery`, its `height`, its `kinds` by place from
  `vegetation/grass.js` GRASSES, the `field` of blades along the trail) or null, `shrubs` (the recipe's own
  `{ count, bloom, fruit }`) and `flowers` (`{ share, mix }` of `vegetation/wildflowers.js`): the kit card's own keys.
  Presets `meadow` (the meadow card's own numbers: a meadow stage given it is byte for byte as without), `upland`,
  `grove`, `bare`; `{ from, …changes }` block by block, every value on its rail and told when it is off.
- **A stage grows it** (`era/isekai.js`, a stage's `biocube`): its trees and grass laid over the card's, its bushes
  when the recipe names none, its flowers in the live grass. On a polygon land the grass is the biocube's: the island
  grows none, a biocube brings back the tufts and the field (the lips' and hats' fringes stay off).
- **A geocube's street takes one** (the geocube kind's `biocube`, `show: 'town'` or a domain's street).
- **A cube carries its own** (a geocube's `biocube`, checked when the cube is read): its streets' flora (`show:
  'town'`, a domain's street, a recipe's `geocube` with a `trail` in the cube's kit) unless the recipe names another.
  `valley-morning` grows a meadow, `upland-morning` and `limestone-crags` an upland, `jungle-haze` a grove; a cube with
  none grows nothing on its streets' land, as its island.
- **Its grass a carpet by default.** A biocube's grass names its live carpet (`grass.live`: `{ kind, density /m²,
  height }`, the card's `live`; null for none), and a stage whose biocube grows grass lays it wherever the grass grows,
  as a recipe's `wind` or `grass` did: blades on every grassable cell round the walker, not tufts in clusters with the
  ground between them. On a polygon land the grass brings back what the island has none of: a big boulder's hat (its
  top the ground's, a fringe draped over its rim) and the cliff lips' fringes.
- **Nothing grows on a path.** The trail's fringe tufts stand off it across the trail, not along x, so a slanting
  stretch keeps them off as a straight one does, and no tuft roots within a hand of it (`nature.js` `grassTufts`: the
  nature kit's fringe too). The carpet grows only in cells wholly clear of the trail (a cell's tufts stand anywhere in
  it). A town's street clears what stands on its own paving, its door paths among it, tufts and carpet cells alike.
- The inventory it was drawn from, and the overlaps left to settle (tree clustering said four ways, grass density
  five), are the plan's; a cube's own default biocube and the nature kit come next.

### The land drawn as the island's: a cube's town and trail stand on its island's terrain

A geocube's island draws its land as polygons lit by the cube's land rules, and a gritty one draws its rock's own
formation on its cliffs; the land under its towns and trails was still the isekai kit's pixel-locked tiles and grass
cards. It is now drawn the island's way, by the island's own functions.

- **The polygon land on an isekai stage** (`era/isekai.js`, a stage's `shading`: the same object the local meru reads,
  `local-meru/plan.js` `readShading`, now exported). No tiles on the land: cliffs and boulders baked flat per facet, the
  ground, the talus and the trail smooth at each corner, then the land's rules (`local-meru/shading.js`: crevice,
  ridge, blend, mix). No grass on it (no tufts, no field, no fringe, no hats, no trail blend, no live grass). A gritty
  land (`grit` from `GRIT_PIXELS`) breaks its boulders and its cliffs' rims and strews stones
  (`local-meru/broken-land.js`), and the page draws its rock's fabric near the eye: the site's own strata and joints,
  the land's `skin` (a formation: beds worn back, overhangs, fallen slabs) and `rocks`. Absent, a stage is byte for
  byte as it was.
- **A geocube's town and trail carry it.** `show: 'town'`, a domain's street and a recipe's `geocube` with a `trail`
  pass the cube's land shading (its outside's `land`, as its island takes it), so every cube's street stands on its
  island's terrain: a quiet cube's ground smooth and green, a gritty one's crags in their formation. Their grass is
  gone with it, to come back with the flora. The trees and the clouds are the kit's, as before.
- **Parked for the flora:** the matte painter's natural cuts, `turf`, `leaves` and `bark` (`matte-paint/dressed.js`,
  on the dressed tile's rails), grey relief tiles to lay over the ground, a crown and a trunk. Nothing lays them yet.
- **Valley and facet on the stage.** The land's `valley` (a corner darkened by the sky the land round it takes) and
  `facet` (the rock drawn toward planes, on the faces' own heights, the ground round it and the land the rest is placed
  on unmoved) now reach a stage's polygon land too: the island's `valleyOf` and `planarise`, moved unchanged into
  `local-meru/land-form.js` (the island imports them from there, byte for byte as before).
- **A gritty land's shadows at a third of the cost.** A broken boulder casts its unbroken shape's shadow (drawn in by an
  eighth, so no chip lies inside it) and the strewn stones cast none: a gritty meadow stage assembles in about 4 s, not
  11. Its rock is drawn and lit as before.
- **The micro-town's `trail` camera** (`show: 'town'`): on the trail's open stretch short of the street, at a person's
  eye, looking along it toward the town, so the trail's edges into the land and the rocks beside it are seen.

### Geotown structures: doors and windows, the street, the square, the gates

The geotown's buildings up close, and the town round them: its openings as architecture rather than marks on a wall.

- **Openings as architecture** (`era/out-openings.js`). New params on the building language's `light` and `door`
  elements, held by the street and refused off their rails by name; absent, every town is as it was, byte for byte.
  A light's `frame` stands a surround proud of the wall with its returns as the reveal, the glass set back in it;
  its `glazing` lays bars over the glass (`lattice`, leaded diamonds; `sash`, two sashes of small panes with a meeting
  rail; `casement`, a mullion and a transom; `plate`, one pane), in its `trim` (a surface group, `trimValue` its
  value). A door's `leaf` is `boards`, `panels` (raised, in two columns) or `glazed` (its upper half glass); its
  `surround` a `frame`, `pilasters` and an entablature, or a `hood` on brackets; its `fanlight` a glazed transom
  (`rect`) or a half-round over the head with radial bars (`arch`); its `steps` up to the threshold, and the stage
  raises the house's floor to meet them. Shutters take a `form` (`boards`, `louvred`) and stand out of the wall. They
  are a detail's depth (the near ring); over the ring's triangle budget the dressing off the lane face goes into the
  tile first, then the language's own ornaments, then the lane face's dressing. The style starters take them by period
  and place (sashes and a fanlight between pilasters for the Georgian terrace, leaded lattices for the Tudor town and
  the medina, white casements for the Nordic harbour, plate glass in deep reveals under a hood for the Brutalist), and
  the style's `surfaces-built` law counts a built light's trim as a surface its palette may name.
- **The street through the town** (`era/stage-street.js`; a stage town's `street: true`, which every geocube town
  takes). The stretch of trail between a town's first and last house is laid as its language's lane: the anchor's own
  section (the road in its paving, the edge in its walk's form: a kerb set on end, a flush channel, a boardwalk's
  fascia, a verge; the walk at its lift) on both sides, draped on the land along the trail; its lamps at their stride,
  the head reaching over the road, their glass warm; posts along a flush walk; a path of slabs from the walk to each
  door. The houses are seated to front it: a seat every metre and a half along it either side, just behind the
  footway, facing it, the seats nearest the town's heart first; a house left no free frontage is not built rather
  than stacked on another (before, a town's houses scattered over the land, one up a hill, and could stand in one
  another). The planning pass reserves the street's ground, so nothing grows on it; its trail and growth are cleared.
  On a gritty cube its setts, flags and slabs are laid from relief (era/town-dress.js `street:*`), a style's `road`
  and `walk` words over them. The micro-town's `house` camera stands on the road before the first house, its
  `street` camera on that house's walk looking down it. A stage town that does not ask for its street is as it was.

### Architectural style: the model composes a town's and a city's look, on the cube's materials

A town or a city is not one style: a STYLE says what a place's builders build, and the town, the city and their dress
follow from it. The buildings' design stays the model's: a style composes the building language's elements and the
material words, and starters are examples on the rails, never the limit.

- **The style card** (`era/arch-style.js`). A style is a starter's id, a document, or `{ from: <starter>, …changes }`:
  its `read`, its `class` (ancient or modern), its `language` (an anchor's id, its own elements, or `{ from: <anchor>,
  elements: { <id>: element | null }, … }` that changes or drops the anchor's elements), its `materials` (a word per
  surface), its `palette` (a colour per surface, over its word's own) and its `city` (a city grammar's changes, its `grain` the
  grammar it starts from). Every refusal names the rail and the words it allows.
- **Material words** (`MATERIAL_WORDS`), each of a class and for a surface: ancient limewash, lime render, ashlar,
  rubble, hand-made brick, adobe, boards, shingle, thatch, flags, setts, earth; modern wire-cut brick, stucco, sawn
  stone, precast, concrete, glass, pavement, asphalt; clay tile and slate built in both. A word is a dressed tile (on a
  gritty cube) and a colour of its own: a lit town face keeps its luminance (the cube's light and the value its language
  gave it) and leans its hue to the word's (`leanHue`, era/town-dress.js; a pale face that would clip gives up chroma,
  not light), a city's frame leans as a modern material's does; a quiet cube's street and city take the colours without
  the relief. What a style does not name keeps the cube's own dress.
- **Starters** (`STYLE_STARTERS`) across periods and places (a whitewashed island village, a Tudor market town, a
  Georgian terrace, an adobe pueblo, a Nordic timber harbour, a Moorish medina, Beaux-Arts, Art Deco, Brutalist), each a
  recipe to take `{ from, …changes }`; each keeps its own laws.
- **Laws that advise** (`styleLaws`, never refusing): the class against the materials, the cover against the pitch,
  the value order (wall over roof over opening; a flat roof is not seen), materials that name a surface the language
  never builds; written back on the specimen (`geocube.style`) as `{ law, ok, value }`.
- **Wired in.** A settlement's `style`, a cube's `buildings.style` (a settlement's over the cube's; at each level an
  `anchor` named beside a style speaks over its language), the micro-town's and the micro-city's `style` (over the
  settlement's anchor), and a city paint's `style` (city/plan/look.js; its class the materials' unless the paint names
  them). The town speaks the style's language in its street and its houses (a stage town's language written as elements
  now reaches its houses and their insides too, not only its street) and wears its words; a program on a styled cube
  speaks its style's language. The city's grammar is the style's language at its `grain` with its changes over it
  (`styleGrammar`): an ancient city raises no curtain walls and no towers and stands no taller than Haussmann's Paris,
  a flat-capped language raises no roofs; its walls and ground are dressed in its words (a rhythm takes a word or a
  list, each building picking one by its dice; glass leaves a building as drawn). Absent a style, as it was, byte for
  byte.

### Geocube town materials: a cube's town and city painted from relief, at its hours

The island's know-how carried to the cube's architecture: its micro-town and micro-city seen at eye height, lit at its
hours under its clouds, and a gritty cube's street painted from relief as its rock is.

- **Seen for the architecture.** The micro-town's first cameras are a person's eye nine metres before its first house's
  front (`house`) and down the street to the rest at their own floors (`street`); the micro-city's, a person's eye on its
  sidewalk a step and a half out from the block, looking down its first side (`sidewalk`). The trail's and the city's
  own cameras follow.
- **The city at the cube's hours.** The micro-city takes `hour` (its domain's unless it names one) and `clouds`, and the
  city kind's `paint` takes them too (`paint: { geocube, amount?, hour?, clouds? }`, city/plan/look.js `cubeLookSpec`):
  the cube's reference card relit at that hour (its sun on the hour's arc, weakened by the hour's gain; past dusk none,
  so the moon lights it and its windows and signs are lit, city/plan/night.js), its dome, ambient and air the hour's, its
  stars out and its moon on the dome by night, its clouds painted round it. The hour's light and air under clouds are one
  function for the land and the city (era/geocube-hours.js `hourAir`). A micro-city refuses the live `weather` (its sky is
  its clouds). A paint without an hour or clouds lights the city as before.
- **Lime render over stone** (`matte-paint/dressed.js` `cut: 'render'`, on the tile rails with `render`, its coat's
  colour, and `loss`). The Dust map: the ashlar laid as ever, a smooth coat proud of it, trowelled in soft swells,
  blotched with damp and streaked by the weather from above, fallen away in broad patches wider than tall (their edges
  broken finer) to the coursed blocks behind; each patch's lip thins and breaks and casts its shadow onto the stone, and
  the stone in the hollow is dirtier for having been under the coat. The ashlar's own paint was factored out to share
  with it, byte for byte. Its noise slides each octave's lattice by whole cells of its own (still periodic): thresholded
  hard, the shared lattice showed every patch at the repeat's origin.
- **A gritty cube's street dressed** (`era/town-dress.js`). At `grit` from `GRIT_PIXELS`, a cube's street (`geocubeTown`)
  carries a `dress`: its plaster walls the lime render (a 3 m repeat, loss from its grit), its stone walls ashlar
  (rock-faced from 0.85), its plinths and stoops a course of long blocks, in the cube's stone and floor colours. A stage
  town's `dress` lays each on the walls, gables, socles, quoins, sills and plinths of its standing houses and of the
  buildings walked into (era/stage-buildings.js), as a DETAIL: the painted tile divided by its own mean in linear light
  and set to 0.8, the face's own colour and baked light lifted by the inverse (the page multiplies them, `textureLit`),
  so each wall keeps the cube's paint and the sun, and the stone's relief, its patches and joints ride on them; laid
  world-locked (u along the wall, v up it, a metre a metre), its two variants by where the wall stands, served by a
  `detail:` texture resolver painted once a spec. Openings, frames, doors and roofs are as they were. `limestone-crags`'s
  harbour is built in the timber hall's language (a coursed stone ground storey, lime render above, tile over it): its
  houses are what its grit dresses. A quiet cube's street, and any town without a dress, is as it was.
- **Roofs in courses, timber in boards** (`matte-paint/dressed.js` `cut: 'tile' | 'slate' | 'boards'`; the rails' `rows`
  to 16 and `cols` to 12). Tiles in courses, each course's lower edge ragged a little and lapping proud over the one
  below so its shadow falls down the slope, each tile rolled across like a pantile, its tone its own, the weather darker
  toward each course's exposed foot and lichen a fine speckle gathered there at grit (a broad thresholded blotch read as
  camouflage); slates the same, thin, flat, half-bonded and each laid a little askew; boards upright with gaps between
  them, a cupped face, a grain in fine ridges up each, knots and the weather streaked down. A gritty cube's street dress
  lays its tile, slate and shingle roofs (u along the eave, v up the slope: a rise over the pitch's sine) and its timber
  walls, frames and trims (the tiered houses' boards) the same way; a flat roof is not laid. Thatch is as it was.
- **Two classes of built material** (`matte-paint/dressed.js`, `city/plan/dress.js`). ANCIENT, hand-worked and
  lime-bound, worn by loss, spalling and lichen (the render over stone, tooled ashlar, clay tile, slate, boards, flags,
  and `setts`, a road of small stones in courses, crowned and worn smooth, set in sand); MODERN, machine-made and
  cement-bound, worn by the weather and never by loss (`brick`, wire-cut in an exact stretcher bond with thin struck
  joints, a burnt brick now and then, a white bloom low at grit; `concrete`, board-formed in form panels, the boards'
  grain pressed in, the panels' joints standing as fins, tie holes in rows and a streak run down below each, bug holes;
  `precast`, chamfered panels with dark sealant joints and the dirt washed down from each; `stucco`, a floated coat with
  a control joint, hairline cracks and a soft repaint; sawn stone, ashlar with hairline joints and no chips; `pavement`,
  a sidewalk scored into slabs with a broom finish, a straight crack across a slab or two and round stains; `asphalt`,
  aggregate in its binder, squares of repair, cracks sealed in tar, oil). A town builds ancient; a city builds modern
  unless its paint says `materials: 'ancient'` (the micro-city takes `materials`). In a modern city each rhythm offers
  its materials (punched: brick or stucco; pier: sawn stone or precast; banded: precast or board-formed concrete) and
  each building takes one by its own dice (its card's frame, body, floors and bays), so a street mixes them; a modern
  material keeps its own colour (a brick red, concrete grey), the cube's tint kept a third; the roads are asphalt (or
  setts, ancient). The dice cells snap to the repeat (a cell that did not divide it left a seam), and a crack ends at
  its slab's joint.
- **One place asks whether a cube is gritty** (`matte-paint/fabric.js` `grittyOf`, beside `GRIT_PIXELS`): its room,
  its town's and city's dress and a style's words read it, instead of each its own threshold. Byte for byte as before.
- **The resampler: painted tiles that do not repeat at scale** (`scene/channels/resample.js`, `matte-paint/detail.js`
  `resamplePlan`). No AI and no new texels: the page reads a detail tile again at seeded shifts as it draws it, by a plan
  read off how the tile was built. Coursed work (ashlar, brick, setts, tile, slate) in bands a few courses deep, each
  read at its own shift down by whole bond periods (so every cut falls on a bed joint and an exact bond holds across it)
  and along by whole units (or any amount where the head joints are free); boards in upright strips shifted by whole
  boards; a grid (slabs, panels) in cells of whole units shifted both ways; free work (a render, stucco, asphalt) as
  three readings at seeded shifts blended on a hexagonal grid, sharpened, the blend's contrast held round the detail's
  known mean so it neither repeats nor washes out (a render's readings shift down by whole courses, so the stone under
  its coat runs on across a blend). Over all of it a broad wash of tone, so a street is not one swatch. Every reading
  takes its gradients from the unshifted uv (no mip seam at a cut); the dice are an integer hash of the cell and the
  plan's seed. The world sends a plan for each detail tile a page draws (`payload.resample`); the patch replaces the map's
  read in those meshes' shader; a page with no plan emits nothing of it. Godot and Roblox tile the detail as painted.
- **The city's facades and sidewalks dressed** (`city/plan/dress.js`). A city painted by a gritty cube (its
  `paint.geocube`, the micro-city's always) is painted from relief as the cube's town is: the wall a facade's windows
  are cut through (a card's shirt in the `punched`, `pier` and `banded` rhythms) a lime render broken to the stone, ashlar,
  or a coat that has weathered rather than fallen; its sidewalks and plazas in worn slabs. A card carries its wall's
  `dress`, and the card realizer (`architecture/facade-card.js` `projectCardOntoQuad`) lays it on each facet of the shirt,
  world-locked in metres on the city's units, so a facade's piers and spandrels carry one stone; the windows' body
  behind, a curtain wall's glass and mullions, metal and the roads are as they were. The tiles a card names are served
  with the payload (a card's facets are realized on the page, after the scene's textures are gathered). The laying is one
  module for the town and the city (`matte-paint/detail.js`: the tile, its mean held, the face's paint lifted by it,
  world-locked as a wall, a roof or a floor); the town's bytes are as they were. A quiet cube's city, and a city no cube
  paints, is byte for byte as before. (The engines' marks now name the page's `fabric` input: absent in Godot and
  Roblox, the rock keeping its baked faces.)

### Geocube domains: one cube, many levels

A geocube made one level: its style fused with one room and one island. A cube is now its style (light, palette,
register, contrast, grit, surfaces, era, target, materials, principles) plus named ingredients (terrains, interiors,
structures, settlements), and its `domains` are its level configs, each a composition of those ingredients at an hour.
Expanding a domain lowers it into a level, in the cube's style. The cube offers its domains with a line each, and the
model picks the one that fits. A cube without domains lowers byte for byte as before.

- **Ingredients apart from the level** (`era/geocube.js`). A terrain in `outside.terrains` may now be a whole land of
  its own (`tiers`, `island` and `crystals` beside base, land, relief, ground and colour). The inside gains the same
  shape: `inside.interiors` are the cube's other rooms (`bones`, `size`, `accentWall`), its own named by
  `inside.interior` (`room` unless named). Terrains and interiors share one set of names.
- **Domains.** A cube's `domains: { <name>: { reads?, terrain? | interior?, hour? } }` are the levels it makes:
  outside on one of its terrains at an hour, or inside one of its interiors. A domain never touches the style: light,
  colour, palette and the rest refuse, with a pointer to `from` on the cube. A cube that names none offers one per
  terrain and one per interior, so `domain: { terrain: 'x' }` is `terrain: 'x'`, byte for byte.
- **Domain expansion.** `domain` on a `stage`, the `geocube` kind, a level and a world's style (`style.domain`, the
  level's own over the world's terrain and the other way round) asks for one: by name, as `{ from: <name>, …changes }`
  (a change of side takes the other side's ingredients with it), or composed from the cube's own ingredients.
  `pickDomain` answers as `pickTerrain` does: the level's ask, else the first domain on its heartbeat's terrain, else
  the cube's first, with what was offered and what was wanted. `expandGeocube` lowers the pick. A stage on an outside
  domain that names neither trail nor meru stands on the cube's island at the domain's hour (the stage's own hour
  wins); an inside one is the room. `painted`, the level's `paint` summary and the specimen's `geocube` payload name
  the domain; a specimen whose cube names more than its own room and land lists the levels it makes.
- **`limestone-crags` makes four levels** (`GEOCUBE_DOMAINS`, beside its buildings, so the preset's own document does
  not move): `crag-path` (its crags, a shrine on the top), `cove-dusk` (a sand cove under low crags, at dusk),
  `harbour-town` (a street up from the cove) and `temple-hall` (a tall nave).
  Every preset's room, land and dusk land, a stage on each and a painted level render byte for byte as before; the
  limestone specimen's payload gains its list of domains. Only the automated checks have run; none of them has been
  looked at.
- **Structures, the landmarks a domain raises.** A cube's `structures: { <name>: [<structure>…] }` are the landmarks
  its builders raise: a fractal structure's words each, standing `at` [x, y, z?] or `on: 'summit'` (the climb's top
  tier, `at` then an offset). A domain stands a set by name or lists its own (`structures`; an interior takes none).
  `geocubeStructures` paints them from the cube's ramps on the domain's terrain (body the stone, band the trim, crown
  the accent, plinth the floor; a structure's own palette over them, key by key) and lights them by the cube's key at
  the domain's hour. The structures channel raises them beside a recipe's own on a stage's climb or a specimen's land,
  never on a trail. `limestone-crags`'s `crag-path` stands a spire on its top. A domain without structures renders as
  before.
- **Settlements, the towns a domain walks through.** A cube's `settlements: { <name>: { town?, houses?, enter?, doors?,
  anchor? } }` are the towns its builders make: a town plan (`era/out-town.js`) and how much of its street stands and
  is walked into. A domain names one or writes its own (`settlement`; an interior takes none). `geocubeTown` makes it a
  stage's `town`, in the cube's builders' language (its buildings' anchor) unless it names its own, painted by the
  cube (Geocube micro worlds, below). A town
  domain standing alone walks a trail through its street (a town does not fit on the island); a level lays the street
  once, on the first trail it paints; a stage's own `town` wins. `limestone-crags` gains `harbour-town`, a street up
  from the cove.
- **A game expands its one cube.** A level on a cube that names its domains, asking for neither a domain nor a
  terrain, takes the first on its heartbeat's terrain, else the cube's first outside (a cube that names none paints by
  terrain, as before). `composeGameworld` lends the cube's outside domains to its walks, the ones the prompt's words
  name first (in the order they are said), then the rest in the cube's order, round again when the walks outnumber
  them; `brief.domains` records each level's domain and the word that chose it, and the world keeps one cube.
  `limestone` and `crag` now name `limestone-crags`.
- **Domain expansion, taught.** The geocube routing card names domains and `domain` and points to a new sketch-vocab
  card, `geocube` (`get_sketch_vocab({ id: 'geocube' })`): the style, the ingredients, the domains, the four doors
  and how to choose. No new tool.

### Geocube micro worlds: a town and a city up close

The trail's stand-in, walked through architecture: two more specimens on the geocube kind, each a tiny world that
builds in seconds, so a cube's town and city can be reviewed at eye height. Showcases, like the trail: no goal, no
hero, nothing to export.

- **`show: 'town'`, a micro-town** (`era/geocube.js`). A few houses of a town's street on a 12 s trail, in the
  domain's land and light (its terrain at its hour, `clouds`) and the cube's builders' language: the domain's
  settlement, else the cube's first, else `MICRO_TOWN` (the smallest town the rails allow, a hamlet on one lane, four
  houses standing, none entered). The dummy walks the trail's spine a point a metre at the ground's height, and at
  each house a spur out to a metre and a half before its door and back. `seed` lays the street; a town minted without
  one draws its own from its ref, as a trail does. `payload.geocube.town` names the settlement, its builders and how
  many houses stand. About four seconds to build.
- **`show: 'city'`, a micro-city** (`era/geocube-city.js`). A city plan on a 2 × 2 board (the smallest that makes
  blocks round a crossing) in the cube's builders' language (its domain's town's, else its buildings', on its base kit
  when that kit has structure rails, else the meadow's), painted by the cube, no cars, no people; a new city every
  mint. `hour` and `clouds` refuse: a city is lit by its cube's look. The city kind takes `route` (`ctx`): the sidewalk
  round the block nearest its core, in its units (`city/plan/pedestrians.js` `blockRing`); a city without it is as it
  was. The dummy walks it round at `1 / CITY_METERS_PER_UNIT` (`attachDummy`'s `scale`, opt-in: a trail's walker is
  as it was), a person's height among the city's buildings. Under a second warm.
- A domain with a town shown on its land is a street on a trail, so it raises no summit structures; nor do a
  micro-town or a micro-city.
- **The cube paints its architecture.** A geocube's look carries the cube's own made ramps beside its kit's, under
  names of their own (`cube-stone`, `cube-trim`, `cube-roof` from the floor, `cube-accent`), so nothing that names a
  kit's ramp moves. A stage's `town` takes `paint` (`era/stage-buildings.js`): its surface groups re-pointed at the
  kit's ramps, a ramp the kit lacks passed over; a cube's street (`geocubeTown`) re-points its timber and trim at the
  cube's trim, its roofs (tile, slate, shingle, thatch) at its floor, its shells at its stone and its painted things at
  its accent (`CUBE_STREET_PAINT`; plaster and stone walls were already the land's soil and rock, the cube's). Two cubes
  on one base kit now paint their houses apart. The micro-city leans its skins all the way to the cube
  (`paint.amount` 1); a game's city level still leans halfway. A street with no `paint` is as it was.
- Rendered headless (no page errors), not reviewed: the dummy walks the town's trail and its door spurs and stands a
  person's height on the city's sidewalk; the gothic town's houses stand in cold grey stone, the island's under
  terracotta, and the island city's facades lean to its stucco, their window bands still the glass's dark.

### Geocube trail: the cube's island, walked by a dummy

The first recipe expansion: a geocube shown one step further in. `show: 'land'` is where a cube's look is judged;
`show: 'trail'` is the same island laid fresh with every way up drawn and a plain stand-in figure walking it, where
the walk and the runtime cost are read. A showcase, not a level: no goal, no hero, nothing to export.

- **`show: 'trail'`** on the geocube kind (`era/geocube.js`): the island and its land as `land` lowers them, with
  every way up drawn (the island's `walk: 'all'` in place of the specimen's `'base'`), walkable from the seam. It takes
  `hour` and `clouds` as `land` does, and `seed`, which lays the island (its relief, ground and geology); the same seed
  gives the same bytes. `room` and `land` refuse a `seed` and emit the same bytes as before. With a `domain` (Geocube
  domains, above) it walks that domain's island: its terrain at its hour, its structures on the rolled top.
- **A new island every mint.** A trail minted without a seed takes one from its new ref (as a new house does), written
  into the recipe, so no two mints show the same island and the row re-renders byte for byte. The seed also rolls the
  way up (`local-meru/roll.js` `rollTiers`): the cube's own tiers, their forms, sides and ways up kept, each mound's
  height, foot, summit and bulge, each spiral's turns and hand and each tower's deck drawn in a band round the cube's
  own. A roll is kept only when it breaks no law the cube's own tiers keep (the steps, landings, shelves, a tier inside
  the top below); else the next, and after eight the cube's own.
- **The dummy** (`local-meru/dummy.js`). A trail is walked by a stand-in: the protoform in plain clothes, its colours
  greyed by their own light into a mannequin's, baked once and kept. It walks the island's route on the walkers
  channel, up to the top and back down to the seam, round and round. The route is laid on the land: each walked
  stretch every half metre at the ground's height, the flights and landings at their own (`local-meru/scene.js` emits
  it only when the geocube asks). The walkers channel takes `follow` on one walker (`scene/channels/walkers.js`): the
  orbit's target rides it and the camera moves with it, so the view still turns and zooms round it; a `follow` button
  lets it go, the walk takes the camera while it is on, and the chase is seated behind the walker again after. A still
  capture keeps its own camera. A world without `follow` emits the same bytes. The dummy adds about 4 MB to the page
  (the clothed bake). A climb is not posed yet: the dummy slides up the ladder in its walk; none of the cubes' trails
  has one.
- Planned: a readout, never a gate: the payload's counts (triangles, draw groups, textures and their bytes, page bytes)
  and, on the page while the dummy walks, frame time and draw calls. `room` and `land` emit the same bytes.

### Geocube hours: one cube at any hour, under a sky painted to match its ground

- **The hour** (`era/geocube-hours.js`). A geocube's outside takes an `hour`: a stage recipe with `geocube` and `meru`
  or a `trail` (in the cube's look), and the geocube kind's `show: 'land'`; a number from 0 up to 24, or a word on the
  clock's dial (`dawn`, `morning`, `noon`, `afternoon`, `golden`, `dusk`, `night`). The sixth-gen references are the
  keyframes (sunshine's noon, colosseum's sunset, dmc3's night, and a twilight between golden and night that no
  reference paints, so the sky never passes through brown), and the cube's own reference is one of them: its sun on
  one arc that rises at 6 and sets at 18 (`weather/clock-dial.js`), peaking at the reference's elevation or 58°, turning
  15° an hour, so at the reference's own hour the light is the reference's. The key warms and dims toward the horizon,
  then hands over to the cube's moon (or a pale one) past the dial's dusk; the sky, the ambient and the fog's colour
  move between the keyframes in the cube's own hue, the golden horizon kept the sun's, and the day's sky is back by the
  time the sun is well up. The air keeps its thickness and the cube its colours (the bake relights the same paint);
  the water darkens into the night. A moonlit hour draws the night on the dome: the moon where the key is, the stars
  out as far as the night has come. A cube's contrast is resolved against the hour's light. A room, a room's show and a
  trail in its own kit refuse an hour. Absent, the outside is byte for byte as it was.
- **The painted sky** (`matte-paint/sky.js`). A geocube's outside takes `clouds`: `clear`, `fair`, `overcast`, `storm`,
  `haze` or `high`, or `{ kind, cover, seed }`; or `'weather'`, the sky the recipe's live weather state is painted under
  (rain and thunder under storm cloud, fog and mist under haze, drizzle and snow under overcast). A band round the dome
  is painted once on the CPU by the old Photoshop recipe, nothing volumetric: each sheet is a flat deck overhead that a
  pixel of the band looks up into, so the clouds crowd and stretch toward the horizon by perspective and wrap the dome
  without a seam; on it, clouds (value fbm, billowed for cumulus) or difference clouds (a storm's churn), stretched along
  the wind, levels cutting the cover (normalised, so a sheet's levels read as its cover), an emboss toward the sun (the
  rims that face it lit, the bellies and thick cloud shaded), a gradient map from the belly's colour (the sky overhead,
  darkened) to the top's (the key, the sun's or the moon's), a silver lining where the sun stands behind thin cloud,
  far deck fading into the horizon's colour, a haze a veil thickest low; the octaves a pixel can hold, so the horizon
  does not speckle. The sheets are laid high first. The clouds lean the light as their cloud would: under overcast and
  storm the key weakens, the shade greys toward the sky, the air thickens and the sun's disc is gone; clouds that follow
  a live weather lean only the disc (the live channel carries the air). The dome draws the band as a ring inside it that
  hides the stars, the moon and the sun behind a cloud; a sky without one emits nothing new. Clouds without an hour are
  at the cube's own. A level minted with a weather keeps its bare dome: following it is opt-in.
- Planned: the clouds through the cube's ramps, banded to the register on a quiet cube and soft on a gritty one.

### Geocube styles: principles and the laws that check them

A style is its principles plus the mistakes it avoids, and each mistake is a law the machine gate measures. A cube's
`why` already carries the principles and the color theorist's laws already name a palette's mistakes; this theme
joins them. Both keys are opt-in: a spec without `values` and a cube without `avoid` solve and lower byte for byte as
before.

- **Value groups.** A palette spec takes `values: { groups: 2 | 3, of? }` (`color-theorist/solve.js`,
  `PALETTE_VALUES`): each land role's lightness band becomes its group's, so the land reads as a few masses of value
  instead of a continuous spread. Two groups are a figure and its ground (what stands dark, the sky and the ground
  light); three are a painter's masses (the sky and the stone light, the ground and what is made mid, the leaves dark).
  `of` moves a role to another group. The key moves every band; the accents are not grouped. Such a spec is also
  checked by a new law, `value-groups`: each grouped role's middle sits in its band and the groups sit apart.
  `pick_palette` takes `values`.
- **A cube's avoid list.** A geocube takes `avoid: [{ line, law }]`: the mistakes its style names, each with the law
  that measures it (`era/geocube-laws.js`). A law is one of the palette's, read off the contract the cube's colours
  were solved from, or one of the cube's own: `quiet-surfaces` (every tile's block shift and speckle under a ceiling).
  Each line is written back with `ok` and `value` when the cube is read; a palette law on a cube whose colours are its
  own is `ok: null`, unmeasured. The readout rides the specimen's `geocube` payload and a painted stage's `painted`.
  It advises and never refuses.
- **A preset from published art direction.** `theatre-grey`: a grey, quiet world staged in pools of light, one red
  for what matters (a `mono-accent` palette, quiet surfaces, thick air, lab bones). It carries its avoid list, and
  every line holds under its own palette. Only the automated checks have run; it has not been looked at.
- **`limestone-crags`, the first terrain past the sixth generation.** Pale limestone crags over a deep blue sea, the
  rock drawn near in its own beds: `grit` 0.7, the land's `skin` the limestone formation, edges broken and stones
  strewn. Its palette is the color theorist's, solved round a locked stone and a locked clear sky (a role's hue alone
  is a pull the solve overrides), with the sky written, since the solve's horizon read lavender. The flagstone and the
  sandstone stay one override away: `skin` and a palette on the same cube.

### Epidermis cube: skin and hair as a recipe

- **Brows.** An epidermis cube (`epidermis/epidermis.js`) is a character's surface as a small recipe, as the geocube
  is a level's look: its first groom is the brows, grown as strands on the relational head by its relations (the
  head over the inner canthus, the arch's peak over the outer edge of the iris, the tail on the line from the nose's
  wing through the outer canthus), in three regions (the head's hairs up, the body's out and up, the tail's out and
  down) with the herringbone along the spine, laid on the skin. The brow hangs on the brow bridge's strings with the
  fold under it: its head is tied on the medial string, its tail on the lateral string (which runs on the line from
  the nose's wing through the outer canthus), and its peak rides the fold's arc. A raised or lowered brow pulls the
  strings, so the hairs and the fold move together, and the same hairs are carried rather than regrown. The field
  lane draws them (`--epidermis`).
- **Lashes.** The cube's second groom roots on the eye rig's lid margins, which the rig now exposes as lash lines.
  The upper lashes are longest centre-lateral and curl up; the lower are shorter and sparser and curl down; the
  lateral lashes flare outward. Each leaves the margin at an elevation set by where the margin sits on the globe and
  the lid's roll, so the lashes ride the openness, a squint, the gaze and a blink, and a shut lid's lashes hang.
  Every lash is grown step by step: a step that would sink into the skin bends off it with its length kept, and a
  lash that cannot clear the skin ends there. Shape words: `natural`, `long`, `curled`, `straight`, `sparse`, `full`,
  each with numbers over it (`length`, `curl`, `density`, `flare`, `lower`, `seed`); `lashes: false` grows none.

- **Skin relief, studied on swatches.** The cube's skin (`epidermis/skin-relief.js`) conveys keratin rather than
  simulating it: a few numbers in, and a height and a roughness out at any point of a flat chart, gray. It has four
  fidelity tiers, each adding to the last: `form` (nothing), `creases`, `keratin` and `micro`.
  - **Creases** are thin lines at the bone/skin connections. They fan from a point (crow's feet across the lateral
    orbital rim) or run beside a tether (under-eye, forehead), each a wavy, tapered, sometimes forked groove with
    the skin bunched beside it.
  - **Keratin** is the primary lines: two crossing families of long, wandering furrows about the skin's tension
    direction, deep in stretches and fading in others, with a weaker family across. Round pores sit near their
    crossings (and scatter between them on the nose), and a faint minor net turns to follow a crease.
  - **Micro** adds the finest net, the keratin grain and its sheen.

  The dials are the region (forehead, cheek, nose, eyelid, chin), age, squint, and the pore and crease scales.
  `/head-study --skin` renders the swatch sheet. The cube reads `skin` (`fidelity`, `age`, `pores`, `creases`,
  `seed`).
- **Skin on the head, by zoom.** The relief lies on the relational head as a shading layer (`epidermis/skin-head.js`):
  a perturbed normal and a cavity darkening per point, never geometry. Each layer shows over its own range of
  millimetres per pixel (`SKIN_ZOOM`): keratin lines and pores from a close-up, the micro layer in a macro shot.
  Coarser than its range a layer is held back rather than aliased, so a whole-head or portrait view is untouched.
  - **Where it lies:** a millimetre chart runs around the head's vertical axis. The regions come from the relations
    (nose, eyelids, forehead, chin, cheek), blended where they meet and with the tension mirrored left to right.
  - **No creases:** the head carries no crow's feet or wrinkles, which read as incongruous with its design. The
    creases tier stays in the swatch study, and lines along a tether are staggered pieces there.
  - **Field lane:** `--skin` shades the field lane with it, and each panel names its zoom and the layers it shows.
    `--crop macro` frames the outer canthus, and a row of `--acts` may carry its own `crop`, which makes a zoom strip.

### Relational head: the face as superposed vajras

- **The head field, seen as it is.** `/head-study --field` meshes the protoform head's field with surface nets
  instead of the latitude rings, so the turntable shows what the field holds. It overlays the head's landmarks, cuts
  sections through the head (the profile, and across at the brow, the nose base and the mouth), and prints caliper
  measurements read off the field itself: head length and breadth, face and jaw width, face and nose height, nose width
  and protrusion, mouth width, and their indices.
- **A head of relations.** `--source relational` reads a second head (`head-relational.js`): named proportions (the
  facial thirds, the eye line, head length and breadth, face and jaw width, the rule of fifths, nasion depth, nose
  projection) place its points, vajras strung between them make the skull (`--layer skull`), and its skin is every
  vajra's wave summed, the bones offset by the forensic soft-tissue depths and the muscles and fat pads at rest. The
  relations are on the skin; the wave's internal points are solved until the skin's calipers meet them, so each
  relation reads its own target (`--untuned` shows the head as authored).
- **The face's actions.** The relational head takes `actions`: `jaw` (the mandible rotates about the condyles and
  glides forward, and the mouth opens between the lips), `smile` (zygomaticus major draws the corners toward the
  cheekbones and lifts the cheeks), `browRaise`, `browLower`, `blink`, and a side alone (`smileL`, `blinkR`). Each
  drives named beads of the vajra graph; their displacements add, so actions compose. `--acts` renders an action strip
  with what each moved from rest.
- **Eyes and mouth.** The eye's opening is an almond read back from the lid margins (the canthi, the lids' apexes,
  `fissure` and `canthalTilt`), cut through the skin to a globe with its cornea: a blink brings the upper lid down to
  the lower and the opening closes; a smile lifts the lower lid. Each lip is two vajras, corner to cupid's bow peak to
  centre, the lower the fuller (`upperVermilion`, `lowerVermilion`), with the lip line, the philtrum and the
  mentolabial sulcus carved. The skin's wavelength shortens near the eyes and the mouth (`featureWave`), so features
  smaller than the wave keep their edges. `--crop face` frames the face.
- **The nose's pyramid and the cheek's balloon.** The nose's base width follows its length (`nasalIndex`, al-al over
  n-sn, tuned like the other relations), and two sidewalls rise from the wings to the mid-bridge, so the nose is a
  ridge with two walls and the wings read as wings. Straight out from the mid-bridge to under the eye's centre is the
  cheek's control point: a cheek balloon is anchored at the jaw's corner (pinned to it, so the cheek's wall follows
  an opening jaw), bulges there, and tapers to the mouth's corner above and below. A balloon keeps its volume, so a
  smile that shortens it bulges the cheek; the zygomaticus thickens the same way.
- **A closed head.** The cheek's side is walled by the buccinator (upper molars, lower molars riding the jaw, the
  raphe between) and sealed to the chin by the depressor anguli oris; the parotid fills behind the ramus, a fill sits
  before the ear, the upper lip's body meets the nose's base and a columella closes the nose beneath. The field
  lane reports `through-holes` (`throughHoles`, lines straight across the head that meet no skin though skin closes
  round them): none at rest, smiling, or with the jaw open to its limit, on either pole. The philtrum is its columns
  alone (the carved groove read as a line). The al-al caliper reads the wing's knee when there is no groove.
- **The nose's base and its nostrils.** Each nostril is its own vajra (the wing's base, the alar lobule, the soft
  triangle beside the tip), placed from the nose's bottom by `nostrilRise` and `nostrilSet`; the alar bar joins the two
  lobules under the subnasale, so the wing's outer side is the alare and al-al meets its target again. The upper lip's
  body is two cones, one per side, from under the wing to the cupid's bow peak, meeting on the midline: the lip slopes
  forward from the subnasale and the nose sits on it, raised from it (one span across had risen over the subnasale and
  melted the nose's base into a bulb). The nose's flesh is a cone down the middle, narrow at the bridge and widening to
  the base over the wings, closing the grooves beside the ridge; a second cone across it, low beside the tip, closes
  the window in each side between the wing, its wall and the tip. Both take their radius from `noseFat`, how fleshy
  the nose is: wider and fuller, never longer (the tip's projection and the wings' width stay their own relations).
  The al-al caliper reads the wing's knee when the tip's slope leaves the wing no crest.
- **The jaw's limit.** `jawOpen` is how far the incisors part at full (`jaw: 1`, ~39 mm male, ~37 mm female: a full,
  comfortable opening), `condyleGlide` how far the condyle glides forward and down the articular eminence. The jaw
  opens by rotation alone at first and glides as it opens wide; the hinge's angle at full is solved so the opening
  meets `jawOpen` (`jawPose`), so the opening grows evenly with the activation and stops at the limit. The head returns
  `jaw` (the angle, the glide, the opening and the limit) and the field lane prints it. The open mouth is an oval that
  rounds into its corners (it was a diamond).
- **The lips stand forward.** Seven masses end beside the mouth's corner, and their summed waves had swelled it ~12 mm
  proud of the cheilion, with the alveolar arch's ends on the corners besides: the mouth sat flat in a trough between
  two mounds. The masses now end at the modiolus, which the tune sets back until the skin at the corner is on the
  cheilion (`mod`), and the arch curves back behind the corners, so the lips stand on a ~12 mm arc in front of the
  cheeks.
- **The lips' bodies and the cheek's fold.** The upper lip is the philtrum's body under the nose, set behind the
  philtral columns, and a thin plate each side out to just above the mouth's corner; the lower lip is a body from corner
  to corner behind its vermilion, riding the jaw, standing forward down to the mentolabial fold. They are their own
  group (`lipBody`), joined to the skin by a smooth minimum like the nose and the vermilion rather than summed with the
  cheeks, so they keep their shapes and do not swell the corners or fill the fold. The cheek takes a fold: a thin roll
  from beside the wing's base, past the mouth's corner, down to the jowl, summed into the cheek as the edge where its fat
  stops against the lip; it rides the cheek's bulge, so a smile deepens it, and the jaw at its foot. The upper lip's top
  sits back under the nose, so the nostrils' base stands off it in an angle, and the lip slopes forward to its peak at
  the vermilion. An alar crease is carved round the back and the bottom of each wing, where it meets the cheek and the
  lip, and the fold begins there; under each wing a sill (the lip's top edge, from the philtrum out to the wing's base)
  tucks under the nostril, so the wing sits on the lip in a crease, not over a slot. `philtrumVolume` is the
  philtrum's fullness: its body's radius down to the bow, the columns growing with it. The upper lip's plates and sills
  taper (each centre bead on the line between its ends, its radius between theirs), so the lip falls off evenly from
  the philtrum to the corner with no terrace for the light to read as a lump. The al-al caliper takes a groove the wing
  runs straight down into, near its edge, as the alar-facial groove even with no crest before it.
- **Lip fullness and the jowl.** `lipFullness` is the vermilion's volume: its beads' radii about their fixed centres
  (the corners stay fine), so fuller lips stand further forward and grow taller and rounder; 1.25 by default, 1.3 on
  the female pole, and the lip line parts them as far forward and as deep as their fullness carries them. The cheek's
  fold ends in the jowl: `jowl` is its roll's radius at the foot (0.012, flatter than before) and `foldReach` how far
  below the mouth's corner it runs (0.05, to the lower lip's edge; ~0.12 carries it past below the lip toward the jaw).
  The fold's top is anchored on the cheek behind the wing, level with the alar crease, so it has a broad base and sits
  back from the lip; its middle rides the zygomaticus up and back as the cheek bunches over it in a smile.
- **The teeth.** The incisal point (`inc`, where the incisors meet behind the stomion, `incisorShow` below it: ~7.4 mm,
  ~6.4 mm female, so ~4 mm of the male's central incisors and ~3 of the female's show under the full upper lip as the
  mouth opens) anchors the dental arches and is where the
  jaw's opening is measured. The upper arch is seven crowns a side on a curved arch (`DENTITION`: central and lateral
  incisors, canine, two premolars, two molars, each placed out from the midline and back from the incisors' faces, the
  arch narrowing into its curve at the front and running nearly straight back along the molars; `archWidth` scales
  it), each crown its own upright vajra from the cervix to its edge or cusps on the occlusal plane, the incisors
  leaning forward and thin at the edge. The lower arch is the upper's mirror across that plane, a touch narrower and
  `overjet` (~3 mm) behind, riding the jaw. The crowns join each other with an all but hard edge, so they read as
  teeth, not a band. The tongue is its own mass on the floor inside the lower arch, apart from the teeth: its stations
  are placed from the lower crowns themselves (the tip a gap behind the incisors, each half's side a gap inside the
  premolars and the first molar, 1 to 3 mm all round), its dorsum a hair under the lower teeth's edges. The palate
  roofs the mouth on the midline above the upper teeth (the cavity had opened into a hollow there). As the jaw opens an oral cavity is carved behind the lips along the arch
  (each side through the incisors, the canine and the first premolar, down the middle and across the back, reaching
  both arches' edges, narrowing inside the cheeks; beside the incisors each station is two beads up and down the line
  between the crowns' edges, since one round bead tilted by the open jaw reached forward through the skin under the
  lower lip's ends), and the teeth and the tongue, joined after it and clipped to its
  neighbourhood (another carve never bares them), line it: the open mouth shows the upper incisors under the lip, the
  lower row and the tongue. A septum fills the nose's midline (a
  pocket there opened to a line seen through from the side as the cheek moved). The through-hole lane finds none over
  the jaw's range in tenths, plain and smiling.
- **A rounder chin.** The mental tubercles (the chin's corners) sit closer in, lower and smaller (the mandible's front
  ends follow them in), so the chin's front rounds off from the midline instead of standing flat between two balls:
  12 mm out it falls 0.7 to 1.1 mm behind the pogonion and 18 mm out 1.5 to 2.3 mm (both were flat to 0.2 mm). The
  jaw's width and the face's height are unchanged. `head-study --field` gains `--crop chin`.
- **The female face's proportions.** Read as ratios (both poles are drawn at one head height, so millimetres against
  adult norms mostly show the female head's smaller size), her face was as long as his for a narrower width and her
  skull too broad: her facial index stood above the male's where the norm (Farkas) sets it ~2.4 below. Her thirds
  shorten (`third` 0.28, the eye line following to 0.49 so the brow keeps its height over the eye) and her vault
  narrows (`cephalic` 0.79): facial index 87.2 → 84.7 (male 86.3), n-gn/g-op 0.615 → 0.592 (male 0.608), n-sn/g-op
  0.291 → 0.280 (male 0.285), eu/g-op 0.802 → 0.790 (male 0.781). The face sits lower on a relatively larger, rounder
  vault; the tune meets every relation as before.
- **The wings' bases.** Each wing meets the face in one crease: the alar crease runs behind the wing's root, clear of
  it, its edge blended, so the root's round end is the wing's heel (cut across the wing in front of the root, it left a
  curled flap outside the groove; cut into the root's back, a point), the root sits just inside the alare so the
  lobule alone is the wing's widest, and the sill under the
  wing sinks its outer end into the cheek (it stood a round knob 7 mm proud of the cheek beside each wing). The
  calipers (al-al, n-sn, sn-prn) are unchanged.
- **A soft mentolabial fold.** The fold between the lower lip and the chin is a broad, shallow hollow curving with the
  lip and thinning away at its ends, its edge blended over ~3 mm (carves take their own edge: the lip line stays crisp).
  Cut as a thin tube with the lip line's sharp edge, it read as a chevron scored into the skin.
- **The lower lip and its fold as the jaw opens.** The fold flattens as the mouth opens (its carve rides the jaw and
  lifts forward out of the skin), and the lower lip stretches down over the lower incisors and settles back (its body
  and centre by up to 6 mm at the limit, its fullest beads by less), so it no longer rolls out over a deep crescent:
  at jaw 0.6 the male's midline reads lip 2 mm ahead of the chin and the fold 2 mm behind it (was 4 mm ahead and 4 mm
  behind), at the limit lip to chin is one line. The tissue over the mandible (the chin's, the angle's, half the
  masseter's and the buccal's) now rides the jaw, so a swung chin keeps its own tissue depth.
- **Ears.** The relational head wears ears in the shape of the operator's sketch (`head-ear.js` `EAR_OUTLINE`, now
  exported): the helix rolled along the outline into the lobule and curling into its root, the antihelix's Y, the
  tragus raised into the notch over the lobe, the concha's bowl and a blind canal. Their place is relational: the top
  at the brow (`earTop`), the lobule level with the nose's base (`earBottom`), the long axis leaning back from
  vertical by `earTilt` degrees, the hinge on the head's own skin, found by probing the field. The concha stands a little
  off the head with its back welded to the skin, and the outer ear folds off it at the antihelix (`earProtrusion`).
  `earlobe` sets the lobule from free (0, tilted off the head) to attached (1, tilted into the cheek, where it fuses).
  `--crop ear` frames the right ear.
- **Expressive eyes.** The relational head's eyes are a rig of their own (`head-relational-eye.js`): a globe whose
  cornea, iris and pupil turn with the gaze; the lids as a skin shell over the globe and its cornea (a shut lid shows
  the gaze), the opening carved between two lid curves, each with its own height, peak (inner to outer) and shape
  (flat and tense to peaked); the upper lid following the gaze's pitch; a crease, a hood and a pretarsal roll that swells
  in a squint. `eyes` takes a word (`neutral`, `wide`, `angry`, `sad`, `sleepy`, `happy`,
  `suspicious`, `focused`, `closed`), channels over it and a side's own; blink, a smile's squint and the brows drive
  the same channels. The field lane paints the sclera, iris and pupil, takes `--eyes` and rows with their own `eyes`,
  and frames `--crop eyes` and `--crop eye`; a crop meshes only its own box.
- **A gaze target.** `eyes: { look: { x, y, z } }` (metres from between the eyes: +x the figure's right, +y ahead,
  +z up) aims each eye from its own centre, so a near target converges them and a far one leaves them parallel; the
  lids follow, and a word or a side's own gaze composes with it. The head reports its `vergence`.
- **The eye's depth.** The eye was set deep in a walled socket: it read from the front but sank from ¾. The skin
  over the lateral orbital rim stood 6–8 mm ahead of the cornea, where it belongs about 10 mm behind, and the brow
  stood 19–22 mm ahead. The cause was the orbit's frame: it was anchored to the glabella, not to the eye.
  - **New relations:** the eye hangs off the nasion by `radix` (11 mm). The brow's outer end sits `orbitRim` behind
    the cornea and the cheekbone's front sits `malarDepth` behind it. A `lateralOrbit` tissue marker gives that rim
    forensic skin.
  - **The brow** is an arch each side, the glabella over a supraorbital peak (`browProjection`, flatter on the
    female pole) to the outer end. It replaces a straight bar, which ran in front of the eyes.
  - **The skull** gains its lateral orbital rim, the zygoma's frontal process (skull only: the skin over it is
    already the wave of its neighbours). Its orbit becomes a cone that holds the globe clear of bone.
  - **Measured** in mm ahead of the cornea, male / female: radix 11 / 11, brow over the pupil 11.6 / 9.3, skin
    over the lateral rim −9.6 / −9.5, the skull's rim −16.1 / −16.1 (Hertel's 12–20). The wave still meets every
    relation within 0.4 mm, with no through-holes.
- **Upright ears.** `earTilt` is now degrees from vertical, not a share of the nose's dorsum. Through the dorsum the
  ears read about 18° along the long axis (helix top to lobule bottom), too angled. At 6° they read about 10°, the
  clinic's floor. The ear still turns about its hinge with its top at the brow and its lobule at the nose's base. The
  tragion moved 0.4 mm and the outer canthus to tragion stays about 76 mm. The attached lobule still fuses, with no
  through-holes.
- **The outer canthus, closed cleanly.** With the outer wall gone, a slab showed at the outer eye corner. The lid
  space's floor ran level past the canthus to the arc's foot, and both it and the opening's sliver end cut back to
  the globe's centre, where the globe no longer reaches, leaving a shelf and a slot.
  - **The lid space:** its floor now rises to the arc's foot, and its cut has a depth floor, shallowing toward the
    feet and past the canthi.
  - **The opening:** it keeps its deep corner pockets where it is open, and grows shallow only where it thins to a
    sliver.
  - **The cut's blend** is softer, so its fold edge is smoother.
- **The iris, patterned.** The iris carries a light pattern: radial fibres, a wavy collarette ring parting a lighter
  pupillary zone from the ciliary, darker crypts, a dark limbal ring and a thin pupillary ruff. It is a tone over its
  colour (`irisTone`, the head's `paintTone`), periodic round the iris, seeded per eye and paint only, with no
  relief. The field lane shades it per pixel.
- **The brow's bridge, and the lid space hung from it.** An invisible bridge runs across the forehead (`browBridge`)
  with four strings hanging from it: two medial strings down beside the nose's root, and two lateral strings down the
  temples. Each eye's arc, the edge of its fold under the brow, hangs between its two strings' feet just past the
  canthi, and the brow is tied on the same strings. The brow pad's action pulls the strings, so a raised brow lifts the arc and a lowered one drops it. The
  upper lid now drapes the globe from its margin to the crease. The fold rolls out of the crease and rises forward
  to the brow at the arc, and the lid space closes where the arc's feet meet the canthi. Before this, the brow's skin
  stood about 19 mm proud of the cornea right down to the lid margin, which hid the lid, the crease and the hood. The
  `hood` channel lowers the crease and draws the fold down, and the crease is a groove along it. `--rig` draws the
  bridge, the strings and the arcs in red on the skin.

### More than meets: one body in two forms

A hero can now transform: the robot you walk and fight in folds into the vehicle you drive or fly, and back, on one
button, the way a Transformers or a transforming mobile suit does. The transformation keeps the parts that exist and
reorients them; it aims at visual plausibility, not mechanical fidelity.

- **One skeleton, two poses** (`lib/graph/transformation/`). The robot is a skeleton: an operator's suit (`unitRef`)
  or an inner frame made to the vehicle's size. The vehicle form is a pose of the same skeleton (the stow), and the
  vehicle's shell is cut into panels along its length, width and height, each panel riding the bone it lies over.
  The sequence between the forms is the skeleton moving joint by joint, staggered, its panels carried. It all bakes
  into one rig figure: the robot's clips, the vehicle form's clips and the two once-clips of the transformation.
- **The ways of transforming are rows** (`transformation/schemes.js`): a car-bot (the hood and nose its chest, the
  roof its back, the doors its forearms, the rear its legs, the front wheels its shoulders), a jet-bot (the nose and
  canopy its chest, the engines its legs, the wings on its back), a waverider (a suit alone, folded into its own
  flight form) and the variable suit's. A row names the stow, the regions the shell is cut into and where each sits
  on the robot.
- **The variable suit** (`transformation/variable-suit.js`): the primitive between a Transformer and a Gundam, a suit
  drawn to fold. Its kit moves apart as it transforms: the kite shield on its forearm becomes the nose, the flight
  binders on its back spread into swept wings, the hip fins flip up into the tail, and the legs close into the engine
  pods, their heel jets the engines. Three palettes (`federal`, `titans`, `crimson`) and breadth dials.
- **Three more ways of transforming.** The REAR FOOT (`rear-foot`, a car): the legs together are the car's rear, its
  bumper split between the feet, the hood the chest, the head folded down into the chest under the middle of the car
  and the last thing out on the way up. The FUSELAGE FOLD (`fuselage-fold`, a jet; its dials `fold` and `legs`): lying
  face down in the jet, the nose and cockpit hinge down onto the chest (`front`) or the tail hinges down behind as a
  pack and the front of the fuselage stands up as the chest (`back`); the legs stretch back as the engine nacelles
  (`stretch`) or tuck up into a box under the fuselage (`box`). A panel may now SWING about a hinge on its way between
  its places. The ALIEN JETSKI (`alien-jetski`): the alien body below, folded.
- **The alien body** (`transformation/alien-body.js`): a humanoid formed of pointed ellipsoid shells and their
  relations, no part a vehicle's or a suit's: shoulders thrown out and up, forearms fattening to blades, a head
  leaning forward like a dart, feet long spurs. Folded face down it is a hover jetski: a long keel (a blade down its
  back standing) runs under it as the hull, the thigh shells slide up beside it as sponsons, the feet hang as skegs,
  its blades, spikes and spine swing back as fins; it skims a hand's breadth over the ground on a light, quick drive.
  Palettes `void`, `chrome`, `ember`.
- **The craft rig** (`craft-shelf/craft-rig.js`): a craft archetype as a rig figure, one bone per item, so a jet form
  is the shelf's jet.
- **Forms in the engine** (`worlds/controllable/forms.js`): an entity carries `forms`, a rule per form, and B (the
  pad's L3) turns it into the next: an owned, invincible beat plays the figure's sequence, then the form's rule and
  pilot rule take over with the speed carried across (a walker's motion is a car's speed and a craft's airspeed, at
  least its take-off speed). A form may name its follow camera's stand-off; a flying form burns its jets with its
  throttle. A body mid-swing, mid-dodge, reeling or downed does not transform.
- **The World page** plays each form's own clips (`vehicle:drive`, `vehicle:idle`), a flying form's attitude on its
  rig and the flight HUD for a body whose form flies, all emitted only when an entity or figure carries `forms`.
- **The doors.** `figures.<name>.transformer: { robot?, vehicle?, scheme?, height? }` bakes the body at resolve (a
  variable suit, a stored suit by `unitRef`, a stored build by `vehicleRef`, a ride, racer, supercar or craft);
  `compose_world` entities take `forms`, refused unless each names a rule the engine knows. A quick game's
  `transformer` is its hero (its `scheme`, `fold` and `legs` read and refused by what the vehicle is): a car-bot or an
  alien jetski plays a trail's goals, a flier the fly goal from its seat in the air. The cosmos
  counts `soul.hero=transformer` (web only; Godot and Roblox have no forms).
- A transformer exports to Godot and Roblox as its starting form. Its hero carries `forms` and no rule of its own (the
  page picks the rule as it starts), so an engine export found no pilot: the pack had nothing to drive. Every engine
  now takes such a body with its starting form's rule, chosen as the page chooses it (`engines/pack.js`
  `startingForms`), and the export names the rest as the page's: `forms` is a figure overlay, absent in both engines
  (the other form and the transform beat). A world without a body in two forms reaches the engines as before.

### Engine legs: the engines as translations, declared

Every engine pack is a translation of the web game. Which engines exist, what each one carries, and how each is
held equal to the web are now said once, in an engine registry, instead of in a Godot-shaped column threaded
through the code. Roblox joins as the second engine with a runtime kernel.

- **The engine registry** (`lib/graph/scene/engines/registry.js`): one row per engine (Godot, Roblox, Unity, Unreal,
  Blender), its kind (a runtime kernel, a scene project, an art pass), its marks module and the folder its pack lands
  in. The desktop packager's ignore list reads the folders, so a Roblox pack beside a desktop app stays out of it.
- **Marks per engine.** A mark row is keyed by its engine (`{ godot: 'built', how }`, `{ roblox: 'absent', how }`),
  every table in one vocabulary (built, approximated, absent), the bus rows among them. Each engine with a runtime
  kernel has its own marks module over the same closed keys (`godot-marks.js`, new `roblox-marks.js`); what no engine
  owns (the camera and traversal rules, the drawing options, the ledger's information rows) is in
  `scene/engines/marks.js`. `bus-abi.js` is the contract alone: which rows an engine performs is its marks' `BUS_MARKS`.
- **The score reads the engine it is for.** `extractEngineScore(…, { engine })` reads the level against that engine's
  marks; Godot packs are byte-identical. Unity and Unreal packs no longer carry Godot's reading rows, Godot's bus
  column, or a flag naming "the Godot kernel": their kernels run no bus, and their portability reads as before.
- **The cosmos counts every engine.** A facet value carries its mark in each engine (a sourced setting's `marks`
  reader runs once per engine; a value no one marked for Roblox reads as absent, while Godot still throws).
  `dryRun` returns `engines: { godot, roblox }`; the sweep, its CLI and the hillclimb page give each engine its
  column and its scoreboard. Roblox starts at zero worlds, and its scoreboard ranks what to build first.
- **The ratchet, per engine** (`scene/engines/marks.test.js`): every engine's tables are closed against the same
  sources (`scene/engines/mark-sources.js`), the cosmos registry agrees with each engine's export tables, and a young
  kernel marks a row only with the part of the place that carries it: a Roblox row not absent says how, and a built one
  names the kernel module or place file that performs it, which must be there.
- **One conformance protocol.** `scene/engines/conformance.js` says what each corpus holds equal (bus, combat, mind,
  rules, scenes: its scenarios, the kernel modules it needs by module id, the web's runs) and compares any engine's
  output to the web's frame by frame; `scene/engines/runners.js` says how each engine's kernel is laid out and run
  headless. `node scripts/conformance.mjs --engine godot|roblox --corpus <name>` replaces the five
  `godot-*-conformance.mjs` scripts (their Godot runners moved to `scripts/conformance/godot/`); it refuses, naming
  the module, a corpus the engine's kernel does not have yet. The sound meter's corpus keeps its own runner.
- **The Roblox kernel's first modules**, in Luau (`scene/roblox-kernel/`): the event bus, the stats and the game store,
  ported from the web runtime and laid out as the Godot kernel's modules, with `js.luau` saying once how JS reads a
  value (null and undefined, an empty array and an empty object, numbers printed as JSON prints them, UTF-16 hashing and
  order) and `json.luau` reading JSON as JSON.parse does. Pure Luau with no host API: the same modules run under Lune
  and in a place. The bus corpus runs equal to the web on them, frame by frame, stats and store scenarios included,
  and every planted bug is caught (`MOJULO_LUNE`, `scene/engines/conformance.test.js`). Lune and Rojo join the
  optional workers (`lib/workers/find.js`: `MOJULO_LUNE`, `MOJULO_ROJO`, a Roblox toolchain manager's or cargo's bin).
- The bus corpus gains words beyond ASCII (`text`: a spawn id hashed over UTF-16 code units, accented and astral words
  matched and stored) and the one place UTF-16 order and code point order part (`text-order`).
- **One pack pipeline.** `scene/engines/pack.js` holds what every pack is built from: the row and its pixelizer
  refusal, the recipe's hash, the level seam (resolveWorldScene → facesToGlb → the engine's score, the bus, the
  level's sound), a game's levels and posture, the music beds, and the clean emit that keeps the developer's folder.
  The Godot, Unity and Unreal legs compose it and keep only their own layout, sidecars and music policy; Blender and
  the arcade leg take its front. Every pack is byte-identical but one: a Unity game whose menu music is also a
  level's now ships `audio/menu.wav` (the importer probes it; the old dedupe dropped it, as Unreal's already did not).
- **`export_game { target: 'roblox' }`**: a game as a Roblox place, written as a Rojo project under `<ref>/roblox/`
  (`rojo build default.project.json -o game.rbxl`, then Play in Studio). The place carries the Roblox kernel as
  ModuleScripts; each level's bus.json and contract.json as the exact JSON text the kernel decodes; a greybox per level
  (every upward face of the level's mesh rastered into floor slabs, each box collider a wall); and a thin server that
  plays the levels in order, one player driving (set Max Players to 1: a script cannot). A Roblox Humanoid walks the
  player, its pace, jump and pull from the pilot's rule; the HUD is drawn as words (readouts in their slots, banners
  and toasts as moments); the bus's own entities are drawn as the page draws them; a key reaches the bus by the page's
  name for it; the outcome is applied to the store and the next open level starts. The level's look rides beside the
  project as `model.glb` for Studio's 3D Importer. What does not travel (menus, the web's walk feel, link travel, saves
  between sessions; a cast, its fight and its scenes since the whole level, below) is the portability report's, with
  each value's Roblox mark.
- **The level step and the game channel, in Luau** (`roblox-kernel/level.luau`, `game.luau`): where the bodies stand
  becomes zone facts, the bus runs in the page's frame order, its warps are handed back, and the page's game channel
  hears the log (the first pattern as written maps an event; an emit gathered and its `{event}` named, an end and its
  exit, a door left by once, the kept numbers rounded as the page rounds them). Held equal by a new **level corpus**
  (`scene/level-conformance.js`): real levels composed from their mechanics (pickups, hazards, a death, doors and named
  exits, a carried chapter, a kept score, laps on foot, a fall off the ground's edge and its warp back), walked in the
  web runtime and replayed under Lune frame by frame, its planted bugs caught. `json.luau` now keeps the order an
  object's keys were written in (`js.keys`), which the channel's first-match reading needs.
- **The Roblox gate** (`node scripts/export-roblox.mjs --ref <game>`, `scene/roblox-gate.js`): Rojo builds the place
  and Lune opens it, checks its tree, compiles its scripts and plays every level from the place's own kernel and data
  over the track the web recorded for it, frame by frame against the web, and checks the kernel it carries is the one
  the corpora hold equal. Advisory: without `MOJULO_ROJO` and `MOJULO_LUNE` the pack is emitted and the gate says why
  it skipped. The eyes gate is the operator's, in Studio.
- **Roblox marks, the first ones flipped**: the bus's logic, guards, warps, zones, timers, start and stats, the game
  channel and the colliders built; the walk and platform rules, the follow and eye cameras, the faces (as the greybox),
  the HUD (as words), key inputs and the play shell's level list approximated. Mechanics follow from the bus rows they
  use: reach-exit, fail-on-death and win-when built; collect, survive, hazard-damage, laps, score, clock and the rest
  of the zone family approximated; a door, a use and a beat absent (a cast, hits and sight came with the whole level,
  below). The hillclimb page's Roblox scoreboard ranks the rest.

- **The Godot kernel, principled** (kernel 0.29.0). Every step below is held by Godot 4.7.2 headless: the five corpora
  and the level corpus equal to the web, every planted bug caught.
  - `kernel/js.gd` says JS value semantics once (truthiness, `===`, ToNumber, the relational operators, String(v),
    numbers as JSON prints them, the deterministic stringify, FNV-1a over UTF-16, the glob, Math.imul and
    Math.round, a heading's vectors, a segment against a box); the copies in the bus, the minds, the fight, the
    rules, the nav and the game shell are gone, and every module calls it.
  - Two JS rules the old copies missed: dictionary keys sort by UTF-16 code units (an astral word before a fullwidth
    one, the bus corpus's `text-order`, now equal), and a glob's `*` stops at line terminators and matches to the
    very end, as a JS regex does (new scenario `glob-lines`). A string compared with `<` compares code units too.
  - `kernel/game_channel.gd`: the page's game channel, out of `level.gd` and held equal by the level corpus (now run
    on Godot too, with its own plants). It settles three ways Godot's outcome drifted from the page's: a level's
    `initial` events are not mapped through the contract (the page's channel listens only once the bus has
    started), a kept number's `scale: 0` is no scale, and a var holding a number's text is kept as its number.
  - `kernel/beat.gd`: the music's beat clock, out of `level.gd`.
  - One frame, live and in the harness (`level.gd _frame`, its order written beside it): the frame's presses, the
    beat, the bus and the fight's first half, then the drivers, the pilot by its rule and the fight's second half.
    Live play steps it on the physics tick with the keys as the pilot's input, where it used to step the pilot on its
    own tick before the bus heard where it stood; a ruled walker no longer steps itself.
  - The cast's edge-detected facts remember the last read in the cast's state, not in the module.
  - One input a frame, for the pilot's rule and the fight: A / D turn and Q / E strafe as the page binds them (the
    fight read A / D as a strafe, so a swing picked a side the page would not), and a recorded `fire` and `aiToggle`
    now reach the fight in the harness; G toggles the AI live.
- **The web harness freezes as the page does.** The level sim (`game/level-sim.js`, the truth the engine harnesses play
  against) walked the pilot on under a menu: it read the menus one step late, and its frozen step passed a zero `dt`,
  which the world's step reads as 1/60. The page steps no world while a menu is up, from the step right after the bus
  that opened it; the sim now does too, and a level that opens a menu under a held key plays equal in both engines
  frame by frame (`godot-frame.test.js`).

- **The Roblox kernel, whole** (`scene/roblox-kernel/`): the motion and camera rules (`rules.luau`), the cast, the fight,
  navigation, the minds and their groups (`cast.luau`, `combat.luau`, `nav.luau`, `mind.luau`, `group.luau`), and the
  scene runner and quest journal (`scenes.luau`, `quests.luau`), ported from the Godot kernel and held equal to the web
  under Lune by the same corpora (rules, combat, mind, scenes), default and seeded, with planted bugs in every module
  (`engines/roblox-rules.test.js`, `roblox-combat.test.js`, `roblox-scenes.test.js`); the corpus holes the plants found
  are listed in those tests as survivors, so a scenario that closes one says so. Every corpus now has its kernel in
  both engines.
- **A whole level in the Roblox place.** `level.luau` builds a level's cast, fight, minds, scenes and journal from its
  bus.json and steps them in the page's frame order, with the Humanoid's pose as the pilot (a Humanoid has moved by the
  time the server steps, so the fight runs in one call where Godot splits it round its own pilot). A new **levelcast
  corpus** (`level-conformance.js castCorpus`) plays real composed levels on the web (guards that spot the pilot, a
  melee fight, an ambush that bites, a cast cued by the bus and a scene) and feeds Lune only the pilot's pose: the bus
  and every other body equal frame by frame, with plants for the order (`engines/roblox-levelcast.test.js`; the
  corpus has no Godot runner, `runCorpus` says so). The place ships every kernel module; the server draws each body as
  an anchored box (downed laid flat, sent away hidden), the left mouse button is the fight's fire, G the minds' world
  switch, and a scene's line and choices show in a box at the bottom. The place gate plays a cast level whole from the
  place's own kernel (`sneak-game` equal to the web). Marks flipped with it: the `ai` rule, the world switch and the
  tier, the cast's facts, hits, beams and sightings, the rearm and the cast rows built; the cast's effects (a box
  each, its moments undrawn), the bodies, scenes (words, no bars or shots) and quests (a word, no journal)
  approximated; the platform rule's strike runs in the fight. hp-pool, defeat-all and unseen now travel.
- **Where the Roblox ports found Godot off the web** (each now a scenario, with a plant per engine). A swing or a
  round spends the hero's guard (`guard-and-overdrive`, `guard-spent-by-a-swing`: a spawn guard held the hero
  unhittable for its whole clock); an overdrive's rounds hit 1.5 times as hard; a respawned mind is a fresh life, its
  last sighting forgotten (`respawn-forgets`; the mind corpus now takes cast ops as the combat corpus does); a scene's
  condition compares as JS does, a number's text as its number (`scenes-text-var`). Below what a corpus can see, the
  same port: a walk's turn in the web's `((x % τ) + τ) % τ` (Godot's `fposmod` parts by an ulp on about one heading in
  sixteen), the spawn's `among` measured in doubles (not a float32 `Vector2`), an empty `land` lands never, a null
  wait time or beat read as the web reads it.
- **A target, as advice** (`intent.target: 'roblox' | 'godot'` on a gameworld). The world names the engine the game is
  meant for, alone or beside its genre and cube; `design_game`'s readout (`intent.target`, a `target` next step) and
  the game bible then say which of the cube's values that engine does not carry and which it carries in part, read
  from the same marks the export reads. Nothing is refused and nothing rewritten: the game still makes and exports
  whatever it holds, and dropping the target drops the advice. An engine without marks is refused as a target, naming
  the engines it can be.
- **The Roblox marks made true across the registry.** A facet value marked inline for Godot read as absent on Roblox
  (its young kernel's default), so the 3D medium, a linear game, a stage kit or melee read as lost: the advice and the
  hillclimb page's Roblox scoreboard said so. Each is now marked for Roblox as the place carries it (the voxel look
  and coloured floors for kits, looks and level forms; the Humanoid for the hero, its walk, jump and stop; the fight
  for melee, ranged and gear; the stats kernel's own table; scenes, quests and talk as words; links, traversal and
  systems by what the greybox and the kernel do), and what the place does not do stays absent (pixel, weather, the
  top-down, side and fixed cameras, hubs and doors between levels, drive and fly, runs, the shot camera).
- **A Roblox place that looks like its level** (`scene/roblox-look.js`), built from the recipe on the operator's machine:
  nothing is uploaded and no account is needed. The floor slabs wear their faces' colours, each a Roblox material its
  texture or group names (grass, rock, bark, brick, slate, soil…), or else what the material shelf stamped on it (a
  metal surface or metal row Metal, mill scale CorrodedMetal, the glass row Glass), a textured face its tint times its
  texture's mean colour, a blend tile's over the ground it lies on where the tile shows (a meadow's grass, the trail's soil through
  it); a slab splits where the look changes, but the grid coarsens on the slabs merged by height alone, so the look
  never changes what the player stands on; a face too small to cover a cell's centre (a lane's dash) colours it only
  where nothing covering it lies near. The floor grid starts no finer than its area allows, so a road world kilometres
  long exports instead of overflowing. The rest of the
  level (walls, rocks, trees, props) is voxelized into boxes of one colour and material each, the voxel coarsening to
  fit a part budget, and the level's instanced repeats (a wall laid in bricks with `instance`, a stand of trees, a
  road's furniture) join it, each instance placed and tinted as the page places it, so they no longer go missing in
  the place, within a box budget of their own so a forest never coarsens the level; ground cover the page draws as cards, ground shadows, blend tiles and a backdrop are left to the
  slabs and the sky. The look is decoration only: no body collides with it and no ray meets it, which the place gate
  now checks part by part. Colliders become unseen, as on the page. The cast stands as block figures (a mind in red,
  the rest in blue) instead of boxes. Marks: the faces, textures and figures approximated; colliders built.
- **The harness stands where the page stands.** The level harness (`game/level-equivalence.js`, the web side of every
  engine comparison) raycast the recipe's raw faces, while the page meshes them first: surface cards realized, then
  de-collided, which lifts a patch stacked on coplanar ground a step for every face under it. A kart track's patch
  sits 1.27 cm above its raw height on the page, and so in Godot, whose land is the GLB the same pass wrote; the
  harness read the raw 0.05, so the fixture matrix blamed Godot. `pageGroundFaces` gives the harness, the level
  corpus's fall and the levelcast corpus's land the page's faces. The kart racers now hold equal for their first
  thirty seconds where they parted in one, and the supercar race is frame-equal start to finish.
- **A walk stands on the ground, on both engines.** The cast's walk (`cast.gd`, `cast.luau`) is pushed out of the
  level's boxes and stood on its land as the web's `stepRoute` does, at the body's own eye, height, radius and step
  (a cast row carries them as `walk` where the rule is not the walk's default). A farmhand minted below the ground
  stood there in Godot; the farming fixture is now frame-equal. The combat corpus prints where each body stands, and
  a scenario walks a body up from below the ground and round a box (`walk-on-the-ground`), with plants per engine.
- **A round's hit says what it dealt, on both engines.** The web's `hit:<id>` fact carries `dmg`, `harm` and `head` for
  a ranged hit (a round or its splash) so the bus can take it from an hp of its own; `cast.gd` and `cast.luau` dropped
  them. The combat corpus's snapshot now prints them (every ranged scenario carries them), and both kernels are equal
  again.
- **Every events key the page reads is marked, on both engines.** The marks ratchet reads the keys the World page's
  events channel takes (`mark-sources.js` `pageEventKeys`) and holds each engine's `EVENT_MARKS` to them, as it holds
  `PAGE_MARKS` to the page's inputs. The party's battles (`rpg`), the effect light and style floor (`fxLight`,
  `fxStyle`) and the minigames (`minigames`) are marked absent in Godot and Roblox, so an export says why each stays
  the page's. What 3.1.1 added is marked too: `versus` absent in both; `vertexContrast` approximated in Godot (shaped
  into the GLB, no Godot leg plays a geocube world yet), absent in Roblox; turn-based combat, now the party's rounds,
  approximated in Godot (the one-on-one battle travels); and the `party` mechanic, whose slice the web's `play.rpg`
  loads and writes, absent in both.

### Godot plays what the web plays

If Godot can run it, the export runs it; what Godot cannot run is named in the export, never dropped silently. The
JS runtime is the truth, and the Godot export is held to it by playing both.

- **One portability source.** `lib/graph/scene/godot-marks.js` marks every World page input, controllable rule,
  events key, gait, system, traversal entry, link and mind value `built`, `approximated` or `absent`; the export
  (`engine-portability.js`, the score's ledger) and the cosmos registry read the same marks, and a mechanic's mark is
  found by lowering it and reading the bus rows it uses (`laps` and `score` travel, keeping no best; `unseen`,
  `on-beat`, `push`, `crops` and `supplies` name the row they lack). Every cosmos value now carries a mark, and a
  value the web builds that Godot loses is what fails a world.
- **The ratchet** (`godot-marks.test.js`, no Godot needed): an unmarked page input, rule, events key, bus verb, cast
  op, ledger row, mechanic or cosmos value fails; so does a cosmos mark that disagrees with the export's tables, and
  a `built` mark that names no Godot leg proving it. `bus-abi.js` reads its verbs from the bus, the cast and the stats
  kernel themselves (a stat cue now counts as `level-up`, which the hand list missed), and gains the `entities`
  (markers) and `shot` rows.
- **The export says what it is.** The score's ledger reads the rules a level runs (its camera's included), the page
  channels and events keys that do not travel whole; `assessPortability` flags them, and `export-godot.mjs` and
  `export_game` stamp `verdict: plays | plays-partly | hollow` with its lost list beside an unchanged `ok`. The pack
  README gains a Portability section. It stamps; it never refuses. Unity and Unreal read as before.
- **The level-equivalence harness.** `lib/graph/game/level-equivalence.js` plays a level in the web runtime from a
  win script (steered toward the contract's audits, recorded as input) and a stay-put control; kernel 0.21.0's level
  replays the same input at the same fixed step (`scripts/godot-level-sim.gd`) and both print one key a frame (the
  bus's `hashState` and the entities, quantized to 5 cm). `scripts/godot-fixture-matrix.mjs` makes every cosmos
  fixture a game through the quick path, exports, imports and plays it in both; `npm run test:godot` runs every
  Godot leg and the matrix, and fails without `MOJULO_GODOT`.
- **The scoreboard.** `docs/tool-surface/hillclimb.md` gains a Godot section: the fixtures' lost lists, the ladders
  and the values that would free the most worlds.
- **The beat travels** (kernel 0.22.0). A level's `audio.beat` rides `score.beat`, and the kernel says each beat on
  the bus from its music player's clock as the page does from its AudioContext: one function, `beats/beat-clock.js`,
  held equal at seeded jumpy clock readings, and an on-beat level is equal on its bus frame by frame. On-beat travels.
  The web's `level-sim.js` keeps the beat too, and the harness's input frames press keys.
- **Rounds and their reserve travel** (kernel 0.22.0): `kernel/cast.gd` performs `rearm` and `kernel/combat.gd`'s
  reload draws from the weapon's reserve, dry when both are out, held equal by the combat corpus.
- **The bus's own entities are drawn** (kernel 0.22.0): `level.gd` draws each as the page does (an unlit sphere, its
  radius and colour, where the bus puts it, shown while on), so a pushed boulder, a growing crop and a supply travel;
  a pick or a shot (`inputs` on `pick` / `fire`) names the marker its ray meets (`fact:aim`, approximated: the ray
  meets the markers and the box colliders, not the GLB's meshes). Push, crops and supplies travel.
- **Turn-based battles and routines travel**, proved equal frame by frame (`godot-story-rows.test.js`): a battle's
  menu, its guarded vars and the foe's answer; a routine's hour cues and the cast's walk. On the way, two kernel
  divergences the harness found are fixed: a menu up now freezes the world and its clock as the page's does (the bus's
  timers and sagas, the cast, the fight; `level-sim.js` models it too), and the cast and the fight step after the bus's
  ops, as the page's world steps after its events (a walk ordered this frame moves this frame).
- **The clock dial travels** (`weather/clock-dial.js`, held equal to the page's own emitted night): a level's clock
  darkens the Godot sky at night and its season swaps the climate (`score.weather.clock`, each season's schedule);
  day-night and seasons travel as the weather does (approximated: fog, colour and light), and growth with them.
- **Planted bugs are a standing test** (`godot-plants.test.js`): mutants per kernel script (a flipped comparison, a
  reserved key dropped, a timer a tick late, a reserve ignored …), each of which must make its corpus fail. Three
  found holes in the corpus (an emit carrying reserved words, a heal past hpMax, a level past its max), now closed.
- **The bus corpus plays every mechanic that travels** (`bus-conformance.js` `mechanic-<kind>`), held equal in Godot;
  the ratchet asks for each by id. **The harness has planted bugs**: `godot-harness.js` `mutate` edits a copy of the
  kernel, and each plant must break an equality.
- **The honest baseline.** The sweep's Godot survivors fall from 56 to 8 of 500 (21 to 0 near the probes): the mind,
  the gaits, the story and the cameras were counted as travelling and do not. The walker's ground is a flat plane
  under a hilly trail (marked approximated, found by the matrix).
- **The pilot walks and runs by the web's own rules** (kernel 0.23.0). `kernel/rules.gd` ports the walk rule and the
  ground half of the platform rule (run; tank, look, world and lane turning; the jump with its cut, buffer, coyote
  time, wind-up, air jumps and glide; boost and its gauge; the colliders slid along), and the pilot stands on the
  level's own faces (the GLB's triangles, as the page's ground raycast meets them), not on a flat plane. The score
  carries the pilot's rule (`score.pilot`, recipe units). A rules corpus (`rules-conformance.js`,
  `scripts/godot-rules-conformance.mjs`) holds it equal to the web's frame by frame, and a whole level climbs a ramp
  and jumps a ledge key for key in both engines, the pilot included. A power's move (`game.powers`) merges into the
  rule when the bus hears it picked up, as the page grants it (`level-sim.js` models it too). The platform rule's
  opt-in moves the kernel does not run (space, the boost hover and slide, the charged jump, the kneel, the dodge, the
  tackle, a loadout) are named per level (`PLATFORM_KEYS`), and a walker besides the pilot is flagged as standing.
  Walk, platform, the platformer kit, unlock, the gap link and the metroidvania idiom are built.
- **The page's cameras travel** (kernel 0.23.0): follow, eye, overhead, side and fixed run in `kernel/rules.gd` after
  the pilot, held equal by the same corpus, and drive the level's own Camera3D as the page's `__driveCamera` drives
  its camera (a whole level checks the pose every frame against the page's own driver, lifted out of its source).
  The score carries the page's camera (`score.camera`). A camera that watches anything but a pilot the kernel walks,
  and a follow camera's lock tracking, are flagged. The page pulls its chase camera in by its 3-unit stand-off even
  with no wall between (a twin bug, named by a failing test in `godot-rules.test.js`); Godot matches it.
- **Travel travels** (kernel 0.23.0). `store.gd` gains the web store's item gate, a door's transit, and a map's
  reachable levels and exits (held equal by the store corpus). `game.gd` goes on through the exit a level was won by
  (telling the next where it came from), takes a door into the linked level by its own door with the session carried,
  draws a run with the web shell's own roll (lifted from `play-shell.js` and held equal) and keeps the deepest, and
  keeps each kept number's best in `user://`; the menu shows a run's title and a map's found levels. A level ends
  through its named exit, leaves by a door once, hears `arrive:<ref>`, stands at the door it came in by, and sends its
  kept numbers, as the page's game channel does (`level-equivalence.js gameChannel` models it for the harness;
  `godot-travel.test.js`, `godot-game-shell.test.js`, each with plants). A level with no faces stands on the score's
  implicit plane; a script that moves the walker's node moves its rule's pose. Interconnected, building, buildings,
  street, runs, doors, links and kept bests are built.
- **Scenes and quests travel** (kernel 0.23.0). `bus.json` carries the scenes' program and the quests' journal;
  `kernel/scenes.gd` ports the page's scene runner (beats, typed lines, presses, holds and skips, choices) and
  `kernel/quests.gd` its journal and news, held equal step by step by a corpus (`scenes-conformance.js`,
  `scripts/godot-scenes-conformance.mjs`, with plants). The level steps the runner where the page does (after the
  bus's ops): its beats go back to the bus, its shots set `kernel/rules.gd`'s new shot rule (frames, moves, the side
  of the line, the clear view) aside the page's camera, a skip lands the walks (`cast.gd finish`), the pilot's input
  is held while one plays, and the bars, the text box and the choices are drawn; J opens the journal and a word shows
  as a quest moves on. `level-sim.js` plays scenes too, so a whole level (a scene watched, answered and skipped) is
  equal key for key with its directed camera. A twin quirk is named (`godot-scenes.test.js`): the page draws half of
  an emoji for a frame as a line types on; Godot keeps the half back. Talk, the shots, framing, steps and quests are
  built.
- **Vehicles travel** (kernel 0.23.0). `kernel/rules.gd` ports the drive rule (its power curve, brakes and reverse,
  the slewed bicycle steer, drag and rolling, the classes' opt-in grip, the ground followed down at a fall rate,
  walls, and flight off a ramp's lip or a crest with `air`), the racer (a rival driving its line: bends braked
  into, laps counted, a lane, a grip-bound speed plan, ramps lifted for, backing off when held up) and fixed-wing
  flight (taxi, takeoff, banked turns, stall, touchdown), held equal by the rules corpus (51 scenarios). A car or a
  plane pilot is walked by its rule with its own node riding the pose; the score carries the rivals
  (`score.drivers`) and the kernel drives them; the chase camera follows the car. A whole race (the car flown off a
  lip, the rival round its loop, the camera) is equal key for key. The ground's surface grip under a car stays the
  web's (`driveSurface`, approximated), and solid bodies that push walkers out on the web are named
  (`bodies_solid`). Drive, racer, fly, the vehicle hero and the circuit are built.
- **The look travels further** (kernel 0.24.0). Game packs ship their rigged figures skinned, as world packs do (one
  mesh, its clips, its face and ink: game-pack emission changes); the skinned suit follows the walker. The score
  carries the page's background colour, its sky dome, its distance haze and its pixel medium (`bg`, `skyDome`,
  `haze`, `pixel`), and `kernel/level.gd` builds them: a sky shader with the dome's gradient, stars, moon and sun
  (`kernel/sky.gdshader`), exponential fog in the horizon colour, the 3D drawn at 1/scale with nearest scaling; a
  toned stage is graded by `kernel/tone.gdshader` (the page's ramps, bands and detail); a metal reflects the sky, or a
  plain studio sky. A blend tile (the two-tile vertex blend) leaves the GLB as the page draws it, faded in per corner
  (COLOR_0 RGBA under a BLEND material, a cut layer masked) instead of an opaque tile over the ground. The figures,
  the background, the tone and the pixel medium are built; the dome and the haze are approximated (hashed stars, an unphased moon, Godot's fog curve); the backdrop image stays the
  web's. Under `--lit` a skinned figure carries smooth rest normals, so an engine light shades it (the default unlit
  export is byte-identical). Machine-held by `godot-look.test.js`; how it looks is the eyes gate.
- **The export's ground is the page's.** The GLB de-collided its blend tiles together with the ground they lie on,
  lifting the ground itself a fraction of a millimetre where the page leaves it; blend faces now go last (the page
  draws them in their own pass), and `score.blendNodes` names their nodes so the kernel's land leaves them out. The
  harness steps the world in the frame a level ends, as the page does. The fixture matrix reports how far a run
  drifts (`keyDrift`: the bus frames that part, the largest gap in quanta) and keeps both engines' keys beside the
  pack.
- **Clips play the page's keys.** Godot's scene importer bakes every clip at 30 fps, cutting across a key that falls
  between two samples (a figure's keys come every twelfth of a second: at a key, the hand of the hero's wave sat
  2.6 cm off the page's). A pack now writes, for each GLB whose keys miss that grid, the lowest rate from 30 up that lands on all of
  them (`animation/fps` in its `.import`; `godot-bake.js`). Pack emission changes for those GLBs only.
- **Worlds that are not games** (kernel 0.25.0). A world with no one to play (no seat, no pilot) opens on its
  authored view, as the page opens on its camera; 0 hands the view to the walker and back. A world's shoot plan plays
  its edit on P: the program camera the GLB carries, cut for cut, its lens frame by frame from `score.shoot` (a glTF
  camera keys no field of view); the set pieces, the transitions and the world's clock stay the page's (`shoot`,
  approximated; the `shoot_edit` ledger row). `--humanoid` (`export-godot.mjs`) ships a humanoid figure's world pack
  on the engine humanoid skeleton (the T-pose rest, VRM names, nested) with Godot's BoneMap named on it, so the
  importer makes it `%GeneralSkeleton` and any humanoid clip retargets onto it; the scene turns it from the VRM
  facing back to the world's. It holds the page's pose at every key; between keys each joint turns against its
  parent, so a fast move strays from the page's path (6 cm at the hand of the wave, between two keys), which is why it is opt-in and the
  default pack's `figure_humanoid` row says how to ask for it. Machine-held by `godot-edit.test.js` and
  `godot-humanoid-pack.test.js`.
- **The supercars and the race moods, named in Godot** (kernel 0.28.0). Every body the world moves now stands in the
  zones in Godot as on the page (the drivers and the cast beside the pilot): a rival that starts on its last checkpoint,
  or crosses one, counts its laps and its place as the web's does, where before only the pilot entered a zone. The
  flight games' chase camera banks with the craft in Godot too (`rollFollow`, a new rules scenario holds it equal). A
  supercar field ships skinned like a racer's, the moods' relit faces and sky with it; what the page alone lays on a
  car is now said per level (`figures_carried`,
  `FIGURE_MARKS`: the live overlay's steer and lean, the juice, a dark mood's headlamp pool and tail-lamp ribbons), as
  is the wet road's film (`PAGE_MARKS.wetRoad`). The fixture matrix gains variants past the cosmos fixtures: a field of
  supercars on a wet night, and an airspace in a palette.
- **The new games, swept** (kernel 0.27.0). On the rebase onto the flight and shooter games, the fly rule's dials run in
  `kernel/rules.gd` (a glider, the throttle lever, space without gravity or lift, the boost and its charge, the barrel
  roll, the arcade and sim assists, the map's bound), held equal by seven new rules scenarios; the space shooter and air
  combat now play key for key, the flight sim to a quantum. The new mechanics (respawn, frags, control, regen,
  abilities) carry their marks, and the arena shooter's match player and the minds' new moves (peek, floors, items, the
  gun for the range, perches, objectives, a flier's clearance) are named per level (`AI_LOST`), as are the guns' new
  ways (spread, recoil, falloff, headshots, the gun's hand, the round to the crosshair, homing missiles: `WEAPON_LOST`),
  until the kernel runs them. The fixture matrix mints the four new games.
- **The mind travels** (kernel 0.26.0). Bodies on the web's `ai` rule decide in `kernel/mind.gd`, a port of the web's
  mind: every motivation (hunt, guard, escort, territorial, wander, forage, flee, sentry), sight and memory with the
  search, cover from the one it fights, the blade with its combo and give-up, the roll off a stagger, the loadout's
  rotation, a world's tier and a body's own tuning, a boss's phases and adapting, the boost juke and space. It paths
  round walls on the web's grid (`kernel/nav.gd`), moves in groups (`kernel/group.gd`: packs, squads, herds, attack
  tokens) and fights with the kernel's trigger, blade and charge (`kernel/combat.gd`; a semi or lob weapon holds fire
  mid-thrust, as on the web). `bus.json` carries the minds (`minds`: each body's rule, the minds' weapons, the tier,
  the walls), the bus hears `seen`, and a level whose minds hit nothing still runs them. The mind corpus
  (`mind-conformance.js`, its first scenarios the cover law) is equal frame by frame at five seeds, and every planted
  bug is caught (`godot-mind.test.js`). The shooter and stealth fixtures now play their levels key for key. What
  stays the page's: the commander, and the shove-down set piece when an opportunist's counter-charge catches the
  pilot (the kernel plays the plain counter).

### Effects noise: flames and lightning, spell circles, a hex shield, an itano circus

- **Noise on the World page.** The terrain's gradient noise reaches the page twice: its own source for strand spines,
  and a GLSL twin on the same integer hash for effect shaders. Nothing carries either unless an attack or a look asks.
- **Lightning and flame.** A strand's `jag` throws lightning across its spine (noise, ends pinned), re-struck `flicker`
  times a second with `forks` branches. Its `fire` draws its head as flame: noise turbulence torn back from its
  flight, white to yellow to red. New presets `lightning` and `fireball`. Under `fxStyle` the attack's colour picks the
  material by rule: a warm bolt burns (its echoes a trail of smaller flames), a pale ray crackles.
- **Spell circles.** `charge.form: 'circle'` opens a sigil square to the target: rings, a rune band turning one way,
  a hexagram turning the other, an overshoot as it opens. The strands leave from it, so a wall or a floating caster can
  fire from a circle (preset `sigil`).
- **A hex shield.** A look's `shield { r, cells }` raises a half-sphere of hex cells round the feet, with a fresnel rim
  and a noise shimmer, and a ripple runs out from wherever a beam lands on it (preset look `ward`).
- **An itano circus.** A strand's `fan` launches each copy its own seeded way round the line, then curves it back in to
  land together. Presets `itano` (missiles with smoke trails) and `itano-laser` (homing rays).

### Effects: light and a style floor, by rule

- **`fxLight: true`.** On a world whose cues fire beams, puffs or explosions, every effect lights what is round it,
  the way fire already did: a strand's head, a ray's body and a charging orb throw the attack's colour as strong and as
  soft as the strand is wide, and a moment its own declared light, tinted by its colour or its kind (a strike cold
  white, a blast warm). Live steel, baked stone, the anime character light and creatures all take it. A night world
  takes it fully, a noon one a quarter. Nothing is authored per effect.
- **`fxStyle: true`.** Every attack is raised to a style floor by rule: no simple shape unless it is a line (a bolt
  trails fading echoes, a ray carries pulse bands and rings, every attack sprays sparks), layered colour (two companion
  strands in an analogous hue), chirality (the companions braid one way, the hand seeded by the attack; an explosion's
  sprays swirl with it), and the principles of animation (a charge before release, a head stretched along its flight,
  a gentle arc, echoes that lag, a flash where it lands, an explosion's ground ring echoed). An ink edge takes the
  attack's own darkened colour instead of black. A laser may stay one beam. An attack that already does a thing keeps
  its own.

### Level age and crystals: a cube's metal tells its age, its land grows crystals

- **`materials: { age }`.** A cube's materials take an age, `new`, `worn`, `old` or `ancient`: copper, brass and bronze
  tarnish brown and then turn verdigris green by their measured film law, and steel dulls and then blackens to forged
  scale. The painted tone of each aged group follows, so the toon light, the paint and the live metal agree. A group the
  cube names ages too, unless it names its own film or finish. Gold does not age. Absent, metal is bright, as before.
- **Armour cards name their materials.** A style card's `materials` says what its pieces are made of where its
  family's table would be wrong: `grim-scifi`'s trim is blasted steel, `armored-hero`'s faceplate brushed stainless, the
  rest of a hardsuit painted. They are worn only on a level that names `materials`, under the level's own overrides and
  age, so sci-fi heroes now take live metal, the cube's light and its age where their designer said metal.
- **Creatures wear their level's materials.** A creature names its level beside its plan (`spec: { plan, geocube }`, or
  `update_character { geocube }`). Where the cube names `materials`, its horn, hoof, beak and shell take a satin gloss,
  its outfit's metal and leather theirs, and its plan's own `materials` (as an armour card's) say the rest, all at the
  cube's age. A creature keeps its character light, so its materials are drawn: a metal steps higher, shades darker
  and glints. A creature's tones are its parts' tints. Absent a level, a creature is as before.
- **A level's cloth and leather are painted.** On a level that names `materials`, a figure's cloth (its top and
  trousers, its outfit's cloth roles, a stylist's garments) takes the bake's painted `cloth` finish, deep in its folds
  and darker toward its hem, and its leather the `leather` finish, a low sheen with its edges rubbed lighter. A group a
  material dresses (metal, satin, glass, rubber) is left to it, and so is every other group. A figure with its own
  `bake` keeps it; the character light keeps its own look. A plain hero is dressed too.
- **Cloths.** `linen`, `cotton`, `canvas`, `wool`, `felt`, `denim`, `silk`, `velvet`, `nylon`, `polymer`, `carbon weave`,
  `ballistic nylon` and the alien `membrane`, `spun filament`, `resin weave` are materials. On a figure each is painted
  its own way: wool soft with no ridge, denim faded pale at its ridges, silk a sheen band toward the sky, velvet dark in
  its body and bright at its rims. Under the character light they are drawn: silk a soft sheen, velvet deep and more in
  shade, wool a soft step, denim a cool shade, the synthetics a small sheen. A stylist's hero wears its genre's cloths
  on its top, trousers and outer layer (fantasy linen and wool, modern cotton, denim and nylon), and a cube names one
  for a group (`materials: { Top: 'velvet', Outer: 'silk' }`). Anywhere a material is taken, a cloth word now resolves
  to its shelf row.
- **`outside.crystals`.** A cube's island grows crystals: `'amethyst'`, or `{ gem, where: 'crags' | 'hollows', count,
  size, glow, seed }`. Seeded clusters stand out of the cliff faces or sit in the land's hollows, off the trail and the
  seam. They are real gems (the crystal channel shades them live, each throwing its own light, and the GLB carries them
  as see-through). Absent, the land is as before.

### Look materials: armour as material, metal in the cube's light

- **`materials` on a geocube.** A hero whose `geocube` names a cube with `materials` wears real materials on its armour,
  outfit and dress: plate as brushed steel, a lamellar's kanamono as gold, leather as leather, a hardsuit as painted
  satin, each metal group's metal read from the tone its card already wrote. `materials: { <group>: <material> }`
  overrides one. Plate then shades as live metal on the World page, in its clips too (the rig pack carries the metal
  channel per part), and exports as PBR. Absent, every hero is as before.
- **Anime heroes draw their materials.** Under the character light (an anime hero whose manifest names `toon.light`)
  the materials are drawn, not reflected: metal steps higher and shades darker (gold leaning red-orange, steel blue)
  with a small gloss tinted by the metal's measured colour, lacquer takes a small sharp gloss, leather a warm shade and
  a dull band, glass a white glint, rubber a deeper shade (`materials/toon-materials.js`). Such a hero wears no live
  metal. An anime hero in the cube's cast light wears the live metal as any hero does.
- **`contrast.metal`: metal in the cube's light.** Metal faces take the cube's occlusion (the foot of a wall, a crease,
  contact) as a multiplier the live metal shader and the GLB carry, and the live metal reflects the cube's own world
  (its sky over a daylit dome, its ground leaned toward grey) instead of the studio's dim room. A hero on such a cube
  takes it on its metal alone. Absent, metal is shaded as it was. `upland-morning` turns both on.

### Sixth-gen land: ground, mix, facets, valley

Four opt-in words on a local meru (and a geocube's outside), each absent unless asked, so every cube and stage
renders byte-identically without them.

- **`ground`: a terrain world under the level.** `meru.ground` / geocube `outside.ground` takes a painted scene
  (`{ from: { heartbeat, splatch, seed }, span, height, at }`) through the `terrain` kind's field (its landform,
  erosion and fracture detail) and lays it under the plain: its lowest point under the level is the datum, its range
  scaled to `height`, eased in from the seam. The island's geology still reads only the mounds and the high shore as
  raised land.
- **`shading.mix`: surfaces mixed per corner.** Each corner takes rock, grass and sand by how much of each lies round
  it, spread `mix` metres and drawn back to a soft, noisy edge, on both sides of a seam: grass meets rock in a curve,
  not in the grid's steps.
- **`shading.facet`: rock in planes.** The rock's grid heights are drawn onto facet planes about `facet` metres wide
  before the land is lit, so a cliff reads as planes of stone instead of a checkerboard of half-metre quads; the
  grass's corners stay where they are.
- **`island.seabed: 'merged'`: the flat seabed in large quads.** Past the beach an island's floor is one plane under
  deep water, yet it was drawn in the land's half-metre quads and was most of the faces. Merged, it is a few dozen
  quads: the upland island goes from 31,944 faces to 10,395 and builds in under half the time, its renders matching the
  grid's to within 13/255 on 0.04% of pixels. `'grid'` (the default) draws it as before.
- **`upland-morning`, a geocube preset with them on.** Valley-morning's look (its colours, light and contrast) on a
  rocky upland: a `rocky-irregular` ground at 45 m and 3.5 m, mix, facet and valley. Its island merges its seabed. The shipped presets are unchanged.
  The geocube card took an `outside` line naming relief, ground and the land words (its ceiling re-pinned 4000 → 4600).
- **`shading.valley`: the sky a hollow loses.** The foot of a slope, a hollow and a gully darken toward the shade by
  how much sky the land round them hides, read over tens of metres and beyond what an even slope of the same grade
  hides.

### Perlin spike: relief for the geocube land

- **One noise module.** `lib/graph/noise/noise.js`: 2D gradient noise on the terrain kernel's integer hash and
  8-direction table (the same values as `terrain-kernel.js gn`), its analytic gradient, fractal sums in four flavours
  (`fbm`, `ridged`, `billow`, `damped`: detail suppressed where the slope is already steep, the eroded look) with
  octaves rotated off the lattice, domain warp and terraces. Only + − × ÷, floor and imul on the height path, so a
  field is the same in every engine.
- **`relief` on a geocube's outside.** `outside.relief` (and `outside.terrains.<name>.relief`) names a relief card
  (`rolling`, `craggy`, `eroded`, `terraced`, `dune`) or `{ from, …changes }`; the stage's meru carries it and the
  local meru lays it on the plain under the seam fade. On an island it only lifts the plain (a hollow would drown the
  grass in beach), and where the island draws its mountain as land (`walk: 'base'`) it runs up the mounds too, so the
  geology breaks already-broken ground. Octaves are set in metres, not by the mesh. A cube without relief lowers and
  renders byte-identically. The geocube routing card names the word.
- **Grain in the vertex.** The relief's octaves finer than the land's cells go to colour only, filtered over each
  corner's footprint (`relief.grain`), so the polygon land's light carries detail its geometry cannot.

### RPG improvements: a cast rolled for the game, familiars that fight on their own, moves per character, minigames

- **The cast roller** (`lib/graph/egocube/cast.js`, `rollCast`): an anchor Egocube and the people rolled against it,
  as docs/egocube.md designs it. Relations (shadow, rival, foil, mentor, party, familiar, lieutenant, mastermind, rank,
  and the journey's herald, threshold guardian, trickster, shapeshifter, ally) aim a target distance from the anchor on
  the archetype wheel, the role, the build and the age, and pull motivation and order; `complement` proposes the roles
  and archetypes a party lacks. The laws are checked as each member is rolled (party silhouettes distinct, a shadow in
  its anchor's shape and a rival in another, the size ladder, the bookends on motivation); a broken law draws the later
  member again, never the anchor nor an ask, and one still broken is kept and named. Seeds are keyed by path and members
  roll in order, so a cast only grows. `castOfScale` is the completeness ladder: hero, rival, party, journey.
- **Beasts, beast-kin and mascots in a cast.** `bond: 'party'` is first party (Kimahri, Red XIII); `bond: 'familiar'`
  is second party, kept by its parent and wearing its accent (a stand, a summon, a poke-companion). A body is a person,
  beast-kin (a beast lineage), a beast (a real species, through the animal door) or a mascot (chibi); unasked, a party
  member's and a familiar's body is thrown on the setting's odds (a myth has beast-kin at its fires), `bodies` leans them.
- **`rollEgocube` takes `lean`, `pull` and `redraw`**: a relation's multipliers on the priors, motivation and order drawn
  near a target on each attempt's own die (never an ask), and the attempts a cast's re-draw starts at. Absent, every
  sheet is byte-identical.
- **A cast is a cube**: `create_sketch({ kind: 'egocube', cast: { anchor, cast, factions, setting, bodies, seed } })`
  rolls and keeps the cast (`castSheet`); its preview is the members standing in a line, a beast among them as the animal
  kind makes it. `create_character({ egocube, member: 'hero/rival' })` makes one member through its door (a beast through
  the animal door); the character records the member it was made from. New routing card `cast`.
- **The casting page** (`lib/graph/gameworld/casting.js`, `characters.casting`): the book's people rolled for the game in
  its setting (a turn-based world reads as a battle), as many as it asks for: `scale` hero | rival | party | journey, or,
  absent, the world's prompt words (saga, a party of four, rival, familiar, chibi, beastfolk), else a party for a world
  that fights turn by turn. The run writes one egocube row (`<ref>-casting`) and makes each member from it
  (`<ref>-cast-<id>`); a journey cast's members wait on the new `characters:cast` review part (the sheets are the
  proposal). The first party fights in the battle party from the start, and the hero with it, each in the class its sheet
  reads as (`classOf`) instead of the rotation; a `joins` flag on a member brings it to the field as a written companion.
  The story, the bible and the field party read the rolled members as cast members. A book without the page is untouched.
- **Familiars that fight on their own** (`play.rpg` party `auto: true | { keeper }`): a second-party member picks for
  itself when its turn comes, from the field as it stands and never on the dice: it mends the hurt (its keeper first),
  raises the fallen, strikes a weakness, finishes the weakest foe, else hits the one that hits hardest. The page asks no
  command of it, on rounds or on the timeline, and it takes no place of the party's `size`. A casting page's familiar
  of the hero or of a first-party member fights beside its keeper. The kernel and the rpg channel are emitted into every
  page with `play.rpg`, so those pages' text moves; a party with no `auto` member plays the same battles.
- **Reactions for every hero, lifted from the versus fighter** (`lib/graph/polygonizer/hero-react.js`): new motion words
  `hitHigh`, `hitBody`, `hitLow` and `stagger`, a `react` move family. The fight's own impact poses and its stagger
  (`versus/versus-react.js`) are read onto the hero's rig through `planeToVajra` (the fight plane's segment angles as
  the hero's joints), not copied: struck fast, held through the blow, given back slowly, the feet planted, home on the
  stand. With the rest `knockedOut` (the topple and the rise) a hero can now take a hit, fall and get up.
- **A cast member is made with its moves** (`lib/graph/egocube/moves.js`, `moveSetOf`): its ready stance and its attack
  by its role, its reactions, and its win by its archetype, as hero motion words, so its page's clip picker plays them;
  `create_character` says which (`egocube.moves`). One character from a single egocube is made as before.
- **The combat states play a hero's own reactions** (`playscape/player.js` `playerStates`): `stagger`, `topple` and
  `getup` map to its `stagger` (or `hitHigh`), `knockedOutDown` and `knockedOutUp` when it has them.
- **The level map plays each member's own moves.** A casting page's member carries its `field`: the runtime states its
  own moves play (`egocube/moves.js` `fieldStatesOf`: the hit's lurch, the topple and the rise, a swing as its attack).
  A figures-map hero takes `moves` beside `clips` (`worlds/world-scene.js`): each state plays the hero's own clip over
  the library's when it has it, and keeps the library's when not. Its first party and its familiars walk beside the hero
  from the start (`play.party` members may now leave out `joins`: woken as the level starts, no flag carried). A level
  with no casting page is byte-identical.
- **Beasts, mascots and beast-kin walk the level map too.** A cast's beast is made with its two gaits rigged
  (`moves.js` `beastGaitsOf`: the wolf's walk and trot, a bird's walk and hop), and a beast-kin below the hero door with a
  walk, a jog and the moves its creature rig solves (`creatureMovesOf`: a stance, a strike, the reactions and the fall;
  a showcase pose is a person's). On the field each walks on its own clips with no library (casting.js `fieldOf`): the
  mascot its run, walk and idle, the creature its jog and its moves, the beast its gaits. A figures-map entry marked
  `walker: true` (it follows or stands, never pilots) may be any rigged character (`heroRefError`'s `walker`).
- **A beast takes a blow** (`lib/graph/fauna/behavior/react.js`): new animal motion words `flinch` (dropped low, the
  head thrown up, back to the stand), `fall` (onto its side, gathering speed) and `rise` (back up), each a one-shot
  between poses the behavior solver already solves for its own body (every bone slerped between them), on any body
  with legs (`{ reactions: 'all' }`, or the words in a motion list). A cast's beast is made with them, and on the level
  map its hit, topple and get-up play them. An animal without them builds byte-identically.
- **Legless beasts and mascots take a blow too.** A snake or an octopus flinches by rearing back from its coil into its
  strike coil and falls laid out flat (the flatter of on its belly or on its side for that body); a swimmer has none
  yet. A cast's mascot is made with `flinch` (squashed down, the arms thrown up, the surprised face), `fall` (tipped
  over its feet onto its back, eyes shut, its head on the floor) and `rise` (back up through a crouch), and plays them
  on the field (`mascotPlan`'s `reactions`; every other mascot is minted as it was).
- **Keyed one-shots and a body tipped over its feet** (`polygonizer/station-loft-rig.js`): a plan clip may be
  `{ once: true, keys }`, packed 0 … 1 inclusive as a function clip with `once` is (a fall that ends lying down); a key's
  `body: { pitch?, roll?, up? }` without `at` turns the figure about the floor under its feet. Clips that use neither
  are byte-identical.
- **Minigames: the games inside the game** (`playscape/ui/minigames.js`, `scene/channels/minigame-channel.js`).
  `play.minigames: [{ id, game, at?, prompt?, goal?, gold?, purse?, prize?, flag? }]`: interact at its place (or emit
  `minigame:<id>`) and a round comes up in a pixel window over the field, the world held still as in a battle; `blocks`
  and `match` are the arcade cabinet's own reducers (brickster, the philosopher's stone trial), `fishing` a new one
  (`pixelizer/fishing-core.js`, `fishing-skin.js`: hold the line over a darting fish until it is landed, a few casts a
  round, five fish from minnow to golden koi). Its score pays gold into the party's purse (a bag transfer when the purse
  is the bag's, so it is carried), keeps `minigame-best-<id>`, and says `minigame-won:<id>` or `minigame-lost:<id>`; the
  first win gives its prize and sets its flag. The page inlines only the games a level plays; a level without one
  carries not a byte of them.
- **Minigames in the game book** (`gameworld/minigames.js`): `minigames: true | false | [game | { game, … }]`, or heard
  in the prompt (minigames, carnival, fishing, arcade, match-3). A keeper (one figure, made as the foe is) stands at each,
  spread across the game; the winnings go into the carried bag (the battles' bag, or its own). A world that asks for
  none makes the same steps it did.
- **An arcade in the inn.** A game's `where: 'inside' | 'trail'` (blocks and match inside by default, fishing on a
  trail, each on the other when the world has none of its kind) puts its keeper in a building's room: a tavern's snug
  or taproom, a hall's hall, a shop's floor, a library's reading room (`ROOMS_KEPT`), in the corner farthest from the
  way in, a building level or the inside of one entered by its door alike. A building level now takes a stage's extra
  (its rooms and use on its ends, its mechanics the level's); a building without one is the level it was.
- **One way to stand people on a stage** (`gameworld/stage-figures.js`): a figure on the shared library or on its own
  clips, a person's body numbers, the entity of one who stands, and a stage's extras composed, where battles, minigames,
  the story's cast, guards and every quick goal's figures each wrote their own. Every run's orders are unchanged.
- **A quick game's cast** (quick.js `cast`, casting.js `castingPage`): any quick goal on foot takes the casting page
  (less the journey; `true` a party of one), rolled in the game's setting and made as the book makes it (one cast row,
  each member by path). Its party and familiars walk beside the hero from the start on the escort motive and fight what
  it fights, on the pilot's side in a team game; a rival with a person's body stands as the first foe in a battle, a
  shooter or a deathmatch; the readout says where each went. A quick game without one makes the steps it did.
- **Every person a run makes can take a blow on its own rig** (a world's `moves: true`, a quick game's lever; egocube/moves.js
  `REACT_MOTION`, `reactStatesOf`): the hero (through its motion page), the battles' foe, a keeper, and every quick
  figure (foes, guards, towers, farmhands) are made with their own hit, stagger, fall and rise, and each figure standing
  for one plays them over the library's (levels.js stageLevelOrder `moves`); a mascot hero its own flinch, fall and rise.
- **Beast foes** (`foe: { species }` on the book's battles, a quick battle or a defence; stage-figures.js `foeFigure`): the
  foe is made through the animal door with its two gaits and its reactions (design_game realizes an `animal` order) and
  stands, walks and takes a blow on its own body; a shooter's or a deathmatch's foes keep a person's hands.

### README demo: a floor plan to rooms you can live in

- The README and the npm page lead with `docs/images/decor-demo.gif` in place of `lounge-handoff-demo.gif` (which
  the long tour keeps). It is one real Claude Code session, recorded rather than staged: a homeowner uploads their
  floor plan as a picture and asks, in their own words, for ideas for living in it (warm, natural, a bit cozy: the
  living room, the dining room and the big bedroom), then for sage green living-room walls and the sofa turned to the
  windows, then for a walkthrough video. The agent reads the plan, builds the house with `mint_building`, designs and
  then repaints and rearranges the rooms with `design_interior`, and films and stitches the walkthrough itself. The
  change is shown from eye level, aimed at what moved, as a before and after swept in by a glowing line; the last
  slide is the session's own working time, tokens and cost at API list price. README section 2 walks through it.
- `docs/images/src/decor-demo/` re-runs it end to end: `plan.mjs` draws the uploaded plan (`house.json` as its own
  A-101 sheet), `run.mjs` drives `claude -p` (`--resume` per ask, the plan as an image in the first message) with
  mojulo as the only tool server, `capture.mjs` films from a replay of the session's calls, checked against the
  recipes it stored, so a kernel fix re-shoots the same session, and `compose.mjs` sets it in a generic chat and
  encodes the GIF. `session.json` is the record of the session the GIF shows: every call, reply, token count and the
  recipes it left. The media helpers launch Chromium without its sandbox when they run as root, as in a Linux
  container.
- `docs/tech-requirements.md` is measured for 3.1.1 (Linux x64, 2026-10-18: an 11.6 MB tarball, 251 MB installed
  across 130 packages, the per-dependency sizes again, and what the measurement turned up), records the Linux runs
  behind the demo (Claude Code driving the stdio server, Chrome for Testing baking without its sandbox as root), and
  names `stitch_motion`'s MP4 decode. The READMEs carry the 3.1.1 install size and name the ChatGPT plugin
  ([plugins/mojulo-chatgpt](../plugins/mojulo-chatgpt/README.md)) beside the Claude one.
- `design_interior`'s reply says where each piece stands: `at` (its centre, mm from the room's corner) and `facing`
  beside its id and size, so the next call can move a piece by id knowing where it is, and a reader can tell what a
  revision moved.
- `design_interior`: a dining room has its chairs. They tuck a little under the table, and the placement check
  counted the table they tuck under as in their way, so every chair was left out ("collides with dining.table") and a
  dining room was a table, a rug and a sideboard. `brief.seats` now seats that many where the room fits them.
- `design_interior`: a plain cloth asked by name on a piece (`finish: { fabric: 'velvet' }`, also linen, canvas,
  bouclé, twill) changes the cloth and keeps the scheme's colour. It used to drop the colour, so the piece wore the
  preset's own (velvet's emerald): "make the sofa velvet" turned the sofa green. A room that names such a fabric
  renders in its scheme's colour now; a patterned cloth (tartan, ticking …) and a full fabric spec are as they were.
- `stitch_motion` joins World clips (a furnished room, a city, a level), which it used to refuse. A World clip its
  forge baked to MP4 is decoded from that video, so a stitch of three room clips takes seconds rather than a fresh
  headless render of every frame; one without an MP4 is rendered again from its recipe.

### Test tiers: the e2e suites run once, in their own CI job

- `npm test` leaves out the e2e tier: the whole worlds made through the real handlers and the games whose audit walks
  each level in headless Chrome (the `E2E` list, now in `vitest.config.js`). Measured on one full run, they were a
  third of the suite's time, and CI ran them on every leg of its matrix. CI runs them once now, in an `e2e` job on
  Ubuntu with Node 22 (`npm run test:e2e`); the byte pins they rest on still run on every leg.
- `lib/mcp/test-tiers.test.js` holds the new shape: the e2e suites run in `test:e2e` and in neither `npm test` nor
  `test:critical`. CLAUDE.md and CONTRIBUTING.md say when to run the tier.

### Claude plugin: the server installs from a lockfile the plugin ships

- The plugin no longer runs `npx -y mojulo@<version>`. Its server is `node ${CLAUDE_PLUGIN_ROOT}/server/launch.mjs`,
  which runs `npm ci` against `plugins/mojulo/server/package-lock.json` once per version, into
  `~/.mojulo/plugin/<version>-<lock hash>/`, then starts the installed server. The lockfile names mojulo and every
  package under it by exact version, registry.npmjs.org source and integrity hash, which npm checks on install; the
  Claude plugin directory held a plugin that ran an npm package without one. A later start runs at once.
- The install is built in a temporary folder and renamed into place when `npm ci` finishes, so two sessions starting
  together share one install, and a start Claude Code cuts short leaves nothing half-built (the next clears it). npm
  writes to stderr: stdout stays the MCP channel.
- `control/scripts/plugin-lock.mjs` writes the launcher's `package.json` and lockfile for the version
  `control/package.json` carries, once it is on npm (`--check` resolves again and compares).
  `check-plugin-version.mjs` now holds the plugin to the launcher: `node` on `launch.mjs`, the distribution flag, a
  `package.json` on exactly the version, and a lockfile that locks it, every entry hashed and from npm.

### Fractal structures

- **Towers for any world, from a few words.** A new kind-generic `structures` channel grows landmark towers from
  four words: a plan (square, turned squares, a star, a stepped circle, offset faces cut again to a depth), a rise
  (how the plan narrows, turns and is banded as it climbs, r(f) = top + (1 − top)(1 − f^p)), a crown (a ribbed disc,
  a dome or a finial) and an echo (smaller copies of the whole against its own flanks, each echoing again: a tower of
  towers). The principles are the Indian temple builders', lifted off the temple. Presets (`PRESETS` in
  `fractal-structure/presets.js`) and a seeded `auto` that rolls a varied skyline.
- Pass them to `compose_world` as `overrides.structures` on any base, or set `structures` on a stored world and
  patch it in place. The faces join before the material, texture and shadow passes; an entity world also gets a box
  collider for each tier and plinth step, so a stepped rise's terraces stand a walker. A face budget trims the
  deepest copies first, never the tower. Absent, every world is byte-identical. Manual: the `structures` view-vocab
  card; kernel: `lib/graph/fractal-structure/`.
- **A structure made of structures.** A `colonnade` stands any structure's words (a fluted `column` by default)
  round the plan, spaced evenly along its perimeter, or on a grid, under an entablature that can roof a walk to the
  wall, or carrying the body on top; a `hollow` body is a wall round open ground whose edge can step out as it rises
  (a seating bowl); `stretch` makes a plan oval; a `top` echo stands a lantern on the crown. New presets come of
  it: `column`, `rotunda` (a tholos with its lantern), `cloister`, `hall` (a pillared hall under a stepped roof) and
  `arena` (an oval bowl behind a storeyed, columned wall). The stepped-circle spire is now `beehive`.

### Mutagenic oozes: base animals made into game creatures

- **An animal takes oozes.** `create_character({ as: 'animal', spec: { species, ooze } })` turns a real species
  into a game creature, drawn to read in a game rather than a field guide: `dire` (bigger and front-heavy, a crest of
  hackles, a snarling face and glowing eyes, still the animal), `skeletal`, `zombie`, `techno`, `crystal`,
  `mythical` (boss size), `herobot` (a toy hero robot in the animal's own colours: a helmeted big head, antennae, ball
  joints and pauldrons, panel seams and vents, flared boots, plastic), `transmetal` (the animal's outline and fur, its details machined: chrome faceplate, plates, pistons), and
  the elements `fire`, `frost`, `storm`, `venom`, `shadow`, and `mascot` (the animal as its own mascot on its own legs,
  by the mascot laws and its family's mascot card: a big round head, toon eyes, a short face, stumpy limbs, owned
  colours and one signature piece its folk promise says). Oozes compose
  (`['dire', 'frost']`), each with a `strength`, in four layers run in a fixed order: form (girth, and size only
  uniformly), sites (what grows at the joints and on seeded spots), surface (palette, metal, glow) and aura (the
  live elemental look). One `seed` places every spot. Absent, every animal is byte-identical.
- **Design notes style a creature up.** `stylism: { register, detail, focal, motif }` on an animal, with or without
  oozes, is the hero door's stylism tuner compressed for a beast: the register heightens every push together, the
  detail budget spends ornaments (horns, spurs, spikes, a ruff, bands, a burning tail) from the focal out by the
  tuner's laws (hierarchy, one echo, rest, an accent from heroic up), all in one motif a clear value step from the coat,
  and the mint returns its design notes. `mythical` (a boss) carries its own mythic, rich stylism.
- **From pure to chimera.** `stylism.chimera` (pure · touched · hybrid · chimera) grafts what the animal should not
  have, in the order it breaks the silhouette: horns, a ridge of plates down the back and tail, another creature's tail
  (serpent, scorpion, lion, dragon), wings (feathered or membrane by the motif, carried half raised), a second crown.
  The seed and the motif choose the kinds; a mythic register is hybrid unless told.
- **An oozed creature takes its game's look.** `spec.setting` (the setting the game rail hands its people: tradition and
  ramps) gives an anime world's creature the character light, lit as a creature is, and dresses what the oozes make
  (pieces, armour, panels, marks, ornaments) from the world's ramps, keeping its values; the coat, glows, metals and
  signal colours stay their own, and the result ledgers every move. A shelf metal named by its word (`'gold'`,
  `'chrome'`, `'gunmetal'`) now draws under the character light instead of throwing.
- **A plan names its materials.** A ring plan's `surfaces` (`{ <group> | '*': <material> }`, validated against the
  material shelf) reach its recipe as a statue's do, so a techno creature is real gunmetal on the World page and in
  the exports. Absent, nothing changes.
- **The creature's own rig.** An oozed animal with `motion` moves on its own body: the fauna rig reads a body
  registry (`lib/graph/fauna/body.js`), so its skeleton is derived from the mutated plan (a grown creature's bones are
  its species' at its size, its clips the same turns), a grafted tail is carved into bones of its own and swings, and
  grafted wings get wing bones and the `fly` and `glide` gaits. Ornaments ride the bone at their root. The stored motion
  keeps the species and the ooze, so the World page and the GLB, Godot and other exports rebuild the same body. Every
  species is byte-identical. Manual: the `ooze` section of the animal vocab card; kernel: `lib/graph/mutagen/`.
- **Articulated wings.** `wearWings(…, { articulated: true })` weighs every wing point to the wing bones it hangs from
  (an arm or digit its bone, a feather its ray's, the membrane each sub-ray's blend), honoured by `bindLayered` as a
  pinned part's `boneWeights`, so a wing folds and beats along its bones. Grafted wings take it; birds and bats keep
  their rigid wings until they opt in.

### Strategy board: spots on the map for tactics and tower defence

A game can carry a board: square spots laid over its terrain as their own layer, each with a height, a terrain type
and at most one unit. From any state the board lists every legal move, so a player can run out of options. Turn-based
tactics (in the manner of Final Fantasy Tactics), tower defence and real-time strategy share it. A board lies over a geocube's level,
indoors (its rooms) or out (its land), or is a diorama the cube paints. Web only. In progress:

- **Real-time strategy on the board** (`lib/graph/board/board-rts.js`, `board-rts-page.js`), built, North star
  StarCraft at a spike's depth: two bases on the board's spots, workers mining gold nodes, a barracks raised over
  time, soldiers and archers trained for gold and sent to a rally point. Units take orders, one or a box of them:
  move, attack-move, attack, hold, stop, gather. Paths walk round buildings and nodes. The other side is played by a
  plain mind (workers to a count, a barracks, waves that grow), and the game ends when a base falls. A fixed step
  and no dice: the same orders at the same times make the same game, however the time is cut. On the page: click,
  shift-click or drag a box; right-click to move, attack, gather or set a rally; A attack-move, B build, H hold, S
  stop, Q / W train, Ctrl+A the army. The board kind and a board over a stage take `rts` (one of `td`, `rts`, a
  battle or units), with `enemy` for a handicap. The quick goal `conquer` is a skirmish on the stage's spots
  (`board: { cols, rows, gold }`), the level the board's to end. Web only.
- **Civilizations as skirmish sides** (`lib/graph/board/board-rts-tech.js`), built: a gameworld civilization's
  technology read into the roster it fields, as StarCraft's sides are unalike. Its hand weapons arm its infantry
  (melee, ranged, a shield's guard); what moves and carries is its worker; armoured vehicles are heavy, small ones
  scout, armed ones fight, armed flyers cross any spot out of melee's reach; machine weapons are siege, three times
  as hard on a building; a turret is a defence that shoots, a barrier a wall, a thing that stores a depot, a thing
  that makes the works its vehicles come from (after a barracks). Stats move with the words (armour, energy, a size,
  a showpiece's rank), and every cost comes from one worth formula, so no side buys more fight for its gold. What a
  civilization lacks is filled from the plain worker, soldier and archer, and every crafted thing says what it
  fields as or why not (a vessel waits for water). The skirmish kernel takes a roster per side; a side without one
  plays as before. The mind raises what it builds in order, past the first only once it has sent a wave, and sends
  everything it has once the gold nodes are spent; a skirmish where the gold is gone and nobody stands is a draw.
  Its ladder: infantry from the start, its machines once researched (tier 2: the works stands only then), its
  showpieces after (tier 3: what its technology ranks its focus, the armoured walker), researched one step at a time
  at what it crafts that signals, senses or lifts (a relay mast, a dish), else a plain lab; its power and growing
  things are income steps, each making a trip pay a fifth more. The mind climbs the ladder after its first wave,
  keeping back what the next step costs. A base now defends itself (it shoots at units in range), stands longer, and
  the gold nodes hold more, so a first wave seldom ends a skirmish and the machines come out.
  On the page (`lib/graph/board/board-rts-look.js`), each side is drawn as its technology crafted it: its walkers,
  crawlers, haulers, masts and turrets as their chassis and adornment (or their block), painted in the
  civilization's finish, cut to the largest faces that read from the RTS camera and fitted to a spot, the main mass
  leaning to the side's team colour; its infantry carries its crafted weapon; a flyer flies over its shadow. What
  a civilization did not craft (a plain base, barracks, lab) is drawn as before. The panel names the roster's
  units, marks what its tier still locks, and shows the next research; B builds (again for the next building),
  Q W E R train, T researches. Defences, siege and flyers shoot their own effects.
  In the flow: quick `conquer` takes `sides: [player, enemy?]`, each a civilization of the world by its id or one in
  words ("armed attack helicopters, a bronze cannon, swords and crossbows"). The level keeps each side as its
  civilization's own words with the kit, seed and team colour it is tunnelled on (`rts.sides`), and the board reads
  them into rosters and looks as it renders, met through the top-down camera (technology's LOD). A world's bible
  shows, on each civilization's technology page, what it fields in a skirmish: its units, buildings, ladder and the
  ledger of why. The registry holds `power.systems=research`, and the real-time strategy probe asks for it.
- **The skirmish's principles: jobs and capabilities**, built: a building is its capabilities, any of them
  together (a factory training over time, research over time, a stationary unit that shoots, a depot), and one lock
  serves buildings, units and research steps alike (a building standing or a step known, then a tier). Workers
  build at the site: a building laid is a foundation, raised only while workers build it (faster with more); the
  nearest worker goes when none is named, and goes back to mining after. Workers repair buildings and machines,
  paying a gold for every ten hp mended. An idle worker keeps to its work instead of picking fights; the mind trains
  the best its factories have opened and sends a worker to any foundation left unbuilt.
  Fighters without a weapon: what carries, shelters or lifts, unarmed (or what its words call a carrier: a troop
  transport, a shuttle), is a transport: units board it (right-click it), ride where it goes, a flyer's over what
  they cannot cross, and unload (U); what it carries falls with it. What its words call medical (a medic, an
  ambulance) mends its own nearby, never a machine. Each is priced by what it carries or mends.
  Transforms: siege deploys to fire (farther and harder, but still until it packs up: D); a building grows in place
  into another (the base into its civilization's fort once its machines are known, harder and shooting farther: G);
  what technology calls deployable (a deployable sentry turret) comes out of the works folded and is set up where
  it stops. The mind deploys its siege where a foe is in reach and packs it to walk on, and grows its fort last. A
  side counts as spent when nothing more can come (it cannot earn, nothing is queued and nothing is in its purse's
  reach), and a skirmish where neither side can is a draw.
- **The skirmish's abilities and effects**, built: a unit or building is a light, armoured or structure class, and a
  blow is multiplied by its striker's bonus against that class (a polearm or launcher pierces machines, a blade or
  axe cuts the unarmoured, siege on structures); siege bursts, half its blow on those round what it hits. Statuses
  run on a timer: a stun (it does nothing), poison (the tactics battles' too, biting on), a slow, a stim, a shield
  that takes blows first; they come on hit (energy weapons stun every fourth hit, poisoned words poison, frost words
  slow) or are cast (F: stim where its words say berserk or stim, paid in hp; a shield where it carries a field),
  each with its cooldown. A cloaked unit (stealth words) is unseen and untouched but by a detector (a sensor, a dish
  that now watches); auras lift a side's own (a banner) or slow its foes (a jammer); researched upgrades lift a side
  at once (its charged or honed weapons, its plating in its finish). Every one is read from the technology's words
  and dials, said in its ledger, and priced by the same worth formula. On the page each status has a mark on whom
  it is on (a spinning ring for a stun, a ring at the feet for a slow, poison or stim, a bubble for a shield), an
  aura its ring on the ground, a selected unit its reach; a struck unit flashes; a cloaked foe shows only once seen.
  The mind casts when a foe is in sight, trains its latest factory's best first and saves for what a tier opened,
  spends what it has when it can earn no more; a worker stopped between spots by its depot steps back to drop off.
- **The skirmish's tree and economy**, built: past its machines a civilization's research branches (flight opens what
  flies, siege works its siege; the showpieces their own step), and its upgrades run in lines (weapons II, plating II
  after the first and its top tier). A civilization may write its own steps in `technology.research` (what each
  opens of what it crafts, what it follows: a step, by name or as machines / showpieces, or a building it raises; a
  buff across its side), every name it uses read against what it fields and refused with what it could name. The
  mind passes over a step that opens only what it never fields, and saves for one that opens what it does.
  Doctrines, chosen before a skirmish (`rts.doctrine`, quick conquer's `doctrine`): economy (two more workers, a
  tenth more a trip), aggression (fighters a tenth harder and faster), fortress (buildings a quarter sturdier,
  defences a quarter cheaper), science (research a quarter quicker, 15% cheaper); a civilization may name the ones
  it allows (`technology.doctrines`), refused otherwise.
  A second resource, named for what a civilization powers itself with (power, else biomass, else crystal), mined
  from its own nodes a step beyond the gold (`nodes2`, laid by default when a side's things cost it): its machines
  and its research cost some, said with the gold when either is short. A supply cap: each unit takes some (the
  bigger, the more), the base and fort hold some, and quarters (what it crafts that shelters, else plain) hold more;
  a unit past the cap is refused, naming what to raise. The mind keeps a third of its workers on the second
  resource, raises quarters as it nears its cap, and is spent when nothing more can come (a board with no nodes at
  all has nothing to run out of; an idle worker's odd load, or a worker with nothing to mine, is nothing more).
- **The skirmish's clock and hand**, built: every action the player takes goes through the kernel's one way in
  (`act`: an order, a training, a building, a step, an upgrade, a rally, a standing order) and is logged by the
  step it was taken before, so a game replays from its log (`replay`), however the page's frames cut the time. Each
  side's actions a minute (APM, over game time) beside a game clock in the panel, the mind's counted as it plays.
  P pauses; [ and ] slow and speed the clock (half, normal, faster, double). Control groups: Ctrl+1 to 9 keep the
  selection (or a building), Shift adds, the digit takes it again, twice running the camera goes there; `.` selects
  the next idle worker and goes to it. Standing orders: what a kind does when idle (I: a worker waits, gathers at
  the nearest node or repairs, a foundation first; a fighter waits or holds), a factory that repeats what it trains
  while it can pay (Y), a kind that casts its abilities on its own when a foe is in sight (C). A mind plays at a
  level (`rts.level`: easy, normal, hard, or one each side): its workers, its first wave and how fast the next
  grow, its actions a minute (easy is held to 40, a few seconds' worth in hand) and how often it thinks; each
  side's waves now its own.
- **The match**, built: a skirmish played end to end as a match, not a campaign's battle. Expansions
  (`rts.expansions`: up to three fields a side, two nodes and a hall's spot each, the same for both sides, mirrored
  through the board's middle and chosen by `rts.seed`) are claimed by a hall, a second depot that trains workers;
  the mind raises one on the nearest field once its own nodes run low. The victory rule (`rts.victory`): a side
  loses when its base falls, or under the melee rule only when its last building does. A side may give up
  (`act({ k: 'surrender' })`). Each side's match is counted: trained, units lost, raised, buildings lost, mined,
  research done, and its army's worth every ten seconds. The fog (`rts.fog`): each side sees what its units and
  buildings see (a flyer a step farther), keeps the ground it explored and the foe's buildings as it last saw them;
  a unit strikes only what its side sees (a siege out of sight needs a spotter), and the mind plays under the same
  fog, its waves sent where it last saw the foe, else where the foe started, then the fields. On the page the
  unexplored ground is dark, the explored dim, the foe hidden out of sight and its buildings remembered as ghosts.
  A match (`rts.match`, quick conquer's `match: true`) is the closed loop: a lobby before the clock (your side and
  the opponent's: as minted, the other's, the plain tables or random; the opponent's level; the purse; the workers;
  the victory rule; the fog), the match under the fog and the melee rule with a field a side unless said, End twice
  to give up, then the results (the winner, the time, each side's count, its APM and its army over time) with
  Rematch (the same setup, its fields laid anew by the next seed), New match (the lobby) and Leave (the level ends as
  the last match went). The lobby's choices are the match's setup (`setup`), so a match replays from them and its log.
- **The command card**, built: the skirmish is commanded as an RTS is. Clicking a building shows it (its health,
  queue with progress, research, upgrade, rally, repeat); clicking a unit shows it (health, attack, range, speed,
  armour, statuses, cooldowns, its idle rule); a box dragged over the ground picks the player's units, never
  buildings, shown a tile each (a click on one picks it). Beside it a command card of buttons, each with its hotkey:
  Move, Stop, Hold, Attack, Attack-move and Patrol for units, then what the kind can (its abilities, Unload, Deploy,
  Build, Gather, Repair); train, research, upgrade, repeat and rally for a building. A command that needs a target
  arms the next click on the board; a button that cannot act says why. Patrol is a new order: an attack-move back and
  forth between where the units were and where they were sent. Every action's key can be rebound in the card's Keys
  panel (kept in the browser), and a game may set its own defaults (`rts.keys`).
- **The genre sweep asks for it, and now finds it.** Probes for a tactics game and a real-time strategy game, and
  registry values for what the board makes: the board's spots, the tactical camera, tactics combat, the epoch map
  (`progression: map`) and its chapters (`chapters: epochs`), scenes told on the board (`shots: board`), the maze
  defence's placement (`systems: maze`) and the summons. The tactics probe asks for FFT's whole shape and is
  makeable; so is the real-time strategy probe, with unit orders built (`systems: orders`). Re-swept on
  `docs/tool-surface/hillclimb.md`: more rolled worlds makeable, the board no longer the top gap.

- **The board kernel** (`lib/graph/board/board-kernel.js`), built: square spots with heights and terrain types, one
  unit a spot; reach by move and jump (through allies, never foes); aim (a diamond or a line, between a reach's
  bounds, within a height) and area; facing (a blow from the side or behind hits harder) and height; every legal
  move listed, ending always among them. The turn is FFT's: move once and act once, in either order, then face; a
  charge-time clock on the party battles' timeline rule, a turn costing less for not moving or not acting. Blows
  follow the party battles' formula. Pure and seeded, a self-contained closure a page can carry.
- **Boards from a geocube** (`lib/graph/board/board-lay.js`), built, indoors and out:
  - a diorama the cube paints: seeded columns in whole steps, banded a step at a time so a height reads at a
    glance, grass and stone outside, floor and trim inside, water optional;
  - over the cube's rooms: spots on the floor, props shutting theirs, the rooms joined only through their
    doorways;
  - over the cube's land (a trail's valley by default): heights and types read off the ground, trees shutting
    their spots, laid inside the site where the most ground can be stood on.
- **The board on the World page**, built: a `board` world kind (`{ board, units, camera, cursor }`) shows a board over
  its ground with a faint grid of its spots, highlights for reach, aim and area, a cursor and the units, and plays it
  with **the tactical camera**: a locked pitch with two stops, quarter turns (Q / E), zoom stops (Z / X or the
  wheel), the cursor moving the way the screen shows whichever way the view is turned. The widest stop holds the
  whole board; the closer ones follow the cursor. Selecting a unit shows its reach from the board kernel, and moving
  it hops the kernel's path. A room is seen as a dollhouse (no ceiling, its walls cut at the waist); over land the
  overlay drapes on the ground. An RTS form pans and scrolls at the edge instead of turning. A page without a board
  keeps every byte. The `board` input scheme names its keys.
- **Battles on the board**, built: a board world kind's `battle` (`{ party, foes, bag?, players? }`) is played on
  the page. The party stands in its classes and the foes by preset, read from the party battles' own book (stats,
  gear, skills, weaknesses), with only the board's numbers added: how far each moves and climbs, the shape of each
  skill (a blow the next spot, a spell four, a mending three, an area for many). Skills, items, statuses and buffs
  work as in party battles, and a blow lands for exactly what a party battle's would on the same dice; from the side or
  behind it lands harder (a spell lands the same from anywhere). The player's units take a menu (Move, Act, Wait,
  then a facing) with the reach and aim shown and a forecast of each act; the other side is a plain mind that weighs
  every spot and act. A turn-order bar, the active unit's card, numbers off the units, and the level hears
  `board-won` or `board-lost`. Classes and humanoid foes stand as figures that walk spot to spot; beasts stay tokens.
- **Tactics games through the game book**, built: `battles: { on: 'board' }` makes each stage that meets packs a
  battle level, fought on spots laid over the stage's own ground, indoors or out (any level can carry a `board`). The
  book's party (the hero and the cast who join, standing as themselves) deploys on the near rows, up to four, before
  the first turn; the stage's packs stand in the far rows. A battle is won when every foe is down (or by its rules: a
  leader down, turns survived, a guest to protect) and lost when the hero falls; the level ends there (the `board`
  mechanic). The party is carried as party battles carry it: each battle stands it as the store has it, at full HP,
  and puts its spoils back (xp, class points and the skills they teach, gold, drops), counted exactly as party battles
  count them. FFT's permadeath countdown is a rule, off by default. A world whose intent fights tactics gets board
  battles without writing them.
- **The epoch map**, built: a tactics book is travelled from a map, its first level: a diorama in the first stage's
  geocube, each stage a dot on it in story order (a battle or a story stop), joined by roads laid spot by spot. A dot
  opens when the one before it is won; the party's marker walks the open roads to the dot chosen, and the map is left
  by that dot (the `map` mechanic). Every dot's level, when won, goes back to the map, where the party stands at the
  dot it came from.
- **Epochs**, built: a tactics book is played in epochs (chapters), each with its own map. By default each of the
  book's levels is an epoch; `battles.board.epochs` cuts them into chapters of its own. Winning an epoch's last stage
  goes on to the next epoch's map, the party and bag carried; a later epoch's skirmishes draw from the harder packs
  met by then. The final epoch's last stage completes the game, and its map stays open for what is left.
- **Story slots**, built: places in a tactics game where a scene or dialogue goes, empty until the story fills them.
  A battle holds for a scene before its first turn and after its win (the level ends once it has played); a walked
  stage plays its before at its start and its after at its exit; an epoch's map plays its begin as it opens, once a
  game, and an epoch's end follows its last stage's own after. The book fills one with a story moment
  (`when: { slot }`, `where: { level }` or `where: { epoch }`), bound and reported as other moments are. A slot
  nobody fills adds nothing to the page.
- **Scenes told on the board**, built: a scene's shot on a board cuts the tactical camera to whoever it names (a unit,
  a dot, the party on a map, a spot), turned to see them from the front, and gives the player's view back after. The
  words float over whoever speaks, a speaking figure gestures, and `talk: { portrait: true }` (on a board, or the
  book's `battles.board.talk`) adds a close portrait of the speaker, their own figure drawn live beside the words. The
  camera also shakes (the same way every time) and orbits, for what comes next.
- **Special animations on the board**, built: every act plays on the map itself (a spell its element's effect: fire
  rises in a pillar, ice spikes from the ground, a bolt falls; a mending glows, a blow sparks), and its numbers land
  with its strike. Effects are timelines of camera moves (shake, orbit, a shot), light (the world dimmed, a flash) and
  3D pieces (rings, rune circles, pillars, orbs, shards, spikes, bolts), seeded, so the same act plays the same way. A
  scene plays one by the bus (`fx:quake:<who>`, `fx:meteor`).
- **Summons**, built: a summoner class (the board's own book beside the party battles' presets) calls five beings,
  each built in 3D and animated on the map: an inferno giant raining fire, a glacier colossus raising ice, a tempest
  crown calling bolts, a stone colossus whose fist quakes the ground, a wyrm of light that circles and breathes. The
  world dims, the camera circles the place, the map shakes; then the view settles back on its quarter. A summon hurts
  exactly as the party battles' formula says. Any member may know one (`skills`); a book gives the class with
  `battles.party.<id>.class: 'summoner'`.
- **A game's final level** (`final` on `create_game`, the light shell): its first win completes the game. The front's
  end plays (or the result says the game is complete) instead of travelling on, and the game counts as cleared by
  that level alone, not every level. A game without one is unchanged.
- **Skirmishes to fight again**, built: each area of the map gets a skirmish dot after its first battle, open once
  that battle is won and fought as often as the party likes. A skirmish draws its foes from the book's packs when it
  starts, scaled to the party (its mean level, give or take one); win and the next visit meets another pack, lose and
  the same one waits. Any board battle can draw (`draw`: packs, weakest first, in place of `foes`);
  `battles.board.skirmish: false` leaves them off.
- **Tower defence on the board**, built: a board's `td` (or the quick path's `defend` with `board: true`) is a tower
  defence on its spots. Foes come in waves from gates in the far row and walk to the base in the near row; towers
  (arrow: long range; cannon: a blast on everyone near; frost: slows) stand on any free spot, paid from the purse,
  and the road bends round them. A tower may only stand where every gate, and every foe already walking, still has a
  way to the base, so the player runs out of spots as well as gold. Bounties pay for kills, a tower sells for half,
  and the next wave can be called early for gold. Foes reaching the base cost lives; holding every wave wins the
  level. Its own kernel (`board-td.js`), the same game in Node and on the page: no dice, a fixed step. Seen from
  above as a commander would (the camera pans and scrolls at the edge). Without `board`, `defend` is the trail's as
  before.

### Traditional board games: a board world of tiles, pieces and rules

Board games composed, not coded: a board is a connection of tiles, and chess, checkers and euro games of resources,
dice and trading are put together from the same systems and meeples (pieces, move rules, turns and exceptions; places,
resources, building, cards, trading, scores), played against the computer. The book holds only games nobody owns: a
published game asked for by name is written out from the rules the person explains, never guessed. The board is
abstract (representational state, heights allowed, no map yet), drawn as an SVG plan and, where it is good enough,
in CSS 3D. In progress:

- **The lattice** (`lib/graph/polygonizer/lattice.js`), built: mandala-space tiled. Square and hex boards (pointy or
  flat, a rectangle or a hexagon of hexes, carved by holes or a heights grid) as cells, corners and edges with shared
  ids, so a piece can stand on a cell, a corner (a settlement) or an edge (a road). The relations are explicit: each
  cell's neighbour by direction, in manji names (N E S W on a square; E NE NW W SW SE on a pointy hex), its corners
  and edges in order round it, each corner's cells and edges, each edge's two corners and its cells. Heights stand on
  the meru. Cells are named as on a chessboard (`C4`), a corner or an edge by any cell it touches and the way to it
  (`C4.ne`), every alias the same record. Lattice vectors move on it (a step, a slide until the board or a hole
  ends it, a jump) and turn and mirror with the board, so a piece's moves are one vector under the board's symmetry:
  a knight is eight moves from one, and the same piece plays on a hex. The relations' invariants are checked
  (`latticeLaws`), and Euler counts the holes.
- **The board drawn** (`lattice-svg.js`, `lattice-css3d.js`), built: the plan as SVG (cells in the board's own
  colouring, corners, edges and names, highlights over them), and the board in CSS 3D, a top a cell, sides where a
  cell stands above its neighbour or the rim, a seat at the table and a view from above.
- **The tabletop kernel** (`lib/graph/tabletop/tabletop-kernel.js`), built: a game as a pure function of its moves,
  composed from data. A piece is what it can do: a vector (or a way) under the board's symmetry, stepped, slid or
  leapt, landing on an empty cell, a foe or either, the cells it crosses empty, held by a foe or anything, taking what
  it lands on, what it jumps or what left a mark. Exceptions are conditions (unmoved, a row counted from the player's
  own side, a mark the last move left), marks, a partner piece that moves with it and a path that must not be
  attacked; promotion offers each piece a pawn may become; a chain lets the same piece go again (a multi-jump). A
  rule is written once for the first player and turned to face each other one. The game's rules: a royal piece that
  may not be left attacked (mate and stalemate follow), compulsory capture, no move loses or draws, repetition, a
  quiet count, a turn cap, moves a turn and passing, and a clock (base, increment, delay) that spends the time the
  page measured, the kernel never reading one. One self-contained closure, as the strategy board's, so a page can
  carry it.
- **Chess and checkers as data** (`lib/graph/tabletop/games/`), built: written in those words alone, chess with
  castling, en passant, promotion, check, the fifty-move rule and threefold repetition, and English draughts with
  compulsory and chained jumps and crowning. A chess position loads from FEN. Their move counts match the published
  perft tables (chess from the start, Kiwipete and the standard test positions; checkers from the start).
- **The computer across the table** (`lib/graph/tabletop/tabletop-mind.js`), built: alpha-beta over the kernel's
  moves, captures followed past the horizon, scored by what the game declares (its pieces' values, a promoting
  piece's progress, the middle of the board), three levels (easy, fair, hard) by depth and by how far below the best
  a pick may fall. Bounded by a count of positions, never a clock, with seeded dice between equal moves: the same
  position and seed give the same move on any machine. A closure over the kernel, so a page carries both. The attack
  test walks each capturing rule backwards from the square, which made the search about three times faster.
- **The game to play** (`lib/graph/tabletop/tabletop-page.js`), built: one self-contained page against the computer,
  carrying the board, the game, the kernel and the mind. Two views of one board: the plan (SVG) and the table (CSS 3D,
  every cell's top a div played by clicking, a piece a token that slides from cell to cell). Select a piece to see
  where it may go, a promotion picker, the last move marked, check and the outcome in the status, the move list, undo,
  a new game, the level (easy, fair, hard), and the clocks when the game has one (the page measures a move's time and
  hands the kernel the number). The person sits at their own side: playing black turns the plan and the table.
- **The economy** (the tabletop kernel, grown), built: a game with building, dice or an opening is played on places,
  a cell, a corner or an edge, so a settlement stands on a corner and a road on an edge. Stocks (a player's pieces
  off the board), hands and a bank, costs; building as data, with conditions over the place graph (no building within
  so many steps, beside the player's own kinds, a road reaching from the player's net and not through a foe's
  settlement) and upgrades (a city on a settlement). Seeded dice at the turn's start; production (each hex showing
  the roll pays the pieces on its corners, not under the robber, the bank's shortage rule); rolls that do something
  else (a seven: half a hand over seven given up, the robber moved, a card stolen). Forced choices queue, even out of
  turn, one move at a time. Decks shuffled from the seed, cards bought and held, played one a turn and never the turn
  bought, their effects in a few verbs (the robber, free placements, gain from the bank, claim from every other
  player). An opening in rounds (the snake), then roll and build. Scores from pieces, cards and awards (the longest
  trail of a kind, broken by a foe's building; the most of a card played), a win on one's own turn. A view per player
  deals what it cannot see again from what is unseen, so a computer never reads a hidden card or the dice ahead. A
  bank exchange is an option. Chess and checkers keep their counts.
- **The deal**, built: a system for a seeded setup. Cell types and numbers shuffled onto the board from the game's
  seed, numberless types left bare, chosen numbers kept off neighbouring cells, neutral pieces set on a type; the same
  seed, the same board.
- **Trading between players**, built: a system (`trade: { offers, shapes }`). After the roll the player to move offers
  any whole cards it holds for others; each other player answers in turn, accepting only what it can pay; the offerer
  deals with one who accepted or calls it off; a few offers a turn, so a game always ends. The computer answers by
  expected value and the table: what the trade does for its own position (points, income, hand, and how many rolls
  it now stands from its next build) less what it does for the offerer's, weighed heavier when the offerer is ahead
  of it and heavier again when the offerer leads, and never a trade with a player two points from winning. It offers
  only what it foresees accepted and helpful, and deals with the partner its own position likes best. Four computers
  with trading finish a dealt island in fewer turns than without (56, 128 and 66 turns against 96, 114 and 107 on
  three seeds).
- **An island economy, as a test fixture** (`lib/graph/tabletop/fixtures/island-economy.js`), built: nineteen hexes
  dealt by the deal system, settlements, cities and roads, dice, production and the seven's robber, development cards,
  the longest road and the largest army, an opening in rounds, and trading when asked: written in the systems alone,
  the way a person's own rules would be once explained. Not in the book and not reachable from the tools.
- **The computer at a euro game**, built: a turn planner. From its own view it weighs lines of its own actions this
  turn, the best few at each step, each forced choice on the way taken greedily, and plays the first action of the
  best line. A seat's worth is its points, what its pieces earn a roll (a spread of resources over a pile), its hand,
  the builds it can pay for, the corners it can settle next, its cards, its army and its road, less a share of the
  leader's. Four computers play a dealt island to a winner.
- **A euro game to play** (`lib/graph/tabletop/tabletop-euro-page.js`), built: the same page for a euro game. The island
  on the plan and the table, its numbers, the pieces in the players' colours; the corners, edges and hexes that can
  be taken now marked and clicked; the person's hand and cards, the roll, the builds, buying and playing cards, and
  the forced choices as prompts (what to give up, where the robber goes, whom to rob); every seat's open points,
  cards and awards; a log; with trading, an offer drafted card by card (checked by the kernel's own rule), the
  computers' offers to accept or decline, and the partner chosen from those who accepted. The computers play their
  turns a beat apart, so their moves can be followed.
- **Meeple shapes** (`lib/graph/tabletop/tabletop-shapes.js`, `tabletop-bodies.js`), built: a piece given a body, not
  only a cube or a flat token. A shape is a cut-out with thickness (a meeple, a house, a city, a tower, a barn, a ship,
  a horse's head), a turned profile (a checker, a stack, the chess set, a robber), a box (a cube, a road) or a group
  of those, named from a shelf or written out in cell units. The table view stands each piece as a body of panels lit
  in its owner's colour and turned to face its player, a road lying along its edge; the plan draws each piece's side
  silhouette, as a diagram does. A turned piece's tapering bands are unmasked rectangles, so a full chess set of 32
  bodies draws in a few seconds where masked bands took minutes. Chess, checkers and the island economy wear them; a
  shape is checked when the game is made.
- **Placement and groups**, built: pieces put down rather than moved. A kind may be dropped from the player's stock onto
  an empty cell, falling a way until something stops it, or turning the lines of foes it closes. One groups engine
  (a side's pieces joined across edges, and the empty cells beside them) serves enclosure (a group with no empty
  neighbour is taken; no suicide; no ko: the board may not return to how it stood before the other player's move),
  connection (a group joining a player's own two sides wins) and the scorers. A line of k along any axis wins.
  Passes in a row or a full board end a game by its points: pieces counted, territory (empty areas one side alone
  borders), majorities in named regions (first and second, ties sharing the places' points), the largest group, an
  added half point. A rhombus of hexes joins the lattice. The computer reads each game by what wins it: open lines
  toward k, the shortest way left to join two sides, groups down to their last empty neighbour, and the game's own
  points; it narrows a wide board to the cells near the play. Five fixtures, each named by its principle (enclosure,
  lines with and without falling, connection, sandwiching, majorities), are played by clicking on the plan or the
  table, with a pass, the score in the status and the regions tinted.
- **Tile placement**, built: a board grown a tile at a time. Tile types are segments of feature types over a tile's
  edges (an area, a line) or its centre; tiles come from a seeded bag, one drawn a turn, laid beside the laid ones,
  turned any of the board's turns, every shared edge's label matching (square or hex alike); a tile that fits nowhere
  is set aside. A segment of the tile just laid may be claimed with a piece from stock if its feature has none. A
  feature (segments joined across edges) with no open edge pays at once, its tiles times its rate, to the most claims
  in it, a tie paying each, and its claims return; a centre feature is done when every cell round it is laid. An empty
  bag ends the game, open features paying their lower rate. A player's view deals the bag again. The computer weighs
  every placement and turn with the best claim it allows: points, each feature it leads at its chance of being done,
  a claim in hand worth more the fuller the bag, less a share of the leader's. A tile-placement fixture named by its
  principle (walls, paths, shrines). The page draws each tile from its segments on the plan (cropped to what is laid)
  and on the table (the art on the cell's top, claims as standing bodies, the view following the play); the drawn tile
  is turned by hand and laid where it fits, then a claim chosen or not.
- **Piles, hands and markets**, built: card games, with no board (`piles`). Card types are data (a cost, coins, points, a
  treasure, effects to play in a few verbs: draw, coins, actions, buys, points, gain a card up to a cost, trash from
  the hand; tags). Each player has a deck, a hand, a discard, the cards played this turn and a tableau; a supply of
  piles and a market, a row face up refilled from its own seeded deck. Deck building: a hand drawn, treasures played
  freely and others for one of the turn's actions, buys into the discard, the turn's cards to the discard and a new
  hand, the discard shuffled into a deck when it runs out; a gain or a trash owed is chosen one card at a time.
  Drafting: a turn takes one card from the row to the tableau. Set collection scorers: the cards' points, different
  values of a tag held, the same value held so many times, a tag's numbers summed, the most of a value (a tie sharing
  the bonus). The game ends as a turn ends (a pile gone, so many piles gone, the market empty, a turn count). A
  player's view keeps its own hand and deals deck order, the others' hands and the market's deck again. The computer
  plays what leaves its turn the most to buy with (an action that keeps the actions going first), then buys what
  leaves its seat worth most: its points weighed more as the end nears, the average hand its deck draws weighed less;
  at a draft, the card worth most to it less half the next seat's best take. Against fixed strategies (a money-only
  buyer, a buyer of the dearest card) it wins about half its games; it beats random play every time. Two fixtures
  named by principle (deck building; drafting and set collection), played on a card page: the supply and the market
  lit where a buy, a take or a gain may go, the hand lit where a play or a trash may, the others' piles as counts and
  their tableaux face up, actions, buys and coins, every seat's points as the game scores them now, a log.
- **The engine, stage 1: one object model**, built. The thesis behind the next stages: every board game is the same
  duel of objects (things with characteristics in zones; a turn of phases; windows to act; a chain of responses;
  triggers; world effects; rules checked between actions), so the kernel grows that engine rather than one feature per
  paradigm. Stage 1 unifies what things are. Every piece, card and laid tile is now an object in one table: a board
  piece as before, a card in its owner's zones (deck, hand, discard, played, tableau; zones hold object ids in order),
  a laid tile and a claim at their cell, an economy card held or played. A shared supply of like things (a supply
  pile, a bag of tiles, a bank, a stock of meeples) stays counted by kind until one comes out of it. Pieces, card types,
  tile types and economy cards share one namespace (a name used twice is refused). One function derives an object's
  characteristics: its definition, then its modifiers in a fixed order (set, add, counters, grant and remove
  abilities, by timestamp within each); with no counters and no modifiers it is the definition itself, so a game that
  uses neither pays nothing, and an object leaving play keeps none of them. Machine gates: the seeded mind-against-mind
  games of every mode (chess, enclosure, tiles, deck building, drafting, three island games, one with trading) replay
  move for move as before the change; perft's counts and time are unchanged; the kernel grew by 8.7 per cent.
- **The engine, stage 2: rounds of phases, sealed choices and utilization**, built. A game with `round` is played in
  rounds, each a list of phases written as data: taken in turns from the first seat while anyone can act, together
  (each player's choice sealed and hidden from every other player's view, all revealed and resolved at once, the
  phase repeating while what it acts on lasts), or by itself (workers made ready, cards dealt, a lot revealed, upkeep
  paid, lots nobody took cleared). Its moves: a worker placed on a space (exhausted; a space holds so many; its
  effects at once: resources, points, another worker, the first seat), a sealed bid (the highest pays and takes the
  lot, a tie to the first in order, nothing on all zeros), a sealed pick (kept, the hands passed on), a pass. Workers
  are objects; resources are pools that carry over; cards and their scorers are the card mode's; the first seat may
  pass on each round. **Utilization**: capacity that expires (a deck turn's actions, buys and coins; workers in a
  round) is kept in a ledger per player, spent and idle (left when it expired while a move could still have spent
  it), and `utilization` reports the share used. The computer optimizes it (a small term preferring capacity used
  over idle when worths are close) and is tuned by it: a level's `use` is how often an option that spends capacity is
  seen at all, so a weaker computer leaves capacity idle where idling is allowed and misplaces where spending is
  forced, the way a weaker player forgets the card in hand (easy 0.7, fair 0.92, hard 1). The computer in a round
  game places a worker where its seat's worth gains most (resources valued by the game's own conversions, upkeep and
  end rates; workers by the spaces' yield for the rounds left), bids by expected value (the lot's worth to it, the
  coins, whether it beats what each rival would pay by the same reckoning, half a rival's gain), and picks what is
  worth most to it less half what the next seat could take from the hand it passes. Three fixtures named by
  principle (worker placement, sealed bids, drafting by passing) and a round page (spaces and their workers, the lot
  and the bids, the hand, pools, every seat's points and utilization, sealed choices shown only as made until
  revealed). Machine gates: hard beats easy 12 of 12 deck games, easy using 72 per cent of its capacity to hard's 96,
  and hard beats easy 9 of 10 worker games; the computer beats random play in every round paradigm; chess,
  enclosure, tiles, drafting and the island games replay move for move as before; perft unchanged; the kernel grew
  to 103,295 bytes (from 85,992) and the mind to 31,575 (from 24,059).
- **The engine, stage 3: a player's own turn, the chain, the initiative and triggers**, built. A round game may give
  each seat a turn of its own (`round.turn`): auto phases acting for the player whose turn it is (ready its objects,
  a pool that grows by one each turn and is refilled, what was left gone; a draw; damage mended) and an active phase
  where it casts cards and uses abilities. Players have a deck, a hand, a discard and a field. A summon enters the
  field exhausted; a spell resolves and goes to the discard; an ability may exhaust its object and cost from a pool.
  Everything cast or used goes on the chain, resolved last in, first out. After a link goes on, the initiative passes
  round, but only to a player who can answer (a fast card it can pay for, a fast ability), never to the one whose own
  link is on top; when all have passed the top link resolves, and with nobody able to answer, links resolve at once,
  so neither a person nor the computer is asked to pass for nothing. Triggers (enters, dies, at its controller's turn
  start, when a foe casts) go on after each action, the active player's first. Checks between actions: damage
  reaching guard kills, a player at the floor of its `lose` pool loses. One target chosen at casting, skipped if gone
  by resolution; a counter cancels the spell beneath it; an ability's power is the source's as it was when used. A
  loop guard: past `cap` actions in a turn or a hundred links, a draw. Energy left at a turn's end while a card could
  have been paid for is idle (utilization). The overlooking dial now holds for the whole turn, decided by a hash of
  the game, the turn, the seat and the option (a forgotten card stays forgotten), so in the deck game hard beats easy
  10 of 10 (95 per cent used against 70). The computer: a duel planner that plays each move and settles the chain
  before weighing the seat (life, the field's power and guard, the hand), and Monte Carlo tree search for any game,
  seeded and bounded by playouts, each from a fresh determinization of its own view, opt in by `search: 'mcts'`. A
  fixture by principle, a response duel (summons, spells, fast answers, a fast ability, four kinds of trigger, a
  counter, strikes), and the round page grown for it (fields, the chain top first, targets, answer or pass). Machine
  gates: forty random duels keep every invariant (each card in one zone, its zone its list, the chain's cards nowhere
  else, no negative pool, no stall); the duel planner beats random play 11 of 12 and hard beats easy 9 of 12; search
  wins 4 of 10 against the planner at about 67 ms a move (it stays opt in); every other mode replays move for move
  except where the dial plays (deck building, worker placement); perft unchanged; the kernel grew to 120,163 bytes
  and the mind to 38,442. A test now refuses two top-level declarations of one name in either closure (a second
  `settle` had silently replaced the first). Re-expressing the existing modes' turn loops as phases was dropped: none
  needs a response window.
- **The engine, stage 4: world effects, counters, ready and exhausted**, built. An object's characteristics now
  gather the world effects that cover it: static abilities of objects in play (an aura on one's own summons, a curse
  on the foe's, a cost cut on the hand) and the game's own (`world`). They apply in one fixed order, written down and
  not pretending to be layered: set, then add (numbers, or objects of numbers summed key by key, a cost never below
  nothing), then counters, then grant and remove abilities, by timestamp within each (the time a source entered play,
  or a modifier was made). A world effect's sources are read from their definitions and their own modifiers, never
  from other world effects, so nothing depends on anything; copies and changes of control are left out. A game with
  no static ability takes the shared definition as before. Effects gain a boost (lasting, or until the turn ends,
  when it is taken off), counters placed or removed, and readying; an ability may cost counters from its own object,
  and a card may enter play with counters (a wand with three charges); a step may empty a pool; damage never goes
  below nothing. Utilization gains ready objects: a summon left ready at the turn's end while it could have struck is
  idle, so the dial now reaches forgotten strikes (in the duel hard beats easy 11 of 12, easy using 84 per cent). The
  duel grows eight cards that use each (an aura, a foe aura, a cost cut, a rally until the turn ends, growth
  counters, a charged wand, a readying spell, a curse that sets power and strips abilities), and the page shows stats
  as derived (raised green, lowered brown) and counters. Machine gates: forty random duels keep every invariant with
  the new cards; every other mode replays move for move as before (the world-effect path costs nothing where there is
  none); perft unchanged; the kernel grew to 125,634 bytes.
- **The engine, stage 5: fixtures that join the systems**, built. *A summoning duel on a board*: a turn game given
  a board puts its summons on the lattice. A summon card names a piece, whose rules (vectors under the board's
  symmetry, as chess's) move it; it is cast onto an empty cell of its controller's home row; a ready summon goes (a
  move onto an empty cell, which simply happens) or attacks (a move onto a foe, which goes on the chain so the foe can
  answer before blows land), either exhausting it; blows are struck together, each its power, and an attacker takes
  the cell of a defender that dies; an ability may need its object's row, so a summon strikes the foe only from the
  far row; a summon leaving play leaves its cell. The fixture (footmen, outriders that leap as knights, lancers that
  charge forward two, a captain's aura, bolts, a counter, a snare) on a five by five board. *Deck building on the turn
  engine*: the card mode's deck game built from its own cards and played on turns, a treasure a card cast for
  nothing that gives coins, an action costing one of the turn's actions, buying a move from a counted supply (a
  card's price, one of the buy pool), cast cards waiting in play until cleanup, a step that discards the hand and
  what was played, pools set each turn, the discard reshuffled into the deck when it runs out, the game ended by the
  supply's piles, every owned card scored (the cards that trash or gain, a choice of several cards, are left out). A
  scripted turn gives the same coins, the same purchase, the same discard and the same next hand in both engines.
  *Worker placement as exhaust and ready* had already been built so in stage 2. The round page shows the board (the
  summons standing on their cells; a summon picked lights where it may go, green, and whom it may attack, red; a
  summon cast lights the cells it may enter), a supply to buy from, and card faces drawn from data (a summon's piece's
  silhouette, a card's glyph); a cell's name no longer swallows the click meant for its cell. Machine gates: thirty
  board duels, random and computer, keep every board invariant (a cell's object stands there, a summon in play stands
  on its cell, nothing off the field holds one); on the board the computer beats random play 12 of 12 and hard beats
  easy 8 of 12; on turns deck building the computer beats random 6 of 6 and hard beats easy 6 of 6; every other mode,
  the response duel too, replays move for move; perft unchanged; the kernel grew to 132,580 bytes and the mind to
  42,449.
- **The engine, stage 6: Monte Carlo search as the third mind**, built, and placed where it measured stronger. The
  search gains priors (the game's own judgement one move deep orders the untried moves and biases the choice, fading
  with visits; a move legal only in some deals of what is hidden counts as even) and centred values (a worth counted
  as its change since the root, so a game whose worths run large is not flattened). Measured against each game's
  hard planner: tiles 9 of 12 (500 playouts, about a second a move), placement whose drops flip lines 8 of 8 (the
  planner's terms do not read it), four in a row about even, the duels about even at fifty to three hundred times
  the cost, deck building and connection and enclosure lost (long one-player turns it could not order; alpha-beta
  with the game's own terms on small perfect-information boards). So hard (`search: 'auto'`) searches the tile game
  (400 playouts) and games whose drops flip, and keeps the planners everywhere else; easier levels keep the
  planners, which carry the difficulty dials; a written game may decide for itself (`mind: { search: 'mcts' | 'plan',
  playouts }`). Seeded and bounded by playouts, never a clock: the same position and seed give the same move. On the
  tile page the computer at hard takes about a second and a half a turn in the browser. Every game at fair replays
  move for move as before.
- **The door** (`create_game`'s `tabletop`), built: `create_game({ title, tabletop: { game } })` makes a board game
  against the computer, chess or checkers from the book or a game written out from the systems, with the person's
  side, the level, the view, a seed and a clock. A published game asked for by name sends the agent to ask the person
  for its rules first. It is a recipe: a game row (`engine:
  'tabletop'`) whose page is made again on every read, played at `/api/sketches/<ref>/game`, edited with
  `update_sketch` (the kernel checks the edit) and exported by `export_game` as one page and its recipe. A game the
  kernel cannot play is refused when it is made. A routing card, two routing rows, and a vocab card
  (`get_game_vocab({ id: 'tabletop' })`) with the systems' grammar and the book's own chess pieces; the cosmos registry's board
  learns `lattice`. The `tools/list` payload pin is raised for the one schema property.

### Mobile genres

- **Swipe.** One reader turns a finger's flick into a tap or a direction, shared by every touch game.
- **A match-3 saga.** `create_pixelizer_game({ reducer: 'stone-saga' })` makes Philosopher's Stone a saga: a map of
  levels (thirty by default, `saga: { seed, levels }`), each a few moves to reach a score or to dissolve so many of one
  reagent, with a bonus for every move left and up to three stars. The map opens a level at a time and remembers the
  stars in the browser; there are no lives, a level is retried as often as you like. The map is made from the
  recipe's seed (the title's, unless you name one), so the same game is the same map everywhere, and its curve was
  measured against a steady player: the first levels are generous, the last leave little to spare. A gem is swiped
  toward its neighbour, or tapped twice. Philosopher's Stone without a saga is unchanged.
- **An endless runner.** `design_game({ quick: { goal: 'runner' } })` makes a game where your hero runs on its own down
  three lanes, faster and faster: swipe left or right to change lane, up to jump a hurdle, down to slide under a bar
  (A / D, Space and S on a keyboard), and take the coins. The rows come from the level's seed as you run, each with a
  way through; a crash ends the run and the best score and distance are kept. `distance: n` makes reaching it the win;
  `runner: { lanes, speed, max, palette, … }` tunes the run. A level of a world can be a run too (`levels.<id>.runner`).
  It plays in the browser (not in an engine export). Worlds without a runner are unchanged.
- **What can be made, measured.** The capability page gains the two genres: the endless runner is makeable; the
  match-3 saga is made by Stone Saga, and a world game's levels taking stars and a map is the next step it names.

### Resolution lock

- **A game is made for a screen.** A gameworld's `screen` (beside `camera`; `quick.screen` too) names the screen it is
  designed for: `'phone'` (upright, 9:16), `'tablet'` (an iPad on its side, 4:3; `{ pole: 'tablet', orientation:
  'portrait' }` stands it up), `'screen'` (a monitor, 16:9), or `{ aspect: [w, h] }`. A new game `design_game` starts
  is made for a phone unless another screen is named; `screen: null` asks for none. A stored game without one plays
  exactly as it did.
- **The frame is held.** Each level plays in the screen's frame, the least a player sees: a longer device shows more
  world along the frame's long axis (up to a third more), and bars past that or on a shorter device. The camera's
  field of view across the frame's short side never changes, so an upright phone keeps the view it was designed with.
  The game's pages leave room for the notch and the home bar.
- **The gates measure it.** The first-frame check and traversals render each level at its screen's frame.
- **Cameras framed for an upright screen.** On a phone (or any upright frame) each camera is framed by its kind, never
  by genre: a chase camera is pulled back and looks a little higher, so the hero stands about a third of the way up
  the screen, clear of the thumbs, with the way ahead above; the top-down and side cameras pull back; the view across
  the width narrows so the screen's height does not stretch. A frame on its side plays every camera as authored.
  `screen: { pole: 'phone', fov }` names the view across the short side yourself.
- **Touch controls.** A game made for a screen draws a touch pad on a touch device: a stick that rises where the left
  thumb lands, a look zone the right thumb drags (a first-person camera, a craft), and the buttons the hero answers
  to (jump; up and down in flight; fire when armed; use while standing where something is used). The layout follows
  the hero's kind of movement and the camera, never the genre: a side-scroller's stick runs left and right only. The
  pad is a gamepad drawn on the screen, so a remapped gamepad control moves with it, and a real gamepad, once
  connected, takes over. `?touch=1` shows it on any device, `?touch=0` hides it.
- **The screens laid out for it.** A game made for a screen lays out its UI once by that screen, never per game. The
  HUD's corners stay clear of the notch and the home bar, and its bottom row rises over the touch pad while the pad
  shows. Upright, a long banner wraps to the width, the battle menu stacks, and the title screen stands its title and
  menu at the foot of the screen in reach of the thumbs, with the cover above. On touch, the level's control hint and
  the pause sheet say what the thumbs do instead of naming keys, and the pad steps aside while a menu, a battle or the
  journal is open.
- **The exports carry it.** The desktop app opens in the screen's shape (a phone game upright at 450×800, a monitor
  game at 1280×720). The Godot project holds the frame (`[display]`: the base viewport, `canvas_items` + `expand`, the
  handheld orientation), and its kernel (0.30.0) keeps an upright game's view across the width, as the browser does.
  Roblox does not carry the screen: `screen` is a World page input marked approximated in Godot (the project file
  holds the frame; the touch pad and the safe-area zones are the page's) and absent in Roblox, and an endless run is
  the page's in both (`runner`, and the runner mechanic, whose events only the page's lanes send).
  The level cameras every engine reads take the screen's view. The Unity and Unreal guides add the two steps that match
  the editor's play view and a mobile build's orientation. The touch pad and the screen's UI layout stay in the browser.
- **Told when a screen fits badly.** A side-scroller or a fight on an upright phone is advised in the run's readout
  (a tablet or a screen frames them better); it is never refused.

## [3.1.1] - 2026-10-16

The first published release of the 3.1 line. `mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is
deprecated (npm refuses to unpublish a package others depend on); no `mojulo-ui` 3.1.0 exists. Where this changelog
and the code say 3.1.0 for a change, it first ships here.

3.1 turns mojulo toward games: a sentence becomes a playable game in a named genre, with its own world, its own
people and its own look, played in the browser, shipped as a desktop app or exported to an engine. The detailed
log behind this summary, theme by theme, is [CHANGELOG-3.1.md](CHANGELOG-3.1.md).

### Upgrading from 3.0

- **Update the Claude plugin.** It runs `npx -y mojulo@3.1.1`; an unpinned `npx -y mojulo` moves to 3.1.1 once it
  is npm `latest`. `mojulo-ui` 3.1.1 is the matching dashboard. No new Node requirement and no new dependency.
- **Retired from the tool list, still callable by name**, so a plan step, script or skill that names one keeps
  working:
  - the office wing: apps, runtime daemons, the contextmap, mcp-orbit, triggers and primitive binding
    (`pack_runtime`, `pack_connected_services`; see `RETIRED_PACKS` in `lib/mcp/packs.js`);
  - game projects (`create_game_project` and its siblings): a game's home is its gameworld, through `design_game`;
  - `create_shoot_plan` and `update_shoot_plan`: a shoot plan is `forge_motion({ shoot })`.
- **The dashboard is view-only.** The copy-prompt buttons and the in-page edits (folders, gallery, stash) are gone;
  `/apps`, `/mcp-skills`, `/map` and `/graph` are removed, and `/maker` redirects home. Sign-in and Settings stay.
- **Stored rows that render differently** (the exceptions to byte-identical re-render):
  - **Heroes** get a structured midsection by default; `core: 'streamlined'` restores the 3.0 body byte for byte.
  - **Houses, stores, restaurants and malls** were the mirror image of their plans in the World and every export;
    they are now built the way the plan reads. House floors are muted. SVG stills were mirrored too and are now
    right-handed.
  - **The default animals'** silhouettes and proportions are retuned; a minted animal redraws on its next read.
- **The recipe book ships inside the package.** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo are
  deprecated: a clone still loads and warns at boot, until 4.0. `MOJULO_BUNDLED_BOOK=off` detaches the bundled book.
- **Every recipe records the mojulo version** that minted it and that last edited it.

### Games

- **The doors.** `design_game` makes a game: `quick: { goal }` for a genre in one call, `compose: { prompt }` for a
  whole gameworld from a sentence, or the full gameworld (world bible, character book, levels). `create_game`
  audits it; `export_game` ships it.
- **Genres** (`quick.goal`):
  - **Fighting game:** a side-view one-on-one fighter, local two-player, on 3D arena stages; every fighter is a
    character the character loop designs.
  - **RPG battles:** turn-based fights, a party of up to four switchable classes against groups of foes, with
    battle effects.
  - **Arena shooter:** deathmatch and team deathmatch against bots, first person or over the shoulder; the arena is
    made from words and one dial runs from realistic to stylized. Also a cover shooter along a trail.
  - **Racing:** a kart racer on a loop against rival drivers, and supercars on the grid (any paint, liveries, race
    moods, night driving). A true-scale divided freeway is the first piece of a driving world.
  - **Flight:** a flight sim (fly the ring gates and land), and air combat or a space shooter (`shoot` with a
    `craft`), on one flight model; craft are assembled from a shelf of aircraft and spacecraft parts.
  - **Also:** reach, collect, survive, avoid, sneak (guards and sightlines), rhythm, defend (tower defence), puzzle
    (block pushing) and farm.
- **Levels and places.** Buildings and room kits play as levels (a house, a store, a school, a crypt); a city is
  planned on a board and played as levels; towns, fixed-camera walkmesh scenes, and chapters of the same world over
  time.
- **What a game carries:** stats, inventory and shops, front menus, a cover and credits, scenes and two characters
  talking, a story bound to its world, weather, destruction, beams and explosions, and a soundtrack scored per level
  with action sounds.
- **Where it plays.** A browser shell runs title, levels and result. `export_game({ target: 'desktop' })` packs it
  as a desktop app with one seam for a store (Steam, GOG, Epic); mojulo ships no store SDK and uploads nothing.
  The Godot pack carries the event bus, combat and looks, and is the most complete engine translation.
- **What can be made next.** The cosmos cube describes a game as six facets, and its sweep measures what the builder
  can and cannot make yet ([docs/tool-surface/hillclimb.md](../docs/tool-surface/hillclimb.md)).

### Characters

- **`create_character`** (`as: 'hero' | 'creature' | 'animal'`) is the first door; `update_character` revises any
  part.
- **Each game's own people.** The Egocube rolls a cast from a game's setting and era: modern and future gear,
  mascots that walk as well as drive, and a palette that keeps its world's era.
- **The look.** An anime hero can be drawn painterly, with a painted face that animates. A stylism solver works
  silhouette, then value, then detail. Clothes fit the body, armour and creature apparel read as what they are,
  hair grows as locks, and light is painted onto the surface. Each character is drawn for its target screen.
- **Motion.** Showcase poses, ready stances, strikes, sitting and rising, vaults and carrying on the hero door, and
  a walk calibrated against measured human gait.
- **Animals.** Sea creatures, insects and other arthropods that move, behaviours said once and done per species,
  and an encyclopedia entry per species.

### Worlds and the look

- **The geocube** is a level's look as data. The color theorist solves its palette from what the world is
  for (land, sky, HUD and cover from one solve), and vertex contrast lights the whole world.
- **Stage kits** in the sixth-gen manner: an isekai meadow, bamboo and sakura groves, a research lab and night, with
  live grass, wind, fire and water.
- **Historic cultures** as walkable `historic` worlds from cited records, with period music and people: Sumer,
  Hellenistic Lindos, Qin Xianyang, Pompeii and Giza. Later eras through the same historic solver.
- **Buildings.** The `interior` kind furnishes one room of a house; houses gain finishes and composed or true-size
  furniture; a structure book documents a house, store, restaurant, mall or school.

### Making things

- **Solids.** The fabricator resolves a part's job from a shelf of standard parts and sizes it; `measure_solid`
  reads strength (bending, tension, print infill); mechanisms move with mass and friction; the `scad` kind gains a
  pinned library for threads, gears and text, and warns where they used to fail silently. Exploded views and teardowns.
- **Asset receipts.** `sign_asset` and `verify_asset` sign an exported file with a per-install creator key.
- **Audio, film and diagrams.** Orchestral strings and brass, a robot-rock style card; a world's shoot plan and a
  Blender film pack from `forge_motion`; flow charts lay themselves out.

### The agent's surface

- **One door per intent.** A new capability is an argument and a routing card on the tool that owns its intent,
  not a new listed tool. A pack opens to a menu; `create_sketch` and `cook` list routing only and read their manuals
  on demand. A routing eval with a held-out set measures where requests land.
- **Model tiering.** An agent task names how much judgment it needs (`ride`, `fill`, `judge`, `design`), never a
  model.
- **Self-description.** Mojulo describes itself by what it makes: things to Play, Print, Read, Hear and Observe.

### For contributors

- Test tiers: `test:critical` is quick again, the game and world suites that walk levels in headless Chrome are
  `test:e2e`, and range sweeps are `*.deep.test.js`. A test picks one case per procedure, never a whole catalog.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
