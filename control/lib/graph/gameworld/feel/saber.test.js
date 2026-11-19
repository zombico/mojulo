// The saber (feel/saber.js; its look round-look.js SLASH_LOOK, SABER_STRAND; drawn by the controllable page). The
// concepts: Galaxy Boy's feel's saber variant strikes with the string and fires no buster; its three cuts chain on the fire
// press and none moves the body; its damage is on the buster's scale (a cut over a tap, the string over a full charge);
// only a page with a saber's body draws its slash and its blade's strand (a buster's page none); the same rule each read.
import { describe, it, expect } from 'vitest';
import { saberRule, SABER_STRIKE, SABER_COMBOS } from './saber.js';
import { feelRule, BUSTER_DAMAGE } from './lower.js';
import { emitThreeWorld } from '../../scene/scene-three.js';

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
  it('three cuts on the fire press, none moving the body', () => {
    const M = saberRule().moveset;
    let node = M.tree.L, n = 0;
    while (node) { n++; expect(M.moves[node.move].travel).toBeNull(); node = node.next?.L; }
    expect(n).toBe(3);
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
});
