### Hydraulics: flowing water as a solved circuit, for a fountain or any water that runs

- **A fountain's water as a circuit** (`materials/hydraulics.js` `solveHydraulics`). Three things mojulo already had
  are joined, none of them simulated on the page. The hydraulics (`rupa/fluid.js`): a basin, a riser with a pump, a
  nozzle; the pump's head, less the climb to the nozzle, is the pressure behind it, and that is the jet's speed and
  the flow. The falls (`materials/jet.js`): the jet rises and falls as a closed-form stream, and each tier spills
  what it receives over its lip as sheets at critical depth (at rest every tier passes the pump's flow). The air
  (`rupa/vayo.js`): where water lands, mist is carried by the air round that spot, solved once when the world is
  resolved (the faces it meets, the wind), so each mote's place is a formula of the clock. One dial moves it all: the
  pump's head. A circuit that cannot run teaches (a pump too weak to reach its nozzle, a tier above the jet's rise).
- **Any world may carry one** (`hydraulics`, a circuit or a list: `{ basin, pump: { head }, nozzle?, tiers }`, or a
  given `flow` with no nozzle: a spring, a channel). Its falls join the world's jets and its mist goes to the page
  (`worlds/world-scene.js`), the air solved against the world's own colliders. The page's channel
  (`scene/channels/hydraulics.js`) is a few dozen points a landing, moved by the clock: no state, no render target,
  the same frame at the same time. Its probe is `window.__mojWater` (the mists, their points, the solve's report:
  litres a second, the jet's speed and rise, the pump's power, each tier's sheet).
- **The island plaza's fountain runs on it** (a stage's `water: 'works'` or `{ works: { head?, nozzle?, mist? } }`).
  A jet rises from the finial, falls into the bowl, and the bowl brims over to the basin in sheets whose flow is the
  pump's; mist stands where they land. `water: true` is the live water it was, and a stage with no `water` its
  painted strips: both byte for byte. Seen in Chrome on the island plaza by day in gen-7.
- **Water landing on water.** Where a circuit's water strikes water the solve says how (`impacts`: the place, the
  ring it lands on, the speed of its fall, its flow): a tier's sheets a little out from its lip on the water below,
  the jet's own fall back on the water under it. The page draws the strike (`channels/hydraulics.js`
  `WATER_IMPACT`): rings running out from where the water lands and dying away, a broken line of foam where each
  sheet comes down and none between them, and drops thrown up to a share of the landing's own head and falling
  back. All of it is a formula of the clock: one disc and a few dozen points a landing. `impact: false` leaves it
  out. Seen in Chrome on the island plaza: rings across the basin under the bowl's sheets, and in the bowl round
  the finial.
- **A fall ends on the water it lands on.** A circuit's sheets and its jet were given a fall a little past their
  water, as the plaza's live sheets are, and through clear water they were seen running on to the floor. Each now
  falls exactly to its water: a sheet to the pool below (a tier's own `level`, a little under its lip where it names
  none), the jet back to the water under its nozzle.
- **The mist's air meets the world's solids.** A circuit a kit lays is solved before its world has its colliders, so
  its mist's air was the open air. Where the world is resolved the air is solved again among its solids
  (`mistAir`, `worlds/world-scene.js`): the world's walls, and the kit's own stone (the plaza's fountain gives its
  bowl and its pedestal, so the mist under the bowl spreads out from under it).
- **A second shape of circuit, and a circuit that draws itself.** A spout thrown from a wall into a trough that
  pours forward into a floor basin, in a stone room, from the world's `hydraulics` key alone. What it took: a nozzle
  that points any way (the jet is thrown along it for as long as it is in the air, and the solve says where it comes
  down, `report.lands`); a lip that pours over an `arc` of itself, not all the way round (a trough against a wall);
  and the circuit's own vessels as plain stone and standing water where the world brings none
  (`hydraulicsFaces`: the basin a walled ring, each tier a bowl on a stem; `stone: false` for none). A jet thrown
  past the water meant for it teaches, with how far it missed: the first three tries at this very demo were
  refused that way. Seen in Chrome in a gothic-stone room in gen-7.
- **Named apart from a trail's `waterworks`** (the land's own rivers and falls, `era/water-live.js`): that is a plan
  the land draws; this is a circuit a pump runs.
