// HOUSE FLY (Musca domestica). Thesis: a round head mostly EYE (big red-brown compound eyes) on a humped grey thorax ·
// a short oval abdomen · ONE pair of clear wings held in a V behind, the hindwings tiny knobs (halteres) · a sponging
// mouth hanging under the head · short bristle (aristate) antennae · the same six walking legs as the bee · grey with
// four dark thorax stripes · 6–7 mm (Hewitt, The House-Fly).
// The HALTERES ride the rear thorax segment low on the flank (`socket` 20), turned out and down, behind and below
// the wing root.
export const bug = {
  order: 'Diptera', name: 'a house fly', length: 0.0068, clearance: 0.10636,
  head: { form: 'globe', len: 0.2, w: 0.125, h: 0.13, lift: 0.03 },
  trunk: { form: 'compact', len: 0.36, w: 0.125, h: 0.13, arch: 0.03, samplesPerSeg: 2 },
  tail: { form: 'oval', len: 0.3, w: 0.16, h: 0.11, segments: 4, r0: 0.8, peak: 0.42, r1: 0.22, q: 0.7, pitch: -8 },
  legs: { form: 'walker', reach: 1.0, fore: { angles: { tibia: -64 } }, mid: { angles: { tibia: -66 } }, hind: { angles: { tibia: -62 } } },
  antennae: 'aristate', mouth: 'sponge', eyes: { form: 'large', size: 0.95, flat: 1.0, depth: 0.8, elev: 30, at: 0.55, bulge: 0.7 },
  wings: { pose: 'vee', poseOver: { sweep: 52, dihedral: 6 }, pairs: [{ form: 'membrane', len: 0.52, chord: 0.3, r1: 0.45 }, { form: 'haltere', len: 0.1, chord: 0.045, seg: 2, socket: 20, poseOver: { sweep: 20, dihedral: -15 } }] },
  colors: { body: '#4a4640', trunk: '#6a665e', tail: '#5d574c', legs: '#1e1c1a', eyes: '#7a2a1c', wing: '#d6dadb', haltere: '#c8b98e' },
  // the FOUR DARK STRIPES run lengthwise over the thorax: the trunk ring (ring12) has six bands a half, t 0 the dorsal
  // midline, so the inner pair is band 1 (30–60° off the top) and the outer pair band 3 (just under the shoulder);
  // `samplesPerSeg` gives the run windows finer rings so the stripes stop cleanly short of the neck and the scutellum
  markings: [{ on: 'trunk', kind: 'band', run: [0.12, 0.92], t: [0.17, 0.33], group: 'Stripe', color: '#2b2824' }, { on: 'trunk', kind: 'band', run: [0.12, 0.92], t: [0.5, 0.66], group: 'Stripe' }],
};
