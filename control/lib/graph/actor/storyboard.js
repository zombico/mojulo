/**
 * storyboard — a SCENE's coverage drawn: a panel a shot, where the person approves the film before anything is minted or
 * rendered. A panel IS a coverage shot (coverage.js), so the board never disagrees with the film the same plan makes in
 * Blender (scene-film.js); nothing here is stored, it is drawn from the scene on every forge.
 *
 *   THE FRAME: stand-in MANNEQUINS (field terms: legs, trunk, shoulders, arms, neck, head and a nose for its facing,
 *   scaled to the part's height) stood where the scene has them at the panel's moment, seen from the coverage camera and
 *   drawn by the book press's drawn plate (book/drawn-plate.js, a wash). The plate's station turns 1 to 89 degrees off
 *   the y axis, so the WORLD is turned about the vertical until the camera stands at 45 (the picture is the same); its
 *   eye is level, so a pitched camera is drawn as a rising or falling front (the horizon moves): exact for a level camera,
 *   near for a high or a low one. On a set with a WALLED room (a decorated room: interior/places.js) the room is drawn
 *   round them: its walls with their doors and windows cut through, and each piece that stands on its floor, as plain
 *   blocks at their heights. On ANY other set what stands on its ground is drawn the same way (`blocks`, read from
 *   the world's faces: actor/ground.js), so a scene is boarded in whatever the world is.
 *   THE BLOCKING: the scene from above at one scale for every panel, the room the actors use: a set's rooms (set.js) and what stands on their floors, the
 *   marks inside it, each actor at the moment and its way through the shot, the camera and its field of view.
 *   THE WORDS: the shot's number, name, span (the scene's seconds and the screen's), lens and move; the lines (a recorded
 *   one marked) and the crosses inside it; the director's notes whose moment falls in it (notes.js), the rest the board's own.
 *
 *   storyboardOf(S, coverage, { notes?, title?, width?, height?, res?, fps?, heights?, rooms?, set? }) → { title, seconds, screen, panels, notes }
 *     each panel { n, name, camera, span, screen: [start, length], at, lens_mm, move, lines, crosses, notes, frame
 *     (svg), blocking (svg) }
 *   storyboardJson(board) → the board without its drawings (storyboard.json)
 *   storyboardHtml(board) → one self-contained page (no script, no link out)
 *   animaticSegments(board) → [{ panel, seconds, caption }]: each panel held its shot's length on screen, cut where a
 *     line starts or ends, the line spoken under it
 *   animaticFrameSvg(board, segment, { width?, height? }) → one frame of the animatic: the panel, its number and name,
 *     the caption
 *   mannequinForms(S, t, { tints?, turn? }) → the plate's forms; panelStation(framing) → { turn, station }
 *   groundForms(blocks, { turn?, about? }) → what stands on any set's ground (actor/ground.js) as the plate's forms
 *   roomForms(rooms, { turn?, about? }) → a walled room's walls and standing pieces as the plate's forms
 *
 * Pure and deterministic: the same scene and coverage give the same bytes.
 */
import { placeOn } from './scene.js';
import { coverageCameraAt } from './scene-film.js';
import { programOf } from '../shoot/sample.js';
import { renderPlate } from '../book/drawn-plate.js';

export const STORYBOARD_VERSION = 'storyboard/0';
/** a panel's frame, in the plate's units (16:9) */
export const PANEL_SIZE = Object.freeze({ width: 480, height: 270 });
/** each actor's tint on the board, in cast order */
export const BOARD_TINTS = Object.freeze(['#c49a74', '#7f9cc4', '#9cb07a', '#b8869f', '#c9b46a', '#86b2ad']);
const STATURE = 1.7;
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

