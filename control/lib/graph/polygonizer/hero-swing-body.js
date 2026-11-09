// hero-swing-body — a swing carried by the whole body (hero-swing.js's keys, a body layer over them): its own module, so
// a page that carries the swing's source (the contest's) carries none of it. Pure: the rig's own pose solve is handed in.
/**
 * THE FULL-BODY SWING (`swingBody`, an action game's: a hero whose rule plays a moveset, gameworld/combos.js): the arm's
 * arc carried by the body on the strike solver's principles (hero-strike.js), on the structured core's stance (the left
 * foot forward, so the sword hand is the rear hand and a forehand cut drives through as a cross does):
 *   • THE HIPS LEAD THE CHEST. The core's `facing` turns back with the coil and starts forward at the cock while the
 *     chest (the verb's own spine twist) is still wound back, then drives through the strike ahead of it.
 *   • THE WEIGHT MOVES. Back over the rear foot through the cock, onto the lead foot through the blow (`shift`).
 *   • THE REAR FOOT PIVOTS as the hips come through: its heel up, its toe turned in on the ball.
 *   • THE OTHER HAND COUNTERS a one-handed swing: out toward the target at the cock, drawn back to the hip through the
 *     blow. A two-handed swing keeps its own (the off hand on the grip).
 *   • THE LEGS REACH. Each key sinks the body as little as lets both planted legs reach their feet on the rig
 *     (`reach`), never a stretched leg; a key no sink lets reach gives up its weight shift a step at a time.
 * A backhand (the rising cut) turns the other way. Absent, a swing is its keys as they were.
 */
const BODY_PHASES = Object.freeze({ light: ['ready', 'cock', 'strike', 'follow', 'recover'], normal: ['ready', 'coil', 'cock', 'strike', 'follow', 'recover'], heavy: ['ready', 'coil', 'cock', 'load', 'strike', 'follow', 'recover'] });
// facing (degrees, + the right shoulder forward), w (metres the weight forward), heel and pivot (the rear foot's degrees)
const BODY_TURN = Object.freeze({
  forehand: { ready: { facing: -8, w: 0 }, coil: { facing: -18, w: -0.03 }, cock: { facing: -12, w: -0.05 }, load: { facing: -14, w: -0.06 }, strike: { facing: 16, w: 0.07, heel: 22, pivot: 18 }, follow: { facing: 22, w: 0.08, heel: 28, pivot: 24 }, recover: { facing: 6, w: 0.03, heel: 8, pivot: 8 } },
  backhand: { ready: { facing: -8, w: 0 }, coil: { facing: 4, w: -0.02 }, cock: { facing: 12, w: -0.04 }, load: { facing: 14, w: -0.05 }, strike: { facing: -14, w: 0.05 }, follow: { facing: -20, w: 0.06 }, recover: { facing: -10, w: 0.02 } },
});
const BODY_OF = Object.freeze({ rising: 'backhand', backhand: 'backhand' });
// the off (left) hand of a one-handed swing, phase by phase: a forehand aims it out and pulls it home through the blow; a
// backhand the other way about
const OFF_HAND = Object.freeze({
  forehand: { coil: { shL: { yaw: -6, pitch: 40, roll: 0 }, elbowL: 35 }, cock: { shL: { yaw: -10, pitch: 55, roll: 0 }, elbowL: 25 }, load: { shL: { yaw: -10, pitch: 58, roll: 0 }, elbowL: 25 }, strike: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, follow: { shL: { yaw: 12, pitch: -15, roll: 0 }, elbowL: 100 }, recover: { shL: { yaw: 0, pitch: 10, roll: 0 }, elbowL: 70 } },
  backhand: { coil: { shL: { yaw: 6, pitch: 5, roll: 0 }, elbowL: 80 }, cock: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, load: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, strike: { shL: { yaw: -14, pitch: 45, roll: 0 }, elbowL: 30 }, follow: { shL: { yaw: -16, pitch: 50, roll: 0 }, elbowL: 25 }, recover: { shL: { yaw: -4, pitch: 25, roll: 0 }, elbowL: 50 } },
});
/**
 * THE ACTION STYLE (a world whose juice is the action game type's: `swings.style`, world-kinds.js from the world's
 * fxStyle flavor): cartoon force, not a fencer's economy. A wider, lower stance; the WINGS (the animation spike's: a key's
 * reach from the ready pose scaled up, the wind-up's and the follow-through's, never the blow's, so the blade still lands
 * where it lands); the hips turned further and the weight thrown harder; the off arm flung wide against the cut.
 */
