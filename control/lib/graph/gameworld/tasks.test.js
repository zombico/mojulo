// A LEVEL'S TASKS (tasks.js): the game's kept fights laid in a building's rooms, in order. One world: the action game's
// first level (action-first-level.js) on a hero that fights hand to hand with a kit chosen from the templates in code.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages } from './levels.js';
import { layTasks, tasksCast, readTasks, PROP_OF } from './tasks.js';
import { actionFirstLevel, UNDEAD_CAST } from './action-first-level.js';
import { castRoles, taskFoeIds } from './fights.js';
import { fieldedIds } from './foes.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { composeMechanics } from '../game/mechanics.js';
import { PIECES } from '../era/compose-dress.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => (TEMPLATE_ARSENALS[id].ranged ?? []).length && TEMPLATE_ARSENALS[id].weapons.some((W) => Object.values(W.moves).some((m) => m.launch > 0)));
const BLADE = { id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] };
const A = actionFirstLevel(), H = MEADOWMARK_HERO.characters.hero;
const WORLD = { ...MEADOWMARK_HERO, id: 'citadel-test', feel: KIT, arsenal: 'auto', foes: A.foes, fights: A.fights, levels: { citadel: A.level }, start: undefined, links: undefined, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [BLADE] } } } };
const clean = (W) => Object.fromEntries(Object.entries(W).filter(([, v]) => v !== undefined));

describe('the action game\'s first level', () => {
  const G = readGameworld(clean(WORLD)), stage = gameStages(G).find((s) => s.level === 'citadel');
  it('is read: a building, its tasks each a kept fight in a room; its cast plays every role', () => {
    expect(G.levels.citadel.goal.tasks.map((t) => t.at)).toEqual(['gate', 'hall', 'gallery', 'sanctum']);
    const R = castRoles(G);
    expect(R).toMatchObject({ grunt: 'zombie', shooter: 'archer', elite: 'risen', boss: 'knight' });
    expect(taskFoeIds(G).sort()).toEqual(Object.keys(UNDEAD_CAST).sort());
    expect(fieldedIds(G).sort()).toEqual(Object.keys(UNDEAD_CAST).sort());
  });
  it('lays each fight in its room: inside it, turned to the doorway it is come into by, holding its laws', () => {
    const L = layTasks(G, 'citadel', stage);
    expect(L.findings.filter((f) => !/left out before a doorway/.test(f))).toEqual([]);
    expect(L.laid.map((t) => t.kind)).toEqual(['duel', 'melee', 'gallery', 'boss']);
    for (const t of L.laid) {
      const b = t.fight.box, c = t.fight.anchors.ring.at;
      expect(c[0] > b.x && c[0] < b.x + b.w && c[1] > b.y && c[1] < b.y + b.d, t.room).toBe(true);
      for (const p of t.fight.primitives) expect(p.at[0] > b.x && p.at[0] < b.x + b.w && p.at[1] > b.y && p.at[1] < b.y + b.d, `${t.room}/${p.id}`).toBe(true);
      for (const f of t.placed.flat()) expect(f.at[0] > b.x && f.at[0] < b.x + b.w && f.at[1] > b.y && f.at[1] < b.y + b.d, `${t.room}/${f.id}`).toBe(true);
      // every doorway of the room is a way it seals, a walker put back inside the room
      expect(t.fight.anchors.ways.length).toBeGreaterThan(0);
      for (const w of t.fight.anchors.ways) expect(Math.hypot(w.back[0] - w.at[0], w.back[1] - w.at[1])).toBeGreaterThan(2);
    }
    // its pieces stand as the stage's props, each a piece the stage knows
    expect(L.props.length).toBeGreaterThan(4);
    for (const it of L.props) { expect(PIECES[it.kind], it.kind).toBeTruthy(); expect(Object.values(PROP_OF)).toContain(it.kind); }
    const ids = L.laid.flatMap((t) => t.placed.flat().map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('foe-'))).toBe(true);
  });
  it('is one gauntlet over them: an arena a task, entered at its ring, its own doorways sealed, the last one the level\'s end', () => {
    const L = layTasks(G, 'citadel', stage), M = L.mechanic;
    expect(M.arenas.length).toBe(4);
    expect(M.at).toBeUndefined();
    const c = composeMechanics([M], { player: 'hero', spawn: [0, 0, 0], fall: 'none' });
    expect(c.on).toEqual({ 'gauntlet:clear:tasks': { end: 'success' } });
    expect(c.events.entities.filter((e) => e.type === 'seal' && e.on === false).length).toBe(M.arenas.reduce((n, a) => n + a.seals.length, 0));
    expect(L.audits[0].target).toEqual(L.laid[3].fight.anchors.ring.at);
    const cast = tasksCast(G, 'citadel', stage);
    expect(cast.entities.every((e) => e.dormant && e.team === 'foes')).toBe(true);
    expect(cast.entities.find((e) => /knight/.test(e.id)).rule.mind.rank).toBe('boss');
  });
  it('says what a task takes', () => {
    for (const [bad, says] of [[[], /in order/], [[{ fight: 'gate' }], /is \{ fight/], [[{ fight: 'moat', at: 'gate' }], /not a fight the world keeps/], [[{ fight: 'gate', at: 'hall' }, { fight: 'hall', at: 'hall' }], /a room holds one fight/]]) expect(() => readTasks(bad, { fights: A.fights }), JSON.stringify(bad)).toThrow(says);
    expect(() => readGameworld(clean({ ...WORLD, levels: { citadel: { ...A.level, goal: { ...A.level.goal, boss: true } } } }))).toThrow(/no boss beside them/);
  });
});
