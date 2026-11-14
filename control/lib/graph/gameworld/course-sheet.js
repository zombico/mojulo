/**
 * THE COURSE SHEET — the design book's page where a rolled course's layers are seen TOGETHER, without running the
 * game: the way and its asks, the walls beside it, the backdrop behind it (course-dress.js, course-scenery.js). One
 * sheet, because they are one design: whoever works the walls sees the asks they must not shout over, and whoever
 * works the asks sees what they are read against.
 *
 *   THE FRAME     the screen as the course's own camera frames it (course-view.js), drawn from the course's own faces
 *                 and the things one roll stands: nothing here is a sketch of the level, it is the level's geometry
 *                 projected. Its thirds are ruled across it and named: where stuff comes from (the backdrop's), where
 *                 it comes to view (the walls' and the asks'), where you react (the character's). Drawn twice: from
 *                 the start, and in the middle of the course with the walls alongside.
 *   THE SLICES    A and B in elevation, as the way sees them, to scale
 *   THE PALETTE   every role's colour, by layer
 *   THE LAWS      the dress's one gate, each law and what it says
 *
 *   courseFrame(course, { seed?, at?, aspect?, vfov?, width? }) → { svg, width, height, drawn }
 *       at      how far along the course the hero stands, metres (0: the start)
 *   sliceElevation(slice, { gap, palette, scale? }) → { svg, width, height }
 *   courseSheetHtml(course, { title?, seed?, aspect?, vfov? }) → the page
 *
 * A painter's drawing (far faces first, no depth buffer): right for a sheet, not a render. The eyes gate (is it
 * handsome, does it read as the place) is the operator's, on the page the game draws. Pure and deterministic.
 */
import { courseObstacles, blockLen, PRIMITIVES } from './roll-course.js';
import { VFOV, ASPECT } from './course-view.js';
import { DRESS_ROLES } from './course-dress.js';
import { skyAt } from './course-scenery.js';
import { hexToRgb, rgbToHex } from '../color-theorist/oklab.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r1 = (v) => Math.round(v * 10) / 10;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const NEAR = 0.4;
const hexOf = (fill) => (typeof fill === 'string' ? fill : Array.isArray(fill) ? rgbToHex(fill.map((v) => v * 255)) : '#888888');
// (a thing's side is a touch darker than its top, so a box reads as a box on a flat drawing)
const shade = (hex, k) => rgbToHex(hexToRgb(hex).map((v) => v * k));

/** A box as the faces a frame draws: the side toward the start, the two flanks, the top. */
function boxFaces(min, max, hex) {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  return [
    { corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], fill: hex },
    { corners: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], fill: shade(hex, 0.8) },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], fill: shade(hex, 0.8) },
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], fill: shade(hex, 1.12) },
  ];
}

