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
 * STATUS: hosts are DATA. Detection, the config stanza, the manual snippet and
 * the runtime capability flags live in one JSON profile per host under
 * [../lib/mcp/hosts/](../lib/mcp/hosts/registry.js); this file owns three writer
 * FORMATS and nothing host-specific — `cli-shellout` (a CLI that owns scope
 * semantics, e.g. Claude Code's `--scope user`), `toml-append` and `json-patch`
 * (config-file merge with backup + detect-before-write). Adding a harness is a
 * profile plus an adapter card, with no edit here. A host whose format has no
 * writer, or a write that fails, degrades to printing the manual snippet.
 * Re-running init also REPAIRS stale entries from older inits: a project-local
 * CLI registration is re-added at user scope, and a JSON entry with bare `npx`
 * (or a dead npx path) is rewritten to the current absolute-npx form. Entries
 * the operator customized are never touched, and a workshop registration
 * (`mojulo-dev`) blocks a second server rather than doubling every tool.
 */

import readline from 'node:readline';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { existsSync, readFileSync, copyFileSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';
import { spawnSync, spawn } from 'node:child_process';
import { resolveMojuloPaths } from './mojulo-paths.mjs';
import { listHostProfiles, getHostProfile, expandPath } from '../lib/mcp/hosts/registry.js';

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
      `  --host <id>   target one host: ${HOST_IDS.join(' | ')}`,
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

// ── host profiles ─────────────────────────────────────────────────────────────
// Detection, wiring, and the manual snippets are DATA — one JSON profile per
// host in [../lib/mcp/hosts/](../lib/mcp/hosts/registry.js). This file owns the
// three writer FORMATS (cli-shellout / toml-append / json-patch) and nothing
// host-specific; adding a harness is a profile plus an adapter card, no JS edit.
const PROFILES = listHostProfiles();
const HOST_IDS = PROFILES.map((p) => p.id);
const MANUAL = Object.fromEntries(PROFILES.map((p) => [p.id, p.manual]));

// The one server name mojulo ever writes. A differently-named `mojulo*` entry
// is the operator's repo workshop (`mojulo-dev`) — see the dev-workshop guard.
const SERVER_NAME = 'mojulo';

// On Windows the CLIs are .cmd shims that plain spawnSync can't resolve; route
// the probes (and the CLI shell-outs below) through the shell there.
const WIN_SHELL = process.platform === 'win32';

// A host is present when ANY declared signal hits: its config file exists, its
// CLI answers a version probe, or its app install footprint is on disk. The
// footprint fallback exists because a fresh Claude Desktop has no config file
// until the user opens developer settings — under-detecting exactly the
// first-timers init exists for; the json-patch writer creates the file.
function hostPresent(profile) {
  const cfg = expandPath(profile.detect.configPath);
  if (cfg && existsSync(cfg)) return true;
  const probe = profile.detect.probe;
  if (probe && probe.length) {
    const res = spawnSync(probe[0], probe.slice(1), { stdio: 'ignore', shell: WIN_SHELL });
    if (!res.error && res.status === 0) return true;
  }
  const apps = (profile.detect.appPaths || {})[process.platform] || [];
  return apps.some((p) => existsSync(expandPath(p)));
}

function detectHosts() {
  return PROFILES.filter(hostPresent).map((p) => p.id);
}

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

// One MCP server per host. When the operator already wired mojulo under a
// workshop name — `mojulo-dev` pointed at a local checkout — adding the
// published server alongside it would double every tool. Skip, and say why.
// Only fires when there is no exact `mojulo` entry; that case keeps its own
// already-wired/repair paths.
//
// Deliberately NOT a `mojulo*` prefix match: sibling servers ship under that
// prefix (`mojulo-orient` is the orientation gallery, a different server), and
// treating one as a workshop copy would refuse to wire mojulo at all. Only the
// dev/local/workshop suffixes count.
const WORKSHOP_NAME = /^mojulo[-_](dev|local|workshop)$/i;
function devWorkshopSkip(profile, names) {
  if (names.includes(SERVER_NAME)) return false;
  const others = names.filter((n) => WORKSHOP_NAME.test(n));
  if (!others.length) return false;
  process.stdout.write(
    `  ✓ ${profile.id}: dev workshop already wired (${others.join(', ')}) — not adding a second server.\n`
  );
  return true;
}

// ── host wiring ────────────────────────────────────────────────────────────────
const WRITERS = {
  'cli-shellout': wireViaCli,
  'toml-append': wireTomlAppend,
  'json-patch': wireJsonPatch,
  manual: wireManual,
};

function wireHost(host, opts) {
  const profile = getHostProfile(host);
  const writer = profile && WRITERS[profile.wire.format];
  if (writer) return writer(profile, opts);
  process.stdout.write(
    `  ↪ ${host}: no writer — add manually:\n\n    ${MANUAL[host].replace(/\n/g, '\n    ')}\n\n`
  );
  return false;
}

// ── writer: manual ────────────────────────────────────────────────────────────
// For a host we can DETECT but must not write to: its config path or format
// isn't verified yet. Patching a guessed path would print a false "✓ wired" and
// leave the operator debugging a file their host never reads. So we detect,
// name the host, and hand over its own paste snippet — strictly better than the
// undetected fallback (which prints every host's snippet), and a two-line
// profile edit away from a real writer once the format is confirmed.
function wireManual(profile, _opts) {
  process.stdout.write(
    `  ↪ ${profile.id}: wire this one by hand — mojulo does not write ${profile.name || profile.id}'s config yet:\n\n    ${profile.manual.replace(/\n/g, '\n    ')}\n\n`
  );
  return true;
}

// ── writer: toml-append ───────────────────────────────────────────────────────
// Append `[<serversTable>.mojulo]` to the host's TOML. Append-if-absent is
// deliberately round-trip-safe: existing servers, comments, and formatting are
// never rewritten. Name collection covers the table-header form we write plus
// the hand-written variants (dotted key, inline table, section key) so none of
// them gets a duplicate appended.
function tomlServerNames(text, table) {
  const esc = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = new Set();
  for (const m of text.matchAll(new RegExp(`^\\s*\\[${esc}\\.([A-Za-z0-9_-]+)\\]`, 'gm'))) names.add(m[1]);
  for (const m of text.matchAll(new RegExp(`^\\s*${esc}\\.([A-Za-z0-9_-]+)\\s*=`, 'gm'))) names.add(m[1]);
  const inline = text.match(new RegExp(`^\\s*${esc}\\s*=\\s*{([^}]*)}`, 'm'));
  if (inline) for (const m of inline[1].matchAll(/([A-Za-z0-9_-]+)\s*=/g)) names.add(m[1]);
  let inSection = false;
  for (const line of text.split('\n')) {
    const header = line.match(/^\s*\[([^\]]+)\]/);
    if (header) {
      inSection = header[1].trim() === table;
      continue;
    }
    if (inSection) {
      const key = line.match(/^\s*"?([A-Za-z0-9_-]+)"?\s*=/);
      if (key) names.add(key[1]);
    }
  }
  return [...names];
}

function tomlStanza(wire) {
  const lines = [`[${wire.serversTable}.${SERVER_NAME}]`];
  lines.push(`command = ${JSON.stringify(wire.stanza.command)}`);
  lines.push(`args = [${wire.stanza.args.map((a) => JSON.stringify(a)).join(', ')}]`);
  for (const [key, value] of Object.entries(wire.extras || {})) {
    lines.push(`${key} = ${typeof value === 'string' ? JSON.stringify(value) : value}`);
  }
  return lines.join('\n') + '\n';
}

function wireTomlAppend(profile, { print }) {
  const wire = profile.wire;
  const cfg = expandPath(wire.configPath);
  const exists = existsSync(cfg);
  const text = exists ? readFileSync(cfg, 'utf8') : '';
  const names = tomlServerNames(text, wire.serversTable);
  if (names.includes(SERVER_NAME)) {
    process.stdout.write(`  ✓ ${profile.id}: mojulo already in ${wire.backupLabel} — leaving it as-is.\n`);
    return true;
  }
  if (devWorkshopSkip(profile, names)) return true;
  const body = tomlStanza(wire);
  const next = !text ? body : text + (text.endsWith('\n') ? '' : '\n') + '\n' + body;
  if (print) {
    process.stdout.write(`  (--print) would append to ${cfg}:\n\n${body}\n`);
    return true;
  }
  if (exists) {
    const bak = backup(cfg);
    process.stdout.write(`  · backed up ${wire.backupLabel} → ${path.basename(bak)}\n`);
  }
  atomicWrite(cfg, next);
  process.stdout.write(
    `  ✓ ${profile.id}: appended [${wire.serversTable}.${SERVER_NAME}] to ${cfg}.\n`
  );
  return true;
}

// ── writer: json-patch ────────────────────────────────────────────────────────
// Patch `<serversKey>.mojulo` into the host's JSON config using the stdio
// {command,args} form (NOT the HTTP url form). JSON round-trips losslessly
// except formatting, which we pretty-print at 2 spaces.
function wireJsonPatch(profile, { print }) {
  const wire = profile.wire;
  const cfg = expandPath(wire.configPath);
  const exists = existsSync(cfg);
  let json = {};
  if (exists) {
    try {
      json = JSON.parse(readFileSync(cfg, 'utf8') || '{}');
    } catch (err) {
      process.stdout.write(
        `  ! ${profile.id}: ${path.basename(cfg)} is not valid JSON (${err.message}) — add manually:\n\n    ${profile.manual}\n\n`
      );
      return false;
    }
  }
  const servers = json[wire.serversKey] || {};
  // Repair path: an entry from an older init may carry the bare-`npx` form
  // (breaks with `spawn npx ENOENT` in the GUI environment) or an absolute npx
  // that no longer exists (node upgrade moved it). Rewrite only shapes we
  // recognize as ours-and-stale; a customized entry (env, extra keys, different
  // args) is the operator's — leave it alone. The per-host "Wire mojulo into
  // <host>?" consent covers the rewrite; no second prompt.
  const existing = servers[SERVER_NAME];
  if (existing) {
    const plainShape =
      Object.keys(existing).length === 2 &&
      typeof existing.command === 'string' &&
      Array.isArray(existing.args) &&
      existing.args.join(' ') === wire.stanza.args.join(' ');
    const commandWorks =
      plainShape && existing.command !== wire.stanza.command && existsSync(existing.command);
    if (commandWorks) {
      process.stdout.write(`  ✓ ${profile.id}: mojulo already in config — leaving it as-is.\n`);
      return true;
    }
    if (!plainShape) {
      process.stdout.write(
        `  ✓ ${profile.id}: found a customized mojulo entry — leaving it as-is.\n`
      );
      return true;
    }
    // plain shape, but bare `npx` or a dead absolute path → refresh below.
    process.stdout.write(
      `  · ${profile.id}: existing mojulo entry uses ${
        existing.command === wire.stanza.command
          ? 'bare `npx` (fails from the GUI environment)'
          : 'a missing npx path'
      } — updating to the current form.\n`
    );
  } else if (devWorkshopSkip(profile, Object.keys(servers))) {
    return true;
  }
  json[wire.serversKey] = servers;
  servers[SERVER_NAME] = {
    command: wire.absoluteNpx ? npxCommand(wire.stanza.command) : wire.stanza.command,
    args: wire.stanza.args,
  };
  const out = JSON.stringify(json, null, 2) + '\n';
  if (print) {
    process.stdout.write(`  (--print) would write ${cfg}:\n\n${out}\n`);
    return true;
  }
  if (exists) {
    const bak = backup(cfg);
    process.stdout.write(`  · backed up ${wire.backupLabel} → ${path.basename(bak)}\n`);
  }
  atomicWrite(cfg, out);
  process.stdout.write(
    `  ✓ ${profile.id}: mojulo added.${wire.postWriteNote ? ` ${wire.postWriteNote}` : ''}\n`
  );
  return true;
}

// GUI-spawned hosts (Claude Desktop) inherit an environment whose PATH often
// lacks nvm/homebrew node on macOS and can't exec `npx` without the .cmd shim
// on Windows — the classic `spawn npx ENOENT`. Write an absolute npx: first hit
// on the installer's PATH (stable symlinks like /opt/homebrew/bin/npx win over
// process.execPath's realpathed, version-pinned Cellar dir), then the sibling
// of the running node, then the bare command as the last resort.
function npxCommand(bare = 'npx') {
  const exe = process.platform === 'win32' ? `${bare}.cmd` : bare;
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, exe);
    if (existsSync(candidate)) return candidate;
  }
  const sibling = path.join(path.dirname(process.execPath), exe);
  return existsSync(sibling) ? sibling : bare;
}

