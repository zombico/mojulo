/**
 * FIGURES ON A GROUND — a game's cast painted so each is told from the land it stands on and from the others, by every
 * eye. The palette (solve.js) is solved for a WORLD; who walks it was coloured elsewhere (a lineage's own skin, a
 * pack's cloth, a hero's shirt off the grass ramp), so a green people sank into a green meadow. The world's palette is
 * the ground the cast are figures on, as it is the road a race's cars are figures on (livery.js): this reads what a
 * figure is seen against and moves it clear.
 *
 * A figure says how much of it may move (`keep`):
 *   'colour'  nothing: it is measured, never moved (a hero already dressed, a colour the creator wrote)
 *   'hue'     its value and its chroma, inside its own hue family (HUE_KEEP degrees either way): a goblin stays green,
 *             an orc olive. Of the candidates that clear the ground and the figures before it, the one NEAREST the
 *             colour it had is taken, so a figure moves as little as it must, its hue turning last (TURN_COST: lighter
 *             or richer it is still itself); where none clears, the clearest is taken and the laws say so
 *   'free'    anything: the clearest colour at a figure's value and chroma (a cloth with no colour of its own)
 * and may name what it wears in place of a colour (`wear`), taken there and then kept as its `keep` says:
 *   'accent'   the palette's accent at its middle stop: the protagonist's
 *   'accent2'  the palette's second accent: the mark of those against it. Where the two accents are neighbours (the
 *              second within AGAINST_GAP degrees of the protagonist's hue) a mark in it would read as the protagonist's
 *              own colour, so it is worn as 'against' instead
 *   'against'  the protagonist's complement, at a cloth's value and chroma: the colour furthest from the one the eye
 *              follows
 *   '#rrggbb'  a colour it is put in (a hero in the accent its world's author NAMED, not the solved role's stop)
 *
 *   seenOn(palette)                        → [{ what, hex, min }] what a figure on foot is seen against: the ground and
 *                                            the foliage (it stands on one, in front of the other), the soil and the rock
 *   figureClear(hex, against)              → { clear, nearest }: its OKLab distance from the nearest thing it stands on
 *   solveFigures({ palette?, against?, figures }) → { figures: [{ id, hex, was?, clear, nearest, moved, turned }],
 *                                            against, laws: [{ law, ok, value, want }] }
 *     figures  [{ id, hex?, wear?, keep?: 'colour' | 'hue' | 'free', protagonist?: true }], solved in their order: the
 *              protagonist first, since the rest are painted clear of it too. One that names both a colour and what it
 *              wears is measured in the colour it has and solved into what it wears
 *   measureFigures(same)                   → the same, nothing moved (every figure kept as it is): what is, said
 *
 * The laws measure and advise; none refuses. Pure, no dice: a function of the palette and the figures alone, so a cast
 * solved once is solved the same again.
 */
import { oklch, rgbToHex, hexToRgb, deltaE, simulate, CVD_KINDS, lchOf, hueGap, wrapHue } from './oklab.js';

/** Under this (OKLab) a figure sinks into what it stands on; a solved one is moved to FIGURE_CLEAR, with room to spare
 * for a palette's shift (a colour script's dusk, a level's own hour). */
export const FIGURE_MIN = 0.12;
export const FIGURE_CLEAR = 0.16;
/** How far apart two figures sit, and the share of each distance that must survive a colour-vision simulation. */
export const FIGURE_PAIR = 0.08;
const CVD_SHARE = 0.5;
/** How far a figure's hue may turn and still be its own family (degrees, OKLCH). */
export const HUE_KEEP = 20;
export const FIGURE_KEEPS = Object.freeze(['colour', 'hue', 'free']);
export const FIGURE_WEARS = Object.freeze(['accent', 'accent2', 'against']);
/** How near the protagonist's hue a second accent may sit and still be worn as a mark against it (degrees), and the
 * value and chroma its complement is taken at. */
