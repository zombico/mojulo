#!/usr/bin/env node
// Deterministic, conservative detection of unused i18n leaf keys in
// control/messages/en.json, by static analysis of how next-intl translators
// reference keys across control/**.
//
// Safety posture: ZERO false positives by design. A leaf is reported unused
// only if BOTH:
//   (a) its full dotted path appears nowhere as a literal key or as a raw
//       dotted string literal anywhere in the source, AND
//   (b) it does not live under any dynamically-built key prefix.
//
// How dynamic keys are handled (the part pure grep gets wrong):
//   - t(`a.b.${x}`)  -> protect the WHOLE subtree under the static prefix
//     `a.b` (combined with the translator's namespace). We never resolve `x`;
//     any assembled key necessarily lives under that prefix.
//   - t(varOrMember) on a *namespaced* translator -> protect that whole
//     namespace subtree (can't see the key, but the namespace bounds it).
//   - t(varOrMember) on a *root* translator (useTranslations()) -> can't bound
//     it, so it is surfaced as a BLIND SPOT for human review. These rely on the
//     raw dotted-literal corpus to stay safe (e.g. ROUTES labelKey: 'a.b.c').
//
// The cost of this posture is possible false negatives: some genuinely-dead
// keys that happen to sit under a dynamic prefix are retained. That asymmetry
// is intentional for a deletion tool.
//
// Usage:
//   node scripts/find-unused-locale-keys.mjs           # detect, print JSON report
//   node scripts/find-unused-locale-keys.mjs --apply   # detect, then DELETE the
//                                                       # unused leaves from en.json
//                                                       # ONLY (prune empty parents).
//                                                       # Run /sync-locales afterward
//                                                       # to propagate the removals to
//                                                       # every other locale file.
//
// Detection is deterministic, so --apply removes exactly what the no-arg run
// reported (absent intervening edits).

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join as pathJoin, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const controlRoot = resolve(__dirname, '..');
const messagesDir = resolve(controlRoot, 'messages');
const enPath = resolve(messagesDir, 'en.json');

const APPLY = process.argv.includes('--apply');

// Directories never worth scanning for translator usage.
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'out', 'dist', 'coverage',
  'data', 'public', 'messages', '.turbo', '.vercel',
]);
const SOURCE_EXTS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

// next-intl translator member methods that also take a key as first arg.
const KEY_METHODS = new Set(['rich', 'markup', 'raw', 'has']);
// Looks like a dotted message path: two+ word segments joined by dots.
const DOTTED = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/;

function loadParser() {
  try { return require('@babel/parser'); } catch { /* fall through */ }
  try { return require('next/dist/compiled/babel/parser'); } catch { /* fall through */ }
  console.error(
    'find-unused-locale-keys: no babel parser found. Install @babel/parser ' +
    '(npm i -D @babel/parser) or run inside a tree where next is installed.',
  );
  process.exit(2);
}

function pluginsFor(file) {
  const ext = extname(file);
  if (ext === '.ts') return ['typescript'];
  if (ext === '.tsx') return ['typescript', 'jsx'];
  return ['jsx'];
}

function listSourceFiles(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') && name !== '.') {
      if (SKIP_DIRS.has(name)) continue;
    }
    if (SKIP_DIRS.has(name)) continue;
    const full = pathJoin(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) listSourceFiles(full, acc);
    else if (SOURCE_EXTS.has(extname(name))) acc.push(full);
  }
  return acc;
}

// Generic AST walker. Visits every node; doesn't recurse into comment nodes.
function walk(node, visit) {
  if (!node || typeof node.type !== 'string') return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'comments' || key === 'leadingComments' ||
        key === 'trailingComments' || key === 'innerComments') continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const c of val) if (c && typeof c.type === 'string') walk(c, visit);
    } else if (val && typeof val.type === 'string') {
      walk(val, visit);
    }
  }
}

function nsJoin(ns, key) {
  if (!key) return ns || '';
  return ns ? `${ns}.${key}` : key;
}

