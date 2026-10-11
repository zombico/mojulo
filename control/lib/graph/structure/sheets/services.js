/**
 * structure/sheets/services — the trades' sheets, projected from what the kernels plan (structure/trades.js).
 *
 *   E-10x   electrical plan per storey: the architectural plan screened back, the devices in the symbols a
 *           residential set uses (duplex receptacle, switch, ceiling outlet, panelboard), the cable runs dashed, room
 *           names; beside it the circuit schedule, the panel and the checks
 *   P-101   roof drainage plan: the roof planes and their falls, gutters, downspouts at their feet (DS1 …), the
 *           outlets they discharge to, any below-grade drain; beside it the rainwater summary and its checks
 *
 * The wiring is drawn as roughed in (a framed house at the bare frame is wired on paper); the rainwater as designed
 * (a framed house wears no gutters in its world, but its roof still drains). Pure: the read gives the bytes.
 */

import { n2, esc, ftIn, receptacleMark, switchMark, ceilingMark, panelMark, downspoutMark, slopeArrow, northArrow, scaleBar, titleBlock, drawingTitle, sheetSvg } from './kit.js';
import { tableSvg } from './schedules.js';
import { planWithKey, overallDims } from './framing.js';
import { planDrawing, planTitle } from './plan.js';

const KEY_W = 112;
const r1 = (v) => Math.round(v * 10) / 10;

/** A room's name at its centre, without the area (the electrical plan names rooms; the A-sheet measures them). */
const roomNames = (read, storey, view) => read.rooms.filter((r) => r.storey === storey).map((r) => {
  const c = [view.x(r.rect.x + r.rect.w / 2), view.y(r.rect.y + r.rect.h / 2)];
  return `<text class="s-ts s-halo" text-anchor="middle" x="${n2(c[0])}" y="${n2(c[1])}">${esc(String(r.name).toUpperCase())} ${esc(r.tag)}</text>`;
}).join('');

/** The circuits on one storey as a schedule table. */
export function circuitTable(read, storey) {
  const w = read.wiring;
  return {
    id: `circuits-${storey}`, title: 'Circuit schedule',
    columns: [{ key: 'no', label: 'CKT', w: 10 }, { key: 'use', label: 'USE', w: 22 }, { key: 'amps', label: 'A', w: 8, align: 'end' }, { key: 'cable', label: 'CABLE', w: 22 }, { key: 'rooms', label: 'ROOMS', w: 26 }, { key: 'devices', label: 'DEV', w: 10, align: 'end' }, { key: 'length', label: 'LENGTH', w: 14, align: 'end' }],
    rows: w.circuits.filter((c) => c.storey === storey).map((c) => ({
      no: String(c.no), use: String(c.use).toUpperCase(), amps: String(c.amps), cable: String(c.cable).replace(/^cable:/, '').toUpperCase(),
      rooms: c.rooms.filter(Boolean).join(' '), devices: String(c.devices), length: `${Math.round(c.lengthFt)}'`,
    })),
  };
}

/** A legend: each symbol on the sheet and what it is. */
function legend([x, y], items) {
  const out = [`<text class="s-th" x="${n2(x)}" y="${n2(y + 4.5)}">LEGEND</text>`];
  items.forEach(([mark, text], i) => {
    const yy = y + 11 + i * 5;
    out.push(mark([x + 3, yy]), `<text class="s-ts" x="${n2(x + 9)}" y="${n2(yy + 0.7)}">${esc(text)}</text>`);
  });
  return { svg: `<g class="s-legend">${out.join('')}</g>`, h: 11 + items.length * 5 };
}

/** Numbered notes under a heading. */
function notes([x, y], title, lines) {
  const out = [`<text class="s-th" x="${n2(x)}" y="${n2(y + 4.5)}">${esc(title)}</text>`];
  lines.forEach((ln, i) => out.push(`<text class="s-ts" x="${n2(x)}" y="${n2(y + 10 + i * 3.6)}">${i + 1}. ${esc(ln)}</text>`));
  return { svg: `<g class="s-notes">${out.join('')}</g>`, h: 10 + lines.length * 3.6 };
}

