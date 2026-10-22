// animation-games weapon verify: a strike with a held weapon in the four registers — one swing per procedure (an
// overhead chop at each item class, a thrust, the two-handed cleave) — PASS/FAIL per concept, and the notes the gate
// measures but does not judge. The machine gate only.
//   node scripts/spikes/animation-games/weapon-verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig, rigNodesAt, layeredClip } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { swingKeys } = await import('../../../lib/graph/polygonizer/hero-swing.js');
const A = await import('./flavor.mjs');
const Wp = await import('./weapon.mjs');

const cast = process.argv[2] ?? 'male';
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const NAMES = A.FLAVOR_NAMES;
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (s, m) => console.log(`note  ${s}  ${JSON.stringify(m)}`);

const SWINGS = [['chop', 'dagger'], ['chop', 'sword'], ['chop', 'greatsword'], ['thrust', 'sword'], ['cleave', 'greatsword']];
const X = {}, S = {}, T = {};
for (const [w, i] of SWINGS) for (const f of NAMES) { const k = `${w}/${i} ${f}`; T[k] = Wp.swingTake(w, i, R, f); X[k] = A.exchange(T[k], 'hitHigh', f, R); S[k] = A.signature(R, X[k].attacker, { take: T[k] }); }
console.log('\nswings (the victim takes hitHigh), each register');
console.table(Object.fromEntries(Object.keys(S).map((k) => [k, { seconds: X[k].attacker.seconds, held: S[k].held, windDepth: S[k].windDepth, driveFrames: S[k].driveFrames, tip: X[k].blow.handSpeed, dv: X[k].blow.dv, hitstop: X[k].blow.hitstop, thrown: X[k].blow.knockback.distance, contactErr: S[k].contactErr }])));
console.log();
const k = (w, i, f) => `${w}/${i} ${f}`;
const sec = (w, i, f) => X[k(w, i, f)].attacker.seconds;

// ── the promise ──
check('at contact the blade\'s tip is where the swing puts it, every swing in every register (< 1 mm)', Object.values(S).every((s) => s.contactErr < 0.001), Math.max(...Object.values(S).map((s) => s.contactErr)));

// ── realistic is the rig's own swing ──
const own = Wp.swingTake('chop', 'sword', R, 'realistic'), play = layeredClip(swingKeys('chop', 'normal').keys, R), rr = A.render(own, 'realistic', R);
let worst = 0; for (const fr of rr.frames) { const a = rigNodesAt(R, fr.pose).nodes, b = rigNodesAt(R, play(Math.min(0.999999, fr.src))).nodes; for (const j of Object.keys(a)) worst = Math.max(worst, Math.hypot(a[j][0] - b[j][0], a[j][1] - b[j][1], a[j][2] - b[j][2])); }
check('realistic plays the rig\'s own swing (every joint within 1 mm of the rig\'s clip player at the same phase), no holds, no trail', worst < 0.001 && S[k('chop', 'sword', 'realistic')].held === 0, { worstJoint: +worst.toFixed(5) });
check('realistic: the swing\'s length follows the item\'s class (dagger < sword < greatsword)', sec('chop', 'dagger', 'realistic') < sec('chop', 'sword', 'realistic') && sec('chop', 'sword', 'realistic') < sec('chop', 'greatsword', 'realistic'), ['dagger', 'sword', 'greatsword'].map((i) => sec('chop', i, 'realistic')));
const dvs = ['dagger', 'sword', 'greatsword'].map((i) => X[k('chop', i, 'realistic')].blow.dv);
check('realistic: a heavier weapon hands on more, though it swings slower (Δv dagger < sword < greatsword; two hands more again)', dvs[0] < dvs[1] && dvs[1] < dvs[2] && X[k('cleave', 'greatsword', 'realistic')].blow.dv > dvs[2], { chop: dvs, cleave: X[k('cleave', 'greatsword', 'realistic')].blow.dv });

// ── how much the weight shows: the class's spread by register ──
const spread = (f) => +(sec('chop', 'greatsword', f) / sec('chop', 'dagger', f)).toFixed(3);
check('the weight shows most in action, as weighed in realistic, least in platformer (greatsword ÷ dagger length)', spread('action') > spread('realistic') && spread('realistic') > spread('platformer') && spread('platformer') < 1.3, Object.fromEntries(NAMES.map((f) => [f, spread(f)])));

