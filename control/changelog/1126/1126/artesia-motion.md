### Artesia's heroine: a stance that breathes, cuts that flow, strings that fork

- **A body standing breathes** (the page's controllable channel): a standing body's idle, and a moveset hero's fighting
  stance, play on their own clock (the clip's seconds, three where it carries none). They had been sampled at the gait's
  phase, which stands still on a body that stands, so a hero's breath froze wherever her last step left it. A moving body,
  a held idle and a clip of two keys or fewer play as they did.
- **The fighting stance breathes** (`polygonizer/hero-swing-body.js` readyClip, `READY_BREATH`): the stance, a breath drawn
  in (the chest up, the knees a little straighter), the stance, the weight let down into the knees, every key on the
  stance's feet. It had been one key held.
- **A move's cloth answers the turn without tearing** (`polygonizer/hero-cloth.js` `CLOTH_SWING`): a moveset's swing turns
  the whole body through a blow in under half a second, and the cape's strings lagged so far behind it that their corners
  tore into shards. A move's cloth now sways off the drape it settles to at a fifth of what the solver gives.
- **The inspired art's off arm has give** (`SWING_STYLES.inspired.offElbow`): the counterbalance is still flung back
  through the blow, but its elbow is never locked into a rod.
- **Artesia's strings fork and flow** (`gameworld/combos.js` `ARTESIA_ARSENAL`):
  - **The blend:** each cut blends into the next over 9 frames (a sixth of a second), not 5.
  - **The forks:** the cuts' tree forks into four strings. L L L ends on the cleave, L L H on a lunging thrust driven
    through, L H on a rising upcut that throws the foe down, and L . L L (a breath after the first cut) turns into a
    rising cut from the other side and then the cleave.
