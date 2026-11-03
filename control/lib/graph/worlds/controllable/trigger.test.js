import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { triggersIn } from './trigger.js';
import { blockMatter } from '../../rupa/matter.js';
import { lowerPlay } from '../../playscape/ui/direction.js';

// triggered breaks: the game, or the player, sets off what a world can break; the world breaks it its own way
const CW = composeLive();
const step = (w, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const get = (w, id) => w.breakables.find((b) => b.id === id);
// a tower of four 1.5 m courses, a house's two walls and its roof, a crate apart
const tower = (matter) => Array.from({ length: 4 }, (_, k) => ({ id: `structure:keep:body-0#${k}.0.0`, min: [0, 0, k * 1.5], max: [1.5, 1.5, (k + 1) * 1.5], hp: 6, ...(matter ? blockMatter({ min: [0, 0, k * 1.5], max: [1.5, 1.5, (k + 1) * 1.5] }, matter) : {}) }));
const house = () => [
  { id: 'town-home-1:wall-s0.0', min: [10, 0, 0], max: [13, 0.25, 2.5], hp: 6 }, { id: 'town-home-1:wall-n0.0', min: [10, 2.75, 0], max: [13, 3, 2.5], hp: 6 },
  { id: 'town-home-1:roof', min: [10, 0, 2.5], max: [13, 3, 4], hp: 6 },
];
const crate = { id: 'crate', min: [-5, -5, 0], max: [-4.4, -4.4, 0.6], hp: 1 };
const dummy = (id, pos) => ({ id, rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 10, radius: 0.4 }, transform: { pos, heading: 0, pitch: 0 } });
const world = (extra = {}) => CW.createWorld({ entities: [dummy('guard', [-4.7, -3.5, 0])], breakables: [...tower(), ...house(), crate], ...extra });
const facts = (w) => { let prev = CW.castFacts(w, null).prev; return () => { const r = CW.castFacts(w, prev); prev = r.prev; return r.events; }; };

describe('a charge set off by the game', () => {
  it('a blast breaks what is in its reach as a grenade would, and hurts the bodies in it', () => {
    const w = step(world());
    CW.castOps(w, [{ op: 'blast', at: [-4.7, -4.7, 0.3], radius: 2, hurt: 3 }]);
    step(w);
    expect(get(w, 'crate').broken).toMatchObject({ how: 'burst' });
    expect(get(w, 'structure:keep:body-0#0.0.0').broken).toBeNull();
    expect(w.bursts.some((b) => b.scripted)).toBe(true);
    expect(w.byId.guard.body.hp).toBe(7);
  });
});

describe('a building brought down', () => {
  it('base: what stands within a storey of its foot breaks and the rest falls on its own', () => {
    const w = step(world());
    CW.castOps(w, [{ op: 'collapse', group: 'keep' }]);   // a structure by its own id
    step(w, 2);
    expect(get(w, 'structure:keep:body-0#0.0.0').broken).toMatchObject({ how: 'call' });
    expect(get(w, 'structure:keep:body-0#1.0.0').broken).not.toBeNull();
    const top = get(w, 'structure:keep:body-0#3.0.0');
    expect(top.broken).toBeNull();
    expect(top.falling).not.toBeNull();   // gravity takes what lost its hold
    expect(get(w, 'town-home-1:roof').broken).toBeNull();   // another building stands
  });

  it('whole, staggered: every block, bottom up, one at a time', () => {
    const w = step(world());
    CW.castOps(w, [{ op: 'collapse', group: 'house-town-home-1', how: 'whole', stagger: 0.5 }]);   // a house by its anchor's id
    step(w);
    const broken = () => house().map((b) => !!get(w, b.id).broken);
    expect(broken().filter(Boolean).length).toBe(1);
    step(w, 60);
    expect(broken().every(Boolean)).toBe(true);
    const at = (id) => w.breaks.find((x) => x.id === id).t;
    expect(at('town-home-1:roof')).toBeGreaterThan(at('town-home-1:wall-n0.0'));
  });

  it('under destructible physics the fall itself breaks what it lands on', () => {
    const w = step(CW.createWorld({ entities: [], breakables: tower('brick'), rupa: {} }));
    CW.castOps(w, [{ op: 'collapse', group: 'structure:keep', storey: 1.5 }]);
    step(w, 120);
    expect(w.breaks.some((x) => x.how !== 'call')).toBe(true);
  });

  it('break: one block by its id', () => {
    const w = step(world());
    CW.castOps(w, [{ op: 'break', id: 'crate' }]);
    step(w);
    expect(get(w, 'crate').broken).not.toBeNull();
    expect(w.breaks.length).toBe(1);
  });
});

