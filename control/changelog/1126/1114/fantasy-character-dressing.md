### Fantasy character dressing

Fantasy clothing on a hero, then armour: the breaks mended, one cloth law (a material's rigidity read at rest, in
motion and in the drawing), the flow wired into the clips, and a fantasy wardrobe on every body.

Built so far: the mends (phase 1).

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
