/**
 * structure/sheets/elevations — A-201, the four exterior elevations, projected from the read model.
 *
 * Each face is drawn as its viewer sees it (the north elevation is seen from the north, so east is on its left):
 * the storey bands and their floor lines, every window and door on that face at its sill and head, the roof planes
 * painted far to near, the ground line heavy, a level head at each floor, the overall height dimensioned.
 * It replaces the storey-band elevation the floorplan kernel once drew with a drawing a set would print.
 */

import { n2, esc, dimension, lengthText, titleBlock, drawingTitle, sheetSvg, SCALES } from './kit.js';

/** The four faces: how a plan point maps onto each (u across the face as seen, depth away from its viewer). */
export const FACES = {
  N: { name: 'North elevation', u: (x) => -x, depth: (x, y) => y, h: true, side: (fp) => fp.y0 },
  S: { name: 'South elevation', u: (x) => x, depth: (x, y) => -y, h: true, side: (fp) => fp.y1 },
  E: { name: 'East elevation', u: (x, y) => -y, depth: (x) => -x, h: false, side: (fp) => fp.x1 },
  W: { name: 'West elevation', u: (x, y) => y, depth: (x) => x, h: false, side: (fp) => fp.x0 },
};

/** The levels a section or elevation heads: each storey's floor, and the top of the highest wall. */
export function levelsOf(read) {
  const ground = read.storeys.find((s) => s.index === 0) || read.storeys[0];
  const z0 = ground.baseZ;
  const rows = [...read.storeys].sort((a, b) => a.index - b.index).map((s) => ({ name: s.index < 0 ? `BASEMENT` : `LEVEL ${s.number}`, z: s.baseZ, rel: s.baseZ - z0 }));
  const top = [...read.storeys].sort((a, b) => b.index - a.index)[0];
  rows.push({ name: 'T.O. WALL', z: top.baseZ + top.height, rel: top.baseZ + top.height - z0 });
  return rows;
}

/** A level head: a datum line across, a target at its end, the name and its height above level 1. */
export function levelHead(x0, x1, y, { name, rel }, units) {
  return `<g class="s-level"><line class="s-grid" x1="${n2(x0)}" y1="${n2(y)}" x2="${n2(x1)}" y2="${n2(y)}"/>`
    + `<circle class="s-paper" cx="${n2(x1 + 3)}" cy="${n2(y)}" r="1.8"/><path class="s-fill" d="M${n2(x1 + 3)} ${n2(y)}L${n2(x1 + 4.8)} ${n2(y)}A1.8 1.8 0 0 0 ${n2(x1 + 3)} ${n2(y - 1.8)}Z"/><path class="s-fill" d="M${n2(x1 + 3)} ${n2(y)}L${n2(x1 + 1.2)} ${n2(y)}A1.8 1.8 0 0 0 ${n2(x1 + 3)} ${n2(y + 1.8)}Z"/>`
    + `<text class="s-tb" x="${n2(x1 + 6)}" y="${n2(y - 0.6)}">${esc(name)}</text><text class="s-ts" x="${n2(x1 + 6)}" y="${n2(y + 2.4)}">${esc(lengthText(rel, units))}</text></g>`;
}

/** The face's extent: u across (ft) and z up, with the exterior wall thickness. */
function faceExtent(read, face) {
  const fp = read.footprint;
  const t = Math.max(0, ...read.elements.walls.filter((w) => !w.interior).map((w) => w.thickness));
  const ws = [face.u(fp.x0 - t / 2, fp.y0 - t / 2), face.u(fp.x1 + t / 2, fp.y1 + t / 2)];
  const us = [...ws];
  // the eaves stand past the walls: the roof's corners widen the face
  if (read.elements.roof) for (const p of read.elements.roof.planes) for (const c of p.corners) us.push(face.u(c[0], c[1]));
  const levels = levelsOf(read);
  const zLo = Math.min(...read.storeys.map((s) => s.baseZ)) - read.floorDrop;
  let zHi = levels[levels.length - 1].z;
  const roof = read.elements.roof;
  if (roof) for (const p of roof.planes) for (const c of p.corners) zHi = Math.max(zHi, c[2]);
  return { u0: Math.min(...us), u1: Math.max(...us), w0: Math.min(...ws), w1: Math.max(...ws), zLo, zHi, t };
}

/**
 * One elevation, its lower-left (u0, zLo) at sheet `at` (the ground line), at `scale`. → SVG marks
 */
