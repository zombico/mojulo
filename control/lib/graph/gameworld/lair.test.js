// A BOSS'S LAIR (gameworld/lair.js): a world map whose climax calls a boss of the boss shelf has it taken off the climax
// and fought in a cave chamber of its own, a page more after the last; a climax whose boss is a foe like any, as it was.
import { describe, it, expect } from 'vitest';
import { LAIR, lairBossOf, withoutLairBoss, lairStage } from './lair.js';
import { VEHICLES, VEHICLE_IDS } from '../boss/vehicles.js';

const beast = VEHICLE_IDS.find((k) => VEHICLES[k].figure);
const sketch = { scenario: { beats: [{ id: 'pack', kind: 'fight', foes: { grunt: 2 } }, { id: 'climax', kind: 'climax', foes: { boss: 1 } }] } };
const G = (vehicle) => ({ foes: { grunt: { class: 'brute' }, boss: { class: 'brute', rank: 'boss', ...(vehicle ? { vehicle } : {}) } } });

describe('a boss\'s lair', () => {
  it('a climax whose boss stands as a boss of the shelf is taken off its page and fought in a lair of its own', () => {
    const b = lairBossOf(G(beast), { sketch });
    expect(b).toEqual({ kind: 'boss', beat: 'climax' });
    const g = withoutLairBoss({ sketch }, b);
    expect(g.sketch.scenario.beats.find((x) => x.id === 'climax').foes).toBeUndefined();
    expect(g.sketch.scenario.beats.find((x) => x.id === 'pack').foes).toEqual({ grunt: 2 });
    // (read as the grid carries it, too)
    expect(withoutLairBoss({ grid: { sketch } }, b).grid.sketch.scenario.beats[1].foes).toBeUndefined();
    const S = lairStage('lvl', 4, b, G(beast));
    expect(S).toMatchObject({ level: 'lvl', section: 'lair', index: 4, boss: 'boss' });
    expect(S.manifest).toMatchObject({ kind: 'dungeon', fire: true });
    expect(S.manifest.chambers[0].radius).toBe(LAIR.chamber.radius);
    expect(S.label).toContain(VEHICLES[beast].name.replace(/^The /, ''));
  });
  it('a climax whose boss is a foe like any keeps it: no lair', () => {
    expect(lairBossOf(G(null), { sketch })).toBeNull();
  });
});
