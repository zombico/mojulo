### Pilot School's night circuit, and a student who lands

- **Lesson 4, Night circuit** (`gameworld/pilot-school.js`): a clear night at 21:30 under a bright moon, almost no
  wind, flown on the runway's and the town's lights. A left-hand circuit at 280 m over the runway, then a landing:
  - the take-off between the white edge lights;
  - the climb straight out, then crosswind, downwind, base and final;
  - the landing over the green threshold, its touchdown kept and graded by its sink.

  The rail's starter now lays every lesson (four), not the first three.
- **The lesson pilot lands** (`skyscape/lesson-pilot.js`, `LANDING`), where before a landing was said not flown:
  - It picks the runway it is lined up nearest and the end it comes at.
  - It flies onto the extended centreline first, holding no lower than 150 m over the runway while off it.
  - It flies a 3° glide path at 1.35 times the stall to a touchdown zone 150 m past the threshold, never steeper than
    about six degrees.
  - It flares higher the faster it sinks, with the sink eased with height and the power holding it over the stall,
    then idles in the last metre and a half and brakes once down.
  - The flight proof flies the night circuit to gold (about 213 s, touching down at 0.5 m/s).
- **Fixed: a level's `airspace.sky` reached its built level.** The gameworld's level record (`gameworld/world.js`)
  laid an airspace's own keys and left the sky out, so every lesson's weather (the first three's too) was dropped
  before the page; it is carried now (not in space).
- **A lesson lays a course only when it flies rings.** The first lesson keeps its gates; the others no longer draw
  rings they never ask for.