export function elevationDrawing(read, side, at, scale, { units = 'imperial' } = {}) {
  const face = FACES[side];
  const ex = faceExtent(read, face);
  const k = 304.8 / SCALES[scale].ratio;
  const X = (u) => at[0] + (u - ex.u0) * k;
  const Y = (z) => at[1] - (z - ex.zLo) * k;
  const out = [];
  const fp = read.footprint;
  const sideAt = face.side(fp);

  // the storey bands (projected), the floor line between them, the outline heavy
  const storeys = [...read.storeys].sort((a, b) => a.index - b.index);
  for (const s of storeys) {
    out.push(`<rect class="s-proj" x="${n2(X(ex.w0))}" y="${n2(Y(s.baseZ + s.height))}" width="${n2((ex.w1 - ex.w0) * k)}" height="${n2((s.height + read.floorDrop) * k)}"/>`);
  }
  const zTop = storeys[storeys.length - 1].baseZ + storeys[storeys.length - 1].height;
  out.push(`<rect class="s-cut" style="stroke-width:0.35" x="${n2(X(ex.w0))}" y="${n2(Y(zTop))}" width="${n2((ex.w1 - ex.w0) * k)}" height="${n2((zTop - ex.zLo) * k)}"/>`);

  // the openings on this face, at their sill and head
  const onFace = (w) => !w.interior && (face.h ? w.orientation === 'h' : w.orientation === 'v') && Math.abs(w.at - sideAt) < 0.5;
  const faceWalls = new Set(read.elements.walls.filter(onFace).map((w) => w.tag));
  const zOf = (st) => read.storeys.find((s) => s.index === st).baseZ;
  for (const o of [...read.elements.windows, ...read.elements.doors]) {
    if (!faceWalls.has(o.host)) continue;
    const c = face.u(o.at.x, o.at.y);
    const a = c - o.width / 2, b = c + o.width / 2;
    const z0 = zOf(o.storey) + (o.sill || 0), z1 = z0 + o.height;
    const r = `<rect class="s-paper" style="stroke-width:0.25" x="${n2(X(a))}" y="${n2(Y(z1))}" width="${n2(o.width * k)}" height="${n2(o.height * k)}"/>`;
    if (o.mark) {
      // a window: the frame, the meeting rail, a sill below
      out.push(`<g class="s-window" data-mark="${esc(o.mark)}">${r}<line class="s-dim" x1="${n2(X(a))}" y1="${n2(Y((z0 + z1) / 2))}" x2="${n2(X(b))}" y2="${n2(Y((z0 + z1) / 2))}"/><line class="s-proj" x1="${n2(X(a - 0.25))}" y1="${n2(Y(z0))}" x2="${n2(X(b + 0.25))}" y2="${n2(Y(z0))}"/></g>`);
    } else {
      out.push(`<g class="s-door" data-tag="${esc(o.tag)}">${r}<line class="s-dim" x1="${n2(X(c))}" y1="${n2(Y(z1))}" x2="${n2(X(c))}" y2="${n2(Y(z0))}"/></g>`);
    }
  }

  // the roof: each plane painted far to near so the near ones cover the far (paper filled, projected lines)
  const roof = read.elements.roof;
  if (roof) {
    const planes = roof.planes.map((p) => ({ p, d: Math.max(...p.corners.map((c) => face.depth(c[0], c[1]))) })).sort((a, b) => b.d - a.d);
    for (const { p } of planes) {
      const pts = p.corners.map((c) => `${n2(X(face.u(c[0], c[1])))},${n2(Y(c[2]))}`).join(' ');
      out.push(`<polygon class="s-paper" style="stroke-width:0.25" points="${pts}"/>`);
    }
  }

  // the ground line, heavy, past both ends
  out.push(`<line class="s-cut" style="stroke-width:0.7" x1="${n2(X(ex.u0) - 8)}" y1="${n2(Y(ex.zLo))}" x2="${n2(X(ex.u1) + 8)}" y2="${n2(Y(ex.zLo))}"/>`);
  // level heads to the right, the overall height to the left
  for (const L of levelsOf(read)) out.push(levelHead(X(ex.u0) - 4, X(ex.u1) + 10, Y(L.z), L, units));
  const zMax = Math.max(zTop, ex.zHi);
  out.push(dimension([X(ex.u0), Y(ex.zLo)], [X(ex.u0), Y(zMax)], zMax - ex.zLo, { offset: 10, units }));
  return `<g class="s-elevation" data-side="${side}">${out.join('')}</g>`;
}

/** The sheet room one elevation takes at a scale (mm): its width with the level heads, its height. */
export function elevationSize(read, side, scale) {
  const ex = faceExtent(read, FACES[side]);
  const k = 304.8 / SCALES[scale].ratio;
  return [(ex.u1 - ex.u0) * k + 48, (Math.max(ex.zHi, ...levelsOf(read).map((l) => l.z)) - ex.zLo) * k + 6];
}

/**
 * A-201 and A-202: the elevations two to a sheet, one above the other at the full drawing width (south and north,
 * then east and west), at the largest standard scale that holds both faces of the set. One scale for all four, so
 * the faces read against each other. → [{ id, title, scale, sides, svg }]
 */
export function elevationsSheets(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  if (!read.footprint) return [];
  const [dx, dy, dw, dh] = titleBlock({ size }).drawing;
  const cellW = dw, cellH = dh / 2;
  const pairs = [['S', 'N'], ['E', 'W']];
  const keys = units === 'metric' ? ['1:50', '1:100', '1:200'] : ['1/4', '3/16', '1/8', '3/32', '1/16'];
  const scale = keys.find((s) => ['S', 'N', 'E', 'W'].every((sd) => { const [w, h] = elevationSize(read, sd, s); return w + 24 <= cellW && h + 22 <= cellH; })) || keys[keys.length - 1];
  return pairs.map((sides, si) => {
    const id = `A-20${si + 1}`, title = 'Exterior elevations';
    const body = [];
    sides.forEach((sd, i) => {
      const cy = dy + i * cellH;
      const [w, h] = elevationSize(read, sd, scale);
      const at = [dx + 18 + Math.max(0, (cellW - 24 - w) / 2), cy + 6 + h + Math.max(0, (cellH - 22 - h) / 2)];
      body.push(elevationDrawing(read, sd, at, scale, { units }));
      body.push(drawingTitle([dx + 6, cy + cellH - 9], { detail: String(i + 1), title: FACES[sd].name, scale, sheet: id }));
    });
    const block = titleBlock({ size, project: project || read.title || 'mojulo house', title, id, scale, revision, sheetOf: null });
    return { id, title, scale, sides, svg: sheetSvg({ size, body: body.join(''), block }) };
  });
}
