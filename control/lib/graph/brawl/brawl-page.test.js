import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brawlPageSource, brawlSource, brawlYardData, exportsOf, BRAWL_PAGE_MODULES, BRAWL_VERSUS_MODULES, BRAWL_ROSTER } from './brawl-page.js';
import { brawlLevel } from './brawl-levels.js';
import { brawlChannelScript } from '../scene/channels/brawl.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { ARCHETYPES } from '../versus/versus-solver.js';

// THE BRAWL PAGE: the fight's modules, the controls, the brawl's own each in a scope of its own, the yard's client. It
// parses as one block; no brawl export takes a name the fight's modules already declare; absent, a page carries none.
const HERE = dirname(fileURLToPath(import.meta.url));
const topNames = (src) => [...src.matchAll(/^(?:export )?(?:async )?(?:function\*?|const|let|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

describe('brawl page: its source', () => {
  it('parses as one block', () => {
    expect(() => new Function(`{${brawlPageSource()}\n}`)).not.toThrow();
  });
  it('the brawl\'s exports never take a name the fight\'s modules declare, nor one another\'s', () => {
    const fight = new Set(BRAWL_VERSUS_MODULES.flatMap((f) => topNames(readFileSync(join(HERE, '../versus', f), 'utf8'))));
    const mine = BRAWL_PAGE_MODULES.flatMap((f) => exportsOf(readFileSync(join(HERE, f), 'utf8')));
    expect(mine.filter((n) => fight.has(n))).toEqual([]);
    expect(mine.length).toBe(new Set(mine).size);
  });
  it('a brawl module reaches the page by its exports alone', () => {
    const src = brawlSource('brawl-core.js');
    expect(src).toMatch(/^\/\/ ── brawl-core\.js ──\nconst \{ [^}]*newBrawl[^}]*\} = \(\(\) => \{/);
    expect(src).not.toMatch(/^import /m);
    expect(src).not.toMatch(/^export /m);
  });
});

describe('brawl page: the yard\'s data and the channel', () => {
  const world = brawlLevel({ kind: 'greybox', preset: 'yard' }, { practice: { dummies: [{ mode: 'walk' }] } });
  it('the yard reads its belt, a fighter of each archetype, the dummies and its screen', () => {
    const D = brawlYardData(world.brawl);
    expect(D.belt).toEqual(world.brawl.belt);
    expect(BRAWL_ROSTER.map((r) => r.id)).toEqual(Object.keys(ARCHETYPES));
    expect(D.dummies).toEqual([{ mode: 'walk' }]);
    expect(Object.keys(D.yard.spec.screens)).toEqual(['moves', 'settings']);
  });
  it('a page with no brawl carries none of it; one with a brawl hands the page its step', () => {
    const none = emitThreeWorld({ faces: [], inline: false });
    expect(none).not.toContain('BRAWL_YARD');
    expect(none).not.toContain('stepBrawl');
    const script = brawlChannelScript(brawlYardData(world.brawl));
    expect(script).toContain('stepBrawlPage = stepBrawlYard;');
  });
});