export const AGAINST_GAP = 60;
const AGAINST_CLOTH = Object.freeze({ L: 0.56, C: 0.13 });
/** Under this chroma (OKLCH) a colour is a grey: it has no hue to keep, to turn or to stand against. */
const GREY = 0.03;
// what a figure on foot is seen against, and the share of the clearance each asks: it stands ON the ground, whole, and
// IN FRONT of the foliage, which is behind its head and broken by sky (FIGURE_MIN there, no more); the soil and the
// rock are underfoot only on a trail or a crag
const SEEN = Object.freeze({ ground: 1, foliage: 0.75, soil: 0.6, rock: 0.6 });
// what turning a figure's hue costs beside moving its value or its chroma (OKLab per degree): a creature made lighter
// or richer is still itself, one turned toward another hue is on its way to being something else, so the hue turns last
const TURN_COST = 0.004;
// what a figure's clearance is MEASURED against: the land it stands on and the one behind it
const STOOD_ON = Object.freeze(['ground', 'foliage']);
// the value and chroma a figure's skin or cloth may take (OKLCH): never black, never white, never neon
const L_RANGE = [0.3, 0.8], C_RANGE = [0.03, 0.2];

const HEXRE = /^#[0-9a-f]{6}$/;
const mid = (r) => r[Math.floor(r.length / 2)];
const r3 = (v) => Math.round(v * 1000) / 1000;
const views = (rgb) => [rgb, ...CVD_KINDS.map((k) => simulate(rgb, k))];
// the worst of a colour's distances from another over what each must keep: 1 is just clear
function margin(A, B, min) {
  let worst = deltaE(A[0], B[0]) / min;
  for (let k = 1; k < A.length; k++) worst = Math.min(worst, deltaE(A[k], B[k]) / (min * CVD_SHARE));
  return worst;
}

export function seenOn(palette) {
  if (!palette?.roles) throw new Error('figures: a palette is a solved contract (color-theorist/solve.js solvePalette)');
  return Object.entries(SEEN).filter(([role]) => palette.roles[role]).map(([what, share]) => ({ what, hex: mid(palette.roles[what]), min: r3(FIGURE_CLEAR * share) }));
}

function readAgainst(against) {
  if (!Array.isArray(against) || !against.length) throw new Error('figures: against is a list of { what, hex, min? }');
  return against.map((a, i) => {
    if (!a || typeof a.hex !== 'string' || !HEXRE.test(a.hex.toLowerCase())) throw new Error(`figures: against[${i}].hex is '#rrggbb'`);
    if (a.min !== undefined && !(a.min > 0 && a.min < 1)) throw new Error(`figures: against[${i}].min is an OKLab distance between 0 and 1`);
    return { what: String(a.what ?? 'ground'), hex: a.hex.toLowerCase(), min: a.min ?? FIGURE_CLEAR };
  });
}

/** A figure's distance from the nearest thing it stands on (the first two of `against`: its ground and what is behind it). */
export function figureClear(hex, against) {
  let clear = Infinity, nearest = null;
  for (const a of against.filter((x) => STOOD_ON.includes(x.what) || SEEN[x.what] === undefined)) { const d = deltaE(hexToRgb(hex), hexToRgb(a.hex)); if (d < clear) { clear = d; nearest = a.what; } }
  return { clear: r3(clear), nearest };
}

