// The script book: every spoken line by its id, level by level in the game's order, its speaker named and its moment in
// words; the page carries the same as data for whoever voices the game.
import { describe, expect, it } from 'vitest';
import { gameScript, scriptBookHtml, momentWords } from './script-book.js';

const level = (script, extra = {}) => ({ goal: { operation: { tasks: [{}, {}, {}], script, ...extra } } });
const G = {
  name: 'Test Game',
  ids: ['two', 'one', 'quiet'],
  levels: {
    one: level({ speakers: { cole: { name: 'Cole' } }, lines: [{ id: 'l1-start', who: 'cole', text: 'Eyes up, rookie.', on: 'start' }, { id: 'l1-wing', who: 'mara', text: 'On your left.', on: { done: 2 }, after: 3 }] }, { allies: [{ id: 'mara', name: 'Mara' }] }),
    two: { name: 'The Tow', ...level({ lines: [{ id: 'l2-a', who: 'tow-boss', text: 'Cables <taut>.', on: 'win' }] }) },
    quiet: { goal: { operation: { tasks: [] } } },
  },
};

describe('the script book', () => {
  it('reads every level with a script in the game\'s order, its speakers named (an ally by its name)', () => {
    const S = gameScript(G);
    expect(S.levels.map((l) => l.id)).toEqual(['two', 'one']);
    expect(S.levels[1].lines.map((l) => [l.id, l.name, l.when])).toEqual([['l1-start', 'Cole', 'as the level begins'], ['l1-wing', 'Mara', '3 s after, as task 2 is met']]);
    expect(S.levels[0].lines[0].name).toBe('Tow Boss');
    expect(S.levels[0].name).toBe('The Tow');
  });

  it('the page lists each line by id and holds the same as data, escaped', () => {
    const html = scriptBookHtml(G);
    expect(html).toContain('3 lines over 2 levels');
    expect(html).toContain('Cables &lt;taut&gt;.');
    const json = html.match(/<script type="application\/json" id="script.json">([\s\S]*?)<\/script>/)[1];
    expect(json).not.toContain('<taut');
    expect(JSON.parse(json)).toEqual(gameScript(G));
  });

  it('a moment reads as words; a game with no script says where one is written', () => {
    expect(momentWords({ found: 4 })).toBe('as task 4\'s scan finds');
    expect(momentWords({ down: 'drone-2' }, 1.5)).toBe('1.5 s after, as drone-2 goes down');
    expect(scriptBookHtml({ levels: {} })).toContain('goal.operation.script');
  });
});
