### Hijack City activities

- **Jobsified, the city's driving jobs.** A new phone app lists jobs done in one of the city's own vehicles. Take one
  on the phone, get into its vehicle and do the job in it; nothing counts on foot. Each pays into the money in hand and
  can be done again.
- **Bin round.** Get into a garbage truck at the works yard. Piles of bags stand at kerbs across the district: pull up
  and hold F to collect one. Four fill the truck; take it to the dump to empty it and get paid, its tailgate swinging
  up as it unloads. Collect every pile and the city puts more out.
- **The dump.** A district can now have a dump (`dump: true` on its city settings): one of its car parks is built as a
  big tipping hall, open to the street, that a truck drives into. Hijack City has one.
- **Heavy vehicle call.** A general call for heavy operators: trucks and construction machines wait at the kerb by the
  works yard, a concrete mixer, a flatbed, a wheel loader, a tipper, a skip lorry, a backhoe, a box truck, a wheeled
  excavator, three at a time. The call names one; drive it across town to its building site to get paid, step out and
  it goes back to the yard, and the next is called. Each handles as its own weight and power.
- **A fake ID.** The city has a forger: walk in with 150 and walk out with a forged heavy machinery licence. The heavy
  vehicle call can't be taken without one; the phone says what it needs and who sells it. A world turns the forger on
  with `shops: { forger: true }`; Hijack City has one.
- **Dig and load.** A side game at a building site, for licence holders: climb into the site's excavator and work it
  with an operator's levers, A/D to swing, W/S for the arm, the arrow keys for the boom and the bucket. Dig into the
  pile of spoil, curl the bucket to scoop, swing over the waiting tipper and open it to tip. Three loads fill the truck
  and pay. The boom, arm, bucket and their hydraulic rams all move as the real machine's do.
- **The materials never came.** Once the dig is done the foreman calls: his building materials never turned up, does
  anyone know a logistics company? The Dockers do. Check in at the Dockers' HQ for delivery orders: trucks of steel,
  timber, fittings and containers wait at the dock, and each driven to a building site pays.
- **A dock, and highways you can drive.** A district can now have a working port on its shore (`dock: true`): a yard
  with a warehouse and truck bays, container stacks and a big quayside crane. Its highways get ramps: at every arterial
  they cross there is a ramp down to the street on each side, and one from the shore highway down into the port, so
  trucks can run from the dock up onto the highway and come off again in town. Hijack City has both.
- **Bus route.** A bus waits at the kerb by the depot. Its stops come in order, each with a sign and people waiting.
  Pull up and hold F to open the doors: the waiting people walk over and board, and the ones who got on at the stop
  before get off and walk away. The last stop pays and the route starts again.
- **Street sweeping.** A street sweeper waits at the kerb by the works yard, and litter lies along the kerb side of
  the streets nearby. No button to hold: drive along the kerb and the sweeper picks each heap up as it passes. The
  screen counts what is swept and calls each quarter; sweep it all to get paid, and the streets are dirty again by the
  next round.
- **Groundskeeping.** The parks' grounds crew keeps falling ill, and the parks office will take anyone with a licence:
  the fake ID gets you this one too. There's no mower left lying around town: walk to the groundskeeper's shed by the
  nearest park and take the mower out, and a mowing minigame of its own comes up. It's that park from above (its paths,
  trees, playground and flowerbeds): drive the zero-turn mower to cut the long grass in stripes, steer round the trees,
  stay off the flowers, and beat the clock. Cut enough of it to get paid; the shed is open for another round.
- **A new minigame, Mowing.** Beside blocks, match and fishing, any level can now put a mowing round at a place
  (`play.minigames`, `game: 'mowing'`), on a lawn of its own (`lawn`) or a seeded park, with a condition before it can be
  started (`if`) and what's said when it can't (`locked`). The book's `minigames: true` stays the three stall games.
- **The ride-on mower** is new on the vehicle shelf (`ride-on mower`, `riding mower`, `lawn tractor`): a low bonnet, an
  open seat with a high back, a cutting deck under it and its chute out to the side, at a mower's own weight and top
  speed.
- **The way and the screen.** Taking a job on the phone points the guide at it straight away; the arrow leads to the
  nearest pile still waiting. A line on screen shows the truck's load or the next stop and who is aboard, with a bar
  while F is held. A finished job is announced with a card in the middle of the screen over what it paid, the money in
  the corner counts up to its new amount, and a new task slides into the phone's list.
