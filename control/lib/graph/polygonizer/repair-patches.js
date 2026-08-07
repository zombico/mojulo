/**
 * Deterministic repair patches for the polygonizer.
 *
 * Several validation-failure classes are rule-fixable without the LLM:
 *   - `partition.target` references a role that doesn't exist on a prior
 *     mark, but a near-match prior role does (typo / suffix slip).
 *   - `viewBox` is missing or has non-positive width/height, but the
 *     manifest's marks already imply a bounding envelope.
 *   - A standard shot glyph is attached but `topology.cameraVector`,
 *     `topology.lightEntry`, or `topology.support` is missing — the
 *     canonical glyph card in `mandala-patterns.js` already declares them.
 *
 * Each of these used to trigger a full LLM repair turn. `applyDeterministicRepairs`
 * pattern-matches on the validation errors, mutates a shallow copy of the
 * manifest, and returns the patched manifest + a list of patch names so the
 * caller can re-validate and skip the LLM trip when everything is now green.
 *
 * Each patch is intentionally narrow: it only fires when the matching error
 * is present AND the deterministic fix is unambiguous. When in doubt, the
 * patcher does nothing and lets the LLM repair path run as before.
 */

import { resolveShotGlyph } from './mandala-patterns.js';

const VIEWBOX_ERROR_PATTERNS = [
  /manifest\.viewBox is required/i,
  /manifest\.viewBox\.(width|height) must be a positive number/i,
  /grid expansion requires a numeric viewBox/i,
  /manifest\.viewBox must declare finite width and height/i,
];

const PARTITION_ERROR_PATTERN = /partition\s+'.*?'\s+target\s+'.*?'\s+must match an earlier mark role/i;

const SHOT_GLYPH_TOPOLOGY_PATTERN = /shotGlyph\s+'(.+?)'\s+must declare topology\.(cameraVector|lightEntry|support)/i;

/**
 * Apply rule-fixable repair patches to a manifest based on the validation
 * errors that just fired. Returns the (possibly-patched) manifest plus the
 * names of patches that were applied — empty when nothing matched.
 *
 * The caller is expected to re-run validation after applying patches; if the
 * new validation is `ok`, the LLM repair turn can be skipped entirely.
 *
 * Never mutates the input manifest.
 */
export function applyDeterministicRepairs(manifest, errors = []) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { manifest, applied: [] };
  }
  const errorList = Array.isArray(errors) ? errors.filter((err) => typeof err === 'string') : [];
  if (errorList.length === 0) return { manifest, applied: [] };

  let patched = manifest;
  const applied = [];

  if (errorList.some((err) => PARTITION_ERROR_PATTERN.test(err))) {
    const result = patchPartitionTargets(patched);
    if (result.changed) {
      patched = result.manifest;
      applied.push('partition-target-rename');
    }
  }

  if (errorList.some((err) => VIEWBOX_ERROR_PATTERNS.some((pat) => pat.test(err)))) {
    const result = patchViewBoxFromMarks(patched);
    if (result.changed) {
      patched = result.manifest;
      applied.push('viewbox-from-bounds');
    }
  }

  if (errorList.some((err) => SHOT_GLYPH_TOPOLOGY_PATTERN.test(err))) {
    const result = patchShotGlyphTopology(patched);
    if (result.changed) {
      patched = result.manifest;
      applied.push('shot-glyph-topology-fill');
    }
  }

  return { manifest: patched, applied };
}

// ── partition.target → closest prior role ─────────────────────────────────

function patchPartitionTargets(manifest) {
  const marks = Array.isArray(manifest.marks) ? manifest.marks : null;
  if (!marks) return { manifest, changed: false };

  const priorRoles = [];
  let changed = false;
  const nextMarks = marks.map((mark) => {
    if (!mark || typeof mark !== 'object') {
      return mark;
    }
    if (mark.kind === 'partition' && typeof mark.target === 'string') {
      if (!priorRoles.includes(mark.target)) {
        const candidate = closestRole(mark.target, priorRoles);
        if (candidate) {
          changed = true;
          return { ...mark, target: candidate };
        }
      }
    }
    if (typeof mark.role === 'string' && mark.role && mark.kind !== 'partition') {
      priorRoles.push(mark.role);
    }
    return mark;
  });

  if (!changed) return { manifest, changed: false };
  return { manifest: { ...manifest, marks: nextMarks }, changed: true };
}