describe('what a cue can wait on', () => {
  it('breached when a building\'s first block breaks, fell when half of it is down, each once', () => {
    const w = step(world()), read = facts(w);
    expect(read().filter((e) => e.type === 'breached' || e.type === 'fell')).toEqual([]);
    CW.breakBlock(w, 'town-home-1:wall-s0.0', Infinity);
    step(w);
    expect(read().filter((e) => e.type === 'breached')).toEqual([{ type: 'breached', entity: 'town-home-1' }]);
    CW.castOps(w, [{ op: 'collapse', group: 'structure:keep' }]);
    step(w, 3);
    const ev = read();
    expect(ev).toContainEqual({ type: 'breached', entity: 'structure:keep' });
    expect(ev).toContainEqual({ type: 'fell', entity: 'structure:keep' });
    step(w, 30);
    expect(read().filter((e) => e.entity === 'structure:keep')).toEqual([]);
  });

  it('the same triggers give the same world', () => {
    const run = () => { const w = step(world()); CW.castOps(w, [{ op: 'collapse', group: 'keep', how: 'whole', stagger: 0.2 }, { op: 'blast', at: [11, 1.5, 0.5], radius: 2 }]); step(w, 90); return JSON.stringify([w.breaks, w.breakables.map((b) => b.min)]); };
    expect(run()).toBe(run());
  });
});

describe('from the cues to the page', () => {
  const play = { cues: [
    { id: 'charge', when: { use: { at: [0, -3], r: 1.5, prompt: 'detonate' } }, then: [{ blast: { at: [0.75, -0.5], radius: 3 } }, { collapse: { group: 'keep', stagger: 0.1 } }] },
    { id: 'down', when: { fell: 'structure:keep' }, then: { say: 'The keep is down.' } },
  ] };

  it('a lever, a zone or any event sets them off; a building\'s fall is a happening', () => {
    const ev = lowerPlay({ kind: 'controllable', play });
    expect(ev.reactions).toContainEqual(expect.objectContaining({ do: 'ctrl', op: 'blast', at: [0.75, -0.5, 0], radius: 3 }));
    expect(ev.reactions).toContainEqual(expect.objectContaining({ do: 'ctrl', op: 'collapse', group: 'keep', stagger: 0.1 }));
    expect(ev.reactions).toContainEqual(expect.objectContaining({ on: 'fell', match: { entity: 'structure:keep' } }));
    expect(ev.cast).toBe(true);
    expect(triggersIn(ev)).toBe(true);
    expect(triggersIn(lowerPlay({ kind: 'controllable', play: { cues: [{ id: 'hi', when: { start: true }, then: { say: 'hi' } }] } }))).toBe(false);
  });

  it('says what is wrong', () => {
    const bad = (then) => () => lowerPlay({ kind: 'controllable', play: { cues: [{ id: 'x', when: { start: true }, then }] } });
    expect(bad({ blast: { radius: 2 } })).toThrow(/a charge set off at a place/);
    expect(bad({ blast: { at: [0, 0], radius: 99 } })).toThrow(/radius is metres/);
    expect(bad({ collapse: { group: 'keep', how: 'sideways' } })).toThrow(/how is base/);
    expect(bad({ break: 3 })).toThrow(/a block's id/);
  });

  it('only a world that uses them carries the builder', () => {
    expect(emissionSource({})).not.toContain("registerWorldPass('trigger'");
    expect(emissionSource({ trigger: true })).toContain("registerWorldPass('trigger'");
  });
});

describe('on the World page', () => {
  it('a page whose cues break the world composes the builder; any other keeps its bytes', async () => {
    const { controllableChannelScript } = await import('../../scene/channels/controllable/index.js');
    const hero = [{ id: 'hero', kind: 'walker', transform: { pos: [0, 0, 1], heading: 0 }, rule: {}, body: {} }];
    expect(controllableChannelScript(hero, null, {}, { trigger: true })).toContain("registerWorldPass('trigger'");
    expect(controllableChannelScript(hero, null, {}, {})).toBe(controllableChannelScript(hero, null, {}, { trigger: false }));
    expect(controllableChannelScript(hero, null, {}, {})).not.toContain("registerWorldPass('trigger'");
  });
});
