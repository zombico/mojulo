import { describe, it, expect } from 'vitest';
import { talkHeadOf, linePerform, talkLines, withTalkTakes, TALK_LEAD } from './talk-lines.js';
import { perform } from '../../face-acting/perform.js';

// Talk lines: a plain line said by a hero with a talking face becomes a face take on its own clock. One case per rule:
// which heads talk, what a line performs, who gets a take, a script's line keeping its own, the program left alone
// when nobody talks.

const manifest = {
  figures: { mayor: { hero: { cast: 'male', form: 'realistic', head: 'relational' } }, ani: { hero: { cast: 'female', head: 'anime' } }, plain: { hero: { cast: 'male' } } },
  entities: [
    { id: 'hero', pilotable: true, body: { type: 'figure-rig', figure: 'ani' } },
    { id: 'mayor', body: { type: 'figure-rig', figure: 'mayor' } },
    { id: 'guard', body: { type: 'figure-rig', figure: 'plain' } },
  ],
};
const program = [{ id: 'gate', once: true, beats: [
  { kind: 'line', who: 'mayor', name: 'Mayor', text: 'The road is shut.', expression: 'worried' },
  { kind: 'line', who: 'guard', name: 'Guard', text: 'Shut tight.' },
  { kind: 'line', who: 'hero', name: 'Hero', text: 'Since when?' },
  { kind: 'line', who: 'mayor', name: 'Mayor', text: '[Mayor: line 2]' },
  { kind: 'line', who: 'mayor', name: 'Mayor', text: 'Since spring.', take: { at: 0, end: 1, clip: 'scene:gate:0', of: 1 } },
] }];

describe('talk lines: a line said by whoever speaks it', () => {
  it('the heads that talk on the page: the realistic face, the anime face drawn, the landmark face and its jaw', () => {
    expect(talkHeadOf({ head: 'relational', form: 'realistic' })).toBe('relational');
    expect(talkHeadOf({ head: 'anime' })).toBe('anime');
    expect(talkHeadOf({ head: 'anime', painterly: true })).toBe(null);
    expect(talkHeadOf({ cast: 'male' })).toBe('landmark');
    expect(talkHeadOf({ cast: 'male', head: 'helm' })).toBe(null);
    expect(talkHeadOf(null)).toBe(null);
  });

  it('a line performs its words lip-synced, under its expression, a breath in and a hold after', () => {
    const P = linePerform({ text: 'The road is shut.', expression: 'smiling' });
    expect(P.beats).toEqual([{ at: TALK_LEAD, say: 'The road is shut.', face: 'happiness' }]);
    expect(P.seconds).toBeGreaterThan(TALK_LEAD + 0.5);
    expect(linePerform({ text: 'Hm.', expression: 'flustered-ish' }).beats[0].face).toBeUndefined();
    expect(linePerform({ text: '[Mayor: line 1]' })).toBe(null);
    // a performance the face reads: the jaw opens while the words are said
    const take = perform(P);
    expect(Math.max(...take.curves.AU26)).toBeGreaterThan(0.1);
  });

  it('a take for each line a talking head says, its clip on its figure; a slot and a script\'s line keep theirs', () => {
    const T = talkLines(manifest, program);
    expect(T.takes.map((t) => [t.beat, t.figure, t.clip])).toEqual([[0, 'mayor', 'talk:gate:0'], [1, 'plain', 'talk:gate:1'], [2, 'ani', 'talk:gate:2']]);
    expect(Object.keys(T.byFigure)).toEqual(['mayor', 'plain', 'ani']);
    const P = withTalkTakes(program, T.takes);
    expect(P[0].beats[0].take).toEqual({ at: 0, end: T.takes[0].seconds, clip: 'talk:gate:0', of: T.takes[0].seconds });
    expect(P[0].beats[3].take).toBeUndefined();
    expect(P[0].beats[4].take.clip).toBe('scene:gate:0');
    expect(withTalkTakes(program, [])).toBe(program);
  });
});
