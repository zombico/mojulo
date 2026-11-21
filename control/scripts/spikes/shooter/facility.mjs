// A MISSION ON A GEOCUBE'S SITE, AS A PAGE (gameworld/mission-site.js): a warehouse on its yard by night in the rain, a
// walker parked in its hall, the mission laid on the place as it stands; written out as one self-contained page to open
// in a browser. The machine gate: the map's laws said, the tasks proved on the bus, the gunner's result on the resolved
// page; the look and the play are the operator's.
//
//   node scripts/spikes/shooter/facility.mjs [--out <page.html>] [--feel conscription] [--seed 1]
//     [--site '{"use":"hangar-bay","containers":20,"floods":6,"hour":"night","weather":"rain","parked":["siege-walker"]}']
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { missionSiteLevel } = await import('@/lib/graph/gameworld/mission-site');
const { readGameworld } = await import('@/lib/graph/gameworld/world');
const { proveMission, playMission } = await import('@/lib/graph/gameworld/mission-proof');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'mission-facility.html')), seed = Number(arg('--seed', '1')), site = JSON.parse(arg('--site', '{}'));
const G = readGameworld({ id: 'facility', name: 'Facility', seed, feel: arg('--feel', 'conscription'), start: 'one', levels: { one: { name: 'The facility', mission: true } } });
const L = await missionSiteLevel(G, { site, seed });
console.log(`site: ${L.site.use}, ${L.site.containers} containers, ${L.site.floods} floods, ${L.site.hour}, ${L.site.weather || 'dry'}, parked ${L.site.parked.join(', ') || 'nothing'}`);
console.log(`map ${L.map.nx} x ${L.map.ny}; laws not held: ${L.laws.filter((l) => !l.holds).map((l) => l.law).join(', ') || 'none'}`);
console.log(`proved on the bus: ${proveMission(L.manifest).proved}`);
const { payload } = await resolveWorldScene({ ref: 'facility-level-one', title: 'The facility', manifest: L.manifest }, { era: 'gen-7', live: true });
const R = playMission(payload, L.mission, { seconds: 240 });
console.log(`gunner: ${R.reason} at ${Math.round(R.t)} s, ${R.tasks?.length ?? 0} of ${L.mission.sections.length} tasks`);
fs.writeFileSync(out, emitThreeWorld({ ...payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: true }));
console.log(`page: ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
