### Cosmetic damage: a map that may not change still shows its blows

A level's `scars` (`true`, or `{ ground?, wall? }`) keeps every wall, the floor and the footing as they were, and paints
what each blow would have done, by the same laws as destructible physics.

- **A burst near the floor** paints the crater its energy would dig in the ground's soil (less the higher it went off)
  and throws its dirt as clumps, spray and a dust cloud.
- **A wall in a burst's reach** is scorched on the face toward the blast: its share crushes a bowl of its joules over the
  wall's crushing strength, the soot covers the disc the burst's radius cuts on the face, and the bowl spalls off as
  chips. A steel wall dents by its yield strength instead.
- **A round** that stops on a wall chips it by the same law (centimetres out of brick, less out of stone); one that stops
  on the floor leaves a pock.
- The ground and the wall come from the world's geocube unless named, else loam and brick. Outdoors a crater is dug
  in the land's own ground (its commonest off the path: soil, sand, scree, bare rock); a stone floor digs by its
  toughness and throws chunks. Scars go with any degree (crates still smash under `objects`).
- A game's `mechanics.scars` rides onto every level it makes; a stage's words ("cosmetic damage", "scorch marks",
  "bullet holes") ask for it. The systems card names it.
- The page paints each mark once as a decal and flies its debris on sim time, seeded, so a capture stays the same. A
  level without `scars` changes no byte.
- The crater, settling and dirt laws now live in the page's physics, so the ground kernel and the page dig the same
  crater from the same joules.
