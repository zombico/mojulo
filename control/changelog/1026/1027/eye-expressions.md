### The eyes' expressions

The eyes, the brows and the lids as a library of their own, which a face word, a clip key or the door lays over any
mouth; and the realistic hero's eyes animate as the landmark hero's do. The eyes gate is the operator's.

- **Eye looks** (`humanoid-head.js` `EYE_LOOKS`): `rest`, `alert`, `wide`, `surprised`, `afraid`, `worried`, `sad`,
  `tired`, `sleepy`, `warm`, `focused`, `stern`, `glare`, `squint`, `wince`, `shut`. A look sets the eye region's
  channels (`browRaise`, `browTilt`, `aperture`, `blink`) and nothing else: `expression: { word: 'smile', eyes:
  'worried' }`, a clip key's `face: { eyes: 'glare' }`. A channel given wins over the look; an unknown look is refused by
  name.
- **The realistic face's eyes** (`relational-face-rig.js`). Its rig had a blink, a smile and the brows raised or
  lowered: a key's aperture played nothing (a surprised key left the eyes as they were) and a worried brow (inner ends
  up) played as both brows lifted. The head takes three more actions (`head-relational.js` `ACTIONS`: `wide` the upper
  lids off the iris, `squint` the lower lids raised and drawn flat, `browInner` the brows' inner ends lifted, the upper
  lids' peak drawn in), and its rig three more targets from them, as the landmark head names them: `eyeWide`,
  `eyeSquint`, `browWorried`. A hero minted before rebuilds its rig with them on export (the store is `v3`).
- **The blink shuts as one lid** (`hero-relational-head.js` `oneSkinFollow`). On the one skin a blink tore the lid into
  slivers: each point's share of the lid eased out with its distance along the skin, which runs on the net's edges and
  is jagged, and a lid that turns 40° or more made a few hundredths of difference between neighbours a sliver across
  the eye. The fold's underside was turned with the lid too, on its longer radius, through it. The lid's weight and turn
  are now smoothed over the skin's own neighbours (`SKIN_FOLLOW.smooth`, only what the lid holds), and the upper lid
  stops at its margin's reach from the globe as the lower did.
- **The fold stays as the lid shuts.** The skin over the lid was pulled down with it, a waterfall down the shut eye: the
  upper lid reached past its crease along the skin, and every point settled onto the blinked head, whose seat had
  followed the shutting margin down. Only what the muscles' beads carried settles now: a blink moves no bead, so the
  brow and the fold stay still (3.4 mm before, under 0.3 now).
- **The shut lid is one sheet, its stretch tucked under the fold.** The lid turned whole to its crease, so it dropped
  away from the fold and the gap was bridged by long slivers across the closed eye. The upper lid now turns by its
  height from its margin up to its crease (the crease on the lid's shell, `margins.crease` from the eye rig): whole over
  its lower fifth, the tarsus, easing to none by seven tenths (`SKIN_FOLLOW.tuck`), so it stretches over its height and
  the stretch gathers at the top of its cavity, under the fold. Every realistic hero's blink changes on its next export;
  a little crumpling stays at the outer corner.
- **The brows ride whole**: each card of the brows moves by its points' mean, so a surprise lifts the brow, not its
  splinters.
