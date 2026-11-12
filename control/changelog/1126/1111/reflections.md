### Reflections: built things under a live sun, a wet ground that mirrors

- The sun's shadow on a built thing outdoors is live, never baked into its corners. A building's shell and its yard's
  containers carry the sun's share of each corner's light, and the page's hour map takes it away where the sun is
  hidden. Open: under a strong sun a container's faces draw in uneven bands. The cause is the live shadow map: the
  bands go when the containers are kept out of it (`shadows.noCastGroups`), so they are shading themselves in error.
  The map's fit and bias on a land page are the next thing to set.
- A sun for rooms indoors. A room kit's recipe takes `daylight: { elevation, azimuth?, color?, gain? }`, and the form
  render takes it live: every corner turned to the sun carries its share, and the page's hour map (which a room's page
  did not have) takes it away where a roof or a wall hides it, so the sun comes in at a window as its own shape on the
  floor. Glass, sky cards and the painted sun patches let it by, and the painted patches give way. A painted page lays
  none, and a room without the word is as it was. `alone: true` turns the lamps off: the room lit by the day alone.
- A daylight's `gain` stands the sun over its paint: the solve lays a sunlit surface as painted, and the sun is then
  that many times it.
- Samples: a recipe's `samples: [{ of, at, size? }]` sets a material down in a room to be looked at: a liquid (`oil`,
  `water`) a pool on the floor, a metal (`chrome`, `steel`) a cube, each with its own roughness and metal to the form
  render. What they show today: a room gives a mirror nothing to hold but a plain gradient, so a pool is dark and a
  chrome cube a dark box; neither holds the windows, the sun on the floor or each other.
