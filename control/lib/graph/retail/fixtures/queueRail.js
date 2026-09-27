import { box } from '../store-box.js';

export default {
  name: 'queueRail',
  decl: { shape: 'run', depth: 1.2, height: 3.3, wallBacked: false, merch: false, tall: false, clearance: 2.5 },
  build(p) {
    const out = [];
    const L = p.light;
    const along = p.along === 'y';
    const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
    const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];
    const c = (t0 + t1) / 2;

    const metal = '#b8bcc2';  // brushed metal for posts
    const beltColor = p.tint || '#8a2f35';  // deep red default

    // Helper to place boxes in the correct orientation based on along axis
    const B = (s0, s1, u0, u1, z0, z1, hex) => (
      along ? box(out, u0, u1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, u0, u1, z0, z1, hex, L)
    );

    const postSpacing = 4;  // ~4 ft between posts
    const postRadius = 0.06;  // slim pole ~0.12 ft diameter
    const postHeight = 3.2;  // posts are ~3.2 ft tall
    const baseRadius = 0.3;  // weighted base radius
    const baseHeight = 0.3;  // base height ~0.3 ft
    const beltHeight = 0.15;  // belt is ~0.15 ft tall
    const beltZ = 2.9;  // belt at ~2.9 ft high
    const beltThickness = 0.08;  // belt thickness in depth direction

    // Place posts and belts along the run, staying within bounds
    const margin = 0.25;
    for (let s = a0 + margin; s < a1 - margin; s += postSpacing) {
      // Clamp base within footprint
      const baseLo = Math.max(s - baseRadius, a0 + margin);
      const baseHi = Math.min(s + baseRadius, a1 - margin);

      // Weighted base
      const baseTLo = Math.max(t0 + 0.1, c - baseRadius);
      const baseTHi = Math.min(t1 - 0.1, c + baseRadius);
      if (baseHi - baseLo > 1e-3 && baseTHi - baseTLo > 1e-3) {
        B(baseLo, baseHi, baseTLo, baseTHi, p.z, p.z + baseHeight, '#5a5d63');
      }

      // Vertical pole - centered
      const poleTLo = c - postRadius;
      const poleTHi = c + postRadius;
      B(s - postRadius, s + postRadius, poleTLo, poleTHi, p.z + baseHeight, p.z + baseHeight + postHeight, metal);

      // Belt to next post (if there is one within bounds)
      const sNext = s + postSpacing;
      if (sNext < a1 - margin) {
        // Belt is a thin horizontal band connecting posts
        const beltTLo = c - beltThickness / 2;
        const beltTHi = c + beltThickness / 2;
        B(s + postRadius, sNext - postRadius, beltTLo, beltTHi, p.z + beltZ, p.z + beltZ + beltHeight, beltColor);
      }
    }

    return out;
  },
};
