// THE FEEL BOOK: a made game's feel to sample, the stick view locked to the card its `feel` makes, on its template's
// stage and viewer, what the runtime carries said beside it; the gameworld bible says the same and links to it.
// The bake is the slow part (takes.js): the page's laws run on takes handed in, the sample's on the recipe alone.

import { describe, it, expect } from 'vitest';
import { MEADOWMARK } from '../index.js';
import { gameworldBibleHtml } from '../bible-html.js';
import { POLES, POLE_IDS, DEMO_ABILITIES, poleCard } from './cards.js';
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

describe('what each template shows', () => {
  // an ability shown is one the template's card has: its book shows the controls the game is about, and they work
  const backed = {
    move: (c) => c.ground.run > 0, sprint: (c) => c.ground.sprint > c.ground.run, jump: (c) => c.jump.height > 0, air: (c) => c.air?.jumps > 0,
    wall: (c) => !!c.cling, attack: (c) => c.moves.string.length > 0, charge: (c) => !!c.charge && !c.charge.tap, buster: (c) => !!c.charge?.tap,
    shoot: (c) => !!c.loadout?.slots?.length, switch: (c) => c.loadout?.slots?.length > 1, dodge: (c) => !!c.dodge, dash: (c) => !!c.dash, boost: (c) => !!c.boost,
    chargeJump: (c) => !!c.chargeJump, guard: (c) => !!c.guard, lock: (c) => !!c.lock, pound: (c) => !!c.pound, stomp: (c) => c.land?.model === 'stomp', lanes: (c) => !!c.runner, spar: (c) => !!c.guard,
    glide: (c, P) => P.gear === 'glide', jet: (c, P) => P.gear === 'jet',
  };
  it('every template names what it is about, each an ability its card has', () => {
    expect(Object.keys(backed).sort()).toEqual([...DEMO_ABILITIES].sort());
    for (const id of POLE_IDS) {
      const P = POLES[id], c = poleCard(id);
      expect([id, P.demo.length > 0]).toEqual([id, true]);
      for (const a of P.demo) expect([id, a, backed[a](c, P)]).toEqual([id, a, true]);
    }
  });

  it('the sample carries its template\'s list (a blend, the nearer\'s)', () => {
    expect(feelSample(W(lane)).demo).toEqual(POLES[lane].demo);
    expect(feelSample(W({ pole: lane, toward: geared, t: 0.8 })).demo).toEqual(POLES[geared].demo);
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
  it('names the feel and links to the feel book to play it; a world with none says nothing of it', () => {
    const page = gameworldBibleHtml(W(lane));
    expect(page).toMatch(/<summary>Feel<\/summary>/);
    expect(page).toMatch(new RegExp(`<b>${POLES[lane].name}</b>`));
    expect(page).toMatch(/href="\?book=feel"/);
    expect(gameworldBibleHtml(MEADOWMARK)).not.toMatch(/id="feel"/);
  });
});
