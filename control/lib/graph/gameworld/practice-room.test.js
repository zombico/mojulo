// THE PRACTICE ROOM from the recipe (practice-room.js): a world's feel played before any level is built. One case per
// procedure: which worlds have a room, the room a template makes (its stage, its kit, a stand-in hero sheathing its blade, a
// foe of the bestiary standing in, a pack), the run's own sketches in the stand-ins' place, the arsenal it plays, and the
// hero's first press on the runtime.
import { describe, expect, it } from 'vitest';

import { practiceRoom, roomEligible, roomArsenal } from './practice-room.js';
import { POLES, STAGES } from './feel/cards.js';
import { TEMPLATE_ARSENALS, BASIC_ARSENAL } from './combos.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

// (the templates are chosen from the tables, never by hand: one with a kit and a stage, one that fights with no kit, one
// that does not fight hand to hand)
const fights = (id) => POLES[id].demo.includes('attack');
const KITTED = Object.keys(TEMPLATE_ARSENALS).find((id) => STAGES[POLES[id].stage]?.blocks);
const KITLESS = Object.keys(POLES).find((id) => fights(id) && !TEMPLATE_ARSENALS[id]);
const UNARMED = Object.keys(POLES).find((id) => !fights(id));
const pilot = (m) => m.entities.find((e) => e.pilotable);
const foesOf = (m) => m.entities.filter((e) => e.team === 'foes');

describe('which worlds have a room', () => {
  it('a feel that fights hand to hand, or any feel with an arsenal written; the rest say why', () => {
    expect(roomEligible({})).toMatch(/writes no feel/);
    expect(roomEligible({ feel: UNARMED })).toMatch(/does not fight hand to hand/);
    expect(roomEligible({ feel: UNARMED, arsenal: KITTED })).toBeNull();
    expect(roomEligible({ feel: KITTED })).toBeNull();
    expect(() => practiceRoom({ feel: UNARMED })).toThrow(/practice room: .*does not fight hand to hand/);
  });
});

describe('the room a template makes, before any level', () => {
  const R = practiceRoom({ id: 'g', feel: KITTED }), m = R.manifest, S = STAGES[POLES[KITTED].stage];
  it('is the template\'s stage greyboxed, its kit armed on a stand-in that sheathes its blade, a foe standing in', () => {
    expect(R).toMatchObject({ kit: KITTED, from: 'feel', stage: POLES[KITTED].stage, hero: 'stand-in', foe: { made: false } });
    // (the floor in metre tiles over the stage, a box for each block and the four walls)
    expect(m.faces.filter((f) => f.group === 'room:floor').length).toBe((2 * S.half) ** 2);
    expect(m.colliders.length).toBe(S.blocks.length + 4);
    const h = pilot(m);
    expect(h.rule.weapons.map((W) => W.id)).toEqual(TEMPLATE_ARSENALS[KITTED].weapons.map((W) => W.id));
    expect(h.rule.combat).toMatchObject({ drawn: 'hero', sheathed: 'hero-sheathed' });
    expect(m.figures.hero.hero.gear.right.item).toBeTruthy();
    expect(m.figures['hero-sheathed'].hero.gear.back.item).toBe(m.figures.hero.hero.gear.right.item);
    expect(m.camera).toMatchObject({ steer: 'orbit', mouseLook: true });
    expect(m.lock).toBe(true);
    // (the foe where the stage's dummy stands, facing the hero, which starts a step out of its reach)
    const [f] = foesOf(m);
    expect(f.transform.pos.slice(0, 2)).toEqual(S.dummy);
    expect(Math.hypot(h.transform.pos[0] - f.transform.pos[0], h.transform.pos[1] - f.transform.pos[1])).toBeCloseTo(2, 2);
    expect(f.body.hittable).toBe(true);
  });
  it('is the same room every read; a pack is that many foes', () => {
    expect(JSON.stringify(practiceRoom({ id: 'g', feel: KITTED }).manifest)).toBe(JSON.stringify(m));
    expect(foesOf(practiceRoom({ id: 'g', feel: KITTED }, { pack: 3 }).manifest)).toHaveLength(3);
  });
  it('plays the run\'s own hero, its sheathed twin and its foe where the run has made them', () => {
    const G = { id: 'g', feel: KITTED, foes: { grunt: { class: 'walker' } }, characters: { hero: { adornment: { items: [{ id: 'b', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] } } } };
    const own = practiceRoom(G, { refs: { hero: 'g-hero', sheathed: 'g-hero-sheathed', foes: { grunt: 'g-foes-grunt' } } });
    expect(own).toMatchObject({ hero: 'own', foe: { eid: 'grunt', made: true } });
    expect(own.manifest.figures.hero.heroRef).toBe('g-hero');
    expect(own.manifest.figures['hero-sheathed'].heroRef).toBe('g-hero-sheathed');
    expect(own.manifest.figures['foe-grunt'].heroRef).toBe('g-foes-grunt');
  });
});

describe('the arsenal it plays', () => {
  it('the world\'s, else its template\'s kit, else the basic one', () => {
    expect(roomArsenal({ feel: KITTED, arsenal: { from: KITTED, art: 'realistic' } })).toMatchObject({ from: 'world', kit: KITTED, arsenal: { art: 'realistic' } });
    expect(roomArsenal({ feel: KITTED })).toMatchObject({ from: 'feel', kit: KITTED });
    expect(roomArsenal({ feel: KITLESS })).toMatchObject({ from: 'basic', kit: null });
    expect(pilot(practiceRoom({ feel: KITLESS }).manifest).rule.weapons.map((W) => W.id)).toEqual(BASIC_ARSENAL.weapons.map((W) => W.id));
  });

  it('on the runtime: the hero\'s first light press is taken as its kit\'s opener', () => {
    const m = practiceRoom({ feel: KITTED }).manifest, h = pilot(m);
    // (the hero armed as the page arms it with what it holds: world-scene.js armHeld)
    const w = createWorld({ entities: [{ ...h, rule: { ...h.rule, strike: 'melee', strikeReach: 1.6, strikeDamage: 2 } }, ...foesOf(m)] });
    const hooks = { ground: () => 0 }, H = w.byId[h.id];
    for (let f = 0; f < 4; f++) stepWorld(w, {}, 1 / 60, hooks);
    stepWorld(w, { fire: 1 }, 1 / 60, hooks);
    for (let f = 0; f < 3; f++) stepWorld(w, {}, 1 / 60, hooks);
    const W0 = TEMPLATE_ARSENALS[KITTED].weapons[0], opener = W0.combos.find((c) => c.beats[0] === 'L').moves[0];
    expect(H.mvPress).toMatchObject({ verdict: 'taken' });
    expect(H.mvPress.why).toMatch(new RegExp(opener));
  });
});
