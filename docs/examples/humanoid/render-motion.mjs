/** render-motion.mjs — the MOTION CARD: a hero's clips played on its own rig, for the motion loop (MOTION.md). A hero spec
 * (the cast files' shape: { name, hero, … }) is taken through the hero door's steps without a database (heroRecord →
 * heroPlanOf → expandLayeredManifest → planLayered, the rig gates included), then every clip asked for is posed frame by
 * frame on the skinned mesh (rigNodesAt → poseLayered: what the rig pack bakes, not a preview) and drawn by a flat
 * z-buffer raster in the palette's own colours. Per clip it writes:
 *   <clip>.gif         the stick figure from the side (the rig's joints, left blue, right orange, on a ground line whose
 *                      ticks slide at the clip's own ground speed), the skinned figure from the side, at the three-quarter
 *                      and at the REAR three-quarter 20° down (the gameplay camera), and under them the FOOT TRACE: each
 *                      foot's height and its slide speed over the cycle, a cursor at the frame
 *   <clip>-strip.png   eight phases of the same four views, for a still review
 *   motion.json        per clip: seconds, frames, and the measures the gates read — per foot the stance share (the toe
 *                      within 1 cm of the floor), the stance slide (the planted toe's speed in the figure's frame, m/s,
 *                      mean and spread), the stride (the toe's fore-aft travel); the implied ground speed `v` (the mean
 *                      backward stance slide: the speed the root must move for a planted foot to stay put; 0 for a clip
 *                      that walks in place); the pelvis bob; the wrists' fore-aft swing
 * Clips: the hero's own and its door clips by name (--clips walk,idle; default every clip but the stand) — the door's
 * `motion` gaits baked as the pack bakes them, replacing the hero's own of their names — and MOTION SPECS
 * on the hero's core (--motion <name>='<json>', repeatable): any vajra motion spec resolveMotion takes ('walk',
 * { walk: { strideLength, … } }, { sprint: {…} }, { keyframes: […] }, `perform`), resolved on THIS body's joints and
 * posed through the rig. --plant says how a motion spec's footfalls reach the rig's planted legs: `feet` (the default) is
 * the locomotion bake (hero-motion.js: each toe on the gait's own path, planted on the floor, the root sunk to reach);
 * the two earlier ways are kept for comparison: `gait` passes the
 * gait's own support word (a double-support 'both' pins both feet at rest), `stance` plants only the foot the gait bears
 * on (the other leg swings free on the core's own pose). A prototype of the bridge: nothing here is a recipe change.
 * Deterministic. Run from control:
 *   node ../docs/examples/humanoid/render-motion.mjs --spec ../docs/examples/humanoid/cast/lead.json \
 *     [--clips walk,idle] [--motion jog='{"sprint":{"dutyFactor":0.45}}'] [--plant gait|stance] [--seconds jog=0.7]
 *     [--jumps jump,jumpForward,jumpBack,doubleJump] [--stances guard,fencingLeft] [--strikes jab,thrust] [--guards chudan,hassoLeft]
 *     [--carry carbineAim,boxFront:18,greatswordSide~] [--rest chairUpright,lotus,yamcha] [--rise chairUpright,lotusDown]
 *     [--vaults hurdle:0.4:0.1:sprint,kongVaultLeft:0.8:0.9] [--auras crossedArms,jotaroPointLeft]
 *     [--views front,side,top,q34,rear]
 *     [--frames 24] [--cell 220] [--out <dir>]   (default out: $MOJULO_SPIKE_OUT or the scratch folder below, /<name>/)
 */
