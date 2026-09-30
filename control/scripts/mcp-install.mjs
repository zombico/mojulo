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
 *   - creative  — the render / media / games stack, the flagship default pack. It
 *                 ships with the base install and is always present, so `install
 *                 creative` has nothing to do: it reports which of the optional
 *                 helpers (package.json optionalDependencies) resolve, and installs
 *                 nothing. Until 3.0 it ran `npm install --include=optional` inside
 *                 the package directory, which under npx is a throwaway cache dir
 *                 and pulled the whole devDependency tree.
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
 * no group and is never gated.
 *
 * `chatbot` (and its old alias `ops`) was a third group from 2.0 to 2.x: the bot factory.
 * It left mojulo in 3.0.0, so `install chatbot` installs nothing, writes nothing, prints
 * where the factory went (lib/mcp/bot-factory-moved.js) and exits 0. A marker an earlier
 * install wrote under $MOJULO_HOME/packs/chatbot is left alone; nothing reads it.
 *
 * Imported (not spawned) by scripts/mcp-stdio.mjs BEFORE it configures itself as
 * an MCP server — this verb needs neither the @/ loader nor the tool registry.
 * argv: [node, mcp-stdio.mjs, 'install', '<pack>'] → argv[3] is the pack.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { distribution, mojuloCommand } from '../lib/version/distribution.js';
import { BOT_FACTORY_MOVED } from '../lib/mcp/bot-factory-moved.js';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// The marker `install chatbot` wrote on 2.x (RETIRED_CHATBOT_MARKER in lib/mcp/packs.js). Only
// read, to mention a leftover; never written or removed.
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

function modelsDir() {
  return process.env.MOJULO_MODELS_DIR || path.join(mojuloHome(), 'models');
}

