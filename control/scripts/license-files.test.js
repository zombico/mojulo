// Both tarballs redistribute code under licenses that require their notices to travel with it:
// mojulo's own Apache-2.0 LICENSE and NOTICE (at the repo root, outside both package folders), and
// the third-party packages the dashboard ships under standalone/node_modules, whose license files
// Next's output tracing leaves out.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyProjectLicense, removeProjectLicense, stageThirdPartyNotices } from './license-files.mjs';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(path.join(CONTROL_DIR, rel), 'utf8'));

let tmp;
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
  writeFileSync(path.join(tmp, rel), text);
};

beforeEach(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'mojulo-license-'));
});
afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe('project LICENSE and NOTICE', () => {
  it('are copied into a package folder and removed again', () => {
    copyProjectLicense(tmp);
    expect(readFileSync(path.join(tmp, 'LICENSE'), 'utf8')).toMatch(/Apache License/);
    expect(readFileSync(path.join(tmp, 'NOTICE'), 'utf8')).toMatch(/Mojulo/);
    removeProjectLicense(tmp);
    expect(existsSync(path.join(tmp, 'LICENSE'))).toBe(false);
  });

  it('are packed by core and the dashboard package', () => {
    const core = readJson('package.json');
    expect(core.scripts.prepack).toContain('license-files.mjs copy');
    expect(core.scripts.postpack).toContain('license-files.mjs remove');
    expect(core.files).toEqual(expect.arrayContaining(['LICENSE', 'NOTICE']));
    expect(readJson('ui-package/package.json').files).toEqual(expect.arrayContaining(['LICENSE', 'NOTICE']));
    expect(readFileSync(path.join(CONTROL_DIR, 'scripts', 'stage-ui-package.mjs'), 'utf8')).toMatch(/stageLicenses\(\);/);
  });
});

describe('stageThirdPartyNotices', () => {
  it('puts back each staged package\'s license files and lists every package', () => {
    // The build's node_modules has the full packages; the traced copy has only code.
    write('src/react/package.json', JSON.stringify({ name: 'react', version: '19.0.0', license: 'MIT' }));
    write('src/react/LICENSE', 'MIT License react');
    write('src/@img/sharp/package.json', JSON.stringify({ name: '@img/sharp', version: '0.34.5', license: 'Apache-2.0' }));
    write('src/@img/sharp/LICENSE.md', 'Apache sharp');
    write('src/@img/sharp/NOTICE', 'sharp notice');
    write('src/nolicense/package.json', JSON.stringify({ name: 'nolicense', version: '1.0.0', license: 'ISC' }));
    write('staged/react/package.json', JSON.stringify({ name: 'react', version: '19.0.0', license: 'MIT' }));
    write('staged/react/index.js', '');
    write('staged/@img/sharp/package.json', JSON.stringify({ name: '@img/sharp', version: '0.34.5', license: 'Apache-2.0' }));
    write('staged/nolicense/package.json', JSON.stringify({ name: 'nolicense', version: '1.0.0', license: 'ISC' }));
    // A nested copy the tree keeps under its parent resolves from the build's hoisted copy.
    write('staged/react/node_modules/scheduler/package.json', JSON.stringify({ name: 'scheduler', version: '0.25.0', license: 'MIT' }));
    write('src/scheduler/package.json', JSON.stringify({ name: 'scheduler', version: '0.25.0', license: 'MIT' }));
    write('src/scheduler/LICENSE', 'MIT License scheduler');

    const outFile = path.join(tmp, 'staged-notices.md');
    const result = stageThirdPartyNotices({
      stagedNodeModules: path.join(tmp, 'staged'),
      sourceNodeModules: path.join(tmp, 'src'),
      outFile,
    });

    expect(result.packages).toBe(4);
    expect(result.missing).toEqual(['nolicense']);
    expect(readFileSync(path.join(tmp, 'staged/react/LICENSE'), 'utf8')).toBe('MIT License react');
    expect(readFileSync(path.join(tmp, 'staged/@img/sharp/NOTICE'), 'utf8')).toBe('sharp notice');
    expect(existsSync(path.join(tmp, 'staged/@img/sharp/LICENSE.md'))).toBe(true);
    expect(existsSync(path.join(tmp, 'staged/react/node_modules/scheduler/LICENSE'))).toBe(true);
    const notices = readFileSync(outFile, 'utf8');
    expect(notices).toContain('| react | 19.0.0 | MIT | node_modules/react/LICENSE |');
    expect(notices).toContain('| @img/sharp | 0.34.5 | Apache-2.0 |');
    expect(notices).toContain('| nolicense | 1.0.0 | ISC | no license file in the published package |');
  });
});
