import { describe, it, expect, beforeAll } from 'vitest';
import { boxOf } from './scene.js';
import { CASTLE_BOSSES, BOSS_DEFAULT, BOSS_LAWS, FIGHT_ROOM, CASTLE_FIGURES, bossRow, bossLaws, figuredBosses, standBosses, castleFigure } from './bosses.js';
import { readGameworld } from '../world.js';
import { runSteps } from '../runner.js';
import { vampireSonataGame } from './vampire-sonata.js';
import { vampireSonata, vampireSonataCastle } from './vampire-sonata.js';

let B, S;
beforeAll(() => {
  const m = { kind: 'geocube', show: 'metroidvania', metroidvania: vampireSonata(), stature: 1.63 };
  B = boxOf(m); S = boxOf({ ...m, bosses: 'stood' });
});

describe('the castle\'s bosses', () => {
  it('reads a boss by its name, and one the shelf does not know as the default', () => {
    expect(bossRow('the Gate Warden').id).toBe('gate-warden');
    expect(bossRow('Lord of the Keep').known).toBe(true);
    expect(bossRow('a stranger')).toMatchObject({ id: BOSS_DEFAULT, known: false });
    // (each row a foe class on a skin, taller than the hero, its health in blows)
    const row = Object.values(CASTLE_BOSSES)[0];
    expect(row.tier).toBeGreaterThan(1);
    expect(row.blows).toBeGreaterThan(0);
  });

  it('stood, leaves the stand-in blocks off: each boss is felled as its body falls, placed in its room', () => {
    expect(B.breakables.some((b) => b.id.startsWith('boss-'))).toBe(true);
    expect(S.breakables.some((b) => b.id.startsWith('boss-'))).toBe(false);
    expect(S.breakables.length).toBe(B.breakables.length - B.bosses.length);
    for (const b of S.held.bosses) expect(b.entity).toBe(b.id);
    expect(B.held.bosses.some((b) => b.entity)).toBe(false);
    for (const b of S.bosses) {
      const r = S.layout.rooms.find((x) => x.id === b.place.room), W = S.greybox.screen.width;
      expect(b.place.span[0]).toBeGreaterThanOrEqual(r.rect[0] * W);
      expect(b.place.span[1]).toBeLessThanOrEqual((r.rect[0] + r.rect[2]) * W);
      expect(b.place.at[1]).toBeGreaterThanOrEqual(b.place.span[0]);
      expect(b.place.at[1]).toBeLessThanOrEqual(b.place.span[1]);
    }
    expect(() => boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: vampireSonata(), bosses: true })).toThrow(/bosses is 'stood'/);
  });

  it('holds them to their laws, and says a boss the shelf does not know, one with no room, one easier going in', () => {
    const lost = (X) => bossLaws(X).filter((l) => !l.holds).map((l) => l.id);
    expect(bossLaws(S).map((l) => l.id)).toEqual([...BOSS_LAWS]);
    expect(lost(S)).toEqual([]);
    const with_ = (f) => ({ ...S, bosses: S.bosses.map(f) });
    const last = S.bosses.at(-1).id;
    expect(lost(with_((b) => (b.id === last ? { ...b, name: 'a stranger' } : b)))).toEqual(expect.arrayContaining(['known', 'rising']));
    expect(lost(with_((b) => (b.id === last ? { ...b, place: { ...b.place, span: [b.place.span[0], b.place.span[0] + FIGHT_ROOM / 2] } } : b)))).toContain('room-to-fight');
  });

  it('holds in a castle of boxes too: its connectors\' keepers among its bosses', () => {
    const C = boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: vampireSonataCastle(), stature: 1.63, bosses: 'stood' });
    expect(C.bosses.map((b) => bossRow(b.name).known)).not.toContain(false);
    expect(bossLaws(C).filter((l) => !l.holds)).toEqual([]);
  });

  it('each boss with a figure is made by the runner and stood as it, grown to its tier; one with none stands as a block', () => {
    const names = S.bosses.map((b) => b.name), ids = figuredBosses(names);
    expect(ids.length).toBeGreaterThan(0);
    const R = runSteps(vampireSonataGame({ heroRef: 'erina-ref' }), { ref: 'vs' }), steps = R.steps ?? R;
    for (const id of ids) expect(steps.find((x) => x.key === `boss-${id}`)).toBeDefined();
    // (stood: a door's body on its ref, at its tier; a beast fitted to its tier's height; no ref, no figure)
    const G = readGameworld(vampireSonataGame({ heroRef: 'erina-ref' })), refs = Object.fromEntries(ids.map((id) => [id, `ref-${id}`]));
    const P = standBosses(G, S, { stature: 1.63, refs }), e = P.entities[0], row = bossRow(S.bosses[0].name);
    expect(P.figures[e.body.figure].heroRef).toBe(`ref-${row.id}`);
    expect(e.body.scale).toBe(CASTLE_FIGURES[row.id].hero ? row.tier : undefined);
    const bare = standBosses(G, S, { stature: 1.63 });
    expect(bare.figures[bare.entities[0].body.figure].heroRef ?? null).toBe(null);
    expect(figuredBosses(['the Great Bell', 'a stranger'])).toEqual([]);
  }, 120000);

  it('a person boss\'s figure carries a wind-up and a strike for each of its moves; a beast\'s is its own', () => {
    const id = Object.keys(CASTLE_FIGURES).find((k) => CASTLE_FIGURES[k].hero), F = castleFigure(id);
    for (const m of Object.values(CASTLE_BOSSES[id].moves)) { expect(F.hero.clips[`wind_${m.pattern}`]).toHaveLength(2); expect(F.hero.clips[`strike_${m.pattern}`]).toHaveLength(2); }
    const beast = Object.keys(CASTLE_FIGURES).find((k) => CASTLE_FIGURES[k].animal);
    expect(castleFigure(beast)).toEqual(CASTLE_FIGURES[beast]);
  });
});
