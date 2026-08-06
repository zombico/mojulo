/**
 * pixelizer — directed pixels on a deterministic frame (P0 + tile
 * lattice + track grammar).
 *
 * The raster mirror of the polygonizer. A recipe is tiny declarative
 * state in the PPU mold — palettes + rasters (cell strings) + integer
 * placements + tracks — and a frame is a pure resolution of that
 * state: resolveFrame(recipe, t) re-derives the whole raster every
 * call. No retained scene graph, no mutation between frames; same
 * recipe + same t → byte-identical SVG.
 *
 * Two tiers, the NES's own split:
 * - tiles (nametable analog): a bank of small rasters + a legend +
 *   char rows; the map is tile *references*, never freehand pixels.
 * - placements (OAM analog): sprites at integer cells, resolved
 *   through tracks. Track props are a closed grammar:
 *     facing — E paints through the E-W reflect (the flip bit as
 *              grammar; a flipped frame carries zero new pixel data)
 *     sprite — frame-variant swap (walk-1/walk-2/squashed); variants
 *              must share the base sprite's size
 *     cell   — integer cell path (jump arcs, patrols)
 *
 * Doctrine, invariants, and the phase ladder: ./pixelizer.plan.md.
 */

const FACINGS = ['W', 'E'];
const TRACK_PROPS = ['facing', 'sprite', 'cell'];
const REGISTERS = { '8bit': 3, '16bit': 15 }; // colors + transparent per raster — the era IS the budget (matches cutscene.js)

const isInt = (n) => Number.isInteger(n);
const isHexColor = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const isCellPair = (v) => Array.isArray(v) && v.length === 2 && isInt(v[0]) && isInt(v[1]);

/** Cell char → 1-based palette index: '1'-'9' then 'a'-'f' (hex; the snes tier needs 15). */
const charIdx = (ch) => parseInt(ch, 16);

const budgetOf = (recipe) => REGISTERS[recipe?.register ?? '8bit'];

/** tiles may be one lattice or an ordered list of them (the SNES's background layers). */
const tileLayers = (tiles) => (Array.isArray(tiles) ? tiles : tiles ? [tiles] : []);

/** Shared raster check for sprites and bank tiles: size, palette budget, cell chars. */
function validateRaster(label, raster, errors, budget) {
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
      const idx = charIdx(ch);
      if (!isInt(idx) || idx < 1 || idx > maxDigit) {
        errors.push(`${label}: cell (${x},${y}) char "${ch}" is outside palette budget 1-${maxDigit}`);
      }
    }
  });
  return true;
}

/**
 * Validate a pixel-map recipe at mint time. Returns a list of error
 * strings; empty list means the recipe is mintable. Bad palette
 * indices, ragged rows, out-of-bounds placements, dangling tile or
 * sprite refs, and off-grammar tracks all fail here with clear
 * messages, never at render time.
 */
