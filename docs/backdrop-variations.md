# Making a backdrop variation

[side-scroll-backgrounds.md](side-scroll-backgrounds.md) says what makes a side-scroller's background good to look at.
This page says what made the three backdrops built on it, Giuseppe's strip, Galaxy Boy's plant and Vampire Sonata's
castle, into starters: things a new variation is made from by changing words, not code. Read it before adding a
scenery, a place, a vista or a locale, or before re-keying one.

## What a starter is

A backdrop starter is a table of places, a vocabulary of pieces, and a deal that matches the two.

- **A place is a row.** It is a few words: what stands where, its colour, its light, what moves. The drawing reads the
  row and never knows its name. A scenery (`era/geocube-side.js` `SCENERIES`), a setting's place (`side-map/dress.js`
  `SETTINGS`), a vista (`side-map/vista.js` `VISTAS`) and a locale (`metroidvania/themes.js` `locales`) are all rows.
- **A piece is a word.** A dome, a canopy, a tower under a dome, a stained lancet, a gear, a throne: each piece is drawn
  once, at its true size, in the family's shapes, and named by any row that wants it (`kind`, `bays`, `focal`, `set`).
- **The deal matches places to the level by role, never by index.** A save room is a chapel because it is a save room.
  A zone's place is dealt from its run (across, up, down, room). A scenery is laid on a segment of the strip. So a
  variation of the level (more rooms, another order, a longer strip) is dressed without being rewritten.

Making a variation is then one of three moves, from cheapest to dearest:

1. **Re-key a row:** its tone, its lamp, its wall, its colours. No new drawing.
2. **Recompose a row:** another set of pieces from the vocabulary in its slots. No new drawing.
3. **Add a piece:** a new word in the vocabulary, drawn once, held to the laws. Every row may then use it.

## The slots every backdrop has

Each starter fills the same slots. A variation changes what fills them, never the slots themselves.

| Slot | What it is for | Giuseppe | Galaxy Boy | Vampire Sonata |
|---|---|---|---|---|
| the sky | the lightest value, breathing room, the light's source | the gen-7 sky, clouds on a shaded underside | the cube's night, a dusk in bands | the night graded by height, stars, the moon and its halo |
| the far | depth, said in silhouette | the range of domes | the far layer of arcologies or stacks | mountains, the castle's towers, a forest ridge |
| the middle | what kind of place this is | hills, a lake, the sea, a canopy | the middle layers of a vista | cloud banks |
| the set piece | one giant thing a stretch is remembered by | (none yet) | the reactor | the focal piece a room |
| the near land or the wall | where a thing is made interesting, seen largest | the terrace's groves (A and B slices) | the back wall in bays | the back wall's bays by the wall's rhythm |
| the near layer | depth in front of the wall, half a silhouette | the low foreground | (the frame of the opened back) | columns, chains |
| the transition | the change of place passed as a thing, not a seam | a headland on each row | the next place's peek at a zone's edge | the door between rooms |
| the motion | the place alive | clouds drift, blossom and canopy sway, water glints, a boat drifts | beacons blink, steam drifts, a train runs, the reactor turns | flames burn, stars twinkle, cloud drifts, gears and clock hands turn |

## The principles that made them variable

### Composition

1. **Depth is a number, and distance is drawn by it.** Every piece stands at its depth (`x`) and is taken into the air
   by a rule of that depth (`aired`, `haze(x)`), never painted pale by hand. Moving a piece to another row re-colours
   it for its distance with no new colour to choose.
2. **Rows stand in a stair.** Each nearer row's crests stand under the farther row's in the frame, so a variation
   checks only that its rows' heights keep the stair. Choose row heights as angles from the game's own camera: the
   sky keeps a quarter to a third of the frame.
3. **Slices in a rhythm, one focal, quiet beside it.** A wall or a terrace is laid in A and B slices by the walls' rule
   (`era/wall-rhythm.js`): A carries the interest, B lets it be seen. Each room or stretch has one focal piece or set
   piece. A variation fills A, B and the focal; the rhythm and the quiet come with them.
4. **One family of shapes a place.** Domes and discs for the orchard, blocks and domes for the future city, pointed
   arches and wheels for the castle. A new piece is drawn in its family, so it belongs on any row of it.
5. **She is the measure.** A piece a hand holds or a body uses keeps its true size; only architecture is as big as
   the place (`backdrop.js` `SCALE`). A giant thing is made giant by its place and its frame (the reactor runs past the
   window), never by blowing up a small thing.
6. **Transitions are things.** Where a place changes, put an object across the seam: a headland, a cape, a door, a
   peek of the next place. It costs one piece and hides every cut edge behind it.
7. **Calm where the hero plays.** The band the hero moves in holds less detail than the band above it, and nothing
   that dresses the land stands in front of the lane. Put the busy pieces high.

### Colour keying

8. **The cube keys the light, the place keys the hue.** The cube (the geocube) gives the sky, the sun or the moon, the
   air and the lit colours. The place gives one hue, a saturation and a lightness: its tone. Re-key a place by its tone
   and every slice, cap and edge of it follows. A level whose subject is far from its game's cube may name its own cube
   (Galaxy Boy's plant draws its level in a city by night, `SIDE_MAP_CUBE`, while the game keeps its orchard).
9. **Swing hue within a band, set apart from what plays.** A place's hue swings only within a band round the setting's
   place hue (`PLACE_SWING`): far enough from the play's colour (the floors, the hatches) and from the colours that are
   reserved (the boss's, a gate's). Inside the band, vary lightness and saturation as freely as hue. That is where
   most of the variety comes from.
10. **Value carries depth, hue carries place.** Within a place, the far is near the sky's value and the near is the
    darkest or the most saturated land, and the floor reads first. Two places may share a hue if their values differ,
    and never the reverse.
11. **Distance goes toward the sky's own colour.** Air is mixed toward the sky's middle colour, never toward white or
    grey, so a far row keeps its chroma and a near one its warmth. Warm comes forward, cool goes back.
12. **The lit things are the accent channel.** Windows, neon, stained glass, flames, glowing domes, a reactor's core,
    a dusk band: these are exempt from the light pass and from the place's hue. They carry the opposite temperature (a
    warm window in a cool plant, a cold moonbeam in a warm hall), a few to a screen. Most of a re-keyed place's
    colour is in its accents.