/** The plate's station for a coverage camera's framing: the world turned so the camera stands at 45 degrees */
export function panelStation(framing, { square = false } = {}) {
  const [px, py, pz] = framing.cameraPosition, [lx, ly, lz] = framing.lookAt;
  const turn = deg(Math.atan2(lx - px, ly - py));
  // (`square`: a set is drawn with the cast. Its walls and blocks lie along the world's axes, and stay boxes when the
  // world is turned by quarter turns only: the station takes the rest, kept inside the plate's 1 to 89 degrees)
  const world = square ? 90 * Math.round((45 - turn) / 90) : 45 - turn;
  return {
    turn: world,
    station: { turn: square ? r3(Math.min(89, Math.max(1, turn + world))) : 45, eye: r3(pz), distance: r3(Math.max(0.05, Math.hypot(lx - px, ly - py))), lens: r3(Math.min(100, Math.max(10, framing.horizontalFov))), look: [0, 0, r3(lz)] },
  };
}

/** a point turned about the vertical by d degrees (clockwise seen from above: +y toward +x) and moved by o */
function turner(d, about) {
  const a = rad(d), c = Math.cos(a), s = Math.sin(a);
  return (x, y) => { const X = x - about[0], Y = y - about[1]; return [r3(X * c + Y * s), r3(-X * s + Y * c)]; };
}

/** One actor as a mannequin at a place and a facing (yaw 0 faces +y, turning toward +x), `h` its stature */
function mannequinTerms(P, h, turn) {
  const s = h / STATURE, a = rad(P.yaw), f = [Math.sin(a), Math.cos(a)], r = [Math.cos(a), -Math.sin(a)];
  const at = (side, fwd, z) => { const [x, y] = turn(P.x + r[0] * side * s + f[0] * fwd * s, P.y + r[1] * side * s + f[1] * fwd * s); return [x, y, r3(z * s)]; };
  const capsule = (a1, b1, radius) => ({ op: 'add', shape: { kind: 'capsule', a: a1, b: b1, radius: r3(radius * s) } });
  const sphere = (center, radius) => ({ op: 'add', shape: { kind: 'sphere', center, radius: r3(radius * s) } });
  return [
    capsule(at(-0.09, 0, 0.08), at(-0.09, 0, 0.84), 0.065),
    capsule(at(0.09, 0, 0.08), at(0.09, 0, 0.84), 0.065),
    capsule(at(0, 0, 0.92), at(0, 0, 1.28), 0.14),
    capsule(at(-0.19, 0, 1.35), at(0.19, 0, 1.35), 0.07),
    capsule(at(-0.23, 0, 1.33), at(-0.25, 0.02, 0.86), 0.048),
    capsule(at(0.23, 0, 1.33), at(0.25, 0.02, 0.86), 0.048),
    capsule(at(0, 0, 1.38), at(0, 0, 1.48), 0.05),
    sphere(at(0, 0, 1.585), 0.11),
    sphere(at(0, 0.1, 1.57), 0.034),
  ];
}

/** The plate's forms: each actor a mannequin where the scene has it at t, the world turned by `turn` degrees about `about` */
export function mannequinForms(S, t, { tints = BOARD_TINTS, turn = 0, about = [0, 0], heights = {} } = {}) {
  const T = turner(turn, about);
  return Object.entries(S.actors).map(([w, A], i) => ({
    id: w, tint: tints[i % tints.length],
    terms: mannequinTerms(placeOn(A.root, t), heights[w] ?? STATURE, T),
  }));
}

/** An upright box between two corners of the floor and two heights, the world turned by `T` (a quarter turn or
 * none: panelStation `square`), as the plate's box */
function boxShape(T, min, max, z0, z1) {
  const a = T(min[0], min[1]), b = T(max[0], max[1]);
  return { kind: 'box', center: [r3((a[0] + b[0]) / 2), r3((a[1] + b[1]) / 2), r3((z0 + z1) / 2)], size: [r3(Math.abs(b[0] - a[0])), r3(Math.abs(b[1] - a[1])), r3(z1 - z0)] };
}

/** the board's tints for a room's walls and for what stands in it */
export const ROOM_TINTS = Object.freeze({ wall: '#d8d2c4', piece: '#a8a091' });
const WALL_THICK = 0.1;
/** the light's height inside a walled room, degrees */
const INDOOR_LIGHT = 75;