function closestRole(target, candidates) {
  if (!candidates.length) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(target.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (best === null) return null;
  // Threshold: tolerate up to 30% character difference, but always allow
  // distance ≤ 2 (single typo / pluralization slip). Avoids "frame" → "roof".
  const maxLen = Math.max(target.length, best.length);
  const threshold = Math.max(2, Math.floor(maxLen * 0.3));
  return bestDistance <= threshold ? best : null;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = new Array(cols);
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[cols - 1];
}

// ── viewBox synthesis from mark bounds ────────────────────────────────────

const VIEWBOX_PADDING = 20;

function patchViewBoxFromMarks(manifest) {
  const existing = manifest.viewBox;
  const widthOk = existing && Number.isFinite(Number(existing.width)) && Number(existing.width) > 0;
  const heightOk = existing && Number.isFinite(Number(existing.height)) && Number(existing.height) > 0;
  if (widthOk && heightOk) return { manifest, changed: false };

  const marks = Array.isArray(manifest.marks) ? manifest.marks : [];
  if (!marks.length) return { manifest, changed: false };

  const bounds = collectMarkBounds(marks);
  if (!bounds) return { manifest, changed: false };

  const minX = Math.min(bounds.minX, 0);
  const minY = Math.min(bounds.minY, 0);
  const width = Math.max(1, Math.ceil(bounds.maxX - minX + VIEWBOX_PADDING * 2));
  const height = Math.max(1, Math.ceil(bounds.maxY - minY + VIEWBOX_PADDING * 2));

  return {
    manifest: { ...manifest, viewBox: { ...(existing || {}), width, height } },
    changed: true,
  };
}

function collectMarkBounds(marks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;

  for (const mark of marks) {
    const box = markBounds(mark);
    if (!box) continue;
    any = true;
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }

  return any ? { minX, minY, maxX, maxY } : null;
}

function markBounds(mark) {
  if (!mark || typeof mark !== 'object') return null;

  if (Array.isArray(mark.points)) {
    const pts = mark.points.filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])));
    if (!pts.length) return null;
    return pointsBounds(pts);
  }

  if (isNumber(mark.x1) && isNumber(mark.y1) && isNumber(mark.x2) && isNumber(mark.y2)) {
    return pointsBounds([[mark.x1, mark.y1], [mark.x2, mark.y2]]);
  }

  if (isNumber(mark.x) && isNumber(mark.y)) {
    const w = pickNumber(mark.width, mark.w);
    const h = pickNumber(mark.height, mark.h);
    if (w !== null && h !== null) {
      return { minX: Number(mark.x), minY: Number(mark.y), maxX: Number(mark.x) + w, maxY: Number(mark.y) + h };
    }
  }

  if (isNumber(mark.cx) && isNumber(mark.cy)) {
    const r = pickNumber(mark.r, mark.rx, mark.ry);
    if (r !== null) {
      return { minX: Number(mark.cx) - r, minY: Number(mark.cy) - r, maxX: Number(mark.cx) + r, maxY: Number(mark.cy) + r };
    }
  }

  if (Array.isArray(mark.from) && Array.isArray(mark.to) && mark.from.length === 2 && mark.to.length === 2) {
    return pointsBounds([mark.from, mark.to]);
  }

  return null;
}

function pointsBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue;
    if (nx < minX) minX = nx;
    if (ny < minY) minY = ny;
    if (nx > maxX) maxX = nx;
    if (ny > maxY) maxY = ny;
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function isNumber(value) {
  return Number.isFinite(Number(value));
}

function pickNumber(...candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && Number.isFinite(Number(candidate))) return Number(candidate);
  }
  return null;
}

// ── shot-glyph topology fill from canonical vocab ─────────────────────────

function patchShotGlyphTopology(manifest) {
  const polygonizer = manifest.polygonizer;
  if (!polygonizer || typeof polygonizer !== 'object' || Array.isArray(polygonizer)) {
    return { manifest, changed: false };
  }

  let changed = false;
  const nextPolygonizer = { ...polygonizer };

  if (Array.isArray(polygonizer.shotGlyphs) && polygonizer.shotGlyphs.length) {
    const patched = polygonizer.shotGlyphs.map((glyph) => {
      const result = fillGlyphTopology(glyph);
      if (result.changed) changed = true;
      return result.glyph;
    });
    nextPolygonizer.shotGlyphs = patched;
  }

  if (polygonizer.shotGlyph) {
    const result = fillGlyphTopology(polygonizer.shotGlyph);
    if (result.changed) {
      changed = true;
      nextPolygonizer.shotGlyph = result.glyph;
    }
  }

  if (!changed) return { manifest, changed: false };
  return { manifest: { ...manifest, polygonizer: nextPolygonizer }, changed: true };
}

function fillGlyphTopology(glyph) {
  if (!glyph || typeof glyph !== 'object' || Array.isArray(glyph)) {
    return { glyph, changed: false };
  }
  const topology = glyph.topology && typeof glyph.topology === 'object' && !Array.isArray(glyph.topology)
    ? { ...glyph.topology }
    : {};

  const ref = glyph.id || glyph.extends || glyph.seed || glyph.ref || glyph.label;
  if (!ref) return { glyph, changed: false };

  const canonical = resolveShotGlyph(ref);
  if (!canonical || !canonical.topology) return { glyph, changed: false };

  let changed = false;
  for (const field of ['cameraVector', 'lightEntry', 'support']) {
    if (topology[field] === undefined || topology[field] === null || topology[field] === '') {
      if (canonical.topology[field] !== undefined) {
        topology[field] = canonical.topology[field];
        changed = true;
      }
    }
  }

  if (!changed) return { glyph, changed: false };
  return { glyph: { ...glyph, topology }, changed: true };
}
