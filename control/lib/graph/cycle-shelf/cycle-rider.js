/**
 * cycle-rider — the rider astride: the realistic hero seated on a cycle shelf machine, its sit bones on the seat, its
 * feet planted on the pegs (or the floor, or the pedals), its hands on the grips, its trunk leaning as far as its posture
 * and the machine's geometry ask. Nothing new in the rig: the hips set as the seated rest sets them (hero-rest.js, the
 * sit bones on a contact), the feet by the rig's own foot targets (`feet`), the hands by its arm reach (hero-stance.js
 * reachArm), the elbows dropped as the rest drops them (hero-elbow.js).
 *
 *   POSTURES                           how a rider sits a kind of machine: a card, never a body special-cased
 *     hinge     [lo, hi] degrees the trunk may lean over the hips; the solve takes the most upright that reaches
 *     spine     the upper back's curl (sagittal), gaze the head's lift against the lean (0 none … 1 level)
 *     headUp    degrees the head is raised besides (the neck's extension, + up), within the neck's range
 *     forward   metres the rider sits ahead of the seat's middle (a motocross rider over the tank)
 *     stand     metres the pelvis rises off the seat (a rider standing on the pegs)
 *   solveRider(R, rider, posture?)    → (async) { pose, report: { posture, hinge, hands: { L, R } (metres off), legs } }:
 *                                      the rig pose (pure: the rig and the machine's rider points alone)
 *   riderOn(archetype, opts)           → (async) { faces, report }: the realistic hero posed on the machine, its faces in
 *                                      the machine's frame; `hero` the door's spec (realistic; built once a process),
 *                                      `posture` a card's name (absent, the machine's own)
 *
 * The hero door's own words (its gestures, its clips) cannot say this pose (they refuse foot targets and a seat); the
 * rider is posed from code. A rider rides upright: a machine on its stand has none. Deterministic.
 */
import { CYCLE_ARCHETYPES } from './cycle-archetypes.js';

// (the rig's modules load when a rider is first solved, as every caller of the hero's motion loads them: imported
// eagerly from here they close an import cycle among themselves)
let KIT = null;
const kit = async () => (KIT ??= Promise.all([
  import('../polygonizer/station-loft-rig.js'), import('../polygonizer/hero-stance.js'), import('../polygonizer/hero-elbow.js'), import('../polygonizer/hero-rest.js'),
]).then(([rig, stance, elbow, rest]) => ({ rigNodesAt: rig.rigNodesAt, reachArm: stance.reachArm, elbowsDown: elbow.elbowsDown, ischOf: rest.ischOf })));

export const POSTURES = Object.freeze({
  upright: Object.freeze({ label: 'sat up, the arms bent to the bar', hinge: [0, 45], spine: 0.15, gaze: 0.6 }),
  sport: Object.freeze({ label: 'leaning onto the bars, the elbows in', hinge: [20, 60], spine: 0.25, gaze: 0.85 }),
  race: Object.freeze({ label: 'tucked behind the screen, the chin toward the tank', hinge: [35, 75], spine: 0.35, gaze: 1 }),
  cruiser: Object.freeze({ label: 'sat back, the feet forward, the arms out', hinge: [0, 25], spine: 0, gaze: 0.3 }),
  mx: Object.freeze({ label: 'sat forward on the long seat, over the bars', hinge: [5, 45], spine: 0.2, gaze: 0.7, forward: 0.12 }),
  mxStand: Object.freeze({ label: 'standing on the pegs, the knees bent, over the bars', hinge: [20, 60], spine: 0.2, gaze: 0.9, forward: 0.15, stand: 0.16 }),
  scooter: Object.freeze({ label: 'sat upright, the feet on the floor', hinge: [0, 40], spine: 0.1, gaze: 0.5 }),
  cyclist: Object.freeze({ label: 'leaning to the bar, the feet on the pedals', hinge: [10, 65], spine: 0.25, gaze: 0.8 }),
  // (a ridden walker's rider: leaning onto the bars as on a sport machine, the head raised past level to look up the trail)
  walker: Object.freeze({ label: 'leaning onto the bars, the head tilted up to look ahead', hinge: [20, 60], spine: 0.25, gaze: 0, headUp: 42 }),
});
export const POSTURE_IDS = Object.freeze(Object.keys(POSTURES));

/** A posture's card by name, or throws naming them. */
export function postureCard(id) {
  const card = POSTURES[id];
  if (!card) throw new Error(`Unknown riding posture '${id}'; expected one of: ${POSTURE_IDS.join(', ')}`);
  return card;
}
/** The posture a machine is ridden in, unless the operator's word says otherwise. */
export const postureOf = (archetype) => CYCLE_ARCHETYPES[archetype]?.posture ?? 'upright';

const WRIST = 0.07;     // the wrist behind the grip's middle, along the bar: the hand's own length closes round it
const REACHED = 0.005;  // a hand within 5 mm of its goal has it

