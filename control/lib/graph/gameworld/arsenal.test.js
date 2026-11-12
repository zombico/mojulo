// A game's ARSENAL (arsenal.js): the practice room's weapons and strings written once on the world, laid on every level's
// hero that strikes. One case per procedure: a template's kit by name, a kit with edits, a whole arsenal, 'auto' from the
// feel, the suggestion, a level armed (the hero, its seats, its foes' juggle), the sheathed weapon left in the rack, and
// nothing written adding nothing.
import { describe, expect, it } from 'vitest';

import { readGameArsenal, arsenalOfGame, arsenalSuggestion, armLevel, heroStrikes, stringDamage, foeHealth } from './arsenal.js';
import { TEMPLATE_ARSENALS, BASIC_ARSENAL, arsenalFor } from './combos.js';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { POLES } from './feel/cards.js';
import { HELD_STRIKE } from '../polygonizer/hero-swing.js';

const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const H = MEADOWMARK_HERO.characters.hero;
const striking = (more = {}) => ({ ...MEADOWMARK_HERO, ...more, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [BLADE] } } } });
const firstLevel = (W) => { const G = readGameworld(W), st = gameStages(W).find((s) => s.section !== 'building'); return stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero' }).args.manifest; };
const pilot = (m) => m.entities.find((e) => e.pilotable);
// (the kits are chosen from the table, never by hand: the one with a juggle and the one without)
const KITS = Object.keys(TEMPLATE_ARSENALS);
const JUGGLER = KITS.find((k) => TEMPLATE_ARSENALS[k].juggle), STEADY = KITS.find((k) => !TEMPLATE_ARSENALS[k].juggle);
// (a template that fights hand to hand and has no kit yet)
const kitless = Object.keys(POLES).find((id) => POLES[id].demo.includes('attack') && !TEMPLATE_ARSENALS[id]);
const SHEATHED = (A) => A.weapons.filter((W) => W.figure === 'sheathed').map((W) => W.id);
const hero = (more = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', strike: 'melee', strikeContact: [0.28, 0.62], ...more }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0], heading: 0 } });
const foe = (body = {}) => ({ id: 'foe-1', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 100, ...body }, rule: { type: 'static' }, transform: { pos: [1.6, 0, 0], heading: Math.PI } });

describe('the arsenal a world writes', () => {
  it('reads a kit by name, a kit with edits, a whole arsenal, auto and false; refuses the rest in words', () => {
    for (const v of [undefined, null, false, 'auto', JUGGLER, { from: STEADY, art: 'realistic' }, BASIC_ARSENAL]) expect(() => readGameArsenal(v)).not.toThrow();
    expect(() => readGameArsenal('dmc')).toThrow(/a template \(.*fallen-angel.*'dmc' is none of them/);
    expect(() => readGameArsenal({ from: 'dmc' })).toThrow(/\.from is a template with a kit/);
    expect(() => readGameArsenal({ from: JUGGLER, sword: {} })).toThrow(/edit 'sword' is not part of an arsenal/);
    expect(() => readGameArsenal({ from: JUGGLER, weapons: [{ id: 'axe', drop: true }] })).toThrow(/no 'axe' to drop/);
    // (an edit that leaves a combo on a dropped move is the combo manifest's own refusal, said from the kit)
    const sword = TEMPLATE_ARSENALS[JUGGLER].weapons.find((W) => W.id === 'sword'), used = sword.combos[0].moves[0];
    expect(() => readGameArsenal({ from: JUGGLER, weapons: [{ id: 'sword', moves: { [used]: null } }] })).toThrow(new RegExp(`\\(from ${JUGGLER}\\).*${used}`));
    // (the world's read carries it)
    expect(readGameworld({ ...MEADOWMARK_HERO, arsenal: JUGGLER }).arsenal).toBe(JUGGLER);
    expect(() => readGameworld({ ...MEADOWMARK_HERO, arsenal: 'dmc' })).toThrow(/arsenal/);
  });

  it('edits a kit by id: moves merged move by move, a combo or a weapon dropped, timing merged, art replaced', () => {
    const K = TEMPLATE_ARSENALS[JUGGLER], sword = K.weapons.find((W) => W.id === 'sword');
    const [mv, m0] = Object.entries(sword.moves).find(([, m]) => m.travel);
    const dropC = sword.combos.find((c) => c.moves.length === 1).id, other = K.weapons.find((W) => W.id !== 'sword');
    const A = arsenalOfGame({ arsenal: { from: JUGGLER, art: 'inspired', timing: { buffer: 16 }, weapons: [{ id: other.id, drop: true }, { id: 'sword', moves: { [mv]: { frames: m0.frames + 4 } }, combos: [{ id: dropC, drop: true }] }] } });
    expect(A).toMatchObject({ from: 'template', template: JUGGLER });
    const S = A.arsenal.weapons.find((W) => W.id === 'sword');
    expect(S.moves[mv]).toEqual({ ...m0, frames: m0.frames + 4 });
    expect(S.combos.map((c) => c.id)).not.toContain(dropC);
    expect(A.arsenal.weapons.map((W) => W.id)).not.toContain(other.id);
    expect(A.arsenal.timing).toEqual({ ...K.timing, buffer: 16 });
    expect(A.arsenal.art).toBe('inspired');
    // (the kit itself untouched)
    expect(TEMPLATE_ARSENALS[JUGGLER].weapons.find((W) => W.id === 'sword').moves[mv]).toEqual(m0);
  });

  it('auto is the feel template\'s kit (the nearer that has one), none where no template near has one', () => {
    expect(arsenalOfGame({ arsenal: 'auto', feel: STEADY })).toMatchObject({ from: 'feel', template: STEADY });
    expect(arsenalFor(kitless)).toBeNull();
    expect(arsenalOfGame({ arsenal: 'auto', feel: kitless })).toBeNull();
    expect(arsenalOfGame({ arsenal: 'auto', feel: { pole: kitless, toward: JUGGLER, t: 0.3 } })).toMatchObject({ template: JUGGLER });
    expect(arsenalOfGame({ arsenal: false, feel: JUGGLER })).toBeNull();
  });

  it('is suggested, never laid: for a striking hero whose feel has a kit and a world that writes none', () => {
    const W = striking({ feel: JUGGLER });
    expect(heroStrikes(W)).toBe(true);
    expect(arsenalSuggestion(W)).toMatchObject({ suggest: 'auto', template: JUGGLER });
    expect(arsenalSuggestion({ ...W, arsenal: false })).toBeNull();
    expect(arsenalSuggestion({ ...MEADOWMARK_HERO, feel: JUGGLER })).toBeNull();
    expect(pilot(firstLevel(W)).rule.moveset).toBeUndefined();
  });
});

describe('a level armed', () => {
  it('nothing written, or no hero that strikes: the manifest itself', () => {
    const m = { entities: [hero(), foe()] };
    expect(armLevel({}, m)).toBe(m);
    const unarmed = { entities: [{ ...hero(), rule: { type: 'platform' } }, foe()] };
    expect(armLevel({ arsenal: JUGGLER }, unarmed)).toBe(unarmed);
  });

  it('the hero and its seats take the weapons, the first one\'s moveset and the sidearm; the foes the juggle', () => {
    const own = { hitstun: { base: 1, decay: 0.5, min: 0.1 } };
    const m = armLevel({ arsenal: JUGGLER }, { entities: [hero({ combat: { drawn: 'hero', sheathed: 'hero-sheathed' } }), { ...hero(), id: 'hero-2' }, foe(), { ...foe({ combo: own }), id: 'foe-2' }] });
    const [h, seat, f1, f2] = m.entities, K = TEMPLATE_ARSENALS[JUGGLER];
    expect(h.rule.weapons.map((W) => W.id)).toEqual(K.weapons.map((W) => W.id));
    expect(h.rule.moveset).toBe(h.rule.weapons[0].moveset);
    expect(h.rule.weapon).toEqual(h.rule.weapons[0].sidearm.weapon);
    // (a seat that does not sheathe its blade has no figure for a sheathed weapon: left in the rack)
    expect(seat.rule.weapons.map((W) => W.id)).toEqual(K.weapons.filter((W) => !SHEATHED(K).includes(W.id)).map((W) => W.id));
    expect(f1.body.combo).toMatchObject({ juggle: { launch: K.juggle.launch } });
    expect(f2.body.combo).toBe(own);
    // (a kit without a juggle leaves the foes as they were)
    expect(armLevel({ arsenal: STEADY }, { entities: [hero(), foe()] }).entities[1].body.combo).toBeUndefined();
  });

  it('numbers its foes in the kit\'s strings: a grunt falls to one, an elite to three or four, a boss to ten or twelve', () => {
    const K = TEMPLATE_ARSENALS[STEADY], S = stringDamage(K);
    const ranked = (id, rank) => ({ ...foe(), id, rule: { type: 'ai', mind: { rank } } });
    const m = armLevel({ arsenal: STEADY }, { entities: [hero(), ranked('g', 'minion'), ranked('e', 'elite'), ranked('b', 'boss'), foe()] });
    const hp = Object.fromEntries(m.entities.filter((e) => e.team === 'foes').map((e) => [e.id, e.body.hp]));
    expect(hp.g / S).toBeCloseTo(1, 1);
    expect(hp.e / S).toBeGreaterThanOrEqual(3); expect(hp.e / S).toBeLessThanOrEqual(4);
    expect(hp.b / S).toBeGreaterThanOrEqual(10); expect(hp.b / S).toBeLessThanOrEqual(12);
    // (a foe that names no rank is a minion)
    expect(hp['foe-1']).toBe(foeHealth('minion', K));
    // (the string is the kit's first light combo on a normal blade: its moves' damage summed, never a fixed number)
    const W = K.weapons[0], c = W.combos.find((x) => !x.air && x.beats[0] === 'L');
    expect(S).toBe(c.moves.reduce((s, id) => s + (W.moves[id].damage ?? 1), 0) * (W.damage ?? 1) * HELD_STRIKE.normal.damage);
    // (no arsenal: the foe shelf's own numbers, the level as it was)
    const bare = { entities: [hero(), ranked('g', 'minion')] };
    expect(armLevel({}, bare)).toBe(bare);
  });

  it('through the level\'s lowering: a striking hero plays the kit, its first press taken as the kit\'s opener', () => {
    const m = firstLevel(striking({ feel: STEADY, arsenal: 'auto' })), p = pilot(m);
    const K = TEMPLATE_ARSENALS[STEADY], first = K.weapons[0];
    expect(p.rule.weapons[0].id).toBe(first.id);
    // (on the runtime: the hero armed as the page arms it with what it holds, world-scene.js armHeld, a foe ahead, a light press)
    const w = createWorld({ entities: [{ ...p, rule: { ...p.rule, strike: 'melee', strikeReach: 1.6, strikeDamage: 2 }, transform: { pos: [0, 0, 0], heading: 0 } }, foe({ hp: 1e6, poise: 1 })] });
    const hooks = { ground: () => 0 }, P = w.byId[p.id];
    for (let f = 0; f < 4; f++) stepWorld(w, {}, 1 / 60, hooks);
    stepWorld(w, { fire: 1 }, 1 / 60, hooks);
    for (let f = 0; f < 3; f++) stepWorld(w, {}, 1 / 60, hooks);
    const opener = first.combos.find((c) => c.beats[0] === 'L').moves[0];
    expect(P.mvPress).toMatchObject({ verdict: 'taken' });
    expect(P.mvPress.why).toMatch(new RegExp(opener));
  });
});
