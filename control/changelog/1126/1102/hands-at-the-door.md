### Hand shapes at the hero door, and the servos as a mint stamp

The manual manipulator's hands, asked for by name at the hero door.

- **Hand shapes:** a hero's stand or clip may give `fingersL` / `fingersR` a shape (`craneBeak`, `tigerClaw`,
  `swordFingers`, `leopardFist`, `phoenixEye`, `verticalPalm`, `pinch`, `ok`, `haft`, and the plain aliases `beak`,
  `claw`, `sword`, `leopard`, `phoenix`, `palm`, `flat`, `okay`), solved digit by digit on that hero's own hand, either
  hand. `fist`, `point` and `grip` stay the hand words they always were.
- **Each joint its own angle:** a finger `{ mcp, pip, dip, spread }`, the thumb `{ cmc, toPalm, mcp, ip }`, degrees over
  the relaxed hand. A clip that mixes words, shapes and joints blends joint by joint.
- **The servo stamp:** a minted hero's readout names any clip key that turns a joint past its stop (the shoulder, the
  elbow, the wrist, a finger's or the thumb's joints) under `layered.rig.servos`; advisory, nothing refuses. Today it
  names the realistic hero's own wave, which turns the forearm well past its range at one key.
- **Unchanged:** a hero naming no shape and no joint-by-joint digit is the hero it was, byte for byte.
