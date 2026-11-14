import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { SCREEN_KEYS, screenKeyRows, withScreenKeys } from './screen-keys.js';
import { normalizeHud } from './hud-widgets.js';
import { hudToMana } from './hud-mana.js';
import { eventsChannelScript } from '../scene/channels/events.js';
import { manaHudScript } from '../scene/channels/mana-hud.js';

// SCREEN KEYS: a level made for a screen never asks for a key a thumb cannot press. Each key it listens for that the
// virtual pad has no control for gets a HUD button, drawn only on a touch screen, and pressing it is that key pressed.
const QUEST = [{ id: 'q', title: 'Find the key', steps: [{ id: 'a', goal: 'Look', done: 'found' }] }];

describe('screen keys', () => {
  it('finds the keys a level listens for: its own inputs and its play channels\'; a level that asks none gains nothing', () => {
    const events = { hud: [{ var: 'score' }], inputs: [{ on: 'key', key: 'q', emit: { type: 'whistle' } }, { on: 'key', key: 'm', label: 'map', emit: { type: 'map' } }, { on: 'pointer', emit: { type: 'tap' } }], quests: QUEST, rpg: {} };
    expect(screenKeyRows(events)).toEqual([
      { key: 'q', code: 'KeyQ', label: 'whistle', touch: true }, { key: 'm', code: 'KeyM', label: 'map', touch: true },
      { key: 'j', code: 'KeyJ', label: 'journal', touch: true }, { key: 'p', code: 'KeyP', label: 'party', touch: true },
    ]);
    const plain = { hud: [{ var: 'score' }] };
    expect(withScreenKeys(plain)).toBe(plain);
    expect(withScreenKeys(events).hud.length).toBe(5);
    // a key the level's HUD already has a button for is left to it
    expect(screenKeyRows({ hud: [{ key: 'J', label: 'notes' }], quests: QUEST })).toEqual([]);
  });
  it('each channel still listens for the key its row presses', () => {
    const page = eventsChannelScript({ quests: QUEST });
    const row = SCREEN_KEYS.find((k) => k.of === 'quests');
    expect(page).toContain(`ev.code === '${row.code}'`);
  });
  it('a keyed button is read, lowered to mana-ui for a touch screen alone, and presses its key', () => {
    const rows = screenKeyRows({ quests: QUEST });
    const { widgets, errors } = normalizeHud(rows);
    expect(errors).toEqual([]);
    expect(widgets).toEqual([{ kind: 'button', key: 'j', code: 'KeyJ', label: 'journal', slot: 'bottom-right', touch: true }]);
    expect(normalizeHud([{ key: 3, label: 'x' }]).errors.join('\n')).toMatch(/key is the key the button presses/);
    expect(JSON.stringify(hudToMana(rows).spec)).toContain('{"use":"button","props":{"label":"journal"},"on":{"accept":{"key":"j","code":"KeyJ"}},"when":{"bind":"touch.on"}}');
    // the mana-ui HUD's host presses the key; a HUD of the level's own making carries the button too
    const hosted = manaHudScript({ spec: { hud: { use: 'hud', children: [] } }, theme: 'greybox' }, { rows });
    expect(hosted).toContain('"accept":{"key":"j","code":"KeyJ"}');
    expect(hosted).toContain("new KeyboardEvent(t, { key: e.key, code: e.code || e.key");
  });
  it('the page\'s own HUD draws it only while the touch layer is up, and a press is the key pressed', async () => {
    const page = eventsChannelScript(withScreenKeys({ hud: [{ var: 'score' }], quests: QUEST }));
    expect(page).toContain("if (w.touch) { el.style.display = 'none';");
    expect(page).not.toContain('__mojBus.press = ');   // a keyed button needs no way into the bus
    // the press itself, as the page writes it
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
    const w = dom.window, heard = [];
    w.addEventListener('keydown', (ev) => heard.push(ev.code));
    w.eval("['keydown', 'keyup'].forEach(function (t) { window.dispatchEvent(new KeyboardEvent(t, { key: 'j', code: 'KeyJ', bubbles: true, cancelable: true })); });");
    expect(heard).toEqual(['KeyJ']);
    w.close();
  });
});
