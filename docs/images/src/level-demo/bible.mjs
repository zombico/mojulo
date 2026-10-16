// The world bible of a stored gameworld, as an HTML file (the page /api/sketches/<ref>/bible serves, without a
// server), and its cube as read: the colours, sky and palette the color theorist solved for it.
//
//   node docs/images/src/level-demo/bible.mjs <manifest.json> <out.html> <cube.json>
import { register } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const { gameworldBibleHtml } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/gameworld/index.js')).href);
const { readGeocube, geocubeRamps } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/era/geocube.js')).href);

const [, , src, out, cubeOut] = process.argv;
const { kind: _k, ...world } = JSON.parse(readFileSync(src, 'utf8'));
writeFileSync(out, gameworldBibleHtml(world));
if (cubeOut && world.style?.geocube) {
  const c = readGeocube(world.style.geocube);
  writeFileSync(cubeOut, JSON.stringify({ id: c.id, title: c.title, reads: c.reads, palette: c.palette, ramps: geocubeRamps(c), sky: c.light.sky }, null, 1));
}
