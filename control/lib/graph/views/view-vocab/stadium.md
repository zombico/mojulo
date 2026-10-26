---
{
  "id": "stadium",
  "name": "Stadium (a sport's venue: the Mojulo Olympics)",
  "family": "world",
  "entry": "compose_world",
  "summary": "A sport's VENUE from a few words, so a game is played inside a place and never against a flat dark colour: the field, a round BOWL of stands round it (a superellipse ring from an ellipse to a rounded box, raked tiers, a concourse of glass boxes, an upper tier), its outer wall in a facade (glass, brick, metal, or an amphitheatre's storeys of arches), a roof (a canopy, a canopy hung from a ring of masts, glowing dome ribs), screens, a landmark (the cauldron, an arch over the far stand), floodlights, a skyline of grown towers past the rim and a sky at an hour. A preset is the Mojulo Olympics' venue for a kind of game; any word over it moves that part alone. A game's arena stands in one by its `venue` word.",
  "when": "Reach for this on framing like 'a stadium', 'an arena for my tennis / football / hockey game', 'a centre court', 'an Olympic stadium with a running track', 'a colosseum / amphitheatre', 'a domed arena', 'a football ground with an arch', 'put the match in a stadium, not the town square', 'a venue for my sports game', 'a hologram duel in a patron's dome', 'stands round the field', 'a crowd in the stands', 'floodlights at night'."
}
---

A stadium is a world of its own (this base) or the place a game's arena stands (its `venue`). Everything is polygons and regenerated from the words: the crowd is a mosaic of colours on the treads, never figures, so a full house costs nothing past the steps it sits on.

## Parameters

```
{ preset?, field?: { w, d, surface? }, palette?, look?, time?, ground?, livery?, colours?, bowl?, masts?, skyline?, camera?, seed? }
  preset    the venue the words start from (below; olympic when absent)
  field     the playing area in metres (4 to 400 each way), centred on x = 0 from y = 0; the preset's own when absent
  surface   grass | clay | hard | track | ice | wood | sand | holo   (the infield, out to the ring through the field's corners)
  bowl      false (the field alone), or over the preset's:
            shape    2 (an ellipse) … 8 (nearly a box): the ring's superellipse
            rows     [lower] or [lower, upper], 4 to 30 rows a tier;  rise  0.2 to 0.7 m a row (the rake)
            roof     none | canopy | ring (hung from masts by stays) | dome (ribs to an open eye)
            facade   none | glass | brick | metal | arches
            crowd    0 to 1, the share of seats taken;  gap  1 to 40 m, the field's edge to the pitch wall
            apron    grass | concrete | sand | track (a running track's lanes; a gap of 6 m or more)
            open     the sides left open: [n, e, s, w] (s the camera's), not all four
            screens  0 to 2 video boards on the rim;  landmark  none | cauldron | arch
            clear    metres the camera's side (s) stands back
  livery    the bowl's colour set: olympic | garden | club | stone | night | candy | meadow | town
  colours   { seat?, wall?, roof?, rib?, accent?, concrete?, boards?, glass?, glow?, track?, screen?, apron? } over the livery, each #rrggbb
  look      shaded | anime (banded) | voxel (cubes, fewer segments): the degree of realism
  palette   the land's kit ramps: isekai-meadow | isekai-garden | isekai-sakura | isekai-bamboo | alien-night | airless-plain
  time      day | golden | dusk | night (after dark the masts and the cauldron light the field)
  ground    grass | concrete: the land out past the skyline
  masts     0 to 8 floodlight towers;  skyline  false or { n: 0..24, height: [lo, hi], forms?: [turning, ziggurat, needle, drum, column], seed? }
```

## The Mojulo Olympics (the presets)

- `olympic` — an oval in two tiers round a running track, the roof hung from a ring of masts, the cauldron, screens, noon. Athletics, football, any field.
- `centre-court` — a steep round bowl close on a lawn, green seats, purple trim, a canopy, brick without. Tennis, volleyball.
- `football` — a rounded box in two tiers on the touchline, a canopy all round, an arch sprung over the far stand, golden evening.
- `colosseum` — an open ellipse of stone tiers, its wall storeys of arches, sand on the floor. Duels, combat, chariots.
- `patron-dome` — a round bowl under glowing ribs to an open eye, lit glass boxes, dusk. A hologram duel, a showcase.
- `arcade` — a chunky candy bowl in voxels, open to the sky, screens. `anime` — banded light, a white canopy, blue seats.
- `municipal` — a low covered stand down each long side, the ends open, brick, two masts. A local match.

## A game's venue

The court, the pitch, the meet, the course and the holo arena each take `venue`: a preset's name, or `{ preset?, surface?, …these words }` (no field: the arena's room is the field, its camera stays its own, and the bowl's camera side is set back until the camera stands inside the pitch wall). The quick goals default a meet to `olympic`, a net game to `centre-court` and a team game to `football`; a course and a board game keep their stage, and `venue: false` keeps any stage.

## Recipes

- A night match: `{ preset: 'football', time: 'night', masts: 4 }`
- Tennis in the colosseum on clay: a court's `venue: { preset: 'colosseum', surface: 'clay' }`
- A club's own colours: `{ preset: 'football', colours: { seat: '#1d4fa8', accent: '#f5d000' } }`
- An open-ended bowl with one end for the camera: `{ bowl: { open: ['s'] } }`

For a seating bowl as one landmark among others in another world, the structures channel's `arena` preset stands one anywhere.
