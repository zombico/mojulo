// A backdrop saved on a game: the world's reader takes it, the "What game it is" chapter owns it, the review part
// carries it, each chapter reads its own slice, and the game book shows it. A world without one is as it was.
import { describe, it, expect } from 'vitest';
import { readGameworld, GAMEWORLD_KEYS } from '../gameworld/world.js';
import { chaptersOfPath } from '../gameworld/chapters.js';
import { chapterView } from '../gameworld/chapter-view.js';
import { reviewParts, MEADOWMARK } from '../gameworld/index.js';
import { backdropHtml } from '../gameworld/bible-html.js';
import { newBackdrop, intensifyBackdrop } from './backdrop.js';

const premise = {
  title: 'The Drowned Valley',
  actors: [{ id: 'millers', name: 'the millers', kind: 'people' }, { id: 'river', name: 'the river', kind: 'force' }],
  events: [{ n: 1, says: 'The river floods the low fields', who: ['river'] }, { n: 2, says: 'The millers dam it <above> the valley', who: ['millers'] }],
};
const backdrop = [
  { stretches: [{ id: 's1', handle: 'the flood and the dam', agency: 'acted' }], events: { 1: { stretch: 's1' }, 2: { stretch: 's1', from: [1] } } },
  { places: [{ id: 'lake', name: 'the lake', state: 'the valley, under water' }], events: { 2: { at: ['lake'] } } },
  { wants: [{ who: 'millers', wants: 'the dam kept', basis: 'inferred', because: 'they built it' }], conflicts: [{ id: 'the-water', between: ['millers', 'river'], over: 'the floods', state: 'open', basis: 'stated' }], threads: [], unknowns: ['who owns the dam'] },
  { play: { begins: { after: 2 }, pov: { who: 'a ferryman' }, basis: 'stated' } },
].reduce((B, add) => intensifyBackdrop(B, add).backdrop, newBackdrop(premise));
const world = { ...MEADOWMARK, backdrop };

describe('a backdrop on a gameworld', () => {
  it('is a key of the recipe, owned by the chapter that says what game it is', () => {
    expect(GAMEWORLD_KEYS).toContain('backdrop');
    expect(chaptersOfPath('/backdrop').map((c) => c.id)).toEqual(['intent']);
  });

  it('the world\'s reader takes one, and refuses a malformed one in the backdrop\'s own words', () => {
    expect(() => readGameworld(world)).not.toThrow();
    expect(() => readGameworld({ ...MEADOWMARK, backdrop: { actors: [], events: [] } })).toThrow(/^gameworld: backdrop\.events is a list/);
    expect(() => readGameworld({ ...MEADOWMARK, backdrop: { ...backdrop, play: { basis: 'inferred' } } })).toThrow(/the author's to give, never the tool's to infer/);
  });

  it('a world without one reads as it did: the same world, the same parts', () => {
    expect(readGameworld({ ...MEADOWMARK, backdrop: null })).toEqual(readGameworld(MEADOWMARK));
    expect(reviewParts({ ...MEADOWMARK, backdrop: null })).toEqual(reviewParts(MEADOWMARK));
  });

  it('the intent part carries it, so the creator accepts the extraction and a change sends it back', () => {
    const part = reviewParts(world).find((p) => p.id === 'intent');
    expect(part.content.backdrop).toEqual(backdrop);
    const moved = reviewParts({ ...world, backdrop: { ...backdrop, unknowns: [] } }).find((p) => p.id === 'intent');
    expect(moved.content).not.toEqual(part.content);
  });

  it('each chapter\'s view carries its own slice, and a chapter with none carries nothing', () => {
    const view = (id) => chapterView({ parts: [], chapters: [] }, world, id);
    expect(view('story').backdrop.before_play.map((e) => e.n)).toEqual([1, 2]);
    expect(view('world').backdrop.places[0]).toMatchObject({ id: 'lake', made_by: [2] });
    expect(view('cast').backdrop.people.map((p) => p.id)).toEqual(['millers']);
    expect(view('intent').backdrop.play.pov).toEqual({ who: 'a ferryman' });
    expect(view('intent').pages['/backdrop']).toEqual(backdrop);
    expect(view('feel')).not.toHaveProperty('backdrop');
    expect(chapterView({ parts: [], chapters: [] }, MEADOWMARK, 'story')).not.toHaveProperty('backdrop');
  });

  it('the game book shows it: the events in order, what is open and unsaid, a reading marked as the tool\'s; escaped', () => {
    const html = backdropHtml(world);
    expect(html).toContain('The backdrop: The Drowned Valley');
    expect(html).toContain('The millers dam it &lt;above&gt; the valley');
    expect(html).toContain('play begins after this');
    expect(html).toContain('Seen through a ferryman');
    expect(html).toMatch(/the dam kept <span class="muted">\(inferred: they built it\)/);
    expect(html).toContain('Not said by the text');
    expect(html).toContain('<b>Open</b> the millers and the river, over the floods');
    expect(backdropHtml(MEADOWMARK)).toBe('');
  });
});