/** The plan of a cable segment: its long axis through its box, when it runs more than half a foot in plan. */
function cableLine(c, view) {
  const dx = c.hi[0] - c.lo[0], dy = c.hi[1] - c.lo[1];
  if (Math.max(dx, dy) < 0.5) return '';
  const [a, b] = dx >= dy ? [[c.lo[0], (c.lo[1] + c.hi[1]) / 2], [c.hi[0], (c.lo[1] + c.hi[1]) / 2]] : [[(c.lo[0] + c.hi[0]) / 2, c.lo[1]], [(c.lo[0] + c.hi[0]) / 2, c.hi[1]]];
  return `<line class="s-hid" data-circuit="${esc(c.circuit ?? '')}" x1="${n2(view.x(a[0]))}" y1="${n2(view.y(a[1]))}" x2="${n2(view.x(b[0]))}" y2="${n2(view.y(b[1]))}"/>`;
}

/** E-101 …: the electrical plan of each storey that has wiring. → [{ id, title, scale, storey, svg }] */
export function electricalSheets(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  const w = read && read.wiring;
  if (!w || !read.footprint) return [];
  const L = planWithKey(read, { size, units, keyW: KEY_W });
  const storeys = [...new Set(w.devices.map((d) => d.storey))].sort((a, b) => a - b);
  return storeys.map((si, i) => {
    const id = `E-${101 + i}`;
    const st = read.storeys.find((s) => s.index === si);
    const title = st ? planTitle(st).replace(/plan$/i, 'electrical plan') : 'Electrical plan';
    const V = L.view;
    const marks = w.devices.filter((d) => d.storey === si).map((d) => {
      const p = [V.x(d.at[0]), V.y(d.at[1])];
      if (d.kind === 'receptacle') return receptacleMark(p, { tag: d.key });
      if (d.kind === 'switch') return switchMark(p, { tag: d.key });
      if (d.kind === 'ceiling') return ceilingMark(p, { tag: d.key });
      if (d.kind === 'panel') return panelMark(p, 'PANEL');
      return ceilingMark(p, { tag: d.key });
    });
    const cables = w.cables.filter((c) => c.storey === si).map((c) => cableLine(c, V)).join('');
    const [kx, ky] = L.key;
    const table = circuitTable(read, si);
    const t = tableSvg(table, [kx, ky]);
    const lg = legend([kx, ky + t.h + 6], [
      [(p) => receptacleMark(p), 'DUPLEX RECEPTACLE'], [(p) => switchMark(p), 'SINGLE-POLE SWITCH'],
      [(p) => ceilingMark(p), 'CEILING OUTLET (LIGHT)'], [(p) => panelMark([p[0], p[1] + 0.6], ''), 'PANELBOARD'],
      [(p) => `<line class="s-hid" x1="${n2(p[0] - 2.5)}" y1="${n2(p[1])}" x2="${n2(p[0] + 2.5)}" y2="${n2(p[1])}"/>`, 'CABLE RUN'],
    ]);
    const mine = w.checks.filter((c) => !c.room || read.rooms.some((r) => r.tag === c.room && r.storey === si));
    const failed = mine.filter((c) => !c.ok);
    const nt = notes([kx, ky + t.h + 6 + lg.h + 4], 'NOTES', [
      `RULES: ${{ 'north-american': 'NEC', british: 'BS 7671', japanese: 'JIS / NAIKI', metric: 'IEC 60364' }[w.tradition] || String(w.tradition).toUpperCase()}. PANEL: ${String(w.panel.material).replace(/^panel:/, '').toUpperCase()}, ${w.panel.circuits} CIRCUITS.`,
      failed.length ? `${failed.length} OF ${mine.length} CHECKS ADVISE: ${failed.slice(0, 3).map((c) => `${c.rule}${c.room ? ` (${c.room})` : ''}`).join(', ')}.` : `ALL ${mine.length} CHECKS PASS (RECEPTACLE SPACING, SWITCH AT DOOR, BORED HOLES).`,
      'DRAWN AS ROUGHED IN; ADVISORY, NOT AN ENGINEERED DESIGN.',
    ]);
    const block = titleBlock({ size, project: project || read.title || `mojulo ${read.occupancy?.label ?? 'house'}`, title, id, scale: L.scale, revision });
    const body = [
      `<g class="s-screen" opacity="0.35">${planDrawing(read, si, V, { units, tags: false, dims: false, objects: false })}</g>`,
      roomNames(read, si, V), `<g class="s-cables">${cables}</g>`, `<g class="s-devices">${marks.join('')}</g>`,
      t.svg, lg.svg, nt.svg,
      drawingTitle(L.titleAt, { detail: '1', title, scale: L.scale, sheet: id }),
      northArrow([L.area[0] + L.area[2] - KEY_W - 12, L.area[1] + 14], 0),
      scaleBar([L.area[0] + L.area[2] - KEY_W - 70, L.area[1] + L.area[3] - 9], V, units),
    ].join('');
    return { id, title, scale: L.scale, storey: si, svg: sheetSvg({ size, body, block }) };
  });
}