// Static path prefix determined by a template literal's first quasi.
// Only complete (dot-bounded) segments count; a partial trailing segment
// (interpolation mid-segment) is dropped.
function templateStaticPrefix(tpl) {
  const cooked = tpl.quasis[0]?.value?.cooked ?? '';
  const endsWithDot = cooked.endsWith('.');
  const segs = cooked.split('.');
  if (!endsWithDot) segs.pop();
  while (segs.length && segs[segs.length - 1] === '') segs.pop();
  return segs.join('.');
}

function analyzeFile(file, parser, acc) {
  let code;
  try { code = readFileSync(file, 'utf8'); } catch { return; }
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: pluginsFor(file) });
  } catch (e) {
    acc.parseErrors.push({ file: rel(file), message: e.message });
    return;
  }

  // Pass 1: bind translator identifiers -> set of namespaces.
  //   const t = useTranslations('ns')            -> t : {'ns'}
  //   const t = await getTranslations('ns')      -> t : {'ns'}
  //   const t = useTranslations()                -> t : {''}   (root)
  //   const t = useTranslations(expr)            -> t : {null} (unknown ns)
  const translators = new Map(); // name -> Set<string|null>
  const addNs = (name, ns) => {
    if (!translators.has(name)) translators.set(name, new Set());
    translators.get(name).add(ns);
  };
  walk(ast, (n) => {
    if (n.type !== 'VariableDeclarator' || !n.id || n.id.type !== 'Identifier' || !n.init) return;
    let init = n.init;
    if (init.type === 'AwaitExpression') init = init.argument;
    if (!init || init.type !== 'CallExpression' || init.callee.type !== 'Identifier') return;
    if (init.callee.name !== 'useTranslations' && init.callee.name !== 'getTranslations') return;
    const arg = init.arguments[0];
    if (arg === undefined) addNs(n.id.name, '');
    else if (arg.type === 'StringLiteral') addNs(n.id.name, arg.value);
    else addNs(n.id.name, null);
  });

  // Pass 2: classify every translator call + harvest the dotted-literal corpus.
  walk(ast, (n) => {
    if (n.type === 'StringLiteral' && DOTTED.test(n.value)) acc.corpus.add(n.value);
    if (n.type !== 'CallExpression') return;

    const callee = n.callee;
    let name = null;
    if (callee.type === 'Identifier' && translators.has(callee.name)) {
      name = callee.name;
    } else if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' && translators.has(callee.object.name) &&
      callee.property.type === 'Identifier' && KEY_METHODS.has(callee.property.name)
    ) {
      name = callee.object.name;
    }
    if (!name) return;

    const namespaces = translators.get(name);
    const arg = n.arguments[0];
    const line = n.loc?.start?.line ?? 0;
    classifyArg(arg, namespaces, { file: rel(file), line, translator: name }, acc);
  });
}

function classifyArg(arg, namespaces, site, acc) {
  if (!arg) return;

  if (arg.type === 'StringLiteral') {
    for (const ns of namespaces) {
      if (ns === null) acc.unknownNsLiterals.add(arg.value);
      else acc.exactUsed.add(nsJoin(ns, arg.value));
    }
    return;
  }

  if (arg.type === 'TemplateLiteral') {
    const prefix = templateStaticPrefix(arg);
    for (const ns of namespaces) {
      if (ns === null) {
        acc.blindSpots.push({ ...site, kind: 'template-unknown-namespace', namespace: '(unknown)' });
      } else if (nsJoin(ns, prefix) === '') {
        acc.blindSpots.push({ ...site, kind: 'template-no-static-prefix', namespace: '(root)' });
      } else {
        acc.protectedPrefixes.add(nsJoin(ns, prefix));
      }
    }
    return;
  }

  // Bare dynamic: Identifier, MemberExpression, CallExpression, Conditional, etc.
  for (const ns of namespaces) {
    if (ns === null) {
      acc.blindSpots.push({ ...site, kind: 'bare-dynamic-unknown-namespace', namespace: '(unknown)' });
    } else if (ns === '') {
      acc.blindSpots.push({ ...site, kind: 'bare-dynamic-root', namespace: '(root)' });
    } else {
      acc.protectedPrefixes.add(ns);
    }
  }
}

function rel(file) {
  return file.startsWith(controlRoot + '/') ? file.slice(controlRoot.length + 1) : file;
}

// Collect en.json leaf paths (anything that is not a plain object is a leaf).
function collectLeaves(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) collectLeaves(v, path, out);
    else out.push(path);
  }
  return out;
}