export const SWING_STYLES = Object.freeze({
  action: Object.freeze({ stance: 1.8, stagger: 0.34, crouch: 0.06, wind: 1.6, after: 1.45, weight: 1.5, off: 1.6,
    // the hips wound hard and thrown through (the chain kept: they come forward at the cock while the chest is still back)
    turn: Object.freeze({
      forehand: { ready: { facing: -12, w: 0 }, coil: { facing: -32, w: -0.04 }, cock: { facing: -26, w: -0.07 }, load: { facing: -30, w: -0.08 }, strike: { facing: 28, w: 0.1, heel: 30, pivot: 26 }, follow: { facing: 42, w: 0.12, heel: 38, pivot: 34 }, recover: { facing: 14, w: 0.04, heel: 12, pivot: 10 } },
      backhand: { ready: { facing: -12, w: 0 }, coil: { facing: 10, w: -0.03 }, cock: { facing: 24, w: -0.06 }, load: { facing: 28, w: -0.07 }, strike: { facing: -26, w: 0.08 }, follow: { facing: -38, w: 0.1 }, recover: { facing: -16, w: 0.03 } },
    }) }),
  // THE SWORD ARTS (a moveset's `art`, gameworld/combos.js; docs/sword-arts.md): the swing performed past the realistic
  // law, over the same verbs and the same body layer. Each adds to a style:
  //   raise    the arm's pitch cap on the wings (the realistic law's 110: the elbow never over the head)
  //   bend     the trunk's forward bend cap on the wings (degrees of hinge: a deep blow's blade off the floor)
  //   gaze     the share of the body's turn the head turns back against (`glance`): the eyes kept on the target
  //   extend   the share of the elbow's bend straightened at the blow and the follow-through (the arm and the blade one
  //            line, the reach full)
  //   timing   its own segments (artTiming): `hold` the anticipation held at the cock, `finish` the follow-through's pose
  //            held before the recovery (zanshin)
  // INSPIRED (realistic-inspired: kenjutsu's and the long sword's chambers, performed for the camera): the blade chambered
  // high (hasso, jodan: the elbow may rise past the shoulder line), the stance deep and long, the hips committed, the arm
  // and blade one line at the blow, the off hand flung back as a counterweight, the finish held a beat.
  inspired: Object.freeze({ stance: 2.05, stagger: 0.42, crouch: 0.1, wind: 1.85, after: 1.7, weight: 1.6, off: 2.0, raise: 140, bend: 22, extend: 0.55, gaze: 0.6,
    turn: Object.freeze({
      forehand: { ready: { facing: -16, w: 0 }, coil: { facing: -42, w: -0.05 }, cock: { facing: -36, w: -0.08 }, load: { facing: -40, w: -0.09 }, strike: { facing: 36, w: 0.12, heel: 34, pivot: 30 }, follow: { facing: 58, w: 0.14, heel: 42, pivot: 40 }, recover: { facing: 18, w: 0.05, heel: 14, pivot: 12 } },
      backhand: { ready: { facing: -16, w: 0 }, coil: { facing: 16, w: -0.04 }, cock: { facing: 34, w: -0.07 }, load: { facing: 38, w: -0.08 }, strike: { facing: -34, w: 0.1 }, follow: { facing: -52, w: 0.12 }, recover: { facing: -20, w: 0.04 } },
    }),
    timing: Object.freeze({ wind: 1.7, act: 0.34, after: 1.15, settle: 0.8, hold: Object.freeze({ light: 0.2, normal: 0.6, heavy: 1.0 }), finish: 1.2 }) }),
  // FREESTYLE (the anime sword: anything goes, the sword's weight and the stance's balance no law): the blade wound fully
  // overhead or far behind, the body coiled and HELD, then the cut near-instant, the hips spun through past the target
  // (the pass-through: the back half turned to it), the stance low and very wide, the arm thrown to full reach and the
  // off hand flung wide, the finish pose held long.
  freestyle: Object.freeze({ stance: 2.4, stagger: 0.52, crouch: 0.16, wind: 2.4, after: 2.2, weight: 1.9, off: 2.5, raise: 172, bend: 18, extend: 0.85, gaze: 0.85,
    turn: Object.freeze({
      forehand: { ready: { facing: -20, w: 0 }, coil: { facing: -62, w: -0.06 }, cock: { facing: -56, w: -0.1 }, load: { facing: -64, w: -0.11 }, strike: { facing: 52, w: 0.15, heel: 40, pivot: 40 }, follow: { facing: 88, w: 0.17, heel: 50, pivot: 55 }, recover: { facing: 26, w: 0.06, heel: 18, pivot: 16 } },
      backhand: { ready: { facing: -20, w: 0 }, coil: { facing: 26, w: -0.05 }, cock: { facing: 52, w: -0.09 }, load: { facing: 58, w: -0.1 }, strike: { facing: -50, w: 0.13 }, follow: { facing: -82, w: 0.15 }, recover: { facing: -26, w: 0.05 } },
    }),
    timing: Object.freeze({ wind: 1.6, act: 0.22, after: 0.9, settle: 0.7, hold: Object.freeze({ light: 0.35, normal: 0.7, heavy: 1.3 }), finish: 2.0 }) }),
});
/** the sword arts by name: `realistic` the game type's own swing (no art), the others the styles above */
export const SWORD_ARTS = Object.freeze(['realistic', 'inspired', 'freestyle']);
export const SWING_BODY = Object.freeze({ phases: BODY_PHASES, turn: BODY_TURN, of: BODY_OF, offHand: OFF_HAND, styles: SWING_STYLES });
/**
 * AN ART'S TIMING (its style's `timing`), as hero-swing.js swingTiming re-times a game type's: each key segment by its role
 * (wind, act, after, settle), the anticipation HELD at the strike's start (`hold`, the cock still before the cut) and the
 * FINISH held at the follow-through's key (`finish`, zanshin) before the recovery. → { cls, warp, strike, window } or null.
 */
