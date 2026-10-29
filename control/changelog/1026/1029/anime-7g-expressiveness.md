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
- **The anime head's form by default** (hero laws 19, `anime-looks.js` `ANIME_FORM`): an anime hero minted now wears the
  socket (`orbit` 0.025), the pyramid nose and the jaw curved in (`jawHollow` 0.02), under every other sculpt layer, so
  its own words move or undo each. Each base keeps its feature bands under it (`ANIME_FORM_POLE`): the male's opening a
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
