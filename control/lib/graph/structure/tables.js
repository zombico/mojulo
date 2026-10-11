/**
 * structure/tables — the house's schedules and checks as data, and the files the `schedules` and `sheets` exports
 * write. One source for the A-60x sheets, the CSV and JSON a spreadsheet or a takeoff tool reads, and the book's
 * Quantities and Checks tabs.
 *
 *   architectural   rooms, doors, windows, wall types, FF&E (sheets/schedules.js `scheduleTables`)
 *   structural      member marks, the cut list, sheet goods to buy, the takeoff by material (framed)
 *   electrical      the circuits (the panel schedule), rooms by tag (wired)
 *   checks          every advisory check with its source: the plan's grade and egress, the frame, the wiring, the
 *                   rainwater, and the span checks (or why there are none)
 *
 * Pure: the read gives the same tables, the same bytes.
 */

import { scheduleTables, tableCsv } from './sheets/schedules.js';
import { drawingSet, sheetIndex } from './sheets/index.js';
import { ROLES } from './trades.js';
import { ftIn } from './sheets/kit.js';

const r1 = (v) => Math.round(v * 10) / 10;
const material = (m) => String(m || '').replace(/^[a-z]+:/, '').replace(/-/g, ' ').toUpperCase();

/** The levels no flight reaches from the ground (walking the stairs both ways from level 0). */
export function unreachedLevels(read) {
  if (read.storeys.length < 2) return [];
  const ground = read.storeys.some((s) => s.index === 0) ? 0 : read.storeys[0].index;
  const reached = new Set([ground]);
  for (let grew = true; grew;) {
    grew = false;
    for (const st of read.elements.stairs) for (const [a, b] of [[st.from, st.to], [st.to, st.from]]) if (reached.has(a) && !reached.has(b)) { reached.add(b); grew = true; }
  }
  return read.storeys.filter((s) => !reached.has(s.index));
}

const SKIN = new Set(['rug', 'runner']);
const WALL_HUNG = new Set(['picture', 'sconce', 'tv', 'television', 'mirror']);
const gapOf = (a, b) => Math.hypot(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));

/**
 * Furniture that crowds a stair: each piece within the clearance of a flight on the floor it climbs in, or of the
 * well on the floor it reaches. The clearance is the recipe's `design.clearance` when it sets one, else the passage.
 * → [{ stair, room, storey, tag, type, marks, gapFt, wantFt, where }], one per type per room per stair, the nearest.
 */
export function stairCrowding(read) {
  const R = read.rules || { passage: 3, clearance: 0 };
  const want = R.clearance > 0 ? R.clearance : R.passage;
  const out = new Map();
  for (const st of read.elements.stairs) {
    if (!st.slot) continue;
    const zones = [...(st.flights || [{ rect: st.slot }]).map((f) => ({ storey: Math.min(st.from, st.to ?? st.from), rect: f.rect, where: 'flight' })),
      ...(st.to != null ? [{ storey: Math.max(st.from, st.to), rect: st.slot, where: 'well' }] : [])];
    if (st.landing) zones.push({ storey: Math.min(st.from, st.to ?? st.from), rect: st.landing.rect, where: 'landing' });
    // a piece crowds a stair only in a room the stair stands in (one behind a wall is not in its way)
    const roomRect = new Map(read.rooms.map((r) => [r.tag, r]));
    const shares = (room, z) => { const r = roomRect.get(room); return !!r && r.storey === z.storey && gapOf(r.rect, z.rect) < 1e-6 && Math.min(r.rect.x + r.rect.w, z.rect.x + z.rect.w) - Math.max(r.rect.x, z.rect.x) > 0.1 && Math.min(r.rect.y + r.rect.h, z.rect.y + z.rect.h) - Math.max(r.rect.y, z.rect.y) > 0.1; };
    for (const z of zones) {
      for (const p of read.objects.pieces) {
        if (p.storey !== z.storey || SKIN.has(p.type) || WALL_HUNG.has(p.type) || !shares(p.room, z)) continue;
        const g = gapOf(p.rect, z.rect);
        if (g >= want - 1 / 24) continue;
        const k = `${st.tag}|${p.room}|${p.tag}`;
        const cur = out.get(k);
        if (!cur) out.set(k, { stair: st.tag, room: p.room, storey: p.storey, tag: p.tag, type: p.type, marks: [p.mark], gapFt: g, wantFt: want, where: z.where });
        else { if (!cur.marks.includes(p.mark)) cur.marks.push(p.mark); if (g < cur.gapFt) { cur.gapFt = g; cur.where = z.where; } }
      }
    }
  }
  return [...out.values()].sort((a, b) => a.gapFt - b.gapFt || (a.tag < b.tag ? -1 : 1));
}

