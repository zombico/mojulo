// TRAVEL (III-c): a level's side of the game shell in Godot as on the page (channels/game.js, modelled by
// level-equivalence.js gameChannel): a level ended through a named exit, what it gathered and its kept numbers on the
// envelope; arrived at from another level (arrive:<ref> heard on the first frame); entered by a door (the pilot at that
// door's spawn, facing in); left by a door, once. The shell's side (game.gd: a map's travel, doors, runs, kept bests) is
// held to the web shell's own functions in godot-game-shell.test.js.
import { describe, it, expect } from 'vitest';
import { playBoth } from './godot-harness.js';
import { playScript, compareKeys } from '../game/level-equivalence.js';

const GODOT = process.env.MOJULO_GODOT;
const quad = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]] };
const zone = (id, at, r = 1.5) => ({ type: 'zone', zone: id, at, radius: r, planar: true, watch: 'hero' });

export function travelLevel() {
  return {
    faces: [quad],
    entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } }],
    events: {
      vars: { score: 0, came: 0 },
      sources: [zone('coin', [4, 0, 0], 1), zone('east', [10, 0, 0]), zone('west', [-10, 0, 0]), zone('cellar', [0, 10, 0])],
      reactions: [
        { on: 'enter', match: { zone: 'coin' }, do: 'inc', var: 'score', by: 3 },
        { on: 'enter', match: { zone: 'coin' }, do: 'emit', type: 'found:coin' },
        { on: 'enter', match: { zone: 'east' }, do: 'emit', type: 'goal:reached:east' },
        { on: 'enter', match: { zone: 'west' }, do: 'emit', type: 'goal:reached:west' },
        { on: 'enter', match: { zone: 'cellar' }, do: 'emit', type: 'door:cellar' },
        { on: 'arrive:town', do: 'set', var: 'came', to: 1 },
      ],
    },
    game: {
      on: {
        'found:*': { emit: { type: 'setFlag', slice: 'world', key: '{event}' } },
        'goal:reached:east': { end: 'success', exit: 'east' }, 'goal:reached:west': { end: 'success', exit: 'west' },
        'door:cellar': { door: 'cellar' },
      },
      produces: { events: [{ type: 'setFlag', slice: 'world' }], results: ['success', 'fail', 'abort'] },
      keep: [{ var: 'score', label: 'score', best: 'high', scale: 10 }, { var: 'came', label: 'from town', best: 'low', unit: '×' }],
      arrive: ['town'],
      doors: [{ id: 'cellar', at: [0, 10, 0], spawn: [6, -4, 0], heading: 1.2 }],
    },
  };
}
const run = (...parts) => parts.flatMap(([n, input]) => Array.from({ length: n }, () => ({ ...input })));
const east = () => run([60, { forward: 1 }]);
const north = () => run([20, { turn: -1 }], [60, { forward: 1 }]);
// up to the frame the level ends (the page's world runs on under its result card; a finished Godot level stands)
const upto = (web, godot) => { const n = (web.at ?? web.keys.length - 1) + 1; return compareKeys(web.keys.slice(0, n), godot.keys.slice(0, n)); };
const line = (text, tag) => (text.split('\n').find((l) => l.startsWith(`[${tag}] `)) || '').slice(tag.length + 3);

describe('a level\'s travel', () => {
  it('the web side: east ends through its exit with the coin gathered and kept; the door is left by; arrival and entry', () => {
    const a = playScript(travelLevel(), east());
    expect(a.envelope).toEqual({ result: 'success', exit: 'east', events: [{ type: 'setFlag', slice: 'world', key: 'found:coin' }], stats: { kept: [{ label: 'score', value: 30, best: 'high' }, { label: 'from town', value: 0, best: 'low', unit: '×' }] } });
    expect(playScript(travelLevel(), east(), { params: { arrive: 'town' } }).envelope.stats.kept[1].value).toBe(1);
    expect(playScript(travelLevel(), east(), { params: { arrive: 'elsewhere' } }).envelope.stats.kept[1].value).toBe(0);
    const d = playScript(travelLevel(), north());
    expect(d.door).toEqual({ door: 'cellar', events: [] });
    expect(d.envelope).toBe(null);
    const e = playScript(travelLevel(), run([1, {}]), { params: { __entry: { door: 'cellar', from: 'hall' } } });
    expect(e.keys[0]).toMatch(/\|hero:120,-80,0,24$/);
  });

  it.skipIf(!GODOT)('a headless Godot ends, arrives, enters and leaves as the page does, key for key (MOJULO_GODOT)', () => {
    const strip = (env) => { const { contractVersion, levelRef, seed, ...rest } = JSON.parse(env); return rest; };
    for (const [name, frames, params] of [['east', east(), null], ['arrived', east(), { arrive: 'town' }], ['entered', east(), { __entry: { door: 'cellar', from: 'hall' } }]]) {
      const { web, godot } = playBoth(travelLevel(), frames, { godot: GODOT, params });
      const compare = upto(web, godot);
      expect(godot.error, name).toBe(null);
      expect(compare.first, name).toBe(null);
      expect(compare.equal, name).toBe(true);
      const sent = line(godot.text, 'mojulo-envelope');
      expect(sent ? strip(sent) : null, name).toEqual(web.envelope);
      if (name !== 'entered') expect(web.envelope, name).not.toBe(null);
    }
    const { web, godot, compare } = playBoth(travelLevel(), north(), { godot: GODOT });
    expect(compare.equal).toBe(true);
    const [id, env] = line(godot.text, 'mojulo-door').split(/ (.*)/s);
    expect({ door: id, events: JSON.parse(env).events }).toEqual(web.door);
    expect(JSON.parse(env).result).toBe('transit');
  }, 600000);

  const PLANTS = [
    { name: 'no exit on the envelope', from: '	if channel.get("exit") != null:\n		env["exit"] = channel["exit"]', to: '	pass' },
    { file: 'game_channel.gd', name: 'the arrive not heard', from: '		out.append({"type": "arrive:" + arrive})', to: '		pass' },
    { name: 'entered facing out', from: '				walker.ent["heading"] = float(d.get("heading", 0.0))', to: '				walker.ent["heading"] = float(d.get("heading", 0.0)) + PI' },
    { file: 'game_channel.gd', name: 'kept unscaled', from: 'var s := Js.to_number(k["scale"]) if Js.truthy(k.get("scale")) else 1.0', to: 'var s := 1.0' },
  ];
  it.skipIf(!GODOT)('every planted bug in a level\'s travel is caught (MOJULO_GODOT)', () => {
    const strip = (env) => { try { const { contractVersion, levelRef, seed, ...rest } = JSON.parse(env); return rest; } catch { return null; } };
    for (const p of PLANTS) {
      const params = p.name.includes('arrive') ? { arrive: 'town' } : p.name.includes('entered') ? { __entry: { door: 'cellar', from: 'hall' } } : null;
      const { web, godot } = playBoth(travelLevel(), east(), { godot: GODOT, params, mutate: [{ file: p.file ?? 'level.gd', from: p.from, to: p.to }] });
      const same = upto(web, godot).equal && JSON.stringify(strip(line(godot.text, 'mojulo-envelope'))) === JSON.stringify(web.envelope);
      expect(same, p.name).toBe(false);
    }
  }, 900000);
});
