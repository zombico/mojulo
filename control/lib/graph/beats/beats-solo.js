/**
 * beats-solo — the soloist: a seeded solo over a composition's chord chart
 * (roots styles). Pure; no audio.
 *
 * A pitched part's `solo: { style, scale?, bars, seed?, density?, arc?,
 * register?, licks? }` lowers to literal object events at expansion. Licks are
 * written in scale steps and chord tones from an anchor, not in notes, so each
 * one transposes to the chord, the key and the register. The phrasing rules:
 * land chord tones on strong beats, breathe after a lick, sometimes repeat the
 * last lick with a variation, climb with the arc, end on the root or the third
 * with vibrato. The style picks the scale, the licks, the grid and the density;
 * every one can be overridden. Deterministic: the same seed is the same solo.
 */

export const SCALES = {
  'minor-pent': [0, 3, 5, 7, 10], 'major-pent': [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10],
  'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10], 'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11], diminished: [0, 2, 3, 5, 6, 8, 9, 11], 'whole-tone': [0, 2, 4, 6, 8, 10],
};
export const SOLO_ARCS = ['build', 'flat', 'call', 'response'];

// Licks: (ctx) → notes { t (quarters from the lick start), d, s (pool steps
// from the anchor) | c (chord-tone steps from the anchor's nearest chord tone,
// plus m semitones) | deg (semitones above the tonic, nearest the anchor) |
// m (semitones from the anchor), dy? (a double stop: a second note about dy
// semitones above — a chord tone on a strong beat, a scale note elsewhere), art? }.
const run = (n, dir, g, from = 0, art) => Array.from({ length: n }, (_, k) => ({ t: k * g, d: g, s: from + dir * k, ...(art && k ? { art } : {}) }));
const VIB = (depth, rate, delay) => ({ type: 'vib', depth, rate, delay });
const LICKS = {
  // blues
  bend5: () => [{ t: 0, d: 1.5, deg: 5, art: { type: 'bend', to: 2, at: 0.05, over: 0.12, vib: { depth: 35, delay: 0.2 } } }],
  curl: () => [{ t: 0, d: 0.5, deg: 3, art: { type: 'bend', to: 1, at: 0.02, over: 0.08 } }, { t: 0.5, d: 1, deg: 0, below: true, art: VIB(30, 5.5, 0.2) }],
  pedal: () => [0, -1, 0, -2, 0, -3].map((s, k) => ({ t: k * 0.5, d: 0.5, s: k % 2 ? s : 0 })),
  descend: () => run(6, -1, 0.5).concat([{ t: 3, d: 1, s: -6, art: VIB(35, 5.5, 0.15) }]),
  'double-stop': () => [0, 0.5, 1, 1.5].map((t, k) => ({ t, d: 0.5, s: k < 2 ? 0 : -1, dy: 5 })),
  'hold-vib': () => [{ t: 0, d: 2, s: 0, art: VIB(45, 5.5, 0.25) }],
  // country
  chick: () => [{ t: 0, d: 0.25, s: 0, art: 'pm' }, { t: 0.25, d: 0.25, s: 1 }, { t: 0.5, d: 0.25, s: 0, art: 'pm' }, { t: 0.75, d: 0.25, s: 2 }, { t: 1, d: 0.5, s: 1 }, { t: 1.5, d: 0.5, s: 0 }],
  'steel-bend': () => [{ t: 0, d: 1.5, s: 0, art: { type: 'bend', to: 2, at: 0.1, over: 0.25 } }, { t: 0, d: 1.5, s: 3 }],
  'major-run': () => run(5, 1, 0.5, 0).map((x, k) => (k ? x : { ...x, art: { type: 'slide', in: -2 } })).concat([{ t: 2.5, d: 1, s: 5, art: VIB(25, 6, 0.15) }]),
  sixths: () => [0, 0.5, 1, 1.5].map((t, k) => ({ t, d: 0.5, s: -k, dy: 9 })),
  // virtuoso rock
  legato3: (c) => { const g = c.fast; const up = c.rng() < 0.5; return Array.from({ length: 9 }, (_, k) => ({ t: k * g, d: g, s: (up ? 1 : -1) * k, ...(k % 3 ? { art: up ? 'hammer' : 'pull' } : {}) })); },
  'tap-arp': (c) => { const g = c.fast; const out = []; for (let k = 0; k < 12; k++) { const i = k % 3; out.push({ t: k * g, d: g, c: [4, 2, 0][i], ...(i === 0 ? { art: 'tap' } : { art: 'pull' }) }); } return out; },
  sweep: (c) => { const g = c.fast; return Array.from({ length: 6 }, (_, k) => ({ t: k * g, d: g, c: k })).concat([{ t: 6 * g, d: 1, c: 6, art: VIB(40, 6, 0.1) }]); },
  climb: () => [0, 1, 2].flatMap((o) => [{ t: o * 1, d: 0.5, s: o * 3 }, { t: o * 1 + 0.5, d: 0.5, s: o * 3 + 2 }]),
  whammy: (c) => [{ t: 0, d: 2, s: 0, art: c.rng() < 0.5 ? { type: 'dive', to: -12, at: 0.4, over: 0.5 } : { type: 'harm', vib: { depth: 70, rate: 7, delay: 0.1 } } }],
  'nat-bell': () => [{ t: 0, d: 1, c: 0, art: { type: 'nat', k: 2 } }, { t: 1, d: 1, c: 1, art: { type: 'nat', k: 2 } }, { t: 2, d: 1.5, c: 2, art: { type: 'nat', k: 3 } }],
  speak: () => [{ t: 0, d: 1, s: 0, art: { type: 'bend', to: 2, at: 0.05, over: 0.12, release: { at: 0.45, over: 0.12 } } }, { t: 1, d: 1, s: -1, art: { type: 'bend', to: 1, at: 0.04, over: 0.1 } }],
  'slow-vib': () => [{ t: 0, d: 3, s: 0, art: VIB(60, 4.5, 0.3) }],
  // classical
  'scale-run': () => run(8, 1, 0.25).map((x, k) => (k % 4 ? x : { ...x, art: 'rest' })),
  'arp-figure': () => [0, 1, 2, 3, 2, 1, 0, 1].map((c, k) => ({ t: k * 0.25, d: 0.25, c })),
  tremolo: () => { const out = []; for (let b = 0; b < 2; b++) { out.push({ t: b, d: 0.25, c: -3 }); for (let k = 1; k < 4; k++) out.push({ t: b + k * 0.25, d: 0.25, s: -b }); } return out; },
  campanella: () => run(6, 1, 0.5).map((x) => ({ ...x, d: 1 })),
  melody: () => [{ t: 0, d: 1, s: 0, art: 'rest' }, { t: 1, d: 0.5, s: 1 }, { t: 1.5, d: 0.5, s: 2 }, { t: 2, d: 1.5, s: 1, art: 'rest' }],
  // flamenco
  picado: (c) => { const g = c.fast; return run(10, -1, g, 4).concat([{ t: 10 * g, d: 1, s: -6, art: VIB(20, 6.5, 0.2) }]); },
  'phrygian-fall': () => [5, 3, 1, 0].map((deg, k) => ({ t: k * 0.5, d: k === 3 ? 1.5 : 0.5, deg, ...(k === 3 ? { art: VIB(20, 6.5, 0.2) } : {}) })),
  'rest-melody': () => [{ t: 0, d: 0.75, s: 0, art: 'rest' }, { t: 0.75, d: 0.25, s: -1 }, { t: 1, d: 1, s: 0, art: { type: 'slide', in: -1 } }],
  // gypsy jazz
  'arp-approach': () => [{ t: 0, d: 0.5, c: 0, m: -1 }, { t: 0.5, d: 0.5, c: 0 }, { t: 1, d: 0.5, c: 1 }, { t: 1.5, d: 0.5, c: 2 }, { t: 2, d: 0.5, c: 3 }, { t: 2.5, d: 1, c: 4, art: VIB(22, 7.5, 0.1) }],
  'dim-run': () => Array.from({ length: 6 }, (_, k) => ({ t: (k * 1) / 3, d: 1 / 3, m: k * 3 })).concat([{ t: 2, d: 1, c: 0 }]),
  rake: () => [{ t: 0, d: 1.5, c: 2, art: { type: 'rake', n: 3, vib: { depth: 22, rate: 7.5, delay: 0.1 } } }],
  chromatic: () => Array.from({ length: 6 }, (_, k) => ({ t: (k * 1) / 3, d: 1 / 3, m: -k })).concat([{ t: 2, d: 1, c: 0 }]),
};
export const LICK_NAMES = Object.keys(LICKS);

