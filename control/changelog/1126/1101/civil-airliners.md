### Civil airliners: the made finish, the airline looks, the jumbo

The shelf's civil aircraft (the bizjet, the regional turboprop, the single-aisle and the twin-aisle) in the treatment
the fighter and the helicopters have, and a four-engined jumbo.

- **The airliner's made finish** (`craft-shelf/liner-made.js`, with `made`). A civil hull, one with a glazed flight
  deck and a windowed cabin, gets:
  - its flight deck's frame (sill, head, posts and centre post);
  - pitot probes and angle-of-attack vanes under it;
  - red beacons over and under the cabin;
  - the APU's exhaust at the tail cone;
  - each door's viewport, handle and hinge line;
  - the cargo holds' doors on the right, their outline, hinge and handle following the skin. They come from a new hull
    word, `holds`, which the single-aisle and the twin-aisle carry.

  A fighter's hull keeps the fighter's finish, and an airliner carries no IFF blades or heat bands.
- **A turbofan, made:** its nacelle and lip open, so the intake reads as a hole down to a fan face behind the blades,
  in place of the disc that stood in front of them. Its spinner carries a swirl. The fan nozzle's trailing edge and
  the core cowl step down to the plug, and the latches sit along the cowl's foot.
- **The turnaround** reads a row's own holds where it names them.
- **The airline looks** (`craft-shelf/liner-looks.js`): a third look family, `liner`, for an airliner's or a courier's
  fixed wing. Its cards are generic schemes, never a real airline's:
  - `white`;
  - `tail`, its colour and a disc on the tail;
  - `cheatline`, dark and gold lines under the windows, a polished belly and a gold sweep;
  - `bellied`, a coloured belly up to the windows and a chevron;
  - `bold`, one strong body colour, grey wings and an accent tail;
  - `freighter`, its windows plugged.

  A card's scheme sets the tail's, engines' and wings' colours, cuts a belly or cheatlines into the hull by height,
  lays an emblem on both sides of the fin and carries the tail's colour to the winglets. A look is taken by
  `assembleCraft`, `craftForm`, a world's craft figure and a parked craft.
- **A fixed wing's civil registration** is aft, under its tail, where an airliner's is; a helicopter's stays at its
  boom's root.
- **The jumbo** (archetype `jumbo`, a class and not a replica): a four-engined twin-aisle with an upper deck over its
  forward third.
  - Its hull is `fus-jumbo`: its stations raise the hump and fair it into the main deck's barrel. Its windows run in a
    row per deck, since a hull's `windows` may now be a list; the first row's ids stay a single row's, so every other
    hull is unchanged. It has main-deck doors, an upper-deck door and two holds.
  - Its wing carries inner and outer engines on their own pylons, and winglets.
  - Its tailplane and fin are its own.
  - It stands on four-wheel wing and body bogies and its own nose leg.

  It measures within a few percent of its reference. The registry's new `jumbo jet` row (jumbo, quad jet, four-engine
  airliner) names it, and the twin-aisle keeps `widebody` and `long-haul jet`.
- **The turnaround** calls a jumbo's whole crew, and the fuel truck waits clear of every engine and pylon by their
  layout's ids (a jumbo's inner and outer pairs). Its craft read loops over a big craft's corners rather than spreading
  them into an argument list.
