### Anime style poles: Shonen High

The anime head takes a style pole: a family of faces for a kind of game, between the head's base and the character, so
games made from it need not share one face. The first is Shonen High, after Bleach and JJK: teen to early-20s leads with
lean, long faces. The eyes gate is the operator's.

- **The style pole** (`anime-styles.js`; the hero door's `animeStyle`, the anime head only): per design base a face, a
  sculpt and a body tune in the door's own words, a layer over the head's form and under the child's face, the look,
  the hero's own words and genki, which compose on it; the base `/hero/face/<control>` moves off. Stored as its word
  beside a resolved stamp, as a look is, so a re-tuned style never moves a stored row; `null` takes it off. The readout
  names it, and a game's head look page can set it.
- **Shonen High** (`shonen-high`, after Bleach and JJK, teen to early-20s leads): a longer, narrower face with flat
  cheeks and a narrow V chin set forward; smaller eyes under a hard upper lid angled up to its tail, small irises and
  pupils; thin brows set low and angled (the female's straight, not arched); a longer nose; a lean body under a smaller
  head. Tuned over three rounds on the live viewer against JJK scale figures.
- **A style's own bands** (`anime-sculpt.js` `featureAdvice`): a styled hero's feature advice reads its style's bands
  in place of the base's it departs from; each base's Shonen High default is advised nothing.
- **Shonen High in profile** (after Yuji's): the brow's ridge forward over the eye and the bridge rising from between
  the brows nearly straight to the upturned tip; the male's jaw prominent and wider to a corner set low and angled, not
  turned under, the line from it climbing behind the jaw to under his ear and on into the back of the skull with no
  ledge to the nape, his ear set back over it, his chin forward; the female's brow and bridge the same, softer. New
  sculpt words for it: `earBack` (the ear set back along the head) and `napeLift` (the back of the head's underside
  raised behind the jaw, faded to nothing at the side seam).
- **Lifting the jaw's corner** to a figure's line was tried and set aside: raising the lower face's rows folds the face's
  front across the cheeks at any size that reads; the corner is set low and angled instead, the skull behind it lifted.
- **A high-schooler's body** (Shonen High's tune): skinnier from here on: the neck slim under the jaw, the arms and legs
  thinner, the waist and the chest's depth less, the shoulders a hair narrower, under the smaller head; the jaw's line
  reads against the neck. The body tune's new `neckGirth` (0.7 to 1.3) thins or thickens the neck, stored only when it
  moves off 1.
- **Shonen High's female after Nobara** (the north star): she wears the male's head (`head: 'male'` on her style
  entry: his skull, his profile, his jaw's line to the back of the skull, his ear), and over his face her own layer:
  her head smaller than his; her features softer (her brow's ridge, bridge and nose lighter, her jaw narrower, softer
  and turned under into a small pointed chin, her lids and brows less angled); her cheeks fuller; her eyes a little
  larger than his, almond under a heavier lash flicked at its tail; her brows thinner; her mouth smaller. Her body
  and her hair are her cast's. A style entry can lend a cast another base's head this way (`heroHeadPole`; the hair and
  the palette follow the cast, `heroHairPole`).
- **The jaw's line squared** (sculpt `jawLine`, a share, absent at 0; Shonen High's male at 1, and his female on his
  head): in profile the jaw's edge runs back from the chin nearly level to a corner set low under the ear, then
  straight up to it, and nothing hangs behind the chin. The side seam is drawn back toward the ramus by the column's
  nearness to it (the face's middle and the throat keep their place); the corner's lift comes off the sides, each point
  narrowed to the row it comes down to so the jaw keeps its V from the front; the underside behind the chin is raised
  onto the line from the chin's bottom to the corner by a smooth max. The male's lower cheeks fuller, rounding the
  face's side down to that edge.
- **The jaw's line, cleaned** (round two): the corner's lift taken off the sides narrows each point as the row twice as
  far below it, so from the front the jaw keeps the V the lift gave it and its lower rim no longer flares out; the
  line holds the face's side at the seam as well as the underside, the same from both, so the jaw's edge lies on it
  with no lip left below; the raise eased in behind the chin. Shonen High's chins a fifth narrower, his jaw's side
  curved in harder toward its edge (`jawHollow`), his female's with it.
- **A head seated back on the neck** (sculpt `seatBack`, of the head's height; the neck stays where it is): the head's
  registration moved back along its depth, the hair's body fit with it. Shonen High's female at 0.08: the male's head
  sat forward on her slimmer neck; seated back, her face stands as far before her neck as his before his. 
- **The keel under the chin merged** (round three): seen from below, the head's narrow bottom rows ran back from the
  chin as a keel with a jagged wall up each side to the wider floor. Behind the chin those rows now widen to the
  floor's width, so the keel and both walls curve into one piece, and the whole floor is then shrunk in toward the
  middle (the chin and the jaw's edge at the seam kept), so what shows from below is one smaller, rounded piece.
- **Shonen High's female, her lower face rounder**: her lower cheeks fuller and her jaw's side curved in less, so her
  face rounds out from the cheekbone down to the chin, the chin as pointed as before.
- **Shonen High's female toward Nobara's figure's proportions**: her eyes, as drawn (the lid band and lashes in
  them), about a quarter of her face's width and one eye's width apart, a little larger than his; her lower face
  shorter (her eye line lower in her head), her nose's tip and her lips lower, her nose smaller and lower in
  projection, her mouth narrower; her style's bands are the figure's measures, not the male's. A styled hero's sculpt
  words are read against their comfortable ranges only where the hero's own words move them off its form and style
  (`animeSculptBase`), as the hair's are: a style is its own canon.
- **Her cheeks taken back in**: the fuller lower cheeks of the round before read as chipmunk cheeks at three-quarter;
  her lower cheeks are now slimmer than his and her jaw's side curved in a little, so from the front and at
  three-quarter her face is one clean line from the cheekbone down to the pointed chin.
- **Her jaw from the front, one convex arc** (after the operator's drawn line): fuller along the jaw's edge from the
  nose's level down and narrowing into a narrower chin, so the outline is one curve from under the ear to the chin
  instead of a straight V meeting the cheek at a corner; at three-quarter it stays one smooth line.
- **Her nose and mouth raised**: her mouth moved up most of the way to where her nose's bottom was, and her nose's
  tip raised by the same amount under a root that stays, so the nose is shorter and steeper and the gap from it to
  the mouth is kept. All the way up, the mouth line sank into the nose's shadow and the nose all but flattened;
  three-quarters of the way reads.
- **Shonen High's bodies, proportioned** (on a proportion sheet: both casts at one scale, a line every head height):
  the male an athletic lead's, 7.65 heads (the torso shorter and the legs longer, the shoulders broader over a narrow
  waist, a V); the female long-legged and slim, 7.26 heads (the torso shorter, the legs longer, the waist narrow, the
  shoulders narrower).
- **The body rounded** (`body-smooth.js`; a style's `smooth`, Shonen High's 1; the recipe's `smoothBody: { rounds }`):
  the body's skin split once, each triangle into four, its new points on the curved patch its corners' welded normals
  describe (the curved PN triangle's edge), so the silhouette reads rounded rather than as its rings' facets. The
  corners keep their places byte for byte (the joints, the pinned parts' seats, the binds); a new point is appended
  after every point the mesh had and binds as its two corners' mean; a part's open rim splits on its straight line.
  Absent, the mesh as built. One round: the parts are still separate shells, so the seams where they meet (the chest's
  plates on the torso, the torso over the pelvis) still read; fusing them is the next step.
