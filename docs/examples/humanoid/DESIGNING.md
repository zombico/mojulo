# Designing a hero character

An orientation for an agent asked to DESIGN a character on the hero door: decide who the character is and make every
still read work (silhouette, proportions, face, hair, values and palette, costume, gear, the stand). It is not about
motion. Clips, timing, facial performance, exports and engine checks come after design, starting from the spec it
produces.

## What you work with

- **The door's words.** A hero is a spec of door fields (`HERO_FIELDS` in `control/lib/mcp/tools/layered.js`). The
  words are in the manual, `control/lib/graph/solid-vocab/layered.md`, in the Hero door section; held equipment
  (`gear`) takes the item words of `control/lib/graph/solid-vocab/equipment.md`. Design on the anime head
  (`head: 'anime'`, which every worked character wears): the looks, the graphic-face words (`sculpt`) and the hair
  families and form words below are that head's. The manual's hair LIBRARY (ponytail, bun, braid and the rest) is the
  landmark head's, and the anime head refuses those names.
- **The order of work.** Take the ORDER from the create-hero catalyst (`control/lib/mcp/catalysts/create-hero.md`):
  thesis, cast, silhouette, colour, face, hair, detail, adornment. Take only the order. Its steps run on a minted row
  with the database tools, and the card replaces them. Its face step defaults to the landmark head, and its LOOK step is
  the exposure ledger (the readout's `dress` here), not the `look` words.
- **The character card.** `render-articulation.mjs --spec <file.json>` takes a spec through the door's own steps without
  a database, resolves it through the World resolver under the same parity guard as the review sheets, and writes
  the door's readout and a card in a few seconds. Run it from `control/`:

  ```
  node ../docs/examples/humanoid/render-articulation.mjs --spec <file.json> [--expr] [--out <dir>]
  ```

  - A spec is `{ "name", "hero": { <door fields> }, "palette"?, "toon"? }`. A top-level key starting with `$` is a note
    the door never sees. Inside `hero` only door fields are allowed, so a `$` key there is refused.
  - The card lands at `<out>/<name>/card.png`, beside `readout.json` (and `expressions.png` with `--expr`). Each render
    overwrites them, so copy the card to `card-vN.png` (or render into a new `--out` folder) to keep your passes. The
    card's title prints `name`, so a `name` bumped per pass (`lead-v5`) tells a blind judge the order.
  - The card shows the words the door read, the head three-quarter at 512 px, and at 256 px: the head front, the
    key-side profile, the rear three-quarter 20° down, the head on the World's dark backdrop, the bust, the body
    three-quarter, front and rear three-quarter 20° down (`body · rear ¾, 20° down`, the gameplay camera), and the
    body's black silhouette and 3-value render at 256 px tall. Held gear is drawn with the body, under the same parity
    guard. The body cells are scaled to the figure with its held gear, so a long item (a greatsword on the back) shrinks
    the figure in them: compare the figure's size only against a card with the same gear, and read the item's size in
    the readout's `gear.<slot>.share`.
  - `--expr` adds the head at every expression word.
  - `--sheet <config.json>` puts several specs side by side, one lens per row. The config is
    `{ "columns": [{ "spec": "a.json", "summary": "…" }], "title"?, "sheet"? }`, with spec paths relative to
    the config.
    It writes `<out>/<sheet or cast-sheet>.png`, and with `--expr` also `cast-expressions.png` (an `expressions` key
    renames it). Use it to compare two approaches in one render.
  - A refusal exits 1. The card first checks the spec itself and refuses with its own message (an unknown top-level
    key, a name that is not a slug, a hero key that is not a door field, a palette that is not an object). After that,
    a door refusal prints the door's own message.
- **The readout.** `readout.json` beside the card is what the door returns:
  - `look` and `lookFrom` (the words), `own` (your layer alone), and the effective `face`, `sculpt`, `hair`,
    `expression` and `tune` after the look and your layer, with `faceMoved` and `hairMoved`;
  - `warnings`, and the feature-spacing advice in `faceMeasures.features.advice` (the terminal prints it as its own
    list);
  - `hairCut`, `hairMeasures` and `hairCoverage`;
  - `dress`, present with `detail` or `adorn`: the adornment ledger (each signature's exposure and verdict), what each
    detail, adornment and signature family reads from at 256 px (`legibility`), and the clearance ledger;
  - `gesture`: the stand's hand clearance and free sole;
  - `gear`, present with gear: each slot's item, style, hold, bone, length in metres and share of the figure's height
    (and a swing's contact data);
  - `budget`: triangles and vertices per palette group.
- **The worked cast.** `docs/examples/humanoid/cast/` holds finished characters. Each `$note` says who the character is
  and what its spec shows off. Start from the nearest one rather than from nothing, with two cautions. Several of them
  name a trait their archetype already carries (the kid's `youthful` and `messy`, the rival's `sharp` and `tsurime`), so
  they wear it twice. And the heroine, the only one in costume, ships with warnings of her own. None carries gear.

Work in scratch: your specs and cards live outside the tracked tree (use `--out`). Designing never needs the database,
the mojulo MCP tools, or an edit to tracked code.

## The theme rule

The gear and armour words came from an arms and armour project, and it is easy to turn every character into a warrior.
Don't. (The trial examples in this file, the bodyguard, the apprentice, the lead's sword and scarf and the heroine's
stand, come from a trial of the loop: characters designed before these words existed, redesigned with them, then
critiqued and judged blind; see "What the trial found".)

- **The role and the story decide the equipment.** A weapon only where the role carries one, at the size and in the
  style that role would own: a young adventurer's plain one-hand sword about half his height, not a greatsword with a
  glowing stone. A merchant's apprentice carries none.
- **Armour only where the role wears it.** A bodyguard in a coat is not a knight in plate. The armour builds, the
  themes and the signatures they bring (the manual's Hero door lists them under "Adornment signatures this uses": kit
  pieces such as `helm`, `crest` and `boards`, theme motifs such as `skull`, `spikes`, `ribs`, `runes` and `fur`)
  belonged on none of the characters in the trial, none of whom wears armour; keep them for a role that does (a
  knight, an armoured antagonist).
- **The head, face and hair lead.** The costume and gear support them and must not out-shout them. Keep the head
  words that already work.
- **The stand follows the role and the temperament.** A swing word is an action stand; a calm character may read
  better at rest with the weapon carried. In a still, a raised hand reads as a clenched fist, and a fist reads as a
  fighter.
- **If no new word earns its place, say so,** and spend the renders on the costume and the stand.

## The loop

0. **Thesis.** Write one line before the first render: the role (and so what it carries and wears), a silhouette word
   (needle, bell, barrel, column), the palette by group, the hair hook, one adjective for the face, and the ONE
   signature. Keep it in the spec as a top-level `$thesis` note and restate it each pass.
1. **Start near.** Copy the nearest worked character or begin from an archetype look word (`heroine`, `lead`, `rival`,
   `princess`, `mentor`, `kid`, `stoic`). An archetype carries a face, a hair family, a pose and sometimes a tune, and
   none of that is guessable from its name: read its one-line note in `ANIME_LOOKS`
   (`control/lib/graph/polygonizer/anime-looks.js`), or card a spec with the look alone, before you build on it. The
   `swept-back` cut is the male base's short swept cut and reads masculine on the female. For a costume, copy the
   heroine's `detail` and `adorn` blocks and ignore her `clips`.
2. **Render, then look.** Open `card.png` and actually look at it. Judge the head three-quarter first. Then check the
   rear three-quarter cells, head and body, which are the gameplay camera, then the silhouette, then the 3-value
   thumbnail. Then read `warnings` and the advice. With a costume, `warnings` fills with clearance lines at the dial
   extremes (stance, lean, bulk) and ledger lines. A still design acts first on clearance at rest and on the face and
   hair advice. Clearance at the extremes is for the animation pass to settle.
3. **Change one idea per render.** Before rendering, say what you expect to see; after, compare. Order the ideas by
   degree of touch, each judged at the size it has to read at:

   | Degree | What it decides | Judged at |
   |---|---|---|
   | Big | the theme and the stand, silhouette, proportion, head size, the value pattern, the hair's mass, the eye-and-brow dark mark, the costume's masses | the silhouette and 3-value cells, squinted or viewed at half size (128 px) |
   | Middle | feature spacing, planes, hair sections and lift, the costume's fit, the gear's size | 256 px three-quarter |
   | Small | lid flick, catchlight, nose line, trim, buckles, the hair's highlight | 512 px close-up |

   Don't touch a small thing while a big one is wrong. From a bare start the big list is usually all wrong at once:
   batch big ideas that do not interact (proportion with the hair's mass; a costume's garment, capped limbs and
   signature as one idea) in the first renders, then go one idea per render.
4. **Stop** when the rubric holds or after about eight renders. Record honestly what the words could not reach.
5. **Critic, one fix pass, blind judge.** Hand the final card to an independent critic, take at most three of its
   fixes in at most three renders, and let a blind judge choose the card to keep (see "The critic and the blind
   judge").

## What good looks like

- **It reads at 256 px, or it goes.** Every defining feature must survive the game-scale card cells. The eye-and-brow
  dark mark and each group's lit and shade pair are big decisions, not accents.
- **A distinct black silhouette.** Give it one accent the silhouette carries: a crown curl, a bow, an elbow out on
  the hip.
- **Three values.** Sort the groups into light, mid and dark. The card's 3-value thumbnail splits at CIE L* 66 and 33.
  Keep adjacent groups apart; hair against the top is a pair that often fails.
  - Example, the worked heroine: the cream top (L* 93) and skin (83) are light, the hair (39), boots (47) and sash
    (54) are mid, and the navy legs (25) are dark. A coral top would sit only 15 L* from her auburn hair, so the coral
    is on the sash.
  - The thumbnail posterises the rendered pixels, so a group's shade side can drop a band: the heroine's hair shade
    reads dark.
- **One base garment plus ONE signature deviation.**
  - Build the costume as a few thick masses, with capped limbs (cuffs, boots, wraps). See "The costume as data".
  - Use one saturated accent colour, and only on the signature. Held gear counts: a weapon can be the signature (the
    trial's bodyguard wore her one red on the sword), or it stays neutral beside one.
  - Put asymmetry where it tells the story.
- **Design for the gameplay camera.** The rear three-quarter, 20° down, is the most-seen view. Put something
  recognisable where it looks (the heroine's bow sits at the small of her back for this reason) and judge it in the
  body's rear cell: from there a hanging piece can stand off the back as a board, or a hip blade poke below a hem. The
  readout's `dress.adornments` exposure and `dress.legibility` still say whether a signature is seen at all.
- **Feature spacing is what makes a face recognisable.** The positions (eye level, nose tip, lip line, brow block and
  angle, lid weight and cover, the fissure's shape) are graphic-face words (`sculpt`). The face ratios mostly scale
  shapes; the advice names the word that moves each measure, so follow it.
- **Hair is a few big masses.** The anime head's families are `bob`, `short`, `long` and `hime` (a refusal lists
  them). Shape the lift, sections and cut with the form words, and judge the hair from behind as well as the front.
  `length` is a ratio on the cut's own (the female base's side-parted cut is already long), so read the effective
  value in the readout's `hair` before raising it. A messy crown comes from `messy`, `crownAccents: 'grow'`,
  `lift: { crown }` and `ahoge` together.
- **Mid-value, saturated hair reads best under the character light.**
  - Near-black and pale hair are where the light is weakest: set the shade and highlight yourself
    (`toon.light.shade`, `toon.light.highlight`, the palette's `HairHighlight`).
  - Watch warm hair: the derived shade turns the hue toward violet (orange goes crimson). Set the shade by hand.
- **The stand is part of the design,** and it follows the role (the theme rule). Use a preset (`relaxed`,
  `hand-on-hip`, `guard`) or pose words (the refusal lists them), composed left to right. Read the readout's `gesture`
  clearance, and judge the three-quarter silhouette at 256 px.
  - The base is the stand's: `stance` (how far apart the planted feet stand, a multiple of the hip spread) and
    `stagger` (+ the left foot forward) set it, the free side's `heelL` / `heelR` raises a heel. On the structured core
    (every hero's default) the legs converge at rest, so a stand that names no base stands with the feet under the knees; the presets carry
    their own (a ready stance wide and bladed, a calm one close-set). A wide base needs a crouch to reach.
  - `relaxed` carries the chin a little down. `{ head: { pitch: 0 } }` brings it level, which reads alert and, at the
    three-quarter, a touch proud.
  - The head's carriage changes the mouth: a wide smile under `relaxed` can read as a one-sided smirk at the
    three-quarter. Turn the head toward the viewer first (the heroine's stand uses `head: { yaw: 12, pitch: 0 }`).
  - The rig has no arm IK and no open hand, so a hand cannot be placed on a prop or a hilt. Leave a wave to a clip,
    where it reads in motion.

## The costume as data

`detail: 'clothed'` and `adorn: 'ranger'` are fixed kits. Anything else is written as data in `detail` (refine,
collars) and `adorn` (a list of shells, bands and straps). The manual gives the fields; these are the conventions it
leaves out.

- **Palette groups.** `Top` colours the torso and both arms to the wrist, `Bottom` the legs, `Shoes` the feet. So a
  coat and a separate top cannot both be sleeved garments, and to bare a forearm you wrap it in a `Skin` shell. Any
  detail, adornment or signature may name a new group (Coat, Belt, Sash), coloured under the same name in `palette`.
- **An address is `s` and `t` on a carrier part.** The carriers include `torso`, `neck`, `upperArmR`/`L`,
  `foreArmR`/`L`, `handR`/`L`, `thighR`/`L`, `shankR`/`L` and `footR`/`L`. `s` is the station along the part from its
  root: the torso runs from 0 at the hem to its top station at the neck base, a shank from the knee to the ankle. `t`
  runs round ONE half from 0 at the front midline to the back midline; `side` picks the half (R by default), and
  `t: 'wrap'` goes all the way round. A front panel is therefore two shells, R and L. An address off the part is
  refused. A shell or band below the torso's hem sits on the thighs and follows them. What hangs below the hem is a
  signature: a `tabard` on a strap (next section), a `plume` from its anchor (the heroine's bow tails drop from the
  small of her back), and the kinds that hang from a shell's edge or a chain, such as `boards`, `medallion` and `bell`.
  Each is rigid on its pin.
- **Every adornment needs one `signature`** from the library (`SIGNATURES` in
  `control/lib/graph/polygonizer/station-loft-adorn.js`; a refusal lists them), and the ledger judges it. On a plain
  panel give it a small real element, such as a rivet or a button, and expect the ledger to call it small. A signature
  cannot be left out: to show none, colour it into its carrier's group (a clasp coloured into its collar). A carrier
  band coloured to vanish, one that only carries its signature, shows `never` in `legibility`, which is expected.
- **Name each adornment after its carrier.** An adornment stands off the earlier ones only when their `id` contains
  its carrier's name or one of its `over` parts' names (the heroine's `torsoSash`, `torsoBowKnot`). Ids that do not
  follow this interpenetrate and fleck.
- **A plume** is a spine of offsets in metres from its anchor (+y front, +z up, x scaled by each `spread`). Its
  cross-section turns with the spine: running down and back, `squash: [1, 0.2]` is a flat panel wide across; running
  down and outward, use `[0.2, 1]`. A spine with no horizontal step turns the section unpredictably. A plume rides one
  pin rigidly.
- **A collar's `at`** is a station id (`st0`, `st1`, …). A between-station id such as `st3_st4_50` exists only after
  `refine` halves that part. `height` is the rise as a share of the ring, and `width` a share of the span between its
  neighbouring stations (two station spacings, one at an end station such as `st0`).

## Gear and adornment words on an anime character

Words from the arms and armour project that a costume can use, with the traps the loop's designers hit. The theme rule
decides whether any of them belongs.

- **Gear.** `gear: { right?, left?, back?, hip? }`, each slot an item's build words
  `{ item, style?, dials?, parts?, gem? }` (the equipment manual gives the items, styles and parts).
  - The holds: `right` and `left` in the fist, a blade's tip forward and down (a raised forearm carries it upright;
    the hand has no roll, so from the front a held blade can read end-on, a thin stick), a staff or a bow near
    upright with its lower end just above the floor, a shield along the forearm; `back` across the shoulder blades (a
    blade hilt-up over the right shoulder); `hip` at the LEFT hip only, hilt forward and up. The three-quarter camera
    stands on the figure's right and, with the default key, so do the key-side profile and the gameplay camera: a hip
    item sits on their far side.
  - An anime hero's gear takes `stylize: 0.7` unless its build sets one. The build's own `dials` win over a style
    card's, so a `stylize` inside an inline card never applies on an anime hero: put `dials` on the slot, beside
    `style` (`hip: { item: 'sword', style: { … }, dials: { stylize: 0.9, mass: 1 } }`). Lower it for a slimmer, more
    realistic item.
  - The sample styles can out-shout an anime head: most bring their own stone and ornament (each card's `gem` and
    `dials.ornament` say so; the default `historical` carries neither), and as stylize rises the stone grows fastest.
    Both armed designs in the trial used a plain inline card with no stone. Start it from a copy of a sample card
    (`SEEDED_STYLES` in `control/lib/graph/equipment/styles.js`, each carrying every field an item needs) and edit
    only `roles` (`{ blade, fittings, accent, wrap }`, the colours), `dials.ornament` (little or none) and `gem` (leave
    it out for no stone; `gem: null` drops a sample's). Keep `edge` (a blade needs `edge.bevel`), `lean` and the
    per-item `language` for every item you carry (a bow needs `language.bow.limb`). A card missing them passes the
    style check but builds broken geometry, and the card run stops on the parity guard at a held gear face: on a card
    with gear, that error means the item's geometry is broken, not that the World drifted.
  - There is no scabbard word. A hip blade is bare, and its tip shows below a long coat from behind: colour the blade
    as the sheathed sword and check the body's rear cell.
  - The swing words (`SWING_WORDS` in `control/lib/graph/polygonizer/hero-swing.js`; a refusal lists them), such as
    `chop`, `thrust` and `bash`, stand the hero in the swing's ready pose and need the swinging hand's gear. A swing
    word stands alone: it takes no pose words after it (a list refuses). To tune a fighting stand, use `guard` or
    `relaxed` with pose words and the item in hand.
  - Judge the gear's size, shape and value on the card, not its shine: the World page shows the metal.
- **A `tabard` on a strap.** `signature: { kind: 'tabard', len, thick, tilt?, stand?, taper?, hemGroup?, hem? }` hangs a
  flat cloth board straight down from a strap's path, so it can hang below the torso's hem: an apron's skirt from a
  waistband strap, coat skirts as panels from waist straps (the gaps between them are vents and a sword slit), a sash's
  ribbon ends from a short strap at the knot, a purse. `tilt` swings the hem out from the body along the strap's normal
  (forward on a front panel, back on a back one), `taper` below 1 narrows it toward the hem and above 1 flares it, and
  `hemGroup` binds the hem in another group. It is rigid on its pin: it will not swing, and a long one cuts the thighs
  in a stride. Keep it short where the legs move, tilt it off them, and name it in the hand-off.
- **A `facing`.** `{ kind: 'facing', dir, r, h }`: a disc on a shell's outer skin where it faces `dir`, or `at` (0 to 1)
  along a strap. A button, a badge, a clasp.
- **A shell's `rim`.** `rim: { group, at?: 'low' | 'high' | 'both', w? }` on a shell or band paints a band along its
  own edges in another group: piping on a collar, a boot's cuff, a pocket's binding. `at` names the window's ends in
  `s`, so a boot's top edge on the shank is `low`; a partial shell's side edges are painted too (`wt` their width,
  `ends: false` for none).
- **`pin` and `rigid`.** Every adornment and its signature ride one carrier address, and so one bone, by default the
  middle of its window or path. `pin: [s, t, side, part?]` chooses that address, on another part if named: the
  trial's lead wears a scarf band on the neck pinned to the torso's upper back (`pin: [3.4, 4, 'R', 'torso']`), so it
  rides the torso, not the turned head. `rigid: true` changes nothing on the mesh; it makes the dress ledger name the
  bone the adornment rides (its `bone`). The pin is what moves it.

## Hair as shapes: carrots, bananas and peppers

The anime head's `shapes` hair word composes a hairstyle from ONE family of primitives, each one closed piece placed
on the cap by `at: [azimuth°, elevation°]` (azimuth 0 the front, 90 the hero's right, 180 the back; elevation 0 the
hairline, 90 the crown) and aimed by `dir: [x, y, z]` (x the hero's right, y up, z back), or laid in rows by `layers`
(`{ shape, az, el, rows, count, length, width, droop, lift, cover, sprout, vary, bend, swirl }`), which flow from the
`whorl` along the head (`swirl` turns a layer's flow by degrees, clockwise seen from outside: a fringe swept off its
part, a crown that spirals one way).
`replace` names the studio clump groups the recipe takes over (`fringe`, `temple`, `back`, `crown`); `scale` grows the
whole style against the head (the shonen guide's stylization dial: the more expressive the register, the bigger the
hair). `sideburns` (`{ length, width, forward, shape?, at?, az? }`) is a hair word of its own and works on any style,
in the style's family.

| Family | What it carries | Shape | Fields |
|---|---|---|---|
| CARROT | points AND mass: the only family that holds a spiky design alone (short and wide reads as mass, long as a spike) | a CUT CONICAL CARROT: round, its square-cut base sunk into the mass, never pinched or draped | `length`, `base`, `sink`, `curve` (0 a cone, toward 1 a thorn), `bend` |
| BANANA | locks: broad tapered locks that TILE the head from a smooth crown and part into points at their ends (the operator's sketch) | a flat crescent widest a third of the way out, laid along the mass | `length`, `width`, `flat`, `bend`, `sprout` |
| PEEL | sheets: a LAYERED BANANA PEEL, a few of them laid one over another (the young-Bieber / farm-boy-Skywalker swoop) | a leaf: a narrow stem, widest where it leaves the head, a pointed tip; thin, its edges cupped to the scalp | `length`, `width`, `flat`, `cup`, `bend`, `sprout` |
| PEPPER | strands: a CHILI, the thin version of the banana's tiling; the weight is how many are layered and how thin and long | a small shoulder at the stem, a slender taper to its point | `length`, `width`, `bend`, `sprout` |

ONE FAMILY PER DESIGN. The operator's experiment (Broku's carrot layout rebuilt as bananas and as bellied peppers at
three length and width settings): length variation inside one family does make hierarchy, but each family has a range
of jobs — a stretched pepper becomes a carrot, a short wide banana goes to mush. So a design picks the family that
fits the style and varies length, width and count inside it. The characters: `broku` (carrots, after Toriyama),
`jinto` (bananas: comma hair over a soft two-block), `jingo` (his cousin: bananas, few and rounded, for a long face),
`kairo` (chili peppers: a wolf cut), and the first heroine, `bidel` (bananas: Videl's short cut).

A HAIRSTYLIST'S PASS made the last two current rather than generic shonen: name the real cut first, then build it.

- **Jinto, comma hair.** The whorl set back and low (`[180, 45]`) so the crown is a smooth dome. The sides are short
  and flat, and the nape is tapered and rounded above the collar, never a rat-tail point. The story is in the front:
  the fringe is parted on his left and swept one way to the brow, with one comma lock curling in over his right cheek.
  Silhouette: a rounded helmet that nothing breaks.
- **Kairo, a wolf cut.** A short base layer fills the shape before thinner, varied strands texture it. The crown is
  the tallest and shaggiest zone. The sides step from the ear to the jaw, the nape grows to the collar and flicks out,
  the sideburns are long and wispy, and the middle part is piecey and off centre. Everything swirls one way from the
  whorl, with one long flick at his right jaw. Silhouette: an hourglass from the side.
- **Jingo, hair that grows from the dome.** Few pieces placed with intent: 29 bananas against Jinto's 57. Every lock
  is a CAP lock (below). A long face wants no height on top, so the crown lies flat and the hem sits at the jaw, the
  fringe cut to the brow. Fewer, wider pieces read calmer and more graphic; the count is a texture choice, not a
  coverage one (cover tiles them either way).
- **The dome is a cap; length is measured to the hem.** A first Jingo set each lock's length from its root and aimed
  it out, so the low side locks came out longest and stood off the head like flaps, longer on the sides than on top.
  Real hair grows from the whole scalp and crosses the dome: a lock from the crown must be LONGER than one from the side
  to reach the same hem, and it falls over the shorter ones beneath. A layer's `cap: 1` walks each lock from its root
  along the scalp (flowing from the whorl, gravity bending it down), lying higher the higher it grew, until it passes
  the hairline or the head's widest point (below it the skull turns in toward the nape, and a lock that kept to it would
  bunch into a knot there); only then it falls free for `length`. `fringe` is the shorter length for locks that leave
  over the face.
- **Volume at the widest.** Where the hair leaves the head is where it is most voluminous: a cap lock lies thin and
  flat on the dome, sleek to the scalp, and swells to its full width and thickness at its departure, bowing out by its
  `bend` before it tapers. A lumpy dome is the volume in the wrong place.
- **Jona, layered banana peels.** Twenty leaf-shaped peels, every one a cap lock. The crown's peels fall over the sides
  and back into a rounded mop over the ears and collar; the front's are turned hard toward his right (`swirl: 60`) and
  barely droop, so the dome walk carries them ACROSS the forehead before they fall: the swoop, from a part over his
  left brow. A flat lock keeps off the body by its thickness, not its width, so a peel lies face-down on the neck.
- **No gap before the ear.** Every anime head with hair wears a thin sideburn patch in the hair's colour on the skin
  before each ear, tucked under the hair's edge and tapering to the ear's lower third. On a bald head the skin shows
  there: the face's own colour, with no patch edge for the ink to outline.
- **Never through the body.** Shaped hair keeps out of the body it is worn on: the hero's own neck and torso rings
  are handed to the head, and a lock that meets them drapes over them (the push carries on down the lock, so it never
  kinks back in). Hair lies close on the neck and stands off the collar and shoulders. A long cut then shows where it
  really falls: Kairo's nape was shortened to end at the collar instead of pouring over his shoulders.
- **Bidel, the principles on a heroine.** Not Broku's spikes on a girl: Videl's short cut (Toriyama), built as Jingo is,
  from cap bananas, with the volume and the hem cut for her. A rounded crown, jagged bangs cut to the brow with the
  EYES CLEAR, the temples swept down over the ears, the sides at the lobe, a short choppy nape of points. What she
  taught: with the whorl behind the crown, every cap lock rooted ABOVE the whorl's elevation walks FORWARD over the dome
  and falls over the face, however far back its azimuth. So only the fringe (cut short by `fringe`) and the rosette
  root in front of the whorl; the crown ring sits at or below it; and the temples, which a back whorl also sends
  forward, are turned down over the ears by `swirl` (positive on her right, negative on her left). A test pins the
  eyes clear and the high crown ring covering one.
- **Face zones: red, yellow, free.** Long hair falls past the face, so the head reads where it falls: RED is each
  eye's iris and the nose and mouth (a face reads through them), YELLOW the brows, lids, cheeks and jaw (where bangs
  end and long hair frames the face), the forehead above the brows free. `hairCoverage.face` gives the share hidden of
  each, from the front and both ¾; the advice speaks past 15 % on red and 75 % on yellow.
- **The veil is the mystery lever.** A peekaboo is a choice, not a mistake: `hair.veil` (0 … 1) lets the one eye the
  hair covers most go under it (to 75 % at 1) and the yellow to 95 %. The other eye and the mouth never: one eye
  veiled is allure, both is a hood. Jona's swoop wants about 0.9; Bidel needs none.
- **Selene, heavy on one side.** Layered peels grown long. Weight on one side is MASS and LENGTH there, not only the
  swoop: a deep part over her left brow and the front swirled hard right (`swirl: 60`, little droop) so the cap walk
  carries it across the forehead; the heavy side long over the shoulder; the BACK split at the middle, its right half
  long and its left short, and swirled to her right (`swirl: -25` on the back sends it right) so the mass below the chin
  sits right; her left side short (0.7) behind the ear. A first pass with a symmetric back hemmed both sides at the same
  height: the asymmetry was only in the face. Her `veil: 0.9`: the swoop veils her right eye.
- **Sintia, flower petals (Cynthia the guiding light).** After the operator's petal sketch: a FEW big peels, wide
  through the middle, each end hooking OUT to a point (`flick`, −1 … 1: out from the head, or under it below 0; the hem
  held). The one exception to "bend one way": a petal's end may turn. Elegance is few large shapes, not many strands.
  A first Sintia went to the waist with a two-petal swoop over one eye, and read as hair laid all over the body with a
  wedge pointing into the face. MANAGEABLE beats long: to the shoulder blades, the back behind the shoulders (only the
  face-framing petals come forward, to the collarbone), CURTAIN BANGS parted off centre and swirled away over the temples
  (±50; ±30 covered the eyes at the ¾, ±55 bared the forehead), and one short centre petal cut to the brow to round the
  part (two curtains alone meet in a pointed arch). Flicks gentle on the sides and back (a strong one hooks out sideways
  where a petal meets the shoulder: a flap). The page draws no outline between hair pieces, so same-coloured petals part
  only by their SHADE: give a pale blonde a deeper gold shade tone.
- **Frieda, gathered hair (Frieren, the ice princess).** A tail is two things: the hair GATHERED into a tie and the
  tail falling from it. `gather: [az°, el°]` on a layer walks each cap lock over the scalp toward the tie instead of
  away from the whorl, sleek all the way, and ends it there (no free fall); the tail is a few long peels placed at the
  tie (`peels`), aimed nearly straight down with a little bow off it — aimed back, a tail juts out at 45° and reads as a
  handle; fanned wide, the peels hang like wings outside the arms. Frieren's ties sit HIGH on the back of the head, so
  from the front each tail's top is level with the top of the head: there the tail leans a little out to clear the head
  and a little back to fall behind the shoulders. One layer per tie: twin tails are two layers, each half of the head to its own side's tie. What stays loose
  is the face: split bangs off a centre part cut at the brow, and two narrow ribbon sidelocks before the ears (wide,
  they taper to spikes). A pale silver wants a cool blue shade tone to part the peels.
- **Keep a pair apart by the nape.** Jinto is closed and short at the nape and his story is the front; Kairo is open
  and long at the nape and his story is the crown and the tail. Trade nape lengths and both collapse into the same
  spiky hero.

Build in this order: the mass first (stubby carrots, a crown layer of bananas, rows of chilis) until it carries 60–70 %
of the silhouette, then the flow back to front, then the outline's accents, the fringe last, an accessory clamping
everything. The principles, one line each:

- **Cut conical carrots.** A spike is a round cone cut at a wide base and sunk into the mass; it never floats on a neck.
- **One family.** A design is carrots, bananas or peppers; it varies length, width and count, it does not mix.
- **Mass before spikes.** Build the envelope first; spikes ride its outline, they do not make it.
- **One whorl.** One hidden origin, behind and off the crown; every piece's direction follows out of it — the front
  forward and down, the sides and back back and down. Layers flow along the head from it, never straight out (a sea
  urchin).
- **Hero and court.** One dominant piece, two or three secondary, the rest small (about 1 : 0.6 : 0.35); odd counts.
- **No twins.** Neighbours never share a size, an angle or a length; the two sides differ in at least two of them.
- **Shallow valleys.** A notch between spikes is never deeper than 40 % of the spike; the cap never shows between them.
- **Shingles.** Every base is hidden under the next layer: front over back, upper over lower.
- **Tile, never bald.** Bananas and chilis are shouldered at the root to overlap their row neighbours (`cover`), so the
  scalp never shows; they part only toward their points. Chilis tile by count, not by width.
- **Sprout, don't push.** A lock leaves its root along the head, flowing from the whorl, and only then arcs out
  (`sprout`); pushed straight out of the skull it reads as a spike through the face. Bangs root up on the crown and
  flow over the forehead, and a ROSETTE (`around: [from°, to°]`, rings by angle from the whorl) fans out from the
  whorl itself so the crown is never bald, from the front, the back or above.
- **No straight-up spike.** A rising carrot leans at least 30° off the vertical seen from the front and from the side;
  horizontal-ish is fine.
- **Bend one way.** C-curves, never S.
- **Clamp and flare.** Under a band, circlet or bandana the shapes press to the skull; above it they flare at once.
- **The black blob test.** Fill the head black: it reads at 64 px from the front, the side and the back.

Cross-referenced recipes (how each hero decomposes; under the one-family rule a design keeps the family that carries
most of it — Goku, Crono and the Dragon Quest III hero carrots, Natsu and the Dragon Quest XI hero bananas):

| Hero | Peppers | Bananas | Carrots | Clamp |
|---|---|---|---|---|
| Goku (Toriyama; `broku` is its carrots-only design) | crown up and back, two sides, back to a nape point, two over the ears | four heavy bangs (the long one off centre), two sideburns | seven thorns, swept 30–60° back in profile: one hero, one long level spike, a court | none |
| Crono (Chrono Trigger) | one tall teardrop above the band, leaning back | two short bangs over the band; the band's tails | five or six up and back from a whorl behind the band | headband |
| Natsu (Fairy Tail) | a modest crown | five jagged bangs to the brow, flicks at the ears | ten to fourteen short, stubby ones out and down, a flat hierarchy | none |
| Dragon Quest III hero | the back, into three nape points | — | three short over the circlet, five or six up and back above it | circlet |
| Dragon Quest VIII hero | the bandana itself (cloth) | three or four bangs, temple locks, a short nape flap; the knot's tails | — | bandana |
| Dragon Quest XI hero | one smooth mass | curtain bangs, locks to the jaw, the back gathered into a low tail | only at the strand tips | tie |

## Score it

Score your final card 0 to 3 on each, honestly:

| Criterion | What earns a 3 |
|---|---|
| Silhouette | recognisable in black |
| Face at 256 px | the eyes, brows and mouth read as shapes |
| Hair masses | lit and shade shapes, not noise |
| Values | three clear groups in the thumbnail |
| Personality | the three-quarter says who this is |
| Theme and pose | the costume, gear and stand belong to the role and the temperament |
| Brief match | the character the brief asked for |

List every defect you see: hair through the face, holes, spikes, dark blotches, stray lines, a mark the outline eats,
seams where panels meet, gear through a hand or a leg. Say what the card could not show, such as a hem or a tail in
motion.

## The critic and the blind judge

The designer is too close to the card to read it as a player will, so the loop ends with two outside eyes.

- **The critic** is a separate agent that never saw the design and does not read the designer's notes: the card has to
  speak for itself, as it will to a player. Give it the before card (the start the design was built from) and the
  after card, with their `expressions.png`, the after spec with its `$` notes removed and its `readout.json` (only to
  name the word a fix should move; it renders and edits nothing), and the principles in this file. Keep the brief in a
  file it opens only AFTER it has written its one-second read.
- **Its order** (the brief below): the first read, brief match, theme and pose, the principles, before against after,
  defects. It hands back a verdict, a before→after table, at most three fixes ranked by how much each changes a
  player's read (each naming the word to move and which way), a Keep list, and the defects.
- **The rules the trial taught.**
  - A fix may never weaken a word of the brief. Softening the apprentice's grin to cure a sly read cost "cheerful",
    and the judge preferred the card before the fix.
  - Big reads first: the theme, the pose, the signature. Tuning fixes (a colour, a spine curve, a dial) are optional.
  - Name a limit rather than ask for a fix the words cannot make (a swinging coat, a hand on a hilt, a scabbard).
  - Read the midsection from the readout's `core` as well as the body cells: the waist to hip, where the hip peaks, the
    seat, the front below the waist, a pouch, a step in the outline, the legs. Its `advice` names the word that moves
    each (on a streamlined hero most of them are `core: 'structured'`). A hip that peaks at the joint, a flat seat, a
    front that bulges below the belly and splayed knees are what made the female figures read wrong before the
    structured core.
- **One fix pass.** Take the fixes in at most three renders, then stop.
- **The blind judge** is the acceptance check: an agent that knows neither card's history. Hand it two cards as X and Y,
  swapping the order from one comparison to the next and keeping the key yourself; it judges each criterion from what
  is drawn, not the words printed on the cards. Keep whichever card wins, even when it is the one before the fixes, and
  judge the final against the original too. Keep it blind:
  - Render both cards under the same `name` (into separate `--out` folders), or crop the title block off both before
    handing them over. The title prints the name and the words, gear and tabard among them.
  - Use one fresh judge agent per comparison. A judge that has seen one comparison knows the card the next shares.
  - On a TIE, keep the card with fewer changes (the one before the fixes). Write the judge's confidence down with
    its result.
- **What the trial found.** Characters designed before the gear and adornment words existed (a heroine, a hot-headed
  lead, a merchant's apprentice and a bodyguard) went through the loop with them, then the critic, one fix pass and the
  blind judge. The originals lost to the finals on all four. The critic's biggest catch was a pose out of theme: the
  heroine's raised near hand read as a clenched fist, a fighter, against a brief that says she is not one, and
  dropping it won both blind comparisons. Its small tuning fixes came out neutral or worse: on two characters the judge
  preferred the card before the fix pass (each at low confidence), and on a third it could barely tell them apart.

A critic brief to hand over. Fill in the placeholders; the paths in it are from the repo root.

```
You are the design critic at the end of a character design loop. Judge the AFTER card as an art director
reviews a character sheet, and hand back what to fix. You did not watch the design and you do not read the
designer's notes: the card must speak for itself, as it will to a player. You render and edit nothing.
You get: the BEFORE card <before card> and the AFTER card <after card>, each with its expressions.png
beside it; the AFTER spec <after spec> (its notes removed) and its readout <after readout>, only to name
the word a fix should move (the words: the Hero door in control/lib/graph/solid-vocab/layered.md, and
equipment.md beside it); the principles: docs/examples/humanoid/DESIGNING.md, "The theme rule" and "What
good looks like"; and the brief at <brief file>, which you open only after step 1.
1. First read: glance at the AFTER body ¾ and body rear ¾ cells and write who this is in one sentence (role,
   age, temperament), as a player would guess. Then open the brief. A mismatch is the most important finding.
2. Brief match: what reads, what reads wrongly, what is missing.
3. Theme and pose: the equipment and costume belong to the role, at its size and style, with no drift toward
   a genre the brief did not ask for; the stand says the temperament; gear is held as this person would.
4. The principles: the silhouette and its one accent; the face at 256 px; three values; one base garment and
   one signature with the one saturated accent; the gameplay camera; hair as masses; the head leads; the
   midsection (the body cells, and the readout's `core` and its advice: the hip, the seat, the front, the legs).
5. Before against after, per criterion: better, same or worse, with the cell that shows it.
6. Defects you can see, each with its cell.
Hand back, in markdown under 600 words: First read; Verdict (SHIP | ONE MORE PASS | REGRESSED, one line why);
Before → after (silhouette, face at 256, hair masses, values, signature and accent, gameplay camera, theme and
pose, brief match); Fixes (at most 3, ranked by how much each changes a player's read: what is wrong and
where, the word to move and which way, what the card should show after); Keep; Defects.
Rules: a fix never weakens a word of the brief. Theme, pose and the signature come before tuning; mark a
tuning fix optional. Never ask for a fix the words cannot make (a swinging coat, a ponytail word, a hand on a
hilt): name it as a limit. Standard art and garment terms; never name a studio, game, franchise or artist.
What you see is your read.
```

A judge brief:

```
Two cards of the same game character, X and Y, come from different design passes. You don't know which came
first or which used which tools. Judge which better realises this brief as a character a player would meet:
<brief>
Look at every cell, the body rear ¾ 20° down (the gameplay camera) among them. Ignore the words printed at the
top of each card: judge what is drawn. For each criterion say X, Y or tie, with the deciding cell in a few
words: brief match; theme and pose (an unarmed civilian stays unarmed, a calm character is not posed as an
action figure, nothing drifts into a genre the brief did not ask for); silhouette; face at 256 px; values;
costume (one base garment and one signature, built cleanly: no seams, flecks or pieces through the body);
gameplay camera.
Then: OVERALL: X | Y | TIE, CONFIDENCE: low | medium | high; WHY: two sentences; OUT OF THEME: anything on
either card that does not belong to this character, or "none". Under 300 words. Standard art and garment
terms; never name a studio, game, franchise or artist.
```

## Words that surprise

- **Look words stack.** An archetype already carries its traits, so naming a trait again applies it twice. Ratios stack
  by product. Offsets add: the face's `tilt`; the hair's `sweep`, `part`, `ahoge` and `strands`; the graphic face's
  placement and angle words such as `browArch`. So a second `ahoge` on the kid gives 2, past its range, and no warning
  fires. A family or a pose is last-wins. To see what a look set, compare the readout's effective values with `own`,
  or card the look alone.
- **Your own expression replaces the pose's.** In `['determined', { brow: 0.3 }]` the brow is 0.3, not 0.55. An
  own `expression` also replaces a look's pose wholesale: `lead` with your `{ brow: 0.3 }` drops the pose's blink.
- **The cut's objects need `amount`.** `sweepBack` and `sweepSides` take `amount` inside the object (a bare number is
  the amount alone). Their other keys are target points in the head's construction frame (y up, +z back, the head
  about 2.2 tall), blended by the amount. Copy from `lead.json` or `tough.json` rather than guessing.
- **Lock names.** `fringe-1` to `fringe-7`, `left-` and `right-temple-0` to `2`, `back-1` to `back-11`, the short
  family's crown accents `crown--1-0` to `crown-1-2`, and `ahoge`. An edit adds `cx`, `cy`, `cz` to the lock's control
  point and `tx`, `ty`, `tz` to its tip, in the construction frame. −x is the figure's left, so +tx moves a tip toward
  the figure's right. Render to confirm.
- **Sign and range matter on the graphic face.**
  - `browArch` is an offset on the base's own arch, comfortable in [-0.03, 0.05]; below that `warnings` says so. On
    the male base the brow presses onto the lid at -0.03 and crosses it by about -0.06. The female's stays one stroke
    to about -0.1 and breaks into crossed strokes past -0.12. `faceMeasures.features.browGap` going negative means the
    brow has entered the eye opening.
  - `fissureShape: 'tri'` gives the upturned outer eye, a straight upper lid rising to the outer corner. The face's
    `tilt` (and `tsurime`) lifts the corner too but barely shows at card scale.
- **The feature bands are adult.** The spacing advice measures against the adult male and female bases, even under a
  look, so a kid's or an elder's face will be advised back toward them. Under a look that advice stays out of
  `warnings`: it is only in `faceMeasures.features.advice`. Overrule it on purpose, and say so.
- **Out of the words' reach today.** Record these as misses instead of fighting them:
  - the face: age marks, a truly flat or turned-down mouth (the rest mouth keeps a slight upturn at its outer corner,
    even where a cast note calls it flat, so "determined" can read as a smirk), a one-sided smirk on purpose, a markedly
    round face (fuller cheeks and a shorter lower face move the three-quarter only a little);
  - the hair: grey at the temples, a pompadour, upright spikes without raw curve numbers, and any tied style (a
    ponytail, bun or braid) on the anime head. A ponytail can be faked as hair-coloured plumes on a neck band coloured
    to vanish; from behind it reads added, not gathered;
  - the costume and gear: cloth that swings (a tabard, a plume and a coat skirt all ride one pin rigidly and can sink
    into the legs when they move), a second sleeved garment over the top, a scabbard, an open hand, a hand placed on a
    hilt or a prop, and a bow at full draw.

## What to hand back

- The spec, with a `$note` in standard terms.
- The final card, and `expressions.png` if the face matters.
- The concept: the thesis, the value table, the signature, the stand, and what the role carries and wears (or why it
  carries nothing).
- The scores and the defects.
- The critic's verdict, the fixes you took and any you refused (and why), and the blind judge's result: which card was
  kept.
- The misses: what the brief wanted, and whether it failed for want of a word, a word too weak, a form that breaks,
  or the manual not saying.
- If the character goes on to animation, a hand-off in words: the gestures that fit the personality and, if a real
  outfit is wanted, the garments in garment terms. Name anything rigid that should move (a tabard, a plume, a hip
  blade against a stride), since it needs real secondary motion or a clearance check there. Leave the clips themselves
  to the animation pass.

Use standard anatomy, art and garment terms in everything you write, and never name a studio, game, franchise or
artist. What you see on a card is your read, not a verdict: the operator judges the character.