export function courseFrame(course, { seed = 1, at = 0, aspect = ASPECT, vfov = VFOV, width = 560 } = {}) {
  const height = Math.round(width / aspect), C = course.camera, col = course.dress.palette;
  const pos = [0, at - C.dist, C.height], fwd = unit(sub([0, at + C.lead, C.lookH], pos)), right = unit(cross(fwd, [0, 0, 1])), up = cross(right, fwd);
  const ty = Math.tan((vfov * Math.PI) / 360), tx = ty * aspect;
  const cam = (p) => { const d = sub(p, pos); return [dot(d, right), dot(d, up), dot(d, fwd)]; };
  // what one roll stands, as boxes, with its tells; and the figure where the hero stands
  const stands = new Set(courseObstacles(course, seed).map((o) => `s${o.k + 1}-${o.id}`)), faces = course.faces.map((f) => ({ corners: f.corners, fill: hexOf(f.fill) }));
  for (const b of course.blocks) {
    if (!stands.has(b.id)) continue;
    const P = PRIMITIVES[b.id.replace(/^s\d+-/, '')], hx = (b.form === 'crate' ? b.size[0] : b.length) / 2, hy = blockLen(b) / 2;
    // (a bare block is its marks alone, a thing drawn whole; else its box, with what is drawn on it over it. Its tell on
    // the ground goes down first)
    if (b.bare !== true) faces.push(...boxFaces([b.at[0] - hx, b.at[1] - hy, 0], [b.at[0] + hx, b.at[1] + hy, P.h], hexOf(b.tint)));
    for (const m of b.marks ?? []) { const ground = m.corners.every((c) => c[2] < 0.05); faces.push({ corners: m.corners, fill: hexOf(m.fill), ...(ground ? { flat: true } : b.bare === true ? {} : { over: true }) }); }
  }
  faces.push(...boxFaces([-0.28, at - 0.2, 0], [0.28, at + 0.2, 1.05], '#e9e4d8'), ...boxFaces([-0.34, at - 0.3, 1.05], [0.34, at + 0.3, 1.7], '#f4efe4'));
  const drawn = [];
  for (const f of faces) {
    let poly = f.corners.map(cam);
    if (poly.every((p) => p[2] < NEAR)) continue;
    // (cut at the near plane: a face that passes the eye is drawn up to it)
    if (poly.some((p) => p[2] < NEAR)) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[2] >= NEAR, ib = b[2] >= NEAR;
        if (ia) out.push(a);
        if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
      }
      poly = out;
    }
    if (poly.length < 3) continue;
    const pts = poly.map((p) => [(0.5 + p[0] / (2 * p[2] * tx)) * width, (0.5 - p[1] / (2 * p[2] * ty)) * height]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > width || Math.max(...ys) < 0 || Math.min(...ys) > height) continue;
    if ((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) < 0.4) continue;
    // far first; paint on the ground goes down before what stands at the same depth
    drawn.push({ z: Math.max(...poly.map((p) => p[2])) + (f.flat ? 0.5 : f.over ? -0.6 : 0), d: pts.map((p) => `${r1(Math.max(-width, Math.min(2 * width, p[0])))},${r1(Math.max(-height, Math.min(2 * height, p[1])))}`).join(' '), fill: f.fill });
  }
  drawn.sort((a, b) => b.z - a.z);
  const y1 = r1(height / 3), y2 = r1((2 * height) / 3), id = `clip-${seed}-${Math.round(at)}-${width}`;
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10">`,
    `<defs><clipPath id="${id}"><rect width="${width}" height="${height}"/></clipPath></defs><g clip-path="url(#${id})"><rect width="${width}" height="${height}" fill="${col.sky}"/>`,
    ...drawn.map((p) => `<polygon points="${p.d}" fill="${p.fill}"/>`), '</g>',
    `<line x1="0" x2="${width}" y1="${y1}" y2="${y1}" stroke="#ffffff" stroke-opacity="0.75" stroke-dasharray="5 4"/><line x1="0" x2="${width}" y1="${y2}" y2="${y2}" stroke="#ffffff" stroke-opacity="0.75" stroke-dasharray="5 4"/>`,
    ...[['where stuff comes from · the backdrop', 12], ['where it comes to view · the walls, the asks', y1 + 12], ['where you react · the character', y2 + 12]].map(([t, y]) => `<text x="6" y="${r1(y)}" fill="#ffffff" fill-opacity="0.9" style="paint-order:stroke" stroke="#000000" stroke-opacity="0.45" stroke-width="2.5">${esc(t)}</text>`),
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#2b2a27"/>`, '</svg>'].join('\n');
  return { svg, width, height, drawn: drawn.length };
}

