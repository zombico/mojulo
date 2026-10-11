/**
 * structure/sheets/schedules — A-60x, the schedules: the tables a set carries beside its drawings, in the NCS table
 * form (a title, a ruled header, a row per type or instance, the tag first).
 *
 *   room schedule      number, name, level, area
 *   door schedule      number, width, height, interior or exterior, from and to
 *   window schedule    type, width, height, sill, count
 *   wall types         type, interior or exterior, thickness, count, length
 *   FF&E schedule      tag, item, style or source, quantity, rooms
 *
 * Every row comes from the read model (structure/read.js), so a tag in a schedule is the tag on the plan. The rows
 * also leave as data (`scheduleTables` → CSV / JSON through export_model's `schedules` format). Tables flow down two
 * columns and across sheets, the header repeated where a table breaks.
 */

import { n2, esc, ftIn, mmOf, areaText, titleBlock, sheetSvg } from './kit.js';
import { inches } from '../tags.js';

const inchText = (n, units) => (units === 'metric' ? String(Math.round(n * 25.4)) : ftIn(n / 12));
const len = (ft, units) => (units === 'metric' ? mmOf(ft) : ftIn(ft));
const levelName = (read, i) => { const s = read.storeys.find((x) => x.index === i); return s ? `L${s.number}` : ''; };

/**
 * The schedules as tables: [{ id, title, columns: [{ key, label, w (mm), align }], rows: [{ key: text }] }].
 * Pure data; the sheet draws it and the CSV export writes it.
 */
export function scheduleTables(read, { units = 'imperial' } = {}) {
  const roomName = new Map(read.rooms.map((r) => [r.tag, r.name]));
  const tables = [];
  tables.push({
    id: 'rooms', title: 'Room schedule',
    columns: [{ key: 'tag', label: 'NO.', w: 14 }, { key: 'name', label: 'NAME', w: 40 }, { key: 'level', label: 'LEVEL', w: 14 }, { key: 'area', label: 'AREA', w: 22, align: 'end' }],
    rows: read.rooms.map((r) => ({ tag: r.tag, name: String(r.name).toUpperCase(), level: levelName(read, r.storey), area: areaText(r.area, units) })),
    total: { tag: '', name: 'GROSS', level: '', area: areaText(read.schedules.grossArea, units) },
  });
  tables.push({
    id: 'doors', title: 'Door schedule',
    columns: [{ key: 'tag', label: 'NO.', w: 14 }, { key: 'width', label: 'WIDTH', w: 18, align: 'end' }, { key: 'height', label: 'HEIGHT', w: 18, align: 'end' }, { key: 'kind', label: 'TYPE', w: 14 }, { key: 'from', label: 'FROM', w: 26 }, { key: 'to', label: 'TO', w: 26 }],
    rows: [...read.elements.doors].sort((a, b) => (a.tag < b.tag ? -1 : 1)).map((d) => {
      const others = d.connects.filter((t) => t !== d.serves);
      return { tag: d.tag, width: inchText(inches(d.width), units), height: inchText(inches(d.height), units), kind: d.entry ? 'ENTRY' : d.exterior ? 'EXT' : 'INT', from: others.length ? `${others[0]} ${String(roomName.get(others[0]) || '').toUpperCase()}`.slice(0, 16) : 'EXTERIOR', to: d.serves ? `${d.serves} ${String(roomName.get(d.serves) || '').toUpperCase()}`.slice(0, 16) : '' };
    }),
  });
  tables.push({
    id: 'windows', title: 'Window schedule',
    columns: [{ key: 'type', label: 'TYPE', w: 14 }, { key: 'width', label: 'WIDTH', w: 20, align: 'end' }, { key: 'height', label: 'HEIGHT', w: 20, align: 'end' }, { key: 'sill', label: 'SILL', w: 20, align: 'end' }, { key: 'count', label: 'QTY', w: 12, align: 'end' }],
    rows: read.elements.windowTypes.map((t) => ({ type: t.type, width: inchText(t.widthIn, units), height: inchText(t.heightIn, units), sill: inchText(t.sillIn, units), count: String(t.count) })),
  });
  tables.push({
    id: 'walls', title: 'Wall types',
    columns: [{ key: 'type', label: 'TYPE', w: 14 }, { key: 'kind', label: 'USE', w: 26 }, { key: 'thickness', label: 'THICKNESS', w: 22, align: 'end' }, { key: 'count', label: 'RUNS', w: 12, align: 'end' }, { key: 'length', label: 'LENGTH', w: 24, align: 'end' }],
    rows: read.elements.wallTypes.map((t) => ({ type: t.type, kind: t.interior ? 'INTERIOR' : 'EXTERIOR', thickness: len(t.thickness, units), count: String(t.count), length: len(t.length, units) })),
  });
  if (read.objects.types.length) {
    tables.push({
      id: 'objects', title: 'FF&E schedule',
      columns: [{ key: 'tag', label: 'TAG', w: 14 }, { key: 'item', label: 'ITEM', w: 26 }, { key: 'style', label: 'STYLE / SOURCE', w: 32 }, { key: 'count', label: 'QTY', w: 10, align: 'end' }, { key: 'rooms', label: 'ROOMS', w: 26 }],
      rows: read.objects.types.map((t) => ({
        tag: t.tag, item: String(t.source === 'ref' ? 'custom piece' : t.type).toUpperCase(),
        style: t.source === 'ref' ? `ref ${t.ref}` : t.like ? `${t.like}` : t.asset ? t.asset : t.source,
        count: String(t.count), rooms: t.rooms.join(' '),
      })),
    });
  }
  return tables;
}

