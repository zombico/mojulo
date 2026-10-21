// footwear/styles — the seeded footwear CARDS. PURE DATA: every card is plain JSON, so an agent can read one, copy it and
// author its own inline. A new look is a new card, not code (principles.js carries the laws).
//
// A card:
//   from    a card it extends (a word or a card): its sock merged, its sole, adorn and family replaced where given,
//           `adornPlus` appended to its adornment, its tones merged. So a variety is a few keys over its kin
//   skin    a COLOURWAY (SKINS, or { <group>: '#hex' }) over the card's tones: any card in any colours
//   family  what kind of footwear it is (expand.js FOOTWEAR_FAMILIES: shoe, boot, sandal, sneaker, dress)
//   sock    { height: 'shoe' | 'boot', collar? (a share of the foot, a shoe's), shaft? (a share of the shank from the
//           ankle, a boot's), thick? (m, how far the leather stands off the foot; 0.004) }, or false: none (a sandal)
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
//             laces   { rows?, lift?, w? } criss-cross between the eyestays
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
    adorn: [{ prim: 'toeCap', lift: 0.004, rivets: 3 }, { prim: 'band', on: 'foot', at: 0.1, width: 0.008 }] },
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
  chelseaBoots: { from: 'oxfords', sock: { height: 'boot', shaft: 0.24, thick: 0.0035 },
    adorn: [{ prim: 'panel', on: 'shank', region: { along: [0.78, 0.98], around: [0.38, 0.62], sides: 'both' }, lift: 0.0015, group: 'Elastic' },
      { prim: 'panel', on: 'shank', region: { along: [0.76, 0.86], around: [0.86, 1], sides: 'centre' }, lift: 0.002, rise: 0.016, group: 'Tab' },
      { prim: 'panel', region: 'counter', lift: 0.0012 }, { prim: 'toeCap', lift: 0.0018, group: 'Cap' }],
    tones: { Elastic: '#1b1b1d', Tab: '#1b1b1d' } },
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
  Foxing: '#f2f1ec', Suede: '#55555a', Heel: '#3a2a20', Welt: '#4a3628', Cap: '#2a1c16', Broguing: '#1a120c', Saddle: '#4c2216', Elastic: '#1b1b1d', Tab: '#1b1b1d' });
