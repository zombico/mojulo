// The practice door's menu on mana-ui: a spec mana-ui reads, opened by the pilot scheme's own pause, its hint line named
// by the scheme's keys, its choices sent back as the route reads them, the page's own panel and keys gone.
import { describe, it, expect } from 'vitest';
import { manaUi } from '../../mana-ui/index.js';
import { manaGlyphs } from '../controls/mana-controls.js';
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';
import { practiceMana, practiceManaSpec, practiceManaHtml, practiceLegend, playCss } from './practice-mana.js';
import { THEME_CARDS, THEME_CARD_IDS, cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { themeAdvice } from '../../mana-ui/theme.js';
import { WORK_LEGEND } from './work-room.js';
import { ROOM_LEGEND } from './game-room.js';

const choice = { id: 'feel', label: 'Movement', now: 'b', options: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };

describe('the practice menu', () => {
  it('is a spec mana-ui reads, its screens the pause, the room, set up and controls', () => {
    const S = practiceManaSpec();
    expect(() => manaUi.readSpec(S)).not.toThrow();
    expect(Object.keys(S.screens).sort()).toEqual(['about', 'controls', 'pause', 'setup']);
  });
  it('opens on the pilot scheme\'s pause, on the keys and the pad, never a key of its own', () => {
    const { open } = practiceMana({ title: 't' }), K = buildControlsKernel();
    const B = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad });
    expect(open.keys.length).toBeGreaterThan(0);
    for (const c of open.keys) expect(K.codeMap(B, 'keyboard')[c]).toBe('pause');
    expect(open.pad).toEqual(B.bind.gamepad.pause.map((b) => DEVICES.gamepad.buttons[b]));
  });
  it('names each action by the key the scheme binds it to, on the rooms\' hint lines too', () => {
    const g = manaGlyphs().keys;
    expect(practiceLegend([['pause', 'the room']])).toBe(`${g.pause}  the room`);
    for (const line of [WORK_LEGEND, ROOM_LEGEND]) { expect(line).toContain(`${g.pause}  the room`); expect(line).not.toMatch(/HUD|Shift\+F/); }
    expect(ROOM_LEGEND).toContain(`${g.aiToggle}  foes`);
  });
  it('holds the choices as names and sends them back as ids; without the studio\'s query, set up says it cannot', () => {
    const C = practiceMana({ title: 't', choices: [choice], foes: true, query: { book: 'practice', room: 'work' } });
    expect(C.state.pr.pick.feel).toBe('B');
    expect(C.ids.feel).toEqual({ A: 'a', B: 'b' });
    expect(C.state.pr.fields.map((f) => f.kind)).toEqual(['cycler', 'toggle']);
    expect(C.state.pr.fixed).toBe(false);
    const D = practiceMana({ title: 't', choices: [choice] });
    expect(D.state.pr.fixed).toBe(true);
    expect(D.state.pr.why).toMatch(/studio/);
    expect(D.state.pr.fields.some((f) => f.kind === 'toggle')).toBe(false);
    expect(practiceManaHtml(C)).toMatch(/__mojPracticeUi/);
  });
  it('wears the shift family: every card of it reads (words on its focus and its tabs), and the play around the menu takes its look', () => {
    const shift = THEME_CARD_IDS.filter((id) => THEME_CARDS[id].family === 'shift');
    expect(shift.length).toBeGreaterThan(1);
    for (const id of shift) expect(themeAdvice(cardTheme(id)).filter((a) => a.law === 'focus-reads' || a.law === 'tab-reads'), id).toEqual([]);
    const T = cardTheme(shift.find((id) => THEME_CARDS[id].from === 'shift')), css = playCss(T);
    expect(css).toContain(`--moj-ink:${T.tokens.ink}`);
    expect(css).toContain(`4px 4px 0 ${T.tokens.accent}`);
    expect(practiceManaHtml(practiceMana({ title: 't', theme: T }))).toContain(css);
  });
});
