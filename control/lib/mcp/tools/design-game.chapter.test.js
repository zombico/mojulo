// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';
import { CHAPTERS, chapterOfPart } from '@/lib/graph/gameworld/chapters.js';
import { MOVE_STEPS, chapterOfMove, chapterPages } from '@/lib/graph/gameworld/chapter-view.js';
import { gameworldCards } from '@/lib/graph/gameworld/gameworld-cards.js';

// One chapter's readout (design_game { ref, chapter }): the whole readout projected onto the chapter a department
// works, so a session (or a subagent) holds its chapter, a digest of what is upstream and one line of the book. These
// write recipes and read them; nothing is made (a run is the e2e tier's).

const GATED = { ...MEADOWMARK_HERO, mode: 'gated' };
const bytes = (o) => Buffer.byteLength(JSON.stringify(o));

describe('design_game: one chapter', () => {
  beforeEach(() => { closeDb(); });

  it('refuses a chapter the book does not have, before it writes anything', async () => {
    await expect(designGameHandler({ world: GATED, ref: 'gw-nope', chapter: 'lighting' })).rejects.toThrow(/chapter is one of intent, world, levels/);
    expect(SketchRepository.getByRef('gw-nope')).toBeFalsy();
  });

  it('the hero\'s chapter: its own parts, pages, upstream digest, next moves and the book in a line', async () => {
    const full = await designGameHandler({ world: GATED, ref: 'gw' });
    const out = await designGameHandler({ ref: 'gw', chapter: 'hero' });
    expect(out).toMatchObject({ ok: true, readout: 'chapter', ref: 'gw', chapter: { id: 'hero', department: 'characters', state: 'open', waits: ['direction'], cards: ['gameworld-looks'] } });
    // its parts only, as the whole readout stamps them
    expect(out.parts.map((p) => p.id)).toEqual(full.parts.filter((p) => chapterOfPart(p.id)?.id === 'hero').map((p) => p.id));
    expect(out.parts.find((p) => p.id === 'hero:base')).toEqual(full.parts.find((p) => p.id === 'hero:base'));
    // its pages: the hero's page, the motion's, actions' and adornment's left to their chapters
    expect(Object.keys(out.pages)).toEqual(['/characters/hero']);
    for (const k of ['motion', 'actions', 'adornment']) expect(out.pages['/characters/hero'][k]).toBeUndefined();
    expect(out.pages['/characters/hero'].looks).toEqual(GATED.characters.hero.looks);
    // upstream as a digest: the direction's state and the print of its pages, not the pages
    expect(out.reads).toEqual([{ id: 'direction', state: 'open', print: expect.stringMatching(/^[0-9a-f]{8}$/) }]);
    // its next moves: the review of its own parts only
    expect(out.next.find((n) => n.step === 'review').parts.every((p) => chapterOfPart(p).id === 'hero')).toBe(true);
    // where it is drawn, and the book one word a chapter
    expect(out.read).toBe('/api/sketches/gw/bible?book=characters#hero-body');
    expect(out.book).toEqual(Object.fromEntries(full.chapters.map((c) => [c.id, c.state])));
  });

  it('every part of the book is in exactly one chapter\'s view; each view is a fraction of the whole', async () => {
    const full = await designGameHandler({ world: GATED, ref: 'gw' });
    const seen = [];
    for (const c of full.chapters) {
      const v = await designGameHandler({ ref: 'gw', chapter: c.id });
      seen.push(...v.parts.map((p) => p.id));
      // the view without its pages (the recipe the department edits, as large as it writes) stays small
      const { pages: _p, ...rest } = v;
      expect(bytes(rest), c.id).toBeLessThan(2500);
      expect(bytes(v), c.id).toBeLessThan(bytes(full));
    }
    expect(seen.sort()).toEqual(full.parts.map((p) => p.id).sort());
  });

  it('a write past the chapter is said, never refused; an upstream write moves its print', async () => {
    await designGameHandler({ world: GATED, ref: 'gw' });
    const before = await designGameHandler({ ref: 'gw', chapter: 'hero' });
    // the hero's own page: nothing said
    const own = await designGameHandler({ ref: 'gw', chapter: 'hero', patch: [{ op: 'set', path: '/characters/hero/looks/hair', value: GATED.characters.hero.looks.hair }] });
    expect(own.outside).toBeUndefined();
    // the motion's page, written from the hero's chapter: written, and said whose it is
    const past = await designGameHandler({ ref: 'gw', chapter: 'hero', patch: [{ op: 'set', path: '/characters/hero/motion', value: GATED.characters.hero.motion ?? { vibe: ['bouncy'] } }] });
    expect(past.outside).toEqual(["/characters/hero/motion: motion's, not hero's"]);
    // the direction changed: the hero reads that its upstream moved
    const D = GATED.characters.direction;
    await designGameHandler({ ref: 'gw', patch: [{ op: 'set', path: '/characters/direction', value: { ...D, motif: ['tide'] } }] });
    const after = await designGameHandler({ ref: 'gw', chapter: 'hero' });
    expect(after.reads[0].print).not.toBe(before.reads[0].print);
  });

  it('every next move the door says belongs to a chapter, or is split among its parts', () => {
    // the step ids the gameworld-next card documents (its two-space indented lines), all but the chapters note
    const card = gameworldCards().get('gameworld-next').body;
    const ids = [...card.matchAll(/^ {2}([a-z]+) {2,}/gm)].map((m) => m[1]).filter((x) => x !== 'chapters');
    expect(ids.length).toBeGreaterThan(8);
    for (const id of ids) expect(MOVE_STEPS, id).toContain(id);
    for (const id of MOVE_STEPS.filter((x) => !['wait', 'form', 'review', 'advised'].includes(x))) expect(chapterOfMove({ step: id }), id).not.toBeNull();
    expect(chapterOfMove({ step: 'wait', on: 'systems' }).id).toBe('systems');
  });

  it('a chapter\'s pages leave a deeper chapter\'s keys to it, and an unwritten chapter has none', () => {
    expect(Object.keys(chapterPages(GATED, 'motion'))).toEqual(GATED.characters.hero.motion ? ['/characters/hero/motion'] : []);
    expect(chapterPages(GATED, 'story')).toEqual({});
    for (const c of CHAPTERS) expect(typeof chapterPages(GATED, c.id), c.id).toBe('object');
  });
});
