// A BUILDING'S TANKS AND PENS (aquarium.js, zoo.js) and what lives in them (marine/tank.js, fauna/pen.js): a collection a
// wing, a tank or a pen in each of its rooms and its hall's the big one. The concepts: every tank stands in a room of
// its wing, its glass and water seen through, a box walked round; every fish swims inside its tank's water; every pen is
// fenced on all four sides; every animal walks inside its pen, and one too long for a gallery's pen is kept in the hall;
// a building with none lays none; a bad collection is refused.
import { describe, it, expect } from 'vitest';
import { layTanks, readTanks, TANK } from './aquarium.js';
import { layPens, readPens, PEN } from './zoo.js';
import { tankFauna } from '../marine/tank.js';
import { penFauna } from '../fauna/pen.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { planStage } from './stage.js';
import { withProgram } from './programs.js';

const plan = planStage(withProgram({ kind: 'stage', kit: 'bay-everyday', program: { use: 'museum', seed: 1, scale: 1.5 }, level: { door: 'out' } }));
const room = new Map(plan.rooms.map((r) => [r.id, r]));
const inside = (p, a, half, pad = 0) => Math.abs(p[0] - a[0]) <= half[0] + pad + 1e-6 && Math.abs(p[1] - a[1]) <= half[1] + pad + 1e-6;

describe('an aquarium\'s tanks', () => {
  const T = layTanks(plan, [{ title: 'Reef', life: ['clownfish', 'angelfish', 'octopus'] }]);
  it('stands a tank in each room of its wing, its glass and water seen through, a box walked round', () => {
    const rooms = T.wings[0].tanks.map((t) => t.room);
    expect(rooms.length).toBeGreaterThan(2);
    expect(T.wings[0].tanks.filter((t) => t.big)).toHaveLength(1);
    expect(T.colliders).toHaveLength(rooms.length);
    expect(T.faces.some((f) => f.group === 'stage:tankglass' && f.alpha > 0 && f.alpha < 1)).toBe(true);
    expect(T.faces.some((f) => f.group === 'stage:tankwater' && f.alpha > 0 && f.alpha < 1)).toBe(true);
    for (const s of T.swims) expect(s.z1).toBeGreaterThan(s.z0);
  });
  it('swims every fish inside its tank\'s water', () => {
    const F = tankFauna(T.swims, { lengthOf: () => 0.2 });
    expect(F.walkers.length).toBeGreaterThan(0);
    for (const w of F.walkers) {
      const s = T.swims.find((x) => w.path.every((p) => inside(p, x.at, x.half)));
      expect(s).toBeTruthy();
      for (const p of w.path) { expect(p[2]).toBeGreaterThanOrEqual(s.z0 - 1e-6); expect(p[2]).toBeLessThanOrEqual(s.z1 + 1e-6); }
    }
  });
  it('lays none where it has none, and refuses what is not the sea\'s', () => {
    expect(layTanks(plan, undefined).faces).toEqual([]);
    expect(() => readTanks([{ life: ['zebra'] }])).toThrow(/not one of the sea's/);
    expect(TANK.alpha.glass).toBeLessThan(1);
  });
});

describe('a zoo\'s pens', () => {
  const Z = layPens(plan, [{ title: 'Savanna', life: ['zebra', 'meerkat', 'elephant'] }]);
  it('fences each pen on all four sides, a walk kept round it', () => {
    for (const w of Z.walks) {
      const mine = Z.props.filter((p) => inside(p.at, w.at, w.half, 0.05));
      for (const f of ['+x', '-x', '+y', '-y']) expect(mine.some((p) => p.facing === f), f).toBe(true);
      const r = plan.rooms.find((x) => inside(w.at, [(x.x0 + x.x1) / 2, (x.y0 + x.y1) / 2], [(x.x1 - x.x0) / 2, (x.y1 - x.y0) / 2]));
      expect(w.at[0] - w.half[0]).toBeGreaterThanOrEqual(r.x0 + PEN.walk - 1e-6);
    }
    expect(Z.props.every((p) => p.kind === 'mesh-panel')).toBe(true);
  });
  it('walks every animal inside its pen; one too long for a gallery\'s pen is kept in the hall', () => {
    const F = penFauna(Z.walks, { lengthOf: (sp) => sizeClassOf(sp).extent });
    for (const w of F.walkers) expect(Z.walks.some((x) => w.path.every((p) => inside(p, x.at, x.half)))).toBe(true);
    const halls = Z.wings[0].pens.filter((p) => p.big).flatMap((p) => p.life), galleries = Z.wings[0].pens.filter((p) => !p.big).flatMap((p) => p.life);
    expect(halls).toContain('elephant');
    expect(galleries).not.toContain('elephant');
  });
  it('reads an animal by the name people say, and refuses one that is not the land\'s', () => {
    expect(readPens([{ life: ['brown bear'] }])[0].life).toEqual(['brownBear']);
    expect(() => readPens([{ life: ['clownfish'] }])).toThrow(/land's animals/);
  });
});