function readFigures(figures, palette, move) {
  if (!Array.isArray(figures) || !figures.length) throw new Error('figures: figures is a list of { id, hex?, wear?, keep?, protagonist? }');
  const seen = new Set();
  return figures.map((f, i) => {
    const at = `figures[${i}]`;
    if (!f || typeof f.id !== 'string' || !f.id) throw new Error(`figures: ${at}.id names the figure`);
    if (seen.has(f.id)) throw new Error(`figures: ${at}.id '${f.id}' appears twice`);
    seen.add(f.id);
    const given = typeof f.wear === 'string' && HEXRE.test(f.wear.toLowerCase());
    if (f.wear !== undefined && !given && !FIGURE_WEARS.includes(f.wear)) throw new Error(`figures: ${at}.wear is a role a figure wears (${FIGURE_WEARS.join(', ')}) or the colour it is put in ('#rrggbb')`);
    if (f.wear !== undefined && !given && f.wear !== 'against' && !palette) throw new Error(`figures: ${at}.wear reads a palette's role: give the palette`);
    if (f.hex !== undefined && !(typeof f.hex === 'string' && HEXRE.test(f.hex.toLowerCase()))) throw new Error(`figures: ${at}.hex is '#rrggbb'`);
    if (f.hex === undefined && f.wear === undefined) throw new Error(`figures: ${at} has a colour (hex) or a role it wears (wear)`);
    const keep = f.keep ?? (f.wear ? 'hue' : 'colour');
    if (!FIGURE_KEEPS.includes(keep)) throw new Error(`figures: ${at}.keep is how much of it may move (${FIGURE_KEEPS.join(', ')})`);
    // (a figure that names both is MEASURED in the colour it has and SOLVED into what it wears: `from` is what it had)
    const own = f.hex?.toLowerCase() ?? null, worn = f.wear === undefined || (own && !move) ? own : given ? f.wear.toLowerCase() : f.wear === 'against' ? null : mid(palette.roles[f.wear]).toLowerCase();
    return { id: f.id, hex: worn, ...(own && own !== worn ? { from: own } : {}), keep, ...(f.wear && !(own && !move) ? { wear: f.wear } : {}), ...(f.protagonist ? { protagonist: true } : {}) };
  }).map((f, _i, all) => {
    // (a mark against the protagonist: its complement where it is asked for, or where the second accent is its neighbour)
    if (!f.wear || f.wear === 'accent' || HEXRE.test(f.wear)) return f;
    // (a grey protagonist has no hue to stand against: its chroma under GREY names none)
    const lead = all.find((x) => x.protagonist && x.hex), lch = lead ? lchOf(hexToRgb(lead.hex)) : null, hL = lch && lch[1] >= GREY ? lch : null;
    const near = f.wear === 'accent2' && hL && hueGap(lchOf(hexToRgb(f.hex))[2], hL[2]) < AGAINST_GAP;
    if (f.wear === 'against' && !hL) throw new Error(`figures: '${f.id}' is worn against a protagonist: name one (protagonist: true, in a colour with a hue) before it`);
    return f.wear === 'against' || near ? { ...f, wear: 'against', hex: rgbToHex(oklch(AGAINST_CLOTH.L, Math.min(AGAINST_CLOTH.C, Math.max(0.06, hL[1])), wrapHue(hL[2] + 180))) } : f;
  });
}

// the colours a figure may move to: its own family's hues (or every hue, free), across a figure's values and chromas;
// each as the hex a page draws, so every distance is measured on what is seen
function candidates(hex, keep, capC) {
  const [, , h0] = lchOf(hexToRgb(hex)), out = new Map();
  const hues = keep === 'hue' ? [-HUE_KEEP, -15, -10, -5, 0, 5, 10, 15, HUE_KEEP].map((d) => wrapHue(h0 + d)) : Array.from({ length: 24 }, (_, i) => i * 15);
  for (const h of hues) for (let L = L_RANGE[0]; L <= L_RANGE[1] + 1e-9; L += 0.025) for (let C = C_RANGE[0]; C <= Math.min(C_RANGE[1], capC) + 1e-9; C += 0.0125) {
    const c = rgbToHex(oklch(L, C, h));
    // (a colour the screen cannot show comes back another hue: it is not this family's)
    if (!out.has(c) && (keep !== 'hue' || hueGap(lchOf(hexToRgb(c))[2], h0) <= HUE_KEEP + 2)) out.set(c, views(hexToRgb(c)));
  }
  return out;
}

