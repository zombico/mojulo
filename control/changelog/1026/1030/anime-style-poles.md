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
