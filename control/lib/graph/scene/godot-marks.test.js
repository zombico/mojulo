// THE RATCHET, Godot's part: what a Godot export runs is said once (godot-marks.js) and read by both the export and the
// cosmos registry, so it cannot drift (engines/marks.test.js holds every engine's tables to the same keys). Each table is closed against what it marks: a new page input, controllable rule,
// events key, bus verb, ledger row, mechanic or cosmos value with no mark fails here, before anyone ships it. And a
// cosmos mark that disagrees with the export's tables fails here too. No Godot needed.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLATFORM_KEYS, platformLost, RULE_MARKS, PAGE_MARKS, EVENT_MARKS, EVENT_CARRIED, SYSTEM_MARKS, LINK_MARKS, gaitMark, traversalMark, mindMark, FIGURE_MARKS, BUS_MARKS, LEDGER_MARKS, SHELL_MARKS } from './godot-marks.js';
import { MARKS, worstMark, CAMERA_RULE, PAGE_CAMERAS, figureOverlays, LEDGER_INFO } from './engines/marks.js';
import { supercarFigure } from '../car-designer/supercar-figure.js';
import { bakeJuice } from '../car-designer/juice.js';
import { mechanicMarks, MECHANIC_SAMPLES, carriedMechanics, carriedRules, assessPortability, exportVerdict, kitMark } from './engine-portability.js';
import { BUS_ABI, BUS_VERBS, CAST_OPS, VERB_ROW, ctrlRow, busCoverage } from './bus-abi.js';
import { extractEngineScore, engineReading } from './engine-score.js';
import { corpus } from './bus-conformance.js';
import { composeControllable, EMISSION_ENGINE } from '../worlds/controllable/compose.js';
import { MECHANIC_KINDS } from '../game/mechanics.js';
import { STAT_OPS } from '../playscape/stats/kernel.js';
import { capabilityRegistry } from '../cosmos/registry.js';
import { KITS } from '../game/kits.js';
import { SYSTEM_KINDS } from '../gameworld/actions.js';
import { MOTION_GAITS } from '../polygonizer/hero-motion.js';
import { ENTRIES } from '../playscape/objects/index.js';
import { LINK_KINDS } from '../era/floormap.js';

const SRC = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const marked = (row) => row && MARKS.includes(row.godot);
const MECHANIC_MARKS = mechanicMarks('godot'), GODOT_MECHANICS = carriedMechanics('godot'), GODOT_RULES = carriedRules('godot');

