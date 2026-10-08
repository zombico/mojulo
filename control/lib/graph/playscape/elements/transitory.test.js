import { describe, it, expect } from 'vitest';
import { composeLive } from '../../worlds/controllable/compose.js';
import { readCues } from '../ui/cues.js';
import { lowerPlay, resolvePlayUi } from '../ui/direction.js';
import { uiBoardHtml } from '../ui/board-html.js';
import { uiAdvice } from '../ui/laws.js';
import { TRANSITS } from '../ui/cast.js';

const CW = composeLive();
const DT = 1 / 30;
const ENTS = [
  { id: 'hero', rule: { type: 'walk' }, transform: { pos: [2, 3, 0], heading: 1 }, body: { type: 'none' } },
  { id: 'beast', dormant: true, rule: { type: 'static' }, transform: { pos: [40, 40, 0] }, body: { type: 'none' } },
];
const world = () => CW.createWorld({ entities: JSON.parse(JSON.stringify(ENTS)) });

describe('transits in the engine', () => {
  it('spawn and vanish carry how they come and go; the page reads e.transit', () => {
    const w = world();
    CW.stepWorld(w, {}, DT);
    CW.castOps(w, [{ op: 'vanish', who: 'hero', with: 'smoke' }]);
    expect(w.byId.hero.gone).toBe(true);
    expect(w.byId.hero.transit).toEqual({ is: 'smoke', dir: 'out', t0: w.time });
    CW.castOps(w, [{ op: 'spawn', who: 'beast', at: [1, 1], with: 'hologram' }]);
    expect(w.byId.beast.transit).toMatchObject({ is: 'hologram', dir: 'in' });
    expect(w.byId.beast.gone).toBe(false);
  });

  it('transfigure wakes into where who stands, facing as it faces, and sends who away; both carry the transit', () => {
    const w = world();
    CW.stepWorld(w, {}, DT);
    CW.castOps(w, [{ op: 'transfigure', who: 'hero', into: 'beast' }]);
    const A = w.byId.hero, B = w.byId.beast;
    expect(A.gone).toBe(true);
    expect(B.gone).toBe(false);
    expect(B.transform.pos.slice(0, 2)).toEqual([2, 3]);
    expect(B.transform.heading).toBeCloseTo(1, 9);
    expect(A.transit).toMatchObject({ is: 'galvatron', dir: 'out', to: 'beast' });
    expect(B.transit).toMatchObject({ is: 'galvatron', dir: 'in', from: 'hero' });
    const f = CW.castFacts(w, CW.castFacts(world(), undefined).prev);
    expect(f.events.map((e) => `${e.type}:${e.entity}`).sort()).toEqual(['gone:hero', 'spawned:beast']);
  });

  it('a puff is a moment at a place or at a character, kept three seconds', () => {
    const w = world();
    CW.castOps(w, [{ op: 'puff', at: [5, 6] }, { op: 'puff', who: 'hero' }]);
    expect(w.moments.map((m) => [m.is, m.at.slice(0, 2)])).toEqual([['smoke', [5, 6]], ['smoke', [2, 3]]]);
    for (let i = 0; i < 100; i++) CW.stepWorld(w, {}, DT);
    CW.castOps(w, [{ op: 'puff', at: [0, 0] }]);
    expect(w.moments).toHaveLength(1);
  });
});

describe('transits in the cues', () => {
  it('reads with, transfigure and puff, teaches, lowers, and the board says them', () => {
    expect(TRANSITS).toEqual(['smoke', 'hologram', 'scan', 'transporter', 'galvatron']);
    const play = { spots: [{ id: 'altar', at: [4, 4] }], cues: [{ id: 'a', when: { start: true }, then: [
      { vanish: { who: 'hero', with: 'scan' } }, { transfigure: { who: 'hero', into: 'beast' } }, { puff: { at: 'altar' } }, { spawn: { who: 'beast', with: 'transporter' } },
    ] }] };
    const ev = lowerPlay({ entities: ENTS, play }, { player: 'hero' });
    expect(ev.reactions.filter((r) => r.do === 'ctrl')).toEqual([
      { on: 'cue:a', do: 'ctrl', op: 'vanish', who: 'hero', with: 'scan' },
      { on: 'cue:a', do: 'ctrl', op: 'transfigure', who: 'hero', into: 'beast' },
      { on: 'cue:a', do: 'ctrl', op: 'puff', at: [4, 4, 0] },
      { on: 'cue:a', do: 'ctrl', op: 'spawn', who: 'beast', with: 'transporter' },
    ]);
    const bad = (then) => () => readCues({ cues: [{ id: 'x', when: { start: true }, then }] });
    expect(bad({ vanish: { who: 'hero', with: 'confetti' } })).toThrow(/with is how it comes or goes: smoke, hologram/);
    expect(bad({ transfigure: { who: 'hero' } })).toThrow(/into is the character it becomes/);
    expect(bad({ puff: { is: 'smoke' } })).toThrow(/puff is a character's id, or \{ at: place, is\? \}/);
    const html = uiBoardHtml(resolvePlayUi({ entities: ENTS, play: { ...play, ui: 'propose' } }, () => 7));
    for (const w of ['send away hero (scan)', 'hero becomes beast (galvatron)', 'a puff of smoke at altar', 'beast appears (transporter)']) expect(html).toContain(w);
    // the laws know a transfigure wakes into (minted asleep) and sends who away
    expect(uiAdvice(play, null, { entities: ENTS }).filter((l) => l.law === 'spawn-asleep' || l.law === 'cast-known')).toEqual([]);
  });
});

describe('the page', () => {
  it('carries the transit code only when the cues use a transit, and the body map with it', async () => {
    const { emitThreeWorld } = await import('../../scene/scene-three.js');
    const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 0.85 }, transform: { pos: [0, 0, 0.85] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } }, { id: 'beast', dormant: true, rule: { type: 'static' }, transform: { pos: [0, 0, 0.5] }, body: { type: 'mesh', shape: 'sphere', radius: 0.5 } }];
    const page = (then) => emitThreeWorld({ entities, events: lowerPlay({ entities, play: { cues: [{ id: 'x', when: { start: true }, then }] } }, { player: 'hero' }), inline: false });
    const js = page({ transfigure: { who: 'hero', into: 'beast' } });
    expect(js).toContain('function __stepTransits()');
    expect(js).toContain('__stepTransits();');
    expect(js).toContain(' bodies: __bodies,');
    expect(page({ kill: 'hero' })).not.toContain('__stepTransits');
    expect(page({ vanish: 'hero' })).not.toContain('__stepTransits');
  });
});
