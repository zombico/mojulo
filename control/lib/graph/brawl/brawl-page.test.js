import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brawlPageSource, brawlSource, brawlYardData, exportsOf, BRAWL_PAGE_MODULES, BRAWL_VERSUS_MODULES, BRAWL_ROSTER, BRAWL_ARMED_ROSTER } from './brawl-page.js';
import { WEAPONS } from '../versus/versus-library.js';
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

describe('brawl page: characters in the yard', () => {
  // (a roster as it reaches here: a character measured from the store, as resolveCharacters leaves it, and an intent)
  const measured = { id: 'wolf', name: 'Wolf', archetype: 'grappler', body: { height: 1850 }, character: 'sk_wolf', color: '#b8452e' };
  const world = brawlLevel({ kind: 'greybox', preset: 'yard' }, { practice: { roster: [measured, { id: 'kai', archetype: 'rushdown' }], players: [1], dummies: [{ mode: 'swing', fighter: 0 }, { mode: 'stand', type: 'heavy' }] } });
  const bodies = { sk_wolf: { bones: [{ id: 'pelvis' }], parts: [null] } };
  const D = brawlYardData(world.brawl, bodies);
  it('the practice\'s roster is who can be played and fought: a character keeps its ref and its style', () => {
    expect(D.roster.map((r) => [r.id, r.style, r.character ?? null])).toEqual([['wolf', 'grappler', 'sk_wolf'], ['kai', 'rushdown', null]]);
    expect(D.players).toEqual([1]);
    expect(D.bodies).toBe(bodies);
  });
  it('a dummy may be anyone on the roster, fought in its own recipe; or one of the street\'s crowd', () => {
    expect(D.dummies[0]).toMatchObject({ mode: 'swing', roster: 0, recipe: D.roster[0].recipe });
    expect(D.dummies[1]).toEqual({ mode: 'stand', type: 'heavy' });
    expect(() => brawlYardData({ ...world.brawl, practice: { ...world.brawl.practice, dummies: [{ fighter: 9 }] } })).toThrow(/roster index/);
  });
});

describe('brawl page: the armed brawler', () => {
  const armed = (practice = {}) => brawlLevel({ kind: 'greybox', preset: 'yard' }, { armed: true, practice });
  it('every hero carries its own weapon: the armed roster by default, one of each archetype, each a weapon of the fight\'s', () => {
    const D = brawlYardData(armed().brawl);
    expect(D.armed).toBe(true);
    expect(D.roster).toBe(BRAWL_ARMED_ROSTER);
    expect(D.roster.every((r) => WEAPONS[r.recipe.weapon])).toBe(true);
    expect(new Set(D.roster.map((r) => r.recipe.weapon)).size).toBe(D.roster.length);
    // (a roster entry's own weapon; one without, or a weapon laid on its street, refused)
    expect(brawlYardData(armed({ roster: [{ id: 'kai', archetype: 'rushdown', weapon: 'spear' }] }).brawl).roster[0].recipe.weapon).toBe('spear');
    expect(() => brawlYardData(armed({ roster: [{ id: 'kai', archetype: 'rushdown' }] }).brawl)).toThrow(/no weapon/);
    expect(() => brawlYardData(armed({ things: [{ kind: 'weapon', what: 'pipe', at: 5, n: 0 }] }).brawl)).toThrow(/keeps its own/);
  });
  it('an unarmed brawl is as it was: no armed word, the plain roster', () => {
    const D = brawlYardData(brawlLevel({ kind: 'greybox', preset: 'yard' }, { practice: {} }).brawl);
    expect(D.armed).toBeUndefined();
    expect(D.roster).toBe(BRAWL_ROSTER);
  });
});
