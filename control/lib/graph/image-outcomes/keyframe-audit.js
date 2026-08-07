/**
 * Keyframe meru audit — the deterministic scale/position gate for a painted
 * keyframe cel, extracted pure from keyframe-spike/composite-keys.mjs so the
 * MCP accept gate (accept_image_render) can run it on a submitted cel without
 * shelling the CLI harness. No fs, no sharp — operates on a raw RGBA buffer and
 * returns numbers (+ an optionally healed buffer); the caller owns persistence.
 *
 * The meru principle (animation-cheats.plan.md Addendum 4): every cel of a
 * motion keeps the SAME crown-to-ground unit, so the body never grows or
 * shrinks between frames. A pure SCALE violation is deterministically healable
 * (a whole-cel similarity onto the unit — NEVER a cut), which is why body
 * animation can promise scale-rock-steady composites over externally-authored
 * paint.
 */

import sharp from 'sharp';

import { segmentTransform, transformPart } from './parts-bank-spike/assemble.js';
import { floodKey } from './parts-bank-spike/key.js';
import { computeCanonical } from './keyframe-emit.js';

const SKY = '#add0eb';

const ALPHA_ON = 28; // alpha above this reads as painted (matches the spike)
const HEIGHT_TOL = 0.06; // painted head-to-sole height must be within 6% of the unit
const GROUND_TOL = 0.02; // lowest painted pixel may sit at most 2% of the span below ground
// Head-crown finder tuning: a raised limb (a fist pump) can be the topmost
// painted pixel, so the meru height is measured HEAD-to-sole, not top-to-sole.
const HEAD_MIN = 70; // painted pixels in a row that reads as head, not a thin limb
const HEAD_RUN = 24; // rows the head band must sustain

