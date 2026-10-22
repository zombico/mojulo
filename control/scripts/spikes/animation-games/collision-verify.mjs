// animation-games collision verify: walking and running into a wall and into another body, in every flavor; PASS/FAIL
// per concept, and the notes the gate measures but does not judge. The machine gate only.
//   node scripts/spikes/animation-games/collision-verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const Cm = await import('./collision.mjs');

const cast = process.argv[2] ?? 'male';
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const NAMES = Object.keys(Cm.COLLIDE_FLAVORS), CASES = [['walk', 'wall'], ['walk', 'unit'], ['run', 'wall'], ['run', 'unit']];
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (s, m) => console.log(`note  ${s}  ${JSON.stringify(m)}`);
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

const C = {}, S = {};
for (const f of NAMES) for (const [g, t] of CASES) { const k = `${f} ${g}→${t}`; C[k] = Cm.collide(R, { flavor: f, gait: g, target: t }); S[k] = Cm.collisionSignature(R, C[k]); }
const row = (x) => (x ? `${x.state}: Δv ${x.dv} (shown ${x.shown}), leaves ${x.vOut} m/s, moved ${x.moved} m${x.thrown > 0.01 ? `, up ${x.thrown} m` : ''}${x.lying ? ', lying' : ''}${x.turns ? `, ${x.turns} turns` : ''}` : '');
console.log(`\nwalk ${S['realistic walk→wall'].vIn} m/s and run ${S['realistic run→wall'].vIn} m/s (the gaits' own speeds), into a wall or a standing body of the same mass`);
console.table(Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { freeze: s.hitstop, incoming: row(s.a), other: row(s.b) }])));
console.log();
const s = (f, g, t) => S[`${f} ${g}→${t}`];

// ── the promise ──
check('no trunk passes the wall or the other body\'s trunk, in any flavor, walking or running (≤ 1 mm)', Object.values(S).every((x) => x.trunkPen <= 0.001), Object.fromEntries(Object.entries(S).map(([k, x]) => [k, x.trunkPen])));

// ── realistic: momentum ──
check('realistic: two equal bodies share the momentum (the speeds after sum to the speed before) and a wall gives back a tenth', ['walk', 'run'].every((g) => near(s('realistic', g, 'unit').a.vOut + s('realistic', g, 'unit').b.vOut, s('realistic', g, 'unit').vIn) && near(s('realistic', g, 'wall').a.vOut, -0.1 * s('realistic', g, 'wall').vIn)),
  ['walk', 'run'].map((g) => ({ g, in: s('realistic', g, 'unit').vIn, out: [s('realistic', g, 'unit').a.vOut, s('realistic', g, 'unit').b.vOut], wall: s('realistic', g, 'wall').a.vOut })));
check('realistic: the change picks the rung — a walk flinches, a run into a wall puts the runner down, a run into a body staggers both', s('realistic', 'walk', 'wall').a.state === 'bump' && s('realistic', 'walk', 'unit').a.state === 'bump' && s('realistic', 'walk', 'unit').b.state === 'bump' && s('realistic', 'run', 'wall').a.state === 'down' && s('realistic', 'run', 'wall').a.lying && s('realistic', 'run', 'unit').a.state === 'stagger' && s('realistic', 'run', 'unit').b.state === 'stagger',
  CASES.map(([g, t]) => `${g}→${t}: ${s('realistic', g, t).a.state}${s('realistic', g, t).b ? ` / ${s('realistic', g, t).b.state}` : ''}`));

// ── action ──
check('action: a walk into anything is a block (it stops, nothing plays, nothing freezes)', ['wall', 'unit'].every((t) => s('action', 'walk', t).a.state === 'block' && s('action', 'walk', t).a.moved === 0 && s('action', 'walk', t).hitstop === 0 && (!s('action', 'walk', t).b || s('action', 'walk', t).b.moved === 0)));
check('action: the wall throws a runner off its feet, the change shown ×3', s('action', 'run', 'wall').a.state === 'launch' && s('action', 'run', 'wall').a.thrown > 0.05 && s('action', 'run', 'wall').a.lying && near(s('action', 'run', 'wall').a.shown, 3 * s('action', 'run', 'wall').a.dv),
  { thrown: s('action', 'run', 'wall').a.thrown, moved: s('action', 'run', 'wall').a.moved, shown: s('action', 'run', 'wall').a.shown });
check('action: a charge — the runner takes its own change and keeps its feet, the one it hits is launched and lands lying', !s('action', 'run', 'unit').a.lying && s('action', 'run', 'unit').a.shown === s('action', 'run', 'unit').a.dv && s('action', 'run', 'unit').b.state === 'launch' && s('action', 'run', 'unit').b.lying && s('action', 'run', 'unit').b.moved > 3,
  { charger: s('action', 'run', 'unit').a.state, other: [s('action', 'run', 'unit').b.state, s('action', 'run', 'unit').b.moved] });
