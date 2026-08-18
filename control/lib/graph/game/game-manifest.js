/**
 * game-manifest — validate + normalize the game manifest (game-metacontext.plan.md).
 *
 * `theme?` is the optional PRESENTATION skin the shell reads (game-shell.js): an accent-color
 * pair + an opt-in `style: 'hud'` that turns on the stylized loading/menu treatment (mono type,
 * cold accents, corner brackets). Absent → the shell keeps its default clean look. Pure
 * presentation — never resolved, never gates play; the loading overlay + progress bar are
 * universal, only their FLAVOR (accent color, corner brackets) is themed.
 *
 * A GAME rides the `sketches` table like every other mint (`kind: 'game'`, recipes-not-
 * renders): the manifest is the store schema + the promoted level list, small and
 * deterministic. The shell (game-shell.js) is emitted FROM it at artifact-staging time;
 * play state never comes back into this row (play data never enters mojulo).
 *
 *   { kind: 'game', title,
 *     store:  { slices: [{ name, kind: character|inventory|party|progression|flags, init? }] },
 *     levels: [{ ref, title?, gate? }],    // order = play order; gate = declarative unlock
 *     menu?:  { tagline?, attribution?, entries: [{ id, title, subtitle?, kind: 'levels'|'world'|'soon'|'about', ref? }] },
 *     music?: { menu?: <beatsRef>, about?: <beatsRef>, battle?: [<beatsRef>, …] },
 *     setup?: { <sliceName>: <presentation> },
 *     difficulty?: { label?, default?, options: [{ id: 'easy'|'medium'|'max', name, sub? }] } }
 *
 * `setup` is the optional PRE-LEVEL presentation, per party slice — how the setup screen renders
 * that slice's pick (the default is the plain radio/checkbox picker). Two styles:
 *   { style: 'hangar', cards?: { <memberId>: { portrait?: <sketchRef>, preview?: <sketchRef>,
 *     stats?: { <label>: <string|number>, … }, blurb? } } }
 *     — the full-page single-pick selector: a rail of portrait cards (each member's portrait
 *       sketch rendered as an image), and the selected member shown large in a side panel (its
 *       preview sketch's World iframed as a self-rotating turntable) beside its stats rows.
 *       Refs resolve at serve time like menu/music refs; a card with no portrait falls back to
 *       a name tile, no preview → no panel iframe. Applies when the level consumes the slice
 *       with pick.max === 1; other picks fall back to the plain picker.
 *   { style: 'count', label?, blurb? }
 *     — the count-only pick: the player chooses HOW MANY (1..pick.max), and the shell draws
 *       that many members from the roster at random (seeded per session — deterministic dice,
 *       never Math.random). For opponent seats where the individual members are interchangeable.
 * Pure presentation over the same contract params — the level receives the identical
 * { roster: { id: member } } shape either way.
 *
 * `menu` is the optional GAME-FRAME presentation: when present the shell boots Start screen →
 * main menu instead of straight into the level list. Exactly one entry is kind:'levels' (the
 * level list + setup flow lives behind it); kind:'world' entries iframe another stored world
 * by ref (e.g. a hangar/viewer world); kind:'soon' entries are inert coming-soon placeholders
 * (rendered disabled, no ref); a kind:'about' entry is the game's provenance page — the entry
 * itself carries the content ({ body?: [para,…], links?: [{ label, href, sub? }], footer?:
 * para|[para,…] }), rendered by the shell as a static screen (no ref, no iframe). A para is a
 * string or an array of segments (string | { text, href }) so prose can carry inline anchors.
 * A ROOT-level about entry renders as the title screen's second option (Start / About) rather
 * than a main-menu row; nested inside a kind:'menu' group it renders as a normal entry.
 * Absent → the shell renders exactly as before.
 *
 * ATTRIBUTION (the trackback, operator-owned): a game with a menu but NO declared about entry
 * gets a generated default about page at resolve time — provenance + links back to mojulo,
 * identical in the served copy and the export. It is a courtesy credit, not a lock: declare
 * your own about entry to replace it wholesale, or set `menu.attribution: false` to remove it.
 * Free either way — the artifact is the operator's; the credit stays only if it earned its place.
 *
 * `music` is the shell's score, by beats ref (recipes stay sovereign; the shell streams each
 * ref's derived beats.wav render): `menu` loops on the menu screens, `about` loops on a
 * kind:'about' menu screen (falls back to `menu` when absent), `battle` ROTATES while a
 * level session runs (track end → next). World-view menu entries silence the shell — a viewed
 * world (e.g. the hangar) carries its own score via its manifest `audio` channel. Optional
 * `volume` / `menuVolume` / `battleVolume` (0..1) set the BED LEVEL — the score plays under
 * the game's own SFX (shell defaults: battle 0.4, menu 0.55).
 *
 * Validation throws teaching errors (the create_game handler will surface them with a
 * pointer at the slice-cards). Gates are predicates evaluated by the store kernel
 * (evalGate): { flag, equals?, slice? } | { completed: ref, slice? }.
 */

