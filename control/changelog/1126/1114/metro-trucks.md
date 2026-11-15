### The metro's trucks: rigs on its highways and at its docks, small trucks on its streets

The metro now keeps and drives the new trucks.

- **Its fleets** (`geocity/fleets.js`). The garbage trucks, fire engines and ambulances are the city's own realistic
  bodies; they were stand-ins. The deliveries take a cube van and a 2-ton cab-over among their vans and box trucks. Two
  new fleets: `freight` (the eighteen-wheeler, its tanker and a cab-over lorry) and `industry` (wing bodies, flatbeds,
  box trucks). A fleet row may give its body's words (`brief`: a semi's trailer).
- **Its industry** (`geocity/industry.js`, `scene.js`). The rigs back onto a warehouse's docks, their tails at the dock
  and their length out into the court (a vehicle op's `back`). They wait at a storage yard's gate. The working trucks
  stand in a works' court.
- **Its traffic** (`geocity/flow.js`). Each road has its own mix: a street's small trucks among its cars, an arterial
  along an industrial neighbourhood's working trucks, and a highway's rigs. A rig never takes a signalled street, so the
  signal boxes are sized to the streets' longest vehicle.
- **Its models** (`geotown/cars.js` carModel). A hull-kit body is compiled in a pale livery, so its own paint takes the
  fleet's tint. Its width is its body's, without its mirrors. A key may carry a brief (`loft:semiSleeper|tanker`). The
  front-third search was quadratic in a model's corners: a rig cost seconds, now milliseconds. The memo holds a
  metro's whole fleet.
