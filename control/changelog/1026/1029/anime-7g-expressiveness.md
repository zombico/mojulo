### The 7G anime head: the hero's acting, read as drawings

The anime hero acts with the realistic hero's acting (its beats, emotions, gaze, lines and recordings), read as anime
draws it: a library of drawings per layer (eyes, lids, brows, gaze, mouth), each a real form on the head that reads
from any angle, and a timing grammar (keys, holds on twos and threes, snaps, in-betweens). The default anime hero's
head first, in one style. It is a higher setting of the anime head, at home from T3 (a late PS3 / PS4 hero): asked
for, it is built at any tier; unset, a take at T3 or higher gets it and below T3 is lowered to the four channels. A
hero with no take and no setting is today's head, byte for byte. The eyes gate is the operator's.

- **The drawings** (`polygonizer/anime-drawings.js`): the vocabulary, by layer: the brows (raised, low, angry, worried),
  the lids' shapes at the open eye (angry, sad, wide; the closures stay the head's knots), the gaze's positions (left,
  right, up, down; pupils shrunk in shock) and the mouth (the vowels A I U E O, the shout, the frown, the cat's ω, the
  wavy line, the small mouth, the smirk), each with the words a 2D brief draws it by and the four-channel face it lowers
  to. A face is one drawing per layer: the brows, the lids and the mouth share no vertex and add exactly; the gaze is
  drawn at its positions, since the lids clip the lenses.
- **The studio's new words** (`anime-form.js` `drawing`, through `animeHead`): the brow block raised, its inner end
  raised or knit down toward the nose; the upper lid lowered at either end or raised whole, its aperture, white, lens
  clip and lid band following one outline; the lenses slid and the pupil scaled; the mouth's outline opened per lip,
  widened, its corners lifted or dropped, squared, drawn as ω or as a wave. Each keeps the head's topology and turns no
  face over, within ranges measured on the default head. A head with no drawing is the studio's, byte for byte.
- **The eye's socket** (sculpt `orbit`, a depth of the head's height): the socket cut as planes, so the face breaks into
  blocks in profile and at three-quarter: the brow's plane runs back to an apex just over the eye and the cheekbone's
  comes forward from it (a "<"), and the nose's side walls angle in down along the bridge, setting the brow and nose apart
  from the cheekbones. The planes meet in soft fillets, and an eye in a socket is built with more rings about it, so no
  streak or raised rim shows around it. The eye, its lids, its lenses and its brow sit in the socket and act as before. A
  head without it keeps its bytes.
