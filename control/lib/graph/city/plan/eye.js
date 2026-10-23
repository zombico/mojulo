/**
 * THE STALKER'S EYE — the air that carries a district past its edge (the city stalker). A district is a few hundred
 * metres across; from its tallest roof a hero sees kilometres. The air is the difference: it hides each ring's far edge
 * at the height it is seen from, as the pilot's eye's haze hides a flight map's (skyscape/map.js, the same law).
 *
 *   rings     distances from the district's middle, in metres:
 *               near     the district itself (its half-diagonal), at full detail, with colliders
 *               ring     the 140 m of real masses the level draws round it (scene.js)
 *               far      the rest of the plan, drawn as massing (one instance a lot)
 *               horizon  a seeded skyline band past the plan's edge, so the city never visibly ends
 *   haze      three's exponential fog (opaque where ρ·d reaches √(−ln(1 − 0.98)) ≈ 1.978), its density thinned with
 *             height (ρ(alt) = ρ₀ · H / (H + alt)): from the street the eye sees the ring and no further; from the
 *             district's tallest roof it sees the horizon band, its outer edge lost
 *
 *   stalkerEye(d, seg, { eye? }) → { rings, haze: { density, hazeHeight, see: { street, roof } }, top }   (metres)
 *   skylineFaces(d, eye, { fill, seed }) → faces (metres): the horizon band's cards, facing the city
 *
 * Pure, deterministic (seeded dice, mulberry32).
 */
import { mulberry32 } from '../../vegetation/grow.js';

/** How opaque the fog is where a ring is called hidden, and the ρ·d that is (three's FogExp2: 1 − e^−(ρd)²). */
export const OPAQUE = 0.98;
export const OPAQUE_RD = Math.sqrt(-Math.log(1 - OPAQUE));
/** The ring of real masses round a level's segment (scene.js), and the lowest hazeHeight (metres). */
export const RING = 140;
const H_MIN = 50;
const r3 = (v) => Math.round(v * 1000) / 1000;

export function stalkerEye(d, seg, { eye = 1.7 } = {}) {
  const R = seg.rect, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, { W, D } = d.frame;
  const near = Math.hypot(R.x1 - R.x0, R.y1 - R.y0) / 2;
  const far = Math.max(...[[0, 0], [W, 0], [0, D], [W, D]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const horizon = [far * 1.08, far * 1.4];
  // the tallest roof a hero stands on in the district (its own lots), the highest eye the air is planned for
  const own = d.lots.filter((l) => l.h > 0 && l.x1 > R.x0 && l.x0 < R.x1 && l.y1 > R.y0 && l.y0 < R.y1);
  const top = Math.max(eye + 1, ...own.map((l) => l.h));
  // the street sees to the ring's edge; the roof to the horizon band's outer edge
  const seeLow = near + RING, seeTop = horizon[1], thin = seeTop / seeLow;
  const H = Math.max(H_MIN, thin > 1 ? (top - thin * eye) / (thin - 1) : H_MIN);
  const density = OPAQUE_RD * (H + eye) / (H * seeLow);
  const seeAt = (alt) => OPAQUE_RD * (H + alt) / (density * H);
  return {
    rings: { near: r3(near), ring: r3(near + RING), far: r3(far), horizon: horizon.map(r3) },
    haze: { density: Number(density.toPrecision(6)), hazeHeight: r3(H), see: { street: r3(seeAt(eye)), roof: r3(seeAt(top)) } },
    top: r3(top),
  };
}

/** The horizon band: cards stood round the plan's middle between the band's radii, each facing in, their heights
 *  falling off the city's own (the tall ones near, the low ones far), so a hero on a roof sees a skyline in the haze. */
export function skylineFaces(d, E, { fill = '#2a2f37', seed = 1 } = {}) {
  const { W, D } = d.frame, cx = W / 2, cy = D / 2, [r0, r1] = E.rings.horizon, rand = mulberry32((seed * 2654435761) >>> 0 ^ 0x5ca1ab1e);
  const hs = d.lots.map((l) => l.h).filter((h) => h > 0).sort((a, b) => a - b), hTop = hs.length ? hs[Math.floor(hs.length * 0.9)] : 40;
  const n = Math.max(48, Math.round((2 * Math.PI * r0) / 60)), faces = [];
  for (let i = 0; i < n; i++) {
    const a = (i + rand() * 0.6) / n * 2 * Math.PI, depth = rand(), r = r0 + (r1 - r0) * depth;
    const w = (2 * Math.PI * r / n) * (0.8 + rand() * 0.9), h = hTop * (0.2 + 0.9 * rand() ** 1.6) * (1 - 0.5 * depth);
    const ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux, x = cx + ux * r, y = cy + uy * r;
    faces.push({
      corners: [[x - tx * w / 2, y - ty * w / 2, 0], [x + tx * w / 2, y + ty * w / 2, 0], [x + tx * w / 2, y + ty * w / 2, h], [x - tx * w / 2, y - ty * w / 2, h]].map((p) => p.map(r3)),
      normal: [r3(-ux), r3(-uy), 0], fill, group: 'city:skyline', doubleSided: true, noInk: true,
    });
  }
  return faces;
}
