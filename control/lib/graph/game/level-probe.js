/**
 * THE PLAY PROBE — a level played for a few seconds the way a person first meets it, and four things said of it. A
 * MACHINE gate: it advises and stamps, never refuses, and never claims the eyes gate (a person playing the level).
 *
 *   loads           the page runs: no uncaught error while it loads and plays (a page that throws at load, its
 *                   instruments never drawn, fails here)
 *   not lost        the level is not over before the player touches anything: after a second standing still, it has
 *                   not ended in a failure (a guard who sees the hero where it spawns fails here)
 *   opposed         a level whose goal is to survive, fight, sneak or race has something to play against: a foe, a
 *                   hazard, a rival (an empty meadow to survive fails here). Read from the stage's own manifest
 *   clean           no debugging text on the page as it plays or ends (`0 events → store` fails here)
 *   sees            at each kept frame, the world it draws is not one colour (first-frame.js dominantColour, the
 *                   first-frame check's own measure and threshold): a camera inside something or looking at an empty
 *                   sky fails here. Read off the WebGL canvas, never the page's overlays (the HUD, the legend)
 *
 * It plays each stage's World page (the capture page the first-frame check opens, in the same installed browser,
 * never a download) for PROBE.seconds of simulated time at PROBE.fps, under a simple script: forward the whole time,
 * fire, jump and interact now and then. It cannot aim, so it says nothing of balance. It keeps a frame at each of
 * PROBE.frames seconds for the look critic to read.
 *
 *   opposition(manifest, { goal? })  → { needs, has, says? }      pure: the stage's mechanics and entities
 *   probeVerdict(stages)              → { gate, holds, checks, frames, note }   pure: the evidence judged
 *   probeLevel(items, opts)           → the evidence, one per stage (a browser; injectable `play` for tests)
 */

import { dominantColour, FIRST_FRAME } from './first-frame.js';

export const PROBE = Object.freeze({ seconds: 17, fps: 24, settle: 24, frames: Object.freeze([5, 11, 17]), width: 640, height: 400, sample: Object.freeze([160, 100]) });
// what a page must never show a player: debugging text left in a card or a HUD
export const DEBUG_TEXT = Object.freeze([/\b\d+ events? → store\b/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/]);
// the mechanics a player can lose to, or must fight or slip past: a level with one of these needs something against it
const NEEDS = new Set(['survive', 'fail-on-death', 'hp-pool', 'defeat-all', 'unseen', 'waves', 'wave-gauntlet', 'frags', 'laps', 'bounty', 'control']);
// the mechanics that are themselves opposition
const OPPOSES = new Set(['hazard-damage', 'waves', 'wave-gauntlet', 'defeat-all', 'unseen', 'frags', 'bounty', 'control', 'push']);
// a level's own goal words that ask for opposition (gameworld world.js: a level's goal)
const GOAL_NEEDS = ['boss', 'guards', 'health'];
const NOTE = 'machine gate: each stage played for a few seconds under a simple script; it cannot aim, so it says nothing of balance, and the eyes gate (a person playing it) has not run';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pct = (x) => `${Math.round(x * 100)}%`;
const kindsOf = (m) => (m?.game?.mechanics ?? []).map((x) => x?.kind).filter(Boolean);

/** What a stage has to play against, and whether its goal needs it. */
export function opposition(manifest, { goal } = {}) {
  const kinds = kindsOf(manifest);
  const foes = (manifest?.entities ?? []).filter((e) => isObj(e) && !e.pilotable && e.team !== 'player' && (e.rule?.type === 'ai' || isObj(e.weapon) || e.hostile === true));
  const rivals = (manifest?.entities ?? []).filter((e) => isObj(e) && !e.pilotable && (e.racer === true || e.rule?.racer === true));
  const has = [
    ...kinds.filter((k) => OPPOSES.has(k)),
    ...(foes.length ? [`${foes.length} foe(s)`] : []),
    ...(rivals.length ? [`${rivals.length} rival(s)`] : []),
  ];
  const needs = kinds.some((k) => NEEDS.has(k)) || (isObj(goal) && GOAL_NEEDS.some((g) => goal[g]));
  return { needs, has, ...(needs && !has.length ? { says: `its goal (${[...kinds.filter((k) => NEEDS.has(k)), ...(isObj(goal) ? GOAL_NEEDS.filter((g) => goal[g]) : [])].join(', ')}) needs something to play against, and nothing stands in it: no foe, hazard or rival` } : {}) };
}

