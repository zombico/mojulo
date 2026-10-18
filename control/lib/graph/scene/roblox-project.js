/**
 * THE ROBLOX PLACE, as a Rojo project (rojo.space): pure text from a game's levels. Rojo builds it into a place file
 * (`rojo build default.project.json -o game.rbxl`) or serves it live into Studio. The tree:
 *
 *   ReplicatedStorage.MojuloKernel    the Roblox kernel (lib/graph/scene/roblox-kernel), each module a ModuleScript
 *   ServerScriptService.MojuloServer  the presenter (roblox-place/): plays the levels, one player driving
 *   StarterPlayer…MojuloClient        the player's keys to the bus, the level's words on screen
 *   ServerStorage.Mojulo              manifest (the level list, the store), Levels/<ref>/data (the level's own data, its
 *                                     bus.json and contract.json as the exact JSON text the kernel decodes) and
 *                                     Levels/<ref>/Greybox (Parts: what the level stands on and walls it in, and its
 *                                     Look: the rest of the level voxelized, decoration only, roblox-look.js)
 *
 * The GREYBOX is what a Humanoid collides with: every upward face of the level's mesh rastered onto a grid of cells
 * (CELL metres, heights in LAYER steps) and merged into slabs, plus each of the score's box colliders as a wall. With a
 * look (roblox-look.js) the slabs wear their faces' colours and materials, the walls are unseen (the page draws no
 * collider) and the voxelized rest rides inside as `Look`. The mesh rides beside the project as model.glb (Studio's 3D
 * Importer); the place itself carries no mesh.
 *
 * Frames: the recipe is z-up in metres; Roblox is y-up in studs (STUDS a metre): (X, Y, Z) = (x, z, -y) × STUDS.
 *
 *   STUDS, CELL, LAYER
 *   toStuds([x, y, z])                       → [X, Y, Z]
 *   floorSlabs(faces, { mpu, cell })         → [{ min, max }] in metres
 *   greyboxModel({ faces, colliders, mpu })  → the .model.json object (a Model of anchored Parts), and its counts
 *   luaString(text)                          → a Luau long-bracket literal that holds text byte for byte
 *   levelData(score)                         → what the presenter reads of a level's score (recipe units)
 *   emitRobloxGame({ ref, title, manifest, levels, portability, remint }) → { files: [{ file, text }] }
 *
 * Deterministic: integer cells, sorted keys, no clock.
 */

export const STUDS = 1 / 0.28;
export const CELL = 0.5;
export const LAYER = 0.1;
const SLAB = 0.2;          // a floor slab's depth below its surface, metres
const NEAR = 0.3;          // metres: how far a blend tile lies from the ground it colours
const UP = 0.6;            // a face counts as floor when its normal's z is at least this
const MAX_PARTS = 8000;    // above it, the floor grid coarsens (a vast terrain reads in bigger cells)
const MAX_CELLS = 4e6;     // the floor grid starts no finer than this many cells over the floors' area
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;   // + 0: never a -0

export const toStuds = (p) => [r4(p[0] * STUDS), r4(p[2] * STUDS), r4(-p[1] * STUDS)];

/** Every upward face, rastered: the cells whose centre it covers (and the cell of its centroid) at its height there,
 * quantized to LAYER; each height's cells merged into rectangles (runs along x, then equal runs down y). With `lookOf`
 * (face → { color, material, transparency? }: roblox-look.js faceLook) a cell takes the look of the first face to mark it
 * at that height, a blend tile's over the ground it lies on (within NEAR) where the tile shows (its corner alpha there at
 * least a half: the page draws the blend on top, faded per corner, so a meadow's grass over its soil and the path's soil
 * through it; a ground's shadow decal never shows), and a faded tile's own cells the ground's look beneath; a face too
 * small to cover a cell's centre colours it only where no face covering it lies within NEAR (a lane's dash on its
 * road); a run then
 * breaks where the look changes, so the slabs cover the same cells at the same heights, in more rectangles. */
