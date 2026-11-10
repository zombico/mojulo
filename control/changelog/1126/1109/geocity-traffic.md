### The metro's traffic: its arterials driven, a signal at every crossing, drawn near the camera

- **Traffic, not parked kerbs.** A geocity parked a car in most stalls along its arterials' kerbs. Now its kerbs are kept
  clear and its arterials are driven (`geocity/flow.js`). This is the old fractal city's "ants"
  (`scene/channels/cars.js`) at a metro's scale:
  - **Lanes.** Every travel lane is a ring its vehicles drive round: out at the land's edge, back in at the other. A
    streetcar's lanes are kept to its tracks.
  - **Signals.** Every crossing has a signal: two exclusive phases and an all-red clearance. The clearance is derived
    from the longest vehicle across the widest box. Vehicles stop at a line behind the crosswalk, queue behind the one
    ahead and pull away on green. This is the shared signalised model (`traffic-model.js`), its numbers in metres.
  - **Vehicles.** Each is one of the fleets' (`fleets.js`): the family cars mostly, a taxi, a delivery van or truck, a
    bus, a works pickup or a garbage truck now and then.
- **Only what the camera sees.** The page's flow channel (`scene/channels/flow.js`) gives each lane its own model and
  steps it only while the camera is within reach of it. A lane far off waits. One that comes into reach starts from the
  last turn of its signals' cycle: all of a metro's signals share one cycle, so a lane's pose at a clock is the clock's.
  Its vehicles are instances, written each frame only for those within reach and in front of the camera. A camera high
  over the metro steps and draws none.
- **One template a model.** They are drawn on the parked vehicles' own templates. A repeat may carry `pool`, a key the
  flow channel instances it by, and is packed even with nothing parked (`geotown/cars.js` `carRepeats({ pool })`).
  Without a flow the page adds not one byte.
- **Laws and readout.** Two laws, `flow-holds` (every lane within what it holds) and `flow-clearance` (the all-red long
  enough). The readout carries `flow`: lanes, vehicles, signals, cycle, clearance. `flow: false` drives none.
