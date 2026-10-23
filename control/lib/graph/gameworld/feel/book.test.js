// THE FEEL BOOK: a made game's feel to sample, the stick view locked to the card its `feel` makes, on its template's
// stage and viewer, what the runtime carries said beside it; the gameworld bible says the same and links to it.
// The bake is the slow part (takes.js): the page's laws run on takes handed in, the sample's on the recipe alone.

import { describe, it, expect } from 'vitest';
import { MEADOWMARK } from '../index.js';
import { gameworldBibleHtml } from '../bible-html.js';
import { POLES, POLE_IDS } from './cards.js';
import { feelCard, feelReport } from './lower.js';
import { feelSample, feelBookHtml } from './book.js';

const geared = POLE_IDS.find((id) => POLES[id].gear), lane = POLE_IDS.find((id) => POLES[id].set?.lane && !POLES[id].gear);
const W = (feel) => ({ ...MEADOWMARK, name: 'Meadowmark', feel });
const revive = (c) => JSON.parse(JSON.stringify(c), (k, v) => (v === 'Infinity' ? Infinity : v));

describe('the sample', () => {
  it('is the card the feel makes, on its template\'s stage, viewer and gear, with what the runtime carries; none without a feel', () => {
    const S = feelSample(W(geared)), P = POLES[geared];
    expect(revive(S.card)).toEqual(feelCard(geared));
    expect([S.base, S.stage, S.view, S.gear, S.cast]).toEqual([P.base, P.stage, P.view.camera, P.gear, 'male']);
    expect(S.report.lost).toEqual(feelReport(geared).lost);
    expect(S.says).toMatch(new RegExp(`Meadowmark plays ${P.name}`));
    expect(feelSample(MEADOWMARK)).toBeNull();
    expect(feelBookHtml(MEADOWMARK)).toBeNull();
  });

  it('a blend is seen as its nearer template, and a turn that is instant survives the trip into the page', () => {
    const S = feelSample(W({ pole: lane, toward: geared, t: 0.8 }));
    expect([S.stage, S.view]).toEqual([POLES[geared].stage, POLES[geared].view.camera]);
    const instant = POLE_IDS.find((id) => feelCard(id).ground.turn === Infinity);
    expect(feelSample(W(instant)).card.ground.turn).toBe('Infinity');
    expect(() => feelSample(W(lane), { cast: 'robot' })).toThrow(/cast is one of/);
  });
});

describe('the page', () => {
  it('carries the sample and the takes it is handed, steps the inlined kernel, and is the lab\'s page put to one game', () => {
    const html = feelBookHtml(W(lane), { data: { male: { stub: true } } });
    expect(html).toMatch(/<title>Meadowmark: feel<\/title>/);
    expect(html).toMatch(/const SAMPLE = \{"name":"Meadowmark"/);
    expect(html).toMatch(/const DATA = \{"male":\{"stub":true\}\}/);
    expect(html).toMatch(/const VS = null/);
    expect(html).toMatch(/export function step|function step\(S0, pad\)/);
    expect(html).not.toMatch(/^import /m);
  });
});

describe('the bible', () => {
  it('says how the controls play, what is carried, and links to the feel book; a world with none says nothing of it', () => {
    const page = gameworldBibleHtml(W(lane));
    expect(page).toMatch(/How the controls play<\/summary>/);
    expect(page).toMatch(new RegExp(`Plays <b>${POLES[lane].name}</b>`));
    expect(page).toMatch(/href="\?book=feel"/);
    expect(gameworldBibleHtml(MEADOWMARK)).not.toMatch(/id="feel"/);
  });
});
