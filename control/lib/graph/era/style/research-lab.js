/**
 * The RESEARCH-LAB style card: what the `research-lab` kit dresses its lab with (era/lab-dress.js), written as
 * principles and as the numbers the dressing reads. Doom 3's labs before the fall: a tall room whose structure shows,
 * lit cool from above, a set piece at its centre that everything in the room serves. Clean, but used: the floor is
 * scuffed where people walk, the skirting is grimy, the benches are each somebody's. Machine checks for the
 * principles live in lab.test.js.
 */
export const RESEARCH_LAB = Object.freeze({
  id: 'research-lab',
  principles: Object.freeze([
    'Floor, walls and roof are three materials and three values: a pale vinyl floor, grey steel walls darker than it, and a dark roof whose structure shows.',
    'The set piece holds the focus: a containment tank on a dais at the centre, glowing, its cables running out to the walls under grated covers.',
    'Lit cool from above: troffers hung between the trusses throw pools on the floor; the glow of the tank and the screens is the only colour.',
    'Things are placed, and each bench is somebody\'s: no two neighbouring benches carry the same things.',
    'Clean but used: the floor is scuffed along the ways people walk, the skirting is grimy, nothing is new.',
  ]),
  // the PORTAL: a blast door on `side`, `width` × `height`, its top corners chamfered `chamfer`, leaves set back
  // `depth`; a hazard surround `surround` wide standing `out` proud; a hazard band `band` high across the leaves' foot;
  // a red status lamp over it
  portal: { side: '-y', width: 3.4, height: 3.8, chamfer: 0.8, depth: 0.45, surround: 0.4, out: 0.16, band: 0.5, stripe: 0.8,
    leafTint: [0.82, 0.84, 0.86], lamp: '#ff3a2a', lampLight: { intensity: 0.9, radius: 4.5 } },
  // the SET PIECE: a containment tank at the centre, `r` round and `h` of glass on a steel base, on a two-step dais
  // ringed in hazard paint; a glowing liquid inside (`glow` up top, `glowLow` at the foot), steel hoops, a cap and a
  // conduit up to the trusses; its light baked cyan into the room
  tank: { r: 0.95, h: 3.0, sides: 20, hoops: 3, dais: [{ r: 2.5, h: 0.18 }, { r: 1.9, h: 0.18 }], ring: 0.32, base: { r: 1.25, h: 0.8 }, cap: { r: 1.25, h: 0.7 }, conduit: 0.32,
    steel: [0.62, 0.64, 0.68], deck: [0.7, 0.72, 0.74], glow: '#62d6c8', glowLow: '#1c6a70', glass: '#bfe8ea', alpha: 0.22,
    light: { color: '#5fe6d2', intensity: 1.5, radius: 10 } },
  // TRENCHES: grated cable trenches `w` wide from the dais out to the walls along the room's axes (never across the way in)
  trench: { w: 0.5 },
  // BENCHES: `len` × `depth`, top at `h`, in two rows `off` m from the long walls at fractions `at` of the run; each
  // carries one dressing from the cycle (neighbours never match); a chair at `share` of them
  bench: { len: 2.6, depth: 0.85, h: 0.92, off: 1.6, at: [0.24, 0.38, 0.62, 0.76], top: [0.86, 0.88, 0.9], body: [0.66, 0.7, 0.76], frame: [0.3, 0.3, 0.32], door: [0.58, 0.62, 0.68],
    dressings: ['monitors+papers', 'microscope+glassware', 'monitor+toolbox', 'glassware+papers', 'monitors+microscope', 'toolbox+papers'],
    liquids: [[0.4, 0.8, 0.9], [0.9, 0.5, 0.3], [0.5, 0.9, 0.5], [0.85, 0.85, 0.9]] },
  chair: { h: 0.48, share: 0.75, seat: [0.18, 0.2, 0.26], frame: [0.3, 0.3, 0.32] },
  rack: { n: 5, w: 0.62, d: 1.0, h: 2.1, shift: 0.18, body: [0.16, 0.17, 0.19], led: '#5cf08a' },
  lockers: { n: 5, w: 0.5, d: 0.5, h: 1.9, from: 3.2, tint: [0.5, 0.6, 0.72] },
  board: { w: 2.4, h: 1.2, z: 1.15, shift: 0 },
  extinguisher: { z: 0.9, h: 0.55, from: 2.4, tint: [0.78, 0.1, 0.08] },
  cart: { w: 0.9, d: 0.55, h: 0.85, box: [0.3, 0.42, 0.62], tint: [0.6, 0.62, 0.64], at: [-2.2, 0.3], yaw: 0.4 },
  screenLight: { color: '#7fb6ff', intensity: 0.35, radius: 2.2 },
  // DECAY (`decay`, era/decay.js): the lab gone derelict, by cause. Every number says how far an event at full strength
  // goes; the recipe's 0–1 per event scales it.
  decay: {
    principles: Object.freeze([
      'Everything messy has a cause it can be traced to: the debris lies under the hole it fell from, the stain runs down from the leak, the spill spreads from the broken tank.',
      'The power is gone: most troffers dead, the clerestory dark, the screens black; red emergency lamps make the light now, and the dark between them is part of the picture.',
      'People left in a hurry and nobody came back: chairs over, papers everywhere, the cart rolled away, dust on everything that faces up.',
      'The set piece is still where the eye lands, broken: the tank cracked open, its glass a jagged ring, its liquid across the floor.',
    ]),
    // the air: the ambient dimmed by `dim` × blackout toward `tint`; fog `fog`, `thicken` × denser
    air: { dim: 0.62, tint: [0.4, 0.06, 0.04], fog: '#16141a', thicken: 2.5 },
    window: { glass: '#11161c' },
    survive: 0.85,                  // the share of troffers out at full blackout
    flicker: { share: 0.6, of: 0.8 },   // of the survivors, the share dying (stutter on the page); `of`: a lamp's share of its pool's light
    hang: -1.2,                     // how far a troffer that lost a chain swings down (radians)
    hole: { from: 0.16, span: 0.5, inset: 0.45 },
    duct: { slew: 0.5, reach: 0.75, stub: 0.7 },
    // collapse's debris: `rocks` per m² of hole, pooled concrete; `sheets` deck sheets lying in the pile
    debris: { rocks: 9, size: [0.22, 0.75], tone: '#7a7772', sheets: 6, heap: 0.75 },
    // the emergency lamps: red, on every other column line and over the door
    emergency: { color: '#ff2e1e', intensity: 1.1, radius: 6.5, z: 3.0, every: 2 },
    // breach: the glass left as a ring `keep` m (± `jag`), the spill `spill` m round the dais, shards
    breach: { keep: 0.5, jag: 0.45, spill: 2.6, shards: 60, color: '#2e7c74', glass: '#4f6466', alpha: 0.4, look: { kind: 'pool', tint: '#2f8f84', shore: 0.1 } },
    leak: { puddle: 1.3, color: '#38403e', look: { kind: 'pool', tint: '#4a5a58', shore: 0.12 }, streak: 0.9, rust: [0.62, 0.44, 0.32] },
    // abandon: the share of chairs tipped, of monitors fallen, papers strewn, the cart rolled; dust on up-facing things
    abandon: { tip: 0.65, monitors: 0.5, papers: 46, roll: 2.6, dust: [0.86, 0.82, 0.74], ledDead: '#e08a20' },
    jetLight: [0.32, 0.3, 0.3],
  },
});
