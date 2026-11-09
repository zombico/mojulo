import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { emitPlayShell } from './play-shell.js';
import { normalizeGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_OUTCOME, MSG_SHOWN, MSG_CARD_DONE, MSG_DOOR } from './level-contract.js';

// THE FLOW RUNNER, played: the play shell runs the game's flow (flow.js), the game's own or the one its front, levels and
// run make. Every screen's buttons and every level's end are events the flow steps on; the level's sidecars say when its
// first frame is drawn (the veil lifts) and when its end card is read (the flow goes on). Driven in a DOM, the level a
// stand-in that posts from the frame.
const REFS = ['vale', 'gate', 'keep'];
const contract = (ref) => normalizeLevelContract({ levelRef: ref, produces: { events: [{ type: 'promote', slice: 'campaign', max: 1 }] } });
const game = (more = {}) => normalizeGameManifest({ kind: 'game', title: 'Lantern Keep', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: REFS.map((ref) => ({ ref, title: ref.toUpperCase() })), ...more });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function page(more) {
  const dom = new JSDOM(emitPlayShell(game(more), REFS.map((ref) => ({ ref, contract: contract(ref) }))), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
  const w = dom.window, d = w.document, frame = d.getElementById('frame');
  const level = () => (frame.getAttribute('src') ? frame.getAttribute('src').replace(/^levels\/|\.html$/g, '') : null);
  // the level speaks from the frame
  const say = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: frame.contentWindow }));
  const end = (result = 'success', extra = {}) => say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: level(), result, events: [], ...extra } });
  const click = (text, scope = 'button') => { const b = [...d.querySelectorAll(scope)].find((x) => x.textContent === text); if (!b) throw new Error(`no button '${text}' (${[...d.querySelectorAll(scope)].map((x) => x.textContent).join(', ')})`); b.click(); };
  const screen = () => d.getElementById('app').textContent;
  return { w, d, frame, level, say, end, click, screen, veil: d.getElementById('veil') };
}

describe('the play shell runs the game\'s flow', () => {
  it('a game with no flow plays as it always has: the levels, a result between, the end card and home', () => {
    const P = page({ front: {} });
    expect(P.d.getElementById('front').style.display).toBe('block');
    P.click('start', '#front .fx-menu button');
    expect(P.level()).toBe('vale');
    P.end(); P.say({ moj: MSG_CARD_DONE });
    expect(P.screen()).toContain('cleared');
    P.click('next: GATE');
    expect(P.level()).toBe('gate');
    P.end('fail'); P.say({ moj: MSG_CARD_DONE });
    P.click('try again');
    expect(P.level()).toBe('gate');
    P.end(); P.say({ moj: MSG_CARD_DONE });
    P.click('next: KEEP');
    P.end(); P.say({ moj: MSG_CARD_DONE });
    // the first full clear: the front's end card, then (no credits) the title
    expect(P.d.querySelector('#front .fx-end h1').textContent).toBe('The end');
    P.click('title', '#front .fx-end button');
    expect(P.d.querySelector('#front .fx-menu')).not.toBeNull();
  });
  it('the veil lifts on the level\'s first frame, not on its ready', () => {
    const P = page({ front: {} });
    P.click('start', '#front .fx-menu button');
    P.say({ moj: MSG_READY, contractVersion: CONTRACT_VERSION, levelRef: 'vale' });
    expect(P.veil.style.display).toBe('flex');
    P.say({ moj: MSG_SHOWN });
    expect(P.veil.style.display).toBe('none');
  });
  it('the result waits for the level\'s end card to be read, and no longer', async () => {
    const P = page();
    P.click('play');
    P.end();
    await wait(50);
    expect(P.frame.style.display).toBe('block');          // the card is still up
    P.say({ moj: MSG_CARD_DONE });
    expect(P.screen()).toContain('cleared');
  });
  it('a flow of its own: a beat between screens, a level straight on to the next, a cinematic gone straight on until its stage plays it', async () => {
    const P = page({ flow: {
      start: 'title',
      steps: {
        title: { kind: 'screen', screen: 'title', on: { play: 'beat' } },
        beat: { kind: 'hold', for: 0.05, next: 'intro' },
        intro: { kind: 'cinematic', scene: 'intro', stage: 'vale', next: 'vale' },
        vale: { kind: 'level', level: 'vale', on: { won: '$next', lost: '$again' } },
        rest: { kind: 'level', level: '$any', on: { won: ['$next', 'title'], lost: '$again' } },
      },
    } });
    P.click('play');
    expect(P.level()).toBeNull();
    await wait(120);
    expect(P.level()).toBe('vale');
    P.end();
    expect(P.level()).toBe('gate');                        // straight on: no result between, no card to wait for
    P.end('fail');
    expect(P.level()).toBe('gate');
  });
  it('a door goes where its link says, carrying what the level gathered', () => {
    const P = page({ links: [{ from: { ref: 'vale', door: 'east' }, to: { ref: 'gate', door: 'west' } }] });
    P.click('play', '#app .card button');
    expect(P.level()).toBe('vale');
    P.say({ moj: MSG_DOOR, door: 'east', envelope: { contractVersion: CONTRACT_VERSION, levelRef: 'vale', result: 'transit', events: [] } });
    expect(P.level()).toBe('gate');
  });
  it('a run goes on through its order, and a fall ends it on the run\'s result', async () => {
    const P = page({ run: { length: 2 } });
    P.click('start a run');
    const first = P.level();
    expect(REFS).toContain(first);
    P.end();
    await wait(1500);
    expect(P.level()).not.toBe(first);                    // the run's next level
    P.end('fail');
    await wait(1500);
    expect(P.screen()).toContain('run over');
    P.click('new run');
    expect(REFS).toContain(P.level());
  });
  it('a screen left alone goes on by its idle; a key keeps it', async () => {
    const P = page({ flow: { start: 'title', steps: {
      title: { kind: 'screen', screen: 'title', on: { play: '$first' }, idle: { after: 0.1, go: 'credits' } },
      credits: { kind: 'screen', screen: 'credits', next: 'title' },
      any: { kind: 'level', level: '$any', on: { won: 'title' } },
    } } });
    await wait(60);
    P.w.dispatchEvent(new P.w.KeyboardEvent('keydown', { code: 'KeyX' }));
    await wait(60);
    expect(P.screen()).toContain('play');
    await wait(120);
    expect(P.screen()).toContain('made with mojulo');
    P.click('done');
    expect(P.screen()).toContain('play');
  });
});
