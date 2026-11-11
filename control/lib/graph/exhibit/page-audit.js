/**
 * THE EXHIBIT AUDIT'S PAGE HALF: every stop framed. A toured page is opened in a browser and seated on each stop in turn
 * (no easing); the page's own probe (window.__mojTour.view(), scene/channels/tour.js) says where the stop's lit parts
 * land: how much of their box is on screen above the plate (`onScreen`) and how much of that room they fill (`share`).
 * A stop whose parts are mostly off screen, behind the camera, or a speck is reported. A stop that lights nothing is not
 * measured. Machine gate: it advises and stamps; the eyes gate is the operator's.
 *
 * The browser is handed in as `evaluate(fn, arg)` (puppeteer's page.evaluate), so the gate is tested with a stub;
 * scripts/exhibit-audit.mjs drives a real Chrome.
 */

export const FRAMED = Object.freeze({ onScreen: 0.85, share: 0.02 });

/** Seat each stop and read its view: { stops: [{ at, id, onScreen, share, framed }], findings, gate: 'machine' }. */
export async function auditStops(evaluate, { settle = async () => {} } = {}) {
  const count = await evaluate(() => (window.__mojTour ? window.__mojTour.count : 0));
  if (!count) return { gate: 'machine', ran: ['framing'], stops: [], findings: [{ level: 'warn', code: 'no-tour', says: 'the page carries no tour to walk' }] };
  const stops = [], findings = [];
  for (let i = 0; i < count; i++) {
    await evaluate((k) => window.__mojTour.go(k, true), i);
    await settle();
    const v = await evaluate(() => window.__mojTour.view());
    if (v.framed === null) { stops.push({ at: i, id: v.id, framed: null }); continue; }
    const framed = !v.behind && v.onScreen >= FRAMED.onScreen && v.share >= FRAMED.share;
    stops.push({ at: i, id: v.id, onScreen: Math.round(v.onScreen * 100) / 100, share: Math.round(v.share * 1000) / 1000, framed });
    if (v.behind) findings.push({ level: 'warn', code: 'behind-camera', says: 'its lit parts are partly behind the camera: frame them ({ frame: <group> })', at: v.id });
    else if (v.onScreen < FRAMED.onScreen) findings.push({ level: 'warn', code: 'off-frame', says: `only ${Math.round(v.onScreen * 100)}% of its lit parts is on screen above the plate: frame them ({ frame: <group> })`, at: v.id });
    else if (v.share < FRAMED.share) findings.push({ level: 'advice', code: 'too-small', says: `its lit parts fill ${Math.round(v.share * 1000) / 10}% of the view: come closer ({ frame: <group> })`, at: v.id });
  }
  return { gate: 'machine', ran: ['framing'], stops, findings, warnings: findings.filter((f) => f.level === 'warn').length };
}
