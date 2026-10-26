/**
 * broadcast — the TV graphics over a contest page, in a browser (inlined into a contest block before its arena client:
 * scene/channels/contest.js). Sport-blind: the arena hands it a FEED each frame (what the scoreboard says) and the
 * kernel's CALLS as they come (what the referee said); the package's data (broadcast/broadcast-package.js
 * broadcastData) says how it looks and moves. Nothing here changes the game: the camera's cut is laid over the
 * arena's own shot after it sets it, and the graphics run on their own frame count.
 *
 *   newBroadcast(BC) → TV                     the graphics' state
 *   tvNames(BC, n, players) → [name, …]       the places' names: the recipe's, else P1 … and CPU (numbered when more)
 *   tvAdvance(TV)                             one frame at 60 Hz (the arena's tick)
 *   tvCall(TV, c, names) → cue | null         a kernel call raised as its plate (CALL_CUES), the words from WHY_WORDS and
 *                                             the arena's names { side(s), who(id), unit(kind), period(c), round(c),
 *                                             gutter() } each → { name, color } or a string; the cue says if it cuts
 *   tvPlate(TV, { text, sub?, tone, color?, hold?, delay? })   a plate raised by hand (the arena's own word); one holds the
 *                                             frame at a time, by weight (tvPlate's rule)
 *   tvStrap(TV, { name, line?, tag?, color, hold? })   the lower third
 *   tvOpen(TV, { title, sub?, rows: [{ name, color }] })   the title card the broadcast opens on
 *   tvBoard(TV, { title, rows: [{ place?, name, color, value, note? }], foot? })   the results
 *   tvPanel(TV, { title, cols: [{ name, color }], rows: [{ words, cells: [string], lead? }], hold? })   the stats at a
 *                                             break (contest/contest-stats.js statPanel): head to head, the lead lit
 *   tvCut(TV, { on: [x, y, z], hold?, lift?, rise?, dist?, fov?, strap? })   the director's closeup on a point of the stage (the
 *                                             arena says when: the dead ball)
 *   tvShot(TV, camera, look)                  the closeup laid over the arena's shot (call after it sets the camera)
 *   tvDraw(TV, g, W, H, feed)                 the frame: feed { title, cols?, hot?, rows: [{ name, color, cells, mark? }],
 *                                             clock?, period?, tab?, meter?: { share, label?, color }, hint? }
 *
 * color is an index into the package's colours (the sides', lanes' or seats'). Tones: side, gold, warn, go, neutral.
 */
/* exported newBroadcast, tvNames, tvAdvance, tvCall, tvPlate, tvStrap, tvOpen, tvBoard, tvPanel, tvCut, tvShot, tvDraw */

function newBroadcast(BC) {
  return { BC, P: BC.card, f: 0, plate: null, queued: null, leaving: [], strap: null, bugBox: null, open: null, board: null, panel: null, cut: null, cells: {}, tab: null, bugAt: 0, finishes: 0, g: null };
}
function tvAdvance(TV) { TV.f += 1; }

// ── motion ───────────────────────────────────────────────────────────────────────────────────────────────────

const tvClamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const TV_EASE = {
  expo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  back: (t) => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  sine: (t) => Math.sin((t * Math.PI) / 2),
};
const tvIn = (TV, t) => TV_EASE[TV.P.ease](tvClamp(t));
const tvOut = (t) => { t = tvClamp(t); return t * t * t; };   // exits accelerate away
// a graphic's life: { k: its reveal 0 → 1 (the package's curve, overshoot and all), x: its exit 0 → 1, gone }
function tvLife(TV, at, hold) {
  const P = TV.P, age = TV.f - at;
  if (age < 0) return { k: 0, x: 0, age, gone: false };
  const x = hold === Infinity ? 0 : tvOut((age - P.in - hold) / P.out);
  return { k: tvIn(TV, age / P.in), x, age, gone: hold !== Infinity && age > P.in + hold + P.out };
}

// ── paint ────────────────────────────────────────────────────────────────────────────────────────────────────

