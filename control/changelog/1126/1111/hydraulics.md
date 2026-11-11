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
  painted strips: both byte for byte. Seen in Chrome on the island plaza by day in gen-7. Its mist's air is solved in
  the open (the fountain passes no colliders yet).
- **Water landing on water.** Where a circuit's water strikes water the solve says how (`impacts`: the place, the
  ring it lands on, the speed of its fall, its flow): a tier's sheets a little out from its lip on the water below,
  the jet's own fall back on the water under it. The page draws the strike (`channels/hydraulics.js`
  `WATER_IMPACT`): rings running out from where the water lands and dying away, a broken line of foam where each
  sheet comes down and none between them, and drops thrown up to a share of the landing's own head and falling
  back. All of it is a formula of the clock: one disc and a few dozen points a landing. `impact: false` leaves it
  out. Seen in Chrome on the island plaza: rings across the basin under the bowl's sheets, and in the bowl round
  the finial.
- **Named apart from a trail's `waterworks`** (the land's own rivers and falls, `era/water-live.js`): that is a plan
  the land draws; this is a circuit a pump runs.