/** Is a check waived by the recipe (`design.waive`: a rule, or `rule:subject`)? */
export const isWaived = (read, rule, subject) => (read.rules?.waive || []).some((w) => w === rule || (subject && w === `${rule}:${subject}`));

/** Every check, flat: [{ source, rule, ok, subject, detail, waived? }]. A failed check advises; none refuses; a waived
 *  one is the operator's call, recorded. */
export function checkRows(read) {
  const rows = checkRowsRaw(read);
  return rows.map((c) => (c.ok === false && isWaived(read, c.rule, c.subject) ? { ...c, waived: true } : c));
}

function checkRowsRaw(read) {
  const rows = [];
  const tagOf = new Map(read.rooms.map((r) => [r.id, r.tag]));
  const g = read.grade;
  if (g) {
    for (const [k, v] of Object.entries(g.breakdown || {})) rows.push({ source: 'plan', rule: `grade:${k}`, ok: v >= 0.75, subject: '', detail: `${Math.round(v * 100)}%` });
    for (const v of g.violations || []) rows.push({ source: 'plan', rule: 'grade', ok: false, subject: '', detail: v });
  }
  // every level above or below the ground is reached by a flight (an authored stack without `stairs` has none)
  for (const lv of unreachedLevels(read)) rows.push({ source: 'plan', rule: 'stair-reach', ok: false, subject: `L${lv.number}`, detail: `no stair reaches this level: add stairs: true (one flight from the ground) or stairs: [{ from, to }]` });
  if (read.storeys.length > 1 && !unreachedLevels(read).length) rows.push({ source: 'plan', rule: 'stair-reach', ok: true, subject: '', detail: `${read.elements.stairs.length} flight${read.elements.stairs.length === 1 ? '' : 's'} reach every level` });
  // furniture that crowds a stair (the livability of its approaches)
  if (read.elements.stairs.length) {
    const say = (ft) => `${Math.round(ft * 12)} in`;
    const crowd = stairCrowding(read);
    for (const c of crowd) rows.push({ source: 'livability', rule: 'stair-clearance', ok: false, subject: c.room ?? '', detail: `${c.type.replace(/-/g, ' ')}${c.marks.length > 1 ? ` ×${c.marks.length}` : ''} (${c.tag}) is ${say(c.gapFt)} from the ${c.where} of ${c.stair}; it wants ${say(c.wantFt)} clear` });
    if (!crowd.length) rows.push({ source: 'livability', rule: 'stair-clearance', ok: true, subject: '', detail: `furniture keeps ${say(read.rules?.clearance > 0 ? read.rules.clearance : read.rules?.passage ?? 3)} off every flight, landing and well` });
  }
  for (const e of read.schedules.egress || []) rows.push({ source: 'plan', rule: 'egress', ok: !!e.ok, subject: tagOf.get(e.id) ?? e.name, detail: `${e.requires}; ${e.windows} window${e.windows === 1 ? '' : 's'}` });
  // the walkway check (floorplan-design.js): each finding a narrow passage, door or stair, said in words
  if (read.design) {
    const found = Array.isArray(read.design.findings) ? read.design.findings : [];
    for (const f of found) rows.push({ source: 'design', rule: 'walkway', ok: false, subject: /^([a-z]+):/.exec(String(f))?.[1] ?? '', detail: String(f).replace(/^[a-z]+:\s*/, '') });
    if (!found.length) rows.push({ source: 'design', rule: 'walkway', ok: true, subject: '', detail: `every door and stair connects through a passage at least ${Math.round((read.rules?.passage ?? 3) * 12)} in wide (${read.design.tradition || 'north-american'})` });
  }
  const wiringRules = new Set((read.wiring?.checks || []).map((c) => c.rule));
  for (const c of read.construction?.checks || []) {
    if (wiringRules.has(c.rule)) continue;
    rows.push({ source: 'frame', rule: c.rule, ok: !!c.ok, subject: '', detail: c.detail || '' });
  }
  if (read.construction) {
    const spans = Object.values(read.construction.spans || {}).flat();
    if (spans.length) for (const s of spans) rows.push({ source: 'frame', rule: 'span', ok: !!s.ok, subject: s.member, detail: `${s.deflMm} of ${s.limitMm} mm over ${s.spanMm} mm` });
    else rows.push({ source: 'frame', rule: 'span', ok: null, subject: '', detail: 'not computed: the house frame carries no bearing joints, so no member has supports to span between' });
  }
  for (const c of read.wiring?.checks || []) {
    const detail = c.rule === 'receptacle-spacing' ? `worst ${c.worstFt} ft to a receptacle` : c.rule === 'switch-at-door' ? `${c.switches} switch${c.switches === 1 ? '' : 'es'} at ${c.doors} door${c.doors === 1 ? '' : 's'}` : c.detail || (c.posts != null ? `${c.posts} posts bored` : '');
    rows.push({ source: 'wiring', rule: c.rule, ok: !!c.ok, subject: c.room ?? '', detail });
  }
  for (const c of read.drainage?.report?.checks || []) {
    const detail = c.rule === 'outlet-capacity' ? `${c.areaPerOutletM2} of ${c.capacityM2} m² per outlet at ${c.rainfallMmH} mm/h` : c.fall ? `fall ${c.fall}` : '';
    rows.push({ source: 'rainwater', rule: c.rule, ok: !!c.ok, subject: '', detail });
  }
  return rows;
}

