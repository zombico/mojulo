/**
 * App-MCP scaffold install helper.
 *
 * Materializes the in-repo template at `control/lib/app-mcp-scaffold/template/`
 * into a target artifact directory's `app-mcp/` subdirectory, substituting
 * the agent-provided identity placeholders (app name, materialization ref,
 * declared purpose).
 *
 * Bearer policy is **static-per-app** (per the spike's anti-scope): if the
 * target's `.env` already carries `APP_MCP_BEARER`, we reuse it; otherwise
 * we mint a fresh 32-byte hex bearer and append it. The bearer persists
 * across restarts; rotation is a post-spike hardening task.
 *
 * Called by the runner's `start_app` (lazily, idempotent) AND directly by
 * the agent at scaffold time. Both call sites converge on the same files.
 *
 * See APP_SPIKE_B_RUNNER_AND_SCHEMA_PLAN.md and template/_agent_extend.md.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = join(__dirname, 'template');

// Files whose contents the install helper substitutes placeholders into.
// Other files are copied byte-for-byte. Listed by relative path under
// TEMPLATE_ROOT so the predicate is explicit (avoids "did the agent edit
// this file post-install" ambiguity).
const FILES_WITH_PLACEHOLDERS = new Set([
  'tools/describe.js',
]);

function substitute(content, vars) {
  return content
    .replace(/\{\{APP_NAME\}\}/g, vars.appName)
    .replace(/\{\{MATERIALIZATION_REF\}\}/g, vars.materializationRef)
    .replace(/\{\{DECLARED_PURPOSE\}\}/g, vars.declaredPurpose);
}

function copyTemplateDir(srcRoot, dstRoot, vars) {
  const stack = [['', '']];
  while (stack.length > 0) {
    const [srcRel, dstRel] = stack.pop();
    const srcAbs = join(srcRoot, srcRel);
    const dstAbs = join(dstRoot, dstRel);
    const entries = readdirSync(srcAbs);
    for (const name of entries) {
      const childSrc = join(srcAbs, name);
      const childDst = join(dstAbs, name);
      const st = statSync(childSrc);
      if (st.isDirectory()) {
        mkdirSync(childDst, { recursive: true });
        stack.push([join(srcRel, name), join(dstRel, name)]);
      } else {
        const childRel = relative(srcRoot, childSrc).split('\\').join('/');
        if (FILES_WITH_PLACEHOLDERS.has(childRel)) {
          const raw = readFileSync(childSrc, 'utf8');
          writeFileSync(childDst, substitute(raw, vars));
        } else {
          copyFileSync(childSrc, childDst);
        }
      }
    }
  }
}

function ensureBearer(envPath) {
  // Idempotent: re-running install on an artifact whose .env already has a
  // bearer must not generate a new one (would orphan inventory entries
  // pinned to the old bearer).
  let existing = '';
  if (existsSync(envPath)) {
    existing = readFileSync(envPath, 'utf8');
    const m = existing.match(/^APP_MCP_BEARER\s*=\s*(\S+)\s*$/m);
    if (m) return { bearer: m[1], generated: false };
  }
  const bearer = randomBytes(32).toString('hex');
  // Append-with-newline so existing .env content isn't clobbered.
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  appendFileSync(envPath, `${prefix}APP_MCP_BEARER=${bearer}\n`);
  return { bearer, generated: true };
}

/**
 * Install the scaffold into `<targetDir>/app-mcp/`.
 *
 * @param {object} opts
 * @param {string} opts.targetDir          — absolute path of the app's artifact directory.
 * @param {string} opts.appName            — human-readable app name, baked into describe.js.
 * @param {string} opts.materializationRef — opaque ref baked into describe.js (typically the artifact node ref from the materialization commit).
 * @param {string} [opts.declaredPurpose]  — optional one-line purpose; baked into describe.js. Defaults to empty.
 * @param {boolean} [opts.overwrite]       — when true, overwrites the scaffold directory if it already exists (default false).
 * @returns {{ scaffoldDir: string, bearer: string, bearerGenerated: boolean, envPath: string }}
 */
export function installScaffold({
  targetDir,
  appName,
  materializationRef,
  declaredPurpose,
  overwrite = false,
}) {
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('installScaffold requires targetDir (absolute path)');
  }
  if (!appName || typeof appName !== 'string' || !appName.trim()) {
    throw new Error('installScaffold requires a non-empty appName');
  }
  if (!materializationRef || typeof materializationRef !== 'string' || !materializationRef.trim()) {
    throw new Error('installScaffold requires a non-empty materializationRef');
  }
  if (!existsSync(targetDir)) {
    throw new Error(`installScaffold: targetDir does not exist: ${targetDir}`);
  }

  const scaffoldDir = join(targetDir, 'app-mcp');
  if (existsSync(scaffoldDir) && !overwrite) {
    // Idempotent re-install: refuse silently to clobber. Caller passes
    // overwrite:true if they want to repave (e.g. evolve-mode, post-spike).
    const envPath = join(targetDir, '.env');
    const { bearer, generated } = ensureBearer(envPath);
    return { scaffoldDir, bearer, bearerGenerated: generated, envPath, reused: true };
  }
  mkdirSync(scaffoldDir, { recursive: true });

  copyTemplateDir(TEMPLATE_ROOT, scaffoldDir, {
    appName: appName.trim(),
    materializationRef: materializationRef.trim(),
    declaredPurpose: (declaredPurpose || '').trim(),
  });

  const envPath = join(targetDir, '.env');
  const { bearer, generated } = ensureBearer(envPath);

  return { scaffoldDir, bearer, bearerGenerated: generated, envPath, reused: false };
}

// Test seam — exposed for direct unit testing of the substitution path
// without spinning up a full install.
export const _internals = {
  substitute,
  FILES_WITH_PLACEHOLDERS,
  TEMPLATE_ROOT,
};
