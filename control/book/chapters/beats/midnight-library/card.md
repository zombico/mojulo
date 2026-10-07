---
{
  "id": "midnight-library",
  "name": "Midnight library",
  "entry": "create_beats",
  "summary": "A ready-to-mint ambient loop: a warm D-minor piano nocturne — soft rolled chords over a dim pad, sparse bell phrases far back in the reverb, no drums. The quiet-interior preset.",
  "when": "quiet background music for reading or studying; a calm late-night piano mood; a library, study, bookshop, or rainy-window scene; gentle music with no drums"
}
---

A worked example over the ambient kind: a nocturne in D minor at 72 bpm.
Piano carries the harmony as softly rolled chords; a low-passed pad doubles it
an octave of air below; the bass walks the roots; an `fmBell` melody at
`gate: 0.35` drops one phrase every few bars into a long ping-pong tail. No
pulse channels at all — stillness is the point.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — drop `tone` on the pad toward 0.4 for a duskier
room, raise the bell `gate` toward 0.5 if the silence feels too empty, or
swap the piano for `rhodes` for a jazzier hour.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-ambient'` with the params
above. Same seed, same performance, forever.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-ambient'`).