function buildIsUsed(acc) {
  const prefixes = acc.protectedPrefixes;
  const unknown = [...acc.unknownNsLiterals];
  return (leaf) => {
    if (acc.exactUsed.has(leaf) || acc.corpus.has(leaf)) return true;
    // ancestor-prefix check: leaf 'a.b.c' is protected if 'a', 'a.b', or
    // 'a.b.c' is a protected subtree root.
    let idx = -1;
    // exact leaf as a prefix
    if (prefixes.has(leaf)) return true;
    while ((idx = leaf.indexOf('.', idx + 1)) !== -1) {
      if (prefixes.has(leaf.slice(0, idx))) return true;
    }
    if (unknown.length) {
      for (const u of unknown) {
        if (leaf === u || leaf.endsWith('.' + u)) return true;
      }
    }
    return false;
  };
}

// --- deletion helpers (apply mode) ---

function deletePath(obj, segs) {
  if (segs.length === 0) return;
  const [head, ...rest] = segs;
  if (!(head in obj)) return;
  if (rest.length === 0) { delete obj[head]; return; }
  const child = obj[head];
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    deletePath(child, rest);
    if (Object.keys(child).length === 0) delete obj[head];
  }
}

function pruneLocale(file, unusedPaths) {
  let obj;
  try { obj = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    return { file: rel(file), error: e.message, removed: 0 };
  }
  const before = JSON.stringify(obj);
  let removed = 0;
  for (const p of unusedPaths) {
    const segs = p.split('.');
    const existed = pathExists(obj, segs);
    deletePath(obj, segs);
    if (existed) removed++;
  }
  if (JSON.stringify(obj) !== before) {
    writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  }
  return { file: rel(file), removed };
}

function pathExists(obj, segs) {
  let cur = obj;
  for (const s of segs) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur) && s in cur) cur = cur[s];
    else return false;
  }
  return true;
}

// --- main ---

const parser = loadParser();
const acc = {
  exactUsed: new Set(),
  protectedPrefixes: new Set(),
  unknownNsLiterals: new Set(),
  corpus: new Set(),
  blindSpots: [],
  parseErrors: [],
};

const files = listSourceFiles(controlRoot, []);
for (const f of files) analyzeFile(f, parser, acc);

let en;
try { en = JSON.parse(readFileSync(enPath, 'utf8')); } catch (e) {
  console.error(`failed to parse en.json: ${e.message}`);
  process.exit(1);
}

const leaves = collectLeaves(en, '', []);
const isUsed = buildIsUsed(acc);
const unused = leaves.filter((l) => !isUsed(l)).sort();

// De-dup blind spots by file:line:translator:kind for a tidy report.
const blindSeen = new Set();
const blindSpots = acc.blindSpots.filter((b) => {
  const k = `${b.file}:${b.line}:${b.translator}:${b.kind}`;
  if (blindSeen.has(k)) return false;
  blindSeen.add(k);
  return true;
}).sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line));

const report = {
  scope: 'control/**',
  scannedFiles: files.length,
  totalLeaves: leaves.length,
  exactUsedCount: acc.exactUsed.size,
  protectedPrefixCount: acc.protectedPrefixes.size,
  unusedCount: unused.length,
  unused,
  protectedPrefixes: [...acc.protectedPrefixes].sort(),
  blindSpots,
  parseErrors: acc.parseErrors,
};

if (!APPLY) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exit(0);
}

// --- apply: delete unused leaves from en.json ONLY ---
// The other locale files are deliberately left untouched. The operator runs
// /sync-locales afterward; its `removed` path detects these en.json deletions
// and propagates them across every locale in one sweep.
if (unused.length === 0) {
  process.stdout.write(JSON.stringify({ ...report, applied: false, note: 'nothing to delete' }, null, 2) + '\n');
  process.exit(0);
}

const enResult = pruneLocale(enPath, unused);

process.stdout.write(JSON.stringify({
  applied: true,
  target: 'messages/en.json',
  deletedLeaves: unused.length,
  enRemoved: enResult.removed,
  nextStep: 'run /sync-locales to propagate these removals to the other locale files',
}, null, 2) + '\n');
