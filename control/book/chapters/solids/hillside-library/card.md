---
{
  "id": "hillside-library",
  "name": "Hillside library",
  "entry": "mint_solid",
  "family": "structure",
  "summary": "A ready-to-mint edifice: a three-mass public library — a glass-curtain reading room, a taller brick stacks tower to its west, a low concrete entry pavilion to the south — fused into one walkable building by two halls.",
  "when": "a bespoke library or civic building; a small campus of connected buildings; a walkable multi-wing building; an architecture study joining glass, brick, and concrete masses"
}
---

A worked example over the edifice kind: a public library composed as a
graph. The two-storey glass reading room is the root; the four-storey brick
stacks tower sits twenty feet west (closed punched facade — books don't
want sun); a one-storey banded-concrete pavilion faces south as the entry.
Two concourses punch doorways and fuse the three masses into one walkable
building; the spawn point starts in the pavilion, so entering reads as
pavilion → reading room → stacks.

This is a Door-1 recipe: pure params, nothing to load — and edifice checks
are advisory, never gated: read the mint's `advisory` block for the
livability/reachability readout. Mint it as-is, or use it as a starting
point — raise `stacks` to 6 floors for a landmark tower, re-seat the
pavilion `on` the stacks' south side for an L-shaped court, or swap the
reading room's roof to `flat` and the pavilion's facade to glass for a more
formal civic face.

## Recipe

See `recipe.json` beside this card — `kind: 'edifice'` with the spec above.

Pass the `kind` and `spec` to the solid mint. The full parameter manual for
the underlying kind is its own card (`id: 'edifice'`).
