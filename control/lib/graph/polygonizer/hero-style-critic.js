/** hero-style-critic.js — the hero's PROPORTIONS read against a style's canon: what the design loop's critic reads to
 * judge whether a figure is drawn in its style, the way hero-core-measures.js judges its midsection.
 *
 * `styleMeasures(plan, mesh)` measures the compiled figure at rest, in head heights (the canon's unit):
 *   headsTall      the figure's height over its head's (crown to chin, the skin of the cranium, jaw or face; hair is not
 *                  the head)
 *   crotch         the inseam over the height: the lowest midline point of the trunk. The academic canon's halfway mark
 *                  is the pubic bone, a few hundredths above the inseam, so the bands are in inseam terms
 *   shoulders      the width across the shoulders (deltoid to deltoid) in head heights
 *   hipsOverShoulders  the width across the hips (at the hip joints) over the shoulders'
 *   wrist          the wrist's height over the crotch's (the hanging wrist reaches the crotch in the canon)
 *   hand           the hand's length (wrist to the farthest fingertip) in head heights
 *   foot           the foot's length (heel to toe) in head heights
 * `styleCritic(m, style, body)` reads them against STYLE_BANDS for 'western' or 'anime' and the 'female' or 'male' body:
 * each measure in band or out (low / high), one advice line per measure out of band naming what moves it. Advice, never
 * a refusal (docs/bicycles.md). Pure: a function of the plan and the mesh.
 *
 * The bands are starting points read off the drawing canons (the academic figure: Loomis, Bridgman; anime and manga
 * figure guides), to be tuned at the eyes gate; none is a measurement of a shipped character. */

const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const HEAD_SKIN = /^(cranium|jaw|face|headSkin)$/;
const HAND = /^(hand|thumb|index|middle|ring|little)R$/;
const FOOT = /^(foot|toes)R$/;

/** The style canons. Each band is [low, high]; the unit is in each measure's line above. */
export const STYLE_BANDS = Object.freeze({
  western: Object.freeze({
    female: Object.freeze({ headsTall: [7, 8], crotch: [0.44, 0.49], shoulders: [1.55, 1.95], hipsOverShoulders: [0.88, 1.08], wrist: [0.9, 1.08], hand: [0.68, 0.85], foot: [0.9, 1.15] }),
    male: Object.freeze({ headsTall: [7.25, 8.25], crotch: [0.44, 0.49], shoulders: [1.85, 2.35], hipsOverShoulders: [0.72, 0.9], wrist: [0.9, 1.08], hand: [0.7, 0.88], foot: [0.95, 1.2] }),
  }),
  anime: Object.freeze({
    female: Object.freeze({ headsTall: [6, 7.5], crotch: [0.48, 0.55], shoulders: [1.25, 1.65], hipsOverShoulders: [0.95, 1.18], wrist: [0.92, 1.12], hand: [0.55, 0.78], foot: [0.75, 1.0] }),
    male: Object.freeze({ headsTall: [6.25, 7.75], crotch: [0.48, 0.54], shoulders: [1.55, 2.05], hipsOverShoulders: [0.75, 0.92], wrist: [0.92, 1.12], hand: [0.6, 0.82], foot: [0.8, 1.05] }),
  }),
});
export const STYLES = Object.freeze(Object.keys(STYLE_BANDS));

const WORDS = Object.freeze({
  headsTall: ['heads tall', '/hero/tune/head (smaller is taller in heads) or /hero/tune/legs'],
  crotch: ['the crotch over the height', '/hero/tune/legs or /hero/tune/torso'],
  shoulders: ['the shoulders, in head heights', '/hero/tune/shoulders'],
  hipsOverShoulders: ['the hips over the shoulders', '/hero/tune/hips or /hero/tune/shoulders'],
  wrist: ['the hanging wrist over the crotch', 'the arms\' length (/hero/tune/arms)'],
  hand: ['the hand, in head heights', 'the hand\'s size (the cast\'s hand)'],
  foot: ['the foot, in head heights', 'the foot\'s size (the cast\'s foot)'],
});

