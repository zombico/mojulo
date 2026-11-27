// A BOSS'S LAIR (gameworld/lair.js): a world map whose climax calls a boss of the boss shelf has it taken off the climax
// and fought in a cave chamber of its own, a page more after the last; a climax whose boss is a foe like any, as it was.
import { describe, it, expect } from 'vitest';
import { LAIR, lairBossOf, withoutLairBoss, lairStage, lairArena } from './lair.js';
import { VEHICLES, VEHICLE_IDS } from '../boss/vehicles.js';
import { DRAGONS, DRAGON_IDS, DRAGON_RISE } from '../boss/dragons.js';
import { standFoe, readBestiary } from './foes.js';
import { composeLive } from '../worlds/controllable/compose.js';

const beast = VEHICLE_IDS.find((k) => VEHICLES[k].figure);
const sketch = { scenario: { beats: [{ id: 'pack', kind: 'fight', foes: { grunt: 2 } }, { id: 'climax', kind: 'climax', foes: { boss: 1 } }] } };
const G = (vehicle) => ({ foes: { grunt: { class: 'brute' }, boss: { class: 'brute', rank: 'boss', ...(vehicle ? { vehicle } : {}) } } });
// (a dragon whose rise brings an arena event: the one that shows the event runs)
const drake = DRAGON_IDS.find((k) => DRAGONS[k].rise.event) ?? DRAGON_IDS[0];
const GD = { foes: { grunt: { class: 'brute' }, boss: { class: 'brute', rank: 'boss', dragon: drake } } };

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
    expect(S.manifest).toMatchObject({ kind: 'dungeon', fire: true, castLight: { cave: LAIR.cast } });
    expect(S.manifest.chambers[0].radius).toBe(LAIR.chamber.radius);
    expect(S.label).toContain(VEHICLES[beast].name.replace(/^The /, ''));
  });
  it('a climax whose boss is a foe like any keeps it: no lair', () => {
    expect(lairBossOf(G(null), { sketch })).toBeNull();
  });
  it('a dragon is fought in its lair: on four legs, then risen, its rise its element\'s', () => {
    expect(lairBossOf(GD, { sketch })).toEqual({ kind: 'boss', beat: 'climax' });
    expect(lairStage('lvl', 4, { kind: 'boss', beat: 'climax' }, GD).label).toBe(`${DRAGONS[drake].name}'s lair`);
    expect(() => readBestiary({ boss: { class: 'brute', dragon: 'wyrm-of-nowhere' } })).toThrow(/dragon/);
    // (stood: its body the primary form, its risen form the figure its rise swaps on, its class's weapon left off)
    const part = { figures: {}, entities: [] };
    const e = standFoe(GD, part, { id: 'foe-boss-1', eid: 'boss', entry: GD.foes.boss, at: [...LAIR.boss], heading: 0 }, { more: { arena: lairArena() } });
    expect(part.figures['foe-boss']).toEqual({ dragon: { id: drake, form: 'primary' } });
    expect(part.figures['foe-boss-risen']).toEqual({ dragon: { id: drake, form: 'risen' } });
    expect(e.body.figure).toBe('foe-boss');
    expect(e.rule.boss).toMatchObject({ kind: 'human', figures: ['foe-boss-risen'], arena: lairArena() });
    expect(e.rule.boss.phases[0].figure).toBeUndefined();
    expect(e.rule.boss.phases.slice(1).every((ph) => ph.figure === 'foe-boss-risen')).toBe(true);
    expect(e.rule.mind).toMatchObject({ rank: 'boss' });
    expect(e.rule.mind.phases[0].below).toBe(DRAGON_RISE.below);
    expect(e.rule.loadout).toBeUndefined();
    // (on the live runtime: crossing into its rise it wears the risen form and its rise's event runs)
    const E = composeLive(), hooks = { ground: () => 0 };
    const pilot = { id: 'p', pilotable: true, team: 'hero', rule: { type: 'platform', speed: 5, eye: 0, jumpSpeed: 0 }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos: [8, 0, 0], heading: Math.PI } };
    const s = E.createWorld({ camera: { rule: 'follow', target: 'p' }, entities: [pilot, { ...e, rule: { ...e.rule, type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    for (let k = 0; k < 2; k++) E.stepWorld(s, {}, 0.05, hooks);
    expect(s.byId['foe-boss-1'].body.figure).toBe('foe-boss');
    s.byId['foe-boss-1'].mindPhase = 0;
    for (let k = 0; k < 2; k++) E.stepWorld(s, {}, 0.05, hooks);
    expect(s.byId['foe-boss-1'].body.figure).toBe('foe-boss-risen');
    if (DRAGONS[drake].rise.event === 'burn') expect(s.bossHazards.length).toBeGreaterThan(0);
  });
});
