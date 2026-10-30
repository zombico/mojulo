// footwear/styles — the seeded footwear CARDS. PURE DATA: every card is plain JSON, so an agent can read one, copy it and
// author its own inline. A new look is a new card, not code (principles.js carries the laws).
//
// A card:
//   from    a card it extends (a word or a card): its sock merged, its sole, adorn and family replaced where given,
//           `adornPlus` appended to its adornment, its tones merged. So a variety is a few keys over its kin
//   skin    a COLOURWAY (SKINS, or { <group>: '#hex' }) over the card's tones: any card in any colours
//   family  what kind of footwear it is (expand.js FOOTWEAR_FAMILIES: shoe, boot, sandal, sneaker, dress, historic, fantasy,
//           military)
//   sock    { height: 'shoe' | 'boot', collar? (a share of the foot, a shoe's), shaft? (a share of the shank from the
//           ankle, a boot's), thick? (m, how far the leather stands off the foot; 0.004) }, or false: none (a sandal)
//   heels   { height (m the heel stands), toe? (m of sole under the toes: a platform), shank?, kind? (stiletto, kitten, block,
//           wedge), to?, group? }: the foot tipped about the toe base and the body risen on them (the rig's stance), the
//           soles and the heel cut against the ground under that pose
//   sole    { thick (m), welt (m) } (one layer), or { layers: [{ thick, welt?, group?, pod? }] } stacked from the floor up
//           (an outsole, a midsole, a stripe …), each with a pattern (expand.js SOLE_PATTERNS): `pod` an air window at the
//           heel, `heel` a block under the heel (a dress heel), `lugs` tread round its edge
//   adorn   [{ prim, … }] laid in order (expand.js ADORN_PRIMS names each one's keys):
//             strap   { on: 'foot' | 'shank', at (share), width? (m), buckle? }
//             band    { on, at, width? } a thin ring of gilding
//             cuff    { width?, lift? } a turned band at the sock's collar
//             toeCap  { lift?, room? (m past the toes, 0.006), rivets? (every n-th point of its back edge), stud? { size, group } } the half teacup: a quarter
//                     egg, toe base to tip (tiny dark studs: a brogue's perforations)
//             panel   { region (cobbler.js COBBLER_REGIONS, or { along, around, sides }), on?, lift?, thick?, rise? } a
//                     pattern piece on the sock, a matching pair where the region has two sides
//             laces   { rows?, shaftRows?, lift?, w? } criss-cross between the eyestays
//           and the pieces of fantasy, drama and history (fantasy.js):
//             toePoint { length, curl (degrees), taper, bell } a toe drawn out past the toes and curled up
//             wrap     { on?, from, to (shares), turns, cross, w } a ribbon spiralled up the leg (cross-gartering)
//             flare    { height, spread } a funnel rising from a boot's top (a bucket top)
//             buttons  { count, side, around, from, to, size } a row of buttons up a boot's side
//             spur     { length, size } a neck from the heel and a star rowel
//             wings    { feathers, span } a fan of feathers at each side of the ankle
//             jewel    { at: toe | instep | ankle, size } a stone set there
//             fur      { on?, at?, length, droop, seed } a shaggy ruff round the collar (or a ring along a segment)
//           any of them `group` (its colour's name) over its own
//   tones   { <group>: '#hex' | { of: <group>, shade: −1 … 1 } } over FOOTWEAR_TONES, for the groups the card uses; a tone
//           OF another group is that group's colour darkened (−) or lightened (+), read after the palette, so recolouring
//           the leather (`Shoes`) carries the pieces cut from it
export const FOOTWEAR = Object.freeze({
  boots: { family: 'boot', sock: { height: 'boot', shaft: 0.3 }, sole: { thick: 0.009, welt: 0.003 },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.625, buckle: true }, { prim: 'strap', on: 'shank', at: 0.9, buckle: true }] },
  shoes: { family: 'shoe', sock: { height: 'shoe', collar: 0.15 }, sole: { thick: 0.007, welt: 0.002 }, adorn: [{ prim: 'strap', on: 'foot', at: 0.625, buckle: true }] },
  sandals: { family: 'sandal', sock: false, sole: { thick: 0.01, welt: 0.004 },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.675, width: 0.02, buckle: true }, { prim: 'strap', on: 'foot', at: 0.1, width: 0.012, buckle: true }] },
  // a steel toe: the toe box capped in steel, riveted along its edge, on a stout low boot with a deep sole
  workBoots: { family: 'boot', sock: { height: 'boot', shaft: 0.22, thick: 0.006 }, sole: { thick: 0.016, welt: 0.005 },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.004, rise: 0.014 }, { prim: 'panel', region: 'eyestay', lift: 0.005 }, { prim: 'laces', rows: 4, shaftRows: 3, lift: 0.0065 },
      { prim: 'panel', region: 'quarter', lift: 0.0035 }, { prim: 'panel', region: 'counter', lift: 0.0035 }, { prim: 'cuff', width: 0.018, lift: 0.007 },
      { prim: 'toeCap', lift: 0.004, rivets: 3 }],
    tones: { Shoes: '#8a5a2e', Overlay: LEATHER(-0.15), Eyestay: LEATHER(-0.15), Counter: LEATHER(-0.15), Tongue: LEATHER(0.05), Cuff: LEATHER(-0.3), Lace: '#3a2818' } },
  // the adventurer's: a thicker sock, a deep sole, the ankle dressed (a cuff at the collar, a gilt band, a buckled strap)
  adventurerBoots: { family: 'boot', sock: { height: 'boot', shaft: 0.35, thick: 0.008 }, sole: { thick: 0.014, welt: 0.005 },
    adorn: [{ prim: 'cuff', width: 0.03 }, { prim: 'band', on: 'shank', at: 0.8, width: 0.008 }, { prim: 'strap', on: 'foot', at: 0.6, buckle: true }],
    tones: { Shoes: '#5a3e2b', Cuff: '#3f2a1d' } },
  // SNEAKERS, cut as a cobbler cuts them: the tongue down the instep (standing above the collar), the eyestays either side
  // and the laces across them, a matching overlay on each quarter, the heel counter, a padded collar, a toe bumper.
  // The court shoe: a tall white cupsole on a thin gum outsole
  sneakers: { family: 'sneaker', sock: { height: 'shoe', collar: 0.1, thick: 0.005 },
    sole: { layers: [{ thick: 0.004, welt: 0.004, group: 'Outsole' }, { thick: 0.02, welt: 0.005, group: 'Midsole' }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.003, rise: 0.014 }, { prim: 'panel', region: 'eyestay', lift: 0.004 }, { prim: 'laces', rows: 7 },
      { prim: 'panel', region: 'quarter', lift: 0.003 }, { prim: 'panel', region: 'counter', lift: 0.003 }, { prim: 'cuff', width: 0.018, lift: 0.006 },
      { prim: 'toeCap', lift: 0.002, group: 'Midsole' }],
    tones: { Shoes: '#ecebe6', Midsole: '#f6f5f0', Outsole: '#b5814a', Overlay: '#1f4e8c', Counter: '#1f4e8c', Eyestay: '#e4e2dc', Tongue: '#ecebe6', Cuff: '#1f4e8c' } },
  // the runner: a foam midsole with an air pod at the heel, a contrast stripe over it, a rubber outsole; the same cut
  runners: { family: 'sneaker', sock: { height: 'shoe', collar: 0.12, thick: 0.005 },
    sole: { layers: [{ thick: 0.005, welt: 0.004, group: 'Outsole' }, { thick: 0.018, welt: 0.006, group: 'Midsole', pod: { from: 0, to: 0.35 } }, { thick: 0.004, welt: 0.005, group: 'Stripe' }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.003, rise: 0.012 }, { prim: 'panel', region: 'eyestay', lift: 0.004 }, { prim: 'laces', rows: 7 },
      { prim: 'panel', region: 'quarter', lift: 0.003, group: 'Stripe' }, { prim: 'panel', region: 'counter', lift: 0.003 }, { prim: 'toeCap', lift: 0.002, group: 'Outsole' }],
    tones: { Shoes: '#2f3a4a', Midsole: '#f2f1ec', Outsole: '#262626', Stripe: '#e2552d', Air: '#9fd3e6', Counter: '#262626', Eyestay: '#262626', Tongue: '#2f3a4a', Lace: '#f2f1ec' } },
  // ── SPORTS: each a few keys over its kin ──
  // the basketball high-top: the sock over the ankle, a padded collar, a strap round the ankle, a deep cupsole on air
  highTops: { from: 'sneakers', sock: { height: 'boot', shaft: 0.14, thick: 0.006 },
    sole: { layers: [{ thick: 0.005, welt: 0.004, group: 'Outsole' }, { thick: 0.024, welt: 0.006, group: 'Midsole', pod: { from: 0, to: 0.3 } }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.004, rise: 0.018 }, { prim: 'panel', region: 'eyestay', lift: 0.005 }, { prim: 'laces', rows: 8, lift: 0.0065 },
      { prim: 'panel', region: 'quarter', lift: 0.004 }, { prim: 'panel', region: 'counter', lift: 0.004 }, { prim: 'cuff', width: 0.024, lift: 0.008 },
      { prim: 'strap', on: 'shank', at: 0.93, width: 0.024, lift: 0.009, group: 'Overlay' }, { prim: 'toeCap', lift: 0.002, group: 'Midsole' }],
    tones: { Shoes: '#f3f2ee', Overlay: '#b3202a', Counter: '#b3202a', Cuff: '#16161a', Air: '#c6e4ef' } },
  // the skate shoe: a vulcanized sole (a gum outsole under a tall foxing wall), a suede vamp, a side stripe, a padded collar
  skateShoes: { from: 'sneakers', sock: { height: 'shoe', collar: 0.1, thick: 0.006 },
    sole: { layers: [{ thick: 0.004, welt: 0.003, group: 'Outsole' }, { thick: 0.014, welt: 0.003, group: 'Foxing' }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.004, rise: 0.012 }, { prim: 'panel', region: 'vamp', lift: 0.003, group: 'Suede' }, { prim: 'panel', region: 'eyestay', lift: 0.0045, group: 'Suede' },
      { prim: 'laces', rows: 5, lift: 0.006 }, { prim: 'panel', region: 'quarter', lift: 0.003, group: 'Stripe' }, { prim: 'cuff', width: 0.02, lift: 0.007 }, { prim: 'toeCap', lift: 0.002, group: 'Foxing' }],
    tones: { Shoes: '#2b2b2e', Suede: '#45454a', Stripe: '#f2f1ec', Foxing: '#f2f1ec', Outsole: '#b5814a', Cuff: '#2b2b2e', Tongue: '#2b2b2e', Lace: '#f2f1ec' } },
  // the trail runner: a lugged outsole under a firm midsole, a rubber toe guard, a heel counter, overlays
  trailRunners: { from: 'runners', sole: { layers: [{ thick: 0.006, welt: 0.005, group: 'Outsole', lugs: { every: 2, size: 0.006 } }, { thick: 0.016, welt: 0.005, group: 'Midsole' }] },
    tones: { Shoes: '#56604a', Overlay: '#2c3326', Stripe: '#d18a2c', Midsole: '#cfc9b8', Outsole: '#2a2a28', Counter: '#2c3326', Eyestay: '#2c3326', Tongue: '#56604a', Lace: '#d18a2c' } },
  // ── DRESS: a sleek sock, a leather sole on a welt, a stacked heel; the cut does the rest ──
  // the cap-toe oxford: closed lacing (narrow eyestays meeting over a hidden tongue), a cap over the toes, a heel counter
  oxfords: { family: 'dress', sock: { height: 'shoe', collar: 0.2, thick: 0.003 },
    sole: { layers: [{ thick: 0.006, welt: 0.004, group: 'Sole', heel: { to: 0.3, thick: 0.024 } }, { thick: 0.003, welt: 0.005, group: 'Welt' }] },
    adorn: [{ prim: 'panel', region: { along: [0.22, 0.76], around: [0.04, 0.13], sides: 'both' }, lift: 0.0015, group: 'Eyestay' }, { prim: 'laces', rows: 5, lift: 0.0025, w: 0.0018 },
      { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Cap' }],
    tones: { Shoes: '#2a1c16', Eyestay: LEATHER(-0.04), Counter: LEATHER(-0.04), Tongue: LEATHER(-0.08), Cap: LEATHER(-0.12), Saddle: LEATHER(-0.12), Tab: LEATHER(-0.3),
      Broguing: LEATHER(-0.55), Lace: '#151110', Sole: '#3a2a20', Welt: '#4a3628', Heel: '#3a2a20' } },
  // the brogue: the oxford perforated round its cap
  brogues: { from: 'oxfords', adorn: [{ prim: 'panel', region: { along: [0.22, 0.76], around: [0.04, 0.13], sides: 'both' }, lift: 0.0015, group: 'Eyestay' }, { prim: 'laces', rows: 5, lift: 0.0025, w: 0.0018 },
    { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Cap', rivets: 1, stud: { size: 0.0018, group: 'Broguing' } }],
    tones: { Shoes: '#6b3d22' } },
  // the derby: open lacing (the eyestays stitched over the vamp, the tongue showing between them)
  derbies: { from: 'oxfords', adorn: [{ prim: 'panel', region: 'tongue', lift: 0.0012 }, { prim: 'panel', region: 'eyestay', lift: 0.0022 }, { prim: 'laces', rows: 5, lift: 0.0034, w: 0.0018 },
    { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Shoes' }] },
  // the penny loafer: no laces, a saddle strap across the instep, a counter, the heel
  loafers: { from: 'oxfords', sock: { collar: 0.17 }, adorn: [{ prim: 'panel', region: 'saddle', lift: 0.0022, group: 'Saddle' }, { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Shoes' }],
    tones: { Shoes: '#5a2a1c' } },
  // the double monk: two buckled straps across the instep, a cap toe
  monkStraps: { from: 'oxfords', adorn: [{ prim: 'strap', on: 'foot', at: 0.5, width: 0.012, lift: 0.002, buckle: true, group: 'Shoes' }, { prim: 'strap', on: 'foot', at: 0.6, width: 0.012, lift: 0.002, buckle: true, group: 'Shoes' },
    { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Cap' }], tones: { Brass: '#b9b9bd' } },
  // the chelsea boot: a sleek boot, an elastic gusset on each side of the ankle, a pull tab at the back
  chelseaBoots: { from: 'oxfords', sock: { height: 'boot', shaft: 0.24, thick: 0.0035 }, heels: { height: 0.04, toe: 0.009, kind: 'block' },
    adorn: [{ prim: 'panel', on: 'shank', region: { along: [0.78, 0.98], around: [0.38, 0.62], sides: 'both' }, lift: 0.0015, group: 'Elastic' },
      { prim: 'panel', on: 'shank', region: { along: [0.76, 0.86], around: [0.86, 1], sides: 'centre' }, lift: 0.002, rise: 0.016, group: 'Tab' },
      { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Cap' }],
    tones: { Elastic: '#1b1b1d', Tab: '#1b1b1d' } },
  // ── BOOTS, laced and cut as a cobbler cuts them: the quarters up past the ankle wrapping round to the back, the tongue up
  // the shaft standing above its top, the eyestays and the laces on up beside it ──
  // the hiking boot: laced above the ankle, a padded collar, a lugged outsole under a firm midsole, a rubber toe guard
  hikingBoots: { family: 'boot', sock: { height: 'boot', shaft: 0.2, thick: 0.006 },
    sole: { layers: [{ thick: 0.007, welt: 0.006, group: 'Outsole', lugs: { every: 2, size: 0.007 } }, { thick: 0.012, welt: 0.005, group: 'Midsole' }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.004, rise: 0.016 }, { prim: 'panel', region: 'eyestay', lift: 0.005 }, { prim: 'laces', rows: 5, shaftRows: 3, lift: 0.0065 },
      { prim: 'panel', region: 'quarter', lift: 0.0035 }, { prim: 'panel', region: 'counter', lift: 0.0035 }, { prim: 'cuff', width: 0.02, lift: 0.008 },
      { prim: 'toeCap', lift: 0.003, group: 'Outsole' }],
    tones: { Shoes: '#7a6448', Overlay: '#3e3226', Eyestay: '#3e3226', Counter: '#3e3226', Tongue: '#7a6448', Cuff: '#3e3226', Lace: '#b3412a', Midsole: '#cfc6b3', Outsole: '#2a2622' } },
  // the combat boot: a tall shaft laced all the way up, a lugged sole, black leather in its shades
  combatBoots: { from: 'hikingBoots', sock: { shaft: 0.42, thick: 0.005 },
    sole: { layers: [{ thick: 0.008, welt: 0.005, group: 'Outsole', lugs: { every: 2, size: 0.007 } }, { thick: 0.01, welt: 0.004, group: 'Midsole' }] },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.0035, rise: 0.01 }, { prim: 'panel', region: 'eyestay', lift: 0.0045 }, { prim: 'laces', rows: 4, shaftRows: 8, lift: 0.006 },
      { prim: 'panel', region: 'quarter', lift: 0.003 }, { prim: 'panel', region: 'counter', lift: 0.003 }, { prim: 'toeCap', lift: 0.002, group: 'Shoes' }],
    tones: { Shoes: '#1c1c1e', Overlay: LEATHER(0.06), Eyestay: LEATHER(0.1), Counter: LEATHER(0.06), Tongue: LEATHER(0.03), Lace: '#0e0e0f', Midsole: '#1a1a1a', Outsole: '#111112' } },
  // the chukka: a suede ankle boot, two or three eyelets, a crepe sole
  chukkas: { family: 'boot', sock: { height: 'boot', shaft: 0.1, thick: 0.004 }, sole: { thick: 0.013, welt: 0.004 },
    adorn: [{ prim: 'panel', region: 'tongue', lift: 0.002, rise: 0.008 }, { prim: 'panel', region: { along: [0.15, 0.55], around: [0.08, 0.22], sides: 'both', shaft: { along: [0.85, 1] } }, lift: 0.003, group: 'Eyestay' },
      { prim: 'laces', rows: 3, shaftRows: 0, lift: 0.0045, w: 0.0022 }, { prim: 'toeCap', lift: 0.0018, room: 0.01, group: 'Shoes' }],
    tones: { Shoes: '#b08a5c', Eyestay: LEATHER(-0.06), Tongue: LEATHER(-0.04), Lace: '#5a3d22', Sole: '#c8a46a' } },
  // the cowboy boot: a mid-calf shaft with pull tabs and a stitched band, a cuban heel the body stands on, a long toe
  cowboyBoots: { family: 'boot', sock: { height: 'boot', shaft: 0.55, thick: 0.004 }, sole: { welt: 0.004 }, heels: { height: 0.045, toe: 0.01, kind: 'block' },
    adorn: [{ prim: 'panel', on: 'shank', region: { along: [0.45, 0.5], around: [0.4, 0.6], sides: 'both' }, lift: 0.002, rise: 0.022, group: 'Tab' },
      { prim: 'band', on: 'shank', at: 0.62, width: 0.003, lift: 0.0012, group: 'Stitch' },
      { prim: 'panel', region: 'counter', lift: 0.0015 }, { prim: 'toeCap', lift: 0.0018, room: 0.025, group: 'Shoes' }],
    tones: { Shoes: '#7b4a2a', Tab: LEATHER(-0.25), Counter: LEATHER(-0.1), Stitch: LEATHER(0.18), Heel: LEATHER(-0.3), Sole: '#3a2516' } },
  // the riding boot: a tall plain shaft to below the knee, a low heel
  ridingBoots: { family: 'boot', sock: { height: 'boot', shaft: 0.78, thick: 0.0035 }, sole: { welt: 0.003 }, heels: { height: 0.03, toe: 0.008, kind: 'block' },
    adorn: [{ prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0016, room: 0.012, group: 'Shoes' }],
    tones: { Shoes: '#161414', Counter: LEATHER(0.04), Heel: LEATHER(0.05), Sole: '#2a2220' } },
  // ── MILITARY: the soldier's boots, each a tradition's (worn from an outfit card by name: `feet: 'jungleBoots'`) ──
  // the jungle boot (Vietnam, the 1960s): a black leather foot, its vamp and toe, its sides to the ankle and its heel
  // counter, under a tall olive canvas shaft laced to the top; the deep lugged sole of the panama tread
  jungleBoots: { family: 'military', sock: { height: 'boot', shaft: 0.45, thick: 0.004 },
    sole: { layers: [{ thick: 0.009, welt: 0.005, group: 'Outsole', lugs: { every: 2, size: 0.008 } }, { thick: 0.008, welt: 0.004, group: 'Midsole' }] },
    adorn: [{ prim: 'panel', region: 'vamp', lift: 0.0035, group: 'Hide' }, { prim: 'panel', region: { along: [0.3, 0.86], around: [0.3, 0.75], sides: 'both' }, lift: 0.0034, group: 'Hide' },
      { prim: 'panel', region: 'counter', lift: 0.0036, group: 'Hide' }, { prim: 'panel', region: 'tongue', lift: 0.003, rise: 0.008 },
      { prim: 'panel', region: 'eyestay', lift: 0.004, group: 'Hide' }, { prim: 'laces', rows: 4, shaftRows: 9, lift: 0.0055 }, { prim: 'toeCap', lift: 0.0032, group: 'Hide' }],
    tones: { Shoes: '#4d5232', Hide: '#161514', Tongue: '#4d5232', Lace: '#14140f', Midsole: '#1a1a1a', Outsole: '#121212' } },
  // the desert combat boot: the combat boot in rough tan suede, a tan sole
  desertBoots: { from: 'combatBoots', family: 'military',
    tones: { Shoes: '#a8865a', Overlay: LEATHER(-0.06), Eyestay: LEATHER(-0.1), Counter: LEATHER(-0.06), Tongue: LEATHER(0.04), Lace: '#7a5e3c', Midsole: '#9a7a50', Outsole: '#6e5536' } },
  // the paratrooper's jump boot: a shorter combat boot in polished brown, laced to its top, a capped toe
  jumpBoots: { from: 'combatBoots', family: 'military', sock: { shaft: 0.36 },
    tones: { Shoes: '#4e2c1a', Overlay: LEATHER(0.05), Eyestay: LEATHER(0.08), Counter: LEATHER(0.05), Tongue: LEATHER(0.03), Lace: '#24150c', Midsole: '#2a1a12', Outsole: '#1c120c' } },
  // the jackboot (the marching boot of the world wars): a tall plain black shaft to below the knee, no laces, a low heel
  // and a hobnailed sole
  jackboots: { family: 'military', sock: { height: 'boot', shaft: 0.66, thick: 0.0055 }, heels: { height: 0.025, toe: 0.012, kind: 'block' },
    sole: { layers: [{ thick: 0.013, welt: 0.004, lugs: { every: 2, size: 0.0035, group: 'Steel' } }] },
    adorn: [{ prim: 'panel', region: 'counter', lift: 0.0015 }, { prim: 'toeCap', lift: 0.0016, room: 0.01, group: 'Shoes' }],
    tones: { Shoes: '#141212', Counter: LEATHER(0.05), Heel: LEATHER(0.03), Sole: '#1e1a18', Steel: '#7a7a7e' } },
  // the kirza boot (the Soviet soldier's sapogi): the jackboot's cut a little shorter and wider at its top, in the
  // pebbled pressed leather it was named for, its brown-black
  kirzaBoots: { from: 'jackboots', sock: { shaft: 0.6, thick: 0.0065 }, tones: { Shoes: '#221d18', Counter: LEATHER(0.08), Heel: LEATHER(0.05) } },
  // the ankle boot and PUTTEES (the British and the Japanese infantry of the world wars): a hobnailed ankle boot laced
  // low, a long band of wool wound round the shin from its top to below the knee, tied off with a tape
  putteeBoots: { family: 'military', sock: { height: 'boot', shaft: 0.13, thick: 0.005 },
    sole: { layers: [{ thick: 0.012, welt: 0.004, lugs: { every: 2, size: 0.003, group: 'Steel' } }] },
    adorn: [{ prim: 'panel', region: 'counter', lift: 0.002 }, { prim: 'panel', region: 'eyestay', lift: 0.0035 }, { prim: 'laces', rows: 5, shaftRows: 2, lift: 0.005 },
      { prim: 'toeCap', lift: 0.002, group: 'Shoes' }, { prim: 'wrap', from: 0.25, to: 0.88, turns: 9, w: 0.05, lift: 0.004, group: 'Puttee' },
      { prim: 'strap', on: 'shank', at: 0.25, width: 0.006, lift: 0.007, group: 'Tape' }],
    tones: { Shoes: '#3a2416', Counter: LEATHER(-0.1), Eyestay: LEATHER(-0.08), Lace: '#1e140c', Puttee: '#7a6c48', Tape: '#6a5c3a', Steel: '#7a7a7e', Sole: '#2a1c12' } },
  // ── HISTORIC, FANTASY, DRAMA: the cobbler's pieces and fantasy.js's ──
  // the poulaine (crakow): a medieval shoe whose toe runs on far past the foot to a point
  poulaines: { family: 'historic', sock: { height: 'shoe', collar: 0.14, thick: 0.003 }, sole: { thick: 0.004, welt: 0.002 },
    adorn: [{ prim: 'toeCap', lift: 0.0012, group: 'Shoes' }, { prim: 'toePoint', length: 0.12, curl: 12, taper: 0.06 }, { prim: 'strap', on: 'foot', at: 0.35, width: 0.008, lift: 0.0015, buckle: true }],
    tones: { Shoes: '#5a1a22', Strap: LEATHER(-0.3) } },
  // the jester's: the toe curled right over to a bell
  jesterShoes: { family: 'fantasy', sock: { height: 'shoe', collar: 0.14, thick: 0.004 }, sole: { thick: 0.004, welt: 0.002 },
    adorn: [{ prim: 'toeCap', lift: 0.0015, group: 'Shoes' }, { prim: 'toePoint', length: 0.08, curl: 150, taper: 0.2, bell: true }, { prim: 'cuff', width: 0.016, lift: 0.004 }],
    tones: { Shoes: '#2f7d32', Cuff: '#c8302e', Bell: '#e3c040' } },
  // the Persian slipper: a low slipper, its toe turned up, a stone on the instep
  persianSlippers: { family: 'historic', sock: { height: 'shoe', collar: 0.3, thick: 0.003 }, sole: { thick: 0.005, welt: 0.002 },
    adorn: [{ prim: 'toeCap', lift: 0.0012, group: 'Shoes' }, { prim: 'toePoint', length: 0.045, curl: 75, taper: 0.12 }, { prim: 'jewel', at: 'instep', size: 0.011 }, { prim: 'band', on: 'foot', at: 0.35, width: 0.005, lift: 0.0015 }],
    tones: { Shoes: '#6e1f5a', Gem: '#2bb3a0', Gilt: '#d8b44a' } },
  // the Roman caliga: an open sandal, hobnailed, laced in a lattice up the ankle
  romanCaligae: { family: 'historic', sock: false, sole: { layers: [{ thick: 0.012, welt: 0.004, lugs: { every: 2, size: 0.003, group: 'Steel' } }] },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.65, width: 0.022 }, { prim: 'strap', on: 'foot', at: 0.4, width: 0.018 }, { prim: 'wrap', from: 0.7, to: 1, turns: 2, cross: true, w: 0.012, group: 'Strap' }],
    tones: { Sole: '#5b3a22', Strap: '#7a4f2c' } },
  // the gladiator sandal: straps crossed up the shin to below the knee
  gladiatorSandals: { family: 'historic', sock: false, sole: { thick: 0.01, welt: 0.003 },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.6, width: 0.016 }, { prim: 'wrap', from: 0.15, to: 1, turns: 5, cross: true, w: 0.01, group: 'Strap' }],
    tones: { Sole: '#6b4a2a', Strap: '#8a5a32' } },
  // the Viking's: a low turnshoe, wool wrapped round the shin above it (winingas)
  vikingWraps: { family: 'historic', sock: { height: 'boot', shaft: 0.14, thick: 0.005 }, sole: { thick: 0.005, welt: 0.002 },
    adorn: [{ prim: 'wrap', from: 0.35, to: 0.86, turns: 6, w: 0.032, lift: 0.004 }, { prim: 'strap', on: 'shank', at: 0.33, width: 0.008, lift: 0.006, group: 'Strap' }],
    tones: { Shoes: '#5a4330', Wrap: '#8d7a5a', Strap: '#3a2a1c' } },
  // the cavalier's: a tall riding boot under a bucket top, spurred
  cavalierBoots: { from: 'ridingBoots', family: 'historic', sock: { shaft: 0.82, thick: 0.004 },
    adornPlus: [{ prim: 'flare', height: 0.09, spread: 1.7 }, { prim: 'spur' }], tones: { Shoes: '#3a2617', Steel: '#b9b9bd' } },
  // the Victorian button boot: a buttoned side, a cap toe, a louis heel the body stands on
  buttonBoots: { family: 'historic', sock: { height: 'boot', shaft: 0.36, thick: 0.0035 }, sole: { welt: 0.002 }, heels: { height: 0.05, toe: 0.007, kind: 'kitten' },
    adorn: [{ prim: 'buttons', count: 8, side: 'lateral', around: 0.3, size: 0.006 }, { prim: 'panel', region: 'counter', lift: 0.001 }, { prim: 'toeCap', lift: 0.0015, room: 0.014, group: 'Cap' }],
    tones: { Shoes: '#1a1a1a', Cap: LEATHER(0.1), Counter: LEATHER(0.06), Button: '#d8d2c0', Heel: LEATHER(0.08) } },
  // the geta: a wooden board on two teeth, the foot raised level on it, a thong strap
  geta: { family: 'historic', sock: false, sole: { welt: 0.006, group: 'Wood' }, heels: { height: 0.065, toe: 0.065, shank: 0.018, kind: 'teeth', group: 'Wood' },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.75, width: 0.016, lift: 0.003 }], tones: { Wood: '#b88a55', Strap: '#1f1f2a' } },
  // the elf's: a soft tall boot, its toe drawn to a point and lifted, a vine wound up the shaft
  elvenBoots: { family: 'fantasy', sock: { height: 'boot', shaft: 0.6, thick: 0.004 }, sole: { thick: 0.004, welt: 0.002 },
    adorn: [{ prim: 'toeCap', lift: 0.0015, group: 'Shoes' }, { prim: 'toePoint', length: 0.05, curl: 30, taper: 0.1 }, { prim: 'wrap', from: 0.45, to: 0.95, turns: 3, w: 0.006, lift: 0.0025, group: 'Gilt' }, { prim: 'cuff', width: 0.022, lift: 0.004 }],
    tones: { Shoes: '#4a6b3a', Cuff: LEATHER(-0.25), Gilt: '#c9b37a' } },
  // Hermes' talaria: a sandal winged at the ankle
  talaria: { family: 'fantasy', sock: false, sole: { thick: 0.01, welt: 0.003 },
    adorn: [{ prim: 'strap', on: 'foot', at: 0.65, width: 0.018, buckle: true }, { prim: 'wrap', from: 0.8, to: 1, turns: 1.5, cross: true, w: 0.01, group: 'Strap' }, { prim: 'wings', feathers: 5, span: 0.08 }],
    tones: { Sole: '#a8843f', Strap: '#a8843f', Wing: '#f4f1e6' } },
  // the fur boot: a soft tall boot, a shaggy ruff round its top, a buckled strap at the ankle
  furBoots: { family: 'fantasy', sock: { height: 'boot', shaft: 0.42, thick: 0.007 }, sole: { thick: 0.012, welt: 0.004 },
    adorn: [{ prim: 'fur', length: 0.034, droop: 0.9 }, { prim: 'strap', on: 'shank', at: 0.88, width: 0.016, lift: 0.004, buckle: true }, { prim: 'toeCap', lift: 0.002, group: 'Shoes' }],
    tones: { Shoes: '#4a3524', Fur: '#cdbb9a', Strap: LEATHER(-0.3) } },
  // the barbarian's: the Viking turnshoe and wraps, a ruff of fur round the shin over them
  barbarianBoots: { from: 'vikingWraps', family: 'fantasy', adornPlus: [{ prim: 'fur', on: 'shank', at: 0.34, length: 0.04, droop: 1, seed: 3 }], tones: { Fur: '#6b5b4a' } },
  // ── HEELS: the body stands in them ──
  // the pump: a low-cut sleek shoe on a stiletto
  pumps: { family: 'dress', sock: { height: 'shoe', collar: 0.22, thick: 0.0025 }, sole: { welt: 0.002 }, heels: { height: 0.085, toe: 0.006, kind: 'stiletto' },
    adorn: [{ prim: 'panel', region: 'counter', lift: 0.001 }, { prim: 'toeCap', lift: 0.0015, room: 0.012, group: 'Shoes' }],
    tones: { Shoes: '#141414', Counter: LEATHER(-0.05), Heel: LEATHER(-0.1), Sole: '#3a1d1d' } },
  // the block heel, lower and steadier; the wedge, the sole filled down under the arch; the platform, the toes on a thick sole
  blockHeels: { from: 'pumps', heels: { height: 0.06, toe: 0.008, kind: 'block' }, tones: { Shoes: '#7a2430' } },
  wedges: { from: 'pumps', heels: { height: 0.07, toe: 0.012, kind: 'wedge' }, tones: { Shoes: '#c9a27a', Sole: '#e9dfcf' } },
  platforms: { from: 'pumps', heels: { height: 0.12, toe: 0.035, kind: 'block' }, tones: { Shoes: '#1d1d22' } },
});
for (const c of Object.values(FOOTWEAR)) Object.freeze(c);
/** a tone of the leather: the shoes' own colour, darkened (−) or lightened (+) */
function LEATHER(shade) { return Object.freeze({ of: 'Shoes', shade }); }
/** COLOURWAYS: a skin over any card's tones, by group (a card's groups it does not name keep their own) */
const all = (c, groups) => Object.fromEntries(groups.split(' ').map((g) => [g, c]));
export const SKINS = Object.freeze({
  tripleBlack: Object.freeze(all('#18181a', 'Shoes Overlay Counter Eyestay Tongue Cuff Midsole Outsole Stripe Foxing Suede Lace Cap Saddle Tab Elastic Sole Welt Heel Strap')),
  tripleWhite: Object.freeze(all('#f3f2ee', 'Shoes Overlay Counter Eyestay Tongue Cuff Midsole Outsole Stripe Foxing Suede Lace')),
  volt: Object.freeze({ Shoes: '#1c1d20', Overlay: '#d7f23a', Counter: '#d7f23a', Stripe: '#d7f23a', Eyestay: '#1c1d20', Lace: '#d7f23a', Midsole: '#f2f1ec', Outsole: '#1c1d20', Cuff: '#1c1d20' }),
  navy: Object.freeze({ Shoes: '#1d2a44', Overlay: '#f2f1ec', Counter: '#f2f1ec', Stripe: '#c8402a', Eyestay: '#1d2a44', Lace: '#f2f1ec', Midsole: '#f2f1ec', Cuff: '#1d2a44' }),
  oxblood: Object.freeze({ Shoes: '#4a1418' }),
  tan: Object.freeze({ Shoes: '#a0643a' }),
});
/** the colours of the groups footwear adds, for a palette that names none (a card's own tones over these) */
export const FOOTWEAR_TONES = Object.freeze({ Sole: '#2a2420', Strap: '#4b3324', Brass: '#a8843f', Steel: '#8d9299', Gilt: '#c9a646', Cuff: '#4b3324',
  Midsole: '#f2f1ec', Outsole: '#2b2b2b', Stripe: '#c8402a', Air: '#a8d8e8', Tongue: '#d9d6cf', Eyestay: '#c9c5bd', Overlay: '#b9b4ab', Counter: '#b9b4ab', Lace: '#f4f3ef',
  Foxing: '#f2f1ec', Suede: '#55555a', Stitch: '#e8d9b5', Wrap: '#8d7a5a', Fur: '#bfae8f', Button: '#d8d2c0', Wing: '#f4f1e6', Gem: '#2b8fb3', Bell: '#e3c040', Wood: '#b88a55', Heel: '#3a2a20', Welt: '#4a3628', Cap: '#2a1c16', Broguing: '#1a120c', Saddle: '#4c2216', Elastic: '#1b1b1d', Tab: '#1b1b1d' });
