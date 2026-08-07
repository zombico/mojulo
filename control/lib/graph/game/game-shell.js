/**
 * game-shell — emit the standalone game artifact's hub page (game-metacontext.plan.md).
 *
 * `emitGameShell(manifest, levels)` → one self-contained, dependency-free game.html that OWNS
 * the store and hosts levels in an iframe. The store kernel ships inside it via
 * `buildGameStoreKernel.toString()` (the beats-kernel emit discipline), reducers already
 * generated from the manifest's schema — no mojulo, no network, no keys at runtime.
 *
 * The session loop (the only writes the store ever sees):
 *   1. setup screen — rendered from the level contract's `consumes` (a pick renders a
 *      checkbox loadout/roster picker capped at pick.max; everything else carries whole)
 *   2. shell → level   { moj: 'game-init', contractVersion, params, seed }  (after game-ready)
 *   3. level → shell   { moj: 'game-outcome', envelope }  — once, at level end
 *   4. K.applyOutcome validates against the level's `produces` and applies ATOMICALLY;
 *      the envelope lands in the runLog; the save persists.
 *
 * Saves: localStorage (feature-detected; in-memory fallback with a visible notice) + export /
 * import as a JSON file — { contractVersion, storeState, runLog }, replayable and portable.
 * Seeds are deterministic by doctrine (no Date.now / Math.random anywhere): session seed =
 * runLog.length + 1.
 *
 * `levels` entries: { ref, title?, contract, src? } — contract is the level's NORMALIZED
 * game channel (level-contract.js); src defaults to `levels/<ref>.html` beside game.html in
 * the staged artifact folder.
 *
 * `menu` (optional, required when manifest.menu is declared): the RESOLVED menu entries from
 * resolveGame — [{ id, title, subtitle?, kind: 'levels'|'world', ref?, src? }]. With a menu the
 * shell boots Start screen → main menu; kind:'levels' opens the level list, kind:'world' iframes
 * that entry's src (a stored world, e.g. a hangar). Without one the shell boots the level list
 * directly (the pre-menu behavior).
 *
 * `music` (optional, required when manifest.music is declared): the RESOLVED score from
 * resolveGame — { menu: src|null, battle: [src,…] }, streamable audio URLs. The shell owns an
 * <audio> element: the menu track LOOPS on menu/level-list/setup screens, the battle list
 * ROTATES while a level session runs (ended → next), and world-view screens are silent (a
 * viewed world carries its own score via its manifest `audio` channel). Playback starts from
 * a user gesture (the START click); a header toggle mutes.
 *
 * `setup` (optional, required when manifest.setup is declared): the RESOLVED per-slice setup
 * presentation from resolveGame — card portrait/preview refs mapped to servable srcs. A
 * 'hangar' slice renders the full-page single-pick selector (portrait rail + self-rotating
 * preview iframe + stats); a 'count' slice renders the how-many pick over a seeded random
 * draw. Slices without presentation keep the plain picker.
 *
 * SCORE SCREEN: when an outcome envelope carries `stats` ({ pilot, rows }), the shell lingers
 * on the in-world result tableau then renders the contender table (kills / deaths / damage /
 * accuracy) as a full page; envelopes without stats keep the classic toast + level list.
 */

