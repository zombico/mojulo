// sheet-metal-sheet.png: "Cut it. Bend it." Mint u-channel.scad, export the flat part as DXF, draw that DXF
// dimensioned beside the World page's view of the bent part and its blank, with the bend allowance worked out.
//
//   node docs/images/src/sheet-metal/run.mjs [workDir]
//
// Every dimension on the drawing is read back from the exported DXF, not from the source; the runner stops if
// the DXF is not one outline with the holes and bend marks inside it, or if its length misses the formula.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureWorld, runJson, snapHtml } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-sheet-metal'));
mkdirSync(work, { recursive: true });
const env = { ...process.env };
env.MOJULO_DATA_DIR ||= path.join(work, 'data');
env.MOJULO_OUTCOMES_DIR ||= path.join(env.MOJULO_DATA_DIR, 'outcomes');
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });
const call = (tool, args) => {
  const res = runJson(env, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)]);
  if (res.ok === false) throw new Error(`${tool}: ${res.error}`);
  return res;
};

const REF = 'uchannel';
const source = readFileSync(path.join(here, 'u-channel.scad'), 'utf8');
call('mint_solid', { kind: 'scad', title: 'U-channel bracket', ref: REF, spec: { source,
  parts: { bent: 'bent();', flat: 'translate([0, 70, 0]) linear_extrude(t) flat2d();' } } });
const dxfRes = call('export_model', { ref: REF, format: 'dxf', part: 'flat', slice_z: 1 });
call('export_model', { ref: REF, format: 'html' });
await captureWorld(path.join(env.MOJULO_OUTCOMES_DIR, REF, 'world.html'), path.join(work, 'bent.png'),
  { width: 800, height: 600, camera: { pos: [250, -170, 190], target: [60, 55, 10], vfov: 34 } });

// the DXF's closed polylines, back in the flat pattern's own frame (the part was placed at y + 70)
const dxf = readFileSync(dxfRes.path, 'utf8').split(/\r?\n/).map((l) => l.trim());
const loops = [];
for (let i = 0; i < dxf.length - 1; i += 2) {
  if (dxf[i] === '0') { if (dxf[i + 1] === 'LWPOLYLINE') loops.push([]); continue; }
  const cur = loops.at(-1);
  if (!cur) continue;
  if (dxf[i] === '10') cur.push([Number(dxf[i + 1]), null]);
  else if (dxf[i] === '20') cur.at(-1)[1] = Number(dxf[i + 1]) - 70;
}
const box = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
const boxes = loops.map(box);
const outer = boxes.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a));
const inner = boxes.filter((b) => b !== outer);
if (!inner.every((b) => b.x0 > outer.x0 && b.x1 < outer.x1 && b.y0 > outer.y0 && b.y1 < outer.y1)) throw new Error('the DXF is not one outline with everything inside it');
const marks = inner.filter((b) => b.x1 - b.x0 < 0.5).sort((a, b) => a.x0 - b.x0);
const holes = inner.filter((b) => b.x1 - b.x0 >= 0.5).sort((a, b) => a.y0 - b.y0);
const t = 2, r = 2, k = 0.44, BA = (Math.PI / 2) * (r + k * t), L = 30 + 50 + 30 + 2 * BA;
const len = outer.x1 - outer.x0, W = outer.y1 - outer.y0;
if (Math.abs(len - L) > 0.002) throw new Error(`flat length ${len} misses the formula's ${L}`);

// the drawing: the DXF at scale, dimensioned from what the DXF holds
const S = 6.6, ox = 40, oy = 70, X = (x) => ox + x * S, Y = (y) => oy + (W - y) * S;
const f = (v, d = 2) => Number(v.toFixed(d)).toString();
const markX = marks.map((m) => (m.x0 + m.x1) / 2), hole = holes[0], hx = (hole.x0 + hole.x1) / 2, hd = hole.x1 - hole.x0;
const dimH = (x0, x1, y, label, up = true) => `<g class="dim"><line x1="${X(x0)}" y1="${y}" x2="${X(x1)}" y2="${y}"/><line x1="${X(x0)}" y1="${y - 5}" x2="${X(x0)}" y2="${y + 5}"/><line x1="${X(x1)}" y1="${y - 5}" x2="${X(x1)}" y2="${y + 5}"/><text x="${(X(x0) + X(x1)) / 2}" y="${up ? y - 7 : y + 16}">${label}</text></g>`;
let svg = `<svg width="${ox * 2 + len * S + 40}" height="${oy + W * S + 90}" xmlns="http://www.w3.org/2000/svg">`;
svg += `<path class="cut" d="${loops[boxes.indexOf(outer)].map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('')}Z"/>`;
for (const h of holes) svg += `<circle class="cut" cx="${X((h.x0 + h.x1) / 2)}" cy="${Y((h.y0 + h.y1) / 2)}" r="${((h.x1 - h.x0) / 2) * S}"/>`;
for (const m of marks) svg += `<line class="mark" x1="${X((m.x0 + m.x1) / 2)}" y1="${Y(m.y1)}" x2="${X((m.x0 + m.x1) / 2)}" y2="${Y(m.y0)}"/>`;
svg += dimH(0, len, oy - 34, `${f(len, 3)}`);
svg += dimH(0, markX[0], oy + W * S + 26, f(markX[0]), false) + dimH(markX[0], markX[1], oy + W * S + 26, f(markX[1] - markX[0]), false) + dimH(markX[1], len, oy + W * S + 26, f(len - markX[1]), false);
svg += `<g class="dim"><line x1="${X(len) + 22}" y1="${Y(W)}" x2="${X(len) + 22}" y2="${Y(0)}"/><text x="${X(len) + 30}" y="${(Y(W) + Y(0)) / 2 + 5}" text-anchor="start">${f(W)}</text></g>`;
svg += `<text class="note" x="${X(hx) + hd * S / 2 + 8}" y="${Y((holes[1].y0 + holes[1].y1) / 2) - 10}">2 × Ø${f(hd, 1)}</text>`;
svg += `<text class="note" x="${X(markX[0]) + 6}" y="${Y(W) + 18}">bend 1 · 90° up</text><text class="note" x="${X(markX[1]) + 6}" y="${Y(W) + 18}">bend 2 · 90° up</text>`;
svg += '</svg>';

const fill = { BENT: 'bent.png', FLAT: svg, LEN: f(len, 3), BA: f(BA, 3), FORM: f(L, 3), W: f(W), HD: f(hd, 1),
  TAB: f(marks[0].y0 - outer.y0, 1), N: loops.length, SRC: source.split('\n').filter((l) => !l.startsWith('//')).join('\n').trim().replace(/&/g, '&amp;').replace(/</g, '&lt;') };
const html = readFileSync(path.join(here, 'sheet-template.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in fill)) throw new Error(`no value for {{${key}}}`);
  return fill[key];
});
writeFileSync(path.join(work, 'sheet.html'), html);
await snapHtml(path.join(work, 'sheet.html'), path.join(work, 'sheet-metal-sheet.png'), { width: 1800, height: 1000 });
console.log(path.join(work, 'sheet-metal-sheet.png'));
