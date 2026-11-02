/**
 * A STREETCAR standing at its stop (geocity/scene.js puts one on each track of a streetcar line where it crosses the
 * subway): a low-floor car in three articulated sections, red over a dark skirt with a white roof, its windows in a band,
 * double doors on its kerb side, a cab and its windscreen at each end, headlights, and its pantograph raised to the
 * overhead's contact wire.
 *
 *   streetcarFaces({ axis, at, s0, dir, side, z, wire }) → [{ corners, normal, group, hex } | { corners, fill, water }]
 *     axis   'ns' | 'ew': the street it runs on; at its track's line across (world x for 'ns', y for 'ew')
 *     s0     where its front stands along the street (its stop), dir +1 | -1 the way it runs, side +1 | -1 the side of its
 *            track its kerb (and its doors) is on, across
 *     z      (x, y) → the street's ground; wire the contact wire's height over it
 *
 * Metres, z up. Pure.
 */
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const STREETCAR = Object.freeze({ sections: 3, length: 9.6, gap: 0.5, width: 2.54, floor: 0.36, height: 3.5, red: '#c4302b', skirt: '#2a2c30', roof: '#e9e7e2', glass: 'rgba(28,36,44,0.82)', door: '#9aa0a6', lamp: '#fff4d0' });

export function streetcarFaces({ axis, at, s0, dir, side, z, wire = 5.6 }) {
  const out = [], C = STREETCAR, hw = C.width / 2;
  // (a point on the car: `u` along it back from its front, `v` across toward its kerb side, `h` over the street)
  const P = (u, v, h) => { const s = s0 - dir * u, c = at + side * v, [x, y] = axis === 'ns' ? [c, s] : [s, c]; return [r3(x), r3(y), r3(z(x, y) + h)]; };
  const nAlong = (sg) => (axis === 'ns' ? [0, sg * dir, 0] : [sg * dir, 0, 0]), nAcross = (sg) => (axis === 'ns' ? [sg * side, 0, 0] : [0, sg * side, 0]);
  const quad = (cs, n, hex, group = 'geocity:streetcar') => out.push({ corners: cs, normal: n, group, hex });
  const glass = (cs) => out.push({ corners: cs, fill: C.glass, water: true, doubleSided: true, group: 'geocity:streetcar-glass' });
  // a band of the car's side from u0 to u1, h0 to h1, on the side `sg` across (+1 its kerb side)
  const side1 = (u0, u1, h0, h1, sg, hex) => quad([P(u0, sg * hw, h0), P(u1, sg * hw, h0), P(u1, sg * hw, h1), P(u0, sg * hw, h1)], nAcross(sg), hex);
  for (let k = 0; k < C.sections; k++) {
    const u0 = k * (C.length + C.gap), u1 = u0 + C.length;
    for (const sg of [-1, 1]) {
      side1(u0, u1, 0.12, C.floor + 0.1, sg, C.skirt);
      side1(u0, u1, C.floor + 0.1, 1.05, sg, C.red);
      side1(u0, u1, 2.35, C.height - 0.2, sg, C.red);
      side1(u0, u1, C.height - 0.2, C.height, sg, C.roof);
      // (its window band: glass between pillars; on the kerb side, two double doors full height in it)
      const doors = sg > 0 ? [[u0 + 1.4, u0 + 2.8], [u1 - 2.8, u1 - 1.4]] : [];
      const cuts = [u0 + 0.2, ...doors.flat(), u1 - 0.2].sort((a, b) => a - b);
      side1(u0, u0 + 0.2, 1.05, 2.35, sg, C.red); side1(u1 - 0.2, u1, 1.05, 2.35, sg, C.red);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = cuts[i], b = cuts[i + 1], door = doors.some(([p, q]) => Math.abs(p - a) < 1e-6 && Math.abs(q - b) < 1e-6);
        if (door) { side1(a, b, C.floor + 0.1, 2.35, sg, C.door); quad([P(a, sg * (hw + 0.005), C.floor + 0.25), P((a + b) / 2 - 0.02, sg * (hw + 0.005), C.floor + 0.25), P((a + b) / 2 - 0.02, sg * (hw + 0.005), 2.2), P(a, sg * (hw + 0.005), 2.2)], nAcross(sg), '#5a6670'); continue; }
        const panes = Math.max(1, Math.round((b - a) / 1.6));
        for (let j = 0; j < panes; j++) {
          const pa = a + ((b - a) * j) / panes, pb = a + ((b - a) * (j + 1)) / panes;
          glass([P(pa + 0.05, sg * (hw + 0.01), 1.1), P(pb - 0.05, sg * (hw + 0.01), 1.1), P(pb - 0.05, sg * (hw + 0.01), 2.3), P(pa + 0.05, sg * (hw + 0.01), 2.3)]);
          side1(pb - 0.05, pb + 0.05, 1.05, 2.35, sg, C.red);
        }
      }
    }
    // (its roof, its floor's underside)
    quad([P(u0, -hw, C.height), P(u1, -hw, C.height), P(u1, hw, C.height), P(u0, hw, C.height)], [0, 0, 1], C.roof);
    // (the bellows between it and the next)
    if (k + 1 < C.sections) for (const sg of [-1, 1]) side1(u1, u1 + C.gap, 0.4, 3.2, sg * 0.92, '#26282c');
    // the pantograph on its middle section: two struts up to a collector bar under the wire
    if (k === 1) {
      const um = (u0 + u1) / 2, top = wire - 0.02;
      quad([P(um - 1.0, -0.5, C.height), P(um + 1.0, -0.5, C.height), P(um + 1.0, 0.5, C.height + 0.18), P(um - 1.0, 0.5, C.height + 0.18)], [0, 0, 1], '#3a3d42');
      for (const v of [-0.35, 0.35]) {
        quad([P(um - 0.7, v, C.height + 0.2), P(um - 0.62, v, C.height + 0.2), P(um + 0.04, v, (C.height + top) / 2), P(um - 0.04, v, (C.height + top) / 2)], nAcross(1), '#2e3236');
        quad([P(um - 0.04, v, (C.height + top) / 2), P(um + 0.04, v, (C.height + top) / 2), P(um - 0.62, v, top - 0.05), P(um - 0.7, v, top - 0.05)], nAcross(1), '#2e3236');
      }
      quad([P(um - 0.8, -0.75, top - 0.05), P(um - 0.6, -0.75, top - 0.05), P(um - 0.6, 0.75, top), P(um - 0.8, 0.75, top)], [0, 0, 1], '#55595e');
    }
  }
  // its two ends: a cab each, its windscreen, its headlights, its destination sign
  const L = C.sections * C.length + (C.sections - 1) * C.gap;
  for (const [u, sg] of [[0, 1], [L, -1]]) {
    const n = nAlong(sg);
    quad([P(u, -hw, 0.12), P(u, hw, 0.12), P(u, hw, 1.05), P(u, -hw, 1.05)], n, C.red);
    quad([P(u, -hw, 2.35), P(u, hw, 2.35), P(u, hw, C.height), P(u, -hw, C.height)], n, C.red);
    glass([P(u - sg * 0.01, -hw + 0.15, 1.05), P(u - sg * 0.01, hw - 0.15, 1.05), P(u - sg * 0.01, hw - 0.15, 2.35), P(u - sg * 0.01, -hw + 0.15, 2.35)]);
    for (const v of [-hw + 0.15, hw - 0.15]) quad([P(u + sg * 0.01, v, C.floor + 0.3), P(u + sg * 0.01, v + Math.sign(-v) * 0.3, C.floor + 0.3), P(u + sg * 0.01, v + Math.sign(-v) * 0.3, C.floor + 0.5), P(u + sg * 0.01, v, C.floor + 0.5)], n, C.lamp);
    quad([P(u + sg * 0.01, -0.7, 2.6), P(u + sg * 0.01, 0.7, 2.6), P(u + sg * 0.01, 0.7, 2.95), P(u + sg * 0.01, -0.7, 2.95)], n, '#f0a020');
  }
  return out;
}
