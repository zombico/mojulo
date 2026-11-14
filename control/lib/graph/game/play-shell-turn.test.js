import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_SHOWN, MSG_CARD_DONE, MSG_SCENE_END, MSG_PAUSE } from './level-contract.js';

// THE PLAY SHELL RUNS A TURN (turn.js): a level step that says picks or a trigger is one level session in phases. The
// picks are drawn by mana-ui and handed to the level, a retry and the pause's restart keep them, the start trigger is
// staged on the level's page once a save. Played in a DOM with the keys a player presses, the level a stand-in that
// posts from the frame. A game whose steps say no turn carries none of it.
const STORE = { slices: [{ name: 'campaign', kind: 'progression' }, { name: 'party', kind: 'party', init: { roster: { ash: { name: 'Ash' }, bryn: { name: 'Bryn' }, cole: { name: 'Cole' } } } }] };
const contract = normalizeLevelContract({ levelRef: 'vale', consumes: [{ slice: 'party', pick: { max: 2 } }], produces: { events: [{ type: 'promote', slice: 'campaign', max: 1 }] } });
const flowOf = (turn) => ({ start: 'title', steps: {
  title: { kind: 'screen', screen: 'title', on: { play: '$first' } },
  play: { kind: 'level', level: '$any', on: { won: 'result', lost: 'result', left: 'result' }, ...turn },
  result: { kind: 'screen', screen: 'result', on: { again: '$again', home: 'title' } },
} });
const PICKS = [{ id: 'difficulty', ask: 'Choose a difficulty', from: { options: [{ id: 'easy', name: 'Easy', about: 'Foes forgive a slow guard.' }, 'hard'] } }, { id: 'squad', ask: 'Choose your squad', hint: 'Two go in.', from: { slice: 'party' }, max: 2 }];
const game = (turn, more = {}) => normalizeGameManifest({ kind: 'game', title: 'Lantern Keep', shell: 'play', store: STORE, levels: [{ ref: 'vale', title: 'Vale' }], flow: flowOf(turn), ...more });
const emit = (turn, more) => emitPlayShell(game(turn, more), [{ ref: 'vale', contract }]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(turn, more) {
  const dom = new JSDOM(emit(turn, more), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
  const w = dom.window, d = w.document, frame = d.getElementById('frame'), posted = [];
  // (the frame's window is a new one once it is given a src: the shell's posts are caught on the one it has now)
  const tap = () => { frame.contentWindow.postMessage = (m) => { posted.push(m); }; };
  const say = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: frame.contentWindow }));
  const key = async (code) => { w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: code, bubbles: true })); w.dispatchEvent(new w.KeyboardEvent('keyup', { code, key: code, bubbles: true })); await wait(30); };
  const screen = () => w.__mojManaUi.state().screen;
  const text = () => { const s = [...d.querySelectorAll('#mana .mana-screen')].find((n) => !n.hasAttribute('data-leaving')); return s ? s.textContent : ''; };
  // the level's side of the handshake: ready, and the init the shell answers with
  const init = () => { tap(); posted.length = 0; say({ moj: MSG_READY, contractVersion: CONTRACT_VERSION }); return posted.find((m) => m.moj === MSG_INIT); };
  // (the result's figures count for a moment, and a press while they do only lands them: wait them out)
  const outcome = async (result) => { say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: 'vale', result, events: [] } }); say({ moj: MSG_CARD_DONE }); await wait(1100); };
  await wait(60);
  return { w, d, frame, tap, say, key, screen, text, init, outcome, posted, loaded: () => !!frame.getAttribute('src'), close: () => w.close() };
}

