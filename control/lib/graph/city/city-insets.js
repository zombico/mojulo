/**
 * city-insets — a MINTED edifice placed inside the generated fractal city (print-loop-demo,
 * 2026-09-08). The pure half: an edifice manifest becomes faces in CITY units plus the plot the
 * planner must reserve. The DB half (ref → manifest) lives in `worlds/city-insets.js`, so
 * `planFractalCity` stays DB-free.
 *
 * Units: the edifice is authored in feet (FLOOR_FT per storey); the city's residential storey
 * is STOREY_H city units. One factor converts everything — footprint, height, face corners.
 */
import { planEdifice, buildEdificeFaces, FLOOR_FT } from '../architecture/edifice.js';
import { STOREY_H } from './fractal-city.js';

export const CITY_UNITS_PER_FOOT = STOREY_H / FLOOR_FT;
export const DEFAULT_INSET_MARGIN = 0.6;   // the sidewalk ring around the plot, city units

/**
 * insetFromEdifice(manifest, { at, margin, light }) → inset
 *   at      [x, y] city units — the plot's min corner (the edifice's bounds min lands here)
 *   margin  city units of plaza ring around the plot (default DEFAULT_INSET_MARGIN)
 * Returns { plot, footprint, faces, textures, envelopes, floors, title } — all in city units.
 * `plot` is the building's own footprint; `footprint` is plot + margin (what the planner claims).
 */
export function insetFromEdifice(manifest, { at = [0, 0], margin = DEFAULT_INSET_MARGIN, light } = {}) {
  const plan = planEdifice(manifest);
  const { faces, textures } = buildEdificeFaces(plan, { light });
  const s = CITY_UNITS_PER_FOOT;
  const b = plan.bounds;
  const ax = Number(at[0]) || 0, ay = Number(at[1]) || 0;
  const tx = (x) => ax + (x - b.x0) * s, ty = (y) => ay + (y - b.y0) * s, tz = (z) => z * s;
  const out = faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [tx(x), ty(y), tz(z)]) }));
  const plot = { x: ax, y: ay, w: (b.x1 - b.x0) * s, d: (b.y1 - b.y0) * s };
  const m = Math.max(0, Number(margin) || 0);
  const footprint = { x: plot.x - m, y: plot.y - m, w: plot.w + 2 * m, d: plot.d + 2 * m };
  const envelopes = plan.envelopes.map((e) => ({ x: tx(e.x0), y: ty(e.y0), w: (e.x1 - e.x0) * s, d: (e.y1 - e.y0) * s, z0: 0, z1: tz(e.top) }));
  const floors = plan.masses.reduce((mx, mm) => Math.max(mx, mm.floors || 0), 0);
  return { plot, footprint, faces: out, textures, envelopes, floors, title: manifest.title || null };
}
