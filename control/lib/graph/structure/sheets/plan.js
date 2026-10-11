/**
 * structure/sheets/plan — A-10x, the floor plan of one storey, drawn from the read model (structure/read.js) with
 * the drawing kit (kit.js), as a set draws it.
 *
 *   walls      cut and poched at true thickness, broken at every opening
 *   doors      the leaf at 90° and its swing arc, into the room the door serves
 *   windows    the jambs and two glass lines across the wall
 *   stairs     the flight under the void it rises through (UP), the void above it on the next storey (DN)
 *   verticals  a commercial stack's escalators (UP / DN by direction) and lift shafts (a crossed shaft), and the
 *              atrium void on the level it opens (OPEN TO BELOW); each tagged (ES1, EL2, AT1)
 *   objects    projected outlines (a rug hidden), tagged by FF&E type
 *   tags       room (name, number, area), door (101A), window type (A), wall type (1)
 *   dimensions three strings a side: the openings at their centrelines, the partitions, the overall
 *
 * Pure: the read and the options give the bytes. No new geometry: every line is a projection of what the kernel
 * already built (walls, openings, slab voids, placements).
 */

import {
  n2, esc, makeView, fitScale, dimChain, dimension, doorTag, windowTag, objectTag, wallTag, roomTag,
  northArrow, scaleBar, titleBlock, drawingTitle, sheetSvg,
} from './kit.js';

const STRINGS = 9;          // mm between dimension strings
const FIRST = 12;           // mm from the wall face to the first string

/** The sheet id for a storey's plan: A-101 for the ground, A-102 the next, A-100 a basement. */
export const planSheetId = (index) => `A-${100 + Math.max(0, index + 1)}`;

const STOREY_TITLE = (s) => (s.index < 0 ? 'Basement floor plan' : s.index === 0 ? 'Ground floor plan' : `${['Second', 'Third', 'Fourth', 'Fifth', 'Sixth'][s.index - 1] || `Level ${s.number}`} floor plan`);
export const planTitle = STOREY_TITLE;

/** A wall's opening spans along its run, sorted: [{ a, b, o }] (o: the door or window). */
function spansOf(wall, openings) {
  const along = (o) => (wall.orientation === 'h' ? o.at.x : o.at.y);
  return openings.filter((o) => o.host === wall.tag).map((o) => ({ a: along(o) - o.width / 2, b: along(o) + o.width / 2, o })).sort((p, q) => p.a - q.a);
}

/** The plan rect of [s0, s1] along a wall, t thick, straddling its line. */
const rectAlong = (wall, s0, s1, t) => (wall.orientation === 'h'
  ? { x: s0, y: wall.at - t / 2, w: s1 - s0, h: t }
  : { x: wall.at - t / 2, y: s0, w: t, h: s1 - s0 });

/**
 * The drawing of one storey's plan, in sheet mm through `view`. → string of SVG marks. `opts.tags` (default true)
 * draws the tags; `opts.dims` (default true) the dimension strings; `opts.objects` (default true) the furniture.
 */
