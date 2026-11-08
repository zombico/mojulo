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
- Nothing in a level reads the shelf yet: the SFX mixer, the re-voiced set and the wiring come next.
