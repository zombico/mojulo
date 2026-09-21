#!/usr/bin/env node
/**
 * `mojulo install <pack>` — on-demand capability-pack installer.
 *
 * Mirrors mojulo's standing "no postinstall download" stance (the embed model
 * via fetch-embed-model, Chromium via lib/graph/scene/chromium.js): the base
 * install stays lean and the operator opts INTO heavy capability when they want
 * it. See lib/mcp/install-capabilities.plan.md.
 *
 * The install axis has three GROUPS (mojulo-2.0-pure-creative.plan.md, Phase 1a):
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
 *                 Installing it installs `recall` first: the builder's preview
 *                 RAG must behave like the deployed bot, which embeds.
 *   - recall    — the embedding runtime (@huggingface/transformers + onnxruntime +
 *                 the e5 model). OPT-IN: not a dependency of the package at all.
 *                 Installed OUTSIDE the package, under $MOJULO_HOME/recall/ — its
 *                 own package.json and an entry.mjs shim that lib/embedder/local.js
 *                 imports by file URL — so it survives package upgrades the way
 *                 $MOJULO_HOME/models does and never mutates the shipped
 *                 package.json. Without it `semantic_search` ranks lexically
 *                 (FTS5); with it, by vector. `--remove` deletes the dir (the
 *                 model cache under models/ is left alone).
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

// The recall group's home and marker (INSTALL_GROUPS.recall.markerFile) and the
// runtime it installs there. The version range is the one the package used to
// carry as a dependency; the model it fetches is pinned in lib/embedder/local.js.
const RECALL_DIR = 'recall';
const RECALL_PACKAGE = '@huggingface/transformers';
const RECALL_RANGE = '^4.2.0';

function mojuloHome() {
  return process.env.MOJULO_HOME || path.join(os.homedir(), '.mojulo');
}

function chatbotMarkerPath() {
  return path.join(mojuloHome(), CHATBOT_MARKER);
}

function recallDir() {
  return path.join(mojuloHome(), RECALL_DIR);
}

function recallInstalled() {
  if (fs.existsSync(path.join(recallDir(), 'node_modules', RECALL_PACKAGE, 'package.json'))) return true;
  try {
    createRequire(import.meta.url).resolve(RECALL_PACKAGE); // repo-dev, installed by hand
    return true;
  } catch {
    return false;
  }
}

// Installs the embedding runtime under $MOJULO_HOME/recall and fetches the model.
// Returns the exit code. Idempotent: an installed group is reported, not redone.
async function installRecall() {
  if (recallInstalled()) {
    process.stdout.write('Recall group already installed (the embedding runtime resolves). Nothing to do.\n');
    return 0;
  }
  const dir = recallDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'mojulo-recall',
        private: true,
        description: 'mojulo recall group — the embedding runtime, installed outside the mojulo package. Managed by `mojulo install recall`.',
        dependencies: { [RECALL_PACKAGE]: RECALL_RANGE },
      },
      null,
      2,
    ) + '\n',
  );
  // The shim lib/embedder/local.js imports by file URL: Node resolves the bare
  // specifier from HERE, so it walks up into this dir's node_modules.
  fs.writeFileSync(
    path.join(dir, 'entry.mjs'),
    `// mojulo recall group — re-exports the embedding runtime installed beside this file.\nexport * from '${RECALL_PACKAGE}';\n`,
  );
  process.stdout.write(`Installing the recall group into ${dir} — ${RECALL_PACKAGE} (brings onnxruntime; ~480 MB on disk) …\n\n`);
  const code = await run(NPM, ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir });
  if (code !== 0 || !recallInstalled()) {
    process.stderr.write('\nRecall group install did not complete — the embedding runtime is still not resolvable.\n');
    return code || 1;
  }
  process.stdout.write('\nFetching the embedding model (~130 MB, once) …\n');
  const fetched = await run(
    process.execPath,
    [path.join(CONTROL_DIR, 'scripts', 'fetch-embed-model.js')],
    {
      cwd: CONTROL_DIR,
      env: {
        ...process.env,
        MOJULO_HOME: mojuloHome(),
        MOJULO_MODELS_DIR: process.env.MOJULO_MODELS_DIR || path.join(mojuloHome(), 'models'),
      },
    },
  );
  if (fetched !== 0) {
    process.stderr.write(
      '\nThe runtime is installed but the model fetch failed — it is retried lazily on the first embedding call, '
        + 'or run `node scripts/fetch-embed-model.js` in the package directory.\n',
    );
    return fetched;
  }
  process.stdout.write(
    '\nRecall group installed. semantic_search now ranks by embedding; restart your MCP host to pick it up.\n',
  );
  return 0;
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
  const recall = recallInstalled();
  const chatbot = chatbotInstalled();
  process.stdout.write(
    'mojulo install — on-demand capability packs\n\n'
      + 'Usage: mojulo install <creative|recall|chatbot> [--remove]\n\n'
      + 'Status:\n'
      + `  creative   ${creative ? 'installed' : 'not installed'}  (render / media / games stack)\n`
      + `  recall     ${recall ? 'installed' : 'not installed'}  (the embedding model behind semantic_search — lexical without it)\n`
      + `  chatbot    ${chatbot ? 'installed' : 'not installed'}  (the bot factory — opt-in since 2.0; needs recall)\n\n`
      + (creative
        ? ''
        : 'Run `mojulo install creative` to add the render/media/games stack (~82 MB of deps;\n'
          + 'Chromium for scene/world PNG bakes stays lazy-fetched on first render).\n')
      + (recall
        ? ''
        : 'Run `mojulo install recall` to add vector recall (~480 MB runtime under ~/.mojulo/recall plus a\n'
          + '~130 MB model). semantic_search works without it, ranking by lexical match.\n')
      + (chatbot
        ? ''
        : 'Run `mojulo install chatbot` to add the bot factory (build/deploy/operate chatbots).\n'
          + 'It is opt-in since 2.0 — mojulo is a 3D compiler first.\n')
      + (creative && recall && chatbot ? 'Everything installed — nothing to add.\n' : ''),
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
  // The builder's preview RAG embeds with the same model the deployed bot uses;
  // a preview that ranked differently from the bot would lie to the operator.
  if (!recallInstalled()) {
    process.stdout.write('The chatbot pack needs the recall group (the embedding runtime). Installing it first.\n\n');
    const code = await installRecall();
    if (code !== 0) process.exit(code);
    process.stdout.write('\n');
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

if (pack === 'recall') {
  if (process.argv.includes('--remove')) {
    const dir = recallDir();
    if (!fs.existsSync(dir)) {
      process.stdout.write('The recall group is already absent — nothing to remove.\n');
      process.exit(0);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    process.stdout.write(
      `Recall group removed (${dir} deleted). semantic_search ranks lexically from the next restart;\n`
        + 'text rows stay indexed. The model cache under models/ is kept. Re-add with `mojulo install recall`.\n',
    );
    process.exit(0);
  }
  process.exit(await installRecall());
}

if (pack !== 'creative') {
  process.stderr.write(`Unknown pack '${pack}'. Known packs: creative, recall, chatbot. Try \`mojulo install\` for status.\n`);
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
