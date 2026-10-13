import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { composeMechanics } from '../../game/mechanics.js';
import { createBusState, processEvents, watchEvents } from '../event-bus.js';
import { listensForHits } from '../../playscape/ui/cast.js';
import { eventsChannelScript } from '../../scene/channels/events.js';

// THE HIT LOOP: a swing's connects become `hit:<id>` facts, and hp-pool / defeat-all count them on the bus
const CW = composeLive();
const DT = 1 / 60;
const body = (hp) => ({ type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hittable: true, hp, radius: 0.5 });
const ent = (id, x, y, extra = {}) => ({ id, rule: { type: 'static' }, transform: { pos: [x, y, 0], heading: 0 }, body: body(10), ...extra });

function swing(world, who, spec = {}) {
  const e = world.byId[who];
  e.strikeParams = CW.meleeSwingSpec({ strikeReach: 2, strikeDamage: 4, ...spec }, {}, 'neutral', false).params;
  e.swingT = 0.4; e.struckThisSwing = {};
  return e;
}

describe('meleeContacts', () => {
  it('names who a swing meets, in entity order, once per swing, stopping at a clash', () => {
    const w = CW.createWorld({ entities: [ent('hero', 0, 0, { team: 'a' }), ent('pal', 1, 0.2, { team: 'a' }), ent('foe', 1.5, -0.2, { team: 'b' }), ent('behind', -1.5, 0, { team: 'b' }), ent('far', 6, 0, { team: 'b' })] });
    const hero = swing(w, 'hero');
    expect(CW.meleeContacts(hero, w.entities).map((c) => [c.tg.id, c.kind])).toEqual([['pal', 'ally'], ['foe', 'hit']]);
    hero.swingT = 0.1;   // the wind-up: outside the contact window
    expect(CW.meleeContacts(hero, w.entities)).toEqual([]);
    hero.swingT = 0.4;
    // a target mid-swing meets the blade: the clash consumes the swing
    const foe = swing(w, 'foe');
    foe.transform.pos = [0.8, 0, 0];
    expect(CW.meleeContacts(hero, w.entities).map((c) => [c.tg.id, c.kind])).toEqual([['pal', 'ally'], ['foe', 'clash']]);
    // it only reads
    expect(hero.struckThisSwing).toEqual({});
  });
});

describe('hit facts', () => {
  it('a connect is a hit:<id> fact, once per hit, carrying the hitter', () => {
    const w = CW.createWorld({ entities: [ent('hero', 0, 0), ent('foe', 1.5, 0)] });
    let prev = CW.castFacts(w, undefined).prev;
    CW.stepMelee(swing(w, 'hero'), DT, w);
    let f = CW.castFacts(w, prev); prev = f.prev;
    expect(f.events.filter((e) => e.type.startsWith('hit:'))).toEqual([{ type: 'hit:foe', entity: 'foe', by: 'hero' }]);
    expect(w.byId.foe.body.hp).toBe(6);
    CW.stepMelee(w.byId.hero, DT, w);   // the same swing: struck once
    f = CW.castFacts(w, prev); prev = f.prev;
    expect(f.events).toEqual([]);
    w.byId.foe.hits += 2; w.byId.foe.lastHitBy = 'hero';   // two in one step (a splash, a burst): two facts
    expect(CW.castFacts(w, prev).events.map((e) => e.type)).toEqual(['hit:foe', 'hit:foe']);
  });

  it('hp-pool and defeat-all count the hits a blade deals, to the win', () => {
    const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'a', hp: 2 }, { id: 'b', hp: 1 }] }, { kind: 'defeat-all' }]);
    expect(m.errors || []).toEqual([]);
    expect(listensForHits(m.events)).toBe(true);
    expect(listensForHits({ reactions: [{ on: 'enter', do: 'emit', event: 'x' }] })).toBe(false);
    const w = CW.createWorld({ entities: [ent('hero', 0, 0), ent('a', 1.5, 0.3), ent('b', 1.5, -0.3)] });
    const bus = createBusState(m.events, []);
    const settle = (evs) => { if (evs.length) processEvents(bus, evs); for (let k = 0; k < 6; k++) { const x = watchEvents(bus); if (!x.length) break; processEvents(bus, x); } };
    let prev = CW.castFacts(w, undefined).prev;
    const strike = () => { CW.stepMelee(swing(w, 'hero'), DT, w); const f = CW.castFacts(w, prev); prev = f.prev; settle(f.events); };
    strike();
    expect(bus.log.filter((r) => r.type === 'enemy:down').length).toBe(1);   // b had one hit in it
    expect(bus.log.some((r) => r.type === 'all:defeated')).toBe(false);
    strike();
    expect(bus.log.filter((r) => r.type === 'enemy:down').length).toBe(2);
    expect(bus.log.some((r) => r.type === 'all:defeated')).toBe(true);
  });

  it('the page reads the facts when a reaction listens for hits, and only then', () => {
    const m = composeMechanics([{ kind: 'hp-pool', entities: [{ id: 'a' }] }, { kind: 'defeat-all' }]);
    expect(eventsChannelScript(m.events)).toMatch(/__mojCtrl\.facts\(__castPrev\)/);
    const plain = composeMechanics([{ kind: 'reach-exit', at: [20, 0, 0], radius: 2 }]);
    expect(eventsChannelScript(plain.events)).not.toMatch(/__castPrev/);
  });
});
