# Egocube: a character as a cube, and a cast as cubes rolled against it

Code: [control/lib/graph/egocube/](../control/lib/graph/egocube/). One Egocube (the anchor alone, H + 0) is built:
the channels and the dial register (`channels.js`), the facet tables (`facets.js`), the brief's words (`lexicon.js`)
and the roller (`egocube.js`); `node scripts/egocube-roll.mjs --brief "a weary paladin"` prints a sheet. Relations,
cast laws, factions and the fate thread below are design, not code yet. A sheet compiles to a first character
by the method in From a sheet to a character, below.

A **mascot** is designed by another method: from a promise, not a life, on a head-heavy body of any topology. The
egocube takes it as its `mascot` tuning (`roll.tuning: 'mascot'`, or a cartoony brief); the laws and the facets are in
[mascot.md](mascot.md).

The Egocube is the soul facet's deep cube, the way the geocube is the reality facet's. The cosmos soul facet
([control/lib/graph/cosmos/facets/soul.js](../control/lib/graph/cosmos/facets/soul.js)) asks "who?" and answers
with a kind (hero, creature, animal), a cast preset and a vibe. The Egocube answers it with a person: who they are,
what their life has done to them, and how that shows. It then answers it again for everyone around them, each rolled
in relation to the first.

**It writes design notes for the visual outcome, and nothing else.** No powers, no mechanics, no behaviour. A rolled
Egocube does not create a character. It hands the character loop notes per expressive channel, each pointing at the
dials that can carry it today, and the loop (`create_character`, `update_character`, the create-hero catalyst) makes
the decisions.

Two sources:

- **Jungian archetypes**, read through the pop-Jungian set of twelve (Pearson, Mark) because each one is
  character-rich and each has a **shadow form**. The shadow comes for free: motivation decides how far toward it
  the archetype shows.
- **"A life is drawn on a face."** What someone has done, wanted and endured settles into the face at rest, the
  stance and the wear. Age decides how much of it shows.

Four inputs: the facets (who they are), the motivation (what they want), the brief (what the operator asked for,
as words), and the world (what everyone shares).

## Born and lived

Every expressive channel is either **born** (what you are given) or **lived** (what your life does with it). This
one split carries most of the system:

- **Affiliation** (a faction, a rank, a hire) echoes lived channels. Foot soldiers share a uniform, not a face.
- **Personal relations** (rival, mentor, shadow) echo or contrast whichever channel the relation is about.
- **Age** is the multiplier on lived channels. A youth's life shows in posture; an elder's in the face.

Relations in a cast are by archetype, never by blood: family resemblance is left to the game's models, which read
plausibly enough. Born channels matter again on a fate thread (see Ageing), where they are the same person's.

## The channels

The notes are written into channels, never as a loose paragraph. The composer merges per channel, so six facets
make one face rather than six lists.

| Channel | Born or lived | A note says | The dials it points at today |
|---|---|---|---|
| frame | born | build, height, mass, where the weight sits | `cast` (pole), `CAST_PRESETS`, `tune`, `body`, `girth`, `scale` |
| face structure | born | the bones: skull, jaw, cheek, nose, eye set | western `face`; anime `face`, `sculpt` placement; tiered face poles |
| colouring | born | skin, hair and eye colour as given | `palette` Skin, Hair, HairHighlight (the sheet carries starting swatches) |
| cover | born | what covers the body when it is not skin alone: scales, fur, feathers, chitin, bone | the creature loop's grown patches and regions passes |
| ornament | born | what grows from the body: horns, ears, tusks, claws, antennae | the creature loop's ornaments pass |
| face at rest | lived | the habitual expression set into the neutral face | western `expression` channels (browRaise, browTilt, mouthCorner, aperture); anime `sculpt` lid and brow (lidWeight, lidAngle, browAngle, browArch); face traits |
| eyes | lived | where the gaze goes, how open, how lit | aperture, lidCover, catchlight, iris |
| stance | lived | carriage at rest and ready | `motion.axes` (energy, weight, poise, confidence), `gesture`, ready stances, aura poses |
| silhouette | lived over born | the shape at 64 px | the create-hero silhouette words (needle, bell, barrel, column); armour mass and coverage; outfit cut |
| dress and adornment | lived | what they chose to wear and carry, and why | outfit and armour cards and their dials; adornment rails; element words; ornament |
| hair | lived (as kept) | how it is kept, or not | hair library and controls; grown hair `spine` |
| palette | lived (as chosen) | value, saturation, the accent they chose | `palette` Top, Bottom, Trim, Ink, Glove; `toon.light` |
| wear | lived | scars, lines, grey, weathering, dirt, repairs | **no dials today**: carried as `unread` (see Gaps) |