import { buildGameStoreKernel } from './store-kernel.js';
import { CONTRACT_VERSION, MSG_READY, MSG_INIT, MSG_OUTCOME, MSG_AUDIO, MSG_PAUSE, MSG_CONTROLS, MSG_GAMEPAD, MSG_AI } from './level-contract.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function emitGameShell(manifest, levels = [], menu = null, music = null, setup = null) {
  if (!manifest || manifest.kind !== 'game') throw new Error("emitGameShell needs a validated game manifest (kind: 'game')");
  if (manifest.menu && !menu) throw new Error('emitGameShell: the manifest declares a menu — pass the resolved menu entries (resolveGame returns them)');
  if (manifest.music && !music) throw new Error('emitGameShell: the manifest declares music — pass the resolved music srcs (resolveGame returns them)');
  if (manifest.setup && !setup) throw new Error('emitGameShell: the manifest declares setup presentation — pass the resolved setup (resolveGame returns it)');
  if (menu) {
    for (const en of menu) {
      if (en.kind === 'world' && !en.src) throw new Error(`emitGameShell: menu entry '${en.id}' (kind 'world') has no resolved src`);
    }
  }
  const byRef = new Map(levels.map((l) => [l.ref, l]));
  for (const lv of manifest.levels) {
    if (!byRef.has(lv.ref)) throw new Error(`emitGameShell: manifest level '${lv.ref}' has no matching entry in levels[] (need its contract + src)`);
    if (!byRef.get(lv.ref).contract) throw new Error(`emitGameShell: level '${lv.ref}' is missing its contract — a level is promoted into a game WITH its signature`);
  }
  const levelTable = manifest.levels.map((lv) => {
    const l = byRef.get(lv.ref);
    return { ref: lv.ref, title: lv.title || l.title || lv.ref, gate: lv.gate || null, src: l.src || `levels/${lv.ref}.html`, contract: l.contract };
  });

  // theme (pure presentation): sanitize the accents into the CSS var block; `hud` style adds the
  // stylized treatment. Colors are validated at mint (hex only) — re-guarded here so a hand-poked
  // row can never inject into the CSS context. Defaults keep the pre-theme look.
  const theme = manifest.theme || {};
  const safeColor = (v, fallback) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : fallback);
  const accent = safeColor(theme.accent, '#5fb0ff');
  const accent2 = safeColor(theme.accent2, '#e8b96a');
  const hud = theme.style === 'hud';

  // menu.art (pure presentation, opt-in): a full-bleed title-card image behind the game-frame
  // screens, under a legibility scrim. Re-guarded here so a hand-poked row can never break out
  // of the CSS url() context (quotes / parens / whitespace / backslashes refused). Absent →
  // the emitted CSS is untouched.
  const rawArt = manifest.menu && typeof manifest.menu.art === 'string' ? manifest.menu.art.trim() : null;
  const art = rawArt && !/["'()\s\\]/.test(rawArt) ? rawArt : null;
  // menu.setupArt (opt-in sibling): a second backdrop for the POST-menu screens — battle
  // setup / level list / world view get the working-bay read while start + menus keep the
  // title card. setScreen toggles body.bay-art per screen.
  const rawSetupArt = manifest.menu && typeof manifest.menu.setupArt === 'string' ? manifest.menu.setupArt.trim() : null;
  const setupArt = rawSetupArt && !/["'()\s\\]/.test(rawSetupArt) ? rawSetupArt : null;
  // Emitted LAST in the stylesheet (after the body.hud skin) with matching body.hud
  // selectors, so the art wins the cascade over the hud theme's own body background.
  const artCss = (art || setupArt) ? `
${art ? `  body,body.hud{background:#04070d url("${art}") center/cover no-repeat fixed}
` : ''}${setupArt ? `  body.bay-art,body.hud.bay-art{background:#04070d url("${setupArt}") center/cover no-repeat fixed}
` : ''}  body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(4,7,13,.12),rgba(4,7,13,.5) 55%,rgba(4,7,13,.88))}
  .screen.art-start{justify-content:flex-end;min-height:92vh;padding-bottom:3vh}
  .screen.art-menu{justify-content:flex-end;min-height:88vh;padding-bottom:5vh}
  .screen .ghost{opacity:0;pointer-events:none;user-select:none}` : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(manifest.title)}</title>
<style>
  :root{color-scheme:dark;--accent:${accent};--accent2:${accent2};
    --bg:#0b1220;--ink:#cfe3ff;--dim:#8fa5c8;--line:#1c2942;--panel:rgba(13,19,33,.6)}
  body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,sans-serif}
  button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}
  /* settings: a floating gear (the only standing chrome — the header bar is gone so the
     play screen presents clean) opening a small panel of audio + save controls. */
  #gearBtn{position:fixed;top:10px;right:10px;z-index:70;width:34px;height:34px;padding:0;border-radius:8px;font-size:16px;line-height:1}
  #settings{position:fixed;top:50px;right:10px;z-index:70;width:250px;display:flex;flex-direction:column;gap:12px;
    background:rgba(12,16,26,.96);border:1px solid #2a3b58;border-radius:10px;padding:14px}
  #settings[hidden]{display:none}
  /* embedded: the SAME settings element, adopted into the pause menu's settings sheet during
     battle (one set of inputs + handlers — never two copies of the state). */
  #settings.embedded{position:static;top:auto;right:auto;width:auto;z-index:auto;border:none;background:none;padding:0;border-radius:0}
  .set-row{display:flex;align-items:center;gap:8px}
  .set-row .set-label{flex:0 0 44px;font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:1px}
  .set-row button{min-width:44px;padding:3px 8px;font-size:12px}
  .set-row input[type=range]{flex:1;min-width:0;accent-color:var(--accent)}
  .set-save{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px}
  .set-save button{font-size:12px;padding:4px 10px}
  /* controller options: a divided group under the audio rows — toggle + detected-pad name,
     then look speed / dead zone / invert-Y. The name chip is display-only (the world polls
     the pad itself); it tracks connect / disconnect so the player sees what the browser found. */
  .set-pad{display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--line);padding-top:12px}
  .pad-name{flex:1;min-width:0;font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pad-name.on{color:#7ed49a}
  /* pause menu (level screens): ☰ freezes the level over the pause sidecar and raises this
     overlay. The ☰/⚙ buttons ride ABOVE the backdrop (z 70 > 65) — ☰ doubles as resume,
     and the settings gear stays reachable while paused. */
  #menuBtn{position:fixed;top:10px;right:50px;z-index:70;width:34px;height:34px;padding:0;border-radius:8px;font-size:15px;line-height:1}
  #pause{position:fixed;inset:0;z-index:65;display:flex;align-items:center;justify-content:center;background:rgba(4,7,12,.72);backdrop-filter:blur(3px)}
  #pause[hidden]{display:none}
  .pause-panel{width:min(400px,86vw);background:rgba(12,16,26,.97);border:1px solid #2a3b58;border-radius:12px;padding:22px 24px;display:flex;flex-direction:column;gap:10px}
  .pause-title{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:var(--dim);text-align:center;margin-bottom:6px}
  #pauseRoot,#pauseControls,#pauseSettings{display:flex;flex-direction:column;gap:10px}
  #pauseRoot[hidden],#pauseControls[hidden],#pauseSettings[hidden]{display:none}
  .pause-item{width:100%;padding:10px 0;font-size:14px;letter-spacing:1px;text-transform:uppercase}
  .ctl-rows{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:0 0 6px;font-size:13px}
  .ctl-rows dt{color:var(--accent);white-space:nowrap;font-variant-numeric:tabular-nums}
  .ctl-rows dd{margin:0}
  /* controller diagram (Controls sheet): an inline SVG pad with callout labels — deterministic
     vector art, no asset fetch (the artifact stays self-contained), glyphs swapped per detected
     pad. The panel widens while the sheet is open so the callout lanes breathe. */
  .pause-panel.wide{width:min(620px,94vw)}
  #padDiagram{margin:0 0 10px}
  #padDiagram svg{width:100%;display:block}
  #padDiagram text{font-family:inherit}
  body.hud .pause-panel{background:rgba(6,14,19,.97);border-color:var(--line)}
  button:disabled{opacity:.4;cursor:not-allowed}
  button.primary{background:#1b2740;color:#fff}
  #notice{padding:4px 16px;font-size:12px;color:#e8b96a;display:none}
  #main{padding:14px 16px;max-width:1220px;margin:0 auto}
  .level{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin:8px 0;background:var(--panel)}
  .level .name{flex:1}
  .level .done{color:#7ed49a;font-size:12px}
  .level .lock{color:var(--dim);font-size:12px}
  .card{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0;background:var(--panel)}
  .card h3{margin:0 0 8px;font-size:13px;color:#9cc4ff;text-transform:uppercase;letter-spacing:.4px}
  label.pick{display:inline-flex;align-items:center;gap:6px;margin:3px 10px 3px 0;padding:4px 8px;border:1px solid #24324a;border-radius:6px;cursor:pointer}
  pre{white-space:pre-wrap;background:rgba(9,13,23,.8);border:1px solid var(--line);border-radius:6px;padding:8px;font-size:12px;color:#a9c1e8;overflow-x:auto}
  #frame{width:100%;aspect-ratio:16/10;border:1px solid var(--line);border-radius:8px;background:#000;display:none}
  .screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:68vh;text-align:center;gap:16px}
  .screen .gametitle{font-size:34px;letter-spacing:3px;color:#eaf2ff;text-transform:uppercase;margin:0}
  .screen .tagline{color:var(--dim);font-size:14px;margin:0}
  button.big{font-size:17px;padding:11px 38px;letter-spacing:2px;text-transform:uppercase}
  .menu-entry{display:block;width:100%;max-width:440px;text-align:left;padding:14px 18px;font-size:16px;margin:0}
  .menu-entry .sub{display:block;font-size:12px;color:var(--dim);margin-top:3px;text-transform:none;letter-spacing:0}
  .menu-entry .soon-tag{float:right;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--accent2);border:1px solid var(--line);border-radius:3px;padding:1px 7px}
  #toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(12,16,26,.95);border:1px solid #2a3b58;border-radius:8px;padding:10px 18px;display:none;max-width:80%;color:#dfe8f8;z-index:90}
  #toast.err{border-color:#8a3b3b;color:#f2c9c9}
  /* ---- setup presentation (opt-in manifest setup block): hangar single-pick + count pick ---- */
  /* stacked layout: the SELECTOR is its own horizontal strip on top (pageable ‹ › when a
     bigger roster overflows the row), then the stage — full-height turntable on the left,
     name / stats / livery swatches on the right. */
  .hangar{display:flex;flex-direction:column;gap:14px}
  .hangar-strip{display:flex;align-items:center;gap:8px}
  .hangar-rail{display:flex;gap:8px;flex:1;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin;padding-bottom:2px}
  .rail-page{flex:0 0 auto;width:28px;height:92px;padding:0;font-size:16px}
  .suit-card{position:relative;flex:0 0 auto;scroll-snap-align:start;width:92px;height:92px;padding:0;border:1px solid var(--line);border-radius:8px;background:var(--panel);cursor:pointer;font:inherit;color:var(--ink);overflow:hidden}
  /* the profile shot is MONOCHROME by treatment — the accent border, not the paint, carries
     the menu's color language; selection lifts the exposure. */
  .suit-card img{width:100%;height:100%;object-fit:cover;display:block;background:#05080e;filter:grayscale(1) brightness(.88) contrast(1.08)}
  .suit-card.sel img{filter:grayscale(1) brightness(1.06) contrast(1.08)}
  /* anonymous until chosen: the nameplate only surfaces on the selected tile (a card with no
     portrait keeps its name — a blank tile identifies nothing). */
  .suit-card .nm{display:none;position:absolute;left:0;right:0;bottom:0;padding:3px 5px;font-size:9px;letter-spacing:1px;text-transform:uppercase;text-align:center;background:rgba(5,8,14,.85);color:var(--ink)}
  .suit-card.sel .nm{display:block}
  .suit-card.no-art .nm{display:block;position:static;background:none;font-size:11px;padding:36px 5px}
  .suit-card.sel{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset,0 0 16px rgba(120,200,255,.14)}
  /* stage: the turntable owns the full pane height; the info column rides its right edge */
  .hangar-stage{display:flex;gap:16px;align-items:stretch;flex-wrap:wrap}
  .hangar-view{flex:1 1 460px;min-width:min(460px,100%);border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:10px;display:flex}
  .hangar-view iframe{width:100%;height:min(64vh,660px);border:0;border-radius:6px;background:#000}
  .hangar-side{flex:1 1 260px;min-width:240px;max-width:360px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px}
  .hangar-side .nm{font-size:15px;letter-spacing:2px;text-transform:uppercase;color:#eaf2ff}
  .livery-label{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);margin-bottom:5px}
  .livery-row{display:flex;gap:8px;flex-wrap:wrap}
  .livery-chip{width:26px;height:26px;padding:0;border-radius:7px;border:1px solid #24324a;cursor:pointer}
  .livery-chip.sel{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
  .stat-rows{display:grid;grid-template-columns:auto 1fr;gap:3px 16px;font-size:12px;margin:0}
  .stat-rows dt{color:var(--dim);text-transform:uppercase;letter-spacing:1px}
  .stat-rows dd{margin:0}
  .count-pick{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .count-pick button{min-width:46px;padding:10px 0;font-size:16px;font-variant-numeric:tabular-nums}
  .count-pick button.sel{border-color:var(--accent);color:#fff;box-shadow:0 0 0 1px var(--accent) inset}
  /* difficulty pick (map step): three named tiers, name over a quiet descriptor */
  .diff-pick{display:flex;gap:8px;flex-wrap:wrap}
  .diff-pick button{flex:1 1 130px;max-width:200px;padding:10px 8px;text-align:center}
  .diff-pick button .nm{display:block;font-size:13px;letter-spacing:1.5px;text-transform:uppercase}
  .diff-pick button .sub{display:block;font-size:10px;color:var(--dim);margin-top:3px;text-transform:none;letter-spacing:0}
  .diff-pick button.sel{border-color:var(--accent);color:#fff;box-shadow:0 0 0 1px var(--accent) inset}
  /* map carousel (mode setup): the baked map still with the label PICKER stacked on its RIGHT
     (operator, 2026-08-04 — tighter than the full-width row under it). ‹ › page it, the labels
     stay the direct pick — and the whole selector when a shot 404s offline. Narrow screens wrap
     the column back under the image. */
  .map-wrap{display:flex;gap:10px;align-items:stretch;flex-wrap:wrap;max-width:720px}
  .map-car{position:relative;flex:1 1 420px;min-width:min(420px,100%);border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#05080e}
  .map-car img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
  .map-picks{display:flex;flex-direction:column;gap:8px;flex:1 0 118px;max-width:150px;justify-content:center}
  .map-picks button{padding:9px 6px;font-size:13px}
  .map-picks button.sel{border-color:var(--accent);color:#fff;box-shadow:0 0 0 1px var(--accent) inset}
  .map-car .car-btn{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:56px;padding:0;font-size:22px;line-height:1;
    background:rgba(5,8,14,.55);border:1px solid rgba(122,160,210,.35);color:#cfe3ff}
  .map-car .car-btn:hover{background:rgba(5,8,14,.8)}
  .map-car .car-prev{left:10px}
  .map-car .car-next{right:10px}
  .map-car .car-name{position:absolute;left:12px;bottom:10px;padding:4px 12px;border-radius:6px;background:rgba(5,8,14,.72);
    font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#eaf2ff}
  .map-car .car-dots{position:absolute;right:14px;bottom:16px;display:flex;gap:6px}
  .map-car .car-dots i{width:7px;height:7px;border-radius:50%;background:rgba(160,190,230,.35)}
  .map-car .car-dots i.on{background:var(--accent)}
  /* the setup action bar is FIXED to the viewport bottom so Start is ALWAYS on screen — a sticky
     last-child would sit at the bottom of a tall page (off-screen), and the tall turntable iframes
     trap wheel-scroll, so a two-hangar Solo Duel (your suit + the enemy) could hide Start entirely. */
  .setup-bar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;gap:10px;align-items:center;justify-content:center;padding:12px 16px;background:rgba(5,8,14,.94);border-top:1px solid var(--line)}
  body.hud .setup-bar{background:rgba(5,10,16,.96)}
  .setup-bar button.primary{font-size:15px;padding:10px 30px;letter-spacing:1px;text-transform:uppercase}
  .setup-foot{height:78px}   /* reserves scroll room so the last pick can clear the fixed bar */
  /* two hangar picks on one screen → shorter turntables so both fit above the bar. */
  body.multi-hangar .hangar-view iframe{height:min(40vh,420px)}
  /* ---- end-of-match score screen ---- */
  .result-line{font-size:32px;letter-spacing:5px;text-transform:uppercase;margin:0}
  .score-wrap{width:min(680px,92vw);overflow-x:auto}
  .score-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  .score-table th{font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;text-align:right;padding:6px 12px;border-bottom:1px solid var(--line)}
  .score-table td{padding:7px 12px;text-align:right;border-bottom:1px solid var(--line);font-size:13px}
  .score-table th:first-child,.score-table td:first-child{text-align:left}
  .score-table tr.me td{color:var(--accent)}
  /* ---- loading overlay (universal; long thin bar + big % + quiet context label) ---- */
  #loading{position:fixed;inset:0;z-index:80;display:none;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(120% 90% at 50% 42%, rgba(8,16,24,.9), rgba(4,7,12,.98));transition:opacity .45s ease}
  #loading.leaving{opacity:0}
  .load-panel{position:relative;width:min(640px,86vw);padding:26px 30px}
  .load-label{font-size:11px;color:var(--dim);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;min-height:14px;opacity:.75}
  .load-track{position:relative;height:3px;width:100%;background:rgba(148,180,220,.14);border-radius:2px;overflow:hidden}
  .load-fill{height:100%;width:0%;background:var(--accent);box-shadow:0 0 14px var(--accent);transition:width .12s linear}
  .load-foot{display:flex;align-items:baseline;gap:5px;justify-content:flex-end;margin-top:12px;font-variant-numeric:tabular-nums}
  #loadPct{font-size:40px;line-height:1;color:#eaf2ff;letter-spacing:3px}
  .load-unit{font-size:15px;color:var(--dim)}
  /* ---- the 'hud' theme (opt-in via theme.style:'hud') — the stylized skin ---- */
  body.hud{--bg:#05080e;--ink:#c3ecf4;--dim:#5f93a4;--line:rgba(95,220,255,.2);--panel:linear-gradient(180deg,rgba(12,26,32,.6),rgba(8,16,22,.34));
    font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
    background:radial-gradient(130% 80% at 50% -10%, rgba(95,220,255,.06), transparent 58%), var(--bg)}
  body.hud .gametitle{text-shadow:0 0 20px rgba(95,220,255,.4);color:#eafcff}
  body.hud #settings{background:rgba(6,14,19,.96);border-color:var(--line)}
  body.hud button{color:var(--accent);background:rgba(8,18,24,.5);border-color:var(--line);text-transform:uppercase;letter-spacing:1px}
  body.hud button:hover:not(:disabled){box-shadow:0 0 16px rgba(95,220,255,.18)}
  body.hud button.primary{color:#eafcff;border-color:var(--accent);background:linear-gradient(180deg,rgba(95,220,255,.2),rgba(95,220,255,.05))}
  body.hud .menu-entry,body.hud .card,body.hud .level{position:relative;border-color:var(--line);background:var(--panel)}
  body.hud .menu-entry::before,body.hud .menu-entry::after{content:"";position:absolute;width:13px;height:13px;border:1px solid var(--accent);opacity:.75}
  body.hud .menu-entry::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
  body.hud .menu-entry::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
  body.hud .menu-entry:hover{box-shadow:0 0 0 1px var(--accent) inset,0 0 24px rgba(95,220,255,.16)}
  body.hud .load-panel::before,body.hud .load-panel::after{content:"";position:absolute;width:18px;height:18px;border:1px solid var(--accent)}
  body.hud .load-panel::before{left:0;top:0;border-right:0;border-bottom:0}
  body.hud .load-panel::after{right:0;bottom:0;border-left:0;border-top:0}
  body.hud #loadPct{text-shadow:0 0 22px var(--accent)}${artCss}
</style></head><body class="${hud ? 'hud' : ''}">
<button id="gearBtn" title="settings" aria-label="settings">⚙</button>
<button id="menuBtn" title="menu" aria-label="pause menu" style="display:none">☰</button>
<div id="pause" hidden>
  <div class="pause-panel">
    <div class="pause-title">paused</div>
    <div id="pauseRoot">
      <button id="pcControls" class="pause-item">controls</button>
      <button id="pcSettings" class="pause-item">settings</button>
      <button id="pcEnd" class="pause-item">end simulation</button>
      <button id="pcResume" class="pause-item primary">return to battle</button>
    </div>
    <div id="pauseControls" hidden>
      <div id="padDiagram"></div>
      <dl class="ctl-rows" id="ctlRows"></dl>
      <button id="pcBack" class="pause-item">back</button>
    </div>
    <div id="pauseSettings" hidden>
      <div class="set-row" id="aiRow" style="display:none">
        <span class="set-label" style="flex-basis:70px">AI attack</span>
        <button id="aiBtn" title="wake or stand down the enemy suits (practice)">on</button>
      </div>
      <div id="setSlot"></div>
      <button id="pcBackS" class="pause-item">back</button>
    </div>
  </div>
</div>
<div id="settings" hidden>
  <div class="set-row" id="musicRow" style="display:none">
    <span class="set-label">music</span>
    <button id="musicBtn" title="toggle the shell music">on</button>
    <input id="musicVol" type="range" min="0" max="100" value="100" aria-label="music volume">
  </div>
  <div class="set-row">
    <span class="set-label">sfx</span>
    <button id="sfxBtn" title="toggle in-level sound effects">on</button>
    <input id="sfxVol" type="range" min="0" max="100" value="100" aria-label="sfx volume">
  </div>
  <div class="set-pad">
    <div class="set-row">
      <span class="set-label">pad</span>
      <button id="padBtn" title="toggle controller input in battle">on</button>
      <span id="padName" class="pad-name">no controller</span>
    </div>
    <div class="set-row">
      <span class="set-label">look</span>
      <input id="padSens" type="range" min="25" max="250" value="100" aria-label="controller look speed">
    </div>
    <div class="set-row">
      <span class="set-label">zone</span>
      <input id="padDead" type="range" min="0" max="40" value="15" aria-label="controller stick dead zone">
    </div>
    <div class="set-row">
      <span class="set-label">inv y</span>
      <button id="padInvY" title="invert the right stick's vertical look">off</button>
    </div>
  </div>
  <div class="set-save">
    <button id="exportBtn" title="download the save as a portable JSON file">export save</button>
    <button id="importBtn">import save</button>
    <input id="importFile" type="file" accept="application/json" style="display:none">
    <button id="resetBtn" title="wipe the save and start over">reset</button>
  </div>
</div>
<div id="notice"></div>
<div id="main"></div>
<iframe id="frame" title="level"></iframe>
<div id="loading"><div class="load-panel">
  <div class="load-label" id="loadLabel"></div>
  <div class="load-track"><div class="load-fill" id="loadBar"></div></div>
  <div class="load-foot"><span id="loadPct">00</span><span class="load-unit">%</span></div>
</div></div>
<div id="toast"></div>
<script>
// ---- the store kernel, generated reducers included (single source of truth) ----
const K = (${buildGameStoreKernel.toString()})();
const MANIFEST = ${JSON.stringify(manifest)};
const LEVELS = ${JSON.stringify(levelTable)};
const MENU = ${JSON.stringify(menu)};   // resolved menu entries (Start → Menu frame) or null
const LEVELS_ENTRY = MENU && MENU.find((en) => en.kind === 'levels');
const LEVEL_BY_REF = {};   // ref → level entry, so a menu 'mode' resolves its variant refs to launchable levels
for (const l of LEVELS) LEVEL_BY_REF[l.ref] = l;
const MUSIC = ${JSON.stringify(music)};   // resolved score { menu: src|null, battle: [src,…] } or null
const SETUP = ${JSON.stringify(setup)};   // resolved per-slice setup presentation (hangar/count) or null
// the DIFFICULTY pick (manifest.difficulty): engine ai-tuning tiers named in the game's own
// voice — rendered on the map step of piloted setups; the picked id rides params.difficulty.
const DIFFICULTY = MANIFEST.difficulty || null;

// ---- player settings (audio prefs) — persisted BESIDE the save, so reset keeps them ----
const SET_KEY = 'moj-game:' + ${JSON.stringify(manifest.title)} + ':settings';
let settings = { musicOn: true, musicVol: 1, sfxOn: true, sfxVol: 1, padOn: true, padSens: 1, padDead: 0.15, padInvY: false };
try { const s = JSON.parse(localStorage.getItem(SET_KEY) || 'null'); if (s && typeof s === 'object') settings = Object.assign(settings, s); } catch (e) { /* file:// quirk — session-only prefs */ }
function persistSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {} }

// ---- shell music: the menu track loops, the battle list rotates, world views are silent ----
let screen = 'start';   // start | menu | levels | setup | world | level | score
let musicOn = settings.musicOn, musicEl = null, battleIdx = 0, wantSrc = null;
// battle music holds for 5s AFTER a match begins (operator, 2026-07-30): armed at the game-ready
// handshake, cleared whenever we leave the level screen. During the delay the level plays on combat
// SFX alone. battleReady gates the 'level' branch of syncMusic; battleTimer is the pending arm.
let battleReady = false, battleTimer = 0;
// Each track is fetched ONCE per session into a blob URL. The beats.wav render is deterministic
// but served no-store, so without this the menu track re-renders (~10s) on every return and
// each battle track re-renders every rotation loop — the "slow to start". Prefetching kicks the
// render early (it runs while the player reads the start screen) and replays are then instant.
const trackCache = {};
function prefetchTrack(src) {
  if (!src) return null;
  if (trackCache[src]) return trackCache[src];
  const entry = { url: null, promise: null };
  entry.promise = fetch(src).then((r) => r.blob()).then((b) => { entry.url = URL.createObjectURL(b); return entry.url; }).catch(() => null);
  trackCache[src] = entry;
  return entry;
}
function battleTrack() { return MUSIC.battle[battleIdx % MUSIC.battle.length]; }
// music BED LEVEL: the score sits UNDER the game — combat SFX live in the level iframe and a
// full-volume soundtrack buries them. Battle tracks ride lowest; menu screens (no SFX to fight)
// a touch higher. Tunable per manifest: music.volume, or menuVolume / battleVolume overrides.
function musicVolFor(src) {
  const mv = MANIFEST.music || {};
  const battle = MUSIC && MUSIC.battle && MUSIC.battle.indexOf(src) >= 0;
  const v = battle ? (mv.battleVolume != null ? mv.battleVolume : (mv.volume != null ? mv.volume : 0.4))
    : (mv.menuVolume != null ? mv.menuVolume : (mv.volume != null ? mv.volume : 0.55));
  // the manifest's bed level is the CEILING; the player's settings slider scales under it.
  return Math.max(0, Math.min(1, v)) * settings.musicVol;
}
function ensureMusicEl() {
  if (musicEl) return musicEl;
  musicEl = new Audio();
  musicEl.preload = 'auto';
  musicEl.addEventListener('ended', () => {   // battle rotation: track end → next in the list
    if (screen === 'level' && battleReady && musicOn && MUSIC && MUSIC.battle.length) { battleIdx += 1; playSrc(battleTrack(), MUSIC.battle.length === 1); }
  });
  return musicEl;
}
function playSrc(src, loop) {
  wantSrc = src;
  const el = ensureMusicEl();
  const entry = prefetchTrack(src);
  const apply = (url) => {
    if (wantSrc !== src || !musicOn) return;   // screen or toggle changed while the blob loaded
    el.loop = loop;
    el.volume = musicVolFor(src);
    if (el._key !== src) { el.src = url; el._key = src; }
    el.play().catch(() => {});   // pre-gesture attempts fail silently; the next click retries
  };
  if (entry && entry.url) apply(entry.url);
  else if (entry) entry.promise.then((url) => { if (url) apply(url); });
}
function stopMusic() { wantSrc = null; if (musicEl) musicEl.pause(); }
function syncMusic() {
  if (!MUSIC || !musicOn) { stopMusic(); return; }
  if (screen === 'world') { stopMusic(); return; }   // the viewed world carries its own score
  if (screen === 'level') {
    // battle music waits out the 5s post-begin delay (battleReady) — silence under the combat SFX until then.
    if (battleReady && MUSIC.battle.length) playSrc(battleTrack(), MUSIC.battle.length === 1); else stopMusic();
    return;
  }
  if (MUSIC.menu) playSrc(MUSIC.menu, true); else stopMusic();
}
if (MUSIC && MUSIC.menu) prefetchTrack(MUSIC.menu);   // start the menu render at boot
function setScreen(s) {
  if (s !== 'level') { clearTimeout(battleTimer); battleReady = false; }
  screen = s; syncMusic(); syncMenuBtn();
  // menu.setupArt: the post-menu screens swap to the working-bay backdrop (see artCss)
  const sa = MANIFEST.menu && MANIFEST.menu.setupArt;
  if (sa) document.body.classList.toggle('bay-art', s === 'setup' || s === 'levels' || s === 'world');
}
if (MUSIC) {
  document.getElementById('musicRow').style.display = '';
  const mb = document.getElementById('musicBtn');
  const mv = document.getElementById('musicVol');
  mb.textContent = musicOn ? 'on' : 'off';
  mv.value = String(Math.round(settings.musicVol * 100));
  mb.addEventListener('click', () => {
    musicOn = settings.musicOn = !musicOn;
    mb.textContent = musicOn ? 'on' : 'off';
    persistSettings();
    syncMusic();
  });
  mv.addEventListener('input', () => {
    settings.musicVol = mv.value / 100;
    if (musicEl && wantSrc) musicEl.volume = musicVolFor(wantSrc);   // live re-level, no restart
    persistSettings();
  });
}
const SCHEMA = MANIFEST.store;
const SAVE_KEY = 'moj-game:' + ${JSON.stringify(manifest.title)};

// ---- persistence: localStorage feature-detected, in-memory fallback (visible) ----
const mem = {};
const storage = (function () {
  try { localStorage.setItem(SAVE_KEY + ':probe', '1'); localStorage.removeItem(SAVE_KEY + ':probe'); return localStorage; }
  catch (e) {
    const n = document.getElementById('notice');
    n.style.display = 'block';
    n.textContent = 'storage unavailable here (file:// quirk?) — this session will not persist. Export your save, or serve the folder with any static server.';
    return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  }
})();

let state, runLog;
function boot() {
  const raw = storage.getItem(SAVE_KEY);
  if (raw) {
    const p = K.parseSave(raw);
    if (p.ok) { state = p.save.storeState; runLog = p.save.runLog; return; }
    console.error('save rejected, starting fresh:', p.errors);
  }
  state = K.createStore(SCHEMA);
  runLog = [];
}
function persist() { storage.setItem(SAVE_KEY, K.makeSave(state, runLog)); }
boot();

// ---- UI ----
const main = document.getElementById('main');
const frame = document.getElementById('frame');
let session = null;   // { level, params, seed } while a level runs

// ---- the settings gear (menu screens): click opens the floating panel, click-away closes.
// During battle the gear hides — settings live in the ☰ pause menu instead (see embedSettings).
const gearBtn = document.getElementById('gearBtn');
const setPanel = document.getElementById('settings');
gearBtn.addEventListener('click', (e) => { e.stopPropagation(); setPanel.hidden = !setPanel.hidden; });
setPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { if (!setPanel.classList.contains('embedded')) setPanel.hidden = true; });
// adopt the ONE settings element into the pause menu's sheet and back — same inputs, same
// handlers, no state to mirror between two copies.
function embedSettings() {
  setPanel.classList.add('embedded');
  document.getElementById('setSlot').appendChild(setPanel);
  setPanel.hidden = false;
}
function unembedSettings() {
  if (!setPanel.classList.contains('embedded')) return;
  setPanel.classList.remove('embedded');
  document.body.appendChild(setPanel);
  setPanel.hidden = true;
}

// ---- sfx prefs: pushed over the audio sidecar into whatever world the frame hosts ----
// (a level's combat cues, a hangar's own score). Sent on every frame load AND on the
// game-ready handshake, so prefs survive level hops; the world applies them to its beats
// engine whenever its audio unlocks.
const sfxBtn = document.getElementById('sfxBtn');
const sfxVol = document.getElementById('sfxVol');
sfxBtn.textContent = settings.sfxOn ? 'on' : 'off';
sfxVol.value = String(Math.round(settings.sfxVol * 100));
function pushSfx() {
  try { if (frame.contentWindow) frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_AUDIO)}, on: settings.sfxOn, volume: settings.sfxVol }, '*'); } catch (e) { /* opaque frame */ }
}
// silence a WORLD's own soundtrack playing inside the frame (e.g. the hangar Vigil) — the world
// honours game-audio {on:false} by suspending its beats context. Posted BEFORE we tear the frame
// down or launch a battle, so a hangar score can't bleed under the game loading screen (operator,
// 2026-07-30). The next real content re-enables audio on its own frame-load (pushSfx).
function muteFrameAudio() {
  try { if (frame.contentWindow) frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_AUDIO)}, on: false, volume: 0 }, '*'); } catch (e) { /* opaque frame */ }
}
sfxBtn.addEventListener('click', () => { settings.sfxOn = !settings.sfxOn; sfxBtn.textContent = settings.sfxOn ? 'on' : 'off'; persistSettings(); pushSfx(); });
sfxVol.addEventListener('input', () => { settings.sfxVol = sfxVol.value / 100; persistSettings(); pushSfx(); });
frame.addEventListener('load', pushSfx);

// ---- controller options: prefs pushed over the gamepad sidecar into whatever world the frame
// hosts (the world polls navigator.getGamepads itself — the shell only carries the knobs).
// Sent on every frame load AND on change, exactly like the sfx prefs. lookScale rides as the
// world's px-per-frame-at-full-deflection equivalent (base 18, scaled by the look slider).
const padBtn = document.getElementById('padBtn');
const padNameEl = document.getElementById('padName');
const padSens = document.getElementById('padSens');
const padDead = document.getElementById('padDead');
const padInvY = document.getElementById('padInvY');
padBtn.textContent = settings.padOn ? 'on' : 'off';
padSens.value = String(Math.round(settings.padSens * 100));
padDead.value = String(Math.round(settings.padDead * 100));
padInvY.textContent = settings.padInvY ? 'on' : 'off';
function pushPad() {
  try {
    if (frame.contentWindow) frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_GAMEPAD)}, on: settings.padOn, deadZone: settings.padDead, lookScale: 18 * settings.padSens, invertY: settings.padInvY }, '*');
  } catch (e) { /* opaque frame */ }
}
padBtn.addEventListener('click', () => { settings.padOn = !settings.padOn; padBtn.textContent = settings.padOn ? 'on' : 'off'; persistSettings(); pushPad(); });
padSens.addEventListener('input', () => { settings.padSens = padSens.value / 100; persistSettings(); pushPad(); });
padDead.addEventListener('input', () => { settings.padDead = padDead.value / 100; persistSettings(); pushPad(); });
padInvY.addEventListener('click', () => { settings.padInvY = !settings.padInvY; padInvY.textContent = settings.padInvY ? 'on' : 'off'; persistSettings(); pushPad(); });
frame.addEventListener('load', pushPad);
// the detected-pad name chip: connect/disconnect events + a boot scan. Browsers only surface a
// pad after its first button press — the placeholder says so instead of reading as broken.
function syncPadName() {
  let id = null;
  if (navigator.getGamepads) { const ps = navigator.getGamepads(); for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { id = ps[i].id; break; } }
  padNameEl.textContent = id ? id.replace(/\\s*\\(.*$/, '').slice(0, 40) : 'no controller — press any button';
  padNameEl.classList.toggle('on', !!id);
}
window.addEventListener('gamepadconnected', syncPadName);
window.addEventListener('gamepaddisconnected', syncPadName);
syncPadName();
// gamepad START (standard button 9) toggles the pause menu during battle — the SHELL polls it
// (the world deliberately leaves start alone), so the pad can pause and resume even while the
// level underneath is frozen. Rising-edge, level screens only.
let padStartPrev = false;
(function padPausePoll() {
  requestAnimationFrame(padPausePoll);
  if (!settings.padOn || screen !== 'level' || !navigator.getGamepads) { padStartPrev = false; return; }
  let dn = false;
  const ps = navigator.getGamepads();
  for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (p && p.connected && p.buttons[9] && p.buttons[9].pressed) { dn = true; break; } }
  if (dn && !padStartPrev) setGamePaused(!gamePaused);
  padStartPrev = dn;
})();

// ---- pause menu (level screens only): ☰ freezes the level over the pause sidecar and raises
// the overlay — controls / end simulation / return to battle. The Controls sheet renders the
// legend the level replies with (MSG_CONTROLS), so it teaches exactly this level's keys.
const menuBtn = document.getElementById('menuBtn');
const pauseEl = document.getElementById('pause');
const pauseRoot = document.getElementById('pauseRoot');
const pauseCtl = document.getElementById('pauseControls');
const pauseSet = document.getElementById('pauseSettings');
let gamePaused = false, ctlRows = null;
function renderCtlRows() {
  const dl = document.getElementById('ctlRows');
  dl.innerHTML = '';
  const rows = (ctlRows && ctlRows.length) ? ctlRows
    : [['W A S D / arrows', 'move'], ['mouse', 'look'], ['Space', 'jump']];   // no reply yet → the universal floor
  for (const r of rows) {
    const dt = document.createElement('dt'); dt.textContent = r[0]; dl.appendChild(dt);
    const dd = document.createElement('dd'); dd.textContent = r[1]; dl.appendChild(dd);
  }
}
function setGamePaused(on) {
  gamePaused = on;
  pauseEl.hidden = !on;
  unembedSettings();
  pauseRoot.hidden = false; pauseCtl.hidden = true; pauseSet.hidden = true;   // always reopen at the root list
  document.querySelector('.pause-panel').classList.remove('wide');            // the controls sheet widened it
  try { if (frame.contentWindow) frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_PAUSE)}, on: on }, '*'); } catch (e) { /* opaque frame */ }
}

// ---- the controller diagram (Controls sheet): a top-down pad drawn as inline SVG with callout
// lanes for every binding. Vector, self-contained, and glyph-aware: a Sony pad id reads as
// PS (L1/R1 · \\u25B3\\u25EF\\u2715\\u25A1, convention colours), anything else as Xbox letters. No pad yet →
// the PS read (this operator's pad). Rebuilt each open so a hot-swapped pad relabels itself.
function padSony() {
  if (navigator.getGamepads) {
    const ps = navigator.getGamepads();
    // 'Wireless Controller' alone is the DualShock's id string, but Xbox pads id as
    // 'Xbox Wireless Controller' — require the ambiguous term to NOT carry the Xbox marks.
    for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].connected) { const id = ps[i].id || ''; return /054c|sony|dual\\s?shock|dual\\s?sense/i.test(id) || (/wireless controller/i.test(id) && !/xbox|045e/i.test(id)); }
  }
  return true;
}
function renderPadDiagram() {
  const sony = padSony();
  const N = sony ? { l1: 'L1', l2: 'L2', r1: 'R1', r2: 'R2', sel: 'SHARE', st: 'OPTIONS' }
                 : { l1: 'LB', l2: 'LT', r1: 'RB', r2: 'RT', sel: 'VIEW', st: 'MENU' };
  const F = sony ? { t: ['\\u25B3', '#58c98f'], r: ['\\u25EF', '#e07a7a'], b: ['\\u2715', '#7aa7e0'], l: ['\\u25A1', '#d98bc7'] }
                 : { t: ['Y', '#e0c05a'], r: ['B', '#e07a7a'], b: ['A', '#58c98f'], l: ['X', '#7aa7e0'] };
  const LBL = (x, y, anchor, btn, txt, btnCol) =>
    '<text x="' + x + '" y="' + y + '" text-anchor="' + anchor + '" font-size="10" fill="var(--dim)">'
    + '<tspan fill="' + (btnCol || 'var(--accent)') + '" font-weight="700">' + btn + '</tspan>\\u2002' + txt + '</text>';
  const LN = (pts) => '<polyline points="' + pts + '" fill="none" stroke="rgba(122,160,210,.35)" stroke-width="1"/>';
  const FACE = (cx, cy, g) =>
    '<circle cx="' + cx + '" cy="' + cy + '" r="9" fill="rgba(10,16,26,.6)" stroke="' + g[1] + '" stroke-width="1.4"/>'
    + '<text x="' + cx + '" y="' + (cy + 3.2) + '" text-anchor="middle" font-size="9" fill="' + g[1] + '">' + g[0] + '</text>';
  const svg =
    '<svg viewBox="0 0 600 216" role="img" aria-label="controller layout">'
    // triggers + bumpers (top lanes)
    + '<rect x="176" y="24" width="40" height="12" rx="6" fill="#26344e" stroke="#46587a"/>'
    + '<rect x="344" y="24" width="40" height="12" rx="6" fill="#26344e" stroke="#46587a"/>'
    + '<rect x="176" y="42" width="40" height="10" rx="5" fill="#2c3c58" stroke="#46587a"/>'
    + '<rect x="344" y="42" width="40" height="10" rx="5" fill="#2c3c58" stroke="#46587a"/>'
    // body + grips
    + '<rect x="168" y="58" width="224" height="100" rx="32" fill="rgba(18,28,46,.7)" stroke="#3a4d6e"/>'
    + '<rect x="174" y="128" width="36" height="70" rx="18" fill="rgba(18,28,46,.7)" stroke="#3a4d6e" transform="rotate(-14 192 163)"/>'
    + '<rect x="350" y="128" width="36" height="70" rx="18" fill="rgba(18,28,46,.7)" stroke="#3a4d6e" transform="rotate(14 368 163)"/>'
    // d-pad
    + '<rect x="211" y="84" width="14" height="32" rx="3" fill="#2c3c58" stroke="#46587a"/>'
    + '<rect x="202" y="93" width="32" height="14" rx="3" fill="#2c3c58" stroke="#46587a"/>'
    // select / start pills
    + '<rect x="256" y="78" width="8" height="16" rx="4" fill="#2c3c58" stroke="#46587a"/>'
    + '<rect x="296" y="78" width="8" height="16" rx="4" fill="#2c3c58" stroke="#46587a"/>'
    // face buttons (PS positions: top / right / bottom / left)
    + FACE(342, 80, F.t) + FACE(364, 100, F.r) + FACE(342, 120, F.b) + FACE(320, 100, F.l)
    // sticks
    + '<circle cx="248" cy="138" r="16" fill="rgba(10,16,26,.6)" stroke="#5a7194" stroke-width="1.4"/><circle cx="248" cy="138" r="7" fill="#31445f"/>'
    + '<circle cx="312" cy="138" r="16" fill="rgba(10,16,26,.6)" stroke="#5a7194" stroke-width="1.4"/><circle cx="312" cy="138" r="7" fill="#31445f"/>'
    // left callout lanes
    + LN('176,30 156,30') + LBL(150, 33, 'end', N.l2, 'boost \\u00b7 tap-tap dodge')
    + LN('176,47 156,47') + LBL(150, 50, 'end', N.l1, 'kneel / descend')
    + LN('202,100 156,100') + LBL(150, 103, 'end', 'D-pad \\u2191', 'switch suit')
    + LN('232,138 156,141') + LBL(150, 144, 'end', 'L\\u25CF', 'move')
    // right callout lanes
    + LN('384,30 404,30') + LBL(410, 33, 'start', N.r2, 'fire')
    + LN('384,47 404,47') + LBL(410, 50, 'start', N.r1, 'weapons \\u00b7 tap cycle \\u00b7 hold selector', 'var(--accent2)')
    + LN('320,89 328,60 404,60') + LBL(410, 63, 'start', F.l[0], N.r1 + '+' + F.l[0] + ' main weapon', F.l[1])
    + LN('351,78 404,82') + LBL(410, 85, 'start', F.t[0], 'tackle \\u00b7 ' + N.r1 + '+' + F.t[0] + ' main melee', F.t[1])
    + LN('373,100 404,102') + LBL(410, 105, 'start', F.r[0], 'kneel / descend', F.r[1])
    + LN('351,122 404,122') + LBL(410, 125, 'start', F.b[0], 'jump / ascend', F.b[1])
    + LN('328,140 404,145') + LBL(410, 148, 'start', 'R\\u25CF', 'look / aim')
    // bottom row: the centre pills, no lanes needed
    + '<text x="280" y="207" text-anchor="middle" font-size="10" fill="var(--dim)">'
    + '<tspan fill="var(--accent)" font-weight="700">' + N.sel + '</tspan>\\u2002AI on / off\\u2003\\u00b7\\u2003'
    + '<tspan fill="var(--accent)" font-weight="700">' + N.st + '</tspan>\\u2002pause</text>'
    + '</svg>';
  document.getElementById('padDiagram').innerHTML = svg;
}
function syncMenuBtn() {
  // battle: ☰ replaces ⚙ (settings ride inside the pause menu); everywhere else the gear stands
  menuBtn.style.display = screen === 'level' ? '' : 'none';
  gearBtn.style.display = screen === 'level' ? 'none' : '';
  if (screen === 'level' && !setPanel.classList.contains('embedded')) setPanel.hidden = true;
  if (screen !== 'level' && gamePaused) { gamePaused = false; pauseEl.hidden = true; unembedSettings(); }   // frame is gone — just drop the overlay
}
menuBtn.addEventListener('click', () => setGamePaused(!gamePaused));
document.getElementById('pcResume').addEventListener('click', () => setGamePaused(false));
document.getElementById('pcEnd').addEventListener('click', () => { setGamePaused(false); renderHome(); });   // end simulation → HOME, not the level list (operator, 2026-08-03) — matches where a finished match lands
document.getElementById('pcControls').addEventListener('click', () => { renderCtlRows(); renderPadDiagram(); document.querySelector('.pause-panel').classList.add('wide'); pauseRoot.hidden = true; pauseCtl.hidden = false; });
document.getElementById('pcBack').addEventListener('click', () => { document.querySelector('.pause-panel').classList.remove('wide'); pauseRoot.hidden = false; pauseCtl.hidden = true; });
document.getElementById('pcSettings').addEventListener('click', () => { embedSettings(); pauseRoot.hidden = true; pauseSet.hidden = false; });
document.getElementById('pcBackS').addEventListener('click', () => { unembedSettings(); pauseSet.hidden = true; pauseRoot.hidden = false; });

