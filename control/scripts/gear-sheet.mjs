#!/usr/bin/env node
/**
 * Draw a world's starter gear (world-gear.js populateGear) as a shaded contact sheet, and list what it filled, from
 * where, and what it left as tasks and requests:
 *
 *   node scripts/gear-sheet.mjs [--example halden-reach|meadowmark] [--auto "a prompt"] [--only hero,civilization,mirror,contrast] [--cols 6] [--out gear.png]
 *
 * The example worlds get the meadow's hero and `equipment.populate: true` for the drawing. Writes a PNG with sharp
 * when it is installed (it is optional), else a PPM.
 */
import { writeFileSync } from 'node:fs';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const example = flag('--example', 'halden-reach'), auto = flag('--auto'), only = flag('--only'), cols = Number(flag('--cols', 6)), out0 = flag('--out', 'gear-sheet.png');
const G0 = await import('../lib/graph/gameworld/index.js');
const { populateGear, gearFaces } = await import('../lib/graph/gameworld/world-gear.js');
const { techRaster, techSheet } = await import('../lib/graph/gameworld/tech-sheet.js');

const base = auto ? G0.composeGameworld({ prompt: auto, seed: 1 }) : example === 'meadowmark' ? G0.MEADOWMARK_HERO : G0.HALDEN_REACH;
const W = { ...base, characters: base.characters ?? G0.MEADOWMARK_HERO.characters, equipment: { ...(base.equipment ?? G0.MEADOWMARK_HERO.equipment ?? {}), populate: base.equipment?.populate ?? true } };
const { world: G } = G0.resolveWorld(W);
const P = populateGear(G), keep = only ? only.split(',') : null, tiles = [];
for (const e of P.entries) {
  if (keep && !keep.includes(e.source)) continue;
  console.log(`${e.source.padEnd(12)} ${e.id.padEnd(36)} ${e.class.padEnd(10)} ${e.slot.padEnd(5)} ${e.tiers ? 'tiered ' : ''}${e.errors ? `ERRORS ${e.errors.join('; ')}` : e.why}`);
  if (!e.errors) tiles.push(techRaster(gearFaces(e.build), { w: 220, h: 300, eye: [1, -0.6, 0.35], base: (f) => f.base }));
}
for (const t of P.tasks) console.log(`task         ${t.civilization}/${t.id}: ${t.intent}: ${t.why}`);
for (const r of P.requests) console.log(`request      ${r.kind} ${r.id}: opens ${r.opens}`);
const S = techSheet(tiles, { cols, w: 220, h: 300 });
let sharp = null;
try { sharp = (await import('sharp')).default; } catch { /* optional: a PPM instead */ }
if (sharp) { await sharp(Buffer.from(S.rgb), { raw: { width: S.width, height: S.height, channels: 3 } }).png().toFile(out0); console.log(`wrote ${out0}`); }
else { const out = out0.replace(/\.png$/i, '.ppm'); writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${S.width} ${S.height}\n255\n`), Buffer.from(S.rgb)])); console.log(`wrote ${out} (sharp is not installed)`); }