/**
 * A walled room as the plate's forms (a set's room: set.js `walled`, `h`, `blocks`): its four walls, a door or a window cut through the wall it lies on, and every piece that
 * stands on its floor at its height, each an upright prism, the world turned as the mannequins are. A room with no
 * walls, or a piece with no height, is not drawn.
 */
export function roomForms(rooms = [], { turn = 0, about = [0, 0] } = {}) {
  const T = turner(turn, about), out = [];
  const prism = (id, tint, min, max, z0, z1) => ({ id, tint, tintOpacity: 0.35, terms: [{ op: 'add', shape: boxShape(T, min, max, z0, z1) }] });
  for (const R of rooms) {
    if (!R.walled || !(R.h > 0)) continue;
    const z = R.z ?? 0, [x0, y0] = R.min, [x1, y1] = R.max, w = WALL_THICK;
    const walls = { s: [[x0 - w, y0 - w], [x1 + w, y0]], n: [[x0 - w, y1], [x1 + w, y1 + w]], w: [[x0 - w, y0], [x0, y1]], e: [[x1, y0], [x1 + w, y1]] };
    // (a door or a window is cut through the wall it lies on)
    const holes = { s: [], n: [], w: [], e: [] }, near = (a, b) => Math.abs(a - b) < 0.02, cut = w + 0.05;
    for (const O of R.openings ?? []) {
      const flat = near(O.min[1], O.max[1]), side = flat ? (near(O.min[1], y0) ? 's' : near(O.min[1], y1) ? 'n' : null) : near(O.min[0], O.max[0]) ? (near(O.min[0], x0) ? 'w' : near(O.min[0], x1) ? 'e' : null) : null;
      if (!side || !(O.head > O.sill)) continue;
      const lo = flat ? [O.min[0], O.min[1] - cut] : [O.min[0] - cut, O.min[1]], hi = flat ? [O.max[0], O.max[1] + cut] : [O.max[0] + cut, O.max[1]];
      holes[side].push({ ...prism('', '', lo, hi, z + O.sill, z + O.head).terms[0], op: 'subtract' });
    }
    for (const [side, [lo, hi]] of Object.entries(walls)) { const W = prism(`${R.id}-wall-${side}`, ROOM_TINTS.wall, lo, hi, z, z + R.h); W.terms.push(...holes[side]); out.push(W); }
    for (const [i, B] of (R.blocks ?? []).entries()) if (B.h > 0) out.push(prism(`${R.id}-piece-${i + 1}`, ROOM_TINTS.piece, B.min, B.max, z, z + B.h));
  }
  return out;
}

/** how far from what a panel looks at the set's ground is drawn (m), and the most blocks a panel draws */
const GROUND_REACH = 10, GROUND_MOST = 24;

/**
 * What stands on ANY set's ground as the plate's forms (actor/ground.js `blocks`, read from the world's faces): each
 * an upright prism at its height, the nearest GROUND_MOST within GROUND_REACH of what the panel looks at, turned as
 * the mannequins are. One form: the ground reads as one thing behind the cast.
 */
export function groundForms(blocks = [], { turn = 0, about = [0, 0] } = {}) {
  const T = turner(turn, about), far = (B) => Math.hypot(Math.max(B.min[0] - about[0], 0, about[0] - B.max[0]), Math.max(B.min[1] - about[1], 0, about[1] - B.max[1]));
  const near = blocks.filter((B) => B.h > 0 && far(B) <= GROUND_REACH).map((B, i) => ({ B, i, d: far(B) })).sort((a, b) => a.d - b.d || a.i - b.i).slice(0, GROUND_MOST).sort((a, b) => a.i - b.i);
  if (!near.length) return [];
  return [{
    id: 'ground', tint: ROOM_TINTS.piece, tintOpacity: 0.35,
    terms: near.map(({ B }) => ({ op: 'add', shape: boxShape(T, B.min, B.max, 0, B.h) })),
  }];
}

