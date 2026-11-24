# What makes a side-scroller's background nice to look at

A side-scroller is one picture that slides. The player looks at the hero, and everything behind the hero is there to
say where they are, how far the world goes, what time it is and that the place is alive, without ever pulling the eye
off the play. These are the principles a background is made by, said for any side view. Each game's own page says how it
lays them: [side-strip-principles.md](side-strip-principles.md) (a mascot platformer's land, Jumping Giuseppe's),
[side-map-principles.md](side-map-principles.md) (a run and gun's stage and its vistas, Galaxy Boy's and Astro Girl's)
and [metroidvania-map.md](metroidvania-map.md) "The backdrop's craft" (a castle's rooms, Vampire Sonata's).

The principles below cover five things: contrast, colour, composition, light and motion.

## Contrast: the play owns the extremes

1. **The background lives in a narrow band of value.** The hero, the foes, the pickups and the floor take the
   picture's strongest contrasts: its darkest darks, its brightest lights and its sharpest edges. The background is
   kept within a compressed range, so that anything standing out in the frame is something the player plays.
2. **Choose the pole and keep it.** Either the play is dark against a light background (a daylight platformer: the
   floor's lit edge and a dark outline over a pale sky) or light against a dark one (a castle at night, a plant's hall:
   lit tops over shadowed walls). Mixing the two in one screen makes the floor hard to find.
3. **The floor reads first.** The surface the hero stands on is the most legible line on the screen. The land just
   behind it is a step quieter, cooler, lower in contrast or further into the air, so the floor never merges with it
   into one field. (Giuseppe's terrace is taken a step into the air; the castle's `lane-reads` law.)
4. **Nothing in the background wears the play's colours.** The colours of what hurts and of what is picked up are
   used for nothing else. A red light in the sky must not be read as a shot.

## Colour: distance is told by hue

5. **Aerial perspective.** Each layer further back moves toward the sky's own colour, never toward grey or white. It
   loses chroma and contrast as it goes, so distance is told by hue and the land keeps its colour.
6. **Warm advances, cool recedes.** Near land is warmer and more saturated, far land cooler. A far row warmer than a
   near one reads backwards.
7. **A palette is a few masses.** Three or four value masses (sky, far, near, play) read at a glance. Twenty
   unrelated colours are noise.

## Composition: a picture, not a texture

8. **A stair of silhouettes.** The layers' top edges stand at different heights in the frame, each nearer row's crests
   under the farther row's, so every row shows its own edge against the one behind it. Rows that climb to the same
   height stack into a wall.
9. **Leave the sky its share.** Outside, about a quarter to a third of the frame is sky. It is the picture's
   breathing room and its lightest value. Land that fills the frame to the top makes the screen feel shut in.
10. **A scale ladder.** Far things are big and pass slowly; near things are small and pass fast. Speed is read on the
    nearest land.
11. **Rhythm, not repetition.** Things are laid in an order (A and B, never three alike, never a pair repeated:
    `era/wall-rhythm.js`), with unlike sizes and some gaps. A row of one thing at one spacing is a stamp.
12. **A focal piece and quiet around it.** A screen is remembered by one thing: a portrait, a tower, a grove. The
    plain stretch beside it is what lets it be seen.
13. **One family of shapes.** All the silhouettes are the same kind of shape (domes, or blocks, or spires), which is
    what makes them one place.

## Light: the source is in the picture

14. **One key every shape agrees on.** Lit caps, rims, shadows and pools all come from the one direction the light
    comes from.
15. **Show the source.** The light is believed when its source is seen. Outside that is the sun, the moon or a dusk
    glow behind the skyline. Inside it is a sconce, a torch, a clerestory, or a window with the night in it.
16. **Light in pools, dark between.** A dark mood is lit where lamps are and nowhere else, and each pool falls off
    within its reach.
17. **Light through the air.** A shaft from a window, a halo round a moon or a flame, dust in a beam. Light seen in
    the air says there is air, and so depth.
18. **The sky is a gradient.** It is deepest overhead and palest at the horizon. A band of dusk low behind a skyline
    gives silhouettes something to stand dark against. An 8-bit look draws that gradient in steps.

## Motion: alive, slow and never in step

19. **Something moves on most screens.** Clouds drift, stars twinkle, flames lick, steam rises, a beacon blinks,
    blossom stirs. A background that never moves is a painting, and a living one tells the player the world runs on
    without them.
20. **Slow and small.** Background motion is an order of magnitude slower and smaller than play. A cloud travels a few
    metres in a minute; a crown sways a few centimetres. Nothing behind the play moves at the speed of a foe.
21. **Never in step.** Things sharing a motion are phased by where they stand, so a row of crowns sways one after
    another, never as one.
22. **Motion is never mistaken for play.** Nothing in the background moves toward the hero, flashes like a hit or
    takes a pickup's shape. A blink is slow and its colour is the place's.
23. **The far moves least.** As with parallax, the furthest things drift slowest, and the sky only breathes.

## How mojulo lays them

The motion is a page channel of its own, [channels/ambient.js](../control/lib/graph/scene/channels/ambient.js):
a recipe's payload names render groups in `ambient.groups`, and each group sways along x, y and z over a period, its
phase spread by where each vertex stands. It may also twinkle in brightness, or blink with a duty. The baked light does
not move with it, the clock is the page's pinned clock when a capture pins it, and a page without `ambient` carries no
bytes of it.

| | Jumping Giuseppe (the side strip, `scoops`) | Galaxy Boy and Astro Girl (the side map) | Vampire Sonata (the castle) |
|---|---|---|---|
| contrast | the terrace a step into the air behind the lane | silhouettes dark against a dusk glow | the lane's tops lighter than the wall (`lane-reads`) |
| colour | three rows of domes, far ones toward the sky's own colour; lit caps quieter with distance | each layer hazed toward the horizon | a ring a hue; the night graded from horizon to zenith |
| composition | a stair of rows, the sky a quarter to a third of the frame | layers at their depth, beacons on the tops | stars, cloud wisps, far mountains and a forest ridge before the towers' feet |
| light | one key from up the lane; clouds shaded underneath | a lit clerestory in a hall's far wall; a dusk in bands | moonlit glass in every window, a moonbeam to the floor, a haloed moon, flames and their pools |
| motion | clouds drift, blossom stirs | beacons blink, steam drifts off the stacks | flames lick (the flames channel), stars twinkle, cloud drifts, moonbeams breathe, cold lamps pulse |

What is measured stays each game's own laws (`sideLaws`, the side map's benchmark, `backdropLaws`). A background
nice to look at is the eyes gate's judgement: the machine gate says the pieces are there, never that the picture is
good.

## Not yet

- A law that measures a frame's value bands on the page (the play holding the extremes, the background within its
  band), as the side map's benchmark measures roles.
- Weather in the backdrop: rain over the ramparts, lightning that lights the castle's skyline for a beat.
- Things that cross the sky (a bird, a bat, an airship) on loops of their own, which a sway cannot draw.
- Giuseppe's sun in the frame. The gen-7 sky draws the sun's glare from the light's own direction, so a sun put in
  view washes the upper sky. It needs a disc of its own, painted, with its glow kept small.
