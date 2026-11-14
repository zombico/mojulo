import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { emitPlayShell } from './play-shell.js';
import { readShellUi, shellManaSpec } from './play-shell-mana.js';
import { normalizeGameManifest, validateGameManifest } from './game-manifest.js';
import { normalizeLevelContract, CONTRACT_VERSION, MSG_OUTCOME, MSG_SHOWN, MSG_CARD_DONE } from './level-contract.js';

// THE PLAY SHELL'S SCREENS IN MANA-UI: a game with a `ui` has its flow's screens drawn by the game UI runtime, in its
// look, driven by the keys and pads through the controls host; a game without one carries none of it. Played in a DOM
// with the keys a player presses, the level a stand-in that posts from the frame.
const REFS = ['vale', 'gate'];
const contract = (ref) => normalizeLevelContract({ levelRef: ref, produces: { events: [{ type: 'promote', slice: 'campaign', max: 1 }] } });
const game = (more = {}) => normalizeGameManifest({ kind: 'game', title: 'Lantern Keep', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: REFS.map((ref) => ({ ref, title: ref.toUpperCase() })), ...more });
const emit = (more) => emitPlayShell(game(more), REFS.map((ref) => ({ ref, contract: contract(ref) })));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(more) {
  const dom = new JSDOM(emit(more), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/game.html' });
  const w = dom.window, d = w.document, frame = d.getElementById('frame');
  const level = () => (frame.getAttribute('src') ? frame.getAttribute('src').replace(/^levels\/|\.html$/g, '') : null);
  const say = (data) => w.dispatchEvent(new w.MessageEvent('message', { data, source: frame.contentWindow }));
  const key = async (code) => { w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key: code, bubbles: true })); w.dispatchEvent(new w.KeyboardEvent('keyup', { code, key: code, bubbles: true })); await wait(40); };
  // the screen up (the runtime's word: a screen leaving keeps its place in the page until its exit plays, which a DOM
  // without animations never ends) and the words it shows
  const screen = () => w.__mojManaUi.state().screen;
  const text = () => { const s = [...d.querySelectorAll('#mana .mana-screen')].find((n) => !n.hasAttribute('data-leaving')); return s ? s.textContent : ''; };
  await wait(60);
  return { w, d, frame, level, say, key, screen, text, close: () => w.close() };
}