const ART_ROLES = Object.freeze({ light: ['wind', 'act', 'after', 'settle', 'settle'], normal: ['wind', 'wind', 'act', 'after', 'settle', 'settle'], heavy: ['wind', 'wind', 'wind', 'act', 'after', 'settle', 'settle'] });
export function artTiming(cls, art) {
  const T = SWING_STYLES[art] && SWING_STYLES[art].timing, roles = ART_ROLES[cls];
  if (!T || !roles) return null;
  const N = roles.length, spans = [];
  let finished = false;
  roles.forEach((r, i) => {
    if (r === 'act' && T.hold[cls]) spans.push({ from: i, hold: true, d: T.hold[cls] });
    if (r === 'settle' && !finished) { finished = true; if (T.finish) spans.push({ from: i, hold: true, d: T.finish }); }
    spans.push({ from: i, d: T[r] });
  });
  const total = spans.reduce((a, x) => a + x.d, 0);
  let acc = 0; for (const x of spans) { x.a = acc; acc += x.d / total; x.b = acc; }
  spans.at(-1).b = 1;
  const warp = (u) => { const x = spans.find((y) => u < y.b) ?? spans.at(-1); return x.hold ? x.from / N : (x.from + Math.min(1, Math.max(0, (u - x.a) / (x.b - x.a)))) / N; };
  const act = spans.find((x) => !x.hold && roles[x.from] === 'act'), cock = spans.find((x) => x.hold && roles[x.from] === 'act') ?? act, after = spans.find((x) => !x.hold && roles[x.from] === 'after');
  return { cls, flavor: art, warp, strike: +act.b.toFixed(3), window: [+cock.a.toFixed(3), +after.b.toFixed(3)] };
}
// a key's reach from ready scaled by `g` (the WINGS): the arms' and the trunk's angles, the twist's share, the hinge, the crouch
const WING_ANGLES = (a, r, g) => (Number.isFinite(a) && Number.isFinite(r) ? Math.round((r + (a - r) * g) * 100) / 100 : a);
function wing(k, ready, g, raise = 110, bend = Infinity) {
  if (g === 1) return k;
  const o = { ...k };
  // (the arm's arc widened, its yaw and its pitch, the pitch held under the head: the swing's law, the elbow low, never over
  // the head, unless an art raises it, `raise`; its roll, the forearm's turn that carries the blade's edge, is the swing's own)
  for (const j of ['shR', 'shL']) if (k[j] && ready[j]) o[j] = Object.fromEntries(Object.entries(k[j]).map(([a, v]) => [a, a === 'roll' ? v : a === 'pitch' ? Math.min(Math.max(v, raise), WING_ANGLES(v, ready[j][a] ?? 0, g)) : WING_ANGLES(v, ready[j][a] ?? 0, g)]));
  // (the trunk's bend over the hips widened too, at most an art's `bend`: a deep blow's blade kept off the floor)
  for (const j of ['hinge']) if (Number.isFinite(k[j])) o[j] = Math.max(0, Math.min(Math.max(k[j], bend), WING_ANGLES(k[j], ready[j] ?? 0, g)));
  if (Number.isFinite(k.shoulders)) o.shoulders = WING_ANGLES(k.shoulders, ready.shoulders ?? 0, g);
  if (k.spine) o.spine = Object.fromEntries(Object.entries(k.spine).map(([a, v]) => [a, Array.isArray(v) ? [v[0], Math.min(0.6, v[1] * g)] : Number.isFinite(v) ? Math.min(0.5, v * g) : v]));
  if (k.head?.pitch != null) o.head = { ...k.head, pitch: WING_ANGLES(k.head.pitch, ready.head?.pitch ?? 0, Math.min(g, 1.3)) };
  return o;
}
/** a pose's legs reach on the rig (a strict rig throws; a clamping one reports) */
function legsReach(R, pose, nodesAt) {
  try { const { report } = nodesAt(R, pose); return Object.values(report.legs).every((l) => !l.metaError || l.metaError < 1e-3); } catch { return false; }
}
/**
 * The keys of `word` at `cls` carried by the whole body on rig `R` (`nodesAt` the rig's own pose solve, rigNodesAt). A
 * verb whose own keys move the off hand (two hands on the grip, a shield's bash) keeps them.
 */
export function swingBody(word, cls, keys, R, nodesAt, style = null) {
  const phases = BODY_PHASES[cls] ?? BODY_PHASES.normal, side = BODY_OF[word] ?? 'forehand', T = BODY_TURN[side], St = SWING_STYLES[style] ?? null;
  // (the action style: its wider stance under every key, and the wings on the wind-up and the follow-through)
  if (St) {
    const ready = keys[0];
    keys = keys.map((k, i) => {
      const ph = phases[i] ?? 'recover', g = ['coil', 'cock', 'load'].includes(ph) ? St.wind : ['follow'].includes(ph) ? St.after : ph === 'recover' ? 1 + (St.after - 1) * 0.5 : 1;
      const w = wing(k, ready, g, St.raise ?? 110, St.bend ?? Infinity);
      // (an art's EXTENSION: at the blow and through the follow the sword arm's elbow straightened by its share, arm and blade
      // one line)
      if (St.extend && (ph === 'strike' || ph === 'follow') && Number.isFinite(w.elbowR)) w.elbowR = Math.round(w.elbowR * (1 - St.extend) * 100) / 100;
      return { ...w, stance: St.stance, stagger: St.stagger, crouch: Math.min(0.4, (k.crouch ?? 0) + St.crouch) };
    });
  }
  // (a verb that moves its own off hand: its keys' left arm leaves the ready key's)
  const ownOff = keys.some((k) => JSON.stringify([k.shL, k.elbowL]) !== JSON.stringify([keys[0].shL, keys[0].elbowL]));
  return keys.map((k, i) => {
    const ph = phases[i] ?? 'recover', B0 = T[ph] ?? T.recover;
    const B = St ? (St.turn[side][ph] ?? St.turn[side].recover) : B0;
    const off = !ownOff && OFF_HAND[side][ph] ? (St ? wing(OFF_HAND[side][ph], { shL: keys[0].shL, elbowL: keys[0].elbowL }, St.off) : OFF_HAND[side][ph]) : {};
    // (an art's GAZE: the head turned back against the body's turn by its share, the eyes held on the target while the body
    // coils away from it and spins through past it)
    const gaze = St && St.gaze ? { glance: Math.round(Math.max(-75, Math.min(75, -B.facing * St.gaze)) * 100) / 100 } : {};
    const out = { ...k, facing: B.facing, ...(B.heel ? { heelR: B.heel, splayR: -B.pivot } : {}), ...off, ...gaze };
    // the weight, and the least sink the legs reach with (a strike solver's reachSink, stepped)
    for (let w = B.w; ; w = w > 0 ? Math.max(0, w - 0.02) : Math.min(0, w + 0.02)) {
      const at = { ...out, shift: { x: 0, y: Math.round(w * 1e4) / 1e4 } };
      for (let c = k.crouch ?? 0; c <= 0.45 + 1e-9; c += 0.02) {
        const pose = { ...at, crouch: Math.round(c * 1e4) / 1e4 };
        if (legsReach(R, pose, nodesAt)) return pose;
      }
      if (w === 0) break;
    }
    // (an art's stance too wide for the turn, no weight given up reaching: the stance drawn in a step at a time, the
    // weight centred; the realistic and the action styles always reach before this)
    for (let st = (out.stance ?? 1) - 0.1; St && st >= 1 - 1e-9; st -= 0.1) {
      for (let c = k.crouch ?? 0; c <= 0.45 + 1e-9; c += 0.02) {
        const pose = { ...out, stance: Math.round(st * 100) / 100, shift: { x: 0, y: 0 }, crouch: Math.round(c * 1e4) / 1e4 };
        if (legsReach(R, pose, nodesAt)) return pose;
      }
    }
    return { ...out, crouch: k.crouch ?? 0 };
  });
}


