/**
 * cutscene — the 16-bit tier's forcing case (P6+P7): scenes, viewport +
 * camera, parallax layers, timeline tracks, captions, and the stepped
 * fade, all resolving through one pure function of an integer clock.
 *
 * A cutscene is the one artifact that is a pure function of t end to
 * end — no sim, no input, no branching — so the whole intro stays a
 * recipe and playback is presentation. The cinematic verbs are closed
 * grammar:
 *   the cut     — scenes: [{duration, ...}]; global t → (scene, local)
 *   the pan     — viewport ≠ world: a '@camera' cell track; `fixed`
 *                 placements (titles, HUD) ignore it
 *   parallax    — layers with a [num, den] rational against the camera
 *                 plus their own scroll; [0,1] sky-locked, [1,1] world
 *   fade/flash  — a '@fade' level track, 0..8 toward a track color —
 *                 the era's palette math kept integer, zero pixel data
 *   text        — fonts are 1-bit glyph banks; a caption's `reveal`
 *                 track is the typewriter, a camera move is the credits
 *   timelines   — keyframes {at, value}: integer-floor lerp for
 *                 cell/scroll/level/reveal, step-hold for sprite/facing;
 *                 P0 cycle tracks survive unchanged, gaining `every`
 *
 * The register widens the raster budget, not the model: '8bit' = 3
 * colors + transparent, '16bit' = 15 (cell chars 1-9a-f, the 4bpp SNES
 * budget).
 *
 * All frame resolution lives inside createCutsceneEngine() — a closure
 * with no outer references — so emitCutscenePlayerHtml() can serialize
 * the SAME source into the player page. The module and the player
 * cannot drift; there is one resolver.
 *
 * Doctrine and the phase ladder: ./pixelizer.plan.md.
 */

// budgets are the eras' own: 2bpp-ish, 4bpp, and the practical 8bpp
// working set (61 = every char the cell alphabet can name)
const REGISTERS = { '8bit': 3, '16bit': 15, '32bit': 61 };
const CELL_ALPHABET = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FACINGS = ['W', 'E'];
const FADE_MAX = 8;
// prop kinds: lerped timelines vs stepped, and which targets they belong to
const LERP_PROPS = new Set(['cell', 'scroll', 'level', 'reveal']);
const PLACEMENT_PROPS = ['cell', 'sprite', 'facing', 'palette'];
const CAPTION_PROPS = ['cell', 'reveal'];

const isInt = (n) => Number.isInteger(n);
const isHexColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const isCellPair = (v) => Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);

/** '1'-'9' → 1-9, 'a'-'z' → 10-35, 'A'-'Z' → 36-61; else 0 (transparent). */
function cellIndex(ch) {
  return CELL_ALPHABET.indexOf(ch) + 1;
}

/** Raster check at a register's budget: size, palette, cell chars. */
function validateRaster(label, raster, budget, errors) {
  const [w, h] = Array.isArray(raster?.size) ? raster.size : [];
  if (!isInt(w) || !isInt(h) || w < 1 || h < 1) {
    errors.push(`${label}: size must be two positive integers`);
    return false;
  }
  const palette = raster.palette;
  if (!Array.isArray(palette) || palette.length < 1 || palette.length > budget) {
    errors.push(`${label}: palette must hold 1-${budget} colors (+ transparent), got ${Array.isArray(palette) ? palette.length : typeof palette}`);
  } else {
    palette.forEach((c, i) => {
      if (!isHexColor(c)) errors.push(`${label}: palette[${i}] must be #rrggbb, got ${JSON.stringify(c)}`);
    });
  }
  const cells = raster.cells;
  if (!Array.isArray(cells) || cells.length !== h) {
    errors.push(`${label}: cells must hold exactly ${h} rows, got ${Array.isArray(cells) ? cells.length : typeof cells}`);
    return false;
  }
  const maxDigit = Array.isArray(palette) ? Math.min(palette.length, budget) : 0;
  cells.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== w) {
      errors.push(`${label}: row ${y} must be a ${w}-char string, got ${typeof row === 'string' ? row.length : typeof row} chars`);
      return;
    }
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const idx = cellIndex(ch);
      if (idx < 1 || idx > maxDigit) {
        errors.push(`${label}: cell (${x},${y}) char "${ch}" is outside palette budget 1-${maxDigit}`);
      }
    }
  });
  return true;
}

