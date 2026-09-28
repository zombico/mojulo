/**
 * How this copy of mojulo was installed, and the commands that fit it.
 *
 * Every command mojulo tells an agent or an operator to run (an install group, a missing optional
 * helper, an update, the dashboard) is written here, so it names the version that is running and
 * the way it was installed:
 *   - 'claude-plugin': started by the Claude plugin, whose manifest runs `npx -y mojulo@<version>`
 *     and sets MOJULO_DISTRIBUTION=claude-plugin (plugins/mojulo/.claude-plugin/plugin.json). The
 *     plugin owns the version: an update is a plugin update, and an unpinned `npx mojulo` would start
 *     another version of the server on the same $MOJULO_HOME.
 *   - 'source': a repo checkout (a .git beside control/). Commands run from control/.
 *   - 'npm': any other npm install (npx, global, a project dependency).
 * Outside a checkout a command names `mojulo@<running version>`, never a bare `mojulo`, which npx
 * resolves to whatever is newest on the registry.
 */

import { getControlPlaneVersion, isSourceClone } from './local.js';
import { uiLaunchCommand } from './ui-package.js';

export const CLAUDE_PLUGIN = 'claude-plugin';

const DISTRIBUTIONS = new Set([CLAUDE_PLUGIN, 'source', 'npm']);

/** 'claude-plugin' | 'source' | 'npm'. An explicit MOJULO_DISTRIBUTION wins over the checkout probe. */
export function distribution(env = process.env) {
  if (DISTRIBUTIONS.has(env.MOJULO_DISTRIBUTION)) return env.MOJULO_DISTRIBUTION;
  return isSourceClone() ? 'source' : 'npm';
}

const versionOf = (opts) => opts?.version ?? getControlPlaneVersion();

/** `npx -y mojulo@<version> <args>`: the running version, fetched from npm. What a box installs too. */
export function npxMojulo(args, opts = {}) {
  return `npx -y mojulo@${versionOf(opts)}${args ? ` ${args}` : ''}`;
}

/** The command that runs a mojulo subcommand (`install recall`, `orient`) for this install. */
export function mojuloCommand(args, opts = {}) {
  if (distribution(opts.env) === 'source') return `node scripts/mcp-stdio.mjs ${args}`;
  return npxMojulo(args, opts);
}

/** "run `<command>`", plus where to run it from a checkout. */
export function runMojulo(args, opts = {}) {
  const where = distribution(opts.env) === 'source' ? ' in control/' : '';
  return `run \`${mojuloCommand(args, opts)}\`${where}`;
}

/** The command that starts the dashboard for this version (it is the separate mojulo-ui package). */
export function dashboardCommand(opts = {}) {
  return uiLaunchCommand(versionOf(opts));
}

// npx keeps one install per package spec under the npm cache; deleting it makes the next start
// install that version again.
const NPX_COPY = "its folder under the npm cache's `_npx` directory (`npm config get cache` prints the cache)";

/**
 * What to say when one of package.json's optionalDependencies (manifold-3d, openscad-wasm-prebuilt,
 * sharp, …) does not resolve. npm skips an optional dependency when optional dependencies are
 * omitted or when the package has no build for the platform, so this names both.
 */
export function optionalHelperHint(pkg, opts = {}) {
  const dist = distribution(opts.env);
  if (dist === 'source') return `\`npm install --include=optional\` in control/ adds ${pkg}`;
  const version = versionOf(opts);
  const why = `${pkg} is an optional dependency of mojulo@${version} that npm did not install here `
    + '(optional dependencies were omitted, see `npm config get omit`, or it has no build for this platform)';
  const fix = dist === CLAUDE_PLUGIN
    ? `to add it, stop npm omitting optional dependencies, then delete the plugin's npx copy of mojulo@${version}, ${NPX_COPY}, and restart the session so npx installs it again`
    : `to add it, reinstall mojulo@${version} with optional dependencies included`;
  return `${why}; ${fix}. \`${npxMojulo('install creative', opts)}\` lists every missing helper`;
}

/** How to reinstall mojulo when a required dependency of the package cannot load (a clause starting with a verb). */
export function reinstallHint(opts = {}) {
  const dist = distribution(opts.env);
  if (dist === 'source') return 'run `npm install` in control/';
  const version = versionOf(opts);
  return dist === CLAUDE_PLUGIN
    ? `delete the plugin's npx copy of mojulo@${version}, ${NPX_COPY}, and restart the session so npx installs it again`
    : `run \`npm i -g mojulo@${version}\`, or for npx delete ${NPX_COPY} and run \`${npxMojulo('', opts)}\` again`;
}

/** check_for_updates: how to move this install to `latest`. */
export function updateAdvice(latest, opts = {}) {
  const dist = distribution(opts.env);
  if (dist === 'source') {
    return `Running from a source clone — \`git pull\` (and \`npm install\` in control/) to pick up ${latest}.`;
  }
  if (dist === CLAUDE_PLUGIN) {
    return `This server is the mojulo Claude plugin, which pins mojulo@${versionOf(opts)}. Update the plugin, not npx: `
      + 'in Claude Code open `/plugin`, pick mojulo and choose Update; in the Claude app use Customize > Plugins. '
      + `Then restart the session. ${latest} arrives when a plugin release pins it. Do not start \`npx mojulo@latest\` `
      + 'beside the plugin: that is a second server, at another version, on the same ~/.mojulo.';
  }
  return `Run \`npm i -g mojulo@${latest}\` (or restart with \`npx -y mojulo@${latest}\`) to upgrade.`;
}

/** check_for_updates: how to move deployed bots to a newer bot image. */
export function botImageAdvice(image, opts = {}) {
  if (distribution(opts.env) === 'source') {
    return `Bump \`BOT_IMAGE\` in control/.env to \`${image}\` (and the default pin in control/lib/version/bot-image.js), then rebuild affected bots.`;
  }
  return `Set \`BOT_IMAGE=${image}\` in the environment the mojulo server starts with (or wait for the mojulo release that pins it), then rebuild affected bots.`;
}