describe('every thing a world can ask of an engine carries a Godot mark', () => {
  it('every World page input (scene-three.js emitThreeWorld: a payload spreads into it)', () => {
    const sig = /export function emitThreeWorld\(\{([\s\S]*?)\}\s*=\s*\{\}\)\s*\{/.exec(SRC('lib/graph/scene/scene-three.js'));
    expect(sig).toBeTruthy();
    const inputs = [...sig[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)].map((x) => x[1]);
    expect(inputs.length).toBeGreaterThan(40);
    const unmarked = inputs.filter((k) => !marked(PAGE_MARKS[k]));
    expect(unmarked, 'mark each in godot-marks.js PAGE_MARKS').toEqual([]);
    // and no stale row: every mark names an input the page still takes
    expect(Object.keys(PAGE_MARKS).filter((k) => !inputs.includes(k))).toEqual([]);
  });

  it('every overlay the page lays on a rigged figure: its live overlay, its juice and what a dark mood adds to it', () => {
    // a supercar in the darkest mood carries every overlay there is; a juice key bakeJuice does not write is an overlay
    const night = supercarFigure({ mood: 'night-rain' }), base = Object.keys(bakeJuice([], [], 1));
    const extra = Object.keys(night.juice).filter((k) => !base.includes(k));
    expect(extra.length).toBeGreaterThan(0);
    expect(extra.filter((k) => !marked(FIGURE_MARKS[k])), 'mark each in godot-marks.js FIGURE_MARKS').toEqual([]);
    expect(figureOverlays({ car: night })).toEqual(Object.keys(FIGURE_MARKS).filter((k) => k !== 'forms').sort());
    // a body in two forms carries its forms (transformation/): the other form is the page's
    expect(figureOverlays({ ride: { rig: true, forms: { robot: {}, vehicle: {} } } })).toEqual(['forms']);
    // a car at noon: no lights of its own; a figure with no rig, nothing
    expect(figureOverlays({ car: supercarFigure({}) })).toEqual(['juice', 'live']);
    expect(figureOverlays({ glyph: { juice: {} } })).toEqual([]);
  });

  it('every controllable rule (compose.js RULES), and every camera the cosmos names', () => {
    const rules = Object.keys(composeControllable(EMISSION_ENGINE).RULES);
    expect(rules.filter((k) => !marked(RULE_MARKS[k]))).toEqual([]);
    expect(Object.keys(RULE_MARKS).filter((k) => !rules.includes(k))).toEqual([]);
    for (const [cam, rule] of Object.entries(CAMERA_RULE)) expect(marked(RULE_MARKS[rule]), cam).toBe(true);
    expect([...Object.keys(CAMERA_RULE), ...Object.keys(PAGE_CAMERAS)].sort()).toEqual(Object.keys(capabilityRegistry().space.camera.values).sort());
  });

  it('every key the platform rule reads is where the kernel runs it: ported, the fight\'s, or named lost', () => {
    const keys = new Set(['type']);
    for (const f of ['rules-platform', 'maneuvers', 'combat-melee', 'wall', 'swing', 'hitstop']) for (const x of SRC(`lib/graph/worlds/controllable/${f}.js`).matchAll(/\br\.([A-Za-z]+)/g)) keys.add(x[1]);
    // combat-melee reads the walk-shared eye and speed too: those are the rule's own, ported
    const placed = new Set([...PLATFORM_KEYS.ported, ...PLATFORM_KEYS.fight, ...Object.keys(PLATFORM_KEYS.lost)]);
    expect([...keys].filter((k) => !placed.has(k)), 'place each in godot-marks.js PLATFORM_KEYS').toEqual([]);
    expect([...placed].filter((k) => !keys.has(k)), 'a key the rule no longer reads').toEqual([]);
    // a ported key is one kernel/rules.gd reads, by name
    const gd = SRC('lib/graph/scene/godot-kernel/rules.gd');
    expect(PLATFORM_KEYS.ported.filter((k) => !gd.includes(`"${k}"`))).toEqual([]);
    expect(platformLost({ type: 'platform', dodge: true, dodgeDur: 0.4, kneel: false, boostHover: 2 })).toEqual(['the boost hover', 'the dodge']);
    expect(platformLost({ type: 'walk', dodge: true })).toEqual([]);
    // the export names them, and another walker that stands
    const payload = { entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', dodge: true }, transform: { pos: [0, 0, 1] } }, { id: 'npc', rule: { type: 'platform' } }] };
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: extractEngineScore({ ref: 'r', manifest: {} }, payload) }], engine: 'godot' });
    expect(p.flags.join('\n')).toMatch(/rule 'platform' \(the pilot\): the kernel runs it but for the dodge/);
    expect(p.flags.join('\n')).toMatch(/1 character besides the pilot\): only the pilot runs its rule/);
  });

  it('every walk rule key kernel/rules.gd reads by name', () => {
    const src = SRC('lib/graph/worlds/controllable/rules-basic.js');
    const body = src.slice(src.indexOf('function walk('), src.indexOf('function follow('));
    const keys = [...new Set([...body.matchAll(/\br\.([A-Za-z]+)/g)].map((x) => x[1]))];
    expect(keys.length).toBeGreaterThan(8);
    const gd = SRC('lib/graph/scene/godot-kernel/rules.gd');
    expect(keys.filter((k) => !gd.includes(`"${k}"`))).toEqual([]);
  });

  it('every events key the export carries, and every one it drops is named', () => {
    // what rides bus.json and score.json is carried, scenes and quests among it (since 0.23.0)
    for (const k of ['reactions', 'watches', 'sequences', 'timers', 'vars', 'sources', 'initial', 'entities', 'budget', 'depthCap', 'cast', 'stats', 'inputs', 'hud', 'style', 'register', 'menus', 'looks']) expect(EVENT_CARRIED, k).toContain(k);
    for (const row of Object.values(EVENT_MARKS)) expect(marked(row)).toBe(true);
    expect(EVENT_MARKS.scenes.godot).toBe('built');
    expect(EVENT_MARKS.quests.godot).toBe('built');
    // an events key nobody marked is not dropped silently: the ledger names it and the verdict reads it as lost
    const payload = { entities: [{ id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 1] } }], events: { reactions: [{ on: 'a', do: 'emit', type: 'b' }], futureKey: [{ x: 1 }], scenes: [{ id: 's' }] } };
    expect(engineReading(payload, 'godot').events).toEqual(['futureKey']);
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: extractEngineScore({ ref: 'r', manifest: {} }, payload) }], engine: 'godot' });
    expect(p.flags.join('\n')).toMatch(/events 'futureKey' is not marked/);
    expect(p.verdict).toBe('hollow');
  });

  it('every bus verb, cast op and stat op has its row (read from the reducers, so a new one cannot go uncounted)', () => {
    expect(BUS_VERBS).toEqual(expect.arrayContaining(['emit', 'set', 'inc', 'toggle', 'spawn', 'move', 'impulse', 'ctrl']));
    expect(BUS_VERBS.filter((v) => !(v in VERB_ROW))).toEqual([]);
    expect(CAST_OPS).toEqual(expect.arrayContaining(['walk', 'hurt', 'rearm', 'beam', 'shot', 'unshot', 'finish']));
    for (const op of [...CAST_OPS, ...Object.keys(STAT_OPS)]) expect(BUS_ABI.effects[ctrlRow(op)], op).toBeTruthy();
    for (const row of Object.values(VERB_ROW)) if (row) expect(BUS_ABI.effects[row]).toBeTruthy();
    // a stat cue is heard as the stats kernel's event (statFire): a level-up cue counts as the stats fact
    expect(busCoverage({ reactions: [{ on: 'level-up', do: 'emit', type: 'x' }] }).used).toContain('fact:stats');
    expect(busCoverage({ reactions: [{ on: 'go', do: 'ctrl', op: 'shot', shot: {} }] }).godot.built).toEqual(['effect:shot']);
    expect(busCoverage({ entities: [{ id: 'boulder', on: true }] }).godot.built).toEqual(['effect:entities']);
  });

  it('every ledger row engine-score.js writes is read (a row nobody reads is a silent drop by another name)', () => {
    const src = SRC('lib/graph/scene/engine-score.js');
    const keys = [...new Set([...src.matchAll(/ledger\.([a-z_]+) =/g), ...src.matchAll(/skip\('([a-z_]+)'/g)].map((x) => x[1]))];
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => !LEDGER_MARKS[k] && !LEDGER_INFO.includes(k))).toEqual([]);
    for (const [k, row] of Object.entries({ ...LEDGER_MARKS, ...SHELL_MARKS })) { expect(MARKS, k).toContain(row.godot); expect(row.flag, k).toBeTruthy(); }
  });

  it('every mechanic, found by lowering a sample of it', () => {
    expect(Object.keys(MECHANIC_SAMPLES).sort()).toEqual([...MECHANIC_KINDS].sort());
    for (const k of MECHANIC_KINDS) expect(marked(MECHANIC_MARKS[k]), k).toBe(true);
    // a mark comes from coverage, not from a list: each lost one names the bus row or shell part it lacks
    expect(MECHANIC_MARKS.unseen).toMatchObject({ godot: 'built', rows: [] });   // the sighting the mind counts (since 0.26.0)
    expect(MECHANIC_MARKS['on-beat'].godot).toBe('built');   // since the beat travels (II2)
    expect(MECHANIC_MARKS.push.godot).toBe('built');       // its boulders are markers (II4)
    expect(MECHANIC_MARKS.supplies.godot).toBe('built');   // its drops are markers, its rearm travels (II3, II4)
    expect(MECHANIC_MARKS.laps.godot).toBe('built');    // pure bus, its kept best in kernel/game.gd (III-c)
    expect(MECHANIC_MARKS.score.godot).toBe('built');
    expect(GODOT_MECHANICS).toEqual(MECHANIC_KINDS.filter((k) => MECHANIC_MARKS[k].godot !== 'absent'));
    // every mechanic that travels is played by the bus corpus Godot is held equal on (bus-conformance.js)
    const ids = corpus({ random: 0 }).map((s) => s.id);
    expect(GODOT_MECHANICS.filter((k) => !ids.includes(`mechanic-${k}`))).toEqual([]);
    expect(GODOT_RULES).toEqual(Object.keys(RULE_MARKS).filter((k) => RULE_MARKS[k].godot !== 'absent'));
  });

  it('every kit, system, gait, traversal entry, link and mind value', () => {
    for (const k of Object.keys(KITS)) expect(marked(kitMark(k)), k).toBe(true);
    for (const k of [...Object.keys(SYSTEM_KINDS), 'place']) expect(marked(SYSTEM_MARKS[k]), k).toBe(true);
    for (const [k, g] of Object.entries(MOTION_GAITS)) expect(marked(gaitMark(k, g)), k).toBe(true);
    expect(gaitMark('walk', MOTION_GAITS.walk).godot).toBe('built');
    for (const k of Object.keys(ENTRIES)) expect(traversalMark(k).how, k).not.toBe('not marked');
    expect(Object.keys(LINK_MARKS).sort()).toEqual([...LINK_KINDS].sort());
    expect(mindMark('motivation', 'ambient').godot).toBe('built');
    expect(mindMark('motivation', 'hunt').godot).toBe('built');
    expect(mindMark('commander', 'builtin').godot).toBe('absent');
    expect(worstMark('built', ['approximated'], 'built')).toBe('approximated');
    expect(worstMark()).toBe('built');
  });

  it('every cosmos value (an unmarked one throws when the registry is read)', () => {
    const reg = capabilityRegistry();
    for (const [f, settings] of Object.entries(reg)) for (const [s, { values }] of Object.entries(settings)) for (const [v, row] of Object.entries(values)) expect(MARKS, `${f}.${s}=${v}`).toContain(row.godot);
  });
});

