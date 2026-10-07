// COMMON WOODLOUSE (Oniscus asellus). Thesis: an OVAL DOME of seven overlapping plates and a short tapering tail
// section, flat underneath, half as wide as long · seven pairs of short legs hidden under the rim · two antennae bent
// like elbows at the front · two short tail spikes · glossy grey with pale edges · up to 16 mm (Hopkin, Woodlice of
// Britain and Ireland).
export const bug = {
  order: 'Isopoda', name: 'a common woodlouse', length: 0.014, clearance: 0.006,
  head: { form: 'prognathous', len: 0.1, w: 0.17, h: 0.06, pitch: -8, lift: 0.03, overlap: 0.3 },
  trunk: { form: 'isopod', len: 0.66, w: 0.28, h: 0.11, r0: 0.72, peak: 0.42, r1: 0.62, p: 0.7, q: 0.8, dip: 0.13, arch: 0.015, belly: 0.45 },
  tail: { form: 'pleon', len: 0.17, w: 0.12, h: 0.055, r0: 0.95, peak: 0.05, r1: 0.4, q: 0.9, belly: 0.45 },
  legs: { form: 'manyfoot', reach: 0.7, thick: 2, socket: -28 },
  antennae: { form: 'geniculate', len: 0.4, r: 0.012, rise: 15, yaw: 40, elbow: { at: 4, deg: 40, flare: 20 }, scape: 0.3 }, mouth: 'none', eyes: { form: 'small', size: 0.2, at: 0.4, elev: 30 },
  extras: [{ kind: 'cerci', len: 0.11, r: 0.018, spread: 60, shape: 'carrot', blunt: true }],
  colors: { body: '#5f5e5a', legs: '#8c8780', antennae: '#6c6a65' },
  markings: [{ on: 'trunk', kind: 'band', t: [0.75, 1], group: 'Edge', color: '#a8a39a' }],
};
