### Fantasy character dressing

Fantasy clothing on a hero, then armour: the breaks mended, one cloth law (a material's rigidity read at rest, in
motion and in the drawing), the flow wired into the clips, and a fantasy wardrobe on every body.

Built so far: the mends, the cloth law as data, the flow in the clips, and the first drape at rest (the chest, the
sleeves, the hood).

- **A robe's skirt no longer tears down its centre on the World page.** The rig preview moved each bone's triangles
  rigidly with its bone, and a triangle rides the bone its corners vote for; a skirt's centre seam (its corners half on
  each thigh) voted for one leg and the other in turn, so the page showed a sawtooth slit front and back at rest (the
  idle clip a hero with no stand opens on) and tore it open from the waist to the hem in a stride; a cloak's hem, a
  realistic skirt's lower half and every joint cracked the same way. A corner the skin shares between bones is now placed
  by its weights, as the skinned GLB places it, then taken into its bone mesh's frame (`rig-preview.js` `rpBlend`; the
  ink a part wears follows its moved corners), so two triangles meeting at a corner meet in every frame. The recipe, the
  pack and the GLB are as they were: the mesh never had the seam. A bank whose parts carry no skin emits the channel
  byte for byte as before.
- **The realistic body wears the ranger's kit and a mantle.** A fold ring the cloth's folds insert between two rings
  (`body-relational-folds.js`) mixed its neighbours' weights without holding them to four, so where the kit's belt or a
  mantle moved a fold onto rings weighing different bones a ring carried five and the rig gate refused the hero
  (`top_body blend at st29f1 must be ≤ 4 …`). It is held to the four strongest and made whole, as every other mixed
  ring is; a mix of four or fewer is as it was, so no minted hero moves.
- **A piece the outfit already wears is said and left off, never refused.** A `belt` piece over a card that wears one
  (the adventurer's) was `adorn (belt).id: 'belt' twice` at the rig gate. The card's is kept, as a kit's belt keeps over
  an outfit's, and the readout says `the belt is not worn: the outfit already wears a belt …`.
- **A piece built on a creature's landmarks says so plainly.** The medallion (a necklace hung from a creature's neck
  chain) is still not worn on a hero, whose neck is a loft it does not read; the readout now says so in those words
  (`the medallion is not worn: its medallion hangs on a creature's landmarks … so it is left off`).
