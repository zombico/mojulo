/**
 * THE MISSION SPIKE'S SHARED PARTS — what every segment's builder (level0.mjs, yard.mjs, hangar.mjs) does the same way:
 * read its options, stand the starter's operative and guard (gameworld/infiltration-room.js), read the ground a land
 * was laid with, and write the page. Kept in one place so a change to how a segment is made is made once.
 *
 *   options(argv)                 → { opt(key, default), has(flag), pair(key) }
 *   database(hero, guard)         sets the process's database for a stored hero or guard (MOJULO_DATA_DIR), else memory
 *   starterRoom(o, G?)            → the infiltration room laid for the options' hero, guard and clips: its figures, its
 *                                   hero and guard entities, its camera and events
 *   groundOf(payload)             → (x, y) → the land's height there (its top face under the point), or null off it
 *   writePage(payload, room, file, { capture?, theme?, events? }) → { file, mb }: the page, the hero's camera and the
 *                                   game's HUD laid on the resolved payload (a stage or geocube recipe takes no pilot)
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export function options(argv) {
  const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  return { opt, has: (k) => argv.includes(k), pair: (k) => (opt(k) ? opt(k).split(',') : null) };
}

export function database(hero, guard) {
  if (!hero && !guard) process.env.SQLITE_PATH ??= ':memory:';
  else if (process.env.MOJULO_DATA_DIR) process.env.SQLITE_PATH ??= path.join(process.env.MOJULO_DATA_DIR, 'mojulo-lite.db');
  process.env.MOJULO_SEMANTIC_INDEX_DISABLED ??= '1';
}

export async function starterRoom(o, G = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents' }) {
  const { infiltrationRoom } = await import('../../../lib/graph/gameworld/infiltration-room.js');
  const hero = o.opt('--hero'), guard = o.opt('--guard'), cr = o.pair('--crouch'), pr = o.pair('--prone');
  const room = infiltrationRoom(G, { refs: { ...(hero ? { hero } : {}), ...(guard ? { guard } : {}) }, vault: o.opt('--vault'), roll: o.opt('--roll'), climb: o.opt('--climb'),
    crouch: cr ? { idle: cr[0], walk: cr[1] } : null, prone: pr ? { idle: pr[0], crawl: pr[1] } : null });
  return { room, hero: room.manifest.entities.find((e) => e.id === 'hero'), guard: room.manifest.entities.find((e) => e.id === 'guard-1') };
}

/** The land's height under a point: the highest of its level-ish faces the point stands over (a triangle fan of each). */
export function groundOf(payload) {
  const F = (payload.faces ?? []).filter((f) => /^isekai:(ground|trail|ridge|lip|scree|grass)|^out-|^land/.test(String(f.group ?? '')) && Array.isArray(f.corners) && f.corners.length >= 3)
    .map((f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return { c: f.corners, bb: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }; });
  const tri = (a, b, c, x, y) => {
    const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) return null;
    const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d, v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d, w = 1 - u - v;
    return u < -1e-6 || v < -1e-6 || w < -1e-6 ? null : u * a[2] + v * b[2] + w * c[2];
  };
  return (x, y) => {
    let best = null;
    for (const f of F) {
      if (x < f.bb[0] || x > f.bb[2] || y < f.bb[1] || y > f.bb[3]) continue;
      for (let k = 1; k + 1 < f.c.length; k++) { const z = tri(f.c[0], f.c[k], f.c[k + 1], x, y); if (z != null && (best == null || z > best)) best = z; }
    }
    return best;
  };
}

export async function writePage(payload, room, file, { capture = false, theme = 'field-brief', events = null } = {}) {
  const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
  const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
  const { walkers: _w, ...P } = payload;
  const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: events ?? room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(theme), inline: true, ...(capture ? { capture: true } : {}) });
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
  return { file, mb: +(html.length / 1e6).toFixed(1) };
}
