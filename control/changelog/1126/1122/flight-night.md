### Night flying: a moonlit sky, towns that light themselves, runway lights, traffic and lightning

`airspace.sky.hour` runs 0–24, and a sky may name its moon (`moon: 0–1`) and its `lightning` (a storm's by default).
See `docs/flight-games.md`, "Night, city lights and lightning".

- **The night** (`skyscape/sky.js`): the day's colours fade through the twilight's afterglow into the night's.
  - The moon lights the ground: its direction is the kernel's light, and the tint is dark and blue on the ramps, the
    country's cover and walls, and the pads' asphalt and marks.
  - The clouds are moonlit.
  - The sea takes the moon's glint.
- **The sky at night** (`scene/channels/flight-sky.js`):
  - stars, and the moon's disc lit to its phase, with its halo;
  - the towns' glow, on the horizon toward each and on the bellies of the clouds and decks over them.
- **The towns' lights** (`scene/channels/aerial.js`):
  - street grids lamp-lit in sodium orange, with a halo, from a light map painted off the ground plan;
  - plazas, lots and yards dimmer, highways white;
  - a share of every building's windows lit, warm or cool, fading to their mean far off.
- **The night's lights** (`skyscape/night-lights.js`, `scene/channels/night-lights.js`), from the dusk on:
  - runway edge lights, green thresholds and approach bars;
  - red beacons flashing on the mast and the tall buildings;
  - traffic on the roads, the arterials and the highway decks: white lamps toward the eye, red away from it.
- **Lightning**: seeded strokes in the thunderheads near the eye, on the page's clock.
  - Return strokes flicker over half a second.
  - The cloud lights through; the sky, the haze and the ground flare.
  - A branching bolt (core and glow) runs to the land or the sea.
- **Thunderheads** now have a broad foot, a tower and a spread anvil.
- A page by day, or a terrain page that is no airspace, carries none of the night's lights.
