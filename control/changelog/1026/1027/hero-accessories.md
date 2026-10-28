### Hero accessories and items

- The comic hero pack's accessory cards (`cosmos/packs/comic-hero/accessories.js`): worn things that are neither a
  garment nor headgear, each the hero door's own words. Neck (the strapped emblem: the harness's straps crossing at a
  `medallion` mounted on them; the torc; the scarf, a `bow` at the collar with no loops and long tails), shoulders (the
  clasped mantle), arm (the arm rings, the rune band, the arm streamers, the feather token) and carried (the satchel, the
  tool roll, the quiver, the field pack) ride the suit's outfit build as its designed pieces on either
  body, each one the door wears on a person's landmarks; a word-list outfit and an armour build take none and the call
  says so. Eyegear (the goggles and the lab goggles pushed up) is the headgear's goggle cast shifted onto the forehead,
  the tiered body's only, carried in an armour build's `with`. Worn by `withAccessories(fragment, ids, body)` and by
  `memberOrders(id, look, { accessories })`. What the door has no word for is `ACCESSORY_GAPS`, said: the hung
  necklace (a `medallion` on its cord, the `chain` of office) has no place on a person's chest yet and the door leaves
  it off, dog tags, a wrist gadget outside armour, a clasp on the cloak itself, and the hip charms: the door's `charms`
  piece throws on a person's tiered body (its cord finds no seat on the pelvis), found by minting the card.
- The pack's item cards (`items.js`): what a hero holds or carries, one slot of the hero door's `gear` filled with an
  equipment build it already makes. Shields (the emblem shield, round and banded round its boss; the heater), blades
  (the sword, the katana in hand or slung on the back, the combat knife at the hip), staves (the bo staff, the sceptre),
  the recurve bow, sidearms (a service or a future pistol holstered at the right thigh or at low ready) and the film's
  long guns (the carbine in hand or slung, the shotgun). A card may name the swing word that suits it (`bash`, `chop`,
  `rising`, `plant`). Worn by `withItems(spec, ids, body)` (two cards for one slot are refused by name) and by
  `memberOrders(id, look, { items, swing })`: `items: 'signature'` carries the member's own (the cast's new `items`),
  `swing: true` stands the hero in its first card's swing. With none of the new options the orders are exactly what
  they were. The comic items with no builder are `ITEM_GAPS`, said and never approximated: a hammer, a thrown disc, a
  grappling gun, short sticks, a whip, a spear.