/** The trades' and checks' tables, beside the architectural ones. Same table shape as `scheduleTables`. */
export function tradeTables(read) {
  const t = [];
  const c = read.construction;
  if (c && c.memberTypes) {
    t.push({
      id: 'members', title: 'Member schedule',
      columns: [{ key: 'mark', label: 'MARK', w: 12 }, { key: 'member', label: 'MEMBER', w: 34 }, { key: 'size', label: 'SIZE', w: 28 }, { key: 'qty', label: 'QTY', w: 12, align: 'end' }, { key: 'frames', label: 'FRAMES', w: 34 }],
      rows: c.memberTypes.map((m) => ({ mark: m.tag, member: (ROLES[m.role]?.name || m.role).toUpperCase(), size: m.size, qty: String(m.count), frames: m.frames.join(' ') })),
    });
  }
  const s = c && c.schedules;
  if (s && s.cutList && s.cutList.length) {
    t.push({
      id: 'cut-list', title: 'Cut list',
      columns: [{ key: 'material', label: 'MATERIAL', w: 34 }, { key: 'section', label: 'SECTION (MM)', w: 24 }, { key: 'length', label: 'LENGTH', w: 22, align: 'end' }, { key: 'count', label: 'QTY', w: 12, align: 'end' }],
      rows: s.cutList.map((x) => ({ material: material(x.material), section: x.sectionMm, length: ftIn(x.lengthIn / 12), count: String(x.count) })),
      total: { material: 'PIECES', section: '', length: '', count: String(s.cutList.reduce((a, x) => a + x.count, 0)) },
    });
  }
  if (s && s.sheets && s.sheets.length) {
    t.push({
      id: 'sheet-goods', title: 'Sheet goods',
      columns: [{ key: 'material', label: 'MATERIAL', w: 34 }, { key: 'pieces', label: 'PIECES', w: 16, align: 'end' }, { key: 'area', label: 'AREA (SF)', w: 20, align: 'end' }, { key: 'buy', label: 'SHEETS TO BUY', w: 24, align: 'end' }],
      rows: s.sheets.map((x) => ({ material: material(x.material), pieces: String(x.pieces), area: String(r1(x.areaSqFt)), buy: String(x.sheetsToBuy) })),
    });
  }
  if (s && s.takeoff && s.takeoff.length) {
    t.push({
      id: 'takeoff', title: 'Takeoff by material',
      columns: [{ key: 'material', label: 'MATERIAL', w: 40 }, { key: 'count', label: 'QTY', w: 14, align: 'end' }, { key: 'length', label: 'LENGTH (FT)', w: 22, align: 'end' }, { key: 'area', label: 'AREA (SF)', w: 20, align: 'end' }],
      rows: s.takeoff.map((x) => ({ material: material(x.material), count: String(x.count), length: x.lengthFt ? String(x.lengthFt) : '', area: x.areaSqFt ? String(x.areaSqFt) : '' })),
    });
  }
  if (read.wiring) {
    t.push({
      id: 'circuits', title: 'Panel schedule',
      columns: [{ key: 'no', label: 'CKT', w: 10 }, { key: 'level', label: 'LEVEL', w: 12 }, { key: 'use', label: 'USE', w: 22 }, { key: 'amps', label: 'A', w: 8, align: 'end' }, { key: 'cable', label: 'CABLE', w: 22 }, { key: 'rooms', label: 'ROOMS', w: 26 }, { key: 'devices', label: 'DEV', w: 10, align: 'end' }, { key: 'length', label: 'LENGTH (FT)', w: 18, align: 'end' }],
      rows: read.wiring.circuits.map((x) => ({ no: String(x.no), level: `L${x.storey + 1}`, use: String(x.use).toUpperCase(), amps: String(x.amps), cable: material(x.cable), rooms: x.rooms.filter(Boolean).join(' '), devices: String(x.devices), length: String(r1(x.lengthFt)) })),
    });
  }
  t.push({
    id: 'checks', title: 'Checks',
    columns: [{ key: 'source', label: 'SOURCE', w: 18 }, { key: 'rule', label: 'RULE', w: 34 }, { key: 'result', label: 'RESULT', w: 16 }, { key: 'subject', label: 'AT', w: 12 }, { key: 'detail', label: 'DETAIL', w: 60 }],
    rows: checkRows(read).map((x) => ({ source: x.source.toUpperCase(), rule: x.rule, result: x.ok === null ? 'NOT RUN' : x.ok ? 'PASS' : x.waived ? 'WAIVED' : 'ADVISE', subject: x.subject, detail: x.detail })),
  });
  return t;
}

