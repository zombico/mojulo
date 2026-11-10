### The cast channel: one light for every body, in both eras

- **The light a cube solves agrees with the sky it paints** (the form render's; a painted page reads none of it).
  The sky's share of a cube's light was its look card's alone (its ambient against its ambient and key), written for
  paint that mixes its light in display units: taken to linear light, an overcast look's sky gave a tenth of the light
  the sky it paints would. A jungle-haze scene read in gen-7 drew a near-black sky over land lit almost wholly by a sun
  the look does not have (a frame's mean luminance 47 against its gen-6 paint's 116). Now the share is read against the
  painted sky (`era/cube-light.js` `skyShare`): where the dome is more than 1.5 times (`SKY_OVER`) the ambient the
  card's share gives, the share rises to meet it, to at most 0.9 (`SKY_SHARE_MAX`: a sun is still a key); past that the
  light's level is the sky's and the materials fall dark under it, no base at the brightest a material may be. The
  jungle path's mean is 108. `cubeLight` returns the read (`skyLight`: the rule, the card's share, the dome's level
  and the ambient's) and says it in its checks.
- **A cube states its own**: `light.skyShare` (between 0 and 1), kept as written, the sky only read against it.
- **What moved, measured**: jungle-haze's share 0.13 to 0.85, theatre-grey's 0.13 to 0.50, limestone-crags' 0.38 to
  0.53, gothic-night's 0.06 to 0.10, city-night's 0.03 to 0.04. island-noon, valley-morning and upland-morning keep
  their look's share: their payloads are byte for byte as they were, in both eras and at another hour. Every gen-6
  payload is as it was.
- **Far ridges stand in the look's haze, not in a clear horizon's.** A form page's far land and its fog took the air
  at the horizon, about twice the look's own haze under an overcast sky: with the sky's share raised, a jungle-haze
  scene's ridges drew near white against a grey sky where the paint draws them dark. A look whose fog is darker than
  its dome's horizon by more than a tenth (`form/land-read.js` `HAZE_UNDER`) now carries that share (`form.land.sky.air`)
  and the form sky lays its haze at it (`channels/form-sky.js`). A clear noon's fog is its horizon's, so island-noon
  carries none and its page is as it was; at dusk its ridges darken against the horizon's glow.
- **The cast rig, as data** (`color-theorist/cast-rig.js` `castRig(cube, { hour, register, palette })`; nothing in a
  mint or a page reads it yet). The one light a body is drawn under, solved from the world's own: the key is the
  cube's solved sun at the level's hour (the light the land is lit by), the hemisphere that solve's sky light over
  what its floor throws back, the rim the horizon's hue. Only the key is a light a page owns; the hemisphere and the
  rim are for a body's own material, so they light nothing else. Two gains are the body's alone, as a fight lights its
  bodies: its key raised (to 3× at most) where a sky-lit level turns a figure less than 1.6× from its key side to its
  shade, its fill raised where a moon over a dark sky leaves the shade more than 6× under the key. The rim is raised
  where the shade side sits on the horizon's value. `register` (`western` | `anime`) is the body's, the light the same:
  the cel carries its three tones. With no cube it is the card, the fight rig's own lights in the solve's units, kept
  as written. Read on the cube presets: the clear and morning looks need no gain; jungle-haze's body key is raised 3×
  and still turns 1.57× (its level is the sky's); city-night's fill is raised 2.6×; both night looks' rims are raised.