- **The pyramid nose** (sculpt `noseShape: 'pyramid'`; `round`, the graphic base's, unchanged): a ridge between two flat
  side planes, its root at the eye's line where the lids meet and set back a little there, the bridge rising straight to
  a tip no further out than the round nose's, its underside cut back to the lip: in profile the centre line's "<" (the
  brow, back to the root, out to the tip) keeps step with the socket's, so the nose reads by its bridge, not by sticking
  out. The tip and dorsum words still size it.
- **The jaw curved in** (sculpt `jawHollow`, a depth of the head's height; none at 0): below the cheekbone the lower face
  narrows toward the jaw's edge and on through its underside, gently at first and more toward the edge, every point by
  its own distance from the middle, so the jaw's side turns down and away from a side light instead of rounding out
  into it, and its edge turns under with no lip. The centre line, the chin's point and the cheekbones keep their place.
- **The lips flat** (sculpt `flatLips`, 0 to 1; none at 0): the rim the studio raised round the mouth, which read as
  lips, laid flat on the face, so the mouth reads drawn, shut or open, in every drawing. The skin round it and the
  mouth's own outline stay where they were.
- **The anime head's form by default** (hero laws 19, `anime-looks.js` `ANIME_FORM`): an anime hero minted now wears the
  socket (`orbit` 0.025), the pyramid nose, the jaw curved in (`jawHollow` 0.02) and the lips flat (`flatLips` 1), under
  every other sculpt layer, so its own words move or undo each (`flatLips: -1` the studio's rim again). Each base wears
  its own beside it (`ANIME_FORM_POLE`): the male's head narrower (`width` 0.95) and his jaw turned under by half as
  much, so less of a plane shows under its edge; the female's chin shorter (`chinHeight` 0.9). The bases' feature bands
  hold under it, each nudged back inside: the male's opening a hair taller, the female's nose tip a hair further out and
  higher, her lip line a hair higher.
- **The anime face smooth in an engine** (`export_model`, the lit, skinned export of an anime hero minted under laws
  19): its corners carry the studio's welded shading normals and no baked shade, so the engine's light shades the face
  as one smooth form, a painted figure's, instead of its triangles; the realistic body's path. A hero minted before
  keeps its export, byte for byte. Each base keeps its feature bands under it (`ANIME_FORM_POLE`): the male's opening a
  hair taller, since the socket reads his lid band a hair heavier, and the female's tip a hair further out, since the
  pyramid sets it nearer the face; so the default hero is advised nothing. A hero minted before keeps its head, byte for
  byte; the child's round face and the studio's own face (`sculpt: false`) do not wear it.
- **The anime hero performs** (the door's `perform` on `head: 'anime'`; `acting: 'full' | 'basic'` on the anime head):
  the same takes the realistic hero plays, each a face-only clip in an export (`face:<take>`), its recorded lines inside
  the GLB and beside an engine pack's scene. Unset, a take on a target of T3 or higher draws the 7G, below it the four
  channels; `full` draws it at any target and `basic` never.
- **The reading** (`face-acting/anime-read.js`): a take read frame by frame as drawings, one per layer (each eye's brow
  and lid, the gaze, the mouth): anger's knit brows and narrowed lids, surprise's raised brows and wide lids, sadness's
  worried brows, happiness's smile, a thought's turned gaze; every layer held on twos but a spoken closure, the mouth in
  kuchipaku (a, i, u, e, o, shut on m, b and p), the gaze stepped. Keyed STEP, so a drawing snaps instead of melting
  through its neighbour; lowered, the same frames weigh the four channels.
- **The 7G rig** (`anime-face-rig.js` `sevenG`): beside the four channels' targets, kept as they were, each drawing is a
  target differenced from the exact head built at it, a brow and a lid per side and the sided mouths per side, with the
  correctives for the pairs that do not add (a lid's shape over a turned gaze, a brow over its shut eye), so a face drawn
  per layer is the exact build of its drawings. Its cost is stamped on the rig (`meta.sevenG`), and a hero whose layout
  moves its vertices skips it with the reason.
- **The pyramid nose points up** (`anime-form.js` PYRAMID): the tip stands out past the face and turns up, its line
  hollowed from the bridge and its underside cut back from a point set above the pronasale to the lip, so the side
  profile reads by it; the face gains a row halfway in each gap through the nose's band, so the tip and its underside
  are drawn by rows, not one edge. The pyramid draws no nose line: its shade plane carries it. A new word raises its
  root toward the brow (`bridgeRoot`), the bridge then rising from between the brows with a shallower dip.
- **The anime face's principles** ([docs/anime-face-principles.md](../../../../docs/anime-face-principles.md)), built
  into the head: the brow never covers the eye (sculpt `browClear`: over the eye the brow is held above the widest lid
  any drawing draws, so a lid's drawing never moves it; the form wears 0.05), the socket follows the brow (its recess
  rises to the brow's middle at rest, and its rim warps with the brow as it acts, raised with it, drawn down at the inner
  end with a knit, never below the lash band; the 7G rig adds a corrective per brow over each lid where the warped rim
  meets the lid's rings), no line where the form carries it, the profile read
  by its blocks, no deformation, drawings snap. The formed head's feature bands are its own (`ANIME_FORM_POLE` bands:
  its nose stands out, its brow held off the eye), a style's over them.
- **The open smile** (`mouth.beam`, a 7G mouth drawing): the top lip held level on the lip line, the bottom dropped
  into a U under it and the corners lifted, so a smile can open without its top line moving; the reading draws an
  open jaw under a smile with it (a laugh), where it drew a plain "a" and lost the smile.