// ---- practice AI switch: the level's controls reply carries ai:{on} when it offers the switch
// (practice bouts only); the row renders in the pause settings sheet and a click posts the
// DESIRED state over the game-ai sidecar — the world converges via its own input edge, and each
// pause re-opens with the level's live state (the reply re-syncs it).
let aiState = null;   // null = this level offers no switch (row hidden)
const aiRow = document.getElementById('aiRow');
const aiBtn = document.getElementById('aiBtn');
function syncAiRow() {
  aiRow.style.display = aiState == null ? 'none' : '';
  if (aiState != null) aiBtn.textContent = aiState ? 'on' : 'off';
}
aiBtn.addEventListener('click', () => {
  if (aiState == null) return;
  aiState = !aiState;
  syncAiRow();
  try { if (frame.contentWindow) frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_AI)}, on: aiState }, '*'); } catch (e) { /* opaque frame */ }
});

// ---- loading overlay: a time-eased % that COMPLETES on the real ready signal ----
// (level = the game-ready postMessage; world-view = the iframe load event). The bar eases
// asymptotically toward ~92% over the expected cold-load time, then snaps to 100 and fades —
// the standard game loading-bar contract (honest completion, no fake finish). The thin bar
// + percentage, with a quiet context label naming what is being loaded; a hard cap un-traps
// the user if a signal never arrives.
const loadEl = document.getElementById('loading');
const loadBar = document.getElementById('loadBar');
const loadPctEl = document.getElementById('loadPct');
const loadLabelEl = document.getElementById('loadLabel');
let loadRAF = 0, loadCap = 0, loadPct = 0, loadT0 = 0, loadDone = true, onFrameLoad = null;
const nowMs = () => (window.performance && performance.now ? performance.now() : 0);
function setLoadPct(p) {
  const v = Math.max(0, Math.min(100, p));
  loadBar.style.width = v.toFixed(1) + '%';
  loadPctEl.textContent = String(Math.round(v)).padStart(2, '0');
}
function showLoading(label) {
  cancelAnimationFrame(loadRAF); clearTimeout(loadCap);
  loadPct = 0; loadDone = false; loadT0 = nowMs();
  loadLabelEl.textContent = label || '';
  setLoadPct(0);
  loadEl.classList.remove('leaving');
  loadEl.style.display = 'flex';
  const EXPECT = 9000;   // measured cold world load (~9s); the ease-ceiling is calibrated to it
  const tick = () => {
    if (loadDone) return;
    const t = nowMs() - loadT0;
    const target = 92 * (1 - Math.exp(-t / (EXPECT * 0.55)));   // fast start, asymptotic to 92
    loadPct += (target - loadPct) * 0.12;
    setLoadPct(loadPct);
    loadRAF = requestAnimationFrame(tick);
  };
  loadRAF = requestAnimationFrame(tick);
  loadCap = setTimeout(() => finishLoading(), 30000);
}
function finishLoading() {
  if (loadDone) return;
  loadDone = true;
  cancelAnimationFrame(loadRAF); clearTimeout(loadCap);
  setLoadPct(100);
  loadEl.classList.add('leaving');
  setTimeout(() => { if (loadDone) { loadEl.style.display = 'none'; loadEl.classList.remove('leaving'); } }, 460);
}
function hideLoadingNow() {   // navigating away mid-load — drop the overlay without the flourish
  loadDone = true;
  cancelAnimationFrame(loadRAF); clearTimeout(loadCap);
  loadEl.style.display = 'none'; loadEl.classList.remove('leaving');
}
// one shared iframe load listener; a nav arms onFrameLoad, this fires it once and disarms.
frame.addEventListener('load', () => { const f = onFrameLoad; onFrameLoad = null; if (f) f(); });