/** The evidence judged. `stages`: [{ ref, errors?, startedLost?, debug?, frames?, opposition, skipped?, error? }] */
export function probeVerdict(stages) {
  if (!stages.length) return { gate: 'machine', holds: false, checks: [], note: 'no stage to play: make the level first (its chapter run)' };
  const skipped = stages.filter((s) => s.skipped);
  if (skipped.length === stages.length) return { gate: 'machine', holds: false, skipped: skipped[0].skipped, checks: [], note: NOTE };
  const each = (check, bad) => {
    const failing = stages.filter((s) => !s.skipped && bad(s));
    return { check, holds: !failing.length, ...(failing.length ? { says: failing.map((s) => `${s.ref}: ${bad(s)}`).join('; ') } : {}) };
  };
  const checks = [
    each('loads', (s) => s.error ?? (s.errors?.length ? `it threw: ${s.errors.slice(0, 2).join(' | ')}` : null)),
    each('not lost', (s) => (s.startedLost ? `it was over before any input: ${s.startedLost}` : null)),
    each('opposed', (s) => s.opposition?.says ?? null),
    each('clean', (s) => (s.debug?.length ? `it shows ${s.debug.map((d) => `"${d}"`).join(', ')}` : null)),
    each('sees', (s) => {
      const blind = (s.frames ?? []).filter((f) => f.colour && f.colour.share > FIRST_FRAME.oneColour);
      return blind.length ? blind.map((f) => `at ${f.at} s one colour (${f.colour.color}) covers ${pct(f.colour.share)} of the frame: the camera looks at nothing`).join('; ') : null;
    }),
  ];
  return {
    gate: 'machine', holds: checks.every((c) => c.holds), checks,
    ...(skipped.length ? { skippedStages: skipped.map((s) => s.ref) } : {}),
    frames: stages.flatMap((s) => (s.frames ?? []).map(({ colour: _c, ...f }) => ({ ref: s.ref, ...f }))),
    note: NOTE,
  };
}

/** The input the script plays at tick `i`: forward always; fire each second, interact each two, jump each three. */
export function scriptInput(i, fps = PROBE.fps) {
  const at = (every) => i > 0 && i % Math.round(every * fps) === 0;
  return { forward: 1, turn: 0, ...(at(1) ? { fire: true } : {}), ...(at(2) ? { interact: true } : {}), ...(at(3) ? { jump: true } : {}) };
}

/**
 * Play each stage page in one browser. → [{ errors, startedLost, debug, frames: [{ at, png }] } | { error }]
 * @param {Array<{ html }>} items
 */
