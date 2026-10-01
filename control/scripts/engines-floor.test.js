// A fresh `npx -y mojulo@<v>` resolves every range anew. pdf2json 4.1.0 declared Node >=22.23.2
// while mojulo promises 22.14, so the cold install smoke checks the installed tree against the
// floor. (Core pinned pdf2json to the 4.0 line until 3.0.0, when it left with the chatbot factory.)

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enginesViolations, floorOf } from './engines-floor.mjs';

const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package.json'), 'utf8'));

let nm;
beforeEach(() => {
  nm = path.join(mkdtempSync(path.join(os.tmpdir(), 'mojulo-engines-')), 'node_modules');
  mkdirSync(nm, { recursive: true });
});
afterEach(() => rmSync(path.dirname(nm), { recursive: true, force: true }));

const hiddenLock = (packages) =>
  writeFileSync(path.join(nm, '.package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages }));

describe('engines floor', () => {
  it('reads the floor from the declared range', () => {
    expect(floorOf('>=22.14.0')).toBe('22.14.0');
    expect(floorOf(pkg.engines.node)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('names a required package that refuses the floor, and skips optional ones', () => {
    hiddenLock({
      'node_modules/pdf2json': { version: '4.1.0', engines: { node: '>=22.23.2' } },
      'node_modules/pdfjs-dist': { version: '5.7.284', engines: { node: '>=20.19.0 || >=22.13.0 || >=24' } },
      'node_modules/x/node_modules/@img/sharp-win32-ia32': { version: '0.35.4', engines: { node: '^20.9.0' }, optional: true },
    });
    expect(enginesViolations(nm, '22.14.0')).toEqual({
      checked: true,
      violations: [{ name: 'pdf2json', version: '4.1.0', range: '>=22.23.2' }],
    });
  });

  it('says when it could not check', () => {
    expect(enginesViolations(nm, '22.14.0').checked).toBe(false);
  });

  it('neither core nor the dashboard depends on the chatbot factory\'s document parsers', () => {
    const ui = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'ui-package', 'package.json'), 'utf8'));
    for (const manifest of [pkg, ui]) {
      for (const name of ['pdf2json', 'officeparser']) {
        expect(manifest.dependencies?.[name], name).toBeUndefined();
        expect(manifest.optionalDependencies?.[name], name).toBeUndefined();
      }
    }
  });

  it('the locked tree accepts the floor', () => {
    const lock = JSON.parse(readFileSync(path.join(CONTROL_DIR, 'package-lock.json'), 'utf8'));
    hiddenLock(lock.packages);
    const { checked, violations } = enginesViolations(nm, floorOf(pkg.engines.node));
    expect(checked).toBe(true);
    expect(violations).toEqual([]);
  });
});
