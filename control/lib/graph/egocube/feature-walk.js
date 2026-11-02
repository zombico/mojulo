/**
 * THE STANDING WALK, from the mechanics: the feature animal upright, strolling on two legs, laid out with the trot's
 * tools (feature-trot.js) and the horse study's walk. In this design language a slow walk is done on two legs and the
 * trot on all fours is faster: the walk is held slower than the animal's own trot.
 *
 *   THE BEAT      the two feet half a stride apart, each down `duty` of it: both down twice a stride (double support).
 *   THE STRIDE    dynamic similarity again: a person's stroll (`froude`, v²/(g·h)) at a cadence that goes as √(g/leg)
 *                 (a person's `cadence` strides a second at a 0.9 m leg); the stance cut to what a near-straight leg
 *                 reaches with the hip falling no more than `vault` of the leg, and the speed held under `slower` of the
 *                 trot's.
 *   ONE GROUND    each planted foot slides back at the one ground speed; the swing laid C1 between the stances (the
 *                 trot's swingPath), lifted by a bump peaking at `peak`, the foot swung back to meet the ground.
 *   THE VAULT     the standing leg near straight (`column` of it, as the feature style stands), the body riding over it:
 *                 highest as the leg passes under the hip, lowest in double support (solved on the rig: feature-body.js
 *                 walked), smoothed to the stride's low harmonics, `bob` exaggerating its dips.
 *   THE WADDLE    a standing foot pushes the body along itself, away from it (an inverted pendulum, the horse study's
 *                 sway: x'' = (g/h)·Σ F·(x − x_foot), each foot's force the walk's double hump, MERKENS 1993): the body
 *                 swings over the foot that bears it, the wider the hips the further; the trunk leaning over it
 *                 (`lean`), the pelvis turning with the leg that reaches (`pelvis`) and the chest against it (`twist`).
 *   FOLLOW-THROUGH the arms swing against the legs, late (`arms`, a share of a stride behind); the head nods after the
 *                 bob and the tail answers it, the trot's pendulums.
 *
 *   walkMeasures({ leg, span, trot }) → { speed, f, seconds, duty, stride, stance, cut? }
 *   walkSignals(M, { lift, hipX, footX, h }) → { feet(S, t) → [dy, dz], down(S, t), sway(t), lean(t), arm(S, t), nod(t), swish(t) }
 */
import { swingPath, bump } from './feature-trot.js';

const TAU = 2 * Math.PI, G = 9.81, frac = (x) => x - Math.floor(x);
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;

/** The walk's numbers. `duty` the share of a stride a foot is down (a person's stroll, ≈ 0.6); `froude` the stroll's
 *  v²/(g·leg) (a person strolls at ≈ 0.15); `cadence` a person's strides a second at `leg0` (m) of leg, scaled by
 *  √(leg0/leg); `slower` the most of the animal's trot speed its walk may go; `vault` how far the hip may fall over the
 *  standing leg toward the stance's ends (a share of the leg); `column` the share of its leg a standing leg keeps (near
 *  straight); `lift` the swing's clearance (a share of the leg) and `peak` where in the swing it is highest; `impact` the
 *  share of the ground's speed a foot matches before it lands; `bob` the vault's dips exaggerated; `sway` the waddle's
 *  exaggeration (× the inverted pendulum's), `lean` the trunk's lean over the bearing foot (spine units at full sway),
 *  `pelvis` and `twist` the pelvis's and the chest's turns (degrees, spine units), `arms` the arms' swing (aim units) and
 *  its lag (a share of a stride); `nod` and `swish` the pendulums (degrees at most); `keys` the packer's samples. */
export const FEATURE_WALK = Object.freeze({
  duty: 0.6, froude: 0.15, cadence: 0.85, leg0: 0.9, slower: 0.7, vault: 0.05, column: 0.995, lift: 0.12, peak: 0.45, impact: 0.7,
  bob: 1.4, sway: 0.8, lean: 0.08, pelvis: 6, twist: 0.08,
  arms: Object.freeze({ swing: 0.32, lag: 0.06 }),
  nod: Object.freeze({ most: 5, lag: 0.08 }), swish: Object.freeze({ most: 8, lag: 0.15 }),
  keys: 12,
});