function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = err ? 'err' : '';
  t.style.display = 'block';
  clearTimeout(toast._h);
  toast._h = setTimeout(() => { t.style.display = 'none'; }, err ? 8000 : 3500);
}

function sliceKindOf(name) { const sl = SCHEMA.slices.find((s) => s.name === name); return sl && sl.kind; }
function completedResult(ref) {
  for (const sl of SCHEMA.slices) if (sl.kind === 'progression' && state[sl.name].completed[ref]) return state[sl.name].completed[ref];
  return null;
}

function closeFrame() {
  onFrameLoad = null;      // the about:blank load must not fire a stale ready handler
  muteFrameAudio();        // suspend a world's own soundtrack (e.g. hangar Vigil) BEFORE the frame tears down
  hideLoadingNow();
  frame.style.display = 'none';
  frame.src = 'about:blank';
}

// ---- the game frame (opt-in via manifest.menu): Start screen → main menu ----
function renderStart() {
  session = null;
  setScreen('start');
  closeFrame();
  main.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'screen';
  // menu.art: the image IS the title card — the text title/tagline still render (semantics +
  // spacing) but GHOSTED transparent, and the stack parks low, like a proper game title
  // screen. Artless games keep the pre-art text treatment untouched.
  const art = MANIFEST.menu && MANIFEST.menu.art;
  if (art) s.classList.add('art-start');
  const h = document.createElement('h2');
  h.className = art ? 'gametitle ghost' : 'gametitle';
  h.textContent = MANIFEST.title;
  s.appendChild(h);
  if (MANIFEST.menu && MANIFEST.menu.tagline) {
    const t = document.createElement('p');
    t.className = art ? 'tagline ghost' : 'tagline';
    t.textContent = MANIFEST.menu.tagline;
    s.appendChild(t);
  }
  const btn = document.createElement('button');
  btn.className = 'primary big';
  btn.textContent = 'start';
  btn.addEventListener('click', renderMenu);
  s.appendChild(btn);
  main.appendChild(s);
}