function validateKeys(label, track, duration, checkValue, errors) {
  const keys = track.keys;
  if (!Array.isArray(keys) || keys.length < 1) {
    errors.push(`${label}: keys must be a non-empty list`);
    return;
  }
  let prev = -1;
  keys.forEach((k, i) => {
    if (!isInt(k?.at) || k.at < 0 || k.at >= duration) {
      errors.push(`${label}: keys[${i}].at must be an integer in [0, ${duration}), got ${JSON.stringify(k?.at)}`);
    } else if (k.at <= prev) {
      errors.push(`${label}: keys[${i}].at ${k.at} must be strictly after ${prev} — keys sort ascending`);
    }
    prev = isInt(k?.at) ? k.at : prev;
    checkValue(k?.value, `${label}: keys[${i}].value`);
  });
}

function validateCycle(label, track, checkValue, errors) {
  if (!Array.isArray(track.values) || track.values.length < 1) {
    errors.push(`${label}: values must be a non-empty list`);
    return;
  }
  if (track.every != null && (!isInt(track.every) || track.every < 1)) {
    errors.push(`${label}: every must be a positive integer, got ${JSON.stringify(track.every)}`);
  }
  track.values.forEach((v, i) => checkValue(v, `${label}: values[${i}]`));
}

/**
 * Validate a cutscene recipe at mint time. Returns error strings; empty
 * means mintable. Register budget, dangling refs (sprites, banks,
 * fonts, glyph coverage, track targets), off-grammar props, unsorted
 * keys, and out-of-range fade/reveal all fail here, never at render.
 */
