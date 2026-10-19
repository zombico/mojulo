// THE RATCHET, for every engine with a runtime kernel (engines/registry.js): each engine's marks module exports the
// same tables over the same closed key sets (read from the sources by mark-sources.js), every row carries that
// engine's mark, and the cosmos registry reads the same marks the export reads. What only one engine proves (Godot's
// proof tests, its kernel files) stays in that engine's own test (godot-marks.test.js). No engine needed.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { MARKS, worstMark, CAMERA_RULE, PAGE_OPTIONS, LEDGER_INFO, SHELL_INFO, figureOverlays } from './marks.js';
import { ENGINES, MARKED_ENGINES, DEFAULT_ENGINE, ENGINE_OUT_DIRS, engineOf, marksOf, marksAcross } from './registry.js';
import { pageInputs, controllableRules, platformRuleKeys, ledgerKeys, busRows, systemKinds, linkKinds, pageEventKeys } from './mark-sources.js';
import { mechanicMarks, kitMark, carriedMechanics, carriedRules, assessPortability } from '../engine-portability.js';
import { busCoverage } from '../bus-abi.js';
import { extractEngineScore, engineReading } from '../engine-score.js';
import { capabilityRegistry } from '../../cosmos/registry.js';
import { dryRun } from '../../cosmos/cosmos.js';
import { FIXTURES } from '../../cosmos/fixtures.js';
import { MECHANIC_KINDS } from '../../game/mechanics.js';
import { KITS } from '../../game/kits.js';
import { MOTION_GAITS } from '../../polygonizer/hero-motion.js';
import { ENTRIES } from '../../playscape/objects/index.js';
import { IDIOMS } from '../../gameworld/actions.js';

const sorted = (a) => [...a].sort();
const TABLES = ['RULE_MARKS', 'PAGE_MARKS', 'FIGURE_MARKS', 'EVENT_MARKS', 'SYSTEM_MARKS', 'LINK_MARKS', 'MECHANIC_EXTRAS', 'LEDGER_MARKS', 'SHELL_MARKS', 'READING_NOTES'];
const FUNCTIONS = ['gaitMark', 'traversalMark', 'mindMark', 'platformLost', 'aiLost', 'weaponLost'];
const MIND_AXES = ['motivation', 'aggressiveness', 'rank', 'skill', 'perception', 'pathing', 'squad', 'social', 'commander'];

describe('the engine registry', () => {
  it('names each engine once, the marked ones with a marks module, a proof and an unmarked policy', () => {
    expect(MARKED_ENGINES).toEqual(['godot', 'roblox']);
    expect(DEFAULT_ENGINE).toBe('godot');
    for (const e of MARKED_ENGINES) {
      expect(ENGINES[e].kind).toBe('runtime');
      expect(ENGINES[e].proof).toMatch(/^MOJULO_/);
      expect([null, 'absent']).toContain(ENGINES[e].unmarked);
    }
    expect(ENGINES.godot.unmarked).toBeNull();   // Godot is closed: an unmarked cosmos value throws
    expect(ENGINE_OUT_DIRS).toEqual(['godot', 'roblox', 'unity', 'unreal']);
    expect(marksOf('unity')).toBeNull();
    expect(marksOf(null)).toBeNull();
    expect(() => engineOf('frostbite')).toThrow(/unknown engine 'frostbite'/);
    expect(marksAcross((M, e) => M.RULE_MARKS.walk[e])).toEqual({ godot: 'built', roblox: 'approximated' });
  });
});

