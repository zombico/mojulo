---
{
  "id": "low-ride",
  "name": "Low ride",
  "entry": "create_beats",
  "summary": "A ready-to-mint pattern groove: a lo-fi head-nod loop in F minor — swung boom-bap kick, layered-burst snare on 2 and 4, ghosted hats, a one-octave bassline, rhodes stabs answering on a dotted-eighth delay.",
  "when": "a lo-fi hip-hop beat; chillhop / boom-bap head-nod groove; study-beats with drums; a laid-back menu or workshop loop with a pocket; make me a mellow beat"
}
---

A worked example over the pattern kind: 84 bpm, `swing: 0.28`, two bars of
F minor. The kick is a `thump` gesture (G2 → G0) laying a boom-bap figure
that varies between bars; the snare is a three-layer cue — two highpassed
bursts a hair apart plus a tiny pitched thump for body. Hats ride eighths
with ghost sixteenths; the bass walks F–Ab–C–Eb in one octave; rhodes stabs
Fm7 / Ebmaj7 on the offbeats and lets a `"3/16"` delay swing the answers.

This is a Door-1 recipe: pure params, nothing to load — and a pattern is
deterministic by construction, no seed at all. Mint it as-is, or use it as a
starting point — swap `rhodes` for `clav` for a funkier ride, thin the hat
mask for more air, or halve the snare's third-layer `vol` if it reads too
acoustic.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-pattern'` with the params
above. The manifest is the grid; masks shorter than 32 wrap per bar.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-pattern'`).