export function validateCutsceneRecipe(recipe) {
  const errors = [];
  if (!recipe || typeof recipe !== 'object') return ['recipe must be an object'];

  const budget = REGISTERS[recipe.register ?? '8bit'];
  if (!budget) errors.push(`register must be one of ${Object.keys(REGISTERS).join('/')}, got ${JSON.stringify(recipe.register)}`);
  if (!isCellPair(recipe.viewport) || recipe.viewport[0] < 1 || recipe.viewport[1] < 1) {
    errors.push(`viewport must be two positive integer cells, got ${JSON.stringify(recipe.viewport)}`);
  }
  if (!isInt(recipe.fps) || recipe.fps < 1) errors.push(`fps must be a positive integer, got ${JSON.stringify(recipe.fps)}`);

  const sprites = recipe.sprites || {};
  if (budget) for (const [id, s] of Object.entries(sprites)) validateRaster(`sprite "${id}"`, s, budget, errors);

  const tileBanks = recipe.tileBanks || {};
  for (const [bankId, tb] of Object.entries(tileBanks)) {
    const [tw, th] = Array.isArray(tb?.tileSize) ? tb.tileSize : [];
    if (!isInt(tw) || !isInt(th) || tw < 1 || th < 1) {
      errors.push(`tileBank "${bankId}": tileSize must be two positive integers`);
      continue;
    }
    for (const [id, tile] of Object.entries(tb.bank || {})) {
      if (budget && validateRaster(`tileBank "${bankId}" tile "${id}"`, tile, budget, errors)) {
        if (tile.size[0] !== tw || tile.size[1] !== th) {
          errors.push(`tileBank "${bankId}" tile "${id}": size ${tile.size[0]}x${tile.size[1]} must match tileSize ${tw}x${th}`);
        }
      }
    }
    for (const [ch, tileId] of Object.entries(tb.legend || {})) {
      if (ch.length !== 1 || ch === '.') errors.push(`tileBank "${bankId}" legend key ${JSON.stringify(ch)} must be a single non-"." char`);
      if (!tb.bank?.[tileId]) errors.push(`tileBank "${bankId}" legend "${ch}": unknown tile "${tileId}"`);
    }
  }

  const fonts = recipe.fonts || {};
  for (const [fontId, font] of Object.entries(fonts)) {
    const [fw, fh] = Array.isArray(font?.size) ? font.size : [];
    if (!isInt(fw) || !isInt(fh) || fw < 1 || fh < 1) {
      errors.push(`font "${fontId}": size must be two positive integers`);
      continue;
    }
    for (const [ch, glyph] of Object.entries(font.glyphs || {})) {
      if (!Array.isArray(glyph) || glyph.length !== fh || glyph.some((r) => typeof r !== 'string' || r.length !== fw || /[^1.]/.test(r))) {
        errors.push(`font "${fontId}" glyph ${JSON.stringify(ch)}: must be ${fh} rows of ${fw} chars from "1"/"."`);
      }
    }
  }

  const scenes = recipe.scenes;
  if (!Array.isArray(scenes) || scenes.length < 1) {
    errors.push('scenes must be a non-empty list');
    return errors;
  }

  scenes.forEach((scene, si) => {
    const label = scene?.id ? `scene "${scene.id}"` : `scene[${si}]`;
    if (!isInt(scene?.duration) || scene.duration < 1) {
      errors.push(`${label}: duration must be a positive integer frame count`);
      return;
    }
    if (scene.background != null && !isHexColor(scene.background)) {
      errors.push(`${label}: background must be #rrggbb or null`);
    }

    const layerIds = new Set();
    (scene.layers || []).forEach((layer, li) => {
      const ll = `${label} layer ${layer?.id ? `"${layer.id}"` : `[${li}]`}`;
      if (!layer?.id || layerIds.has(layer.id)) errors.push(`${ll}: needs a unique id`);
      layerIds.add(layer?.id);
      const bank = tileBanks[layer?.bank];
      if (!bank) {
        errors.push(`${ll}: unknown tileBank "${layer?.bank}"`);
        return;
      }
      const p = layer.parallax;
      if (p != null && (!Array.isArray(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1]) || p[1] < 1)) {
        errors.push(`${ll}: parallax must be [int, positive int], got ${JSON.stringify(p)}`);
      }
      for (const key of ['origin', 'scroll']) {
        if (layer[key] != null && !isCellPair(layer[key])) errors.push(`${ll}: ${key} must be two integers`);
      }
      (layer.rows || []).forEach((row, y) => {
        if (typeof row !== 'string') {
          errors.push(`${ll}: rows[${y}] must be a string`);
          return;
        }
        for (const ch of row) {
          if (ch !== '.' && !bank.legend?.[ch]) errors.push(`${ll}: rows[${y}] char "${ch}" is not in the "${layer.bank}" legend`);
        }
      });
    });

    const targetKind = {};
    (scene.placements || []).forEach((p, pi) => {
      const pl = `${label} placement ${p?.id ? `"${p.id}"` : `[${pi}]`}`;
      if (!p?.id || targetKind[p.id]) errors.push(`${pl}: needs a unique id`);
      if (p?.id) targetKind[p.id] = 'placement';
      if (!sprites[p?.sprite]) errors.push(`${pl}: unknown sprite "${p?.sprite}"`);
      if (!isCellPair(p?.cell)) errors.push(`${pl}: cell must be two integers`);
      if (p?.facing != null && !FACINGS.includes(p.facing)) errors.push(`${pl}: facing must be ${FACINGS.join('/')}`);
    });
    (scene.captions || []).forEach((c, ci) => {
      const cl = `${label} caption ${c?.id ? `"${c.id}"` : `[${ci}]`}`;
      if (!c?.id || targetKind[c.id]) errors.push(`${cl}: needs a unique id`);
      if (c?.id) targetKind[c.id] = 'caption';
      const font = fonts[c?.font];
      if (!font) errors.push(`${cl}: unknown font "${c?.font}"`);
      if (typeof c?.text !== 'string' || !c.text.length) errors.push(`${cl}: text must be a non-empty string`);
      else if (font) {
        for (const ch of c.text) {
          if (ch !== ' ' && !font.glyphs?.[ch]) errors.push(`${cl}: char ${JSON.stringify(ch)} has no glyph in font "${c.font}"`);
        }
      }
      if (!isCellPair(c?.cell)) errors.push(`${cl}: cell must be two integers`);
      if (!isHexColor(c?.color)) errors.push(`${cl}: color must be #rrggbb`);
      if (c?.scale != null && (!isInt(c.scale) || c.scale < 1)) errors.push(`${cl}: scale must be a positive integer`);
    });

    (scene.tracks || []).forEach((tr, ti) => {
      const tl = `${label} track[${ti}]`;
      const target = tr?.target;
      let allowedProps;
      let checkValue = () => {};
      if (target === '@camera') {
        allowedProps = ['cell'];
        checkValue = (v, vl) => { if (!isCellPair(v)) errors.push(`${vl} must be two integers`); };
      } else if (target === '@fade') {
        allowedProps = ['level'];
        checkValue = (v, vl) => { if (!isInt(v) || v < 0 || v > FADE_MAX) errors.push(`${vl} must be an integer 0-${FADE_MAX}`); };
        if (tr?.color != null && !isHexColor(tr.color)) errors.push(`${tl}: color must be #rrggbb`);
      } else if (typeof target === 'string' && target.startsWith('@layer:')) {
        allowedProps = ['scroll'];
        if (!layerIds.has(target.slice(7))) errors.push(`${tl}: target "${target}" matches no layer in this scene`);
        checkValue = (v, vl) => { if (!isCellPair(v)) errors.push(`${vl} must be two integers`); };
      } else if (targetKind[target] === 'placement') {
        allowedProps = PLACEMENT_PROPS;
        const base = (scene.placements || []).find((p) => p.id === target);
        const baseSprite = sprites[base?.sprite];
        // palette cycling rotates a sub-range of the sprite's palette —
        // the era's color-cycling on a range of palette RAM
        if (tr?.prop === 'palette') {
          const r = tr.range;
          const n = baseSprite?.palette?.length ?? 0;
          if (!Array.isArray(r) || r.length !== 2 || !isInt(r[0]) || !isInt(r[1]) || r[0] < 1 || r[1] < 1 || r[0] + r[1] - 1 > n) {
            errors.push(`${tl}: palette range must be [start, length] within the sprite's ${n} colors, got ${JSON.stringify(r)}`);
          }
        }
        checkValue = (v, vl) => {
          if (tr.prop === 'cell' && !isCellPair(v)) errors.push(`${vl} must be two integers`);
          if (tr.prop === 'facing' && !FACINGS.includes(v)) errors.push(`${vl} must be ${FACINGS.join('/')}`);
          if (tr.prop === 'palette' && (!isInt(v) || v < 0)) errors.push(`${vl} must be a non-negative integer rotation offset`);
          if (tr.prop === 'sprite') {
            const variant = sprites[v];
            if (!variant) errors.push(`${vl}: unknown sprite "${v}"`);
            else if (baseSprite && (variant.size[0] !== baseSprite.size[0] || variant.size[1] !== baseSprite.size[1])) {
              errors.push(`${vl}: variant "${v}" is ${variant.size[0]}x${variant.size[1]}, base is ${baseSprite.size[0]}x${baseSprite.size[1]} — variants share the base size`);
            }
          }
        };
      } else if (targetKind[target] === 'caption') {
        allowedProps = CAPTION_PROPS;
        const cap = (scene.captions || []).find((c) => c.id === target);
        checkValue = (v, vl) => {
          if (tr.prop === 'cell' && !isCellPair(v)) errors.push(`${vl} must be two integers`);
          if (tr.prop === 'reveal' && (!isInt(v) || v < 0 || v > (cap?.text?.length ?? 0))) {
            errors.push(`${vl} must be an integer 0-${cap?.text?.length ?? 0} (the caption's length)`);
          }
        };
      } else {
        errors.push(`${tl}: target ${JSON.stringify(target)} matches no placement, caption, layer, @camera, or @fade`);
        return;
      }
      if (!allowedProps.includes(tr?.prop)) {
        errors.push(`${tl}: prop must be one of ${allowedProps.join('/')} for target "${target}", got ${JSON.stringify(tr?.prop)}`);
        return;
      }
      const hasKeys = tr.keys != null;
      const hasValues = tr.values != null;
      if (hasKeys === hasValues) {
        errors.push(`${tl}: exactly one of keys (timeline) or values (cycle) is required`);
        return;
      }
      if (hasKeys) validateKeys(tl, tr, scene.duration, checkValue, errors);
      else validateCycle(tl, tr, checkValue, errors);
    });
  });

  return errors;
}

