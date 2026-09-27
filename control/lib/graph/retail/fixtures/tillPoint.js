import { box } from '../store-box.js';

export default {
  name: 'tillPoint',
  decl: { shape: 'point', size: [3.6, 2.2], height: 4.4, wallBacked: false, merch: false, tall: false, clearance: 3 },
  build(p) {
    const out = [];
    const x = (p.x0 + p.x1) / 2;
    const y = (p.y0 + p.y1) / 2;
    const hw = (p.x1 - p.x0) / 2;  // ~1.8 ft
    const hd = (p.y1 - p.y0) / 2;  // ~1.1 ft
    const bodyColor = p.tint || '#4a4f57';
    const workTopColor = '#c9c4bb';
    const L = p.light;

    // Dark kick band at bottom (0.35 ft tall)
    box(out, x - hw * 0.92, x + hw * 0.92, y - hd * 0.92, y + hd * 0.92, p.z, p.z + 0.35, '#3a3d42', L);

    // Main waist-high body: desk from kick to 3.3 ft
    box(out, x - hw * 0.90, x + hw * 0.90, y - hd * 0.90, y + hd * 0.90, p.z + 0.35, p.z + 3.3, bodyColor, L);

    // Light worktop slab (0.12 thick), overhanging 0.2 ft on customer side (-y)
    const workTopY0 = y - hd * 0.90 - 0.2;
    const workTopY1 = y + hd * 0.90;
    box(out, x - hw * 0.92, x + hw * 0.92, workTopY0, workTopY1, p.z + 3.3, p.z + 3.42, workTopColor, L);

    // Short neck supporting POS terminal on staff side
    const neckY0 = y + hd * 0.72;
    const neckY1 = y + hd * 0.82;
    const neckZ = p.z + 3.42;
    box(out, x - 0.2, x + 0.2, neckY0, neckY1, neckZ, neckZ + 0.2, '#3a3d42', L);

    // POS terminal: 1.3 ft wide × 0.95 ft tall, tilted back with 3 stacked boxes
    const termW = 1.3;
    const termH = 0.95;
    const termSegH = termH / 3;
    const termZ0 = neckZ + 0.2;

    // Stack 3 segments, each stepping back slightly toward staff side (+y)
    for (let i = 0; i < 3; i++) {
      const segZ = termZ0 + i * termSegH;
      const segYOffset = i * 0.08;  // Step back each segment for tilt effect
      const segY0 = neckY0 + segYOffset;
      const segY1 = neckY1 + segYOffset;
      box(out, x - termW / 2, x + termW / 2, segY0, segY1, segZ, segZ + termSegH, '#6f8fa8', L);
    }

    // Dark bezel on left and right sides of terminal
    const bezelW = 0.08;
    const termY0 = neckY0;
    const termY1 = neckY1 + 0.24;
    box(out, x - termW / 2 - bezelW, x - termW / 2, termY0, termY1, termZ0, termZ0 + termH, '#2a2d33', L);
    box(out, x + termW / 2, x + termW / 2 + bezelW, termY0, termY1, termZ0, termZ0 + termH, '#2a2d33', L);

    // Card reader on staff side, beside terminal
    const cardX = x + termW / 2 + bezelW + 0.2;
    const cardY = y + hd * 0.75;
    box(out, cardX - 0.12, cardX + 0.12, cardY - 0.1, cardY + 0.1, neckZ, neckZ + 0.35, '#1a1d23', L);

    // Low impulse shelf on customer side at ~2.2 ft, shallow
    const rackZ = p.z + 2.2;
    const rackFrontY = workTopY0 - 0.05;
    const rackBackY = workTopY0 + 0.15;

    // Shelf tray
    box(out, x - hw * 0.85, x + hw * 0.85, rackFrontY, rackBackY, rackZ, rackZ + 0.08, '#5a5d63', L);

    // 7 small merchandise blocks on shelf
    const merchCount = 7;
    const merchSpacing = (hw * 1.7) / (merchCount + 1);

    for (let i = 0; i < merchCount; i++) {
      const merchX = x - hw * 0.85 + (i + 1) * merchSpacing;
      const merchW = merchSpacing * 0.65;
      const merchD = 0.12;
      const merchH = 0.3 + p.rng() * 0.45;
      box(out, merchX - merchW / 2, merchX + merchW / 2, rackFrontY, rackFrontY + merchD, rackZ + 0.08, rackZ + 0.08 + merchH, p.merch(), L);
    }

    return out;
  },
};
