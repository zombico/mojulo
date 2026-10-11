import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { emitThreeWorld } from '@/lib/graph/scene/scene-three';
import { applyCommand, builtinCommander, createCommanderPort, commanderSource } from './commander.js';

// The COMMANDER (commander.js): at strategy rate it patches a mind's rule (posture, boost, melee, dodge, gun
// cycling); the mind keeps the reflexes. Page-only: injected only when some body is `rule.commanded`.

const DT = 1 / 60;
const hooks = { ground: () => 0 };
const body = { type: 'mesh', hittable: true, hp: 100, radius: 1 };
const gun = { fireClass: 'sight', magazine: 30, cooldown: 0.2, damage: 1, range: 400 };
const duel = (mRule = {}) => createWorld({
  entities: [
    { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { ...body }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'm', rule: { type: 'ai', speed: 10, turn: 4, ...mRule }, weapon: { ...gun }, body: { ...body }, transform: { pos: [80, 0, 0], heading: Math.PI } },
  ],
});
const digest = (over = {}) => ({
  tick: 1, t: 5,
  self: { hp: 100, poise: 0, boost: 0, stunned: false, downed: false },
  foe: { hp: 100, stunned: false, downed: false, dist: 250 },
  since_last_tick: { my_stuns: 0, foe_stuns: 0, my_hp_lost: 0, foe_hp_lost: 0 },
  match: { my_kills: 0, foe_kills: 0, target: 0 },
  ...over,
});

describe('commander: a command is a rule patch', () => {
  it('each posture sets the standoff and the spacing; boost, melee, dodge and the gun cycle follow', () => {
    const r = {};
    applyCommand(r, { posture: 'kite', boost: 'conserve', melee: false, dodge: true, cycle: 3.2 });
    expect(r).toMatchObject({ standoff: 360, approach: { style: 'siege', close: 0.95, weave: 1.45 }, meleeSeek: false, boost: true, boostBurst: 1, boostRest: 3, dodge: true, weaponRotate: 3.2 });
    applyCommand(r, { posture: 'rush', boost: 'commit', melee: true, dodge: false });
    expect(r).toMatchObject({ standoff: 45, approach: { style: 'rush' }, meleeSeek: true, boostBurst: 4, dodge: false, weaponRotate: 3.2 });
    applyCommand(r, { posture: 'nonsense' });   // unknown words fall back to skirmish / juke
    expect(r).toMatchObject({ standoff: 150, boostBurst: 2.5 });
  });

  it('the reference commander snipes, presses an opening, and backs off from a closing foe', () => {
    expect(builtinCommander(digest(), { history: [] }).posture).toBe('siege');
    const open = builtinCommander(digest({ foe: { hp: 80, stunned: true, downed: false, dist: 90 } }), { history: [] });
    expect(open).toMatchObject({ posture: 'skirmish', melee: true });
    const close = builtinCommander(digest({ foe: { hp: 100, stunned: false, downed: false, dist: 60 } }), { history: [] });
    expect(close).toMatchObject({ posture: 'kite', leadStagger: true });
  });
});