/** A table → CSV (RFC 4180: a field with a comma, quote or newline is quoted, a quote doubled). */
export function tableCsv(table) {
  const f = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const keys = table.columns.map((c) => c.key);
  const lines = [table.columns.map((c) => f(c.label)).join(','), ...table.rows.map((r) => keys.map((k) => f(r[k])).join(','))];
  if (table.total) lines.push(keys.map((k) => f(table.total[k])).join(','));
  return `${lines.join('\n')}\n`;
}

export const ROW = 5, HEAD = 6, TITLE = 8, GAP = 8;

/** Draw a fragment of a table at [x, y]: its title (the first fragment), the header, rows [r0, r1), the total. */
export function tableSvg(t, [x, y], r0 = 0, r1 = t.rows.length, { first = true, last = true } = {}) {
  const W = t.columns.reduce((a, c) => a + c.w, 0);
  const out = [];
  let yy = y;
  if (first) { out.push(`<text class="s-th" x="${n2(x)}" y="${n2(yy + 4.5)}">${esc(t.title.toUpperCase())}</text>`); yy += TITLE; }
  else { out.push(`<text class="s-ts" x="${n2(x)}" y="${n2(yy + 4.5)}">${esc(t.title.toUpperCase())} (CONTINUED)</text>`); yy += TITLE; }
  out.push(`<rect class="s-fill" x="${n2(x)}" y="${n2(yy)}" width="${n2(W)}" height="${HEAD}"/>`);
  let cx = x;
  for (const c of t.columns) {
    const tx = c.align === 'end' ? cx + c.w - 1.5 : cx + 1.5;
    out.push(`<text class="s-ts" style="fill:var(--paper,#fff);font-weight:700" ${c.align === 'end' ? 'text-anchor="end" ' : ''}x="${n2(tx)}" y="${n2(yy + 4)}">${esc(c.label)}</text>`);
    cx += c.w;
  }
  yy += HEAD;
  const rows = t.rows.slice(r0, r1);
  if (last && t.total) rows.push({ ...t.total, _total: true });
  for (const r of rows) {
    cx = x;
    for (const c of t.columns) {
      const tx = c.align === 'end' ? cx + c.w - 1.5 : cx + 1.5;
      out.push(`<text class="${r._total || c.key === t.columns[0].key ? 's-tb' : 's-t'}" ${c.align === 'end' ? 'text-anchor="end" ' : ''}x="${n2(tx)}" y="${n2(yy + 3.6)}">${esc(r[c.key] ?? '')}</text>`);
      cx += c.w;
    }
    yy += ROW;
    out.push(`<line class="${r._total ? 's-rule' : 's-dim'}" x1="${n2(x)}" y1="${n2(yy)}" x2="${n2(x + W)}" y2="${n2(yy)}"/>`);
  }
  // the column rules and the frame
  cx = x;
  for (const c of t.columns.slice(0, -1)) { cx += c.w; out.push(`<line class="s-dim" x1="${n2(cx)}" y1="${n2(y + TITLE)}" x2="${n2(cx)}" y2="${n2(yy)}"/>`); }
  out.push(`<rect class="s-rule" style="fill:none" x="${n2(x)}" y="${n2(y + TITLE)}" width="${n2(W)}" height="${n2(yy - y - TITLE)}"/>`);
  return { svg: `<g class="s-schedule" data-table="${esc(t.id)}">${out.join('')}</g>`, h: yy - y };
}

/**
 * A-601, A-602 …: the tables flowed down two columns per sheet, breaking a table (header repeated) where a column
 * runs out. → [{ id, title, svg, tables: [ids] }]
 */
export function scheduleSheets(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  const tables = scheduleTables(read, { units });
  const [dx, dy, dw, dh] = titleBlock({ size }).drawing;
  const colW = dw / 2, cols = [dx + 4, dx + 4 + colW];
  const pages = [];
  let page = null, col = 0, y = dy;
  const newPage = () => { page = { body: [], tables: new Set() }; pages.push(page); col = 0; y = dy + 4; };
  newPage();
  for (const t of tables) {
    let r = 0;
    let first = true;
    while (r < t.rows.length || first) {
      const room = dy + dh - y - (TITLE + HEAD);
      let fit = Math.floor(room / ROW) - (t.total ? 1 : 0);
      if (fit < Math.min(3, t.rows.length - r) && !(first && t.rows.length === 0)) {
        // not even a few rows here: the next column, or the next sheet
        if (col === 0) { col = 1; y = dy + 4; } else newPage();
        continue;
      }
      fit = Math.max(fit, 0);
      const r1 = Math.min(t.rows.length, r + fit);
      const last = r1 >= t.rows.length;
      const frag = tableSvg(t, [cols[col], y], r, r1, { first, last });
      page.body.push(frag.svg);
      page.tables.add(t.id);
      y += frag.h + GAP;
      r = r1;
      first = false;
      if (!last) { if (col === 0) { col = 1; y = dy + 4; } else newPage(); }
    }
  }
  return pages.map((p, i) => {
    const id = `A-60${i + 1}`, title = pages.length > 1 ? `Schedules (${i + 1} of ${pages.length})` : 'Schedules';
    const block = titleBlock({ size, project: project || read.title || 'mojulo house', title, id, scale: 'NONE', revision });
    return { id, title, tables: [...p.tables], svg: sheetSvg({ size, body: p.body.join(''), block }) };
  });
}
