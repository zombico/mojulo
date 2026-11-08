### The SFX shelf: one library of game sounds, Mobile Suit Arena's effects its floor

- **A core shelf of game sounds** (`lib/graph/sfx-shelf/`, `docs/sfx-shelf.md`): one
  row per sound under the word people say (`beam rifle`, `machine gun`, `mech step`), its category, the audio channel
  slot a level plays it in, its family and what voices it. Game effects only; a menu's sounds are the interface's.
  `sfxSound(word, { style })` gives its cue: the row's own voice, the palette's, its family's (a beam rifle's shot is a
  `shoot`), or the style's fallback. The categories with no row yet are the shelf's gaps (`sfxGaps()`): explosions,
  destruction, the elements.
- **The styles are kept.** The four palettes (arcade, foley, orchestral, synth) are styles of the shelf and are frozen
  behind it: every palette cue id is exactly one row, so no recipe changes by a byte. `realistic` is the shelf's own
  style, several voices sounding as one, and falls back to foley where it has no voice yet.
- **Mobile Suit Arena's effects, rescued.** The game's thirteen cues (the footstep, the landing, the roll, the beam
  rifle's shot, hit, charge-up and charged shot, the bazooka's shot and hit, the machine gun, the fallback blip, the
  beam saber's swing and hit) lived only in its rows; they are the `mecha` set now, verbatim, held to their recorded
  hash. A set is a beats-sfx manifest (`setManifest`), so the beats tools mint, play and render it as it is. The game's
  thruster roar and jump servo are rows naming the channel code that plays them.
- **One yardstick** (`measure.js`): a cue rendered as an export renders it, measured by its layers, its length, its
  attack's brightness, its crest and its energy by band. `baseline.js` holds the mecha set's numbers, the floor a
  better voice is held to (`npm run sfx-baseline`; `--wav <dir>` writes each cue and two per-hit variants to listen
  to). Machine gates only: the ears are the operator's.
- **The SFX mixer** (the kernel feature `sfxmix`, opt-in). Cues used to play dry, mono and centred, straight to the
  master. Now any gesture can be a layer with its own `chain` (filter, drive, compress, crush, delay), `pan` and `send`.
  A world's `audio.sfx.mix: { space?, send?, voices?, distance? }` puts its cues on an SFX bus in one shared space
  (`open`, `interior`, `hangar`, `cavern`, or `vacuum`: the bus dulled, no tail). A `duck` gesture dips the score under a
  big hit (both scores of an adaptive pair). `voices` caps the cues sounding at once: a quieter new cue is dropped, a
  louder one steals the quietest. `distance` (on unless false) places a combat cue by its source's distance from the
  pilot: duller and roomier, not only quieter. A beats-sfx row takes `mix` too, and its WAV takes `?far=`. A recipe
  that uses none of it emits the same kernel and the same page, byte for byte.
- Nothing in a level reads the shelf yet: the re-voiced set and the wiring come next.