export function planDrawing(read, storeyIndex, view, opts = {}) {
  const units = opts.units || 'imperial';
  const walls = read.elements.walls.filter((w) => w.storey === storeyIndex);
  const doors = read.elements.doors.filter((d) => d.storey === storeyIndex);
  const windows = read.elements.windows.filter((w) => w.storey === storeyIndex);
  const rooms = read.rooms.filter((r) => r.storey === storeyIndex);
  const roomByTag = new Map(read.rooms.map((r) => [r.tag, r]));
  const R = (r, cls) => `<rect class="${cls}" x="${n2(view.x(r.x))}" y="${n2(view.y(r.y))}" width="${n2(view.len(r.w))}" height="${n2(view.len(r.h))}"/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls}" x1="${n2(view.x(x1))}" y1="${n2(view.y(y1))}" x2="${n2(view.x(x2))}" y2="${n2(view.y(y2))}"/>`;
  const out = { walls: [], openings: [], stairs: [], objects: [], tags: [], dims: [] };

  // ── stairs: the flight below its void (UP), the void on the storey it reaches (DN) ──
  for (const st of read.elements.stairs) {
    if (!st.slot) continue;
    const s = st.slot;
    const up = st.from === storeyIndex, dn = st.to === storeyIndex;
    if (!up && !dn) continue;
    const along = s.w >= s.h;                   // the flight runs along the slot's long side
    const n = Math.max(3, Math.round((along ? s.w : s.h) / 0.85));
    const treads = [];
    for (let i = 1; i < n; i++) {
      const f = i / n;
      treads.push(along ? L(s.x + f * s.w, s.y, s.x + f * s.w, s.y + s.h, up ? 's-proj' : 's-hid') : L(s.x, s.y + f * s.h, s.x + s.w, s.y + f * s.h, up ? 's-proj' : 's-hid'));
    }
    const c = [view.x(s.x + s.w / 2), view.y(s.y + s.h / 2)];
    out.stairs.push(`<g class="s-stair" data-tag="${esc(st.tag)}">${R(s, up ? 's-proj' : 's-hid')}${treads.join('')}`
      + `<text class="s-tb" text-anchor="middle" x="${n2(c[0])}" y="${n2(c[1] + 0.9)}">${up ? 'UP' : 'DN'}</text></g>`);
  }

  // ── a commercial stack's escalators, lifts and atrium ──
  for (const v of read.elements.verticals || []) {
    if (!v.rects || (v.from !== storeyIndex && v.to !== storeyIndex)) continue;
    const top = v.to === storeyIndex;
    const marks = v.rects.map((r) => {
      const c = [view.x(r.x + r.w / 2), view.y(r.y + r.h / 2)];
      if (v.kind === 'elevator') return `${R(r, 's-proj')}${L(r.x, r.y, r.x + r.w, r.y + r.h, 's-hid')}${L(r.x + r.w, r.y, r.x, r.y + r.h, 's-hid')}`;
      const along = r.h >= r.w, n = Math.max(4, Math.round((along ? r.h : r.w) / 1.4));
      const steps = Array.from({ length: n - 1 }, (_, i) => { const f = (i + 1) / n; return along ? L(r.x, r.y + f * r.h, r.x + r.w, r.y + f * r.h, top ? 's-hid' : 's-proj') : L(r.x + f * r.w, r.y, r.x + f * r.w, r.y + r.h, top ? 's-hid' : 's-proj'); });
      return `${R(r, top ? 's-hid' : 's-proj')}${steps.join('')}<text class="s-tb" text-anchor="middle" x="${n2(c[0])}" y="${n2(c[1] + 0.9)}">${r.dir === 'down' ? 'DN' : r.dir === 'up' ? 'UP' : ''}</text>`;
    });
    const r0 = v.rects[0];
    out.stairs.push(`<g class="s-vertical" data-tag="${esc(v.tag)}">${marks.join('')}<text class="s-tb" text-anchor="middle" x="${n2(view.x(r0.x + r0.w / 2))}" y="${n2(view.y(r0.y) - 1.2)}">${esc(v.tag)}</text></g>`);
  }
  for (const a of read.elements.voids || []) {
    if (a.to !== storeyIndex) continue;
    const r = a.rect, c = [view.x(r.x + r.w / 2), view.y(r.y + r.h / 2)];
    out.stairs.push(`<g class="s-void" data-tag="${esc(a.tag)}">${R(r, 's-hid')}${L(r.x, r.y, r.x + r.w, r.y + r.h, 's-hid')}${L(r.x + r.w, r.y, r.x, r.y + r.h, 's-hid')}<text class="s-tb" text-anchor="middle" x="${n2(c[0])}" y="${n2(c[1] + 0.9)}">${esc(a.tag)} OPEN TO BELOW</text></g>`);
  }

  // ── objects: their outlines, a rug hidden ──
  if (opts.objects !== false) {
    for (const p of read.objects.pieces.filter((x) => x.storey === storeyIndex)) {
      const soft = p.type === 'rug' || p.type === 'runner';
      out.objects.push(`<g class="s-object" data-mark="${esc(p.mark)}">${R(p.rect, soft ? 's-hid' : 's-proj')}</g>`);
    }
  }

  // ── walls: poched, broken at each opening; exterior runs carried past their ends to close the corners ──
  for (const w of walls) {
    const spans = spansOf(w, [...doors, ...windows]);
    const ext = w.interior ? 0 : w.thickness / 2;
    let cursor = w.along[0] - ext;
    const piers = [];
    for (const sp of spans) { if (sp.a > cursor) piers.push([cursor, sp.a]); cursor = Math.max(cursor, sp.b); }
    if (cursor < w.along[1] + ext) piers.push([cursor, w.along[1] + ext]);
    out.walls.push(`<g class="s-wall" data-tag="${esc(w.tag)}" data-type="${esc(w.type)}">${piers.map(([a, b]) => R(rectAlong(w, a, b, w.thickness), 's-poche')).join('')}</g>`);

    for (const sp of spans) {
      const o = sp.o;
      const t = w.thickness;
      const jamb = (s) => (w.orientation === 'h' ? L(s, w.at - t / 2, s, w.at + t / 2, 's-cut') : L(w.at - t / 2, s, w.at + t / 2, s, 's-cut'));
      if (o.mark) {
        // a window: the jambs, the frame across the wall, two glass lines
        const g = [jamb(sp.a), jamb(sp.b), R(rectAlong(w, sp.a, sp.b, t), 's-proj'),
          ...[-0.08, 0.08].map((d) => (w.orientation === 'h' ? L(sp.a, w.at + d, sp.b, w.at + d, 's-dim') : L(w.at + d, sp.a, w.at + d, sp.b, 's-dim')))];
        out.openings.push(`<g class="s-window" data-mark="${esc(o.mark)}" data-tag="${esc(o.tag)}">${g.join('')}</g>`);
        continue;
      }
      // a cased opening (a storefront, a pass): the jambs and the head above it, dashed, and no leaf
      if (o.cased) {
        const head = w.orientation === 'h' ? L(sp.a, w.at, sp.b, w.at, 's-hid') : L(w.at, sp.a, w.at, sp.b, 's-hid');
        out.openings.push(`<g class="s-door s-cased" data-tag="${esc(o.tag)}">${jamb(sp.a)}${jamb(sp.b)}${head}</g>`);
        continue;
      }
      // a door: the leaf open at 90° into the room it serves, hinged at its start, and the swing arc
      const served = roomByTag.get(o.serves);
      let side = 1;
      if (served) {
        const mid = w.orientation === 'h' ? served.rect.y + served.rect.h / 2 : served.rect.x + served.rect.w / 2;
        side = mid >= w.at ? 1 : -1;
      } else if (w.exteriorSide) side = -w.exteriorSide;
      const face = w.at + side * t / 2;
      const len = sp.b - sp.a;
      let d;
      if (w.orientation === 'h') {
        const hx = sp.a, hy = face, ex = sp.a, ey = face + side * len;
        d = `${L(hx, hy, ex, ey, 's-proj')}<path class="s-dim" d="M${n2(view.x(ex))} ${n2(view.y(ey))}A${n2(view.len(len))} ${n2(view.len(len))} 0 0 ${side > 0 ? 0 : 1} ${n2(view.x(sp.b))} ${n2(view.y(face))}"/>`;
      } else {
        const hx = face, hy = sp.a, ex = face + side * len, ey = sp.a;
        d = `${L(hx, hy, ex, ey, 's-proj')}<path class="s-dim" d="M${n2(view.x(ex))} ${n2(view.y(ey))}A${n2(view.len(len))} ${n2(view.len(len))} 0 0 ${side > 0 ? 1 : 0} ${n2(view.x(face))} ${n2(view.y(sp.b))}"/>`;
      }
      out.openings.push(`<g class="s-door" data-tag="${esc(o.tag)}">${jamb(sp.a)}${jamb(sp.b)}${d}</g>`);
    }
  }

  // ── tags ──
  if (opts.tags !== false) {
    // door tags first: the room tags then keep clear of them
    const doorBoxes = [];
    for (const d of doors) {
      // the tag sits in the room the door serves, a little in from the opening
      const served = roomByTag.get(d.serves);
      const w = walls.find((x) => x.tag === d.host);
      let dx = 0, dy = 0;
      if (served && w) {
        const into = w.orientation === 'h' ? Math.sign(served.rect.y + served.rect.h / 2 - w.at) || 1 : Math.sign(served.rect.x + served.rect.w / 2 - w.at) || 1;
        if (w.orientation === 'h') dy = into * 5; else dx = into * 6.5;
      }
      const at = [view.x(d.at.x) + dx, view.y(d.at.y) + dy];
      const bw = (Math.max(6, d.tag.length * 1.55 + 1.6) + 1) / view.mmPerFt, bh = 4.6 / view.mmPerFt;
      doorBoxes.push({ x: d.at.x + dx / view.mmPerFt - bw / 2, y: d.at.y + dy / view.mmPerFt - bh / 2, w: bw, h: bh });
      out.tags.push(doorTag(at, d.tag));
    }
    // a room tag stands where the room is clearest: the first of the centre and the thirds that no piece covers
    const pieces = opts.objects !== false ? read.objects.pieces.filter((x) => x.storey === storeyIndex && x.type !== 'rug' && x.type !== 'runner') : [];
    const tagBox = (c, r) => { const w = Math.max(String(r.name).length * 1.75, 16) / view.mmPerFt, h = 7 / view.mmPerFt; return { x: c[0] - w / 2, y: c[1] - h / 2 - 1 / view.mmPerFt, w, h }; };
    const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const roomTagAt = new Map();
    const stairRects = [...read.elements.stairs.filter((st) => st.slot && (st.from === storeyIndex || st.to === storeyIndex)).map((st) => st.slot),
      ...(read.elements.verticals || []).filter((v) => v.rects && (v.from === storeyIndex || v.to === storeyIndex)).flatMap((v) => v.rects)];
    for (const r of rooms) {
      const { x, y, w, h } = r.rect;
      const spots = [[0.5, 0.5], [0.5, 0.3], [0.5, 0.7], [0.3, 0.5], [0.7, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7], [0.5, 0.15], [0.5, 0.85]];
      const free = spots.map(([u, v]) => [x + u * w, y + v * h]).find((c) => !pieces.some((p) => p.room === r.tag && hits(tagBox(c, r), p.rect)) && !doorBoxes.some((b) => hits(tagBox(c, r), b)) && !stairRects.some((b) => hits(tagBox(c, r), b)));
      const c = free || [x + w / 2, y + h / 2];
      roomTagAt.set(r.tag, tagBox(c, r));
      out.tags.push(roomTag([view.x(c[0]), view.y(c[1])], { name: r.name, number: r.tag, area: r.area, units }));
    }
    for (const w of windows) {
      const host = walls.find((x) => x.tag === w.host);
      const outSide = host && host.exteriorSide ? host.exteriorSide : -1;
      const off = 5;
      out.tags.push(windowTag(host && host.orientation === 'v' ? [view.x(w.at.x) + outSide * off, view.y(w.at.y)] : [view.x(w.at.x), view.y(w.at.y) + outSide * off], w.tag));
    }
    // one wall type tag per type on this storey, at the middle of its longest wall
    const seen = new Set();
    for (const w of [...walls].sort((a, b) => b.length - a.length || (a.tag < b.tag ? -1 : 1))) {
      if (seen.has(w.type)) continue;
      seen.add(w.type);
      // at the middle of the wall's longest solid stretch, on its inside face (clear of every opening and its tag)
      const spans = spansOf(w, [...doors, ...windows]);
      let best = [w.along[0], w.along[1]], cur = w.along[0], bestLen = -1;
      for (const sp of [...spans, { a: w.along[1], b: w.along[1] }]) { if (sp.a - cur > bestLen) { bestLen = sp.a - cur; best = [cur, sp.a]; } cur = Math.max(cur, sp.b); }
      const m = (best[0] + best[1]) / 2;
      const inward = w.interior ? 1 : -(w.exteriorSide || 1);
      const sideOff = inward * ((w.thickness / 2) * view.mmPerFt + 3.4);
      out.tags.push(w.orientation === 'h' ? wallTag([view.x(m), view.y(w.at) + sideOff], w.type) : wallTag([view.x(w.at) + sideOff, view.y(m)], w.type));
    }
    // one tag per furniture type in each room, on its largest piece (six chairs at a table are one CH-1, as an FF&E
    // plan tags them); a lamp or a vase is in the schedule, not tagged on the plan; a tag never sits on a room tag
    const tagged = new Set();
    for (const p of [...pieces].sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h) || (a.mark < b.mark ? -1 : 1))) {
      const k = `${p.room}|${p.tag}`;
      if (tagged.has(k) || p.rect.w * p.rect.h < 2) continue;
      const c = { x: p.rect.x + p.rect.w / 2, y: p.rect.y + p.rect.h / 2 };
      const r = 3 / view.mmPerFt;
      const box = { x: c.x - r, y: c.y - r, w: 2 * r, h: 2 * r };
      if (p.room && roomTagAt.has(p.room) && hits(box, roomTagAt.get(p.room))) continue;
      tagged.add(k);
      out.tags.push(objectTag([view.x(c.x), view.y(c.y)], p.tag));
    }
  }

  // ── dimensions: openings, partitions, overall, on each side ──
  if (opts.dims !== false && read.footprint) {
    const fp = read.footprint;
    const tExt = Math.max(0, ...walls.filter((w) => !w.interior).map((w) => w.thickness));
    const faceN = fp.y0 - tExt / 2, faceS = fp.y1 + tExt / 2, faceW = fp.x0 - tExt / 2, faceE = fp.x1 + tExt / 2;
    const sides = [
      { name: 'N', h: true, at: fp.y0, face: faceN, lo: faceW, hi: faceE, sign: 1 },
      { name: 'S', h: true, at: fp.y1, face: faceS, lo: faceW, hi: faceE, sign: -1 },
      { name: 'W', h: false, at: fp.x0, face: faceW, lo: faceN, hi: faceS, sign: -1 },
      { name: 'E', h: false, at: fp.x1, face: faceE, lo: faceN, hi: faceS, sign: 1 },
    ];
    for (const sd of sides) {
      // h sides measure x along y = face; a left-to-right run puts a positive offset up the sheet (north); flip for S
      const toSheet = (s) => (sd.h ? [view.x(s), view.y(sd.face)] : [view.x(sd.face), view.y(s)]);
      const onSide = (w) => !w.interior && w.orientation === (sd.h ? 'h' : 'v') && Math.abs(w.at - sd.at) < 0.5;
      const sideWalls = walls.filter(onSide);
      const centres = [...doors, ...windows].filter((o) => sideWalls.some((w) => w.tag === o.host)).map((o) => (sd.h ? o.at.x : o.at.y));
      const parts = walls.filter((w) => w.interior && w.orientation === (sd.h ? 'v' : 'h') && Math.abs((sd.h ? (sd.name === 'N' ? w.along[0] : w.along[1]) : (sd.name === 'W' ? w.along[0] : w.along[1])) - sd.at) < 0.6).map((w) => w.at);
      // offset sign: the kit's offset is to the left of a→b; for N (a→b left to right) left is up (outside) → +;
      // for S, outside is down → −; for W (a→b top to bottom) left is east (inside) → so outside is −; E → +
      const off = (k) => sd.sign * (FIRST + k * STRINGS);
      let k = 0;
      if (centres.length) out.dims.push(dimChain([sd.lo, ...centres, sd.hi], toSheet, { offset: off(k++), units }));
      if (parts.length) out.dims.push(dimChain([sd.lo, ...parts, sd.hi], toSheet, { offset: off(k++), units }));
      out.dims.push(dimension(toSheet(sd.lo), toSheet(sd.hi), sd.hi - sd.lo, { offset: off(k), units }));
    }
  }

  return `<g class="s-plan" data-storey="${storeyIndex}">${out.stairs.join('')}${out.objects.join('')}${out.walls.join('')}${out.openings.join('')}${out.tags.join('')}${out.dims.join('')}</g>`;
}

