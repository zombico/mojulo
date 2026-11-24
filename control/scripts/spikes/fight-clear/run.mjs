// THE FIGHT-CLEAR SPIKE: what stands between a party battle's camera and its fighters? Composes the party RPG starter,
// plays its first wilds block with a pack in headless Chromium (the bodies stood in: the occluders are the level's), walks
// the party up to the pack, and once the fight is staged casts a ray from the camera to each fighter's chest, saying what
// each crosses (its kind, its group, its size) and how many of the fighters are hidden. Writes report.json and a shot.
//   node scripts/spikes/fight-clear/run.mjs <out dir> [stage: live|arena] [view]
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const OUT = process.argv[2] ?? '.', STAGE = process.argv[3] ?? null, VIEW = process.argv[4] ?? null;
mkdirSync(OUT, { recursive: true });
const { composeGameworld, runSteps } = await import('../../../lib/graph/gameworld/index.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const W = composeGameworld({ prompt: process.env.FC_PROMPT ?? 'a jrpg where we storm the citadel to save the princess', seed: 3 });
const S = runSteps(W, { ref: 'fc' });
const lv = S.filter((s) => s.key.startsWith('level-') && s.order.manifest?.play?.rpg?.encounters?.length);
const report = { levels: [] };
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const L of lv.slice(0, Number(process.env.FC_LEVELS ?? 2))) {
  const M = structuredClone(L.order.manifest);
  if (STAGE || VIEW) M.play.rpg.rules = { ...(M.play.rpg.rules ?? {}), ...(STAGE ? { stage: STAGE } : {}), ...(VIEW ? { view: VIEW } : {}) };
  Object.entries(M.figures ?? {}).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB }; });
  for (const e of M.entities ?? []) if (/^foe-/.test(e.id) && e.rule?.collideHeight < 1.5) e.body = { ...(e.body ?? {}), scale: Math.round((e.rule.collideHeight / 1.8) * 1000) / 1000 };
  const { payload } = await resolveWorldScene({ ref: `fc_${L.key}`, title: L.key, manifest: M });
  let html = emitThreeWorld({ ...payload, inline: true, hud: false });
  // (the scene handed to the spike: the page keeps it to itself)
  html = html.replace('const scene = new THREE.Scene();', 'const scene = new THREE.Scene(); window.__fcScene = scene; window.__fcTHREE = THREE;').replace('const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000);', 'const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.1, 8000); window.__fcCam = camera;');
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojRpg && window.__fcScene, { timeout: 300000 });
  // (the whole party in: each member's flag set, as a level after the town has them)
  const PM = Array.isArray(M.play?.party) ? M.play.party : [];
  await page.evaluate((js, ids) => { const B = window.__mojBus, ev = []; for (const j of js) { B.state.vars[`flag-${j}`] = 1; ev.push({ type: `flag-carried:${j}` }); } for (const id of ids) ev.push({ type: `rpg-join:${id}` }); B.bus.processEvents(B.state, ev); }, PM.map((m) => m.joins).filter(Boolean), PM.map((m) => m.who));
  await nap(2000);
  const out = { key: L.key, fights: [] };
  for (const [n, enc] of M.play.rpg.encounters.slice(0, Number(process.env.FC_FIGHTS ?? 3)).entries()) {
    if (!enc.at) continue;
    await page.evaluate((a) => { const w = window.__mojCtrl.world, me = w.byId[w.pilotId]; me.transform.pos[0] = a[0]; me.transform.pos[1] = a[1]; me.transform.pos[2] += 2; if (me.vel) me.vel[2] = 0; }, enc.at);
    try { await page.waitForFunction(() => window.__mojRpg.state().mode === 'battle', { timeout: 30000 }); } catch { out.fights.push({ n, met: false }); continue; }
    await nap(2500);
    const seen = await page.evaluate(() => {
      const T = window.__fcTHREE, sc = window.__fcScene, w = window.__mojCtrl.world, R = window.__mojRpg.R, cp = w.camera.transform.pos;
      const meshes = []; sc.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
      const fighters = [...R.b.ids.filter((id) => w.byId[id]), ...Object.keys(w.byId).filter((k) => w.byId[k].staged && !R.b.ids.includes(k))];
      const name = (o) => { const ch = []; for (let x = o; x && ch.length < 4; x = x.parent) ch.push((x.userData && x.userData.g) || x.name || x.type); return ch.join(' < '); };
      const hits = {}, hidden = [];
      for (const id of fighters) {
        const q = w.byId[id].transform.pos, to = new T.Vector3(q[0], q[1], q[2] + 1.1), from = new T.Vector3(cp[0], cp[1], cp[2]), d = to.clone().sub(from), L = d.length();
        const rc = new T.Raycaster(from, d.normalize(), 0.05, L - 0.9);
        const xs = rc.intersectObjects(meshes, false);
        if (xs.length) hidden.push(id);
        for (const x of xs) { const k = name(x.object); const bs = x.object.geometry.boundingSphere || (x.object.geometry.computeBoundingSphere(), x.object.geometry.boundingSphere);
          hits[k] = hits[k] || { n: 0, kind: x.object.isInstancedMesh ? 'instanced' : 'mesh', material: x.object.material && x.object.material.type, r: Math.round(bs.radius * 10) / 10, at: Math.round(x.distance * 10) / 10 }; hits[k].n++; }
      }
      // THE FRAME: a grid of rays through the screen; a cell is covered where something not the land stands nearer than
      // the fight's nearest fighter less 1.5 m (the fighters themselves stand at the fight)
      const C = window.__fcCam, LAND = /(ground|trail|cliff|core|ridge|cloud|terrain|land|water|sky|road|floor|path)$/;
      const near = Math.min(...fighters.map((id) => { const q = w.byId[id].transform.pos; return Math.hypot(q[0] - cp[0], q[1] - cp[1], q[2] + 1 - cp[2]); })) - 1.5;
      const GX = 32, GY = 18, rc2 = new T.Raycaster(), cover = {};
      let covered = 0;
      for (let i = 0; i < GX; i++) for (let j = 0; j < GY; j++) {
        rc2.setFromCamera(new T.Vector2(((i + 0.5) / GX) * 2 - 1, ((j + 0.5) / GY) * 2 - 1), C); rc2.far = near;
        // (a hit inside the fight's clearing is discarded by the page's shader: not seen)
        const CB = (window.__mojClip && window.__mojClip.boxes) || [], cut = (p) => CB.some((b) => { const dx = p.x - b.c[0], dy = p.y - b.c[1], a = dx * b.u[0] + dy * b.u[1], c = -dx * b.u[1] + dy * b.u[0]; return Math.abs(a) < b.half[0] && Math.abs(c) < b.half[1] && p.z > b.z[0] && p.z < b.z[1]; });
        const xs = rc2.intersectObjects(meshes, false).filter((h) => !(cut(h.point) && !LAND.test((h.object.userData && h.object.userData.g) || ''))), x = xs.find((h) => !LAND.test((h.object.userData && h.object.userData.g) || ''));
        if (x) { covered++; const k = name(x.object); cover[k] = (cover[k] || 0) + 1; }
        if (xs[0] && !x) { const k = 'land:' + name(xs[0].object); cover[k] = (cover[k] || 0) + 1; }
      }
      const top = Object.entries(cover).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => `${k} ${Math.round((100 * n) / (GX * GY))}%`);
      const FF = window.__formFlora ? window.__formFlora() : null;
      return { cam: cp.map((v) => Math.round(v * 10) / 10), fighters: fighters.length, hidden, hits, near: Math.round(near * 10) / 10, covered: Math.round((100 * covered) / (GX * GY)), top, boxes: (window.__mojClip && window.__mojClip.boxes || []).length, plantsLeftOut: FF ? FF.taken : null };
    });
    out.fights.push({ n, met: true, ...seen });
    await page.screenshot({ path: `${OUT}/${L.key}-${n}.png` });
    // (the fight left: fled, and the pilot moved off)
    await page.evaluate(() => { const R = window.__mojRpg.R; if (R.b) { R.b.foes.forEach((f) => { f.hp = 0; }); } });
    await nap(3000);
  }
  report.levels.push(out); await page.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close(); process.exit(0);
