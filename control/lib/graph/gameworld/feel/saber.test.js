// The saber (feel/saber.js; its look round-look.js SLASH_LOOK, SABER_STRAND; drawn by the controllable page). The
// concepts: Galaxy Boy's feel's saber variant strikes with the string and fires no buster; its three cuts chain on the fire
// press and none moves the body, each splitting the feet in place; its damage is on the buster's scale (a cut over a tap, the string over a full charge);
// only a page with a saber's body draws its slash and its blade's strand (a buster's page none); the same rule each read.
import { describe, it, expect } from 'vitest';
import { saberRule, SABER_STRIKE, SABER_COMBOS } from './saber.js';
import { feelRule, BUSTER_DAMAGE } from './lower.js';
import { emitThreeWorld } from '../../scene/scene-three.js';
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';

const BLOW = 20;
const floor = { corners: [[-2, -20, 0], [2, -20, 0], [2, 20, 0], [-2, 20, 0]], normal: [0, 0, 1], fill: '#3a4048', group: 'sidemap:rock' };
const page = (rule) => emitThreeWorld({ faces: [floor], entities: [{ id: 'p1', pilotable: true, transform: { pos: [0, 0, 0], heading: Math.PI / 2 }, rule: { type: 'platform', eye: 1, speed: 6, collideHeight: 1.6, ...rule }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } }],
  camera: { rule: 'side-map', target: 'p1', screen: [24, 13.5], dist: 18, tilt: 0.05, lookH: 1.2, zones: [{ rect: [-20, 20, -2, 10], lock: 'z', checkpoint: [0, 0] }] }, inline: true });

describe('the saber', () => {
  it('the saber variant strikes with the string and fires no buster', () => {
    const R = feelRule({ pole: 'galaxy-boy', takes: true, variant: 'saber' });
    expect(R.buster).toBeUndefined();
    expect(R).toMatchObject({ strike: 'melee', strikeDamage: SABER_STRIKE.damage });
    expect(feelRule({ pole: 'galaxy-boy', takes: true }).moveset).toBeUndefined();
  });
  it('three cuts on the fire press, none moving the body, each planting its feet split', () => {
    const M = saberRule().moveset;
    let node = M.tree.L, n = 0;
    while (node) { n++; expect(M.moves[node.move].travel).toBeNull(); expect(M.moves[node.move].plant).toBeGreaterThan(0); node = node.next?.L; }
    expect(n).toBe(3);
    // (each cut plants its feet in place, one leg forward and one back; the finisher's split the widest)
    expect(M.moves['saber-3'].plant).toBeGreaterThan(M.moves['saber-1'].plant);
  });
  it('in the air, a cut at what is ahead that never holds the hero up: the same rise and fall as a jump without it', () => {
    const rule = { ...feelRule({ pole: 'galaxy-boy', takes: true, variant: 'saber' }), eye: 0, collideRadius: 0.3, collideHeight: 1.7 };
    const flight = (cut, foe) => {
      const w = createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', ...rule }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } },
        ...(foe ? [{ id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1000, poise: 1 }, rule: { type: 'static' }, transform: { pos: [0, 1.6, 1.4], heading: -Math.PI / 2 } }] : [])] });
      const p = w.byId.p, zs = [], moves = [];
      for (let i = 0; i < 70; i++) { stepWorld(w, { jump: i === 2 ? 1 : 0, jumpHeld: i < 30 ? 1 : 0, fire: cut && i === 20 ? 1 : 0 }, 1 / 60, { ground: () => 0 }); zs.push(+p.transform.pos[2].toFixed(5)); if (p.swingT != null && p.mvPress) moves.push(p.mvPress.why); }
      return { zs, moves, hp: foe ? w.byId.foe.body.hp : null };
    };
    // (the air cut taken; with nothing to strike, the flight exactly a jump's: no hang, no kick)
    const air = flight(true, false);
    expect(air.moves.some((m) => /saber-air/.test(m))).toBe(true);
    expect(air.zs).toEqual(flight(false, false).zs);
    // (a foe ahead is cut; the flight pauses only for the hit's own freeze, the hitstop, then goes on as it was)
    const hit = flight(true, true), plain = flight(false, true), H = Math.round((rule.hitstop?.max ?? 2));
    expect(hit.hp).toBeLessThan(1000);
    const at = hit.zs.findIndex((z, i) => z !== plain.zs[i]);
    expect(hit.zs.slice(at + H, at + H + 20)).toEqual(plain.zs.slice(at, at + 20));
  });
  it('its damage on the buster\'s scale: a cut over a tap, the string over a full charge', () => {
    const cuts = SABER_COMBOS.combos[0].moves.map((id) => SABER_STRIKE.damage * (SABER_COMBOS.moves[id].damage ?? 1));
    expect(cuts[0]).toBeGreaterThan(BLOW * BUSTER_DAMAGE[0]);
    expect(cuts.reduce((a, b) => a + b, 0)).toBeGreaterThan(BLOW * BUSTER_DAMAGE.at(-1));
    expect(cuts.at(-1)).toBeGreaterThan(cuts[0]);
  });
  it('only a saber\'s page draws its slash and its blade\'s strand', () => {
    const sab = page(saberRule()), bus = page(feelRule({ pole: 'galaxy-boy', takes: true }));
    expect(sab).toContain('__slashFx');
    expect(sab).toContain('__strandFx');
    expect(bus).not.toContain('__strandFx');
    expect(saberRule()).toEqual(saberRule());
  });
  it('only a page whose hero\'s dash raises dust draws it (a burst and a wisp off the feet on the ground)', () => {
    const R = feelRule({ pole: 'galaxy-boy', takes: true });
    expect(page(R)).toContain('__dashDust');
    const { dust, ...dash } = R.dash;
    expect(page({ ...R, dash })).not.toContain('__dashDust');
  });
});