// ─── the footwork: a move's feet through its travel ─────────────────────────────────────────────────────────
/**
 * THE FOOTWORK (a move's own clip, `moveClip`): the runtime carries the body `m` metres along its facing as a move plays
 * (worlds/controllable/combat-melee.js: the travel eased over the phase from `from` to `to`, smoothstepped, `from` the
 * blend into the move waited out so the outgoing pose, held still, never rides the body), so a clip whose
 * feet stood still on the hero would skate them across the floor. A travelling move ADVANCES as a fencer does: the lead
 * foot steps out first, the rear foot follows, both down by `to` (before the blow lands, for a step; through it, for a
 * lunge); a planted foot is held where it stands on the floor while the body moves over it, a stepping foot lifts on an
 * arc and lands `m` ahead. Every move ends in the stance it began in, so a string chains without a foot jumping, and
 * where a wide moment of the advance outstretches a leg the body sinks (`sink`) until both legs reach.
 *
 *   travelAt(u, T)          → metres the runtime has carried the body at phase u (its own law, here so the two agree)
 *   footworkAt(u, T, lead)  → { L, R } each { dy (metres along the facing, off its stance place), lift } at phase u
 *   moveClip(move, ctx)     → the move's clip (a function of the runtime's phase, `keys` samples): the held swing of its
 *                             `swing`, the whole body over it (swingBody), its footwork; `move` on it as a swing's
 */
const ease = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
/** A LUNGE (`kind: 'lunge'`) is not an advance: the lead foot drives out and lands with the blow while the rear foot
 * holds, the rear leg extending behind as the body drops (`LUNGE.share` of the travel, the most one stride reaches), then
 * after the blow the rear foot RECOVERS forward to the stance, the body rising through the rest of the travel by `rec`.
 * The runtime carries the body by the same two pieces (combat-melee.js, its own copy: the law holds the two equal). */
export const LUNGE = Object.freeze({ share: 0.55, recover: 0.3, most: 0.7 });
export const lungeRec = (T) => Math.min(0.92, T.to + LUNGE.recover);
export function travelAt(u, T) {
  if (!T || !(T.m > 0)) return 0;
  const f0 = T.from || 0;
  if (T.kind !== 'lunge') return T.m * ease((u - f0) / (T.to - f0));
  const k = LUNGE.share, rec = lungeRec(T);
  return u <= T.to ? T.m * k * ease((u - f0) / (T.to - f0)) : T.m * k + T.m * (1 - k) * ease((u - T.to) / (rec - T.to));
}
/** the advance's split: the lead foot's flight over the first share of the travel's phases, the rear's over the rest */
export const ADVANCE = Object.freeze({ split: 0.5, lift: (m) => Math.min(0.09, 0.03 + 0.12 * m) });
export function footworkAt(u, T, lead = 'L') {
  const rear = lead === 'L' ? 'R' : 'L';
  if (!T || !(T.m > 0)) return { L: { dy: 0, lift: 0 }, R: { dy: 0, lift: 0 } };
  const arc = (a, b) => (u > a && u < b ? Math.sin(Math.PI * (u - a) / (b - a)) : 0);
  if (T.kind === 'lunge') {
    // the lead foot out the whole travel, landing with the blow; the rear holding, then recovering forward after it
    const f0 = T.from || 0, rec = lungeRec(T), d = travelAt(u, T), lift = ADVANCE.lift(T.m) * 0.7;
    const leadW = T.m * ease((u - f0) / (T.to - f0)), rearW = T.m * ease((u - T.to) / (rec - T.to));
    return { [lead]: { dy: leadW - d, lift: lift * arc(f0, T.to) }, [rear]: { dy: rearW - d, lift: lift * arc(T.to, rec) } };
  }
  const f0 = T.from || 0, h = f0 + (T.to - f0) * ADVANCE.split, d = travelAt(u, T), lift = ADVANCE.lift(T.m);
  // each foot's own travel over the floor: the lead's over [from, h], the rear's over [h, to]
  const leadW = T.m * ease((u - f0) / (h - f0)), rearW = T.m * ease((u - h) / (T.to - h));
  return { [lead]: { dy: leadW - d, lift: lift * arc(f0, h) }, [rear]: { dy: rearW - d, lift: lift * arc(h, T.to) } };
}
/** the feet targets of a pose with its footwork: each foot from its stance place (the pose's own targets, a solved strike's;
 * else plantedFoot's), moved along the facing */
function feetOf(R, pose, F, plantedFoot) {
  const out = {};
  for (const S of ['L', 'R']) {
    const base = Array.isArray(pose.feet?.[S]) ? pose.feet[S] : plantedFoot(R, R.legs[S], pose).toeBase;
    out[S] = [base[0], base[1] + F[S].dy, base[2] + F[S].lift];
  }
  return out;
}
/** A clip's footwork over it (a function of the runtime's phase): each foot from the clip's own stance place moved by the
 * footwork, the body sunk as little as lets both legs reach. The lead foot is the one standing further forward. */