/** The figure's proportions in head heights, or null without a mesh or a head. */
export function styleMeasures(plan, mesh) {
  if (!mesh?.vertices?.length) return null;
  const V = mesh.vertices, partOf = (vi) => mesh.provenance[vi].part;
  let zMin = Infinity, zMax = -Infinity, cMin = Infinity, cMax = -Infinity, crotch = Infinity;
  const handPts = [], footPts = [];
  for (let i = 0; i < V.length; i++) {
    const v = V[i], p = partOf(i);
    if (v[2] < zMin) zMin = v[2];
    if (v[2] > zMax) zMax = v[2];
    if (HEAD_SKIN.test(p)) { if (v[2] < cMin) cMin = v[2]; if (v[2] > cMax) cMax = v[2]; }
    if ((p === 'pelvis' || p === 'torso') && Math.abs(v[0]) < 0.015 && v[2] < crotch) crotch = v[2];
    if (HAND.test(p)) handPts.push(v);
    if (FOOT.test(p)) footPts.push(v);
  }
  if (!(cMax > cMin)) return null;
  const H = zMax - zMin, h = cMax - cMin, J = plan?.joints || {};
  // widths: the widest of the body's own parts in a band round a joint's height (the dress and the hair are not the body)
  const BODY = /^(torso|pelvis|neck|upperArm[RL]|thigh[RL]|pectoral[RL])$/;
  const widthAt = (z, band, re = BODY) => { let w = 0; for (let i = 0; i < V.length; i++) if (Math.abs(V[i][2] - z) <= band && re.test(partOf(i))) w = Math.max(w, Math.abs(V[i][0])); return 2 * w; };
  const shoulders = J.shoulder ? widthAt(J.shoulder[2], 0.03, /^(torso|upperArm[RL])$/) : null;
  const hips = J.hip ? widthAt(J.hip[2] - 0.03, 0.05, /^(pelvis|torso|thigh[RL])$/) : null;
  const wrist = J.wrist ? J.wrist[2] : null;
  const handLen = J.wrist && handPts.length ? Math.max(...handPts.map((p) => Math.hypot(p[0] - J.wrist[0], p[1] - J.wrist[1], p[2] - J.wrist[2]))) : null;
  const footLen = footPts.length ? Math.max(...footPts.map((p) => p[1])) - Math.min(...footPts.map((p) => p[1])) : null;
  const ground = zMin, cz = Number.isFinite(crotch) ? crotch - ground : null;
  return {
    height_m: r3(H), head_m: r3(h),
    headsTall: r3(H / h),
    crotch: cz != null ? r3(cz / H) : null,
    shoulders: shoulders ? r3(shoulders / h) : null,
    hipsOverShoulders: shoulders && hips ? r3(hips / shoulders) : null,
    wrist: wrist != null && cz ? r3((wrist - ground) / cz) : null,
    hand: handLen ? r3(handLen / h) : null,
    foot: footLen ? r3(footLen / h) : null,
  };
}

/** The measures read against a style's bands: { style, body, fit: 'n/m', verdicts, advice }. */
export function styleCritic(m, style, body = 'female') {
  if (!m) return null;
  const bands = STYLE_BANDS[style]?.[body];
  if (!bands) throw new Error(`style critic: style is ${STYLES.join(' or ')} and body female or male`);
  const verdicts = {}, advice = [];
  for (const [k, [lo, hi]] of Object.entries(bands)) {
    const v = m[k]; if (v == null) continue;
    const at = v < lo ? 'low' : v > hi ? 'high' : 'in';
    verdicts[k] = { value: v, band: [lo, hi], at };
    if (at !== 'in') advice.push(`${style}: ${WORDS[k][0]} ${v} is ${at === 'low' ? 'under' : 'over'} ${lo}–${hi} (${body}); it moves with ${WORDS[k][1]}`);
  }
  const n = Object.keys(verdicts).length, inBand = Object.values(verdicts).filter((x) => x.at === 'in').length;
  return { style, body, fit: `${inBand}/${n}`, verdicts, ...(advice.length ? { advice } : {}) };
}

