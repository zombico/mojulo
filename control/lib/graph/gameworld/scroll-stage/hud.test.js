// The scroll stage's HUD and menu (scroll-stage/hud.js). The concepts: a spec the runtime reads, with or without a boss,
// in a theme mana-ui knows; its parts in their corners, in pictures (the score's star, a ship a life, the hull's heart, the
// gear's pips top left; a card a pod bottom left, its picture, its ammo as a count and a bar, the eject's hold under the
// live one; the boss's skull top right only while it is on the screen; the controls bottom right while they are on);
// every picture it names is drawn by its sheet, and its hints fade out by the host's word; READY and the end only while
// the host says; the menu is mana-ui's pause
// with its def carried, and the sheet lists the keys and the pad side by side; the feed carries the controls for a page in
// a game's shell and one not; the host emits the scroll block only for a scroll feed, and it parses; stage 1 carries it.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { scrollHud, scrollHudSpec, SCROLL_HUD_THEME, SCROLL_KEYS, SCROLL_ICONS } from './hud.js';
import { POD_IDS } from './pods.js';
import { manaHudScript } from '../../scene/channels/mana-hud.js';
import { readTheme } from '../../../mana-ui/theme.js';
import { scrollStagePlay } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';
import { BLAZE_GUNNER_LOOK } from '../blaze-gunner.js';

const BOSS = { id: 'hull-0', name: 'Corvette', systems: 3 };
const runtime = (spec, sg) => manaUi.runtime(spec, { read: (p) => manaUi.readPath({ sg }, p), act() {}, now: () => 1 });
const view = (spec, sg) => runtime(spec, sg).view();
const sg = (o = {}) => ({ score: 0, lives: 2, livesRow: [{}, {}], livesMore: '', hp: 10, slots: [], gears: [{ icon: 'sg-pip' }, { icon: 'sg-pip-off' }], bossOn: false, boss: 3, ready: false, end: false, endWord: '', scoreWord: '', keysOn: false, keys: [], moments: [], menu: [], aside: [], sheet: [], padName: 'Xbox', stage: '', ...o });
const at = (html, place) => html.split('class="mana-place"').find((c) => c.includes(`data-at="${place}"`)) ?? '';
const card = (o) => ({ live: false, mark: '', icon: 'sg-empty', name: 'EMPTY', ammoWord: '—', ammo: 0, max: 1, bar: false, ejOn: false, ej: 0, hue: '', ...o });