/** The room a plan of this storey needs on the sheet (ft): the footprint plus the dimension strings each side. */
function planExtent(read, view) {
  const fp = read.footprint;
  const margin = (FIRST + 3 * STRINGS + 6) / view.mmPerFt;
  return { x0: fp.x0 - margin, y0: fp.y0 - margin, x1: fp.x1 + margin, y1: fp.y1 + margin };
}

/**
 * A-10x: one storey's plan on an ANSI B sheet, at the largest standard scale that holds it with its dimensions,
 * with the drawing title, the north arrow, the scale bar and the title block. → { id, title, scale, svg }
 */
export function planSheet(read, storeyIndex, { units = 'imperial', project, size = 'ANSI B', revision = null, sheetOf = null } = {}) {
  const storey = read.storeys.find((s) => s.index === storeyIndex);
  if (!storey || !read.footprint) return null;
  const id = planSheetId(storeyIndex);
  const title = STOREY_TITLE(storey);
  const probe = titleBlock({ size });
  const [dx, dy, dw, dh] = probe.drawing;
  const fp = read.footprint;
  const marginMm = 2 * (FIRST + 3 * STRINGS + 6);
  const titleRoom = 16;
  // fit: the largest scale whose footprint plus strings fits the drawing area above the drawing title
  let scale = fitScale([fp.x1 - fp.x0, fp.y1 - fp.y0], [dw - marginMm, dh - marginMm - titleRoom], units);
  const view0 = makeView({ scale, origin: [0, 0], at: [0, 0] });
  const ext = planExtent(read, view0);
  const wMm = (ext.x1 - ext.x0) * view0.mmPerFt, hMm = (ext.y1 - ext.y0) * view0.mmPerFt;
  const at = [dx + (dw - wMm) / 2, dy + Math.max(0, (dh - titleRoom - hMm) / 2)];
  const view = makeView({ scale, origin: [ext.x0, ext.y0], at });
  const block = titleBlock({ size, project: project || read.title || `mojulo ${read.occupancy?.label ?? 'house'}`, title, id, scale, revision, sheetOf });
  const body = [
    planDrawing(read, storeyIndex, view, { units }),
    drawingTitle([dx + 4, dy + dh - 8], { detail: '1', title, scale, sheet: id }),
    northArrow([dx + dw - 12, dy + 14], 0),
    scaleBar([dx + dw - 80, dy + dh - 9], view, units),
  ].join('');
  return { id, title, scale, svg: sheetSvg({ size, body, block }) };
}