/** Alpha bbox + horizontal centre of the painted figure. */
function measure(buf, w, h) {
  let top = h, bottom = -1, x0 = w, x1 = -1;
  for (let i = 0; i < w * h; i += 1) {
    if (buf[i * 4 + 3] > ALPHA_ON) {
      const y = (i / w) | 0;
      const x = i % w;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
  }
  return { top, bottom, cx: (x0 + x1) / 2 };
}

/**
 * The head crown: scan down for the first SUSTAINED band of head-sized rows.
 * A thin raised arm/fist column never sustains HEAD_MIN painted pixels for
 * HEAD_RUN rows, so it is not mistaken for the head. Falls back to the absolute
 * top when no head band is found (an arms-down cel).
 */
function findHeadTop(buf, w, h, top, bottom) {
  const rowCount = new Array(h).fill(0);
  for (let i = 0; i < w * h; i += 1) if (buf[i * 4 + 3] > ALPHA_ON) rowCount[(i / w) | 0] += 1;
  for (let y = top; y <= bottom - HEAD_RUN; y += 1) {
    let ok = true;
    for (let d = 0; d < HEAD_RUN; d += 1) if (rowCount[y + d] < HEAD_MIN) { ok = false; break; }
    if (ok) return y;
  }
  return top;
}

/**
 * Audit a keyed RGBA cel against the canonical meru unit.
 *
 * @param {Buffer|Uint8ClampedArray} rgba raw RGBA (keyed — background already transparent)
 * @param {{ canvas: {width:number,height:number}, canonical: {crown:number,ground:number,span:number} }} ctx
 * @returns {{
 *   compliant: boolean, heightRatio: number, groundDeltaPx: number,
 *   crownDeltaPx: number, headTop: number, normalized: boolean,
 *   healed: (Buffer|Uint8ClampedArray|null), retry: (string|null)
 * }}
 *   `healed` is the whole-cel-normalized buffer when a pure scale violation was
 *   corrected (else null — the input was already within the unit or the caller
 *   should reject). `retry` is a worker-facing redo note when still non-compliant.
 */
export function auditCel(rgba, { canvas, canonical }) {
  const { width: w, height: h } = canvas;
  let buf = rgba;
  let m = measure(buf, w, h);
  let headTop = findHeadTop(buf, w, h, m.top, m.bottom);
  let heightRatio = round3((m.bottom - headTop) / canonical.span);
  let normalized = false;
  let healed = null;

  // Pure SCALE violations heal deterministically: map the painted head-to-sole
  // span onto the unit (soles → ground, head-crown → ground − span). A raised
  // fist is then allowed above the crown line; only the head is pinned.
  const outOfUnit = Math.abs(heightRatio - 1) >= HEIGHT_TOL
    || m.bottom - canonical.ground >= canonical.span * GROUND_TOL;
  if (outOfUnit) {
    const T = segmentTransform(
      [m.cx, m.bottom], [m.cx, headTop],
      [m.cx, canonical.ground], [m.cx, canonical.ground - canonical.span],
    );
    buf = transformPart(buf, canvas, T);
    m = measure(buf, w, h);
    headTop = findHeadTop(buf, w, h, m.top, m.bottom);
    heightRatio = round3((m.bottom - headTop) / canonical.span);
    normalized = true;
    healed = buf;
  }

  const groundDeltaPx = m.bottom - canonical.ground;
  const compliant = Math.abs(heightRatio - 1) < HEIGHT_TOL && groundDeltaPx < canonical.span * GROUND_TOL;
  const retry = compliant ? null : [
    `painted height ${heightRatio}x the unit (must be within ${HEIGHT_TOL * 100}%),`,
    `lowest pixel y=${m.bottom} vs ground y=${canonical.ground}. Redo this cel as an edit of`,
    `its guide.png: crown at/below y=${canonical.crown}, soles ON y=${canonical.ground}.`,
  ].join(' ');

  return {
    compliant, heightRatio, groundDeltaPx,
    crownDeltaPx: canonical.crown - headTop, headTop,
    normalized, healed, retry,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

// Held-region gate tuning. A face-variant cel is a fresh whole-cel render, so
// honest line/shade wobble outside the face is expected — the gate only fires
// on wholesale drift (repose, re-outfit, background boil painted into the
// figure), the failure GPT's talking-phone run measured at up to ~50%.
const HOLD_TOL = 0.35; // fraction of held-region figure pixels allowed to change
const HOLD_COLOR_DELTA = 60; // summed |ΔR|+|ΔG|+|ΔB| that reads as a changed pixel
const HEAD_MARGIN_PX = 8; // rows above the head crown still counted as face
const HEAD_SPAN_FRAC = 0.24; // face region depth below the crown, as a unit fraction

/**
 * The HELD-REGION audit for a face-variant cel (the deterministic half of the
 * "only the face changes" contract): compare the variant against its key's
 * accepted BASE cel with the head band excluded — everything below the face
 * must hold. Both buffers must be keyed RGBA on the same canvas.
 *
 * Returns { compliant, holdFrac, headTop, headBottom, comparedPx, retry }.
 * `holdFrac` = changed / compared, over pixels painted in either cel outside
 * the head band. Deterministic numbers either way; `retry` only above HOLD_TOL.
 */
export function auditFaceHold(variantRgba, baseRgba, { canvas, canonical }) {
  const { width: w, height: h } = canvas;
  const m = measure(baseRgba, w, h);
  const headTop = findHeadTop(baseRgba, w, h, m.top, m.bottom);
  const headBottom = Math.min(h - 1, Math.round(headTop + canonical.span * HEAD_SPAN_FRAC));
  const faceFrom = Math.max(0, headTop - HEAD_MARGIN_PX);
  let compared = 0;
  let changed = 0;
  for (let y = 0; y < h; y += 1) {
    if (y >= faceFrom && y <= headBottom) continue; // the face band may change
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const aOn = baseRgba[i + 3] > ALPHA_ON;
      const bOn = variantRgba[i + 3] > ALPHA_ON;
      if (!aOn && !bOn) continue;
      compared += 1;
      if (aOn !== bOn) { changed += 1; continue; }
      const d = Math.abs(baseRgba[i] - variantRgba[i])
        + Math.abs(baseRgba[i + 1] - variantRgba[i + 1])
        + Math.abs(baseRgba[i + 2] - variantRgba[i + 2]);
      if (d > HOLD_COLOR_DELTA) changed += 1;
    }
  }
  const holdFrac = compared ? round3(changed / compared) : 0;
  const compliant = holdFrac < HOLD_TOL;
  const retry = compliant ? null : [
    `${Math.round(holdFrac * 100)}% of the figure OUTSIDE the face changed vs the base cel`,
    `(limit ${Math.round(HOLD_TOL * 100)}%). A face variant re-renders the SAME pose — only the`,
    'expression may differ. Redo as an edit of the base cel: same pose, outfit, scale, position.',
  ].join(' ');
  return { compliant, holdFrac, headTop, headBottom, comparedPx: compared, retry };
}

/**
 * Run the held-region gate against a submitted face-variant PNG and its key's
 * base-cel PNG (the render-handoff submit seam). Both are resized to the canvas
 * and flood-keyed before comparison.
 */
export async function faceHoldAuditPng(variantPngBytes, basePngBytes, { canvas, canonical }) {
  const { width: w, height: h } = canvas;
  const canon = canonical || (await computeCanonical({ canvas }));
  const key = async (bytes) => {
    const rgba = await sharp(bytes).resize({ width: w, height: h, fit: 'fill' }).ensureAlpha().raw().toBuffer();
    floodKey(rgba, canvas);
    return rgba;
  };
  const [variantRgba, baseRgba] = await Promise.all([key(variantPngBytes), key(basePngBytes)]);
  const r = auditFaceHold(variantRgba, baseRgba, { canvas, canonical: canon });
  return {
    hold: { holdFrac: r.holdFrac, compliant: r.compliant, comparedPx: r.comparedPx },
    retry: r.retry,
  };
}

/**
 * Run the meru gate against a submitted cel PNG (the render-handoff submit
 * seam). Resizes to the canvas, floods the pale background to transparent, and
 * audits against the canonical unit. A pure scale violation heals to a
 * whole-cel-normalized PNG (flattened back over the sky) the caller re-stores.
 *
 * @param {Buffer} pngBytes the submitted cel
 * @param {{ canvas:{width:number,height:number}, canonical?:object }} ctx
 * @returns {Promise<{ meru:object, healedPng:(Buffer|null), retry:(string|null) }>}
 *   `meru` = { heightRatio, groundDeltaPx, crownDeltaPx, compliant, normalized }.
 */
export async function meruAuditCelPng(pngBytes, { canvas, canonical }) {
  const { width: w, height: h } = canvas;
  const canon = canonical || (await computeCanonical({ canvas }));
  const rgba = await sharp(pngBytes)
    .resize({ width: w, height: h, fit: 'fill' }).ensureAlpha().raw().toBuffer();
  floodKey(rgba, canvas); // mutates rgba: background → transparent
  const r = auditCel(rgba, { canvas, canonical: canon });
  let healedPng = null;
  if (r.healed) {
    healedPng = await sharp(Buffer.from(r.healed), { raw: { width: w, height: h, channels: 4 } })
      .flatten({ background: SKY }).png().toBuffer();
  }
  return {
    meru: {
      heightRatio: r.heightRatio,
      groundDeltaPx: r.groundDeltaPx,
      crownDeltaPx: r.crownDeltaPx,
      compliant: r.compliant,
      normalized: r.normalized,
    },
    healedPng,
    retry: r.retry,
  };
}