import { buildGameStoreKernel } from './store-kernel.js';

const K = buildGameStoreKernel();

export function validateGameManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  if (manifest.kind !== 'game') return { ok: false, errors: ["manifest.kind must be 'game'"] };
  if (!manifest.title || typeof manifest.title !== 'string') errors.push('manifest.title is required (string)');

  const sliceNames = new Set();
  const kindsByName = new Map();
  if (!manifest.store || !Array.isArray(manifest.store.slices) || !manifest.store.slices.length) {
    errors.push('store.slices is required: [{ name, kind, init? }] — the game\'s typed store (see the slice cards)');
  } else {
    manifest.store.slices.forEach((sl, i) => {
      const where = `store.slices[${i}]`;
      if (!sl || typeof sl !== 'object') { errors.push(`${where} must be { name, kind, init? }`); return; }
      if (!sl.name || typeof sl.name !== 'string') errors.push(`${where}.name is required (string)`);
      else if (sliceNames.has(sl.name)) errors.push(`${where}.name '${sl.name}' is duplicated`);
      else { sliceNames.add(sl.name); kindsByName.set(sl.name, sl.kind); }
      if (!K.SLICE_KINDS.includes(sl.kind)) errors.push(`${where}.kind must be one of: ${K.SLICE_KINDS.join(', ')}`);
      else if (sl.init !== undefined) {
        // initSlice throws a teaching error on shape faults — surface it as a validation error.
        try { K.createStore({ slices: [{ name: sl.name || `s${i}`, kind: sl.kind, init: sl.init }] }); }
        catch (e) { errors.push(`${where}.init: ${e.message}`); }
      }
    });
  }

  const refs = new Set();
  if (!Array.isArray(manifest.levels) || !manifest.levels.length) {
    errors.push('levels is required: [{ ref, title?, gate? }] — refs of promoted level sketches, in play order');
  } else {
    manifest.levels.forEach((lv, i) => {
      const where = `levels[${i}]`;
      if (!lv || typeof lv !== 'object' || !lv.ref || typeof lv.ref !== 'string') { errors.push(`${where} must be { ref, title?, gate? }`); return; }
      if (refs.has(lv.ref)) errors.push(`${where}.ref '${lv.ref}' is duplicated`);
      refs.add(lv.ref);
      const gate = lv.gate;
      if (gate !== undefined) {
        if (!gate || typeof gate !== 'object') { errors.push(`${where}.gate must be { flag, equals?, slice? } or { completed: ref, slice? }`); return; }
        const forms = ['flag', 'completed'].filter((k) => gate[k] !== undefined);
        if (forms.length !== 1) errors.push(`${where}.gate needs exactly one of flag | completed`);
        if (gate.completed !== undefined && typeof gate.completed !== 'string') errors.push(`${where}.gate.completed must be a level ref (string)`);
        if (gate.slice !== undefined && !sliceNames.has(gate.slice)) errors.push(`${where}.gate.slice '${gate.slice}' is not a declared slice`);
        else if (gate.slice !== undefined) {
          const want = gate.flag !== undefined ? 'flags' : 'progression';
          if (kindsByName.get(gate.slice) !== want) errors.push(`${where}.gate.slice '${gate.slice}' must be a ${want} slice`);
        }
        if (gate.slice === undefined) {
          const want = gate.flag !== undefined ? 'flags' : 'progression';
          if (![...kindsByName.values()].includes(want)) errors.push(`${where}.gate needs a ${want} slice in the store (none declared)`);
        }
      }
    });
    // gate.completed must reference a level in this game — a dangling ref can never unlock.
    manifest.levels.forEach((lv, i) => {
      if (lv && lv.gate && typeof lv.gate.completed === 'string' && !refs.has(lv.gate.completed)) {
        errors.push(`levels[${i}].gate.completed '${lv.gate.completed}' is not a level of this game`);
      }
    });
  }

  if (manifest.menu !== undefined) {
    const menu = manifest.menu;
    if (!menu || typeof menu !== 'object') errors.push("menu must be { tagline?, entries: [{ id, title, subtitle?, kind: 'levels'|'world', ref? }] }");
    else {
      if (menu.tagline !== undefined && typeof menu.tagline !== 'string') errors.push('menu.tagline must be a string');
      if (menu.attribution !== undefined && typeof menu.attribution !== 'boolean') {
        errors.push('menu.attribution must be a boolean (false removes the default mojulo about/credits page; declaring your own about entry also replaces it)');
      }
      // art (pure presentation, opt-in): a full-bleed title-card image URL/path the shell
      // paints behind the game-frame screens (Start renders button-only over it — the art IS
      // the title card). Serve-side value is typically a bound render under /outcomes/…;
      // export_game copies it into assets/ so the exported folder stays self-contained.
      if (menu.art !== undefined && (typeof menu.art !== 'string' || !menu.art.trim())) {
        errors.push('menu.art must be a non-empty string (the title-card image URL/path)');
      }
      // setupArt: the post-menu sibling — battle setup / level list / world view swap to this
      // backdrop while start + menus keep `art` (the title card).
      if (menu.setupArt !== undefined && (typeof menu.setupArt !== 'string' || !menu.setupArt.trim())) {
        errors.push('menu.setupArt must be a non-empty string (the setup-screen backdrop image URL/path)');
      }
      if (!Array.isArray(menu.entries) || !menu.entries.length) {
        errors.push("menu.entries is required (non-empty array) when menu is declared");
      } else {
        // entry kinds: 'levels' (the flat level list) · 'world' (iframe a stored world) · 'soon'
        // (inert placeholder) · 'menu' (a nested submenu group — the two-step mode picker) · 'mode'
        // (opens the setup screen for a level or a set of map-variant levels, with a variant picker).
        const ids = new Set();
        const levelRefSet = new Set((Array.isArray(manifest.levels) ? manifest.levels : []).map((lv) => lv && lv.ref).filter(Boolean));
        let levelsEntries = 0, reachEntries = 0;   // reach = a way to get to a level ('levels' or 'mode')
        const validateEntry = (en, where, depth) => {
          if (!en || typeof en !== 'object') { errors.push(`${where} must be { id, title, kind }`); return; }
          if (!en.id || typeof en.id !== 'string') errors.push(`${where}.id is required (string)`);
          else if (ids.has(en.id)) errors.push(`${where}.id '${en.id}' is duplicated`);
          else ids.add(en.id);
          if (!en.title || typeof en.title !== 'string') errors.push(`${where}.title is required (string)`);
          if (en.subtitle !== undefined && typeof en.subtitle !== 'string') errors.push(`${where}.subtitle must be a string`);
          if (en.kind === 'levels') { levelsEntries += 1; reachEntries += 1; if (en.ref !== undefined) errors.push(`${where}: a 'levels' entry carries no ref (it opens this game's own level list)`); }
          else if (en.kind === 'world') { if (!en.ref || typeof en.ref !== 'string') errors.push(`${where}.ref is required for kind 'world' (the stored world to view)`); }
          else if (en.kind === 'soon') { if (en.ref !== undefined) errors.push(`${where}: a 'soon' entry carries no ref (it is an inert coming-soon placeholder)`); }
          else if (en.kind === 'mode') {
            reachEntries += 1;
            if (!Array.isArray(en.variants) || !en.variants.length) errors.push(`${where}.variants is required for kind 'mode' (non-empty [{ ref, label? }] — the level(s) it launches; more than one adds a map/variant picker)`);
            else en.variants.forEach((vr, j) => {
              const vw = `${where}.variants[${j}]`;
              if (!vr || typeof vr !== 'object') { errors.push(`${vw} must be { ref, label? }`); return; }
              if (!vr.ref || typeof vr.ref !== 'string') errors.push(`${vw}.ref is required (a level ref)`);
              else if (!levelRefSet.has(vr.ref)) errors.push(`${vw}.ref '${vr.ref}' is not one of this game's levels[]`);
              if (vr.label !== undefined && typeof vr.label !== 'string') errors.push(`${vw}.label must be a string`);
              if (vr.shot !== undefined && (typeof vr.shot !== 'string' || !vr.shot.trim())) errors.push(`${vw}.shot must be a non-empty string (the map still the setup carousel shows)`);
            });
          }
          else if (en.kind === 'menu') {
            if (!Array.isArray(en.entries) || !en.entries.length) errors.push(`${where}.entries is required for kind 'menu' (a non-empty submenu group)`);
            else if (depth >= 3) errors.push(`${where}: menus nest at most 3 deep`);
            else en.entries.forEach((c, j) => validateEntry(c, `${where}.entries[${j}]`, depth + 1));
          }
          else if (en.kind === 'about') {
            if (en.ref !== undefined) errors.push(`${where}: an 'about' entry carries no ref (its content lives on the entry itself)`);
            // a PARAGRAPH is a plain string, or an array of segments mixing strings with inline
            // links ({ text, href }) — so prose can carry an anchor mid-sentence.
            const validPara = (p) => (typeof p === 'string' && !!p)
              || (Array.isArray(p) && p.length > 0 && p.every((sg) => (typeof sg === 'string' && !!sg)
                || (sg && typeof sg === 'object' && typeof sg.text === 'string' && !!sg.text && typeof sg.href === 'string' && !!sg.href)));
            const paraShape = "a non-empty string, or an array of segments (string | { text, href })";
            if (en.body !== undefined && (!Array.isArray(en.body) || !en.body.every(validPara))) {
              errors.push(`${where}.body must be an array of paragraphs — each ${paraShape}`);
            }
            if (en.links !== undefined) {
              if (!Array.isArray(en.links)) errors.push(`${where}.links must be an array of { label, href, sub? }`);
              else en.links.forEach((ln, j) => {
                const lw = `${where}.links[${j}]`;
                if (!ln || typeof ln !== 'object') { errors.push(`${lw} must be { label, href, sub? }`); return; }
                if (!ln.label || typeof ln.label !== 'string') errors.push(`${lw}.label is required (string)`);
                if (!ln.href || typeof ln.href !== 'string') errors.push(`${lw}.href is required (string)`);
                if (ln.sub !== undefined && typeof ln.sub !== 'string') errors.push(`${lw}.sub must be a string`);
              });
            }
            if (en.footer !== undefined && !(validPara(en.footer) || (Array.isArray(en.footer) && en.footer.length > 0 && en.footer.every(validPara)))) {
              errors.push(`${where}.footer must be a paragraph (${paraShape}) or an array of them`);
            }
          }
          else errors.push(`${where}.kind must be 'levels' (the level list), 'world' (iframe a stored world), 'soon' (a placeholder), 'menu' (a submenu group), 'mode' (opens setup for a level or map-set), or 'about' (the provenance page)`);
        };
        menu.entries.forEach((en, i) => validateEntry(en, `menu.entries[${i}]`, 0));
        if (levelsEntries > 1) errors.push(`menu has ${levelsEntries} kind:'levels' entries — at most one is allowed (the flat level list)`);
        if (reachEntries === 0) errors.push(`menu needs a way to reach a level — one kind:'levels' entry or at least one kind:'mode' entry`);
      }
    }
  }

  if (manifest.theme !== undefined) {
    const theme = manifest.theme;
    const COLOR = /^#[0-9a-fA-F]{3,8}$/;
    if (!theme || typeof theme !== 'object') errors.push("theme must be { accent?, accent2?, style?: 'hud'|'clean' }");
    else {
      for (const k of ['accent', 'accent2']) {
        if (theme[k] !== undefined && (typeof theme[k] !== 'string' || !COLOR.test(theme[k]))) errors.push(`theme.${k} must be a hex color like '#5fe6d6'`);
      }
      if (theme.style !== undefined && theme.style !== 'hud' && theme.style !== 'clean') errors.push("theme.style must be 'hud' or 'clean'");
    }
  }

  if (manifest.setup !== undefined) {
    const setup = manifest.setup;
    if (!setup || typeof setup !== 'object' || Array.isArray(setup)) {
      errors.push("setup must be { <sliceName>: { style: 'hangar'|'count', … } } — per-slice setup-screen presentation");
    } else {
      for (const slice of Object.keys(setup)) {
        const where = `setup.${slice}`;
        if (!sliceNames.has(slice)) { errors.push(`${where}: '${slice}' is not a declared slice`); continue; }
        if (kindsByName.get(slice) !== 'party') { errors.push(`${where}: setup presentation applies to party slices (the roster picks); '${slice}' is ${kindsByName.get(slice)}`); continue; }
        const p = setup[slice];
        if (!p || typeof p !== 'object') { errors.push(`${where} must be { style: 'hangar'|'count', … }`); continue; }
        if (p.style === 'hangar') {
          for (const k of ['label', 'blurb']) {
            if (p[k] !== undefined && typeof p[k] !== 'string') errors.push(`${where}.${k} must be a string`);
          }
          if (p.cards !== undefined) {
            if (!p.cards || typeof p.cards !== 'object' || Array.isArray(p.cards)) { errors.push(`${where}.cards must be { <memberId>: { portrait?, preview?, stats?, blurb? } }`); continue; }
            for (const id of Object.keys(p.cards)) {
              const c = p.cards[id], cw = `${where}.cards.${id}`;
              if (!c || typeof c !== 'object') { errors.push(`${cw} must be { portrait?, preview?, stats?, blurb? }`); continue; }
              for (const k of ['portrait', 'preview']) {
                if (c[k] !== undefined && (typeof c[k] !== 'string' || !c[k])) errors.push(`${cw}.${k} must be a sketch ref (string)`);
              }
              if (c.blurb !== undefined && typeof c.blurb !== 'string') errors.push(`${cw}.blurb must be a string`);
              if (c.stats !== undefined) {
                if (!c.stats || typeof c.stats !== 'object' || Array.isArray(c.stats)) errors.push(`${cw}.stats must be { <label>: <string|number> }`);
                else for (const sk of Object.keys(c.stats)) {
                  if (typeof c.stats[sk] !== 'string' && typeof c.stats[sk] !== 'number') errors.push(`${cw}.stats.${sk} must be a string or number`);
                }
              }
            }
          }
        } else if (p.style === 'count') {
          for (const k of ['label', 'blurb']) {
            if (p[k] !== undefined && typeof p[k] !== 'string') errors.push(`${where}.${k} must be a string`);
          }
          // opt-in FIXED draw: the count isn't the player's to choose — this many are drawn at random.
          if (p.fixed !== undefined && !(typeof p.fixed === 'number' && Number.isInteger(p.fixed) && p.fixed >= 1)) errors.push(`${where}.fixed must be a positive integer (a fixed random-draw size)`);
        } else if (p.style === 'roster') {
          // named member check-pick (WHICH members, not how many) — default-checked from the
          // level's presets.default, so the standalone lineup is the opening state.
          for (const k of ['label', 'blurb']) {
            if (p[k] !== undefined && typeof p[k] !== 'string') errors.push(`${where}.${k} must be a string`);
          }
        } else {
          errors.push(`${where}.style must be 'hangar' (portrait single-pick), 'count' (how-many pick over a random draw), or 'roster' (named member check-pick)`);
        }
      }
    }
  }

  if (manifest.music !== undefined) {
    const music = manifest.music;
    if (!music || typeof music !== 'object') errors.push('music must be { menu?: <beatsRef>, battle?: [<beatsRef>, …], volume?, menuVolume?, battleVolume? }');
    else {
      if (music.menu !== undefined && (typeof music.menu !== 'string' || !music.menu)) errors.push('music.menu must be a beats sketch ref (string)');
      if (music.about !== undefined && (typeof music.about !== 'string' || !music.about)) errors.push('music.about must be a beats sketch ref (string)');
      if (music.battle !== undefined) {
        if (!Array.isArray(music.battle) || !music.battle.length || !music.battle.every((r) => r && typeof r === 'string')) {
          errors.push('music.battle must be a non-empty array of beats sketch refs');
        }
      }
      // the music BED LEVEL: the score plays under the game's own SFX. 0..1; the shell defaults
      // battle tracks to 0.4 and menu screens to 0.55 when unset; `volume` sets both, the
      // per-context keys override it.
      for (const k of ['volume', 'menuVolume', 'battleVolume']) {
        if (music[k] !== undefined && !(typeof music[k] === 'number' && Number.isFinite(music[k]) && music[k] >= 0 && music[k] <= 1)) {
          errors.push(`music.${k} must be a number between 0 and 1 (the playback volume)`);
        }
      }
      if (music.menu === undefined && music.battle === undefined) errors.push('music needs at least one of menu | battle');
    }
  }

  // difficulty (optional): the pre-battle DIFFICULTY pick — engine ai-tuning tiers named in the
  // game's own voice. options[].id must be an engine tier (controllable-world AI_DIFFICULTY:
  // 'easy' | 'medium' | 'max'; 'max' is the top brain — NEWTYPE — with the tackle-guard read); the shell renders name/sub on the
  // map step of piloted setups and passes the picked id to the level as params.difficulty.
  if (manifest.difficulty !== undefined) {
    const df = manifest.difficulty;
    const TIERS = ['easy', 'medium', 'max'];
    if (!df || typeof df !== 'object' || !Array.isArray(df.options) || !df.options.length) {
      errors.push("difficulty must be { label?, default?, options: [{ id: 'easy'|'medium'|'max', name, sub? }] }");
    } else {
      if (df.label !== undefined && typeof df.label !== 'string') errors.push('difficulty.label must be a string');
      df.options.forEach((o, i) => {
        const where = `difficulty.options[${i}]`;
        if (!o || typeof o !== 'object') { errors.push(`${where} must be { id, name, sub? }`); return; }
        if (!TIERS.includes(o.id)) errors.push(`${where}.id must be one of: ${TIERS.join(', ')} (an engine ai-tuning tier)`);
        if (!o.name || typeof o.name !== 'string') errors.push(`${where}.name is required (the tier's display name)`);
        if (o.sub !== undefined && typeof o.sub !== 'string') errors.push(`${where}.sub must be a string`);
      });
      const ids = df.options.filter((o) => o && typeof o === 'object').map((o) => o.id);
      if (new Set(ids).size !== ids.length) errors.push('difficulty.options ids must be unique');
      if (df.default !== undefined && !ids.includes(df.default)) errors.push('difficulty.default must name one of difficulty.options');
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Fill defaults so the stored manifest is self-contained. Never mutates the input. */
export function normalizeGameManifest(manifest) {
  const m = JSON.parse(JSON.stringify(manifest));
  m.contractVersion = K.CONTRACT_VERSION;
  m.levels = m.levels.map((lv) => ({ title: lv.ref, ...lv }));
  return m;
}
