/**
 * What the dashboard package's manifest (control/ui-package/package.json) must say, derived from
 * core's package.json and the Next build config. Shared by stage-ui-package.mjs (its prepack,
 * --check and --sync), the cold-install smoke and lib/version/ui-package.test.js.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextConfig from '../next.config.mjs';
import { UI_PACKAGE_BIN, UI_PACKAGE_NAME } from '../lib/version/ui-package.js';

export const CONTROL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UI_PACKAGE_DIR = path.join(CONTROL_DIR, 'ui-package');

// Native halves that travel with a server external: @img/* is sharp's libvips build, and
// onnxruntime-common pairs with onnxruntime-node (the recall group's runtime).
const NATIVE_PARTNERS = ['@img', 'onnxruntime-common'];

// Dependencies the dashboard package declares for itself; every other one follows core.
// `open` starts the browser, and only the dashboard does that.
const OWN_DEPENDENCIES = ['open'];

/**
 * Packages the dashboard resolves from the install, never from a copy traced into its standalone
 * build: every server external (the build leaves each one a runtime require) plus the native
 * halves above. A traced copy carries whatever version the build machine had, while the stdio
 * server resolves the installed one, so two processes on one database would run different
 * versions of the same geometry, raster and archive code.
 */
export function fromInstallPackages() {
  return [...nextConfig.serverExternalPackages, ...NATIVE_PARTNERS];
}

/** True when `name` is one of `list`, or sits under a scope listed there (`@img` → `@img/x`). */
export function matchesPackage(name, list) {
  return list.some((entry) => name === entry || name.startsWith(`${entry}/`));
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'en')));

/**
 * The manifest fields that follow core: name, version, engines, bin, and the dependency ranges.
 * It depends on mojulo at exactly core's version and declares each shared package with core's
 * range, in the same field, so npm installs one copy for both.
 */
export function derivedUiFields(core, ui = {}) {
  const shared = fromInstallPackages();
  const pick = (deps = {}) => Object.fromEntries(Object.entries(deps).filter(([name]) => matchesPackage(name, shared)));
  const own = Object.fromEntries(
    Object.entries(ui.dependencies ?? {}).filter(([name]) => OWN_DEPENDENCIES.includes(name)),
  );
  const optional = sortKeys(pick(core.optionalDependencies));
  return {
    name: UI_PACKAGE_NAME,
    version: core.version,
    engines: core.engines,
    bin: { [UI_PACKAGE_BIN]: `bin/${UI_PACKAGE_BIN}.mjs` },
    dependencies: sortKeys({ ...own, mojulo: core.version, ...pick(core.dependencies) }),
    ...(Object.keys(optional).length ? { optionalDependencies: optional } : {}),
  };
}

/** Where the dashboard manifest disagrees with core; an empty list when it is in step. */
export function uiManifestProblems(core, ui) {
  const problems = [];
  const want = derivedUiFields(core, ui);
  for (const [field, value] of Object.entries(want)) {
    if (JSON.stringify(ui[field]) !== JSON.stringify(value)) {
      problems.push(`${field} is ${JSON.stringify(ui[field])}, core wants ${JSON.stringify(value)}`);
    }
  }
  if (ui.optionalDependencies && !want.optionalDependencies) {
    problems.push(`optionalDependencies is ${JSON.stringify(ui.optionalDependencies)}, core wants none`);
  }
  for (const name of OWN_DEPENDENCIES) {
    if (!ui.dependencies?.[name]) problems.push(`dependencies.${name} is missing`);
  }
  return problems;
}

/** The dashboard manifest with its derived fields rewritten from core. */
export function syncedUiManifest(core, ui) {
  const next = { ...ui, ...derivedUiFields(core, ui) };
  if (!derivedUiFields(core, ui).optionalDependencies) delete next.optionalDependencies;
  return next;
}

/** Top-level package names in a node_modules directory (`@scope/name` for scoped ones). */
export function listPackages(nm) {
  const names = [];
  for (const entry of readdirSync(nm, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (!entry.name.startsWith('@')) names.push(entry.name);
    else for (const s of readdirSync(path.join(nm, entry.name), { withFileTypes: true })) {
      if (s.isDirectory()) names.push(`${entry.name}/${s.name}`);
    }
  }
  return names;
}

/**
 * The packages to leave out of the staged standalone node_modules: those matching `fromInstall`,
 * and anything reachable only through them. A dependency another kept package also declares
 * stays (jsdom and puppeteer-core both need ws, for one).
 */
export function prunedPackages(nm, fromInstall) {
  const all = new Set(listPackages(nm));
  const depsOf = (name) => {
    try {
      const pkg = readJson(path.join(nm, name, 'package.json'));
      return Object.keys({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies });
    } catch {
      return [];
    }
  };
  const closure = (roots, stop) => {
    const out = new Set();
    const stack = [...roots];
    while (stack.length) {
      const name = stack.pop();
      if (out.has(name) || !all.has(name) || stop(name)) continue;
      out.add(name);
      stack.push(...depsOf(name));
    }
    return out;
  };
  const excluded = (name) => matchesPackage(name, fromInstall);
  const viaExcluded = closure([...all].filter(excluded), () => false);
  const keep = closure([...all].filter((name) => !viaExcluded.has(name)), excluded);
  return [...all].filter((name) => !keep.has(name)).sort();
}
