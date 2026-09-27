import { box } from '../store-box.js';

export default {
  name: 'fridgeCase',
  decl: { shape: 'run', depth: 2.6, height: 7, wallBacked: true, merch: true, tall: true, clearance: 3.5 },
  build(p) {
    const out = [];
    const L = p.light;
    const body = '#2a2d33'; // dark metal cabinet
    const headerColor = '#e8f1f4'; // pale header sign strip

    // Determine axis alignment
    const along = p.along === 'y';
    const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
    const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];

    // Helper to box in either orientation
    const B = (s0, s1, u0, u1, z0, z1, hex) =>
      (along ? box(out, u0, u1, s0, s1, z0, z1, hex, L) : box(out, s0, s1, u0, u1, z0, z1, hex, L));

    // Helper for glass door pane (translucent face)
    const addPane = (s0, s1, u0, u1, z0, z1) => {
      const corners = along
        ? [[u1, s0, z0], [u1, s1, z0], [u1, s1, z1], [u1, s0, z1]]
        : [[s0, u1, z0], [s1, u1, z0], [s1, u1, z1], [s0, u1, z1]];
      out.push({
        corners,
        fill: 'rgba(205,228,235,0.18)',
        doubleSided: true,
        water: true
      });
    };

    const cabinetDepth = t1 - t0;
    const runLength = a1 - a0;

    // Back panel (against wall when wallBacked)
    B(a0, a1, t1 - 0.05, t1, p.z, p.z + 7, body);

    // Side panels
    B(a0, a0 + 0.08, t0, t1, p.z, p.z + 7, body);
    B(a1 - 0.08, a1, t0, t1, p.z, p.z + 7, body);

    // Base/kick plate
    B(a0 + 0.08, a1 - 0.08, t0, t1, p.z, p.z + 0.25, '#1a1c20');

    // Top header band (lit sign strip)
    B(a0 + 0.08, a1 - 0.08, t0, t1, p.z + 6.8, p.z + 7, headerColor);

    // Shelves (4-5 shelves)
    const shelfZs = [0.5, 2.0, 3.5, 5.0];

    for (const shelfZ of shelfZs) {
      // Shelf boards
      B(a0 + 0.1, a1 - 0.1, t0 + 0.05, t1 - 0.05, p.z + shelfZ, p.z + shelfZ + 0.06, '#4a4d53');

      // Merchandise on shelves (bottles/cans as small boxes with varied heights)
      for (let s = a0 + 0.15; s < a1 - 0.15;) {
        const w = 0.25 + p.rng() * 0.35; // bottle width
        const h = 0.6 + p.rng() * 0.5; // varied bottle height
        const e = Math.min(s + w, a1 - 0.15);
        const merchColor = p.merch();
        B(s, e, t0 + 0.1, t1 - 0.12, p.z + shelfZ + 0.06, p.z + shelfZ + 0.06 + h, merchColor);
        s = e + 0.05;
      }
    }

    // Glass doors (front face)
    const doorWidth = 2.5; // ~2.5 ft per door
    const numDoors = Math.max(1, Math.round(runLength / doorWidth));
    const actualDoorWidth = runLength / numDoors;

    for (let i = 0; i < numDoors; i++) {
      const s0 = a0 + i * actualDoorWidth;
      const s1 = a0 + (i + 1) * actualDoorWidth;

      // Door frame (thin boxes around pane)
      const frameThickness = 0.06;
      const glassZ0 = p.z + 0.4;
      const glassZ1 = p.z + 6.6;

      // Top frame
      B(s0, s1, t0 + 0.05, t0 + 0.05 + frameThickness, glassZ1 - frameThickness, glassZ1, body);

      // Bottom frame
      B(s0, s1, t0 + 0.05, t0 + 0.05 + frameThickness, glassZ0, glassZ0 + frameThickness, body);

      // Left frame
      B(s0, s0 + frameThickness, t0 + 0.05, t0 + 0.05 + frameThickness, glassZ0, glassZ1, body);

      // Right frame
      B(s1 - frameThickness, s1, t0 + 0.05, t0 + 0.05 + frameThickness, glassZ0, glassZ1, body);

      // Glass pane (translucent, pushed to front)
      const paneU0 = t0 + 0.05 + frameThickness * 0.5;
      const paneU1 = t0 + 0.05 + frameThickness * 1.5;
      addPane(s0 + frameThickness * 0.5, s1 - frameThickness * 0.5, paneU0, paneU1, glassZ0 + frameThickness, glassZ1 - frameThickness);
    }

    return out;
  },
};
