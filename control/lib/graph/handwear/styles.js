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
//   adorn   [{ prim, … }] the adornment, in order (expand.js ADORN_PRIMS: panel, points, cuff, strap, flare, knuckles,
//           studs, lames, rings, jewel, claws, fur, wrap)
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
  knightGauntlets: { family: 'historic', glove: { cuff: 0.2, thick: 0.0025, group: 'Mail' }, adorn: [{ prim: 'panel', region: 'back', lift: 0.004, thick: 0.004, group: 'Steel' }, { prim: 'knuckles', lift: 0.005, group: 'Steel' }, { prim: 'lames' }, { prim: 'flare', height: 0.08, spread: 1.6, group: 'Steel' }],
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
  gemGauntlet: { family: 'fantasy', glove: { cuff: 0.2, thick: 0.003 }, adorn: [{ prim: 'knuckles', lift: 0.004, group: 'Gilt' }, { prim: 'jewel', at: 'knuckles', size: 0.008 }, { prim: 'jewel', at: 'back', size: 0.016 }, { prim: 'flare', height: 0.06, spread: 1.5, group: 'Gloves' }],
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
});
/** the colours of the groups handwear lays, for a palette that names none (a card's own tones over these) */
export const HANDWEAR_TONES = Object.freeze({ Gloves: '#3b2a20', Overlay: '#2a1e17', Stitch: '#d8c9a8', Cuff: '#2f2a26', Strap: '#2a1e17', Brass: '#a8843f', Steel: '#8d9299',
  Guard: '#26272a', Gilt: '#c9a646', Gem: '#2b8fb3', Claw: '#e8e2d0', Fur: '#bfae8f', Wrap: '#efe9dc', Pad: '#202022', Latex: '#f2f1ec', Mail: '#6d6f73' });
