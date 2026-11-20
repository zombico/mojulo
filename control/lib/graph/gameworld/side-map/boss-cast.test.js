// The side map's boss (side-map/boss-cast.js, a chain's `boss`). The concepts: a chain names its boss only in a last room
// that teaches the boss, and a world only one of the roster; the boss stands in that room, in from its far wall on its
// floor, facing the way in, on the lane's rail, at its tier's height, in the hero's cel light; its fall is the level's end
// in place of the far side's reach; no figure, no boss (the level as it was); the run mints it through the hero door, in
// the hue its level's map holds back for its boss.
import { describe, it, expect } from 'vitest';
import { sideMapBossCast } from './boss-cast.js';
import { bossPlace, BOSS_BACK, FACING_IN } from './cast.js';
import { readSideMap } from './zones.js';
import { sideMapOf } from './scene.js';
import { BOSSES } from '../bosses.js';
import { bossSpec } from '../boss-spec.js';
import { platformerGame } from '../platformer-game.js';
import { gameStages, stageLevelOrder } from '../levels.js';
import { readGameworld } from '../world.js';
import { runSteps } from '../runner.js';
import { MEADOWMARK_HERO } from '../index.js';

const galaxy = () => readGameworld({ id: 'gb', name: 'Galaxy Boy', ...platformerGame({ pole: 'galaxy-boy' }).words });

describe('the side map\'s boss', () => {
  it('a chain names its boss in a last room that teaches it; a world, one of the roster', () => {
    const zones = [{ run: 'across', screens: 2, beat: 'rest' }, { room: [1, 1], teach: 'boss' }];
    expect(readSideMap({ zones, boss: 'crucible' }).boss).toBe('crucible');
    expect(() => readSideMap({ zones: zones.slice(0, 1), boss: 'crucible' })).toThrow(/last zone, a room/);
    const W = { id: 'gb', ...platformerGame({ pole: 'galaxy-boy' }).words };
    expect(() => readGameworld({ ...W, levels: { first: { ...W.levels.first, sidemap: { ...W.levels.first.sidemap, boss: 'nobody' } } } })).toThrow(/a boss of the roster/);
  });
  it('stood in its room, on the rail at its tier, in the hero\'s light; its fall the level\'s end', () => {
    const G = galaxy(), [stage] = gameStages(G), id = G.levels.first.sidemap.boss, B = BOSSES[id];
    const { layout } = sideMapOf({ ...stage.manifest, feel: G.feel, stature: 1.67 }), place = bossPlace(layout, id), Z = layout.zones.at(-1);
    expect(place.at[1]).toBeCloseTo(Z.rect[1] - BOSS_BACK, 3);
    expect(place.heading).toBe(FACING_IN);
    const extra = (ends) => sideMapBossCast(G, ends, { refs: { [id]: 'gb-foe-boss' } });
    const m = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', extra }).args.manifest;
    const boss = m.entities.find((e) => e.id === `boss-${id}`);
    expect(boss.transform.pos).toEqual(place.at);
    expect(boss.rule.rail.join).toEqual(place.at);
    expect(boss.rule.collideHeight).toBeCloseTo(1.67 * B.tier, 2);
    // (its figure the hero door's by its ref, or a machine's its frame's rig; in the hero's light either way)
    expect(m.figures[boss.body.figure]).toMatchObject({ ...(B.mecha ? { mecha: B.mecha } : { heroRef: 'gb-foe-boss' }), light: 'cel' });
    expect(m.game.mechanics.find((x) => x.kind === 'defeat-all')).toMatchObject({ who: `boss-${id}*`, count: 1, bar: { of: `boss-${id}`, hp: boss.body.hp, label: B.name } });
    // (its health the HUD's, never a bar over its head)
    expect(boss.body.hpBar).toBe('none');
    expect(m.game.mechanics.some((x) => x.kind === 'reach-exit')).toBe(false);
    // (no figure, no boss: the far side's reach, as it was; a machine needs none, its frame its figure)
    const bare = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', extra: (ends) => sideMapBossCast(G, ends, { refs: {} }) }).args.manifest;
    expect(bare.game.mechanics.some((x) => x.kind === 'reach-exit')).toBe(!B.mecha);
  });
  it('the run mints it through the hero door, in its own face', () => {
    // (a world with a character book: the hero's, its levels the side scroller's)
    const W0 = { ...MEADOWMARK_HERO }; for (const k of ['links', 'start', 'hub', 'levels', 'review']) delete W0[k];
    const words = platformerGame({ pole: 'galaxy-boy' }).words;
    // (a machine, level 0's worker bot, is its frame's rig: nothing minted for it)
    expect(runSteps({ ...W0, ...words }, { ref: 'gb', lookup: { stature: 1.67 } }).some((x) => x.key.startsWith('foe-bulwark'))).toBe(false);
    // (a boss of the hero's family, Crucible, on the same map: minted through the hero door)
    const crucible = { ...words, levels: { first: { ...words.levels.first, sidemap: { ...words.levels.first.sidemap, boss: 'crucible' } } } };
    const S = runSteps({ ...W0, ...crucible }, { ref: 'gb', lookup: { stature: 1.67 } });
    const step = S.find((x) => x.key === 'foe-crucible');
    expect(step).toBeDefined();
    expect(step.order.mint).toMatchObject({ kind: 'layered', via: 'hero' });
    expect(step.order.spec.adorn.with[0].signature.window).toBeUndefined();
    // (its identity the hue its level's map holds back for its boss: the room's mark and the boss in one colour)
    const G = readGameworld({ id: 'gb', name: 'Galaxy Boy', ...crucible }), [stage] = gameStages(G), { dress } = sideMapOf({ ...stage.manifest, feel: G.feel });
    expect(step.order.spec.palette.Pec).toBe(dress.palette.boss);
  });
  it('level 0\'s boss is a GIANT WORKER BOT (a mecha shelf work frame), gives nothing, a short fight: one shot low across the room', () => {
    const G = galaxy(), [stage] = gameStages(G), B = BOSSES[G.levels.first.sidemap.boss];
    expect(G.levels.first.sidemap.boss).toBe('bulwark');
    expect(B.tier).toBeGreaterThanOrEqual(2);
    expect(B.weapon).toBeNull();
    const extra = (ends) => sideMapBossCast(G, ends, { refs: { bulwark: 'gb-foe-bulwark' }, stature: 1.67 });
    const m = stageLevelOrder(G, stage, { heroRef: 'hero-ref', heroStature: 1.67, ref: 'lvl', extra }).args.manifest;
    const boss = m.entities.find((e) => e.id === 'boss-bulwark');
    // (its body the frame's rig, drawn at the tier's height: no hero-door figure, nothing to mint)
    expect(m.figures[boss.body.figure].mecha).toMatchObject(B.mecha);
    expect(() => bossSpec('bulwark')).toThrow(/machine/);
    expect(boss.rule.collideHeight).toBeCloseTo(1.67 * B.tier, 2);
    expect(boss.body.hp).toBe(B.hp);
    // (its round low across the room, under the hero's head, so a jump clears it; and it travels)
    expect(boss.weapon).toMatchObject({ fireClass: 'lob', lobAngle: 0, foeRound: true, cooldown: B.shot.cooldown });
    expect(boss.weapon.eye).toBeLessThan(1.67 * 0.8);
    // (a robot: it comes apart as it falls)
    expect(boss.body.vanish).toMatchObject({ die: 'dismantle', sever: 'all' });
  });
});