// The file scripts/fetch-embed-model.js checks for once the model is in place (the model it names,
// pinned in lib/embedder/local.js).
function recallModelPresent() {
  return fs.existsSync(path.join(modelsDir(), 'Xenova', 'multilingual-e5-small', 'onnx', 'model_quantized.onnx'));
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
// Returns the exit code. Idempotent: an installed group is reported, not redone. A runtime whose
// model is missing (a fetch that failed once, a cleared models/ dir) gets the model fetched: the
// Claude plugin build never fetches it on its own, so this command is the one that does.
async function installRecall() {
  if (recallInstalled()) {
    if (recallModelPresent()) {
      process.stdout.write('Recall group already installed (the embedding runtime resolves).\n');
      return buildRecallIndex();
    }
    process.stdout.write(`The embedding runtime is installed, but its model is not in ${modelsDir()}.\n`);
    return fetchRecallModel();
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
  return fetchRecallModel();
}

// Fetches the model into $MOJULO_HOME/models (scripts/fetch-embed-model.js). Returns the exit code.
async function fetchRecallModel() {
  process.stdout.write('\nFetching the embedding model (~130 MB, once) …\n');
  const fetched = await run(
    process.execPath,
    [path.join(CONTROL_DIR, 'scripts', 'fetch-embed-model.js')],
    {
      cwd: CONTROL_DIR,
      env: {
        ...process.env,
        MOJULO_HOME: mojuloHome(),
        MOJULO_MODELS_DIR: modelsDir(),
      },
    },
  );
  if (fetched !== 0) {
    // The Claude plugin build never fetches the model on its own (lib/embedder/local.js): running
    // this command again is the way there. Elsewhere the server also fetches it when it next starts.
    const later = distribution() === 'claude-plugin'
      ? '.\n'
      : '; the MCP server also fetches it when it next starts (and again on the first embedding call if that fails too)'
        + (distribution() === 'source' ? ', or run `node scripts/fetch-embed-model.js` in control/.\n' : '.\n');
    process.stderr.write(
      `\nThe runtime is installed but the model fetch failed. Run \`${mojuloCommand('install recall')}\` again to retry${later}`,
    );
    return fetched;
  }
  const indexed = await buildRecallIndex();
  if (indexed !== 0) return indexed;
  process.stdout.write(
    '\nRecall group installed. semantic_search now ranks by embedding; restart your MCP host to pick it up.\n',
  );
  return 0;
}

// Embeds the index once, here, so the vectors are in the database before the first search. The server's
// boot backfill would give them too, but a CLI call is one short-lived process that exits before it
// finishes: without this, a shell host searched an index with no vectors. Idempotent (rows whose text and
// model are unchanged are skipped), so a re-run only fills what is missing.
async function buildRecallIndex() {
  process.stdout.write('\nIndexing the cards, catalysts and your recipes for vector recall …\n');
  const url = (...p) => pathToFileURL(path.join(CONTROL_DIR, ...p)).href;
  const script = [
    "import { register } from 'node:module';",
    `register(${JSON.stringify(url('scripts', 'mcp-stdio-loader.mjs'))});`,
    `const { resolveMojuloPaths } = await import(${JSON.stringify(url('scripts', 'mojulo-paths.mjs'))});`,
    'resolveMojuloPaths();',
    `const { reindexAll } = await import(${JSON.stringify(url('lib', 'db', 'repositories', 'embeddings.js'))});`,
    `const { getDb } = await import(${JSON.stringify(url('lib', 'db', 'index.js'))});`,
    'const r = await reindexAll();',
    "const { n, v } = getDb().prepare('SELECT COUNT(*) AS n, COUNT(embedding) AS v FROM meta_embeddings').get();",
    'process.stdout.write(`The index holds ${n} entries, ${v} with vectors (${r.written} embedded now).\\n`);',
    "if (v < n) process.stdout.write('The rest are text only, so semantic_search answers lexically for them; run this again once the model loads.\\n');",
    'process.exit(r.failed ? 1 : 0);',
  ].join('\n');
  const code = await run(process.execPath, ['--input-type=module', '-e', script], {
    cwd: CONTROL_DIR,
    // the boot backfill getDb() would start stays off: this child is the backfill
    env: { ...process.env, MOJULO_HOME: mojuloHome(), MOJULO_MODELS_DIR: modelsDir(), MOJULO_SEMANTIC_INDEX_DISABLED: '1', MOJULO_DISABLE_SCENE_WARM: '1' },
  });
  if (code !== 0) {
    process.stderr.write(
      `\nThe recall group is installed, but indexing did not finish. Run \`${mojuloCommand('install recall')}\` again; semantic_search answers lexically until it does.\n`,
    );
  }
  return code;
}

function chatbotMarkerLeftover() {
  return fs.existsSync(chatbotMarkerPath());
}

// creative is always installed (INSTALL_GROUPS.creative.alwaysInstalled in
// lib/mcp/packs.js). What can be missing is an optional helper that some of its
// calls load lazily; those calls say so in-band.
function missingCreativeHelpers() {
  const { optionalDependencies = {} } = JSON.parse(fs.readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'));
  // ESM resolution: manifold-3d and openscad-wasm-prebuilt export no `require` entry.
  return Object.keys(optionalDependencies).filter((name) => {
    try {
      import.meta.resolve(name);
      return false;
    } catch {
      return true;
    }
  });
}

function creativeHelpersLine(missing) {
  return missing.length
    ? `  Optional helpers not installed here: ${missing.join(', ')}. The calls that need them say so\n`
      + '  in-band (for example WAV audio, OpenSCAD meshing, exact booleans, raster images); everything\n'
      + '  else in the creative pack works without them.\n'
    : '';
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
  const recall = recallInstalled();
  process.stdout.write(
    'mojulo install — on-demand capability packs\n\n'
      + `Usage: ${mojuloCommand('install')} recall [--remove]\n\n`
      + 'Status:\n'
      + '  creative   installed  (render / media / games stack; ships with the base install)\n'
      + creativeHelpersLine(missingCreativeHelpers())
      + `  recall     ${recall ? 'installed' : 'not installed'}  (the embedding model behind semantic_search — lexical without it)\n\n`
      + (recall
        ? 'Everything installed — nothing to add.\n'
        : `Run \`${mojuloCommand('install recall')}\` to add vector recall (~480 MB runtime under ~/.mojulo/recall plus a\n`
          + '~130 MB model). semantic_search works without it, ranking by lexical match.\n'),
  );
}

const pack = (process.argv[3] || '').trim().toLowerCase();

if (!pack || pack === 'status' || pack === '--help' || pack === '-h') {
  printStatus();
  process.exit(0);
}

// The chatbot factory left in 3.0.0: install nothing, write nothing, say where it went. Exit 0 so
// a setup script that still runs `install chatbot` keeps going (the rest of mojulo is unaffected).
if (pack === 'chatbot' || pack === 'ops') {
  process.stdout.write(`${BOT_FACTORY_MOVED}\nNothing was installed.\n`);
  if (chatbotMarkerLeftover()) {
    process.stdout.write(
      `(The marker an earlier install wrote at ${chatbotMarkerPath()} is ignored by 3.0; you may delete it.)\n`,
    );
  }
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
        + `text rows stay indexed. The model cache under models/ is kept. Re-add with \`${mojuloCommand('install recall')}\`.\n`,
    );
    process.exit(0);
  }
  process.exit(await installRecall());
}

if (pack !== 'creative') {
  process.stderr.write(`Unknown pack '${pack}'. Known packs: creative, recall. Try \`${mojuloCommand('install')}\` for status.\n`);
  process.exit(1);
}

process.stdout.write(
  'The creative pack ships with the base install, so there is nothing to install: its tools are\n'
    + 'always listed unless a MOJULO_PACKS override leaves it out.\n'
    + creativeHelpersLine(missingCreativeHelpers()),
);
process.exit(0);