function tvFont(TV, size, weight) {
  const g = TV.g, P = TV.P;
  g.font = `${weight ?? P.weight} ${Math.round(size)}px ${P.face}`;
  if ('letterSpacing' in g) g.letterSpacing = `${(P.track * size).toFixed(1)}px`;
  g.textBaseline = 'middle';
}
function tvTextW(TV, s, size, weight) { tvFont(TV, size, weight); return TV.g.measureText(s).width; }
function tvText(TV, s, x, y, size, color, align = 'left', weight) {
  const g = TV.g;
  tvFont(TV, size, weight);
  g.textAlign = align;
  if (TV.P.ink) { g.lineJoin = 'round'; g.lineWidth = TV.P.ink; g.strokeStyle = '#120a26'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
}
function tvGrad(TV, y0, y1, stops) { const gr = TV.g.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; }
const tvRampStops = (r) => [[0, r.hi], [0.45, r.base], [1, r.lo]];
// a plate's outline: a parallelogram leaning by slant × its height, its corners rounded
function tvPath(TV, x, y, w, h, lean) {
  const g = TV.g, s = (lean ?? TV.P.slant) * h, r = Math.min(TV.P.radius, h / 2, w / 4);
  const pts = [[x + s, y], [x + w, y], [x + w - s, y + h], [x, y + h]];
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const p = pts[i], a = pts[(i + 3) % 4], b = pts[(i + 1) % 4];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, db = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    const p0 = [p[0] + ((a[0] - p[0]) / da) * r, p[1] + ((a[1] - p[1]) / da) * r], p1 = [p[0] + ((b[0] - p[0]) / db) * r, p[1] + ((b[1] - p[1]) / db) * r];
    if (i === 0) g.moveTo(p0[0], p0[1]); else g.lineTo(p0[0], p0[1]);
    g.quadraticCurveTo(p[0], p[1], p1[0], p1[1]);
  }
  g.closePath();
}
// the fill a tone paints: the side's ramp, the accent metal, the referee's amber, the green, or the glass
function tvFill(TV, tone, color, y, h) {
  const BC = TV.BC;
  if (tone === 'side' && BC.colors[color]) return { fill: tvGrad(TV, y, y + h, tvRampStops(BC.colors[color])), ink: BC.colors[color].ink };
  if (tone === 'gold' && BC.metal.accent) return { fill: tvGrad(TV, y, y + h, BC.metal.accent), ink: '#0b0f17' };
  if (tone === 'warn' || tone === 'go') { const r = BC.tones[tone]; return { fill: tvGrad(TV, y, y + h, tvRampStops(r)), ink: r.ink }; }
  return { fill: tvGrad(TV, y, y + h, [[0, TV.P.glass[0]], [1, TV.P.glass[1]]]), ink: BC.glassInk, glass: true };
}
// a plate: its fill, a lit top edge, the metal rim, and the sheen sweeping across it at `sheen` (0 → 1, or none)
function tvPlateAt(TV, x, y, w, h, tone, color, sheen, lean) {
  const g = TV.g, P = TV.P, F = tvFill(TV, tone, color, y, h);
  g.save();
  if (F.glass) g.globalAlpha *= P.glassAlpha;
  tvPath(TV, x, y, w, h, lean); g.fillStyle = F.fill; g.fill();
  g.restore();
  g.save(); tvPath(TV, x, y, w, h, lean); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w, Math.max(1, h * 0.06));
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + h * 0.94, w, h * 0.06);
  if (sheen !== null && sheen !== undefined && sheen > 0 && sheen < 1 && P.sheen) {
    const bw = Math.max(h * 1.4, w * 0.22), cx = x - bw + (w + 2 * bw) * sheen, gr = g.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, TV.BC.metal.sheen); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.35; g.fillStyle = gr;
    g.transform(1, 0, -0.5, 1, 0, 0); g.fillRect(cx - bw / 2 + (y + h / 2) * 0.5, y, bw, h);
  }
  g.restore();
  if (tone === 'side' && TV.BC.colors[color] && TV.BC.colors[color].key) { g.save(); tvPath(TV, x + 1.5, y + 1.5, w - 3, h - 3, lean); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke(); g.restore(); }
  if (P.rim && TV.BC.metal.rim) { g.save(); tvPath(TV, x, y, w, h, lean); g.lineWidth = P.rim; g.strokeStyle = tvGrad(TV, y, y + h, TV.BC.metal.rim); g.stroke(); g.restore(); }
  else if (P.ink) { g.save(); tvPath(TV, x, y, w, h, lean); g.lineWidth = P.ink * 0.6; g.strokeStyle = '#120a26'; g.stroke(); g.restore(); }
  return F.ink;
}
// a graphic's entrance as its package moves: a wipe from the centre (expo), a slide with an overshoot (back), a pop
// (elastic), a fade (sine); its exit a slide away and a fade. Returns false when there is nothing to draw.
function tvEnter(TV, L, cx, cy, from = 'centre') {
  const g = TV.g, ease = TV.P.ease;
  if (L.age < 0 || L.gone) return false;
  g.globalAlpha = (ease === 'sine' ? tvClamp(L.k) : tvClamp(L.k * 3)) * (1 - L.x);
  g.translate(L.x * 60, 0);
  if (ease === 'elastic') { const s = Math.max(0.01, L.k); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }
  else if (ease === 'back') g.translate((1 - L.k) * (from === 'left' ? -cx - 200 : -260), 0);
  else if (ease === 'expo') { const s = Math.max(0.01, L.k); g.translate(from === 'left' ? 0 : cx, 0); g.scale(s, 1); g.translate(from === 'left' ? 0 : -cx, 0); }
  return true;
}

// ── the cues ─────────────────────────────────────────────────────────────────────────────────────────────────

// a plate's weight: the decisive call outranks a side's, a side's the referee's word, that the information
const TV_RANK = { gold: 3, side: 2, warn: 2, go: 2, neutral: 1 };
/**
 * A plate raised. One plate holds the frame: a weightier call takes it at once, an equal one once the plate on screen
 * has been read (its reveal and a beat), and a lighter one waits its turn: one word waits, the weightiest (the later
 * of equals). Nothing is raised over the open: it waits for the title card to go.
 */
function tvPlate(TV, q) {
  const free = Math.max(TV.f + (q.delay || 0), TV.open ? TV.bugAt - TV.P.out : TV.f);
  const next = { ...q, at: free, hold: Math.round(TV.P.hold * (q.hold ?? 1)), rank: TV_RANK[q.tone] || 1 };
  const cur = TV.plate;
  if (cur && TV.f < cur.at + TV.P.in + cur.hold) {
    const read = TV.f - cur.at >= TV.P.in + 24;
    if (next.rank < cur.rank || (next.rank === cur.rank && !read)) { if (!TV.queued || next.rank >= TV.queued.rank) TV.queued = next; return; }
    TV.leaving.push({ ...cur, hold: Math.max(0, TV.f - cur.at - TV.P.in) });
  }
  if (TV.queued && TV.queued.text === next.text) TV.queued = null;
  TV.plate = next;
}
// the queued word goes up when the plate before it has gone
function tvNextPlate(TV) {
  if (TV.plate || !TV.queued) return;
  TV.plate = { ...TV.queued, at: Math.max(TV.f, TV.queued.at) }; TV.queued = null;
}
function tvStrap(TV, q) { TV.strap = { ...q, at: TV.f, hold: Math.round(TV.P.hold * (q.hold ?? 1.4)) }; }
function tvOpen(TV, q) { TV.open = { ...q, at: TV.f, hold: Math.round(TV.P.hold * 1.3) }; TV.bugAt = TV.f + TV.P.in + TV.open.hold + TV.P.out; TV.board = null; TV.panel = null; TV.plate = null; TV.queued = null; TV.strap = null; TV.cut = null; TV.cells = {}; TV.finishes = 0; }
function tvBoard(TV, q) { TV.board = { ...q, at: TV.f + Math.round(TV.P.hold * 0.6) }; TV.panel = null; }
function tvPanel(TV, q) { if (!TV.board && q && q.rows && q.rows.length) TV.panel = { ...q, at: TV.f, hold: Math.round(TV.P.hold * (q.hold ?? 2.6)) }; }
function tvCut(TV, q) {
  if (!TV.P.closeups) { if (q.strap) tvStrap(TV, q.strap); return; }
  TV.cut = { lift: 1, rise: 0.6, dist: 6.5, fov: 32, hold: 80, ...q, at: TV.f };
  if (q.strap) TV.strap = { ...q.strap, at: TV.f + 10, hold: TV.cut.hold };
}
const tvUp = (s) => String(s).toUpperCase();
/** The names the broadcast gives n places of which the first `players` are held: the recipe's, else P1 … and CPU, the
 *  computer's numbered when it holds more than one. */
