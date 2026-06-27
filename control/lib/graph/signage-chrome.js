/**
 * adaptive-signage — the one cross-backend source of truth for sign CHROME and
 * sign RESOLUTION.
 *
 * A `signage` channel (manifest.signage[], validated in sketch-manifest.js) is
 * read by all three renderers — the SVG diagram (CreationMap), the CSS-3D scene
 * (scene-css3d), and the three.js world (scene-three). Each renderer supplies a
 * small `paletteCtx` describing its scene's visual language; this module derives
 * the sign's CSS chrome from it so a sign matches what it annotates — a night
 * city sign blooms like the city, a flat technical scene gets clean neutral
 * chrome, a painted landscape gets soft parchment. The author writes only
 * `{ variant, text, anchor }` (+ optional timing); the look is derived.
 *
 * deriveSignageChrome returns CSS *strings* (one shape) consumed identically by
 * every emitter. resolveSignage normalizes a raw signage[] into render-ready
 * signs (chrome attached, anchors resolved) so the per-renderer code only emits.
 */

import { hexToRgb, rgbToHex, scaleHex } from './polygonizer/vexar.js';

// ── colour helpers ───────────────────────────────────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function relLuminance(hex) {
  try {
    const [r, g, b] = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  } catch {
    return 0.5;
  }
}