export function floorSlabs(faces = [], { mpu = 1, cell = CELL, lookOf = null } = {}) {
  const layers = new Map();   // q → Set('ix,iy')
  const looks = new Map();    // look key → look
  const cellLook = new Map(); // 'q:ix,iy' → look key, the first ground face's at that height
  const tiles = new Map();    // 'ix,iy' → [[z, look key, shows]] the blend tiles over that cell, in face order
  let look = null, lk = '', blend = false;
  const small = new Map();    // 'q:ix,iy' → look key of the first face too small to cover the cell's centre there
  const mark = (ix, iy, z, shows = true, weak = false) => {
    const q = Math.round(z / LAYER), c = `${q}:${ix},${iy}`;
    (layers.get(q) || layers.set(q, new Set()).get(q)).add(`${ix},${iy}`);
    if (!lookOf) return;
    if (blend) (tiles.get(`${ix},${iy}`) || tiles.set(`${ix},${iy}`, []).get(`${ix},${iy}`)).push([z, lk, shows]);
    else if (weak) { if (!small.has(c)) small.set(c, lk); }
    else if (!cellLook.has(c)) cellLook.set(c, lk);
  };
  // a cell's look: the first blend tile lying within NEAR of it where the tile shows, else the ground's there (at its
  // height, or the nearest within NEAR: a tile floats a hair over its ground and may round to the next layer), a face
  // covering the cell's centre before one only standing in it (a lane's dash marks its cell, the road colours it)
  const near = (m, q, ix, iy) => {
    let g = m.get(`${q}:${ix},${iy}`);
    for (let d = 1; g === undefined && d <= Math.round(NEAR / LAYER); d++) g = m.get(`${q - d}:${ix},${iy}`) ?? m.get(`${q + d}:${ix},${iy}`);
    return g;
  };
  const lookAt = (q, ix, iy) => {
    const z = q * LAYER, t = (tiles.get(`${ix},${iy}`) || []).find((e) => Math.abs(e[0] - z) <= NEAR);
    if (t && t[2]) return t[1];
    return near(cellLook, q, ix, iy) ?? near(small, q, ix, iy) ?? (t ? t[1] : undefined);
  };
  for (const f of faces) {
    const c = f && Array.isArray(f.corners) ? f.corners : null;
    if (!c || c.length < 3) continue;
    if (lookOf) { look = lookOf(f); lk = `${look.color.join(',')}|${look.material}|${look.transparency ?? ''}`; blend = !!f.blend || !!f.decal; if (!looks.has(lk)) looks.set(lk, look); }
    for (let i = 1; i + 1 < c.length; i++) {
      const t = [c[0], c[i], c[i + 1]];
      if (!t.every((p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite))) continue;
      const [a, b, d] = t.map((p) => [p[0] * mpu, p[1] * mpu, p[2] * mpu]);
      // a blend tile's fade at this triangle's corners (the page's per-corner alpha), else opaque; a decal never shows
      const al = f.decal ? [0, 0, 0] : blend && Array.isArray(f.cornerAlpha) && f.cornerAlpha.length === c.length ? [f.cornerAlpha[0], f.cornerAlpha[i], f.cornerAlpha[i + 1]].map((x) => (Number.isFinite(x) ? x : 1)) : [1, 1, 1];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = Math.hypot(nx, ny, nz);
      if (!(n > 1e-12) || Math.abs(nz) / n < UP) continue;   // either winding: a floor faces up or down the same
      const det = (b[1] - d[1]) * (a[0] - d[0]) + (d[0] - b[0]) * (a[1] - d[1]);
      if (Math.abs(det) < 1e-12) continue;
      // the height over (x, y) and the tile's alpha there, or null outside the triangle
      const at = (x, y) => {
        const u = ((b[1] - d[1]) * (x - d[0]) + (d[0] - b[0]) * (y - d[1])) / det;
        const v = ((d[1] - a[1]) * (x - d[0]) + (a[0] - d[0]) * (y - d[1])) / det;
        const w = 1 - u - v;
        return u < -1e-9 || v < -1e-9 || w < -1e-9 ? null : [u * a[2] + v * b[2] + w * d[2], u * al[0] + v * al[1] + w * al[2]];
      };
      const x0 = Math.floor(Math.min(a[0], b[0], d[0]) / cell), x1 = Math.floor(Math.max(a[0], b[0], d[0]) / cell);
      const y0 = Math.floor(Math.min(a[1], b[1], d[1]) / cell), y1 = Math.floor(Math.max(a[1], b[1], d[1]) / cell);
      let hit = false;
      for (let ix = x0; ix <= x1; ix++) {
        for (let iy = y0; iy <= y1; iy++) {
          const h = at((ix + 0.5) * cell, (iy + 0.5) * cell);
          if (h != null) { mark(ix, iy, h[0], h[1] >= 0.5); hit = true; }
        }
      }
      // a face smaller than a cell still stands somewhere: its centroid's cell
      if (!hit) mark(Math.floor((a[0] + b[0] + d[0]) / 3 / cell), Math.floor((a[1] + b[1] + d[1]) / 3 / cell), (a[2] + b[2] + d[2]) / 3, (al[0] + al[1] + al[2]) / 3 >= 0.5, true);
    }
  }
  const slabs = [];
  for (const q of [...layers.keys()].sort((x, y) => x - y)) {
    const cells = layers.get(q);
    const rows = new Map();   // iy → sorted ix
    for (const k of cells) { const [ix, iy] = k.split(',').map(Number); (rows.get(iy) || rows.set(iy, []).get(iy)).push(ix); }
    const open = new Map();   // 'x0,x1,look' → { x0, x1, y0, y1, k } the run still growing down y
    const close = (r) => slabs.push({ min: [r.x0 * cell, r.y0 * cell, q * LAYER - SLAB], max: [(r.x1 + 1) * cell, (r.y1 + 1) * cell, q * LAYER], ...(lookOf ? { look: looks.get(r.k) } : {}) });
    let prev = null;
    for (const iy of [...rows.keys()].sort((x, y) => x - y)) {
      const xs = rows.get(iy).sort((x, y) => x - y), runs = [];
      // a run: neighbouring cells of one look (without a look, of one height only)
      const lk = lookOf ? xs.map((ix) => lookAt(q, ix, iy)) : null;
      for (let i = 0; i < xs.length; i++) { let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1 && (!lk || lk[j + 1] === lk[i])) j++; runs.push([xs[i], xs[j], lk ? lk[i] : '']); i = j; }
      const next = new Map();
      for (const [x0, x1, k] of runs) {
        const key = `${x0},${x1},${k}`, r = prev === iy - 1 ? open.get(key) : null;
        if (r) { r.y1 = iy; open.delete(key); next.set(key, r); } else next.set(key, { x0, x1, y0: iy, y1: iy, k });
      }
      for (const r of open.values()) close(r);
      open.clear();
      for (const [k, r] of next) open.set(k, r);
      prev = iy;
    }
    for (const r of open.values()) close(r);
  }
  return slabs;
}

