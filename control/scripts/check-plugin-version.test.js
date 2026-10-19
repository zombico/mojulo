import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MARKETPLACE_MANIFEST,
  PLUGIN_MANIFEST,
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
    const pluginServer = { mojulo: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/launch.mjs'], env: { MOJULO_DISTRIBUTION: 'claude-plugin' } } };
    const REG = 'https://registry.npmjs.org';
    // the launcher package the plugin installs: package.json on `plugin`, a lockfile on `locked`
    const lockFor = (version, extra = {}) => ({
      name: 'mojulo-claude-plugin-server', lockfileVersion: 3,
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
      write('plugins/mojulo/server/launch.mjs', '// the launcher');
      write('plugins/mojulo/server/package.json', { name: 'mojulo-claude-plugin-server', private: true, dependencies: { mojulo: plugin } });
      write('plugins/mojulo/server/package-lock.json', locked);
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
      expect(problems).toMatch(/server\/package\.json depends on mojulo 3\.0\.9, expected 3\.1\.0/);
      expect(problems).toMatch(/server\/package-lock\.json: it locks mojulo 3\.0\.9, expected 3\.1\.0/);
      expect(problems).toMatch(/glama\.json: mcpServers\.mojulo runs mojulo@3\.0\.0/);
      expect(problems).toMatch(/server\.json: version is 3\.0\.0/);
      expect(problems).toMatch(/packages\[mojulo\]\.version is 3\.0\.0/);
    });

    // The plugin directory holds a plugin that runs an npm package without a lockfile: the plugin starts the
    // launcher, and the launcher installs only what its lockfile names, hashed, from npm.
    it('runs the plugin through the launcher and its lockfile, never npx', () => {
      tree({ servers: launcher('mojulo@3.1.0') });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/plugin\.json: mcpServers\.mojulo should run node \$\{CLAUDE_PLUGIN_ROOT\}\/server\/launch\.mjs, found npx/);
      tree({ servers: { mojulo: { ...pluginServer.mojulo, env: {} } } });
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/should set MOJULO_DISTRIBUTION=claude-plugin/);
      tree({ locked: lockFor('3.1.0', { 'node_modules/left-pad': { version: '1.3.0', resolved: 'https://example.com/left-pad.tgz' } }) });
      const problems = checkManifestVersions({ root }).join('\n');
      expect(problems).toMatch(/node_modules\/left-pad has no integrity hash/);
      expect(problems).toMatch(/node_modules\/left-pad does not resolve from https:\/\/registry\.npmjs\.org\//);
      rmSync(path.join(root, 'plugins/mojulo/server/package-lock.json'));
      expect(checkManifestVersions({ root }).join('\n')).toMatch(/server\/package-lock\.json is missing/);
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
      expect(checkPluginVersionBump({ root, since: 'HEAD' }).join('\n')).toMatch(/still version 3\.1\.0; raise it/);
      write(PLUGIN_MANIFEST, { name: 'mojulo', version: '3.1.1', mcpServers: pluginServer });
      expect(checkPluginVersionBump({ root, since: 'HEAD' })).toEqual([]);
    });
  });
});
