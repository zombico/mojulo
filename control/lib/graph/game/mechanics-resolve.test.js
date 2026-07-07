import { describe, it, expect } from 'vitest';

import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { buildBus } from '../worlds/event-bus.js';

// ── M1: game.mechanics through the world-scene resolve (game-mechanics.plan.md) ─────────────────
// A level declared purely by mechanics: the resolve lowers them into the events channel (onto the
// zone fact source) AND synthesizes the game contract (produces/on). The author writes verbs; the
// plumbing is generated. Uses a controllable action world so it exercises the real walk player.

const sketch = (manifest) => ({ manifest, title: 'test level' });

const LEVEL = {
  kind: 'controllable',
  entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'mesh', shape: 'box' }, transform: { pos: [0, 0, 2] } }],
  camera: { rule: 'follow', target: 'hero' },
  game: {
    levelRef: 'crypt-1',
    mechanics: [
      { kind: 'reach-exit', at: [20, 0, 0], radius: 2 },
      { kind: 'collect', into: 'bag', pickups: [{ item: 'coin', at: [8, 0, 0] }] },
      { kind: 'hazard-damage', hazards: [{ at: [12, 0, 0], damage: 30 }] },
      { kind: 'fail-on-death' },
    ],
    fall: { mode: 'respawn', penalty: 10, floor: 1 },
  },
};

describe('resolveWorldScene — mechanics lowering', () => {
  it('lowers mechanics into the events channel + synthesizes the game contract', async () => {
    const out = await resolveWorldScene(sketch(LEVEL));
    // events channel got the mechanic zones/reactions and is live
    expect(out.payload.events).toBeTruthy();
    expect(out.payload.nonBakeable).toBe(true);
    const zones = out.payload.events.sources.filter((s) => s.type === 'zone').map((s) => s.zone);
    expect(zones).toContain('exit_0');
    expect(zones).toContain('__catch__');            // the fall catch-box
    expect(zones.some((z) => z.startsWith('pk_'))).toBe(true);
    // player watch + spawn were derived from the walk entity
    const exit = out.payload.events.sources.find((s) => s.zone === 'exit_0');
    expect(exit.watch).toBe('hero');
    // contract synthesized: grant produces (nested under produces.events) + goal/dead on-map
    expect(out.payload.game.produces.events).toEqual([{ type: 'grant', slice: 'bag', max: 1 }]);
    expect(out.payload.game.on['goal:reached']).toEqual({ end: 'success' });
    expect(out.payload.game.on.dead).toEqual({ end: 'fail' });
    // the walkto audit rode along for G4
    expect(out.payload.game.audits).toEqual([{ mechanic: 'reach-exit', kind: 'walkto', target: [20, 0, 0] }]);
    // the fall penalty clamps at floor 1 (a fall can never end the run)
    const fallPenalty = out.payload.events.reactions.find((r) => r.match && r.match.zone === '__catch__' && r.do === 'inc');
    expect(fallPenalty).toMatchObject({ var: 'hp', by: -10, min: 1 });
  });

  it('a bad mechanic set fails the resolve loudly (teaching error)', async () => {
    await expect(resolveWorldScene(sketch({
      ...LEVEL,
      game: { levelRef: 'x', mechanics: [{ kind: 'collect', pickups: [{ item: 'c', at: [0, 0, 0] }] }] },  // no success terminal + unnamed slice
    }))).rejects.toThrow(/SUCCESS-capable terminal|name the inventory slice/);
  });

  it('merges mechanic events with hand-authored events (both run on the one bus)', async () => {
    const out = await resolveWorldScene(sketch({
      ...LEVEL,
      events: { vars: { coins: 0 }, reactions: [{ on: 'pickup:coin', do: 'inc', var: 'coins' }], hud: [{ var: 'coins', label: 'Coins' }] },
    }));
    // hand-authored reaction + mechanic reactions coexist
    expect(out.payload.events.reactions.some((r) => r.on === 'pickup:coin' && r.do === 'inc')).toBe(true);
    expect(out.payload.events.reactions.some((r) => r.match && r.match.zone === 'exit_0')).toBe(true);
    expect(out.payload.events.vars.coins).toBe(0);
  });

  it('a level with no mechanics is untouched (additive posture)', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'controllable', entities: LEVEL.entities, camera: LEVEL.camera }));
    expect(out.payload.game).toBeUndefined();
  });
});

describe('the resolved level plays end-to-end through the real bus', () => {
  it('walking the hero to the exit fires goal:reached → the game bridge would end success', async () => {
    const out = await resolveWorldScene(sketch(LEVEL));
    const B = buildBus();
    // stand in for the __mojGame on-map: goal:reached → a `won` var (the bridge maps it to end()).
    const evs = out.payload.events;
    const state = B.createBusState({ ...evs, reactions: [...evs.reactions, { on: 'goal:reached', do: 'set', var: 'won', to: 1 }] }, evs.entities || []);
    const hero = { id: 'hero', transform: { pos: [0, 0, 2] } };
    let z = B.deriveZoneEvents([hero], undefined, evs.sources); B.processEvents(state, z.events);
    expect(state.vars.won).toBeUndefined();
    hero.transform.pos = [20, 0, 2];
    z = B.deriveZoneEvents([hero], z.prev, evs.sources); B.processEvents(state, z.events);
    expect(state.vars.won).toBe(1);
  });

  it('the emitted World HTML carries the zone deriver + the game bridge (a playable level)', async () => {
    const out = await resolveWorldScene(sketch(LEVEL));
    const html = emitThreeWorld({ ...out.payload, walk: true });
    expect(html).toContain('deriveZoneEvents');       // zones are live
    expect(html).toContain('window.__mojGame');        // the contract bridge is present
    expect(html).toContain('"levelRef":"crypt-1"');
  });
});
