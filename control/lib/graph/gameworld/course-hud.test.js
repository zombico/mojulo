import { describe, expect, it } from 'vitest';
import { courseOf, obstacleStage } from './roll-course.js';
import { courseHud, COURSE_HUD_STATE } from './course-hud.js';
import { DRESS_THEMES } from './course-dress.js';
import { manaUi, readTheme, THEMES } from '../../mana-ui/index.js';
import { THEME_CARDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { manaHudScript } from '../scene/channels/mana-hud.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { POLES } from './feel/cards.js';
import { runSteps } from './index.js';

// THE RUNNER'S HUD: a course's in-play HUD as one composition on mana-ui, hosted by the level page.
const MOMENTUM = Object.keys(POLES).find((p) => POLES[p].base === 'pinball');
const C = courseOf({ feel: MOMENTUM }, { slots: 6 });
const regions = (hud) => hud.children.filter((n) => n.use === 'region').map((n) => n.props.at);
const draw = (H, state, open) => { const rt = manaUi.runtime(H.spec, { read: (p) => manaUi.readPath(state, p), act() {}, now: () => 1 }); if (open) rt.open(open); return rt.view(); };

describe('the composition: laid by the course\'s thirds', () => {
  it('reads as a mana-ui spec and draws on its state; nothing is laid in the bottom band, wide or tall', () => {
    for (const screen of [null, 'phone']) {
      const H = courseHud(C, { screen });
      expect(regions(H.spec.hud).filter((at) => at.startsWith('bottom'))).toEqual([]);
      const html = draw(H, { ...COURSE_HUD_STATE, moments: [] });
      expect(html).toContain('128 m');
      expect(H.spec.screens.ready.props).toMatchObject({ layer: 'overlay', legend: 'none' });
    }
    expect(regions(courseHud(C).spec.hud)).toEqual(['top-left', 'top', 'top-right', 'right', 'center']);
    // (the coins taken, read off the level's bus)
    expect(draw(courseHud(C), { ...COURSE_HUD_STATE, moments: [], coins: { count: 37 } })).toContain('37');
    // (a tall frame: one plate in the top's middle, clear of the shell's menu button in the corner)
    expect(regions(courseHud(C, { screen: 'phone' }).spec.hud)).toEqual(['top', 'right', 'center']);
  });

  it('the run\'s maps show only in a run, the hint only while it is asked for, stamina only for a hero that sprints', () => {
    const H = courseHud(C), base = { ...COURSE_HUD_STATE, moments: [] };
    expect(draw(H, base)).toContain('■');
    expect(draw(H, { ...base, run: { show: false, at: 1, of: 1 } })).not.toContain('■');
    expect(draw(H, base)).toMatch(/clear track/);
    expect(draw(H, { ...base, hint: { show: false } })).not.toMatch(/clear track/);
    const sprints = JSON.stringify(H.spec).includes('hero.stamina');
    expect(sprints).toBe(!!C.rule.stamina);
    expect(JSON.stringify(courseHud({ ...C, rule: { ...C.rule, stamina: false } }).spec)).not.toContain('hero.stamina');
  });

  it('the start cue is a screen (it holds the hero) that says the count and the premise\'s line', () => {
    const H = courseHud(C), html = draw(H, { ...COURSE_HUD_STATE, moments: [], start: { count: '3', sub: 'x' } }, 'ready');
    expect(html).toContain('>3<');
    expect(H.feed).toMatchObject({ kind: 'course', from: C.start[1], to: C.exit[1], cue: { beats: ['3', '2', '1'], go: 'GO', sub: 'the last train is leaving' }, hint: { seconds: 9 }, stamina: !!C.rule.stamina });
  });
});

describe('the look: chosen by the game\'s style, read from the dress', () => {
  it('last train wears the toybox, a card of the toy family; a tall frame is sized for the hand', () => {
    expect(DRESS_THEMES['last-train'].ui).toBe('toybox');
    expect(THEME_CARDS.toybox).toMatchObject({ family: 'toy', from: 'idol' });
    const T = readTheme(cardTheme('toybox'));
    expect(T).toMatchObject({ corner: 'round', scale: 'large' });
    expect(courseHud(C).theme).toEqual(cardTheme('toybox'));
    expect(courseHud(C, { screen: 'phone' }).theme).toMatchObject({ distance: 'hand' });
    // (a dress with no look of its own, and one named: a preset stays its name, a card is resolved to its theme)
    expect(courseHud(courseOf({ feel: MOMENTUM }, { slots: 6, dress: 'greybox' })).theme).toBe('console');
    expect(courseHud(C, { theme: 'arcade' }).theme).toBe('arcade');
    expect(THEMES.arcade).toBeDefined();
  });
});

describe('the host: a level page that carries one', () => {
  const H = courseHud(C);
  it('a made course level carries its HUD; the page hosts it, and a page without one carries not a byte', () => {
    const M = obstacleStage({ feel: MOMENTUM }, { slots: 6 });
    expect(M.manaHud).toEqual(courseHud(courseOf({ feel: MOMENTUM }, { slots: 6 })));
    // (and how it is played in the hand: its tracks and its hero's sideways push, for the touch layer's swipes)
    expect(M.courseTouch).toEqual({ lanes: [-2, 0, 2], accel: C.rule.accel || 7 });
    expect(manaHudScript(H)).toContain("touch: { jump: 'tap', steer: 'swipe' }");
    const js = manaHudScript(H, { game: true });
    expect(js).toContain('window.__mojHud');
    expect(js).toContain('GAME = true');
    expect(js).toContain('.moj-c-gauge,.moj-hud-col{display:none!important}');   // the runtime's own gauge stands down
    expect(manaHudScript(null)).toBe('');
    expect(manaHudScript({})).toBe('');
    const page = (extra) => emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], fill: '#888888' }], inline: false, cdn: true, ...extra });
    expect(page({ manaHud: H })).toContain('moj-mana-hud');
    expect(page({})).not.toContain('moj-mana-hud');
    expect(page({})).not.toContain('__mojHud');
  });

  it('the page\'s script is whole: it parses', () => {
    expect(() => new Function(manaHudScript(H, { game: false }))).not.toThrow();
  });
});

describe('the shell: a course game\'s screens are the game UI runtime\'s, in its dress\'s look', () => {
  const world = (extra = {}) => ({ id: 'dash', name: 'Dash', feel: MOMENTUM, levels: { one: { name: 'The Lane', obstacles: { slots: 6 } } }, start: 'one', ...extra });
  const game = (w) => runSteps(w, { ref: 'gw' }).find((s) => s.key === 'game').order;

  it('a world of courses that says no ui still gets one: its first course\'s look; its own word wins; a course with no look gives none', () => {
    expect(game(world())).toMatchObject({ shell: 'play', ui: { theme: cardTheme('toybox') } });
    expect(game(world({ ui: { theme: 'grim' } })).ui.theme).not.toEqual(cardTheme('toybox'));
    expect(game(world({ levels: { one: { name: 'The Lane', obstacles: { slots: 6, dress: 'greybox' } } } })).ui).toBeUndefined();
    // (the level keeps its coins for the result: a platformer's coins, scored high)
    const lv = runSteps(world(), { ref: 'gw' }).find((s) => s.key.startsWith('level-')).order.manifest;
    expect(lv.game.mechanics.map((m) => m.kind)).toEqual(['coins', 'score', 'reach-exit']);
    expect(lv.game.mechanics[1]).toMatchObject({ var: 'coins', label: 'Coins', best: 'high' });
  });
});
