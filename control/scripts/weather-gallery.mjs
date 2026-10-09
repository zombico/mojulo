#!/usr/bin/env node
/**
 * weather-gallery.mjs: write the world weather gallery (every state and every climate, in each art style's air) to a
 * directory, and say where to open it. Usage (from control/):  node scripts/weather-gallery.mjs <out-dir> [--seed N]
 * Standalone pages, no server: open <out-dir>/index.html. Machine gate only (lib/graph/weather/gallery.js).
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { weatherGallery } from '../lib/graph/weather/gallery.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { seed: { type: 'string' } } });
const out = positionals[0];
if (!out) { console.error('usage: node scripts/weather-gallery.mjs <out-dir> [--seed N]'); process.exit(2); }
const files = weatherGallery({ seed: values.seed ? Number(values.seed) : undefined });
await fs.mkdir(out, { recursive: true });
for (const [name, html] of Object.entries(files)) await fs.writeFile(path.join(out, name), html);
console.log(JSON.stringify({ dir: path.resolve(out), open: path.resolve(out, 'index.html'), files: Object.keys(files) }));
