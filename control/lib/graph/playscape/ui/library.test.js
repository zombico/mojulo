import { describe, it, expect } from 'vitest';
import { readLibrary, libraryFlags, libraryProgram, libraryView, libraryNews, LIBRARY_KEYS, LIBRARY_MAX } from './library.js';
import { sceneFlags } from './scenes.js';
import { LIBRARY_CSS, libraryScript } from '../../scene/channels/library-channel.js';
import { eventsChannelScript as eventsScript } from '../../scene/channels/events.js';
import { emitThreeWorld } from '../../scene/scene-three.js';

const BOOK = { kind: 'manual', title: 'A Handbook', chapters: [{ blocks: [{ p: 'One thing, done well.' }] }] };
const PLAY = { library: [{ id: 'handbook', book: BOOK }, { id: 'ledger', book: { ...BOOK, kind: 'notebook', title: 'A Ledger' }, found: 'found-ledger' }] };

describe('a level\'s library', () => {
  it('is read as written; what is not a shelf\'s book is refused by name', () => {
    expect(readLibrary({})).toEqual([]);
    expect(readLibrary(PLAY).map((e) => [e.id, e.found])).toEqual([['handbook', undefined], ['ledger', 'found-ledger']]);
    const bad = (library, re) => expect(() => readLibrary({ library })).toThrow(re);
    bad({}, /is a list of up to/);
    bad(Array.from({ length: LIBRARY_MAX + 1 }, (_, i) => ({ id: `b${i}`, book: BOOK })), /up to 8/);
    bad([{ id: 'Handbook', book: BOOK }], /lowercase id/);
    bad([{ id: 'a', book: BOOK }, { id: 'a', book: BOOK }], /appears twice/);
    bad([{ id: 'a', book: BOOK, shelf: 2 }], /shelf is not part of a shelf's book \(id, book, found\)/);
    bad([{ id: 'a', book: BOOK, found: 'Found It' }], /found is the flag/);
    bad([{ id: 'a', book: { ...BOOK, kind: 'novel' } }], /play\.library\[0\]\.book: kind is one of/);
    expect(Object.keys(LIBRARY_KEYS)).toEqual(['id', 'book', 'found']);
  });

  it('its flags are the level\'s: a book found on one is a flag the scenes keep', () => {
    expect(libraryFlags(PLAY)).toEqual(['found-ledger']);
    expect(sceneFlags(PLAY)).toContain('found-ledger');
  });

  it('the page carries each book as its reader, and holds what the flags have put on the shelf', () => {
    const program = libraryProgram(PLAY);
    expect(program.map((b) => [b.id, b.title, b.kind, b.found])).toEqual([['handbook', 'A Handbook', 'manual', undefined], ['ledger', 'A Ledger', 'notebook', 'found-ledger']]);
    for (const b of program) { expect(b.page.startsWith('<!doctype html>')).toBe(true); expect(b.page).toContain('window.__mojReader'); }
    expect(libraryView(program, {}).map((b) => b.id)).toEqual(['handbook']);
    expect(libraryView(program, { 'flag-found-ledger': true }).map((b) => b.id)).toEqual(['handbook', 'ledger']);
    expect(libraryView(program, {})[0]).toEqual({ id: 'handbook', title: 'A Handbook', kind: 'manual', cover: false });
    // a book with a front brings it to the shelf, its ids its own
    const fronted = libraryProgram({ library: [{ id: 'tome', book: { ...BOOK, cover: { props: ['tome'] } } }] });
    expect(fronted[0].cover).toMatch(/^<svg /);
    expect(fronted[0].cover).toMatch(/id="cv-tome-f1"/);
    expect(libraryView(fronted, {})[0].cover).toBe(true);
    expect(program[0]).not.toHaveProperty('cover');
    expect(libraryNews(program, ['other', 'found-ledger'])).toEqual([{ title: 'A Ledger' }]);
    expect(libraryNews(program, [])).toEqual([]);
  });
});

describe('the library channel', () => {
  it('opens on L, reads a book in a frame of its own, and holds the world as a menu does', () => {
    const src = libraryScript();
    expect(src).toContain("ev.code === 'KeyL'");
    expect(src).toContain("setAttribute('sandbox', 'allow-scripts')");
    expect(src).toContain('window.__mojFreeze = open');
    expect(src).toContain('window.__mojLibrary');
    expect(LIBRARY_CSS).toContain('.moj-lib-book');
    expect(LIBRARY_CSS).toContain('.moj-lib-book.has-cover');
    expect(src).toContain("e.classList.add('has-cover')");
  });

  it('rides the events channel only when the events carry a library: absent, not a byte', () => {
    const base = { vars: { score: 0 }, reactions: [] };
    const without = eventsScript(base), withLib = eventsScript({ ...base, library: libraryProgram(PLAY) });
    expect(without).not.toContain('moj-lib');
    expect(without).not.toContain('__stepLibrary');
    expect(withLib).toContain('__stepLibrary(dtSec);');
    expect(withLib).toContain('window.__mojLibrary');
    expect(eventsScript({ ...base, library: [] })).not.toContain('__stepLibrary');
  });

  it('a library alone is a channel: a level with no rule of its own still gets its shelf', () => {
    const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#888888' };
    const page = emitThreeWorld({ faces: [face], events: { library: libraryProgram(PLAY) } });
    expect(page).toContain('window.__mojLibrary');
    expect(emitThreeWorld({ faces: [face], events: {} })).not.toContain('__mojLibrary');
  });
});
