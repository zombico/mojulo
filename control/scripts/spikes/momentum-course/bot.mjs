// SPIKE momentum-course, the reaction bot's readout: what a course must give a player, found by playing it.
//   node scripts/spikes/momentum-course/bot.mjs [feel]
import { calibrate, layCourse, playCourse, trial, PRIMITIVES } from './course.mjs';
const feel = process.argv[2] ?? 'commuter-rail-runner', cal = calibrate(feel), r2 = (v) => Math.round(v * 100) / 100;
console.log(`feel: ${feel} · top ${r2(cal.top)} m/s`);
for (const [id, L] of Object.entries(cal.lead)) console.log(`  ${id}: jump between ${r2(L.late)} and ${r2(L.early)} s before it (a window of ${L.frames} frames)`);
console.log(`  posts: a lane change takes ${r2(cal.laneTime[1])} s for one lane, ${r2(cal.laneTime[2])} s for two`);
const say = (label, T) => `${label}: clean ${T.clean}/${T.seeds}, finished ${T.finished}/${T.seeds}, ${T.hits} hits${T.seconds ? `, ${T.seconds} s` : ''}`;
const base = { rhythm: 1.2, asks: 12 };
console.log(`\nREACTION (a course of 12 asks, one every ${base.rhythm} s, seen 30 m ahead):`);
for (const react of [0.15, 0.25, 0.4, 0.6, 0.8]) console.log('  ' + say(`reacts in ${react} s`, trial(cal, base, { react, sight: 30 })));
console.log('\nSIGHT (the same course, a player who reacts in 0.4 s):');
for (const sight of [4, 6, 8, 10, 14, 20, 30]) console.log('  ' + say(`sees ${sight} m ahead (${r2(sight / cal.top)} s)`, trial(cal, base, { react: 0.4, sight })));
console.log('\nRHYTHM (seen 30 m ahead, reacts in 0.4 s):');
for (const rhythm of [0.5, 0.7, 0.9, 1.2, 1.6, 2.4]) console.log('  ' + say(`an ask every ${rhythm} s (${r2(rhythm * cal.top)} m)`, trial(cal, { ...base, rhythm }, { react: 0.4, sight: 30 })));
console.log('\nBY PRIMITIVE (one kind only, every 1.2 s, seen 30 m, reacts in 0.4 s; then what sight each needs):');
for (const id of Object.keys(PRIMITIVES)) {
  const all = trial(cal, { ...base, mix: [id] }, { react: 0.4, sight: 30 });
  let need = null;
  for (const sight of [2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20]) { if (trial(cal, { ...base, mix: [id] }, { react: 0.4, sight }, 6).clean === 6) { need = sight; break; } }
  console.log('  ' + say(id, all) + ` · clean from ${need ?? 'more than 20'} m of sight (${need ? r2(need / cal.top) : '?'} s)`);
}
// THE FAIR COURSE: each ask given the time it needs (its jump's lead, its lane change) plus a rest, and the sight it
// then asks for; the gate: the slowest reaction that still runs it clean, with that sight and with less
console.log('\nTHE FAIR LAYOUT (each ask spaced by what it needs, plus a rest):');
for (const rest of [0.3, 0.6, 1.0]) {
  const design = { ...base, rhythm: rest, fair: true }, T0 = trial(cal, design, { react: 0.4, sight: 60 }), need = T0.needs;
  const cleanAt = (react, sight) => { const T = trial(cal, design, { react, sight }); return T.clean === T.seeds; };
  const slowest = (sight) => [0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.15].find((r) => cleanAt(r, sight)) ?? null;
  const sightFor = (react) => [6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40].find((m) => cleanAt(react, m)) ?? null;
  console.log(`  a rest of ${rest} s: its neediest ask wants ${r2(need)} s (${r2(need * cal.top)} m) · ${say('seen 60 m, reacts 0.4 s', T0)}`);
  console.log(`    clean for a 0.4 s reaction from ${sightFor(0.4)} m of sight; for 0.6 s from ${sightFor(0.6)} m · with ${Math.round((need + 0.4) * cal.top)} m of sight (need + 0.4 s) the slowest reaction that runs it clean: ${slowest(Math.round((need + 0.4) * cal.top))} s`);
}
// one course, one bad player, in full: where it went wrong
const C = layCourse(cal, { ...base, seed: 3 }), R = playCourse(cal, C, { react: 0.8, sight: 8 });
console.log(`\nONE RUN (seed 3, reacts in 0.8 s, sees 8 m): ${R.finished ? `finished in ${R.seconds} s` : `stuck at ask ${R.stuck} (${C.obs[R.stuck]?.id})`}, backed off ${R.retries} times, hit ${R.hits.map((k) => `${k}:${C.obs[k].id}`).join(', ') || 'nothing'}, slowest ${R.slowest} m/s`);
process.exit(0);
