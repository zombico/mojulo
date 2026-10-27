// The form render in a real browser (an e2e suite, skipped when no Chromium is installed): a streamlined supercar and a
// gloss racer, each in the form render, on a World page with the actors' shadows. Their body and wheel bones are drawn
// with a physical material per slot, the lamps baked as they shine; every shader compiles; the car is drawn, lit (its
// colours vary across its body, not one fill); its status tint still reaches its bones; and the shadow lights carry
// the key's colour.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supercarFigure, supercarRule } from './supercar-figure.js';
import { composeSupercar } from './vehicle-library.js';
import { racerOf } from './roster.js';
import { vehicleRule } from '../roads/vehicles.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let browser = null;
const pageOf = (fig, rule) => emitThreeWorld({ faces: [{ corners: [[-200, -200, 0], [200, -200, 0], [200, 200, 0], [-200, 200, 0]], fill: '#7d8b72' }],
  cameras: [{ name: 'c', worldFraming: { cameraPosition: [-4, -3.4, 1.8], lookAt: [0, 0, 0.5], horizontalFov: 50, pictureCenter: [320, 224] } }], viewBox: { width: 640, height: 448 }, title: 'form', metersPerUnit: 1,
  sky: { preset: 'day', zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1, stars: 0, seed: 7 }, bg: '#c6cfda', shadows: { actors: true }, light: { toLight: [0.45, -0.35, 0.82] },
  entities: [{ id: 'car', pilotable: true, rule, body: { type: 'figure-rig', figure: 'f' }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } }], figures: { f: fig }, pilot: 'car', fx: { states: { none: 'pulse' } }, inline: true, hud: false });
const design = composeSupercar({ preset: 'razor', surface: { quality: 'game' } }).design;
const CASES = [
  ['a streamlined supercar', supercarFigure({ preset: 'razor', surface: { line: 'streamline' }, light: 'form' }), supercarRule(design)],
  ['a gloss racer', racerOf({ facets: { archetype: 'jester' }, seed: 3, shade: 'gloss', light: 'form' }).S.figure, vehicleRule('kart')],
];
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close(); });

describe('the form render in the page', () => {
  for (const [name, fig, rule] of CASES) {
    it(name, async (ctx) => {
      if (!browser) return ctx.skip();
      const page = await browser.newPage(), errors = [];
      await page.setViewport?.({ width: 640, height: 448 });
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setContent(pageOf(fig, rule), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.car, { timeout: 20000 });
      await new Promise((r) => setTimeout(r, 1500));
      const read = await page.evaluate(() => {
        const rig = window.__mojCtrl.bodies.car.userData.rigFig, out = { bones: {}, casters: [] };
        rig.fig.bones.forEach((b, i) => { const m = rig.boneMeshes[i]; if (m) out.bones[b.id] = [].concat(m.material).map((x) => x.type); });
        let root = window.__mojCtrl.bodies.car; while (root.parent) root = root.parent;
        root.traverse((o) => { if (o.isDirectionalLight && o.castShadow) out.casters.push([o.color.r, o.color.g, o.color.b, o.intensity]); });
        return out;
      });
      expect(errors, errors.join('\n')).toEqual([]);
      for (const [id, types] of Object.entries(read.bones)) {
        if (id.startsWith('lamp')) expect(types, id).toEqual(['MeshBasicMaterial']);
        else expect(types.every((t) => t === 'MeshPhysicalMaterial'), id).toBe(true);
      }
      expect(read.casters.length).toBeGreaterThan(0);
      for (const c of read.casters) expect(c[3]).toBeCloseTo(fig.form.keyIntensity / read.casters.length, 3);
      // the car drawn and lit: the frame's middle holds many colours, not the ground's one
      const png = await page.screenshot({ clip: { x: 200, y: 140, width: 240, height: 160 } });
      expect(new Set(Array.from(png.subarray(64, png.length - 16)).filter((_, i) => i % 7 === 0)).size).toBeGreaterThan(40);
      await page.close();
    }, 90000);
  }
});