/** A roof plane's fall in plan: from its highest edge's middle toward its lowest, and its pitch as rise in 12. */
function planeFall(p) {
  const zs = p.corners.map((c) => c[2]);
  const zMax = Math.max(...zs), zMin = Math.min(...zs);
  if (zMax - zMin < 0.05) return null;
  const hi = p.corners.filter((c) => zMax - c[2] < 0.05), lo = p.corners.filter((c) => c[2] - zMin < 0.05);
  const avg = (cs) => [cs.reduce((a, c) => a + c[0], 0) / cs.length, cs.reduce((a, c) => a + c[1], 0) / cs.length];
  const a = avg(hi), b = avg(lo);
  const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { a, b, pitch: run > 0 ? Math.round(((zMax - zMin) / run) * 12 * 2) / 2 : 0 };
}

/** P-101: the roof drainage plan. → { id, title, scale, svg } or null when the read has no rainwater. */
export function drainageSheet(read, { units = 'imperial', project, size = 'ANSI B', revision = null } = {}) {
  const d = read && read.drainage;
  if (!d || !read.footprint) return null;
  const fp = read.footprint;
  const planes = read.elements.roof?.planes || [];
  const pts = [...planes.flatMap((p) => p.corners), ...d.gutters.flatMap((g) => [g.from, g.to]), ...d.outlets.flatMap((o) => [o.lo, o.hi])];
  const ext = pts.length
    ? { x0: Math.min(fp.x0, ...pts.map((c) => c[0])), y0: Math.min(fp.y0, ...pts.map((c) => c[1])), x1: Math.max(fp.x1, ...pts.map((c) => c[0])), y1: Math.max(fp.y1, ...pts.map((c) => c[1])) }
    : fp;
  const L = planWithKey(read, { size, units, keyW: KEY_W, ext });
  const V = L.view;
  const P = (c) => `${n2(V.x(c[0]))},${n2(V.y(c[1]))}`;
  const out = [];
  out.push(`<rect class="s-hid" x="${n2(V.x(fp.x0))}" y="${n2(V.y(fp.y0))}" width="${n2(V.len(fp.x1 - fp.x0))}" height="${n2(V.len(fp.y1 - fp.y0))}"/>`);
  for (const p of planes) {
    out.push(`<polygon class="s-proj" points="${p.corners.map(P).join(' ')}"/>`);
    const f = planeFall(p);
    if (f) {
      // the arrow from a third of the way down the plane to two thirds, the pitch beside it
      const a = [f.a[0] + (f.b[0] - f.a[0]) * 0.3, f.a[1] + (f.b[1] - f.a[1]) * 0.3], b = [f.a[0] + (f.b[0] - f.a[0]) * 0.7, f.a[1] + (f.b[1] - f.a[1]) * 0.7];
      out.push(slopeArrow([V.x(a[0]), V.y(a[1])], [V.x(b[0]), V.y(b[1])], `${f.pitch}:12`));
    }
  }
  for (const g of d.gutters) out.push(`<line class="s-cut" style="stroke-width:0.7" data-key="${esc(g.key)}" x1="${n2(V.x(g.from[0]))}" y1="${n2(V.y(g.from[1]))}" x2="${n2(V.x(g.to[0]))}" y2="${n2(V.y(g.to[1]))}"/>`);
  for (const b of d.below || []) out.push(`<line class="s-hid" data-key="${esc(b.key)}" x1="${n2(V.x(b.from[0]))}" y1="${n2(V.y(b.from[1]))}" x2="${n2(V.x(b.to[0]))}" y2="${n2(V.y(b.to[1]))}"/>`);
  for (const c of d.chambers || []) out.push(`<rect class="s-proj" data-key="${esc(c.key)}" x="${n2(V.x(c.at[0]) - 1.5)}" y="${n2(V.y(c.at[1]) - 1.5)}" width="3" height="3"/>`);
  for (const o of d.outlets) out.push(`<rect class="s-proj" data-key="${esc(o.key)}" x="${n2(V.x(o.lo[0]))}" y="${n2(V.y(o.lo[1]))}" width="${n2(V.len(o.hi[0] - o.lo[0]))}" height="${n2(V.len(o.hi[1] - o.lo[1]))}"/>`);
  // downspouts numbered in reading order (north to south, west to east), as the outlets are
  const ds = [...d.downpipes].sort((a, b) => (a.at[1] - b.at[1]) || (a.at[0] - b.at[0]));
  ds.forEach((p, i) => out.push(downspoutMark([V.x(p.at[0]), V.y(p.at[1])], `DS${i + 1}`)));

  const rep = d.report || {};
  const [kx, ky] = L.key;
  const summary = {
    id: 'rainwater', title: 'Rainwater summary',
    columns: [{ key: 'item', label: 'ITEM', w: 40 }, { key: 'value', label: 'VALUE', w: 64 }],
    rows: [
      { item: 'TRADITION', value: String(rep.tradition || '').toUpperCase() },
      { item: 'ROOF AREA (PLAN)', value: units === 'metric' ? `${rep.roofAreaM2} m²` : `${Math.round((rep.roofAreaM2 || 0) / 0.09290304)} SF` },
      { item: 'GUTTERS', value: rep.gutters ? `${rep.gutters.runs} RUNS · ${ftIn(rep.gutters.lengthFt)} · FALL ${rep.gutters.fall}` : '—' },
      { item: 'DOWNSPOUTS', value: rep.downpipes ? `${rep.downpipes.count} · ${ftIn(rep.downpipes.lengthFt)}` : '—' },
      { item: 'OUTLETS', value: rep.outlets ? `${rep.outlets.count} ${String(rep.outlets.kind).toUpperCase()}` : '—' },
      ...(rep.below ? [{ item: 'BELOW GRADE', value: `${ftIn(rep.below.lengthFt)} · FALL ${rep.below.fall} · ${rep.below.chambers} CHAMBERS` }] : []),
    ],
  };
  const t = tableSvg(summary, [kx, ky]);
  const checks = (rep.checks || []).map((c) => `${c.ok ? 'PASS' : 'ADVISE'}: ${String(c.rule).toUpperCase()}${c.rule === 'outlet-capacity' ? ` (${r1(c.areaPerOutletM2)} OF ${r1(c.capacityM2)} m² PER OUTLET AT ${c.rainfallMmH} mm/h)` : ''}`);
  const nt = notes([kx, ky + t.h + 6], 'CHECKS', [...checks, 'ADVISORY, NOT AN ENGINEERED DESIGN.']);
  const lg = legend([kx, ky + t.h + 6 + nt.h + 4], [
    [(p) => `<line class="s-cut" style="stroke-width:0.7" x1="${n2(p[0] - 2.5)}" y1="${n2(p[1])}" x2="${n2(p[0] + 2.5)}" y2="${n2(p[1])}"/>`, 'GUTTER'],
    [(p) => downspoutMark(p, ''), 'DOWNSPOUT'],
    [(p) => slopeArrow([p[0] - 2.5, p[1]], [p[0] + 2.5, p[1]], ''), 'ROOF FALL (RISE:12)'],
  ]);
  const id = 'P-101', title = 'Roof drainage plan';
  const block = titleBlock({ size, project: project || read.title || `mojulo ${read.occupancy?.label ?? 'house'}`, title, id, scale: L.scale, revision });
  const body = [
    `<g class="s-drainage">${out.join('')}</g>`, overallDims(read, V, units), t.svg, nt.svg, lg.svg,
    drawingTitle(L.titleAt, { detail: '1', title, scale: L.scale, sheet: id }),
    northArrow([L.area[0] + L.area[2] - KEY_W - 12, L.area[1] + 14], 0),
    scaleBar([L.area[0] + L.area[2] - KEY_W - 70, L.area[1] + L.area[3] - 9], V, units),
  ].join('');
  return { id, title, scale: L.scale, downspouts: ds.length, svg: sheetSvg({ size, body, block }) };
}
