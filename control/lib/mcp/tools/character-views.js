/**
 * The compare step of a character made from a picture: the hero drawn back to the agent, beside the picture it read.
 *
 * capture_reference target 'character' and update_character on a hero carrying a `reference` stamp answer with the
 * hero drawn at the picture's view (and from the back, when the read says the picture did not show it), one image
 * block per view after the body, so the agent sets its render beside the picture and moves one word. The views come
 * from the read filed in the stamp's stash (its `view` and `unseen`).
 *
 * Drawn on the hero's World page by a browser ALREADY on this machine (withoutChromiumFetch: never downloaded for
 * this, and the Claude plugin profile forbids the fetch anyway). Without one, the answer says so and gives the World
 * page's url: the eyes gate is then the person's, at the page. A drawing that fails never fails the call.
 *
 * The cameras orbit the hero's own front camera (the World payload's `cameras[0]`, named 'front') about its vertical
 * axis through the look-at point, so every view keeps the front's distance, height and lens.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { withoutChromiumFetch } from '@/lib/graph/scene/chromium-consent';

/** degrees turned about the hero from its front camera */
export const VIEW_TURNS = Object.freeze({ front: 0, 'three-quarter': 35, side: 90, back: 180 });
const VIEW_CELL = Object.freeze({ width: 360, height: 480 });
const MAX_VIEWS = 3;

/** The views to draw for a read: its view (a turnaround is front, side and back), and the back when it was unseen. */
export function viewsForRead({ view, unseen } = {}) {
  const views = view === 'turnaround' ? ['front', 'side', 'back'] : [VIEW_TURNS[view] !== undefined ? view : 'front'];
  if ((unseen || []).some((u) => /\bback\b/i.test(u)) && !views.includes('back')) views.push('back');
  return views.slice(0, MAX_VIEWS);
}

/** The capture specs for the views: the front camera turned about the vertical axis through its look-at. Pure. */
export function viewSpecs(payload, views, { width = VIEW_CELL.width, height = VIEW_CELL.height } = {}) {
  const wf = payload?.cameras?.find((c) => c?.name === 'front')?.worldFraming ?? payload?.cameras?.[0]?.worldFraming;
  if (!wf || !Array.isArray(wf.cameraPosition) || !Array.isArray(wf.lookAt)) throw new Error('the hero\'s World page has no front camera to turn');
  const [tx, ty, tz] = wf.lookAt, [dx, dy, dz] = [wf.cameraPosition[0] - tx, wf.cameraPosition[1] - ty, wf.cameraPosition[2] - tz];
  const hfov = wf.horizontalFov ?? 38, aspect = width / height;
  const vfov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI;
  return views.map((v) => {
    const a = (VIEW_TURNS[v] * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return { view: v, spec: { pos: [tx + dx * c - dy * s, ty + dx * s + dy * c, tz + dz], target: [tx, ty, tz], vfov, t: 0 } };
  });
}

/** The views drawn on the hero's World page, one PNG each, in one browser. Heavy imports deferred to the call. */
async function renderViews(row, views) {
  const [{ resolveWorldScene }, { emitThreeWorld }, { renderWorldFrames }] = await Promise.all([
    import('@/lib/graph/worlds/world-scene'),
    import('@/lib/graph/scene/scene-three'),
    import('@/lib/motion/world-frames'),
  ]);
  const { payload } = await resolveWorldScene(row);
  if (!payload) throw new Error('the hero has no World page to draw');
  const shots = viewSpecs(payload, views);
  const html = emitThreeWorld({ ...payload, inline: true, capture: true, walk: false, hud: false });
  const { pngs } = await renderWorldFrames(html, shots.map((s) => s.spec), { width: VIEW_CELL.width, height: VIEW_CELL.height });
  return shots.map((s, i) => ({ view: s.view, png: pngs[i] }));
}

/** Draw a hero's views, or say why not. `render` is the drawing (a test passes its own). */
export async function drawCharacterViews(ref, views, { render = renderViews } = {}) {
  const row = SketchRepository.getByRef(ref);
  const page = `/api/sketches/${encodeURIComponent(ref)}/world`;
  if (!row) return { drawn: false, why: `no sketch '${ref}'`, world_url: page };
  try {
    const shots = await withoutChromiumFetch(() => render(row, views));
    return { drawn: true, views: shots.map((s) => s.view), shots, world_url: page };
  } catch (err) {
    return { drawn: false, views, why: `not drawn: ${err?.message || err}. No browser is fetched for this; open the World page to compare it with the picture.`, world_url: page };
  }
}

/** A tool body with the drawn views after it, as MCP content (one image block per view, in `views.drawn`'s order). */
export function withDrawnViews(body, drawn) {
  const views = drawn.drawn
    ? { drawn: drawn.views, order: 'one image after this text per view, in this order', world_url: drawn.world_url, compare: 'Set each beside the picture: the silhouette and the read at a normal distance, then move one word.' }
    : { drawn: false, why: drawn.why, world_url: drawn.world_url };
  if (!drawn.drawn) return { ...body, views };
  return { content: [{ type: 'text', text: JSON.stringify({ ...body, views }, null, 2) }, ...drawn.shots.map((s) => ({ type: 'image', data: s.png.toString('base64'), mimeType: 'image/png' }))] };
}

/** The views a referenced hero is drawn at: its stash's last character read, else the front. */
export function referenceViews(hero) {
  const stash = hero?.reference?.stash;
  const full = stash ? StashRepository.getFull(stash) : null;
  const last = (full?.items || []).filter((it) => it.metadata?.reference_target === 'character').at(-1);
  return viewsForRead(last?.metadata?.insights ?? {});
}

/** capture_reference, answered with the drawn views when it made a character. Other targets as they were. */
export function withCaptureViews(handler, opts) {
  return async (input, ctx) => {
    const out = await handler(input, ctx);
    if (!out || out.target !== 'character' || !out.ref) return out;
    return withDrawnViews(out, await drawCharacterViews(out.ref, viewsForRead(input?.insights), opts));
  };
}

/** update_character, answered with the drawn views when the hero carries a `reference` stamp. Others as they were. */
export function withReferenceViews(handler, opts) {
  return async (input, ctx) => {
    const out = await handler(input, ctx);
    const hero = out?.ref ? SketchRepository.getByRef(out.ref)?.manifest?.hero : null;
    if (!hero?.reference) return out;
    return withDrawnViews(out, await drawCharacterViews(out.ref, referenceViews(hero), opts));
  };
}