// ─── the chest ─────────────────────────────────────────────────────────────
/** The unsupported adult female chest, by the anatomical references (not a garment's shape): the apexes about as far
 * apart as each is from the sternal notch (the equilateral rule: `spacing` = apart ÷ notch-to-apex), the apex at about
 * 0.71 of the height, and a gap at the sternum (`gap`: how far the midline sits behind the apexes, in head heights; a
 * filled midline is cleavage, a garment's). Starting points, tuned at the eyes gate. */
export const CHEST_BANDS = Object.freeze({ spacing: [0.9, 1.15], apex: [0.69, 0.73], gap: [0.08, 0.25] });
const CHEST_PARTS = /^(torso|bust[RL]|pectoral[RL])$/;
const CHEST_WORDS = Object.freeze({ spacing: 'the apexes apart over the notch to an apex', apex: 'the apex height over the figure\'s', gap: 'the midline behind the apexes, in head heights' });

/** The chest's measures off the compiled figure at rest, or null without the joints or a head unit. */
export function chestMeasures(plan, mesh, headM) {
  const J = plan?.joints, V = mesh?.vertices; if (!J?.shoulder || !J.neckHub || !V?.length || !(headM > 0)) return null;
  const partOf = (i) => mesh.provenance[i].part; let zMin = Infinity, zMax = -Infinity; for (const v of V) { zMin = Math.min(zMin, v[2]); zMax = Math.max(zMax, v[2]); }
  const inBand = (v) => v[0] > 0.02 && v[2] > J.shoulder[2] - 0.3 && v[2] < J.shoulder[2] - 0.02;
  let yMax = -Infinity; for (let i = 0; i < V.length; i++) if (CHEST_PARTS.test(partOf(i)) && inBand(V[i])) yMax = Math.max(yMax, V[i][1]);
  if (!Number.isFinite(yMax)) return null;
  // the apex: the centre of the frontmost region (within 6 mm of the front), so a form spanning two slots reads at its middle
  const top = []; for (let i = 0; i < V.length; i++) if (CHEST_PARTS.test(partOf(i)) && inBand(V[i]) && V[i][1] > yMax - 0.006) top.push(V[i]);
  const apex = [0, 2].map((k) => top.reduce((t, v) => t + v[k], 0) / top.length);
  let notch = null; for (let i = 0; i < V.length; i++) { const v = V[i]; if (partOf(i) !== 'torso' || Math.abs(v[0]) > 0.01 || v[2] > J.neckHub[2] + 0.02) continue; if (!notch || v[2] > notch[2]) notch = v; }
  let mid = -Infinity; for (let i = 0; i < V.length; i++) { const v = V[i]; if (Math.abs(v[0]) < 0.015 && Math.abs(v[2] - apex[1]) < 0.03 && CHEST_PARTS.test(partOf(i))) mid = Math.max(mid, v[1]); }
  if (!notch || !Number.isFinite(mid)) return null;
  const apart = 2 * apex[0], toNotch = Math.hypot(apex[0] - notch[0], apex[1] - notch[2]);
  return { apart_m: r3(apart), notchToApex_m: r3(toNotch), spacing: r3(apart / toNotch), apex: r3((apex[1] - zMin) / (zMax - zMin)), gap: r3((yMax - mid) / headM) };
}

/** The chest's measures against CHEST_BANDS: { fit, verdicts, advice? }. */
export function chestCritic(m) {
  if (!m) return null;
  const verdicts = {}, advice = [];
  for (const [k, [lo, hi]] of Object.entries(CHEST_BANDS)) {
    const v = m[k], at = v < lo ? 'low' : v > hi ? 'high' : 'in'; verdicts[k] = { value: v, band: [lo, hi], at };
    if (at !== 'in') advice.push(`chest: ${CHEST_WORDS[k]} ${v} is ${at === 'low' ? 'under' : 'over'} ${lo}–${hi}${k === 'gap' && at === 'low' ? ' (a filled midline reads as a garment\'s cleavage)' : k === 'spacing' && at === 'low' ? ' (set close together)' : ''}`);
  }
  const n = Object.keys(verdicts).length, inBand = Object.values(verdicts).filter((x) => x.at === 'in').length;
  return { fit: `${inBand}/${n}`, verdicts, ...(advice.length ? { advice } : {}) };
}