// the MENU frame — a NESTED tree (no arena-specific code; the manifest declares the shape).
// renderMenu() shows the ROOT; a kind:'menu' entry opens a submenu screen (a back button returns
// home); kind:'mode' opens the setup for a level or a set of map-variant levels; kind:'levels'
// opens the flat level list; kind:'world' iframes a stored world; kind:'soon' is inert. Nesting is
// the two-step mode picker (e.g. Single Player / AI Spectate → Solo Duel / Team Battle / Free for all).
function renderMenuScreen(entries, opts) {
  opts = opts || {};
  session = null;
  setScreen('menu');
  closeFrame();
  main.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'screen';
  // menu.art: menu screens ride low over the title card too; the ROOT heading (the game
  // title — already painted in the art) ghosts transparent, submenu headings stay visible.
  const art = MANIFEST.menu && MANIFEST.menu.art;
  if (art) s.classList.add('art-menu');
  const h = document.createElement('h2');
  h.className = art && !opts.heading ? 'gametitle ghost' : 'gametitle';
  h.style.fontSize = '20px';
  h.textContent = opts.heading || MANIFEST.title;
  s.appendChild(h);
  const backHere = () => renderMenuScreen(entries, opts);   // "return to THIS screen" closure for children
  for (const en of entries) {
    const btn = document.createElement('button');
    btn.className = 'menu-entry';
    btn.textContent = en.title;
    if (en.kind === 'soon') {   // an inert coming-soon placeholder
      const tag = document.createElement('span');
      tag.className = 'soon-tag';
      tag.textContent = 'coming soon';
      btn.appendChild(tag);
    }
    if (en.subtitle) {
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = en.subtitle;
      btn.appendChild(sub);
    }
    if (en.kind === 'soon') { btn.disabled = true; s.appendChild(btn); continue; }
    btn.addEventListener('click', () => {
      if (en.kind === 'menu') renderMenuScreen(en.entries, { heading: en.title, back: backHere, backLabel: opts.back ? 'back' : 'back to home' });
      else if (en.kind === 'mode') renderModeSetup(en, backHere);
      else if (en.kind === 'levels') renderLevels(backHere);
      else renderWorldView(en, backHere);
    });
    s.appendChild(btn);
  }
  if (opts.back) {
    const back = document.createElement('button');
    back.textContent = opts.backLabel || 'back';
    back.style.marginTop = '6px';
    back.addEventListener('click', opts.back);
    s.appendChild(back);
  }
  main.appendChild(s);
}
function renderMenu() { renderMenuScreen(MENU, {}); }