- **The chest lies flat, and the mantle is a shoulder cape (outfit laws 2).** A robe's, a gown's or a tunic's bodice
  showed a roll at each of its rings from the waist to the shoulders: each ring's lift over the shirt beneath came out
  apart from its neighbours', and the rounded body puffed every dent between them. From a short band above the waist
  (where a sash or a belt holds the cloth) up, the bodice now bridges those dents along its length (`body-garment.js`
  `lie`, never in, so nothing beneath shows through); below the band it gathers as it did. The MANTLE was a band round
  the upper chest with a buckle on its front, which read as a belt across the collarbones, and the realistic tailor,
  which makes a belt of every wrap round the trunk, made it one (the shirt bloused over it up there too). It is now a
  short cape from the neck's root over the shoulders and the arms' tops (the cape fit, its dents bridged the same way),
  closed at the throat by a round clasp; `drop`, `open` and `clasp: false` shape it. A hero minted before keeps its
  look: its outfit is stamped with laws 1 (`outfit/principles.js` OUTFIT_LAWS_VERSION 2; the cut's own bytes unchanged).
- **The cloth law as data.** What a piece is made of is one table, `polygonizer/cloth-law.js` `MATERIALS` (silk, linen,
  wool, leather, fur, mail: each a rigidity on the rigidity scale and a weight against plain linen), and how a register
  draws cloth in motion is another, `CLOTH_REGISTERS` (strings round a curtain, links along each, the share of the
  body's travel the cloth feels as headwind, keys a pose is held for), a row for each hero register and for the anime
  and realistic lanes. A piece says `material` beside or instead of `rigidity` (its own rigidity wins); the weight slows
  the cloth's pull to its skin and the air it catches, never the gravity it feels. The rigidity words stay valid, and
  `docs/garment-principles.md` points at the table where it listed a second fabric scale. The numbers are a starting
  tuning from published spring-bone and cloth defaults, not measured. The solver's angles, exponentials and powers now
  run on the deterministic math, so a baked swing is the same on both CPUs.
- **A hero's loose cloth swings in its clips (hero laws 23).** The flow solver (`hero-flow.js`), until now called only by
  its own test, hangs every piece that says how it moves on its register's strings: a cloak (wool), a robe's, a wizard's
  robe's or a gown's skirt (wool, wool, silk; a tunic's linen), a card's drape panels, a bow's tails. Each string is bones
  appended after the body's, so the body's bones keep their indices and keys, and every clip's swing is simulated between
  its keys and baked into those bones (`hero-cloth.js`, the mount's hair bake's pattern), so the World page's player and
  the skinned GLB both play it as bone keys. The skirt hangs from the hips and is pushed out by the leg capsules (on the
  robed round and anime heroes a knee no longer shows through the front at mid-stride), the cloak by the arms; the
  hem's embroidery and other trims worked on the cloth ride the flowing vertex nearest them. An open curtain (a cape) now
  spreads its strings over the arc it covers, so its open edges are its own: laid round the back from a seam at the
  centre, a cloak had split up the middle in the walk. Read where the rig is packed: no plan or recipe moves, a hero
  minted before keeps its clips (its stamp, laws 22 or under), and a hero with nothing that flows packs byte for byte as
  before. A card's panels under a flowing cloak keep their skin (the two layers do not collide with each other yet, and
  a panel swung on its own came out through the cloak). Not yet: the hood (locked to the head), wide sleeves, the hair,
  and the realistic body's tailored skirt (the tailor's `robe_pelvis` declares no material, so it rides its weights as
  before; the realistic cloak, a cape, flows). A heel still shows out of an ankle-length hem's back mid-stride (the
  foot is not in the collision form), and the bake adds a few seconds to a flowing hero's page.
- **The chest and the sleeves lie as one surface (outfit laws 2, refined).** The bodice still showed ledges from the bust
  to the shoulders after the first pass. Its rings were bridged off each ring's own middle, and on the game body those
  middles jump forward at the bust and back at the shoulder blades, so a straight line in that frame was no straight
  line on the figure. The cloth is now read off one straight axis from the band to the collar. Each slot's line is
  bridged, rounded a little (never closer to what lies beneath than a third of its ease), and bridged again. The
  yoke's sideways cap, which holds the cloth in at the shoulder, now comes on over the rise from the armpit to the
  collar rather than at one ring, so it no longer steps in round the chest. A robe's, gown's or tunic's sleeves lie the
  same way down the arm, so the upper arm is no longer a stack of rings. A bell cuff keeps its widening to the wrist. On
  the tiered body, the box and the anime hero, the deepest roll the drawn bodice shows from the front or the back is
  now under 3 mm, where laws 1 drew up to 12 mm. The yoke's sides above the armpit, under the sleeve, still dip where
  the cap holds them, and the realistic body's bodice still stands in under its bust. Laws 1 are byte for byte as they
  were.
