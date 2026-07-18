/**
 * Skin projection — the polygomer WEARS a diffusion skin (the approximation
 * between the deterministic polygonizer and a painted render).
 *
 * A skin PNG is painted OVER a polygomer's filled control scaffold
 * (`renderManjiTreeToSvg(m, { control:true })`) from a FIXED camera, so the skin
 * is already registered to the render in screen space. For each filled face in
 * the control SVG, we sample the skin at the face's normalized screen centroid
 * for its ALBEDO, then multiply by the face's deterministic Lambert factor
 * (carried as `data-shade`) — so the SKIN supplies colour and the POLYGONIZER
 * supplies 3D form. No UV unwrap — the shared camera IS the registration.
 *
 * The result is a DETERMINISTIC render that wears the skin's colours with the
 * recipe's lit form (studs and rivets read as rounded metal, not flat stickers).
 * Doctrine: the skin PNG stays a bound render/provenance; the recipe stays
 * sovereign. Single-view — front faces are faithful; the back wraps front
 * colours (full coverage is the turntable multi-view bake).
 */

import { scaleHex, hexToRgb, rgbToHex, litFactor, newellNormal, orientOutward, centroid } from './vexar.js';
import { projectTwoPoint } from './pure-mandala.js';

// Matches a lit face polygon, optionally carrying data-shade (the Lambert factor).
const POLY_RE =
  /<polygon points="([^"]+)" fill="[^"]+" stroke="[^"]+" stroke-width="([^"]+)" stroke-linejoin="round"(?: data-shade="([\d.]+)")?\/>/g;

function clamp01(t) {
  return t < 0 ? 0 : t > 0.999 ? 0.999 : t;
}

/** Parse the `x y W H` viewBox the face screen coords live in. */
export function parseViewBox(svg) {
  const m = svg.match(/viewBox="([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+)"/);
  if (!m) throw new Error('skin-projection: control SVG has no viewBox');
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

function colorDist(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/**
 * Inspect a skin raster: the corner is the background; the mean of everything
 * NOT near the background is the fallback colour for faces whose screen centroid
 * misses the creature (the pale-edge-dot fix).
 */
export function analyzeSkin({ data, width, height, channels }) {
  const at = (px, py) => {
    const i = (py * width + px) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // background = average of the four corners
  const corners = [at(1, 1), at(width - 2, 1), at(1, height - 2), at(width - 2, height - 2)];
  const background = [0, 1, 2].map((c) => Math.round(corners.reduce((s, p) => s + p[c], 0) / 4));
  // fallback = mean of foreground pixels (coarse grid scan)
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 96));
  for (let py = 0; py < height; py += step) {
    for (let px = 0; px < width; px += step) {
      const c = at(px, py);
      if (colorDist(c, background) > 40) {
        r += c[0];
        g += c[1];
        b += c[2];
        n += 1;
      }
    }
  }
  const fallback = n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [58, 58, 64];
  return { background: rgbToHex(background), fallback: rgbToHex(fallback) };
}

/**
 * Build a sampler from a raw pixel buffer (e.g. sharp(png).ensureAlpha().raw()).
 * With `{ background, fallback }`, a sample that lands on the background (a face
 * whose centroid missed the creature silhouette) returns the fallback albedo
 * instead of a stray background colour.
 * @returns {(u:number,v:number)=>string} (u,v)∈[0,1] → '#rrggbb'
 */
export function rasterSampler({ data, width, height, channels, background = null, fallback = null, bgTolerance = 30 }) {
  if (!data || !width || !height || !channels) {
    throw new Error('skin-projection: rasterSampler needs { data, width, height, channels }');
  }
  const bg = background ? hexToRgb(background) : null;
  const fb = fallback || null;
  return (u, v) => {
    const px = Math.min(width - 1, Math.floor(clamp01(u) * width));
    const py = Math.min(height - 1, Math.floor(clamp01(v) * height));
    const i = (py * width + px) * channels;
    const rgb = [data[i], data[i + 1], data[i + 2]];
    if (bg && fb && colorDist(rgb, bg) < bgTolerance) return fb;
    return rgbToHex(rgb);
  };
}

/**
 * Reskin a filled (control) manji-tree SVG: replace each face's vexar fill with
 * the skin ALBEDO sampled at the face's normalized screen centroid, multiplied
 * by the face's `data-shade` Lambert factor (deterministic form-shading) when
 * present.
 *
 * @param {string} controlSvg  renderManjiTreeToSvg(m, { control:true })
 * @param {(u:number,v:number)=>string} sampler  → albedo hex
 * @returns {{ svg:string, faces:number }}
 */
export function reskinManjiSvg(controlSvg, sampler) {
  if (typeof controlSvg !== 'string') throw new Error('skin-projection: controlSvg must be a string');
  if (typeof sampler !== 'function') throw new Error('skin-projection: sampler must be a function');
  const vb = parseViewBox(controlSvg);
  let faces = 0;
  const svg = controlSvg.replace(POLY_RE, (_m, pts, sw, shadeStr) => {
    const coords = pts.trim().split(/\s+/).map((p) => p.split(',').map(Number));
    let cx = 0;
    let cy = 0;
    for (const c of coords) {
      cx += c[0];
      cy += c[1];
    }
    cx /= coords.length;
    cy /= coords.length;
    const u = (cx - vb.x) / vb.w;
    const v = (cy - vb.y) / vb.h;
    const albedo = sampler(u, v);
    // SKIN = albedo, POLYGONIZER = form: multiply by the Lambert factor so every
    // face reads as lit 3D, integrating small studs instead of flat stickers.
    const col = shadeStr ? scaleHex(albedo, Number(shadeStr)) : albedo;
    faces += 1;
    return `<polygon points="${pts}" fill="${col}" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  });
  return { svg, faces };
}

/** Mean of all face corners — the outward-orientation reference for shading. */
export function objectCenter(faces) {
  let n = 0;
  const c = [0, 0, 0];
  for (const f of faces) for (const p of f.corners) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; n += 1; }
  return n ? [c[0] / n, c[1] / n, c[2] / n] : [0, 0, 0];
}

/**
 * Bake a skin onto baked world faces: sample the skin at each face's projected
 * centroid for ALBEDO, times the face's Lambert factor for FORM. Faces keep
 * everything but their fill. Generic over any `lowerObjectFaces`-shaped face
 * list (manji-tree, workbench, assembler) — the camera/viewBox pair must be
 * the SAME one the painted control scaffold was rendered with (the shared
 * camera IS the registration).
 * @param {Array} faces  ({ corners:[[x,y,z]×4], fill, … })
 * @param {object} opts  { sampler, viewBox, camera, roomBasis, light }
 */
export function bakeSkinOntoFaces(faces, { sampler, viewBox, camera = {}, roomBasis = {}, light }) {
  if (!light) throw new Error('skin-projection: bakeSkinOntoFaces requires the light the faces were lowered with');
  const center = objectCenter(faces);
  return faces.map((f) => {
    const cen = centroid(f.corners); // [x,y,z]
    const [sx, sy] = projectTwoPoint({ x: cen[0], y: cen[1], z: cen[2] }, camera, roomBasis);
    const u = (sx - viewBox.x) / viewBox.w;
    const v = (sy - viewBox.y) / viewBox.h;
    const albedo = sampler(u, v);
    const normal = orientOutward(newellNormal(f.corners), cen, center);
    const fill = scaleHex(albedo, litFactor(normal, light));
    return { ...f, fill };
  });
}