/** the camera keys a shot holds: the first and the last */
function shotKeys(coverage, s) {
  const cam = coverage.cameras.find((c) => c.id === s.camera);
  const ks = cam.keys.filter((k) => k.t >= s.span[0] - 1e-3 && k.t <= s.span[1] + 1e-3);
  return { cam, a: ks[0], b: ks.at(-1) };
}

/** what the camera does through a shot, in a director's words */
function moveOf(a, b) {
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const travel = d(a.pos, b.pos), aim = d(a.poi, b.poi), zoom = Math.abs((b.focal_mm ?? 0) - (a.focal_mm ?? 0));
  if (travel < 0.05 && aim < 0.05 && zoom < 1) return 'holds';
  const parts = [];
  if (travel >= 0.05) parts.push(`moves ${r2(travel)} m`);
  else if (aim >= 0.05) parts.push('pans');
  if (zoom >= 1) parts.push(`zooms to ${Math.round(b.focal_mm)} mm`);
  return parts.join(', ');
}

/** the mark a point stands on, by name, else the point */
const markAt = (marks, p) => Object.entries(marks ?? {}).find(([, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-3)?.[0] ?? `[${r2(p[0])}, ${r2(p[1])}]`;

/** The board: a panel a coverage shot */
export function storyboardOf(S, coverage, { notes = [], title = 'scene', width = PANEL_SIZE.width, height = PANEL_SIZE.height, res = undefined, fps = 24, heights = {}, rooms = [], blocks = [], set = null } = {}) {
  const program = programOf({ ...coverage, fps });
  const names = Object.keys(S.actors);
  const tintOf = Object.fromEntries(names.map((w, i) => [w, BOARD_TINTS[i % BOARD_TINTS.length]]));
  const placed = [];
  // (inside walls the light comes from above, as a ceiling's does: a low sun would lay the walls' shadow over the cast)
  const indoors = rooms.some((R) => R.walled && R.h > 0), drawn = indoors || blocks.some((B) => B.h > 0);
  const panels = coverage.shots.map((s, k) => {
    const [s0, s1] = s.span, at = r3(Math.min(S.seconds - 1e-3, (s0 + s1) / 2));
    const { framing } = coverageCameraAt(coverage, at, s);
    const { a, b, cam } = shotKeys(coverage, s);
    const { turn, station } = panelStation(framing, { square: drawn });
    const about = framing.lookAt.slice(0, 2);
    // (a walled room is drawn round them: its walls and what stands in it; any other set stays open ground)
    const forms = [...roomForms(rooms, { turn, about }), ...groundForms(blocks, { turn, about }), ...mannequinForms(S, at, { turn, about, heights })];
    const { svg } = renderPlate({ forms, station, finish: 'wash', frame: 'full', width, height, light: { azimuth: -50, elevation: indoors ? INDOOR_LIGHT : 40 } }, { prefix: `sb${k + 1}-`, ...(res ? { res } : {}) });
    const P = program.shots[k];
    placed.push({ framing, a, b });
    return {
      n: k + 1, name: s.name, camera: cam.id, span: [r3(s0), r3(s1)], screen: [r3(P.start), r3(P.length)], at,
      lens_mm: Math.round(a.focal_mm ?? 35), move: moveOf(a, b),
      lines: S.turns.filter((T) => T.at < s1 && T.end > s0).map((T) => ({ who: T.who, text: T.text, at: T.at, end: T.end, ...(T.face ? { face: T.face } : {}), ...(T.recording ? { recording: T.recording } : {}) })),
      crosses: names.flatMap((w) => (S.actors[w].walks ?? []).filter((W) => W.start < s1 && W.end > s0).map((W) => ({ who: w, to: W.toward ?? markAt(S.marks, W.to), start: W.start, end: W.end }))),
      notes: notes.filter((N) => N.at !== undefined && N.at >= s0 && (N.at < s1 || k === coverage.shots.length - 1)),
      frame: svg,
    };
  });
  // (the blocking at one scale for every panel: the marks, every place an actor stands, every camera)
  // (the room the actors use, at least 3 m by 2 m: a camera beyond it is drawn on its edge, pointing in)
  // (a set's many places: only where the actors stand and walk sets the room; a mark or a set's room inside it is drawn)
  const pts = names.flatMap((w) => S.actors[w].root.map((K) => [K.x, K.y]));
  const bx = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))], by = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const half = [Math.max(1.5, (bx[1] - bx[0]) / 2 + 0.9), Math.max(1, (by[1] - by[0]) / 2 + 0.9)];
  // (a plan between two wide to one and square: a long cross widens it rather than towering it)
  half[0] = Math.max(half[0], half[1]); half[1] = Math.max(half[1], half[0] / 2);
  const mid = [(bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2];
  const box = { x0: mid[0] - half[0], x1: mid[0] + half[0], y0: mid[1] - half[1], y1: mid[1] + half[1] };
  panels.forEach((pn, k) => { pn.blocking = blockingSvg(S, pn, placed[k], box, tintOf, rooms, blocks); });
  return {
    version: STORYBOARD_VERSION, title, seconds: S.seconds, screen: r3(program.total), cast: names, tints: tintOf,
    ...(set ? { set: { ...set, ...(indoors ? { drawn: true } : blocks.some((B) => B.h > 0) ? { ground: true } : {}) } } : {}),
    panels, notes: notes.filter((N) => N.at === undefined),
  };
}

