/**
 * game-resolve — turn a stored game manifest into `emitGameShell` inputs by resolving each
 * level ref to its level sketch's `game` contract (game-metacontext.plan.md).
 *
 * Contracts live on the LEVEL sketches (their world manifest's `game` channel), not baked into
 * the game row — the game manifest is a pure recipe of refs, resolved on demand exactly like a
 * world's `beatsRef` (recipes, not renders; no staleness). This module is the resolution seam,
 * shared by the mint (verify-at-author-time) and the /game serve route (assemble-at-play-time).
 *
 * `src` for each level points at that level's live World page — the shell hosts it in an
 * iframe and speaks the postMessage contract to it. (The portable standalone-folder export,
 * where levels are inlined self-contained HTML, is a later phase; this is the served form.)
 */

import { validateGameManifest, normalizeGameManifest } from './game-manifest.js';
import { validateLevelContract, normalizeLevelContract } from './level-contract.js';
import { synthesizeLevel } from './level-synth.js';
import { isBeatsKind } from '../beats/beats-manifest.js';

// The generated default about/credits page (menu.attribution; see game-manifest.js).
// Plain data in the same shape an operator would author — nothing special downstream.
function defaultAboutEntry(norm) {
  const n = norm.levels.length;
  return {
    id: 'mojulo-about',
    title: 'About',
    subtitle: 'What this is — and what made it',
    kind: 'about',
    body: [
      `${norm.title} is a playable artifact composed from deterministic recipes — ${n} level${n === 1 ? '' : 's'}, each a small manifest that regenerates its world byte-for-byte.`,
      'It was made in conversation with a coding agent inside mojulo — a local, open-source workshop that keeps what an agent makes. Worlds, music, and rules are recipes: editable a line at a time, re-mintable on any machine running mojulo.',
    ],
    links: [
      { label: 'mojulo — the workshop', href: 'https://github.com/zombico/mojulo', sub: 'github.com/zombico/mojulo · Apache-2.0' },
      { label: 'mojulo on npm', href: 'https://www.npmjs.com/package/mojulo', sub: 'npx mojulo init — needs Claude Code or Codex' },
      { label: 'mojulo.ai', href: 'https://mojulo.ai', sub: 'what else the workshop makes — worlds, music, bots, games' },
    ],
    footer: 'Generated with mojulo. This credit is the operator’s — kept, customized, or removed in the game’s own recipe.',
  };
}

/**
 * @param {object} manifest        a game manifest (validated here)
 * @param {(ref:string)=>object|null} getSketch  ref → stored sketch ({ manifest, ... }) | null
 * @param {(ref:string)=>string} levelSrc        ref → the level's playable URL (iframe src)
 * @param {(ref:string)=>string} [worldSrc]      ref → a menu world-view URL (defaults to levelSrc)
 * @param {(ref:string)=>string} [beatsSrc]      ref → a streamable audio URL for a beats sketch
 *                                               (defaults to the served beats.wav route)
 * @param {(ref:string)=>string} [portraitSrc]   ref → a still-image URL for a setup card portrait
 *                                               (defaults to the served /png raster)
 * @param {(ref:string)=>string} [spinSrc]       ref → a self-rotating World URL for a setup card
 *                                               preview (defaults to /world?spin=1)
 * @returns {{ manifest, levels, menu, music, setup }}  normalized manifest + emitGameShell level
 *          entries + resolved menu entries (world entries carry src; null when the manifest has no
 *          menu) + resolved music { menu: src|null, about: src|null, battle: [src,…] } (null without music) +
 *          resolved setup presentation (card refs mapped to srcs; null without setup)
 * @throws  with a teaching message listing every fault (manifest, missing level, bad contract)
 */
