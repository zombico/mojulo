// handwear/styles — HANDWEAR CARDS: pure data, read by expand.js under principles.js. A new glove is a card, not code.
//
// A card:
//   from    a card it extends (its glove merged, its adornment and family replaced where given, `adornPlus` appended,
//           its tones merged)
//   skin    a COLOURWAY (SKINS, or { <group>: '#hex' }) over the card's tones: any card in any colours
//   family  what kind of handwear it is (expand.js HANDWEAR_FAMILIES)
//   glove   { cuff? (a share of the forearm from the wrist; 0.06), thick? (m, how far the leather stands off the hand;
//           0.0018), fingers? / thumb? (full | half: cut at the middle joint | none: at the knuckle), group? }, or false:
//           the adornment on the bare hand
//   adorn   [{ prim, … }] the adornment, in order (expand.js ADORN_PRIMS)
//   tones   { <group>: '#hex' | { of: <group>, shade: −1 … 1 } } over HANDWEAR_TONES, for the groups the card uses; a tone
//           OF another group is that group's colour darkened (−) or lightened (+), so recolouring the leather (`Gloves`)
//           carries the pieces cut from it
/** a tone of the glove's leather, darkened (−) or lightened (+) */
const OF = (shade) => ({ of: 'Gloves', shade });
export const HANDWEAR = Object.freeze({
  // ── GLOVES ──
  gloves: { family: 'glove', glove: { cuff: 0.06, thick: 0.0018 }, tones: { Gloves: '#5a3a26' } },
  // the undersuit's glove, close and thin, at the wrist (a plated suit's hands: plating/ `hands`)
  suitGloves: { family: 'glove', glove: { cuff: 0, thick: 0.0012 } },
  fingerless: { from: 'gloves', glove: { fingers: 'half' } },
  mitts: { from: 'gloves', glove: { fingers: 'none', cuff: 0.12 } },
  // ── DRESS ──
  // the dress glove: thin black leather, the three points down the back
  dressGloves: { family: 'dress', glove: { cuff: 0.07, thick: 0.0012 }, adorn: [{ prim: 'points' }], tones: { Gloves: '#141416', Stitch: OF(0.18) } },
  // the opera glove: satin to the elbow
  operaGloves: { family: 'dress', glove: { cuff: 0.95, thick: 0.001 }, tones: { Gloves: '#f2efe8' } },
  // the driving glove: tan, a darker back, a snap strap at the wrist
  drivingGloves: { family: 'dress', glove: { cuff: 0.02, thick: 0.0014 }, adorn: [{ prim: 'panel', region: 'back' }, { prim: 'panel', region: 'knuckles', lift: 0.0014 }, { prim: 'strap', width: 0.014, lift: 0.0018, buckle: false, group: 'Overlay' }],
    tones: { Gloves: '#a0643a', Overlay: OF(-0.25) } },
  // the kid glove: fine pale leather, the points in a darker thread, a button at the wrist
  kidGloves: { from: 'dressGloves', glove: { thick: 0.001 }, adornPlus: [{ prim: 'buttons', size: 0.006 }], tones: { Gloves: '#cdb592', Stitch: OF(-0.3), Button: '#efe9dc' } },
  // the walking glove: peccary tan, the points stitched in a pale thread, a button
  walkingGloves: { from: 'dressGloves', glove: { thick: 0.0016 }, adornPlus: [{ prim: 'buttons', size: 0.007 }], tones: { Gloves: '#9a6a3c', Stitch: OF(0.4), Button: OF(-0.35) } },
  // the winter glove: the dress glove lined, its lining turned out at the cuff
  winterGloves: { from: 'dressGloves', glove: { cuff: 0.12, thick: 0.0024 }, adornPlus: [{ prim: 'cuff', width: 0.012, lift: 0.0015 }], tones: { Gloves: '#2a1c16', Cuff: '#7a6a5a' } },
  // the evening glove: wrist-length satin, a pearl button
  eveningGloves: { family: 'dress', glove: { cuff: 0.04, thick: 0.001 }, adorn: [{ prim: 'buttons', size: 0.006 }], tones: { Gloves: '#141416', Button: '#f4efe4' } },
  // the mousquetaire: the opera glove buttoned at the wrist's opening up the inner forearm
  mousquetaireGloves: { from: 'operaGloves', adornPlus: [{ prim: 'buttons', count: 3, size: 0.005 }], tones: { Button: '#d6ccb6' } },
  // the bride's: ivory satin, the fingers open at the middle joint, a pearl on the middle finger
  bridalGloves: { from: 'operaGloves', glove: { cuff: 0.6, fingers: 'half', thumb: 'half' }, adornPlus: [{ prim: 'rings', on: ['middle'], at: 0.36, width: 0.003, gem: { size: 0.005, group: 'Pearl' }, group: 'Gloves' }],
    tones: { Gloves: '#f4efe4', Pearl: '#e6dac2' } },
  // the ceremonial glove: white cotton, white points, a button
  ceremonialGloves: { from: 'dressGloves', glove: { cuff: 0.08, thick: 0.0014 }, adornPlus: [{ prim: 'buttons', size: 0.006 }], tones: { Gloves: '#f6f5f1', Stitch: OF(-0.08), Button: '#f6f5f1' } },
  // the driving glove perforated over the backs of the fingers
  perforatedDrivers: { from: 'drivingGloves', adornPlus: [{ prim: 'perf', region: 'fingerBacks', rows: 3, cols: 2 }], tones: { Perf: OF(-0.6) } },
  // ── WORK ──
  // the work glove: suede, a leather palm and finger pads, a knit cuff
  workGloves: { family: 'work', glove: { cuff: 0.22, thick: 0.0028 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0015 }, { prim: 'panel', region: 'fingerPads', lift: 0.0013 }, { prim: 'cuff', width: 0.035, lift: 0.002 }],
    tones: { Gloves: '#b8935e', Overlay: OF(-0.35), Cuff: '#2f5d8a' } },
  // the welder's: thick, a long cuff flaring a little
  weldingGloves: { family: 'work', glove: { cuff: 0.32, thick: 0.004 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0018 }, { prim: 'flare', height: 0.08, spread: 1.3, group: 'Gloves' }],
    tones: { Gloves: '#b07a45', Overlay: OF(-0.2) } },
  // the gardener's: cotton, a rubbered palm, a coloured cuff
  gardenGloves: { family: 'work', glove: { cuff: 0.2, thick: 0.0022 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0014 }, { prim: 'panel', region: 'fingerPads', lift: 0.0012 }, { prim: 'cuff', width: 0.03 }],
    tones: { Gloves: '#ddd3b5', Overlay: '#4f8a3a', Cuff: '#4f8a3a' } },
  // ── SPORT ──
  // the rider's: black, a hard knuckle guard, a palm, a strap at the wrist
  bikerGloves: { family: 'sport', glove: { cuff: 0.08, thick: 0.0022 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0014 }, { prim: 'knuckles' }, { prim: 'strap', width: 0.022, lift: 0.0025, buckle: false, group: 'Overlay' }],
    tones: { Gloves: '#18181a', Overlay: OF(0.12), Guard: '#2c2e33' } },
  // the cyclist's: fingerless, a padded heel, a bright back, a strap
  cyclingGloves: { family: 'sport', glove: { cuff: 0.02, thick: 0.0016, fingers: 'half', thumb: 'half' }, adorn: [{ prim: 'panel', region: 'back', lift: 0.0013 }, { prim: 'panel', region: 'heel', lift: 0.0028, group: 'Pad' }, { prim: 'strap', width: 0.02, lift: 0.002, buckle: false, group: 'Gloves' }],
    tones: { Gloves: '#1c1d20', Overlay: '#d8372a', Pad: '#2a2b2e' } },
  // the goalkeeper's: thick, a latex palm and pads, the fingers' backs ribbed, a wide strap
  goalkeeperGloves: { family: 'sport', glove: { cuff: 0.06, thick: 0.004 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.003, group: 'Latex' }, { prim: 'panel', region: 'fingerPads', lift: 0.0028, group: 'Latex' }, { prim: 'panel', region: 'fingerBacks', lift: 0.0018 }, { prim: 'strap', width: 0.04, lift: 0.003, buckle: false }],
    tones: { Gloves: '#1b1c20', Overlay: '#d7f23a', Strap: '#d7f23a', Latex: '#f2f1ec' } },
  // the fighter's: fingerless, a padded knuckle, a wide strap
  fightGloves: { family: 'sport', glove: { cuff: 0.03, thick: 0.002, fingers: 'half', thumb: 'half' }, adorn: [{ prim: 'panel', region: 'knuckles', lift: 0.007, thick: 0.008, group: 'Pad' }, { prim: 'panel', region: 'back', lift: 0.004, thick: 0.005, group: 'Pad' }, { prim: 'strap', width: 0.035, lift: 0.003 }],
    tones: { Gloves: '#1b1b1d', Pad: '#8a1c22', Strap: '#1b1b1d' } },
  // the skier's: puffed, a long cuff strapped up the forearm
  skiGloves: { family: 'sport', glove: { cuff: 0.22, thick: 0.006 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.002 }, { prim: 'strap', at: 0.16, width: 0.02, lift: 0.004, buckle: true }],
    tones: { Gloves: '#2a3b5c', Overlay: '#1b1c20', Strap: '#1b1c20' } },
  // the batter's: thin white leather, a palm, the fingers' backs in a colour, a wide strap with a snap
  battingGloves: { family: 'sport', glove: { cuff: 0.02, thick: 0.0012 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0012, group: 'Pad' }, { prim: 'panel', region: 'fingerBacks', lift: 0.0011 }, { prim: 'panel', region: 'back', lift: 0.001 }, { prim: 'strap', width: 0.03, lift: 0.0025, buckle: false }],
    tones: { Gloves: '#f2f1ec', Overlay: '#1d2a44', Strap: '#1d2a44', Pad: '#d9d5cb' } },
  // the golfer's: fine white leather, perforated over the fingers, a tab strap
  golfGloves: { family: 'sport', glove: { cuff: 0.02, thick: 0.001 }, adorn: [{ prim: 'perf', region: 'fingerBacks', rows: 3, cols: 2 }, { prim: 'perf', region: 'back', rows: 3, cols: 4 }, { prim: 'strap', width: 0.016, lift: 0.0018, buckle: false }],
    tones: { Gloves: '#f4f3ef', Perf: OF(-0.3), Strap: '#1b1c20' } },
  // the lifter's: fingerless, a padded palm, a wide wrap round the wrist
  liftingGloves: { family: 'sport', glove: { cuff: 0.03, thick: 0.0018, fingers: 'half', thumb: 'half' }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0035, thick: 0.004, group: 'Pad' }, { prim: 'strap', width: 0.045, lift: 0.0035, buckle: false }],
    tones: { Gloves: '#1b1b1d', Pad: '#3a3b3f', Strap: '#c8402a' } },
  // the receiver's: a tacky palm and pads, the fingers' backs in a colour, a strap
  receiverGloves: { family: 'sport', glove: { cuff: 0.03, thick: 0.0016 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0016, group: 'Latex' }, { prim: 'panel', region: 'fingerPads', lift: 0.0015, group: 'Latex' }, { prim: 'panel', region: 'fingerBacks', lift: 0.0012 }, { prim: 'strap', width: 0.025, lift: 0.0022, buckle: false }],
    tones: { Gloves: '#f2f1ec', Overlay: '#c8402a', Strap: '#c8402a', Latex: '#c9c9c4' } },
  // the racing driver's: a snug short gauntlet, soft knuckle pads, a palm, a strap
  racingGloves: { family: 'sport', glove: { cuff: 0.18, thick: 0.0016 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0013 }, { prim: 'knuckles', lift: 0.0026, group: 'Pad' }, { prim: 'strap', width: 0.018, lift: 0.002, buckle: false }],
    tones: { Gloves: '#c8402a', Overlay: '#1b1c20', Pad: '#1b1c20', Strap: '#1b1c20' } },
  // the hockey player's: thick, a long flared cuff, padded rolls down the fingers, a knuckle pad
  hockeyGloves: { family: 'sport', glove: { cuff: 0.32, thick: 0.007 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0015 }, { prim: 'knuckles', lift: 0.006, group: 'Pad' }, { prim: 'lames', lift: 0.004, group: 'Pad' }, { prim: 'flare', height: 0.06, spread: 1.2, group: 'Gloves' }],
    tones: { Gloves: '#1d2a44', Overlay: '#1b1c20', Pad: '#c8402a' } },
  // the tactical glove: olive, a hard knuckle guard, padded fingers, a palm, a strap
  tacticalGloves: { family: 'sport', glove: { cuff: 0.06, thick: 0.002 }, adorn: [{ prim: 'panel', region: 'palm', lift: 0.0014 }, { prim: 'panel', region: 'fingerBacks', lift: 0.0018, group: 'Pad' }, { prim: 'knuckles' }, { prim: 'strap', width: 0.022, lift: 0.0025, buckle: false }],
    tones: { Gloves: '#3d4232', Overlay: OF(-0.3), Pad: OF(-0.18), Guard: '#26272a', Strap: OF(-0.3) } },
  // the boxer's: a thick padded glove, the fingers lost in it, a wide band at the wrist (a puffed glove, not yet the
  // rounded fist a boxing glove closes into)
  boxingGloves: { family: 'sport', glove: { cuff: 0.26, thick: 0.012 }, adorn: [{ prim: 'strap', at: 0.12, width: 0.05, lift: 0.004 }], tones: { Gloves: '#b3141b', Strap: '#f2f1ec' } },
  // hand wraps: no glove, a strip wound over the palm and the wrist, crossed
  handWraps: { family: 'sport', glove: false, adorn: [{ prim: 'wrap', turns: 2.5, cross: true, w: 0.016 }], tones: { Wrap: '#efe9dc' } },
  // ── HISTORIC ──
  // the cavalier's: a flared gauntlet cuff embroidered in gilt, a gilt band at the wrist
  cavalierGloves: { family: 'historic', glove: { cuff: 0.18, thick: 0.002 }, adorn: [{ prim: 'flare', height: 0.09, spread: 1.8, group: 'Cuff' }, { prim: 'strap', width: 0.008, lift: 0.0018, group: 'Gilt' }, { prim: 'jewel', at: 'back', size: 0.01, group: 'Gilt' }],
    tones: { Gloves: '#c9a77a', Cuff: OF(-0.12), Gilt: '#c9a646' } },
  // the falconer's: a heavy glove, a long cuff buckled up the forearm
  falconryGlove: { family: 'historic', glove: { cuff: 0.42, thick: 0.0045 }, adorn: [{ prim: 'panel', region: 'back', lift: 0.002 }, { prim: 'strap', at: 0.3, width: 0.02, lift: 0.004, buckle: true }, { prim: 'flare', height: 0.1, spread: 1.3, group: 'Gloves' }],
    tones: { Gloves: '#6b4528', Overlay: OF(-0.2), Strap: OF(-0.4) } },
  // the knight's: a mail glove under steel: lames down the digits, a back plate, a knuckle bar, a flared steel cuff
  knightGauntlets: { family: 'gauntlet', glove: { cuff: 0.2, thick: 0.0025, group: 'Mail' }, adorn: [{ prim: 'panel', region: 'back', lift: 0.004, thick: 0.004, group: 'Steel' }, { prim: 'knuckles', lift: 0.005, group: 'Steel' }, { prim: 'lames' }, { prim: 'flare', height: 0.08, spread: 1.6, group: 'Steel' }],
    tones: { Mail: '#6d6f73', Steel: '#a9adb3' } },
  // the bishop's: red silk, a jewel on the back, a gilt band, a ring
  bishopGloves: { family: 'historic', glove: { cuff: 0.18, thick: 0.0012 }, adorn: [{ prim: 'jewel', at: 'back', size: 0.016 }, { prim: 'cuff', width: 0.012, group: 'Gilt' }, { prim: 'rings', on: ['ring'], gem: true }],
    tones: { Gloves: '#8a1c2b', Gilt: '#c9a646', Gem: '#2b8fb3' } },
  // ── FANTASY ──
  // the beast's: black, claws from every digit
  clawGloves: { family: 'fantasy', glove: { cuff: 0.08, thick: 0.0018 }, adorn: [{ prim: 'claws', length: 0.032, curl: 55 }], tones: { Gloves: '#151518', Claw: '#e8e2d0' } },
  // the sorcerer's: fingerless, rings with stones on two fingers, a stone on the back, a gilt band
  sorcererGloves: { family: 'fantasy', glove: { cuff: 0.16, thick: 0.0014, fingers: 'half' }, adorn: [{ prim: 'rings', on: ['index', 'ring'], at: 0.38, gem: true }, { prim: 'jewel', at: 'back', size: 0.014 }, { prim: 'cuff', width: 0.01, group: 'Gilt' }],
    tones: { Gloves: '#2c1d3d', Gilt: '#c9a646', Gem: '#7f3fbf' } },
  // the trapper's: fur round the cuff
  furGloves: { family: 'fantasy', glove: { cuff: 0.14, thick: 0.0028 }, adorn: [{ prim: 'fur', length: 0.026 }], tones: { Gloves: '#5a3a26', Fur: '#bfae8f' } },
  // the stone gauntlet: gold, a stone on each knuckle and one on the back
  gemGauntlet: { family: 'gauntlet', glove: { cuff: 0.2, thick: 0.003 }, adorn: [{ prim: 'knuckles', lift: 0.004, group: 'Gilt' }, { prim: 'jewel', at: 'knuckles', size: 0.008 }, { prim: 'jewel', at: 'back', size: 0.016 }, { prim: 'flare', height: 0.06, spread: 1.5, group: 'Gloves' }],
    tones: { Gloves: '#b8902e', Gilt: '#d8b44a', Gem: '#c23a3a' } },
});
const all = (c, groups) => Object.fromEntries(groups.split(' ').map((g) => [g, c]));
/** COLOURWAYS over any card, by role */
export const SKINS = Object.freeze({
  black: Object.freeze(all('#151517', 'Gloves Overlay Cuff Strap Pad')),
  white: Object.freeze(all('#f2f0ea', 'Gloves Overlay Cuff Strap')),
  tan: Object.freeze({ Gloves: '#a0643a' }),
  oxblood: Object.freeze({ Gloves: '#4a1418' }),
  navy: Object.freeze({ Gloves: '#1d2a44', Overlay: '#f2f1ec', Strap: '#c8402a' }),
  volt: Object.freeze({ Gloves: '#1c1d20', Overlay: '#d7f23a', Strap: '#d7f23a', Pad: '#1c1d20' }),
  // the sport colourways
  tripleWhite: Object.freeze(all('#f3f2ee', 'Gloves Overlay Cuff Strap Pad Latex Guard')),
  infrared: Object.freeze({ Gloves: '#1c1d20', Overlay: '#e8412c', Strap: '#e8412c', Pad: '#e8412c', Latex: '#f2f1ec' }),
  royal: Object.freeze({ Gloves: '#1f3f9a', Overlay: '#f2f1ec', Strap: '#f2f1ec', Pad: '#1f3f9a', Latex: '#f2f1ec' }),
  hiVis: Object.freeze({ Gloves: '#e6f23a', Overlay: '#1b1c20', Strap: '#1b1c20', Pad: '#1b1c20', Cuff: '#1b1c20' }),
  // the leathers (the pieces cut OF the leather follow it)
  cognac: Object.freeze({ Gloves: '#8a4b22' }),
  chocolate: Object.freeze({ Gloves: '#3b2418' }),
  dove: Object.freeze({ Gloves: '#9a9590' }),
  burgundy: Object.freeze({ Gloves: '#5a1a26' }),
  ivory: Object.freeze({ Gloves: '#f1ead9' }),
});
/** the colours of the groups handwear lays, for a palette that names none (a card's own tones over these) */
export const HANDWEAR_TONES = Object.freeze({ Gloves: '#3b2a20', Overlay: '#2a1e17', Stitch: '#d8c9a8', Cuff: '#2f2a26', Strap: '#2a1e17', Brass: '#a8843f', Steel: '#8d9299',
  Guard: '#26272a', Gilt: '#c9a646', Gem: '#2b8fb3', Claw: '#e8e2d0', Fur: '#bfae8f', Wrap: '#efe9dc', Pad: '#202022', Latex: '#f2f1ec', Mail: '#6d6f73',
  Button: '#e9e4d8', Perf: '#141010', Pearl: '#f7f3ea' });
