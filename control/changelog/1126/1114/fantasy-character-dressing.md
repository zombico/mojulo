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