export function solveFigures({ palette, against, figures } = {}, { move = true } = {}) {
  const ground = readAgainst(against ?? (palette ? seenOn(palette) : null)), G = ground.map((g) => views(hexToRgb(g.hex)));
  const F = readFigures(figures, palette, move), placed = [], out = [];
  // (no figure louder than the protagonist: the eye goes to it first)
  // (a grey protagonist leads by value, not by chroma: it caps none)
  const lead = F.find((f) => f.protagonist), leadC = lead ? lchOf(hexToRgb(lead.hex))[1] : 0, capC = leadC >= GREY ? Math.max(C_RANGE[0] + 0.05, leadC) : C_RANGE[1];
  const score = (V) => { let s = Infinity; for (let g = 0; g < ground.length; g++) s = Math.min(s, margin(V, G[g], ground[g].min)); for (const p of placed) s = Math.min(s, margin(V, p, FIGURE_PAIR)); return s; };
  for (const f of F) {
    const own = views(hexToRgb(f.hex));
    let hex = f.hex, V = own;
    if (move && f.keep !== 'colour' && score(own) < 1) {
      // of those that clear, the nearest to what it was; where none clears, the clearest
      let near = null, best = null;
      for (const [c, CV] of candidates(f.hex, f.keep, f.protagonist ? C_RANGE[1] : capC)) {
        const s = score(CV), d = deltaE(CV[0], own[0]) + TURN_COST * hueGap(lchOf(CV[0])[2], lchOf(own[0])[2]) * (f.keep === 'hue' ? 1 : 0);
        if (s >= 1 && (!near || d < near.d)) near = { c, CV, d };
        if (!best || s > best.s) best = { c, CV, s };
      }
      const take = near ?? best;
      if (take) { hex = take.c; V = take.CV; }
    }
    placed.push(V);
    const [L0, C0, h0] = lchOf(hexToRgb(f.hex)), [L1, C1, h1] = lchOf(hexToRgb(hex)), was = f.from ?? (hex !== f.hex ? f.hex : null);
    out.push({ id: f.id, hex, ...(was && was !== hex ? { was } : {}), ...figureClear(hex, ground), moved: r3(deltaE(V[0], own[0])), turned: Math.min(C0, C1) < GREY ? 0 : Math.round(hueGap(h0, h1)),
      value: r3(L1 - L0), chroma: r3(C1 - C0), keep: f.keep, ...(f.wear ? { wear: f.wear } : {}), ...(f.protagonist ? { protagonist: true } : {}) });
  }
  return { figures: out, against: ground, laws: figureLaws(out, ground) };
}

export const measureFigures = (order) => solveFigures(order, { move: false });

/** What a cast on a ground is held to; each { law, want, ok, value }. Advice, never a refusal. */
export const FIGURE_LAWS = Object.freeze([
  { law: 'figures-clear', want: `every figure sits ${FIGURE_MIN} (OKLab) or more from the ground and the foliage it is seen on` },
  { law: 'figures-apart', want: `no two figures within ${FIGURE_PAIR} of each other` },
  { law: 'colour-vision', want: 'each figure still parts from its ground for protan, deutan and tritan eyes' },
  { law: 'families-kept', want: `a figure that keeps its hue turns ${HUE_KEEP} degrees at most: it is still its kind` },
  { law: 'protagonist-leads', want: 'no figure is more chromatic than the protagonist' },
]);
function figureLaws(figures, ground) {
  const on = ground.filter((g) => STOOD_ON.includes(g.what) || SEEN[g.what] === undefined), V = figures.map((f) => views(hexToRgb(f.hex)));
  const sunk = figures.filter((f) => f.clear < FIGURE_MIN).map((f) => `${f.id} ${f.clear} from the ${f.nearest}`);
  let close = null;
  for (let i = 0; i < figures.length; i++) for (let j = i + 1; j < figures.length; j++) { const d = deltaE(V[i][0], V[j][0]); if (!close || d < close.d) close = { d, says: `${figures[i].id} and ${figures[j].id} ${r3(d)}` }; }
  const blind = figures.filter((f, i) => on.some((g) => { const GV = views(hexToRgb(g.hex)); return V[i].slice(1).some((v, k) => deltaE(v, GV[k + 1]) < FIGURE_MIN * CVD_SHARE); })).map((f) => f.id);
  const turned = figures.filter((f) => f.keep === 'hue' && f.turned > HUE_KEEP).map((f) => `${f.id} ${f.turned}°`);
  const lead = figures.find((f) => f.protagonist), cOf = (f) => lchOf(hexToRgb(f.hex))[1];
  const louder = lead && cOf(lead) >= GREY ? figures.filter((f) => f !== lead && cOf(f) > cOf(lead) + 0.01).map((f) => f.id) : [];
  const answers = {
    'figures-clear': { ok: !sunk.length, value: sunk.join('; ') || `the nearest ${Math.min(...figures.map((f) => f.clear))}` },
    'figures-apart': { ok: !close || close.d >= FIGURE_PAIR, value: close ? close.says : 'one figure' },
    'colour-vision': { ok: !blind.length, value: blind.join(', ') || 'all part' },
    'families-kept': { ok: !turned.length, value: turned.join(', ') || 'all kept' },
    'protagonist-leads': { ok: !louder.length, value: !lead ? 'no protagonist named' : louder.join(', ') || lead.id },
  };
  return FIGURE_LAWS.map((l) => ({ ...l, ...answers[l.law] }));
}