## The world and its factions

Everyone in a cast shares the **world**: its light, era and medium (a geocube), and a default tradition (anime or
western). Shared light is shared visual language: two designs that share nothing else still read as one game when
they stand under the same key, ambient and rim.

A **faction** is a visual language inside the world: tradition, motif, palette family, shape language (round,
square, triangle), material. Every character belongs to one. A world of one faction is the common case. An alien
race invading another is two factions with opposed languages under one light, and the hero and villain can be
designed from opposite ends because their factions are.

### The setting: a game loads the dice

A game says a good deal about its people before anyone asks for one: its world's look, its era, what is played in
it. The **setting** ([setting.js](../control/lib/graph/egocube/setting.js)) carries that to every roll made for the
game, person and mascot alike, so each game gets its best shot at characters drawn in its own look. It is read off
the game by `settingOfGame` ([gameworld/cast-setting.js](../control/lib/graph/gameworld/cast-setting.js)):

| Word | Read from | What it does |
|---|---|---|
| `tradition` | the book's direction; else the kit's pole (banded anime, material western, the rule the book already ledgers a hero against) | a RULE: an anime game's person wears the anime head, its proportions and the character light, and the sheet's graphic-face derives land on its `sculpt`; a mascot's style |
| `era` | the kit (`ERA_OF_KIT`) | leans the roles the era has people for (no casters in the modern world); a modern or future era leaves the fantasy role kit and weapons off and says so (no era gear yet) |
| `genre` | the quick game's goal | leans who stands in it (`GENRES`: farmhands are non-combatants, a firefight has no children) and how far it leans toward a mascot |
| `ramps` | the kit card's ramps, made and grown things first | the clothes' colours: the top by archetype, the bottom by role, each walked along its ramp until it no longer reads as the skin under it |

A lean is a multiplier on the seed's priors, never a verdict: what the operator asks for (a facet, a brief word)
beats the setting, and a roll with no setting is the roll it always was, byte for byte. A stored cube keeps the
setting it was rolled in (`roll.setting`). A quick game's figures it names none of (its foe, guard, farmhand, tower
archer, gunner) are rolled in its setting and wear the kit's underlayer, and its racers are rolled in it; the run's
readout says what was rolled, what the era left out, and an adopted hero drawn in another tradition (kept as it is).

## One Egocube: the facets

The setting is not rolled per character: the world is shared and the faction is assigned. The rest is.

**Age**, in bands. Each band scales the strength of the lived channels' notes.

| Band | Lived strength | Note |
|---|---|---|
| child | 0.15 | Maps to the child-coded casts (`child`, `chibi`) and their guards. Never takes a lieutenant, mastermind or rank relation by roll. |
| youth | 0.3 | The life is in the posture, barely in the face. |
| adult | 0.6 |
| seasoned | 0.85 | Lines begin; the face at rest has set. |
| elder | 1 | Born channels soften too: grey into Hair, mass shifts down and in. |

**Frame**: a pole (male or female, for body-type categorization only) times a build (`lithe`, `canonical`,
`heroic`, `stout`, `brute`), both read from the existing cast tables. Build is ordered by mass for distance.

**Ancestry**: who their people are, read for what it gives the body
([control/lib/graph/egocube/ancestry.js](../control/lib/graph/egocube/ancestry.js)). It is born and never scaled by
age. One rule holds for every kind: **an ancestry is a range, never one look.** The seed picks inside the range, so
rolling the same ancestry again gives another person of the same people.

- **Human ancestries** are broad regional groups (African, European, East Asian, Southeast Asian, South Asian,
  Middle Eastern or North African, Indigenous American, Pacific Islander, Latin American, mixed). Each is a span of
  skin tones on the Monk Skin Tone scale (ten published swatches), undertones, hair textures, hair colours and eye
  colours, with spans that overlap on purpose: variation within a group is wider than between groups. An ancestry
  writes colouring and hair. It does not write the face's structure, which is the individual's; the one exception is
  a fact a modeller needs (a low or absent upper-lid crease is common in East Asian faces), stated as "draw this
  person's eye". A blind roll picks among the human ancestries; brief words (`japanese`, `nigerian`, `latina` …)
  name one.