/** The scene from above for one panel: the marks, each actor at the moment and its way through the shot, the camera */
export function blockingSvg(S, panel, { framing }, box, tintOf, rooms = [], blocks = []) {
  const W = 220, sc = W / (box.x1 - box.x0), H = Math.round((box.y1 - box.y0) * sc);
  const X = (x) => r2((x - box.x0) * sc), Y = (y) => r2((box.y1 - y) * sc);
  const out = [];
  // (the set's rooms from above, as far as the panel's room shows them)
  for (const R of rooms) if (R.max[0] > box.x0 && R.min[0] < box.x1 && R.max[1] > box.y0 && R.min[1] < box.y1) out.push(`<rect class="room" x="${X(R.min[0])}" y="${Y(R.max[1])}" width="${r2((R.max[0] - R.min[0]) * sc)}" height="${r2((R.max[1] - R.min[1]) * sc)}"/>`);
  // (a door is a gap in the wall, a window a thin line across one)
  for (const R of rooms) for (const O of R.openings ?? []) out.push(`<path class="${O.kind === 'door' ? 'door' : 'window'}" d="M${X(O.min[0])} ${Y(O.min[1])}L${X(O.max[0])} ${Y(O.max[1])}"/>`, ...(O.kind === 'door' ? [] : [`<path class="pane" d="M${X(O.min[0])} ${Y(O.min[1])}L${X(O.max[0])} ${Y(O.max[1])}"/>`]));
  // (and what stands on their floors)
  for (const R of [...rooms, { blocks }]) for (const B of R.blocks ?? []) if (B.max[0] > box.x0 && B.min[0] < box.x1 && B.max[1] > box.y0 && B.min[1] < box.y1) out.push(`<rect class="piece" x="${X(B.min[0])}" y="${Y(B.max[1])}" width="${r2((B.max[0] - B.min[0]) * sc)}" height="${r2((B.max[1] - B.min[1]) * sc)}"/>`);
  const inBox = (p) => p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1;
  // (a furnished room names a place by every piece: only the places a cross goes to are written, the pieces are drawn)
  const furnished = rooms.some((R) => R.blocks?.length);
  const gone = new Set(Object.values(S.actors).flatMap((A) => (A.walks ?? []).map((W) => W.toward ?? markAt(S.marks, W.to))));
  for (const [m, p] of Object.entries(S.marks ?? {}).filter(([m, p]) => inBox(p) && (!furnished || gone.has(m)))) out.push(`<g class="mark"><path d="M${X(p[0]) - 4} ${Y(p[1]) - 4}l8 8m0-8l-8 8"/><text x="${X(p[0]) + 6}" y="${Y(p[1]) + 3}">${esc(m)}</text></g>`);
  // the camera: where it stands, where it looks, its field of view
  const [lx, ly] = framing.lookAt, aim = Math.atan2(lx - framing.cameraPosition[0], ly - framing.cameraPosition[1]), half = rad(framing.horizontalFov / 2), L = 1.2;
  // (a camera outside the room stands on its edge, on the line from what it looks at; the room's edge less a margin)
  const m = 0.12, inside = (u) => { const x = lx + (framing.cameraPosition[0] - lx) * u, y = ly + (framing.cameraPosition[1] - ly) * u; return x >= box.x0 + m && x <= box.x1 - m && y >= box.y0 + m && y <= box.y1 - m; };
  let u = 1; while (u > 0 && !inside(u)) u -= 0.02;
  const cx = lx + (framing.cameraPosition[0] - lx) * Math.max(0, u), cy = ly + (framing.cameraPosition[1] - ly) * Math.max(0, u), off = u < 1;
  const ray = (d) => `L${X(cx + Math.sin(aim + d) * L)} ${Y(cy + Math.cos(aim + d) * L)}`;
  out.push(`<g class="cam${off ? ' off' : ''}"><path class="fov" d="M${X(cx)} ${Y(cy)}${ray(-half)}M${X(cx)} ${Y(cy)}${ray(half)}"/><circle cx="${X(cx)}" cy="${Y(cy)}" r="4"/></g>`);
  for (const [w, A] of Object.entries(S.actors)) {
    const ks = A.root.filter((K) => K.t > panel.span[0] && K.t < panel.span[1]);
    const way = [placeOn(A.root, panel.span[0]), ...ks, placeOn(A.root, panel.span[1])];
    if (way.some((p) => Math.hypot(p.x - way[0].x, p.y - way[0].y) > 0.05)) out.push(`<path class="way" stroke="${tintOf[w]}" d="M${way.map((p) => `${X(p.x)} ${Y(p.y)}`).join('L')}"/>`);
    const P = placeOn(A.root, panel.at), a = rad(P.yaw);
    out.push(`<g class="who"><circle cx="${X(P.x)}" cy="${Y(P.y)}" r="6" fill="${tintOf[w]}"/><path d="M${X(P.x)} ${Y(P.y)}l${r2(Math.sin(a) * 11)} ${r2(-Math.cos(a) * 11)}"/><text x="${X(P.x)}" y="${Y(P.y) + 17}">${esc(w)}</text></g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="blocking" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="the blocking from above">${out.join('')}</svg>`;
}

/** The board without its drawings: what storyboard.json keeps */
export function storyboardJson(board) {
  return { ...board, panels: board.panels.map(({ frame, blocking, ...p }) => p) };
}

const UPPER = (w) => String(w).toUpperCase();
/** a shot's name without the number the coverage gives it (the panel carries its own) */
export const shotTitle = (name) => String(name).replace(/^\d+\s+/, '');
/** a line as it is heard: the read's markup (stress, pauses) taken out */
export const spoken = (text) => String(text).replace(/\*([^*]+)\*/g, '$1').replace(/\[pause[^\]]*\]\s*/g, '').replace(/\s+/g, ' ').trim();
const span = (a, b) => `${a.toFixed(1)}–${b.toFixed(1)} s`;

/** One self-contained page: a panel a shot (no script, no link out; prints a panel whole) */
export function storyboardHtml(board) {
  const panel = (p) => `<article class="panel">
<div class="frame">${p.frame}<span class="no">${p.n}</span></div>
<div class="side">${p.blocking}</div>
<div class="words">
<h2>${esc(shotTitle(p.name))}</h2>
<p class="meta">${span(p.span[0], p.span[1])} of the scene · on screen ${p.screen[1].toFixed(1)} s · ${p.lens_mm} mm · ${esc(p.move)}</p>
${p.lines.map((L) => `<p class="line"><b>${esc(UPPER(L.who))}</b>${L.face ? ` <i>(${esc(L.face)})</i>` : ''} ${esc(spoken(L.text))}${L.recording ? ' <span class="rec">recorded</span>' : ''}</p>`).join('\n')}
${p.crosses.map((C) => `<p class="dir">${esc(C.who.charAt(0).toUpperCase() + C.who.slice(1))} crosses to ${esc(C.to)}.</p>`).join('\n')}
${p.notes.map((N) => `<p class="note"><b>Note · ${esc(N.id)}</b> ${esc(N.says)} <i>Try:</i> ${esc(N.try)}</p>`).join('\n')}
</div>
</article>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(board.title)} — storyboard</title>
<style>
:root{--bg:#f3f1ec;--card:#fffdf8;--ink:#1f1d1a;--dim:#6b665e;--rule:#d6d1c6;--accent:#a4522f}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1b1a18;--card:#252320;--ink:#ece9e3;--dim:#a39d93;--rule:#3d3a35;--accent:#e08a62}}
:root[data-theme=dark]{--bg:#1b1a18;--card:#252320;--ink:#ece9e3;--dim:#a39d93;--rule:#3d3a35;--accent:#e08a62}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,sans-serif;padding:16px}
header{max-width:1200px;margin:0 auto 16px}h1{font-size:22px;margin:0 0 4px}header p{margin:2px 0;color:var(--dim)}
.cast span{display:inline-block;margin-right:10px}.cast i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
main{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,540px),1fr));gap:16px}
.panel{background:var(--card);border:1px solid var(--rule);border-radius:6px;padding:10px;display:grid;grid-template-columns:1fr;gap:8px;break-inside:avoid}
.frame{position:relative}.frame svg{display:block;width:100%;height:auto;border:1.5px solid var(--ink)}
.no{position:absolute;top:6px;left:6px;background:var(--ink);color:var(--card);font-weight:700;border-radius:3px;padding:0 6px}
.side svg{display:block;width:100%;max-width:240px;height:auto;max-height:240px;margin:0 auto}
.blocking text{font:9px system-ui,sans-serif;fill:var(--dim);text-anchor:middle}.blocking .mark text{text-anchor:start}
.blocking .mark path{stroke:var(--dim);stroke-width:1}.blocking .room{fill:none;stroke:var(--rule);stroke-width:3}.blocking .door,.blocking .window{stroke:var(--card);stroke-width:4.5}.blocking .pane{stroke:var(--dim);stroke-width:1}.blocking .piece{fill:var(--rule);fill-opacity:.55;stroke:var(--dim);stroke-width:.6}.blocking .who path{stroke:var(--ink);stroke-width:2}
.blocking .way{fill:none;stroke-width:2;stroke-dasharray:4 3}.blocking .cam circle{fill:var(--accent)}.blocking .cam.off circle{fill:none;stroke:var(--accent);stroke-width:1.5}.blocking .fov{stroke:var(--accent);stroke-width:1.2;fill:none}
h2{font-size:15px;margin:0}.meta{margin:2px 0 6px;color:var(--dim);font-size:12px}.words p{margin:3px 0}
.dir{font-style:italic;color:var(--dim)}.rec{font-size:11px;color:var(--accent);border:1px solid var(--accent);border-radius:3px;padding:0 4px;margin-left:4px}.note{border-left:3px solid var(--accent);padding-left:8px;font-size:13px}
.board-notes{max-width:1200px;margin:0 auto 16px}
@media (min-width:900px){.panel{grid-template-columns:3fr 2fr}.frame{grid-column:1/-1}}
@media print{body{background:#fff;padding:0}.panel{border-color:#999}}
</style></head><body>
<header><h1>${esc(board.title)}</h1>
${board.set ? `<p>On the set <b>${esc(board.set.title ?? board.set.ref)}</b> (${esc(board.set.ref)}): ${board.set.drawn ? 'the panels draw its walls, doors, windows and furniture as plain blocks round the stand-ins; the blocking shows the room and what stands in it' : board.set.ground ? 'the panels draw what stands on its ground as plain blocks round the stand-ins; the blocking shows it from above' : 'the panels draw the actors as stand-ins on open ground; the blocking shows its rooms'}.</p>\n` : ''}<p>A storyboard: ${board.panels.length} shots, ${board.seconds.toFixed(1)} s of the scene, ${board.screen.toFixed(1)} s on screen. Each panel is a shot of the director's coverage, drawn with stand-ins where the actors stand; the film is made from the same plan.</p>
<p class="cast">${board.cast.map((w) => `<span><i style="background:${board.tints[w]}"></i>${esc(UPPER(w))}</span>`).join('')}</p></header>
${board.notes.length ? `<section class="board-notes">${board.notes.map((N) => `<p class="note"><b>Note · ${esc(N.id)}</b> ${esc(N.says)} <i>Try:</i> ${esc(N.try)}</p>`).join('\n')}</section>` : ''}
<main>
${board.panels.map(panel).join('\n')}
</main>
</body></html>
`;
}

/** The animatic's cuts: each panel held its shot's length on screen, cut where a line starts or ends inside it */
export function animaticSegments(board) {
  const out = [];
  for (const [k, p] of board.panels.entries()) {
    const [s0, s1] = p.span, cuts = [...new Set([s0, ...p.lines.flatMap((L) => [L.at, L.end]).filter((t) => t > s0 && t < s1), s1])].sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1], seconds = r3(((b - a) / (s1 - s0)) * p.screen[1]);
      if (seconds < 0.04) continue;
      const L = p.lines.find((x) => x.at <= (a + b) / 2 && x.end >= (a + b) / 2);
      out.push({ panel: k, seconds, caption: L ? `${UPPER(L.who)}: ${spoken(L.text)}` : '' });
    }
  }
  return out;
}

