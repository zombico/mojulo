#!/usr/bin/env node
/**
 * Write a scapeshift outdoor sheet to disk: `node scripts/out-sheet.mjs <index|flora|structures|fortified-town|castle|gameworld> [out.html] [--seed N] [--kit id] [--raster]`.
 * `--raster` swaps each of the gameworld bible's plates (drawn as SVG) for a JPEG, for a page small enough to share.
 * The sheets are pure string builders (era/out-*-html.js); this only writes one where a browser can open it.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const raster = args.includes('--raster') && !!args.splice(args.indexOf('--raster'), 1);
const seed = flag('--seed'), kitId = flag('--kit');
const [name = 'structures', out = `out-${name}.html`] = args;
const SHEETS = {
  index: async (o) => (await import('../lib/graph/era/out-index-html.js')).outIndexHtml(o),
  flora: async (o) => (await import('../lib/graph/era/out-flora-html.js')).outFloraHtml(o),
  structures: async (o) => (await import('../lib/graph/era/out-structures-html.js')).outStructuresHtml(o),
  'fortified-town': async (o) => (await import('../lib/graph/era/out-fortified-town-html.js')).outFortifiedTownHtml(o),
  castle: async (o) => (await import('../lib/graph/era/out-castle-html.js')).outCastleHtml(o),
  gameworld: async () => { const G = await import('../lib/graph/gameworld/index.js'); return G.gameworldBibleHtml(G.MEADOWMARK); },
};
if (!SHEETS[name]) { console.error(`out-sheet: '${name}' is not a sheet (${Object.keys(SHEETS).join(', ')})`); process.exit(1); }
const opts = { ...(seed ? { seed: Number(seed) } : {}), ...(kitId ? { kitId } : {}) };
let html = await SHEETS[name](opts);
if (raster) html = await rasterPlates(html);
writeFileSync(resolve(out), html);
console.log(`${resolve(out)} (${Math.round(html.length / 1024)} KB)`);

// each fenced plate's SVG as a JPEG (sharp), twice its drawn size
async function rasterPlates(page) {
  const sharp = (await import('sharp')).default, parts = page.split(/<!--plate:([^>]*)-->([\s\S]*?)<!--\/plate-->/), out = [parts[0]];
  for (let i = 1; i < parts.length; i += 3) {
    let svg = parts[i + 1];
    if (!/xmlns=/.test(svg.slice(0, 300))) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    const jpg = await sharp(Buffer.from(svg), { density: 144, limitInputPixels: false }).flatten({ background: '#ffffff' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    out.push(`<img src="data:image/jpeg;base64,${jpg.toString('base64')}" alt="${parts[i]}" loading="lazy">`, parts[i + 2]);
  }
  return out.join('');
}
