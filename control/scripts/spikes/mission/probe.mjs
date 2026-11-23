// The mission probe: Steel Serpents' base written through the real design_game door, one variant a question, to say
// what is refused, what builds, what a made level carries and what is dropped without a word. No new code is under
// test: this measures the rail as it stands.
//
//   node scripts/spikes/mission/probe.mjs [workDir] [variant ...]      (from control/)
//
// Each variant is the base recipe (world.json) with one thing added. It is written, every part approved, the rail
// run, and its made rows read back from the database. Writes <workDir>/probe.json and prints a line a finding.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const control = path.resolve(here, '../../..');
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-mission-probe'));
const only = process.argv.slice(3);
const env = { ...process.env, MOJULO_DATA_DIR: path.join(work, 'data'), MOJULO_OUTCOMES_DIR: path.join(work, 'data', 'outcomes') };
mkdirSync(env.MOJULO_OUTCOMES_DIR, { recursive: true });

const call = (tool, args) => {
  const r = spawnSync(process.execPath, ['scripts/mcp-stdio.mjs', 'call', tool, '--json', JSON.stringify(args)], { cwd: control, env, encoding: 'utf8', maxBuffer: 1 << 28 });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, error: (r.stdout || r.stderr || '').trim().slice(0, 1200) }; }
};
const base = () => JSON.parse(readFileSync(path.join(here, 'world.json'), 'utf8'));

const HERO = { direction: { tradition: 'western' }, hero: {} };
const LEVELS = ['hangar', 'barracks', 'fortifications', 'plant'];
// the mission as a flow written by hand: a cutscene slot before the first layer, at every gate, and after the core
const missionFlow = (briefing) => {
  const steps = { title: { kind: 'screen', screen: 'title', on: { play: 'briefing', continue: '$continue' } }, briefing };
  LEVELS.forEach((id, i) => {
    const last = i === LEVELS.length - 1, gate = `gate-${i + 1}`;
    steps[id] = { kind: 'level', level: id, on: { won: last ? 'debrief' : gate, lost: 'result' } };
    if (!last) steps[gate] = { kind: 'cutscene', next: LEVELS[i + 1] };
  });
  steps.debrief = { kind: 'cutscene', next: 'result' };
  steps.result = { kind: 'screen', screen: 'result', on: { again: '$again', home: 'title' } };
  return { start: 'title', steps };
};
const SCRIPT = 'HERO: I am inside the hangar.';

const VARIANTS = {
  // the base: the dungeon, a building a layer, guards, an escape room at each keyed gate, the top-down camera, no hero
  base: (w) => w,
  // a hero: does the camera, the guards and the template's loadout reach a building's page?
  hero: (w) => ({ ...w, characters: HERO }),
  // a level's own scene on a building level
  scenes: (w) => ({ ...w, characters: HERO, levels: { ...w.levels, hangar: { ...w.levels.hangar, scenes: [{ id: 'arrival', when: { start: true }, beats: [{ script: SCRIPT }] }] } } }),
  // a story moment bound to a building level, as it starts and at a place
  story: (w) => ({ ...w, characters: HERO, story: [
    { id: 'arrival', where: { level: 'hangar' }, when: { slot: 'before' }, beats: [{ script: SCRIPT }] },
    { id: 'the-plant', where: { level: 'plant', place: 'exit' }, when: { reach: true }, beats: [{ script: 'HERO: There it is.' }] },
  ] }),
  // the mission's flow with empty cutscene slots, on a world with no hero: is it kept?
  'flow-no-hero': (w) => ({ ...w, flow: missionFlow({ kind: 'cutscene', next: 'hangar' }) }),
  // the same, with a hero
  flow: (w) => ({ ...w, characters: HERO, flow: missionFlow({ kind: 'cutscene', next: 'hangar' }) }),
  // the same flow, its briefing a film's ref
  film: (w) => ({ ...w, characters: HERO, flow: missionFlow({ kind: 'cinematic', film: 'steel_serpents-briefing', next: 'hangar' }) }),
};

