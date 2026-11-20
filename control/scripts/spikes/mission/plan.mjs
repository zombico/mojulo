#!/usr/bin/env node
/**
 * THE MISSION'S PLAN, DRY — a mission read as a walled-core dungeon in miniature: its layers the SEGMENTS of one level
 * (an outdoor section of its walk, a building's inside by its door), its doors the joins between them, its gates what
 * is found in the layer before. Nothing is built: the level is laid through the game rail as it stands
 * (gameworld/levels.js gameStages) to say which segments the rail makes, the dungeon's own laws are read on it
 * (wcd/wcd.js), and the mission's are checked beside them. A spike: the recipe (level1.json) is this script's own.
 *
 *   cd control
 *   node scripts/spikes/mission/plan.mjs [--mission scripts/spikes/mission/level1.json] [--cube jungle-haze] [--out plan.md]
 */
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
process.env.SQLITE_PATH ??= ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';
const here = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const { readGameworld } = await import('../../../lib/graph/gameworld/index.js');
const { gameStages } = await import('../../../lib/graph/gameworld/levels.js');
const { readWcd } = await import('../../../lib/graph/wcd/wcd.js');
const { parkable } = await import('../../../lib/graph/vehicle-registry/parked.js');
const { buildingStage } = await import('../../../lib/graph/gameworld/levels.js');
const { assembleStageScene } = await import('../../../lib/graph/era/stage.js');

const M = JSON.parse(fs.readFileSync(opt('--mission', path.join(here, 'level1.json')), 'utf8'));
const W0 = JSON.parse(fs.readFileSync(path.join(here, 'world.json'), 'utf8'));
const LEVEL = 'infiltration';
// (the world with this one level: the game's own dungeon, which spans its levels, set aside)
const { wcd: _game, ...rest } = W0;
const G = readGameworld({ ...rest, style: { ...W0.style, geocube: opt('--cube', 'jungle-haze') }, levels: { [LEVEL]: M.level } });
const stages = gameStages(G), made = new Map(stages.map((s) => [s.node, s]));

// THE DUNGEON, read by its own reader: every space is in the one level (so a lift between two of them is within it)
const D = readWcd({ ...M.wcd, spaces: Object.fromEntries(Object.entries(M.wcd.spaces).map(([id, s]) => [id, { ...s, level: LEVEL }])) }, { levels: [LEVEL] });
const doorId = (d) => `${d.from}>${d.to}`;

