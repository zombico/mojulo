// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { page, esc, NAV } from './html.js';
import { games, gameOf, levels, characters, objects, printOf } from './data.js';
import { still, gates, eyes, stampEyes, stillNow, recordStill } from './verify.js';
import { gamesPage, gamePage, levelPage, levelsPage, charactersPage, objectsPage } from './pages.js';

// THE GAME VIEW (lib/view/): games first, then levels, characters, objects; on every level its machine gates and the
// person's eyes, never conflated. The concept on the smallest store: one designed game, its level, a hero, an object;
// the still check on one level a player loses (or wins) before a press and one that waits for them.

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-view-'));
process.env.MOJULO_DATA_DIR = DIR;
afterAll(() => fs.rmSync(DIR, { recursive: true, force: true }));
beforeEach(() => { closeDb(); for (const f of fs.readdirSync(DIR)) fs.rmSync(path.join(DIR, f)); });

const level = (mechanics) => ({
  kind: 'controllable',
  entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 2] } }],
  camera: { rule: 'follow', target: 'hero' },
  game: { levelRef: 'lv', mechanics },
});
// a level whose exit is under the hero's feet (won before a press) and one whose exit is down the way (waits)
const AT_SPAWN = level([{ kind: 'reach-exit', at: [0, 0, 0], radius: 3 }]);
const DOWN_THE_WAY = level([{ kind: 'reach-exit', at: [40, 0, 0], radius: 2 }]);

function store() {
  SketchRepository.create({ ref: 'lv-a', title: 'The yard', manifest: DOWN_THE_WAY });
  SketchRepository.create({ ref: 'lv-b', title: 'The gate', manifest: AT_SPAWN });
  SketchRepository.create({ ref: 'hero-1', title: 'Wren', manifest: { kind: 'layered', hero: { name: 'Wren' } } });
  SketchRepository.create({ ref: 'g-game', title: 'Keep', manifest: { kind: 'game', title: 'Keep', store: { slices: [] }, levels: [{ ref: 'lv-a' }, { ref: 'lv-b' }], shell: 'play' } });
  SketchRepository.create({ ref: 'g', title: 'Keep', manifest: { kind: 'gameworld', id: 'keep', name: 'Keep', made: { hero: { ref: 'hero-1' }, 'level-keep-0': { ref: 'lv-a', frame: { status: 'pass' } }, 'level-keep-1': { ref: 'lv-b', frame: { status: 'pass' } }, game: { ref: 'g-game' } } } });
  SketchRepository.create({ ref: 'box', title: 'A crate', manifest: { kind: 'workbench', extrudes: [] } });
}

describe('the page and its order', () => {
  it('games come first, then levels, characters and everything else; text is escaped', () => {
    expect(NAV.map(([id]) => id)).toEqual(['games', 'levels', 'characters', 'objects']);
    const html = page({ title: '<x>', active: 'games', body: esc('<b>&') });
    expect(html).toContain('&lt;x&gt;');
    expect(html).toContain('&lt;b&gt;&amp;');
    expect(html.indexOf('>Games<')).toBeLessThan(html.indexOf('>Objects<'));
  });
});

describe('the store as the view reads it', () => {
  it('a designed game owns its game and its levels; a character lists the games it is in; the rest is objects', () => {
    store();
    const G = games();
    expect(G.map((g) => g.ref)).toEqual(['g']);   // the game it made is not a game of its own
    expect(G[0].levels).toEqual(['lv-a', 'lv-b']);
    expect(gameOf('g').characters).toEqual(['hero-1']);
    expect(levels().map((l) => [l.ref, l.of])).toEqual(expect.arrayContaining([['lv-a', 'g'], ['lv-b', 'g']]));
    expect(characters().find((c) => c.ref === 'hero-1').games).toEqual(['g']);
    expect(objects().map((o) => o.ref)).toEqual(['box']);
  });
});

describe('the still check', () => {
  it('a level that ends before any press fails, with the event and its second; one that waits passes', async () => {
    const lost = await still({ ref: 'lv-b', manifest: AT_SPAWN });
    expect(lost.status).toBe('fail');
    expect(lost.ended).toMatchObject({ event: 'goal:reached', end: 'success' });
    expect(lost.ended.at).toBeLessThan(1);
    const waits = await still({ ref: 'lv-a', manifest: DOWN_THE_WAY });
    expect(waits.status).toBe('pass');
    expect(waits.ends).toEqual([{ event: 'goal:reached', end: 'success' }]);
    expect((await still({ ref: 'x', manifest: { kind: 'controllable', entities: [] } })).status).toBe('skip');
  }, 180_000);

  it('its record is kept against the level as stored: a changed level is unread', () => {
    const r = { ref: 'lv-a', manifest: DOWN_THE_WAY };
    recordStill(r, { status: 'pass', seconds: 3, why: 'stood still' });
    expect(stillNow(r).status).toBe('pass');
    expect(stillNow({ ...r, manifest: { ...DOWN_THE_WAY, seed: 2 } })).toBeNull();
  });
});

describe('the gates, apart', () => {
  it('machine gates and the eyes are never one: the eyes are open until the person stamps, stale once the level changes', () => {
    const r = { ref: 'lv-a', manifest: DOWN_THE_WAY };
    const G = gates({ ref: 'lv-a', frame: { status: 'pass' } }, r, { still: { status: 'fail', why: 'spotted at 0.07 s' } });
    expect(G.map((g) => [g.id, g.kind, g.status])).toEqual([['walk', 'machine', 'skip'], ['first frame', 'machine', 'pass'], ['still', 'machine', 'fail'], ['eyes', 'eyes', 'open']]);
    stampEyes(r, { verdict: 'it is the game', note: 'tense' });
    expect(eyes(r)).toMatchObject({ verdict: 'it is the game', note: 'tense', print: printOf(r) });
    expect(gates({}, r).at(-1)).toMatchObject({ status: 'pass' });
    const changed = { ...r, manifest: { ...DOWN_THE_WAY, seed: 9 } };
    expect(gates({}, changed).at(-1)).toMatchObject({ status: 'open' });
    expect(() => stampEyes(r, { verdict: 'great' })).toThrow(/verdict is one of/);
  });
});

describe('the pages', () => {
  it('each page renders from its data, a failing gate said beside its level', () => {
    store();
    expect(gamesPage(games())).toContain('/games/g');
    const G = gameOf('g');
    const rows = { 'lv-a': { title: 'The yard', gates: gates(G.levels[0], { ref: 'lv-a', manifest: DOWN_THE_WAY }, { still: { status: 'fail', why: 'spotted at 0.07 s' } }) }, 'hero-1': { title: 'Wren' } };
    const html = gamePage({ G, rows });
    expect(html).toContain('still: fail');
    expect(html).toContain('spotted at 0.07 s');
    expect(html).toContain('Wren');
    const lp = levelPage({ r: { ref: 'lv-a', title: 'The yard', manifest: DOWN_THE_WAY }, of: 'g', gates: rows['lv-a'].gates, ends: [{ event: 'goal:reached', end: 'success' }] });
    expect(lp).toContain('/play/lv-a');
    expect(lp).toContain('action="/levels/lv-a/eyes"');
    expect(levelsPage(levels())).toContain('/levels/lv-b');
    expect(charactersPage(characters())).toContain('Wren');
    expect(objectsPage(objects())).toContain('A crate');
    expect(gamesPage([])).toContain('No games yet');
  });
});
