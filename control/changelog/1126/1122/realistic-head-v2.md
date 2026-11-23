### The realistic head: a mainstream face

The realistic hero's head had a sound skull and a face that read as a mannequin. This work reshapes the face toward
the proportions and the clean structure of a current game character, on the head's existing masses, and draws its hair
as a game draws it, held to a game's budget.

- The sex poles: a woman's mouth wider and her lips less full; ears that lie flatter to the head; a man's lips and
  mouth less full. Her face reads apart from his from the 3/4: her bones show through softer tissue (the jaw's border
  and the cheekbone gentler), her lower face shorter, her chin finer, her nose smaller and shorter (its root lower, between the eyes) and her
  cheeks fuller high up.
- The forehead turns to the temple at the temporal line instead of rolling round as one ball, and the brow is fullest
  over the eye's inner half, finer toward its outer corner.
- The nose's wings join the cheek without the dark pit at their outer corners: the alar crease a fine line scaled with
  the nose, the cheek's pad running under the wing's base.
- The mouth: the lips lie on the curve of the teeth instead of standing on a mound, their corners tuck into the cheek,
  and the profile's lips sit behind the line from the nose's tip to the chin. The lower lip rolls into a shallow fold
  over the chin instead of standing as a shelf over a hollow.
- The upper lip follows the curve of the teeth instead of a wedge, and the cheek beside it comes forward to meet it in
  a soft fold, so the hard line from the nose's wing to the mouth's corner is gone. The corners tuck into the cheek
  without the hook they had, and the pit at the foot of each wing is gone.
- The jaw has a border: a line from the chin to the jaw's angle, the face turning under it to the jaw's underside
  instead of melting into a fullness under the chin.
- A cheekbone: the cheek's front plane carries out to the cheekbone and turns there to the side, a high plane under the
  eye with a soft shadow beneath it, the full cheek kept below.
- The eyes open wider and read awake: the lids' edges at a lid's own thickness, the opening 7.7 mm tall on him and 8.4
  on her where it was 6.0 and 7.4. A relaxed adult's 9 to 11 waits on the blink: a lid opened that far stretches its
  skin past what the shut lid can spread.
- The eye's corners read clean, without the dark pocket beside each: the lids' spaces close into the canthi in a ramp
  instead of a slot under a ceiling facing down, the skin round the globe's flank reaches out to the corners (the
  fissure is wider than the globe), and the brow's outer end sits on the brow's corner instead of a bone's thickness in
  front of it, so the skin beside her outer corner no longer stands well forward of it.
- The brows are painted into the skin, each hair of the brow's groom a stroke, where the hero wore a solid band that
  read as a plank stuck on the face: the skin shows between the hairs, the band thins at its head and tail, and it moves
  with the brow. A woman's brow arches higher and is a little finer, a man's lies flatter; on her the heavy and the level
  brow are rarer, the arched likelier.
- The lashes are a ribbon of alpha cards along each lid, drawn with a lash texture of their own (thick at the root,
  tapering, gathered in clumps toward the tips) and darker than the hair, over a lash line painted along each margin:
  about 200 faces where a blade a lash was about 1,100, and dark lashes where the blades' lit edges read pale.
- A beard reads as hair: its skin is painted with streaks along the beard's growth, and its coat, the shell over the
  skin, shows that paint instead of one flat colour, so a short beard is a textured shell with no shards and its edge
  fades into the cheek; only hair longer than 16 mm still grows a lock. A moustache the same.
- The hair's locks, the scalp's and a long beard's, are drawn with a hair texture along them (fine strands of their
  own light and shade, darker at the root) where each was one flat colour.
- A crop reads as short hair and no longer as a helmet: the scalp's skin is painted with streaks along its growth and
  the crop's shell shows that paint, its hairline soft and its sides fading into the skin, each of its faces read off one
  face of the skin so the head's seam shows no line. Under a cut's locks the shell keeps the hair's colour.
- The hairline has no gap and stops at its edge: a few millimetres of fine short hairs painted along it, the clipped
  hair under a taper or a fade painted as hair (never a pale band of skin under the locks), a crop's shell lying down
  onto the forehead over 16 mm instead of standing as a lip and a lock's root nearly on the skin; the scalp under a crop
  is the hair's own colour, with no dark line where the fade met it, and the fade's small cards are gone. The locks'
  texture is fine strands without the waves that read as wood grain.
- Game speed held by a budget: the default woman and man are minted and exported as an engine takes them and held under
  their triangles, vertices and atlas, the body drawn opaque (an E2E test). The textured shells share their corners again
  (the man's vertices back from 43,445 to 36,765), the alpha cards (the lashes, the strand cards) are a primitive and a
  masked material of their own over the body's vertices so the body draws opaque, and the strand, lash and lock strips
  sit beside the head's page instead of under it (the atlas 2048 x 3104, where it was 3616 for her).

- Long hair hangs: no flat wedges standing out of it at the jaw's height and across the back. A lock's tip is carried on
  to the cut's line only where it lies on the scalp (a lock hanging free was carried onto the skin under its tip and held
  its width to it, a flat blunt wedge), and below the head's middle a lock falls, never turning out or running off level.
- The fold under the lower lip is shallower (about 4 mm on her where it was 5, under 3 on him where it was 3.6 to 4.4),
  the pad between the lip and the chin brought forward and up, and the skin's baked shadow softer on the painted face
  (its darkest 0.72 of the colour, where it was half), so a crease reads as a soft shadow, never a black slot.
- The East and North Asian eye wider and less tall (`EAST_ASIAN_EYE` in `face-compose.js`): the eye ~1.5 mm longer and
  its opening ~1.5 mm lower, the height taken off the lower lid, which now rises to the iris's edge while the upper stays
  where it was (lowered from above, the white showed under the iris); never slanted; the inner corners a little closer so
  the longer eye stays on the face, and the large, round eye shape rolled rarely. A mixed face carries the eye's width
  and split from both parents.
- The East and North Asian eye reworked after reference faces: the tilt turned about the pupil (`tiltPivot`), so a
  lifted outer corner no longer lifts the opening off the iris; the globe set toward the inner corner (`globeShift`),
  the white running out to the temple; the flesh TENTED from the low nasal root over the inner corner (`tent`,
  `MEDIAL_TENT`), so the fold is that skin and never a roll hooking down to the nose; and the outer corner's lids
  meeting at a point just past the globe (`outerClose`), as the inner's do, where a pale wall stood at the opening's
  end. Each a head relation absent from every other face.
- The East Asian eye set against the nose and brow as a low root measures: the nasion ~6 mm ahead of the cornea where
  the pole's is ~11, the brow ~1.5 mm back, so no pocket stands between the bridge and the inner corner from the side;
  the tent's volume held from the eye's lid space (its cut had taken the tent's corner away again), and the lids, their
  rims and their lashes ending where the tent takes the inner corner over (`innerClose`), never flapping out over it.
- At a closed canthus (`innerClose`, `outerClose`) the corner fill ends just past where the lids meet and its front is
  set back to the face (`COVER_CLOSED`): stretched on to the canthus's depth it stood ~2.6 mm proud of the face beside
  the outer corner, a bean at the eye's side wall where the East Asian face, with less of the orbit's frame showing,
  runs flat from the lids into the temple.

Still to come: the upper lid's fold; a long beard's locks still hang as broad flat shards; a crop's shell a ledge at the
nape.