/**
 * The one resolver, as a self-contained closure (no outer references)
 * so the player HTML can embed `(${createCutsceneEngine})()` and run
 * the exact same source. Everything in here is pure integer math:
 * same recipe + same t → the same grid, in the module or in a browser.
 */
export function createCutsceneEngine() {
  const LERP = { cell: 1, scroll: 1, level: 1, reveal: 1 };

  const ALPHABET = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function cellIdx(ch) {
    return ALPHABET.indexOf(ch) + 1;
  }

  function ilerp(a, b, t0, t1, t) {
    return a + Math.floor(((b - a) * (t - t0)) / (t1 - t0));
  }

  function trackValue(track, t) {
    if (track.values) {
      const every = track.every || 1;
      return track.values[Math.floor(t / every) % track.values.length];
    }
    const keys = track.keys;
    if (t <= keys[0].at) return keys[0].value;
    let i = keys.length - 1;
    while (keys[i].at > t) i--;
    const cur = keys[i];
    const next = keys[i + 1];
    if (!next || !LERP[track.prop]) return cur.value;
    if (Array.isArray(cur.value)) return cur.value.map((a, j) => ilerp(a, next.value[j], cur.at, next.at, t));
    return ilerp(cur.value, next.value, cur.at, next.at, t);
  }

  function totalFrames(recipe) {
    return recipe.scenes.reduce((n, s) => n + s.duration, 0);
  }

  function sceneAt(recipe, t) {
    let acc = 0;
    for (let i = 0; i < recipe.scenes.length; i++) {
      const scene = recipe.scenes[i];
      if (t < acc + scene.duration) return { scene, local: t - acc, index: i };
      acc += scene.duration;
    }
    const last = recipe.scenes[recipe.scenes.length - 1];
    return { scene: last, local: last.duration - 1, index: recipe.scenes.length - 1 };
  }

  function blit(grid, W, H, palette, cells, ox, oy) {
    for (let y = 0; y < cells.length; y++) {
      const py = oy + y;
      if (py < 0 || py >= H) continue;
      const row = cells[y];
      for (let x = 0; x < row.length; x++) {
        const idx = cellIdx(row[x]);
        if (idx < 1) continue;
        const px = ox + x;
        if (px < 0 || px >= W) continue;
        grid[py][px] = palette[idx - 1];
      }
    }
  }

  function blend(color, fadeColor, level) {
    const c = parseInt(color.slice(1), 16);
    const f = parseInt(fadeColor.slice(1), 16);
    let out = '#';
    for (let sh = 16; sh >= 0; sh -= 8) {
      const a = (c >> sh) & 255;
      const b = (f >> sh) & 255;
      out += (a + Math.round(((b - a) * level) / 8)).toString(16).padStart(2, '0');
    }
    return out;
  }

  function resolveFrame(recipe, t) {
    if (!Number.isInteger(t) || t < 0) throw new Error(`frame index must be a non-negative integer, got ${t}`);
    const [W, H] = recipe.viewport;
    const { scene, local } = sceneAt(recipe, t);
    const grid = Array.from({ length: H }, () => new Array(W).fill(scene.background ?? null));

    const ov = {};
    let fade = null;
    for (const tr of scene.tracks || []) {
      const v = trackValue(tr, local);
      if (tr.target === '@fade') fade = { level: v, color: tr.color || '#000000' };
      else if (tr.prop === 'palette') {
        const o = ov[tr.target] || (ov[tr.target] = {});
        (o.palette || (o.palette = [])).push({ range: tr.range, offset: v });
      } else (ov[tr.target] || (ov[tr.target] = {}))[tr.prop] = v;
    }
    const cam = (ov['@camera'] && ov['@camera'].cell) || [0, 0];

    for (const layer of scene.layers || []) {
      const bank = recipe.tileBanks[layer.bank];
      const [tw, th] = bank.tileSize;
      const par = layer.parallax || [1, 1];
      const base = layer.scroll || [0, 0];
      const ls = (ov['@layer:' + layer.id] && ov['@layer:' + layer.id].scroll) || [0, 0];
      const [orx, ory] = layer.origin || [0, 0];
      const offX = Math.floor((cam[0] * par[0]) / par[1]) + base[0] + ls[0];
      const offY = Math.floor((cam[1] * par[0]) / par[1]) + base[1] + ls[1];
      (layer.rows || []).forEach((row, ty) => {
        for (let tx = 0; tx < row.length; tx++) {
          if (row[tx] === '.') continue;
          const tile = bank.bank[bank.legend[row[tx]]];
          blit(grid, W, H, tile.palette, tile.cells, orx + tx * tw - offX, ory + ty * th - offY);
        }
      });
    }

    for (const p of scene.placements || []) {
      const o = ov[p.id] || {};
      const sprite = recipe.sprites[o.sprite != null ? o.sprite : p.sprite];
      const facing = o.facing != null ? o.facing : (p.facing || 'W');
      const cells = facing === 'E' ? sprite.cells.map((r) => [...r].reverse().join('')) : sprite.cells;
      const cell = o.cell || p.cell;
      const sx = p.fixed ? cell[0] : cell[0] - cam[0];
      const sy = p.fixed ? cell[1] : cell[1] - cam[1];
      let palette = sprite.palette;
      if (o.palette) {
        // color cycling: rotate each track's range within the base
        // palette — the pixels never change, only what the indices mean
        palette = palette.slice();
        for (const rot of o.palette) {
          const [start, len] = rot.range;
          for (let i = 0; i < len; i++) palette[start - 1 + i] = sprite.palette[start - 1 + ((i + rot.offset) % len)];
        }
      }
      blit(grid, W, H, palette, cells, sx, sy);
    }

    for (const c of scene.captions || []) {
      const o = ov[c.id] || {};
      const font = recipe.fonts[c.font];
      const [fw, fh] = font.size;
      const s = c.scale || 1;
      const reveal = Math.min(o.reveal != null ? o.reveal : c.text.length, c.text.length);
      const cell = o.cell || c.cell;
      const fixed = c.fixed !== false; // captions default screen-fixed
      let x = fixed ? cell[0] : cell[0] - cam[0];
      const y = fixed ? cell[1] : cell[1] - cam[1];
      for (let i = 0; i < reveal; i++) {
        const glyph = c.text[i] === ' ' ? null : font.glyphs[c.text[i]];
        if (glyph) {
          for (let gy = 0; gy < fh; gy++) {
            for (let gx = 0; gx < fw; gx++) {
              if (glyph[gy][gx] !== '1') continue;
              for (let dy = 0; dy < s; dy++) {
                for (let dx = 0; dx < s; dx++) {
                  const px = x + gx * s + dx;
                  const py = y + gy * s + dy;
                  if (px >= 0 && px < W && py >= 0 && py < H) grid[py][px] = c.color;
                }
              }
            }
          }
        }
        x += (fw + 1) * s;
      }
    }

    if (fade && fade.level > 0) {
      const memo = {};
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const color = grid[y][x];
          if (!color) continue;
          if (memo[color] === undefined) memo[color] = blend(color, fade.color, fade.level);
          grid[y][x] = memo[color];
        }
      }
    }

    return { width: W, height: H, grid };
  }

  return { resolveFrame, sceneAt, totalFrames };
}

