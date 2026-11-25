// The scroll stage's HUD (scroll-stage/hud.js). The concepts: a spec the runtime reads, with or without a boss; its parts
// in their corners (score, lives, hull and speed top left, the pods bottom left, the boss top right only while it is on
// the screen, the keys bottom right while their latch says); an open slot draws no ammo bar; READY and the end only while
// the host says; a controls line read as key caps; the feed the host reads carries the hull's ticks, the lives and the
// boss; the host emits the scroll block only for a scroll feed, and it parses; a level of a designed game draws it in
// its own look, and stage 1 carries it.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../../mana-ui/index.js';
import { scrollHud, scrollHudSpec, SCROLL_HUD_THEME, SCROLL_KEYS } from './hud.js';
import { manaHudScript } from '../../scene/channels/mana-hud.js';
import { readTheme } from '../../../mana-ui/theme.js';
import { scrollStagePlay } from './stage-scene.js';
import { stageManifest, STAGE_IDS } from './stages.js';

const BOSS = { id: 'hull-0', name: 'Corvette', systems: 3 };
const view = (spec, sg) => manaUi.runtime(spec, { read: (p) => manaUi.readPath({ sg }, p), act() {}, now: () => 1 }).view();
const sg = (o = {}) => ({ score: 0, lives: 2, livesWord: '×2', hp: 10, slots: [], gear: '▮▯▯', bossOn: false, boss: 3, ready: false, end: false, endWord: '', scoreWord: '', keysOn: false, keys: [], moments: [], ...o });
const at = (html, place) => html.split('class="mana-place"').find((c) => c.includes(`data-at="${place}"`)) ?? '';

describe('the scroll stage\'s HUD', () => {
  it('is a spec the runtime reads, with or without a boss, in a theme mana-ui knows', () => {
    expect(() => manaUi.readSpec(scrollHudSpec())).not.toThrow();
    expect(() => manaUi.readSpec(scrollHudSpec({ hp: 8, boss: BOSS }))).not.toThrow();
    expect(() => readTheme(SCROLL_HUD_THEME)).not.toThrow();
  });

  it('the score, the lives, the hull and the speed top left; the pods bottom left, an open slot no bar', () => {
    const S = scrollHudSpec({ hp: 10 });
    const H = view(S, sg({ score: 1200, hp: 6, slots: [{ mark: '▶', name: 'VULCAN', ammo: 90, max: 360, bar: true, hue: '#ffe27a' }, { mark: '', name: '—', ammo: 0, max: 1, bar: false, hue: '' }] }));
    const tl = at(H, 'top-left'), bl = at(H, 'bottom-left');
    expect(tl).toContain('1200');
    expect(tl).toContain('×2');
    expect(tl).toContain('data-variant="hp"');
    expect(tl).toContain('width:60%');
    expect(bl).toContain('VULCAN');
    expect(bl).toContain('width:25%');
    expect(bl.match(/class="mana-bar"/g) ?? []).toHaveLength(1);   // (the open slot draws no bar)
  });

  it('the boss top right only while it is on the screen; no boss, no bar', () => {
    const S = scrollHudSpec({ boss: BOSS });
    expect(view(S, sg())).not.toContain('data-variant="boss"');
    const on = view(S, sg({ bossOn: true, boss: 2 }));
    expect(at(on, 'top-right')).toContain('data-variant="boss"');
    expect(at(on, 'top-right')).toContain('Corvette');
    expect(view(scrollHudSpec(), sg({ bossOn: true }))).not.toContain('data-variant="boss"');
  });

  it('READY, the end and the keys only while the host says', () => {
    const S = scrollHudSpec();
    const quiet = view(S, sg());
    expect(quiet).not.toMatch(/>Ready</i);
    expect(quiet).not.toContain('Stage clear');
    expect(quiet).not.toContain('data-at="bottom-right"');
    expect(view(S, sg({ ready: true }))).toMatch(/Ready/i);
    expect(view(S, sg({ end: true, endWord: 'Stage clear', scoreWord: 'Score 4200' }))).toContain('Stage clear');
    expect(at(view(S, sg({ keysOn: true, keys: scrollHud({ keys: SCROLL_KEYS }).feed.scroll.keys })), 'bottom-right')).toMatch(/eject/i);
  });

  it('its feed: the hull\'s ticks, the lives, the boss and the keys as caps; a boss without systems is none', () => {
    const H = scrollHud({ hp: 8.4, lives: 2, boss: BOSS, keys: SCROLL_KEYS });
    expect(H.theme).toBe(SCROLL_HUD_THEME);
    expect(H.feed.scroll).toMatchObject({ hp: 8, lives: 2, boss: BOSS });
    const caps = H.feed.scroll.keys.flatMap((r) => r.actions ?? [r.action]);
    expect(caps).toEqual(expect.arrayContaining(['J', 'click', 'R', '1', '2', 'F']));
    expect(scrollHud({ boss: { id: 'x', name: 'X', systems: 0 } }).feed.scroll.boss).toBeUndefined();
    expect(scrollHud().spec.hud.children.some((c) => c.props && c.props.at === 'top-right')).toBe(false);
  });

  it('the host reads a scroll feed only where there is one, and the script parses', () => {
    const H = scrollHud({ hp: 10, lives: 2, boss: BOSS, keys: SCROLL_KEYS });
    const js = manaHudScript(H, { game: false });
    expect(js).toContain("'scroll-ship'");
    expect(js).toContain('--sg-tint-');
    expect(() => new Function(js)).not.toThrow();
    expect(manaHudScript({ ...H, feed: {} }, { game: false })).not.toContain("'scroll-ship'");
  });

  it('a stage carries it: its boss the hull the track holds for, named, its systems the bar; a page without the ship none', () => {
    const M = stageManifest(STAGE_IDS[0]), H = scrollStagePlay(M).manaHud;
    expect(H.feed.scroll.boss.systems).toBeGreaterThan(0);
    expect(H.feed.scroll.boss.name).toMatch(/^[A-Z]/);
    expect(H.feed.scroll.keys.length).toBeGreaterThan(0);
    expect(scrollStagePlay(M, { airframe: false }).manaHud).toBeUndefined();
  });
});
