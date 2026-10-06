---
{
  "id": "orbital-beacon",
  "name": "Orbital beacon",
  "entry": "create_beats",
  "summary": "A ready-to-mint ambient loop: a slow A-minor electronic bed — wide chorused pads, a chip-lead signal blinking through a ping-pong delay, a heartbeat kick. The space-station / sci-fi preset.",
  "when": "sci-fi ambient for a space station, spaceship, orbit, or night-city scene; a synthwave-adjacent mood bed; calm electronic music with a pulse; a beacon blinking in the dark"
}
---

A worked example over the ambient kind: A minor at 84 bpm. Pads run wide
through chorus into an eight-second reverb; the `chipLead` melody is the
beacon — pentatonic blips at `gate: 0.45`, slightly darkened (`tone: 0.75`)
and bounced left-right by the ping-pong so each blip answers itself across
the stereo field. The kick lands twice a bar like a slow heartbeat; the E7
bar (G#) pulls the loop home without breaking the drift.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — drop the kick channel for zero-gravity, raise the
beacon's `gate` toward 0.6 for a busier console, or transpose the whole loop
+3 for a less somber deck.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-ambient'` with the params
above. Same seed, same performance, forever.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-ambient'`).
