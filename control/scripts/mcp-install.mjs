#!/usr/bin/env node
/**
 * `mojulo install <pack>` — on-demand capability-pack installer.
 *
 * Mirrors mojulo's standing "no postinstall download" stance (the embed model
 * via fetch-embed-model, Chromium via lib/graph/scene/chromium.js): the base
 * install stays lean and the operator opts INTO heavy capability when they want
 * it. See lib/mcp/install-capabilities.plan.md.
 *
 * The install axis has exactly two packs (install-capabilities.plan.md):
 *   - ops       — bots / connected services / apps. PURE CODE, always shipped;
 *                 it has no optional deps, so there is nothing to install.
 *   - creative  — the render / media / games stack. Its footprint is the three
 *                 optionalDependencies (three / node-web-audio-api / opentype.js);
 *                 installing them flips physical detection (packs.js installedWings)
 *                 to "studio present" with no env flag needed.
 *
 * Imported (not spawned) by scripts/mcp-stdio.mjs BEFORE it configures itself as
 * an MCP server — this verb needs neither the @/ loader nor the tool registry.
 * argv: [node, mcp-stdio.mjs, 'install', '<pack>'] → argv[3] is the pack.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// The marker the whole studio wing is keyed on (kept in sync with WING_INSTALL
// in lib/mcp/packs.js — omitted/installed together with the other creative deps).
const CREATIVE_MARKER = 'three';

function creativeInstalled() {
  try {
    createRequire(import.meta.url).resolve(CREATIVE_MARKER);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', (err) => {
      process.stderr.write(`failed to launch ${cmd}: ${err.message}\n`);
      resolve(1);
    });
  });
}

function printStatus() {
  const creative = creativeInstalled();
  process.stdout.write(
    'mojulo install — on-demand capability packs\n\n'
      + 'Usage: mojulo install <creative|ops>\n\n'
      + 'Status:\n'
      + '  ops        installed  (kernel + ops are pure code, always present)\n'
      + `  creative   ${creative ? 'installed' : 'not installed'}  (render / media / games stack)\n\n`
      + (creative
        ? 'Full install — nothing to add.\n'
        : 'Run `mojulo install creative` to add the render/media/games stack (~82 MB of deps;\n'
          + 'Chromium for scene/world PNG bakes stays lazy-fetched on first render).\n'),
  );
}

const pack = (process.argv[3] || '').trim().toLowerCase();

if (!pack || pack === 'status' || pack === '--help' || pack === '-h') {
  printStatus();
  process.exit(0);
}

if (pack === 'ops') {
  process.stdout.write('The ops pack is pure code and always present — nothing to install.\n');
  process.exit(0);
}

if (pack !== 'creative') {
  process.stderr.write(`Unknown pack '${pack}'. Known packs: creative, ops. Try \`mojulo install\` for status.\n`);
  process.exit(1);
}

if (creativeInstalled()) {
  process.stdout.write('Creative pack already installed (its optional deps resolve). Nothing to do.\n');
  process.exit(0);
}

process.stdout.write('Installing the creative pack — optional deps: three, node-web-audio-api, opentype.js …\n\n');
// --include=optional forces the optionalDependencies even if a prior
// `npm install --omit=optional` (or an .npmrc omit) left them out.
const code = await run(NPM, ['install', '--include=optional'], { cwd: CONTROL_DIR });

if (code !== 0 || !creativeInstalled()) {
  process.stderr.write('\nCreative pack install did not complete — the optional deps are still not resolvable.\n');
  process.exit(code || 1);
}

process.stdout.write(
  '\nCreative pack installed. Studio tools (compose_world, create_view, beats, …) are now live;\n'
    + 'scene/world PNG renders will lazy-fetch Chromium on first use.\n',
);
process.exit(0);
