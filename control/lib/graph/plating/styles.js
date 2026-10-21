// plating/styles — the seeded SUITS. PURE DATA: a new suit is a card, not code (principles.js carries the laws).
//
// A card:
//   family   'powered'
//   from     a card it extends (its plates replaced where given, `platesPlus` appended, its tones merged); `skin` a
//            colourway (SKINS, or { <group>: '#hex' }) over its tones
//   suit     { ease? (m off the skin, 0.002) } the undersuit, or false: plates on the bare skin
//   plates   [{ region (regions.js PLATE_REGIONS, or { seg, along, around, sides, rows?, gap? }), lift? (m, the
//            standoff: bulk), thick?, rows?, gap?, group? }]
//   reactor  { at? (a share up the torso, 0.78; the sternum about 0.64), r? (m), group? } a disc on the sternum, its rim in Rim
//   tones    { <group>: '#hex' }; emissive [<group>] (rendered full-bright)
export const SUITS = Object.freeze({
  // the powered suit: red plates with gold trim on every segment, a reactor on the chest
  powerSuit: { family: 'powered', suit: { ease: 0.002 },
    plates: [{ region: 'chest', lift: 0.008 }, { region: 'abs', lift: 0.006, group: 'Trim' }, { region: 'flank', lift: 0.006 }, { region: 'back', lift: 0.008 }, { region: 'lumbar', lift: 0.006 },
      { region: 'belt', lift: 0.006, group: 'Trim' }, { region: 'hip', lift: 0.006 }, { region: 'shoulder', lift: 0.01 }, { region: 'bicep', lift: 0.006 }, { region: 'triceps', lift: 0.006 },
      { region: 'gauntlet', lift: 0.007 }, { region: 'thigh', lift: 0.007 }, { region: 'thighOuter', lift: 0.008, group: 'Trim' }, { region: 'hamstring', lift: 0.006 }, { region: 'shin', lift: 0.007, group: 'Trim' }, { region: 'calf', lift: 0.007 }],
    reactor: { at: 0.64, r: 0.028 },
    tones: { Plate: '#9b1b1f', Trim: '#c9a23a', Suit: '#1e1f24', Reactor: '#c8f4ff', Rim: '#8d9299' }, emissive: ['Reactor'] },
  // the stealth suit: matte black plates parting wide over a dark suit, cold glow
  stealthSuit: { from: 'powerSuit', plates: [{ region: 'chest', lift: 0.006 }, { region: 'abs', lift: 0.004, gap: 0.04 }, { region: 'back', lift: 0.006 }, { region: 'shoulder', lift: 0.007 },
      { region: 'gauntlet', lift: 0.005 }, { region: 'thigh', lift: 0.005, gap: 0.05 }, { region: 'shin', lift: 0.005 }, { region: 'calf', lift: 0.005 }],
    reactor: { at: 0.64, r: 0.02 }, tones: { Plate: '#1a1b1f', Trim: '#2a2c33', Suit: '#0d0e10', Reactor: '#7fd8ff' } },
  // the heavy suit: gunmetal, every plate stood far off (bulk), the trunk banded in more rows
  heavySuit: { from: 'powerSuit', plates: [{ region: 'chest', lift: 0.016 }, { region: 'abs', lift: 0.012, rows: 4 }, { region: 'flank', lift: 0.012 }, { region: 'back', lift: 0.016 }, { region: 'lumbar', lift: 0.012, rows: 3 },
      { region: 'belt', lift: 0.012 }, { region: 'hip', lift: 0.012 }, { region: 'shoulder', lift: 0.02 }, { region: 'bicep', lift: 0.012 }, { region: 'triceps', lift: 0.012 },
      { region: 'gauntlet', lift: 0.014, rows: 3 }, { region: 'thigh', lift: 0.014, rows: 3 }, { region: 'thighOuter', lift: 0.016 }, { region: 'hamstring', lift: 0.012 }, { region: 'shin', lift: 0.014, rows: 3 }, { region: 'calf', lift: 0.014 }],
    reactor: { at: 0.64, r: 0.034 }, tones: { Plate: '#55595f', Trim: '#2f3236', Suit: '#1a1b1e', Reactor: '#ffd27a' } },
  // the sleek suit: few plates, white over grey, close to the body
  sleekSuit: { from: 'powerSuit', plates: [{ region: 'chest', lift: 0.004 }, { region: 'shoulder', lift: 0.005 }, { region: 'gauntlet', lift: 0.004, rows: 1 }, { region: 'thigh', lift: 0.004, rows: 1 }, { region: 'shin', lift: 0.004, rows: 1 }],
    reactor: { at: 0.64, r: 0.018 }, tones: { Plate: '#e9eaee', Trim: '#9aa3ad', Suit: '#3a3f47', Reactor: '#9fe8ff' } },
});
for (const c of Object.values(SUITS)) Object.freeze(c);
/** COLOURWAYS over any suit, by role */
export const SKINS = Object.freeze({
  hotRod: Object.freeze({ Plate: '#9b1b1f', Trim: '#c9a23a' }),
  gunmetal: Object.freeze({ Plate: '#55595f', Trim: '#2f3236' }),
  arctic: Object.freeze({ Plate: '#e9eaee', Trim: '#7fa6c9', Reactor: '#9fe8ff' }),
  midnight: Object.freeze({ Plate: '#1b2340', Trim: '#c0c6d6', Reactor: '#7fd8ff' }),
});
/** the colours of the groups a suit lays, for a palette that names none */
export const PLATING_TONES = Object.freeze({ Plate: '#8d9299', Trim: '#c9a23a', Suit: '#1e1f24', Reactor: '#c8f4ff', Rim: '#8d9299' });
