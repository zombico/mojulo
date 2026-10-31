### Headgear as a library, and the comic hero pack's characters by name

Operator: "i need the comic pack to load character and assets more than anything else in comics"; "lift headgear into a
general library and build it". Nothing outside the comic hero pack (and the foes, through its grunts) read its headgear,
its cast or its crews; no tool reached them.

- **The headgear library** (`lib/graph/headgear/cards.js`): the comic hero pack's headgear cards moved out of the pack,
  beside the helmets by tradition (`helmets.js`). Masks, cowls, eyegear, mouthpieces, helmets, respirators and visors,
  each a card in the hero door's own words per body. Its errors say `headgear:`; its shell table is `HELMET_SHELLS`
  (the tradition library owns `HELMETS`). The pack, its grunts and the foes read it from there. Nothing they make
  changes: a move, not an edit.
- **`headgear` on the hero door** (`headgear/wear.js`, `layered.js`): a card's id, or a helmet by tradition. The hero
  stores the word alone and lowers it on every read, after a sport's `kit` (`wornHero`), so
  `update_character { spec: { headgear } }` swaps it in place and `null` takes it off.
  - A hero wearing a word is the hero with the card applied by hand, plan for plan.
  - The card's colours sit beneath the hero's `palette`, so naming a group (Helmet, Mask, EyeLens …) recolours it.
  - The game body wears every word. The realistic body wears the domino and the cowl and refuses the others by name.
  - A helmet by tradition becomes the outfit build's `language.head`, keeping a cover, band, net or mount the language
    already names; with no outfit build it is refused.
  - An unknown word is refused with the nearest word. A word the door does not take (`helmet`, `mask`, `cowl`,
    `goggles`, `visor`, `hat`) points at `headgear`.
  - Absent, no key and every byte as it was.
- **The comic hero pack's characters by name** (`cosmos/packs/index.js`): `create_character { pack: { id: 'comic-hero',
  member | grunt, look?, … } }`.
  - `member`: a cast member, with `era`, `pole`, `seed`, `headgear`, `pieces`, `accessories`, `items` (or
    `'signature'`), `ensemble` and `swing`.
  - `grunt`: a crew's grunt, with `kind`, `colourway`, `pole`, `seed` and `index`.
  - `look`: a stop of the dial, `dcau-golden` (the western hero on the game body) when none is named.
  - The pack's own orders are minted through the hero door with the headgear left as the door's word
    (`memberOrders` and `gruntOrders` take `words: true`), so the character is the same hero and stays editable by word.
    A grunt's crew colours stay over its head's.
  - A hero's `spec` beside `pack` lays over the pack's. The result says what was rolled (`pack`). One schema property
    on `create_character`.
- **Found and read**: generated solid-vocab cards, built from the tables at load: `headgear` (every word by family, the
  bodies it fits) and `comic-hero` (the cast, the looks, the eras, the cards, the crews, how to call them). The layered
  card's `hero-headgear` section. A `comic-hero` routing card ("a superhero and his henchmen", "put a cowl with bat ears
  on my hero"), `headgear` on the `revise-character` card, and two routing-eval rows.
- Machine gate: `headgear/wear.test.js`, `headgear/entries.test.js`, `hero-headgear.test.js` (one card per family
  through the door, the swap and the removal through `update_character`), `create-character.pack.test.js` (a member
  with each family's card as the word equals the member with it worn; a grunt with a head; the refusals; a mint through
  the door), the pack's own tests and the tests the change reaches. Eyes gate not run: nobody has looked at a pack
  member made through the door, or at a swap.
- Stopping point: the realistic head is fitted for two words; the pack's pieces, accessories and ensembles ride a
  member's orders, not the hero door; the pack's cubes are not yet read by `design_game`.