describe('the cosmos registry and the export read the same marks', () => {
  const reg = capabilityRegistry();
  const agree = (setting, table, of = (v) => table[v]?.godot) => {
    for (const [v, row] of Object.entries(setting.values)) if (of(v) !== undefined) expect(row.godot, v).toBe(of(v));
  };
  it('mechanics, rules, cameras, kits, systems, idioms, links, traversal, gaits, mind', () => {
    agree(reg.power.mechanics, MECHANIC_MARKS);
    agree(reg.power.rules, RULE_MARKS);
    agree(reg.space.camera, null, (v) => (PAGE_CAMERAS[v] ? 'absent' : RULE_MARKS[CAMERA_RULE[v]].godot));
    agree(reg.power.kit, null, (v) => kitMark(v).godot);
    agree(reg.power.systems, SYSTEM_MARKS);
    agree(reg.space.links, LINK_MARKS);
    agree(reg.space.traversal, null, (v) => traversalMark(v).godot);
    agree(reg.soul.gaits, null, (v) => gaitMark(v, MOTION_GAITS[v]).godot);
    for (const axis of ['motivation', 'aggressiveness', 'rank', 'skill', 'perception', 'pathing', 'squad', 'social', 'commander']) agree(reg.mind[axis], null, (v) => mindMark(axis, v).godot);
  });
  it('the story: shots, framing, quests and talk travel no further than scenes and quests do', () => {
    // (a shot told on the board itself is the board page's: no engine kernel plays a board; a PLANNED shot, status
    // 'absent', travels nowhere yet, as every planned row in the registry marks it)
    for (const v of Object.values(reg.time.shots.values)) expect(v.godot).toBe(v.requires?.includes('space.board=spots') || v.status === 'absent' ? 'absent' : EVENT_MARKS.scenes.godot);
    for (const v of Object.values(reg.time.framing.values)) expect(v.godot).toBe(EVENT_MARKS.scenes.godot);
    expect(reg.time.advance.values.quests.godot).toBe(EVENT_MARKS.quests.godot);
    expect(reg.time.advance.values.steps.godot).toBe(EVENT_MARKS.quests.godot);
    expect(reg.reality.medium.values.pixel.godot).toBe(PAGE_MARKS.pixel.godot);
  });
});