- **The hood is cut and falls as cloth (outfit laws 2).** It was a smooth bell over an ellipsoid sized from the head's
  joints. That ellipsoid was too big on the landmark head and far too small on a chibi, whose hood vanished inside its
  hair. The hood is now fitted to the head this figure has, read from its own parts: the skull, the face, the ears and
  the hair, on the landmark, anime, realistic and chibi heads alike. Its crown lies on the skull and the hair with a
  little slack, more as the cloth stiffens: soft wool lies close and stiff leather stands off. It never passes through
  either. From the head the cloth falls straight onto the shoulders, as a tent rather than a tube dropped onto them,
  and gathers into a few large folds at the neck. Its foot sits on the cloak's or the robe's collar. The opening frames
  the face from the chin to a rolled brim that clears the cheeks. The brim stands above the brow as far as the cloth
  is stiff, and `depth` sets how far it comes forward of the face. The back of the hood draws out to a `point` behind
  the crown. A short point is a peak with a seam ridge down the back. A long point is a liripipe hanging down the back,
  its own part, which flows on a strand of the hood's cloth in the clips. None keeps the back round. `worn: 'down'` lays
  the hood collapsed on the back as a loose ring at the collar over a soft sack, narrowing to its point, with the head
  and the hair bare. The words are `hood: { worn, point, depth, open }`. An unknown word is said and the piece left
  off, as a hem word is. The register sets the budget: a few planes on the box, facets on the low-poly body, smooth
  elsewhere. On the hair I chose clearance over tucking. A ponytail or long hair under the hood is enclosed, so the back
  of the hood stands out over it. The hood's body stays locked: up, to the head and the neck; down, to the shoulders.
  Laws 1 keep the bell byte for byte.