/**
 * The rig pose of a rider on a machine. `rider`: the machine's rider points (assembleCycle's readout.rider: the seat,
 * each grip, each peg), in its frame. The trunk's lean is searched within the posture's range, most upright first,
 * until both hands reach; the nearest is kept, and the report says how far each hand is off.
 */
export async function solveRider(R, rider, posture = 'upright') {
  const { rigNodesAt, reachArm, elbowsDown, ischOf } = await kit();
  const card = postureCard(posture), J = R.joints, isch = ischOf(R);
  for (const k of ['seat', 'grip.l', 'grip.r', 'peg.l', 'peg.r']) if (!rider?.[k]) throw new Error(`cycle rider: the machine has no '${k}' for a rider`);
  const seat = rider.seat, pel = [0, seat[1] + (card.forward ?? 0) - isch[1], seat[2] - isch[2] + 0.01 + (card.stand ?? 0)], dz = pel[2] - J.pelvisHub[2];
  let best = null;
  const [lo, hi] = card.hinge;
  for (let hinge = lo; hinge <= hi + 1e-9; hinge += 2.5) {
    let pose = {
      support: 'none', shift: { x: 0, y: pel[1] }, ...(dz >= 0 ? { lift: dz } : { sink: -dz }),
      hinge, spine: { sagittal: card.spine, lateral: 0, axial: 0 }, head: { pitch: -hinge * card.gaze + (card.headUp ?? 0) },
      feet: { L: rider['peg.l'], R: rider['peg.r'] }, fingersL: 'fist', fingersR: 'fist',
    };
    const hands = {};
    for (const S of ['L', 'R']) {
      const g = rider[`grip.${S.toLowerCase()}`], a = reachArm(R, pose, S, [g[0], g[1] - WRIST, g[2]]);
      pose = { ...pose, [`sh${S}`]: a.sh, [`elbow${S}`]: a.elbow };
      hands[S] = a.err;
    }
    pose = elbowsDown(R, pose);
    const off = Math.max(hands.L, hands.R);
    if (!best || off < best.off - 1e-9) best = { hinge, off, pose, hands };
    if (off <= REACHED) break;
  }
  const { report } = rigNodesAt(R, best.pose);
  const legs = Object.fromEntries(Object.entries(report.legs ?? {}).map(([S, l]) => [S, l.reach]));
  const r4 = (n) => Math.round(n * 1e4) / 1e4;
  return { pose: best.pose, report: { posture, hinge: best.hinge, hands: { L: r4(best.hands.L), R: r4(best.hands.R) }, legs, reached: best.off <= REACHED && Object.values(legs).every((l) => l === 'ok') } };
}

// (a hero is built once a process: half a minute for the realistic body's recipe)
const HEROES = new Map();
async function heroOf(spec) {
  const key = JSON.stringify(spec);
  if (!HEROES.has(key)) {
    HEROES.set(key, (async () => {
      const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
      const { validateRig, bindLayered } = await import('../polygonizer/station-loft-rig.js');
      const { compileLayered } = await import('../polygonizer/station-loft.js');
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      const R = validateRig(m.recipe.rig), mesh = compileLayered(m.recipe, m.dials);
      return { recipe: m.recipe, R, mesh, skin: bindLayered(mesh, m.recipe, R) };
    })());
  }
  return HEROES.get(key);
}

/** The rider's hero: the door's spec, the realistic body (the straddle is solved on its rig). */
export function readRiderHero(hero, at = 'rider') {
  const spec = hero === true || hero === undefined ? { form: 'realistic' } : hero;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`${at} is true (the realistic hero) or a hero's spec`);
  if ((spec.form ?? 'realistic') !== 'realistic') throw new Error(`${at}: a rider is the realistic hero (form 'realistic'): the straddle is solved on its rig`);
  return { ...spec, form: 'realistic' };
}

export async function riderOn(archetype, { hero, posture, rider } = {}) {
  const spec = readRiderHero(hero), word = posture ?? postureOf(archetype);
  postureCard(word);
  if (!rider) { const { assembleCycle } = await import('./index.js'); rider = assembleCycle(archetype).readout.rider; }
  const H = await heroOf(spec);
  const { pose, report } = await solveRider(H.R, rider, word);
  const { poseLayered } = await import('../polygonizer/hero-gesture.js');
  const { layeredFaces } = await import('../polygonizer/station-loft-faces.js');
  const { mesh: posed } = poseLayered(H.mesh, H.recipe, pose, { R: H.R, skin: H.skin });
  // (seated where the solve put it: not grounded, its feet on the pegs and not the floor)
  const faces = layeredFaces(posed, H.recipe, { seat: false });
  return { faces, pose, report: { ...report, height: Math.round(H.R.joints.headTop[2] * 1000) / 1000 } };
}
