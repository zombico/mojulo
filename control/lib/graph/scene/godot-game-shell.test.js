// THE SHELL'S TRAVEL (III-c): kernel/game.gd's side of a game, held to the web shell's (game/play-shell.js) own
// decisions. A scratch Godot project runs the real Game autoload over stub levels that end as a plan says (an outcome,
// a door taken), and prints every level it starts (with the params and seed it hands in) and every menu; the web's
// side is the same plan through the web shell's own functions: the store kernel (travel, transit, reachable, the
// outcome), and its run order, `roll`, lifted out of play-shell.js's source. A map travels on through the exit a level
// was won by, telling the next where it came from; a door applies what the session gathered and enters the next level
// by its own door; a run draws its order, goes on through each clear and ends at a fall, keeping the deepest; a kept
// number is remembered beside its best.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildGameStoreKernel } from '../game/store-kernel.js';

const GODOT = process.env.MOJULO_GODOT;
const KERNEL = path.join(process.cwd(), 'lib', 'graph', 'scene', 'godot-kernel');
const K = buildGameStoreKernel();

const SCHEMA = { slices: [{ name: 'bag', kind: 'inventory' }, { name: 'campaign', kind: 'progression' }, { name: 'world', kind: 'flags' }] };
const CONTRACT = (ref, extra = {}) => ({ levelRef: ref, contractVersion: 1, consumes: [{ slice: 'bag' }], produces: { results: ['success', 'fail', 'abort'], events: [{ type: 'grant', slice: 'bag' }, { type: 'setFlag', slice: 'world' }] }, presets: { default: {} }, ...extra });
const env = (ref, result, extra = {}) => ({ contractVersion: 1, levelRef: ref, seed: 1, result, events: [], ...extra });

export const GAMES = {
  map: {
    manifest: { kind: 'game', title: 'map', store: SCHEMA, levels: [
      { ref: 'town', exits: [{ id: 'east', to: 'fields' }, { id: 'gate', to: 'keep', gate: { has: 'key' } }] },
      { ref: 'fields', exits: [{ id: 'west', to: 'town' }] }, { ref: 'keep', gate: { completed: 'town' } }] },
    plan: [{ start: 'town' }, { finish: env('town', 'success', { exit: 'east', events: [{ type: 'grant', slice: 'bag', item: 'coin' }] }) },
      { finish: env('fields', 'success', { exit: 'west' }) }, { finish: env('town', 'success', { exit: 'gate' }) }, { quit: true }],
  },
  doors: {
    manifest: { kind: 'game', title: 'doors', store: SCHEMA, levels: [{ ref: 'hall' }, { ref: 'cellar' }, { ref: 'vault', gate: { has: 'key' } }],
      links: [{ from: { ref: 'hall', door: 'down' }, to: { ref: 'cellar', door: 'up' } }, { from: { ref: 'cellar', door: 'deep' }, to: { ref: 'vault', door: 'in' } }] },
    plan: [{ start: 'hall' }, { door: 'down', envelope: env('hall', 'transit', { events: [{ type: 'grant', slice: 'bag', item: 'lamp' }] }) },
      { door: 'deep', envelope: env('cellar', 'transit') }, { door: 'nowhere', envelope: env('cellar', 'transit') },
      { door: 'up', envelope: env('cellar', 'success') }, { door: 'up', envelope: env('cellar', 'transit', { events: [{ type: 'grant', slice: 'bag', item: 'key' }] }) },
      { finish: env('hall', 'abort') }, { quit: true }],
  },
  run: {
    manifest: { kind: 'game', title: 'run', store: SCHEMA, run: { length: 3 }, levels: [{ ref: 'r1' }, { ref: 'r2' }, { ref: 'r3' }, { ref: 'r4' }, { ref: 'r5' }] },
    plan: [{ run: true }, { finish: env('*', 'success') }, { finish: env('*', 'fail') }, { run: true }, { finish: env('*', 'success') }, { finish: env('*', 'success') },
      { finish: env('*', 'success') }, { quit: true }],
  },
  kept: {
    manifest: { kind: 'game', title: 'kept', store: SCHEMA, levels: [{ ref: 'lap' }] },
    plan: [{ start: 'lap' }, { finish: env('lap', 'success', { stats: { kept: [{ label: 'time', value: 41.5, best: 'low', unit: 's' }, { label: 'score', value: 12, best: 'high' }] } }) },
      { start: 'lap' }, { finish: env('lap', 'fail', { stats: { kept: [{ label: 'time', value: 30, best: 'low', unit: 's' }, { label: 'score', value: 20, best: 'high' }] } }) },
      { start: 'lap' }, { finish: env('lap', 'success', { stats: { kept: [{ label: 'time', value: 39, best: 'low', unit: 's' }, { label: 'score', value: 15, best: 'high' }] } }) }, { quit: true }],
  },
};

