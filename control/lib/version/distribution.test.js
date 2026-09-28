import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Every command mojulo tells an agent or an operator to run, rendered as the Claude plugin runs the
// server (plugins/mojulo/.claude-plugin/plugin.json sets MOJULO_DISTRIBUTION=claude-plugin). A plugin
// user has no `mojulo` bin and no control/ directory, and a bare `npx mojulo` would start whatever
// version is newest on the registry against the same ~/.mojulo, so each hint must name
// mojulo@<the running version> and never a repo-clone step. Some hints are built when their module
// loads (the initialize preamble, the drawers), so the env is set before anything is imported.
const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8')).version;
const PINNED = `mojulo@${VERSION}`;
const PLUGIN = { MOJULO_DISTRIBUTION: 'claude-plugin' };

// A command naming the package without the running version: `npx mojulo`, `npx -y mojulo `,
// `mojulo install`, `npm install mojulo` (the `-ui` package and `mojulo@<version>` are fine).
const UNPINNED = /(?:npx(?: -y)?|npm (?:i|install)(?: -g)?) mojulo(?![@\w-])|(?<![\w@/.-])mojulo install\b/;
const REPO_STEP = /in control\/|control\/\.env|scripts\/mcp-stdio\.mjs|package directory/;

function expectPluginHint(label, text) {
  expect(text, label).toEqual(expect.any(String));
  expect(text, `${label} names the running version`).toContain(PINNED);
  expect(text, `${label} names no unpinned command`).not.toMatch(UNPINNED);
  expect(text, `${label} gives no repo-clone step`).not.toMatch(REPO_STEP);
}

