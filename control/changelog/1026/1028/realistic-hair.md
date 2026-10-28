### The realistic hair as its main shapes

The realistic hero's hair, re-cut for the seventh-generation look: a designed mass that gives a hero its outline, in one
colour, with nothing to fight the light. Its register is a dial between a realistic game's hair and a stylised one's.
The eyes gate is the operator's.

- **Hair as its main shapes** (realistic laws 10, `REALISTIC_LAWS_VERSION`; `epidermis/hair-locks.js` `lockHair`).
  Laws 7 to 9 grew a lawn of thousands of blades, banded root to tip with grey flecks. Under real light the bands read as
  noise, and a dark-brown groom greying a little came out silver. The alpha cards shimmered at their edges, the cap
  showed through as dark squares, and the outline was fuzzy. Now a stroke budget (the operator's: a number of major
  flows, volumized, and some trailers, that's it):
  - MAJOR FLOWS: the groom's guides (`dermal-hair.js` `growScalp`) gathered into a few dozen flows, by their roots,
    middles and ends, never across the part. Each flow's section is drawn through its own guides across it: a smooth
    arc fitted to them, so a broad flow lies on the head as its guides do. It is domed and grooved on top, flat beneath.
    Its root runs to the hairline and its end to the cut's line. Under it the cap is kept as a solid inner shell.
  - THE FLOWS LIE ON THE HEAD (`LOCK_CONFORM`). Over the scalp a flow's section wraps round the head at its spine's own
    height, not as a chord across it, and the higher a flow is rooted the further out it lies (the crown's hair over the
    nape's). Its root comes out of the scalp, and a root reached back off a curved crown is laid back on it. So the flows
    shingle, never planks standing off the head at angles (long hair at `stylize` 0 read as crumpled paper).
  - VOLUME: round by round, only the flows nearest where the scalp shows grow wider, and only over the scalp, until the
    overlap principle holds (below): widening every flow hung panels below the head.
  - TRAILERS: a few strokes per flow riding its edges toward its tip and on past a free tip, breaking its outline, never
    flaring off the mass along a guide of their own.
  - THE FADE: the shell's edge is smoothed into a curve (`hair-depict.js` `capMesh` `smoothEdge`, laws 10 only) and
    fringed with strand cards running out over the skin, so no hairline is a hard line. The fade is the hairline's only
    cards (a card as wide as a flow stood off the temples as a barred plank in the skinned GLB).
  - TIP CARDS (`LOCK_TIP`, toward `stylize` 0): laid on a lock's top as narrow cards side by side, each through the
    lock's own section, so a broad flow's cards curve with it; one straight card across a broad flow (up to 18 cm) stood
    off it.
  - One procedure per hair class (`lockClass`). Cropped is the shell alone, raised to the hair's length. Standing coils
    (an afro, a crop of curls) are a sculpted volume: the shell raised to where the coils stand, in puffs. Curly hair that
    falls (`curls`) is flows, as long hair is: as a volume it flared off one side of the head as a brim. Short and long
    hair are flows and trailers. Standing hair is anime sections: a lying layer of flows with laid-down spikes over it,
    less spiky than anime. Tied
    hair is flat flows pulled to the tie, with the tail (a ponytail, a braid, a bun) a separate mass: a core wrapped by
    locks. Locs and rows are ropes, each round with a twist groove, drawn in enough stations for its twist (`LOCK_ROPE`;
    fewer drew a braid as a flat zigzag).
  - Every stroke lies off the head's skin and ears and over the shell. A long flow also falls outside the hero's neck,
    shoulders and back (the compiled parts, `HAIR_HANG`). Its points below the head ride the neck and the torso
    (`boneWeights`), so the skinned GLB swings it with the body.
  - ONE colour, `Hair`: the hair as the eye averages it, so grey is a lighter whole, never flecks. `HairStreak` appears
    only where the groom asks for a streak. The cards draw the strand page undyed (`strands: 'plain'`), in the mass's
    colour.
  - THE FACE'S HAIR in the same register (`lockStrands`; `stylize` the face's, as the scalp's), each in one colour,
    with no root band:
    - A BEARD is its coat sculpted to where its hairs stand (`beardShell`, the coil's procedure), lumped finer at 0 and
      chunkier at 1. A short beard is that coat alone. Only hair whose tip leaves the skin, a full beard's chin, hangs
      as flows, rooted inside the coat so they come out at its edge. The coat is smoothed whole and then split at the
      lip line, so the jaw's half and the head's meet (smoothing each half pulled the seam open).
    - A MOUSTACHE's halves and each BROW are a band (`browMass`): one flat mass along it, its head rounded and its tail
      drawn in, with the dial's few strokes laid on it and held inside it: never a brow of two-tone blades, never a
      beard of small locks reading as scales.
    - A card face pushed off the skin onto itself is dropped (a fade card at the forehead had no area), and a tip card
      is never narrower than `LOCK_TIP.half`.
  - CLIPPED HAIR (`dermal-map.js` `CLIPPER`): hair a clipper takes under 4 mm (clipper 0, ½ and 1, a skin fade's
    foot, a stubble beard) is no shell and no coat but a SHADOW on the skin. The hair's colour is painted over it by
    the share its length covers (`clipCover`: about a third at clipper 0, about four fifths at clipper 1), mottled as
    follicles are, reaching the shell's own colour over its last 1.5 mm so the two meet with no ledge. The scalp's
    shell stops at the clipper's length, its edge smoothed, so a fade runs from the shell down through its shadow to
    the skin; a stubble shades the face and the throat alike, the neck's page as the head's. The length is the cut's
    own rule, smooth over the head (`dermal-hair.js` `growScalp` `clipOf`: the clipper's taper with no guide's own
    variation, the hairline averaged round the head), never the nearest guides' (their patches scalloped the fade's line
    and smeared its shadow); the recipe's `hairClip` carries it as a grid over the head for the skin's paint
    (`dermal-texture.js` `paintDermis` `clip`). The fade's cards fringe the hairline alone, never the fade's line. Never
    a solid helmet down to a fade's foot, never a stubble's blotchy coat.
  - THE SIDEBURN connects a fade to a beard, as a barber leaves it (`dermal-map.js` `sideburnOf`): where the face grows
    a beard, a band in front of the ear, from the beard's top on up until the scalp's own length is the longer, wears
    the beard's cheek length, both in the scalp's clipped length and in the paint (the dermis's own sideburn is a sliver
    over vellus skin, so a skin fade left bare skin between the hair and the beard). Its clipped length stays under the
    shell's, so a longer beard's sideburn is paint at full, never a strip of shell fringed with cards. The beard's paint
    over it adds only what the band left, so their overlap is never darker. A shaven face's fade takes the sideburn as
    it takes the rest.
  - THE BEARD FADE: with a beard, the side over the ear (from the sideburn back 60 mm behind the ear canal, above the
    ear's top) holds the same length, so the fade runs down to the beard's length there, never to a bald patch beside
    the sideburn; behind it the nape fades to the skin as the cut has it. Where the scalp's own paint is the fainter (the
    hairline's soft edge, a cell the clip has no length for), the band's shade is the one painted.
- **The ear raised** (realistic laws 10, `head-relational.js` `EAR_RAISE`): the ear sat low, its top 6 to 8 mm under the
  brow line and a man's lobule 4 mm under the nose's base. A laws 10 hero's ear is raised to the canon, its top at the
  brow line and its lobule at the nose's base (the face's own ear relations raised by the pole's amount). The ear's
  rim takes none of the hair's paint: the hero's skin chart knows the ear by its own parts, not by the box about it
  (`dermal-head.js` `headChartOf` `earAt`), and the hairline over the ear clears the ear's top by 12 mm
  (`dermal-map.js`; the head's marks carry the ear's top). A hero minted under earlier laws keeps its ear.
- A hero minted before keeps its blades byte for byte: the locks are its laws'.