- **Lineages** are non-human peoples, built on the vocabulary of the creature loop that made the dragon warrior (the
  creature-from-plan catalyst and `docs/examples/dragon-body`). A lineage is a band of **humanity** h (1 human … 0
  creature) and a list of **cues**, each written as one of the loop's passes would take it: the thesis (silhouette,
  legs, head, the one iconic feature), ornaments (horns, ears, tusks, claws), grown patches (scales, fur, chitin),
  correctives (drawn-back flesh), hair (whiskers, feathers) and colour (a cover palette and a paler underside). A cue
  shows at or below its h; cues sharing a slot show only the deepest, so the long dragon snout replaces the short
  one and full scales replace patches. Below about h = 0.5, or once a cue needs a snout, beak or muzzle, the sheet's
  **door** is the creature loop, not the hero door. The built ones: draconic (the dragon head and body, the membrane
  wing), sylvan, dwarven, orcish, infernal, undead, feline, lupine, ursine (the bear head), avian (the feathered wing)
  and insectoid. Each says what the creature loop already has for it; the rest is words the loop prints a plan from.
- **A people established once can be rolled for variations.** A custom lineage is the same data as a built one,
  passed in (`rollEgocube({ lineages })`, or `--lineages <file>` on the script), so a race designed for one game
  rolls more of its own people. A blind roll never picks a lineage: a non-human people is the world's decision (a
  faction), so it comes only by ask.

**Role**: how they fight, read only for what it does to the body and the kit.

| Role | Silhouette tendency | Focal | Notes |
|---|---|---|---|
| frontline | column or barrel, mass high in the shoulders | the shield, the chest | coverage high, feet planted |
| flanker | needle, low profile | the blade hand, the eyes | light layers, asymmetric wraps, nothing that clatters |
| ranged | needle, one long line | the weapon's line | layered for weather |
| caster | bell (the robe) or needle | hands and head | ornament carries the element word |
| controller | the pair: their own shape plus the familiar's | the bond: a tether, a shared emblem | the familiar echoes their palette |
| support | barrel or bell | the kit | pouches, tools, packs |
| non-combatant | from dress, not kit | the face |

Roles are ordered by engagement range (frontline, flanker, support, controller, caster, ranged) for distance;
non-combatant sits apart.

**Archetype**: the twelve, in Pearson's four quadrants. Each has a light reading and a shadow reading.

| Archetype | Quadrant | Light reads | Shadow | Shadow reads |
|---|---|---|---|---|
| innocent | freedom | open face, brows high at rest, round shapes, clean light palette, little adornment | the denier | a fixed smile; pristine where it should be worn |
| explorer | freedom | weathered, practical layers, gaze off to the distance, weight forward | the drifter | everything worn, nothing kept |
| sage | freedom | stillness, the heavy lid of attention, hands visible, one tool | the cold judge | lids heavy and level, mouth thin, chin up, arms folded |
| hero | mastery | level brows, square stance, column silhouette, one focal symbol | the bully | jaw forward, chest out, oversized weapon, trophies |
| outlaw | mastery | asymmetric, patched, defiance in the chin, weight on one hip | the destroyer | scars worn as display, the torn insignia of what was rejected |
| magician | mastery | hands as focal, a catchlight in the eyes, an emblem | the corrupter | beauty slightly wrong: too symmetric, too smooth, a colour off |
| everyman | belonging | plain clothes, average frame, relaxed stance, warm muted palette | the conformist | the uniform swallows the face |
| jester | belonging | an elastic face, mobile brows, colour clash, loose stance | the cruel prankster | the smile wider than the eyes; same palette, harder edges |
| lover | belonging | soft lids, open posture, warm accents, something worn for someone | the obsessive | a fixed gaze, a token kept too long |
| caregiver | stability | soft shapes, low centre, open hands, worn practical | the martyr | tired eyes, worry drawn in, turned toward others even at rest |
| creator | stability | tool marks, stains, one handmade object | the mad maker | every surface over-worked; the self as a project |
| ruler | stability | symmetry, verticality, insignia, stillness, chin level | the tyrant | heavy lids, mouth corners down, mass in the robe not the body, seated |

