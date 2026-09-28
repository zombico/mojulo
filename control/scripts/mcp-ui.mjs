#!/usr/bin/env node
/**
 * `mojulo-ui` — starts the mojulo dashboard at this core package's exact version.
 *
 * Sibling to [mcp-stdio.mjs](./mcp-stdio.mjs): the stdio bin is what MCP hosts spawn; this is what
 * humans run to scan the fleet and act on outcomes. Both share `~/.mojulo/` state via
 * [resolveMojuloPaths](./mojulo-paths.mjs).
 *
 * Since 3.0.0 the dashboard's prebuilt Next.js server is its own npm package
 * (lib/version/ui-package.js), so a host's cold `npx mojulo` no longer downloads it. This bin is
 * the shim that keeps `npx -y -p mojulo mojulo-ui` and `mojulo init`'s launch working:
 *   1. the dashboard package installed beside core at the same version → run its bin;
 *   2. a repo checkout with a local `next build` (control/.next/standalone) → run that;
 *   3. otherwise fetch it: `npm exec --yes --package=mojulo-ui@<this version>`, announced on
 *      stderr first because it downloads from the npm registry. MOJULO_UI_NO_FETCH=1 refuses.
 *
 * Usage:
 *   npx -y -p mojulo mojulo-ui                # port 3001 (or next free), opens browser
 *   npx -y -p mojulo mojulo-ui --port 3999    # pin the port
 *   npx -y -p mojulo mojulo-ui --no-open      # skip browser launch
 */

import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  CONTROL_DIR,
  UI_USAGE,
  locateDashboard,
  parseUiArgs,
  readPackageJson,
  startDashboard,
  uiArgsToArgv,
} from './ui-launch.mjs';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME, uiLaunchCommand } from '../lib/version/ui-package.js';

const argv = process.argv.slice(2);
const args = parseUiArgs(argv);
const version = readPackageJson(CONTROL_DIR)?.version;
const spec = `${UI_PACKAGE_NAME}@${version}`;

if (args.error) {
  process.stderr.write(`mojulo-ui: ${args.error}\n`);
  process.exit(2);
}
if (args.help) {
  process.stdout.write(
    `${UI_USAGE}\nThe dashboard is the ${UI_PACKAGE_NAME} package, at this mojulo's version (${spec}).\n`
      + `When it is not installed beside mojulo, this command downloads it from the npm registry with\n`
      + `npm exec first; MOJULO_UI_NO_FETCH=1 refuses the download. \`${uiLaunchCommand(version)}\` runs it directly.\n`,
  );
  process.exit(0);
}

const found = locateDashboard({ version });
if (found.source === 'package') {
  // Its bin starts the dashboard with this process's argv.
  await import(pathToFileURL(found.bin).href);
} else if (found.source === 'local-build') {
  await startDashboard({
    standaloneServer: found.standaloneServer,
    argv,
  });
} else {
  fetchAndRun();
}

function fetchAndRun() {
  const other = found.mismatched.map((m) => `${m.root} (${m.version ?? 'unreadable'})`).join(', ');
  const say = (line) => process.stderr.write(`mojulo-ui: ${line}\n`);
  say(`the dashboard is its own npm package, ${spec}, and it is not installed beside mojulo ${version}.`);
  if (other) say(`found ${UI_PACKAGE_NAME} at another version, which cannot share this version's database: ${other}`);
  if (process.env.MOJULO_UI_NO_FETCH === '1') {
    say(`MOJULO_UI_NO_FETCH=1, so nothing was downloaded. Start it with: ${uiLaunchCommand(version)}`);
    process.exit(1);
  }
  const npmArgs = ['exec', '--yes', `--package=${spec}`, '--', UI_PACKAGE_BIN, ...uiArgsToArgv(args)];
  say('downloading it from the npm registry into the npm cache now (the prebuilt Next.js server, plus');
  say('any dependency not already cached; once per version):');
  say(`  npm ${npmArgs.join(' ')}`);
  say(`MOJULO_UI_NO_FETCH=1 skips this download; \`${uiLaunchCommand(version)}\` does the same thing directly.`);

  const win = process.platform === 'win32';
  // npm is a .cmd shim on Windows, which spawn only runs through a shell; every forwarded
  // argument came out of parseUiArgs, so none needs quoting.
  const child = spawn(win ? 'npm.cmd' : 'npm', npmArgs, { stdio: 'inherit', shell: win });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }
  child.on('error', (err) => {
    say(`could not run npm (${err.message}). Start the dashboard with: ${uiLaunchCommand(version)}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