// ── writer: cli-shellout ──────────────────────────────────────────────────────
// For hosts whose CLI owns registration-scope semantics we cannot replicate by
// patching a file (Claude Code's `--scope user`). Every write stays CLI-owned;
// we only PEEK at the user-scope file to classify where an existing entry lives.
//
// `<cli> mcp list` merges every scope, but an older init wired the default
// `local` scope — pinned to the one directory init happened to run from. The
// fix is a user-scope entry. Returns true / false / null (couldn't tell).
function userScopeHasMojulo(wire) {
  if (!wire.userScope) return null;
  try {
    const raw = readFileSync(expandPath(wire.userScope.file), 'utf8');
    const json = JSON.parse(raw);
    const servers = json[wire.userScope.key];
    return Boolean(servers && servers[SERVER_NAME]);
  } catch {
    return null;
  }
}

function wireViaCli(profile, { print }) {
  const { cli } = profile.wire;
  // Detect-before-write: skip if `mojulo` is already registered at user scope.
  // Registered-but-not-user-scope is the old init's local-scope wiring — fall
  // through and add the user-scope entry so mojulo works in every project.
  const list = spawnSync(cli.bin, cli.listArgs, { encoding: 'utf8', shell: WIN_SHELL });
  const names = list.error
    ? []
    : [...(list.stdout || '').matchAll(/\bmojulo[A-Za-z0-9_-]*\b/g)].map((m) => m[0]);
  if (!names.includes(SERVER_NAME) && devWorkshopSkip(profile, names)) return true;
  if (names.includes(SERVER_NAME)) {
    const userScoped = userScopeHasMojulo(profile.wire);
    if (userScoped !== false) {
      process.stdout.write(`  ✓ ${profile.id}: mojulo already registered — leaving it as-is.\n`);
      return true;
    }
    process.stdout.write(
      `  · ${profile.id}: mojulo is registered project-locally (older init default) — adding the user-scope entry so it is available in every project.\n`
    );
    if (!print && cli.removeLocalArgs) {
      // Best-effort: clear a local-scope entry for THIS directory so the add
      // can't collide. Local entries in other project directories are only
      // removable from those directories; they shadow the user entry there but
      // run the identical command, so they are harmless duplicates.
      spawnSync(cli.bin, cli.removeLocalArgs, { stdio: 'ignore', shell: WIN_SHELL });
    }
  }
  if (print) {
    process.stdout.write(`  (--print) would run: ${MANUAL[profile.id]}\n`);
    return true;
  }
  const res = spawnSync(cli.bin, cli.addArgs, { stdio: 'inherit', shell: WIN_SHELL });
  if (res.error || res.status !== 0) {
    process.stdout.write(
      `  ↪ ${profile.id}: CLI wiring failed — add manually:\n\n    ${MANUAL[profile.id]}\n\n`
    );
    return false;
  }
  process.stdout.write(`  ✓ ${profile.id}: mojulo registered.\n`);
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
function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ port, host: '127.0.0.1' }, () => server.close(() => resolve(true)));
  });
}

// Pick the port HERE so the final banner can print the real URL — the docs say
// 3001, so prefer it and fall back to an OS-assigned free port. Stderr stays
// attached to the terminal so a failed boot (missing standalone bundle, port
// race) is visible instead of vanishing with the detached child.
async function launchDashboard() {
  const uiScript = path.join(SCRIPTS_DIR, 'mcp-ui.mjs');
  let port = 3001;
  if (!(await portIsFree(port))) {
    port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      server.on('error', reject);
      server.listen({ port: 0, host: '127.0.0.1' }, () => {
        const { port: p } = server.address();
        server.close(() => resolve(p));
      });
    });
  }
  const child = spawn(process.execPath, [uiScript, '--port', String(port)], {
    detached: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  child.unref();
  return port;
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
const uiPort = openUi ? await launchDashboard() : null;

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
    openUi
      ? `    Dashboard: opening at http://localhost:${uiPort}`
      : '    Dashboard: npx -y -p mojulo mojulo-ui',
    '    Dashboard language:        ~two dozen to pick from — Settings → Language',
    '    Add a key later:           mojulo-config set anthropic sk-...',
    '',
  ].join('\n')
);

process.exit(0);
