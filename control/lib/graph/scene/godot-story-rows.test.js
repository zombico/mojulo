// TURN-BASED BATTLES AND ROUTINES (II5): both are composed of what the bus already runs in Godot (menus, guarded vars,
// cues on the clock's hour, the cast's walk), so they travel once proved: each level played by the same input in both
// engines, equal frame by frame on the bus and on the cast (the routine's walker stands where the web's does). The
// world freezes while a menu is up in both (the page's interact-channel; level-sim and level.gd since 0.22.0).
import { describe, it, expect } from 'vitest';
import { lowerPlay } from '../playscape/ui/direction.js';
import { composeMechanics } from '../game/mechanics.js';
import { playScript } from '../game/level-equivalence.js';
import { playBoth } from './godot-harness.js';
import { capabilityRegistry } from '../cosmos/registry.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]] };
const HERO = { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [1, 0, 1.7], heading: Math.PI / 2 } };
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Array.isArray(v) ? [...(o[k] || []), ...v] : v && typeof v === 'object' ? { ...(o[k] || {}), ...v } : v; return o; };

export function battleLevel() {
  const entities = [HERO, { id: 'foe', rule: { type: 'ai' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7], hp: 6 }, transform: { pos: [3, 0, 0.85], heading: Math.PI } }];
  const play = { battle: { hero: { atk: 3 }, foes: [{ who: 'foe', at: [3, 0], hp: 6, atk: 2 }] } };
  const m = composeMechanics([{ kind: 'win-when', when: { var: 'won', gte: 1 } }, { kind: 'fail-on-death' }], { player: 'hero', spawn: [1, 0, 0] });
  const events = merge(m.events, lowerPlay({ entities, play }, { player: 'hero' }));
  return { faces: [quad], entities, events, walk: { spawn: [1, 0, 0] }, game: { on: m.on } };
}
// stand by the foe, then pick Attack, Guard, Attack, Attack: each pick closes the menu, the foe answers a beat later
const PICK = (n) => ({ events: [{ type: `menu-pick:battle-foe:${n}` }] });
const battleFrames = () => Array.from({ length: 260 }, (_, i) => ({ 10: PICK(0), 60: PICK(1), 110: PICK(0), 160: PICK(0) }[i] || {}));

export function routineLevel() {
  const entities = [HERO, { id: 'baker', rule: { type: 'walk', speed: 2 }, transform: { pos: [0, 5, 0], heading: 0 } }];
  const play = { spots: [{ id: 'oven', at: [6, 5] }, { id: 'stall', at: [0, 10] }], routines: [{ who: 'baker', plan: [{ hour: 6, to: 'oven' }, { hour: 9, to: 'stall', pose: 'talk' }] }] };
  const m = composeMechanics([{ kind: 'clock', start: 5.5, rate: 60 }, { kind: 'survive', seconds: 600 }], { player: 'hero', spawn: [1, 0, 0] });
  const events = merge(m.events, lowerPlay({ entities, play }, { player: 'hero' }));
  return { faces: [quad], entities, events, walk: { spawn: [1, 0, 0] }, game: { on: m.on } };
}

describe('battles and routines travel', () => {
  it('on the web: the battle is fought turn by turn and won; the baker keeps her day', () => {
    const b = playScript(battleLevel(), battleFrames());
    const last = JSON.parse(b.keys.at(-1).split('|')[0]);
    expect(last.vars).toMatchObject({ won: 1, 'foe-hp-foe': 0 });
    expect(b.outcome).toBe('success');
    const r = playScript(routineLevel(), Array.from({ length: 300 }, () => ({})));
    const baker = r.keys.at(-1).split('|').find((x) => x.startsWith('baker:'));
    // at the stall (0, 10) within the walk's reach (0.3), facing its last leg from the oven
    const [x, y] = baker.split(':')[1].split(',').map((v) => Number(v) * 0.05);
    expect(Math.hypot(x - 0, y - 10)).toBeLessThan(0.35);
  });

  it('their cosmos marks say so', () => {
    const reg = capabilityRegistry();
    expect(reg.power.combat.values['turn-based'].godot).toBe('built');
    expect(reg.mind.social.values.schedule.godot).toBe('built');
  });

  it.skipIf(!GODOT)('a headless Godot fights the battle and keeps the routine, equal to the web frame by frame (MOJULO_GODOT)', () => {
    const bus = (keys) => keys.map((k) => k.split('|')[0]);
    const fight = playBoth(battleLevel(), battleFrames(), { godot: GODOT });
    expect(fight.godot.error).toBe(null);
    expect(bus(fight.godot.keys).slice(0, fight.web.at + 1)).toEqual(bus(fight.web.keys).slice(0, fight.web.at + 1));
    expect(fight.godot.states).toContain('complete');
    // the routine: the bus and the baker (a cast walker), frame by frame
    const day = playBoth(routineLevel(), Array.from({ length: 300 }, () => ({})), { godot: GODOT });
    expect(day.godot.error).toBe(null);
    const cast = (keys) => keys.map((k) => { const p = k.split('|'); return `${p[0]}|${p.find((x) => x.startsWith('baker:'))}`; });
    expect(cast(day.godot.keys)).toEqual(cast(day.web.keys));
  }, 600000);

  const PLANTS = [
    { name: 'the world runs under a menu', level: battleLevel, frames: battleFrames, from: '	if menu_open != null:\n		delta = 0.0\n', to: '' },
    { name: 'the cast stepped before the bus\'s ops', level: routineLevel, frames: () => Array.from({ length: 300 }, () => ({})), from: '		var facts: Array = cast.facts(cast_state)', to: '		cast.step(cast_state, minf(delta, 0.05))\n		var facts: Array = cast.facts(cast_state)' },
  ];
  it.skipIf(!GODOT)('every planted bug in the freeze and the step order is caught (MOJULO_GODOT)', () => {
    for (const p of PLANTS) {
      const { web, godot } = playBoth(p.level(), p.frames(), { godot: GODOT, mutate: [{ file: 'level.gd', from: p.from, to: p.to }] });
      const n = Math.min(web.keys.length, (web.at ?? web.keys.length - 1) + 1);
      const k = (keys) => keys.slice(0, n).map((x) => x.split('|').filter((y, j) => j === 0 || y.startsWith('baker:')).join('|'));
      expect(k(godot.keys), p.name).not.toEqual(k(web.keys));
    }
  }, 600000);
});