- **The open items, cleared where they fall out (outfit laws 2, hero laws 23).**
  - A clip played at two speeds. A clip that carried no seconds played over three seconds on the World page and over
    one in the GLB, and its cloth was simulated for the page's three, so the exported swing was the slow one played
    fast. A hero whose cloth flows now plays every clip over one duration on the page and in an export, the one its
    swing is baked at: a clip with seconds keeps them, the hero's own clips take the anime hero's timing (an idle in
    four seconds, a wave in two, a walk in one), a compiled clip one second, and an act its own clock. A hero with
    nothing that flows is as it was.
  - The realistic body's cape keeps its skin. On strings its open side edges sheared into angular flaps where the arm
    carries the cloth draped on it and the strings swing the rest, and the shirt showed through between them. No
    tuning of the strings made that clean, so the cape rides its weights as it did before the hero laws 23. A hood's
    liripipe still flows.
  - A heel still shows out of the back of an ankle-length robe in a stride. The cause is that the strings collide at
    their joints only: a heel kicked up behind the leg sits between the knee's joint and the hem's, mid-link, where no
    joint can meet it, which is why adding the foot to the collision form did nothing. Colliding the links as well,
    with the foot in the form, moved the hem but let the heel through between the strings and opened holes in the
    cloth, so it was not kept. The solver is as it was.
  - The medallion is worn. The necklace read the neck's radius as a chain's, and the hero's neck is a loft, so its
    chain came out with no size and the piece was left off. Under outfit laws 2 it reads the lofted neck by its lowest
    ring and hangs from the nape to its pendant on the chest. Laws 1 leave it off with the line that says so. The pendant
    is laid on the body's chest, so a tunic's or a robe's bodice over it still hides it.
  - A hood worn down lies flat on the back. It stood the hood's whole ease and a deep sack off the cloak, a hump in
    profile; it now keeps a share of the ease and a shallow sack, and its liripipe lies on the sack it hangs from.
  - The mantle is wool, so it hangs on strings and swings a little in the clips.
  - On the realistic body a robe's, a gown's or a tunic's bodice is the outer layer. The pieces named their part as a
    bare word where a card's pieces name a list of one, and the realistic body's tailor reads only the list, so it
    passed the bodice and the sleeves by: the game body's kernel drew them on the bare skin and the tailor's shirt came
    out over them. Under outfit laws 2 they name a list, the tailor makes them as its own cloth, a layer over the card's
    shirt and its sleeves, and the shirt shows only at the collar. The game body reads either form alike, so the
    tiered and anime bodies are unchanged; laws 1 keep the old look.
  - The realistic bodice under the bust. With the bodice now the tailor's close cloth, the 14 mm roll the game body's
    kernel drew there is gone from the realistic body. Over a 6.4 cm chord the tailor's bodice still goes in about 7 mm
    under the bust, where the card's shirt went in about 6; it was not brought under a few millimetres.
  - Not changed. The tunic's and robe's shoulders keep their bulbous caps: they are the game body's own shoulder forms
    (its deltoid ball, the trapezius cone and the web) standing out of the bodice's yoke. Wearing the bodice over them
    raised a ridge round the neck and left the caps, so it was not kept. The neckline is still the torso's top turning
    in to the neck. The embroidery that floats off a skirt mid-stride is placed at the skirt's waist ring rather than its
    hem (its window counts the skirt's rings from the top), and much of it lies too far from the cloth to ride it; it is
    left as it was. The box register's cloak reads its row as written (four strings of two links, held on twos); it moves
    little because two long links follow the skin closely. The hood still clears big hair rather than tucking it, so the
    chibi's hood stays large and the anime hood's back stays boxy over long hair. The chamfer noble's green shirt still
    shows at the back waist at mid-stride, where the skirt's top swings off it.
- **The open items, second pass (outfit laws 2, hero laws 23).**
  - A long skirt is carried by the legs. The strings kept their joints out of the legs, never the cloth between them, so
    a heel kicked up behind in the stride came out through the back of an ankle-length robe. Now a skirt that hangs as a
    ring of strings knows the shins, the feet and the toes as their outermost points, carried by their bones; each pose
    its target is pushed out round them, and what is shown of it is pushed out too: each string straight out from the
    ring's axis by what the cloth between it and its neighbour needs to pass outside every shin or foot point at that
    height, the push shared with the neighbours so the ring bulges instead of creasing, the links' lengths kept, so the
    trailing leg lifts the back of the skirt. The simulation's own state is untouched by that last pass, which is what
    flung the cloth when the push was made a constraint inside the solve; the last link runs on a little past its joint
    to the cloth's own edge. Through the walk the shin and foot points outside the skirt's surface fell from thousands
    to a few dozen on the round, anime and low-poly robes and the round noble's (the chamfer's eight strings leave a few
    hundred mid-chord at the back), and the ring keeps its order. The bake is two to three times slower. The realistic body's robe skirt is the tailor's shell on the legs' weights, not
    strings: hung on strings it tore and creased, so it was left as it was and its heel still shows.
  - Work on a flowing cloth rides it by the cloth's surface. It took the skin of the nearest cloth vertex, and on a coarse
    register the hem work lay farther from any vertex than it may lie to ride, so it stayed put while the skirt moved and
    was hidden or floated. It now takes the blend of the nearest triangle of the cloth's outer face (never the hem turned
    up inside a skirt).
  - A skirt's hem work lies on its hem. Its window was read as shares of every ring of the skirt, the turn-up inside
    counted too, so it landed on the lining at the knees, two to twenty centimetres off the cloth that shows. Under outfit
    laws 2 it is addressed on the skirt's outer rings, waist to hem, in the skirt's own measure, and lies within a
    centimetre of the cloth near the hem. On the realistic body, which read any band on a skirt as a belt at its waist,
    the hem work is a band of the trim's thread at that height of the tailor's skirt.
  - A hood worn up tucks the hair. The hood was cut round the whole head of hair. Now the hair behind its brim (the crown,
    the back, long back hair) is pressed in toward the skull to within a centimetre of it before the hood is cut, and
    the fringe and the locks that frame the face are kept whole; worn down, the hair is as it was. The anime hood's back
    is rounder and a little smaller. The chibi's hood is only a little smaller: its hair stood little off its head, and
    the hood's size there comes from its own ease, the brim drawn forward and the point behind the crown, scaled to the
    head, which this does not change.
  - A medallion hangs over the bodice. The chain was laid on the body's own chest, so a tunic's or a robe's bodice hid
    the pendant. Under outfit laws 2 it clears the close cloth already worn on the chest, and lies low and close round
    the neck's root behind, where it stood off the nape over a mantle. Over a mantle's shoulders the chain still shows on
    top of the mantle rather than under it.
  - Not changed. The tiered body's tunic and robe shoulders keep their bulbous caps and the shelf neckline: no different
    approach was tried in this pass. The chamfer noble's green sliver at the back waist mid-stride is the shirt's tail,
    skinned to the thighs, passing out between the skirt's strings at the top of the thighs; the legs' clearance covers
    the shins and the feet only. The light sliver at one shoulder with the hood down and the shirt's cuff at the
    realistic noble's forearm are as they were.

