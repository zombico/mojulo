### Snow and footprints in gen-7

- **Snow drawn by the form render** (`era/snow.js` snowMap, `scene/channels/form-land.js`). The gen-7 page drew a level's
  snow as the painted surface it reads nothing of, with stepped bands at the trail's edge. Read for the form render (the
  read's `ctx.form`), a level lays no snow faces over its ground: it hands the page a map of where the snow lies (the
  snow field, read on the ground's own normal, half a metre a texel), and the layered ground lays the snow over whatever
  is beneath, held per pixel only where the ground is level enough (a rock's ledge white, its face bare), its edge
  wandering in and out over a metre and finer. It buries the ground's own detail (deeper, more), swells in soft drifts a
  couple of metres across and glitters (a grain in fifty, polished, lit through the light); on the trail it is trodden,
  packed and greyed, the soil showing through as far as it is shallow. Its colour is the snow's own (snowAlbedo) solved
  under the cube's light as the palette's colours are (`snowBase`). The grass thins in it by the cube of the share its
  depth leaves standing (the near blades stand their full height), and the plants carry it: a leaf turned up past its cap
  (capOf) takes it, a share of them by the depth, where the map says it lies. The stones' painted caps stay as they were.
- **Footprints** (`scene/channels/form-land.js`, `PRINTS`; window.__formPrints). The walker's steps press into the sand of
  a land with dunes and into its snow: a sole (heel and ball, a tread, its rim pushed up) every 0.8 m, left and right, on
  a map 12 m across that moves with the walker; the ground reads it a march along the view into the print (its far wall
  seen, its near one hidden), lights its walls from their slopes, erases the ripples and the drifts where the foot
  pressed and shades its inside (a snow print holds the sky's blue). A sand print is 3.5 cm deep and the wind fills it
  back over a minute; a snow print is as deep as the snow lets it (to 12 cm) and lasts ten. Under the form render the
  gen-6 snow's footprint bed (`channels/snow-prints.js`) is not laid; gen-6 pages keep it. A land with neither dunes nor
  snow carries none of this: the same page to the byte.