/** The upward faces' area seen from above, square metres (overlapping floors each counted). */
function floorArea(faces, mpu) {
  let a = 0;
  for (const f of faces) {
    const c = f && Array.isArray(f.corners) ? f.corners : null;
    if (!c || c.length < 3) continue;
    for (let i = 1; i + 1 < c.length; i++) {
      const t = [c[0], c[i], c[i + 1]];
      if (!t.every((p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite))) continue;
      const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2], vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = Math.hypot(nx, ny, nz);
      if (n > 1e-12 && Math.abs(nz) / n >= UP) a += Math.abs(nz) / 2 * mpu * mpu;
    }
  }
  return a;
}

const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export function partOf(name, min, max, color, extra = {}) {
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  // a box's extent along each Roblox axis: X from x, Y from z, Z from y (a size has no sign)
  const size = [max[0] - min[0], max[2] - min[2], max[1] - min[1]].map((s) => r4(Math.max(s, 0.01) * STUDS));
  return {
    Name: name, ClassName: 'Part',
    Properties: {
      Anchored: true, Size: size, CFrame: { CFrame: { position: toStuds(c), orientation: IDENTITY } },
      Color: color, Material: 'SmoothPlastic', TopSurface: 'Smooth', BottomSurface: 'Smooth', ...extra,
    },
  };
}
const FLOOR = [0.64, 0.66, 0.7], WALL = [0.42, 0.45, 0.52];

