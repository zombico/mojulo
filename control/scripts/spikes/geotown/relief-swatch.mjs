#!/usr/bin/env node
/**
 * SPIKE: gen-7 palettes' relief as swatches: each painted role's nine stops (two shades, the ramp, two lights), per spec.
 *
 *   cd control && node scripts/spikes/geotown/relief-swatch.mjs [name]
 *     → ../lite-template/integration/1022/spike-output/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { solvePalette } = await import('../../../lib/graph/color-theorist/solve.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1022/spike-output');
mkdirSync(outDir, { recursive: true });
const name = process.argv[2] ?? 'relief';
const SPECS = [{ seed: 1, intent: 'a mid key by day' }, { seed: 7, key: 'low', heat: -0.6, intent: 'a moonlit low key' }, { seed: 3, key: 'high', intent: 'a high key' }, { seed: 4, air: 'none', intent: 'vacuum' }];
const rows = SPECS.map((spec) => {
  const K = solvePalette({ ...spec, era: 'gen-7' });
  const roles = ['rock', 'soil', 'ground', 'made'].map((r) => `<div class=role><span>${r}</span>${K.relief[r].map((c, i) => `<i style="background:${c}" class="${i < 2 ? 'sh' : i > 6 ? 'li' : ''}"></i>`).join('')}</div>`).join('');
  const failing = K.checks.filter((c) => c.law.startsWith('relief-') && !c.ok).map((c) => c.law).join(', ') || 'relief laws hold';
  return `<h3>${spec.intent} · ${failing}</h3>${roles}`;
}).join('');
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:14px;background:#2b2a28;color:#ddd;font:13px system-ui}.role{display:flex;align-items:center;gap:3px;margin:3px 0}.role span{width:52px}i{display:block;width:64px;height:40px}i.sh{outline:2px dashed #000;outline-offset:-3px}i.li{outline:2px dashed #fff;outline-offset:-3px}h3{margin:10px 0 4px;font-weight:500}</style><p>each row: two deeper shades (dashed dark) · the ramp's own five · their two light negatives (dashed light)</p>${rows}`;
const b = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b.newPage(); await p.setViewport({ width: 700, height: 800 }); await p.setContent(page); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b.close(); }
console.log('→', path.join(outDir, `${name}.png`));