// THE MISSION'S LAWS (advice, as the dungeon's are)
const law = (id, holds, says) => ({ law: id, holds, says }), laws = [];
const segs = M.segments, ids = Object.keys(segs);
const unbound = Object.keys(M.wcd.spaces).filter((id) => !segs[id]);
laws.push(law('a-segment-a-space', !unbound.length, unbound.length ? `${unbound.join(', ')}: a space with no segment` : 'every space of the dungeon is a segment of the level'));
const unmade = ids.filter((id) => !segs[id].stage || !made.has(segs[id].stage));
laws.push(law('rail-makes-it', !unmade.length, unmade.length ? `${unmade.join(', ')}: the rail lays no stage for it` : `the rail lays a stage for every segment (${[...new Set(ids.map((id) => segs[id].stage))].join(', ')})`));
// THE BUILDING, laid dry as its program lays it (a floor 0 under the ground one where the mission asks: era/program-core.js
// `basement`): the rooms the mission's floors name, how they are joined, and whether what is parked stands under the roof
const B = M.building, m0 = buildingStage({ use: B.use, seed: B.seed, ...(B.scale ? { scale: B.scale } : {}), ...(B.headroom ? { headroom: B.headroom } : {}) }), BP = assembleStageScene({ ...m0, program: { ...m0.program, ...(B.basement ? { basement: B.basement } : {}) } });
const roomOf = (id) => (BP.rooms ?? []).find((r) => r.id === id || r.id === `${id}@1`), size = (r) => (r && r.size ? r.size : r && r.box ? [r.box.max[0] - r.box.min[0], r.box.max[1] - r.box.min[1], r.box.max[2] - r.box.min[2]] : null);
const floors = ids.filter((id) => segs[id].room), noRoom = floors.filter((id) => !roomOf(segs[id].room));
laws.push(law('floors-are-rooms', !noRoom.length, noRoom.length ? `${noRoom.map((id) => `${id}: no room '${segs[id].room}'`).join('; ')} (rooms: ${(BP.rooms ?? []).map((r) => r.id).join(', ')})` : floors.map((id) => { const z = size(roomOf(segs[id].room)); return `${id} is the ${B.use}'s '${segs[id].room}', floor ${segs[id].floor}${z ? `, ${z.map((v) => +v.toFixed(1)).join(' × ')} m` : ''}`; }).join('; ')));
// a lift between two floors of the building, and the stair down to a floor lodged deep: the building lays neither (its
// core's stair does not climb that far); both are the mission's ways, played by worlds/controllable/mission.js
const lifts = D.doors.filter((d) => d.via === 'lift'), deep = (BP.program?.findings ?? []).concat(BP.findings ?? []).filter((f) => f && f.id === 'deep-floor');
laws.push(law('ways-are-played', true, `${lifts.map(doorId).join(', ') || 'no lift'}: a way of the mission (a deck ridden between the two floors, shut until its gate holds)${B.basement && B.basement.hall ? `; floor 0 is lodged ${B.basement.hall} m down, past the core's stair: the stairwell is a way too` : ''}`));
// what stands parked on a floor stands under its roof
const tall = { 'siege walker': 8.4, 'field walker': 3.2 };
const low = ids.flatMap((id) => (segs[id].parked ?? []).flatMap((p) => { const z = size(roomOf(segs[id].room ?? '')); return z && tall[p.vehicle] && tall[p.vehicle] + 0.6 > z[2] ? [`${p.vehicle} (${tall[p.vehicle]} m) under ${id}'s ${z[2].toFixed(1)} m`] : []; }));
laws.push(law('headroom', !low.length, low.join('; ') || 'what is parked stands under its floor\'s roof'));
const wheres = new Set(ids.map((id) => segs[id].where));
laws.push(law('out-and-in', wheres.has('outdoor') && wheres.has('indoor'), `segments ${ids.map((id) => `${id} (${segs[id].where})`).join(', ')}`));
// a keyed door's key lies in the space it leaves, and some segment holds it
const keyed = D.doors.filter((d) => d.gate && d.gate.keys), keyOf = (d) => Object.entries(M.items).find(([, it]) => it.opens === doorId(d));
const badKeys = keyed.flatMap((d) => { const k = keyOf(d); return !k ? [`${doorId(d)} names no key`] : k[1].in !== d.from ? [`${k[0]} lies in ${k[1].in}, not in ${d.from}`] : !(segs[d.from].holds ?? []).includes(k[0]) ? [`${d.from} does not hold ${k[0]}`] : []; });
laws.push(law('keys-inside', !badKeys.length, badKeys.join('; ') || `${keyed.map((d) => `${doorId(d)} by ${keyOf(d)[0]}`).join(', ')}: each key in the space its door leaves`));
// the clues: enough of them, all in the space the reveal's door leaves
const R = M.reveal, rd = D.doors.find((d) => doorId(d) === R.opens), cl = R.of.map((c) => M.clues[c]);
const badClues = [...(R.of.length < R.needs ? [`${R.needs} needed of ${R.of.length}`] : []), ...R.of.filter((c, i) => !cl[i] || !rd || cl[i].in !== rd.from).map((c) => `${c} is not in ${rd ? rd.from : 'the door\'s space'}`), ...(R.of.length === R.needs ? ['every clue is needed: one missed and the mission stalls'] : [])];
laws.push(law('clues-lead', !badClues.length, badClues.join('; ') || `${R.needs} of ${R.of.length} clues in ${rd.from} open ${R.opens}: one may be missed`));
// what stands parked is a vehicle the registry parks
const parked = ids.flatMap((id) => (segs[id].parked ?? []).map((p) => ({ id, ...p })));
const badParked = parked.flatMap((p) => { try { parkable(p.vehicle); return []; } catch (e) { return [`${p.vehicle}: ${e.message.slice(0, 80)}`]; } });
laws.push(law('parked-stand', !badParked.length, badParked.join('; ') || parked.map((p) => `${p.count ?? 1} × ${p.vehicle}${p.role ? ` (${p.role})` : ''} in ${p.id}`).join(', ')));
// one result, where the way out leads, reached from the core
const out = D.doors.find((d) => d.from === D.core && d.oneWay);
const joined = out && (out.to === M.result.at || D.doors.some((d) => !d.oneWay && ((d.from === out.to && d.to === M.result.at) || (d.to === out.to && d.from === M.result.at))));
laws.push(law('one-result', !!joined, out ? `the core's way out (${out.via}) leads to ${out.to}${out.to === M.result.at ? '' : `, and on to ${M.result.at}`}; the result is at ${M.result.at}` : 'the core has no way back out'));

// THE PLAN, as a page of text
const L = [], row = (...c) => L.push(`| ${c.join(' | ')} |`);
L.push(`# ${M.name}`, '', M.brief, '', `The building: ${M.building.reads}.`, '', '## Segments (the dungeon\'s layers)', '');
row('Depth', 'Segment', 'Kind', 'Where', 'What it is', 'Guards', 'Parked', 'Rail stage'); row('---', '---', '---', '---', '---', '---', '---', '---');
for (const id of Object.keys(D.spaces).sort((a, b) => D.spaces[a].depth - D.spaces[b].depth)) {
  const s = segs[id] ?? {}, sp = D.spaces[id], st = s.stage && made.get(s.stage);
  row(sp.depth, `${id}${id === D.core ? ' (core)' : ''}`, sp.kind, `${s.where ?? '?'}${s.floor !== undefined ? `, floor ${s.floor}` : ''}`, s.reads ?? '', s.guards ?? 0, (s.parked ?? []).map((p) => `${p.count ?? 1} × ${p.vehicle}${p.role ? `, ${p.role}` : ''}`).join('; ') || 'none', st ? `${s.stage} (${st.section})${s.room ? `, room ${s.room}` : ''}` : 'not laid');
}
L.push('', '## Doors and gates', '');
row('Door', 'Via', 'Opens on', 'Found', 'Back'); row('---', '---', '---', '---', '---');
for (const d of D.doors) {
  const k = d.gate && d.gate.keys ? keyOf(d) : null, rv = R.opens === doorId(d);
  row(`${d.from} → ${d.to}`, d.via, d.oneWay && !d.gate ? 'open from inside' : [k ? k[0] : d.gate ? JSON.stringify(d.gate) : 'open', ...(rv ? [`and ${R.needs} of ${R.of.length} clues (${R.flag})`] : [])].join(' '), k ? `${k[1].at}, in ${k[1].in}` : '', d.oneWay ? 'one way' : 'both ways');
}
L.push('', '## Objectives', '');
for (const [id, o] of Object.entries(M.objectives)) L.push(`- **${id}**: ${o.reads}${o.after ? ` (given once ${o.after})` : ''}. Done by ${o.done}: ${M.items[o.done].reads}, at ${M.items[o.done].at}.`);
L.push(`- **Result**: ${M.result.reads}, holding ${M.result.when.join(' and ')}.`);
L.push('', '## Clues', '');
for (const c of R.of) L.push(`- **${c}** (${M.clues[c].at}): ${M.clues[c].reads}.`);
L.push(`- Any ${R.needs}: ${R.reads}.`);
L.push('', '## Scenes', '');
for (const s of M.scenes) L.push(`- ${s.at} (${s.kind}): ${s.reads}.`);
L.push('', '## The critical path', '', D.path ? D.path.join(' → ') + ` → out (${out ? out.to : '?'})` : 'the core is not reached');
L.push('', '## Laws', '', '### The dungeon\'s (wcd/wcd.js)', '');
for (const l of D.laws) L.push(`- ${l.holds ? 'holds' : '**ADVISED**'} · ${l.law}: ${l.says}`);
L.push('', '### The mission\'s', '');
for (const l of laws) L.push(`- ${l.holds ? 'holds' : '**ADVISED**'} · ${l.law}: ${l.says}`);
L.push('', '## What the rail lays today', '');
for (const s of stages) L.push(`- ${s.node} (${s.section}${s.outside ? `, behind ${s.outside.node}'s door ${s.outside.door}` : ''}): ${s.manifest.kind}${(s.manifest.buildings ?? []).length ? `, buildings ${(s.manifest.buildings).map((b) => `${b.use} by ${b.enter ?? 'walk'}`).join(', ')}` : ''}`);
const text = L.join('\n') + '\n';
if (opt('--out')) fs.writeFileSync(path.resolve(opt('--out')), text);
console.log(text);
process.exit(0);