describe('the scroll stage\'s HUD', () => {
  it('is a spec the runtime reads, with or without a boss, in a ship console\'s look with nothing drawn across the play', () => {
    expect(() => manaUi.readSpec(scrollHudSpec())).not.toThrow();
    expect(() => manaUi.readSpec(scrollHudSpec({ hp: 8, boss: BOSS }))).not.toThrow();
    expect(SCROLL_HUD_THEME).toBe(BLAZE_GUNNER_LOOK);
    const T = readTheme(scrollHud().theme);
    expect(T).toMatchObject({ name: 'Orbit', overlay: 'none', stage: 'none' });
    // (a game's own look, a preset or a card's theme, keeps its colours and loses only its overlay and its stage)
    expect(readTheme(scrollHud({ theme: 'arcade' }).theme)).toMatchObject({ name: 'Arcade', overlay: 'none', stage: 'none' });
  });

  it('top left in pictures: the score\'s star, a ship a life, the hull\'s heart and its ticks, the gear\'s pips', () => {
    const tl = at(view(scrollHudSpec({ hp: 10 }), sg({ score: 1200, hp: 6 })), 'top-left');
    expect(tl).toContain('data-icon="sg-star"');
    expect(tl).toContain('1200');
    expect(tl.match(/data-icon="sg-ship"/g)).toHaveLength(2);
    expect(tl).toContain('data-icon="sg-heart"');
    expect(tl).toContain('width:60%');
    expect(tl).toContain('data-icon="sg-pip"');
    expect(tl).toContain('data-icon="sg-pip-off"');
  });

  it('a card a pod bottom left: its picture, its ammo as a count and a bar; an open slot no bar; the eject\'s hold only while held', () => {
    const S = scrollHudSpec();
    const bl = at(view(S, sg({ slots: [card({ live: true, mark: '▶', icon: 'sg-vulcan', name: 'VULCAN', ammoWord: '90', ammo: 90, max: 360, bar: true }), card()] })), 'bottom-left');
    expect(bl).toContain('data-icon="sg-vulcan"');
    expect(bl).toContain('>90<');
    expect(bl).toContain('width:25%');
    expect(bl.match(/class="mana-bar"/g)).toHaveLength(1);
    const ej = at(view(S, sg({ slots: [card({ live: true, mark: '▶', icon: 'sg-spread', bar: true, ammo: 10, max: 70, ejOn: true, ej: 0.5 })] })), 'bottom-left');
    expect(ej).toContain('data-variant="boss"');
    expect(ej).toContain('width:50%');
  });

  it('every picture it names is drawn by its sheet: the ship, the base gun, an empty slot, each pod, the pips', () => {
    const css = scrollHud().css;
    for (const k of ['ship', 'twin', 'empty', 'pip', 'star', 'heart', 'skull', ...POD_IDS]) expect(css, k).toContain(`[data-icon=sg-${k}]{--sg-icon:`);
    expect(Object.keys(SCROLL_ICONS)).toEqual(expect.arrayContaining(POD_IDS));
    expect(css).toContain('#moj-mana-hud[data-sg-hint=fade] .mana-place[data-at=bottom-right]>.mana-region{opacity:0}');
  });

  it('the boss top right only while it is on the screen, its skull and its name; no boss, no bar', () => {
    const S = scrollHudSpec({ boss: BOSS });
    expect(view(S, sg())).not.toContain('data-variant="boss"');
    const tr = at(view(S, sg({ bossOn: true, boss: 2 })), 'top-right');
    expect(tr).toContain('data-variant="boss"');
    expect(tr).toContain('data-icon="sg-skull"');
    expect(tr).toContain('Corvette');
    expect(view(scrollHudSpec(), sg({ bossOn: true }))).not.toContain('data-variant="boss"');
  });

  it('READY, the end and the controls only while the host says', () => {
    const S = scrollHudSpec(), keys = scrollHud().feed.scroll.controls.off.keys;
    const quiet = view(S, sg());
    expect(quiet).not.toMatch(/>Ready</i);
    expect(quiet).not.toContain('Stage clear');
    expect(quiet).not.toContain('data-at="bottom-right"');
    expect(view(S, sg({ ready: true }))).toMatch(/Ready/i);
    expect(view(S, sg({ end: true, endWord: 'Stage clear', scoreWord: 'Score 4200' }))).toContain('Stage clear');
    expect(at(view(S, sg({ keysOn: true, keys })), 'bottom-right')).toMatch(/eject/i);
  });

  it('the menu: mana-ui\'s pause, its def carried; the sheet the keys and the pad side by side; back from the sheet is the menu', () => {
    const S = scrollHudSpec();
    expect(S.defs['pause-menu'].node).toBeTruthy();
    const items = [{ label: 'Resume', then: { emit: 'sg:resume' } }, { label: 'Controls', then: { open: 'controls' } }, { label: 'Control hints: on', then: { emit: 'sg:controls' } }];
    const sheet = [{ does: 'fire', keys: [{ actions: ['J', 'click'], label: '' }], pad: [{ actions: ['A', 'RT'], label: '' }] }];
    const rt = runtime(S, sg({ menu: items, sheet, stage: 'The fleet\'s edge' }));
    rt.open('menu');
    expect(rt.view()).toContain('Resume');
    expect(rt.view()).toContain('Control hints: on');
    rt.open('controls');
    const v = rt.view();
    for (const c of ['J', 'click', 'A', 'RT', 'Keyboard', 'Xbox']) expect(v, c).toContain(c);
    rt.press('back');
    expect(rt.state().screen).toBe('menu');
  });

  it('its feed: the hull\'s ticks, the lives, the boss, the stage; the controls for a page in a game\'s shell and one not', () => {
    const H = scrollHud({ hp: 8.4, lives: 2, boss: BOSS, stage: 'Stage 1' });
    expect(H.theme.name).toBe('Orbit');
    expect(H.feed.scroll).toMatchObject({ hp: 8, lives: 2, boss: BOSS, stage: 'Stage 1' });
    const menuOf = (C) => C.pad.xbox.find((r) => r.label === 'menu').actions;
    expect(menuOf(H.feed.scroll.controls.off)).toEqual(['start']);
    expect(menuOf(H.feed.scroll.controls.in)).toEqual(['select']);
    expect(scrollHud({ more: 'G  call' }).feed.scroll.controls.off.keys.at(-1)).toEqual({ action: 'G', label: 'call' });
    expect(scrollHud({ boss: { id: 'x', name: 'X', systems: 0 } }).feed.scroll.boss).toBeUndefined();
    expect(SCROLL_KEYS).toContain('F  eject (hold)');
  });

  it('the host reads a scroll feed only where there is one: its menu, its pad button, its glyphs; the script parses', () => {
    const H = scrollHud({ hp: 10, lives: 2, boss: BOSS });
    const js = manaHudScript(H, { game: false });
    for (const s of ["'scroll-ship'", '--sg-tint-', 'function sgOpen', 'SG_MENU', "rt.open('menu')", 'moj.scroll.controls', 'Control hints: ', 'root.dataset.sgHint']) expect(js, s).toContain(s);
    expect(() => new Function(js)).not.toThrow();
    const none = manaHudScript({ ...H, feed: {} }, { game: false });
    expect(none).not.toContain("'scroll-ship'");
    expect(none).not.toContain('sgOpen');
  });

  it('a stage carries it: its boss the hull the track holds for, named, its systems the bar; a page without the ship none', () => {
    const M = stageManifest(STAGE_IDS[0]), H = scrollStagePlay(M).manaHud;
    expect(H.feed.scroll.boss.systems).toBeGreaterThan(0);
    expect(H.feed.scroll.boss.name).toMatch(/^[A-Z]/);
    expect(H.feed.scroll.controls.off.keys.length).toBeGreaterThan(0);
    expect(scrollStagePlay(M, { airframe: false }).manaHud).toBeUndefined();
  });
});
