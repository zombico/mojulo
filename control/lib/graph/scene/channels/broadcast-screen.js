// broadcasts channel: a persona's read on a SCREEN in the world (lib/graph/persona/screen.js: the news broadcast).
// Opt-in on a world's `broadcasts` key; absent, it adds nothing to the page.
//
// Each screen is a lit plane in a dark frame standing at its point, facing −y turned by its yaw, its picture a canvas
// redrawn when its frame moves (about 15 a second): the set in the package's glass, the channel's bug, the reader as
// the body plays the read (a silhouette that nods, points, bows on the read's gestures, its mouth open on its words),
// the lower third (the reader's name, its strap) for the read's first seconds, and the caption on screen. Its clock is
// the page's `t`, looped over the read and its gap: the same t draws the same frame. It hands the page `stepBroadcasts`
// and publishes `window.__mojBroadcasts` ({ screens, state(i) }) for probes.
//
// screens: broadcastScreens's (persona/screen.js): [{ at, yaw, size, loop, gap, seconds, title, name, strap?, look,
// cues: [[start, end, text]], words: [[t, dur, emph]], body: [[t, gesture]], fidelity }]

import { safeJson } from '../emit-util.js';

export function broadcastScreenScript(screens) {
  return `
// ── broadcasts: a persona's read on a screen in the world ──
{
const BC = ${safeJson(screens)};
const BC_W = 1024, BC_H = 576, BC_STRAP = 6, BC_GESTURE = 0.9;
const bcAt = (list, t) => { for (let i = list.length - 1; i >= 0; i--) if (list[i][0] <= t) return list[i]; return null; };
const bcScreens = BC.map((s) => {
  const cv = document.createElement('canvas'); cv.width = BC_W; cv.height = BC_H;
  const tex = new THREE.CanvasTexture(cv); if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  const W = s.size[0], H = s.size[1], g = new THREE.Group();
  const face = new THREE.PlaneGeometry(W, H); face.rotateX(Math.PI / 2);
  const pic = new THREE.Mesh(face, new THREE.MeshBasicMaterial({ map: tex })); pic.position.y = -0.001; pic.userData.g = 'broadcast:screen';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.06, H + 0.08), new THREE.MeshBasicMaterial({ color: 0x111317 })); frame.position.y = 0.031;
  g.add(frame); g.add(pic); g.position.set(s.at[0], s.at[1], s.at[2]); g.rotation.z = s.yaw * Math.PI / 180; scene.add(g);
  return { s, ctx: cv.getContext('2d'), tex, key: -1, state: null };
});
function bcReader(c, s, tt, look) {
  // the reader: the body's register on the read's gestures (nod, point, bow, shrug, think, cheer), the mouth on its words
  const G = bcAt(s.body, tt), gk = G && tt - G[0] < BC_GESTURE ? G[1] : null, u = G ? (tt - G[0]) / BC_GESTURE : 0, swing = Math.sin(Math.PI * Math.min(1, u));
  const nod = gk === 'nod' ? 10 * swing : gk === 'bow' ? 26 * swing : 0, tilt = gk === 'think' ? 0.12 * swing : gk === 'shrug' ? -0.06 * swing : 0;
  const W = bcAt(s.words, tt), talking = W && tt < W[0] + W[1], open = talking ? (W[2] ? 14 : 9) * Math.abs(Math.sin(Math.PI * (tt - W[0]) / Math.max(0.08, W[1]))) : 1;
  const x = 330, y = 205;
  c.fillStyle = '#2b3448'; c.beginPath(); c.ellipse(x, 440, 165, 145, 0, Math.PI, 0); c.fill();                  // the shoulders
  c.fillStyle = '#d9dee8'; c.beginPath(); c.moveTo(x - 30, 300); c.lineTo(x + 30, 300); c.lineTo(x, 345); c.fill(); c.fillStyle = look.accent; c.fillRect(x - 6, 318, 12, 90);                                                        // the tie
  if (gk === 'point' || gk === 'cheer') { c.strokeStyle = '#2b3448'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 120, 420); c.lineTo(x + 190 + 20 * swing, gk === 'cheer' ? 250 - 60 * swing : 360 - 20 * swing); c.stroke(); }
  c.save(); c.translate(x, y + nod); c.rotate(tilt);
  c.fillStyle = '#3a4459'; c.beginPath(); c.ellipse(0, 0, 62, 78, 0, 0, Math.PI * 2); c.fill();                  // the head
  c.fillStyle = '#e8ecf4'; c.fillRect(-28, -12, 14, 5); c.fillRect(14, -12, 14, 5);                                // the eyes
  c.fillStyle = '#0b0e14'; c.beginPath(); c.ellipse(0, 34, 18, open / 2 + 1, 0, 0, Math.PI * 2); c.fill();        // the mouth
  c.restore();
  return gk;
}
function bcDraw(B, tt, on) {
  const c = B.ctx, s = B.s, look = s.look, font = (px, w) => (w || look.weight) + ' ' + px + 'px ' + look.face;
  const bg = c.createLinearGradient(0, 0, 0, BC_H); bg.addColorStop(0, look.glass[0]); bg.addColorStop(1, look.glass[1]); c.fillStyle = bg; c.fillRect(0, 0, BC_W, BC_H);
  c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 6; i++) c.fillRect(560 + i * 70, 60, 44, 300);       // the set behind the desk
  c.fillStyle = look.accent; c.fillRect(36, 30, 96, 40); c.fillStyle = '#0b0e14'; c.font = font(24); c.textBaseline = 'middle'; c.fillText(on ? 'LIVE' : 'NEXT', 48, 51);
  c.fillStyle = '#ffffff'; c.font = font(24); c.fillText(s.title.toUpperCase(), 148, 51);
  const gesture = on ? bcReader(c, s, tt, look) : null;
  c.fillStyle = '#0d1018'; c.fillRect(0, 440, BC_W, 30);                                                           // the desk
  if (on && tt < BC_STRAP) {                                                                                        // the lower third
    c.fillStyle = 'rgba(8,10,16,0.88)'; c.fillRect(40, 372, 620, 62); c.fillStyle = look.accent; c.fillRect(40, 372, 8, 62);
    c.fillStyle = '#ffffff'; c.font = font(28); c.fillText(String(s.name).toUpperCase(), 62, 392); if (s.strap) { c.font = font(18, 500); c.fillStyle = '#c9d1e0'; c.fillText(s.strap, 62, 420); }
  }
  const cue = on ? bcAt(s.cues, tt) : null, text = cue && tt < cue[1] ? cue[2] : '';
  if (text) {                                                                                                       // the caption
    const rows = text.split('\\n'); c.font = font(30, 600); c.textAlign = 'center';
    const w = Math.max(...rows.map((r) => c.measureText(r).width)) + 36, h = rows.length * 38 + 16;
    c.fillStyle = 'rgba(0,0,0,0.78)'; c.fillRect(BC_W / 2 - w / 2, BC_H - 18 - h, w, h);
    c.fillStyle = '#ffffff'; rows.forEach((r, i) => c.fillText(r, BC_W / 2, BC_H - 18 - h + 8 + 19 + i * 38)); c.textAlign = 'left';
  }
  B.state = { t: Math.round(tt * 1000) / 1000, on, caption: text, gesture, fidelity: s.fidelity };
}
stepBroadcasts = function (t) {
  for (const B of bcScreens) {
    const s = B.s, period = s.seconds + s.gap, tt = s.loop ? t % period : Math.min(t, s.seconds), on = tt < s.seconds;
    const key = Math.floor(tt * 15);
    if (key === B.key) continue;
    B.key = key; bcDraw(B, tt, on); B.tex.needsUpdate = true;
  }
};
window.__mojBroadcasts = { screens: bcScreens.length, state: (i) => (bcScreens[i] ? bcScreens[i].state : null) };
}`;
}
