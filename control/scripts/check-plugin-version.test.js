import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BOT_IMAGE_MODULE,
  MARKETPLACE_MANIFEST,
  PLUGIN_MANIFEST,
  checkBotImagePublished,
  checkManifestVersions,
  checkPluginVersionBump,
  defaultBotImage,
} from './check-plugin-version.mjs';

// The published manifests outside control/ pin the npm version by hand; this is what keeps them
// from drifting (the plugin sat at 2.0.1 while npm shipped 2.1.0).
describe('check-plugin-version', () => {
  it('passes on this repository', () => {
    expect(checkManifestVersions()).toEqual([]);
  });

  describe('against a fixture tree', () => {
    let root;
    const write = (rel, value) => {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    };
    const launcher = (spec) => ({ mojulo: { command: 'npx', args: ['-y', spec] } });
    const tree = ({ version = '3.1.0', plugin = 'mojulo@3.1.0', glama = 'mojulo@3.1.0', server = '3.1.0', entry = {}, readme = 'Run it.' } = {}) => {
      write('control/package.json', { name: 'mojulo', version });
      write(PLUGIN_MANIFEST, { name: 'mojulo', version: '3.1.0', mcpServers: launcher(plugin) });
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
      tree({ plugin: 'mojulo', glama: 'mojulo@3.0.0', server: '3.0.0' });
      const problems = checkManifestVersions({ root }).join('\n');
      expect(problems).toMatch(/plugin\.json: mcpServers\.mojulo runs mojulo, expected mojulo@3\.1\.0/);
      expect(problems).toMatch(/glama\.json: mcpServers\.mojulo runs mojulo@3\.0\.0/);
      expect(problems).toMatch(/server\.json: version is 3\.0\.0/);
      expect(problems).toMatch(/packages\[mojulo\]\.version is 3\.0\.0/);
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

    // Every default chatbot deploy pulls DEFAULT_BOT_IMAGE, so a release that pins a tag
    // publish-bot-image.yml has not pushed yet breaks them all. --bot-image asks GHCR.
    describe('--bot-image', () => {
      const pinImage = (image) => write(BOT_IMAGE_MODULE, `export const DEFAULT_BOT_IMAGE = '${image}';\n`);
      function fakeGhcr(manifestStatus) {
        const calls = [];
        const fetchImpl = async (url, init = {}) => {
          calls.push({ url, method: init.method || 'GET' });
          if (url.startsWith('https://ghcr.io/token')) return new Response(JSON.stringify({ token: 't' }), { status: 200 });
          return new Response(null, { status: manifestStatus });
        };
        return { calls, fetchImpl };
      }

      it('reads the pin from the source', () => {
        pinImage('ghcr.io/zombico/mojulo-bot:9.9.9');
        expect(defaultBotImage({ root })).toEqual({ image: 'ghcr.io/zombico/mojulo-bot:9.9.9', repo: 'zombico/mojulo-bot', tag: '9.9.9' });
      });

      it('passes when GHCR serves the pinned tag', async () => {
        pinImage('ghcr.io/zombico/mojulo-bot:9.9.9');
        const { calls, fetchImpl } = fakeGhcr(200);
        expect(await checkBotImagePublished({ root, fetchImpl })).toEqual([]);
        expect(calls.at(-1)).toEqual({ url: 'https://ghcr.io/v2/zombico/mojulo-bot/manifests/9.9.9', method: 'HEAD' });
      });

      it('fails, naming the order to release in, when the tag is not published', async () => {
        pinImage('ghcr.io/zombico/mojulo-bot:9.9.9');
        const problems = await checkBotImagePublished({ root, fetchImpl: fakeGhcr(404).fetchImpl });
        expect(problems.join('\n')).toMatch(/not published on GHCR: push the bot-v9\.9\.9 tag and wait for publish-bot-image\.yml/);
      });

      it('fails closed when GHCR cannot be reached', async () => {
        pinImage('ghcr.io/zombico/mojulo-bot:9.9.9');
        const fetchImpl = async () => { throw new Error('getaddrinfo ENOTFOUND ghcr.io'); };
        expect((await checkBotImagePublished({ root, fetchImpl })).join('\n')).toMatch(/could not reach ghcr\.io/);
      });
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
      write(PLUGIN_MANIFEST, { name: 'mojulo', version: '3.1.1', mcpServers: launcher('mojulo@3.1.0') });
      expect(checkPluginVersionBump({ root, since: 'HEAD' })).toEqual([]);
    });
  });
});