function tvNames(BC, n, players) {
  const cpus = n - players;
  return Array.from({ length: n }, (_, i) => (BC.names && BC.names[i]) || (i < players ? `P${i + 1}` : cpus > 1 ? `CPU ${i + 1 - players}` : 'CPU'));
}
function tvName(v) { return typeof v === 'string' ? { name: v, color: null } : v || { name: '', color: null }; }
/** A kernel call as the broadcast shows it: its plate raised, the cue (tone, cut) returned. */
function tvCall(TV, c, names = {}) {
  // a scoring unit's call (a game, a set) carries its side and the unit's count: the meet's starter's SET carries neither
  const BC = TV.BC, isUnit = c.side !== undefined && Array.isArray(c.score);
  const cue = isUnit ? BC.cues.unit : BC.cues[c.kind];
  if (!cue) return null;
  const W = (k) => BC.why[k] ?? tvUp(String(k).replace(/-/g, ' '));
  const side = c.side !== undefined && c.side !== null && names.side ? tvName(names.side(c.side)) : null;
  const who = c.who !== undefined && names.who ? tvName(names.who(c.who)) : null;
  let text = '', sub = '', tone = cue.tone, color = (side || who || {}).color;
  switch (isUnit ? 'unit' : c.kind) {
    case 'point': text = W(c.why); sub = side ? `POINT ${side.name}` : ''; break;
    case 'fault': text = c.faults >= 2 || c.why === 'double-fault' ? 'DOUBLE FAULT' : 'FAULT'; sub = c.why && c.why !== 'fault' && c.why !== 'double-fault' ? W(c.why) : ''; break;
    case 'let': text = 'LET'; sub = 'REPLAY THE POINT'; break;
    case 'unit': text = names.unit ? tvUp(names.unit(c.kind)) : tvUp(c.kind); sub = side ? `${side.name} · ${c.score[0]}–${c.score[1]}` : ''; break;
    case 'over': {
      const win = c.winner !== undefined && c.winner !== null && names.side ? tvName(names.side(c.winner)) : null;
      if (c.placings) { text = 'FINAL'; sub = 'THE RESULT'; tone = 'gold'; }
      else if (c.totals) { const w = c.winner && names.who ? tvName(names.who(c.winner)) : null; text = w ? `${w.name} WINS` : 'A TIE'; color = w ? w.color : null; }
      else { text = win ? `${win.name} WINS` : 'A DRAW'; color = win ? win.color : null; }
      break;
    }
    case 'period': text = names.period ? names.period(c) : `END OF PERIOD ${c.period}`; break;
    case 'overtime': text = 'OVERTIME'; break;
    case 'score': text = c.points ? (c.points === 3 ? 'THREE!' : `${c.points} POINTS`) : `${names.unit ? tvUp(names.unit('score')) : 'SCORE'}!`; sub = side ? side.name : ''; break;
    case 'out': text = W(c.restart && c.restart.kind); sub = side ? side.name : ''; tone = 'neutral'; color = null; break;
    case 'foul': text = c.foul === 'offside' ? 'OFFSIDE' : 'FOUL'; sub = c.cost === 'warn' ? 'WARNING' : c.cost === 'free' ? `FREE · ${side ? side.name : ''}` : c.cost === 'point' ? `POINT · ${side ? side.name : ''}` : ''; break;
    case 'set': text = 'SET'; break;
    case 'gun': text = 'GO'; break;
    case 'false-start': text = 'FALSE START'; sub = `${who ? who.name : ''} · ${c.warned ? 'WARNING' : 'DISQUALIFIED'}`; break;
    case 'finish': if (TV.finishes++ > 0) return null; text = (c.t ?? 0).toFixed(2); sub = who ? `${who.name} · FIRST ACROSS` : ''; break;
    case 'mark': if (c.foul) { text = 'FOUL'; tone = 'warn'; } else { text = `${(c.value ?? 0).toFixed(2)} M`; } sub = `${who ? who.name : ''} · ATTEMPT ${c.attempt}`; break;
    case 'turn': text = `${who ? who.name : ''} TO PLAY`; sub = names.round ? names.round(c) : ''; color = null; break;
    case 'holed':
      text = c.why === 'picked-up' ? 'PICKED UP' : c.strokes === 1 ? 'HOLE IN ONE' : c.toPar === null ? `HOLED IN ${c.strokes}` : BC.why[String(c.toPar)] ?? `+${c.toPar}`;
      tone = c.why === 'picked-up' ? 'neutral' : c.toPar !== null && c.toPar < 0 || c.strokes === 1 ? 'gold' : 'side'; sub = who ? who.name : ''; break;
    case 'penalty': text = c.region === 'out' ? 'OUT OF BOUNDS' : W(c.region); sub = `+${c.strokes} · ${who ? who.name : ''}`; break;
    case 'roll':
      if (c.mark === 'strike') { text = 'STRIKE!'; tone = 'gold'; } else if (c.mark === 'spare') text = 'SPARE';
      else if (c.down === 0) { text = names.gutter && names.gutter() ? 'GUTTER' : 'MISS'; tone = 'warn'; }
      else { text = `${c.down} DOWN`; tone = 'neutral'; }
      sub = who ? who.name : ''; break;
    default: text = tvUp(c.kind);
  }
  tvPlate(TV, { text, sub, tone, color, hold: cue.hold });
  return { ...cue, tone, color, kind: c.kind, unit: isUnit, side, who, text, sub };
}

