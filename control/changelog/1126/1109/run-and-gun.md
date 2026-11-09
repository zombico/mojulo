### The run & gun on the belt: bullets that fly, its practice range

- The run & gun's guns (`brawl/brawl-guns.js`): a gun as its ROUND's flight, never a hitscan: its speed (mm a frame), its
  rate, its fan (pellets, spread) and its stream's wander (a fixed cycle of its shots, no dice), its damage and
  stagger, its life, how many bodies it passes through, the line across the belt it lands within, a knockdown, a burst
  where it lands, a lob, its ammo, the warning a foe aims for before it fires. The shelf: the players' sidearm (never
  out), machine gun, spread, flame, rocket and grenade, and the foes' rifle, burst, bazooka and lob, their rounds slow
  enough to see and step off. A gun passed into a practice room is its dials over a row (`readGun({ from, … })`).
- In the brawl's core a body with a `gun` fires rounds that fly along the belt and across it (eight aims on the floor,
  the across ones shallow so the depth reads under the side camera), land only within their line (step off it: dodged),
  pierce as their gun says, burst where they land (a rocket, a lobbed grenade), and never re-stun a body already reeling
  (a stream cannot pin it; its damage is whole, not scaled by its own count). A pick-up gun's ammo spent, the body is
  back on its sidearm; firing, it walks slower and faces its aim; `roll` is the gunner's dodge, untouchable as it goes.
