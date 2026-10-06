---
{
  "id": "cavern-drift",
  "name": "Cavern drift",
  "entry": "create_beats",
  "summary": "A ready-to-mint ambient loop: a dark E-minor drone — low-passed pads in an eleven-second reverb, a sub walking the roots, rare sine glints echoing like water, a distant soft pulse. The underground / dungeon preset.",
  "when": "dark ambient for a cave, dungeon, ruin, or deep-sea scene; an ominous underground drone; slow tension music; a mysterious explorable space that needs a hum"
}
---

A worked example over the ambient kind: a drone in E minor at 66 bpm, voiced
for underground spaces. The pad is low-passed twice (`tone: 0.4` at the chain
head, then a 1.2 kHz filter) and sunk into an 11-second reverb, so the chords
read as walls, not keys. `sinePluck` glints at `gate: 0.3` fall like water
drops into a long ping-pong; a single soft kick every other bar is felt more
than heard.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as a starting point — zero out the `pulse` steps for pure drone, raise
`tone` on the pad toward 0.6 as the player nears the surface (a world can
drive that macro live from sim state via its audio bindings), or transpose
the whole thing down two semitones for dread.

## Recipe

See `recipe.json` beside this card — `kind: 'beats-ambient'` with the params
above. Same seed, same performance, forever.

Pass the `kind` and `params` to the beats mint. The full parameter manual for
the underlying kind is its own card (`id: 'beats-ambient'`).
