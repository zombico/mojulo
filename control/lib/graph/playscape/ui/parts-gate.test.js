// A part a cue shows, hides or restates, and a part that stands in some phases only: the rows carry the part's id and
// its phases, the bus sets the vars, and the page's gate reads them (the page's own __hudOn, taken from the script).
import { describe, it, expect } from 'vitest';
import { createBusState, processEvents, watchEvents } from '../../worlds/event-bus.js';
import { lowerPlay } from './direction.js';
import { lowerParts } from './parts.js';
import { normalizeHud } from '../../game/hud-widgets.js';
import { eventsChannelScript } from '../../scene/channels/events.js';

const PLAY = {
  phases: ['title', 'playing', 'won'],
  parts: [
    { part: 'readout', id: 'gold', bind: { var: 'gold' }, at: 'top-left', label: 'Gold' },
    { part: 'legend', id: 'hint', text: 'Press E', at: 'bottom' },
    { part: 'banner', bind: { on: 'cue:win' }, text: 'Cleared!', when: ['won'] },
    { part: 'legend', text: 'Press start', when: ['title'] },
  ],
  cues: [
    { id: 'go', when: { start: true }, then: [{ phase: 'playing' }, { hide: 'hint' }] },
    { id: 'rich', when: { var: 'gold', gte: 5 }, then: [{ show: 'hint' }, { state: 'gold', to: 'alert' }] },
    { id: 'win', when: { on: 'won' }, then: { phase: 'won' } },
  ],
};

const gateOf = (script) => {
  const src = script.match(/function __hudOn\(w\) \{[\s\S]*?\n\}/)[0];
  return (vars) => new Function('__busState', `${src}; return __hudOn;`)({ vars });
};

describe('parts a cue gates', () => {
  it('the rows keep the part id and its phases as indices; a name that is no phase teaches', () => {
    const rows = lowerParts(PLAY.parts, PLAY.phases);
    expect(rows[0]).toMatchObject({ var: 'gold', id: 'gold' });
    expect(rows[2]).toMatchObject({ on: 'cue:win', when: [2] });
    expect(rows[3]).toMatchObject({ text: 'Press start', when: [0] });
    // a banner part carved: its as, look and style ride the row (hud-widgets.js `as: 'title'`)
    expect(lowerParts([{ part: 'banner', bind: { on: 'fight' }, text: '@fight', as: 'title', look: 'stamp', style: 'blocky', color: 'harm' }], PLAY.phases)).toEqual([{ on: 'fight', text: '@fight', as: 'title', look: 'stamp', style: 'blocky', color: 'harm' }]);
    expect(() => lowerParts([{ part: 'legend', text: 'x', when: ['paused'] }], PLAY.phases)).toThrow(/'paused', which is no phase/);
    const { widgets, errors } = normalizeHud(rows);
    expect(errors).toEqual([]);
    expect(widgets.map((w) => [w.id, w.when])).toEqual([['gold', undefined], ['hint', undefined], [undefined, [2]], [undefined, [0]]]);
    expect(normalizeHud([{ text: 'x', id: 'Bad' }, { text: 'y', when: ['won'] }]).errors).toEqual(['hud[0].id is a lower-case word (a cue names a part by it)', 'hud[1].when is a list of phase indices']);
  });

  it('the bus moves the vars and the page gate follows them', () => {
    const ev = lowerPlay({ play: PLAY });
    const on = gateOf(eventsChannelScript(ev));
    const { widgets } = normalizeHud(ev.hud);
    const [gold, hint, cleared, title] = widgets;
    const bus = createBusState(ev, []);
    const run = (evs) => { processEvents(bus, evs); for (let k = 0; k < 6; k++) { const w = watchEvents(bus); if (!w.length) break; processEvents(bus, w); } };
    const shown = () => [gold, hint, cleared, title].map((w) => on(bus.vars)(w));
    // before the start: the title phase, every part as declared
    expect(shown()).toEqual([true, true, false, true]);
    run(ev.initial || []);
    expect(bus.vars.phase).toBe(1);
    expect(shown()).toEqual([true, false, false, false]);
    run([{ type: 'gold-up' }]);
    bus.vars.gold = 5;
    run([]);
    expect(bus.vars['ui-gold-state']).toBe(5);   // UI_STATES: alert
    expect(shown()).toEqual([true, true, false, false]);
    run([{ type: 'won' }]);
    expect(shown()).toEqual([true, true, true, false]);
    // a part restated to hidden goes as a hide does
    expect(on({ 'ui-gold-state': 0 })(gold)).toBe(false);
  });
});
