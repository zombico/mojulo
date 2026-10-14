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
    // the HUD and the menus are whole since kernel 0.14.0 (kernel/hud.gd, menus by pad and pointer)
    expect(godot.built).toEqual(expect.arrayContaining(['fact:use', 'effect:logic', 'effect:hud', 'effect:menus']));
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
    // a pick on what the pointer is over the kernel feeds in part (since 0.22.0: against the bus's markers and the box
    // colliders, not the GLB's meshes); keys travel since 0.18.0, the parts a cue hides are drawn since 0.14.0
    const score = extractEngineScore({ ref: 'r', manifest: {} }, { entities, events: { ...events, inputs: [{ on: 'pick', emit: { type: 'flare' } }] } });
    expect(score.ledger.bus_carried.godot.absent).toEqual([]);
    expect(score.ledger.bus_carried.godot.partial).toEqual(['fact:aim']);
    expect(score.ledger.bus_carried.godot.built).toEqual(expect.arrayContaining(['effect:menus', 'effect:parts']));
    expect(score.menus.map((m) => m.id)).toEqual(['sign']);
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score }], engine: 'godot' });
    expect(p.flags.join('\n')).toMatch(/behaviour the Godot kernel performs in part: fact:aim/);
    expect(busCoverage(null)).toEqual({ used: [], godot: { built: [], partial: [], absent: [] } });
  });

  it('reads a hit listener (hp-pool) as the hit fact', () => {
    const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'a' }] }, { kind: 'defeat-all' }]);
    expect(busCoverage(m.events).used).toContain('fact:hit');
    expect(busCoverage(m.events).used).not.toContain('fact:cast');
  });

  it('reads a cue on a beam striking as its own fact (performed since kernel 0.18.0), apart from the other cast facts', () => {
    const ev = lowered({ cues: [{ id: 'a', when: { struck: 'hero' }, then: { say: 'ow' } }] });
    expect(busCoverage(ev).godot.built).toContain('fact:struck');
    expect(busCoverage(ev).godot.absent).toEqual([]);
    expect(busCoverage(ev).used).not.toContain('fact:cast');
    const down = lowered({ cues: [{ id: 'a', when: { down: 'hero' }, then: { say: 'ow' } }] });
    expect(busCoverage(down).godot.built).toContain('fact:cast');
    expect(busCoverage(down).used).not.toContain('fact:struck');
  });
});

describe('the genre snipe rows', () => {
  it('a sighting is a web fact Godot does not feed yet; the beat it feeds (since 0.22.0), a guarded reaction it runs (since 0.19.0)', () => {
    const c = composeMechanics([{ kind: 'laps', checkpoints: [{ at: [1, 0, 0] }, { at: [2, 0, 0] }] }, { kind: 'unseen' }, { kind: 'on-beat' }], { player: 'hero' });
    const { used, godot } = busCoverage(c.events);
    expect(used).toEqual(expect.arrayContaining(['fact:seen', 'fact:beat', 'effect:guarded']));
    expect(godot.absent).toEqual(['fact:seen']);
    expect(godot.built).toEqual(expect.arrayContaining(['effect:guarded', 'fact:beat']));
    expect(used).not.toContain('fact:cast');
  });
});

describe('the shooter\'s rows', () => {
  it('a supply\'s rounds are the rearm effect (Godot since 0.22.0); a fall counted is the cast\'s fact', () => {
    const c = composeMechanics([{ kind: 'fail-on-death', hits: 8 }, { kind: 'supplies', drops: [{ at: [1, 0, 0], gives: 'ammo' }] }, { kind: 'defeat-all', who: 'foe-*', count: 1 }], { player: 'hero' });
    const cov = busCoverage(c.events);
    expect(cov.godot.built).toContain('effect:rearm');
    expect(cov.used).toContain('fact:cast');
    expect(cov.used).not.toContain('effect:cast');
  });
});