export function resolveGame(manifest, getSketch, levelSrc, worldSrc = levelSrc,
  beatsSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/beats.wav`,
  portraitSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/png?inline=1`,
  spinSrc = (ref) => `/api/sketches/${encodeURIComponent(ref)}/world?spin=1&hud=0`) {
  const v = validateGameManifest(manifest);
  if (!v.ok) throw new Error(`game manifest is invalid:\n- ${v.errors.join('\n- ')}`);
  const norm = normalizeGameManifest(manifest);

  const errors = [];
  const levels = [];
  for (const lv of norm.levels) {
    const sketch = getSketch(lv.ref);
    if (!sketch || !sketch.manifest) { errors.push(`level '${lv.ref}': no sketch with that ref`); continue; }
    if (!sketch.manifest.game || typeof sketch.manifest.game !== 'object') {
      errors.push(`level '${lv.ref}': its sketch carries no \`game\` channel — a level is a world minted WITH a level contract or mechanics (compose_world … { game: { levelRef, mechanics|produces, … } })`);
      continue;
    }
    // synthesize the contract from mechanics (if any) — a level stores the RECIPE, so the contract
    // (produces/on/audits) is generated here, exactly as the world route does at render time.
    let game;
    try { game = synthesizeLevel(sketch.manifest).game; }
    catch (err) { errors.push(`level '${lv.ref}': ${err.message}`); continue; }
    const cv = validateLevelContract(game, norm.store);
    if (!cv.ok) { errors.push(`level '${lv.ref}' contract (against this game's store): ${cv.errors.join('; ')}`); continue; }
    levels.push({ ref: lv.ref, title: lv.title, contract: normalizeLevelContract(game), src: levelSrc(lv.ref) });
  }
  // menu entries (Start → Menu presentation), resolved depth-first so a nested submenu ('menu') is
  // walked too: a 'world' entry's viewed world must exist as a sketch (its src resolves here like a
  // level src); 'mode' entries carry only level refs (already resolved into levels[] above — the shell
  // looks them up by ref), so they pass through untouched. Nothing is baked into the game row.
  let menu = null;
  if (norm.menu) {
    const resolveEntry = (en) => {
      if (en.kind === 'world') {
        const sketch = getSketch(en.ref);
        if (!sketch || !sketch.manifest) { errors.push(`menu entry '${en.id}': no sketch with ref '${en.ref}'`); return { ...en }; }
        return { ...en, src: worldSrc(en.ref) };
      }
      if (en.kind === 'menu') return { ...en, entries: (en.entries || []).map(resolveEntry) };
      return { ...en };
    };
    menu = norm.menu.entries.map(resolveEntry);
    // ATTRIBUTION default (operator-owned; see game-manifest.js): a menu with no declared
    // about entry gets a generated provenance/credits page — injected HERE so the served copy
    // and the export carry the identical page while the stored recipe stays clean. Declaring
    // any about entry replaces it wholesale; `menu.attribution: false` removes it. Never
    // validated against, never required — a courtesy credit, not a lock.
    const hasAbout = (ens) => ens.some((en) => en.kind === 'about' || (en.kind === 'menu' && hasAbout(en.entries || [])));
    if (norm.menu.attribution !== false && !hasAbout(menu)) menu.push(defaultAboutEntry(norm));
  }

  // music refs (the shell's score): each must be a stored beats sketch; resolved to a
  // streamable src (the derived beats.wav render) — the game row keeps only the refs.
  let music = null;
  if (norm.music) {
    const beat = (ref, where) => {
      const sketch = getSketch(ref);
      if (!sketch || !sketch.manifest) { errors.push(`${where}: no sketch with ref '${ref}'`); return null; }
      if (!isBeatsKind(sketch.manifest.kind)) { errors.push(`${where}: '${ref}' is kind '${sketch.manifest.kind}', not a beats artifact`); return null; }
      return beatsSrc(ref);
    };
    music = {
      menu: norm.music.menu ? beat(norm.music.menu, 'music.menu') : null,
      about: norm.music.about ? beat(norm.music.about, 'music.about') : null,
      battle: (norm.music.battle || []).map((r, i) => beat(r, `music.battle[${i}]`)).filter(Boolean),
    };
  }

  // setup presentation (pre-level screens): hangar card portrait/preview refs must exist as
  // sketches; each resolves to a servable src (a /png still, a ?spin=1 self-rotating World) —
  // the game row keeps only the refs, exactly like menu worlds and music beats.
  let setup = null;
  if (norm.setup) {
    setup = {};
    for (const slice of Object.keys(norm.setup)) {
      const p = norm.setup[slice];
      if (p.style !== 'hangar') { setup[slice] = { ...p }; continue; }
      const cards = {};
      for (const id of Object.keys(p.cards || {})) {
        const c = p.cards[id];
        const out = { ...c };
        for (const [k, toSrc] of [['portrait', portraitSrc], ['preview', spinSrc]]) {
          if (!c[k]) continue;
          const sketch = getSketch(c[k]);
          if (!sketch || !sketch.manifest) { errors.push(`setup.${slice}.cards.${id}.${k}: no sketch with ref '${c[k]}'`); continue; }
          out[k] = toSrc(c[k]);
        }
        // per-livery preview turntables (livery-ingame.plan.md): a card's `liveries` may each carry a
        // `preview` world ref so the setup carousel repaints when the operator picks a livery. Resolve
        // each to a servable src; an unresolvable ref drops to null so the shell falls back to
        // card.preview. (The swatch id + hex pass through untouched for the picker + in-match paint.)
        if (Array.isArray(out.liveries)) {
          out.liveries = out.liveries.map((l) =>
            (l && l.preview) ? { ...l, preview: getSketch(l.preview) ? spinSrc(l.preview) : null } : l);
        }
        cards[id] = out;
      }
      setup[slice] = { ...p, cards };
    }
  }

  if (errors.length) throw new Error(`cannot assemble game '${norm.title}':\n- ${errors.join('\n- ')}`);
  return { manifest: norm, levels, menu, music, setup };
}
