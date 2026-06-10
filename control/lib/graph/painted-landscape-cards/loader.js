/**
 * painted-landscape card loader.
 *
 * Scans `./` (this directory) for `*.md` files with JSON frontmatter,
 * dispatches each card by its `family` field, validates the payload
 * against the family schema, and returns `{ HEARTBEATS, SPLATCHES }`
 * registries keyed by card `id`.
 *
 * Card shape (all cards):
 *   ---
 *   {
 *     "id": "<kebab-case-id>",
 *     "family": "heartbeat" | "splatch",
 *     "aliases"?: [string, ...],
 *     "intent": "<one-line description>",
 *     ... family-specific fields ...
 *   }
 *   ---
 *   <markdown body — documentation for humans + semantic search>
 *
 * Heartbeat family payload:
 *   "engine"?: "sine-stack" | "fbm",   // default 'sine-stack' (backward compat)
 *   "samples": { "u": int >= 2, "v": int >= 2 },
 *   "defaultLight": { "x": number, "y": number, "z": number },
 *
 *   // sine-stack engine payload:
 *   "waves": [{ "amp": [lo, hi], "cu": [lo, hi], "cv": [lo, hi] }, ...]
 *
 *   // fbm engine payload (fractional Brownian motion over value noise):
 *   "fbm": {
 *     "octaves":     [int lo, int hi],  // 1-8 sensible; integer sampled
 *     "persistence": [lo, hi],          // 0-1; amplitude decay per octave
 *     "lacunarity":  [lo, hi],          // > 1; frequency multiplier per octave
 *     "baseScale":   [lo, hi],          // world units per cycle at octave 0
 *     "amplitude":   [lo, hi]           // overall height multiplier
 *   }
 *
 * Splatch family payload:
 *   "seeds": ["#rrggbb", "#rrggbb", "#rrggbb"]
 *
 * Camera family payload (binds the scene's projection):
 *   "camera": { "vanishingPoints": { "left": [x, y], "right": [x, y] }, "verticalAxis": [x, y] },
 *   "roomBasis": { "xRange": [lo, hi], "yRange": [lo, hi], "frontLeft": [x, y], "depthReach": n, "verticalUnit": n }
 *
 * Scene family payload (the completion unit — per-depth-band fill quotas):
 *   "affinity"?: { "heartbeats": [id, ...], "splatches": [id, ...] },  // recommendation only
 *   "fill": {
 *     "near"?: [{ "kind": <scatter-kind>, "count": int >= 0, "size": [lo, hi] }, ...],
 *     "mid"?:  [ ... ],
 *     "far"?:  [ ... ]
 *   }
 *   // At least one band must carry a non-empty entry. `kind` must be a
 *   // member of SCATTER_KIND_IDS (cone | canopy | boulder | tuft).
 *
 * Throws at module-load time on parse failures or schema violations —
 * fail fast at startup, never at first render. Adding a glyph is a
 * content edit (drop a markdown file here); shipping a new family kind
 * is still a code change.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const CARDS_DIR = path.dirname(fileURLToPath(import.meta.url));

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;

// Closed set of scatter mark kinds a scene card may place. Owned here (the
// loader has no dependency on painted-landscape.js, which imports from this
// module) so the renderer and the card validator share one source of truth.
export const SCATTER_KIND_IDS = Object.freeze(['cone', 'canopy', 'boulder', 'tuft']);
// Depth bands over the quad's v axis (v=0 near → v=1 far).
export const SCENE_BAND_IDS = Object.freeze(['near', 'mid', 'far']);
export const SCENE_BAND_RANGES = Object.freeze({
  near: Object.freeze([0, 0.34]),
  mid: Object.freeze([0.34, 0.67]),
  far: Object.freeze([0.67, 1.0]),
});

function parseFrontmatter(rawText, file) {
  const match = rawText.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`painted-landscape card ${file}: missing JSON frontmatter block (expected '---\\n{...}\\n---')`);
  }
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`painted-landscape card ${file}: malformed JSON frontmatter — ${err.message}`);
  }
  return { meta: parsed, body: match[2] || '' };
}

function validateCommon(meta, file) {
  const errors = [];
  if (typeof meta.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/i.test(meta.id)) {
    errors.push(`'id' must be a kebab-case-or-alphanumeric string`);
  }
  if (typeof meta.family !== 'string') {
    errors.push(`'family' is required (string)`);
  }
  if (typeof meta.intent !== 'string' || !meta.intent.length) {
    errors.push(`'intent' is required (non-empty string)`);
  }
  if (meta.aliases !== undefined) {
    if (!Array.isArray(meta.aliases) || !meta.aliases.every((a) => typeof a === 'string')) {
      errors.push(`'aliases' must be an array of strings when provided`);
    }
  }
  return errors;
}

function validateHeartbeat(meta, file) {
  const errors = [];
  if (typeof meta.samples !== 'object' || !meta.samples) {
    errors.push(`'samples' is required ({ u, v } object)`);
  } else {
    const intOk = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 2;
    if (!intOk(meta.samples.u)) errors.push(`'samples.u' must be an integer >= 2`);
    if (!intOk(meta.samples.v)) errors.push(`'samples.v' must be an integer >= 2`);
  }
  if (typeof meta.defaultLight !== 'object' || !meta.defaultLight) {
    errors.push(`'defaultLight' is required ({ x, y, z } object)`);
  } else {
    const finite = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!finite(meta.defaultLight.x) || !finite(meta.defaultLight.y) || !finite(meta.defaultLight.z)) {
      errors.push(`'defaultLight' must have finite x/y/z numbers`);
    }
  }
  const engine = meta.engine || 'sine-stack';
  if (engine !== 'sine-stack' && engine !== 'fbm') {
    errors.push(`'engine' must be 'sine-stack' or 'fbm' when provided (got ${JSON.stringify(meta.engine)})`);
    return errors;
  }
  if (engine === 'sine-stack') {
    errors.push(...validateSineStack(meta));
  } else if (engine === 'fbm') {
    errors.push(...validateFbm(meta));
  }
  return errors;
}

function validateSineStack(meta) {
  const errors = [];
  if (!Array.isArray(meta.waves) || meta.waves.length === 0) {
    errors.push(`'waves' is required (non-empty array of components) for engine 'sine-stack'`);
    return errors;
  }
  for (let i = 0; i < meta.waves.length; i += 1) {
    const w = meta.waves[i];
    if (typeof w !== 'object' || !w) {
      errors.push(`waves[${i}]: must be an object`);
      continue;
    }
    for (const key of ['amp', 'cu', 'cv']) {
      const range = w[key];
      if (!Array.isArray(range) || range.length !== 2) {
        errors.push(`waves[${i}].${key}: must be a [lo, hi] array`);
        continue;
      }
      const finite = (v) => typeof v === 'number' && Number.isFinite(v);
      if (!finite(range[0]) || !finite(range[1])) {
        errors.push(`waves[${i}].${key}: must contain finite numbers`);
      } else if (range[0] > range[1]) {
        errors.push(`waves[${i}].${key}: lo must be <= hi`);
      }
    }
  }
  return errors;
}

function validateFbm(meta) {
  const errors = [];
  if (typeof meta.fbm !== 'object' || !meta.fbm) {
    errors.push(`'fbm' object is required for engine 'fbm'`);
    return errors;
  }
  const finiteRange = (range) =>
    Array.isArray(range) && range.length === 2
    && typeof range[0] === 'number' && Number.isFinite(range[0])
    && typeof range[1] === 'number' && Number.isFinite(range[1])
    && range[0] <= range[1];
  const intRange = (range) =>
    finiteRange(range) && Number.isInteger(range[0]) && Number.isInteger(range[1]);
  if (!intRange(meta.fbm.octaves) || meta.fbm.octaves[0] < 1) {
    errors.push(`fbm.octaves: must be an [intLo, intHi] integer range with lo >= 1`);
  }
  for (const key of ['persistence', 'lacunarity', 'baseScale', 'amplitude']) {
    if (!finiteRange(meta.fbm[key])) {
      errors.push(`fbm.${key}: must be a [lo, hi] range of finite numbers with lo <= hi`);
      continue;
    }
    if (meta.fbm[key][0] <= 0) {
      errors.push(`fbm.${key}: lo must be > 0`);
    }
  }
  return errors;
}

function validateSplatch(meta, file) {
  const errors = [];
  if (!Array.isArray(meta.seeds) || meta.seeds.length !== 3) {
    errors.push(`'seeds' must be an array of exactly 3 hex colors`);
  } else {
    for (let i = 0; i < meta.seeds.length; i += 1) {
      const s = meta.seeds[i];
      if (typeof s !== 'string' || !HEX_RE.test(s)) {
        errors.push(`seeds[${i}]: must match '#rrggbb' (got ${JSON.stringify(s)})`);
      }
    }
  }
  return errors;
}

function validateCamera(meta) {
  const errors = [];
  const point2 = (v) =>
    Array.isArray(v) && v.length === 2
    && typeof v[0] === 'number' && Number.isFinite(v[0])
    && typeof v[1] === 'number' && Number.isFinite(v[1]);
  const finiteRange = (range) =>
    Array.isArray(range) && range.length === 2
    && typeof range[0] === 'number' && Number.isFinite(range[0])
    && typeof range[1] === 'number' && Number.isFinite(range[1]);
  if (typeof meta.camera !== 'object' || !meta.camera) {
    errors.push(`'camera' object is required for family 'camera'`);
  } else {
    if (!meta.camera.vanishingPoints
        || !point2(meta.camera.vanishingPoints.left)
        || !point2(meta.camera.vanishingPoints.right)) {
      errors.push(`camera.vanishingPoints: must be { left: [x, y], right: [x, y] }`);
    }
    if (!point2(meta.camera.verticalAxis)) {
      errors.push(`camera.verticalAxis: must be [x, y]`);
    }
  }
  if (typeof meta.roomBasis !== 'object' || !meta.roomBasis) {
    errors.push(`'roomBasis' object is required for family 'camera'`);
  } else {
    if (!finiteRange(meta.roomBasis.xRange)) {
      errors.push(`roomBasis.xRange: must be [lo, hi]`);
    }
    if (!finiteRange(meta.roomBasis.yRange)) {
      errors.push(`roomBasis.yRange: must be [lo, hi]`);
    }
    if (!point2(meta.roomBasis.frontLeft)) {
      errors.push(`roomBasis.frontLeft: must be [x, y]`);
    }
    for (const key of ['depthReach', 'verticalUnit']) {
      if (typeof meta.roomBasis[key] !== 'number' || !Number.isFinite(meta.roomBasis[key]) || meta.roomBasis[key] <= 0) {
        errors.push(`roomBasis.${key}: must be a positive finite number`);
      }
    }
  }
  return errors;
}

function validateScene(meta) {
  const errors = [];
  if (meta.affinity !== undefined) {
    if (typeof meta.affinity !== 'object' || !meta.affinity || Array.isArray(meta.affinity)) {
      errors.push(`'affinity' must be an object when provided`);
    } else {
      for (const key of ['heartbeats', 'splatches']) {
        if (meta.affinity[key] !== undefined
            && (!Array.isArray(meta.affinity[key]) || !meta.affinity[key].every((s) => typeof s === 'string'))) {
          errors.push(`affinity.${key}: must be an array of strings when provided`);
        }
      }
    }
  }
  if (typeof meta.fill !== 'object' || !meta.fill || Array.isArray(meta.fill)) {
    errors.push(`'fill' is required (object keyed by band: near | mid | far)`);
    return errors;
  }
  for (const band of Object.keys(meta.fill)) {
    if (!SCENE_BAND_IDS.includes(band)) {
      errors.push(`fill: unknown band '${band}' (available: ${SCENE_BAND_IDS.join(', ')})`);
      continue;
    }
    const entries = meta.fill[band];
    if (!Array.isArray(entries)) {
      errors.push(`fill.${band}: must be an array of { kind, count, size } entries`);
      continue;
    }
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      if (typeof e !== 'object' || !e) {
        errors.push(`fill.${band}[${i}]: must be an object`);
        continue;
      }
      if (!SCATTER_KIND_IDS.includes(e.kind)) {
        errors.push(`fill.${band}[${i}].kind: must be one of ${SCATTER_KIND_IDS.join(', ')} (got ${JSON.stringify(e.kind)})`);
      }
      if (typeof e.count !== 'number' || !Number.isInteger(e.count) || e.count < 0) {
        errors.push(`fill.${band}[${i}].count: must be an integer >= 0`);
      }
      if (!Array.isArray(e.size) || e.size.length !== 2
          || typeof e.size[0] !== 'number' || typeof e.size[1] !== 'number'
          || !Number.isFinite(e.size[0]) || !Number.isFinite(e.size[1])
          || e.size[0] <= 0 || e.size[0] > e.size[1]) {
        errors.push(`fill.${band}[${i}].size: must be a positive [lo, hi] range with lo <= hi`);
      }
    }
  }
  const totalCount = SCENE_BAND_IDS.reduce((sum, band) => {
    const entries = Array.isArray(meta.fill[band]) ? meta.fill[band] : [];
    return sum + entries.reduce((s, e) => s + (Number.isInteger(e?.count) ? e.count : 0), 0);
  }, 0);
  if (totalCount <= 0) {
    errors.push(`fill: at least one band must declare a non-zero count`);
  }
  return errors;
}

function loadCards() {
  const HEARTBEATS = {};
  const SPLATCHES = {};
  const CAMERAS = {};
  const SCENES = {};
  let files;
  try {
    files = readdirSync(CARDS_DIR).filter((f) => f.endsWith('.md')).sort();
  } catch (err) {
    throw new Error(`painted-landscape cards: cannot read directory ${CARDS_DIR}: ${err.message}`);
  }
  for (const file of files) {
    const rawText = readFileSync(path.join(CARDS_DIR, file), 'utf8');
    const { meta } = parseFrontmatter(rawText, file);
    const errors = validateCommon(meta, file);
    if (errors.length) {
      throw new Error(`painted-landscape card ${file}:\n - ${errors.join('\n - ')}`);
    }
    if (meta.family === 'heartbeat') {
      const familyErrors = validateHeartbeat(meta, file);
      if (familyErrors.length) {
        throw new Error(`painted-landscape card ${file} (heartbeat):\n - ${familyErrors.join('\n - ')}`);
      }
      if (HEARTBEATS[meta.id]) {
        throw new Error(`painted-landscape card ${file}: duplicate heartbeat id '${meta.id}'`);
      }
      const engine = meta.engine || 'sine-stack';
      const common = {
        aliases: Object.freeze([...(meta.aliases || [])]),
        intent: meta.intent,
        engine,
        samples: Object.freeze({ u: meta.samples.u, v: meta.samples.v }),
        defaultLight: Object.freeze({
          x: meta.defaultLight.x,
          y: meta.defaultLight.y,
          z: meta.defaultLight.z,
        }),
      };
      if (engine === 'sine-stack') {
        HEARTBEATS[meta.id] = Object.freeze({
          ...common,
          waves: Object.freeze(meta.waves.map((w) => Object.freeze({
            amp: Object.freeze([...w.amp]),
            cu: Object.freeze([...w.cu]),
            cv: Object.freeze([...w.cv]),
          }))),
        });
      } else {
        // fbm
        HEARTBEATS[meta.id] = Object.freeze({
          ...common,
          fbm: Object.freeze({
            octaves: Object.freeze([...meta.fbm.octaves]),
            persistence: Object.freeze([...meta.fbm.persistence]),
            lacunarity: Object.freeze([...meta.fbm.lacunarity]),
            baseScale: Object.freeze([...meta.fbm.baseScale]),
            amplitude: Object.freeze([...meta.fbm.amplitude]),
          }),
        });
      }
    } else if (meta.family === 'splatch') {
      const familyErrors = validateSplatch(meta, file);
      if (familyErrors.length) {
        throw new Error(`painted-landscape card ${file} (splatch):\n - ${familyErrors.join('\n - ')}`);
      }
      if (SPLATCHES[meta.id]) {
        throw new Error(`painted-landscape card ${file}: duplicate splatch id '${meta.id}'`);
      }
      SPLATCHES[meta.id] = Object.freeze({
        seeds: Object.freeze([...meta.seeds]),
        intent: meta.intent,
        aliases: Object.freeze([...(meta.aliases || [])]),
      });
    } else if (meta.family === 'camera') {
      const familyErrors = validateCamera(meta);
      if (familyErrors.length) {
        throw new Error(`painted-landscape card ${file} (camera):\n - ${familyErrors.join('\n - ')}`);
      }
      if (CAMERAS[meta.id]) {
        throw new Error(`painted-landscape card ${file}: duplicate camera id '${meta.id}'`);
      }
      CAMERAS[meta.id] = Object.freeze({
        intent: meta.intent,
        aliases: Object.freeze([...(meta.aliases || [])]),
        camera: Object.freeze({
          vanishingPoints: Object.freeze({
            left: Object.freeze([...meta.camera.vanishingPoints.left]),
            right: Object.freeze([...meta.camera.vanishingPoints.right]),
          }),
          verticalAxis: Object.freeze([...meta.camera.verticalAxis]),
        }),
        roomBasis: Object.freeze({
          xRange: Object.freeze([...meta.roomBasis.xRange]),
          yRange: Object.freeze([...meta.roomBasis.yRange]),
          frontLeft: Object.freeze([...meta.roomBasis.frontLeft]),
          depthReach: meta.roomBasis.depthReach,
          verticalUnit: meta.roomBasis.verticalUnit,
        }),
      });
    } else if (meta.family === 'scene') {
      const familyErrors = validateScene(meta);
      if (familyErrors.length) {
        throw new Error(`painted-landscape card ${file} (scene):\n - ${familyErrors.join('\n - ')}`);
      }
      if (SCENES[meta.id]) {
        throw new Error(`painted-landscape card ${file}: duplicate scene id '${meta.id}'`);
      }
      const freezeEntries = (entries) => Object.freeze(
        (Array.isArray(entries) ? entries : []).map((e) => Object.freeze({
          kind: e.kind,
          count: e.count,
          size: Object.freeze([...e.size]),
        })),
      );
      SCENES[meta.id] = Object.freeze({
        intent: meta.intent,
        aliases: Object.freeze([...(meta.aliases || [])]),
        affinity: Object.freeze({
          heartbeats: Object.freeze([...(meta.affinity?.heartbeats || [])]),
          splatches: Object.freeze([...(meta.affinity?.splatches || [])]),
        }),
        fill: Object.freeze(SCENE_BAND_IDS.reduce((acc, band) => {
          acc[band] = freezeEntries(meta.fill[band]);
          return acc;
        }, {})),
      });
    } else {
      throw new Error(`painted-landscape card ${file}: unknown family '${meta.family}' (expected 'heartbeat', 'splatch', 'camera', or 'scene')`);
    }
  }
  return {
    HEARTBEATS: Object.freeze(HEARTBEATS),
    SPLATCHES: Object.freeze(SPLATCHES),
    CAMERAS: Object.freeze(CAMERAS),
    SCENES: Object.freeze(SCENES),
  };
}

const registries = loadCards();
export const HEARTBEATS = registries.HEARTBEATS;
export const SPLATCHES = registries.SPLATCHES;
export const CAMERAS = registries.CAMERAS;
export const SCENES = registries.SCENES;