// a kind:'mode' menu entry: open the setup screen for its level (or its SET of map-variant levels —
// same picks, different world). Resolves the variant refs to launchable levels; setup adds the map
// picker when there's more than one. back returns to the submenu the mode was chosen from.
function renderModeSetup(en, back) {
  const variants = (en.variants || []).map((v) => ({ ref: v.ref, label: v.label || null, shot: v.shot || null, lv: LEVEL_BY_REF[v.ref] })).filter((v) => v.lv);
  if (!variants.length) { toast('mode "' + en.title + '" has no playable level', true); return; }
  renderSetup(variants[0].lv, { variants: variants, back: back, title: en.title });
}

// a kind:'world' menu entry (e.g. a hangar): iframe the stored world, no store wire — the
// message handler ignores it (session stays null). back returns to the screen it opened from.
function renderWorldView(en, back) {
  session = null;
  setScreen('world');
  main.innerHTML = '<h2 style="font-size:14px;color:#9cc4ff">' + en.title + '</h2>';
  const b = document.createElement('button');
  b.textContent = 'back to menu';
  b.addEventListener('click', back || renderMenu);
  main.appendChild(b);
  // a world-view has no game bridge — the iframe LOAD event is its ready signal.
  onFrameLoad = () => finishLoading();
  showLoading('loading ' + en.title);
  frame.style.display = 'block';
  frame.src = en.src;
}

// the level list (+ store card). With a menu this lives behind the kind:'levels' entry;
// without one it IS the home screen (the pre-menu behavior, unchanged).
function renderLevels(back) {
  session = null;
  setScreen('levels');
  closeFrame();
  const heading = LEVELS_ENTRY ? LEVELS_ENTRY.title : 'levels';
  main.innerHTML = '<h2 style="font-size:14px;color:#9cc4ff">' + heading + '</h2>';
  for (const lv of LEVELS) {
    const open = K.evalGate(SCHEMA, state, lv.gate);
    const row = document.createElement('div');
    row.className = 'level';
    const done = completedResult(lv.ref);
    row.innerHTML = '<span class="name">' + lv.title + '</span>'
      + (done ? '<span class="done">' + done + '</span>' : '')
      + (open ? '' : '<span class="lock">locked — ' + (lv.gate.completed ? 'complete ' + lv.gate.completed : 'needs ' + lv.gate.flag) + '</span>');
    const btn = document.createElement('button');
    btn.textContent = 'play';
    btn.disabled = !open;
    btn.className = 'primary';
    btn.addEventListener('click', () => renderSetup(lv, { back: () => renderLevels(back) }));
    row.appendChild(btn);
    main.appendChild(row);
  }
  const store = document.createElement('div');
  store.className = 'card';
  store.innerHTML = '<h3>store</h3><pre>' + JSON.stringify(state, null, 2) + '</pre>'
    + '<div style="font-size:12px;color:#8fa5c8">' + runLog.length + ' session' + (runLog.length === 1 ? '' : 's') + ' in the run log</div>';
  main.appendChild(store);
  if (MENU) {
    const b = document.createElement('button');
    b.textContent = 'back to menu';
    b.addEventListener('click', back || renderMenu);
    main.appendChild(b);
  }
}

// home = where boot and save-management land: the Start screen when the game declares a
// menu, the plain level list otherwise (the pre-menu shell, byte-for-byte in behavior).
function renderHome() { if (MENU) renderStart(); else renderLevels(); }

// warm the hangar preview bakes from BOOT: a preview World is baked server-side on its first
// request (then cached in-process), which can take a minute per suit on a cold server — so
// start the ovens while the player is still on the start screen / menus, ONE at a time (a
// live click must never queue behind a stampede of warm fetches). Bodies are cancelled once
// headers land — the server-side bake (the expensive part) is already done and cached.
(function warmSetupPreviews() {
  if (!SETUP || typeof fetch !== 'function') return;
  const urls = [];
  for (const s in SETUP) {
    const cards = SETUP[s] && SETUP[s].cards;
    if (cards) for (const id in cards) { if (cards[id].preview && urls.indexOf(cards[id].preview) < 0) urls.push(cards[id].preview); }
  }
  if (!urls.length) return;
  let i = 0;
  const next = () => {
    if (i >= urls.length) return;
    fetch(urls[i++])
      .then((r) => { try { if (r.body && r.body.cancel) r.body.cancel(); } catch (e) { /* cache is warm either way */ } })
      .catch(() => {})
      .then(() => setTimeout(next, 250));
  };
  setTimeout(next, 1500);   // let the shell paint + the menu track prefetch go first
})();

// seeded dice for the shell's own draws (the count pick) — no Math.random by doctrine; the
// stream is keyed to the NEXT session seed so a draw is deterministic per save state yet
// reshuffles every session.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function drawSeeded(ids, n) {
  const rnd = mulberry32(runLog.length + 1);
  const pool = ids.slice(), out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

// the HANGAR single-pick (setup style 'hangar'): a rail of portrait cards, and the selected
// member large in a side panel — its preview World self-rotating in an iframe, stats beside it.
// Returns a picker whose chosen() is the one selected member.
function renderHangarPick(c, pane) {
  const pres = SETUP[c.slice];
  const roster = state[c.slice].roster;
  const ids = Object.keys(roster);
  const wrap = document.createElement('div');
  wrap.className = 'card';
  const h = document.createElement('h3');
  h.textContent = pres.label || (c.slice + ' — choose one');
  wrap.appendChild(h);
  if (!ids.length) {
    wrap.innerHTML += '<div style="font-size:12px;color:#8fa5c8">nothing to pick — the ' + c.slice + ' roster is empty</div>';
    pane.appendChild(wrap);
    return { c, kind: 'party', chosen: () => [] };
  }
  const row = document.createElement('div'); row.className = 'hangar';
  // section 1 — the selector STRIP: a horizontal rail with ‹ › pagers that only appear once
  // the roster overflows the row (the "next batch" carousel affordance, ready for more suits).
  const strip = document.createElement('div'); strip.className = 'hangar-strip';
  const rail = document.createElement('div'); rail.className = 'hangar-rail';
  const pagePrev = document.createElement('button'); pagePrev.type = 'button'; pagePrev.className = 'rail-page'; pagePrev.textContent = '‹'; pagePrev.title = 'previous suits';
  const pageNext = document.createElement('button'); pageNext.type = 'button'; pageNext.className = 'rail-page'; pageNext.textContent = '›'; pageNext.title = 'more suits';
  pagePrev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth, behavior: 'smooth' }));
  pageNext.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth, behavior: 'smooth' }));
  function syncPagers() {
    if (!rail.isConnected) { window.removeEventListener('resize', syncPagers); return; }
    const over = rail.scrollWidth > rail.clientWidth + 4;
    pagePrev.style.display = over ? '' : 'none';
    pageNext.style.display = over ? '' : 'none';
  }
  window.addEventListener('resize', syncPagers);
  strip.appendChild(pagePrev); strip.appendChild(rail); strip.appendChild(pageNext);
  // section 2 — the stage: full-height turntable left, name/stats/livery right
  const stage = document.createElement('div'); stage.className = 'hangar-stage';
  const view = document.createElement('div'); view.className = 'hangar-view';
  const frameEl = document.createElement('iframe'); frameEl.title = 'suit preview';
  const meta = document.createElement('div'); meta.className = 'hangar-side';
  const nameEl = document.createElement('div'); nameEl.className = 'nm';
  const statsEl = document.createElement('dl'); statsEl.className = 'stat-rows';
  const blurbEl = document.createElement('div'); blurbEl.style.cssText = 'font-size:12px;color:var(--dim)';
  // livery swatches (z-series suits): repaint the turntable onto another shelf wear; the pick
  // rides the launch params beside the suit id.
  const liveryWrap = document.createElement('div');
  const liveryLbl = document.createElement('div'); liveryLbl.className = 'livery-label'; liveryLbl.textContent = 'livery';
  const liveryRow = document.createElement('div'); liveryRow.className = 'livery-row';
  liveryWrap.appendChild(liveryLbl); liveryWrap.appendChild(liveryRow);
  // a preview World is baked server-side on first request (then cached) — a cold pane reads
  // black for a while, so tell the player instead of looking broken. (The bakes themselves
  // are warmed from shell BOOT — see warmSetupPreviews — so by setup time most are ready.
  // A fresh LIVERY is a fresh bake too, so the note re-shows on a swatch change.)
  const prevNote = document.createElement('div');
  prevNote.style.cssText = 'font-size:11px;color:var(--dim);opacity:.85';
  prevNote.textContent = 'preview is baking — the first open of a suit (or a new livery) can take a minute';
  meta.appendChild(nameEl); meta.appendChild(statsEl); meta.appendChild(blurbEl); meta.appendChild(liveryWrap); meta.appendChild(prevNote);
  view.appendChild(frameEl);
  stage.appendChild(view); stage.appendChild(meta);
  frameEl.addEventListener('load', () => { prevNote.style.display = 'none'; frameEl.style.opacity = '1'; });
  let sel = ids[0];
  const cards = {};
  const liveryPick = {};   // per-suit chosen wear; unset → the card's detected current livery
  function previewUrl(card, id) {
    const pick = liveryPick[id] || card.livery;
    // a livery with its OWN preview turntable (per-livery bake) points the iframe straight at it, so
    // the carousel repaints on a swatch pick; otherwise fall back to the card's default preview.
    const lv = (card.liveries || []).find((l) => l.id === pick);
    return (lv && lv.preview) || card.preview;
  }
  function pointPreview(card, id) {
    if (!card.preview) { frameEl.style.display = 'none'; prevNote.style.display = 'none'; return; }
    frameEl.style.display = '';
    const url = previewUrl(card, id);
    if (frameEl.dataset.src !== url) {
      frameEl.style.opacity = '.45'; prevNote.style.display = '';   // dim until this preview's load fires
      frameEl.src = url; frameEl.dataset.src = url;
    }
  }
  function renderLivery(card, id) {
    liveryRow.innerHTML = '';
    const list = Array.isArray(card.liveries) ? card.liveries : [];
    liveryWrap.style.display = list.length > 1 ? '' : 'none';
    const cur = liveryPick[id] || card.livery;
    for (const l of list) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'livery-chip' + (l.id === cur ? ' sel' : '');
      chip.style.background = l.hex;
      chip.title = l.id;
      chip.setAttribute('aria-label', 'livery ' + l.id);
      chip.addEventListener('click', () => { liveryPick[id] = l.id; renderLivery(card, id); pointPreview(card, id); });
      liveryRow.appendChild(chip);
    }
  }
  function select(id) {
    sel = id;
    for (const k in cards) cards[k].classList.toggle('sel', k === id);
    const card = (pres.cards && pres.cards[id]) || {};
    nameEl.textContent = roster[id].name || id;
    pointPreview(card, id);
    renderLivery(card, id);
    statsEl.innerHTML = '';
    const st = card.stats || {};
    for (const k of Object.keys(st)) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = String(st[k]);
      statsEl.appendChild(dt); statsEl.appendChild(dd);
    }
    blurbEl.textContent = card.blurb || '';
  }
  for (const id of ids) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const card = (pres.cards && pres.cards[id]) || {};
    btn.className = card.portrait ? 'suit-card' : 'suit-card no-art';
    if (card.portrait) {
      const img = document.createElement('img');
      img.src = card.portrait; img.alt = roster[id].name || id; img.loading = 'lazy';
      btn.appendChild(img);
    }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = roster[id].name || id;
    btn.appendChild(nm);
    btn.addEventListener('click', () => select(id));
    cards[id] = btn;
    rail.appendChild(btn);
  }
  row.appendChild(strip); row.appendChild(stage);
  wrap.appendChild(row);
  pane.appendChild(wrap);
  select(sel);
  requestAnimationFrame(syncPagers);   // measured after layout — pagers only when the rail overflows
  return {
    c, kind: 'party', chosen: () => [sel],
    // the picked wear for a chosen suit (its current livery when untouched) — startLevel rides
    // it into the launch params beside the roster entry.
    liveryOf: (id) => { const card = (pres.cards && pres.cards[id]) || {}; return liveryPick[id] || card.livery || null; },
  };
}

