#!/usr/bin/env node
/**
 * rasterize.mjs — turn SVG files into PNGs the model can Read.
 *
 * The polygonizer illustration spikes write SVGs into
 * lite-template/integration/<date>/spike-output/<name>/*.svg. The Read tool
 * renders PNG/JPG visually but not SVG, so to *evaluate* a generated
 * illustration the model needs a raster. This wraps control's bundled `sharp`
 * (libvips, with librsvg for SVG input) so that conversion is one command.
 *
 * Usage:
 *   node rasterize.mjs <path|dir|glob>... [options]
 *
 * Inputs:
 *   - a .svg file            → rasterized
 *   - a directory            → every .svg under it (recursive) is rasterized
 *   - a shell glob           → let the shell expand it (e.g. foo/*.svg)
 *
 * Options:
 *   --out <dir>     output directory (default: /tmp/svg-preview/<timestamp>)
 *   --density <n>   render DPI; higher = crisper upscale (default: 200)
 *   --max <px>      cap the longest output side, preserving aspect (default: 2000)
 *   --bg <color>    flatten onto this background (default: white; use "none"
 *                   to keep transparency)
 *
 * Output: prints each written PNG's absolute path, one per line, so the caller
 * knows exactly what to Read. A trailing summary line goes to stderr.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
// sharp lives in the control package, not at repo root or in this skill dir.
const require = createRequire(path.join(REPO_ROOT, 'control', 'package.json'));
const sharp = require('sharp');

function parseArgs(argv) {
  const opts = { density: 200, max: 2000, bg: 'white', out: null };
  const inputs = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--density') opts.density = Number(argv[++i]);
    else if (a === '--max') opts.max = Number(argv[++i]);
    else if (a === '--bg') opts.bg = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else inputs.push(a);
  }
  return { opts, inputs };
}

function collectSvgs(input) {
  const abs = path.resolve(input);
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    process.stderr.write(`skip (not found): ${input}\n`);
    return [];
  }
  if (stat.isDirectory()) {
    const found = [];
    for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.svg')) {
        // Node >=20: Dirent.parentPath holds the dir for recursive reads.
        const dir = entry.parentPath || entry.path || abs;
        found.push(path.join(dir, entry.name));
      }
    }
    return found.sort();
  }
  if (abs.toLowerCase().endsWith('.svg')) return [abs];
  process.stderr.write(`skip (not an svg): ${input}\n`);
  return [];
}

// Mirror the SVG's source tree under the out dir so same-named files from
// different spikes (e.g. several "1-*.svg") don't collide.
function outPathFor(svgAbs, outDir) {
  const rel = path.relative(REPO_ROOT, svgAbs);
  const safeRel = rel.startsWith('..') ? path.basename(svgAbs) : rel;
  const png = safeRel.replace(/\.svg$/i, '.png');
  return path.join(outDir, png);
}

async function rasterize(svgAbs, outDir, opts) {
  const outAbs = outPathFor(svgAbs, outDir);
  await fsp.mkdir(path.dirname(outAbs), { recursive: true });
  let pipeline = sharp(svgAbs, { density: opts.density });
  const meta = await pipeline.metadata();
  if (opts.max && Math.max(meta.width || 0, meta.height || 0) > opts.max) {
    pipeline = pipeline.resize({
      width: opts.max,
      height: opts.max,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  if (opts.bg && opts.bg !== 'none') {
    pipeline = pipeline.flatten({ background: opts.bg });
  }
  await pipeline.png().toFile(outAbs);
  return outAbs;
}

async function main() {
  const { opts, inputs } = parseArgs(process.argv.slice(2));
  if (opts.help || inputs.length === 0) {
    process.stderr.write(
      'usage: node rasterize.mjs <path|dir|glob>... ' +
        '[--out DIR] [--density N] [--max PX] [--bg COLOR|none]\n',
    );
    process.exit(opts.help ? 0 : 1);
  }

  // Timestamp comes from the OS, not from inside the process, so this stays a
  // pure-ish script. A fixed-name default would clobber prior previews.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = opts.out ? path.resolve(opts.out) : path.join('/tmp', 'svg-preview', stamp);

  const svgs = [...new Set(inputs.flatMap(collectSvgs))];
  if (svgs.length === 0) {
    process.stderr.write('no svg files matched\n');
    process.exit(1);
  }

  const written = [];
  for (const svg of svgs) {
    try {
      const out = await rasterize(svg, outDir, opts);
      written.push(out);
      process.stdout.write(out + '\n');
    } catch (err) {
      process.stderr.write(`FAILED ${svg}: ${err.message}\n`);
    }
  }
  process.stderr.write(`\nrasterized ${written.length}/${svgs.length} → ${outDir}\n`);
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});
