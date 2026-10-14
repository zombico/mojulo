// dresser-shop-sheet.png: mint the chest of drawers, read its furniture report, render the teardown, and lay
// the report's numbers and cutting plan onto sheet-template.html.
//
//   node docs/images/src/dresser-sheet/run.mjs [workDir]
//
// Same environment as interior-demo/run.mjs (a scratch MOJULO_DATA_DIR unless one is set; CHROME_BIN).
// The tip-over headline and the build order are written for this piece; the run refuses to draw the sheet
// if the report no longer says it tips.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureWorld, snapHtml, runJson } from '../lib/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-dresser-sheet'));
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

const REF = 'dresser_demo';
const recipe = JSON.parse(readFileSync(path.join(here, 'recipe.json'), 'utf8'));
const minted = call('mint_solid', { kind: 'workbench', title: 'Plywood chest of drawers', ref: REF, spec: recipe });
const frame = minted.stats.frames[0], f = frame.furniture;
if (!f.tip.drawers || !f.tip.drawers.tips) throw new Error('the report no longer says the chest tips: rewrite the headline before drawing the sheet');
writeFileSync(path.join(work, 'report.json'), JSON.stringify(frame, null, 1));

// the hero: the teardown's exploded pose, from the front (−y), in mm
call('update_sketch', { ref: REF, patch: [{ op: 'set', path: '/frames/0/teardown', value: { show: 'exploded', distance: 220 } }] });
call('export_model', { ref: REF, format: 'html' });
const raw = path.join(work, 'teardown.png');
await captureWorld(path.join(env.MOJULO_OUTCOMES_DIR, REF, 'world.html'), raw, { width: 1000, height: 750, camera: { pos: [2900, -3400, 2300], target: [480, -80, 150], vfov: 36 } });
const ff = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-vf', 'crop=1840:1380:80:40', path.join(work, 'hero.png')]);
if (ff.status !== 0) copyFileSync(raw, path.join(work, 'hero.png'));

// the cutting plan: three plywood sheets drawn at the report's own placements
const LABEL = { 'side-l': 'side', 'side-r': 'side', top: 'top', bottom: 'bottom', divider: 'divider', plinth: 'plinth', back: 'back' };
const label = (id) => LABEL[id] || (/-box-(front|back)$/.test(id) ? 'box end' : /-front$/.test(id) ? 'drawer front' : /-side-/.test(id) ? 'box side' : /-bottom$/.test(id) ? 'drawer bottom' : id);
function sheetSvg(m, idx, W = 540) {
  const [L, Wd] = m.sheetMm, s = W / L, H = Wd * s;
  let out = `<svg width="${W}" height="${H.toFixed(0)}" viewBox="0 0 ${W} ${H.toFixed(1)}" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="${W - 1}" height="${(H - 1).toFixed(1)}" fill="#141c2c" stroke="#3a4760" stroke-dasharray="4 3"/>`;
  for (const p of m.parts.filter((q) => q.sheet === idx)) {
    const [l, w] = p.turned ? [p.w, p.l] : [p.l, p.w];
    const x = p.x * s, y = p.y * s, pw = l * s, ph = w * s;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" fill="#b49b72" stroke="#0b1220" stroke-width="1"/>`;
    if (pw > 60 && ph > 14) {
      out += `<text x="${(x + pw / 2).toFixed(1)}" y="${(y + ph / 2 + 4).toFixed(1)}" font-size="${ph > 26 ? 11 : 9}" text-anchor="middle" fill="#2a2116" font-family="-apple-system,Helvetica" font-weight="600">${label(p.id)}</text>`;
      if (ph > 40) out += `<text x="${(x + pw / 2).toFixed(1)}" y="${(y + ph / 2 + 17).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#4a3c28" font-family="ui-monospace,Menlo">${l} × ${w}</text>`;
    }
  }
  return out + '</svg>';
}
const ply = (t) => f.cutList.find((m) => m.material === 'plywood' && m.thickMm === t);
const hb = f.cutList.find((m) => m.material === 'hardboard');
const cut = [[ply(18), 1, '18 mm plywood · sheet 1 of 2'], [ply(18), 2, '18 mm plywood · sheet 2 of 2'], [ply(16), 1, '16 mm plywood · drawer boxes']]
  .map(([m, i, t]) => `<div class="sh"><div class="shl">${t}</div>${sheetSvg(m, i)}</div>`).join('');

const sag = frame.span.filter((x) => ['top', 'bottom', 'divider'].includes(x.member)).sort((a, b) => b.deflMm - a.deflMm)[0];
const k = (x) => `<span class="k">"${x}"</span>`, sv = (x) => (typeof x === 'string' ? `<span class="s">"${x}"</span>` : x);
const b = recipe.frames[0].build;
const bl = Object.entries(b).map(([a, v]) => `${k(a)}: ${sv(v)}`);
const fill = {
  HERO: 'hero.png', CUT: cut, Y18: ply(18).yieldPct, HB: hb.sheets,
  OUT: f.tip.drawers.outMm, CHILD: f.tip.drawers.childKg, NET: Math.abs(f.tip.drawers.netNm),
  PF: Math.round(f.tip.pull.forceN), PH: f.tip.pull.heightMm, PO: Math.round(f.tip.pull.overturnNm), PR: Math.round(f.tip.pull.restoreNm),
  STAND: f.tip.standingMarginMm, SAG: sag.deflMm, SAGLIM: sag.limitMm, MASS: f.massKg, CARTON: f.cartonMm.join(' × '),
  BUY: f.hardware.map((h) => `<li><span class="v"><span class="mono">${String(h.count).padStart(2, ' ')}</span>&nbsp; ${h.label}</span></li>`).join('') +
    `<li><span class="v" style="color:#aab6cc">${f.tools.join(' · ')}</span></li>`,
  RECIPE: `{ ${k('units')}: ${sv('mm')}, ${k('frames')}: [ { ${k('id')}: ${sv(recipe.frames[0].id)}, ${k('build')}: { ${bl.slice(0, 5).join(', ')},\n    ${bl.slice(5).join(', ')} } } ] }`,
};
const html = readFileSync(path.join(here, 'sheet-template.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in fill)) throw new Error(`no value for {{${key}}}`);
  return fill[key];
});
writeFileSync(path.join(work, 'sheet.html'), html);
await snapHtml(path.join(work, 'sheet.html'), path.join(work, 'dresser-shop-sheet.png'), { width: 1800, height: 1220 });
console.log(path.join(work, 'dresser-shop-sheet.png'));