export function withFootwork(arm, travel, { R, rigNodesAt, plantedFoot }) {
  return (u) => {
    const p = arm(u);
    const F0 = feetOf(R, p, { L: { dy: 0, lift: 0 }, R: { dy: 0, lift: 0 } }, plantedFoot), lead = F0.L[1] >= F0.R[1] ? 'L' : 'R';
    const at = { ...p, feet: feetOf(R, p, footworkAt(u, travel, lead), plantedFoot) };
    // (the least sink both legs reach with)
    for (let s = 0; s <= 0.3 + 1e-9; s += 0.01) { const q = s ? { ...at, sink: Math.round(((p.sink ?? 0) + s) * 1e4) / 1e4 } : at; if (legsReach(R, q, rigNodesAt)) return q; }
    return at;
  };
}
/**
 * THE ART'S REACH GUARD (a sword art's clips, `ctx.style` an art: SWING_STYLES with a `timing`): an art's keys stand at
 * the edge of what the legs reach (the least sink, the widest stance), so a moment between two keys, or a lunge out of
 * the art's wide stance, can outstretch a leg. Any sample that does sinks on until both reach (`sink`, at most 0.6 m),
 * and a stance with no footwork's feet is drawn in a step at a time. The realistic and the action clips never take it.
 */
const isArt = (style) => !!(style && SWING_STYLES[style] && SWING_STYLES[style].timing);
function reachGuard(fn, R, nodesAt) {
  const g = (u) => {
    const p = fn(u);
    if (p.support === 'none' || legsReach(R, p, nodesAt)) return p;
    for (let s = 0.005; s <= 0.6 + 1e-9; s += 0.005) { const q = { ...p, sink: Math.round(((p.sink ?? 0) + s) * 1e4) / 1e4 }; if (legsReach(R, q, nodesAt)) return q; }
    if (!p.feet) for (let st = (p.stance ?? 1) - 0.1; st >= 1 - 1e-9; st -= 0.1) for (let c = p.crouch ?? 0; c <= 0.45 + 1e-9; c += 0.02) { const q = { ...p, stance: Math.round(st * 100) / 100, crouch: Math.round(c * 1e4) / 1e4 }; if (legsReach(R, q, nodesAt)) return q; }
    return p;
  };
  for (const k of Object.keys(fn)) g[k] = fn[k];
  return g;
}
/**
 * AN AIR MOVE'S BODY (a moveset's `air` move, gameworld/combos.js: played in the air, a launch's or a jump's): the swing
 * or the strike as its arms and trunk play it, the feet off the floor (no support, no planted foot, no sink or step) and
 * the legs their own: TUCKED as it gathers, one kicking down and back through the blow while the other draws up, tucked
 * again after. `at` the blow's share of the move.
 */
const AIR_STRIP = ['feet', 'crouch', 'sink', 'heelL', 'heelR', 'shift', 'splayL', 'splayR', 'stance', 'stagger', 'toeTurnL', 'toeTurnR', 'lift', 'seat', 'seatL', 'seatR', 'weight'];
export const AIR_LEGS = Object.freeze({ tuck: { hipL: 55, kneeL: 95, hipR: 38, kneeR: 82 }, blow: { hipL: 14, kneeL: 28, hipR: 52, kneeR: 98 } });
const airEase = (x) => { const q = Math.max(0, Math.min(1, x)); return q * q * (3 - 2 * q); };
export function airBody(pose, u, at) {
  const o = {};
  for (const k of Object.keys(pose)) if (!AIR_STRIP.includes(k)) o[k] = pose[k];
  // (0 tucked … 1 at the blow: the kick lands with the blade, the tuck drawn back over the follow-through)
  const k = u <= at ? airEase(u / Math.max(at, 1e-6)) : 1 - airEase((u - at) / Math.max(1 - at, 1e-6)), T = AIR_LEGS.tuck, B = AIR_LEGS.blow, l = (a, b) => Math.round((a + (b - a) * k) * 100) / 100;
  o.support = 'none';
  o.hipL = { ...(pose.hipL || {}), pitch: l(T.hipL, B.hipL) }; o.hipR = { ...(pose.hipR || {}), pitch: l(T.hipR, B.hipR) };
  o.kneeL = l(T.kneeL, B.kneeL); o.kneeR = l(T.kneeR, B.kneeR);
  return o;
}
/**
 * The clip a move plays: { swing, travel?: { kind, m }, contact?, air? } at the hero's held class (an `air` move its
 * airBody: no feet on the floor, no footwork). ctx: { R, cls, base, grip,
 * contact (the rule's window), own (the hero's own cut word), body (the whole body over the swing), timing (a game
 * type's swingTiming, or null) } and the rig's functions { layeredClip, rigNodesAt, plantedFoot }, and the swing's
 * { swingClipKeys, fitSwing, swingPhases, HELD_SWINGS }.
 */