describe.each(MARKED_ENGINES)('%s marks: the same tables over the same closed keys', (e) => {
  const M = marksOf(e);
  const marked = (row) => !!row && MARKS.includes(row[e]);
  const keyed = (t) => Object.values(t).every(marked);

  it('exports every table and reader', () => {
    for (const t of TABLES) expect(M[t], t).toBeTruthy();
    for (const f of FUNCTIONS) expect(typeof M[f], f).toBe('function');
    expect(M.BUS_MARKS?.facts && M.BUS_MARKS?.effects).toBeTruthy();
    expect(M.PLATFORM_KEYS && M.AI_LOST && M.WEAPON_LOST && M.CAMERA_LOST).toBeTruthy();
  });

  it('every World page input, the drawing options alike in every engine', () => {
    expect(sorted(Object.keys(M.PAGE_MARKS))).toEqual(sorted(pageInputs()));
    expect(keyed(M.PAGE_MARKS)).toBe(true);
    for (const k of PAGE_OPTIONS) expect(M.PAGE_MARKS[k], k).toEqual({ [e]: 'built', option: true });
  });

  it('every controllable rule, every camera, every figure overlay, events key, system and link', () => {
    expect(sorted(Object.keys(M.RULE_MARKS))).toEqual(sorted(controllableRules()));
    for (const rule of Object.values(CAMERA_RULE)) expect(marked(M.RULE_MARKS[rule]), rule).toBe(true);
    expect(sorted(Object.keys(M.FIGURE_MARKS))).toEqual(['beams', 'forms', 'juice', 'live', 'trails']);
    expect(sorted(Object.keys(M.EVENT_MARKS))).toEqual(sorted(Object.keys(marksOf(DEFAULT_ENGINE).EVENT_MARKS)));
    // every events key the page reads is marked (the table also marks the bus's own keys, which the reducer reads)
    expect(pageEventKeys().filter((k) => !M.EVENT_MARKS[k]).sort()).toEqual([]);
    expect(sorted(Object.keys(M.SYSTEM_MARKS))).toEqual(sorted(systemKinds()));
    expect(sorted(Object.keys(M.LINK_MARKS))).toEqual(sorted(linkKinds()));
    for (const t of [M.RULE_MARKS, M.FIGURE_MARKS, M.EVENT_MARKS, M.SYSTEM_MARKS, M.LINK_MARKS]) expect(keyed(t)).toBe(true);
  });

  it('the platform rule\'s keys are placed whenever the engine runs the rule', () => {
    if (M.RULE_MARKS.platform[e] === 'absent') { expect(M.PLATFORM_KEYS).toEqual({ ported: [], fight: [], lost: {} }); return; }
    const keys = platformRuleKeys(), placed = new Set([...M.PLATFORM_KEYS.ported, ...M.PLATFORM_KEYS.fight, ...Object.keys(M.PLATFORM_KEYS.lost)]);
    expect(keys.filter((k) => !placed.has(k))).toEqual([]);
    expect([...placed].filter((k) => !keys.includes(k))).toEqual([]);
  });

  it('every bus row, every mechanic extra, ledger row and shell key', () => {
    const rows = busRows();
    expect(sorted(Object.keys(M.BUS_MARKS.facts))).toEqual(sorted(rows.facts));
    expect(sorted(Object.keys(M.BUS_MARKS.effects))).toEqual(sorted(rows.effects));
    expect(keyed(M.BUS_MARKS.facts) && keyed(M.BUS_MARKS.effects)).toBe(true);
    expect(sorted(Object.keys(M.MECHANIC_EXTRAS))).toEqual(sorted(Object.keys(marksOf(DEFAULT_ENGINE).MECHANIC_EXTRAS)));
    expect(keyed(M.MECHANIC_EXTRAS)).toBe(true);
    // a ledger row is either information (what travels) or the engine's flag; never both, never neither
    expect(ledgerKeys().filter((k) => !LEDGER_INFO.includes(k) && !M.LEDGER_MARKS[k])).toEqual([]);
    expect(Object.keys(M.LEDGER_MARKS).filter((k) => LEDGER_INFO.includes(k))).toEqual([]);
    for (const [k, row] of Object.entries({ ...M.LEDGER_MARKS, ...M.SHELL_MARKS })) { expect(MARKS, k).toContain(row[e]); expect(row.flag, k).toBeTruthy(); }
    expect(sorted(Object.keys(M.SHELL_MARKS))).toEqual(sorted(Object.keys(marksOf(DEFAULT_ENGINE).SHELL_MARKS)));
    expect(Object.keys(M.SHELL_MARKS).filter((k) => SHELL_INFO.includes(k))).toEqual([]);
    expect(sorted(Object.keys(M.READING_NOTES))).toEqual(['bus_carried', 'channels_carried', 'events_carried', 'figures_carried', 'rules_carried']);
  });

  it('every mechanic (found by lowering it), kit, gait, traversal entry and mind value', () => {
    const MECH = mechanicMarks(e);
    for (const k of MECHANIC_KINDS) expect(marked(MECH[k]), k).toBe(true);
    expect(carriedMechanics(e)).toEqual(MECHANIC_KINDS.filter((k) => MECH[k][e] !== 'absent'));
    expect(carriedRules(e)).toEqual(Object.keys(M.RULE_MARKS).filter((k) => M.RULE_MARKS[k][e] !== 'absent'));
    for (const k of Object.keys(KITS)) expect(marked(kitMark(k, e)), k).toBe(true);
    for (const [k, g] of Object.entries(MOTION_GAITS)) expect(marked(M.gaitMark(k, g)), k).toBe(true);
    for (const k of Object.keys(ENTRIES)) expect(marked(M.traversalMark(k)), k).toBe(true);
    for (const axis of MIND_AXES) expect(marked(M.mindMark(axis, 'x')), axis).toBe(true);
  });

  it('the cosmos registry reads the marks the export reads, and every value carries one', () => {
    const reg = capabilityRegistry();
    for (const [f, settings] of Object.entries(reg)) for (const [s, { values }] of Object.entries(settings)) for (const [v, row] of Object.entries(values)) expect(MARKS, `${f}.${s}=${v}`).toContain(row[e]);
    const agree = (setting, of) => { for (const [v, row] of Object.entries(setting.values)) if (of(v) !== undefined) expect(row[e], v).toBe(of(v)); };
    const MECH = mechanicMarks(e);
    agree(reg.power.mechanics, (v) => MECH[v]?.[e]);
    agree(reg.power.rules, (v) => M.RULE_MARKS[v]?.[e]);
    agree(reg.space.camera, (v) => M.RULE_MARKS[CAMERA_RULE[v]][e]);
    agree(reg.power.kit, (v) => kitMark(v, e)[e]);
    agree(reg.power.systems, (v) => M.SYSTEM_MARKS[v]?.[e]);
    agree(reg.power.idiom, (v) => M.SYSTEM_MARKS[IDIOMS[v].system.kind][e]);
    agree(reg.space.links, (v) => M.LINK_MARKS[v]?.[e]);
    agree(reg.space.traversal, (v) => M.traversalMark(v)[e]);
    agree(reg.soul.gaits, (v) => M.gaitMark(v, MOTION_GAITS[v])[e]);
    for (const axis of MIND_AXES) agree(reg.mind[axis], (v) => M.mindMark(axis, v)[e]);
  });

  it('the export reads the level against this engine, and only this engine', () => {
    const payload = { entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk' }, transform: { pos: [0, 0, 1] } }], events: { reactions: [{ on: 'a', do: 'emit', type: 'b' }] } };
    const score = extractEngineScore({ ref: 'r', manifest: {} }, payload, { engine: e });
    expect(Object.keys(score.ledger.bus_carried)).toContain(e);
    for (const other of MARKED_ENGINES.filter((x) => x !== e)) expect(score.ledger.bus_carried).not.toHaveProperty(other);
    expect(busCoverage(payload.events, e)[e]).toBeTruthy();
    expect(engineReading(payload, e).rules.walk).toMatchObject({ count: 1, pilot: true });
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score }], engine: e });
    expect(['plays', 'plays-partly', 'hollow']).toContain(p.verdict);
    for (const f of p.lost) expect(MARKS).toContain(f[e]);
  });
});

