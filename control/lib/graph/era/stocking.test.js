// A military base's stocking (stocking.js, laid by compose-dress.js layProps): a composed base building's rooms hold
// what a supply chain stocks them with, in place of the register's generic clusters, an extinguisher by each doorway,
// and the supply chain's laws read the result. One building stands for the procedure (the armoury: its weapons and its
// rounds); the laws are shown failing on things moved by hand, as an operator's patch would move them.
import { describe, expect, it } from 'vitest';
import { resolveCompose } from './compose.js';
import { resolveProps } from './compose-lay.js';
import { planStage } from './stage.js';
import { withProgram } from './programs.js';
import { stockLaws, roleOf, STOCK } from './stocking.js';
import { PIECES } from './compose-dress.js';

const composed = (use) => resolveProps(resolveCompose({ kind: 'stage', program: { use, seed: 1 }, compose: 'military greys' }));
const lawOf = (laws, id) => laws.find((l) => l.id === id);

describe('a base building stocked', () => {
  const m = composed('armoury'), plan = planStage(withProgram(m)), kinds = (role) => new Set(m.props.filter((it) => roleOf(it.room) === role).map((it) => it.kind));

  it('each room its stock: the cages their weapon racks, the magazine its rounds, an extinguisher by the doors', () => {
    expect(kinds('cage').has('weapon-rack')).toBe(true);
    expect(kinds('magazine').has('ammo-crate')).toBe(true);
    expect(m.props.some((it) => it.kind === 'extinguisher')).toBe(true);
    // (no generic cluster: a drum, the military set's fuel, stands nowhere in an armoury)
    expect(m.props.some((it) => it.kind === 'drum')).toBe(false);
    for (const l of plan.compose.dress) expect(l.ok, `${l.id}: ${l.says}`).toBe(true);
    // every piece a stock line names is a piece the build knows
    for (const lines of Object.values(STOCK)) for (const [k] of lines) expect(PIECES[k], k).toBeDefined();
  });

  it('laid the same twice', () => {
    expect(JSON.stringify(composed('armoury').props)).toBe(JSON.stringify(m.props));
  });

  it('the laws say what a hand moved wrong', () => {
    const rack = m.props.find((it) => it.kind === 'weapon-rack'), ammo = m.props.find((it) => it.kind === 'ammo-crate');
    const fuel = { ...ammo, id: `${ammo.room}/+x/drum-1`, kind: 'drum', at: [ammo.at[0] + 1, ammo.at[1]] };
    const none = () => [];
    expect(lawOf(stockLaws({ ...plan, use: 'barracks' }, [rack], none), 'weapons-in-armoury')).toMatchObject({ ok: false, says: expect.stringMatching(/weapons stand only in an armoury/) });
    expect(lawOf(stockLaws(plan, [ammo, fuel], none), 'fuel-apart')).toMatchObject({ ok: false, says: expect.stringMatching(/fuel within 3 m of ammunition/) });
    expect(lawOf(stockLaws(plan, [ammo], () => [[ammo.at[0] + 10, ammo.at[1]]]), 'extinguisher-by-exit').ok).toBe(false);
    expect(lawOf(stockLaws(plan, [], none), 'stocked').ok).toBe(false);
  });
});

describe('every other stage is dressed as it was', () => {
  it('a composed office lays its register\'s clusters, no stock and no stocking laws', () => {
    const m = resolveProps(resolveCompose({ kind: 'stage', program: { use: 'office', storeys: 1, bays: 2, seed: 1 }, compose: 'an office' }));
    expect(m.props.some((it) => it.kind === 'extinguisher')).toBe(false);
    expect(planStage(withProgram(m)).compose.dress.some((l) => l.id === 'stocked')).toBe(false);
  });
});
