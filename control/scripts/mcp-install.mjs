#!/usr/bin/env node
/**
 * `mojulo install <pack>` — on-demand capability-pack installer.
 *
 * Mirrors mojulo's standing "no postinstall download" stance (the embed model
 * via fetch-embed-model, Chromium via lib/graph/scene/chromium.js): the base
 * install stays lean and the operator opts INTO heavy capability when they want
 * it. See lib/mcp/install-capabilities.plan.md.
 *
 * The install axis has two GROUPS (mojulo-2.0-pure-creative.plan.md, Phase 1a):
 *   - creative  — the render / media / games stack, the flagship default pack. Its
 *                 footprint is the three optionalDependencies (three /
 *                 node-web-audio-api / opentype.js); installing them flips physical
 *                 detection (packs.js installedGroups) with no env flag needed.
 *   - chatbot   — the bot factory. In-tree code today, so there is nothing to
 *                 install; it is gated only by an explicit MOJULO_PACKS override.
 *                 When it ships as @mojulo/chatbot this verb installs it for real.
 *
 * Everything else — the kernel and the always-present orchestration packs — declares
 * no group and is never gated. `ops` is a deprecated alias for `chatbot`.
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

// The marker the creative group is keyed on (kept in sync with INSTALL_GROUPS
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
      + 'Usage: mojulo install <creative|chatbot>\n\n'
      + 'Status:\n'
      + `  creative   ${creative ? 'installed' : 'not installed'}  (render / media / games stack)\n`
      + '  chatbot    installed  (the bot factory is in-tree code; gate it off with MOJULO_PACKS)\n\n'
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

if (pack === 'chatbot' || pack === 'ops') {
  process.stdout.write(
    pack === 'ops'
      ? "'ops' is a deprecated alias for 'chatbot'. The chatbot pack is in-tree code and always\npresent — nothing to install. Gate it off with MOJULO_PACKS if you want it absent.\n"
      : 'The chatbot pack is in-tree code and always present — nothing to install.\nGate it off with MOJULO_PACKS if you want it absent.\n',
  );
  process.exit(0);
}

if (pack !== 'creative') {
  process.stderr.write(`Unknown pack '${pack}'. Known packs: creative, chatbot. Try \`mojulo install\` for status.\n`);
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
