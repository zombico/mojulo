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
 *   writePage(payload, room, file, { capture?, theme?, events? }) → { file, mb }: the page (filling its window: the
 *       game's screen, a monitor's, where the payload names none), the hero's camera and the
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

/** A box as the static world's faces (its five seen sides, its bottom left out), one colour, under a group the page
 *  draws as one with the rest of the static world: cheap, and ground a body stands on. */
export function boxFaces(mn, mx, fill, group) {
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx, f = (corners, n) => ({ corners, fill, cornerFills: corners.map(() => fill), normal: n, outNormal: n, group });
  return [
    f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]),
    f([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]),
    f([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0]),
    f([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]),
    f([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]),
  ];
}

// (a frame-time readout in a corner, the spike's own: what the person reports when a page is slow)
const FPS = `<script>(function(){var d=document.createElement('div');d.style.cssText='position:fixed;left:8px;bottom:8px;z-index:50;font:600 12px ui-monospace,monospace;color:#cfe;background:rgba(0,0,0,.45);padding:3px 6px;pointer-events:none';document.body.appendChild(d);var n=0,t0=performance.now(),w=0;(function f(t){requestAnimationFrame(f);n++;var dt=t-t0;if(dt>=1000){var fps=n*1000/dt,B=window.__mojBudget;var C=window.__mojCost;d.textContent=Math.round(fps)+' fps · '+(1000/fps).toFixed(1)+' ms'+(C?' · logic '+C.logic.toFixed(1)+' (rays '+C.rays.toFixed(1)+') · draw '+C.render.toFixed(1):'')+(B?' · dpr '+B.dpr:'');n=0;t0=t;}})(t0);})();</script>`;

export async function writePage(payload, room, file, { capture = false, theme = 'field-brief', events = null } = {}) {
  const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
  const { levelHud } = await import('../../../lib/graph/game/hud-mana.js');
  const { walkers: _w, ...P0 } = payload;
  // (a level is played on the window it is given: the game's screen, a monitor's 16:9 grown wider before it bars,
  // game/screen.js; a payload that names its own keeps it)
  const { readScreen, screenPayload, screenFrame } = await import('../../../lib/graph/game/screen.js');
  const P = P0.screen ? P0 : { ...P0, screen: screenPayload(readScreen('screen')), viewBox: screenFrame(readScreen('screen'), 1120) };
  const html = emitThreeWorld({ ...P, camera: room.manifest.camera, events: events ?? room.manifest.events, walk: false, spin: false, hud: false, manaHud: levelHud(theme), inline: true, ...(capture ? { capture: true } : {}) });
  await fs.mkdir(path.dirname(file), { recursive: true });
  // (the World page's orbit hint is a viewer's, not a game's: a played level hides it)
  const NOHINT = '<style>#wrap>.hint{display:none}</style>';
  const out = html.includes('</body>') ? html.replace('</body>', NOHINT + FPS + '</body>') : html + NOHINT + FPS;
  await fs.writeFile(file, out);
  return { file, mb: +(out.length / 1e6).toFixed(1) };
}
