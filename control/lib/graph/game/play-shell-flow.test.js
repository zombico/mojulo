import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { emitPlayShell } from './play-shell.js';
import { defaultFlow, startInPlay } from './flow.js';
import { normalizeGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_SHOWN, MSG_CARD_DONE, MSG_DOOR, MSG_SCENE_END } from './level-contract.js';

// THE FLOW RUNNER, played: the play shell runs the game's flow (flow.js), the game's own or the one its front, levels and
// run make. Every screen's buttons and every level's end are events the flow steps on; the level's sidecars say when its
// first frame is drawn (the veil lifts) and when its end card is read (the flow goes on). Driven in a DOM, the level a
// stand-in that posts from the frame.
const REFS = ['vale', 'gate', 'keep'];
const contract = (ref) => normalizeLevelContract({ levelRef: ref, produces: { events: [{ type: 'promote', slice: 'campaign', max: 1 }] } });
const game = (more = {}) => normalizeGameManifest({ kind: 'game', title: 'Lantern Keep', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: REFS.map((ref) => ({ ref, title: ref.toUpperCase() })), ...more });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// `seen`: the flow's steps a save has already entered (a later boot)
function page(more, { seen = null } = {}) {
  const dom = new JSDOM(emitPlayShell(game(more), REFS.map((ref) => ({ ref, contract: contract(ref) }))), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html',
    beforeParse: (win) => { if (seen) win.localStorage.setItem('moj-play:Lantern Keep:seen', JSON.stringify(seen)); } });
  const w = dom.window, d = w.document, frame = d.getElementById('frame');
  const level = () => (frame.getAttribute('src') ? frame.getAttribute('src').replace(/^levels\/|\.html$/g, '') : null);
  // the level speaks from the frame
  const say = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: frame.contentWindow }));
  const end = (result = 'success', extra = {}) => say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: level(), result, events: [], ...extra } });
  const click = (text, scope = 'button') => { const b = [...d.querySelectorAll(scope)].find((x) => x.textContent === text); if (!b) throw new Error(`no button '${text}' (${[...d.querySelectorAll(scope)].map((x) => x.textContent).join(', ')})`); b.click(); };
  const screen = () => d.getElementById('app').textContent;
  // the level says it is ready; what the shell sends it back (its params) is caught
  const ready = () => { const got = []; frame.contentWindow.postMessage = (m) => got.push(m); say({ moj: MSG_READY, contractVersion: CONTRACT_VERSION, levelRef: level() }); return got.find((m) => m.moj === MSG_INIT) || null; };
  return { w, d, frame, level, say, end, click, screen, ready, veil: d.getElementById('veil') };
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
  it('a flow of its own: a beat between screens, a cinematic on its stage, a level straight on to the next', async () => {
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
    expect(P.level()).toBe('vale');                        // the cinematic's stage
    P.say({ moj: MSG_SCENE_END, scene: 'intro' });
    expect(P.level()).toBe('vale');                        // the level itself, its page anew
    P.end();
    expect(P.level()).toBe('gate');                        // straight on: no result between, no card to wait for
    P.end('fail');
    expect(P.level()).toBe('gate');
  });
  it('a cinematic plays on its stage, asked of the level; kept, its page goes on as the level, the player\'s', () => {
    const P = page({ flow: {
      start: 'opening',
      steps: {
        opening: { kind: 'cinematic', scene: 'opening', stage: 'keep', next: 'title', skip: false },
        title: { kind: 'screen', screen: 'title', on: { play: 'prologue' } },
        prologue: { kind: 'cinematic', scene: 'prologue', stage: 'vale', next: 'vale', keep: true },
        vale: { kind: 'level', level: 'vale', on: { won: '$next', lost: '$again' } },
        rest: { kind: 'level', level: '$any', on: { won: 'title', lost: '$again' } },
      },
    } });
    expect(P.level()).toBe('keep');
    expect(P.ready().params.__stage).toEqual({ scene: 'opening', skip: false });
    expect(P.d.getElementById('pauseBtn').style.display).toBe('none');   // a cinematic has no pause: Esc is its skip
    P.say({ moj: MSG_SCENE_END, scene: 'another' });                  // not the one staged: nothing moves
    expect(P.level()).toBe('keep');
    P.say({ moj: MSG_SCENE_END, scene: 'opening' });
    expect(P.screen()).toContain('play');
    P.click('play');
    expect(P.level()).toBe('vale');
    expect(P.ready().params.__stage).toEqual({ scene: 'prologue' });
    const src = P.frame.getAttribute('src');
    P.say({ moj: MSG_SCENE_END, scene: 'prologue' });
    expect(P.frame.getAttribute('src')).toBe(src);                    // the same page: no reload
    expect(P.d.getElementById('pauseBtn').style.display).toBe('block');
    P.end();
    expect(P.level()).toBe('gate');                                    // the kept level's outcome is the flow's, as any level's
  });
  it('the story\'s opening plays on a first boot only; its prologue hands its page to play', () => {
    const lv = REFS.map((ref) => ({ ref }));
    const flow = defaultFlow({ levels: lv, front: {}, cinematics: { opening: { scene: 'dawn', stage: 'keep' }, prologue: { scene: 'setting-out', stage: 'vale' } } });
    const P = page({ front: {}, flow });
    expect(P.level()).toBe('keep');
    expect(P.ready().params.__stage).toEqual({ scene: 'dawn' });
    P.say({ moj: MSG_SCENE_END, scene: 'dawn' });
    P.click('start', '#front .fx-menu button');
    expect(P.level()).toBe('vale');
    expect(P.ready().params.__stage).toEqual({ scene: 'setting-out' });
    const src = P.frame.getAttribute('src');
    P.say({ moj: MSG_SCENE_END, scene: 'setting-out' });
    expect(P.frame.getAttribute('src')).toBe(src);                    // play goes on, the same page
    expect(JSON.parse(P.w.localStorage.getItem('moj-play:Lantern Keep:seen'))).toMatchObject({ opening: 1, prologue: 1 });
    const later = page({ front: {}, flow }, { seen: { opening: 1 } });
    expect(later.level()).toBeNull();                                  // a later boot: the title at once
    expect(later.d.querySelector('#front .fx-menu')).not.toBeNull();
  });
  it('a stage that has no such scene says so, and the flow goes on', () => {
    const P = page({ flow: { start: 'opening', steps: {
      opening: { kind: 'cinematic', scene: 'opening', stage: 'vale', next: 'title' },
      title: { kind: 'screen', screen: 'title', on: { play: '$first' } },
      any: { kind: 'level', level: '$any', on: { won: 'title' } },
    } } });
    P.say({ moj: MSG_SCENE_END, scene: 'opening', missing: true });
    expect(P.screen()).toContain('play');
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
  it('a game started in play boots through its opening cutscene straight into the first level: an empty slot is passed at once', async () => {
    const P = page({ flow: startInPlay(defaultFlow(game())) });
    expect(P.level()).toBeNull();
    await wait(40);
    expect(P.level()).toBe('vale');                        // no title, no press: the game
    // the screens after a level are as they were: the level picker is where this game's result goes back to
    P.end('fail'); P.say({ moj: MSG_CARD_DONE });
    P.click('levels');
    expect(P.level()).toBeNull();
    expect(P.screen()).toContain('GATE');
  });

  it('a cutscene\'s video plays over the shell and the game goes on as it ends, or at a skip once it has been up a moment', async () => {
    const boot = (cut) => page({ flow: startInPlay(defaultFlow(game()), cut) });
    const P = boot({ video: 'media/opening.mp4' }), video = () => P.d.querySelector('video');
    await wait(20);
    expect(video().getAttribute('src')).toBe('media/opening.mp4');
    expect(P.level()).toBeNull();
    // a key at once is the key that started the game, not a skip
    P.w.dispatchEvent(new P.w.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(video()).not.toBeNull();
    video().dispatchEvent(new P.w.Event('ended'));
    expect(video()).toBeNull();
    expect(P.level()).toBe('vale');
    // skipped once it has been up a moment; unskippable, it plays on
    const Q = boot({ video: 'media/opening.mp4' });
    await wait(700);
    Q.w.dispatchEvent(new Q.w.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(Q.level()).toBe('vale');
    const U = boot({ video: 'media/opening.mp4', skip: false });
    await wait(700);
    U.w.dispatchEvent(new U.w.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(U.level()).toBeNull();
    // a video that cannot play is no dead end
    U.d.querySelector('video').dispatchEvent(new U.w.Event('error'));
    expect(U.level()).toBe('vale');
  });

  it('a cutscene made of a directed scene is staged as a cinematic is, and the game goes on as its scene ends', async () => {
    const P = page({ flow: startInPlay(defaultFlow(game()), { scene: 'dawn', stage: 'gate' }) });
    await wait(20);
    expect(P.level()).toBe('gate');                        // its stage
    expect(P.ready().params.__stage).toMatchObject({ scene: 'dawn' });
    P.say({ moj: MSG_SCENE_END, scene: 'dawn' });
    expect(P.level()).toBe('vale');                        // the first level
  });
});
