/**
 * What every science world's page shares: the drawing scale and the liberties it declares (a scale other than a
 * metre per unit, time sped up or slowed), small geometry (a quad, a unit bar the link mover stretches, a lattice of
 * bars for a see-through box or membrane), the cameras that fit a set of points, and the honesty panel's sections.
 * Pure; every scale's world.js lays its own model out with these.
 */

export const PALETTE = ['#e0b15f', '#7fa8d6', '#e57cd8', '#7bd88f', '#ff7a59', '#b39ddb', '#ffd54f', '#80cbc4'];

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a) => { const l = len(a) || 1; return scl(a, 1 / l); };
export const sig = (v, n = 3) => +(+v).toPrecision(n);
export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const hex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
export const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
export const hexInt = (h) => parseInt(h.slice(1), 16);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A uniform drawing scale: metres as they are from a millimetre to ten kilometres, a power of ten outside. */
export function drawScale(L) {
  if (!(L > 0)) return 1;
  if (L >= 1e-3 && L <= 1e4) return 1;
  return 10 ** Math.round(Math.log10(20 / L));
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const pow10 = (k) => `10${String(k).split('').map((c) => SUP[c]).join('')}`;
export const times = (x) => {
  if (x >= 1e6) { const e = Math.floor(Math.log10(x)); return `${sig(x / 10 ** e, 2)} × ${pow10(e)}×`; }
  return x >= 10 ? `${sig(x, 2).toLocaleString('en-US')}×` : `${sig(x, 2)}×`;
};

/** The liberty a drawing scale other than one metre per unit takes (none at 1). */
export function scaleLiberty(s) {
  if (s === 1) return null;
  const k = Math.round(-Math.log10(s));
  return s > 1
    ? { what: `magnified ${pow10(-k)}× (one grid unit is ${pow10(k)} m)`, why: 'so the smallest things can be seen' }
    : { what: `drawn at 1 : ${pow10(k)} (one grid unit is ${pow10(k)} m)`, why: 'so the whole motion fits the view' };
}

/** The liberty a playback other than real time takes (none within 5%). */
export function timeLiberty(duration, playback) {
  const rate = duration / playback;
  if (Math.abs(rate - 1) <= 0.05) return null;
  const why = `${sig(duration, 3)} s of the model plays in ${sig(playback, 3)} s`;
  return rate > 1 ? { what: `time runs ${times(rate)} faster than real`, why } : { what: `time runs ${times(1 / rate)} slower than real`, why };
}

export function quad(corners, fill, group) { return { corners, fill, group }; }

/** A unit bar along +x from the origin (the link mover places, aims and stretches it). */
export function unitBar(w, fill, group) {
  const p = [[0, -w, -w], [1, -w, -w], [1, w, -w], [0, w, -w], [0, -w, w], [1, -w, w], [1, w, w], [0, w, w]];
  return [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]].map((f) => quad(f.map((k) => p[k]), fill, group));
}

/** A static bar between two points (a box edge, a membrane strand), as six quads. */
export function bar(a, b, w, fill, group) {
  const d = sub(b, a), l = len(d);
  if (!(l > 0)) return [];
  const x = scl(d, 1 / l), helper = Math.abs(x[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const y = unit(cross(helper, x)), z = cross(x, y);
  const at = (u, v, t) => add(a, add(scl(x, t * l), add(scl(y, u * w), scl(z, v * w))));
  const p = [at(-1, -1, 0), at(1, -1, 0), at(1, 1, 0), at(-1, 1, 0), at(-1, -1, 1), at(1, -1, 1), at(1, 1, 1), at(-1, 1, 1)];
  return [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]].map((f) => quad(f.map((k) => p[k]), fill, group));
}

/**
 * Side, angle and top cameras that fit a set of points: far enough that their bounding sphere fits the narrower
 * (vertical) field of view, with a margin. `lead` names the view the page opens on.
 */
export function framing(points, { viewBox, minRadius = 1e-6, lead = 'side' } = {}) {
  const mn = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))), mx = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
  const center = scl(add(mn, mx), 0.5);
  const radius = Math.max(...points.map((p) => len(sub(p, center))), minRadius);
  const vb = isObj(viewBox) ? viewBox : { width: 1120, height: 780 };
  const tanV = Math.tan((46 / 2) * Math.PI / 180) * Math.min(1, (vb.height || 780) / (vb.width || 1120));
  const d = (radius / tanV) * 1.12;
  const at = (dir) => add(center, scl(unit(dir), d));
  const cams = {
    side: { name: 'side', worldFraming: { cameraPosition: at([0, -1, 0]), lookAt: center, horizontalFov: 46 } },
    angle: { name: 'angle', worldFraming: { cameraPosition: at([0.55, -0.75, 0.36]), lookAt: center, horizontalFov: 46 } },
    top: { name: 'top', worldFraming: { cameraPosition: at([0, -0.04, 1]), lookAt: center, horizontalFov: 46 } },
  };
  return { center, radius, cameras: [cams[lead], ...['side', 'angle', 'top'].filter((k) => k !== lead).map((k) => cams[k])] };
}

/** The honesty panel's sections, the same on every scale: the model, the checks, what it leaves out, the liberties, the gaps. */
export function honesty({ model, gates, assumptions, liberties, gaps, held }) {
  const note = (g) => {
    const v = g.value || {};
    if (g.id.startsWith('closed-form:')) return Object.keys(v.expected || {}).map((q) => `${q}: expected ${v.expected[q]}, measured ${v.measured?.[q]}`).join('; ');
    return Object.entries(v).map(([k, x]) => `${k} ${typeof x === 'object' ? JSON.stringify(x) : x}`).join(', ');
  };
  return {
    title: `What's real · what's drawn${held ? '' : ' · ⚠ the checks advise'}`,
    checks: { held: gates.filter((g) => g.ok).length, of: gates.length },
    sections: [
      { head: 'The model (real)', color: '#55e08a', items: model.map((text) => ({ text })) },
      { head: 'Checked by the solver', color: '#9ad0ff', items: gates.map((g) => ({ mark: true, ok: g.ok, text: g.want, note: note(g) })) },
      { head: 'Left out (assumptions)', color: '#c9b8ff', items: assumptions.map((a) => ({ text: a })) },
      { head: 'Drawn, not real', color: '#ffb347', items: liberties.map((l) => ({ text: l.what, ...(l.why ? { note: `(${l.why})` } : {}) })) },
      { head: 'Not modelled', color: '#ff7a59', items: gaps.map((g) => ({ text: `${g.law}: ${g.why}` })) },
    ],
  };
}