// the web shell's run order, lifted out of its source (play-shell.js roll)
export function webRoll(levels, length) {
  const src = fs.readFileSync(path.join(process.cwd(), 'lib/graph/game/play-shell.js'), 'utf8');
  const a = src.indexOf('  function roll(n) {'), b = src.indexOf('  function startRun() {', a);
  return new Function('LEVELS', 'RUN', `${src.slice(a, b)}\nreturn roll;`)(levels, { length });
}

/** The web shell over a plan: what it starts (ref, params, seed), its menus, its kept lines; the store as it goes. */
export function webShell({ manifest, plan }) {
  const levels = manifest.levels, contract = (ref) => CONTRACT(ref);
  let state = K.createStore(SCHEMA), runLog = [], session = null, run = null, runs = 0, deepest = 0, step = 0;
  const bests = {}, out = [];
  const roll = webRoll(levels, manifest.run ? manifest.run.length : levels.length);
  const links = {};
  for (const lk of manifest.links || []) { (links[lk.from.ref] ||= {})[lk.from.door] = lk.to; (links[lk.to.ref] ||= {})[lk.to.door] = lk.from; }
  const paramsFor = (ref) => { const p = {}; for (const c of contract(ref).consumes) p[c.slice] = JSON.parse(JSON.stringify(state[c.slice])); return p; };
  const launch = (ref, arrive, carry) => {
    const params = carry || paramsFor(ref);
    if (arrive) params.arrive = arrive;
    session = { ref, params, seed: run ? run.n * 100 + run.at + 1 : runLog.length + 1 };
    out.push(`start ${ref} ${JSON.stringify(sortKeys(params))} seed=${session.seed}`);
  };
  const menu = () => { session = null; const open = K.reachable(SCHEMA, state, levels); out.push(`menu ${levels.map((l) => `${l.ref}:${open[l.ref] ? 'open' : 'shut'}`).join(' ')}`); };
  const keptList = (ref, e) => e.stats.kept.forEach((k) => {
    const key = `${ref}:${k.label}`, v = Number(k.value), prior = key in bests ? bests[key] : null;
    const counts = Number.isFinite(v) && (k.best === 'high' || e.result === 'success');
    const better = counts && (prior === null || (k.best === 'high' ? v > prior : v < prior));
    if (better) bests[key] = v;
    out.push(`kept ${k.label} ${v}${better ? (prior === null ? '' : ' new best') : prior !== null ? ` best ${prior}` : ''}`);
  });
  while (step < plan.length) {
    const s = plan[step++];
    if (s.quit) break;
    if (s.start) { launch(s.start); continue; }
    if (s.run) { runs += 1; run = { n: runs, order: roll(runs).map((l) => l.ref), at: 0 }; launch(run.order[0]); continue; }
    const ref = session.ref;
    if (s.door) {
      const e = { ...s.envelope, levelRef: ref };
      const r = K.applyTransit(SCHEMA, state, contract(ref), e);
      if (!r.ok) { out.push(`refused ${s.door}`); continue; }
      state = r.state;
      if ((e.events || []).length) runLog.push(e);
      const to = (links[ref] || {})[s.door], lv = to && levels.find((l) => l.ref === to.ref);
      if (!lv) { out.push(`nowhere ${s.door}`); continue; }
      if (lv.gate && !K.evalGate(SCHEMA, state, lv.gate)) { out.push(`locked ${lv.ref}`); continue; }
      const carry = JSON.parse(JSON.stringify(session.params));
      carry.__entry = { door: to.door, from: ref };
      launch(lv.ref, null, carry);
      continue;
    }
    const e = { ...s.finish, levelRef: ref };
    const r = K.applyOutcome(SCHEMA, state, contract(ref), e);
    if (r.ok) {
      state = r.state;
      if (e.result === 'success' && !state.campaign.completed[ref]) { const pr = K.applyEvents(SCHEMA, state, [{ type: 'promote', slice: 'campaign', ref, result: 'success' }]); if (pr.ok) state = pr.state; }
      runLog.push(e);
    }
    if (run) {
      if (e.result === 'success') run.at += 1;
      const won = run.at >= run.order.length;
      if (run.at > deepest) deepest = run.at;
      if (e.result === 'success' && !won) { launch(run.order[run.at]); continue; }
      out.push(`run ${run.n} ${won ? 'complete' : 'over'} ${run.at} deepest=${deepest}`);
      run = null; menu(); continue;
    }
    const to = r.ok && e.result === 'success' && e.exit ? K.travel(SCHEMA, state, levels, ref, e.exit) : null;
    if (to) { launch(to, ref); continue; }
    if (e.stats && e.stats.kept) keptList(ref, e);
    menu();
  }
  return out;
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// ── the Godot side: a scratch project, the real Game autoload, stub levels and a stub menu that follow the plan ─────
const DRIVER = `extends Node
# the plan's runner: pops its next step at each level and each menu
const JsonExact := preload("res://kernel/json_exact.gd")
const Bus := preload("res://kernel/bus.gd")
var plan: Array = []
var i := 0
func _ready() -> void:
	plan = JsonExact.parse(FileAccess.get_file_as_string("res://plan.json"))
	next_at_menu.call_deferred()
func pop():
	if i >= plan.size():
		return {"quit": true}
	i += 1
	return plan[i - 1]
func next_at_menu() -> void:
	var s = pop()
	if s.get("quit"):
		print("[shell] done")
		get_tree().quit()
	elif s.get("run"):
		Game.start_run()
	else:
		Game.start_level(String(s["start"]))
`;
const STUB = `extends Node
const JsonExact := preload("res://kernel/json_exact.gd")
const Bus := preload("res://kernel/bus.gd")
func _ready() -> void:
	var ref: String = Game.current
	var contract = JsonExact.parse(FileAccess.get_file_as_string("res://levels/%s/contract.json" % ref))
	var params: Dictionary = Game.session_params(contract)
	print("[shell] start %s %s seed=%d" % [ref, Bus.ss(params), Game.session_seed()])
	_step.call_deferred(ref, contract)
func _step(ref: String, contract: Dictionary) -> void:
	while true:
		var s = Driver.pop()
		if s.get("quit"):
			print("[shell] done")
			get_tree().quit()
			return
		var e: Dictionary = (s.get("envelope") if s.has("door") else s["finish"]).duplicate(true)
		e["levelRef"] = ref
		if s.has("door"):
			var before := Game.current
			var ok: bool = Game.level_transit(String(s["door"]), e, contract)
			if not ok:
				print("[shell] refused-or-shut %s" % s["door"])
				continue
			return
		Game.level_finish(e, contract)
		return
`;
const MENU = `extends Node
func _ready() -> void:
	var open := []
	for i in Game.levels.size():
		open.append("%s:%s" % [Game.levels[i]["ref"], "open" if Game.is_unlocked(i) else "shut"])
	print("[shell] menu " + " ".join(open))
	Driver.next_at_menu.call_deferred()
`;
const tscn = (script) => `[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="${script}" id="s"]\n\n[node name="Root" type="Node"]\nscript = ExtResource("s")\n`;

export function playShellInGodot(game, godot, { mutate = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-shell-'));
  try {
    fs.cpSync(KERNEL, path.join(dir, 'kernel'), { recursive: true });
    for (const { file, from, to } of mutate) {
      const p = path.join(dir, 'kernel', file), src = fs.readFileSync(p, 'utf8');
      if (!src.includes(from)) throw new Error(`plant does not apply: kernel/${file} has no '${from}'`);
      fs.writeFileSync(p, src.replace(from, to));
    }
    fs.writeFileSync(path.join(dir, 'project.godot'), `config_version=5\n\n[application]\nconfig/name="shell"\nrun/main_scene="res://boot.tscn"\n\n[autoload]\n\nGame="*res://kernel/game.gd"\nDriver="*res://driver.gd"\n`);
    fs.writeFileSync(path.join(dir, 'driver.gd'), DRIVER);
    fs.writeFileSync(path.join(dir, 'stub.gd'), STUB);
    fs.writeFileSync(path.join(dir, 'menu_stub.gd'), MENU);
    fs.writeFileSync(path.join(dir, 'boot.tscn'), `[gd_scene format=3]\n\n[node name="Boot" type="Node"]\n`);
    fs.writeFileSync(path.join(dir, 'menu.tscn'), tscn('res://menu_stub.gd'));
    fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(game.manifest));
    // the run's levels are named by the draw: a finish step names '*', the level under way
    fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(game.plan));
    for (const lv of game.manifest.levels) {
      fs.mkdirSync(path.join(dir, 'levels', lv.ref), { recursive: true });
      fs.writeFileSync(path.join(dir, 'levels', lv.ref, 'level.tscn'), tscn('res://stub.gd'));
      fs.writeFileSync(path.join(dir, 'levels', lv.ref, 'contract.json'), JSON.stringify(CONTRACT(lv.ref)));
    }
    const home = path.join(dir, 'home');
    fs.mkdirSync(home);
    const r = spawnSync(godot, ['--headless', '--path', dir], { encoding: 'utf8', timeout: 180000, env: { ...process.env, HOME: home, XDG_DATA_HOME: path.join(home, 'data') } });
    const text = `${r.stdout || ''}${r.stderr || ''}`;
    const lines = [];
    for (const l of text.split('\n')) {
      let m;
      if ((m = /^\[shell\] (start|menu) (.*)$/.exec(l))) lines.push(`${m[1]} ${m[2]}`);
      else if ((m = /^moj: kept (\S+) (\S+)(.*)$/.exec(l))) lines.push(`kept ${m[1]} ${Number(m[2])}${m[3].replace(' · new best!', ' new best').replace(/ · best (\S+)/, (_, b) => ` best ${Number(b)}`)}`);
      else if ((m = /^moj: run (\d+) (complete|over): (\d+) of \d+$/.exec(l))) lines.push(`run ${m[1]} ${m[2]} ${m[3]}`);
    }
    return { lines, text, error: /SCRIPT ERROR|Parse Error/.test(text) ? text.split('\n').find((l) => /SCRIPT ERROR|Parse Error/.test(l)) : null };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('the shell\'s travel', () => {
  it('the web shell: a map travels on through its exit, a door carries the session, a run draws and ends, a best is kept', () => {
    expect(webShell(GAMES.map)).toEqual([
      'start town {"bag":{"items":{}}} seed=1',
      'start fields {"arrive":"town","bag":{"items":{"coin":1}}} seed=2',
      'start town {"arrive":"fields","bag":{"items":{"coin":1}}} seed=3',
      'menu town:open fields:open keep:shut',
    ]);
    const doors = webShell(GAMES.doors);
    expect(doors[1]).toBe('start cellar {"__entry":{"door":"up","from":"hall"},"bag":{"items":{}}} seed=2');
    expect(doors).toContain('locked vault');
    expect(doors).toContain('nowhere nowhere');
    expect(doors).toContain('refused up');
    const run = webShell(GAMES.run);
    expect(run.filter((l) => l.startsWith('run '))).toEqual(['run 1 over 1 deepest=1', 'run 2 complete 3 deepest=3']);
    expect(webRoll(GAMES.run.manifest.levels, 3)(1).map((l) => l.ref)).toHaveLength(3);
    expect(webShell(GAMES.kept).filter((l) => l.startsWith('kept'))).toEqual(['kept time 41.5', 'kept score 12', 'kept time 30 best 41.5', 'kept score 20 new best', 'kept time 39 new best', 'kept score 15 best 20']);
  });

  it.skipIf(!GODOT)('kernel/game.gd starts, travels, enters, draws and keeps as the web shell does (MOJULO_GODOT)', () => {
    for (const [name, game] of Object.entries(GAMES)) {
      const web = webShell(game).filter((l) => !/^(locked|nowhere|refused) /.test(l)).map((l) => (l.startsWith('run ') ? l.replace(/ deepest=\d+$/, '') : l));
      const gd = playShellInGodot(game, GODOT);
      expect(gd.error, name).toBe(null);
      expect(gd.lines, name).toEqual(web);
    }
  }, 900000);

  const PLANTS = [
    { game: 'map', name: 'no arrive told', from: '		start_level(String(to), from)', to: '		start_level(String(to))' },
    { game: 'doors', name: 'a door\'s carry without its entry', from: '	carry["__entry"] = {"door": to["door"], "from": current}', to: '	pass' },
    { game: 'run', name: 'a run drawn from the next number', from: '	var a := _u32(n * 2654435761)', to: '	var a := _u32((n + 1) * 2654435761)' },
    { game: 'kept', name: 'a low best kept from a failed run', from: 'or envelope.get("result") == "success")', to: 'or true)' },
  ];
  it.skipIf(!GODOT)('every planted bug in the shell\'s travel is caught (MOJULO_GODOT)', () => {
    for (const p of PLANTS) {
      const web = webShell(GAMES[p.game]).filter((l) => !/^(locked|nowhere|refused) /.test(l)).map((l) => (l.startsWith('run ') ? l.replace(/ deepest=\d+$/, '') : l));
      const gd = playShellInGodot(GAMES[p.game], GODOT, { mutate: [{ file: 'game.gd', from: p.from, to: p.to }] });
      expect(gd.lines, p.name).not.toEqual(web);
    }
  }, 900000);
});