describe('install and update hints under the Claude plugin', () => {
  const saved = process.env.MOJULO_DISTRIBUTION;
  let m;
  beforeAll(async () => {
    process.env.MOJULO_DISTRIBUTION = 'claude-plugin';
    m = {
      distribution: await import('./distribution.js'),
      packs: await import('@/lib/mcp/packs'),
      embedder: await import('@/lib/embedder/local'),
      sharp: await import('@/lib/sharp-lazy'),
      lazy: await import('@/lib/lazy-deps'),
      exact: await import('@/lib/graph/polygonizer/field-exact'),
      scad: await import('@/lib/graph/scad/scad-render'),
      union: await import('@/lib/graph/scene/manifold-union'),
      search: await import('@/lib/mcp/tools/semantic-search'),
      hosts: await import('@/lib/mcp/hosts/registry'),
      server: await import('@/lib/mcp/server'),
      context: await import('@/lib/mcp/tools/context'),
    };
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.MOJULO_DISTRIBUTION;
    else process.env.MOJULO_DISTRIBUTION = saved;
  });

  it('reads the plugin marker', () => {
    expect(m.distribution.distribution()).toBe('claude-plugin');
    expect(m.distribution.distribution({})).not.toBe('claude-plugin');
  });

  it('names mojulo@<running version> in every install, dependency and update hint', async () => {
    const { distribution: d, packs, embedder, sharp, lazy, exact, scad, union, search } = m;
    const pluginEnv = { ...PLUGIN, MOJULO_PACKS: 'creative' }; // chatbot and recall absent
    const hints = {
      'mojulo install command': d.mojuloCommand('install recall'),
      'run-mojulo prose': d.runMojulo('install chatbot'),
      'box install command': d.npxMojulo('init --yes --no-ui'),
      'pack install notice': packs.installNotice('start_new_bot', pluginEnv),
      'pack dispatcher notice': packs.packInstallNotice(packs.PACKS.find((p) => p.installGroup === 'chatbot'), pluginEnv),
      'install command for a group': packs.installCommandFor('chatbot'),
      'recall install line': embedder.recallInstallLine(),
      'recall unavailable error': new embedder.RecallUnavailableError().message,
      'sharp unavailable error': new sharp.SharpUnavailableError(new Error('x')).message,
      'required dependency error': new lazy.DependencyUnavailableError('archiver', 'zip bundles', new Error('x')).message,
      'exact kernel missing': exact.exactInstallLine(),
      'openscad missing': scad.openscadInstallLine(),
      'manifold union skipped': union.manifoldMissingReason(),
      'optional helper hint': d.optionalHelperHint('opentype.js'),
      'reinstall hint': d.reinstallHint(),
      'degraded search hint': search.buildSearchHint({ degraded: true, results: [] }),
      'update advice': d.updateAdvice('9.9.9'),
    };
    for (const [label, text] of Object.entries(hints)) expectPluginHint(label, text);
    // Updates go through the plugin, not a newer npx.
    expect(hints['update advice']).toMatch(/Update the plugin/);
    expect(hints['update advice']).not.toMatch(/npm i -g/);
  });

  it('points bot-image updates at the environment, not a repo file', () => {
    const text = m.distribution.botImageAdvice('ghcr.io/zombico/mojulo-bot:9.9.9');
    expect(text).toContain('BOT_IMAGE=ghcr.io/zombico/mojulo-bot:9.9.9');
    expect(text).not.toMatch(REPO_STEP);
  });

  it('launches the dashboard at the same version', async () => {
    expect(m.distribution.dashboardCommand()).toBe(`npx -y mojulo-ui@${VERSION}`);
    const uiMap = (await m.context.uiMapHandler({})).content[0].text;
    expect(uiMap).toContain(`npx -y mojulo-ui@${VERSION}`);
  });

  it('pins the agent-facing drawers and the initialize preamble', async () => {
    const substrate = (await m.context.substrateHandler({})).content[0].text;
    const index = (await m.context.toolIndexHandler({ full: true })).content[0].text;
    for (const [label, text] of Object.entries({ substrate, 'tool index': index, 'initialize preamble': m.server.SERVER_INSTRUCTIONS })) {
      expect(text, `${label} names no unpinned command`).not.toMatch(UNPINNED);
    }
    expect(substrate).toContain(`npx -y ${PINNED} install recall`);
    // The plugin starts the server itself; `init` there would only register a second copy.
    expect(substrate).not.toContain('init --yes --no-ui');
    expect(substrate).toContain('where the mojulo plugin starts it');
    expect(m.server.SERVER_INSTRUCTIONS).toContain(`npx -y ${PINNED} install chatbot`);
  });

  it('wires other hosts to the plugin version and adds no second Claude Code server', () => {
    for (const profile of m.hosts.listHostProfiles()) {
      const pinned = m.hosts.pinProfileToVersion(profile, VERSION);
      if (profile.id === 'claude-code') {
        expect(pinned.manual).toMatch(/already starts/);
        expect(pinned.manual).toContain('claude mcp remove mojulo');
        // The server name stays `mojulo`; only the package spec is pinned.
        expect(pinned.wire.cli.addArgs).toEqual(['mcp', 'add', '--scope', 'user', 'mojulo', '--', 'npx', '-y', PINNED]);
      } else {
        expectPluginHint(`${profile.id} manual line`, pinned.manual);
      }
      if (pinned.wire.stanza) expect(pinned.wire.stanza.args).toContain(PINNED);
    }
  });
});

describe('the same hints from a plain npm install', () => {
  it('name the running version and no repo-clone step', async () => {
    const d = await import('./distribution.js');
    const env = { MOJULO_DISTRIBUTION: 'npm' };
    for (const text of [d.runMojulo('install recall', { env }), d.optionalHelperHint('sharp', { env }), d.reinstallHint({ env })]) {
      expect(text).toContain(PINNED);
      expect(text).not.toMatch(UNPINNED);
      expect(text).not.toMatch(REPO_STEP);
    }
    expect(d.botImageAdvice('ghcr.io/zombico/mojulo-bot:9.9.9', { env })).not.toMatch(REPO_STEP);
  });
});

describe('the same hints from a repo checkout', () => {
  it('keep the checkout form, which is where control/ exists', async () => {
    const d = await import('./distribution.js');
    const env = {}; // this test tree is a checkout, so an absent marker reads as 'source'
    expect(d.distribution(env)).toBe('source');
    expect(d.runMojulo('install recall', { env })).toBe('run `node scripts/mcp-stdio.mjs install recall` in control/');
    expect(d.optionalHelperHint('sharp', { env })).toMatch(/--include=optional` in control\//);
    expect(d.updateAdvice('9.9.9', { env })).toMatch(/git pull/);
  });
});