// ── the camera ───────────────────────────────────────────────────────────────────────────────────────────────

/** The closeup laid over the arena's shot: eased in, a slow push, eased out; a breath of drift, as a held camera's. */
function tvShot(TV, camera, look) {
  const C = TV.cut;
  if (!C) return;
  const age = TV.f - C.at, inF = 22, outF = 20;
  if (age > inF + C.hold + outF) { TV.cut = null; return; }
  const w = age < inF ? TV_EASE.sine(age / inF) : age > inF + C.hold ? 1 - TV_EASE.sine((age - inF - C.hold) / outF) : 1;
  const push = tvClamp(age / (inF + C.hold)), dist = C.dist * (1.08 - 0.16 * push);
  const [fx, fy, fz] = C.on, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const dx = cx - fx, dy = cy - fy, n = Math.hypot(dx, dy) || 1;
  const sway = 0.035 * Math.sin(TV.f * 0.05), bob = 0.02 * Math.sin(TV.f * 0.083);
  const px = fx + (dx / n) * dist - (dy / n) * sway, py = fy + (dy / n) * dist + (dx / n) * sway, pz = fz + C.lift + C.rise + bob;
  const lx = fx, ly = fy, lz = fz + C.lift;
  camera.position.set(cx + (px - cx) * w, cy + (py - cy) * w, cz + (pz - cz) * w);
  camera.lookAt(look[0] + (lx - look[0]) * w, look[1] + (ly - look[1]) * w, look[2] + (lz - look[2]) * w);
  const fov = camera.fov + (C.fov - camera.fov) * w;
  if (Math.abs(fov - camera.fov) > 1e-3) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
// the letterbox's share of the frame now: in with the cut, out after it
function tvBars(TV) {
  const C = TV.cut;
  if (!C || !TV.P.letterbox) return 0;
  const age = TV.f - C.at, inF = 22, outF = 20;
  return TV.P.letterbox * (age < inF ? TV_EASE.sine(age / inF) : age > inF + C.hold ? 1 - tvClamp((age - inF - C.hold) / outF) : 1);
}

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────

function tvDraw(TV, g, W, H, feed) {
  TV.g = g;
  const P = TV.P, M = Math.round(P.safe * Math.min(W, H * 16 / 9)), bars = tvBars(TV) * H;
  if (bars > 0.5) { g.fillStyle = '#000'; g.fillRect(0, 0, W, bars); g.fillRect(0, H - bars, W, bars); }
  const S = Math.max(0.7, Math.min(1.5, H / 720));   // the graphics' scale: laid out at 720 lines
  // the bug steps aside for the full-frame board, as a director takes it out for the results
  if (feed) { g.save(); g.globalAlpha = TV.board ? 1 - tvClamp((TV.f - TV.board.at) / 12) : 1; if (g.globalAlpha > 0.01) tvBug(TV, M, M + bars, S, feed); else TV.bugBox = null; g.restore(); }
  if (feed && feed.meter) tvMeter(TV, W, H - M - bars, S, feed.meter);
  if (feed && feed.hint) { g.save(); g.globalAlpha = 0.55 + 0.25 * Math.sin(TV.f * 0.08); tvText(TV, tvUp(feed.hint), W / 2, H - M * 0.55 - bars, 11 * S, '#ffffff', 'center', 600); g.restore(); }
  tvDrawStrap(TV, M, H - M - bars, S);
  for (const q of TV.leaving) tvDrawPlate(TV, q, W, H, S);
  TV.leaving = TV.leaving.filter((q) => !tvLife(TV, q.at, q.hold).gone);
  if (TV.plate) { tvDrawPlate(TV, TV.plate, W, H, S); if (tvLife(TV, TV.plate.at, TV.plate.hold).gone) TV.plate = null; }
  tvNextPlate(TV);
  if (TV.open) { tvDrawOpen(TV, W, H, S); if (tvLife(TV, TV.open.at, TV.open.hold).gone) TV.open = null; }
  if (TV.panel && !TV.board) tvDrawPanel(TV, W, H, S);
  if (TV.board) tvDrawBoard(TV, W, H, S);
  g.globalAlpha = 1;
}

// the call: a plate centred high, its words tracked in, the sub on a tab beneath it
function tvDrawPlate(TV, q, W, H, S) {
  const g = TV.g, L = tvLife(TV, q.at, q.hold);
  if (L.gone) return;
  const h = 64 * S, size = h * 0.56, track = Math.max(0, 1 - tvClamp(L.age / (TV.P.in * 1.6))), text = tvUp(q.text), sub = q.sub ? tvUp(q.sub) : '';
  const tw = tvTextW(TV, text, size), w = tw + h * 1.7, x = W / 2 - w / 2;
  // high and centred, the bug's corner kept clear: a plate that would cross the bug drops below it
  const B = TV.bugBox, y = B && x < B.x1 + 12 * S && B.y0 < H * 0.2 + h + 40 * S ? Math.max(H * 0.2, B.y1 + 16 * S) : H * 0.2;
  g.save();
  if (tvEnter(TV, L, W / 2, y + h / 2)) {
    if (TV.P.ease === 'back' && L.age < 10) { g.save(); g.globalAlpha *= 0.5 * (1 - L.age / 10); tvPath(TV, x - 8, y - 6, w + 16, h + 12); g.fillStyle = '#ffffff'; g.fill(); g.restore(); }
    const sheen = TV.P.sheen ? (L.age - TV.P.in * 0.6) / TV.P.sheen : null;
    const ink = tvPlateAt(TV, x, y, w, h, q.tone, q.color, sheen);
    g.save(); g.globalAlpha *= tvClamp(L.age / (TV.P.in * 0.8));
    tvFont(TV, size); if ('letterSpacing' in g) g.letterSpacing = `${((TV.P.track + 0.5 * track * track) * size).toFixed(1)}px`;
    g.textAlign = 'center'; if (TV.P.ink) { g.lineJoin = 'round'; g.lineWidth = TV.P.ink; g.strokeStyle = '#120a26'; g.strokeText(text, W / 2, y + h * 0.53); }
    g.fillStyle = ink; g.fillText(text, W / 2, y + h * 0.53);
    g.restore();
    if (sub) {
      const L2 = tvLife(TV, q.at + 6, q.hold - 6), sh = h * 0.42, ss = sh * 0.56, sw = tvTextW(TV, sub, ss, 700) + sh * 1.4;
      if (L2.age >= 0) { g.save(); g.globalAlpha *= tvClamp(L2.k * 2); g.translate(0, (1 - tvClamp(L2.k)) * -sh * 0.6); tvPlateAt(TV, W / 2 - sw / 2, y + h + 3 * S, sw, sh, 'neutral', null, null); tvText(TV, sub, W / 2, y + h + 3 * S + sh * 0.53, ss, TV.BC.glassInk, 'center', 700); g.restore(); }
    }
  }
  g.restore();
}

// the score bug: the title on its tab, a row a side, the hot column on the accent metal, the clock beside, the tab below
function tvBug(TV, x0, y0, S, feed) {
  const g = TV.g, P = TV.P, BC = TV.BC, L = tvLife(TV, TV.bugAt, Infinity);
  if (L.age < 0) return;
  const rh = 26 * S, ts = rh * 0.6, cs = rh * 0.62, pad = rh * 0.38;
  const rows = feed.rows || [], cols = feed.cols || [];
  const nameW = Math.max(rh * 2.2, ...rows.map((r) => tvTextW(TV, tvUp(r.name), ts, 800))) + pad * 2;
  const ncell = Math.max(0, ...rows.map((r) => r.cells.length));
  const cellW = Array.from({ length: ncell }, (_, c) => Math.max(rh * 1.05, ...rows.map((r) => (r.cells[c] === undefined ? 0 : tvTextW(TV, String(r.cells[c]), cs, 800))), ...(cols[c] ? [tvTextW(TV, cols[c], rh * 0.34, 700)] : [])) + pad);
  const chip = rh * 0.22, mark = rh * 0.62, w = chip + nameW + mark + cellW.reduce((a, b) => a + b, 0), h = rh * rows.length;
  const titleH = rh * 0.72, colH = cols.length ? rh * 0.5 : 0;
  g.save();
  g.globalAlpha = tvClamp(L.k * 2);
  g.translate((1 - tvClamp(L.k)) * -(w + x0 + 40), 0);
  let y = y0;
  if (feed.title) {
    const tw = tvTextW(TV, tvUp(feed.title), titleH * 0.5, 700) + titleH;
    tvPlateAt(TV, x0, y, Math.max(tw, chip + nameW), titleH, 'neutral', null, (L.age - P.in) / (P.sheen || 1), 0);
    if (BC.metal.accent) { g.fillStyle = tvGrad(TV, y + titleH - 3 * S, y + titleH, BC.metal.accent); g.fillRect(x0 + 2, y + titleH - 3 * S, Math.max(tw, chip + nameW) - 4, 3 * S); }
    tvText(TV, tvUp(feed.title), x0 + titleH * 0.5, y + titleH * 0.52, titleH * 0.5, BC.glassInk, 'left', 700);
    y += titleH + 2 * S;
  }
  if (colH) {
    let cx = x0 + chip + nameW + mark;
    cols.forEach((c, i) => { tvText(TV, c, cx + cellW[i] / 2, y + colH * 0.5, rh * 0.34, 'rgba(255,255,255,0.72)', 'center', 700); cx += cellW[i]; });
    y += colH;
  }
  tvPlateAt(TV, x0, y, w, h, 'neutral', null, (L.age - P.in - 8) / (P.sheen || 1), 0);
  rows.forEach((r, i) => {
    const ry = y + i * rh, col = BC.colors[r.color];
    if (col) { g.fillStyle = tvGrad(TV, ry, ry + rh, tvRampStops(col)); g.fillRect(x0 + 1, ry + 1, chip, rh - 2); if (col.key) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.strokeRect(x0 + 1.5, ry + 1.5, chip - 1, rh - 3); } }
    if (i > 0) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0 + chip, ry, w - chip, 1); }
    tvText(TV, tvUp(r.name), x0 + chip + pad, ry + rh * 0.53, ts, BC.glassInk, 'left', 800);
    const mx = x0 + chip + nameW + mark / 2, my = ry + rh / 2;
    if (r.mark === 'serve') { g.fillStyle = BC.metal.accent ? tvGrad(TV, my - rh * 0.14, my + rh * 0.14, BC.metal.accent) : '#d9e84a'; g.beginPath(); g.arc(mx, my, rh * 0.14, 0, Math.PI * 2); g.fill(); }
    else if (r.mark === 'turn') { g.fillStyle = col ? col.hi : '#ffffff'; g.beginPath(); g.moveTo(mx - rh * 0.12, my - rh * 0.16); g.lineTo(mx + rh * 0.14, my); g.lineTo(mx - rh * 0.12, my + rh * 0.16); g.closePath(); g.fill(); }
    else if (r.mark === 'out') { g.fillStyle = BC.tones.warn.base; g.fillRect(mx - rh * 0.14, my - rh * 0.05, rh * 0.28, rh * 0.1); }
    let cx = x0 + chip + nameW + mark;
    r.cells.forEach((v, c) => {
      const s = String(v ?? ''), key = `${i}:${c}`, hot = c === feed.hot;
      if (hot) {
        // a cel package's banded metal would cut through a digit: a small cell takes its lit band flat
        if (BC.metal.accent) { g.fillStyle = TV.P.cel ? BC.metal.accent[0][1] : tvGrad(TV, ry, ry + rh, BC.metal.accent); g.fillRect(cx, ry + (i === 0 ? 1 : 0), cellW[c], rh - (i === rows.length - 1 ? 1 : 0)); }
        else { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(cx, ry, cellW[c], rh); }
      }
      // a value that changed rolls: the old up and out, the new up from below, the cell flashing the row's colour
      let memo = TV.cells[key];
      if (!memo) memo = TV.cells[key] = { v: s, prev: s, at: -999 };
      if (memo.v !== s) { memo.prev = memo.v; memo.v = s; memo.at = TV.f; }
      const age = TV.f - memo.at, roll = tvClamp(age / 14), flash = 1 - tvClamp(age / 34);
      if (flash > 0 && col) { g.save(); g.globalAlpha *= 0.85 * flash; g.fillStyle = col.hi; g.fillRect(cx, ry, cellW[c], rh); g.restore(); }
      const ink = hot && BC.metal.accent ? '#0b0f17' : BC.glassInk;
      g.save(); g.beginPath(); g.rect(cx, ry, cellW[c], rh); g.clip();
      const e = TV_EASE.expo(roll);
      if (roll < 1) tvText(TV, memo.prev, cx + cellW[c] / 2, ry + rh * 0.53 - e * rh, cs, ink, 'center', 800);
      tvText(TV, s, cx + cellW[c] / 2, ry + rh * 0.53 + (1 - e) * rh, cs, ink, 'center', 800);
      g.restore();
      cx += cellW[c];
    });
  });
  // the clock beside the rows, the period over it
  let bx = x0 + w + 3 * S;
  if (feed.clock) {   // the clock's box: two rows tall at most, the period over the time
    const cw = tvTextW(TV, '00:00.0', cs * 1.05, 800) * 0.9 + pad * 2, ch = Math.min(h, rh * 2);
    tvPlateAt(TV, bx, y, cw, ch, 'neutral', null, null, 0);
    if (feed.period) tvText(TV, tvUp(feed.period), bx + cw / 2, y + ch * 0.3, rh * 0.36, 'rgba(255,255,255,0.75)', 'center', 700);
    tvText(TV, feed.clock, bx + cw / 2, y + ch * (feed.period ? 0.68 : 0.53), cs * 1.05, BC.glassInk, 'center', 800);
    bx += cw;
  }
  TV.bugBox = { x1: bx, y0: y0, y1: y + h + (feed.tab ? rh * 0.85 : 0) };
  // the tab: one line under the bug, sliding down when its words change
  if (feed.tab) {
    if (!TV.tab || TV.tab.text !== feed.tab) TV.tab = { text: feed.tab, at: TV.f };
    const k = TV_EASE.expo(tvClamp((TV.f - TV.tab.at) / 16)), th = rh * 0.78, tw2 = tvTextW(TV, tvUp(feed.tab), th * 0.5, 700) + th;
    g.save(); g.beginPath(); g.rect(x0 - 10, y + h, Math.max(w, tw2) + 20, th + 6 * S); g.clip();
    g.translate(0, (k - 1) * th);
    tvPlateAt(TV, x0, y + h + 2 * S, tw2, th, 'neutral', null, null, 0);
    if (BC.metal.accent) { g.fillStyle = tvGrad(TV, y + h, y + h + th, BC.metal.accent); g.fillRect(x0 + 1, y + h + 2 * S + 1, 3 * S, th - 2); }
    tvText(TV, tvUp(feed.tab), x0 + th * 0.5, y + h + 2 * S + th * 0.53, th * 0.5, BC.glassInk, 'left', 700);
    g.restore();
  } else TV.tab = null;
  g.restore();
}