import { register, createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

register('../../../control/scripts/mcp-stdio-loader.mjs', import.meta.url);
const lib = (p) => import(new URL(`../../../control/lib/${p}`, import.meta.url).href);
const sharp = createRequire(new URL('../../../control/package.json', import.meta.url))('sharp');
const { HERO_FIELDS, heroRecord, heroPlanOf, planLayered, expandLayeredManifest } = await lib('mcp/tools/layered.js');
const { validateRig, bindLayered, layeredClip, rigNodesAt, boneFrames, VAJRA_CORE } = await lib('graph/polygonizer/station-loft-rig.js');
const { poseLayered, heroClipSeconds, GESTURE_CLIP } = await lib('graph/polygonizer/hero-gesture.js');
const { resolveMotion } = await lib('graph/polygonizer/figure-posing.js');
const { heroLocomotion, locomotionClips } = await lib('graph/polygonizer/hero-motion.js');
const { heroJump, JUMP_NAMES } = await lib('graph/polygonizer/hero-jump.js');
const { heroStance, STANCE_NAMES } = await lib('graph/polygonizer/hero-stance.js');
const { heroStrike, STRIKE_NAMES } = await lib('graph/polygonizer/hero-strike.js');
const { heroGuard, GUARD_NAMES } = await lib('graph/polygonizer/hero-grip.js');
const { gearFaces } = await lib('graph/polygonizer/hero-gear.js');
const { heroHold, HOLD_NAMES, carryTriangles, carryMounts } = await lib('graph/polygonizer/hero-carry.js');
const { heroRest, REST_NAMES, restTriangles } = await lib('graph/polygonizer/hero-rest.js');
const { heroRise } = await lib('graph/polygonizer/hero-rise.js');
const { heroVault, VAULT_NAMES } = await lib('graph/polygonizer/hero-vault.js');
const { heroAura, AURA_NAMES, auraBody } = await lib('graph/polygonizer/hero-aura.js');
const { WORKBENCH_LIGHT } = await lib('graph/worlds/workbench.js');
const { flowRig, simulateClip, rigidityOf } = await lib('graph/polygonizer/hero-flow.js');
const { windField, resolveTerrainWind } = await lib('graph/vegetation/wind.js');

// ─── arguments ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const argsOf = (k) => argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : []));
const SPEC = argOf('--spec'); if (!SPEC) throw new Error('render-motion: --spec <hero spec .json> (the cast files\' shape)');
const FRAMES = Number(argOf('--frames') ?? 24), CELL = Number(argOf('--cell') ?? 220), PLANT = argOf('--plant') ?? 'feet';
if (!['feet', 'gait', 'stance'].includes(PLANT)) throw new Error(`--plant: feet, gait or stance (got ${PLANT})`);
const MOTIONS = argsOf('--motion').map((s) => { const i = s.indexOf('='); if (i < 1) throw new Error(`--motion ${s}: <name>=<json motion spec>`); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; });
const JUMPS_ASKED = (argOf('--jumps') ?? '').split(',').filter(Boolean);
// --stances guard,fencingLeft,…: ready stances (hero-stance.js), each its enter clip from the stand to the held pose
const STANCES_ASKED = (argOf('--stances') ?? '').split(',').filter(Boolean);
// --strikes jab,crossLeft,thrust,…: straight strikes (hero-strike.js) out of their stances and back
const STRIKES_ASKED = (argOf('--strikes') ?? '').split(',').filter(Boolean);
// --guards chudan,hassoLeft,…: sword guards (hero-grip.js), each its stance's enter with the hands closing on the grip,
// the sword (and a shield) drawn in the hand as it carries it
const GUARDS_ASKED = (argOf('--guards') ?? '').split(',').filter(Boolean);
// --carry pistolIsosceles,boxFront,…: carrying holds (hero-carry.js), the held pose with the thing in hand (`name:kg`
// sets its mass; `name~` the weightless regime)
const CARRY_ASKED = (argOf('--carry') ?? '').split(',').filter(Boolean);
// --rest chairUpright,lotus,yamcha,…: rest poses (hero-rest.js), the held pose with its seat drawn
const REST_ASKED = (argOf('--rest') ?? '').split(',').filter(Boolean);
// --rise chairUpright,lotusDown,…: getting up out of a rest pose (hero-rise.js), or with `Down` sitting / lying into it
const RISE_ASKED = (argOf('--rise') ?? '').split(',').filter(Boolean);
// --vaults hurdle:0.4:0.1:sprint,…: clearing a box out of the run (hero-vault.js), `name:h:d[:gait]` (metres: the box's
// height and depth), the box drawn passing under the figure as the engine carries it on
const VAULTS_ASKED = (argOf('--vaults') ?? '').split(',').filter(Boolean);
// --auras crossedArms,jotaroPointLeft,…: showcase poses (hero-aura.js), each its performance from the stand to the hit
const AURAS_ASKED = (argOf('--auras') ?? '').split(',').filter(Boolean);
const SECONDS = Object.fromEntries(argsOf('--seconds').map((s) => { const [k, v] = s.split('='); return [k, Number(v)]; }));
// --hair: the hair on its control strings (hero-flow.js), against the body and outfit as one collision form;
// --wind speed[,dir[,gust]]: the world's wind (vegetation/wind.js), m/s, dir in degrees the wind blows TOWARD (0 the
// figure's front, 90 its right), gust 0 … 1 (default 0.5)
// --flow <part>=<rigidity> (repeatable): a garment part made to flow (a word: stiff | crisp | soft | flowing, or 0 … 1)
const FLOWS = Object.fromEntries(argsOf('--flow').map((s) => { const [k, v] = s.split('='); const r = Number.isFinite(Number(v)) ? Number(v) : v; if (rigidityOf(r) === null) throw new Error(`--flow ${s}: <part>=<rigidity>`); return [k, { rigidity: r }]; }));
const HAIR = argv.includes('--hair') || argv.includes('--wind') || Object.keys(FLOWS).length > 0;
const WIND = argOf('--wind') ? (() => { const [sp, dir = 0, gust = 0.5] = argOf('--wind').split(',').map(Number); return { speed: sp, dir: ((90 - dir) * Math.PI) / 180, gust }; })() : null;

// ─── the hero through the door ─────────────────────────────────────────────
const spec = JSON.parse(readFileSync(resolve(SPEC), 'utf8'));
const NAME = spec.name ?? 'hero';
const OUT = resolve(argOf('--out') ?? join(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/1008/spike-output/motion', import.meta.url)), NAME));
mkdirSync(OUT, { recursive: true });
const heroIn = { ...spec.hero, ...(spec.palette ? { palette: { ...(spec.hero?.palette || {}), ...spec.palette } } : {}) };
const hero = heroRecord(Object.fromEntries(HERO_FIELDS.filter((k) => heroIn[k] !== undefined).map((k) => [k, heroIn[k]])));
const plan = heroPlanOf(hero);
const ex = expandLayeredManifest({ kind: 'layered', title: NAME, hero });
const manifest = { kind: 'layered', title: NAME, recipe: ex.recipe, plan, hero, dials: ex.dials, units: 'm' };
const { mesh } = planLayered(manifest);
const recipe = manifest.recipe; const HR = HAIR ? flowRig(mesh, recipe, { pieces: FLOWS }) : null;
const R = HR ? HR.R : validateRig(recipe.rig); const skin = HR ? HR.skin : bindLayered(mesh, recipe, R);
let auraBodyMemo = null; const AURA_BODY = () => auraBodyMemo || (auraBodyMemo = auraBody(R, mesh, skin));
const FIELD = WIND ? windField({ ...resolveTerrainWind(WIND), z0: 0.03 }) : null;
const core = Object.fromEntries(VAJRA_CORE.map((k) => [k, { x: R.joints[k][0], y: R.joints[k][1], z: R.joints[k][2] }]));
const ownSeconds = heroClipSeconds(hero, recipe.clips) || {};

// the clips: own/door clips by name, then the motion specs on this body
// the door's motion (hero.motion), baked as the pack bakes it: its gaits replace the hero's own clips of their names
const LOCO = recipe.locomotion ? locomotionClips(recipe.locomotion, R, { keys: FRAMES }) : null;
const own = [...new Set([...Object.keys(recipe.clips || {}), ...Object.keys(LOCO?.clips || {})])].filter((k) => k !== GESTURE_CLIP);
const asked = argOf('--clips') ? argOf('--clips').split(',').filter(Boolean) : (MOTIONS.length || JUMPS_ASKED.length || STANCES_ASKED.length || STRIKES_ASKED.length || GUARDS_ASKED.length || CARRY_ASKED.length || REST_ASKED.length || RISE_ASKED.length || VAULTS_ASKED.length || AURAS_ASKED.length ? [] : own);
for (const c of asked) if (!recipe.clips?.[c] && !LOCO?.clips[c]) throw new Error(`--clips: the hero has no clip '${c}' (has ${own.join(', ')})`);
const bridge = (dof) => {
  if (PLANT === 'gait' || !dof?.plant) return dof;
  const { L = 1, R: Rt = 1 } = dof.plant;
  return { ...dof, support: L >= 0.5 && Rt >= 0.5 ? 'both' : L >= Rt ? 'L' : 'R' };
};
const CLIPS = [
  ...asked.map((c) => (LOCO?.clips[c]
    ? { name: c, src: `hero.motion.${c} · v ${LOCO.speeds[c]} m/s`, fn: LOCO.clips[c], seconds: SECONDS[c] ?? LOCO.seconds[c], once: !!LOCO.clips[c].once, air: LOCO.clips[c].air, speed: LOCO.speeds[c] ?? LOCO.clips[c].air?.speed ?? 0, roll: LOCO.clips[c].roll, before: LOCO.clips[c].stop ? LOCO.speeds[LOCO.clips[c].stop.from] ?? 0 : 0 }
    : { name: c, src: 'clip', fn: layeredClip(recipe.clips[c], R), seconds: SECONDS[c] ?? ownSeconds[c] ?? 1 })),
  ...MOTIONS.map(([n, m]) => {
    if (PLANT === 'feet') { const loco = heroLocomotion(m, R, { frames: FRAMES }); const s = SECONDS[n] ?? 1; return { name: n, src: `motion ${JSON.stringify(m)} · feet · travel ${loco.travel.toFixed(3)} m/cycle`, fn: loco.fn, seconds: s }; }
    const f = resolveMotion(m, { frames: FRAMES, base: core }); if (!f) throw new Error(`--motion ${n}: not a motion spec resolveMotion takes`); return { name: n, src: `motion ${JSON.stringify(m)} · plant ${PLANT}`, fn: (ph) => bridge(f(ph)), seconds: SECONDS[n] ?? 1 }; }),
  ...JUMPS_ASKED.map((n) => { if (!JUMP_NAMES.includes(n)) throw new Error(`--jumps: no jump '${n}' (have ${JUMP_NAMES.join(', ')})`); const J = heroJump(n, R, { seconds: SECONDS[n] }); return { name: n, src: `jump · in place · air ${J.air ? `${J.air.takeoff}–${J.air.land} s, ${(J.air.height * 100).toFixed(0)} cm${J.air.kick !== undefined ? `, kick at ${J.air.kick} s (${(J.air.kickHeight * 100).toFixed(0)} cm) → ${(J.air.apexHeight * 100).toFixed(0)} cm` : ''}` : 'none'} (the card draws the arc)${J.roll ? ` · roll ${J.roll.axis} ${J.roll.start}–${J.roll.end} s, ${J.roll.travel} m at ${J.roll.speed} m/s` : ''}`, fn: J.fn, seconds: J.seconds, once: true, air: J.air, speed: J.air?.speed ?? 0, roll: J.roll }; }),
  ...STRIKES_ASKED.map((n) => { if (!STRIKE_NAMES.includes(n)) throw new Error(`--strikes: no strike '${n}' (have ${STRIKE_NAMES.join(', ')})`); const K = heroStrike(n, R, { seconds: SECONDS[n] }); const c = K.checks; return { name: n, src: `strike from ${K.from} · ${K.hand} hand · contact ${K.contact.t}s, off ${(c.contact * 100).toFixed(1)} cm · path ±${(c.straight * 100).toFixed(1)} cm · peaks hips ${c.order.hips} chest ${c.order.chest} hand ${c.order.hand}${c.order.ordered ? '' : ' (OUT OF ORDER)'} · balance ${(c.balance * 100).toFixed(1)} cm · elbow ${c.elbow}°`, fn: K.clip.fn, seconds: K.seconds, once: true }; }),
  ...GUARDS_ASKED.map((n) => { if (!GUARD_NAMES.includes(n)) throw new Error(`--guards: no guard '${n}' (have ${GUARD_NAMES.join(', ')})`); const K = heroGuard(n, R, { seconds: SECONDS[n] }); const c = K.checks; const hands = Object.entries(c.hands).map(([s, h]) => `${s} wrist ${h.wrist.flex}/${h.wrist.deviation}/${h.wrist.twist}°${h.stray ? ` (+${h.stray}° past ease)` : ''}`).join(' · '); const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); return { name: n, src: `guard · ${K.regime} · ${K.tradition} · ${K.stance} · ${K.grip} grip · ${hands} · point ${c.point}° · edge ${c.edge}° · clear ${(c.clearance * 100).toFixed(1)} cm · lever ${c.lever} · balance ${(c.balance * 100).toFixed(1)} cm${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: K.clip.fn, seconds: K.clip.seconds ?? SECONDS[n] ?? 0.9, once: true, gear: K.mounts }; }),
  ...CARRY_ASKED.map((spec) => { const m = /^(\w+)(?::([\d.]+))?(~)?$/.exec(spec); if (!m || !HOLD_NAMES.includes(m[1])) throw new Error(`--carry: no hold '${spec}' (have ${HOLD_NAMES.join(', ')})`); const K = heroHold(m[1], R, { ...(m[2] ? { kg: Number(m[2]) } : {}), regime: m[3] ? 'weightless' : 'skilled' }); const c = K.checks, e = K.effort, a = K.answer; const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); const hands = Object.entries(c.hands).map(([s, h]) => `${s} wrist ${h.wrist.flex}/${h.wrist.deviation}/${h.wrist.twist}°`).join(' · '); return { name: spec.replace(/[:~]/g, '_'), src: `carry · ${K.mode} · ${K.item} ${K.kg} kg · ${K.regime} · effort CR10 ${e.cr10} (${e.word}, ${e.limit} ${Math.round(e.mvc * 100)}% MVC${Number.isFinite(e.endurance) ? `, ${e.endurance} min` : ''}) · lean ${a.lean} side ${a.sideLean} sway ${(a.sway[1] * 100).toFixed(1)} cm${a.ease ? ` · held in ${a.ease.from}→${a.ease.to} m` : ''} · ${hands}${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: () => K.pose, seconds: 0.5, once: true, carry: K, gear: carryMounts(K, R) }; }),
  ...REST_ASKED.map((n) => { if (!REST_NAMES.includes(n)) throw new Error(`--rest: no rest pose '${n}' (have ${REST_NAMES.join(', ')})`); const K = heroRest(n, R), c = K.checks; const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); return { name: n, src: `rest · ${K.family}${K.seat ? ` · ${K.seat.kind}` : ''} · knees ${c.knees.R}/${c.knees.L}° · hips ${c.hips.R}/${c.hips.L}° · floor ${(c.floor * 100).toFixed(1)} cm (${c.floorAt})${c.balance !== null ? ` · balance ${(c.balance * 100).toFixed(1)} cm` : ''} · ${K.effort ? `effort CR10 ${K.effort.cr10} (${K.effort.limit}${K.effort.supported ? `, ${K.effort.supported} supported` : ''})` : 'the floor holds it'}${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: () => K.pose, seconds: 0.5, once: true, rest: K }; }),
  ...RISE_ASKED.map((spec) => { const down = /Down$/.test(spec), n = down ? spec.slice(0, -4) : spec; if (!REST_NAMES.includes(n)) throw new Error(`--rise: no rest pose '${n}' (have ${REST_NAMES.join(', ')})`); const K = heroRise(n, R, { down, seconds: SECONDS[spec] }), c = K.checks; const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); return { name: K.name, src: `${down ? 'down into' : 'up from'} ${n} · ${K.beats.states.map((x) => `${x.name} ${x.t}`).join(' → ')} s${K.lean !== null ? ` · lean ${K.lean}°` : ''} · balance ${(c.balance * 100).toFixed(1)} cm · floor ${(c.floor * 100).toFixed(1)} cm · knees ${c.knees}° hips ${c.hips}° · fastest ${c.speed} m/s${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: K.fn, seconds: K.seconds, once: true, rest: { props: K.props } }; }),
  ...VAULTS_ASKED.map((spec) => { const [n, h, d = '0.3', from] = spec.split(':'); if (!VAULT_NAMES.includes(n)) throw new Error(`--vaults: no move '${n}' (have ${VAULT_NAMES.join(', ')})`); const K = heroVault(n, R, { h: Number(h), d: Number(d), ...(from ? { from } : {}), seconds: SECONDS[n] }), c = K.checks; const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); return { name: `${n}_${h}x${d}`, src: `${K.move} out of the ${K.from} · ${K.foot} off ${K.entry.takeoff} m before, ${K.landing} lands ${K.exit.landing} m past · ${K.beats.map((x) => `${x.name} ${x.t}`).join(' → ')} s · up ${c.takeoff} m/s · clear ${(-c.clear * 100).toFixed(1)} cm (${c.clearAt}) · knees ${c.knees}° hips ${c.hips}°${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: K.fn, seconds: K.seconds, once: true, rest: { props: K.props }, propsAt: (t) => K.props.map((b) => { const y = K.root.y(t); return { ...b, lo: [b.lo[0], b.lo[1] - y, b.lo[2]], hi: [b.hi[0], b.hi[1] - y, b.hi[2]] }; }) }; }),
  ...AURAS_ASKED.map((n) => { if (!AURA_NAMES.includes(n)) throw new Error(`--auras: no pose '${n}' (have ${AURA_NAMES.join(', ')})`); const K = heroAura(n, R, { body: AURA_BODY(), seconds: SECONDS[n] }), c = K.checks; const fails = Object.entries(c.laws).filter(([, v]) => !v).map(([k]) => k); return { name: n, src: `${K.family} · ${K.beats.map((x) => `${x.name} ${x.t}`).join(' → ')} s · balance ${(c.balance * 100).toFixed(1)} cm · hands ${Object.entries(c.hands).map(([s, d]) => `${s} ${(d * 100).toFixed(1)}`).join('/')} cm · clear ${(c.clear * 100).toFixed(1)} cm (${c.clearAt}) · gaze ${c.gaze}° · fastest ${c.speed} m/s${fails.length ? ` · FAILS ${fails.join(', ')}` : ' · laws hold'}`, fn: K.clip.fn, seconds: K.seconds, once: true }; }),
  ...STANCES_ASKED.map((n) => { if (!STANCE_NAMES.includes(n)) throw new Error(`--stances: no stance '${n}' (have ${STANCE_NAMES.join(', ')})`); const S = heroStance(n, R, { seconds: SECONDS[n] }); const c = S.checks; return { name: n, src: `stance · ${S.family}${S.lead ? ` · lead ${S.lead}` : ''} · facing ${S.facing}° · com ${(c.com.margin * 100).toFixed(1)} cm in, weight ${c.com.weight} · knees ${c.knees.L}/${c.knees.R}° · turnout ${c.turnout.L}/${c.turnout.R}° · gaze ${c.gaze}° · serves ${S.serves.join(', ')}`, fn: S.clip.fn, seconds: S.clip.seconds, once: true, checks: c }; }),
];

// ─── a small vector kit and the raster ─────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rad = (d) => (d * Math.PI) / 180;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** a baked face fill ('#rrggbb' or 'rgb(r, g, b)') as 0–255 */
const fillRgb = (f) => { if (typeof f === 'string' && f[0] === '#') return hexRgb(f); const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(f || ''); return m ? [+m[1], +m[2], +m[3]].map(Math.round) : [120, 120, 125]; };
/** an orthographic camera at azimuth `az` (0 = in front of the figure, which faces +y; 90 = its right side) and
 * elevation `el`: screen right, screen up, and the depth axis toward the camera */
const camera = (az, el) => { const d = [Math.sin(rad(az)) * Math.cos(rad(el)), Math.cos(rad(az)) * Math.cos(rad(el)), Math.sin(rad(el))]; const r = unit(cross([0, 0, 1], d)); return { d, r, u: cross(d, r) }; };
// --views front,side,top,q34,rear (default side,q34,rear): the cells after the stick figure
const VIEW_SET = { front: { id: 'front', label: 'front', cam: camera(0, 0) }, side: { id: 'side', label: 'side', cam: camera(90, 0) }, top: { id: 'top', label: 'top (target up)', cam: camera(180, 89) }, q34: { id: 'q34', label: '¾', cam: camera(35, 8) }, rear: { id: 'rear', label: 'rear ¾ 20° down (gameplay)', cam: camera(150, 20) } };
const VIEWS = (argOf('--views') ?? 'side,q34,rear').split(',').map((v) => { if (!VIEW_SET[v]) throw new Error(`--views: ${Object.keys(VIEW_SET).join(', ')} (got ${v})`); return VIEW_SET[v]; });
const PAL = recipe.palette || {}; const GREY = [138, 143, 150];
const faceRgb = mesh.faces.map((_, fi) => (PAL[mesh.groups?.[fi]] ? hexRgb(PAL[mesh.groups[fi]]) : GREY));
const LIGHT = unit([0.35, 0.55, 0.75]);
const BG = [233, 230, 223];

/** the figure's frame over the whole clip in one view (so the cell does not jump): [x0, x1, y0, y1] on screen */
function boundsOf(frames, cam) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const V of frames) for (const p of V) { const x = dot(p, cam.r), y = dot(p, cam.u); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, x1, y0, y1];
}
/** one view of posed vertices into an RGB buffer W × H (2× supersampled, then box-filtered by the caller) */
function raster(V, cam, box, W, H, extra = []) {
  const [x0, x1, y0, y1] = box; const pad = 0.06 * Math.max(x1 - x0, y1 - y0);
  const s = Math.min((W - 2) / (x1 - x0 + 2 * pad), (H - 2) / (y1 - y0 + 2 * pad));
  const ox = W / 2 - s * (x0 + x1) / 2, oy = H / 2 + s * (y0 + y1) / 2;
  const P = V.map((p) => [ox + s * dot(p, cam.r), oy - s * dot(p, cam.u), dot(p, cam.d)]);
  const rgb = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) { rgb[3 * i] = BG[0]; rgb[3 * i + 1] = BG[1]; rgb[3 * i + 2] = BG[2]; }
  const z = new Float64Array(W * H).fill(-Infinity);
  const proj = (p) => [ox + s * dot(p, cam.r), oy - s * dot(p, cam.u), dot(p, cam.d)];
  // the mesh's triangles (shaded here), then any held gear's (in their baked fill)
  const tris = [...mesh.faces.map((f, fi) => ({ q: f.map((i) => P[i]), w: f.map((i) => V[i]), rgb: faceRgb[fi], shade: true })), ...extra.map((t) => ({ q: t.p.map(proj), w: t.p, rgb: t.rgb, shade: false }))];
  tris.forEach((T) => {
    const [a, b, c] = T.q; const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(area) < 1e-9) return;
    const n = unit(cross(sub(T.w[1], T.w[0]), sub(T.w[2], T.w[0]))); const facing = dot(n, cam.d) < 0 ? -1 : 1;
    const sh = T.shade ? 0.55 + 0.45 * Math.max(0, facing * dot(n, LIGHT)) : 1; const col = T.rgb.map((v) => Math.min(255, Math.round(v * sh)));
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area, w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * a[2] + w1 * b[2] + w2 * c[2]; const k = y * W + x; if (d <= z[k]) continue;
      z[k] = d; rgb[3 * k] = col[0]; rgb[3 * k + 1] = col[1]; rgb[3 * k + 2] = col[2];
    }
  });
  // the figure's outline: a dark pixel wherever the depth breaks against the background
  const out = Buffer.from(rgb);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = y * W + x; if (z[k] === -Infinity) continue; if (z[k - 1] === -Infinity || z[k + 1] === -Infinity || z[k - W] === -Infinity || z[k + W] === -Infinity) { out[3 * k] = 30; out[3 * k + 1] = 28; out[3 * k + 2] = 26; } }
  // the floor line (z = 0) where the camera looks level; a raised camera shows the floor as a plane, not a line
  const floorY = Math.abs(cam.d[2]) < 1e-9 ? Math.round(oy) : -1; if (floorY > 0 && floorY < H) for (let x = 0; x < W; x++) { const k = floorY * W + x; if (z[k] === -Infinity) { out[3 * k] = 120; out[3 * k + 1] = 140; out[3 * k + 2] = 110; } }
  return { rgb: out, s, ox, oy };
}

// ─── the legs and the stick ────────────────────────────────────────────────
const SIDES = Object.keys(R.legs);
const STICK = [['headTop', 'headBase'], ['headBase', 'neckHub'], ['neckHub', 'navel'], ['navel', 'pelvisHub'],
  ...['L', 'R'].flatMap((S) => [['neckHub', `shoulder${S}`], [`shoulder${S}`, `elbow${S}`], [`elbow${S}`, `wrist${S}`], ['pelvisHub', `hip${S}`]]),
  ...SIDES.flatMap((S) => { const L = R.legs[S]; return [[L.hip, L.knee], [L.knee, L.hock], [L.hock, L.toeBase], [L.toeBase, L.toeTip]]; })];
const sideOf = (a, b) => (/L$/.test(a) || /L$/.test(b) ? 'L' : /R$/.test(a) || /R$/.test(b) ? 'R' : '');
const STICK_COL = { L: '#2f6fd0', R: '#e07a2a', '': '#3a3633' };
const FLOOR = Math.min(...SIDES.map((S) => Math.min(R.joints[R.legs[S].toeBase][2], R.joints[R.legs[S].toeTip][2])));

/** the stick cell (side view) as SVG: the joints from the rig, the floor whose ticks slide back at the ground speed */
function stickSvg(nodes, box, W, H, phase, travel) {
  const cam = VIEWS[0].cam; const [x0, x1, y0, y1] = box; const pad = 0.06 * Math.max(x1 - x0, y1 - y0);
  const s = Math.min((W - 2) / (x1 - x0 + 2 * pad), (H - 2) / (y1 - y0 + 2 * pad)); const ox = W / 2 - s * (x0 + x1) / 2, oy = H / 2 + s * (y0 + y1) / 2;
  const pt = (p) => [ox + s * dot(p, cam.r), oy - s * dot(p, cam.u)];
  const fy = oy - s * FLOOR; const tick = 0.1 * s; const shift = ((-(travel * phase) * s) % tick + tick) % tick;
  let g = `<line x1="0" y1="${fy}" x2="${W}" y2="${fy}" stroke="#7a8a6e" stroke-width="2"/>`;
  for (let x = shift - tick; x < W + tick; x += tick) g += `<line x1="${x.toFixed(1)}" y1="${fy}" x2="${(x - 6).toFixed(1)}" y2="${fy + 8}" stroke="#7a8a6e" stroke-width="1.5"/>`;
  const order = [...STICK].sort((a, b) => (sideOf(...a) === 'R' ? 1 : 0) - (sideOf(...b) === 'R' ? 1 : 0));   // seen from the right side, the right limbs are near: drawn last
  for (const [a, b] of order) { if (!nodes[a] || !nodes[b]) continue; const [p, q] = [pt(nodes[a]), pt(nodes[b])]; g += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="${STICK_COL[sideOf(a, b)]}" stroke-width="4" stroke-linecap="round"/>`; }
  for (const k of Object.keys(nodes)) if (VAJRA_CORE.includes(k)) { const [x, y] = pt(nodes[k]); g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#1b1a19"/>`; }
  // the hair's control strings
  for (const st of HR?.strings ?? []) g += `<polyline fill="none" stroke="${/^hair/.test(st.part) ? '#b5562a' : '#7a3fa0'}" stroke-width="2" stroke-linejoin="round" points="${st.joints.map((j) => pt(nodes[j]).map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fbfaf7"/>${g}</svg>`;
}

// ─── measure one clip ──────────────────────────────────────────────────────
function measure(frames, seconds) {
  const n = frames.length, dt = seconds / n; const feet = {};
  for (const S of SIDES) {
    const L = R.legs[S];
    const h = frames.map((f) => Math.min(f.nodes[L.toeBase][2], f.nodes[L.toeTip][2]) - FLOOR);
    const y = frames.map((f) => f.nodes[L.toeBase][1]);
    const vel = y.map((v, i) => (y[(i + 1) % n] - v) / dt);   // the step to the next frame
    const st = h.map((v) => v < 0.01); const sv = vel.filter((_, i) => st[i] && st[(i + 1) % n]);   // planted at both ends
    const mean = sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : 0;
    const spread = sv.length ? Math.sqrt(sv.reduce((a, b) => a + (b - mean) ** 2, 0) / sv.length) : 0;
    feet[S] = { stance: +(st.filter(Boolean).length / n).toFixed(3), slide: { mean: +mean.toFixed(3), spread: +spread.toFixed(3) }, stride: +(Math.max(...y) - Math.min(...y)).toFixed(3), lift: +Math.max(...h).toFixed(3), h, vel };
  }
  const v = Math.max(0, -SIDES.map((S) => feet[S].slide.mean).reduce((a, b) => a + b, 0) / SIDES.length);
  const pz = frames.map((f) => f.nodes.pelvisHub[2]); const wy = (S) => frames.map((f) => f.nodes[`wrist${S}`][1]);
  return { feet, v: +v.toFixed(3), bob: +(Math.max(...pz) - Math.min(...pz)).toFixed(3), wristSwing: Object.fromEntries(['L', 'R'].map((S) => [S, +(Math.max(...wy(S)) - Math.min(...wy(S))).toFixed(3)])) };
}

/** the foot trace (W × H SVG): each foot's height (solid) and slide speed (dashed) over the cycle, a cursor at `i` */
function traceSvg(M, i, n, W, H, title) {
  const hMax = Math.max(0.05, ...SIDES.map((S) => M.feet[S].lift)); const vMax = Math.max(0.2, ...SIDES.flatMap((S) => M.feet[S].vel.map(Math.abs)));
  const X = (k) => 40 + (k / (n - 1)) * (W - 60); const mid = H / 2 + 6;
  let g = `<rect width="100%" height="100%" fill="#f2efe8"/><text x="8" y="16" font-family="Helvetica, Arial" font-size="12" font-weight="700" fill="#23201d">${title}</text>`;
  g += `<line x1="40" y1="${mid}" x2="${W - 20}" y2="${mid}" stroke="#bbb"/><text x="4" y="${mid + 4}" font-family="Helvetica" font-size="10" fill="#666">floor</text>`;
  for (const S of SIDES) {
    const F = M.feet[S], col = STICK_COL[S];
    g += `<polyline fill="none" stroke="${col}" stroke-width="2" points="${F.h.map((h, k) => `${X(k).toFixed(1)},${(mid - (h / hMax) * (H / 2 - 24)).toFixed(1)}`).join(' ')}"/>`;
    g += `<polyline fill="none" stroke="${col}" stroke-width="1.2" stroke-dasharray="4 3" points="${F.vel.map((v, k) => `${X(k).toFixed(1)},${(mid + (v / vMax) * (H / 2 - 14) * -1).toFixed(1)}`).join(' ')}"/>`;
    F.h.forEach((h, k) => { if (h < 0.01) g += `<rect x="${(X(k) - 2).toFixed(1)}" y="${S === 'L' ? H - 10 : H - 5}" width="${((W - 60) / (n - 1) + 1).toFixed(1)}" height="4" fill="${col}"/>`; });
  }
  g += `<line x1="${X(i).toFixed(1)}" y1="20" x2="${X(i).toFixed(1)}" y2="${H}" stroke="#23201d" stroke-width="1.5"/>`;
  g += `<text x="${W - 8}" y="16" text-anchor="end" font-family="Helvetica" font-size="11" fill="#444">solid: toe height (max ${(hMax * 100).toFixed(1)} cm) · dashed: toe speed (±${vMax.toFixed(2)} m/s) · bars: planted</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${g}</svg>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const labelSvg = (W, H, text, size = 12) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#d9d4ca"/><text x="6" y="${H - 6}" font-family="Helvetica, Arial" font-size="${size}" font-weight="700" fill="#23201d">${esc(text)}</text></svg>`);

// ─── render ────────────────────────────────────────────────────────────────
const CW = CELL, CH = Math.round(CELL * 1.45), LAB = 20, TRACE = 120, HEAD = 34;
const W = CW * 4, Hgif = HEAD + LAB + CH + TRACE;
const report = { name: NAME, spec: SPEC, plant: PLANT, frames: FRAMES, clips: {} };
for (const C of CLIPS) {
  const t0 = Date.now();
  const frames = []; const reports = [];
  // the hair: the clip sampled at 120 Hz and simulated (the air at the head: the wind less the body's own motion — a
  // gait's ground speed, a roll's travel between its start and end), each frame taking the nearest sample
  let hairAt = null;
  if (HR) {
    const K = Math.max(FRAMES, Math.round(C.seconds * 120)), poses = Array.from({ length: K }, (_, k) => C.fn(C.once ? k / (K - 1) : k / K));
    const headAt = R.joints.headBase;
    // a stop arrives at its gait's speed (the hair settles in that headwind) and is halted at once: still air after
    const own = (s) => (s <= 0 && C.before ? C.before : C.roll && s >= C.roll.start && s <= C.roll.end ? C.roll.speed : C.once && !C.speed ? 0 : C.speed || 0);
    const air = (s) => { const w = FIELD ? FIELD.at(headAt[0], headAt[1] + own(s) * s, headAt[2], s) : [0, 0, 0]; return [w[0], w[1] - own(s), w[2]]; };
    const sim = simulateClip(HR, poses, C.seconds, { loop: !C.once, air });
    hairAt = (t) => sim[Math.min(K - 1, Math.round(t * (C.once ? K - 1 : K)) % (C.once ? K : K))];
  }
  for (let i = 0; i < FRAMES; i++) {
    const t = C.once ? i / (FRAMES - 1) : i / FRAMES;
    const pose = hairAt ? hairAt(t) : C.fn(t); const { nodes, report: rep } = rigNodesAt(R, pose);
    const posed = poseLayered(mesh, recipe, pose, { R, skin });
    // a jump plays in place; the card draws the flight its timing designs (ballistic between take-off and touch-down)
    let up = 0; if (C.air) { const s = t * C.seconds, A = C.air; if (s > A.takeoff && s < A.land) {
      if (A.kick === undefined) { const ta = A.land - A.takeoff, u = s - A.takeoff; up = 4 * A.height * (u / ta) * (1 - u / ta); }
      else { const g = 9.81, v1 = Math.sqrt(2 * g * A.height); if (s < A.kick) { const u = s - A.takeoff; up = v1 * u - g * u * u / 2; } else { const vk = v1 - g * (A.kick - A.takeoff), u = s - A.kick; up = A.kickHeight + (vk + A.kickSpeed) * u - g * u * u / 2; } }
      up = Math.max(0, up); } }
    const lift = (p) => [p[0], p[1], p[2] + up];
    // held gear (a guard's sword, a shield): its faces carried by the posed bones, in their baked fill
    const XR = C.rest ? restTriangles(C.propsAt ? { props: C.propsAt(t) } : C.rest).map((t) => ({ p: t.p, rgb: hexRgb(t.colour) })) : [];
    const X0 = C.carry ? carryTriangles(C.carry, R, boneFrames(R, R.joints, nodes)).map((t) => ({ p: t.p.map(lift), rgb: hexRgb(t.colour) })) : [];
    const X = [...XR, ...X0, ...(C.gear ? gearFaces(C.gear, { frames: boneFrames(R, R.joints, nodes), light: WORKBENCH_LIGHT }).flatMap((g) => { const rgb = fillRgb(g.fill); const c = g.corners.map(lift); return c.slice(2).map((_, k) => ({ p: [c[0], c[k + 1], c[k + 2]], rgb })); }) : [])];
    frames.push({ V: up ? posed.mesh.vertices.map(lift) : posed.mesh.vertices, X, nodes: up ? Object.fromEntries(Object.entries(nodes).map(([k, v]) => [k, lift(v)])) : nodes }); reports.push(rep);
  }
  const M = measure(frames, C.seconds);
  const boxes = VIEWS.map((v) => boundsOf(frames.map((f) => [...f.V, ...f.X.flatMap((t) => t.p)]), v.cam));
  const clamped = reports.flatMap((r, i) => Object.entries(r.legs).filter(([, l]) => l.reach === 'clamped').map(([S]) => `${S}@${i}`));
  const head = `${NAME} · ${C.name} · ${C.seconds}s · ${C.src === 'clip' ? 'hero clip' : C.src}`;
  const sub2 = `v ${M.v} m/s · bob ${(M.bob * 100).toFixed(1)} cm · ${SIDES.map((S) => `${S}: stance ${Math.round(M.feet[S].stance * 100)}% slide ${M.feet[S].slide.mean}±${M.feet[S].slide.spread} stride ${(M.feet[S].stride * 100).toFixed(0)}cm lift ${(M.feet[S].lift * 100).toFixed(0)}cm`).join(' · ')}${clamped.length ? ` · leg clamped ${clamped.length}×` : ''}`;
  const headSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${HEAD}"><rect width="100%" height="100%" fill="#c9c4bb"/><text x="8" y="15" font-family="Helvetica" font-size="13" font-weight="700" fill="#23201d">${esc(head)}</text><text x="8" y="29" font-family="Helvetica" font-size="10.5" fill="#23201d">${esc(sub2)}</text></svg>`);
  const cellsAt = async (i) => {
    const f = frames[i]; const layers = [];
    layers.push({ input: Buffer.from(stickSvg(f.nodes, boxes[0], CW, CH, i / FRAMES, M.v * C.seconds)), left: 0, top: 0 });
    for (const [vi, v] of VIEWS.entries()) {
      const r = raster(f.V, v.cam, boxes[vi], CW * 2, CH * 2, f.X);
      layers.push({ input: await sharp(r.rgb, { raw: { width: CW * 2, height: CH * 2, channels: 3 } }).resize(CW, CH, { kernel: 'cubic' }).png().toBuffer(), left: CW * (vi + 1), top: 0 });
    }
    return layers;
  };
  const labels = [{ input: labelSvg(CW, LAB, 'stick · side'), left: 0, top: HEAD }, ...VIEWS.map((v, vi) => ({ input: labelSvg(CW, LAB, v.label), left: CW * (vi + 1), top: HEAD }))];
  const gifFrames = [];
  for (let i = 0; i < FRAMES; i++) {
    const cells = (await cellsAt(i)).map((l) => ({ ...l, top: l.top + HEAD + LAB }));
    const png = await sharp({ create: { width: W, height: Hgif, channels: 3, background: '#bdb8ae' } })
      .composite([{ input: headSvg, left: 0, top: 0 }, ...labels, ...cells, { input: Buffer.from(traceSvg(M, i, FRAMES, W, TRACE, `foot trace · phase ${(i / FRAMES).toFixed(2)}`)), left: 0, top: HEAD + LAB + CH }]).png().toBuffer();
    gifFrames.push(png);
  }
  const delay = Math.max(20, Math.round((C.seconds * 1000) / FRAMES));
  const gif = join(OUT, `${C.name}.gif`);
  writeFileSync(gif, await sharp(gifFrames, { join: { animated: true } }).gif({ delay: gifFrames.map(() => delay), loop: 0 }).toBuffer());
  // the strip: eight phases, each a row of the four cells
  const phases = Array.from({ length: 8 }, (_, k) => Math.round((k * FRAMES) / 8));
  const SW = W, SH = HEAD + phases.length * (LAB + CH);
  const strip = [{ input: headSvg, left: 0, top: 0 }];
  for (const [k, i] of phases.entries()) {
    const top = HEAD + k * (LAB + CH);
    strip.push({ input: labelSvg(W, LAB, `phase ${(i / FRAMES).toFixed(3)} · stick side | side | ¾ | rear ¾ (gameplay)`), left: 0, top });
    for (const l of await cellsAt(i)) strip.push({ ...l, top: top + LAB });
  }
  writeFileSync(join(OUT, `${C.name}-strip.png`), await sharp({ create: { width: SW, height: SH, channels: 3, background: '#bdb8ae' } }).composite(strip).png().toBuffer());
  const { feet, ...rest } = M;
  report.clips[C.name] = { src: C.src, seconds: C.seconds, ...rest, feet: Object.fromEntries(Object.entries(feet).map(([S, F]) => [S, { stance: F.stance, slide: F.slide, stride: F.stride, lift: F.lift }])), legClamped: clamped.length };
  console.log(`${C.name}: ${gif} (${Date.now() - t0} ms) · ${sub2}`);
}
writeFileSync(join(OUT, 'motion.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`wrote ${join(OUT, 'motion.json')}`);
