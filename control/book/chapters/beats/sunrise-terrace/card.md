---
{
  "id": "sunrise-terrace",
  "name": "Sunrise terrace",
  "entry": "create_beats",
  "summary": "A ready-to-mint ambient loop: a bright F-major morning — chorused rhodes chords, a nylon-guitar melody wandering the major pentatonic, brushed hats with dropout. The daylight / café preset.",
  "when": "warm upbeat background music; a morning, café, terrace, garden, or seaside scene; cheerful bossa-adjacent chill; a friendly menu or lobby loop; music for a bright open world"
}
---

A worked example over the ambient kind: F major at 88 bpm with a light swing.
Rhodes carries the harmony through a chorus into a short room reverb; a
nylon-string guitar walks the F-major pentatonic at `gate: 0.55` with a
quarter-note delay; hats sketch a gentle offbeat with `dropout: 0.25` so no
two bars shuffle alike. The IV–V motion (Bb → C(add9)) keeps it hopeful
without ever resolving hard.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — swap the guitar for `music-box` for a toy-town
feel, add a soft kick channel for a groovier café, or slow to 80 bpm and it
becomes a lazy Sunday.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-ambient'` with the params
above. Same seed, same performance, forever.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-ambient'`).
