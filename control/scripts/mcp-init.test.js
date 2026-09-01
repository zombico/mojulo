/**
 * Integration tests for the `npx mojulo init` config writers — the file-editing
 * hosts (Codex, Claude Desktop) driven through the real bin against a temp HOME.
 * This folds the manual temp-HOME smoke tests from the mcp-init plan into the
 * suite: fixture config in, one `node mcp-stdio.mjs init --host <h>` run, assert
 * on the bytes written (merge, backup, idempotency, repair, dry-run).
 *
 * The Claude Code writer shells out to the `claude` CLI and is deliberately not
 * driven here — its detect/repair classification (user-scope peek at
 * ~/.claude.json) is machine-dependent; it stays on the manual checklist.
 *
 * A fake `npx` is planted at $HOME/bin and prepended to PATH so npxCommand()'s
 * "first hit on PATH" resolution is deterministic in assertions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const STDIO = join(SCRIPTS_DIR, 'mcp-stdio.mjs');

let home;
let fakeNpx;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'mojulo-init-test-'));
  mkdirSync(join(home, 'bin'), { recursive: true });
  fakeNpx = join(home, 'bin', 'npx');
  writeFileSync(fakeNpx, '#!/bin/sh\nexit 0\n');
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

function runInit(...extraArgs) {
  const res = spawnSync(process.execPath, [STDIO, 'init', '--yes', '--no-ui', ...extraArgs], {
    encoding: 'utf8',
    timeout: 25000,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      MOJULO_HOME: join(home, '.mojulo'),
      PATH: join(home, 'bin') + delimiter + (process.env.PATH || ''),
    },
  });
  expect(res.error).toBeUndefined();
  expect(res.status).toBe(0);
  return res;
}

// ── codex ─────────────────────────────────────────────────────────────────────

const codexCfg = () => join(home, '.codex', 'config.toml');

function seedCodex(text) {
  mkdirSync(dirname(codexCfg()), { recursive: true });
  writeFileSync(codexCfg(), text);
}

const codexBackups = () =>
  readdirSync(dirname(codexCfg())).filter((f) => f.startsWith('config.toml.mojulo-bak-'));

describe('init — codex writer', () => {
  it('appends mojulo, preserves existing servers, backs up once, re-run is idempotent', () => {
    seedCodex('# my config\n[mcp_servers.foo]\ncommand = "foo"\n');
    runInit('--host', 'codex');

    let text = readFileSync(codexCfg(), 'utf8');
    expect(text).toContain('[mcp_servers.foo]');
    expect(text).toContain('[mcp_servers.mojulo]');
    expect(text).toContain('args = ["-y", "mojulo"]');
    expect(codexBackups()).toHaveLength(1);

    const res = runInit('--host', 'codex');
    expect(res.stdout).toContain('already in config.toml');
    text = readFileSync(codexCfg(), 'utf8');
    expect(text.match(/\[mcp_servers\.mojulo\]/g)).toHaveLength(1);
    expect(codexBackups()).toHaveLength(1); // skip path takes no second backup
  });

  it.each([
    ['inline table', 'mcp_servers = { mojulo = { command = "npx", args = ["-y", "mojulo"] } }\n'],
    ['dotted key', 'mcp_servers.mojulo = { command = "npx", args = ["-y", "mojulo"] }\n'],
    ['section key', '[mcp_servers]\nmojulo = { command = "npx", args = ["-y", "mojulo"] }\n'],
  ])('detects hand-written %s form — no duplicate appended', (_label, toml) => {
    seedCodex(toml);
    const res = runInit('--host', 'codex');
    expect(res.stdout).toContain('already in config.toml');
    expect(readFileSync(codexCfg(), 'utf8')).toBe(toml);
    expect(codexBackups()).toHaveLength(0);
  });
});

// ── claude desktop ────────────────────────────────────────────────────────────

const desktopCfg = () =>
  process.platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : join(home, '.config', 'Claude', 'claude_desktop_config.json');

function seedDesktop(json) {
  mkdirSync(dirname(desktopCfg()), { recursive: true });
  writeFileSync(
    desktopCfg(),
    typeof json === 'string' ? json : JSON.stringify(json, null, 2) + '\n'
  );
}

const readDesktop = () => JSON.parse(readFileSync(desktopCfg(), 'utf8'));
const desktopBackups = () =>
  readdirSync(dirname(desktopCfg())).filter((f) => f.includes('.mojulo-bak-'));

describe('init — desktop writer', () => {
  it('merges mojulo beside existing servers with an absolute npx', () => {
    seedDesktop({ mcpServers: { other: { command: 'other-cmd' } } });
    runInit('--host', 'desktop');

    const json = readDesktop();
    expect(json.mcpServers.other).toEqual({ command: 'other-cmd' });
    expect(json.mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
    expect(desktopBackups()).toHaveLength(1);
  });

  it('repairs the old bare-npx form to an absolute npx', () => {
    seedDesktop({ mcpServers: { mojulo: { command: 'npx', args: ['-y', 'mojulo'] } } });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('updating to the current form');
    expect(readDesktop().mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
    expect(desktopBackups()).toHaveLength(1);
  });

  it('repairs an absolute npx path that no longer exists', () => {
    seedDesktop({
      mcpServers: { mojulo: { command: join(home, 'gone', 'npx'), args: ['-y', 'mojulo'] } },
    });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('updating to the current form');
    expect(readDesktop().mcpServers.mojulo).toEqual({ command: fakeNpx, args: ['-y', 'mojulo'] });
  });

  it('leaves a working absolute-npx entry as-is', () => {
    seedDesktop({ mcpServers: { mojulo: { command: fakeNpx, args: ['-y', 'mojulo'] } } });
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('leaving it as-is');
    expect(desktopBackups()).toHaveLength(0);
  });

  it('never touches a customized entry', () => {
    const custom = {
      mcpServers: { mojulo: { command: 'npx', args: ['-y', 'mojulo'], env: { FOO: 'bar' } } },
    };
    seedDesktop(custom);
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('customized mojulo entry');
    expect(readDesktop()).toEqual(custom);
    expect(desktopBackups()).toHaveLength(0);
  });

  it('falls back to the manual snippet on invalid JSON without writing', () => {
    seedDesktop('{ not json');
    const res = runInit('--host', 'desktop');

    expect(res.stdout).toContain('not valid JSON');
    expect(readFileSync(desktopCfg(), 'utf8')).toBe('{ not json');
    expect(desktopBackups()).toHaveLength(0);
  });

  it('--print is a true dry run', () => {
    seedDesktop({ mcpServers: {} });
    const res = runInit('--host', 'desktop', '--print');

    expect(res.stdout).toContain('(--print) would write');
    expect(readDesktop()).toEqual({ mcpServers: {} });
    expect(desktopBackups()).toHaveLength(0);
  });
});

// ── dev-workshop guard (any file-editing host) ────────────────────────────────

describe('init — dev-workshop guard', () => {
  it('skips when a mojulo-dev workshop server is already wired', () => {
    const toml = '[mcp_servers.mojulo-dev]\ncommand = "node"\nargs = ["/repo/control/scripts/mcp-stdio.mjs"]\n';
    seedCodex(toml);
    const res = runInit('--host', 'codex');
    expect(res.stdout).toContain('dev workshop already wired (mojulo-dev)');
    expect(readFileSync(codexCfg(), 'utf8')).toBe(toml); // untouched
    expect(codexBackups()).toHaveLength(0);
  });

  it('still wires beside a sibling mojulo-* server that is not a workshop copy', () => {
    // `mojulo-orient` is the orientation gallery — a different server, not a
    // second registration of this one. A `mojulo*` prefix match would refuse
    // to wire mojulo at all on such a machine.
    seedCodex('[mcp_servers.mojulo-orient]\ncommand = "npx"\n');
    const res = runInit('--host', 'codex');
    expect(res.stdout).not.toContain('dev workshop');
    const text = readFileSync(codexCfg(), 'utf8');
    expect(text).toContain('[mcp_servers.mojulo-orient]');
    expect(text).toContain('[mcp_servers.mojulo]');
  });
});

// ── cli-shellout writer ───────────────────────────────────────────────────────
// The Claude Code writer shells out, so it was previously untested. A fake
// `claude` on PATH makes its three decisions deterministic: already-registered,
// local-scope repair, and the substring hole (`mojulo-orient` is not `mojulo`).

function plantFakeClaude(listOutput) {
  const bin = join(home, 'bin', 'claude');
  writeFileSync(
    bin,
    [
      '#!/bin/sh',
      'if [ "$1" = "--version" ]; then echo "9.9.9 (fake)"; exit 0; fi',
      'if [ "$1" = "mcp" ] && [ "$2" = "list" ]; then cat "$HOME/mcp-list.txt"; exit 0; fi',
      'exit 0',
    ].join('\n') + '\n'
  );
  spawnSync('chmod', ['+x', bin]);
  writeFileSync(join(home, 'mcp-list.txt'), listOutput);
}

describe('init — cli-shellout writer', () => {
  it('leaves an existing user-scope registration alone', () => {
    plantFakeClaude('mojulo: npx -y mojulo - ✓ Connected\n');
    writeFileSync(join(home, '.claude.json'), JSON.stringify({ mcpServers: { mojulo: {} } }));
    const res = runInit('--host', 'claude-code');
    expect(res.stdout).toContain('already registered — leaving it as-is');
  });

  it('adds the user-scope entry when the existing registration is project-local', () => {
    plantFakeClaude('mojulo: npx -y mojulo - ✓ Connected\n');
    writeFileSync(join(home, '.claude.json'), JSON.stringify({ mcpServers: { other: {} } }));
    const res = runInit('--host', 'claude-code', '--print');
    expect(res.stdout).toContain('registered project-locally');
    expect(res.stdout).toContain('would run: claude mcp add --scope user mojulo');
  });

  it('does not read a sibling mojulo-* server as an existing registration', () => {
    plantFakeClaude('mojulo-orient: npx -y mojulo-orient - ✓ Connected\n');
    const res = runInit('--host', 'claude-code');
    expect(res.stdout).not.toContain('already registered');
    expect(res.stdout).not.toContain('registered project-locally');
    expect(res.stdout).toContain('claude-code: mojulo registered.');
  });

  it('skips when only a workshop registration is present', () => {
    plantFakeClaude('mojulo-dev: node /repo/scripts/mcp-stdio.mjs - ✓ Connected\n');
    const res = runInit('--host', 'claude-code');
    expect(res.stdout).toContain('dev workshop already wired (mojulo-dev)');
  });
});

// ── grok build (toml-append, second host on the same writer) ─────────────────

const grokCfg = () => join(home, '.grok', 'config.toml');

describe('init — grok writer', () => {
  it('wires grok on the codex writer with its own stanza extras', () => {
    mkdirSync(dirname(grokCfg()), { recursive: true });
    writeFileSync(grokCfg(), '[mcp_servers.other]\ncommand = "x"\n');

    const res = runInit('--host', 'grok');
    expect(res.stdout).toContain('Detected: grok');

    const text = readFileSync(grokCfg(), 'utf8');
    expect(text).toContain('[mcp_servers.other]'); // round-trip safe
    expect(text).toContain('[mcp_servers.mojulo]');
    // First `npx -y mojulo` fetches the package; a default startup timeout
    // marks the server dead mid-download.
    expect(text).toContain('startup_timeout_sec = 120');
  });

  it('re-run is a no-op', () => {
    mkdirSync(dirname(grokCfg()), { recursive: true });
    writeFileSync(grokCfg(), '');
    runInit('--host', 'grok');
    const once = readFileSync(grokCfg(), 'utf8');
    const res = runInit('--host', 'grok');
    expect(res.stdout).toContain('already in config.toml');
    expect(readFileSync(grokCfg(), 'utf8')).toBe(once);
  });
});

// ── manual format: detected, guided, never written ───────────────────────────

// Walk the fake HOME for any file that registers mojulo as an MCP server.
// `.mojulo/` is mojulo's own state dir (always created); a version PROBE can
// create a host's config dir as a side effect, so the invariant under test is
// "no registration was written", not "no bytes appeared".
function registeredAnywhere(dir, depth = 0) {
  if (depth > 4) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (depth === 0 && (entry.name === '.mojulo' || entry.name === 'bin')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (registeredAnywhere(full, depth + 1)) return true;
      continue;
    }
    let text = '';
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue; // binary or unreadable — not a config we wrote
    }
    if (/mcp_servers\.mojulo|"mojulo"\s*:/.test(text)) return true;
  }
  return false;
}

describe('init — manual writer', () => {
  it('prints the host snippet and registers nothing for an unverified config format', () => {
    const res = runInit('--host', 'hermes');
    if (!res.stdout.includes('Detected: hermes')) return; // no hermes CLI on this machine
    expect(res.stdout).toContain('wire this one by hand');
    expect(res.stdout).toContain('npx');
    expect(registeredAnywhere(home)).toBe(false);
  });
});

// ── the seam itself: a host is data ───────────────────────────────────────────

describe('init — host profiles are data, not code', () => {
  const hostsDir = join(SCRIPTS_DIR, '..', 'lib', 'mcp', 'hosts');
  const fixture = join(hostsDir, 'zz-test-fixture.json');
  const fixtureCfg = () => join(home, '.fixturehost', 'config.toml');

  function plantProfile() {
    writeFileSync(
      fixture,
      JSON.stringify(
        {
          id: 'fixture-host',
          adapterId: null,
          order: 90,
          name: 'Fixture Host',
          detect: { configPath: '~/.fixturehost/config.toml' },
          wire: {
            format: 'toml-append',
            configPath: '~/.fixturehost/config.toml',
            serversTable: 'mcp_servers',
            backupLabel: 'config.toml',
            stanza: { command: 'npx', args: ['-y', 'mojulo'] },
            extras: { startup_timeout_sec: 120 },
          },
          manual: '[mcp_servers.mojulo]  # add to ~/.fixturehost/config.toml',
          capabilities: { maxOutputBytes: 20000 },
        },
        null,
        2
      ) + '\n'
    );
  }

  afterEach(() => rmSync(fixture, { force: true }));

  it('detects, lists, and wires a brand-new host with zero JS edits', () => {
    plantProfile();
    mkdirSync(dirname(fixtureCfg()), { recursive: true });
    writeFileSync(fixtureCfg(), '# fixture host config\n');

    expect(runInit('--help').stdout).toContain('fixture-host');

    const res = runInit('--host', 'fixture-host');
    expect(res.stdout).toContain('Detected: fixture-host');
    const text = readFileSync(fixtureCfg(), 'utf8');
    expect(text).toContain('# fixture host config'); // round-trip safe
    expect(text).toContain('[mcp_servers.mojulo]');
    expect(text).toContain('startup_timeout_sec = 120'); // profile extras land
  });

  it('offers the profile-declared manual snippet when nothing is detected', () => {
    plantProfile(); // planted, but its config file is absent → undetected
    const res = runInit('--host', 'fixture-host');
    expect(res.stdout).toContain('No MCP host detected');
    expect(res.stdout).toContain('~/.fixturehost/config.toml');
  });
});
