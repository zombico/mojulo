### The open city's shops: a respray and a gun shop

- **A world's `shops`** (`gameworld/shops.js`: `{ respray?: true | { price }, guns?: true | { price, rounds } }`), laid
  on a played district with a bag to pay from and marked on its map.
- **The respray** (`game/shop-mechanics.js` `respray`): a garage at a street junction a drive from the start, clear of the
  parked cars. Driven into with stars and the price, the car comes out a new colour (the cast's `repaint`) and the law
  loses the player (`cleared:wanted`); with no stars, nothing to hide.
- **The gun shop** (`gunshop`): at a shop front a walk from the start; the price buys a box of rounds for the pistol the
  hero carries empty (`arsenal.js` `cityPistol`, the bare hands' sidearm: Q held, it fires at the foe before the hero).
  A sidearm takes `reserve` and `loaded` (a gun carried empty), and a weapon `loaded` (the runtime's).
- **Bare hands strike**: a hero whose moveset is only its fists is armed with them on the page (`held-strike.js`
  `FIST`); before, its clicks swung nothing. A city the law watches, or where guns are sold, has a hero who fights.
