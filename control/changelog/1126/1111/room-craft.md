### Room craft: the reasons behind a worked interior, as questions a room is asked

The ashlar crypt's craft laws said what to build (a turned torch, a fluted shaft, a blind arch, a candle ring). Carried
to another interior as they stood, they would have placed the crypt's things in a lab. `era/room-craft.js` carries each
law back to its reason and puts it as a question to the place being built: what its fixtures are made of and what holds
them, what carries the roof and in what material, what a wall's full bay is and what it is with less, where reach ends
on a tall wall, what covers the structure and what has taken it off, where the floor's edge, way and centre are, what
the height is for, and what gives light above. Each row has its why, what the answer is derived from, how a crypt, a
lab, a hangar and a chapel each answer it (no two alike), and the answer that is not one.

- `readRoomCraft(kit)` reads which questions a room kit's card answers and by what; `roomCraftLedger` reads the room
  kits together. It reads what a card declares, never a kit by name; whether an answer reads on the page is the eyes
  gate's.
- The agent reads it: a generated card, `room-craft`, and a `CRAFT` line on every room kit's card naming what the kit
  answers and what is open for whoever builds with it (answered with `items` and `lights`).
- The craft laws' wording no longer names the crypt's things.
- The bay kits' service boxes follow a wall's rhythm (`services.rhythm`, `era/wall-rhythm.js`) where they stood on
  every second bay; the everyday register boxes the fewer of a wall's bays. A bay room already minted draws its boxes
  on other bays.
- The catacomb answers every question in its own things, each by its own cause: a clay lamp on a corbel of the rock
  (`torch.form: 'lamp'`, its live flame a wick's); piers splayed at the foot with an impost; loculi in a rhythm; a
  ledge at the first diggers' floor with the oldest tombs sealed over it (`storeys.loculi`); plaster within reach and
  sooted bare rock above; a floor laid by its use; shoring logs wedged wall to wall with a lamp hung from each
  (`above.span`) and a light shaft's mouth over the ossuary. A catacomb already minted renders differently.
- As read now: the ashlar crypt, the catacomb and the bay kits (but the vernacular, which has no services) answer all;
  the research lab lacks a rhythm and a coat; the nave a made fixture, a rhythm and a coat; the first crypt
  (`gothic-stone`) answers none and is unchanged.
