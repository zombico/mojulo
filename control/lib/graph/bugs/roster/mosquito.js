// YELLOW FEVER MOSQUITO female (Aedes aegypti). Thesis: a tiny humped body slung between VERY long thin legs · a
// long straight piercing proboscis · one pair of narrow wings folded flat over a slim abdomen, the hindwings halteres ·
// fine (pilose) antennae · black with white leg rings and a white lyre on the thorax · 4–7 mm (Christophers, Aedes
// aegypti: the Yellow Fever Mosquito).
export const bug = {
  order: 'Culicidae', name: 'a yellow fever mosquito', length: 0.005, clearance: 0.3986,
  head: { form: 'globe', len: 0.12, w: 0.07, h: 0.07, pitch: -30 },
  trunk: { form: 'compact', len: 0.28, w: 0.075, h: 0.09, arch: 0.02 },
  tail: { form: 'long', len: 0.6, w: 0.045, h: 0.04, segments: 8, pitch: -4, samplesPerSeg: 3 },
  legs: { form: 'stilt', reach: 0.66, thick: 1.8, fore: { yaw: 38 }, hind: { yaw: -40, ground: false, angles: { coxa: -50, femur: 60, tibia: -40, tarsus: 15 } } },
  antennae: { form: 'plumose', len: 0.32, r: 0.008, rise: 15, curve: 10, comb: { count: 6, len: 0.025, r: 0.0025, from: 0.15 } }, mouth: { form: 'stylet', len: 0.48, r: 0.019, end: 0.25, pitch: -42 }, eyes: { form: 'large', size: 0.7 },
  wings: { pose: 'flat', pairs: [{ form: 'narrow', len: 0.62, chord: 0.2 }, { form: 'haltere' }] },
  colors: { body: '#1d1c1b', legs: '#1d1c1b', wing: '#cfd3d2', eyes: '#2a2826' },
  // WHITE BANDS: thin basal bands on the abdomen (`samplesPerSeg` 3 → six rings a segment; each band its first ring),
  // white knees (the end ring of every femur), and white rings at the base of tarsomeres 1–4 on every leg,
  // the hind leg's last tarsomere all white
  markings: [
    { on: 'tail', kind: 'segments', offset: 0, every: 1, trim: 5 / 3, group: 'Ring', color: '#e8e6df' },
    ...[0, 1, 2].map((j) => ({ on: `leg${j}Femur`, kind: 'band', run: [0.67, 1], group: 'Ring' })),
    ...[0, 1, 2].flatMap((j) => [1, 2, 3, 4].map((i) => ({ on: `leg${j}Tarsus${i}`, kind: 'band', run: [0, 0.34], group: 'Ring' }))),
    { on: 'leg2Tarsus4', kind: 'band', group: 'Ring' },
  ],
};
