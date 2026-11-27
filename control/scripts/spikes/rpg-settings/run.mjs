// THE RPG-SETTINGS SPIKE: fantasy settings that keep ONE colour relationship (the colour theorist's seed, scheme, key
// and value groups: color-theorist/solve.js) and move only its hues (palette.shift: turn, warm, chroma, light) to say
// each setting's mood and intensity, each dressed by what the geocube composes (its preset, biocube, snow, dunes,
// crystals, grit) at its hour under its weather. Each is laid as the starter's trail level's style and shot from where
// the party sets out, in headless Chromium; what fails to compose is said, with why. Writes report.json, a shot each and
// sheet.png into the directory it is given.
//   node scripts/spikes/rpg-settings/run.mjs <out dir> [id,id,…]
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const OUT = process.argv[2] ?? '.', ONLY = process.argv[3] ? process.argv[3].split(',') : null;
mkdirSync(OUT, { recursive: true });
const { composeGameworld, runSteps } = await import('../../../lib/graph/gameworld/index.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const { solvePalette, readPaletteSpec } = await import('../../../lib/graph/color-theorist/solve.js');
const { GEOCUBE_PALETTES } = await import('../../../lib/graph/era/geocube.js');
const nap = (ms) => new Promise((r) => setTimeout(r, ms));

// THE ONE RELATIONSHIP every setting keeps: the home valley's character (its roles' hues, its scheme, its key, its
// heat and weight: era/geocube.js GEOCUBE_PALETTES), one seed; a setting moves it whole, never re-solves it
const RELATION = { ...GEOCUBE_PALETTES['valley-morning'], seed: 11 };
// THE SETTINGS, calm to dire: each composed from the WORDS a person would say of it (gameworld/compose.js LEXICON,
// CUBE_WORDS: what the geocube is given), then its trail level coloured by the one relationship moved: mood the hue's
// turn and its warmth, intensity its chroma and value; `cube`, a change no word reaches (said in the report as a gap)
export const SETTINGS = [
  { id: 'verdant-vale', name: 'Verdant Vale', mood: 'home, safe', intensity: 1, words: 'a meadow valley with a river and wildflowers', shift: {}, hour: 'morning' },
  { id: 'harvest-march', name: 'Harvest March', mood: 'warm, nostalgic', intensity: 1, words: 'autumn farmland by a lake', shift: { turn: -30, warm: 0.4 }, hour: 'golden' },
  { id: 'whisperwood', name: 'Whisperwood', mood: 'mysterious, hushed', intensity: 2, words: 'a misty pine forest', shift: { turn: 60, chroma: 0.8, light: -0.2 }, hour: 'dusk' },
  { id: 'frostmere', name: 'Frostmere', mood: 'lonely, still', intensity: 2, words: 'snowy alpine heights with a tarn', shift: { turn: 140, chroma: 0.6, light: 0.15 }, hour: 'noon' },
  { id: 'redrock-canyon', name: 'Redrock Canyon', mood: 'vast, ancient', intensity: 2, words: 'a sandstone canyon with spires, arches and a waterfall', shift: { turn: -40, warm: 0.5, chroma: 1.1 }, hour: 'afternoon' },
  { id: 'sunscar-dunes', name: 'Sunscar Dunes', mood: 'harsh, parched', intensity: 3, words: 'desert dunes, an erg', shift: { turn: -50, warm: 0.6, chroma: 1.3, light: 0.1 }, hour: 'noon' },
  { id: 'stormbreak-coast', name: 'Stormbreak Coast', mood: 'wild, restless', intensity: 3, words: 'a stormy coast of basalt columns and sea stacks', shift: { turn: 170, chroma: 0.9, light: -0.15 }, hour: 'afternoon' },
  { id: 'mire-of-sorrows', name: 'Mire of Sorrows', mood: 'oppressive, sickly', intensity: 3, words: 'a foggy swamp, rainy', shift: { turn: 90, chroma: 0.7, light: -0.3 }, hour: 'afternoon' },
  { id: 'sunken-reef', name: 'Sunken Reef', mood: 'dreamlike, drowned', intensity: 3, words: 'an underwater coral reef', shift: { turn: 150, chroma: 1.2 }, hour: 'noon' },
  { id: 'crystal-hollows', name: 'Crystal Hollows', mood: 'wondrous, eerie', intensity: 3, words: 'limestone crags', cube: { outside: { crystals: { gem: 'amethyst' } } }, shift: { turn: 120, chroma: 1.2, light: -0.25 }, hour: 'dusk' },
  { id: 'abyssal-trench', name: 'Abyssal Trench', mood: 'crushing, alien', intensity: 4, words: 'the abyss, an abyssal seafloor', shift: { turn: -140, chroma: 1.3, light: -0.4 }, hour: 'noon' },
  { id: 'emberreach', name: 'Emberreach', mood: 'hostile, burning', intensity: 4, words: 'basalt columns, rocky, dusty', cube: { biocube: 'bare', grit: 0.8 }, shift: { turn: -80, warm: 0.8, chroma: 1.5, light: -0.35 }, hour: 'dusk' },
  { id: 'blighted-reach', name: 'Blighted Reach', mood: 'corrupted, dread', intensity: 5, words: 'a stormy wasteland of monoliths', cube: { biocube: 'bare', grit: 0.7 }, shift: { turn: 170, chroma: 1.2, light: -0.4 }, hour: 'night' },
  { id: 'shadowkeep', name: 'Shadowkeep Approach', mood: 'gothic, final', intensity: 5, words: 'a haunted gothic crypt, foggy', shift: { turn: -160, chroma: 0.9, light: -0.45 }, hour: 'night' },
];

const report = { relation: RELATION, settings: [] };
const LIB = { forward: 'Walk_Loop', idle: 'Idle_Loop', walk: 'Walk_Loop', turn: 'Walk_Loop', strafe: 'Walk_Loop', leap: 'Jump_Loop' };
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const S of SETTINGS.filter((x) => !ONLY || ONLY.includes(x.id))) {
  const row = { id: S.id, name: S.name, mood: S.mood, intensity: S.intensity, shift: S.shift }, t0 = Date.now();
  try {
    const palette = { ...RELATION, ...(Object.keys(S.shift).length ? { shift: S.shift } : {}) };
    // (the palette the relationship and the shift solve to: its roles' hexes)
    try { const P = solvePalette(readPaletteSpec(palette)); row.palette = P.roles ?? P.hex ?? Object.fromEntries(Object.entries(P).filter(([, v]) => typeof v === 'string' && /^#/.test(v)).slice(0, 10)); } catch (e) { row.palette = `unsolved: ${e.message.split('\n')[0]}`; }
    const W = composeGameworld({ prompt: `a jrpg in ${S.words}`, seed: 3 });
    // (its first walked level past the hub: the trail the words dressed)
    const ids = Object.keys(W.levels), lid = ids.find((id) => id !== W.hub && W.levels[id].walk) ?? ids.find((id) => W.levels[id].walk), L = W.levels[lid];
    delete L.places;
    const cube0 = L.style?.geocube ?? W.style?.geocube;
    row.level = lid; row.composed = { geocube: cube0 ?? null, weather: L.style?.weather ?? W.style?.weather ?? null, kit: L.style?.kit ?? W.style?.kit ?? null };
    const cube = S.cube ? { ...(typeof cube0 === 'string' ? { from: cube0 } : cube0 ?? { from: 'valley-morning' }), ...S.cube } : cube0;
    L.style = { ...(L.style ?? {}), ...(cube ? { geocube: cube } : {}), palette, hour: S.hour };
    // (a world whose hub cannot stand its shop on the land the words made: said, and tried again without the shops,
    // so its land is still seen)
    let St0 = null;
    try { St0 = runSteps(W, { ref: `rs-${S.id}` }); } catch (e) { row.composeFailed = e.message.split('\n')[0]; W.battles = { ...(W.battles ?? {}), shops: false }; St0 = runSteps(W, { ref: `rs-${S.id}` }); }
    const St = St0, step = St.find((s) => s.key === `level-${lid}-0`) ?? St.find((s) => s.key.startsWith(`level-${lid}-`));
    const M = structuredClone(step.order.manifest);
    Object.entries(M.figures ?? {}).forEach(([k, f], i) => { if (f && f.heroRef) M.figures[k] = { hero: { cast: i % 2 ? 'male' : 'female' }, library: 'quaternius-ual', clips: LIB }; });
    const { payload } = await resolveWorldScene({ ref: `rs_${S.id}`, title: S.name, manifest: M });
    const html = emitThreeWorld({ ...payload, inline: true, hud: false });
    row.bytes = html.length;
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world, { timeout: 300000 });
    await nap(4000);
    // (the opening's lines skipped; then the shot from where the party sets out, and an establishing one: raised behind
    // it, looking along its way, where the land's forms are seen)
    for (let k = 0; k < 4; k++) { await page.keyboard.down('Escape'); await nap(300); await page.keyboard.up('Escape'); await nap(500); }
    await nap(1500);
    await page.screenshot({ path: `${OUT}/${S.id}.png` });
    await page.evaluate(() => { const w = window.__mojCtrl.world, me = w.byId[w.pilotId], C = w.camera, h = me.transform.heading, p = me.transform.pos;
      C.rule = null; C.transform.pos = [p[0] - Math.cos(h) * 22, p[1] - Math.sin(h) * 22, p[2] + 14]; C.lookAt = [p[0] + Math.cos(h) * 40, p[1] + Math.sin(h) * 40, p[2]]; });
    await nap(2500);
    await page.screenshot({ path: `${OUT}/${S.id}-wide.png` });
    row.errors = errors.slice(0, 3); row.ok = true;
    await page.close();
  } catch (e) { row.ok = false; row.why = e.message.split('\n').slice(0, 2).join(' '); }
  row.ms = Date.now() - t0;
  report.settings.push(row);
  console.log(S.id, row.ok ? 'ok' : `FAILED ${row.why}`, Math.round(row.ms / 1000) + 's');
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
}
await browser.close(); process.exit(0);