const both = (k) => { const c = C[k]; const held = c.frames.filter((f) => f.held); return held.length && held.every((f) => f.b === null || JSON.stringify(f.b) === JSON.stringify(c.frames[c.contact].b)) && held.every((f) => JSON.stringify(f.a) === JSON.stringify(c.frames[c.contact].a)); };
check('action: both bodies hold still through the freeze, and a harder impact freezes longer', both('action run→unit') && both('action run→wall') && s('action', 'run', 'wall').hitstop > s('action', 'run', 'unit').hitstop, { wall: s('action', 'run', 'wall').hitstop, unit: s('action', 'run', 'unit').hitstop });

// ── platformer ──
check('platformer: a walk is a block; a run bonks off a wall with the fixed hop, whatever its speed', s('platformer', 'walk', 'wall').a.state === 'block' && s('platformer', 'run', 'wall').a.state === 'bonk' && near(s('platformer', 'run', 'wall').a.thrown, 0.5, 0.01) && [3, 5.3, 9].every((v) => Cm.outcome('platformer', v, 'wall').a.vOut === -3 && Cm.outcome('platformer', v, 'wall').a.hop === 0.5),
  { thrown: s('platformer', 'run', 'wall').a.thrown, vOut: [3, 5.3, 9].map((v) => Cm.outcome('platformer', v, 'wall').a.vOut) });
check('platformer: a boop throws both bodies apart evenly', s('platformer', 'run', 'unit').a.state === 'boop' && near(s('platformer', 'run', 'unit').a.moved, -s('platformer', 'run', 'unit').b.moved, 0.01) && near(s('platformer', 'run', 'unit').a.thrown, s('platformer', 'run', 'unit').b.thrown, 0.01),
  { moved: [s('platformer', 'run', 'unit').a.moved, s('platformer', 'run', 'unit').b.moved] });
const sq = C['platformer run→wall'].frames.find((x) => x.part === 'contact').scale;
check('platformer: squashed flat along the travel on contact (≤ 0.8 deep), the volume kept; realistic never squashes', sq && sq[1] <= 0.8 && near(sq[0] * sq[1] * sq[2], 1, 2e-3) && C['realistic run→wall'].frames.every((x) => !x.scale), { scale: sq });

// ── pinball ──
check('pinball: every wall is a bumper — the body leaves 1.3× as fast as it came, walking or running', ['walk', 'run'].every((g) => near(-s('pinball', g, 'wall').a.vOut, 1.3 * s('pinball', g, 'wall').vIn)), ['walk', 'run'].map((g) => [s('pinball', g, 'wall').vIn, s('pinball', g, 'wall').a.vOut]));
check('pinball: off a wall at speed it balls up and spins whole turns as it rolls back', s('pinball', 'run', 'wall').a.state === 'spin' && s('pinball', 'run', 'wall').a.turns >= 1 && s('pinball', 'run', 'wall').a.moved < -2, { turns: s('pinball', 'run', 'wall').a.turns, moved: s('pinball', 'run', 'wall').a.moved });
check('pinball: two bodies are a Newton\'s cradle — the runner all but stops, the other leaves faster than the runner came', Math.abs(s('pinball', 'run', 'unit').a.vOut) < 0.2 * s('pinball', 'run', 'unit').vIn && s('pinball', 'run', 'unit').b.vOut > s('pinball', 'run', 'unit').vIn && s('pinball', 'run', 'unit').b.state === 'spin',
  { runner: s('pinball', 'run', 'unit').a.vOut, other: s('pinball', 'run', 'unit').b.vOut, in: s('pinball', 'run', 'unit').vIn });

// ── the four are four, determinism ──
check('the same run into a wall plays four ways (rung and speed after differ pairwise)', NAMES.every((a, i) => NAMES.slice(i + 1).every((b) => s(a, 'run', 'wall').a.state !== s(b, 'run', 'wall').a.state || s(a, 'run', 'wall').a.vOut !== s(b, 'run', 'wall').a.vOut)), NAMES.map((f) => `${f}: ${s(f, 'run', 'wall').a.state} ${s(f, 'run', 'wall').a.vOut}`));
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
check('a collision is byte-identical run to run', NAMES.every((f) => hash(Cm.collide(R, { flavor: f, gait: 'run', target: 'unit' })) === hash(C[`${f} run→unit`])));

// ── what the gate measures but does not judge ──
note('the forward hand passes the surface (m): the trunk stops on it, but no clip braces a hand against it', Object.fromEntries(NAMES.map((f) => [f, [s(f, 'walk', 'wall').handPen, s(f, 'run', 'wall').handPen]])));
note('the hero walk\'s own speed is a stroll (m/s): every walk here is gentle', s('realistic', 'walk', 'wall').vIn);

console.log(`\n${fails ? `${fails} FAILED` : 'all held'} (machine gate; the eyes gate is open: run collision-preview.mjs and look)`);
process.exitCode = fails ? 1 : 0;