export function validatePixelRecipe(recipe) {
  const errors = [];
  if (!recipe || typeof recipe !== 'object') return ['recipe must be an object'];

  const [mapW, mapH] = Array.isArray(recipe.size) ? recipe.size : [];
  if (!isInt(mapW) || !isInt(mapH) || mapW < 1 || mapH < 1) {
    errors.push(`size must be two positive integer cells, got ${JSON.stringify(recipe.size)}`);
  }
  if (recipe.background != null && !isHexColor(recipe.background)) {
    errors.push(`background must be a #rrggbb color or null, got ${JSON.stringify(recipe.background)}`);
  }
  if (recipe.register != null && !REGISTERS[recipe.register]) {
    errors.push(`register must be one of ${Object.keys(REGISTERS).join('/')}, got ${JSON.stringify(recipe.register)}`);
  }
  const budget = budgetOf(recipe);

  const sprites = recipe.sprites || {};
  for (const [id, sprite] of Object.entries(sprites)) validateRaster(`sprite "${id}"`, sprite, errors, budget);

  tileLayers(recipe.tiles).forEach((tiles, li) => {
    const where = tileLayers(recipe.tiles).length > 1 ? `tiles[${li}]` : 'tiles';
    const [tw, th] = Array.isArray(tiles.tileSize) ? tiles.tileSize : [];
    if (!isInt(tw) || !isInt(th) || tw < 1 || th < 1) {
      errors.push(`${where}.tileSize must be two positive integers, got ${JSON.stringify(tiles.tileSize)}`);
    }
    const bank = tiles.bank || {};
    for (const [id, tile] of Object.entries(bank)) {
      if (validateRaster(`tile "${id}"`, tile, errors, budget) && isInt(tw)) {
        if (tile.size[0] !== tw || tile.size[1] !== th) {
          errors.push(`tile "${id}": size ${tile.size[0]}x${tile.size[1]} must match tileSize ${tw}x${th}`);
        }
      }
    }
    const legend = tiles.legend || {};
    for (const [ch, tileId] of Object.entries(legend)) {
      if (ch.length !== 1 || ch === '.') errors.push(`${where}.legend key ${JSON.stringify(ch)} must be a single non-"." char`);
      if (!bank[tileId]) errors.push(`${where}.legend "${ch}": unknown tile "${tileId}"`);
    }
    const rows = tiles.rows || [];
    if (isInt(tw) && isInt(mapW)) {
      if (rows.length * th > mapH) errors.push(`${where}.rows: ${rows.length} rows of ${th}px overflow the ${mapH}px map`);
      rows.forEach((row, y) => {
        if (typeof row !== 'string' || row.length * tw > mapW) {
          errors.push(`${where}.rows[${y}]: ${typeof row === 'string' ? row.length : typeof row} tiles of ${tw}px overflow the ${mapW}px map`);
          return;
        }
        for (const ch of row) {
          if (ch !== '.' && !legend[ch]) errors.push(`${where}.rows[${y}]: char "${ch}" is not in the legend`);
        }
      });
    }
  });

  const placements = recipe.placements || [];
  const placementById = {};
  placements.forEach((p, i) => {
    const label = p?.id ? `placement "${p.id}"` : `placement[${i}]`;
    if (p?.id) {
      if (placementById[p.id]) errors.push(`${label}: duplicate id`);
      placementById[p.id] = p;
    }
    const sprite = sprites[p?.sprite];
    if (!sprite) {
      errors.push(`${label}: unknown sprite "${p?.sprite}"`);
      return;
    }
    if (!isCellPair(p.cell)) {
      errors.push(`${label}: cell must be two integers, got ${JSON.stringify(p.cell)}`);
      return;
    }
    const [w, h] = sprite.size;
    const [cx, cy] = p.cell;
    if (isInt(mapW) && (cx < 0 || cy < 0 || cx + w > mapW || cy + h > mapH)) {
      errors.push(`${label}: sprite ${w}x${h} at cell (${cx},${cy}) leaves the ${mapW}x${mapH} map`);
    }
    if (p.facing != null && !FACINGS.includes(p.facing)) {
      errors.push(`${label}: facing must be one of ${FACINGS.join('/')}, got ${JSON.stringify(p.facing)}`);
    }
  });

  const tracks = recipe.animation?.tracks || [];
  tracks.forEach((tr, i) => {
    const base = placementById[tr?.target];
    if (!base) {
      errors.push(`track[${i}]: target "${tr?.target}" matches no placement id`);
      return;
    }
    if (!TRACK_PROPS.includes(tr?.prop)) {
      errors.push(`track[${i}]: prop must be one of ${TRACK_PROPS.join('/')}, got ${JSON.stringify(tr?.prop)}`);
      return;
    }
    if (!Array.isArray(tr?.values) || tr.values.length < 1) {
      errors.push(`track[${i}]: values must be a non-empty list`);
      return;
    }
    const baseSprite = sprites[base.sprite];
    tr.values.forEach((v, j) => {
      if (tr.prop === 'facing' && !FACINGS.includes(v)) {
        errors.push(`track[${i}]: values[${j}] must be one of ${FACINGS.join('/')}, got ${JSON.stringify(v)}`);
      }
      if (tr.prop === 'sprite') {
        const variant = sprites[v];
        if (!variant) {
          errors.push(`track[${i}]: values[${j}] unknown sprite "${v}"`);
        } else if (baseSprite && (variant.size[0] !== baseSprite.size[0] || variant.size[1] !== baseSprite.size[1])) {
          errors.push(`track[${i}]: variant "${v}" is ${variant.size[0]}x${variant.size[1]}, base "${base.sprite}" is ${baseSprite.size[0]}x${baseSprite.size[1]} — variants share the base size`);
        }
      }
      if (tr.prop === 'cell') {
        if (!isCellPair(v)) {
          errors.push(`track[${i}]: values[${j}] must be two integers, got ${JSON.stringify(v)}`);
        } else if (baseSprite && isInt(mapW)) {
          const [w, h] = baseSprite.size;
          if (v[0] < 0 || v[1] < 0 || v[0] + w > mapW || v[1] + h > mapH) {
            errors.push(`track[${i}]: values[${j}] (${v[0]},${v[1]}) leaves the ${mapW}x${mapH} map`);
          }
        }
      }
    });
  });

  return errors;
}

