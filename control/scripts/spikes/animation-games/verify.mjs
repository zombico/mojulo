// animation-games verify: one take per procedure (a strike, a jump, a reaction) rendered in every flavor, each flavor's
// signature measured, PASS/FAIL per concept. The machine gate only; nobody has looked at it.
//   node scripts/spikes/animation-games/verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig, rigNodesAt } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { keyedClip } = await import('../../../lib/graph/polygonizer/hero-jump.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { GENRES } = await import('../../../lib/graph/gameworld/intent.js');
const A = await import('./flavor.mjs');

const cast = process.argv[2] ?? 'male';
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const jab = A.strikeTake('jab', R), cross = A.strikeTake('cross', R), jump = A.jumpTake('jump', R);
const X = Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, A.exchange(jab, 'hitHigh', f, R)]));
const J = Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, A.render(jump, f, R)]));
const sig = (r, take) => A.signature(R, r, { take });
const SA = Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, sig(X[f].attacker, jab)]));
const SV = Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, sig(X[f].victim)]));
const SJ = Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, sig(J[f], jump)]));
console.log('\njab (attacker)'); console.table(SA);
console.log('hitHigh (victim)'); console.table(SV);
console.log('jump'); console.table(SJ);
console.log('the blow'); console.table(Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, { ...X[f].blow, knockback: undefined, ...Object.fromEntries(Object.entries(X[f].blow.knockback).map(([k, v]) => [`kb.${k}`, v])) }])));
console.log();

// ── the promise: the same poses in every flavor ──
check('the jab\'s hand lands on its contact point in every flavor (< 1 mm)', A.FLAVOR_NAMES.every((f) => SA[f].contactErr < 0.001), Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, SA[f].contactErr])));
const src = keyedClip(jump, R);
const toes = (n) => [n.toeBaseL, n.toeBaseR];
const feetErr = Object.fromEntries(A.FLAVOR_NAMES.map((f) => {
  const { nodes } = A.nodesOf(R, J[f]);
  return [f, +Math.max(...['takeoff', 'land'].flatMap((id) => { const b = J[f].beats.find((x) => x.id === id); const want = toes(rigNodesAt(R, src.fn(b.at)).nodes); return toes(nodes[b.frame]).map((p, i) => near(p, want[i])); })).toFixed(4)];
}));
check('the jump leaves and meets the floor on the same feet in every flavor (< 1 cm, squash about the feet)', Object.values(feetErr).every((e) => e < 0.01), feetErr);

// ── realistic: the clip as its solver made it ──
const ident = J.realistic.frames.every((f) => JSON.stringify(f.pose) === JSON.stringify(src.fn(f.src)));
check('realistic shows the take\'s own poses (no key grown), no holds, no squash, no smears', ident && SJ.realistic.held === 0 && SA.realistic.held === 0 && SJ.realistic.squash === 0 && SA.realistic.smears === 0);
check('realistic keeps the take\'s length to half a frame', Math.abs(J.realistic.seconds - jump.seconds) <= 0.5 / 60 && Math.abs(X.realistic.attacker.seconds - jab.seconds) <= 0.5 / 60, { jump: [J.realistic.seconds, jump.seconds], jab: [X.realistic.attacker.seconds, jab.seconds] });
check('realistic hands on a blow\'s real momentum (powerscale 1) and the victim barely flinches', X.realistic.blow.powerscale === 1 && X.realistic.blow.reactGain < 0.5, { dv: X.realistic.blow.dv, reactGain: X.realistic.blow.reactGain });

// ── action: the transfer of force is the depiction ──
const holdRun = (r, from) => { let n = 0; for (let k = from + 1; k < r.frames.length && r.frames[k].held; k++) n++; return n; };
const aAt = X.action.attacker.beats.find((b) => b.id === 'contact').frame, vAt = X.action.victim.beats.find((b) => b.id === 'peak').frame;
check('action freezes both bodies on the blow for the same frames (hitstop), the victim within two frames of the striker', holdRun(X.action.attacker, aAt) === X.action.blow.hitstop && holdRun(X.action.victim, vAt) === X.action.blow.hitstop && vAt <= 2 && X.action.blow.hitstop >= 4,
  { hitstop: X.action.blow.hitstop, striker: holdRun(X.action.attacker, aAt), victim: holdRun(X.action.victim, vAt), victimLag: vAt });
const stops = [1, 4, 8, 16].map((dv) => A.render(jab, 'action', R, { blowDv: dv }).hitstop);
check('action\'s hitstop grows with the blow (Δv 1, 4, 8, 16 m/s), never past its cap', stops.every((h, i) => !i || h >= stops[i - 1]) && stops[3] > stops[0] && stops[3] <= A.FLAVORS.action.hitstop.max, { stops });
const crossX = A.blow(cross, 'action', R);
console.log(`note  jab vs cross into contact: ${X.action.blow.handSpeed} vs ${crossX.handSpeed} m/s; one effective-mass share for every strike, so the cross is not heavier here`);
check('action winds up deeper than realistic (the load\'s reach off ready, jab and jump, ×1.3+)', SA.action.windDepth > 1.3 * SA.realistic.windDepth && SJ.action.windDepth > 1.3 * SJ.realistic.windDepth, { jab: [SA.realistic.windDepth, SA.action.windDepth], jump: [SJ.realistic.windDepth, SJ.action.windDepth] });
check('action snaps into contact (fewer moving frames from load to contact than realistic)', SA.action.driveFrames < SA.realistic.driveFrames, { realistic: SA.realistic.driveFrames, action: SA.action.driveFrames });
check('action throws the victim (airborne, powerscale ≥ 10) and the victim goes deeper into its reaction', X.action.blow.knockback.airborne > 0 && X.action.blow.powerscale >= 10 && SV.action.windDepth > 2 * SV.realistic.windDepth, { knockback: X.action.blow.knockback, react: [SV.realistic.windDepth, SV.action.windDepth] });

