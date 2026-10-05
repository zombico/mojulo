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
});