export function moveClip(move, ctx) {
  const { R, cls, base, grip, own, body, timing: T, layeredClip, rigNodesAt, plantedFoot, swingClipKeys, fitSwing, swingPhases, HELD_SWINGS } = ctx;
  const word = HELD_SWINGS[move.swing] ?? own;
  const keys0 = swingClipKeys(word, cls, { base, grip }), keys = body ? swingBody(word, cls, keys0, R, rigNodesAt, ctx.style ?? null) : keys0;
  const contact = move.contact ?? ctx.contact, from = contact[0];
  const play = layeredClip(keys, R), fit = fitSwing(T ? T.strike : swingPhases(keys.length).strike, from);
  const arm = T ? (u) => play(T.warp(fit(u))) : (u) => play(fit(u));
  // the travel as the runtime carries it (combat-melee.js: a step's to the window's start, a lunge's to its end)
  const tTo = move.travel ? Math.max(0.05, move.travel.kind === 'step' || move.travel.kind === 'dash' ? contact[0] : contact[1]) : 0;
  const travel = move.travel && move.travel.kind !== 'none' && move.travel.m > 0 ? { kind: move.travel.kind, m: move.travel.m, from: Math.min(move.travel.wait || 0, tTo * 0.5), to: tTo } : null;
  // (a DASH glides: its feet held in the stance while the runtime carries the body, no footwork)
  const fn0 = move.air ? (u) => airBody(arm(u), u, from) : travel && ctx.footwork && travel.kind !== 'dash' ? withFootwork(arm, travel, ctx) : arm;
  const fn = isArt(ctx.style) ? reachGuard(fn0, R, rigNodesAt) : fn0;
  fn.keys = 24;
  fn.move = { family: 'swing', word, hand: 'R', class: cls, strike: from, window: [from, contact[1]], ...(travel ? { travel } : {}), ...(move.air ? { air: true } : {}) };
  return fn;
}

/** THE FIGHTING STANCE (`mv_ready`): the stance a moveset's moves start and end in (the hero's own cut's ready key, the
 * whole body over it), held: the hero's idle in combat, so standing and striking share their feet. */
export function readyClip(ctx) {
  const { R, cls, base, grip, own, body, layeredClip, rigNodesAt, swingClipKeys } = ctx;
  const keys0 = swingClipKeys(own, cls, { base, grip }), ready = (body ? swingBody(own, cls, keys0, R, rigNodesAt, ctx.style ?? null) : keys0)[0];
  const play = layeredClip([ready], R), fn = (u) => play(u);
  fn.keys = 2;
  return fn;
}

// ─── the body's strikes: the fist's moves (hero-strike.js, hero-box.js) ─────────────────────────────────────────
/**
 * A move that plays a body's strike (`strike`: jab, cross from the punch solver; hook, uppercut from the boxing solver),
 * on the rig: the solver's own clip (its guard stance, its chain, its pivots and its feet), played over the move's length
 * by the runtime's phase, its footwork over it as a swing's (withFootwork: a planted foot held on the floor while the
 * runtime carries the body). ctx: { R, rigNodesAt, plantedFoot, footwork, solvers: { strike: heroStrike, box: heroBox } }.
 */
export const STRIKE_FAMILY = Object.freeze({ jab: 'strike', cross: 'strike', hook: 'box', uppercut: 'box' });
export function strikeMoveClip(move, ctx) {
  const K = ctx.solvers[STRIKE_FAMILY[move.strike]](move.strike, ctx.R), arm = (u) => K.clip.fn(Math.max(0, Math.min(1, u)));
  const contact = move.contact ?? [K.contact.t / K.seconds, Math.min(0.95, K.contact.t / K.seconds + 0.1)];
  const tTo = move.travel ? Math.max(0.05, move.travel.kind === 'step' ? contact[0] : contact[1]) : 0;
  const travel = move.travel && move.travel.kind !== 'none' && move.travel.m > 0 ? { kind: move.travel.kind, m: move.travel.m, from: Math.min(move.travel.wait || 0, tTo * 0.5), to: tTo } : null;
  const fn = move.air ? (u) => airBody(arm(u), u, contact[0]) : travel && ctx.footwork ? withFootwork(arm, travel, ctx) : arm;
  fn.keys = 24;
  fn.move = { family: 'strike', word: move.strike, hand: K.hand, strike: contact[0], window: [contact[0], contact[1]], ...(travel ? { travel } : {}), ...(move.air ? { air: true } : {}) };
  return fn;
}
/** The fist's fighting stance: its strikes' guard (the solved strike's first pose), held. */
export function strikeReadyClip(word, ctx) {
  const K = ctx.solvers[STRIKE_FAMILY[word]](word, ctx.R), p = K.clip.fn(0), fn = () => ({ ...p });
  fn.keys = 2;
  return fn;
}

// ─── the sidearms' aims: the archer's draw and the gunslinger's two guns (hero-stance.js, a stance's own words) ─────
/**
 * THE AIMS a moveset's sidearm plays while S holds it (gameworld/combos.js `ranged`), each a stance said in its own words
 * and solved by the stance solver (its feet, its balance, its eyes on the target, each hand reaching its place):
 *   • ARCHER (a draw: the bow). Side on, the bow arm's shoulder toward the target (a right-handed archer's left), the
 *     bow hand straight out on the target line at the anchor's height (the arrow level); the string hand from NOCKED (an
 *     arrow's length short of the bow hand) to ANCHORED (at the jaw), played by the draw's share (0 nocked … 1 full).
 *     The page turns the body above the hips onto the target itself (its pitch and yaw): the aim layer.
 *   • GUNSLINGER (an auto: two guns). Square, both arms straight out at the shoulders' height, a little in.
 *   • the GUARDS (SHIELD, COVER: a weapon's guard up, combat-melee.js stepGuard) are held stances of their own words.
 * Each hand's place is a share of the arm's length, so a short arm and a long one hold the same pose. `hand` the bow's
 * (or a single gun's) hand: 'left' (the default bow hand) mirrors a right-led stance. ctx: { R, stance: heroStance,
 * reachArm (hero-stance.js), rigNodesAt (station-loft-rig.js), elbowsDown (hero-elbow.js) }.
 */