export function sliceElevation(slice, { gap, palette, scale = 14 } = {}) {
  const tall = Math.max(6, ...slice.parts.map((p) => p.box[5])) + 1, width = Math.round(gap * scale), height = Math.round(tall * scale);
  const parts = [...slice.parts].sort((a, b) => b.box[1] - a.box[1]);
  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`, `<rect width="${width}" height="${height}" fill="${skyAt(palette, 0.35)}"/>`,
    ...parts.map((p) => { const [u0, , z0, u1, , z1] = p.box; return `<rect x="${r1(u0 * width)}" y="${r1(height - z1 * scale)}" width="${r1((u1 - u0) * width)}" height="${r1((z1 - z0) * scale)}" fill="${palette[p.role]}"/>`; }),
    // (the hero beside it, for scale: 1.7 m)
    `<rect x="${r1(width - 1.2 * scale)}" y="${r1(height - 1.7 * scale)}" width="${r1(0.5 * scale)}" height="${r1(1.7 * scale)}" fill="#f4efe4" fill-opacity="0.85"/>`, '</svg>'].join('\n');
  return { svg, width, height };
}

const LAYERS = [['The backdrop', ['sky', 'horizon', 'far', 'mid', 'land']], ['The walls', ['flank', 'flank2', 'trim', 'iron', 'lamp']], ['The way', ['ground', 'ground2', 'sleeper', 'rail', 'kerb', 'wall']], ['The asks', ['jump', 'jump2', 'steer']], ['The tells and the end', ['tell-jump', 'tell-steer', 'exit']]];

export function courseSheetHtml(course, { title = 'Course', seed = 1, aspect = ASPECT, vfov = VFOV } = {}) {
  const D = course.dress, col = D.palette, mid = course.slots[Math.min(2, course.slots.length - 1)].y - course.reactAt - 4, fw = aspect < 1 ? 300 : 560;
  const frames = [[0, 'from the start'], [r1(mid), `${r1(mid)} m in, before the third ask`]].map(([at, says]) => `<figure>${courseFrame(course, { seed, at, aspect, vfov, width: fw }).svg}<figcaption>roll ${seed}, ${esc(says)}</figcaption></figure>`).join('');
  const slices = [['A', D.walls.a], ['B', D.walls.b]].map(([k, s]) => `<figure>${sliceElevation(s, { gap: course.gap, palette: col }).svg}<figcaption><b>${k}</b> · ${esc(s.name)} · ${s.parts.length} parts · ${esc(s.says)}</figcaption></figure>`).join('');
  const swatches = LAYERS.map(([name, roles]) => `<div class="layer"><h3>${esc(name)}</h3>${roles.filter((r) => DRESS_ROLES.includes(r)).map((r) => `<span class="sw"><i style="background:${col[r]}"></i>${r}<small>${col[r]}</small></span>`).join('')}</div>`).join('');
  const laws = D.laws.map((l) => `<li class="${l.holds ? 'ok' : 'lost'}"><b>${esc(l.law)}</b> ${l.holds ? 'holds' : 'does not hold'} · ${esc(l.says)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · course sheet</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#ebe7dd;color:#2b2a27;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:1180px;margin:0 auto;padding:24px 16px}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 8px}h3{font-size:12px;margin:0 0 6px;color:#6b675e;font-weight:600}p{margin:0 0 12px;color:#6b675e;max-width:80ch}.row{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;max-width:100%}figure svg{max-width:100%;height:auto;display:block}figcaption{font-size:12px;color:#6b675e;margin-top:4px;max-width:60ch}.layer{min-width:150px}.sw{display:flex;align-items:center;gap:8px;font-size:12px;margin:3px 0}.sw i{width:26px;height:18px;border:1px solid #2b2a2733;display:inline-block}.sw small{color:#8a857a}ul{list-style:none;padding:0;margin:0}li{padding:5px 0 5px 12px;border-left:3px solid #7a9a6a;margin:4px 0;font-size:13px}li.lost{border-left-color:#c2553a}table{border-collapse:collapse;font-size:13px}th{text-align:left;font-weight:600;padding:3px 18px 3px 0;color:#6b675e;white-space:nowrap;vertical-align:top}td{padding:3px 0}</style></head><body><main>
<h1>${esc(title)} · course sheet</h1>
<p>${esc(D.name)}${D.own ? ', written for this course' : ''}. The way, the asks, the walls and the backdrop on one sheet: they share the screen, so they are designed as one. The frames are the course's own geometry through its own camera, one roll standing; the eyes gate is the game's page.</p>
${D.premise ? `<h2>The premise</h2><p><b>${esc(D.premise)}</b></p><table>${[['The lanes', 'lanes'], ['Go over, low', 'hurdle'], ['Go over, tall', 'block'], ['Go round', 'posts'], ['The jump\'s tell', 'tell-jump'], ['The steer\'s tell', 'tell-steer'], ['Overhead', 'overhead'], ['Beyond the walls', 'beyond'], ['Walls, A', 'a'], ['Walls, B', 'b'], ['The backdrop', 'backdrop'], ['The end', 'end']].map(([n, k]) => `<tr><th>${n}</th><td>${esc(D.things[k] ?? 'not named')}</td></tr>`).join('')}</table>` : ''}
<h2>The frame</h2><div class="row">${frames}</div>
<h2>The walls · left ${esc(course.scenery.left)} · right ${esc(course.scenery.right)}</h2><p>A slice is one segment long (${course.gap} m, ${r1(course.gap / course.pace.top)} s at the hero's top speed). A is the slice the eye is given; B lets it be seen. Neither side runs three alike or repeats a pair.</p><div class="row">${slices}</div>
<h2>The backdrop · ${esc(D.backdrop.name)}</h2><p>${esc(D.backdrop.says)}. ${D.backdrop.skyline.length} silhouettes, the sky in ${D.backdrop.bands} steps, ${Math.round(course.scenery.far - course.length)} m past the course's end.</p>
<h2>The palette, by layer</h2><div class="row">${swatches}</div>
<h2>The laws (a machine gate: they advise)</h2><ul>${laws}</ul>
</main></body></html>`;
}