describe('an engine without a runtime kernel reads no marks', () => {
  it('Unity and Unreal: no reading, no bus coverage, no Godot rows, no verdict', () => {
    const payload = { entities: [{ id: 'hero', rule: { type: 'glide' }, transform: { pos: [0, 0, 1] } }], events: { reactions: [{ on: 'a', do: 'emit', type: 'b' }] } };
    for (const e of ['unity', 'unreal']) {
      const score = extractEngineScore({ ref: 'r', manifest: {} }, payload, { engine: e });
      for (const k of ['rules_carried', 'channels_carried', 'figures_carried', 'events_carried']) expect(score.ledger).not.toHaveProperty(k);
      expect(Object.keys(score.ledger.bus_carried).filter((k) => MARKED_ENGINES.includes(k))).toEqual([]);
      const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score }], engine: e });
      expect(p).not.toHaveProperty('verdict');
      expect(p.flags.join('\n')).not.toMatch(/Godot/);
    }
  });
});

describe('dryRun and the sweep read every engine', () => {
  it('a cube is read per engine; a value an engine loses fails only that engine', () => {
    const r = dryRun(FIXTURES[0].cube);
    expect(Object.keys(r.engines)).toEqual(MARKED_ENGINES);
    for (const e of MARKED_ENGINES) expect(r.engines[e].ok).toBe(r.engines[e].lost.length === 0);
  });
});