/** E-W reflect as grammar: reverse each authored row. Zero new pixel data. */
export function reflectCellsEW(cells) {
  return cells.map((row) => [...row].reverse().join(''));
}

function blit(grid, raster, ox, oy, cells) {
  const [w, h] = raster.size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = cells[y][x];
      if (ch === '.') continue;
      grid[oy + y][ox + x] = raster.palette[charIdx(ch) - 1]; // '1' → palette[0], 'f' → palette[14]
    }
  }
}

/**
 * Resolve one frame — a pure function of (recipe, t). Tiles paint
 * first (the nametable), then placements in declaration order (back
 * to front). Tracks override placement props by t modulo the track's
 * value cycle; sprites are authored facing W, so a resolved facing of
 * E paints through the E-W reflect. Returns { width, height, grid }
 * with grid[y][x] = '#rrggbb' | null (null = background).
 */
export function resolveFrame(recipe, t) {
  if (!isInt(t) || t < 0) throw new Error(`frame index must be a non-negative integer, got ${t}`);
  const [mapW, mapH] = recipe.size;
  const grid = Array.from({ length: mapH }, () => new Array(mapW).fill(null));

  for (const { tileSize: [tw, th], bank, legend, rows = [] } of tileLayers(recipe.tiles)) {
    rows.forEach((row, ty) => {
      for (let tx = 0; tx < row.length; tx++) {
        const tile = row[tx] === '.' ? null : bank[legend[row[tx]]];
        if (tile) blit(grid, tile, tx * tw, ty * th, tile.cells);
      }
    });
  }

  const overrides = {};
  for (const tr of recipe.animation?.tracks || []) {
    overrides[tr.target] = { ...(overrides[tr.target] || {}), [tr.prop]: tr.values[t % tr.values.length] };
  }

  for (const p of recipe.placements || []) {
    const sprite = recipe.sprites[overrides[p.id]?.sprite ?? p.sprite];
    const facing = overrides[p.id]?.facing ?? p.facing ?? 'W';
    const cells = facing === 'E' ? reflectCellsEW(sprite.cells) : sprite.cells;
    const [cx, cy] = overrides[p.id]?.cell ?? p.cell;
    blit(grid, sprite, cx, cy, cells);
  }

  return { width: mapW, height: mapH, grid };
}

/**
 * Emit one frame as crisp-edges SVG: a background rect, then one
 * merged path per color with horizontal runs collapsed. Colors emit
 * in sorted order and runs in row-major order so the same frame is
 * always the same bytes.
 */
export function emitPixelSvg(recipe, t, { scale = 12 } = {}) {
  const { width, height, grid } = resolveFrame(recipe, t);
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
  const bg = recipe.background
    ? `  <rect width="${width}" height="${height}" fill="${recipe.background}"/>\n`
    : '';
  const paths = [...byColor.keys()].sort()
    .map((color) => `  <path fill="${color}" d="${byColor.get(color).join('')}"/>`)
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * scale}" height="${height * scale}" shape-rendering="crispEdges">`,
    bg + paths,
    '</svg>',
  ].join('\n');
}

/**
 * Throwaway eyeball preview: every frame of one animation cycle
 * stacked and flipped by CSS steps() — playback is presentation, the
 * frames themselves are the derived artifacts.
 */
export function emitPreviewHtml(recipe, { fps = 2, scale = 12 } = {}) {
  const cycle = Math.max(1, ...(recipe.animation?.tracks || []).map((tr) => tr.values.length));
  const frames = Array.from({ length: cycle }, (_, t) => emitPixelSvg(recipe, t, { scale }));
  const dur = cycle / fps;
  const layers = frames
    .map((svg, i) => `<div class="frame" style="animation-delay:${-((cycle - i) % cycle) / fps}s">${svg}</div>`)
    .join('\n');
  return `<!doctype html>
<style>
  body { background: #16161e; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .stack { position: relative; }
  .frame { position: absolute; inset: 0; animation: flash ${dur}s steps(1, end) infinite; }
  .frame:first-child { position: relative; }
  @keyframes flash { 0% { opacity: 1; } ${(100 / cycle).toFixed(4)}% { opacity: 0; } 100% { opacity: 0; } }
</style>
<div class="stack">
${layers}
</div>`;
}
