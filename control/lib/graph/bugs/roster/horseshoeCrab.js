// ATLANTIC HORSESHOE CRAB (Limulus polyphemus). Thesis: a low smooth dome in three parts, flat to the ground — a broad
// HORSESHOE-shaped PROSOMA (wider than long, rounded in front, widest at its rear corners, a low midline ridge) that
// hides every leg from above, a smaller hinged hexagonal OPISTHOSOMA behind it tapering back (in life with six short
// movable spines along each edge), and a long straight spike TAIL (telson) about as long as the shell · two small
// kidney-shaped compound eyes high on the prosoma's flanks · five pairs of short legs (and the chelicerae) tucked
// entirely underneath · olive-brown. Adult females average 46–48 cm total length with the telson, males 25–30 % smaller
// (Shuster, Barlow & Brockmann, The American Horseshoe Crab, 2003; horseshoecrab.org "Natural History"); mean female
// prosomal width 214 mm. Proportions here: prosoma width ≈ shell length (prosoma + opisthosoma), the telson about the
// same again. `length` is the prosoma front to the opisthosoma tip (0.23 m, a female); the telson adds ~0.22 m. The
// horseshoe outline and the spike tail carry the silhouette (not a crab: no claws, no visible legs; not a stingray).
export const bug = {
  order: 'Xiphosura', name: 'an Atlantic horseshoe crab', length: 0.23, clearance: 0.03,
  head: 'fused',
  trunk: { form: 'carapace', len: 0.6, w: 0.5, h: 0.17, belly: 0.08, r0: 0.95, peak: 0.3, r1: 0.38, p: 0.5, q: 0.5, arch: 0, samples: 12 },
  tail: { form: 'mesosoma', len: 0.42, w: 0.26, h: 0.09, overhang: 0.04, lift: 0.02, segments: 1, dip: 0, belly: 0.1, r0: 0.95, peak: 0.12, r1: 0.3, p: 1, q: 1.1, pitch: -4, samples: 8 },
  legs: { form: 'tucked', socket: -10, reach: 0.35, thick: 0.75, yaw: [150, 165, 180, 195, 210], angles: { coxa: -20, femur: -5, tibia: -25, tarsus: -4 } },
  palps: null,
  antennae: null,
  mouth: 'none',
  eyes: { form: 'small', at: -0.6, elev: 55, size: 0.4, flat: 0.5, bulge: 0.55 },
  extras: [{ kind: 'filament', len: 1.0, r: 0.028, bend: 0, rise: 2 }],
  colors: { body: '#6e5a36', legs: '#8a7448', cerci: '#5e4c2e', eyes: '#1c1a14' },
};
