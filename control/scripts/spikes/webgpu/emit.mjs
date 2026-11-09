// THE WEBGPU SPIKE, step 1: today's gen-7 World page for a geocube island (the form render the era says is built), and an
// inventory of what it carries: its size, its shader hooks (onBeforeCompile, ShaderMaterial, render targets) and its
// prepasses, the work a node twin would have to do.
//   node scripts/spikes/webgpu/emit.mjs [--out <dir>] [--cube island-noon] [--show land|trail|path] [--era gen-6|gen-7]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const outDir = path.resolve(arg('--out', 'spike-output/webgpu')), cube = arg('--cube', 'island-noon'), show = arg('--show', 'land'), era = arg('--era', 'gen-7');
fs.mkdirSync(outDir, { recursive: true });

const manifest = { kind: 'geocube', cube, show, ...(show === 'land' ? {} : { seed: 1 }) };
const { payload } = await resolveWorldScene({ title: 'island', manifest }, { era });
const html = emitThreeWorld({ ...payload, capture: true });
const file = path.join(outDir, `island-${era}.html`);
fs.writeFileSync(file, html);

const count = (re) => (html.match(re) || []).length;
const keys = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined && v !== false && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)).map(([k]) => k);
console.log(JSON.stringify({
  file, bytes: html.length, era, payloadKeys: keys,
  hooks: { onBeforeCompile: count(/onBeforeCompile/g), ShaderMaterial: count(/ShaderMaterial\(/g), WebGLRenderTarget: count(/WebGLRenderTarget\(/g) },
  prepasses: [...new Set(html.match(/__\w+(Prepass|Pass)\(\)/g) || [])],
  blocks: [...new Set(html.match(/\/\/ --- [^\n]{0,70}/g) || [])].slice(0, 40),
}, null, 1));