/** `hex` → an `rgba(r,g,b,a)` string. */
function rgba(hex, a) {
  try {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${clamp01(a)})`;
  } catch {
    return `rgba(20,26,38,${clamp01(a)})`;
  }
}

/** Linear blend from hex `a` toward hex `b` by `t` (0..1). */
function blend(a, b, t) {
  try {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  } catch {
    return a;
  }
}

/** Multiply a hex by a vexar tint triple ([r,g,b] ≈ 1.0) — the scene's colour temperature. */
function applyTint(hex, tint) {
  if (!Array.isArray(tint) || tint.length !== 3) return hex;
  try {
    const c = hexToRgb(hex);
    return rgbToHex([c[0] * tint[0], c[1] * tint[1], c[2] * tint[2]]);
  } catch {
    return hex;
  }
}

const tintNeutral = (t) =>
  !Array.isArray(t) || t.length !== 3 || t.every((v) => Math.abs(v - 1) < 0.06);

// ── mood inference ────────────────────────────────────────────────────────────
// A scene's "visual language" collapses to one of four moods, derived from the
// data a renderer already has (background, sky, vexar tint/ambient, lamps).
export function inferMood(ctx = {}) {
  if (ctx.mood && ['night', 'day', 'flat', 'painted'].includes(ctx.mood)) return ctx.mood;
  const sky = ctx.sky;
  const skyPreset = typeof sky === 'string' ? sky : sky && typeof sky === 'object' ? sky.preset : undefined;
  const skyPainted = sky && typeof sky === 'object' && (sky.horizon || sky.zenith);
  const lamps = Array.isArray(ctx.lamps) ? ctx.lamps : [];
  const ambient = Number.isFinite(ctx.ambient) ? ctx.ambient : undefined;
  const lum = ctx.bg ? relLuminance(ctx.bg) : undefined;

  const night =
    skyPreset === 'night' ||
    lamps.length > 0 ||
    (ambient !== undefined && ambient < 0.32) ||
    (lum !== undefined && lum < 0.18);
  if (skyPainted) return 'painted';
  if (night) return 'night';
  // The LIGHTING_PRESETS.flat signature: high even ambient, neutral tint, no sky.
  if (!sky && tintNeutral(ctx.tint) && ambient !== undefined && ambient >= 0.8) return 'flat';
  return 'day';
}

// ── chrome derivation ─────────────────────────────────────────────────────────
const VARIANT_FONT = { tooltip: 12, popup: 13, toast: 16 };

/**
 * Derive a sign's CSS chrome from a scene-palette context.
 * @param {object} ctx     { bg, sky, tint, ambient, lamps, accent, mood }
 * @param {string} variant 'tooltip' | 'popup' | 'toast'
 * @param {object} override author overrides ({ bg, color, border, glow, radius, font })
 * @returns {{ bg, color, border, glow, shadow, radius, font, fontSize, fontWeight, padding }}
 */
export function deriveSignageChrome(ctx = {}, variant = 'tooltip', override = {}) {
  const mood = inferMood(ctx);
  const tint = ctx.tint;
  const font = "system-ui, -apple-system, Segoe UI, sans-serif";
  let chrome;

  if (mood === 'night') {
    const accent = ctx.accent || (Array.isArray(ctx.lamps) && ctx.lamps[0] && ctx.lamps[0].color) || '#ffd9a0';
    const panel = applyTint(scaleHex(ctx.bg || '#10141c', 0.55), tint);
    chrome = {
      bg: rgba(panel, 0.82),
      color: '#eaf2ff',
      border: `1px solid ${rgba(accent, 0.5)}`,
      glow: `0 0 14px ${rgba(accent, 0.55)}, 0 6px 22px rgba(0,0,0,0.5)`,
      shadow: 'none',
      radius: '8px',
      font,
    };
  } else if (mood === 'painted') {
    const horizon = (ctx.sky && typeof ctx.sky === 'object' && ctx.sky.horizon) || '#d9c3a0';
    const paper = applyTint(blend(horizon, '#f3ead7', 0.6), tint);
    chrome = {
      bg: rgba(paper, 0.92),
      color: '#3b3026',
      border: `1px solid ${rgba('#8a6f4f', 0.5)}`,
      glow: 'none',
      shadow: '0 3px 10px rgba(60,40,20,0.25)',
      radius: '10px',
      font,
    };
  } else if (mood === 'flat') {
    chrome = {
      bg: 'rgba(255,255,255,0.94)',
      color: '#1b2330',
      border: '1px solid rgba(0,0,0,0.18)',
      glow: 'none',
      shadow: '0 2px 8px rgba(0,0,0,0.18)',
      radius: '6px',
      font,
    };
  } else {
    // day — clean neutral light panel, the safe default for diagrams.
    chrome = {
      bg: 'rgba(255,255,255,0.92)',
      color: '#222a36',
      border: '1px solid rgba(0,0,0,0.14)',
      glow: 'none',
      shadow: '0 2px 10px rgba(0,0,0,0.16)',
      radius: '7px',
      font,
    };
  }

  // Variant nudges layered on the mood base.
  chrome.fontSize = override.fontSize || VARIANT_FONT[variant] || 13;
  chrome.fontWeight = 500;
  chrome.padding = '6px 9px';
  if (variant === 'toast') {
    chrome.fontWeight = 700;
    chrome.border = 'none';
    chrome.padding = '7px 13px';
    if (chrome.glow === 'none') chrome.glow = '0 4px 16px rgba(0,0,0,0.28)';
  } else if (variant === 'tooltip') {
    chrome.padding = '4px 7px';
  } else if (variant === 'popup') {
    chrome.padding = '9px 11px';
  }

  // Author overrides win last (only the chrome-shaped fields).
  for (const k of ['bg', 'color', 'border', 'glow', 'radius', 'font']) {
    if (override && override[k] !== undefined) chrome[k] = override[k];
  }
  chrome.mood = mood;
  return chrome;
}

// ── signage resolution ────────────────────────────────────────────────────────
const DEFAULT_TTL = 2.5;

function normalizeBody(sign) {
  if (Array.isArray(sign.body)) return sign.body.slice();
  if (typeof sign.body === 'string') return [sign.body];
  if (typeof sign.text === 'string') return [sign.text];
  return [];
}

/**
 * Normalize a raw signage[] into render-ready signs: chrome derived from the
 * scene palette, anchor normalized, body paged, toast timing defaulted.
 *
 * @param {Array} signage  manifest.signage (already schema-validated)
 * @param {object} opts
 *   - palette: the scene-palette ctx passed to deriveSignageChrome
 *   - resolveObject(name) -> [x,y,z]|null : map an { object } anchor to a world
 *     point at emit time (CSS-3D). Optional — when absent (or it returns null)
 *     the { object } anchor passes through unresolved for backends that resolve
 *     it at render time (three.js, via mesh userData) or look it up themselves
 *     (SVG, via station id).
 * @returns {Array} resolved signs
 */
export function resolveSignage(signage, { palette = {}, resolveObject } = {}) {
  if (!Array.isArray(signage) || !signage.length) return [];
  return signage.map((sign, i) => {
    const variant = ['tooltip', 'popup', 'toast'].includes(sign.variant) ? sign.variant : 'tooltip';
    const a = sign.anchor && typeof sign.anchor === 'object' ? sign.anchor : {};
    let anchor;
    if (a.object !== undefined) {
      const pt = typeof resolveObject === 'function' ? resolveObject(a.object) : null;
      anchor = pt ? { kind: 'world', world: pt, object: a.object } : { kind: 'object', object: a.object };
    } else if (Array.isArray(a.world)) {
      anchor = { kind: 'world', world: a.world };
    } else if (a.slot !== undefined) {
      anchor = { kind: 'slot', slot: a.slot };
    } else if (Array.isArray(a.xy)) {
      anchor = { kind: 'xy', xy: a.xy };
    } else {
      anchor = { kind: 'slot', slot: 'top' };
    }
    return {
      id: typeof sign.id === 'string' && sign.id ? sign.id : `sign${i}`,
      variant,
      text: typeof sign.text === 'string' ? sign.text : '',
      body: normalizeBody(sign),
      anchor,
      after: Number.isFinite(sign.after) ? sign.after : 0,
      ttl: Number.isFinite(sign.ttl) ? sign.ttl : DEFAULT_TTL,
      pageLines: Number.isFinite(sign.pageLines) ? Math.floor(sign.pageLines) : null,
      chrome: deriveSignageChrome(palette, variant, sign.palette || {}),
    };
  });
}