describe('commander: the port over a live engine world', () => {
  it('reads the fight at its period, finds the nearest foe on its own, and patches the commanded rule', async () => {
    const w = duel({ commanded: true });
    const port = createCommanderPort({ commandedId: 'm', period: 2 });
    let reads = 0, last = null;
    for (let i = 0; i < 60 * 5; i++) {
      port.onFrame(w);
      stepWorld(w, {}, DT, hooks);
      await Promise.resolve(); await Promise.resolve();
      if (port.currentCommand() !== last) { last = port.currentCommand(); reads++; }
    }
    expect(reads).toBeGreaterThanOrEqual(1);
    expect(port.currentNote()).not.toBe('scripted');
    expect(w.byId.m.rule.standoff).toBe({ rush: 45, skirmish: 150, siege: 300, kite: 360 }[last.posture]);
  });

  it('a hook port asks the page; no hook means the mind stays scripted', async () => {
    const w = duel({ commanded: true });
    const seen = [];
    globalThis.__testCmd = (dg) => { seen.push(dg); return { posture: 'rush', melee: false, note: 'hooked' }; };
    const port = createCommanderPort({ commandedId: 'm', port: 'hook', hook: '__testCmd', period: 1 });
    for (let i = 0; i < 90; i++) { port.onFrame(w); stepWorld(w, {}, DT, hooks); await Promise.resolve(); await Promise.resolve(); }
    delete globalThis.__testCmd;
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(seen[0].foe.dist).toBe(80);
    expect(port.currentNote()).toBe('hooked');
    expect(w.byId.m.rule.standoff).toBe(45);
    const quiet = createCommanderPort({ commandedId: 'm', port: 'hook', hook: '__absent', period: 1 });
    for (let i = 0; i < 90; i++) { quiet.onFrame(w); await Promise.resolve(); }
    expect(quiet.currentNote()).toBe('scripted');
  });

  it('the mind spaces the whole body by the rule\'s approach when the weapon slot names none', () => {
    // standoff 150 from 200 out: rush drives inside it, the bare rule holds it, siege and kite hold off
    const settle = (approach) => {
      const w = createWorld({ entities: [
        { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { ...body }, transform: { pos: [0, 0, 0], heading: 0 } },
        { id: 'm', rule: { type: 'ai', speed: 10, turn: 4, standoff: 150, ...(approach ? { approach } : {}) }, weapon: { ...gun }, body: { ...body }, transform: { pos: [200, 0, 0], heading: Math.PI } },
      ] });
      for (let i = 0; i < 60 * 10; i++) stepWorld(w, {}, DT, hooks);
      return Math.hypot(...w.byId.m.transform.pos.slice(0, 2));
    };
    const r = {};
    applyCommand(r, { posture: 'rush' }); const rush = settle(r.approach);
    applyCommand(r, { posture: 'kite' }); const kite = settle(r.approach);
    const bare = settle(null);
    expect(rush).toBeLessThan(140);
    expect(bare).toBeCloseTo(150, 0);
    expect(kite).toBeGreaterThan(190);
  });
});

describe('commander: the page', () => {
  const floor = { corners: [[-50, -50, 0], [50, -50, 0], [50, 50, 0], [-50, 50, 0]], fill: '#556' };
  const ents = (commanded) => [
    { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: { ...body } },
    { id: 'm', rule: { type: 'ai', speed: 10, ...(commanded ? { commanded: true } : {}) }, weapon: { ...gun }, body: { ...body } },
  ];

  it('no commanded body: no commander bytes, even when the world names a transport', () => {
    const html = emitThreeWorld({ faces: [floor], entities: ents(false), camera: { rule: 'follow', target: 'p' }, commander: { port: 'hook' } });
    expect(html).not.toContain('createCommanderPort');
    expect(html).not.toContain('__mojCmd');
  });

  it('a commanded body injects the port, its HUD line and the per-frame step', () => {
    const html = emitThreeWorld({ faces: [floor], entities: ents(true), camera: { rule: 'follow', target: 'p' }, commander: { port: 'http', url: 'http://127.0.0.1:9/cmd', period: 3 } });
    expect(html).toContain('function createCommanderPort');
    expect(html).toContain('__mojCmd.step(__world);');
    expect(html).toContain('"http://127.0.0.1:9/cmd"');
    expect(html).toContain('period: 3');
  });

  it('the injected source is self-contained (import-free) and runs', () => {
    const make = new Function(`${commanderSource()}\nreturn createCommanderPort;`);
    const port = make()({ commandedId: 'm' });
    expect(typeof port.onFrame).toBe('function');
    expect(commanderSource()).not.toMatch(/\bimport\b|\brequire\(/);
  });
});