/** The level's greybox: floor slabs (coarsened until they fit MAX_PARTS) and the score's colliders as walls. With
 * `lookOf` the slabs wear their faces' looks; with `look` (roblox-look.js lookModel) the walls are the physics only,
 * unseen as on the page, and the look's decoration rides in the Model as its `Look` child. */
export function greyboxModel({ faces = [], colliders = [], mpu = 1, lookOf = null, look = null }) {
  const walls = colliders.filter((c) => c && Array.isArray(c.min) && Array.isArray(c.max) && c.min.length === 3 && c.max.length === 3);
  // the grid coarsens on the physics alone (the slabs merged by height), so a look never changes where the player stands;
  // it starts no finer than MAX_CELLS cells over the floors' area (a road kilometres long would overflow a fine grid)
  let cell = CELL;
  const area = floorArea(faces, mpu);
  while (area / (cell * cell) > MAX_CELLS && cell < 8) cell *= 2;
  while (floorSlabs(faces, { mpu, cell }).length + walls.length > MAX_PARTS && cell < 8) cell *= 2;
  const floors = floorSlabs(faces, { mpu, cell, lookOf });
  const lookProps = (l) => (l ? { Material: l.material, ...(l.transparency ? { Transparency: l.transparency } : {}) } : {});
  const children = [
    ...floors.map((s, i) => partOf(`floor-${i}`, s.min, s.max, s.look ? s.look.color : FLOOR, lookProps(s.look))),
    ...walls.map((w, i) => partOf(typeof w.of === 'string' && w.of ? `wall-${i}-${w.of}` : `wall-${i}`, w.min, w.max, WALL, look ? { Transparency: 1 } : {})),
    ...(look ? [look.model] : []),
  ];
  return { model: { ClassName: 'Model', Children: children }, floors: floors.length, walls: walls.length, cell, ...(look ? { look: look.boxes, voxel: look.voxel, ...(look.repeatVoxel ? { repeatVoxel: look.repeatVoxel } : {}) } : {}) };
}

/** A Luau long-bracket string holding text exactly (the level of `=` chosen so the closer never occurs in it). */
export function luaString(text) {
  let n = 0;
  while (text.includes(`]${'='.repeat(n)}]`)) n++;
  const eq = '='.repeat(n);
  // a long string drops a newline right after its opener: JSON never starts with one, but text might
  return `[${eq}[${text.startsWith('\n') ? '\n' : ''}${text}]${eq}]`;
}

/** What the presenter reads of a level's score: the pilot (its rule and seat in recipe units), the camera rule, the
 * other bodies where they stand (recipe units: the score's metres over metersPerUnit), the HUD's rows. */
export function levelData(score) {
  const mpu = Number(score.metersPerUnit) > 0 ? Number(score.metersPerUnit) : 1;
  return {
    ref: score.ref, title: score.title ?? score.ref, metersPerUnit: mpu,
    ...(score.pilot ? { pilot: score.pilot } : {}),
    ...(score.camera ? { camera: score.camera } : {}),
    ...(Array.isArray(score.hud) && score.hud.length ? { hud: score.hud } : {}),
    entities: (score.entities || []).filter((e) => e && typeof e.id === 'string' && Array.isArray(e.translation))
      .map((e) => ({ id: e.id, pos: e.translation.map((v) => r4(v / mpu)) })),
  };
}

const project = (ref) => ({
  name: ref,
  tree: {
    $className: 'DataModel',
    ReplicatedStorage: { MojuloKernel: { $path: 'src/kernel' } },
    ServerScriptService: { MojuloServer: { $path: 'src/server/MojuloServer.server.luau' } },
    StarterPlayer: { StarterPlayerScripts: { MojuloClient: { $path: 'src/client/MojuloClient.client.luau' } } },
    ServerStorage: { Mojulo: { $path: 'src/data' } },
  },
});