Distance between archetypes is the step around the wheel, over six (neighbours 1/6, opposites 1).

**Motivation** `m` in [0, 1]: 0 selfless, 0.5 opportunistic, 1 self-serving. It is the shadow dial. Each lived
channel's note is a blend of the archetype's light and shadow readings at `smoothstep(0.25, 0.85, m)`. A Dark
Knight is a hero at about 0.6: the light reading's structure, the shadow's face at rest. No hybrid entries are
needed; hybrids fall out of the blend.

**Order** `o` in [0, 1], optional: bound to free. It is what survives of the D&D law-chaos axis, kept because it
is the most visual part of it: bound reads as symmetry, uniform and insignia; free as asymmetry, patching and
personal marks. Absent, it takes the faction's.

## Rolling one

- **Brief first.** Words map to facet values through a lexicon (as `gameworld/compose.js` maps prompt words to
  settings). What no word decided, the seed does, inside the rails.
- **Seeded dice only.** `mulberry32`, drawn as decks (without repeats until spent) as `gameworld/samples.js` does.
- **Coherence faults re-draw**, as the trail's beat order does: an incoherent roll is drawn again on the next
  attempt seed. An explicit ask is never re-drawn; it is the operator's.
- **The output is a sheet**, roughly:

```js
{
  path: 'hero', seed, faction,
  facets: { age, frame, role, archetype, motivation, order },
  notes:   { <channel>: [{ line, from: 'archetype.ruler@m0.8' }] },   // the design notes, merged per channel
  derives: { <channel>: ['expression.mouthCorner lower', 'sculpt.lidWeight up', …] },   // where each note can land
  unread:  [ … ],   // notes no dial can carry yet (wear, today)
}
```

`derives` names dials and directions, never values: the character loop chooses the amounts. A sheet with no brief
and no seed changes nothing downstream.

## Relationships: the cast as cubes rolled against an anchor

A cast is an **anchor** Egocube plus a relationship matrix. Every other member is rolled with loaded dice against
the anchor (or against another member: see The fractal).

### The one operator

Every relational tuning is a **target distance** `δ` in [0, 1] from the anchor's value, with a looseness `λ`. For a
facet with a distance `d(v, a)` between a candidate value `v` and the anchor's `a`:

    P(v) ∝ exp( −(d(v, a) − δ)² / (2 λ²) )

- **echo** is `δ = 0`: roll near the anchor.
- **contrast** is `δ = 1`: roll away from it. Partial contrast is anything between.
- `λ` is how loaded the dice are: 0.1 nearly decides; 0.5 barely leans. Default 0.2.

Continuous facets (motivation, order) draw from a normal at the target instead. Distances: age by band steps,
frame by the mass order, role by the range order, archetype round the wheel.

Two more operators cover what distance cannot:

- **complement**: draw from the values the cast does not yet cover, weighted by the gap. A party's roles.
- **shadow** `s`: keep the archetype (`δ = 0`) and reflect the motivation toward its mirror,
  `m = m_a + s (1 − 2 m_a)`. At `s = 1` a selfless hero's shadow is fully self-serving; the same archetype, the
  other face.

The operator's tunings (size, technique, silhouette, palette, shadow) are these operators aimed at channels:
**size** is `δ` on frame and stature, **technique** is `δ` on role, **silhouette** is same-word or distinct-word,
**palette** is hue distance on the faction's wheel and value contrast, **shadow** is `s`.

### Presets

First readings, to be calibrated at the eyes gate; a tuning whose ends no one can tell apart is cut, as hero-vibe
cuts axes. Any preset takes overrides: `{ relation: 'rival', tune: { size: 0.8, shadow: 0.3 } }`.

| Relation | Family | Archetype δ | Motivation | Role δ | Size δ | Age | Silhouette | Palette |
|---|---|---|---|---|---|---|---|---|
| shadow | personal | 0 | shadow 1 | 0 | 0.2 | echo | same word | value inverted |
| rival | personal | 0.25 | shadow 0.3 | 0.15 (same school) | 0.7 | echo | distinct | complementary hue |
| foil | personal | 1 (the opposite quadrant) | echo | free | free | free | distinct | contrast |
| mentor | personal | 0.15, leaning sage | echo, −0.1 | free | free | +2 bands | free | echo, muted |
| party | affiliation | complement | echo ±0.15 | complement | ladder | free | distinct (a law) | distinct hue, same family |
| lieutenant (the Dragon) | personal, of a master | 0.2 | echo the master | frontline | +0.6 | free | barrel or column, coverage high | the master's family |
| mastermind (the Emperor) | personal | toward ruler or magician | ≥ 0.85 | non-combatant or caster | −0.4 | +2 bands | bell | the bookend's |

