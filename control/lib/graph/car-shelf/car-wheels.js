/**
 * car-wheels — a composed car's wheels: the road wheel lathed (car-designer/road-wheel.js) in the shelf's styles, on
 * the tyre the car asks for.
 *
 *   styles   hubcap (a chrome-capped steel dish) | steelCap (a painted steel wheel, its small cap) | flatAlloy (a flat
 *            turbine face, its ring of slots) | multiSpoke (ten slim spokes) | fiveSpokeAlloy | sport (ten dark spokes)
 *            | aero (a near-flat cover) | offroad (a dark six-spoke dish) | wireVintage
 *   tyres    road | whitewall (a white band on the outer wall) | lowProfile (the rim the larger share of the
 *            radius) | allTerrain (the field's lugged tyre on a dark steel rim, car-designer/mil-wheel.js)
 *
 *   carWheel({ hub, r, width, style, tyre }) → form faces
 *   CAR_WHEEL_STYLES
 *
 * Vehicle space; the wheel turns about x, its face toward the side its hub is on. Pure and deterministic.
 */
import { roadWheel } from '../car-designer/road-wheel.js';
import { milWheel } from '../car-designer/mil-wheel.js';

const W = (o) => Object.freeze(o);
export const CAR_WHEEL_STYLES = Object.freeze({
  hubcap: W({ hex: '#d8dbde', spokes: 0, dish: 0.08, material: 'chrome', bright: true }),
  steelCap: W({ hex: '#aeb2b6', spokes: 0, dish: 0.2, vents: 6, material: 'paint' }),
  flatAlloy: W({ hex: '#b9bcc0', spokes: 0, dish: 0.07, vents: 12, material: 'alloy' }),
  multiSpoke: W({ hex: '#c9ccd0', spokes: 10, hubArc: 0.22, rimArc: 0.1, dish: 0.14, material: 'alloy' }),
  fiveSpokeAlloy: 'fiveSpokeAlloy',
  sport: W({ hex: '#46494e', spokes: 10, hubArc: 0.28, rimArc: 0.12, dish: 0.22, material: 'alloy' }),
  aero: W({ hex: '#d3d6da', spokes: 0, dish: 0.03, vents: 5, material: 'alloy' }),
  offroad: W({ hex: '#2c2f33', spokes: 6, hubArc: 0.5, rimArc: 0.34, dish: 0.3, material: 'paint' }),
  wireVintage: 'wireVintage',
});

const WHITEWALL = '#ecebe4';
export function carWheel({ hub, r, width, style = 'fiveSpokeAlloy', tyre = 'road' }) {
  if (tyre === 'allTerrain') return milWheel({ hub, r, width, paint: '#2c2f33' }).map((f) => ({ ...f, part: f.part.startsWith('wheel') || f.part === 'tyre' || f.part === 'sidewall' ? f.part : `wheel.${f.part}` }));
  const S = CAR_WHEEL_STYLES[style];
  if (S === undefined) throw new Error(`car-shelf: wheel '${style}' is one of ${Object.keys(CAR_WHEEL_STYLES).join(', ')}`);
  const faces = roadWheel({ hub, r, width, style: S, ...(tyre === 'lowProfile' ? { rim: 0.72 } : {}) });
  if (tyre !== 'whitewall') return faces;
  // the white band: the outer wall's lower run, from the bead to the bulge
  const out = Math.sign(hub[0]) || 1;
  return faces.map((f) => {
    if (f.part !== 'sidewall') return f;
    const c = f.corners.reduce((a, p) => [a[0] + p[0] / f.corners.length, a[1] + p[1] / f.corners.length, a[2] + p[2] / f.corners.length], [0, 0, 0]);
    const rho = Math.hypot(c[1] - hub[1], c[2] - hub[2]);
    return (c[0] - hub[0]) * out > 0 && rho < r * 0.82 ? { ...f, part: 'sidewall.white', albedo: WHITEWALL } : f;
  });
}