// the COUNT pick (setup style 'count'): choose HOW MANY; launch draws that many roster members
// with the seeded dice — the individual seats are interchangeable, so only the count is asked.
function renderCountPick(c, pane) {
  const pres = SETUP[c.slice];
  const roster = state[c.slice].roster;
  const ids = Object.keys(roster);
  const max = Math.max(1, Math.min(c.pick.max || ids.length, ids.length));
  // FIXED draw (pres.fixed): the count isn't the player's to choose — a fixed number is drawn at
  // random every sortie (a team battle's teammates / enemies). No buttons; just the blurb.
  const fixed = Number.isFinite(pres.fixed) ? Math.max(1, Math.min(pres.fixed, ids.length)) : null;
  let n = fixed != null ? fixed : Math.min(2, max);   // opening default mirrors the standalone preset (two rivals)
  const wrap = document.createElement('div');
  wrap.className = 'card';
  const h = document.createElement('h3');
  h.textContent = pres.label || (c.slice + (fixed != null ? '' : ' — how many'));
  wrap.appendChild(h);
  if (fixed == null) {
    const row = document.createElement('div'); row.className = 'count-pick';
    const btns = [];
    for (let i = 1; i <= max; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i);
      b.addEventListener('click', () => { n = i; btns.forEach((x, j) => x.classList.toggle('sel', j === i - 1)); });
      btns.push(b); row.appendChild(b);
    }
    if (btns.length) btns[n - 1].classList.add('sel');
    wrap.appendChild(row);
  }
  if (pres.blurb) {
    const p = document.createElement('div');
    p.style.cssText = 'font-size:12px;color:var(--dim);margin-top:8px';
    p.textContent = pres.blurb;
    wrap.appendChild(p);
  }
  pane.appendChild(wrap);
  return { c, kind: 'party', chosen: () => drawSeeded(ids, n) };
}

// the pre-level setup screen: a param composer over the level contract's consumes. A slice with
// declared setup presentation renders its styled page (hangar / count); everything else keeps
// the plain radio/checkbox picker. A multi-map mode runs it as TWO steps (operator, 2026-08-06):
// step 1 is the machine bay — the pickers, closed by Confirm; step 2 is the map select, and
// THAT is where start battle lives. A single-map level keeps the one-screen flow (there is
// nothing to choose on a second step).
function renderSetup(lv, opts) {
  opts = opts || {};
  setScreen('setup');
  // the player is seconds from a battle — start rendering the track that will play first.
  if (MUSIC && MUSIC.battle && MUSIC.battle.length) prefetchTrack(battleTrack());
  // a MODE may carry several map VARIANTS (identical picks, different world). variants[0] drives the
  // consumes render; a >1 set gets the map-select step and Start launches the selected variant. A
  // plain level (the flat-list path) is a single implicit variant, so the map step never shows.
  const variants = (opts.variants && opts.variants.length) ? opts.variants : [{ ref: lv.ref, label: null, lv: lv }];
  let variantIdx = 0;
  const title = opts.title || lv.title;
  main.innerHTML = '';
  const heading = document.createElement('h2');
  heading.style.cssText = 'font-size:14px;color:#9cc4ff';
  main.appendChild(heading);
  // the map card: built for a multi-map mode, shown on its own step after Confirm — the suit
  // is still the star (operator, 2026-08-04); the arena now gets a full screen second.
  let mapCard = null;
  if (variants.length > 1) {
    mapCard = document.createElement('div');
    mapCard.className = 'card';
    const mh = document.createElement('h3'); mh.textContent = 'map'; mapCard.appendChild(mh);
    // the CAROUSEL (variants carrying baked map stills — the shot field): the big picture pages with
    // ‹ ›, the label buttons below stay the direct pick, both drive ONE selection. Rendered
    // only when a shot exists and hidden if the image 404s (a stale offline export degrades
    // to the plain buttons). Shared by every mode's setup — solo, practice, team, ffa, spectate.
    const mbtns = [];
    let syncCar = () => {};
    const pickVariant = (i) => {
      variantIdx = i;
      mbtns.forEach((x, j) => x.classList.toggle('sel', j === i));
      syncCar();
    };
    const hasShots = variants.some((v) => v.shot);
    let wrap = null;
    if (hasShots) {
      wrap = document.createElement('div');
      wrap.className = 'map-wrap';
      const car = document.createElement('div');
      car.className = 'map-car';
      const img = document.createElement('img');
      img.alt = 'map preview';
      const nameEl = document.createElement('div'); nameEl.className = 'car-name';
      const dots = document.createElement('div'); dots.className = 'car-dots';
      const dotEls = variants.map(() => { const d = document.createElement('i'); dots.appendChild(d); return d; });
      const prev = document.createElement('button'); prev.type = 'button'; prev.className = 'car-btn car-prev'; prev.textContent = '\\u2039'; prev.setAttribute('aria-label', 'previous map');
      const next = document.createElement('button'); next.type = 'button'; next.className = 'car-btn car-next'; next.textContent = '\\u203A'; next.setAttribute('aria-label', 'next map');
      prev.addEventListener('click', () => pickVariant((variantIdx + variants.length - 1) % variants.length));
      next.addEventListener('click', () => pickVariant((variantIdx + 1) % variants.length));
      img.addEventListener('error', () => { car.style.display = 'none'; });   // offline/stale export → buttons only
      syncCar = () => {
        const v = variants[variantIdx];
        if (v.shot && img.getAttribute('src') !== v.shot) img.src = v.shot;
        nameEl.textContent = v.label || ('map ' + (variantIdx + 1));
        dotEls.forEach((d, j) => d.classList.toggle('on', j === variantIdx));
      };
      car.appendChild(img); car.appendChild(prev); car.appendChild(next); car.appendChild(nameEl); car.appendChild(dots);
      wrap.appendChild(car);
    }
    // the label picker: a vertical column on the carousel's right; shot-less games keep the
    // classic horizontal row (there is no image to sit beside).
    const mrow = document.createElement('div'); mrow.className = hasShots ? 'map-picks' : 'count-pick';
    variants.forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (!hasShots) b.style.minWidth = '104px';
      b.textContent = v.label || ('map ' + (i + 1));
      b.addEventListener('click', () => pickVariant(i));
      mbtns.push(b); mrow.appendChild(b);
    });
    if (wrap) { wrap.appendChild(mrow); mapCard.appendChild(wrap); } else mapCard.appendChild(mrow);
    pickVariant(0);   // mounted on the map step — see below
  }
  const setupLv = variants[0].lv;
  // two full-height turntable picks (your suit + the enemy) would push the action bar far below
  // the fold — flag the body so the CSS shortens both turntables, and the sticky bar keeps
  // Confirm reachable.
  const hangarCount = (setupLv.contract.consumes || []).filter((c) => {
    const p = SETUP && SETUP[c.slice];
    return p && p.style === 'hangar' && c.pick && c.pick.max === 1 && sliceKindOf(c.slice) === 'party';
  }).length;
  document.body.classList.toggle('multi-hangar', hangarCount > 1);
  // step 1 pane: every consume picker renders here.
  const pickPane = document.createElement('div');
  const pickers = [];
  for (const c of (setupLv.contract.consumes || [])) {
    const kind = sliceKindOf(c.slice);
    const pres = SETUP && SETUP[c.slice];
    if (pres && kind === 'party' && c.pick && pres.style === 'hangar' && c.pick.max === 1) { pickers.push(renderHangarPick(c, pickPane)); continue; }
    if (pres && kind === 'party' && c.pick && pres.style === 'count') { pickers.push(renderCountPick(c, pickPane)); continue; }
    const card = document.createElement('div');
    card.className = 'card';
    if (c.pick && (kind === 'inventory' || kind === 'party')) {
      const entries = kind === 'inventory'
        ? Object.entries(state[c.slice].items).map(([id, n]) => ({ id, label: id + ' ×' + n }))
        : Object.entries(state[c.slice].roster).map(([id, m]) => ({ id, label: m.name + ' (lv ' + m.level + ')' }));
      // pick.max === 1 is a "choose ONE" — render single-select radios with the first pre-selected,
      // so a level never starts with nothing chosen (that silently fell back to the default pilot).
      const single = c.pick.max === 1;
      card.innerHTML = '<h3>' + c.slice + (single ? ' — choose one' : ' — take up to ' + c.pick.max) + '</h3>';
      const boxes = [];
      entries.forEach((e, idx) => {
        const label = document.createElement('label');
        label.className = 'pick';
        const box = document.createElement('input');
        box.value = e.id;
        if (single) {
          box.type = 'radio';
          box.name = 'pick_' + c.slice;
          if (idx === 0) box.checked = true;   // always one chosen + visible
        } else {
          box.type = 'checkbox';
          box.addEventListener('change', () => {
            if (boxes.filter((b) => b.checked).length > c.pick.max) box.checked = false;
          });
        }
        label.appendChild(box);
        label.appendChild(document.createTextNode(e.label));
        card.appendChild(label);
        boxes.push(box);
      });
      if (!entries.length) card.innerHTML += '<div style="font-size:12px;color:#8fa5c8">nothing to take — the ' + c.slice + ' is empty</div>';
      pickers.push({ c, kind, boxes });
    } else {
      card.innerHTML = '<h3>' + c.slice + ' — carried along</h3><pre>' + JSON.stringify(state[c.slice], null, 2) + '</pre>';
      pickers.push({ c, kind, boxes: null });
    }
    pickPane.appendChild(card);
  }
  // the DIFFICULTY card (manifest.difficulty, operator 2026-08-06): set AFTER the map — it rides
  // the map step, under the map card. Piloted setups only (a hangar pick present): an all-AI
  // spectate bout is never detuned, and its setup has no hangar. The picked tier id is read by
  // launch via a closure, so the default ('max' — the untuned current brain — unless the game
  // says otherwise) applies untouched.
  let difficulty = null, diffCard = null;
  if (DIFFICULTY && hangarCount > 0) {
    difficulty = DIFFICULTY.default || DIFFICULTY.options[0].id;
    diffCard = document.createElement('div');
    diffCard.className = 'card';
    const dh = document.createElement('h3'); dh.textContent = DIFFICULTY.label || 'difficulty'; diffCard.appendChild(dh);
    const drow = document.createElement('div'); drow.className = 'diff-pick';
    const dbtns = [];
    DIFFICULTY.options.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = o.name; b.appendChild(nm);
      if (o.sub) { const sb = document.createElement('span'); sb.className = 'sub'; sb.textContent = o.sub; b.appendChild(sb); }
      if (o.id === difficulty) b.classList.add('sel');
      b.addEventListener('click', () => { difficulty = o.id; dbtns.forEach((x, j) => x.classList.toggle('sel', DIFFICULTY.options[j].id === o.id)); });
      dbtns.push(b); drow.appendChild(b);
    });
    diffCard.appendChild(drow);
  }
  main.appendChild(pickPane);
  // step 2 pane: the map select (+ the difficulty card under it). Hidden until Confirm; HIDING
  // (not tearing down) the pick pane keeps its closures, iframes and checked boxes live, so back
  // returns with every choice intact. A single-map level has no map step — its difficulty card
  // rides the one setup screen instead.
  let mapPane = null;
  if (mapCard) {
    mapPane = document.createElement('div');
    mapPane.style.display = 'none';
    mapPane.appendChild(mapCard);
    if (diffCard) mapPane.appendChild(diffCard);
    main.appendChild(mapPane);
  } else if (diffCard) pickPane.appendChild(diffCard);
  const foot = document.createElement('div');   // scroll spacer so the last pick clears the fixed bar
  foot.className = 'setup-foot';
  main.appendChild(foot);
  // the two steps share ONE fixed action bar; the primary re-aims per step (Confirm → start battle).
  const bar = document.createElement('div');
  bar.className = 'setup-bar';
  const primary = document.createElement('button');
  primary.className = 'primary';
  const backBtn = document.createElement('button');
  backBtn.textContent = 'back';
  bar.appendChild(primary); bar.appendChild(backBtn);
  main.appendChild(bar);
  const launch = () => startLevel(variants[variantIdx].lv, pickers, difficulty);
  const leave = opts.back || (() => renderLevels());
  function showPickStep() {
    heading.textContent = title + ' — setup';
    pickPane.style.display = '';
    if (mapPane) mapPane.style.display = 'none';
    primary.textContent = mapPane ? 'confirm' : 'start battle';
    primary.onclick = mapPane ? showMapStep : launch;
    backBtn.onclick = leave;
    window.scrollTo(0, 0);
  }
  function showMapStep() {
    heading.textContent = title + ' — select map';
    pickPane.style.display = 'none';
    mapPane.style.display = '';
    primary.textContent = 'start battle';
    primary.onclick = launch;
    backBtn.onclick = showPickStep;   // step back to the machine bay, picks intact
    window.scrollTo(0, 0);
  }
  showPickStep();
}

