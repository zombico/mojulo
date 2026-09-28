#!/usr/bin/env node
/**
 * Builds and stages the dashboard package, control/ui-package/, from this checkout. It is that
 * package's `prepack`, so `npm pack` or `npm publish` inside ui-package/ builds it first; from
 * control/, `npm run pack:ui` packs it beside core's tarball.
 *
 *   node scripts/stage-ui-package.mjs           check the manifest, build, stage (the prepack)
 *   node scripts/stage-ui-package.mjs --check   only check ui-package/package.json against core
 *   node scripts/stage-ui-package.mjs --sync    rewrite its derived fields from core and exit
 *
 * Build and stage:
 *   1. `next build --webpack` in control/, then stage-standalone.mjs copies .next/static and
 *      public/ into .next/standalone. MOJULO_UI_REUSE_BUILD=1 keeps an existing build instead.
 *   2. Copy .next/standalone to ui-package/standalone/, leaving out env files, data, trace
 *      manifests, tests, and every package the dashboard resolves from the install
 *      (ui-package-manifest.mjs, fromInstallPackages) plus the dependencies only those pulled in.
 *   3. Put back the license files tracing left out and write standalone/THIRD_PARTY_NOTICES.md,
 *      and copy the repo's LICENSE and NOTICE to the package root (license-files.mjs).
 * (Until 3.0 a fourth step staged the chatbot runtime template, lite-template/; it left with the
 * chatbot factory.)
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { UI_STANDALONE_DIR } from '../lib/version/ui-package.js';
import { copyProjectLicense, stageThirdPartyNotices } from './license-files.mjs';
import {
  CONTROL_DIR,
  UI_PACKAGE_DIR,
  fromInstallPackages,
  prunedPackages,
  readJson,
  syncedUiManifest,
  uiManifestProblems,
} from './ui-package-manifest.mjs';

const BUILT = path.join(CONTROL_DIR, '.next', 'standalone');
const say = (line) => process.stderr.write(`stage-ui-package: ${line}\n`);

function run(cmd, args, env = process.env) {
  const res = spawnSync(cmd, args, { cwd: CONTROL_DIR, stdio: 'inherit', env });
  if (res.status !== 0) {
    say(`${path.basename(args[0] ?? cmd)} exited ${res.status ?? res.signal}`);
    process.exit(1);
  }
}

function dirStats(dir) {
  let files = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) {
        files += 1;
        bytes += statSync(p).size;
      }
    }
  }
  return { files, mb: (bytes / 1024 / 1024).toFixed(1) };
}

function checkManifest({ sync }) {
  const manifestPath = path.join(UI_PACKAGE_DIR, 'package.json');
  const core = readJson(path.join(CONTROL_DIR, 'package.json'));
  const ui = readJson(manifestPath);
  if (sync) {
    writeFileSync(manifestPath, `${JSON.stringify(syncedUiManifest(core, ui), null, 2)}\n`);
    say(`synced ${path.relative(CONTROL_DIR, manifestPath)} to mojulo ${core.version}`);
    return;
  }
  const problems = uiManifestProblems(core, ui);
  if (problems.length) {
    for (const p of problems) say(`ui-package/package.json: ${p}`);
    say('run `npm run ui:sync` in control/ to bring it in step with core, then review the diff.');
    process.exit(1);
  }
  say(`ui-package/package.json is in step with mojulo ${core.version}`);
}

function build() {
  if (process.env.MOJULO_UI_REUSE_BUILD === '1' && existsSync(path.join(BUILT, 'server.js'))) {
    say('MOJULO_UI_REUSE_BUILD=1: keeping the existing .next/standalone build');
  } else {
    const next = createRequire(path.join(CONTROL_DIR, 'package.json')).resolve('next/dist/bin/next');
    const nodeOptions = [process.env.NODE_OPTIONS, '--max-old-space-size=8192'].filter(Boolean).join(' ');
    run(process.execPath, [next, 'build', '--webpack'], { ...process.env, NODE_OPTIONS: nodeOptions });
  }
  run(process.execPath, [path.join(CONTROL_DIR, 'scripts', 'stage-standalone.mjs')]);
}

function stageStandalone() {
  const dest = path.join(UI_PACKAGE_DIR, UI_STANDALONE_DIR);
  const pruned = new Set(prunedPackages(path.join(BUILT, 'node_modules'), fromInstallPackages()));
  const skipAtRoot = (rel) => rel === 'data' || rel === '.env'
    || rel.startsWith('.env.') || /^mojulo-.*\.tgz$/.test(rel);
  const filter = (src) => {
    const rel = path.relative(BUILT, src).split(path.sep).join('/');
    if (!rel) return true;
    if (!rel.includes('/') && skipAtRoot(rel)) return false;
    if (rel.endsWith('.nft.json') || rel.endsWith('.test.js')) return false;
    if (rel === 'lib/embedder/models') return false;
    const mod = rel.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)$/);
    return !(mod && pruned.has(mod[1]));
  };
  rmSync(dest, { recursive: true, force: true });
  cpSync(BUILT, dest, { recursive: true, filter });
  if (!existsSync(path.join(dest, 'server.js'))) {
    say(`no server.js in ${dest}; the build did not stage`);
    process.exit(1);
  }
  const { files, mb } = dirStats(dest);
  say(`staged ${path.relative(CONTROL_DIR, dest)}: ${files} files, ${mb} MB; left ${pruned.size} packages to the install`);
}

// The tracing that built standalone/node_modules keeps no license files; put them back, list every
// redistributed package, and ship the project's own LICENSE and NOTICE at the package root.
function stageLicenses() {
  copyProjectLicense(UI_PACKAGE_DIR);
  const { packages, missing } = stageThirdPartyNotices({
    stagedNodeModules: path.join(UI_PACKAGE_DIR, UI_STANDALONE_DIR, 'node_modules'),
    sourceNodeModules: path.join(CONTROL_DIR, 'node_modules'),
    outFile: path.join(UI_PACKAGE_DIR, UI_STANDALONE_DIR, 'THIRD_PARTY_NOTICES.md'),
  });
  say(`license files for ${packages} redistributed packages; standalone/THIRD_PARTY_NOTICES.md lists them`);
  if (missing.length) say(`no license file published by: ${missing.join(', ')} (listed with their declared license)`);
}

const flags = new Set(process.argv.slice(2));
if (flags.has('--sync')) checkManifest({ sync: true });
else {
  checkManifest({ sync: false });
  if (!flags.has('--check')) {
    build();
    stageStandalone();
    stageLicenses();
  }
}