- **A fantasy wardrobe (phase 5).** Six outfit cards, one per archetype, each a seeded sample the hero door already takes
  as `outfit: { type: 'outfit', style }`: `ranger`, `mage`, `peasant`, `noble`, `cleric` and `rogue`
  (`outfit/styles.js` FANTASY_OUTFITS). A fantasy look was the modern `adventurer` card with pieces over it, and that
  card's green shirt showed at every collar and cuff. Now each card carries its own underlayer (its cut: a linen shirt,
  legs, boots or shoes) and its designed pieces over it, listed in the order a costume is worn: the over-garment (a
  tunic, a robe, a wizard's robe, or the cut's own coat or jerkin), a girdle at the natural waist, the outer layer (a
  cloak or a mantle, hoods by the draped hood's words), then what hangs over all (bracers, a medallion, a satchel, a
  thigh pouch).
  - Each card names what its cloth is made of (silk, linen, wool, leather, fur), so it hangs and flows by the cloth
    law. Its values run dark at the feet and light at the chest, and neighbouring layers differ by a value step or by
    their cloth.
  - Every card has a belt at the waist, never on the chest: the girdle piece carries an id of its own, and the cut
    spends no belt beneath the over-garment.
  - On the realistic body the cards wear what that body can: the cloak keeps its skin and does not flow, and a robe's
    skirt is the tailor's shell.
  - Make one your own as an inline card.
- **Fantasy headgear.** Three headgear words, each a card over the existing builders: `circlet` (an eyegear cast pushed
  up to the brow, its strap the band round the head, a gem on its front; it keeps the hair), `travelerHat` (a soft
  helmet shell with the brim fitting round it) and `wizardHat` (the same with a cone ornament leaning back off the
  crown). They fit the game body only. On the anime head the circlet is hidden under the hair.
- **A skirt's hem binding lies on its hem.** Under outfit laws 2 a robe's, a gown's or a tunic's `trim.hem: 'binding'`
  is painted on the skirt's last outer band. Before, it was painted on the last share of every ring, the turn-up inside
  counted, so it showed as a band at the waist. Laws 1 keep their band.
- **The shoulder under cloth (the tiered body).** A top worn on the game body ended in a flat shelf at the shoulders,
  and the body's own shoulder forms (the ball, its cone and its web, painted as the shirt) stood over it as balls: at a
  sleeveless tunic's armholes, through a cloak at the side and the back, beside a robe's sleeve. Under outfit laws 2
  every piece on the trunk (the cut's shirt, coat and waistcoat, a robe's, a gown's or a tunic's bodice) names its
  `shoulder`, sleeved or sleeveless (`body-garment.js`), and on a body with shoulder forms:
  - the forms are laid under the shoulder's line, from the neck's root down to the shoulder point and rounding over the
    arm's root; they keep their weights, so they move as before, under the cloth;
  - the piece's cloth runs on over them as pieces of its own, copies of the forms that skin as they do: over the
    trapezius from inside the neck to the shoulder point, then into the sleeve's head when sleeved, or ending there as
    the armhole's edge when not;
  - each layer stands off the cloth another layer wears there, so a shirt's shoulder lies inside a sleeveless tunic's,
    and a cloak, a mantle or a hood hangs over it.
  On the round, low-poly, chamfer, box and anime bodies the shirt's shoulders stood 3–5 cm over the over-garment's top;
  they now lie inside it, and the outline's rise at the shoulder (the ball on the shelf) went from about 2.5 cm to a few
  millimetres. With the arm raised, a shirt's sleeve head still comes up through a sleeveless armhole with the arm.
  Still open: the bodice's front still turns into its top at a level line across the upper chest, and the peasant's
  tunic is still boxy below the shoulders. Outfit laws 1 and the realistic body are unchanged.