// the meter: a glass track with its rim, the fill in the player's ramp, the quarters ticked, alight near the top
function tvMeter(TV, W, yb, S, m) {
  const g = TV.g, BC = TV.BC, w = Math.min(420 * S, W * 0.42), h = 14 * S, x = W / 2 - w / 2, y = yb - h - 26 * S;
  if (m.label) tvText(TV, tvUp(m.label), W / 2, y - 12 * S, 12 * S, 'rgba(255,255,255,0.9)', 'center', 700);
  tvPlateAt(TV, x, y, w, h, 'neutral', null, null, 0);
  const col = BC.colors[m.color] || BC.tones.go, share = tvClamp(m.share);
  if (share > 0) {
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, col.lo); gr.addColorStop(0.7, col.base); gr.addColorStop(1, col.hi);
    g.save(); tvPath(TV, x + 2, y + 2, (w - 4) * share, h - 4, 0); g.fillStyle = gr; g.fill();
    if (share > 0.9) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * (0.5 + 0.5 * Math.sin(TV.f * 0.6)); g.fillStyle = BC.metal.sheen; g.fill(); }
    g.restore();
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (const q of [0.25, 0.5, 0.75]) g.fillRect(x + w * q, y + h * 0.25, 1, h * 0.5);
}

// the lower third: the tag on the accent metal, the name on the side's ramp, the line on the glass; staggered in
function tvDrawStrap(TV, x0, yb, S) {
  const q = TV.strap;
  if (!q) return;
  const g = TV.g, L = tvLife(TV, q.at, q.hold);
  if (L.gone) { TV.strap = null; return; }
  if (L.age < 0) return;
  const nh = 40 * S, lh = 26 * S, ns = nh * 0.56, ls = lh * 0.54, tag = q.tag ? nh + lh : 0;
  const nw = tvTextW(TV, tvUp(q.name), ns, 800) + nh * 1.1, lw = q.line ? tvTextW(TV, tvUp(q.line), ls, 600) + lh * 1.2 : 0;
  const y = yb - nh - lh;
  g.save();
  g.globalAlpha = tvClamp(L.k * 3) * (1 - L.x);
  g.translate(-L.x * 80, 0);
  if (tag) {
    const k = TV_EASE[TV.P.ease](tvClamp(L.age / TV.P.in)), cx = x0 + tag / 2, cy = y + tag / 2;
    g.save(); g.translate(cx, cy); g.scale(Math.max(0.01, k), Math.max(0.01, k)); g.translate(-cx, -cy);
    tvPlateAt(TV, x0, y, tag, tag, TV.BC.metal.accent ? 'gold' : 'neutral', null, (L.age - TV.P.in) / (TV.P.sheen || 1), 0);
    tvText(TV, tvUp(q.tag), cx, cy + tag * 0.03, tag * 0.42, TV.BC.metal.accent ? '#0b0f17' : TV.BC.glassInk, 'center', 900);
    g.restore();
  }
  const wipe = (at, ww, hh, yy) => { const k = tvClamp(TV_EASE.expo(tvClamp((L.age - at) / TV.P.in))); g.beginPath(); g.rect(x0 + tag, yy - 2, (ww + 8) * k, hh + 4); g.clip(); return k > 0; };
  g.save(); if (wipe(4, nw, nh, y)) { const ink = tvPlateAt(TV, x0 + tag + 2 * S, y, nw, nh, q.color === null || q.color === undefined ? 'neutral' : 'side', q.color, (L.age - TV.P.in - 4) / (TV.P.sheen || 1), 0); tvText(TV, tvUp(q.name), x0 + tag + 2 * S + nh * 0.5, y + nh * 0.54, ns, ink, 'left', 800); } g.restore();
  if (q.line) { g.save(); if (wipe(10, lw, lh, y + nh)) { tvPlateAt(TV, x0 + tag + 2 * S, y + nh, lw, lh, 'neutral', null, null, 0); tvText(TV, tvUp(q.line), x0 + tag + 2 * S + lh * 0.55, y + nh + lh * 0.54, ls, TV.BC.glassInk, 'left', 600); } g.restore(); }
  g.restore();
}

