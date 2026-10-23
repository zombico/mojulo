// test:changed's selection (scripts/test-changed.mjs over scripts/test-graph.mjs): what a change picks, and the guard
// that keeps the graph honest: a module that reads files beside it is declared a reader of code (TEXT_READERS: a change
// to what it reads is a change to it) or of data (DATA_READERS), so a new hidden dependency cannot slip past the gate.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONTROL, importGraph, testsReaching } from './test-graph.mjs';
import { selectTests, TEXT_READERS, DATA_READERS } from './test-changed.mjs';

const G = importGraph();

describe('the import graph', () => {
  it('reads control\'s modules and resolves relative and @/ imports', () => {
    expect(G.deps.get('lib/graph/versus/versus-core.js').has('lib/graph/versus/versus-kinds.js')).toBe(true);
    expect(G.deps.get('lib/graph/worlds/world-kinds.js').has('lib/graph/polygonizer/hero-swing.js')).toBe(true);   // an @/ import
  });
  it('reaches a test in as many hops as the shortest chain, no further than asked', () => {
    const T = testsReaching(G, ['lib/graph/versus/versus-kinds.js'], { depth: 1 });
    expect(T.get('lib/graph/versus/versus-kinds.test.js')).toBe(1);
    expect([...T.values()].every((d) => d <= 1)).toBe(true);
    // a start hop moves a file out
    expect(testsReaching(G, new Map([['lib/graph/versus/versus-kinds.js', 1]]), { depth: 1 }).size).toBe(0);
  });
});

describe('what a change picks', () => {
  it('a module: its own tests (and at depth 2 those of its importers), and every byte pin it reaches; a test file itself', () => {
    const m = 'lib/graph/scene/juice-style.js', S = selectTests([m], { graph: G }), hops = testsReaching(G, [m]);
    expect(S.tests).toEqual(expect.arrayContaining(['lib/graph/scene/juice-style.test.js', 'lib/graph/gameworld/juice.test.js']));
    expect(S.tests.filter((t) => !/\.(char|trace)\.test\.js$/.test(t)).every((t) => hops.get(t) <= 1)).toBe(true);
    expect(selectTests([m], { graph: G, depth: 2 }).tests.length).toBeGreaterThan(S.tests.length);
    expect(S.pins).toContain('lib/graph/scene/emit-channels.char.test.js');
    expect(selectTests(['lib/graph/versus/versus.test.js'], { graph: G, depth: 0 }).tests).toEqual(['lib/graph/versus/versus.test.js']);
  });
  it('a source read as text: the reader\'s tests; a config: the critical tier; prose: nothing', () => {
    const S = selectTests(['lib/graph/versus/versus-runtime.client.js'], { graph: G });
    expect(S.why.join(' ')).toMatch(/read as text by lib\/graph\/versus\/versus-page\.js/);
    expect(S.tests).toContain('lib/graph/versus/versus-runtime.test.js');
    expect(selectTests(['vitest.config.js'], { graph: G }).critical).toBe(true);
    const P = selectTests(['CHANGELOG.md', '../docs/plating.md'], { graph: G });
    expect([P.tests.length, P.deep.length, P.critical, P.prose.length]).toEqual([0, 0, false, 2]);
  });
  it('a data file: the tests beside it', () => {
    const dir = 'lib/mcp/routing-cards', card = fs.readdirSync(path.join(CONTROL, dir)).find((f) => !f.endsWith('.js'));
    const S = selectTests([`${dir}/${card}`], { graph: G });
    expect(S.tests.length).toBeGreaterThan(0);
    expect(S.tests.every((t) => path.posix.dirname(t) === dir || /\.(char|trace)\.test\.js$/.test(t))).toBe(true);
  });
});

describe('the guard: every module that reads files beside it is declared', () => {
  const READS = /readFileSync|readdirSync/, BESIDE = /import\.meta\.url|moduleDir|__dirname|CONTROL|process\.cwd\(\)/;
  const readers = [...G.files].filter((f) => /^(lib|app|components)\//.test(f) && !/\.test\.m?js$/.test(f)).filter((f) => { const s = fs.readFileSync(path.join(CONTROL, f), 'utf8'); return READS.test(s) && BESIDE.test(s); });
  const declared = new Set([...TEXT_READERS.flatMap((T) => T.by), ...DATA_READERS]);
  it('as a reader of code (TEXT_READERS) or of data (DATA_READERS)', () => {
    expect(readers.filter((f) => !declared.has(f)), 'a module reading files beside it: declare it in scripts/test-changed.mjs').toEqual([]);
  });
  it('and every declared reader still exists', () => {
    expect([...declared].filter((f) => !fs.existsSync(path.join(CONTROL, f)))).toEqual([]);
  });
});
