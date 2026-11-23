#!/usr/bin/env node
// The holo briefing of a campaign's mission (lib/graph/campaign/briefing-page.js), written as one page to open in a
// browser: the place, the theatre in hologram light on a table, the mission told one step at a time on mana-ui. The page
// a person looks at to approve a mission's design before its level is built; it loads nothing from anywhere (--cdn: three
// from the pinned CDN, for a host that will not run data modules).
//
//   node scripts/briefing.mjs <rail> <mission> [--out <dir>] [--cdn] [--laws]
//
//   rail      rebel-storm (its MISSION_DESIGNS)
//   --laws    print the design's machine gate (campaign/mission.js missionLaws) and what its compile lays
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
const cwd = process.env.INIT_CWD || process.cwd();
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2), flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const [rail, id] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
if (!rail || !id) { console.error('usage: node scripts/briefing.mjs <rail> <mission> [--out <dir>] [--cdn] [--laws]'); process.exit(2); }
const RAILS = { 'rebel-storm': async () => (await import('@/lib/graph/gameworld/rebel-storm.js')).MISSION_DESIGNS };
if (!RAILS[rail]) { console.error(`briefing: '${rail}' has no designed missions (${Object.keys(RAILS).join(', ')})`); process.exit(2); }
const designs = await RAILS[rail]();
if (!designs[id]) { console.error(`briefing: ${rail} has no design '${id}' (${Object.keys(designs).join(', ')})`); process.exit(2); }

const { readMission, missionLaws, compileMission } = await import('@/lib/graph/campaign/mission.js');
const { briefingPage } = await import('@/lib/graph/campaign/briefing-page.js');
const { placeLine } = await import('@/lib/graph/campaign/theatre.js');
const M = readMission(designs[id]);
const out = path.resolve(cwd, flag('--out') ?? '.'), file = path.join(out, `${rail}-${id}-briefing.html`);
mkdirSync(out, { recursive: true });
writeFileSync(file, briefingPage(M, { cdn: args.includes('--cdn') }));
console.log(`${M.name} · ${placeLine(M.place)} · ${M.status}\n→ ${file}`);
if (args.includes('--laws')) {
  for (const L of missionLaws(M)) console.log(`${L.ok ? '  ok  ' : '  ADVISE'} ${L.law}: ${L.says}`);
  const C = compileMission(M);
  console.log(`compiled: ${C.level.goal.flight.sortie.groups.map((g) => `${g.name} ×${g.count ?? 1}`).join(', ')}; the build lays ${C.build.fleet.map((f) => `${f.name} (${f.capital ?? f.station})`).join(', ')}`);
}
