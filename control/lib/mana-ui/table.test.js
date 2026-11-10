import { describe, it, expect } from 'vitest';
import { manaUi, withIdioms, IDIOMS, coverageOverlap } from './index.js';

// The table's parts, each concept once on the smallest spec that shows it: a card's states are shapes, a log is kept
// and shown from its end, a small series is read against its largest, a disabled thing says why, a question with no
// way out ignores back. Every idiom on the sample state is the deep sweep's (idioms.deep.test.js).

const hud = (...children) => ({ use: 'hud', children: [{ use: 'region', props: { at: 'bottom' }, children }] });
const draw = (spec, state = {}, log = []) => {
  const rt = manaUi.runtime(spec, { read: (p) => manaUi.readPath(state, p), act: (e, from) => log.push({ e, from }) });
  return { rt, html: rt.view(), log };
};

describe('mana-ui: a card on the table', () => {
  it('its face in reading order; its state a shape, never a colour alone; face down, a back and a count', () => {
    const card = (props) => draw({ screens: {}, hud: hud({ use: 'card', props }) }).html;
    const up = card({ name: 'Smithy', cost: '4', text: 'Draw three cards.', tags: ['action'], power: 2, guard: 3, count: '×2', side: 1, state: 'playable' });
    expect(up).toMatch(/class="mana-card"[^>]* data-state="playable"/);
    expect(up).toMatch(/class="mana-band" data-side="1"><span class="mana-name">Smithy<\/span><span class="mana-cost">4</);
    expect(up).toContain('<span class="mana-rules">Draw three cards.</span>');
    expect(up).toContain('<span class="mana-might">2 / 3</span>');
    expect(card({ name: 'Estate' })).not.toContain('data-state');          // plain says nothing
    const down = card({ name: 'Secret', face: 'down', count: '21' });
    expect(down).toContain('data-face="down"');
    expect(down).not.toContain('Secret');                                  // what is hidden stays hidden
    expect(down).toContain('<span class="mana-count">21</span>');
    expect(() => manaUi.readNode({ use: 'card', props: { name: 'x', state: 'glowing' } })).toThrow(/one of: plain, playable, picked, spent/);
  });
  it('a tap plays it from the HUD and takes no focus; a spent card is not tapped', () => {
    const spec = { screens: {}, hud: hud({ use: 'card', props: { name: 'Copper' }, on: { accept: { emit: 'play' } } }, { use: 'card', props: { name: 'Hound', state: 'spent' }, on: { accept: { emit: 'never' } } }) };
    const { rt, html, log } = draw(spec);
    expect(rt.state().focusables).toBe(0);
    expect((html.match(/data-tap=/g) || []).length).toBe(1);
    expect(rt.hudTap(0)).toBe(true);
    expect(log.map((x) => x.e.emit)).toEqual(['play']);
  });
});

describe('mana-ui: history kept', () => {
  it('a log shows its end, numbered from the game\'s first row, and counts what is above', () => {
    const rows = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'].map((text, i) => ({ text, side: i % 2 }));
    const { html } = draw({ screens: {}, hud: hud({ use: 'log', props: { rows, numbered: true, visible: 2 } }) });
    expect(html).toContain('▲ 3 more');
    expect(html).not.toContain('Nf3');
    expect(html).toMatch(/<span class="mana-no">4\.<\/span><i class="mana-chip" data-side="1"><\/i>Nc6/);
    expect(html).toMatch(/data-last="yes"><span class="mana-no">5\.<\/span>.*Bb5/);
  });
  it('a small series is drawn against its largest value and says its last', () => {
    const { html } = draw({ screens: {}, hud: hud({ use: 'spark', props: { label: 'Army', values: [2, 4, 8, 4] } }) });
    expect(html).toContain('<i style="height:25%"></i><i style="height:50%"></i><i style="height:100%"></i><i style="height:50%"></i>');
    expect(html).toContain('<span class="mana-num">4</span>');
  });
});

describe('mana-ui: what cannot be done says why', () => {
  it('a disabled button, row and slot carry their reason; an enabled one carries none', () => {
    const s = { use: 'screen', children: [
      { use: 'button', props: { label: 'Town', disabled: true, why: 'Needs brick' } },
      { use: 'button', props: { label: 'Road', why: 'never shown' } },
      { use: 'list', props: { rows: [{ label: 'Buy', disabled: true, why: 'Not in the purse' }] } },
    ] };
    const { rt, html } = draw({ start: 'a', screens: { a: s } });
    expect(html).toContain('<span class="mana-why">Needs brick</span>');
    expect(html).toContain('<span class="mana-why">Not in the purse</span>');
    expect(html).not.toContain('never shown');
    rt.press('accept');                                                    // pressing it is a deny, seen on it
    expect(rt.view()).toMatch(/data-press="deny-[ab]"[^>]*>Town<span class="mana-why">/);
    const slot = draw({ screens: {}, hud: hud({ use: 'slot', props: { name: 'Roll', disabled: true, why: 'Already rolled' }, on: { accept: { emit: 'roll' } } }) });
    expect(slot.html).toContain('data-st="disabled"');
    expect(slot.html).toContain('<span class="mana-why">Already rolled</span>');
    expect(slot.html).not.toContain('data-tap');                           // a tap cannot do it either
  });
});

describe('mana-ui: the table\'s language', () => {
  const state = { choices: [{ id: 'q', label: 'Queen', then: { emit: 'promote:q' } }, { id: 'n', label: 'Knight', then: { emit: 'promote:n' } }] };
  const ask = (props) => manaUi.runtime(withIdioms({ start: 's', screens: { s: { use: 'choice-prompt', props: { title: 'Promotion', ask: 'Which piece?', choices: { bind: 'choices' }, columns: 2, ...props } } } }), { read: (p) => manaUi.readPath(state, p), act: (e) => asked.push(e) });
  let asked = [];
  it('one question at a time: back leaves it only where the game lets the choice be put off', () => {
    asked = [];
    const must = ask({});
    must.press('back');
    expect(must.state().screen).toBe('s');
    must.press('right'); must.press('accept');
    expect(asked.filter((e) => e.emit).map((e) => e.emit)).toEqual(['promote:n']);
    const may = ask({ cancel: { back: true } });
    may.press('back');
    expect(may.state().screen).toBe(null);
  });
  it('the seats are the coverage\'s on a covered table; the turn order is one part wherever it is drawn', () => {
    expect(IDIOMS['seat-plates'].coverage).toBe(true);
    expect(coverageOverlap({ hud: { use: 'hud', children: [{ use: 'seat-plates' }, { use: 'card-hand' }] } })).toEqual(['seat-plates']);
    const turns = [{ name: 'Ayla', variant: 'strong', turn: true, side: 0 }, { name: 'Warden', variant: 'muted', side: 1 }];
    const { html } = draw(withIdioms({ screens: {}, hud: { use: 'hud', children: [{ use: 'turn-order', props: { turns, at: 'top-left' } }] } }));
    expect(html).toMatch(/data-at="top-left"/);
    expect(html).toMatch(/data-turn="[^"]+"[^>]*><i class="mana-chip" data-side="0"><\/i>Ayla/);
  });
});