const require = createRequire(path.join(control, 'package.json'));
const rowsOf = (ref) => {
  const db = new (require('better-sqlite3'))(path.join(env.MOJULO_DATA_DIR, 'mojulo-lite.db'), { readonly: true });
  try { return db.prepare('select ref, kind, manifest_json from sketches where ref like ?').all(`${ref}%`).map((r) => ({ ref: r.ref, kind: r.kind, m: JSON.parse(r.manifest_json || '{}') })); } finally { db.close(); }
};
// what a made level carries, read from its recipe
const levelFacts = (m) => {
  const ents = Array.isArray(m.entities) ? m.entities : [], hero = ents.find((e) => e.id === 'hero') ?? null;
  return {
    mechanics: (m.level?.mechanics ?? []).map((x) => x.kind),
    entities: ents.length,
    teams: ents.reduce((a, e) => ({ ...a, [e.team ?? '-']: (a[e.team ?? '-'] ?? 0) + 1 }), {}),
    minds: ents.filter((e) => e.rule?.type === 'ai').length,
    camera: m.camera?.rule ?? m.camera?.steer ?? (m.camera ? 'own' : null),
    hero: hero ? { rule: hero.rule?.type ?? null, move: hero.rule?.move ?? null, weapons: (hero.rule?.weapons ?? hero.weapons ?? (hero.weapon ? [hero.weapon] : [])).length, knife: !!hero.rule?.knife } : null,
    scenes: (m.play?.scenes ?? []).map((s) => s.id),
  };
};

const out = {};
for (const [name, vary] of Object.entries(VARIANTS)) {
  if (only.length && !only.includes(name)) continue;
  const ref = `ss_${name}`, t0 = Date.now(), R = { ref };
  const made = call('design_game', { ref, title: `Steel Serpents (${name})`, world: vary(base()) });
  R.written = made.ok === true;
  if (!R.written) { R.refused = made.error; out[name] = R; console.log(`${name}: REFUSED at write: ${String(made.error).slice(0, 300)}`); continue; }
  R.advice = made.advice ?? null;
  call('design_game', { ref, approve: (made.parts ?? []).map((p) => p.id) });
  let ran = null;
  for (let i = 0; i < 6; i++) {
    ran = call('design_game', { ref, run: true });
    if (ran.ok === false || !(ran.pending ?? []).some((p) => p.action !== 'keep')) break;
  }
  R.ran = ran.ok !== false;
  if (!R.ran) R.runError = ran.error;
  R.pending = (ran.pending ?? []).filter((p) => p.action !== 'keep').map((p) => `${p.key}:${p.action}`);
  R.unplaced = ran.story?.unplaced ?? ran.advice?.story ?? null;
  R.readoutAdvice = ran.advice ?? null;
  const rows = rowsOf(ref);
  R.rows = rows.map((r) => `${r.ref.slice(ref.length) || '(world)'}:${r.kind}`);
  R.levels = Object.fromEntries(rows.filter((r) => /-level-/.test(r.ref)).map((r) => [r.ref.replace(/^.*-level-/, ''), levelFacts(r.m)]));
  const game = rows.find((r) => r.kind === 'game');
  R.flow = game?.m.flow ? Object.fromEntries(Object.entries(game.m.flow.steps ?? {}).map(([k, s]) => [k, s.kind + (s.film ? ':film' : s.scene ? ':scene' : s.video ? ':video' : '')])) : null;
  R.seconds = Math.round((Date.now() - t0) / 1000);
  out[name] = R;
  console.log(`${name}: built in ${R.seconds}s · ${R.ran ? 'ran' : `RUN FAILED: ${String(R.runError).slice(0, 300)}`}`);
  console.log(`  levels ${JSON.stringify(R.levels)}`);
  console.log(`  flow ${JSON.stringify(R.flow)}${R.unplaced ? ` · unplaced ${JSON.stringify(R.unplaced)}` : ''}`);
}
writeFileSync(path.join(work, 'probe.json'), JSON.stringify(out, null, 1));
console.log(`written ${path.join(work, 'probe.json')}`);
