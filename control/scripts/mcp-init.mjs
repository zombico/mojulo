#!/usr/bin/env node
/**
 * `npx mojulo init` — one-shot installer.
 *
 * Reached via the `init` argv branch in [mcp-stdio.mjs](./mcp-stdio.mjs) (the
 * `mojulo` bin), so the user-facing command is `npx mojulo init`. Fully
 * self-contained: does its own loader register + path resolution (like
 * [mcp-config.mjs](./mcp-config.mjs)) so it can reach ApiKeyRepository for the
 * optional key step, then exits — it never returns to the stdio server loop.
 *
 * Flow:
 *   detect hosts → per-host wire (y/n) → optional provider key → open dashboard
 *   → print the KEYLESS first-look instruction.
 *
 * Design invariants:
 *   - No LLM key REQUIRED. Offered, skippable. The first look needs no key.
 *   - Idempotent + safe. Detect-before-write; back up JSON/TOML; atomic writes;
 *     one bad host never aborts init (fall back to printing the manual command).
 *   - Never touch .env secrets. The key step goes through ApiKeyRepository +
 *     encryptApiKey (AES-256-GCM), the same path as mojulo-config.
 *
 * STATUS: all three host writers are real — Claude Code (CLI shell-out), Codex
 * and Claude Desktop (config-file merge with backup + detect-before-write) — plus
 * the provider-key step and the dashboard launch. A host with no writer, or a
 * write that fails, degrades to printing the manual snippet.
 */

import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, copyFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

// Same setup as mcp-config.mjs so the key step can reach @/lib code.
register('./mcp-stdio-loader.mjs', import.meta.url);
resolveMojuloPaths();
const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTROL_DIR = path.resolve(SCRIPTS_DIR, '..');
process.chdir(CONTROL_DIR);

// ── args ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { yes: false, ui: true, host: null, print: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') args.yes = true;
    else if (a === '--no-ui') args.ui = false;
    else if (a === '--print') args.print = true;
    else if (a === '--host') args.host = argv[++i];
    else if (a.startsWith('--host=')) args.host = a.slice('--host='.length);
    else if (a === '-h' || a === '--help') usage(0);
    else {
      process.stderr.write(`mojulo init: unknown arg "${a}"\n`);
      usage(2);
    }
  }
  return args;
}

function usage(code = 0) {
  process.stdout.write(
    [
      'Usage: npx mojulo init [options]',
      '',
      'Wire mojulo into your MCP host(s), optionally set a key, open the dashboard.',
      '',
      '  --yes         take all defaults (wire every detected host, skip key, open UI)',
      '  --no-ui       do not launch the dashboard',
      '  --host <id>   target one host: claude-code | codex | desktop',
      '  --print       dry-run: show what would be written, change nothing',
      '  -h, --help    this message',
      '',
    ].join('\n')
  );
  process.exit(code);
}

// ── prompts ───────────────────────────────────────────────────────────────────
let rl = null;
function ask(question) {
  if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())));
}
async function confirm(question, def = true) {
  const hint = def ? '[Y/n]' : '[y/N]';
  const a = (await ask(`${question} ${hint} `)).toLowerCase();
  if (!a) return def;
  return a === 'y' || a === 'yes';
}

// ── host detection ────────────────────────────────────────────────────────────
function detectHosts() {
  const hosts = [];

  // Claude Code — the `claude` CLI on PATH.
  const claudeProbe = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  if (!claudeProbe.error && claudeProbe.status === 0) hosts.push('claude-code');

  // Codex — ~/.codex/config.toml, or `codex` on PATH.
  const codexCfg = path.join(os.homedir(), '.codex', 'config.toml');
  const codexProbe = spawnSync('codex', ['--version'], { stdio: 'ignore' });
  if (existsSync(codexCfg) || (!codexProbe.error && codexProbe.status === 0)) hosts.push('codex');

  // Claude Desktop — the config dir (macOS / Windows / Linux).
  if (existsSync(desktopConfigPath())) hosts.push('desktop');

  return hosts;
}