describe('the play shell\'s screens in mana-ui', () => {
  it('a game says its ui in the play shell, and is taught its faults; one without carries none of mana-ui', () => {
    expect(validateGameManifest(game({ ui: { theme: 'grim' } })).errors).toEqual([]);
    expect(validateGameManifest(game({ ui: { theme: 'gilded' } })).errors.join('\n')).toMatch(/ui.theme: /);
    expect(validateGameManifest(game({ shell: undefined, ui: { theme: 'grim' } })).errors.join('\n')).toMatch(/ui is the play shell's screens/);
    expect(readShellUi({ theme: 'grim', colours: 1 })[0]).toMatch(/ui.colours: not part of a game's ui/);
    const plain = emit({ front: {} }), drawn = emit({ front: {}, ui: { theme: 'grim' } });
    for (const marker of ['__manaUi', '.mana-root', '__manaHostK']) { expect(plain).not.toContain(marker); expect(drawn).toContain(marker); }
    expect(drawn).not.toContain('const __mojFront = (');  // the front's words are mana-ui's to draw
    expect(Object.keys(shellManaSpec().screens)).toEqual(['attract', 'title', 'levels', 'options', 'credits', 'end', 'result', 'pause', 'controls', 'loading']);
    // (and a HUD of passing moments over the play)
    expect(shellManaSpec().hud.use).toBe('hud');
  });

  it('the title\'s menu starts the first level over a loading screen that goes once the level is drawn; its result says what next', async () => {
    const P = await page({ front: {}, ui: { theme: 'grim' } });
    expect(P.screen()).toBe('title');
    expect(P.text()).toMatch(/Lantern Keep.*start.*levels.*options/);
    await P.key('Enter');
    expect(P.level()).toBe('vale');
    expect(P.screen()).toBe('loading');
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    expect(P.screen()).toBeNull();                         // ready at once: the loading screen never lingers
    P.say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: 'vale', result: 'success', events: [] } });
    P.say({ moj: MSG_CARD_DONE });
    await wait(60);
    expect(P.screen()).toBe('result');
    expect(P.text()).toMatch(/cleared · VALE.*next: GATE.*play again.*title/);
    await P.key('Enter');                                  // skip the count, then pick next
    await P.key('Enter');
    expect(P.level()).toBe('gate');
    // the last level cleared: the game complete, its end card (the front's words, drawn by mana-ui), then the title
    P.say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: 'gate', result: 'success', events: [] } });
    P.say({ moj: MSG_CARD_DONE });
    await wait(60);
    expect(P.screen()).toBe('end');
    expect(P.text()).toMatch(/game complete.*The end.*Lantern Keep/);
    await P.key('Enter');
    expect(P.screen()).toBe('title');
    P.close();
  });

  it('options keep the sound; back goes back; the levels list picks; credits go on to the title', async () => {
    const P = await page({ front: { credits: { roll: [{ role: 'made by', names: ['Ayla', 'Bram'] }] } }, ui: { theme: 'modern' } });
    await P.key('ArrowDown'); await P.key('ArrowDown');   // start, levels, options
    await P.key('Enter');
    expect(P.screen()).toBe('options');
    await P.key('Enter');                                  // the sound, off
    expect(JSON.parse(P.w.localStorage.getItem('moj-play:Lantern Keep:settings')).sfxOn).toBe(false);
    await P.key('Escape');
    expect(P.screen()).toBe('title');
    await P.key('ArrowUp');                                // the cursor kept on options: up to levels
    await P.key('Enter');
    expect(P.screen()).toBe('levels');
    expect(P.text()).toMatch(/VALE.*GATE/);
    await P.key('Enter');
    expect(P.level()).toBe('vale');
    P.close();
    const C = await page({ front: { credits: { roll: [{ role: 'made by', names: ['Ayla', 'Bram'] }] } }, ui: { theme: 'modern' } });
    await C.key('ArrowUp');                                // credits, the last
    await C.key('Enter');
    expect(C.screen()).toBe('credits');
    expect(C.text()).toMatch(/made by.*Ayla · Bram.*made with mojulo/);
    await C.key('Enter');
    expect(C.screen()).toBe('title');
    C.close();
  });

  it('a run on mana-ui: its rules and best on the title, the pause, what was cleared on the way to the next map, a result that adds up', { timeout: 20000 }, async () => {
    const P = await page({ run: { length: 2 }, ui: { theme: 'idol' } });
    expect(P.screen()).toBe('title');
    expect(P.text()).toMatch(/Lantern Keep.*2 of 2 levels, drawn anew each run\. Fall, and it ends\..*start a run/);
    await P.key('Enter');
    const first = P.level();
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    // the pause: mana-ui's menu over the held level, the shell's own panel left down; its first row resumes
    P.d.getElementById('pauseBtn').click();
    await wait(60);
    expect(P.screen()).toBe('pause');
    expect(P.text()).toMatch(/paused.*resume.*restart.*controls.*sound: on.*quit to title/);
    expect(P.d.getElementById('pause').style.display).toBe('none');
    await P.key('ArrowDown'); await P.key('ArrowDown'); await P.key('Enter');
    expect(P.screen()).toBe('controls');
    expect(P.text()).toMatch(/move.*jump/);
    await P.key('Escape');
    expect(P.screen()).toBe('pause');
    await P.key('ArrowUp'); await P.key('ArrowUp'); await P.key('Enter');   // back up to its first row: resume
    await wait(60);
    expect(P.screen()).toBeNull();
    const won = (ref, coins) => { P.say({ moj: MSG_OUTCOME, envelope: { contractVersion: CONTRACT_VERSION, levelRef: ref, result: 'success', events: [], stats: { kept: [{ label: 'Coins', value: coins, best: 'high' }] } } }); P.say({ moj: MSG_CARD_DONE }); };
    won(first, 7);
    await wait(2700);                                      // (a run reads its level's end card before it goes on)
    // on to the next map: the loading screen says what was cleared and what is next; the moment said it over the play
    expect(P.screen()).toBe('loading');
    expect(P.text()).toMatch(/cleared 1 of 2 · map 2 of 2/);
    expect(P.w.__mojManaState.ui.moments.map((m) => m.text)).toEqual(['cleared 1 of 2']);
    P.say({ moj: MSG_SHOWN });
    await wait(150);
    won(P.level(), 5);
    await wait(2700);
    expect(P.screen()).toBe('result');
    expect(P.text()).toMatch(/run complete.*run 1.*2 of 2.*coins.*12.*new run.*title/);
    expect(P.w.__mojManaState.ui.result.rank).toBe('clear');
    P.close();
  });
});

