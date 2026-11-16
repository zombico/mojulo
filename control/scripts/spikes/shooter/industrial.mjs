// AN INDUSTRIAL LEVEL, AS A PAGE (gameworld/mission-industrial.js): a world whose one level is `industrial`, staged and
// ordered as a game's level is, resolved and written out as one self-contained page to open in a browser. The machine
// gate: the yard's laws said, the tasks proved on the bus, the gunner's result on the resolved page; the look and the
// play are the operator's.
//
//   node scripts/spikes/shooter/industrial.mjs [--out <page.html>] [--feel conscription] [--seed 1]
//     [--industrial '{"depth":33,"hour":"golden","wet":"wet","tower":true}']
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { readGameworld } = await import('@/lib/graph/gameworld/world');
const { gameStages, stageLevelOrder } = await import('@/lib/graph/gameworld/levels');
const { yardAscii } = await import('@/lib/graph/arena-map/yard');
const { proveMission, playMission } = await import('@/lib/graph/gameworld/mission-proof');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'mission-industrial.html'));
const W = { id: 'industrial', name: 'Industrial', seed: Number(arg('--seed', '1')), feel: arg('--feel', 'conscription'), start: 'yard', levels: { yard: { name: 'The yard', industrial: JSON.parse(arg('--industrial', 'true')) } } };
const G = readGameworld(W), st = gameStages(W)[0], P = st.mission, O = stageLevelOrder(G, st, { ref: 'industrial-level-yard-0', heroRef: null });
console.log(yardAscii(P.design));
console.log(`yard ${P.grid.nx} x ${P.grid.ny}: ${P.design.held} of ${P.design.of} laws; not held: ${P.design.laws.filter((l) => !l.holds).map((l) => `${l.law} (${l.says})`).join('; ') || 'none'}`);
console.log(`proved on the bus: ${proveMission(O.args.manifest).proved}`);
const { payload } = await resolveWorldScene({ ref: 'industrial-level-yard-0', title: 'The yard', manifest: O.args.manifest }, { era: 'gen-7', live: true });
const R = playMission(payload, P.mission, { seconds: 240 });
console.log(`gunner: ${R.reason} at ${Math.round(R.t)} s, ${R.tasks?.length ?? 0} of ${P.mission.sections.length} tasks`);
fs.writeFileSync(out, emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: true }));
console.log(`page: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