// the open: the event's name on a big plate, the sides beneath it, then away into the bug
function tvDrawOpen(TV, W, H, S) {
  const q = TV.open, g = TV.g, L = tvLife(TV, q.at, q.hold);
  if (L.gone) return;
  const h = 86 * S, size = h * 0.5, tw = tvTextW(TV, tvUp(q.title), size), w = Math.max(tw + h * 1.6, 420 * S), x = W / 2 - w / 2, y = H * 0.36;
  g.save();
  if (tvEnter(TV, L, W / 2, y + h / 2)) {
    const ink = tvPlateAt(TV, x, y, w, h, TV.BC.metal.accent ? 'gold' : 'neutral', null, (L.age - TV.P.in * 0.5) / (TV.P.sheen * 1.4 || 1));
    tvText(TV, tvUp(q.title), W / 2, y + h * 0.54, size, ink, 'center');
    const rows = q.rows || [], rh = 34 * S;
    if (rows.length) {
      const names = rows.map((r) => tvUp(r.name)), gap = rows.length === 2 ? tvTextW(TV, 'VS', rh * 0.5, 800) + rh * 1.4 : rh * 0.4;
      const ws = names.map((n) => tvTextW(TV, n, rh * 0.55, 800) + rh * 1.2), total = ws.reduce((a, b) => a + b, 0) + gap * (rows.length - 1);
      let cx = W / 2 - total / 2;
      rows.forEach((r, i) => {
        const L2 = tvLife(TV, q.at + 8 + i * 5, q.hold - 8 - i * 5), yy = y + h + 8 * S;
        g.save(); g.globalAlpha *= tvClamp(L2.k * 2); g.translate(0, (1 - tvClamp(L2.k)) * 14 * S);
        const ink2 = tvPlateAt(TV, cx, yy, ws[i], rh, 'side', r.color, null);
        tvText(TV, names[i], cx + ws[i] / 2, yy + rh * 0.54, rh * 0.55, ink2, 'center', 800);
        g.restore();
        cx += ws[i];
        if (i < rows.length - 1) { if (rows.length === 2) tvText(TV, 'VS', cx + gap / 2, yy + rh * 0.54, rh * 0.5, '#ffffff', 'center', 800); cx += gap; }
      });
    }
    if (q.sub) tvText(TV, tvUp(q.sub), W / 2, y - 16 * S, 13 * S, 'rgba(255,255,255,0.85)', 'center', 700);
  }
  g.restore();
}

