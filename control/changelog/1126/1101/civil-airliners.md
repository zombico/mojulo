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
