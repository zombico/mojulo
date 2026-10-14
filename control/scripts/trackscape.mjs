/**
 * A track from words (roads/trackscape-compose.js → trackscape-dress.js), written as a self-contained World page:
 * the course designed, drawn in the words' look, dressed where a driver looks, set in its land. Prints what each word
 * decided, the driver's eye over the dressed lap and the laws, the surrounds, and writes the arena plan's sheet beside the page (the venue's zones,
 * reviewed before anything in them is built). Tooling; output where you point it.
 *
 *   cd control && node scripts/trackscape.mjs "a realistic GT circuit in green hills" [out.html] [seed]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
const { composeTrack } = await import('../lib/graph/roads/trackscape-compose.js');
const { planScapedTrack } = await import('../lib/graph/roads/trackscape-dress.js');
const { assembleTrackScene } = await import('../lib/graph/roads/track.js');
const { collectFaceTextures } = await import('../lib/graph/landscape/surface-textures.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { arenaSheetSvg } = await import('../lib/graph/roads/arena-plan.js');

const intent = process.argv[2];
if (!intent) { console.error('usage: node scripts/trackscape.mjs "<the track in words>" [out.html] [seed]'); process.exit(1); }
const out = path.resolve(process.argv[3] || 'trackscape.html'), seed = Number(process.argv[4] || 1);
mkdirSync(path.dirname(out), { recursive: true });
const M = composeTrack(intent, { seed }), plan = planScapedTrack(M), S = plan.scape;
console.log(`"${intent}"`);
for (const r of M.reads) console.log(`  ${r.phrase.padEnd(14)} → ${r.decided}`);
console.log(`  a ${M.form} of ${Math.round(plan.length)} m (${M.course.class}), the ${S.set} set, raced in a ${M.vehicle}; look "${M.kit.look}"`);
console.log(`  the eye: ${S.census.blank} of ${S.census.seconds} s blank, ${S.census.corners.filter((c) => c.focused).length} of ${S.census.corners.length} corners focused, landmark ${S.census.landmarkSeen ? 'seen' : 'not seen'}, ${S.census.rhythm.perSecond} things a second`);
console.log(`  laws: ${S.laws.length ? S.laws.map((l) => `${l.law} (${l.detail})`).join('; ') : 'none advised'}`);
if (S.arena) {
  console.log(`  the arena: ${S.arena.zones.map((z) => `${z.id}${z.share !== undefined ? ` (sees ${Math.round(z.share * 100)} %)` : ''}`).join(', ')}; ${S.arena.tunnels.length} tunnel(s); ${S.absorbed.length} slots the zones' to fill; laws ${S.arena.laws.length ? S.arena.laws.map((l) => l.law).join(', ') : 'none advised'}`);
  const sheet = out.replace(/\.html$/, '') + '.plan.svg';
  writeFileSync(sheet, arenaSheetSvg(plan, S.arena, { scape: S, title: intent }));
  console.log(`  wrote ${sheet}`);
}
if (S.surrounds) { const U = S.surrounds; console.log(`  the surrounds: ${U.land}, ${U.settlement}${U.lake ? `, a lake of ${Math.round(U.lake.r)} m` : ''}; formations ${U.formations.map((f) => f.kind).join(', ') || 'none'}; ${U.buildings} buildings, ${U.trees} trees, ${U.canopy} woods`); }
const scene = assembleTrackScene(M, { title: intent }, plan);
scene.textures = collectFaceTextures(scene.faces, {});
writeFileSync(out, emitThreeWorld({ ...scene, inline: true }));
console.log(`  wrote ${out}`);
