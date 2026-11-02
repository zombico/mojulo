/**
 * coverage — a scene SHOT as a director covers it: the camera setups and the cuts between them, from where the actors
 * stand and whom they face (scene.js), in the shoot plan's own shape (shoot/plan.js normalizeShoot: cameras keyed in
 * time, shots that cut between them), so whatever plays or exports a shoot plan takes a scene's coverage.
 *
 *   frameShot(frame, subjects, { side, lookH, fov, heading }) → { pos, poi, fov }   one framing (the scenes card's own
 *     geometry, worlds/controllable/rules-basic.js `shot`: FRAMES's room round the subjects, height and yaw off the
 *     facing; `over` the first seen past the second's shoulder), pure: points [x, y, z] in metres, z up, the heading in
 *     radians from +x
 *   coverScene(S) → { cameras, shots } the scene's coverage:
 *     an establishing WIDE on everyone; each line OVER the shoulder of the one it is spoken to onto the speaker, or
 *     CLOSE on the speaker where the line has a face of its own (a parenthetical); back to the WIDE on a cross; the
 *     cameras on one side of the line all scene (the 180° rule: the side the first wide stands on); a camera a setup
 *     (the wide, and an over and a close for each actor), re-keyed where its shot is
 *
 * Pure and deterministic.
 */

/** the framings: room round the subjects (m), height over the look point (m), yaw off the facing (quarter turns): the
 * scenes card's (rules-basic.js FRAMES, held equal by coverage.test.js) */
export const FRAMES = Object.freeze({ wide: [5, 2.2, 0], low: [1.6, -0.8, 0], profile: [1.2, 0.2, 1], corner: [3, 3.5, 0.5], overhead: [2.5, 0, 0], two: [0.8, 0.35, 0], close: [0.35, 0.1, 0.25] });
/** the look point's height over the subjects' feet (m), the field of view (degrees), an over's place past the shoulder
 * (m back, m aside, m over the look point): the scenes card's */
export const LOOK_H = 1.4, FOV = 50, OVER = Object.freeze({ back: 1.1, aside: 0.45, up: 0.15 });
/** a close's look point over the feet (m): the eyes, not the chest */
export const CLOSE_LOOK = 1.52;
/** the film back the cameras' focal lengths are given for (mm: the shoot plan's), and the least time a shot holds (s) */
export const FILM = 36, LEAST = 1.2;
/** the establishing wide's hold at the scene's start (s, at most) */
export const ESTABLISH = 2.5;

const r3 = (v) => Math.round(v * 1000) / 1000;
const HALF_PI = Math.PI / 2;
const fwd = (y) => [Math.cos(y), Math.sin(y)], right = (y) => [Math.sin(y), -Math.cos(y)];

/** One framing (see the header) */
export function frameShot(frame, subjects, { side = 1, lookH = LOOK_H, fov = FOV, heading = 0 } = {}) {
  if (!subjects.length) throw new Error('coverage: a shot frames one subject at least');
  const P = subjects.map((p) => [p[0], p[1], p[2] ?? 0]);
  if (frame === 'over' && P.length >= 2) {
    const [A, B] = P, yaw = Math.atan2(B[1] - A[1], B[0] - A[0]), f = fwd(yaw), rt = right(yaw);
    return { pos: [B[0] + f[0] * OVER.back + rt[0] * OVER.aside * side, B[1] + f[1] * OVER.back + rt[1] * OVER.aside * side, B[2] + lookH + OVER.up].map(r3), poi: [A[0], A[1], A[2] + lookH].map(r3), fov };
  }
  const cx = P.reduce((s, p) => s + p[0], 0) / P.length, cy = P.reduce((s, p) => s + p[1], 0) / P.length, cz = P.reduce((s, p) => s + p[2], 0) / P.length + lookH;
  const spread = Math.max(...P.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
  const [room, rise, off] = FRAMES[frame] ?? FRAMES.wide;
  const face = P.length >= 2 ? Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]) - HALF_PI * side : heading;
  const yaw = face + off * HALF_PI * side, dist = Math.max(1.2, (spread + room) / Math.tan((fov * Math.PI) / 360)), f = fwd(yaw);
  const pos = frame === 'overhead' ? [cx + f[0] * dist * 0.3, cy + f[1] * dist * 0.3, cz + dist] : [cx + f[0] * dist, cy + f[1] * dist, cz + rise];
  return { pos: pos.map(r3), poi: [cx, cy, cz].map(r3), fov };
}

/** a field of view (degrees, horizontal) as a focal length on FILM */
export const focalOf = (fov) => r3(FILM / (2 * Math.tan((fov * Math.PI) / 360)));