function startLevel(lv, pickers, difficulty) {
  const params = {};
  // the difficulty pick rides beside the slice params as a plain string — the level's params
  // seam maps it to the engine tuning tier; a level that never looks stays byte-identical.
  if (difficulty) params.difficulty = difficulty;
  for (const p of pickers) {
    const name = p.c.slice;
    if (!p.boxes && !p.chosen) { params[name] = JSON.parse(JSON.stringify(state[name])); continue; }
    // a styled picker (hangar/count) reports its members via chosen(); the plain picker via boxes.
    const chosen = new Set(p.chosen ? p.chosen() : p.boxes.filter((b) => b.checked).map((b) => b.value));
    if (p.kind === 'inventory') {
      const items = {};
      for (const id of chosen) items[id] = state[name].items[id];
      params[name] = { items };
    } else {
      const roster = {};
      for (const id of chosen) {
        roster[id] = JSON.parse(JSON.stringify(state[name].roster[id]));
        // hangar livery pick: carried beside the roster entry — the level-side seam for
        // painting the piloted suit is free to consume it when battles learn liveries.
        if (typeof p.liveryOf === 'function') { const wear = p.liveryOf(id); if (wear) roster[id].livery = wear; }
      }
      params[name] = { roster };
    }
  }
  session = { level: lv, params, seed: runLog.length + 1 };
  ctlRows = null;        // each level replies with its own legend on the first pause
  aiState = null; syncAiRow();   // the AI switch only returns if THIS level's reply offers it
  setScreen('level');
  main.innerHTML = '';   // the frame stands alone — the ☰ pause menu owns abandonment now
  // a level DOES carry the game bridge — completion is the game-ready postMessage (below),
  // not the iframe load (which fires before the world scene + AI are up). Cap covers a no-bridge level.
  onFrameLoad = null;
  muteFrameAudio();      // a lingering world soundtrack (hangar Vigil) must not play under the battle loading screen
  showLoading('loading ' + lv.title);
  frame.style.display = 'block';
  frame.src = lv.src;
}

// ---- the shell↔level wire (versioned both directions; refuse legibly on drift) ----
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || !session || e.source !== frame.contentWindow) return;
  if (d.moj === ${JSON.stringify(MSG_CONTROLS)}) {
    ctlRows = Array.isArray(d.rows) && d.rows.length ? d.rows : null;
    if (!pauseCtl.hidden) renderCtlRows();   // panel already open → live-update it
    aiState = d.ai && typeof d.ai.on === 'boolean' ? d.ai.on : null;   // practice AI switch (re-synced per pause)
    syncAiRow();
    return;
  }
  if (d.moj === ${JSON.stringify(MSG_READY)}) {
    finishLoading();   // the level's scene + bridge are up — the real completion signal
    if (d.contractVersion !== K.CONTRACT_VERSION) {
      toast('level "' + session.level.ref + '" speaks contract v' + d.contractVersion + ' but this shell is v' + K.CONTRACT_VERSION + ' — re-stage the artifact.', true);
      return;
    }
    frame.contentWindow.postMessage({ moj: ${JSON.stringify(MSG_INIT)}, contractVersion: K.CONTRACT_VERSION, params: session.params, seed: session.seed }, '*');
    pushSfx();
    // the match has BEGUN — hold the battle score for 5s so the opening seconds play on combat SFX
    // alone (operator, 2026-07-30); warm the track blob now so it starts clean at the 5s mark.
    if (MUSIC && MUSIC.battle && MUSIC.battle.length) {
      prefetchTrack(battleTrack());
      clearTimeout(battleTimer); battleReady = false;
      battleTimer = setTimeout(() => { battleReady = true; if (screen === 'level') syncMusic(); }, 5000);
    }
  }
  if (d.moj === ${JSON.stringify(MSG_OUTCOME)}) {
    const r = K.applyOutcome(SCHEMA, state, session.level.contract, d.envelope);
    if (!r.ok) { toast('outcome rejected (store untouched): ' + r.errors.join('; '), true); return; }
    state = r.state;
    // auto-record completion: beating a level marks it done in the progression slice, so gates on
    // it open (the universal campaign behavior; mechanics levels don't emit their own promote).
    if (d.envelope.result === 'success') {
      const prog = SCHEMA.slices.filter((s) => s.kind === 'progression')[0];
      if (prog && !state[prog.name].completed[session.level.ref]) {
        const pr = K.applyEvents(SCHEMA, state, [{ type: 'promote', slice: prog.name, ref: session.level.ref, result: 'success' }]);
        if (pr.ok) state = pr.state;
      }
    }
    runLog.push(d.envelope);
    persist();
    const stats = d.envelope.stats;
    if (stats && Array.isArray(stats.rows) && stats.rows.length) {
      // linger on the in-world result tableau (banner + final topple), then the score screen.
      const sess = session;
      setTimeout(() => { if (session === sess) renderScore(sess.level, d.envelope); }, 2400);
    } else {
      toast(session.level.title + ': ' + d.envelope.result + ' — ' + (d.envelope.events || []).length + ' event(s) applied');
      renderHome();   // match-end → home screen (operator, 2026-07-30)
    }
  }
});

// the end-of-match SCORE SCREEN (rendered when the outcome envelope carries a stats payload):
// VICTORY/DEFEAT over the full contender table — kills · deaths · damage · accuracy — with the
// piloted row highlighted. Levels without stats keep the classic toast + level list.
function renderScore(lv, envelope) {
  session = null;
  setScreen('score');
  closeFrame();
  main.innerHTML = '';
  const s = document.createElement('div');
  s.className = 'screen';
  const won = envelope.result === 'success';
  const head = document.createElement('h2');
  head.className = 'result-line';
  head.textContent = won ? 'victory' : 'defeat';
  head.style.color = won ? '#7fe0a8' : '#ff8f8f';
  s.appendChild(head);
  const stats = envelope.stats;
  // TEAM bout: rows carry a team tag + the envelope a winnerTeam; the table gains a colour-coded
  // team column and the subtitle names the winning faction. A duel/FFA has no team on any row → the
  // classic table, unchanged.
  const teamed = Array.isArray(stats.rows) && stats.rows.some((r) => r.team);
  const teamNames = stats.teamNames || {};
  const teamNameOf = (t) => teamNames[t] || (t ? String(t).toUpperCase() : '');
  const scoreTeamColor = (team) => {
    if (!team) return '#cfe3ff';
    const teams = [...new Set(stats.rows.map((r) => r.team).filter(Boolean))];
    const myTeam = (!stats.spectated && stats.pilot) ? ((stats.rows.find((r) => r.id === stats.pilot) || {}).team) : null;
    if (myTeam) return team === myTeam ? '#7fe0a8' : ['#ff8f8f', '#ff9d6b', '#e6b3ff'][teams.filter((t) => t !== myTeam).indexOf(team) % 3];
    return ['#7fd4ff', '#ff9d6b', '#a8e6a1', '#e6b3ff'][teams.indexOf(team) % 4];
  };
  const sub = document.createElement('p');
  sub.className = 'tagline';
  sub.textContent = lv.title + (teamed && stats.winnerTeam ? '  ·  ' + teamNameOf(stats.winnerTeam) + ' TEAM WINS' : '');
  s.appendChild(sub);
  const wrap = document.createElement('div');
  wrap.className = 'score-wrap';
  const tbl = document.createElement('table');
  tbl.className = 'score-table';
  const cols = teamed ? ['pilot', 'team', 'kills', 'deaths', 'damage', 'accuracy'] : ['pilot', 'kills', 'deaths', 'damage', 'accuracy'];
  const headRow = document.createElement('tr');
  for (const t of cols) {
    const th = document.createElement('th'); th.textContent = t; headRow.appendChild(th);
  }
  const thead = document.createElement('thead'); thead.appendChild(headRow); tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const r of stats.rows) {
    const tr = document.createElement('tr');
    if (r.id === stats.pilot) tr.className = 'me';
    const acc = r.shots ? Math.round((r.hits / r.shots) * 100) + '%' : '—';
    const vals = teamed ? [r.name || r.id, teamNameOf(r.team), r.kills, r.deaths, r.dmg, acc] : [r.name || r.id, r.kills, r.deaths, r.dmg, acc];
    vals.forEach((v, ci) => {
      const td = document.createElement('td'); td.textContent = String(v);
      if (teamed && ci === 1) td.style.color = scoreTeamColor(r.team);
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  s.appendChild(wrap);
  const bar = document.createElement('div');
  // match-end lands on the HOME screen by default (operator, 2026-07-30) — no longer straight back into
  // the setup "swagger". Battle-again stays as a secondary rematch shortcut (its own back → home too).
  const home = document.createElement('button');
  home.className = 'primary big';
  home.textContent = MENU ? 'home' : 'back to levels';
  home.addEventListener('click', () => renderHome());
  const again = document.createElement('button');
  again.textContent = 'battle again';
  again.style.marginLeft = '10px';
  again.addEventListener('click', () => renderSetup(lv, { back: () => renderHome() }));
  bar.appendChild(home); bar.appendChild(again);
  s.appendChild(bar);
  main.appendChild(s);
}

// ---- save management: export / import / reset ----
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([K.makeSave(state, runLog)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = ${JSON.stringify(manifest.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))} + '.save.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const p = K.parseSave(String(reader.result));
    if (!p.ok) { toast('save rejected: ' + p.errors.join('; '), true); return; }
    state = p.save.storeState;
    runLog = p.save.runLog;
    persist();
    toast('save imported — ' + runLog.length + ' session(s)');
    renderLevels();
  };
  reader.readAsText(f);
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Wipe the save and start over?')) return;
  storage.removeItem(SAVE_KEY);
  boot();
  renderHome();
});

renderHome();
</script>
</body></html>`;
}

export { CONTRACT_VERSION };