function desktopConfigPath() {
  const home = os.homedir();
  if (process.platform === 'darwin')
    return path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (process.platform === 'win32')
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  return path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

const MANUAL = {
  'claude-code': 'claude mcp add mojulo --command "npx -y mojulo"',
  codex: '[mcp_servers.mojulo]\ncommand = "npx"\nargs = ["-y", "mojulo"]   # add to ~/.codex/config.toml',
  desktop: '"mojulo": { "command": "npx", "args": ["-y", "mojulo"] }   # add under mcpServers in the Desktop config',
};

// ── safe file writes (shared by the file-editing host writers) ────────────────
function backup(file) {
  let n = 1;
  while (existsSync(`${file}.mojulo-bak-${n}`)) n++;
  const dest = `${file}.mojulo-bak-${n}`;
  copyFileSync(file, dest);
  return dest;
}

function atomicWrite(file, contents) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, contents);
  renameSync(tmp, file); // rename is atomic within a filesystem
}

// ── host wiring ────────────────────────────────────────────────────────────────
function wireHost(host, opts) {
  if (host === 'claude-code') return wireClaudeCode(opts);
  if (host === 'codex') return wireCodex(opts);
  if (host === 'desktop') return wireDesktop(opts);
  process.stdout.write(
    `  ↪ ${host}: no writer — add manually:\n\n    ${MANUAL[host].replace(/\n/g, '\n    ')}\n\n`
  );
  return false;
}

// Codex — append `[mcp_servers.mojulo]` to ~/.codex/config.toml. Append-if-absent
// is deliberately round-trip-safe: existing servers, comments, and formatting are
// never rewritten. Detection matches the standard table-header form we write;
// hand-written inline-table variants aren't detected (documented in the plan).
function wireCodex({ print }) {
  const cfg = path.join(os.homedir(), '.codex', 'config.toml');
  const exists = existsSync(cfg);
  const text = exists ? readFileSync(cfg, 'utf8') : '';
  if (/^\s*\[mcp_servers\.mojulo\]/m.test(text)) {
    process.stdout.write('  ✓ codex: mojulo already in config.toml — leaving it as-is.\n');
    return true;
  }
  const body = '[mcp_servers.mojulo]\ncommand = "npx"\nargs = ["-y", "mojulo"]\n';
  const next = !text ? body : text + (text.endsWith('\n') ? '' : '\n') + '\n' + body;
  if (print) {
    process.stdout.write(`  (--print) would append to ${cfg}:\n\n${body}\n`);
    return true;
  }
  if (exists) {
    const bak = backup(cfg);
    process.stdout.write(`  · backed up config.toml → ${path.basename(bak)}\n`);
  }
  atomicWrite(cfg, next);
  process.stdout.write(`  ✓ codex: appended [mcp_servers.mojulo] to ${cfg}.\n`);
  return true;
}

// Claude Desktop — patch mcpServers.mojulo into claude_desktop_config.json using
// the stdio {command,args} form (NOT the HTTP url form). JSON round-trips
// losslessly except formatting, which we pretty-print at 2 spaces.
function wireDesktop({ print }) {
  const cfg = desktopConfigPath();
  const exists = existsSync(cfg);
  let json = {};
  if (exists) {
    try {
      json = JSON.parse(readFileSync(cfg, 'utf8') || '{}');
    } catch (err) {
      process.stdout.write(
        `  ! desktop: ${path.basename(cfg)} is not valid JSON (${err.message}) — add manually:\n\n    ${MANUAL.desktop}\n\n`
      );
      return false;
    }
  }
  if (json.mcpServers && json.mcpServers.mojulo) {
    process.stdout.write('  ✓ desktop: mojulo already in config — leaving it as-is.\n');
    return true;
  }
  json.mcpServers = json.mcpServers || {};
  json.mcpServers.mojulo = { command: 'npx', args: ['-y', 'mojulo'] };
  const out = JSON.stringify(json, null, 2) + '\n';
  if (print) {
    process.stdout.write(`  (--print) would write ${cfg}:\n\n${out}\n`);
    return true;
  }
  if (exists) {
    const bak = backup(cfg);
    process.stdout.write(`  · backed up desktop config → ${path.basename(bak)}\n`);
  }
  atomicWrite(cfg, out);
  process.stdout.write('  ✓ desktop: mojulo added. Restart Claude Desktop to load it.\n');
  return true;
}

function wireClaudeCode({ print }) {
  // Detect-before-write: skip if `mojulo` already registered.
  const list = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf8' });
  const already = !list.error && (list.stdout || '').includes('mojulo');
  if (already) {
    process.stdout.write('  ✓ claude-code: mojulo already registered — leaving it as-is.\n');
    return true;
  }
  if (print) {
    process.stdout.write(`  (--print) would run: ${MANUAL['claude-code']}\n`);
    return true;
  }
  const res = spawnSync('claude', ['mcp', 'add', 'mojulo', '--command', 'npx -y mojulo'], {
    stdio: 'inherit',
  });
  if (res.error || res.status !== 0) {
    process.stdout.write(
      `  ↪ claude-code: CLI wiring failed — add manually:\n\n    ${MANUAL['claude-code']}\n\n`
    );
    return false;
  }
  process.stdout.write('  ✓ claude-code: mojulo registered.\n');
  return true;
}

