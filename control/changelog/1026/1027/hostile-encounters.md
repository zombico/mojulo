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
- **One figure per entry** (page weight): every body a bestiary entry stands wears the entry's figure, `foe-<entry>`, a
  summons and a mode included, so the page carries one pack per entry and builds each body its own rig from it (a
  game's own figure, made per body, keeps the body's name). The summoner's demo page, a necromancer and three skeletons,
  went from 36.9 MB to 29.7 MB; every body still built, no page error. A cleave's slash, seeded by the figure's name, is
  now the entry's.

  Machine gate: three placements of one entry on one figure; the bestiary's cases on the entry's names. Eyes: the page
  loaded and every body built (no film).
- **Modes as a word** (`becomes: '<id>'`; the operator: "armored mode is one layer, unarmored mode is another … koopa with
  shell, koopa no shell"). An entry names the entry it becomes when defeated, a chain of up to four with no loop: each
  mode is that entry's own skin, class and bar, minted as its own figure, laid as the body's `modes` (each with its
  class's rule, which the runtime's reset now takes on: a quicker shell-less koopa fights as one), its death the last's.
  The page sheds what one mode wears that the next lacks, as the hand-laid modes did.

  Machine gate: the chain stood as modes with their figures, health and rules, the last's death, a clear counting one;
  loops and self refused; the runtime's reset taking the next mode's rule. Eyes: the hand-laid armoured skeleton earlier;
  this word's own not yet looked at.
- **A pair: two foes as one encounter** (`pair: { foe, cover?, down?: enrage | revive, swap? }`;
  `worlds/controllable/pair.js`; the operator's Scylla and Charybdis: "both on the field. one stunned. one switch out.
  one die first", "the orchestration of S&C means 'sometimes they are together, sometimes autonomous'"). The second
  relation on the shelf: an entry's partner stands beside it, each with its own bar and layer 0, the two sharing a fate
  by rows. Reeling, one is covered (its partner goes to its side and stands over it, the mind's escort, until it is up).
  Fallen, its partner enrages (relentless, quicker, the power-up look for good); or, `revive`, neither dies while the
  other stands: a killing blow fells it (combat-hit's `noDestroy`, as a mode's defeat: knocked down, up at half its
  health), and only both felled together finishes them, each falling once, so a win counting the fallen counts each
  once. Under its `swap` share one leaves in smoke while the other holds the field, and comes back as hurt as it left.
  A clear counts the partner. Emitted only into a page whose world has a pair.
  - The foes card's ceiling is re-pinned (4608 bytes, its reason beside it): its row per class grew by three and the
    relations' words joined it; the class shelf is a growing family, due to become an index and a card per member.

  Machine gate: each row on the live runtime (the cover and its end, the enrage, the felling and both felled together,
  the swap and the return); the bestiary's pair stood with symmetric rows, fielded, counted, refused by name. Eyes: not
  yet looked at.
- **Encounters are won, not drained** (`levels.<id>.foes.win: exit | clear`; the operator: "the encounter doesnt have a bar,
  it has win cons", "encoutner win con canbe kill all enemies"). A stage its foes stand on is won by its exit (as before)
  or by clearing it: every foe stood on it down, a summoner's summons counted (those it never called are dropped as it
  falls), lowered to the existing `defeat-all` over the cast's own falls in place of the exit's reach. Each foe keeps its
  own bar.
  - A summoner's summons hunt as one pack once awake (`group.js`: `<summoner>-summons`, their sight shared, as many
    pressing in at a time as may be up, on their own move's plan when they have one); asleep they are no member.

  Machine gate: the clear's count with a summoner's summons, the exit kept when it is not named, the word refused; the
  woken summons in one group and the sleeping out of it.
- **One stand step for every hostile** (`gameworld/foes.js` `standFoe`; the operator: "can we sequence our injection at
  that step so it happens at each game type", "lets make those sight changes then too"). The bestiary's foes, a
  shooter's foes and a sneak's guards are stood through the same step, so each gets layer 0's whole package (its death
  in the game's register, its base states, the target rim and bar) and a game type passes only its own few numbers over
  the class's (`tune`: the shooter's gun, health and spacing; the sneak's watchers on their own team, never fought).
  - How a mind sees, in words (`mind/vocab.js`): `sight` narrow | wide | keen, `gaze` still | sweep (a lookout's), and
    `cover`, each lowering to the knobs the runtime already read; a class names them on its mind, refused by name.
  - Two class rows in those words: `guard` (holds its post, a narrow sweeping gaze, engages what it sees) and `hunter`
    (hunts by sight and memory on the navmesh, fires a rifle's pattern from range, takes cover). A shooter's foes are
    hunters and a sneak's guards are guards, each in a person's skin, on the figure the game made.
  - Their pages now carry layer 0: a shooter's foes are lit by the target rim and go in the game's register when they
    fall; a sneak's guards keep their beam, their sweep and their team. Web first, as every AI attack: the engines'
    marks say approximated (the planning page's Godot count moves with them).

  Machine gate: the words lowered and refused; the stand step's package and a game's numbers last; the shooter's foes
  stood as hunters with its gun; the gameworld, foe, mind and runtime suites. Eyes: not yet looked at.
- **The summoner, and its summons** (`class: 'summoner'`, `summons: { foe, count?, bound? }`; `worlds/controllable/summon.js`;
  the operator: "a solo that controls/spawns N temp or persistent enemies. killing the puppetmaster wipes all temp
  enemies"). The first RELATION between foes (docs/foes.md's sixth shelf). The class is behaviour alone: it keeps its
  place and calls (a new attack word, `call`, its wind-up the telegraph). Its summons are any other entry of the
  bestiary, minted with it asleep beside it (`dormant`) and fielded with it: a hero near, it wakes the next on its wind-up
  (the first on sight, then every 4 s, two up at once, arriving in smoke), a blow breaking the call. Reeling, its bound summons stand slack; down,
  their strings are cut (destroyed where they stand, every joint letting go) and the uncalled are dropped, while an
  unbound one fights on. Emitted only into a page whose world has a summoner. A summoner calls no summoner, and names what
  it calls; the stand-in bestiary's summoner calls the walker. Web only: the engines' marks say absent.

  Machine gate: the call held off with no hero near, capped, broken by a blow; the slack; the cut and the dropped; the
  unbound fighting on; absent, no code; the bestiary's summons stood asleep by their summoner, fielded, refused by name.
  Eyes: a necromancer on the demo level calling a skeleton in smoke, the skeleton slack while it reels, collapsing when it
  falls (the first round called 4 s after the hero came: now on sight). Eyes gate: the operator's to judge.
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