- **A top's front is one surface to its neckline, and a belted tunic is a tunic (the tiered body).** The tiered torso's
  top is a box: its front and back stand up to the shoulder line and its last rings turn in over a flat lid to the neck.
  A top copied off those rings turned over the same lid, a level edge across the upper chest with a shadow under it, the
  shirt showing in a sliver along it, a little V at the neck, and a fold across the shoulder blades. Under outfit laws 2,
  on a body with shoulder forms (`body-garment.js`):
  - every piece on the trunk that names its `shoulder` RISES: from the chest's fullest ring up, each of its lines is one
    curve to the neckline, which is the neck's root carried out over what is worn there (a shallow round, lower at the
    front than at the sides). It is lifted over the layers beneath it, over the body, and over the shoulder's cone by its
    yoke's own ease, so the yoke lies under it at rest and comes out with a raised arm;
  - a sleeveless piece is an armhole: under the arm its side runs up from the chest's own width, never held out by the
    arm's root or by the shirt there, which now shows in the armhole; over the armpit it goes on over the shoulder's
    corner to its own yoke, so the shoulder point is narrower and rounder;
  - a robe's, a gown's or a tunic's bodice worn under a belt or a sash at the waist is taken in under it (the new garment
    word `cinch`), blousing a little above it, and ends just under it, where its skirt now hangs from (before, from the
    top of the hips, a ledge under the belt).
  The game body's jacket fit reads a risen ring at each point's own height, so a jerkin's front is no longer pulled in
  to the neck at the front (on the rogue that showed as a dark chevron of the shirt). Measured from the front on the
  peasant, ranger, mage, cleric and rogue cards (round) and the peasant and mage cards (low-poly, chamfer, box, anime),
  the largest step down the front's middle line from under the neckline to mid-chest went from 26–94 mm to 1–2 mm, and
  its sharpest turn from 48–80° to 9–20°, on the eleven heroes that had the lid, at rest, in a walk and with an arm
  raised; the fold across the back is gone. The peasant's chest is 2–4 cm narrower a side, it comes in a further 4.5–6 cm a
  side to the belt, and its skirt starts under the belt. The anime body shared the defect and takes the fix. Outfit laws 1
  and the realistic body are unchanged.
  Still open: the tunic's cross-section at the chest is no rounder (its front corners stay while its side came in);
  with an arm raised, the shoulder's cloth that follows the arm still meets the chest at an edge at mid-clavicle; the
  neckline rides 1–2 cm up the neck on some casts; the peasant's hood worn down still covers the shoulders; on the box
  and low-poly registers a small chip of the shirt shows at the top of a sleeveless armhole.
- **The fantasy wardrobe on the realistic body (gen-7).** The six cards were minted on the realistic body under the
  gen-7 cube, both sexes, and shot still, in the walk and with an arm raised. Under outfit laws 2 (the hero laws 23):
  - a tailored robe's skirt (the tailor's rings carried down from its body) that names its cloth hangs on the realistic
    register's strings from its first ring below the hips, its bodice and hips kept on their skin (`hero-cloth.js`
    `tailoredSkirts`, a curtain's new `top` in `hero-flow.js`), so the legs' clearing carries it: the shin and heel
    points above the hem that stood outside the mage's and the cleric's skirts through the walk went from 48–55 % to
    0.1–0.6 %. The tunics' short skirts hang on them too;
  - the cape sways instead of riding its skin: six stiff strings rooted below the hanging hand (`CAPE_FROM` of the way
    from the knee to the hip), its shoulders and sides on their skin, so the edges the arm carries are never sheared;
    its hem swings about 7 cm behind the stride and its turns down the cloth are as on its skin (95th percentile 45°);
  - a skirt's hem work is a motif: a thread of its colour in peaks over a plain rule, lying on the skirt where it flares,
    each a thread along its path rather than a band (whose ends were a disc across the open skirt) (`hemMotif`);
  - a medallion is worn: its chain, bail and pendant were each read as a belt round the waist (three gold bands over the
    girdle); they are laid on what is worn instead (`layNecklaces`), the chain on the cloth at the front and out of it
    elsewhere, round the neck's root, the pendant on the chest.
  Outfit laws 1 and the game and anime bodies are unchanged. Still open on the realistic body: the fur mantle stands
  off the shoulders as a stiff box and a raised arm tears its side; the arm swinging back comes through the cloak's side
  (as before); the hood is faceted, and worn down it stands proud of the back in the robe's own colour; the shirt's
  shoulder pokes white through a sleeveless robe's armhole; the hats and the circlet still fit the game body only (the
  relational head has no cranium kit to carry them).
