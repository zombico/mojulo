// plating/styles — the seeded SUITS. PURE DATA: a new suit is a card, not code (principles.js carries the laws).
//
// A card:
//   family   'powered'
//   from     a card it extends (its plates replaced where given, `platesPlus` appended, its tones merged); `skin` a
//            colourway (SKINS, or { <group>: '#hex' }) over its tones
//   suit     { ease? (m off the skin, 0.002), on? [segments] } the undersuit, or false: plates on the bare skin
//   plates   [{ region (regions.js PLATE_REGIONS, or { seg, along, around, sides, rows?, gap? }), lift? (m, the
//            standoff: bulk), thick?, rows?, gap?, group? }]
//   shells   [layout | { layout, bulk? }] FITTED SHELLS (layouts.js: greave, greaveFront, kneeCap, sabaton, joints, spine,
//            lumbar, hips, servos): a segment's shell cut along
//            design lines into bevelled panels fitted across narrow seams, stacked by layer
//   muscles  { on: [segments], only?: [plate groups], bulk?, seam? (m, the grooves' width, 0.014) } MUSCLE-MAPPED SHELLS (muscles.js): each segment cut where its
//            grooves run, a plate per muscle group, its edges straightened into stepped lines, an underplate under all
//   feet     a footwear card (the footwear library's: its sole, its toe cap) worn with the suit
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
  // MARK BOOTS: the fitted shell's first layouts (a supercar's lines, not a grid of plates): greaves under domed knee caps,
  // sabatons, on an undersuit over the legs and feet; red over a silver underplate, gold strips, lit vents
  markBoots: { family: 'powered', suit: { ease: 0.002, on: ['shank', 'foot', 'toes'] }, shells: ['greave', 'kneeCap', 'sabaton'],
    feet: { sock: false, sole: { thick: 0.012, welt: 0.004 }, adorn: [{ prim: 'toeCap', lift: 0.012, room: 0.01, group: 'Plate' }] },
    tones: { Plate: '#8e1a1f', Alloy: '#b7b9bd', Trim: '#c9a23a', Suit: '#1e1f24', Light: '#e8f6ff', Sole: '#2a2b2e' }, emissive: ['Light'] },
  // the MARK SUIT: the body cut where its muscles part (the chest and the upper back, the arms, the thighs, the calves),
  // by design where they interleave (the spine and its vertebrae, the lumbar plates, the hips), the greaves' fronts, knee
  // caps and sabatons below, articulated bands at every joint, servos at the knees and the elbows, a reactor on the
  // sternum; red over silver, gold strips, lit vents
  markSuit: { from: 'markBoots', suit: { ease: 0.002, on: ['torso', 'pelvis', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'toes'] },
    shells: ['greaveFront', 'kneeCap', 'sabaton', 'joints', 'spine', 'lumbar', 'hips', 'thighs', 'servos'],
    muscles: { on: ['torso', 'upperArm', 'foreArm', 'shank'], only: ['Pec', 'Sternum', 'Collar', 'Abs1', 'Abs2', 'Abs3', 'Oblique', 'Lat', 'Trap', 'Armpit',
      'Deltoid', 'Biceps', 'Triceps', 'Brachioradialis', 'Extensors', 'Flexors',
      'GastrocMedial', 'GastrocLateral', 'Soleus'] },
    reactor: { at: 0.64, r: 0.026 }, emissive: ['Light', 'Reactor'], tones: { Reactor: '#c8f4ff', Rim: '#b7b9bd', Joint: '#4a4d53' } },
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
export const PLATING_TONES = Object.freeze({ Plate: '#8d9299', Trim: '#c9a23a', Suit: '#1e1f24', Reactor: '#c8f4ff', Rim: '#8d9299', Alloy: '#b7b9bd', Light: '#e8f6ff', Joint: '#4a4d53' });