// ── provider key (reuses the mcp-config path) ─────────────────────────────────
const ALLOWED_PROVIDERS = new Set(['anthropic', 'openai', 'ollama', 'fly']);
async function maybeSetKey({ yes }) {
  if (yes) return; // --yes skips the key by design (first look needs none)
  const want = await confirm(
    'Set an LLM provider key now? (needed for bots/cooks, not for the first look)',
    false
  );
  if (!want) {
    process.stdout.write('  → skipped. Add one later: mojulo-config set anthropic sk-...\n');
    return;
  }
  const provider = (await ask(`  provider [${[...ALLOWED_PROVIDERS].join('/')}]: `)).toLowerCase();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    process.stdout.write(`  ! unknown provider "${provider}" — skipping. Use mojulo-config later.\n`);
    return;
  }
  const value = await ask('  value: ');
  if (!value) {
    process.stdout.write('  ! empty value — skipping.\n');
    return;
  }
  const { ApiKeyRepository } = await import('@/lib/db/repositories/apiKeys');
  const { encryptApiKey } = await import('@/lib/deployment-auth');
  const existing = await ApiKeyRepository.findByUserId('local');
  for (const row of existing.filter((k) => k.provider === provider)) {
    await ApiKeyRepository.delete(row.id);
  }
  const isDefault = !existing.filter((k) => k.provider !== provider).some((k) => k.isDefault);
  await ApiKeyRepository.create({
    name: `${provider}-init`,
    provider,
    encryptedKey: encryptApiKey(value),
    isDefault,
  });
  process.stdout.write(`  ✓ ${provider} key stored (encrypted)${isDefault ? ' (default)' : ''}.\n`);
}

// ── dashboard launch ──────────────────────────────────────────────────────────
function launchDashboard() {
  const uiScript = path.join(SCRIPTS_DIR, 'mcp-ui.mjs');
  const child = spawn(process.execPath, [uiScript], { detached: true, stdio: 'ignore' });
  child.unref();
}

// ── main ──────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(3)); // argv: node mcp-stdio.mjs init [...]

process.stdout.write('\nmojulo init — wiring mojulo into your agent.\n\n');

let detected = detectHosts();
if (args.host) detected = detected.includes(args.host) ? [args.host] : [];

if (detected.length === 0) {
  process.stdout.write('No MCP host detected. Wire mojulo manually:\n\n');
  for (const [host, cmd] of Object.entries(MANUAL)) {
    process.stdout.write(`  ${host}:\n    ${cmd.replace(/\n/g, '\n    ')}\n\n`);
  }
} else {
  process.stdout.write(`Detected: ${detected.join(', ')}\n\n`);
  for (const host of detected) {
    const go = args.yes || args.print || (await confirm(`Wire mojulo into ${host}?`, true));
    if (!go) {
      process.stdout.write(`  → skipped ${host}.\n`);
      continue;
    }
    try {
      wireHost(host, { print: args.print });
    } catch (err) {
      process.stdout.write(
        `  ! ${host} wiring errored (${err.message || err}) — add manually:\n\n    ${MANUAL[host].replace(/\n/g, '\n    ')}\n\n`
      );
    }
  }
}

if (!args.print) await maybeSetKey({ yes: args.yes });

const openUi = args.ui && !args.print && (args.yes || (await confirm('\nOpen the dashboard now?', true)));
if (rl) rl.close();
if (openUi) launchDashboard();

// ── final message — the keyless first-look, not "done" ────────────────────────
process.stdout.write(
  [
    '',
    '✓ mojulo wired.  State: ~/.mojulo/',
    '',
    'Try this in your agent right now — no provider key needed:',
    '',
    '    what is this?              →  mojulo orients itself',
    '    generate a 3D city         →  opens a rendered scene',
    '    make a walkable world      →  a world you can drive',
    '',
    openUi ? '    Dashboard: opening at http://localhost:3001' : '    Dashboard: npx -y -p mojulo mojulo-ui',
    '    Add a key later:           mojulo-config set anthropic sk-...',
    '',
  ].join('\n')
);

process.exit(0);