const engine = createCutsceneEngine();
export const resolveCutsceneFrame = engine.resolveFrame;
export const cutsceneSceneAt = engine.sceneAt;
export const cutsceneTotalFrames = engine.totalFrames;

/**
 * One frame as crisp-edges SVG — same run-merged one-path-per-color
 * emission as the 8-bit tier, for stills and eyeball review.
 */
export function emitCutsceneFrameSvg(recipe, t, { scale = 6 } = {}) {
  const { width, height, grid } = engine.resolveFrame(recipe, t);
  const byColor = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = grid[y][x];
      if (!color) continue;
      let run = 1;
      while (x + run < width && grid[y][x + run] === color) run++;
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color).push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run - 1;
    }
  }
  const paths = [...byColor.keys()].sort()
    .map((color) => `  <path fill="${color}" d="${byColor.get(color).join('')}"/>`)
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges">`,
    paths,
    '</svg>',
  ].join('\n');
}

/**
 * The player — playback as presentation over the sovereign recipe. A
 * canvas at native cell size (CSS-upscaled, pixelated), an integer rAF
 * clock, scrub/step/pause because every frame is addressable. The
 * engine closure is serialized in verbatim; there is no second
 * resolver to drift.
 */
export function emitCutscenePlayerHtml(recipe, { scale = 6, title = 'cutscene' } = {}) {
  return `<!doctype html>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { background: #0c0c12; color: #9a96b0; font: 12px/1.6 ui-monospace, monospace;
         display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .rig { display: grid; gap: 10px; justify-items: center; }
  canvas { image-rendering: pixelated; border: 1px solid #26243a; }
  .bar { display: flex; gap: 10px; align-items: center; width: 100%; }
  button { background: #1a1828; color: #cac6e0; border: 1px solid #34324a;
           padding: 3px 12px; font: inherit; cursor: pointer; }
  input[type=range] { flex: 1; accent-color: #7a6ac0; }
</style>
<div class="rig">
  <canvas id="cv"></canvas>
  <div class="bar">
    <button id="play">&#9654;</button>
    <input id="scrub" type="range" min="0" value="0">
    <span id="label"></span>
  </div>
</div>
<script>
const RECIPE = ${JSON.stringify(recipe)};
const SCALE = ${scale};
const engine = (${createCutsceneEngine})();
const total = engine.totalFrames(RECIPE);
const W = RECIPE.viewport[0], H = RECIPE.viewport[1];
cv.width = W; cv.height = H;
cv.style.width = W * SCALE + 'px'; cv.style.height = H * SCALE + 'px';
scrub.max = total - 1;
const ctx = cv.getContext('2d');
let frame = 0, playing = false, t0 = 0, f0 = 0;
function draw(t) {
  const grid = engine.resolveFrame(RECIPE, t).grid;
  ctx.clearRect(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = grid[y][x];
      if (!c) { x++; continue; }
      let run = 1;
      while (x + run < W && grid[y][x + run] === c) run++;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, run, 1);
      x += run;
    }
  }
  const s = engine.sceneAt(RECIPE, t);
  label.textContent = 'f' + t + '/' + (total - 1) + ' \\u00b7 ' + (s.scene.id || 'scene ' + s.index) + ' ' + s.local;
  scrub.value = t;
}
function setFrame(t) { playing = false; play.innerHTML = '&#9654;'; frame = Math.max(0, Math.min(t, total - 1)); draw(frame); }
play.onclick = () => {
  if (!playing && frame >= total - 1) frame = 0;
  playing = !playing;
  play.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  if (playing) { t0 = performance.now(); f0 = frame; }
};
scrub.oninput = (e) => setFrame(+e.target.value);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') setFrame(frame + 1);
  if (e.key === 'ArrowLeft') setFrame(frame - 1);
  if (e.key === ' ') { e.preventDefault(); play.onclick(); }
});
(function tick(now) {
  if (playing) {
    frame = Math.min(f0 + Math.floor(((now - t0) / 1000) * RECIPE.fps), total - 1);
    if (frame === total - 1) { playing = false; play.innerHTML = '&#8635;'; }
    draw(frame);
  }
  requestAnimationFrame(tick);
})(performance.now());
draw(0);
</script>`;
}