export const AIM_POSES = Object.freeze({
  archer: Object.freeze({ spread: 0.5, line: 74, toes: { L: 82, R: 8 }, sink: 0.06, lean: 4, weight: 0.5, heel: 0, chest: 0.1, bow: { fwd: 0.93, up: 0.0 }, nock: 0.3, anchor: { fwd: 0.0, up: -0.02, side: -0.03 } }),
  gunslinger: Object.freeze({ spread: 0.5, line: 0, toes: { L: 10, R: -10 }, sink: 0.07, lean: 6, weight: 0.5, heel: 0, chest: 0, guns: { fwd: 0.97, up: 0, side: 0.06 } }),
  // THE GUARDS (combat-melee.js stepGuard: the pose while the guard is up), each held still. Their hands' `fwd` a share
  // of the arm's length. SHIELD (a blade's: the shield on the left arm out before the chest, the left side toward the
  // target, the sword hand low at its own side, ready); COVER (the fist's: both fists up before the face, the elbows in)
  shield: Object.freeze({ family: 'bladed', left: true, spread: 0.55, line: 35, toes: { L: 35, R: 5 }, sink: 0.1, lean: 10, weight: 0.55, heel: 0, chest: 0.4,
    hands: { R: { at: 'chest', fwd: 0.55, up: 0.05, side: 0, line: true, hand: 'grip' }, L: { at: 'navel', fwd: 0.2, up: 0.05, side: -0.3, hand: 'grip' } } }),
  cover: Object.freeze({ family: 'square', spread: 0.5, line: 0, toes: { L: 12, R: -12 }, sink: 0.1, lean: 14, weight: 0.5, heel: 0, chest: 0,
    hands: { R: { at: 'chin', fwd: 0.22, up: -0.02, side: 0.06, line: true, hand: 'fist' }, L: { at: 'chin', fwd: 0.22, up: -0.02, side: -0.06, line: true, hand: 'fist' } } }),
});
const DRAW_SAMPLES = 8;   // (the draw's string hand re-solved at every eighth of the way)
const armLength = (R, s) => { const J = R.joints, d = (a, b) => Math.hypot(J[a][0] - J[b][0], J[a][1] - J[b][1], J[a][2] - J[b][2]); return d(`shoulder${s}`, `elbow${s}`) + d(`elbow${s}`, `wrist${s}`); };
const stanceWords = (A, hands, family) => ({ family, spread: A.spread, line: A.line, toes: A.toes, sink: A.sink, lean: A.lean, weight: A.weight, heel: A.heel, chest: A.chest, hands, serves: [] });
export function aimClip(pose, ctx) {
  const { R, stance, rigNodesAt } = ctx, A = AIM_POSES[pose];
  if (!A) throw new Error(`hero-swing-body: no aim '${pose}' (have ${Object.keys(AIM_POSES).join(', ')})`);
  const arm = Math.min(armLength(R, 'R'), armLength(R, 'L')), left = (ctx.hand ?? 'left') === 'left';
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  if (pose === 'archer') {
    // (right-led: the right the bow hand, the left the string's; a left bow hand is its mirror)
    const bow = { at: 'leadShoulder', fwd: r4(A.bow.fwd * arm), up: A.bow.up, side: 0, line: true, hand: 'grip' };
    const D = stance(stanceWords(A, { R: bow, L: { at: 'chin', fwd: A.anchor.fwd, up: A.anchor.up, side: A.anchor.side, line: true, hand: 'grip' } }, 'bladed'), R, { left });
    const s = left ? 'R' : 'L', b = left ? 'L' : 'R', n = rigNodesAt(R, D.hold).nodes, anc = n[`wrist${s}`], sh = n[`shoulder${b}`];
    // THE ARROW LEVEL: the bow hand raised to the anchor's height (the jaw sits above the shoulder), out at the bow arm's
    // reach on the target line, so the arrow from the anchor to the bow points straight at the target, not into the floor
    // (a solved arm is posed elbows down, as the stance's own are: hero-elbow.js, a roll added on top of the solver's)
    const posed = (side, sol) => ({ [`sh${side}`]: ctx.elbowsDown(R, { [`sh${side}`]: sol.sh })[`sh${side}`], [`elbow${side}`]: sol.elbow });
    const reach = A.bow.fwd * arm, bx = n[`wrist${b}`][0], dx = bx - sh[0], dz = anc[2] - sh[2];
    const body = { ...D.hold, ...posed(b, ctx.reachArm(R, D.hold, b, [bx, sh[1] + Math.sqrt(Math.max(0, reach * reach - dx * dx - dz * dz)), anc[2]])) };
    // THE DRAW: the string hand pulled straight back along the arrow, from the nock (an arrow's length, `nock`, short of
    // the bow hand) to the anchor, each sample the string arm re-solved to its point on that line, so
    // the hand never arcs off it
    const bw = rigNodesAt(R, body).nodes[`wrist${b}`], L = Math.hypot(bw[0] - anc[0], bw[1] - anc[1], bw[2] - anc[2]);
    const a = [0, 1, 2].map((c) => bw[c] + ((anc[c] - bw[c]) * Math.min(A.nock, L)) / L);
    // (solved from the anchor out to the nock, each seeded by the one before it: one branch of the arm all the way, the
    // elbow never flipping between samples)
    const samples = [body]; let seed = null;
    for (let i = DRAW_SAMPLES - 1; i >= 0; i--) {
      const k = i / DRAW_SAMPLES, goal = [0, 1, 2].map((c) => a[c] + (anc[c] - a[c]) * k);
      const sol = ctx.reachArm(R, body, s, goal, seed); seed = sol;
      samples.unshift({ ...body, ...posed(s, sol) });
    }
    const fn = (u) => { const x = Math.max(0, Math.min(1, u)) * DRAW_SAMPLES, i = Math.min(DRAW_SAMPLES - 1, Math.floor(x)); return lerpPose(samples[i], samples[i + 1], x - i); };
    fn.keys = 12; fn.once = true;   // (a one-shot, its last key the full draw: a share of 1 holds there)
    fn.aim = { pose, string: s, checks: { drawn: D.checks } };
    return fn;
  }
  const G = A.guns, gun = (sd) => ({ at: 'shoulder', fwd: r4(G.fwd * arm), up: G.up, side: sd, hand: 'grip' });
  const own = (h) => ({ ...h, fwd: r4(h.fwd * arm) });
  const S = A.hands ? stance(stanceWords(A, { R: own(A.hands.R), L: own(A.hands.L) }, A.family), R, { left: !!A.left })
    : stance(stanceWords(A, { R: gun(-G.side), L: gun(G.side) }, 'square'), R);
  const p = S.hold, fn = () => ({ ...p });
  fn.keys = 2; fn.once = true;
  fn.aim = { pose, checks: { held: S.checks } };
  return fn;
}
/** two poses of the same shape mixed channel by channel (a number lerped, an object each of its numbers; else the first's) */
function lerpPose(a, b, k) {
  const mix = (x, y) => (typeof x === 'number' && typeof y === 'number' ? x + (y - x) * k : x && y && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries([...new Set([...Object.keys(x), ...Object.keys(y)])].map((c) => [c, mix(x[c] ?? (typeof y[c] === 'number' ? 0 : y[c]), y[c] ?? (typeof x[c] === 'number' ? 0 : x[c]))])) : Array.isArray(x) && Array.isArray(y) && x.length === y.length ? x.map((v, i) => mix(v, y[i])) : k < 0.5 ? x : y);
  return mix(a, b);
}