// per style: scale (by key mode), licks (the first half calm, the second the peak's), grid, density, register.
const STYLES = {
  blues: { scale: () => 'blues', calm: ['bend5', 'curl', 'hold-vib', 'pedal'], hot: ['descend', 'double-stop', 'pedal', 'bend5'], grid: 0.5, fast: 0.25, density: 0.55, register: [55, 81], vib: VIB(40, 5.5, 0.2) },
  country: { scale: () => 'major-pent', calm: ['steel-bend', 'sixths', 'major-run'], hot: ['chick', 'major-run', 'chick', 'sixths'], grid: 0.5, fast: 0.25, density: 0.6, register: [55, 79], vib: VIB(25, 6, 0.15) },
  'virtuoso-rock': { scale: (minor) => (minor ? 'aeolian' : 'lydian'), calm: ['slow-vib', 'speak', 'nat-bell', 'climb'], hot: ['legato3', 'tap-arp', 'sweep', 'whammy', 'legato3'], grid: 0.5, fast: 1 / 6, density: 0.7, register: [52, 88], vib: VIB(60, 4.5, 0.3) },
  classical: { scale: (minor) => (minor ? 'harmonic-minor' : 'major'), calm: ['melody', 'campanella', 'arp-figure'], hot: ['scale-run', 'tremolo', 'arp-figure'], grid: 0.5, fast: 0.25, density: 0.65, register: [52, 83], vib: VIB(15, 5, 0.3) },
  flamenco: { scale: () => 'phrygian-dominant', calm: ['rest-melody', 'phrygian-fall'], hot: ['picado', 'phrygian-fall', 'picado'], grid: 0.5, fast: 1 / 6, density: 0.7, register: [52, 83], vib: VIB(20, 6.5, 0.2) },
  'gypsy-jazz': { scale: (minor) => (minor ? 'harmonic-minor' : 'major'), calm: ['arp-approach', 'rake'], hot: ['arp-approach', 'dim-run', 'chromatic', 'rake'], grid: 0.5, fast: 1 / 3, density: 0.65, register: [55, 86], vib: VIB(22, 7.5, 0.1) },
};
export const SOLO_STYLES = Object.keys(STYLES);
// arts a non-plucked voice (a fiddle, a harmonica, a steel's sustain) can't play; hammer/pull glide instead.
const PLUCK_ONLY = new Set(['pm', 'harm', 'nat', 'tap', 'pop', 'rake']);