### Relations compose

A member can hold several relations: the rival who is also the mastermind's lieutenant is `['rival',
'lieutenant']`. Each channel has an owner when relations disagree:

- **dress, adornment and palette**: affiliation wins (the uniform is the faction's).
- **every other channel**: the personal relation listed first wins.

### Affiliation and rank: individuation

Inside a faction, a member's **individuation** `ι` in [0, 1] is how much of their own Egocube shows over the
faction's template.

| Rank | ι | Reads |
|---|---|---|
| foot | 0.1 | the uniform; the face hidden or repeated. No face, so no life drawn on it. |
| elite | 0.3 | the uniform plus one distinction: a crest, a colour, a scar |
| officer | 0.6 | the face shown, insignia |
| lieutenant | 0.8 |
| leader | 1 | the whole Egocube |
| hired | 0.7 | their own Egocube with pieces of the employer's uniform; motivation drawn from 0.5 to 0.8, order toward free, wear high |

The rank words line up by name with the mind's `RANKS` (minion, elite, miniboss, boss); behaviour is untouched.

## Cast laws

Pairwise relations are not enough. A cast is checked as a whole, as a town is by its laws:

- **Silhouette**: no two party members share a silhouette word. The party reads by silhouette alone.
- **Size ladder**: named members side by side differ in stature, or in silhouette word.
- **Palette spread**: named members' accent hues sit apart on the faction's wheel, or apart in value.
- **Bookends**: the two poles of the cast (the anchor and the mastermind or the shadow, or two factions) set the
  extremes on value (light to dark), shape language (round, square, triangle), saturation and order. Every other
  named member sits inside the range on each, unless marked a wildcard. With no second pole (H + 0) the bookends
  stay implied; a full journey cast states both.

A broken law re-draws the offending member on its next attempt seed, never the anchor and never an explicit ask.

## The fractal

Any member can be an anchor for its own relations. Paths name them: `hero/mastermind/lieutenant`,
`hero/mastermind/lieutenant/troops`.

- **Seeds are path-keyed**: a member's seed is a hash of the anchor's seed and its path. Adding members never
  re-rolls existing ones; a cast only grows.
- **Pull decays**: for a facet its relation leaves free, a member at depth `k` leans toward the original anchor
  with weight `0.6^k`, the rest toward its faction's default.

Requests grow from the smallest:

- **H + 0**: the anchor's sheet.
- **H + R**: the anchor and a rival.
- **H + Pn**: a party of n. Roles named by the operator, or proposed by complement against the anchor.
- **A journey cast**: the anchor plus Vogler's functions as relations (herald, mentor, threshold guardian,
  shapeshifter, shadow, trickster, allies), a mastermind and its lieutenant, and their ranks. Both bookends set.

Any anchor works: a villain first, and the hero rolled as its contrast.

## From a sheet to a character: the method, not a template

The sheet is the brief; the plan is the designer's. Mojulo establishes a form, isolates its principles, and teaches
the model to execute them instead of copying the form. Three pieces carry that:

- **The principle card**, the `creature-from-sheet` catalyst
  ([control/lib/mcp/catalysts/creature-from-sheet.md](../control/lib/mcp/catalysts/creature-from-sheet.md)): the loop
  (read, thesis, door, topology, head, masses, cover, ornaments, dress, colour, stance, look, audit), how a head is
  derived from the nearest skull (the wolf from the bear, step by step), and the lessons table: every mistake made
  building the first forms, as a principle, with the audit check that catches it where a machine can.
- **The audit** ([control/lib/graph/egocube/audit.js](../control/lib/graph/egocube/audit.js), `auditPlan`): a plan
  someone wrote, read against its sheet. A ledger (each note carried, missing, or for the eyes, with the evidence),
  the lesson checks (`head`, `world-sweeps`, `windows`, `mass-before-cover`, `lean`, `one-focal`, `stack`,
  `ornament-scale`), whether the plan expands, and **sameness**: a joint table that is the served biped rescaled is
  flagged, so a body is designed, not copied. `node scripts/egocube-roll.mjs <roll> --audit plan.json`.
- **Contrast pairs** ([control/lib/graph/egocube/plan.js](../control/lib/graph/egocube/plan.js), `contrastPair`): the
  same roll twice, one facet changed, and the first-reading choices that moved (the caregiver's lean of 18° and her
  pack against the ruler's 5° and his pauldron). A pair teaches the mapping from a note to a choice; one example would
  teach a destination. `--contrast archetype=ruler`. `planFromSheet` remains as the first-reading compiler behind the
  pairs and the sweep tests; it is not the authoring path.

### The creature head library

[control/lib/graph/creature-heads/](../control/lib/graph/creature-heads/): detailed heads as plan data
(`layered-head-v1`), one JSON file each, worn by a ring plan. The dragon and the bear moved in from the head-detail
example (which now reads them from here); the wolf is new, the bear's mammal skull re-drawn with a stop at the brow, a
long narrow muzzle and tall pointed ears, so its regions, skin maps and expressions keep their addresses. Each entry
says which peoples it serves; a people may borrow another's head provisionally (the feline wears the wolf's skull), and
a people with none wears a neutral stand-in skull and its ledger says so. A new species' head is a new file, usually
drawn from the nearest one.

## Ageing: the fate thread (an optional extension)

Built: the TIME chapter ([control/lib/graph/egocube/thread.js](../control/lib/graph/egocube/thread.js), `rollThread`;
`node scripts/egocube-roll.mjs --brief hero --seed 7 --years 11 --skip 5`). A roll may carry an age in `years`, which
sets the band. The canonical node is the first roll; every later node is derived from it: the born facets (pole,
ancestry and its swatches, humanity, the build the child grows into, the role and the archetype) are held; motivation
and order drift by seeded dice and by the chapter's words (`war`, `loss`, `training`, `exile`, `fame`, `hardship`,
`kindness`); a chapter's wear is on every later node; one kept marker, a seeded keepsake (with where it is worn and how
big), is on every node. Turn and return are design still.

**Growth is not identity.** The first time-skip trial held the face identical to keep the person recognisable, and the
head stayed the same size while the body grew. Under 18 the born channels move by rule (`GROWTH`, first readings from
growth charts that a stylized head may exaggerate but never reverse): height by a curve per body pole, the head only a
little (11 → 16: +3 % against +12 % of height, so about 9 % more heads tall in whatever style the figure is drawn), the face down and forward (the lower face +10 %, the nose
+14 %, the chin), the eyes held (so they read smaller), the neck longer, and puberty when the chapter spans it. Each is a
note on the later node with the dials it moves, and the rule beside them: hold the eye shape, the brow's line, the
colouring, the hair and the kept marker; grow the proportions around them.

**The body pole reads past childhood.** A sheet past the child band carries the pole's silhouette cues, whatever the
build: for a female body, the waist above a wider hip line, a longer neck, and garments falling from the shoulder's
slope and the chest, taken in at the waist (a square yoke or a stood-off shoulder reads as padding); for a male body,
the shoulder's V and a straight drop to the hip. Body type and how cloth falls on it, never character. A child takes
none; growth names their arrival.

Most games have one hero in one timeline, and the main dice are enough. The fate thread is a separate function on
top of them, used only when a game asks for it: one character across time, as a sequence of nodes (`hero@17`,
`hero@40`), each its own Egocube sheet keyed by path and node, so its notes can be worked on in isolation. It is how
a character ages as the game goes on, switches sides, or comes back changed.

- **One node is canonical.** Every other node derives from it, forward or backward, and never from another
  derived node, so the order nodes are asked for never changes them.
- **Born channels follow age, not dice.** Growth and ageing transform them by rule: the child's head and frame
  grow into the adult's, the elder's colouring greys. The bones stay the bones.
- **Lived channels accumulate forward.** A scar at 17 is on the face at 40. Going backward subtracts: it removes
  wear and never invents a fact a later node contradicts.
- **Chapters say what happened.** Each step between nodes is a chapter, with brief words ("war", "exile", "the
  throne") that push the lived channels as a brief steers a single roll. A chapter with no words is rolled.

A chapter is one of three kinds:

| Chapter | Changes | Example |
|---|---|---|
| time | age band; lived channels accumulate; motivation and order may drift (the arc) | the kid hero grown up after the timeskip |
| turn | faction, motivation, or both; dress, adornment and palette move to the new faction's language | the knight who defects to the invaders |
| return | a transformation: the archetype's reading shifts, wear is reset or made ritual, colouring may change | Gandalf the White; the Lich King |

A return is the strongest chapter. Gandalf the White keeps his archetype (sage) and motivation, resets his wear and
moves his palette to white: the same man, purified. The Lich King is a turn and a return at once: the hero at full
shadow, a new faction (the dead), colouring transformed, the old insignia kept and corrupted.

**The recognition law.** A character must be recognisable at every node, or the timeskip fails: the player has to
know it is them. Born channels carry most of it (a return may change colouring, so it carries less); at least one
lived marker is kept across every node: a keepsake, a hair colour, an accent colour, a silhouette word. After a
turn or a return, the kept marker is the point: the same thing, worn differently. Young nodes are in the child band
and take its guards.

## A request, sketched

```js
{
  world:    { geocube: 'gothic-night', tradition: 'western' },
  factions: { native: { motif: 'vine', shape: 'round' }, invader: { tradition: 'anime', shape: 'triangle' } },
  anchor:   { brief: 'a weary paladin who stayed too long', faction: 'native', seed: 7 },
  cast: {
    rival:                     { relation: 'rival', tune: { size: 0.8, shadow: 0.3 } },
    party:                     { relation: 'party', n: 3, roles: ['caster', 'flanker'] },
    emperor:                   { relation: 'mastermind', faction: 'invader' },
    'emperor/dragon':          { relation: 'lieutenant' },
    'emperor/dragon/troops':   { relation: 'rank', rank: 'foot' },
  },
}
```

The result is a sheet per member and a cast sheet: the bookends, the laws and any re-draws.

A fate thread is a separate call on a sheet that already exists, never part of the cast request:

```js
{
  of: 'hero',                                                          // the canonical node: the paladin, an adult
  thread: [
    { chapter: 'time', at: 'youth', back: true },                      // who he was, before it wore on him
    { chapter: 'turn', words: ['betrayal'], faction: 'invader' },      // he defects
    { chapter: 'return', words: ['the dead'], at: 'elder' },           // and comes back as the Lich King
  ],
}
```

## Where it plugs in

- **The cosmos soul facet**: its `party` value is partial today; the Egocube is what fills a cast.
- **The create-hero catalyst**, step 0 THESIS: role, silhouette word, face read. The sheet answers it.
- **The gameworld character book**: `direction` (motif, primary, secondary) and the looks pages; the unmerged
  story-cast branch reuses them for cast members.
- **`update_character`**: `derives` names its words; the loop sets them.

## Gaps it surfaces

- **Hair for every ancestry**: the hair library has no coily texture or protective styles (an afro, locs, twists,
  cornrows). A sheet that rolls coily hair says so as a gap.
- **Non-human parts on the hero door**: horns, tusks, tails and scale patches are passes the hero grammar lacks, so a
  near-human lineage (a tiefling, an orc) names them as a gap; below the door the creature loop carries them.
- **Faces on the creature door**: the face-at-rest dials a sheet names are the hero heads'; a creature head has its
  own baked expressions (neutral, snarl). The notes still read; the dials do not land yet.

- **Wear**: no dials for lines, scars, grey, freckles, weathering or repairs. Carried as `unread`, so the gap is
  counted rather than blocking.
- **Age**: beyond the child-coded casts, the anime kid and mentor looks and the youthful and mature traits,
  nothing. The bands above map onto what exists.
- **Archetype looks are anime-only**: `look` is refused on the landmark head, so the western face takes notes
  through `face`, `expression` and stance.
- **Factions**: the gameworld has one world kit; a faction layer is new. A game's setting is one language for its
  whole cast today.
- **Era gear**: the role kit and the held items are a myth's (sword, dagger, bow, staff, shield). A modern or future
  setting leaves them off and says so; no firearm or modern kit is built yet.
- **One body per role in a quick game**: each goal's casts take one figure ref, so every guard is the same roll.
- **No free text on `create_character`**: notes reach it through the catalyst and the character book.
- **Non-hero cast**: waits on story-cast and party landing; on this branch the book still refuses `characters.cast`.
