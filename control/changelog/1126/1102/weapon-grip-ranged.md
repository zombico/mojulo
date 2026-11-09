### Weapon grip and ranged play: hands on the real guns, the bow drawn, sights, scopes and switching in the shooters

The shooters (the quick `shoot` and `deathmatch` goals, first person or over the shoulder) and the hero's holds get the
arms kernel's own guns in their hands. A hero holds a rifle, a sniper rifle, a submachine gun or a handgun on the arm's
own stations, its fingers closed on the parts as drawn and the index on the trigger; a hero draws a bow to the anchor
and looses it; a player carries a kit of the latest arms, aims down their sights, looks through a scope, steadies it,
reloads and switches with the arm stowed and drawn, and moves and strafes while doing it. Every hero, clip and page
minted before is byte for byte as it was. The eyes gate is the operator's: the pages were driven in headless Chromium
and looked at in screenshots only.

- **Handling read off the arm** (`lib/graph/equipment/arms/handling.js`): `armHandling(build)` reads each part of an arm
  as the workbench draws it and gives its stations (the fist on the grip, the trigger's face, the index along the
  frame, the support hand's part: a vertical foregrip, a handguard, a pump, a guard's loop, or a handgun's wrap; the
  butt; the sight line: an optic's window, a scope's axis, its power and its eye relief, or a bead along the receiver;
  the magazine; the muzzle) and its handling (loaded mass, time to the eye, the switch's two halves, sway, recoil:
  class estimates, marked so). `armBoxes(build)` gives the arm as its parts' boxes.
- **A sniper rifle** (`equipment/arms/models.js`): `rifle` model `sniper`, the marksman's receiver on the longest
  barrel with a long scope read at 8×. No existing builder's bytes move.
- **Hands on the real guns** (`polygonizer/hero-carry.js`): new holds `rifleAim`, `rifleLowReady`, `sniperAim`,
  `sniperLowReady`, `smgAim`, `smgLowReady`, `handgunAim`, `handgunLowReady` hold the arms kernel's models on their
  own stations (the proxy-box samples' holds are unchanged). The fists close on the arm as drawn (hero-digits: the
  strong hand's fingers and thumb round the grip at its girth, the support hand round the handguard, the pump or up the
  foregrip, or wrapped over the strong fist on a handgun), the index's pad on the trigger at the aim (within 0.1 mm)
  and straight along the frame at the ready; a scope's eye relief is kept in the cheek weld. New checks: `grasp` (every
  closed digit on its part) and `trigger`. `heroHold(name, R, { arm })` puts another model of the class in the hold
  (a bullpup in `rifleAim`). The arm rides the hand as gear (`carryMounts`), so the clip's prop is the real arm.
- **The bow** (`polygonizer/hero-bow.js`, motion words `bowDraw` and `bowLoose`): side on to the mark, the nock at the
  corner of the mouth, the arrow from it to the mark, the bow arm straight at its own draw length, the bow hand closed
  round the grip, the drawing arm by the archer's rule (the elbow on the force line, the wrist straight, the three
  fingers hooked on the string). `bowDraw` nocks, raises and draws to the anchor and holds; `bowLoose` lets go (the
  hand thrown back along the jaw, the fingers open), follows through and comes back to the ready. The readout names
  the draw length and the nock's place per key; the bow is a rigid prop, so its string stays at brace on the model (a
  limit: an engine bends it from the readout).
- **The carried kit** (`gameworld/arms-kit.js`, the quick door's `arms: [...]` on `shoot` and `deathmatch`): up to five
  of `rifle`, `carbine`, `bullpup`, `smg`, `pdw`, `shotgun`, `breacher`, `marksman`, `sniper`, `coilgun`, `caseless`,
  `handgun`, `revolver`, `bow`, or an arm's build words. Each is a weapon row by its archetype (an assault rifle's
  automatic fire, a shotgun's wide cone thinning with range, a marksman's and a sniper's head multiple, a bolt's pull)
  scaled to the goal's base round, with its sights, its sway and its switch's halves from the arm's handling.
- **Gunplay in the world** (`worlds/controllable/gunplay.js`, opt-in, emitted only for a world that asks): the sights
  come up over the arm's aim time, tighten the cone and slow the feet (the body still moves, strafes and fires,
  wider on the move); the aim sways by the arm, more from the hip and on the move, and a scope's breath held steadies
  it for four seconds before the body wants air; R reloads a partly spent magazine; a first-person walker switches on
  the same keys with the switch's ready-time; a bow's arrow flies faster and harder the further it was drawn and falls
  as it flies. Deterministic: the sway is a curve of the world's clock.
- **The page** (`scene/channels/controllable/gunplay-view.js`, opt-in): right click aims, Shift steadies a scope, R
  reloads, the wheel and 1–5 switch, A and D strafe under a look camera. The view closes to the sight's power, a spray
  lifts it, a scope shows its picture (crosshair, marks, the breath's bar). In first person the arm is in hand as its
  parts' boxes (an optic an open hood), brought to the eye along its sight line, bobbing with the stride, lagging the
  look, kicking with each round, dipping to reload, and switched as two halves (lowered out, the next raised in); a
  bow's string draws back with the button held, and its arrows fly as shafts.
