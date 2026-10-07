// AMERICAN GIANT MILLIPEDE (Narceus americanus). Thesis: a long ROUND tube of many rings, two pairs of short legs
// under every ring, a slow wave of legs under a smooth glossy back · a rounded head with short clubbed antennae · dark
// brown with pale ring edges · 40–100 mm (Hoffman, Checklist of the Millipeds of North and Middle America).
// the slow WAVE of legs: each pair's yaw swings ±16° along the body, a wavelength of twelve pairs
const SWING = [0, 8, 13.86, 16, 13.86, 8, 0, -8, -13.86, -16, -13.86, -8];   // 16 × sin(30° × j), literal (no float trig in a recipe)
const WAVE = Array.from({ length: 60 }, (_, j) => ({ yawOver: SWING[j % 12] }));
// short legs straight down under the body, knees barely out
const TUCK = { coxa: -82, femur: -5, tibia: -85, tarsus: -20 };
export const bug = {
  order: 'Diplopoda', name: 'a giant millipede', length: 0.07, clearance: 0.025,
  head: { form: 'prognathous', len: 0.05, w: 0.048, h: 0.042, pitch: -35 },
  trunk: { form: 'millipede', w: 0.05, h: 0.05, legPairs: [0, 1, 1] }, tail: { form: 'telson', w: 0.042, h: 0.04, r1: 0.9 },
  legs: { form: 'manyfoot', reach: 0.68, socket: -82, each: WAVE, fore: { angles: TUCK }, mid: { angles: TUCK }, hind: { angles: TUCK } },
  antennae: { form: 'clavate', len: 0.07, r: 0.006 }, mouth: 'none', eyes: { form: 'small', size: 0.25 },
  colors: { body: '#3a2418', legs: '#9c7a52', antennae: '#5a3a22' },
  markings: [{ on: 'trunk', kind: 'segments', offset: 0, every: 1, from: 1.6, group: 'Ring', color: '#8a4a26' }],
};