// ── platformer: movement, squash and stretch, a boop ──
const zAt = (r, id) => r.frames[r.beats.find((b) => b.id === id).frame].scale?.[2] ?? 1;
check('platformer stretches at take-off and squashes at landing, the volume kept', zAt(J.platformer, 'takeoff') > 1.15 && zAt(J.platformer, 'land') < 0.85 && SJ.platformer.volumeErr < 1e-3, { takeoff: zAt(J.platformer, 'takeoff'), land: zAt(J.platformer, 'land'), volumeErr: SJ.platformer.volumeErr });
check('platformer starts quicker than realistic (the wind-up and the push in fewer frames)', J.platformer.beats.find((b) => b.id === 'takeoff').frame < J.realistic.beats.find((b) => b.id === 'takeoff').frame, { realistic: J.realistic.beats.find((b) => b.id === 'takeoff').frame, platformer: J.platformer.beats.find((b) => b.id === 'takeoff').frame });
check('platformer\'s blow is a boop: a short freeze, the victim pushed and squashed, the striker bounced', X.platformer.blow.hitstop <= 2 && X.platformer.blow.bounce > 0 && SV.platformer.squash > 0.15 && !X.platformer.blow.knockback.airborne, { blow: X.platformer.blow.dv, bounce: X.platformer.blow.bounce, squash: SV.platformer.squash });

// ── pinball: the faster it goes, the faster its frames change ──
const P20 = A.render(jump, 'pinball', R, { speed: 20 }), P4 = A.render(jump, 'pinball', R, { speed: 4 });
check('pinball plays the take faster the faster the body travels (4 → 10 → 20 m/s), never slower than its own pace', P4.seconds === J.realistic.seconds && J.pinball.seconds < P4.seconds && P20.seconds < J.pinball.seconds, { realistic: J.realistic.seconds, at4: P4.seconds, at10: J.pinball.seconds, at20: P20.seconds });
check('pinball shows a new pose every frame (no holds) and moves the most a frame of any flavor', SJ.pinball.held === 0 && A.FLAVOR_NAMES.every((f) => SJ.pinball.meanStep >= SJ[f].meanStep), Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, SJ[f].meanStep])));
check('pinball smears its fastest frames; realistic and platformer never smear', SJ.pinball.smears > 0 && SJ.realistic.smears === 0 && SJ.platformer.smears === 0, Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, SJ[f].smears])));
check('pinball\'s blow ricochets: the victim leaves faster than the body came in', X.pinball.blow.dv > A.FLAVORS.pinball.rate.speed, { in: A.FLAVORS.pinball.rate.speed, out: X.pinball.blow.dv });

// ── the four are four ──
const order = (k) => A.FLAVOR_NAMES.map((f) => SJ[f][k]);
check('the same jump renders four different ways (length, holds, squash or smears differ pairwise)', A.FLAVOR_NAMES.every((a, i) => A.FLAVOR_NAMES.slice(i + 1).every((b) => ['seconds', 'held', 'squash', 'smears'].some((k) => SJ[a][k] !== SJ[b][k]))), { seconds: order('seconds'), held: order('held'), squash: order('squash'), smears: order('smears') });

// ── determinism ──
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
check('a render is byte-identical run to run', A.FLAVOR_NAMES.every((f) => hash(A.render(jump, f, R)) === hash(J[f])), Object.fromEntries(A.FLAVOR_NAMES.map((f) => [f, hash(J[f])])));

// ── selection: every genre asks for one flavor ──
const homes = Object.keys(GENRES).map((id) => [id, Object.entries(A.GENRE_FLAVOR).filter(([, ids]) => ids.includes(id)).length]);
check('every cosmos genre asks for exactly one flavor', homes.every(([, n]) => n === 1), homes.filter(([, n]) => n !== 1));
const asks = [[{ genre: 'versus-fighter' }, 'action'], [{ says: 'a kart racer on the beach' }, 'pinball'], [{ says: 'a metroidvania with a double jump' }, 'platformer'], [{ says: 'a stealth game in a museum' }, 'realistic'], [{ genre: 'versus-fighter', flavor: 'platformer' }, 'platformer'], [{}, 'realistic']];
check('a game\'s genre, its words, or the operator\'s word picks the flavor', asks.every(([g, want]) => A.flavorFor(g).flavor === want), asks.map(([g]) => `${JSON.stringify(g)} → ${A.flavorFor(g).flavor} (${A.flavorFor(g).from})`));

console.log(`\n${fails ? `${fails} FAILED` : 'all held'} (machine gate; the eyes gate is open: run preview.mjs and look)`);
process.exitCode = fails ? 1 : 0;