describe('the verdict stamps, never refuses', () => {
  const walker = { id: 'hero', rule: { type: 'walk' }, transform: { pos: [0, 0, 1] } };
  const score = (payload, manifest = {}) => extractEngineScore({ ref: 'r', manifest }, payload);
  it('plays: a walk to an exit', () => {
    const s = score({ entities: [walker] }, { game: { mechanics: [{ kind: 'reach-exit', at: [5, 0, 0] }] } });
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: s }], engine: 'godot' });
    expect(p.verdict).toBe('plays');
    expect(exportVerdict(p)).toEqual({ verdict: 'plays', lost: [], approximated: [] });
  });
  it('hollow: a glider with no rule, a moving deck at rest; plays: a drive (since 0.23.0), a sneak past sight (since 0.26.0)', () => {
    const sneak = score({ entities: [walker] }, { game: { mechanics: [{ kind: 'unseen' }, { kind: 'reach-exit', at: [5, 0, 0] }] } });
    expect(assessPortability({ manifest: {}, levels: [{ ref: 'r', score: sneak }], engine: 'godot' }).verdict).toBe('plays');
    const glider = score({ entities: [{ ...walker, pilotable: true, rule: { type: 'glide' } }] }, { game: { mechanics: [{ kind: 'reach-exit', at: [5, 0, 0] }] } });
    const pg = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: glider }], engine: 'godot' });
    expect(pg.verdict).toBe('hollow');
    expect(exportVerdict(pg).lost.join('\n')).toMatch(/rule 'glide' \(the pilot\)/);
    const car = score({ entities: [{ ...walker, pilotable: true, rule: { type: 'drive' } }] }, { game: { mechanics: [{ kind: 'reach-exit', at: [5, 0, 0] }] } });
    expect(assessPortability({ manifest: {}, levels: [{ ref: 'r', score: car }], engine: 'godot' }).verdict).toBe('plays');
    const deck = score({ entities: [walker, { id: 'deck', rule: { type: 'mover', path: [[0, 0, 0], [1, 0, 0]] } }] }, { game: { mechanics: [{ kind: 'reach-exit', at: [5, 0, 0] }] } });
    const pd = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: deck }], engine: 'godot' });
    expect(pd.verdict).toBe('hollow');   // a mover is a character's rule the level runs: absent and not the camera's
  });
  it('the other engines read as they always did: no verdict, no Godot rows', () => {
    const s = score({ entities: [walker] }, { game: { mechanics: [{ kind: 'laps', checkpoints: [{ at: [1, 0, 0] }] }] } });
    const p = assessPortability({ manifest: {}, levels: [{ ref: 'r', score: s }] });
    expect(p).not.toHaveProperty('verdict');
    expect(p.flags.join('\n')).toMatch(/mechanics outside the vocabulary: laps/);
  });
});
