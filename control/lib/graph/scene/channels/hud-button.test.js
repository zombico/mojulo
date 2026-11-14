import { describe, it, expect } from 'vitest';
import { eventsChannelScript } from './events.js';
import { manaHudScript } from './mana-hud.js';

// A HUD BUTTON REACHES THE LEVEL: a level's button row (events.hud { press, label }) is drawn by its HUD, the page's own
// or mana-ui's, and a press raises its event on the level's bus as a key bound to it would. A level with no such row
// carries none of it.
const BUTTON = { press: 'whistle', label: 'whistle' }, SCORE = { var: 'score', label: 'Score' };

describe('a HUD button reaches the level', () => {
  it('a level with a button row gives its bus a way in, and its own HUD a thing to press; one without carries neither', () => {
    const plain = eventsChannelScript({ hud: [SCORE] }), pressed = eventsChannelScript({ hud: [SCORE, BUTTON] });
    expect(plain).not.toContain('__mojBus.press');
    expect(plain).not.toContain("w.kind === 'button'");
    expect(pressed).toContain("window.__mojBus.press = function (type) { __inputQueue.push({ type: String(type) }); };");
    expect(pressed).toContain("else if (w.kind === 'button') {");
    expect(pressed).toContain("else __inputQueue.push({ type: w.press });");
  });
  it('the mana-ui HUD draws it as a button and carries its press to the bus', () => {
    const s = manaHudScript({ rows: 'events', theme: 'greybox' }, { rows: [SCORE, BUTTON] });
    expect(s).toContain('{"use":"button","props":{"label":"whistle"},"on":{"accept":{"emit":"whistle"}}}');
    expect(s).toContain('window.__mojBus.press(e.emit)');
    expect(s).toContain('act: press');
  });
});