/** The scene's coverage (see the header) */
export function coverScene(S) {
  const names = Object.keys(S.actors), smooth = (u) => u * u * (3 - 2 * u), wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
  const placeAt = (w, s) => { const K = S.actors[w].root; if (s <= K[0].t) return K[0]; for (let k = 1; k < K.length; k++) if (s <= K[k].t) { const a = K[k - 1], c = K[k], u = (s - a.t) / Math.max(1e-6, c.t - a.t); return { x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u, yaw: a.yaw + wrap(c.yaw - a.yaw) * smooth(u) }; } return K.at(-1); };
  const pt = (w, s) => { const P = placeAt(w, s); return [P.x, P.y, 0]; };
  const heading = (w, s) => ((90 - placeAt(w, s).yaw) * Math.PI) / 180;   // (the actor's yaw, 0 facing +y, as a heading from +x)
  // THE SIDE OF THE LINE, kept all scene (the 180° rule): the side the first wide stands on, the side of the first two
  // actors' line the set opens to (−y, where a first camera stands with no other word); carried as the line turns (an
  // actor crosses), so each shot stands on the same side of the line as it is then
  const n0 = (() => { if (names.length < 2) return [0, -1]; const a = pt(names[0], 0), b = pt(names[1], 0), d = [b[0] - a[0], b[1] - a[1]], p = [-d[1], d[0]]; return p[1] <= 0 ? p : [-p[0], -p[1]]; })();
  const sideAt = (s) => { if (names.length < 2) return n0; const a = pt(names[0], s), b = pt(names[1], s), d = [b[0] - a[0], b[1] - a[1]], p = [-d[1], d[0]], l = Math.hypot(...p) || 1; return (p[0] * n0[0] + p[1] * n0[1] >= 0 ? [p[0] / l, p[1] / l] : [-p[0] / l, -p[1] / l]); };
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
  // (each framing's own ±: the one that puts its camera on the scene's side)
  const wideSide = (s) => { if (names.length < 2) return 1; const a = pt(names[0], s), b = pt(names[1], s), f = (sd) => fwd(Math.atan2(b[1] - a[1], b[0] - a[0]) - HALF_PI * sd); return dot(f(1), sideAt(s)) >= 0 ? 1 : -1; };
  const overSide = (A, B, s) => { const a = pt(A, s), b = pt(B, s); return dot(right(Math.atan2(b[1] - a[1], b[0] - a[0])), sideAt(s)) >= 0 ? 1 : -1; };
  const closeSide = (w, s) => { const h = heading(w, s), turn = (sd) => fwd(h + FRAMES.close[2] * HALF_PI * sd); return dot(turn(1), sideAt(s)) >= dot(turn(-1), sideAt(s)) ? 1 : -1; };
  // ─── the cuts: a wide to open, a line's over or close, the wide again on a cross ────────────────────────────────────
  const cuts = [{ t: 0, frame: 'wide', on: names }];
  const crosses = names.flatMap((w) => S.actors[w].walks.map((x) => ({ who: w, start: x.start, end: x.end })));
  const events = [
    ...S.turns.map((T) => ({ t: T.at, T })),
    ...crosses.map((c) => ({ t: c.start - 0.6, cross: c })),
  ].sort((a, b) => a.t - b.t);
  for (const e of events) {
    if (e.cross) { cuts.push({ t: Math.max(0, e.t), frame: 'wide', on: names, why: `${e.cross.who} crosses` }); continue; }
    const T = e.T, to = S.actors[T.who] && names.find((w) => w !== T.who && S.actors[w]) ? addresseeOf(S, T) : null;
    // (the opening wide holds a while before the first line cuts in)
    const t = cuts.length === 1 ? Math.min(Math.max(T.at, ESTABLISH), T.end) : T.at;
    cuts.push(T.face || !to ? { t, frame: 'close', on: [T.who], why: T.face ? `${T.who}, ${T.face}` : T.who } : { t, frame: 'over', on: [T.who, to], why: `${T.who} to ${to}` });
  }
  // (a cut that would hold less than LEAST is folded into the one before; the same framing twice in a row is one shot)
  const kept = [];
  for (const c of cuts.sort((a, b) => a.t - b.t)) {
    const last = kept.at(-1);
    if (last && (c.t - last.t < LEAST || (c.frame === last.frame && c.on.join() === last.on.join()))) { if (c.t - last.t < LEAST && c.frame !== last.frame) Object.assign(last, { ...c, t: last.t }); continue; }
    kept.push({ ...c });
  }
  // ─── the setups: one camera each, keyed where its shots are ───────────────────────────────────────────────────────
  const cams = new Map(), shots = [];
  kept.forEach((c, i) => {
    const t0 = r3(c.t), t1 = r3(kept[i + 1]?.t ?? S.seconds), mid = (t0 + t1) / 2;
    const id = c.frame === 'wide' ? 'wide' : `${c.frame}-${c.on[0]}`;
    const at = (s) => (c.frame === 'over' ? frameShot('over', [pt(c.on[0], s), pt(c.on[1], s)], { side: overSide(c.on[0], c.on[1], s) })
      : c.frame === 'close' ? frameShot('close', [pt(c.on[0], s)], { heading: heading(c.on[0], s), side: closeSide(c.on[0], s), lookH: CLOSE_LOOK })
        : frameShot('wide', names.map((w) => pt(w, s)), { side: wideSide(s) }));
    // (a wide over a cross keeps everyone in frame from where it starts to where it ends; another holds where it cut)
    const a = at(t0), b = c.frame === 'wide' ? at(t1) : a;
    const cam = cams.get(id) ?? { id, name: c.frame === 'wide' ? 'the wide' : `${c.frame} on ${c.on[0]}`, type: 'two_node', film_mm: FILM, path: 'linear', keys: [] };
    cam.keys.push({ t: t0, pos: a.pos, poi: a.poi, focal_mm: focalOf(a.fov) }, { t: r3(Math.max(t0 + 0.001, t1 - 0.001)), pos: b.pos, poi: b.poi, focal_mm: focalOf(b.fov) });
    cams.set(id, cam);
    shots.push({ name: `${i + 1} ${c.frame}${c.why ? `: ${c.why}` : ''}`, camera: id, span: [t0, t1] });
    void mid;
  });
  return { fps: 24, cameras: [...cams.values()], shots };
}

/** whom a line is spoken to (scene.js's rule: the next line's speaker, else the last's, else the first other) */
function addresseeOf(S, T) {
  const i = S.turns.indexOf(T), nx = S.turns.slice(i + 1).find((x) => x.who !== T.who), pv = S.turns.slice(0, i).reverse().find((x) => x.who !== T.who);
  return nx?.who ?? pv?.who ?? Object.keys(S.actors).find((w) => w !== T.who);
}