// ─── the run with the blade drawn: the sword arm carried, the other arm swinging (hero-motion.js gaits) ──────────────
/**
 * THE CARRY (a moveset's hero with a blade in hand: its walk, jog and sprint): the sword arm held out from the body,
 * trailing a little behind the hip, the blade aimed out and down and a little back, still through the stride but
 * for a small sway with it; the other arm, the legs and the trunk keep the gait's own. Solved once on the rig: the
 * shoulder's pitch, yaw and roll and the elbow searched for the hand's place and the blade's line, weighed alike (the
 * hand rides the forearm, so the blade's tip rides the forearm's frame; with no forearm twist and the shoulder's roll
 * at most 120°, the blade leans back only as far as the arm trails). ctx: { R, rigNodesAt, boneFrames, tip (the
 * blade's point at rest on the hand) }.
 */
export const CARRY = Object.freeze({ blade: [0.55, -0.45, -0.7], hand: { out: 0.18, back: -0.38, up: 0.16 }, sway: 4 });
export function carryArm(ctx) {
  const { R, rigNodesAt, boneFrames, tip } = ctx;
  const fi = R.bones.findIndex((b) => b.id === 'foreArmR' || (b.head === 'elbowR' && b.tail === 'wristR'));
  if (fi < 0 || !tip) return null;
  const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };
  const want = unit(CARRY.blade), J = R.joints, hipZ = (J.hipR ?? J[R.legs.R.hip])[2];
  const goal = [J.shoulderR[0] + CARRY.hand.out, J.shoulderR[1] + CARRY.hand.back, hipZ + CARRY.hand.up];
  const at = (x) => {
    const pose = { shR: { pitch: x[0], yaw: x[1], roll: x[2] }, elbowR: x[3] }, n = rigNodesAt(R, pose).nodes, F = boneFrames(R, J, n)[fi];
    const d = [0, 1, 2].map((c) => tip[c] - F.restHead[c]), p = [0, 1, 2].map((r) => F.head[r] + F.m[r][0] * d[0] + F.m[r][1] * d[1] + F.m[r][2] * d[2]);
    return { pose, n, dir: unit([p[0] - n.wristR[0], p[1] - n.wristR[1], p[2] - n.wristR[2]]) };
  };
  // (the blade's line and the hand's place weighed alike: the arm held out low at the side, never thrown back)
  const cost = (x) => { const A = at(x), w = A.n.wristR; return 4 * (1 - (A.dir[0] * want[0] + A.dir[1] * want[1] + A.dir[2] * want[2])) + 12 * ((w[0] - goal[0]) ** 2 + (w[1] - goal[1]) ** 2 + (w[2] - goal[2]) ** 2); };
  let best = null;
  for (let p = -30; p <= 60; p += 15) for (let y = -60; y <= 60; y += 20) for (let r = -180; r < 180; r += 30) for (let e = 0; e <= 90; e += 30) { const c = cost([p, y, r, e]); if (!best || c < best.c) best = { x: [p, y, r, e], c }; }
  for (const step of [8, 4, 2, 1, 0.5]) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < 4; i++) for (const s of [1, -1]) { const x = [...best.x]; x[i] += s * step; x[3] = Math.max(0, Math.min(150, x[3])); const c = cost(x); if (c < best.c - 1e-12) { best = { x, c }; moved = true; } }
    }
  }
  const A = at(best.x), r1 = (v) => Math.round(v * 10) / 10;
  return { shR: { pitch: r1(best.x[0]), yaw: r1(best.x[1]), roll: r1(best.x[2]) }, elbowR: r1(best.x[3]), blade: A.dir.map((v) => Math.round(v * 1e3) / 1e3), hand: A.n.wristR.map((v) => Math.round(v * 1e3) / 1e3), goal };
}
/** a gait (its clip: keys or a function of the phase) with the sword arm carried: the arm's angles over the gait's, a
 * small sway with the stride; the other channels the gait's own */
export function carryClip(gait, arm, layeredClip, R) {
  const base = typeof gait === 'function' ? gait : layeredClip(gait, R);
  const fn = (u) => { const p = base(u); return { ...p, shR: { ...arm.shR, pitch: Math.round((arm.shR.pitch + CARRY.sway * Math.sin(2 * Math.PI * u)) * 100) / 100 }, elbowR: arm.elbowR }; };
  fn.keys = typeof gait === 'function' ? gait.keys ?? 24 : 24;
  for (const k of ['once', 'move', 'held', 'air', 'stop', 'rest']) if (typeof gait === 'function' && gait[k] !== undefined) fn[k] = gait[k];
  return fn;
}