describe('the play shell runs a turn', () => {
  it('a game whose steps say no turn carries no turn kernel; one with picks and no ui is drawn in the greybox', () => {
    const plain = emit({}), turned = emit({ picks: PICKS });
    expect(plain).not.toContain('const __mojTurnK = (');
    expect(plain).not.toContain('__manaUi');
    expect(turned).toContain('const __mojTurnK = (');
    expect(turned).toContain('__manaUi');
    expect(validateGameManifest(game({ picks: PICKS })).errors).toEqual([]);
    // a trigger alone needs no screen of mana-ui's
    expect(emit({ start: { video: 'intro.mp4' } })).not.toContain('__manaUi');
    // a pick from a slice the level does not consume is refused at the emit, taught
    expect(() => emit({ picks: [{ id: 'kit', from: { slice: 'campaign' } }] })).toThrow(/not a slice the level consumes \(party\)/);
  });

  it('untap, then the load: each pick asked in turn, back unwinding one, the level handed what was picked', async () => {
    const P = await page({ picks: PICKS });
    await P.key('Enter');                                   // the title's start
    expect(P.screen()).toBe('pick');
    expect(P.loaded()).toBe(false);                         // nothing loads until the picks are made
    // the question, how far along, the rows, and the one in focus beside them with what it means
    expect(P.text()).toMatch(/Vale.*Choose a difficulty.*Easy.*hard.*Easy.*Foes forgive a slow guard\./);
    await P.key('ArrowDown'); await P.key('Enter');         // hard
    // the squad: what was chosen before it, the roster as faces, the one in focus with its level
    expect(P.text()).toMatch(/Choose your squad.*Two go in\..*difficulty · hard.*Ash.*Bryn.*Cole.*Ash.*Lv 1/);
    await P.key('Escape');                                  // back: the first pick again, its choice let go
    expect(P.text()).toMatch(/Choose a difficulty/);
    expect(P.text()).not.toMatch(/Choose your squad/);
    await P.key('Enter');                                   // easy
    await P.key('Enter');                                   // Ash
    expect(P.text()).toMatch(/Ash\s*picked/);
    await P.key('ArrowRight'); await P.key('ArrowRight'); await P.key('Enter');   // Cole
    await P.key('ArrowDown'); await P.key('Enter');         // continue
    expect(P.loaded()).toBe(true);
    expect(P.screen()).toBe('loading');
    const init = P.init();
    expect(init.params.__picks).toEqual({ difficulty: 'easy' });
    expect(Object.keys(init.params.party.roster)).toEqual(['ash', 'cole']);
    P.close();
  });

  it('a retry and the pause\'s restart load again with the same picks, never asked twice', async () => {
    const P = await page({ picks: [PICKS[0]] });
    await P.key('Enter'); await P.key('ArrowDown'); await P.key('Enter');   // start, hard
    expect(P.init().params.__picks).toEqual({ difficulty: 'hard' });
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    // the pause, then restart: the same picks, no pick screen
    P.d.getElementById('pauseBtn').click(); await wait(30);
    expect(P.screen()).toBe('pause');
    await P.key('ArrowDown'); await P.key('Enter');
    expect(P.screen()).toBe('loading');
    expect(P.init().params.__picks).toEqual({ difficulty: 'hard' });
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    await P.outcome('fail');
    expect(P.screen()).toBe('result');
    await P.key('Enter');                                   // try again
    expect(P.screen()).toBe('loading');
    expect(P.init().params.__picks).toEqual({ difficulty: 'hard' });
    // home, then start: a new turn asks again
    P.say({ moj: MSG_SHOWN }); await wait(150);
    await P.outcome('fail');
    await P.key('ArrowDown'); await P.key('Enter');         // title
    expect(P.screen()).toBe('title');
    await P.key('Enter');
    expect(P.screen()).toBe('pick');
    P.close();
  });

  it('main\'s start trigger: its scene staged on the level\'s page, no pause while it plays, once a save', async () => {
    const P = await page({ start: { scene: 'arrival' } }, { ui: { theme: 'grim' } });
    await P.key('Enter');
    expect(P.init().params.__stage).toEqual({ scene: 'arrival' });
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    const btn = P.d.getElementById('pauseBtn');
    P.tap(); P.posted.length = 0;
    btn.click(); await wait(30);
    expect(P.posted.some((m) => m.moj === MSG_PAUSE)).toBe(false);   // the interrupt is legal in play only
    P.say({ moj: MSG_SCENE_END, scene: 'arrival' });
    btn.click(); await wait(30);
    expect(P.screen()).toBe('pause');
    await P.key('Escape');
    await P.outcome('fail');
    await P.key('Enter');                                   // try again: never replayed
    expect(P.init().params.__stage).toBeUndefined();
    P.close();
  });
});
