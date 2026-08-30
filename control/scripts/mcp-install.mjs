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
 *   - chatbot   — the bot factory. OPT-IN as of 2.0: a fresh install does not
 *                 have it. `mojulo install chatbot` writes a marker file under
 *                 $MOJULO_HOME which flips physical detection on; deleting that
 *                 file puts it away again. The code is in-tree until the Phase 3
 *                 ABI lands, so this is a logical gate — but from the operator's
 *                 side it behaves like the eventual @mojulo/chatbot package.
 *
 * Everything else — the kernel and the always-present orchestration packs — declares
 * no group and is never gated. `ops` is a deprecated alias for `chatbot`.
 *
 * Imported (not spawned) by scripts/mcp-stdio.mjs BEFORE it configures itself as
 * an MCP server — this verb needs neither the @/ loader nor the tool registry.
 * argv: [node, mcp-stdio.mjs, 'install', '<pack>'] → argv[3] is the pack.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// The marker the creative group is keyed on (kept in sync with INSTALL_GROUPS
// in lib/mcp/packs.js — omitted/installed together with the other creative deps).
const CREATIVE_MARKER = 'three';

// Kept in sync with INSTALL_GROUPS.chatbot.markerFile in lib/mcp/packs.js.
const CHATBOT_MARKER = 'packs/chatbot';

function chatbotMarkerPath() {
  const home = process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
  return path.join(home, CHATBOT_MARKER);
}

function chatbotInstalled() {
  return fs.existsSync(chatbotMarkerPath());
}

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
      + `  chatbot    ${chatbotInstalled() ? 'installed' : 'not installed'}  (the bot factory — opt-in since 2.0)\n\n`
      + (creative
        ? ''
        : 'Run `mojulo install creative` to add the render/media/games stack (~82 MB of deps;\n'
          + 'Chromium for scene/world PNG bakes stays lazy-fetched on first render).\n')
      + (chatbotInstalled()
        ? ''
        : 'Run `mojulo install chatbot` to add the bot factory (build/deploy/operate chatbots).\n'
          + 'It is opt-in since 2.0 — mojulo is a 3D factory first.\n')
      + (creative && chatbotInstalled() ? 'Everything installed — nothing to add.\n' : ''),
  );
}

const pack = (process.argv[3] || '').trim().toLowerCase();

if (!pack || pack === 'status' || pack === '--help' || pack === '-h') {
  printStatus();
  process.exit(0);
}

if (pack === 'chatbot' || pack === 'ops') {
  if (pack === 'ops') {
    process.stdout.write("('ops' is a deprecated alias for 'chatbot'.)\n");
  }
  const marker = chatbotMarkerPath();
  const remove = process.argv.includes('--remove');
  if (remove) {
    if (!chatbotInstalled()) {
      process.stdout.write('The chatbot pack is already absent — nothing to remove.\n');
      process.exit(0);
    }
    fs.rmSync(marker);
    process.stdout.write(
      'Chatbot pack removed. Its tools no longer list or run.\n'
        + 'Already-deployed bots are unaffected — they run as their own processes and\n'
        + 'were never part of the workshop install. Re-add with `mojulo install chatbot`.\n',
    );
    process.exit(0);
  }
  if (chatbotInstalled()) {
    process.stdout.write(`Chatbot pack already installed (marker at ${marker}). Nothing to do.\n`);
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(
    marker,
    'mojulo chatbot pack — presence marker.\n'
      + 'Delete this file (or run `mojulo install chatbot --remove`) to put the bot\n'
      + 'factory away. The code ships in-tree; this file is what turns it on.\n',
  );
  process.stdout.write(
    `Chatbot pack installed (marker written to ${marker}).\n`
      + 'The bot factory tools now list and run. Restart your MCP host to pick them up.\n',
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