/**
 * generateSolo(part, h) → object events. h: { chart, clock, key, seed,
 * parseChord, parseKey, nameOf, midiOf, dice(seed) → rng, plucked }.
 */
export function generateSolo(p, h) {
  const o = p.solo, S = STYLES[o.style] || STYLES.blues;
  const k = h.parseKey(h.key);
  const firstCh = h.chart.length ? h.parseChord(h.chart[0].sym, h.key) : null;
  const tonic = k ? k.tonic : firstCh ? firstCh.root : 0;
  const minor = k ? k.minor : !!(firstCh && firstCh.intervals.includes(3));
  const scaleName = o.scale && o.scale !== 'auto' && o.scale !== 'chord' ? o.scale : S.scale(minor);
  const scalePcs = new Set(SCALES[scaleName].map((x) => (x + tonic) % 12));
  const [lo, hi] = Array.isArray(o.register) ? o.register.map((n) => (typeof n === 'string' ? h.midiOf(n) : n)) : S.register;
  const barsR = Array.isArray(o.bars) ? o.bars : [0, o.bars];
  const q0 = h.clock.barQ(barsR[0]), q1 = h.clock.barQ(barsR[1]);
  const rng = h.dice(o.seed != null ? o.seed : h.seed);
  const density = Math.max(0.1, Math.min(1, (o.density != null ? o.density : S.density)));
  const arc = o.arc || 'build';
  const pickFrom = (list) => list[Math.floor(rng() * list.length)];
  const segs = h.chart.map((sg) => ({ a: h.clock.barQ(sg.at), b: h.clock.barQ(sg.at + sg.bars), ch: h.parseChord(sg.sym, h.key) })).filter((x) => x.ch);
  const chordAt = (q) => { let c = segs[0]; for (const sg of segs) if (sg.a <= q + 1e-9) c = sg; return c ? c.ch : { root: tonic, intervals: [0, minor ? 3 : 4, 7] }; };
  const chordPcs = (ch) => new Set(ch.intervals.map((x) => (x + ch.root) % 12));
  const pool = [];
  for (let m = lo; m <= hi; m++) if (scalePcs.has(m % 12)) pool.push(m);
  const nearestIdx = (m) => pool.reduce((bi, x, i) => (Math.abs(x - m) < Math.abs(pool[bi] - m) ? i : bi), 0);
  const ctIn = (ch, near) => { const pcs = chordPcs(ch); const list = []; for (let m = lo - 12; m <= hi + 12; m++) if (pcs.has(m % 12)) list.push(m); return { list, i0: list.reduce((bi, x, i) => (Math.abs(x - near) < Math.abs(list[bi] - near) ? i : bi), 0) }; };
  const allowed = (lick) => (h.plucked ? true : !['tap-arp', 'nat-bell', 'chick', 'rake'].includes(lick));
  const pool2 = (names) => { const list = (Array.isArray(o.licks) && o.licks.length ? o.licks : names).filter((n) => LICKS[n] && allowed(n)); return list.length ? list : ['hold-vib']; };
  const calm = pool2(S.calm), hot = pool2(Array.isArray(o.licks) && o.licks.length ? o.licks : S.hot);

  const events = [];
  let cursor = q0, last = null, anchor = pool[nearestIdx(lo + (hi - lo) * 0.35)];
  const span = Math.max(1e-9, q1 - q0), endRoom = 2;
  while (cursor < q1 - endRoom - 1e-9) {
    const x = (cursor - q0) / span;
    // call / response: two bars on, two off (response plays the other two).
    if (arc === 'call' || arc === 'response') {
      const barIdx = Math.floor((cursor - q0) / 4);
      if ((Math.floor(barIdx / 2) % 2 === 0) !== (arc === 'call')) { cursor = q0 + (barIdx + 1) * 4; continue; }
    }
    const heat = arc === 'build' ? (x < 0.3 ? 0.2 : x < 0.7 ? 0.5 : 0.95) : 0.5;
    const center = arc === 'build' ? lo + (hi - lo) * (0.3 + 0.45 * x) : lo + (hi - lo) * 0.5;
    let name, notesRel;
    if (last && rng() < 0.3) { name = last.name; notesRel = last.notes; } // the ear's anchor: say it again …
    else { name = pickFrom(rng() < heat ? hot : calm); notesRel = LICKS[name]({ rng, fast: S.fast }); }
    // … a step up or down the second time (the variation), otherwise a new anchor near the arc's center.
    const aIdx = last && name === last.name ? Math.max(0, Math.min(pool.length - 1, nearestIdx(anchor) + (rng() < 0.5 ? 1 : -1))) : nearestIdx(center + (rng() * 2 - 1) * 4);
    anchor = pool[aIdx];
    const lickLen = notesRel.reduce((mx, n) => Math.max(mx, n.t + n.d), 0);
    if (cursor + lickLen > q1 - endRoom + 1e-9) break;
    const ch = chordAt(cursor);
    const ct = ctIn(ch, anchor);
    for (const n of notesRel) {
      const q = cursor + n.t;
      const chq = chordAt(q);
      let m;
      if (n.deg != null) { m = nearestPc((tonic + n.deg) % 12, anchor); if (n.below && m > anchor) m -= 12; }
      else if (n.c != null) { const L = ctIn(chq, anchor); m = L.list[Math.max(0, Math.min(L.list.length - 1, L.i0 + n.c))] + (n.m || 0); }
      else if (n.s != null) m = pool[Math.max(0, Math.min(pool.length - 1, aIdx + n.s))];
      else m = anchor + (n.m || 0);
      while (m > hi) m -= 12;
      while (m < lo) m += 12;
      // strong beats land on chord tones (a bend's target is its own; passing tones may pass).
      const strong = Math.abs(q - Math.round(q)) < 1e-6;
      const pcs = chordPcs(chq);
      const bent = n.art && typeof n.art === 'object' && (n.art.type === 'bend' || n.art.type === 'dive');
      if (strong && !bent && !n.m && !pcs.has(m % 12)) { const L = ctIn(chq, m); m = L.list[L.i0]; }
      let art = n.art;
      if (!h.plucked && art) {
        const ty = typeof art === 'string' ? art : art.type;
        if (ty === 'hammer' || ty === 'pull') art = 'legato';
        else if (PLUCK_ONLY.has(ty)) art = typeof art === 'object' && art.vib ? { type: 'vib', ...(typeof art.vib === 'number' ? { depth: art.vib } : art.vib) } : undefined;
      }
      const v = Math.min(1, (n.t === 0 ? 0.9 : 0.78) * (0.92 + 0.16 * (arc === 'build' ? x : 0.5)) * (1 + (rng() * 2 - 1) * 0.05));
      const notes = n.dy != null ? [m, strong ? (() => { const L = ctIn(chq, m + n.dy); return L.list[L.i0] > m ? L.list[L.i0] : L.list[Math.min(L.list.length - 1, L.i0 + 1)]; })() : pool[nearestIdx(m + n.dy)]] : [m];
      events.push({ at: r6(q), n: notes.length === 1 ? h.nameOf(notes[0]) : notes.map(h.nameOf), d: r6(n.d), v: r6(v), ...(art !== undefined ? { art } : {}) });
    }
    last = { name, notes: notesRel };
    // breathe: a rest that shrinks as the solo heats up and as density rises.
    const rest = Math.max(0.5, Math.round(((1 - density) * 3 * (1.1 - heat) + rng() * 1.5) * 2) / 2);
    cursor = Math.ceil((cursor + lickLen + rest) / S.grid - 1e-9) * S.grid;
  }
  // the ending: home (the key's root or third) when the chord under it holds
  // one; otherwise that chord's root or third (a solo ending on a twelve-bar's
  // turnaround V lands on the V and leads home).
  const endQ = Math.max(q0, Math.min(Math.ceil(cursor), q1 - 1));
  const under = chordAt(endQ), upcs = chordPcs(under);
  const home = [tonic, (tonic + (minor ? 3 : 4)) % 12].filter((pc) => upcs.has(pc));
  const third3 = under.intervals.find((x) => x === 3 || x === 4) ?? 4;
  const tgt = home.length ? ctIn({ root: home[0], intervals: home.map((pc) => (pc - home[0] + 12) % 12) }, anchor) : ctIn({ root: under.root, intervals: [0, third3] }, anchor);
  let endM = tgt.list[tgt.i0];
  while (endM > hi) endM -= 12;
  while (endM < lo) endM += 12;
  events.push({ at: r6(endQ), n: h.nameOf(endM), d: r6(Math.max(1, q1 - endQ)), v: 0.9, art: S.vib });
  return events;
}
function nearestPc(pc, near) { let x = Math.floor(near / 12) * 12 + pc; if (x - near > 6) x -= 12; if (near - x > 6) x += 12; return x; }
function r6(x) { return Math.round(x * 1e6) / 1e6 + 0; }