- **The fantasy wardrobe on the realistic body, second pass (outfit laws 2, hero laws 23).**
  - The circlet and the hats are worn on the realistic body. They were refused there: the relational head has no
    cranium kit. Each card now has a realistic side, which lowers to a `headwear` word, and `headgear/realistic.js`
    builds it on the head the hero has. It reads the head's skin, its hair and a hood worn up, as the draped hood does.
    The circlet is a band traced round the head on a line from just under the hairline to the back of the skull. It
    sits over the hair, rides the hair's crests (it never dips into them), and widens to a setting and a cabochon at
    the front. A hat's crown is fitted over the hair: each meridian is bridged, then cleared crest by crest by half its
    ease. It has a ribbon at its foot, a brim turned up at the front and let down at the back, and, for the wizard, a
    cone leaning back off the crown. Each is one part per colour, pinned to the head's skin where the head bone alone
    carries it. The hair is kept under it. The card's colours sit under the operator's palette. A hero minted under
    hero laws 22 or earlier still refuses these words, by name. On the six heroes shot, no point of the head or the
    hair lies outside what covers it (`headwearGaps`).
  - A cloak on the realistic body takes the nearer arm out to 24 cm from it (`capeArm`). The cloth behind a swinging
    arm now goes back with it. In the walk's back view, the ranger's forearm and hand had shown through the cloak's
    side (0.7–0.8 % of their points, in 3–6 of 12 keys); now none do.
  - The mantle's clasp rides the shirt. Every shell worn on a body segment under outfit laws 2 (a clasp on the torso,
    a bracer on the forearm, a satchel on the hips) now stands off the tailor's cloth on that segment. Before, it
    searched for that cloth by the segment's own name and missed it. The noble's clasp points inside the shirt went
    from 7 of 52 to 0. The mantle's shoulder is rounded (a quarter ellipse from the neck to its widest ring) and its hem
    is rolled by 1 cm. It still stands about 3 cm off the shoulders, and a raised arm still draws its side out along the
    arm.
  - A draped hood on the realistic body is eased round (`hoodRound`). Worn up, each ring is smoothed round its
    directions and down its rings, then cleared again. The arch springs from the cheekbones, and a deep hood's brim
    comes forward as a soft fall rather than a visor. Worn down, it is a cowl gathered at the nape: a thicker roll, the
    cloth heaped under it with folds at the back, shorter down the back, and in its lining's shade (the cloth's colour
    × 0.72).
  - The peasant card's shirt is lighter and its tunic darker (`#e4dccb` over `#7a6440`, from `#d8ccb0` over
    `#9c8a66`).
  Outfit laws 1, the hero laws up to 22, and the game and anime bodies are unchanged. Still open on the realistic body:
  the shirt's white sliver at a sleeveless armhole, the skirt's centre-back crease and the facets at the hips, the
  rogue's pale ring at each boot top (it is the shank's skin seen between the blousing and the boot's cuff; turning the
  blousing's hem in did not close it, so that change was reverted), the bodice's dip under the bust, and the medallion
  chain's beads.
