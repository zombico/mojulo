/**
 * prerender — the DKC seam: polygonizer solids, vexar-lit, lowered
 * into pixelizer sprites by deterministic quantization.
 *
 * Donkey Kong Country's look was never hand-drawn pixels: Rare
 * modeled and lit 3D props, rendered them, and downsampled the
 * renders into SNES palette sprites. Mojulo owns both ends natively —
 * the polygonizer monomers are the modeler, vexar is the light rig,
 * the pixelizer 16bit register is the SNES — and this module is the
 * seam between them.
 *
 * Doctrine: this is the one LEGAL "pixels from a render" path. The
 * dream-loop quantizer stays parked (posture 2) because diffusion is
 * non-deterministic; here the source render is mojulo's own pure
 * function of a sovereign recipe, so recipe → lit faces → projected
 * SVG → downsample → median-cut palette → cells is deterministic end
 * to end. Same solid + same view + same budget = same sprite bytes.
 *
 * projectFacesToSvg: a bounds-fit painter's-algorithm camera over
 * { corners, fill } faces (the relief-spike projector, transparent
 * background). quantizeRgbaToRaster: deterministic median-cut to the
 * register budget with 1-bit alpha (the SNES had no soft edges — the
 * anti-aliasing lives in the downsample, exactly like 1994).
 */

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const centroid3 = (pts) => {
  const c = [0, 0, 0];
  for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return [c[0] / pts.length, c[1] / pts.length, c[2] / pts.length];
};

/** Bounds-fit painter projector for lit { corners, fill } faces; transparent background. */
export function projectFacesToSvg(faces, { azimuth = 45, elevation = 0.6, W = 640, H = 640, pad = 24 } = {}) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) {
    if (c[i] < min[i]) min[i] = c[i];
    if (c[i] > max[i]) max[i] = c[i];
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;
  const a = (azimuth / 180) * Math.PI;
  const R = radius * 3;
  const eye = [center[0] + R * Math.cos(a), center[1] + R * Math.sin(a), center[2] + radius * elevation * 2];
  const fwd = norm3(sub3(center, eye));
  const right = norm3([fwd[1], -fwd[0], 0]); // horizontal right for z-up
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];

  const newell = (pts) => {
    const n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      n[0] += (p[1] - q[1]) * (p[2] + q[2]);
      n[1] += (p[2] - q[2]) * (p[0] + q[0]);
      n[2] += (p[0] - q[0]) * (p[1] + q[1]);
    }
    return n;
  };

  const drawn = [];
  for (const f of faces) {
    if (dot3(newell(f.corners), sub3(eye, centroid3(f.corners))) <= 0) continue; // back-face cull
    const pts = f.corners.map((P) => {
      const d = sub3(P, eye);
      const z = dot3(d, fwd);
      return [dot3(d, right) / z, -dot3(d, up) / z, z];
    });
    drawn.push({ fill: f.fill, pts, depth: pts.reduce((s, p) => s + p[2], 0) / pts.length });
  }
  drawn.sort((p, q) => q.depth - p.depth);

  // fit the projected cloud into the canvas, aspect preserved
  let px = [Infinity, -Infinity];
  let py = [Infinity, -Infinity];
  for (const d of drawn) for (const [x, y] of d.pts) {
    if (x < px[0]) px[0] = x;
    if (x > px[1]) px[1] = x;
    if (y < py[0]) py[0] = y;
    if (y > py[1]) py[1] = y;
  }
  const s = Math.min((W - 2 * pad) / (px[1] - px[0] || 1), (H - 2 * pad) / (py[1] - py[0] || 1));
  const ox = (W - s * (px[1] - px[0])) / 2 - s * px[0];
  const oy = (H - s * (py[1] - py[0])) / 2 - s * py[0];

  const polys = drawn.map((d) => {
    const pts = d.pts.map(([x, y]) => `${(s * x + ox).toFixed(2)},${(s * y + oy).toFixed(2)}`).join(' ');
    return `<polygon points="${pts}" fill="${d.fill}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n${polys.join('\n')}\n</svg>`;
}

/**
 * Deterministic median-cut quantization: RGBA bytes → a pixelizer
 * raster at the register budget. 1-bit alpha at 128. Same input +
 * same budget → same palette order and same cell bytes (all sorts
 * carry full tiebreakers).
 */
export function quantizeRgbaToRaster(data, w, h, { budget = 15 } = {}) {
  const opaque = [];
  for (let i = 0; i < w * h; i++) {
    if (data[i * 4 + 3] >= 128) opaque.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  if (!opaque.length) {
    return { size: [w, h], palette: ['#000000'], cells: Array.from({ length: h }, () => '.'.repeat(w)) };
  }

  let boxes = [opaque];
  for (;;) {
    if (boxes.length >= budget) break;
    let bi = -1;
    let bc = 0;
    let best = 0;
    boxes.forEach((box, i) => {
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const p of box) {
          if (p[c] < lo) lo = p[c];
          if (p[c] > hi) hi = p[c];
        }
        const range = hi - lo;
        if (range > best) { best = range; bi = i; bc = c; }
      }
    });
    if (bi < 0 || best === 0) break;
    const box = boxes[bi];
    box.sort((p, q) => p[bc] - q[bc] || p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }

  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  const palette = [];
  const seen = new Map();
  const boxIndex = [];
  for (const box of boxes) {
    const avg = [0, 0, 0];
    for (const p of box) { avg[0] += p[0]; avg[1] += p[1]; avg[2] += p[2]; }
    const hex = `#${toHex(avg[0] / box.length)}${toHex(avg[1] / box.length)}${toHex(avg[2] / box.length)}`;
    if (!seen.has(hex)) { seen.set(hex, palette.length); palette.push(hex); }
    boxIndex.push(seen.get(hex));
  }

  const rgb = palette.map((hx) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)]);
  const nearest = (r, g, b) => {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < rgb.length; i++) {
      const d = (rgb[i][0] - r) ** 2 + (rgb[i][1] - g) ** 2 + (rgb[i][2] - b) ** 2;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  };

  const cells = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] < 128) { row.push('.'); continue; }
      row.push((nearest(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) + 1).toString(16));
    }
    cells.push(row.join(''));
  }
  return { size: [w, h], palette, cells };
}
