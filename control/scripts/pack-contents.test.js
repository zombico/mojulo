// The tarball carries nothing the repo ignores. `files` in package.json overrides .gitignore, so a
// gitignored tree on the packing machine's disk rides along: a checkout holding the operator-local
// mobile-suit content pack packed all of it, plans included. Packing is a dry run with scripts off;
// a gitignored file is allowed only when `files` names it literally (the prepack outputs: the
// CreationMap twin, LICENSE, NOTICE). The check means most on a checkout that has such trees on disk,
// and CI's clean checkout keeps the list honest.

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isCheckout = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' }).stdout?.trim() === 'true';

describe.skipIf(!isCheckout)('npm package contents', () => {
  it('carries no gitignored file unless files names it', () => {
    const pack = spawnSync(NPM, ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(pack.status, pack.stderr).toBe(0);
    const packed = JSON.parse(pack.stdout)[0].files.map((f) => f.path);
    const check = spawnSync('git', ['check-ignore', '--stdin'], { input: packed.join('\n'), encoding: 'utf8' });
    const named = new Set(JSON.parse(readFileSync('package.json', 'utf8')).files);
    const ignored = check.stdout.split('\n').filter(Boolean).filter((p) => !named.has(p));
    expect(ignored).toEqual([]);
  });

  it('still carries the two tracked mobile-suit behavior modules and nothing else from that tree', () => {
    const pack = spawnSync(NPM, ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const suit = JSON.parse(pack.stdout)[0].files.map((f) => f.path).filter((p) => p.startsWith('lib/graph/mobile-suit/'));
    expect(suit.sort()).toEqual(['lib/graph/mobile-suit/ms-ai.js', 'lib/graph/mobile-suit/ms-maneuvers.js']);
  });
});
