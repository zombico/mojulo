// The dashboard ships as its own npm package since 2.2.0. Its Next.js build was most of what the
// core package downloaded, and the stdio server a host spawns never loads it. This file is the one
// place the package's name and layout live; control/ui-package/package.json must agree with it
// (lib/version/ui-package.test.js). The package is published at exactly the core version and
// depends on mojulo at that version, because the dashboard runs its own compiled copy of lib/
// (the SQLite schema included) against the same $MOJULO_HOME.
export const UI_PACKAGE_NAME = 'mojulo-ui';

// Its bin. Not `mojulo-ui`: core keeps that name for the shim (scripts/mcp-ui.mjs), and two
// packages in one tree that link the same bin name make a later `npm install` fail with EEXIST.
export const UI_PACKAGE_BIN = 'mojulo-dashboard';

// Where the package keeps the Next standalone server and the bot template, from its root.
export const UI_STANDALONE_DIR = 'standalone';
export const UI_LITE_TEMPLATE_DIR = 'lite-template';

/** The command that starts the dashboard matching a given core version. */
export function uiLaunchCommand(version) {
  return `npx -y ${UI_PACKAGE_NAME}@${version}`;
}
