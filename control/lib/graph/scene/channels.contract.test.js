import { describe, expect, it } from 'vitest';

import { EMIT_FIXTURES } from './emit-fixtures.js';
import { RUNTIME_CHANNELS, SETUP_CHANNELS, rowProvides } from './channels/index.js';
import { emitThreeWorld } from './scene-three.js';

// ── the mechanical half of channels/contract.md (channel-registry-formalization S1) ────
// The emitted blocks share one page lexical scope; before S1 the cross-block couplings
// lived in comments only. This lint turns the census into a standing check:
//   1. every `__`-prefixed symbol REFERENCED by an emitted page is defined in that page,
//      declared as a contract symbol (some row's provides — typeof-guarded probes may
//      reference an absent provider's name), or on the emit-scope allowed list;
//   2. every symbol a row DECLARES as provides actually appears as a definition in at
//      least one fixture page (a claimed provide nobody emits is a stale contract).
// The load-time assertion in channels.js checks declared ordering (requires ⊆ earlier
// provides); this test checks the declarations against the emitted reality. Scope is
// deliberately `__`-prefixed names only — the high-collision cross-block namespace; the
// plain-named registry lets (stepX/walkOn) are emitted unconditionally by the scaffold.

// page globals with `__` names a block may reference without declaring (emit-scope.md)
const EMIT_SCOPE = new Set(['__mojStep', '__mojClock']);

const moduleScript = (page) => {
  const m = page.match(/<script type="module">([\s\S]*)<\/script>/);
  if (!m) throw new Error('no module script in emitted page');
  return m[1];
};

// strip line + block comments so doc mentions of symbols don't count as references
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');

// lexical references only: skip property accesses (`fig.__armIdx`, `window.__mojSim` —
// window-namespaced symbols are covered by the declared-provides check instead) and
// in-string mentions (DOM ids `id="__wepName"`, selectors `'#__rlArc'`).
const referenced = (src) => new Set([...src.matchAll(/(?<![.\w$'"`#])(__[A-Za-z0-9_$]+)/g)].map((m) => m[1]));

const defined = (src) => {
  const out = new Set();
  for (const m of src.matchAll(/\b(?:const|let|var|function)\s+(__[A-Za-z0-9_$]+)/g)) out.add(m[1]);
  for (const m of src.matchAll(/\bwindow\.(__[A-Za-z0-9_$]+)\s*=[^=]/g)) out.add(m[1]);
  for (const m of src.matchAll(/(?:^|[\s;{(,])(__[A-Za-z0-9_$]+)\s*=[^=]/g)) out.add(m[1]);
  // arrow/function params: (…, __x, …) => and function (…, __x)
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)) {
    for (const p of m[1].split(',')) {
      const id = p.trim().match(/^(__[A-Za-z0-9_$]+)$/);
      if (id) out.add(id[1]);
    }
  }
  return out;
};

const catalogProvides = new Set([...RUNTIME_CHANNELS, ...SETUP_CHANNELS].flatMap(rowProvides));

describe('channel contract lint (referenced ⊆ defined ∪ declared ∪ emit-scope)', () => {
  const pages = EMIT_FIXTURES.map(([name, opts]) => [name, stripComments(moduleScript(emitThreeWorld(opts)))]);

  it.each(pages.map(([name]) => name))('%s has no undeclared __symbols', (name) => {
    const src = pages.find(([n]) => n === name)[1];
    const defs = defined(src);
    const dangling = [...referenced(src)]
      .filter((s) => !defs.has(s) && !catalogProvides.has(s) && !EMIT_SCOPE.has(s));
    expect(dangling).toEqual([]);
  });

  it('every declared provide appears as a definition in some fixture page', () => {
    const allDefs = new Set();
    for (const [, src] of pages) for (const d of defined(src)) allDefs.add(d);
    // plain-named provides (walkMode) checked by name-specific pattern across raw pages
    const plainDefined = (name) => pages.some(([, src]) =>
      new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b|[\\s;{(,]${name}\\s*=[^=]`).test(src));
    const missing = [...catalogProvides].filter((p) => (p.startsWith('__') ? !allDefs.has(p) : !plainDefined(p)));
    expect(missing).toEqual([]);
  });
});
