import { describe, it, expect } from 'vitest';
import { BUS_ABI, busCoverage } from './bus-abi.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { composeMechanics } from '../game/mechanics.js';
import { assessPortability } from './engine-portability.js';
import { extractEngineScore } from './engine-score.js';

const entities = [{ id: 'hero', pilotable: true, rule: { type: 'walk' }, transform: { pos: [0, 0, 0.85] } }];
const lowered = (play) => lowerPlay({ entities, play }, { player: 'hero' });

describe('the bus contract', () => {
  it('names every row with a status per kernel, the web building all of them', () => {
    for (const side of ['facts', 'effects']) {
      for (const [id, row] of Object.entries(BUS_ABI[side])) {
        expect(row.about, id).toBeTruthy();
        expect(row.web, id).toBe('built');
        expect(['built', 'partial', 'absent'], id).toContain(row.godot);
      }
    }
  });

  it('reads what a world uses from its lowered events', () => {
    const ev = lowered({
      menus: [{ id: 'sign', kind: 'read', text: 'hello' }],
      cues: [
        { id: 'a', when: { use: { at: [1, 0], r: 1 } }, then: [{ open: 'sign' }, { say: 'hi' }] },
        { id: 'b', when: { down: 'hero' }, then: [{ weather: 'rain' }, { spawn: 'hero' }] },
        { id: 'c', when: { start: true }, then: { set: 'x', to: 1 } },
      ],
    });
    const { used, godot } = busCoverage(ev);
    for (const id of ['fact:use', 'fact:cast', 'effect:logic', 'effect:hud', 'effect:menus', 'effect:weather', 'effect:cast']) expect(used, id).toContain(id);
    expect(godot.built).toEqual(expect.arrayContaining(['fact:use', 'effect:logic']));
    expect(godot.partial).toEqual(expect.arrayContaining(['effect:hud', 'effect:menus']));
    expect(godot.built).toContain('fact:cast');
    expect(godot.partial).toContain('effect:cast');
    expect(godot.built).toContain('effect:weather');
    expect(godot.absent).toEqual([]);
  });

  it('finds a mechanics level whole in the Godot kernel but its painting', () => {
    const out = composeMechanics([{ kind: 'reach-exit', at: [20, 0, 0], radius: 2 }, { kind: 'hazard-damage', hazards: [{ at: [10, 0, 0], damage: 25 }] }],
      { storeSchema: { slices: [{ name: 'hero', kind: 'character', init: { stats: { hp: 100 } } }] }, player: 'hero', spawn: [0, 0, 2] });
    const { godot } = busCoverage(out.events);
    expect(godot.absent).toEqual([]);
    expect(godot.built).toContain('fact:zone');
  });

  it('rides the ledger and the portability flags', () => {
    const events = lowered({ menus: [{ id: 'sign', kind: 'read', text: 'hello' }], parts: [{ part: 'readout', id: 'gauge', bind: { var: 'hp' } }], cues: [{ id: 'a', when: { use: { at: [1, 0], r: 1 } }, then: [{ open: 'sign' }, { hide: 'gauge' }] }] });
    const score = extractEngineScore({ ref: 'r', manifest: {} }, { entities, events });
    expect(score.ledger.bus_carried.godot.absent).toEqual(['effect:parts']);
    expect(score.ledger.bus_carried.godot.partial).toContain('effect:menus');
    expect(score.menus.map((m) => m.id)).toEqual(['sign']);
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score }] });
    expect(p.flags.join('\n')).toMatch(/behaviour the Godot kernel does not perform yet: effect:parts/);
    expect(busCoverage(null)).toEqual({ used: [], godot: { built: [], partial: [], absent: [] } });
  });
});