export async function playStages(items, { executablePath, T = PROBE, timeoutMs = 90000 } = {}) {
  const { loadPuppeteer } = await import('@/lib/graph/scene/puppeteer-lazy');
  const { launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');
  const C = await import('@/lib/graph/scene/capture-contract');
  const B = { g: C.CAPTURE_GLOBAL, ready: C.CAPTURE_READY, step: C.CAPTURE_STEP, probe: C.CAPTURE_PROBE };
  await loadPuppeteer();
  const browser = await launchChromium({ executablePath, headless: true, args: CHROMIUM_WEBGL_ARGS, timeout: timeoutMs });
  const out = [];
  try {
    for (const { html } of items) {
      let pg = null;
      const errors = [];
      try {
        // eslint-disable-next-line no-await-in-loop -- one stage at a time, one browser
        pg = await browser.newPage();
        pg.on('pageerror', (e) => errors.push(String(e?.message ?? e).split('\n')[0]));
        // eslint-disable-next-line no-await-in-loop
        await pg.setViewport({ width: T.width, height: T.height, deviceScaleFactor: 1 });
        // eslint-disable-next-line no-await-in-loop
        await pg.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        // eslint-disable-next-line no-await-in-loop
        await pg.waitForFunction((b) => window[b.g] && window[b.g][b.ready] === true, { timeout: timeoutMs }, B);
        // a second standing still: over already?
        // eslint-disable-next-line no-await-in-loop
        const start = await pg.evaluate((b, n, dt) => {
          for (let i = 0; i < n; i++) window[b.g][b.step]({ dt, input: {} });
          const g = window[b.g][b.probe] ? window[b.g][b.probe]().game : null;
          return g ? { ended: !!g.ended, result: g.result ?? null } : null;
        }, B, T.settle, 1 / T.fps);
        const startedLost = start?.ended && start.result !== 'success' ? `ended (${start.result ?? 'no result'}) standing still` : null;
        const frames = [], debug = new Set();
        let tick = 0;
        for (const at of T.frames) {
          const until = Math.round(at * T.fps);
          const script = [];
          for (; tick < until; tick++) script.push(scriptInput(tick, T.fps));
          // eslint-disable-next-line no-await-in-loop
          const got = await pg.evaluate((b, s, dt, w, h) => {
            for (const input of s) window[b.g][b.step]({ dt, input });
            // the world's own canvas (#c), read in the task that rendered it, small: the overlays never count
            let px = null, cv = document.getElementById('c');
            if (!cv) for (const c of document.querySelectorAll('canvas')) if (!cv || c.width * c.height > cv.width * cv.height) cv = c;
            if (cv) {
              const out = document.createElement('canvas');
              out.width = w; out.height = h;
              const cx = out.getContext('2d');
              cx.drawImage(cv, 0, 0, w, h);
              const d = cx.getImageData(0, 0, w, h).data;
              let bin = '';
              for (let i = 0; i < d.length; i += 0x8000) bin += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
              px = btoa(bin);
            }
            return { text: document.body ? document.body.innerText : '', px };
          }, B, script, 1 / T.fps, T.sample[0], T.sample[1]);
          for (const re of DEBUG_TEXT) { const m = got.text.match(re); if (m) debug.add(m[0]); }
          const colour = got.px ? dominantColour(Buffer.from(got.px, 'base64')) : null;
          // eslint-disable-next-line no-await-in-loop
          frames.push({ at, png: await pg.screenshot({ type: 'png' }), ...(colour ? { colour } : {}) });
        }
        out.push({ errors: [...new Set(errors)], startedLost, debug: [...debug], frames });
      } catch (e) {
        out.push({ error: e.message, errors: [...new Set(errors)] });
      } finally {
        // eslint-disable-next-line no-await-in-loop
        if (pg) await pg.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return out;
}

/**
 * Probe one level's stages. → the verdict (probeVerdict), its frames written as PNGs under `framesDir`.
 * @param {Array<{ ref, manifest, html? , skip? }>} stages  each stage's ref, stored manifest, and capture page
 * @param {object} opts  { goal, findBrowser, play, framesDir, writeFile }
 */
export async function probeLevel(stages, { goal, findBrowser, play = playStages, framesDir = null, writeFile = null } = {}) {
  const found = await findBrowser();
  const evidence = stages.map((s) => ({ ref: s.ref, opposition: opposition(s.manifest, { goal }) }));
  if (!found.path) return probeVerdict(evidence.map((e) => ({ ...e, skipped: `skipped: ${found.why}` })));
  const playable = stages.map((s, i) => [s, i]).filter(([s]) => s.html && !s.skip);
  const played = playable.length ? await play(playable.map(([s]) => ({ html: s.html })), { executablePath: found.path }) : [];
  playable.forEach(([, i], k) => { Object.assign(evidence[i], played[k] ?? { error: 'not played' }); });
  stages.forEach((s, i) => { if (s.skip) evidence[i].skipped = s.skip; });
  // the frames kept on disk for the look critic; the verdict carries their paths
  for (const e of evidence) {
    if (!e.frames) continue;
    e.frames = await Promise.all(e.frames.map(async (f) => {
      const keep = f.colour ? { colour: f.colour } : {};
      if (!framesDir || !writeFile) return { at: f.at, ...keep };
      const file = `${framesDir}/${e.ref.replace(/[^A-Za-z0-9_-]/g, '_')}-${f.at}s.png`;
      await writeFile(file, f.png);
      return { at: f.at, file, ...keep };
    }));
  }
  return probeVerdict(evidence);
}
