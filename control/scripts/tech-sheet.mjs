#!/usr/bin/env node
/**
 * Draw crafted technology as a contact sheet, shaded as the engine will shade it, and say for each what it read as,
 * what it was dressed in and whether every law held:
 *
 *   node scripts/tech-sheet.mjs "vehicle|a covered wagon|riveted|third-person|timber-and-rope|muscle" "weapon|a field cannon" [--eye front|rear|side] [--cols 3] [--out sheet.png]
 *
 * Each brief is `kind|words[|motif|camera|made|driven]`: the motif, camera and setting default to smooth, third
 * person and the alloy finish's. Rank and use are each thing's own default (tech-direction.js). Writes a PNG with
 * sharp when it is installed (it is optional), else a PPM any image viewer opens.
 */
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const eyeName = flag('--eye', 'front'), cols = Number(flag('--cols', 3)), out0 = flag('--out', 'tech-sheet.png');
const { buildAdorned } = await import('../lib/graph/gameworld/tech-adornment.js');
const { craftTech } = await import('../lib/graph/gameworld/tech-crafter.js');
const { rankOf, useOf } = await import('../lib/graph/gameworld/tech-direction.js');
const { techRaster, techSheet, SHEET_EYES } = await import('../lib/graph/gameworld/tech-sheet.js');
if (!SHEET_EYES[eyeName]) { console.error(`tech-sheet: --eye is one of ${Object.keys(SHEET_EYES).join(', ')}`); process.exit(1); }
if (!args.length) { console.error('tech-sheet: name at least one brief, "kind|words[|motif|camera|made|driven]"'); process.exit(1); }

const LIST = { vehicle: 'vehicles', structure: 'structures', weapon: 'weapons' }, tiles = [];
for (const brief of args) {
  const [kind, intent, motif = 'smooth', camera = 'third-person', made, driven] = brief.split('|');
  const t = { ...craftTech(kind, intent).plan, intent }, rank = rankOf(LIST[kind], t).rank, use = useOf(LIST[kind], t).use;
  const a = buildAdorned(t, { kind, direction: { motif, camera, ...(made ? { setting: { made, driven: driven ?? 'combustion' } } : {}) }, rank, use });
  const failed = a.laws.filter((l) => !l.ok).map((l) => `${l.law}: ${l.value}`);
  console.log(`${intent} → ${t.form}${a.variant ? `/${a.variant}` : ''} · ${rank} ${use} · ${a.readout.triangles} triangles · ${[...new Set(a.mechanisms.map((m) => `${m.mechanism} ${m.dress}`))].join(', ') || 'no mechanism'} · ${a.held ? 'every law holds' : `advises ${failed.join('; ')}`}${a.conflict ? ` · conflict: ${a.conflict.why}` : ''}`);
  tiles.push(techRaster(a.faces, { eye: SHEET_EYES[eyeName] }));
}
const S = techSheet(tiles, { cols });
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional: a PPM instead */ }
if (sharp) { await sharp(Buffer.from(S.rgb), { raw: { width: S.width, height: S.height, channels: 3 } }).png().toFile(out0); console.log(`wrote ${out0}`); }
else {
  const out = out0.replace(/\.png$/i, '.ppm');
  writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${S.width} ${S.height}\n255\n`), Buffer.from(S.rgb)]));
  console.log(`wrote ${out} (sharp is not installed)`);
}