13. **The play's colours are reserved.** No background piece takes the colour of what hurts, what is picked up or
    what opens a gate, and nothing behind the play blinks like a hit.

### Light

14. **Show every source.** A lamp in the backdrop is a seen thing (a sconce, a torch, a window, a beacon, a core), and
    its light is a pool round it. A variation that adds light adds its source.
15. **Light seen in the air.** A moonbeam from a window, a halo round a moon or a flame, a dusk behind a skyline, a
    glint on water. One a place is enough to say the air is there.

### Motion

16. **Motion is a word on a group.** A piece that moves is put in its own group, and the group is given a motion in
    the page's ambient channel: a sway (drift, bob), a twinkle, a blink (a duty), or a spin about a hub. The drawing
    never animates anything itself. A variation adds motion by naming a group.
17. **Phased by where it stands.** One group's members move one after another by their position (`spread`), so a row
    of crowns sways in a wave and never in step. A wheel or a gear is a group of its own, about its own hub.
18. **Slow, small, the far slowest.** Sky things take a minute or more, near things a few seconds, and nothing moves at
    a foe's speed.

### Making them hold

19. **Additions roll their own dice.** New pieces in an existing row take a seeded stream of their own
    (`side-map-vista-life`, `beam:<pc>`, `cloud:<s>:<z>`), so adding a piece never moves the pieces already there, and
    the same recipe still makes the same bytes.
20. **The laws are the variation's guard rails.** Every starter keeps its laws:
    - the strip's `sideLaws` (one family, behind, quiet, rhythm);
    - the side map's (play against place, the boss's colour, solid over void, lit tops);
    - the castle's `backdropLaws` (eye detail, calm play, focal, three depths, pools, lane reads, scale).

    A variation is free inside them. When one fails, fix the piece, not the law: the library's stacks were bound in
    calm sets, and the throne's dais was lowered with its crest raised.
21. **Look from the game's own camera.** Judge a variation through the camera the game plays with (`SHAPED_CAMERA`,
    the side map's, `boxCameraOf`), not an overview. Shoot it with `scripts/spikes/backdrops/shots.mjs`, read the
    contact sheet, and leave the eyes gate to the person.

## Pitfalls the page taught

- **A face that laps another on its plane is lifted a step toward the eye.** A stack of lapped faces climbs: the
  castle's lapped sky bands stood in front of its towers and stars. Lay coplanar pieces edge to edge, or give each a
  step of its own depth.
- **Faces are drawn as fans, so keep each one convex.** A star, a gear or a crown is made of convex parts (a disc and
  its teeth, a bank and its puffs), never one concave outline.
- **Too small to see is not there.** Size a piece in pixels at its depth: a star needed about 3 px of radius before it
  read.
- **A light source in the frame changes the frame.** The gen-7 sky draws the sun's glare from its direction, so a sun
  put in view whitens the sky; keep the solved sun where the cube puts it and show light some other way.
- **The camera decides what is seen.** The reactor first sat above its window; the castle's stars sat behind its far
  land. Place a set piece by the opening it is seen through, and spread the sky's things over the heights the camera
  visits.

## How to add one

**A scenery for a scooped strip** (Giuseppe):
1. Add a row to `SCENERIES` and to `SCENE_ROWS` (which of the scoops' rows it keeps).
2. Draw its own pieces in `sceneryFaces`, for its stretch, in the family's domes and discs, each at its depth.
3. Give anything that moves its own group, with a motion in `SCOOPS.motion`.
4. Name it in a level's `style.scenery`. The headlands come for free.

**A place or a vista for a side map** (Galaxy Boy):
1. Give the place a row in its setting: name, fill family, indoor, vista, tone `[hue swing, saturation, lightness]`.
2. A vista is a row of `VISTAS`: its layers (depth, kind, spacing, width, height, tone, and `windows`, `neon`,
   `skyway`), its sky or far wall, its `traffic`, and optionally a `set`.
3. A new kind of thing is a branch in `vistaOf`, drawn as boxes and convex shapes.
4. Its moving groups go in `VISTA_MOTION`; a set's spins go in the vista's own `motion`.

**A locale or a wall for a box** (Vampire Sonata):
1. Add a row to the theme's `locales` (place, wall, back, trim, bays, focal, near, ceiling, lamp, dark), and say in
   `localeOf` which rooms take it.
2. A new piece is a branch in `drawPiece`, at its true size, with what stands out of the wall noted (`proud`) for its
   shadow.
3. A turning piece is a `box:turn:<id>` group with its spin. Glass lit from behind is `box:stained`.
4. A new masonry is a row of `WALLS`; what its floors and ledges are built of is its `path` and `ledge` (rows of
   `PATHS` and `LEDGES` in `fabric.js`, docs/metroidvania-map.md "The castle's fabric").
5. Run `backdropLaws` and `fabricLaws`.

**A re-key only:** change a place's tone, a locale's `back`, `trim` and lamp, or a level's cube. Then check the laws
and the contact sheet. No code.
