// footwear/styles — the seeded footwear CARDS. PURE DATA: every card is plain JSON, so an agent can read one, copy it and
// author its own inline. A new look is a new card, not code (principles.js carries the laws).
//
// A card:
//   family  what kind of footwear it is (expand.js FOOTWEAR_FAMILIES: shoe, boot, sandal, sneaker)
//   sock    { height: 'shoe' | 'boot', collar? (a share of the foot, a shoe's), shaft? (a share of the shank from the
//           ankle, a boot's), thick? (m, how far the leather stands off the foot; 0.004) }, or false: none (a sandal)
//   sole    { thick (m), welt (m) } (one layer), or { layers: [{ thick, welt?, group?, pod? }] } stacked from the floor up
//           (an outsole, a midsole, a stripe …), `pod` a window of another group at the heel (expand.js SOLE_PATTERNS)
//   adorn   [{ prim, … }] laid in order (expand.js ADORN_PRIMS names each one's keys):
//             strap   { on: 'foot' | 'shank', at (share), width? (m), buckle? }
//             band    { on, at, width? } a thin ring of gilding
//             cuff    { width?, lift? } a turned band at the sock's collar
//             toeCap  { lift?, rivets? (every n-th point of its back edge) } the half teacup: a quarter egg, toe base to tip
//             panel   { region (cobbler.js COBBLER_REGIONS, or { along, around, sides }), on?, lift?, thick?, rise? } a
//                     pattern piece on the sock, a matching pair where the region has two sides
//             laces   { rows?, lift?, w? } criss-cross between the eyestays
//           any of them `group` (its colour's name) over its own
//   tones   { <group>: '#hex' } over FOOTWEAR_TONES, for the groups the card uses
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
});
for (const c of Object.values(FOOTWEAR)) Object.freeze(c);
/** the colours of the groups footwear adds, for a palette that names none (a card's own tones over these) */
export const FOOTWEAR_TONES = Object.freeze({ Sole: '#2a2420', Strap: '#4b3324', Brass: '#a8843f', Steel: '#8d9299', Gilt: '#c9a646', Cuff: '#4b3324',
  Midsole: '#f2f1ec', Outsole: '#2b2b2b', Stripe: '#c8402a', Air: '#a8d8e8', Tongue: '#d9d6cf', Eyestay: '#c9c5bd', Overlay: '#b9b4ab', Counter: '#b9b4ab', Lace: '#f4f3ef' });
