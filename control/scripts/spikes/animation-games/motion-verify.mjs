// animation-games motion verify: a run-up from a jog, the running jump, the landing and a run-out, in every flavor;
// PASS/FAIL per concept, and the notes the gate measures but does not judge. The machine gate only.
//   node scripts/spikes/animation-games/motion-verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { register } from 'node:module';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const { validateRig } = await import('../../../lib/graph/polygonizer/station-loft-rig.js');
const { heroRecord, expandLayeredManifest } = await import('../../../lib/mcp/tools/layered.js');
const { keyedClip, JUMPS } = await import('../../../lib/graph/polygonizer/hero-jump.js');
const M = await import('./motion.mjs');

const cast = process.argv[2] ?? 'male';
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const NAMES = Object.keys(M.MOTION_FLAVORS);
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (s, m) => console.log(`note  ${s}  ${JSON.stringify(m)}`);
const by = (k) => Object.fromEntries(NAMES.map((f) => [f, S[f][k]]));

const RUN = Object.fromEntries(NAMES.map((f) => [f, M.runJump(R, f)]));
const S = Object.fromEntries(NAMES.map((f) => [f, M.motionSignature(R, RUN[f])]));
console.log(`\nrun-up from the jog (${RUN.realistic.cycle.jog} m/s; the sprint's own ${RUN.realistic.cycle.sprint} m/s, ${RUN.realistic.cycle.travel} m a stride), running jump, run-out`);
console.table(S);
console.log();

// ── the promise: the clip's feet and the flight agree, in every flavor ──
const arc = Object.fromEntries(NAMES.map((f) => { const r = RUN[f], b = r.beats, fr = r.frames; return [f, { off: fr[b.takeoff].root[2] === 0 && fr[b.takeoff + 1].root[2] > 0, land: fr[b.land].root[2] === 0 && fr[b.land - 1].root[2] > 0, air: fr.slice(b.takeoff + 1, b.land).every((x) => x.part === 'air' && x.root[2] > 0) }]; }));
check('the body leaves the floor on the take-off frame and meets it on the landing frame, airborne between, in every flavor', NAMES.every((f) => arc[f].off && arc[f].land && arc[f].air), arc);
check('on the landing frame the feet are where the clip\'s own are at its landing (± 1 cm: the absorb\'s depth and the squash)', NAMES.every((f) => Math.abs(S[f].landToes - S[f].clipLandToes) < 0.01), Object.fromEntries(NAMES.map((f) => [f, [S[f].landToes, S[f].clipLandToes]])));

// ── realistic ──
check('realistic: a planted foot holds still in the world on one gait (< 0.1 m/s)', S.realistic.skate < 0.1, { skate: S.realistic.skate });
check('realistic: speed builds over seconds (90 % of top after more than a second)', S.realistic.toTop90 > 1, { toTop90: S.realistic.toTop90 });
const own = keyedClip(JUMPS.runningJump, R, { speed: 0 }).air;
check('realistic: the flight is the clip\'s own on earth\'s gravity (its air to the frame, its height) and a landing costs speed', Math.abs(S.realistic.air - (own.land - own.takeoff)) <= 0.5 / 60 && Math.abs(S.realistic.height - own.height) < 0.001 && S.realistic.landSpeed < S.realistic.takeoffSpeed,
  { air: [S.realistic.air, +(own.land - own.takeoff).toFixed(4)], height: [S.realistic.height, own.height], speed: [S.realistic.takeoffSpeed, S.realistic.landSpeed] });

// ── action ──
check('action: top speed in under a second, a deeper gather, a jump 5× the body\'s with a hang, a landing that holds', S.action.toTop90 < 1 && S.action.gather < S.realistic.gather - 0.03 && S.action.height >= 5 * S.realistic.height && RUN.action.jump.hang > 0 && S.action.held === M.MOTION_FLAVORS.action.landHold,
  { toTop90: S.action.toTop90, gather: [S.realistic.gather, S.action.gather], height: [S.realistic.height, S.action.height], held: S.action.held });

// ── platformer ──
check('platformer: top speed at once (< 0.25 s) and the feet still hold on one gait', S.platformer.toTop90 < 0.25 && S.platformer.skate < 0.1, { toTop90: S.platformer.toTop90, skate: S.platformer.skate });
check('platformer: the platform rule\'s arc (8.5 m/s up on 20, down on 34): it falls faster than it rose', Math.abs(S.platformer.height - 8.5 ** 2 / 40) < 0.001 && S.platformer.upDown > 1.25, { height: S.platformer.height, upDown: S.platformer.upDown });
check('platformer: a quicker spring (a shorter contact before take-off than realistic), squash and stretch, no speed lost', S.platformer.contactIn < S.realistic.contactIn && S.platformer.squash >= 0.2 && S.platformer.landSpeed === S.platformer.takeoffSpeed,
  { contactIn: [S.realistic.contactIn, S.platformer.contactIn], squash: S.platformer.squash });

// ── pinball ──
check('pinball: the stride outruns the ground (its feet sweep back faster than the ground goes by), but never under four frames a stride', S.pinball.outrun > 1 && S.pinball.framesPerStride >= 4 && NAMES.filter((f) => f !== 'pinball').every((f) => Math.abs(S[f].outrun) < 0.05),
  { outrun: by('outrun'), framesPerStride: by('framesPerStride') });
check('pinball: the fastest take-off, the shortest contact, the most smears, no speed lost', NAMES.every((f) => S.pinball.takeoffSpeed >= S[f].takeoffSpeed && S.pinball.contactIn <= S[f].contactIn && S.pinball.smears >= S[f].smears) && S.pinball.landSpeed === S.pinball.takeoffSpeed,
  { takeoff: by('takeoffSpeed'), contactIn: by('contactIn'), smears: by('smears') });

// ── the four are four, and determinism ──
check('the same run and jump plays four ways (take-off speed, height, air and contact differ pairwise)', NAMES.every((a, i) => NAMES.slice(i + 1).every((b) => ['takeoffSpeed', 'height', 'air', 'contactIn'].some((k) => S[a][k] !== S[b][k]))));
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
check('a run is byte-identical run to run', NAMES.every((f) => hash(M.runJump(R, f)) === hash(RUN[f])), Object.fromEntries(NAMES.map((f) => [f, hash(RUN[f])])));

// ── what the gate measures but does not judge ──
note('the jog → sprint blend slides a planted foot, worse the faster speed builds (m/s, over the frames the blend takes)', Object.fromEntries(NAMES.map((f) => [f, [S[f].blendSkate, S[f].blendFrames]])));
note('jump length on the ground (m): the flavor\'s air times its take-off speed', by('length'));

console.log(`\n${fails ? `${fails} FAILED` : 'all held'} (machine gate; the eyes gate is open: run motion-preview.mjs and look)`);
process.exitCode = fails ? 1 : 0;
