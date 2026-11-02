// screen: a persona's read on a screen in a world, the first host (the news broadcast)
import { describe, it, expect } from 'vitest';
import { broadcastErrors, broadcastScreens, SCREEN_SIZE } from './screen.js';
import { readScript } from './read.js';
import { captionCues } from './captions.js';
import { emitThreeWorld } from '../scene/scene-three.js';

const SCRIPT = 'Good evening. The storm left 4,000 homes without power.\n\nIn sport, the Harbor Kings won 3-2.';
const STORE = {
  news: { manifest: { kind: 'persona', persona: { hero: 'ada', register: 'anchor', reads: { lead: { script: SCRIPT } } } } },
  plain: { manifest: { kind: 'persona', persona: { hero: 'bo', register: 'anchor', reads: { lead: { script: SCRIPT } } } } },
  ada: { manifest: { kind: 'layered', hero: { name: 'Ada', form: 'realistic', head: 'relational' } } },
  bo: { manifest: { kind: 'layered', hero: { name: 'Bo', form: 'tiered' } } },
  box: { manifest: { kind: 'solid-turntable' } },
};
const lookup = (r) => STORE[r];
const ONE = { persona: 'news', read: 'lead', at: [0, 2, 1.5] };

describe('a persona on a screen', () => {
  it('compiles the read onto the screen: its captions, its words and its gestures on the read\'s clock, looped', () => {
    const [S] = broadcastScreens([ONE], { lookup });
    const R = readScript({ script: SCRIPT, register: 'anchor' });
    expect(S).toMatchObject({ at: [0, 2, 1.5], yaw: 0, size: [...SCREEN_SIZE], loop: true, seconds: R.seconds, name: 'Ada', title: 'NEWS' });
    expect(S.cues).toEqual(captionCues(R).map((c) => [c.start, c.end, c.text]));
    expect(S.words).toHaveLength(R.lines.reduce((n, L) => n + L.words.length, 0));
    expect(S.body.map(([, g]) => g)).toEqual(R.body.map((b) => b.gesture));
    expect(JSON.stringify(broadcastScreens([ONE], { lookup }))).toBe(JSON.stringify([S]));
  });

  it('the face is a gen-7 world\'s with the realistic hero; anywhere else the body', () => {
    expect(broadcastScreens([ONE], { lookup, era: 'gen-7' })[0].fidelity).toBe('face');
    expect(broadcastScreens([ONE], { lookup })[0].fidelity).toBe('body');
    expect(broadcastScreens([{ ...ONE, persona: 'plain' }], { lookup, era: 'gen-7' })[0].fidelity).toBe('body');
  });

  it('refuses a shape it does not take, a ref that is no persona, and a read the persona lacks', () => {
    expect(broadcastErrors([])).toHaveLength(1);
    expect(broadcastErrors([{ ...ONE, at: [0, 1], package: 'cable', mood: 1 }])).toHaveLength(3);
    expect(() => broadcastScreens([{ ...ONE, persona: 'box' }], { lookup })).toThrow(/not a persona/);
    expect(() => broadcastScreens([{ ...ONE, read: 'sport' }], { lookup })).toThrow(/no read 'sport'.*lead/);
  });

  it('a page with screens carries the channel and its frame step; a page without carries none of it', () => {
    const floor = { pts: [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]], fill: '#888' };
    const page = emitThreeWorld({ faces: [floor], broadcasts: broadcastScreens([ONE], { lookup }) });
    expect(page).toContain('stepBroadcasts(t);');
    expect(page).toContain('window.__mojBroadcasts');
    expect(emitThreeWorld({ faces: [floor] })).not.toMatch(/Broadcasts/);
  });
});
