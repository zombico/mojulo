import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MARKETPLACE_MANIFEST,
  PLUGIN_MANIFEST,
  SERVER_ARG,
  checkManifestVersions,
  checkPlaceholders,
  checkPluginVersionBump,
} from './check-plugin-version.mjs';

// The published manifests outside control/ pin the npm version by hand; this is what keeps them
// from drifting (the plugin sat at 2.0.1 while npm shipped 2.1.0).
describe('check-plugin-version', () => {
  it('passes on this repository', () => {
    expect(checkManifestVersions()).toEqual([]);
    expect(checkPlaceholders()).toEqual([]);
  });

  describe('against a fixture tree', () => {
    let root;
    const write = (rel, value) => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    };
    const launcher = (spec) => ({ mojulo: { command: 'npx', args: ['-y', spec] } });
    const pluginServer = { mojulo: { command: 'node', args: [SERVER_ARG], env: { MOJULO_DISTRIBUTION: 'claude-plugin' } } };
    const REG = 'https://registry.npmjs.org';
    // the package Claude Code installs from the plugin's root: package.json on `plugin`, a lockfile on `locked`
    const lockFor = (version, extra = {}) => ({
      name: 'mojulo-claude-plugin', lockfileVersion: 3,
      packages: {
        '': { dependencies: { mojulo: version } },
        'node_modules/mojulo': { version, resolved: `${REG}/mojulo/-/mojulo-${version}.tgz`, integrity: 'sha512-x' },
        'node_modules/fflate': { version: '0.8.2', resolved: `${REG}/fflate/-/fflate-0.8.2.tgz`, integrity: 'sha512-y' },
        ...extra,
      },
    });
    const tree = ({ version = '3.1.0', plugin = '3.1.0', locked = lockFor('3.1.0'), servers = pluginServer, glama = 'mojulo@3.1.0', server = '3.1.0', entry = {}, readme = 'Run it.' } = {}) => {
      write('control/package.json', { name: 'mojulo', version });
      write(PLUGIN_MANIFEST, { name: 'mojulo', version: '3.1.0', mcpServers: servers });
      write('plugins/mojulo/package.json', { name: 'mojulo-claude-plugin', private: true, dependencies: { mojulo: plugin } });
      write('plugins/mojulo/package-lock.json', locked);
      write('glama.json', { name: 'mojulo', mcpServers: launcher(glama) });
      write('server.json', { version: server, packages: [{ registryType: 'npm', identifier: 'mojulo', version: server }] });
      write(MARKETPLACE_MANIFEST, { name: 'mojulo', plugins: [{ name: 'mojulo', source: './plugins/mojulo', ...entry }] });
      write('plugins/mojulo/README.md', readme);
    };

    beforeEach(() => {
      root = mkdtempSync(path.join(os.tmpdir(), 'mojulo-pin-'));
    });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('accepts a tree where everything names the package version', () => {
      tree();
      expect(checkManifestVersions({ root })).toEqual([]);
    });

    it('names each manifest that runs another version or no version', () => {
      tree({ plugin: '3.0.9', locked: lockFor('3.0.9'), glama: 'mojulo@3.0.0', server: '3.0.0' });
      const problems = checkManifestVersions({ root }).join('\n');
      expect(problems).toMatch(/plugins\/mojulo\/package\.json depends on mojulo 3\.0\.9, expected 3\.1\.0/);
      expect(problems).toMatch(/plugins\/mojulo\/package-lock\.json: it locks mojulo 3\.0\.9, expected 3\.1\.0/);
      expect(problems).toMatch(/glama\.json: mcpServers\.mojulo runs mojulo@3\.0\.0/);
      expect(problems).toMatch(/server\.json: version is 3\.0\.0/);
      expect(problems).toMatch(/packages\[mojulo\]\.version is 3\.0\.0/);
    });

    // The plugin runs the package Claude Code installs from the plugin's root lockfile: no npx, no launcher of ours,
    // and nothing in the lockfile that Claude Code's install (frozen, hashed, --ignore-scripts) cannot provide.
    it('runs the package Claude Code installs from the plugin\'s lockfile, never npx or a launcher', () => {
      tree({ servers: launcher('mojulo@3.1.0') });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/mcpServers\.mojulo should run node \$\{CLAUDE_PLUGIN_ROOT\}\/node_modules\/mojulo\/scripts\/mcp-stdio\.mjs, found npx/);
      tree({ servers: { mojulo: { ...pluginServer.mojulo, env: {} } } });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/should set MOJULO_DISTRIBUTION=claude-plugin/);
      tree();
      write('plugins/mojulo/server/launch.mjs', '// the 3.1 launcher');
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/server\/ is the 3\.1 launcher/);
      tree({ locked: lockFor('3.1.0', {
        'node_modules/left-pad': { version: '1.3.0', resolved: 'https://example.com/left-pad.tgz' },
        'node_modules/native': { version: '1.0.0', resolved: 'https://registry.npmjs.org/native/-/native-1.0.0.tgz', integrity: 'sha512-z', hasInstallScript: true },
        'node_modules/native-opt': { version: '1.0.0', resolved: 'https://registry.npmjs.org/native-opt/-/native-opt-1.0.0.tgz', integrity: 'sha512-w', hasInstallScript: true, optional: true },
      }) });
      const problems = checkManifestVersions({ root }).join('\n');
      expect(problems).toMatch(/node_modules\/left-pad has no integrity hash/);
      expect(problems).toMatch(/node_modules\/left-pad does not resolve from https:\/\/registry\.npmjs\.org\//);
      expect(problems).toMatch(/node_modules\/native needs an install script/);
      expect(problems).not.toMatch(/native-opt/);
      tree({ locked: { ...lockFor('3.1.0'), lockfileVersion: 1 } });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/lockfileVersion is 1, expected 2 or 3/);
      tree();
      write('plugins/mojulo/package.json', { name: 'mojulo-claude-plugin', dependencies: { mojulo: '3.1.0', 'left-pad': '1.3.0' }, overrides: { ws: '8.0.0' } });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/depends on more than mojulo[\s\S]*sets overrides/);
      tree();
      rmSync(path.join(root, 'plugins/mojulo/package-lock.json'));
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/plugins\/mojulo\/package-lock\.json is missing/);
    });

    // Past either limit the plugin directory holds a version for a reviewer instead of reading it.
    it('keeps the plugin folder inside what the plugin directory reads', () => {
      tree();
      write('plugins/mojulo/skills/big/SKILL.md', 'x'.repeat(256 * 1024 + 1));
      expect(checkManifestVersions({ root })).toEqual([
        'plugins/mojulo/skills/big/SKILL.md is 257 KiB; the plugin directory holds a file over 256 KiB for a reviewer',
      ]);
      tree();
      rmSync(path.join(root, 'plugins/mojulo/skills'), { recursive: true, force: true });
      for (let i = 0; i < 512; i++) write(`plugins/mojulo/skills/s${i}.md`, 'Run it.');
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/holds 51\d files/);
      // a local install is never counted: it is not committed
      tree();
      rmSync(path.join(root, 'plugins/mojulo/skills'), { recursive: true, force: true });
      for (let i = 0; i < 600; i++) write(`plugins/mojulo/node_modules/p${i}.js`, '');
      expect(checkManifestVersions({ root })).toEqual([]);
    });

    it('refuses a version on the marketplace entry and a stale version in the plugin prose', () => {
      tree({ entry: { version: '3.1.0' }, readme: 'Starts `npx -y mojulo@3.0.9`.' });
      const problems = checkManifestVersions({ root }).join('\n');
      expect(problems).toMatch(/marketplace\.json: the mojulo entry sets version/);
      expect(problems).toMatch(/README\.md: names mojulo@3\.0\.9, expected mojulo@3\.1\.0/);
    });

    // The dashboard is published at core's version; a README that still opens the old one after a
    // bump points the user at a dashboard built from other code over the same database.
    it('checks the dashboard package pin in the plugin prose too', () => {
      tree({ readme: 'Starts `npx -y mojulo@3.1.0`; the dashboard is `npx -y mojulo-ui@3.0.9`.' });
      expect(checkManifestVersions({ root })).toEqual([
        'plugins/mojulo/README.md: names mojulo-ui@3.0.9, expected mojulo-ui@3.1.0',
      ]);
      tree({ readme: 'The dashboard is `npx -y mojulo-ui@3.1.0`.' });
      expect(checkManifestVersions({ root })).toEqual([]);
    });

    // A size or timing left as a placeholder renders as an empty tag on npmjs.com and GitHub.
    it('refuses an unfilled <measured> placeholder in the published prose, not in the changelog', () => {
      tree({ readme: 'About <measured> MB of disk.' });
      write('README.md', 'Fine.\nIt answered in <measured> s.');
      write('docs/tour.md', 'About <measured> MB.');
      write('docs/STATUS.md', '<measured> (the gitignored ledger)');
      write('control/CHANGELOG.md', '## [Unreleased]\n- about <measured> MB');
      expect(checkPlaceholders({ root }).sort()).toEqual([
        'README.md:2: unfilled <measured> placeholder',
        'docs/tour.md:1: unfilled <measured> placeholder',
        'plugins/mojulo/README.md:1: unfilled <measured> placeholder',
      ]);
      tree();
      write('README.md', 'About 230 MB.');
      write('docs/tour.md', 'About 230 MB.');
      expect(checkPlaceholders({ root })).toEqual([]);
    });

    it('lets npm publish run before the lockfile can name the release, and relaxes nothing else', () => {
      // the release commit: everything 3.2.0 but the plugin's package, whose lockfile waits for the published tarball
      const pending = { version: '3.2.0', plugin: '3.1.0', locked: lockFor('3.1.0'), glama: 'mojulo@3.2.0', server: '3.2.0' };
      tree(pending);
      expect(checkManifestVersions({ root })).toEqual([
        'plugins/mojulo/package.json depends on mojulo 3.1.0, expected 3.2.0',
        'plugins/mojulo/package-lock.json: the root depends on mojulo 3.1.0, expected 3.2.0 (node control/scripts/plugin-lock.mjs, after npm publish)',
        'plugins/mojulo/package-lock.json: it locks mojulo 3.1.0, expected 3.2.0 (node control/scripts/plugin-lock.mjs, after npm publish)',
      ]);
      expect(checkManifestVersions({ root, prepublish: true })).toEqual([]);
      // the lockfile is still held to its own rules, and the other manifests to the version
      tree({ ...pending, locked: { ...lockFor('3.1.0'), lockfileVersion: 1 }, server: '3.1.0' });
      expect(checkManifestVersions({ root, prepublish: true })).toEqual([
        'plugins/mojulo/package-lock.json: lockfileVersion is 1, expected 2 or 3 (node control/scripts/plugin-lock.mjs, after npm publish)',
        'server.json: version is 3.1.0, expected 3.2.0',
        'server.json: packages[mojulo].version is 3.1.0, expected 3.2.0',
      ]);
    });

    it('checks the release tag when asked', () => {
      tree();
      expect(checkManifestVersions({ root, expect: '3.2.0' })).toEqual(['control/package.json is 3.1.0, expected 3.2.0']);
    });

    it('requires a plugin.json version bump when the plugin folder changed', () => {
      tree();
      const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
      git('init', '-q', '-b', 'main');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
      git('add', '.');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'base');
      expect(checkPluginVersionBump({ root, since: 'HEAD' })).toEqual([]);
      write('plugins/mojulo/README.md', 'Run it, now with more words.');
      // (no tags at all: released or not cannot be told, so the rule holds)
      expect(checkPluginVersionBump({ root, since: 'HEAD' }).join('\n')).toMatch(/still version 3\.1\.0; raise it/);
      // released (its tag is here): the rule holds
      git('tag', 'v3.1.0');
      expect(checkPluginVersionBump({ root, since: 'HEAD' }).join('\n')).toMatch(/still version 3\.1\.0; raise it/);
      write(PLUGIN_MANIFEST, { name: 'mojulo', version: '3.1.1', mcpServers: pluginServer });
      expect(checkPluginVersionBump({ root, since: 'HEAD' })).toEqual([]);
    });

    it('lets a plugin version not yet released take changes as it stands', () => {
      tree();
      const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
      git('init', '-q', '-b', 'main');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'root');
      git('tag', 'v3.0.0');
      git('add', '.');
      git('-c', 'user.email=t@example.com', '-c', 'user.name=t', 'commit', '-q', '-m', 'base');
      // the base's plugin.json is 3.1.0 and only v3.0.0 is tagged: nobody has 3.1.0 installed
      write('plugins/mojulo/README.md', 'Run it, now with more words.');
      expect(checkPluginVersionBump({ root, since: 'HEAD' })).toEqual([]);
    });
  });
});
