// THE ACTION GAME'S FIRST LEVEL PLAYED (an e2e suite: the whole building resolved and stepped headless): the citadel, its
// four fights laid in its rooms (tasks.js), is won by the playthrough's floor player, who walks the rooms in order, fells
// every wave of every fight and ends the level on the last; one who does nothing wins nothing. The level is made as the
// run makes it (stageLevelOrder with the tasks' goal and cast); the hero a stand-in, since no figure is stored here.
// Nobody has looked: the eyes gate is the operator's.
import { describe, it, expect } from 'vitest';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { layTasks, tasksCast } from './tasks.js';
import { actionFirstLevel } from './action-first-level.js';
import { playLevel } from './playthrough.js';
import { TEMPLATE_ARSENALS } from './combos.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

const KIT = Object.keys(TEMPLATE_ARSENALS).find((id) => (TEMPLATE_ARSENALS[id].ranged ?? []).length && TEMPLATE_ARSENALS[id].weapons.some((W) => Object.values(W.moves).some((m) => m.launch > 0)));

describe('the citadel played through', () => {
  it('is won room by room by the floor player, and not by one who does nothing', async () => {
    const A = actionFirstLevel(), H = MEADOWMARK_HERO.characters.hero;
    const { start: _s, links: _l, ...base } = MEADOWMARK_HERO;
    const G = readGameworld({ ...base, id: 'citadel-play', feel: KIT, arsenal: 'auto', foes: A.foes, fights: A.fights, levels: { citadel: A.level }, characters: { ...MEADOWMARK_HERO.characters, hero: { ...H, adornment: { items: [{ id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] } } } });
    const st = gameStages(G).find((s) => s.level === 'citadel'), L = layTasks(G, 'citadel', st);
    const m = stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero', goal: () => [{ ...L.mechanic, audit: L.audits[0] }], extra: () => tasksCast(G, 'citadel', st, { refs: {}, hero: true }) }).args.manifest;
    expect(m.props.length).toBe(L.props.length);
    // (a stand-in in the stored hero's place, its blade in hand and on its back)
    const figures = Object.fromEntries(Object.entries(m.figures).map(([k, f]) => { if (!f.heroRef) return [k, f]; const { heroRef: _r, ...rest } = f; return [k, { ...rest, hero: { cast: 'male', gear: k.includes('sheath') ? { back: { item: 'sword' } } : { right: { item: 'sword' } } } }]; }));
    const { payload } = await resolveWorldScene({ ref: 'lv', manifest: { ...m, figures } }, {});
    const basic = playLevel(payload, { player: 'basic', seconds: 400 }), still = playLevel(payload, { player: 'still', seconds: 20 });
    expect(basic.won, basic.reason).toBe(true);
    expect(basic.foes.length).toBe(L.laid.flatMap((t) => t.placed.flat()).length);
    expect(basic.foes.every((f) => f.hp === 0)).toBe(true);
    expect(still.won).toBe(false);
  }, 1800000);
});
