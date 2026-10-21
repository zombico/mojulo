// plating/layouts — FITTED-SHELL LAYOUTS: how a segment's shell is cut (shell.js), panel by panel, in the segment's design
// coordinates (`t` 0 … 1 down it: the shank from the knee to the ankle, the foot from over the ankle to past the toe base,
// the toes to their tips; `s` −1 … 1 round it: 0 its front line, + its lateral side, ±1 its back). The lines are a
// supercar's: diagonals sweeping down and forward, chevrons narrowing down the front, an underplate showing through the
// windows the overplates leave.
//
// A panel: { id, seg, layer: under | mid | over | cap | light, t: [t0, t1], left: [[t, s], …], right: [[t, s], …],
//            mirror? (a copy on the other side: s negated), dome? (m), lift? (m, over the layer's: a light set on a cap),
//            role? (its colour's role over the layer's) }
// LAYERS set each layer's height off the shell, its depth and its bevel (a card's `bulk` scales the heights).
export const LAYERS = Object.freeze({
  under: Object.freeze({ lift: 0.005, thick: 0.003, bevel: 0.0015, role: 'Alloy' }),
  mid: Object.freeze({ lift: 0.0075, thick: 0.003, bevel: 0.002, role: 'Trim' }),
  over: Object.freeze({ lift: 0.0105, thick: 0.004, bevel: 0.003, role: 'Plate' }),
  cap: Object.freeze({ lift: 0.0135, thick: 0.004, bevel: 0.003, role: 'Plate' }),
  light: Object.freeze({ lift: 0.012, thick: 0.002, bevel: 0.0005, role: 'Light' }),
});

const line = (s, t0 = 0, t1 = 1) => [[t0, s], [t1, s]];

export const LAYOUTS = Object.freeze({
  // the GREAVE: an underplate all round to a back seam; a shin plate narrowing down the front in a chevron; side plates
  // sweeping forward to the ankle, a window of underplate between them and the shin plate with a trim strip in it; calf
  // plates a layer higher, overlapping the sides; a cuff over the ankle; vents
  greave: [
    { id: 'Under', seg: 'shank', layer: 'under', t: [0.03, 0.97], left: line(-0.995), right: line(0.995) },
    { id: 'Shin', seg: 'shank', layer: 'over', t: [0.15, 0.84], left: [[0.15, -0.3], [0.55, -0.22], [0.84, -0.08]], right: [[0.15, 0.3], [0.55, 0.22], [0.84, 0.08]] },
    { id: 'Side', seg: 'shank', layer: 'over', mirror: true, t: [0.08, 0.84], left: [[0.08, 0.5], [0.45, 0.44], [0.84, 0.28]], right: [[0.08, 0.8], [0.84, 0.86]] },
    { id: 'Strip', seg: 'shank', layer: 'mid', mirror: true, t: [0.22, 0.8], left: [[0.22, 0.36], [0.8, 0.17]], right: [[0.22, 0.42], [0.8, 0.23]] },
    { id: 'Calf', seg: 'shank', layer: 'cap', mirror: true, t: [0.1, 0.72], left: [[0.1, 0.74], [0.45, 0.7], [0.72, 0.9]], right: line(0.99, 0.1, 0.72) },
    { id: 'Cuff', seg: 'shank', layer: 'over', t: [0.87, 0.98], left: line(-0.99), right: line(0.99) },
    { id: 'Vent', seg: 'shank', layer: 'light', lift: 0.016, mirror: true, t: [0.12, 0.16], left: line(0.82), right: line(0.92) },
  ],
  // the KNEE CAP: a domed cap over the top of the shank, chevroned below
  kneeCap: [
    { id: 'Cap', seg: 'shank', layer: 'cap', dome: 0.008, t: [0.0, 0.14], left: [[0, -0.36], [0.14, -0.14]], right: [[0, 0.36], [0.14, 0.14]] },
  ],
  // the SABATON: an underplate over the foot's top and sides; an instep plate and side plates leaving windows; a heel cap
  // (the toe and the sole are the footwear library's: a card's `feet`)
  sabaton: [
    { id: 'Under', seg: 'foot', layer: 'under', t: [0.14, 0.92], left: line(-0.74), right: line(0.74) },
    { id: 'Instep', seg: 'foot', layer: 'over', t: [0.3, 0.78], left: [[0.3, -0.24], [0.78, -0.34]], right: [[0.3, 0.24], [0.78, 0.34]] },
    { id: 'Side', seg: 'foot', layer: 'over', mirror: true, t: [0.18, 0.9], left: [[0.18, 0.38], [0.9, 0.46]], right: line(0.72, 0.18, 0.9) },
    { id: 'Heel', seg: 'foot', layer: 'cap', mirror: true, t: [0.04, 0.34], left: line(0.76, 0.04, 0.34), right: line(0.995, 0.04, 0.34) },
  ],
});
