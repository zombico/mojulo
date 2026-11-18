### The co-op kitchen: seats work the shift

The work shift (the Work Sim rail's kitchen, farm stand, site and roof) learns its seats, the first step toward the
co-op kitchen the cosmos registry refused: two to four cooks in one kitchen on one screen, an order carried from
station to station and handed between them.

- **Every seat works with its own hands.** A level with seats (`seats.bodies`, a cube's `soul.seats`) lowers the work
  mechanic once a seat: seat n's hands are the holder `hands<n>` (seat 1 keeps `bag`), its presses `s<n>:use-<place>`,
  its zones watching its own body. Stations, shelves, tickets and the clock stay shared. A station slot remembers who
  works it: walking off pauses only that cook's work, and what a run with no wait makes comes into that cook's hands.
- **The pass.** A shelf is put on from one pad and taken from the other by anyone, so a kitchen laid with the shelf
  between two cooks can only be worked by handing things across it.
- **The page.** Seats 2 to 4 each get their own reach and interact press (seat 1's is as it was), emitted only for a
  world with seats and a shift.
- **The proof.** `proveWork` plays several cooks, each its own spawn and reach, on the page's bus; a split kitchen is
  won only through the pass (machine gate). Whether it plays well together is the eyes gate, the operator's.
- **Opt-in, byte for byte.** A level with no seats lowers and emits what it did.
