/**
 * structure/sheets/framing — the S-sheets, the frame as a framer reads it, projected from the frame the world lowers
 * (structure/trades.js `readFraming`).
 *
 *   S-101        foundation plan: stem walls and grade beams poched, footings and pads hidden, posts and columns
 *                filled, girders, the lowest floor's joists as a field
 *   S-102 …      per storey: its walls (the plates), headers, posts, beams and braces, and the joists of the floor
 *                above it as a field ("Second floor framing plan"), its stair opening outlined and crossed; a top
 *                storey with no floor above is its walls
 *   S-1xx        roof framing plan: ridge, hips and purlins, the rafters as a field per fall, ceiling joists
 *
 * A singular member carries its type mark (B1, H2, P1; one mark per type where the marks would crowd); a repeated one
 * is a field: an arrow across its bearings with its size and spacing. Each sheet has a framing key: every mark and
 * field on it, its member, size and count, and the studs by size and spacing. Pure: the read gives the bytes.
 */

import { n2, esc, ftIn, makeView, fitScale, dimension, memberTag, fieldArrow, northArrow, scaleBar, titleBlock, drawingTitle, sheetSvg } from './kit.js';
import { tableSvg } from './schedules.js';
import { ROLES } from '../trades.js';

const KEY_W = 96;           // mm: the framing key's column, right of the plan
const MARGIN = 20;          // mm: one overall dimension string a side
const inchOC = (ft) => `${Math.round(ft * 12)}" O.C.`;
const FLOOR = ['Ground', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
const floorName = (i) => (i < 0 ? 'Basement' : FLOOR[i] || `Level ${i + 1}`);

/** The plan view for a sheet that keeps a key column on its right: the largest standard scale that holds `ext` (ft). */
export function planWithKey(read, { size = 'ANSI B', units = 'imperial', keyW = KEY_W, ext = read.footprint } = {}) {
  const [dx, dy, dw, dh] = titleBlock({ size }).drawing;
  const titleRoom = 16;
  const box = [dw - keyW - 2 * MARGIN, dh - titleRoom - 2 * MARGIN];
  const scale = fitScale([ext.x1 - ext.x0, ext.y1 - ext.y0], box, units);
  const mmPerFt = makeView({ scale }).mmPerFt;
  const wMm = (ext.x1 - ext.x0) * mmPerFt, hMm = (ext.y1 - ext.y0) * mmPerFt;
  const at = [dx + MARGIN + (box[0] - wMm) / 2, dy + MARGIN + Math.max(0, (box[1] - hMm) / 2)];
  const view = makeView({ scale, origin: [ext.x0, ext.y0], at });
  return { view, scale, area: [dx, dy, dw, dh], key: [dx + dw - keyW, dy + 4, keyW - 4], titleAt: [dx + 4, dy + dh - 8] };
}

/** The overall dimensions of the footprint: one string above and one to the left. */
export function overallDims(read, view, units) {
  const fp = read.footprint;
  return dimension([view.x(fp.x0), view.y(fp.y0)], [view.x(fp.x1), view.y(fp.y0)], fp.x1 - fp.x0, { offset: 10, units })
    + dimension([view.x(fp.x0), view.y(fp.y0)], [view.x(fp.x0), view.y(fp.y1)], fp.y1 - fp.y0, { offset: -10, units });
}

/** What a frame's sheet is called, and its id. */
export function frameSheets(read) {
  const c = read.construction;
  if (!c || !c.frames) return [];
  const storeyFrames = c.frames.filter((f) => /^storey-/.test(f.id)).sort((a, b) => a.storey - b.storey);
  const out = [];
  const fnd = c.frames.find((f) => f.id === 'foundation');
  if (fnd) out.push({ frame: fnd, title: 'Foundation plan' });
  for (const f of storeyFrames) {
    const floors = f.fields.some((x) => x.role === 'joist');
    out.push({ frame: f, title: floors ? `${floorName(f.storey + 1)} floor framing plan` : `${floorName(f.storey)} floor wall framing plan` });
  }
  const roof = c.frames.find((f) => f.id === 'roof');
  if (roof) out.push({ frame: roof, title: 'Roof framing plan' });
  return out.map((s, i) => ({ ...s, id: `S-${101 + i}` }));
}

/**
 * The drawing of one frame in plan, in sheet mm through `view`. → { svg, marks: [tags drawn], fields }
 */
export function frameDrawing(read, frame, view, { units = 'imperial' } = {}) {
  const P = (p) => [view.x(p[0]), view.y(p[1])];
  const line = (m, cls) => { const a = P(m.from), b = P(m.to); return `<line class="${cls}" data-member="${esc(m.id)}" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}"/>`; };
  // a level member as its plan band (true width, straddling its line)
  const band = (m, cls, w = m.width) => {
    const x0 = Math.min(m.from[0], m.to[0]), x1 = Math.max(m.from[0], m.to[0]), y0 = Math.min(m.from[1], m.to[1]), y1 = Math.max(m.from[1], m.to[1]);
    const r = m.axis === 'x' ? { x: x0, y: m.from[1] - w / 2, w: x1 - x0, h: w } : { x: m.from[0] - w / 2, y: y0, w, h: y1 - y0 };
    return `<rect class="${cls}" data-member="${esc(m.id)}" x="${n2(view.x(r.x))}" y="${n2(view.y(r.y))}" width="${n2(view.len(r.w))}" height="${n2(view.len(r.h))}"/>`;
  };
  // a standing member (post, column, pad) as its square, never smaller than a mark can read
  const square = (m, cls, s = Math.max(m.width, 0.33)) => `<rect class="${cls}" data-member="${esc(m.id)}" x="${n2(view.x(m.from[0] - s / 2))}" y="${n2(view.y(m.from[1] - s / 2))}" width="${n2(view.len(s))}" height="${n2(view.len(s))}"/>`;
  const out = { under: [], walls: [], members: [], fields: [], marks: [] };
  const roleIs = (m, ...r) => r.includes(m.role);
  const ms = frame.members;
  const hasPlate = ms.some((m) => roleIs(m, 'plate', 'dodai'));

  for (const m of ms) {
    const R = ROLES[m.role] || {};
    if (R.stud || R.field || R.skip || R.slab) continue;
    if (R.band) { if (m.axis === 'x' || m.axis === 'y') out.under.push(band(m, 's-poche')); continue; }
    if (roleIs(m, 'footing')) { out.under.push(m.axis === 'z' ? square(m, 's-hid') : band(m, 's-hid')); continue; }
    if (roleIs(m, 'pad')) { out.under.push(square(m, 's-hid', m.width)); continue; }
    if (R.wall) {
      // the wall's line: the bottom plate (or, with none, the top), lying flat, so drawn at its wide face
      const lower = roleIs(m, 'plate', 'dodai');
      if ((lower || (!hasPlate && roleIs(m, 'top-plate', 'wall-plate'))) && (m.axis === 'x' || m.axis === 'y')) out.walls.push(band(m, 's-proj', Math.max(m.width, m.depth)));
      continue;
    }
    if (m.axis === 'z') { out.members.push(square(m, roleIs(m, 'post', 'column', 'hashira') ? 's-poche' : 's-proj')); continue; }
    if (roleIs(m, 'brace', 'nuki')) { out.members.push(line(m, 's-hid')); continue; }
    if (R.tag) { out.members.push(line(m, 's-cut')); continue; }
    out.members.push(line(m, 's-proj'));
  }

  // the floor this frame carries (the foundation the lowest; a storey frame with joists, the floor above it) and its
  // openings: a stair void drawn as a framing plan marks one, outlined and crossed, named for its flight
  const floorIndex = frame.id === 'foundation' ? Math.min(...read.storeys.map((x) => x.index)) : frame.fields.some((x) => x.role === 'joist') ? frame.storey + 1 : null;
  const slab = floorIndex == null ? null : read.elements.slabs.find((x) => x.storey === floorIndex);
  for (const h of slab ? slab.holes : []) {
    const st = read.elements.stairs.find((x) => x.slot && Math.abs(x.slot.x - h.x) < 0.05 && Math.abs(x.slot.y - h.y) < 0.05);
    const [x0, y0, x1, y1] = [view.x(h.x), view.y(h.y), view.x(h.x + h.w), view.y(h.y + h.h)];
    out.under.push(`<g class="s-opening"${st ? ` data-tag="${esc(st.tag)}"` : ''}><rect class="s-proj" x="${n2(x0)}" y="${n2(y0)}" width="${n2(x1 - x0)}" height="${n2(y1 - y0)}"/>`
      + `<line class="s-dim" x1="${n2(x0)}" y1="${n2(y0)}" x2="${n2(x1)}" y2="${n2(y1)}"/><line class="s-dim" x1="${n2(x1)}" y1="${n2(y0)}" x2="${n2(x0)}" y2="${n2(y1)}"/>`
      + `<text class="s-tb s-halo" text-anchor="middle" x="${n2((x0 + x1) / 2)}" y="${n2((y0 + y1) / 2 - 1)}">STAIR OPENING</text>`
      + `<text class="s-ts s-halo" text-anchor="middle" x="${n2((x0 + x1) / 2)}" y="${n2((y0 + y1) / 2 + 2.4)}">${st ? `${esc(st.tag)} · ` : ''}${esc(ftIn(h.w))} x ${esc(ftIn(h.h))}</text></g>`);
  }

  // fields: an arrow across the bearings, the size and spacing along it; fields that share a line are staggered across
  // their extent (rafters and ceiling joists over one bay read as two arrows, not one)
  const used = [];
  for (const f of frame.fields) {
    const R = ROLES[f.role] || {};
    const text = `${f.size}${f.spacing ? ` @ ${inchOC(f.spacing)}` : ''}`;
    const inset = Math.min(1, (f.span[1] - f.span[0]) * 0.1);
    // an arrow never runs through an opening (its label would sit on the opening's)
    const holes = slab ? slab.holes : [];
    const throughHole = (at) => holes.some((h) => (f.axis === 'y'
      ? at > h.x - 1 && at < h.x + h.w + 1 && f.span[0] < h.y + h.h && h.y < f.span[1]
      : at > h.y - 1 && at < h.y + h.h + 1 && f.span[0] < h.x + h.w && h.x < f.span[1]));
    const clash = (at) => throughHole(at) || used.some((u) => u.axis === f.axis && Math.abs(u.at - at) < 2.5 && u.span[0] < f.span[1] && f.span[0] < u.span[1]);
    const at = [0.5, 0.3, 0.7, 0.15, 0.85].map((k) => f.from + (f.to - f.from) * k).find((v) => !clash(v)) ?? f.at;
    used.push({ axis: f.axis, at, span: f.span });
    const [a, b] = f.axis === 'x' ? [[f.span[0] + inset, at], [f.span[1] - inset, at]] : [[at, f.span[0] + inset], [at, f.span[1] - inset]];
    out.fields.push(fieldArrow(P(a), P(b), null, null, `${R.name ? R.name.toUpperCase().replace(/ \(.*\)/, '') : f.role.toUpperCase()}: ${text}`, { role: f.role }));
  }

  // marks: a tagged member, unless one of its type already stands within 9 mm (posts in a row read as one mark)
  const placed = [];
  const marks = new Set();
  // a hidden member (a nuki through its posts) is in the key, not marked; a type of many pieces is marked at four,
  // spread through its pieces in reading order, so a hundred hashira read as posts without a hundred marks
  const byTag = new Map();
  for (const m of ms) if (m.tag && !roleIs(m, 'nuki', 'brace')) { if (!byTag.has(m.tag)) byTag.set(m.tag, []); byTag.get(m.tag).push(m); }
  const tagged = [];
  for (const tag of [...byTag.keys()].sort()) {
    const list = byTag.get(tag).sort((a, b) => (a.from[1] - b.from[1]) || (a.from[0] - b.from[0]) || (a.id < b.id ? -1 : 1));
    if (list.length <= 8) { tagged.push(...list); continue; }
    for (let i = 0; i < 4; i++) tagged.push(list[Math.floor(((i + 0.5) * list.length) / 4)]);
  }
  for (const m of tagged) {
    const mid = m.axis === 'z' ? [m.from[0], m.from[1]] : [(m.from[0] + m.to[0]) / 2, (m.from[1] + m.to[1]) / 2];
    const s = P(mid);
    const at = m.axis === 'z' ? [s[0] + 3.2, s[1] - 3.2] : m.axis === 'y' ? [s[0] + 3.8, s[1]] : [s[0], s[1] - 2.6];
    if (placed.some((q) => (q.tag === m.tag && Math.hypot(q.at[0] - at[0], q.at[1] - at[1]) < 9) || Math.hypot(q.at[0] - at[0], q.at[1] - at[1]) < 4.5)) continue;
    placed.push({ tag: m.tag, at });
    marks.add(m.tag);
    out.marks.push(memberTag(at, m.tag));
  }
  const svg = `<g class="s-frame" data-frame="${esc(frame.id)}">${out.under.join('')}${out.walls.join('')}${out.members.join('')}${out.fields.join('')}${out.marks.join('')}</g>`;
  return { svg, marks: [...marks].sort(), fields: frame.fields };
}

/** The framing key for one frame: the marks on it, its fields and its studs. → a table for `tableSvg`. */
export function framingKey(read, frame) {
  const types = new Map((read.construction.memberTypes || []).map((t) => [t.tag, t]));
  const rows = [];
  const onFrame = new Map();
  for (const m of frame.members) if (m.tag) onFrame.set(m.tag, (onFrame.get(m.tag) || 0) + 1);
  for (const tag of [...onFrame.keys()].sort()) {
    const t = types.get(tag);
    rows.push({ mark: tag, member: (ROLES[t.role]?.name || t.role).toUpperCase(), size: t.size, qty: String(onFrame.get(tag)) });
  }
  const fieldRows = new Map();
  for (const f of frame.fields) {
    const k = `${f.role}|${f.size}|${f.spacing}`;
    const r = fieldRows.get(k) || { mark: '—', member: (ROLES[f.role]?.name || f.role).toUpperCase(), size: `${f.size}${f.spacing ? ` @ ${inchOC(f.spacing)}` : ''}`, qty: 0 };
    r.qty += f.count;
    fieldRows.set(k, r);
  }
  for (const r of fieldRows.values()) rows.push({ ...r, qty: String(r.qty) });
  for (const s of frame.studs || []) rows.push({ mark: '—', member: 'STUDS', size: `${s.size}${s.spacing ? ` @ ${inchOC(s.spacing)}` : ''}`, qty: String(s.count) });
  return {
    id: `framing-${frame.id}`, title: 'Framing key',
    columns: [{ key: 'mark', label: 'MARK', w: 12 }, { key: 'member', label: 'MEMBER', w: 34 }, { key: 'size', label: 'SIZE', w: 30 }, { key: 'qty', label: 'QTY', w: 12, align: 'end' }],
    rows,
  };
}

/** The general notes a framing sheet carries: the system and tradition, the sizes' meaning, the advice. */
function framingNotes(read, [x, y]) {
  const c = read.construction;
  const lines = [
    `SYSTEM: ${String(c.system || '').toUpperCase()} · ${String(c.tradition || '').toUpperCase()}`,
    'SIZES NOMINAL WHERE DRESSED LUMBER MATCHES, ELSE INCHES W x D.',
    'MARKS ARE TYPES; THE KEY COUNTS EVERY PIECE.',
    'ADVISORY: A DRAWING OF THE RECIPE, NOT AN ENGINEERED DESIGN.',
  ];
  const out = [`<text class="s-th" x="${n2(x)}" y="${n2(y + 4.5)}">GENERAL NOTES</text>`];
  lines.forEach((ln, i) => out.push(`<text class="s-ts" x="${n2(x)}" y="${n2(y + 10 + i * 3.6)}">${i + 1}. ${esc(ln)}</text>`));
  return `<g class="s-notes">${out.join('')}</g>`;
}

/** The roof's outline in plan: each finished plane projected, light (the frame sits under it). */
function roofOutline(read, view) {
  const roof = read.elements.roof;
  if (!roof) return '';
  return roof.planes.map((p) => `<polygon class="s-dim" points="${p.corners.map((c) => `${n2(view.x(c[0]))},${n2(view.y(c[1]))}`).join(' ')}"/>`).join('');
}

/**
 * The S-sheets: one per frame (foundation, each storey, the roof), each with its plan, overall dimensions, framing key
 * and notes. → [{ id, title, scale, frame, marks, svg }]
 */
export function framingSheets(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  if (!read || !read.construction || !read.construction.frames || !read.footprint) return [];
  const fp = read.footprint;
  const roofPts = (read.elements.roof?.planes || []).flatMap((p) => p.corners);
  const ext = roofPts.length
    ? { x0: Math.min(fp.x0, ...roofPts.map((c) => c[0])), y0: Math.min(fp.y0, ...roofPts.map((c) => c[1])), x1: Math.max(fp.x1, ...roofPts.map((c) => c[0])), y1: Math.max(fp.y1, ...roofPts.map((c) => c[1])) }
    : fp;
  // every S-sheet at one scale, the extent of the roof, so a member lands at the same place on each
  const L = planWithKey(read, { size, units, ext });
  return frameSheets(read).map(({ frame, title, id }) => {
    const d = frameDrawing(read, frame, L.view, { units });
    const ref = frame.id === 'roof'
      ? `<rect class="s-hid" x="${n2(L.view.x(fp.x0))}" y="${n2(L.view.y(fp.y0))}" width="${n2(L.view.len(fp.x1 - fp.x0))}" height="${n2(L.view.len(fp.y1 - fp.y0))}"/>${roofOutline(read, L.view)}`
      : '';
    const key = tableSvg(framingKey(read, frame), [L.key[0], L.key[1]]);
    const block = titleBlock({ size, project: project || read.title || 'mojulo house', title, id, scale: L.scale, revision });
    const body = [
      ref, d.svg, overallDims(read, L.view, units), key.svg,
      framingNotes(read, [L.key[0], L.key[1] + key.h + 8]),
      drawingTitle(L.titleAt, { detail: '1', title, scale: L.scale, sheet: id }),
      northArrow([L.area[0] + L.area[2] - KEY_W - 12, L.area[1] + 14], 0),
      scaleBar([L.area[0] + L.area[2] - KEY_W - 70, L.area[1] + L.area[3] - 9], L.view, units),
    ].join('');
    return { id, title, scale: L.scale, frame: frame.id, marks: d.marks, svg: sheetSvg({ size, body, block }) };
  });
}
