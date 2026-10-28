// The hall (in-hall.js): rooms strung on a walk from a recipe, the out-trail's twin indoors. The grammar refuses what
// breaks it, the plan lays every beat on the kit's grid down one axis, the laws measure the stage's own plan (and fail
// when the sightline is broken), and the stage and the geocube kind build it.
import { describe, expect, it } from 'vitest';
import { readInHall, drawHallBeats, hallOrderFaults, planInHall, inHallLaws, IN_BEATS, IN_HALL } from './in-hall.js';
import { assembleStageScene, planStage, withHall, stageKit } from './stage.js';
import { assembleGeocubeScene } from './geocube.js';

const kit = stageKit('gothic-stone');

describe('the hall\'s grammar', () => {
  it('reads a recipe and refuses what breaks the grammar, saying why', () => {
    expect(readInHall({})).toMatchObject({ id: 'hall', run: IN_HALL.run[2], beats: null, mouth: 'arch', exit: 'arch' });
    expect(() => readInHall({ beats: ['squeeze', 'crossing', 'landmark'] })).toThrow(/planned, not built yet/);
    expect(() => readInHall({ beats: ['reveal', 'squeeze', 'landmark'] })).toThrow(/a reveal first/);
    expect(() => readInHall({ beats: ['squeeze', 'landmark', 'rest', 'reveal'] })).toThrow(/comes out of a squeeze/);
    expect(() => readInHall({ beats: ['pocket', 'squeeze', 'landmark'] })).toThrow(/a pocket first/);
    expect(() => readInHall({ size: 3 })).toThrow(/not a hall setting/);
    expect(() => readInHall({ exit: 'none' })).toThrow(/name its beats/);
  });

  it('draws beats under the grammar: a reveal out of a squeeze, a landmark and a pocket, no fault', () => {
    for (const seed of [1, 2, 3, 4]) {
      const order = drawHallBeats(5, seed);
      expect(hallOrderFaults(order), `seed ${seed}: ${order}`).toEqual([]);
      for (const b of ['reveal', 'landmark', 'pocket']) expect(order).toContain(b);
      expect(order.every((b) => IN_BEATS.includes(b))).toBe(true);
    }
  });
});

describe('the hall\'s plan', () => {
  const H = readInHall({ beats: ['squeeze', 'pocket', 'landmark', 'squeeze', 'reveal', 'rest'], heartbeat: 1, run: 16 });
  const P = planInHall(kit, H, 3);

  it('lays the spine down one axis on the kit\'s grid, each room an even width centred on it; the same seed, the same plan', () => {
    expect(planInHall(kit, H, 3)).toEqual(P);
    const spine = P.rooms.filter((r) => P.spine.includes(r.id));
    for (const r of P.rooms) for (const k of ['x', 'y', 'w', 'd']) expect(Number.isInteger(r[k] / kit.grid), `${r.id}.${k}`).toBe(true);
    for (const r of spine) { expect(r.x + r.w / 2).toBe(0); expect(r.w % (2 * kit.grid)).toBe(0); }
    spine.slice(1).forEach((r, i) => expect(r.y).toBe(spine[i].y + spine[i].d));
  });

  it('opens a pocket off the room before it, no deeper than its host; the landmark\'s link last; a mouth and an exit', () => {
    const pocket = P.beats.find((b) => b.kind === 'pocket'), r = P.rooms.find((q) => q.id === pocket.room), host = P.rooms.find((q) => q.id === pocket.host);
    expect(r.d).toBeLessThanOrEqual(host.d);
    expect(pocket.side === '+x' ? r.x : r.x + r.w).toBe(pocket.side === '+x' ? host.x + host.w : host.x);
    expect(P.links.at(-1).to).toBe(P.beats.find((b) => b.kind === 'landmark').room);
    expect(P.ways).toEqual([{ room: P.spine[0], side: '-y' }, { room: P.spine.at(-1), side: '+y' }]);
  });

  it('is held by laws measured on the stage\'s plan, and the sightline law fails when a doorway leaves the axis', () => {
    const plan = planStage({ kind: 'stage', kit: 'gothic-stone', rooms: P.rooms, links: P.links, ways: P.ways });
    const laws = inHallLaws(P, H, plan);
    expect(laws.filter((l) => !l.ok).map((l) => `${l.law}: ${l.value}`)).toEqual([]);
    // (the doorway into the landmark's room slid off the axis: the mouth no longer sees down it)
    const lm = P.beats.find((b) => b.kind === 'landmark').room, moved = { ...plan, links: plan.links.map((l) => (l.to === lm ? { ...l, lo: l.lo + 3, hi: l.hi + 3 } : l)) };
    expect(inHallLaws(P, H, moved).find((l) => l.law === 'landmark').ok).toBe(false);
  });
});

describe('the hall built', () => {
  it('a stage with a hall: its rooms, its beats and ports as anchors, its laws on the payload', () => {
    const S = assembleStageScene({ kind: 'stage', kit: 'gothic-stone', seed: 2, hall: { run: 10 } }, {});
    expect(S.hall.laws.filter((l) => !l.ok)).toEqual([]);
    expect(S.hall.ports.map((p) => [p.id, p.as])).toEqual([['mouth', 'arch'], ['exit', 'arch']]);
    expect(S.anchors.filter((a) => a.kind === 'beat' && a.hall === 'in-hall:hall')).toHaveLength(S.hall.beats.length);
    expect(() => withHall({ kind: 'stage', kit: 'gothic-stone', hall: {}, rooms: [] })).toThrow(/names no rooms/);
    expect(() => withHall({ kind: 'stage', kit: 'isekai-meadow', hall: {} })).toThrow(/not a room kit/);
  });

  it('the geocube kind walks an inside domain as a hall, in its interior\'s bones; an outside domain is refused', () => {
    const P = assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', domain: 'temple-hall', show: 'hall', seed: 5 }, {}, assembleStageScene);
    expect(P.hall.laws.filter((l) => !l.ok)).toEqual([]);
    expect(P.faces.some((f) => f.group === 'stage:accent')).toBe(true);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', domain: 'cove-dusk', show: 'hall' }, {}, assembleStageScene)).toThrow(/domain is outside/);
    expect(() => assembleGeocubeScene({ kind: 'geocube', cube: 'limestone-crags', hall: {} }, {}, assembleStageScene)).toThrow(/show 'hall'/);
  }, 60000);
});