/** words wrapped to lines of about n characters, at most `max` lines */
function wrap(text, n = 64, max = 2) {
  const lines = [];
  for (const w of text.split(' ')) {
    if (lines.length && (lines.at(-1) + ' ' + w).length <= n) lines[lines.length - 1] += ` ${w}`;
    else lines.push(w);
  }
  return lines.length > max ? [...lines.slice(0, max - 1), `${lines.slice(max - 1).join(' ').slice(0, n - 1)}…`] : lines;
}

/** One frame of the animatic: the panel's drawing, its number and name above, the line spoken below */
export function animaticFrameSvg(board, seg, { width = PANEL_SIZE.width, height = PANEL_SIZE.height } = {}) {
  const p = board.panels[seg.panel], title = `${p.n} · ${shotTitle(p.name)}`;
  const inner = p.frame.replace(/^<svg ([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, '<svg $1').replace(/^<svg /, `<svg x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" `);
  const lines = seg.caption ? wrap(seg.caption) : [];
  const fs = Math.round(height / 18), lh = Math.round(fs * 1.3), y0 = height - 12 - (lines.length - 1) * lh;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${inner}`
    + `<rect x="8" y="8" width="${Math.min(width - 16, 22 + title.length * fs * 0.55)}" height="${lh + 6}" rx="3" fill="#1f1d1a" fill-opacity="0.78"/>`
    + `<text x="16" y="${8 + lh}" font-family="sans-serif" font-size="${fs}" fill="#fffdf8">${esc(title)}</text>`
    + (lines.length ? `<rect x="0" y="${y0 - fs - 8}" width="${width}" height="${height - y0 + fs + 8}" fill="#000" fill-opacity="0.55"/>`
      + lines.map((l, i) => `<text x="${width / 2}" y="${y0 + i * lh}" text-anchor="middle" font-family="sans-serif" font-size="${fs}" fill="#fff">${esc(l)}</text>`).join('') : '')
    + '</svg>';
}