/** Every table the house has: the architectural schedules, then the trades and the checks. */
export const allTables = (read, opts = {}) => [...scheduleTables(read, opts), ...tradeTables(read)];

/** `format: 'schedules'`: one CSV per table and one JSON of them all. → [{ name, text }] */
export function scheduleFiles(read, opts = {}) {
  const tables = allTables(read, opts);
  const json = { title: read.title, units: opts.units || 'imperial', tables: tables.map(({ id, title, columns, rows, total }) => ({ id, title, columns: columns.map(({ key, label }) => ({ key, label })), rows, ...(total ? { total } : {}) })) };
  return [
    ...tables.map((t) => ({ name: `schedules/${t.id}.csv`, text: tableCsv(t) })),
    { name: 'schedules/schedules.json', text: `${JSON.stringify(json, null, 2)}\n` },
  ];
}

/** `format: 'sheets'`: one SVG per sheet, in set order, and an index. → { files: [{ name, text }], index } */
export function sheetFiles(read, opts = {}) {
  const set = drawingSet(read, opts);
  const index = sheetIndex(set);
  const lines = [`# ${read.title || 'House'}: drawing set`, '', '| sheet | title | file |', '|---|---|---|', ...set.map((s) => `| ${s.id} | ${s.title} | [${s.id}.svg](${s.id}.svg) |`), '',
    'Each sheet is an SVG at true paper size (ANSI B, 17 x 11 in) in NCS conventions; print at 100%. A re-export of the same recipe writes the same bytes.', ''];
  return { files: [...set.map((s) => ({ name: `sheets/${s.id}.svg`, text: s.svg })), { name: 'sheets/INDEX.md', text: lines.join('\n') }], index };
}
