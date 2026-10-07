---
{
  "id": "earthlight-beacon",
  "name": "Earthlight beacon",
  "family": "world",
  "entry": "compose_world",
  "summary": "A ready-to-mint planetary world WITH ITS OWN SOUNDTRACK: the live mojulo Earth — real coastlines, graticule mandala, true Sun and Moon for the current instant — carrying an inline A-minor electronic beacon loop in its audio channel.",
  "when": "Earth from orbit with music; a space scene with an ambient soundtrack; the live mojulo earth; a planetary world that plays its own score; a cross-family recipe joining a world and a beats loop"
}
---

A worked example over the planetary base — and the book's first CROSS-FAMILY
recipe: the world carries its soundtrack inline. The globe is the opinionated
live mojulo Earth (Sun, terminator, and Moon at their true positions for the
current instant, re-resolved each load); the `audio.soundtrack` channel holds
a complete `beats-ambient` recipe — the orbital-beacon loop: wide chorused
pads, a chip-lead signal ping-ponging across the stereo field, a slow
heartbeat kick. Open the world and it hums; mute it and the capture is
byte-identical.

This is a Door-1 recipe: pure params, nothing to load — and nothing to bind:
the soundtrack travels INSIDE the world recipe, so the entry is
self-contained on any host. Mint it as-is, or use it as a starting point —
swap the inline loop for your own kept beats recipe, or replace
`soundtrack` with `{ beatsRef: '<your stored loop>' }` to bind a loop that
lives in your instance instead.

## Recipe

See `recipe.json` beside this card — `base: 'planetary'` with the seed and
inline audio above.

Pass the `base` and `overrides` to the world composer. The full parameter
manuals are the `planetary` card and, for the audio channel, the
`beats-ambient` card.