// the results: the header plate, a row a place with its medal, staggered in from the right; the winner's row lit
function tvDrawBoard(TV, W, H, S) {
  const q = TV.board, g = TV.g, BC = TV.BC, age = TV.f - q.at;
  if (age < 0) return;
  const rh = 36 * S, w = Math.min(560 * S, W * 0.8), x = W / 2 - w / 2, hh = 52 * S, rows = q.rows || [];
  const top = Math.max(H * 0.3, H / 2 - (hh + rows.length * (rh + 3 * S)) / 2);
  const L = tvLife(TV, q.at, Infinity);
  g.save();
  if (tvEnter(TV, L, W / 2, top + hh / 2)) {
    const ink = tvPlateAt(TV, x, top, w, hh, BC.metal.accent ? 'gold' : 'neutral', null, (age - TV.P.in) / (TV.P.sheen * 1.5 || 1));
    tvText(TV, tvUp(q.title), W / 2, top + hh * 0.54, hh * 0.5, ink, 'center');
  }
  g.restore();
  rows.forEach((r, i) => {
    const k = TV_EASE[TV.P.ease](tvClamp((age - TV.P.in - i * 5) / TV.P.in));
    if (age - TV.P.in - i * 5 < 0) return;
    const y = top + hh + 4 * S + i * (rh + 3 * S);
    g.save(); g.globalAlpha = tvClamp(k * 2); g.translate((1 - k) * 120 * S, 0);
    tvPlateAt(TV, x, y, w, rh, 'neutral', null, null, 0);
    const col = BC.colors[r.color];
    if (col) { g.fillStyle = tvGrad(TV, y, y + rh, tvRampStops(col)); g.fillRect(x + rh * 1.15, y + 1, rh * 0.18, rh - 2); }
    const medal = r.place >= 1 && r.place <= 3 ? BC.metal.medals[r.place - 1] : null, mx = x + rh * 0.6, my = y + rh / 2, mr = rh * 0.36;
    if (medal) { g.fillStyle = tvGrad(TV, my - mr, my + mr, medal); g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.5 * S; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke(); }
    tvText(TV, r.place === null || r.place === undefined ? '—' : String(r.place), mx, my + rh * 0.02, rh * 0.48, medal ? '#0b0f17' : BC.glassInk, 'center', 900);
    tvText(TV, tvUp(r.name), x + rh * 1.55, my + rh * 0.02, rh * 0.5, BC.glassInk, 'left', 800);
    if (r.note) tvText(TV, tvUp(r.note), x + w - rh * 3.4, my + rh * 0.02, rh * 0.36, 'rgba(255,255,255,0.7)', 'right', 600);
    tvText(TV, String(r.value ?? ''), x + w - rh * 0.4, my + rh * 0.02, rh * 0.52, BC.glassInk, 'right', 800);
    if (i === 0 && medal && TV.P.sheen) {
      const s = (age - TV.P.in * 2 - rows.length * 5) / TV.P.sheen;
      if (s > 0 && s < 1) { g.save(); tvPath(TV, x, y, w, rh, 0); g.clip(); const cx = x + (w + 200) * s - 100, gr = g.createLinearGradient(cx - 80, 0, cx + 80, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, BC.metal.sheen); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.3; g.fillStyle = gr; g.fillRect(x, y, w, rh); g.restore(); }
    }
    g.restore();
  });
  if (q.foot) { const fy = top + hh + 4 * S + rows.length * (rh + 3 * S) + 18 * S; g.save(); g.globalAlpha = tvClamp((age - TV.P.in * 2) / 20) * (0.6 + 0.3 * Math.sin(TV.f * 0.08)); tvText(TV, tvUp(q.foot), W / 2, fy, 12 * S, '#ffffff', 'center', 700); g.restore(); }
}

