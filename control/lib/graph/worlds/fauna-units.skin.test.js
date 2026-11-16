/**
 * A herd animal is drawn as one skin where its skin holds (worlds/fauna-units.js): its figure asks the controllable
 * drawer's skinned mesh (`skin: true`), so the page keeps its corners' joints and weights and a back that bends opens no
 * seam; measured over every clip it carries (scene/channels/walkers.js walkerSkinStretch).
 */
import { describe, expect, it } from 'vitest';

import { animalFigure } from './fauna-units.js';
import { unitOf } from '../era/biocube-fauna.js';
import { walkerSkinStretch, WALKER_BLEND } from '../scene/channels/walkers.js';
import { pageFigures } from '../scene/channels/controllable/index.js';
import { PER_RIG } from '../fauna/test-cases.js';

// one land animal, the first of the rigs' cases that can stand in a level as a unit
const id = PER_RIG.find((s) => { try { unitOf(s); return true; } catch { return false; } });

describe('a herd animal\'s skin', () => {
  it('asks for one skin where its skin holds over every clip, and the page keeps its weights', async () => {
    const u = unitOf(id), fig = await animalFigure({ species: id, gait: u.gait, behaviors: u.eat ? ['eat'] : [], reactions: u.reacts });
    const S = walkerSkinStretch(fig, { clips: 'all' });
    expect(S.stretch).toBeGreaterThanOrEqual(walkerSkinStretch(fig).stretch);
    expect(fig.skin === true).toBe(S.stretch <= WALKER_BLEND.holds);
    expect(fig.skin).toBe(true);
    // (the controllable drawer's bank: a skinned figure keeps its corners' joints and weights, a rigid one drops them)
    const kept = pageFigures({ a: fig }).figs.a.parts.find(Boolean), { skin, ...rigid } = fig, dropped = pageFigures({ a: rigid }).figs.a.parts.find(Boolean);
    expect(kept.jnt && kept.wgt).toBeTruthy();
    expect(dropped.jnt).toBeUndefined();
  }, 60000);
});
