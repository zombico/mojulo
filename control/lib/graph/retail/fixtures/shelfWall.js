import { box } from '../store-box.js';

export default {
  name: 'shelfWall',
  decl: { shape: 'run', depth: 1.6, height: 7.5, wallBacked: true, merch: true, tall: true, clearance: 3 },
  build(p) {
    const out = [];
    const L = p.light;
    const body = p.tint || '#d8d3c8'; // pale carcass color
    const trim = '#8a7960'; // darker trim for standards and shelves

    // Determine axis alignment
    const along = p.along === 'y';
    const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
    const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];

    // Helper to box in either orientation
    const B = (s0, s1, u0, u1, z0, z1, hex) =>
      (along ? box(out, u0, u1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, u0, u1, z0, z1, hex, L));

    const cabinetDepth = t1 - t0;
    const runLength = a1 - a0;

    // Back panel (against wall when wallBacked)
    B(a0, a1, t1 - 0.08, t1, p.z, p.z + 7.5, body);

    // Side panels (frame the whole unit)
    B(a0, a0 + 0.08, t0, t1, p.z, p.z + 7.5, body);
    B(a1 - 0.08, a1, t0, t1, p.z, p.z + 7.5, body);

    // Base plinth/kick plate (deeper at bottom)
    B(a0 + 0.08, a1 - 0.08, t0, t1 - 0.08, p.z, p.z + 0.35, '#5a5254');

    // Top rail/header
    B(a0 + 0.08, a1 - 0.08, t0, t1 - 0.08, p.z + 7.35, p.z + 7.5, trim);

    // Vertical standards every ~3 feet dividing bays
    const bayWidth = 2.8; // slightly less than 3 ft to allow for standards
    const numBays = Math.max(1, Math.round(runLength / bayWidth));
    const actualBayWidth = runLength / numBays;

    for (let i = 1; i < numBays; i++) {
      const s = a0 + i * actualBayWidth;
      B(s - 0.05, s + 0.05, t0, t1 - 0.08, p.z, p.z + 7.5, trim);
    }

    // Shelf system: 5 shelves stepping slightly shallower toward top
    // Shelf heights at: base, 1.5ft, 3.2ft, 4.8ft, 6.3ft
    const shelfZs = [0.35, 1.85, 3.35, 4.85, 6.35];
    const shelfDepths = [
      { front: t0 + 0.08, back: t1 - 0.1 },   // base shelf, full depth
      { front: t0 + 0.1, back: t1 - 0.1 },    // shelf 2
      { front: t0 + 0.12, back: t1 - 0.1 },   // shelf 3, slightly shallower
      { front: t0 + 0.14, back: t1 - 0.1 },   // shelf 4
      { front: t0 + 0.16, back: t1 - 0.1 },   // shelf 5, most shallow
    ];

    for (let sh = 0; sh < shelfZs.length; sh++) {
      const shelfZ = shelfZs[sh];
      const { front, back } = shelfDepths[sh];

      // Shelf board itself (thin but visible)
      B(a0 + 0.1, a1 - 0.1, front, back, p.z + shelfZ, p.z + shelfZ + 0.06, trim);

      // Merchandise on shelves (books, boxed goods, varied sizes)
      // Merchandise width and height vary with rng
      for (let s = a0 + 0.15; s < a1 - 0.15;) {
        const itemW = 0.4 + p.rng() * 0.5; // width 0.4-0.9 ft
        const itemH = 0.4 + p.rng() * 0.6; // height 0.4-1.0 ft (books/boxes)
        const e = Math.min(s + itemW, a1 - 0.15);
        const merchColor = p.merch();

        // Item block (merchandise)
        B(s, e, front + 0.02, back - 0.02, p.z + shelfZ + 0.06, p.z + shelfZ + 0.06 + itemH, merchColor);
        s = e + 0.08; // gap between items
      }
    }

    return out;
  },
};