// the stats panel: a title plate, the sides' chips over their columns, a row a stat with its words beside the values
// (head to head: the words between two columns; more places: the words first), the leading value on its side's colour
function tvDrawPanel(TV, W, H, S) {
  const q = TV.panel, g = TV.g, BC = TV.BC, L = tvLife(TV, q.at, q.hold);
  if (L.gone) { TV.panel = null; return; }
  if (L.age < 0) return;
  const cols = q.cols || [], rows = q.rows || [], two = cols.length === 2;
  const rh = 28 * S, hh = 40 * S, w = Math.min((two ? 520 : 400 + 92 * cols.length) * S, W * 0.86), x = W / 2 - w / 2;
  const top = Math.max(H * 0.2, H * 0.58 - (hh + rh * (rows.length + 1)) / 2);
  const wordsW = two ? w * 0.44 : w * 0.38, cw = two ? (w - wordsW) / 2 : (w - wordsW) / Math.max(1, cols.length);
  const colX = (i) => (two ? (i === 0 ? x + cw / 2 : x + w - cw / 2) : x + wordsW + cw * (i + 0.5));
  const wordsX = two ? W / 2 : x + rh * 0.5;
  g.save();
  g.globalAlpha = tvClamp(L.k * 2) * (1 - L.x);
  g.translate(0, L.x * 30 * S);
  if (tvEnter(TV, L, W / 2, top + hh / 2)) {
    const ink = tvPlateAt(TV, x, top, w, hh, BC.metal.accent ? 'gold' : 'neutral', null, (L.age - TV.P.in) / (TV.P.sheen * 1.5 || 1));
    tvText(TV, tvUp(q.title || 'stats'), W / 2, top + hh * 0.55, hh * 0.46, ink, 'center');
  }
  // the places' chips over their columns
  const y0 = top + hh + 3 * S;
  tvPlateAt(TV, x, y0, w, rh, 'neutral', null, null, 0);
  cols.forEach((c, i) => {
    const col = BC.colors[c.color], cx = colX(i), name = tvUp(c.name), nw = Math.min(cw - 6 * S, tvTextW(TV, name, rh * 0.46, 800) + rh * 0.8);
    if (col) { g.fillStyle = tvGrad(TV, y0 + 2, y0 + rh - 2, tvRampStops(col)); g.fillRect(cx - nw / 2, y0 + 3 * S, nw, rh - 6 * S); }
    tvText(TV, name, cx, y0 + rh * 0.54, rh * 0.46, col ? col.ink : BC.glassInk, 'center', 800);
  });
  rows.forEach((r, i) => {
    const age = L.age - TV.P.in - i * 4;
    if (age < 0) return;
    const k = TV_EASE[TV.P.ease](tvClamp(age / TV.P.in)), y = y0 + (i + 1) * (rh + 2 * S);
    g.save(); g.globalAlpha *= tvClamp(k * 2); g.translate(0, (1 - k) * 10 * S);
    tvPlateAt(TV, x, y, w, rh, 'neutral', null, null, 0);
    tvText(TV, tvUp(r.words), wordsX, y + rh * 0.54, rh * 0.42, 'rgba(255,255,255,0.78)', two ? 'center' : 'left', 600);
    (r.cells || []).forEach((cell, j) => {
      const cx = colX(j), lead = r.lead === j, col = BC.colors[cols[j] && cols[j].color];
      if (lead && col) { const bw = Math.max(rh * 1.6, tvTextW(TV, cell, rh * 0.56, 900) + rh * 0.7); g.fillStyle = tvGrad(TV, y + 3, y + rh - 3, tvRampStops(col)); g.fillRect(cx - bw / 2, y + 3 * S, bw, rh - 6 * S); }
      tvText(TV, cell, cx, y + rh * 0.55, rh * 0.56, lead && col ? col.ink : BC.glassInk, 'center', lead ? 900 : 700);
    });
    g.restore();
  });
  g.restore();
}
