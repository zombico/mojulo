/**
 * field-gates — the field-orchestra principles as machine checks over a beats-composition.
 *
 *   fieldGates(manifest, 'idyllic' | 'adventurous') → [] when every principle holds, else one line per breach
 *
 * Advisory, like every gate here: it reports and never refuses. It checks the principles a machine can see
 * (card `beats-field-orchestra`): one colour alone at the opening, the parts and leads sounding together inside
 * the energy's budget, no V–i at the loop seam, a dynamics ceiling, and (adventurous) motion. Whether it sounds
 * right is the ears gate. Pure.
 */
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';
import { expandBeatsManifest, kitOf, parseChord } from './beats-authoring.js';

export const FIELD_BUDGETS = {
  idyllic: { parts: 4, leads: 1, vel: 0.65 },
  adventurous: { parts: 5, leads: 2, vel: 0.8, notesPerSecond: 3 },
};
const NOT_LEADS = /^(timpani|glockenspiel|crotales)$/;
const barLenOf = (m) => { const r = /^(\d+)\/(\d+)$/.exec(m.meter || '4/4'); return r ? (4 * r[1]) / r[2] : 4; };

// a part's sounding events: its own, plus its form's phrases placed at their bars.
function eventsOf(p, m, len) {
  const placed = (p.form || []).flatMap((f) => {
    const at0 = Number(String(f.at).split(':')[0]) * len;
    const tr = f.transpose || 0;
    return ((m.phrases || {})[f.phrase] || []).map((e) => [at0 + e[0], e[1], e[2], e[3] == null ? 0.8 : e[3] * (f.vel || 1), tr]);
  });
  return (p.events || []).concat(placed);
}
function barsOf(p, m, len) {
  const out = new Set();
  for (const ev of eventsOf(p, m, len)) {
    const at = Array.isArray(ev) ? ev[0] : ev.at, d = Array.isArray(ev) ? ev[2] : ev.d;
    if (typeof at !== 'number') continue;
    const end = at + (typeof d === 'number' ? d : 0.25);
    for (let b = Math.floor(at / len); b < Math.ceil(end / len - 1e-9); b++) out.add(b);
    out.add(Math.floor(at / len));
  }
  return out;
}
const chartOf = (m) => (Array.isArray(m.progression) ? m.progression : [m.progression]).flatMap((e) => {
  if (typeof e === 'string') return e.trim().split(/\s+/);
  if (e && typeof e.chords === 'string') return Array(e.repeat || 1).fill(e.chords.trim().split(/\s+/)).flat();
  return [];
});

/** The principles a machine can check, over a beats-composition at an energy. [] = all hold. */
export function fieldGates(manifest, energy) {
  const B = FIELD_BUDGETS[energy];
  if (!B) throw new Error(`fieldGates: energy must be one of ${Object.keys(FIELD_BUDGETS).join(', ')}`);
  const v = validateBeatsManifest(manifest);
  if (!v.ok) return v.errors.map((e) => `invalid: ${e}`);
  const out = (v.warnings || []).map((w) => `warning: ${w}`);
  const m = expandBeatsManifest(normalizeBeatsManifest(manifest)), len = barLenOf(m);
  const pitched = m.parts.filter((p) => !kitOf(p));
  // leads are read from the recipe as written: expansion turns a chord part's chart into plain events.
  const leadNames = new Set((manifest.parts || []).filter((p) => p && p.chordVoice === undefined && p.groove === undefined && !NOT_LEADS.test(p.instrument || '')).map((p) => p.name));
  const leads = pitched.filter((p) => leadNames.has(p.name));
  const span = Math.max(0, ...pitched.flatMap((p) => [...barsOf(p, m, len)]));

  const early = pitched.filter((p) => [0, 1].some((b) => barsOf(p, m, len).has(b)));
  if (early.length !== 1) out.push(`layers: bars 0–1 should be one colour alone (heard: ${early.map((p) => p.name).join(', ') || 'nothing'})`);
  for (let b = 0; b <= span; b++) {
    const n = pitched.filter((p) => barsOf(p, m, len).has(b)).length;
    if (n > B.parts) out.push(`space: bar ${b} has ${n} pitched parts (${energy} budget ${B.parts})`);
    const l = leads.filter((p) => barsOf(p, m, len).has(b)).length;
    if (l > B.leads) out.push(`answer: bar ${b} has ${l} leads at once (${energy} budget ${B.leads})`);
  }
  const chart = chartOf(manifest);
  if (manifest.key && chart.length >= 2) {
    const [a, z] = chart.slice(-2).map((s) => parseChord(s, manifest.key));
    const tonic = parseChord(/m$/.test(manifest.key) ? 'i' : 'I', manifest.key);
    if (a && z && tonic && z.root === tonic.root && a.root === (tonic.root + 7) % 12) out.push('seam: the loop closes V–i');
  }
  const vels = pitched.flatMap((p) => eventsOf(p, m, len).map((e) => (Array.isArray(e) ? e[3] : e.v)).filter((x) => typeof x === 'number'));
  if (vels.length && Math.max(...vels) > B.vel + 1e-9) out.push(`dynamics: a note at ${Math.max(...vels)} (${energy} ceiling ${B.vel})`);
  if (B.notesPerSecond) {
    const secPerBar = (len * 60) / (m.bpm || 120);
    let moving = 0;
    for (let b = 0; b <= span; b++) {
      const busiest = Math.max(0, ...m.parts.map((p) => (p.events || []).filter((e) => { const at = Array.isArray(e) ? e[0] : e.at; return typeof at === 'number' && Math.floor(at / len) === b; }).length));
      if (busiest / secPerBar >= B.notesPerSecond) moving++;
    }
    if (moving / (span + 1) <= 0.5) out.push(`motion: only ${moving} of ${span + 1} bars have a part at ${B.notesPerSecond}+ notes a second`);
  }
  return out;
}