/** the stroll's stride for this leg (hip over the floor, m), its stance cut to what the leg reaches (`span`: the most a
 *  foot may travel fore and aft of its stance's middle, m) and its speed held under the trot's (`trot`, m/s, if any) */
export function walkMeasures({ leg, span, trot = null }, W = FEATURE_WALK) {
  const f = W.cadence * Math.sqrt(W.leg0 / leg), v0 = Math.sqrt(W.froude * G * leg), stance0 = (W.duty * v0) / f;
  let stance = Math.min(stance0, 2 * span);
  // (slower than the trot: shorter steps at the same cadence)
  if (trot > 0) stance = Math.min(stance, (W.slower * trot * W.duty) / f);
  const speed = (stance / W.duty) * f;
  return { speed: r4(speed), f: r4(f), seconds: r4(1 / f), duty: W.duty, stride: r4(stance / W.duty), stance: r4(stance), ...(stance < stance0 ? { cut: r4(stance / stance0) } : {}) };
}

/**
 * The stride's signals: each foot's place fore and aft of its stance's middle and its rise (`feet`), whether it is down
 * (`down`), the body's sideways swing over the bearing foot (`sway`, m, + to the right), the trunk's lean (−1 … 1), each
 * arm's swing (−1 back … 1 forward), the nod and the swish (degrees). `lift` the swing's clearance (m); `hipX` and
 * `footX` the right hip's and foot's distance from the mid-plane (m); `h` the hip's height (m). The right foot lands at 0,
 * the left at half a stride.
 */
export function walkSignals(M, { lift, footX, h }, W = FEATURE_WALK) {
  const { duty, stance } = M, T = 1 / M.f, half = stance / 2, ground = -stance / duty, at = { R: 0, L: 0.5 };
  const feet = (S, t) => {
    const u = frac(t - at[S]);
    if (u < duty) return [half - stance * (u / duty), 0];
    const v = (u - duty) / (1 - duty), m = ground * (1 - duty);
    return [swingPath(-half, m, half, W.impact * m, v), lift * bump(v, W.peak)];
  };
  const down = (S, t) => frac(t - at[S]) < duty;
  // (each foot's vertical force: the walk's double hump through its stance, its impulse half the weight's)
  const b = 0.28, Is = 2 / Math.PI + (b * 2) / (3 * Math.PI), A = 0.5 / (duty * Is);
  const force = (S, t) => { const u = frac(t - at[S]) / duty; return u < 1 ? A * (Math.sin(Math.PI * u) + b * Math.sin(3 * Math.PI * u)) : 0; };
  // (THE WADDLE: x'' = (g/h)·(x − Σ F·x_foot) about its mean, solved harmonic by harmonic)
  const N = 128, K = 12, drive = Array.from({ length: N }, (_, n) => force('R', n / N) * footX - force('L', n / N) * footX);
  const C = [];
  for (let k = 0; k <= K; k++) { let re = 0, im = 0; for (let n = 0; n < N; n++) { const a = (-TAU * k * n) / N; re += drive[n] * Math.cos(a); im += drive[n] * Math.sin(a); } C.push(k ? [(2 * re) / N, (2 * im) / N] : [0, 0]); }
  const gh = G / h, swayC = C.map((c, k) => { const w = (TAU * k) / T, g = k ? gh / (w * w + gh) : 0; return [c[0] * g, c[1] * g]; });
  const ev = (Cs, t) => Cs.reduce((v, c, k) => v + c[0] * Math.cos(TAU * k * t) - c[1] * Math.sin(TAU * k * t), 0);
  const swayMost = Math.max(...Array.from({ length: 48 }, (_, n) => Math.abs(ev(swayC, n / 48)))) || 1;
  const sway = (t) => W.sway * ev(swayC, t), lean = (t) => ev(swayC, t) / swayMost;
  // (the arms against the legs, late: the right arm forward as the left foot is)
  const arm = (S, t) => { const o = S === 'R' ? 'L' : 'R', [dy] = feet(o, t - W.arms.lag); return half > 0 ? Math.max(-1, Math.min(1, dy / half)) : 0; };
  // (the bob's pendulums: two dips a stride, the head and the tail answering late)
  const dip = (t) => Math.cos(2 * TAU * t);
  return { feet, down, force, sway, lean, arm, nod: (t) => W.nod.most * dip(t - W.nod.lag), swish: (t) => W.swish.most * dip(t - W.swish.lag) };
}
