// The scene composer's reader (compose.js): words name each axis they speak of, the rest lean to the register the words
// lean to, nothing said falls to the base; a pinned axis is kept; the reading is stored once and built from.
import { describe, expect, it } from 'vitest';
import { COMPOSE_AXES, COMPOSE_WORDS, REGISTER_WORDS, readCompose, resolveCompose, composeForBuild } from './compose.js';
import { bayKitOf } from './style/bay-kits.js';
import { planStage, assembleStageScene } from './stage.js';

const REGS = Object.keys(REGISTER_WORDS);
// (one register's words for its place, another's for its palette: the words chosen from the tables, not by hand)
const [home, other] = REGS;
const place = REGISTER_WORDS[other][1], paint = COMPOSE_WORDS.palette[home][0];
const ROOMS = { rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };

describe('the scene composer reads an intent', () => {
  it('an axis its words name takes that value; the rest lean to the place the words name', () => {
    const { resolved, said } = readCompose(`a ${place} in ${paint}`, home);
    expect(resolved.palette).toBe(home);
    expect(said.palette).toContain(paint);
    for (const a of COMPOSE_AXES.filter((x) => x !== 'palette')) expect([a, resolved[a], said[a]]).toEqual([a, other, `leans ${other}`]);
  });

  it('nothing said falls to the base; a pinned axis is kept over the words; a named register is the base', () => {
    expect(Object.values(readCompose('somewhere', other).resolved)).toEqual(COMPOSE_AXES.map(() => other));
    const pinned = readCompose({ words: `${paint}`, palette: other, register: other }, home);
    expect(pinned.resolved.palette).toBe(other);
    expect(pinned.said.palette).toBe('pinned');
    expect(pinned.resolved.construction).toBe(home); // (the words lean to the palette's register)
  });

  it('refuses what it cannot read, by name', () => {
    expect(() => readCompose({ floor: 'red' })).toThrow(/compose.floor is not a setting/);
    expect(() => readCompose({ palette: 'pink' })).toThrow(/compose.palette is/);
    expect(() => readCompose({ register: 'castle' })).toThrow(/compose.register is/);
  });
});

describe('the reading is stored once and built from', () => {
  const m = { kind: 'stage', kit: `bay-${home}`, compose: `a ${place} in ${paint}`, ...ROOMS };

  it('authoring stores the intent, the axes and why; a stored reading comes back as it was', () => {
    const r = resolveCompose(m);
    expect(r.compose.intent).toBe(m.compose);
    expect(r.compose.resolved).toEqual(readCompose(m.compose, home).resolved);
    expect(resolveCompose(r)).toBe(r);
    // the build reads the stored axes, whatever the words would say now
    const kept = { ...r, compose: { ...r.compose, resolved: { ...r.compose.resolved, plot: home } } };
    expect(composeForBuild(kept).plot).toBe(home);
  });

  it('a composed stage builds on the composed kit, and the bay laws hold', () => {
    const r = resolveCompose(m), plan = planStage(r), kit = bayKitOf(r.compose.resolved);
    expect(plan.kit.tiles.wall.family).toBe(kit.tiles.wall.family);
    expect(plan.kit.B.light).toBe(kit.B.light);
    expect(assembleStageScene(r, {}).bay.laws.filter((l) => !l.ok)).toEqual([]);
  });

  it('composes only a bay room', () => {
    expect(() => planStage({ ...m, kit: 'gothic-stone' })).toThrow(/compose composes a bay room/);
  });
});