describe('a young kernel offers only what it proves', () => {
  // A Roblox mark flips with the part of the place that carries it: every row not absent says how, and a built row names
  // the kernel module (held equal under Lune by engines/conformance.test.js) or the place file that performs it.
  it('every Roblox row not absent says how the place carries it, and a built one names a file that is there', () => {
    const M = marksOf('roblox');
    const rows = [...['RULE_MARKS', 'PAGE_MARKS', 'FIGURE_MARKS', 'EVENT_MARKS', 'SYSTEM_MARKS', 'LINK_MARKS', 'MECHANIC_EXTRAS'].flatMap((t) => Object.entries(M[t]).map(([k, r]) => [`${t}.${k}`, r])),
      ...Object.entries(M.BUS_MARKS.facts).map(([k, r]) => [`fact.${k}`, r]), ...Object.entries(M.BUS_MARKS.effects).map(([k, r]) => [`effect.${k}`, r])].filter(([, r]) => !r.option);
    const FILES = { 'kernel/': 'lib/graph/scene/roblox-kernel/', 'MojuloServer': 'lib/graph/scene/roblox-place/MojuloServer.server.luau', 'MojuloClient': 'lib/graph/scene/roblox-place/MojuloClient.client.luau', 'roblox-project.js': 'lib/graph/scene/roblox-project.js' };
    for (const [k, r] of rows) {
      if (r.roblox === 'absent') continue;
      expect(r.how, k).toBeTruthy();
      if (r.roblox !== 'built') continue;
      const named = [...r.how.matchAll(/kernel\/(\w+)\.luau/g)].map((x) => `lib/graph/scene/roblox-kernel/${x[1]}.luau`);
      for (const [word, file] of Object.entries(FILES)) if (word !== 'kernel/' && r.how.includes(word)) named.push(file);
      expect(named.length, `${k} names what performs it`).toBeGreaterThan(0);
      for (const f of named) expect(existsSync(f), `${k}: ${f}`).toBe(true);
    }
    // the ledger and the shell: no row built yet but the play shell's level list, approximated
    expect(Object.entries({ ...M.LEDGER_MARKS, ...M.SHELL_MARKS }).filter(([, r]) => r.roblox !== 'absent').map(([k]) => k)).toEqual(['shell']);
    // what the place carries reads through: the zone mechanics a Humanoid can walk to, and with the cast whole in the
    // kernel the fight's and the watchers'; never a door, a beat, a use or a bag
    const carried = carriedMechanics('roblox');
    for (const k of ['reach-exit', 'collect', 'survive', 'laps', 'hp-pool', 'defeat-all', 'unseen']) expect(carried, k).toContain(k);
    for (const k of ['door', 'on-beat', 'crops', 'bag']) expect(carried, k).not.toContain(k);
  });
  it('worstMark and figureOverlays are the engines\' shared reads', () => {
    expect(worstMark('built', ['approximated'], 'built')).toBe('approximated');
    expect(worstMark()).toBe('built');
    expect(figureOverlays({ glyph: { juice: {} } })).toEqual([]);
  });
});
