// fabricator/bom — a stored row's bill of materials as the files a builder or a buyer opens: a CSV and a Markdown page.
//
// What it reads, never re-plans:
//   · a fabricated row (`manifest.fabricate`): the plan frozen at mint. A frames row's fittings are recounted from its
//     frames (construction/frame.js lowerFrame, the same report the mint read), so the count is what the joints place;
//     a scad row's lines are the plan's own.
//   · any workbench furniture row: its frames' hardware reports.
// Either way a frame's sheet cut list rides along, and a fabricated row's printed parts are listed as made, not bought.
// The line shape is the plan's (`code`, `label`, `count`, `tool`, `buy`, `standard`, `grade`, `provenance`, `for`), so
// the export, the furniture report and the instruction manual's inventory say the same thing. The notices (an owner's
// trademark, an open system's licence) travel with the list. Pure: the same row writes the same bytes.
import { lowerFrame } from '../construction/frame.js';
import { mintedBom, unplacedModules } from './plan.js';

export const BOM_COLUMNS = Object.freeze(['item', 'kind', 'count', 'code', 'label', 'grade', 'standard', 'buy', 'tool', 'provenance', 'for']);

const framesOf = (m) => (Array.isArray(m.frames) ? m.frames.filter((f) => f && typeof f === 'object') : []);

/** A stored manifest → { lines, cutList, tools, notices, gaps, source, version } or null when it has nothing to buy. */
export function bomOf(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  const fab = manifest.fabricate && manifest.fabricate.plan ? manifest.fabricate : null;
  const frames = framesOf(manifest);
  const reports = frames.length ? frames.map((f) => lowerFrame(f).report) : [];
  const furnished = reports.some((r) => r.furniture);
  if (!fab && !furnished) return null;
  let bought;
  if (fab) bought = fab.executor === 'frames' ? mintedBom(fab.plan, reports) : fab.plan.bom.map((l) => ({ ...l, from: 'plan' }));
  else bought = mintedBom({ bom: [] }, reports);
  const lines = bought.map((l) => ({ kind: 'buy', count: l.count ?? null, code: l.code ?? null, label: l.label, grade: l.grade ?? null,
    standard: l.standard ?? null, buy: l.buy ?? null, tool: l.tool ?? null, provenance: l.provenance ?? null, for: l.for ?? [], ...(l.count == null && l.perJoint ? { note: l.note } : {}) }));
  // A printed part is made, not bought: listed once per call, counted across the needs that print it.
  if (fab) {
    const made = new Map();
    for (const c of fab.plan.cuts || []) {
      if (c.route !== 'print') continue;
      const line = made.get(c.call) || { kind: 'print', count: 0, code: null, label: c.call, grade: null, standard: null, buy: null, tool: null, provenance: null, for: [] };
      line.count += c.count;
      if (!line.for.includes(c.need)) line.for.push(c.need);
      made.set(c.call, line);
    }
    lines.push(...made.values());
  }
  const cutList = reports.flatMap((r) => r.furniture?.cutList || []).map((g) => ({ material: g.material, thickMm: g.thickMm, sheetMm: g.sheetMm, sheets: g.sheets, parts: g.parts.length }));
  for (const g of cutList) lines.push({ kind: 'sheet', count: g.sheets, code: null, label: `${g.material} sheet ${g.thickMm} mm, ${g.sheetMm.join(' × ')} mm (${g.parts} parts)`, grade: null, standard: null, buy: null, tool: null, provenance: null, for: [] });
  lines.forEach((l, i) => { l.item = i + 1; });
  const tools = [...new Set([...lines.map((l) => l.tool).filter(Boolean), ...reports.flatMap((r) => r.furniture?.tools || [])])].sort();
  return {
    lines, cutList, tools,
    notices: fab ? fab.plan.notices || [] : [],
    gaps: fab ? fab.plan.gaps || [] : [],
    // A source edited since its plan may have lost a cut the plan still buys for: said, so the list is re-planned.
    unplaced: fab && fab.executor === 'scad' && typeof manifest.source === 'string' ? unplacedModules(fab.plan, manifest.source) : [],
    source: fab ? `fabricate (${fab.executor})` : 'frames',
    version: fab ? fab.plan.version : null,
  };
}

const cell = (v) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join(' ') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180 CSV, one row per line, the columns in BOM_COLUMNS order, CRLF line ends. */
export const bomCsv = (bom) => `${[BOM_COLUMNS.join(','), ...bom.lines.map((l) => BOM_COLUMNS.map((k) => cell(l[k])).join(','))].join('\r\n')}\r\n`;

const md = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** A Markdown page: what to buy, what to print, the sheets to cut, the tools, the notices. */
export function bomMarkdown(bom, { title, ref } = {}) {
  const table = (rows, cols) => [`| ${cols.map((c) => c[0]).join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`,
    ...rows.map((l) => `| ${cols.map((c) => md(c[1](l))).join(' | ')} |`)];
  const bought = bom.lines.filter((l) => l.kind === 'buy');
  const printed = bom.lines.filter((l) => l.kind === 'print');
  const sheets = bom.lines.filter((l) => l.kind === 'sheet');
  const out = [`# Bill of materials: ${md(title || ref || 'untitled')}`, ''];
  if (ref) out.push(`From \`${ref}\`, ${bom.source}${bom.version ? `, ${bom.version}` : ''}. Re-export after any edit: the list is read from the recipe.`, '');
  if (bom.unplaced?.length) out.push(`> The source no longer calls ${bom.unplaced.map((u) => `\`${u}\``).join(', ')}: the parts bought for it may not be needed. Re-plan with \`fabricate_solid({ ref${ref ? `: '${ref}'` : ''} })\` and export again.`, '');
  if (bought.length) out.push('## Buy', '', ...table(bought, [['#', (l) => l.item], ['Count', (l) => l.count ?? 'counted by the frame'], ['Part', (l) => l.label],
    ['Code', (l) => l.code], ['Grade', (l) => l.grade], ['Standard', (l) => l.standard], ['Ask for', (l) => l.buy], ['For', (l) => (l.for || []).join(', ')]]), '');
  if (printed.length) out.push('## Print', '', ...table(printed, [['#', (l) => l.item], ['Count', (l) => l.count], ['Part', (l) => `\`${l.label}\``], ['For', (l) => l.for.join(', ')]]), '');
  if (sheets.length) out.push('## Cut', '', ...table(sheets, [['#', (l) => l.item], ['Sheets', (l) => l.count], ['Stock', (l) => l.label]]), '');
  if (bom.tools.length) out.push('## Tools', '', ...bom.tools.map((t) => `- ${md(t)}`), '');
  if (bom.gaps.length) out.push('## Designed from scratch', '', ...bom.gaps.map((g) => `- ${md(g.need)} (${md(g.function)}): ${md(g.why)}`), '');
  if (bom.notices.length) out.push('## Notices', '', ...bom.notices.map((n) => `- ${md(n)}`), '');
  out.push('Sizes come from typical catalogue and handbook values. Check each part against its supplier\'s datasheet before you rely on it.', '');
  return out.join('\n');
}
