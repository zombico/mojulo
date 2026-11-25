# Cockpit instruments

How a starfighter's instruments are coloured and how its panel is made: the principles the cockpit HUD is held to.
The code is `control/lib/graph/scene/channels/cockpit-look.js` (the colour code, the thresholds, the panel's metal) and
`cockpit-hud.js` (the instruments on mana-ui, the panel drawn over the view); each craft's panel is its card in
`skyscape/cockpits.js`.

## A dark cockpit

What is normal is quiet. Every readout that is as it should be is drawn in the one phosphor, its label dimmer than its
figure. Colour is rare, and that is what makes it work: a colour among few pops out before it is read (pre-attentive
pop-out holds only while few hues are on the screen). A pilot who sees colour knows something wants them; a display
painted in six hues loses that, and every glance becomes a search.

So the systems are not given a hue each. Lasers and engines read in the phosphor like every other normal readout, and
the shields alone have a hue of their own, blue: the shields are the one system with a colour in the world (their
shimmer on a hit), and the blue ties the gauge to what the pilot sees outside.

## One code

The code aviation flies by, with the symbology code's sides:

| Meaning | Colour | Where |
|---|---|---|
| normal | the phosphor green | every readout, scale and the gunsight |
| label | the phosphor, dimmed | what a figure is, never brighter than the figure |
| figure | the phosphor, bright | the numbers a glance is for |
| friend | cyan-blue | a friend on the sensors; the comms (an advisory) |
| hostile | red | a foe on the sensors; a target whose weapons are hot |
| target | magenta | what the computer holds: its brackets, lead pip, range, edge arrow, its mark on the sensors, its name |
| caution | amber | a pool running low |
| warning | red, beating | a pool gone |
| shields | blue | the shields' gauges and arcs; a target with its shields up |

The target is magenta because nothing else in space is: the stars are white, the bolts red and green, the fire orange.
The eye finds it by its hue alone. A hostile is the warning's red, since both mean danger.

Hue says what a thing is. Chroma and motion say how urgent it is: a caution is steady, a warning beats, and the master
lamps on the glare shield light for either, so the eye is called to the panel before it finds the gauge.

## The thresholds

| Pool | Caution | Warning |
|---|---|---|
| lasers | under a quarter | none: an empty gun is a caution, the shot it costs is the pilot's |
| shields | a side under a third | a side down |
| hull | under a half | at a quarter or less |

The page carries each pool's state on the HUD's root as a word (`data-lasers`, `data-shields`, `data-hull`) and its
gauges are coloured by it. The master caution lamp lights for any caution, the master warning lamp for any warning.

## Luminance in three steps

Labels at under half the figures' luminance, then the figures, then the cues over the world (the gunsight, the target)
brightest. The glass under them is near black, so each step holds its contrast: a label clears the glass at better
than 4.5:1, a figure at better than 7:1. Figures use tabular numerals, so a changing number does not shift its
neighbours.

## A panel that is a thing

The panel is painted metal, its colour the craft's card's (`panel.paint`): a light grey for the general craft, darker
for the interceptor, warm for the heavy fighter, near black for the other side's. It darkens toward the pilot's knees.
Over it:

- the glare shield's lip along its top, with its shadow on the panel under it;
- the star's light on that lip and down the panel's top, as strong as the star is above the craft: it sweeps across as
  the craft rolls, and is gone when the star is under it;
- each screen set in a bevelled bezel (lit along its top and left, dark along its bottom and right) held by four
  screws, the sensors in knurled rings, each screen's glass catching a faint sheen across its upper corner;
- each screen's phosphor spilling onto the metal round it;
- a stencilled placard under each screen naming it;
- the master caution and master warning lamps standing on the lip.

The generator's feeds are named by three-letter mnemonics (LAS, SHD, ENG), as a cockpit's switches are, so the
narrowest screen holds them.

## Checking it

`cockpit-look.test.js` holds the code to these principles: each meaning its own hue, the target far from the scene's
colours, the luminance steps and their contrast on the glass, the thresholds, the star's light on the panel, each
cockpit its own paint. The eyes gate is the person's: fly a sortie from each cockpit, take a few hits, and see whether
the panel tells you what is wrong before you look for it.