function readme({ ref, title, levels, portability, remint }) {
  const lost = (portability?.flags || []).map((f) => `- ${f}`);
  return [
    `# ${title} — a Roblox place (Rojo project)`,
    '',
    `Exported by mojulo from the game \`${ref}\`. The recipes under \`recipe/\` are the source: \`${remint}\` makes this folder again.`,
    '',
    '## Build and play',
    '',
    '```sh',
    'rojo build default.project.json -o game.rbxl   # then open game.rbxl in Roblox Studio and press Play',
    'rojo serve                                     # or sync live into an open place (the Rojo Studio plugin)',
    '```',
    '',
    'Set the place\'s **Max Players to 1** in Game Settings: the bus keeps one player\'s state, and a script cannot set the',
    'server size. Only the first player to join drives the level.',
    '',
    '## What is in the place',
    '',
    '- `ReplicatedStorage.MojuloKernel`: the mojulo runtime\'s bus, stats, store and game channel ported to Luau and held equal',
    '  to the web runtime by the conformance corpora. Not yours to edit: an export writes it again.',
    '- `ServerScriptService.MojuloServer`: plays the levels in order; a Roblox Humanoid walks the player (the web\'s walk feel',
    '  is not ported, so a level is equal in what it does with where the player stands, not in how the player moves).',
    '- `ServerStorage.Mojulo.Levels.<ref>.Greybox`: what the level stands on (its mesh\'s upward faces as slabs, in their colours',
    '  and materials) and its walls (unseen, as on the web); its `Look` is the rest of the level voxelized into coloured boxes,',
    '  decoration only (nothing collides with it or meets it with a ray). Built from the recipe: nothing is uploaded.',
    '  The mesh itself is `levels/<ref>/model.glb`, beside the project, for Studio\'s 3D Importer; the place carries no mesh.',
    '- The cast stands as block figures (a mind in red, the rest in blue); their meshes and clips do not travel.',
    '',
    `## Levels (${levels.length})`,
    '',
    ...levels.map((l) => `- \`${l.ref}\` — ${l.title}: ${l.floors} floor slabs, ${l.walls} walls (cells of ${l.cell} m)${l.look != null ? `, ${l.look} look boxes (voxels of ${l.voxel} m${l.repeatVoxel ? `, its repeats' of ${l.repeatVoxel} m` : ''})` : ''}`),
    '',
    '## What did not travel',
    '',
    ...(lost.length ? lost : ['- nothing the portability report names']),
    '',
    'The whole reading is `portability.json`.',
    '',
  ].join('\n');
}

/**
 * The project's own text (the kernel and presenter files are copied beside it by the pack). `levels`: [{ ref, title,
 * gate, data, bus, contract, greybox }] — data from levelData, bus and contract the JSON documents (or null), greybox
 * from greyboxModel.
 */
export function emitRobloxGame({ ref, title, manifest, levels, portability, remint }) {
  const list = { title, levels: levels.map((l) => ({ ref: l.ref, title: l.title, ...(l.gate ? { gate: l.gate } : {}) })), ...(manifest?.store ? { store: manifest.store } : {}) };
  const files = [
    { file: 'default.project.json', text: `${JSON.stringify(project(ref), null, 2)}\n` },
    { file: 'src/data/manifest.luau', text: `-- the game's level list and store schema (JSON, decoded by the kernel)\nreturn ${luaString(JSON.stringify(list))}\n` },
  ];
  for (const l of levels) {
    const rows = [`\tlevel = ${luaString(JSON.stringify(l.data))},`];
    if (l.bus) rows.push(`\tbus = ${luaString(JSON.stringify(l.bus))},`);
    if (l.contract) rows.push(`\tcontract = ${luaString(JSON.stringify(l.contract))},`);
    files.push({ file: `src/data/Levels/${l.ref}/data.luau`, text: `-- the level's data as JSON text, decoded by the kernel (kernel/json.luau keeps what JSON.parse keeps)\nreturn {\n${rows.join('\n')}\n}\n` });
    files.push({ file: `src/data/Levels/${l.ref}/Greybox.model.json`, text: `${JSON.stringify(l.greybox.model)}\n` });
  }
  files.push({ file: 'README.md', text: readme({ ref, title, levels: levels.map((l) => ({ ref: l.ref, title: l.title, floors: l.greybox.floors, walls: l.greybox.walls, cell: l.greybox.cell, look: l.greybox.look, voxel: l.greybox.voxel, repeatVoxel: l.greybox.repeatVoxel })), portability, remint }) });
  return { files };
}
