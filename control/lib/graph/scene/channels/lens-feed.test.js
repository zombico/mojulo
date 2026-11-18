import { describe, it, expect } from 'vitest';
import { lensStep, lensMemory } from './lens-feed.js';

// a world of a pilot, a foe and the pilot's ally; a projection that puts each where its x says
const foe = (o = {}) => ({ id: 'foe', team: 'foes', transform: { pos: [5, 0, 0] }, hits: 0, body: { hp: 100 }, hpMax: 100, ...o });
const world = (f = foe(), o = {}) => ({ pilotId: 'me', byId: { me: { id: 'me', team: 'us', transform: { pos: [0, 0, 0] }, hits: 0 }, ally: { id: 'ally', team: 'us', transform: { pos: [2, 0, 0] }, hits: 0 }, foe: f }, entities: [], ...o });
const live = (W) => { W.entities = Object.values(W.byId); return W; };
const at = (e) => ({ x: e.transform.pos[0] / 10, y: 0.5, r: 0.06 });

describe('the lens\'s feed: the foe just struck, where it stands on the screen', () => {
  it('a hit is counted once, followed while its strike plays, then let go', () => {
    const L = lensMemory(), W = live(world());
    expect(lensStep(L, W, 0, at)).toEqual([]);
    W.byId.foe.hits = 1; W.byId.foe.body.hp = 80;
    const rows = lensStep(L, W, 0.1, at, { hold: 0.4 });
    expect(rows).toEqual([{ id: 'foe', n: 1, x: 0.5, y: 0.5, r: 0.06, power: 0.8 }]);   // 20 of 100: 0.3 + 2.5 × 0.2
    W.byId.foe.transform.pos = [6, 0, 0];
    expect(lensStep(L, W, 0.3, at, { hold: 0.4 })[0].x).toBe(0.6);   // followed
    expect(lensStep(L, W, 0.6, at, { hold: 0.4 })).toEqual([]);      // its beat over
  });
  it('never the pilot or the pilot\'s side: their hurt is the HUD\'s', () => {
    const L = lensMemory(), W = live(world());
    lensStep(L, W, 0, at);
    W.byId.me.hits = 1; W.byId.ally.hits = 1;
    expect(lensStep(L, W, 0.1, at)).toEqual([]);
  });
  it('stands down while a world moment plays: the world\'s own flash and zoom answer that hit', () => {
    const L = lensMemory(), W = live(world(foe(), { tempo: { playing: { on: 'strike' } } }));
    lensStep(L, W, 0, at);
    W.byId.foe.hits = 1;
    expect(lensStep(L, W, 0.1, at)).toEqual([]);
    // (and that hit is spent, not played late once the moment ends)
    W.tempo.playing = null;
    expect(lensStep(L, W, 0.2, at)).toEqual([]);
  });
  it('skips a foe off the screen, and keeps at most `most` at once', () => {
    const L = lensMemory(), W = live(world());
    lensStep(L, W, 0, at);
    W.byId.foe.hits = 1;
    expect(lensStep(L, W, 0.1, () => null)).toEqual([]);
    const many = lensMemory(), M = { pilotId: 'me', byId: { me: { id: 'me', transform: { pos: [0, 0, 0] } } }, entities: [] };
    for (let i = 0; i < 9; i++) M.byId[`f${i}`] = { id: `f${i}`, transform: { pos: [i, 0, 0] }, hits: 0 };
    live(M); lensStep(many, M, 0, at);
    for (const e of M.entities) if (e.id !== 'me') e.hits = 1;
    expect(lensStep(many, M, 0.1, at, { most: 4 })).toHaveLength(4);
  });
});