// ── action ──
const charge = (i) => Math.round(Wp.WEAPON_REGISTERS.action.charge[Wp.ITEMS[i].cls] * 60);
const holdAtLoad = (key) => { const r = X[key].attacker, b = r.beats.find((x) => x.id === 'load').frame; let n = 0; for (let j = b + 1; j < r.frames.length && r.frames[j].held; j++) n++; return n; };
check('action: a heavy weapon charges (held at the cock), a dagger does not', holdAtLoad(k('chop', 'greatsword', 'action')) === charge('greatsword') && charge('greatsword') >= 15 && holdAtLoad(k('chop', 'dagger', 'action')) === 0, { greatsword: holdAtLoad(k('chop', 'greatsword', 'action')), dagger: holdAtLoad(k('chop', 'dagger', 'action')) });
const stops = ['dagger', 'sword', 'greatsword'].map((i) => X[k('chop', i, 'action')].blow.hitstop);
check('action: the freeze grows with the weapon (dagger ≤ sword ≤ greatsword < two-handed cleave)', stops[0] <= stops[1] && stops[1] <= stops[2] && stops[0] < stops[2] && X[k('cleave', 'greatsword', 'action')].blow.hitstop > stops[2], { chop: stops, cleave: X[k('cleave', 'greatsword', 'action')].blow.hitstop });
const trailOf = (key, f) => { const { nodes } = A.nodesOf(R, X[key].attacker); return Wp.trails(T[key], f, nodes); };
const tr = (key, f) => trailOf(key, f).filter(Boolean).length;
const contactTrailed = (key, f) => { const t = trailOf(key, f), c = X[key].attacker.beats.find((b) => b.id === 'contact').frame; return t.slice(Math.max(0, c - 4), c + 1).some(Boolean); };
check('action and pinball: the blade leaves a trail through the drive into contact; realistic and platformer leave none', ['action', 'pinball'].every((f) => tr(k('chop', 'sword', f), f) > 0 && contactTrailed(k('chop', 'sword', f), f)) && ['realistic', 'platformer'].every((f) => tr(k('chop', 'sword', f), f) === 0),
  Object.fromEntries(NAMES.map((f) => [f, tr(k('chop', 'sword', f), f)])));

// ── platformer and pinball ──
check('platformer: every weapon is a boop (the same push, a 2-frame freeze)', ['dagger', 'sword', 'greatsword'].every((i) => X[k('chop', i, 'platformer')].blow.dv === 2.5 && X[k('chop', i, 'platformer')].blow.hitstop === 2));
check('pinball: the blow ricochets off the tip (Δv = tip speed × 1.3), the swing played at speed', ['dagger', 'greatsword'].every((i) => Math.abs(X[k('chop', i, 'pinball')].blow.dv - 1.3 * X[k('chop', i, 'pinball')].blow.handSpeed) < 1e-3) && sec('chop', 'sword', 'pinball') < sec('chop', 'sword', 'realistic'),
  ['dagger', 'greatsword'].map((i) => [X[k('chop', i, 'pinball')].blow.handSpeed, X[k('chop', i, 'pinball')].blow.dv]));

// ── determinism ──
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
check('a swing is byte-identical run to run', NAMES.every((f) => hash(A.exchange(Wp.swingTake('cleave', 'greatsword', R, f), 'hitHigh', f, R).attacker.frames.map((x) => x.pose)) === hash(X[k('cleave', 'greatsword', f)].attacker.frames.map((x) => x.pose))));

// ── what the gate measures but does not judge ──
note('hero-swing reports the strike at one phase and its clip player plays the strike key at another (the game\'s hit window is set from the first)', Wp.swingPhases());
note('the tip\'s speed into contact on the body\'s clock (m/s): a chop at each class, a thrust, a cleave', SWINGS.map(([w, i]) => `${w}/${i} ${X[k(w, i, 'realistic')].blow.handSpeed}`));

console.log(`\n${fails ? `${fails} FAILED` : 'all held'} (machine gate; the eyes gate is open: run weapon-preview.mjs and look)`);
process.exitCode = fails ? 1 : 0;
