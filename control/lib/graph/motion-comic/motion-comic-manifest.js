/**
 * motion-comic manifest — normalize/validate the click-gated comic presentation
 * (motion-comic.plan.md).
 *
 * A motion comic is a "glorified powerpoint" over comic art: a deterministic
 * BOX (the view screen — phone-upright / phone-wide / … / freeform, with an
 * author-chosen matte), and a story of scenes — canonically one scene per
 * panel — whose events piecemeal the panel out click by click. There is no
 * clock: time is the click, and state is a pure fold
 * `state(scene, i) = base ∘ events[0..i]`.
 *
 * Invariants (shared with image-outcomes/manifest.js): manifests are TIMELESS
 * (no timestamps, no dice), closed vocabularies are validated at mint with
 * pointers back at the vocab card, and the stored manifest is the normalized
 * form so defaults are pinned at mint. Pure module: no DB, no fs — ref
 * existence / zone resolution is the tool layer's job (it has the repository).
 */

export const KIND_MOTION_COMIC = 'motion-comic';
export const MOTION_COMIC_CONTRACT = 'motion-comic/v1';

// The box presets — logical px, the coordinate space every placement uses.
// A freeform { width, height } is equally valid; the preset is a convenience.
export const SCREEN_PRESETS = {
  'phone-upright': { width: 390, height: 844 },
  'phone-wide': { width: 844, height: 390 },
  'square': { width: 900, height: 900 },
  'desktop': { width: 1280, height: 720 },
};

export const LETTERING_MODES = ['bubbles', 'subtitles'];
export const SUBTITLE_ENTERS = ['fade', 'type-on', 'cut'];
export const SUBTITLE_EXITS = ['fade', 'cut'];
export const SHOW_ENTERS = ['pop', 'fade', 'slide', 'none'];
export const HIDE_EXITS = ['fade', 'none'];
// Direct single-panel action: the swap is a CUT by default — the reader's
// mind interpolates the in-between (closure, the sequential-art principle).
export const SWAP_ENTERS = ['cut', 'fade'];
// The move is continuous by default (shrink = depth/falling away, grow =
// approach/coming in fast — the zoom-approach cheat transposed); 'cut'
// gives a jump-cut reframe instead.
export const MOVE_ENTERS = ['ease', 'cut'];
// SFX lettering overlays — mojulo-drawn onomatopoeia over the art. The
// composer owns placement and treatment; the image worker never letters.
export const LETTER_ENTERS = ['slam-in', 'pop', 'fade', 'none'];
export const LETTER_EFFECTS = ['3d', 'xmen-90s', 'none'];
// Balloon tails point somewhere — the Turbomedia foreshadow grammar (a
// tail aimed at what the NEXT click reveals). Eight directions.
export const TAIL_DIRECTIONS = ['down-left', 'down', 'down-right', 'left', 'right', 'up-left', 'up', 'up-right'];
// full-spread = art bleeds to the whole screen; splash = the 80% showcase
// panel floating in matte; two-panel divides the box along its long axis.
export const SCENE_LAYOUTS = ['full-spread', 'splash', 'two-panel'];
export const SAY_ENTERS = ['pop', 'fade', 'type-on', 'none'];
export const CARRIER_KINDS = ['speech', 'thought', 'shout', 'narration'];
export const PLACEMENT_FACES = ['auto', 'svg', 'png', 'final'];
export const PLACEMENT_FRAMES = ['panel', 'borderless'];

const LETTERING_MODE_SET = new Set(LETTERING_MODES);
const SUBTITLE_ENTER_SET = new Set(SUBTITLE_ENTERS);
const SUBTITLE_EXIT_SET = new Set(SUBTITLE_EXITS);
const SHOW_ENTER_SET = new Set(SHOW_ENTERS);
const HIDE_EXIT_SET = new Set(HIDE_EXITS);
const SAY_ENTER_SET = new Set(SAY_ENTERS);
const CARRIER_SET = new Set(CARRIER_KINDS);
const FACE_SET = new Set(PLACEMENT_FACES);
const FRAME_SET = new Set(PLACEMENT_FRAMES);
const SWAP_ENTER_SET = new Set(SWAP_ENTERS);
const MOVE_ENTER_SET = new Set(MOVE_ENTERS);
const LETTER_ENTER_SET = new Set(LETTER_ENTERS);
const LETTER_EFFECT_SET = new Set(LETTER_EFFECTS);
const TAIL_DIRECTION_SET = new Set(TAIL_DIRECTIONS);
const SCENE_LAYOUT_SET = new Set(SCENE_LAYOUTS);

const CARD_POINTER = "read the 'motion-comic' sketch_vocab card (get_sketch_vocab)";

export function isMotionComicKind(kind) {
  return kind === KIND_MOTION_COMIC;
}

function fail(context, message) {
  throw new Error(`${context}: ${message} — ${CARD_POINTER}`);
}

function normalizeBox(box) {
  const context = 'box';
  const src = box && typeof box === 'object' ? box : {};
  let width;
  let height;
  let screen;
  const rawScreen = src.screen;
  if (rawScreen === undefined || rawScreen === null) {
    ({ width, height } = SCREEN_PRESETS['phone-upright']);
    screen = 'phone-upright';
  } else if (typeof rawScreen === 'string') {
    const preset = SCREEN_PRESETS[rawScreen];
    if (!preset) {
      fail(context, `unknown screen preset '${rawScreen}' (known: ${Object.keys(SCREEN_PRESETS).join(', ')}, or pass { width, height })`);
    }
    ({ width, height } = preset);
    screen = rawScreen;
  } else if (typeof rawScreen === 'object') {
    width = Math.round(Number(rawScreen.width));
    height = Math.round(Number(rawScreen.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 100 || height < 100 || width > 4000 || height > 4000) {
      fail(context, 'freeform screen requires numeric width/height in [100, 4000]');
    }
  } else {
    fail(context, 'screen must be a preset name or { width, height }');
  }
  let matte = src.matte === undefined ? '#000000' : src.matte;
  if (typeof matte !== 'string' || !/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(matte)) {
    fail(context, `matte must be a hex color like '#000' or '#f5f0e6', got ${JSON.stringify(src.matte)}`);
  }
  matte = matte.toLowerCase();
  const out = { width, height, matte };
  if (screen) out.screen = screen;
  return out;
}

function normalizeSubtitleStyle(style, context) {
  if (style === undefined || style === null) return undefined;
  if (typeof style !== 'object') fail(context, 'style must be an object');
  const out = {};
  if (style.font !== undefined) {
    if (typeof style.font !== 'string' || !style.font) fail(context, 'style.font must be a non-empty string');
    out.font = style.font;
  }
  if (style.size !== undefined) {
    const size = Number(style.size);
    if (!Number.isFinite(size) || size < 8 || size > 96) fail(context, 'style.size must be a number in [8, 96] (px in box coords)');
    out.size = size;
  }
  for (const key of ['color', 'bg']) {
    if (style[key] !== undefined) {
      if (typeof style[key] !== 'string' || !style[key]) fail(context, `style.${key} must be a non-empty CSS color string`);
      out[key] = style[key];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeLettering(lettering, context = 'lettering', { allowUndefinedMode = false } = {}) {
  if (lettering === undefined || lettering === null) {
    return allowUndefinedMode ? undefined : { mode: 'bubbles' };
  }
  if (typeof lettering !== 'object') fail(context, 'must be an object');
  let mode = lettering.mode;
  if (mode === undefined && allowUndefinedMode) {
    // Scene-level override may set subtitles styling without restating mode.
    mode = undefined;
  } else {
    if (!LETTERING_MODE_SET.has(mode)) {
      fail(context, `mode must be one of ${LETTERING_MODES.join(' | ')}, got ${JSON.stringify(mode)}`);
    }
  }
  const out = {};
  if (mode !== undefined) out.mode = mode;
  if (lettering.subtitles !== undefined) {
    const sub = lettering.subtitles;
    if (!sub || typeof sub !== 'object') fail(`${context}.subtitles`, 'must be an object');
    const subOut = {};
    if (sub.at !== undefined) {
      if (sub.at === 'bottom' || sub.at === 'top') {
        subOut.at = sub.at;
      } else if (sub.at && typeof sub.at === 'object' && Number.isFinite(Number(sub.at.y))) {
        subOut.at = { y: Number(sub.at.y) };
      } else {
        fail(`${context}.subtitles`, "at must be 'bottom', 'top', or { y } (box coords)");
      }
    }
    if (sub.enter !== undefined) {
      if (!SUBTITLE_ENTER_SET.has(sub.enter)) fail(`${context}.subtitles`, `enter must be one of ${SUBTITLE_ENTERS.join(' | ')}`);
      subOut.enter = sub.enter;
    }
    if (sub.exit !== undefined) {
      if (!SUBTITLE_EXIT_SET.has(sub.exit)) fail(`${context}.subtitles`, `exit must be one of ${SUBTITLE_EXITS.join(' | ')}`);
      subOut.exit = sub.exit;
    }
    const style = normalizeSubtitleStyle(sub, `${context}.subtitles`);
    if (style) Object.assign(subOut, style);
    out.subtitles = subOut;
  }
  return out;
}

function normalizeRect(rect, context) {
  if (!rect || typeof rect !== 'object') fail(context, 'requires { x, y, w, h } in box coords');
  const x = Number(rect.x);
  const y = Number(rect.y);
  const w = Number(rect.w);
  const h = Number(rect.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    fail(context, 'requires numeric x/y and positive w/h');
  }
  return { x, y, w, h };
}

function normalizePlacement(placement, context, placements, sceneLayout) {
  if (!placement || typeof placement !== 'object') fail(context, 'placement must be an object');
  const id = placement.id === undefined ? `pl${placements.size + 1}` : placement.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    fail(context, `placement id must be 1-64 chars of [A-Za-z0-9_-], got ${JSON.stringify(placement.id)}`);
  }
  if (placements.has(id)) fail(context, `duplicate placement id '${id}' in this scene`);
  const normalizedSource = normalizeSource(placement.source, context);
  const layout = sceneLayout?.layout;
  let at;
  let slot;
  if (placement.slot !== undefined) {
    if (!layout) fail(context, "slot placement requires the scene to declare layout: 'full-spread' | 'two-panel'");
    slot = Number(placement.slot);
    const max = layout === 'two-panel' ? 2 : 1;
    if (!Number.isInteger(slot) || slot < 1 || slot > max) {
      fail(context, `slot must be 1..${max} for layout '${layout}'`);
    }
    if (placement.at !== undefined) {
      // Explicit at always wins (the pageRecipe precedent) — keep it, drop slot.
      at = normalizeRect(placement.at, `${context}.at`);
      slot = undefined;
    }
  } else {
    at = normalizeRect(placement.at, `${context}.at`);
  }
  const frame = placement.frame === undefined ? 'panel' : placement.frame;
  if (!FRAME_SET.has(frame)) fail(context, `frame must be one of ${PLACEMENT_FRAMES.join(' | ')}`);
  const out = { id, source: normalizedSource, frame };
  if (at !== undefined) out.at = at;
  if (slot !== undefined) out.slot = slot;
  placements.set(id, out);
  return out;
}

// A source is EITHER a panel crop (the showcase) or a whole-sketch face.
// Shared by placements and swap deltas.
function normalizeSource(source, context) {
  if (!source || typeof source !== 'object') {
    fail(context, 'requires source: { pageRef, panel } (THE showcase — one panel of a sequential-art page) or { ref } (any sketch face)');
  }
  const face = source.face === undefined ? 'auto' : source.face;
  if (!FACE_SET.has(face)) fail(context, `source.face must be one of ${PLACEMENT_FACES.join(' | ')}`);
  if (source.pageRef !== undefined || source.panel !== undefined) {
    // The panel-crop form — the canonical grain: a motion comic has no
    // pages, it is bound by panels only. The page is the panel SOURCE.
    if (typeof source.pageRef !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(source.pageRef)) {
      fail(context, 'panel-crop source requires pageRef: a sequential-art sketch ref');
    }
    if (typeof source.panel !== 'string' || !source.panel) {
      fail(context, "panel-crop source requires panel: '<panel id>' (e.g. 'p1')");
    }
    if (source.ref !== undefined) fail(context, 'source carries EITHER { pageRef, panel } or { ref }, not both');
    return { pageRef: source.pageRef, panel: source.panel, face };
  }
  if (typeof source.ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(source.ref)) {
    fail(context, 'source.ref must be a sketch ref (1-64 chars of [A-Za-z0-9_-])');
  }
  return { ref: source.ref, face };
}

function normalizeSay(say, delta, context, placements) {
  if (!say || typeof say !== 'object') fail(context, 'say must be an object');
  const out = {};
  const isZoneForm = say.zone !== undefined || say.panel !== undefined
    || (say.text === undefined && say.of !== undefined && placements.get(say.of)?.source.panel !== undefined);
  const isTextForm = say.text !== undefined;
  if (isZoneForm && isTextForm) fail(context, 'say is EITHER a page-zone reference { of, panel?, zone } OR inline { text, … }, not both');
  if (isZoneForm) {
    if (typeof say.of !== 'string' || !say.of) fail(context, 'zone-form say requires of: <placementId> (a placed panel or page)');
    const placement = placements.get(say.of);
    if (!placement) fail(context, `say.of names unknown placement '${say.of}' (declare it in base or an earlier show)`);
    let panel = say.panel;
    if (panel === undefined) {
      // Through a panel-crop placement the panel is implicit — the showcase
      // IS the panel. Through a whole-page placement it must be named.
      panel = placement.source.panel;
      if (panel === undefined) fail(context, "say through a whole-sketch placement requires panel: '<panel id>'");
    } else if (typeof panel !== 'string' || !panel) {
      fail(context, "panel must be a panel id string (e.g. 'p1')");
    } else if (placement.source.panel !== undefined && panel !== placement.source.panel) {
      fail(context, `zone says through placement '${say.of}' (a crop of panel '${placement.source.panel}') can only read that panel's zones, not '${panel}'`);
    }
    const zone = say.zone === undefined ? 0 : Number(say.zone);
    if (!Number.isInteger(zone) || zone < 0) fail(context, 'zone must be a non-negative integer index into that panel\'s bubbleZones');
    out.of = say.of;
    out.panel = panel;
    out.zone = zone;
  } else if (isTextForm) {
    if (typeof say.text !== 'string' || !say.text.trim()) fail(context, 'say.text must be a non-empty string');
    out.text = say.text;
    if (say.speaker !== undefined) {
      if (typeof say.speaker !== 'string' || !say.speaker) fail(context, 'say.speaker must be a non-empty string');
      out.speaker = say.speaker;
    }
    const carrier = say.carrier === undefined ? 'speech' : say.carrier;
    if (!CARRIER_SET.has(carrier)) fail(context, `say.carrier must be one of ${CARRIER_KINDS.join(' | ')}`);
    out.carrier = carrier;
    if (say.of !== undefined) {
      if (typeof say.of !== 'string' || !say.of) fail(context, 'say.of must be a placement id string');
      out.of = say.of;
    }
    if (say.at !== undefined) out.at = normalizeRect(say.at, `${context}.at`);
  } else {
    fail(context, 'say requires either { of, panel, zone } (a page bubbleZone) or { text } (inline)');
  }
  if (say.tail !== undefined) {
    // The foreshadow grammar: the tail points — often at something the
    // NEXT click reveals. Bubbles mode only (subtitles have no carrier).
    if (!TAIL_DIRECTION_SET.has(say.tail)) fail(context, `say.tail must be one of ${TAIL_DIRECTIONS.join(' | ')}`);
    out.tail = say.tail;
  }
  if (delta.enter !== undefined) {
    if (!SAY_ENTER_SET.has(delta.enter)) fail(context, `enter must be one of ${SAY_ENTERS.join(' | ')}`);
    out.enter = delta.enter;
  }
  if (delta.exit !== undefined) {
    if (!SUBTITLE_EXIT_SET.has(delta.exit)) fail(context, `exit must be one of ${SUBTITLE_EXITS.join(' | ')} (subtitles mode only)`);
    out.exit = delta.exit;
  }
  const style = normalizeSubtitleStyle(delta.style, `${context}.style`);
  if (style) out.style = style;
  return out;
}

function normalizeDelta(delta, context, placements, sceneLayout) {
  if (!delta || typeof delta !== 'object') fail(context, 'delta must be an object');
  const keys = ['show', 'hide', 'say', 'swap', 'move', 'letter', 'focus', 'hold', 'clear'].filter((k) => delta[k] !== undefined);
  if (keys.length !== 1) {
    fail(context, `each delta carries exactly ONE of show | hide | say | swap | move | letter | focus | hold | clear (got ${keys.length ? keys.join('+') : 'none'})`);
  }
  const kind = keys[0];
  if (kind === 'show') {
    const placement = normalizePlacement(delta.show, `${context}.show`, placements, sceneLayout);
    const out = { show: placement };
    if (delta.enter !== undefined) {
      if (!SHOW_ENTER_SET.has(delta.enter)) fail(context, `enter must be one of ${SHOW_ENTERS.join(' | ')}`);
      out.enter = delta.enter;
    }
    return out;
  }
  if (kind === 'swap') {
    // Direct single-panel action: same frame, same rect, new art — an
    // action beat, a subtle motion, an impact frame. The camera never
    // moves; the cut is the motion and the gutter lives between clicks.
    const swap = delta.swap;
    if (!swap || typeof swap !== 'object') fail(context, 'swap must be { of: <placementId>, to: <source> }');
    if (typeof swap.of !== 'string' || !placements.has(swap.of)) {
      fail(context, `swap.of must name a placement declared earlier in this scene (got ${JSON.stringify(swap.of)})`);
    }
    const to = normalizeSource(swap.to, `${context}.swap.to`);
    const out = { swap: { of: swap.of, to } };
    if (delta.enter !== undefined) {
      if (!SWAP_ENTER_SET.has(delta.enter)) fail(context, `swap enter must be one of ${SWAP_ENTERS.join(' | ')} (cut is the medium's default — the mind interpolates)`);
      out.enter = delta.enter;
    }
    // Later zone says resolve against the ACTIVE art: update the fold view.
    const prev = placements.get(swap.of);
    placements.set(swap.of, { ...prev, source: to });
    return out;
  }
  if (kind === 'move') {
    // The camera-cheat primitive: reposition/resize IN PLACE. Shrinking
    // does depth / falling away; growing is approach / coming in fast
    // (zoom-approach transposed to the click). 'ease' reads as motion;
    // 'cut' is a jump-cut reframe.
    const move = delta.move;
    if (!move || typeof move !== 'object') fail(context, 'move must be { of: <placementId>, to: {x,y,w,h} }');
    if (typeof move.of !== 'string' || !placements.has(move.of)) {
      fail(context, `move.of must name a placement declared earlier in this scene (got ${JSON.stringify(move.of)})`);
    }
    const to = normalizeRect(move.to, `${context}.move.to`);
    const out = { move: { of: move.of, to } };
    if (delta.enter !== undefined) {
      if (!MOVE_ENTER_SET.has(delta.enter)) fail(context, `move enter must be one of ${MOVE_ENTERS.join(' | ')}`);
      out.enter = delta.enter;
    }
    // Later zone says map through the CURRENT rect: update the fold view.
    const prev = placements.get(move.of);
    placements.set(move.of, { ...prev, at: to });
    return out;
  }
  if (kind === 'letter') {
    // SFX lettering as a Z-INDEX OVERLAY on the art: mojulo constructs the
    // glyphs deterministically (the handwritten-bubble-letter kernel), so
    // the image worker never paints text — placement and treatment are the
    // COMPOSER's job. Anchor with `of` and the lettering rides that
    // placement's moves.
    const letter = delta.letter;
    if (!letter || typeof letter !== 'object') fail(context, "letter must be { text: 'CRASH', at: {x,y,w,h} }");
    if (typeof letter.text !== 'string' || !letter.text.trim()) fail(context, 'letter.text must be a non-empty string');
    const text = letter.text.trim();
    if (text.length > 24) fail(context, 'letter.text is display SFX lettering — 24 glyphs max (use say for dialogue)');
    const out = { letter: { text, at: normalizeRect(letter.at, `${context}.letter.at`) } };
    if (letter.of !== undefined) {
      if (typeof letter.of !== 'string' || !placements.has(letter.of)) {
        fail(context, `letter.of must name a placement declared earlier in this scene (got ${JSON.stringify(letter.of)})`);
      }
      out.letter.of = letter.of;
    }
    const effect = letter.effect === undefined ? '3d' : letter.effect;
    if (!LETTER_EFFECT_SET.has(effect)) fail(context, `letter.effect must be one of ${LETTER_EFFECTS.join(' | ')}`);
    out.letter.effect = effect;
    for (const key of ['fill', 'shadowFill', 'stroke']) {
      if (letter[key] !== undefined) {
        if (typeof letter[key] !== 'string' || !letter[key]) fail(context, `letter.${key} must be a non-empty CSS color string`);
        out.letter[key] = letter[key];
      }
    }
    if (letter.rotate !== undefined) {
      const rotate = Number(letter.rotate);
      if (!Number.isFinite(rotate) || rotate < -45 || rotate > 45) fail(context, 'letter.rotate must be a number in [-45, 45] degrees');
      out.letter.rotate = rotate;
    }
    if (delta.enter !== undefined) {
      if (!LETTER_ENTER_SET.has(delta.enter)) fail(context, `letter enter must be one of ${LETTER_ENTERS.join(' | ')}`);
      out.enter = delta.enter;
    }
    return out;
  }
  if (kind === 'hide') {
    if (typeof delta.hide !== 'string' || !placements.has(delta.hide)) {
      fail(context, `hide must name a placement id declared earlier in this scene (got ${JSON.stringify(delta.hide)})`);
    }
    const out = { hide: delta.hide };
    if (delta.exit !== undefined) {
      if (!HIDE_EXIT_SET.has(delta.exit)) fail(context, `exit must be one of ${HIDE_EXITS.join(' | ')}`);
      out.exit = delta.exit;
    }
    return out;
  }
  if (kind === 'say') {
    const say = normalizeSay(delta.say, delta, `${context}.say`, placements);
    if (say.of !== undefined && !placements.has(say.of)) {
      fail(context, `say.of names unknown placement '${say.of}' (declare it in base or an earlier show)`);
    }
    return { say };
  }
  if (kind === 'focus') {
    // Rack focus — the Infinite Comics signature: attention pulled between
    // elements of one PERSISTENT image; every other placement dims. No
    // camera move. `focus: false` releases.
    if (delta.focus === false) return { focus: false };
    if (!delta.focus || typeof delta.focus !== 'object' || typeof delta.focus.on !== 'string') {
      fail(context, "focus must be { on: '<placementId>' } or false (release)");
    }
    if (!placements.has(delta.focus.on)) {
      fail(context, `focus.on must name a placement declared earlier in this scene (got ${JSON.stringify(delta.focus.on)})`);
    }
    return { focus: { on: delta.focus.on } };
  }
  if (kind === 'hold') {
    // The held beat — an AUTHORED empty click: the identical frame repeated,
    // suspended time, the wait as the beat (Turbomedia grammar). The event's
    // `note` carries why the beat holds.
    if (delta.hold !== true) fail(context, 'hold must be exactly true (the click that changes nothing on purpose)');
    return { hold: true };
  }
  if (delta.clear !== true) fail(context, 'clear must be exactly true');
  return { clear: true };
}

function normalizeScene(scene, index, sceneIds) {
  const context = `scenes[${index}]`;
  if (!scene || typeof scene !== 'object') fail(context, 'scene must be an object');
  const id = scene.id === undefined ? `s${index + 1}` : scene.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    fail(context, `scene id must be 1-64 chars of [A-Za-z0-9_-], got ${JSON.stringify(scene.id)}`);
  }
  if (sceneIds.has(id)) fail(context, `duplicate scene id '${id}'`);
  sceneIds.add(id);
  let sceneLayout;
  if (scene.layout !== undefined) {
    if (!SCENE_LAYOUT_SET.has(scene.layout)) {
      fail(context, `layout must be one of ${SCENE_LAYOUTS.join(' | ')}`);
    }
    sceneLayout = { layout: scene.layout };
  }
  const placementIds = new Map(); // id → normalized placement (say/hide/swap resolve through it)
  const base = (Array.isArray(scene.base) ? scene.base : []).map((p, i) =>
    normalizePlacement(p, `${context}.base[${i}]`, placementIds, sceneLayout));
  const rawEvents = Array.isArray(scene.events) ? scene.events : [];
  const eventIds = new Set();
  const events = rawEvents.map((event, i) => {
    const eContext = `${context}.events[${i}]`;
    if (!event || typeof event !== 'object') fail(eContext, 'event must be an object');
    const eId = event.id === undefined ? `e${i + 1}` : event.id;
    if (typeof eId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(eId)) {
      fail(eContext, `event id must be 1-64 chars of [A-Za-z0-9_-], got ${JSON.stringify(event.id)}`);
    }
    if (eventIds.has(eId)) fail(eContext, `duplicate event id '${eId}' in this scene`);
    eventIds.add(eId);
    const doList = Array.isArray(event.do) ? event.do : (event.do !== undefined ? [event.do] : []);
    if (!doList.length) fail(eContext, 'event requires do: [delta, ...] (at least one delta — the click must change something)');
    const out = { id: eId, do: doList.map((d, j) => normalizeDelta(d, `${eContext}.do[${j}]`, placementIds, sceneLayout)) };
    if (event.note !== undefined) {
      if (typeof event.note !== 'string') fail(eContext, 'note must be a string');
      out.note = event.note;
    }
    return out;
  });
  const out = { id, base, events };
  if (sceneLayout) out.layout = sceneLayout.layout;
  if (scene.note !== undefined) {
    if (typeof scene.note !== 'string') fail(context, 'note must be a string');
    out.note = scene.note;
  }
  const lettering = normalizeLettering(scene.lettering, `${context}.lettering`, { allowUndefinedMode: true });
  if (lettering !== undefined) out.lettering = lettering;
  return out;
}

/**
 * Normalize + validate a motion-comic manifest. Pure and structural: closed
 * vocabularies, id uniqueness, fold-referential integrity (hide/say name
 * placements that exist). Ref existence and bubbleZone resolution are checked
 * by the tool layer against the sketch store (collectMotionComicSources /
 * collectZoneSays below feed that check).
 */
export function normalizeMotionComicManifest(input) {
  if (!input || typeof input !== 'object') throw new Error(`motion-comic manifest must be an object — ${CARD_POINTER}`);
  if (input.kind !== KIND_MOTION_COMIC) {
    throw new Error(`manifest.kind must be '${KIND_MOTION_COMIC}', got ${JSON.stringify(input.kind)}`);
  }
  const box = normalizeBox(input.box);
  const lettering = normalizeLettering(input.lettering);
  const sceneIds = new Set();
  const rawScenes = Array.isArray(input.scenes) ? input.scenes : [];
  if (!rawScenes.length) fail('scenes', 'at least one scene is required (canonically one scene per panel)');
  const scenes = rawScenes.map((s, i) => normalizeScene(s, i, sceneIds));

  // Bubble-mode inline says need somewhere to draw: require `at` when the
  // effective mode is bubbles (subtitles mode ignores position by design).
  for (const scene of scenes) {
    const mode = scene.lettering?.mode ?? lettering.mode;
    if (mode !== 'bubbles') continue;
    scene.events.forEach((event, i) => {
      event.do.forEach((delta, j) => {
        if (delta.say && delta.say.text !== undefined && !delta.say.at && !delta.say.of) {
          fail(`scenes(${scene.id}).events[${i}].do[${j}].say`,
            "inline say in 'bubbles' mode requires at: {x,y,w,h} (or of: a placement to anchor near) — in 'subtitles' mode position is the band's");
        }
      });
    });
  }

  const out = {
    kind: KIND_MOTION_COMIC,
    contract: MOTION_COMIC_CONTRACT,
    box,
    lettering,
    scenes,
  };
  if (typeof input.title === 'string' && input.title) out.title = input.title;
  if (typeof input.intent === 'string' && input.intent) out.intent = input.intent;
  return out;
}

/** The sketch ref a placement resolves through (whole face or panel crop). */
export function placementRef(placement) {
  return placement.source.ref ?? placement.source.pageRef;
}

/** The named layout regions of a box (box coords). `full-spread` bleeds to
 * the whole screen; `splash` is the 80% showcase floating in matte;
 * `two-panel` slots split along the LONG axis — phone-upright stacks two
 * panels top/bottom, phone-wide sits them side by side. Deterministic:
 * two-panel pad = 3% of the short edge. */
export function layoutSlotRects(box, layout) {
  if (layout === 'full-spread') {
    return [{ x: 0, y: 0, w: box.width, h: box.height }];
  }
  if (layout === 'splash') {
    return [{
      x: Math.round(box.width * 0.1),
      y: Math.round(box.height * 0.1),
      w: Math.round(box.width * 0.8),
      h: Math.round(box.height * 0.8),
    }];
  }
  const pad = Math.round(0.03 * Math.min(box.width, box.height));
  const full = { x: pad, y: pad, w: box.width - 2 * pad, h: box.height - 2 * pad };
  if (layout !== 'two-panel') return [full];
  const portrait = box.height >= box.width;
  if (portrait) {
    const h = (full.h - pad) / 2;
    return [
      { x: full.x, y: full.y, w: full.w, h },
      { x: full.x, y: full.y + h + pad, w: full.w, h },
    ];
  }
  const w = (full.w - pad) / 2;
  return [
    { x: full.x, y: full.y, w, h: full.h },
    { x: full.x + w + pad, y: full.y, w, h: full.h },
  ];
}

function containFit(aspect, slot) {
  let w = slot.w;
  let h = w / aspect;
  if (h > slot.h) { h = slot.h; w = h * aspect; }
  return {
    x: Math.round(slot.x + (slot.w - w) / 2),
    y: Math.round(slot.y + (slot.h - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
}

/**
 * Mint-time slot resolution (tool layer, after normalize, before the ref
 * gate): every `slot` placement gets a concrete `at` — the slot's region
 * with the SOURCE's aspect contain-fitted into it (panel bounds for a crop,
 * viewBox for a whole face, square fallback), so art never stretches. The
 * stored manifest carries the resolved rects — pinned at mint, like every
 * other default.
 */
export function resolveMotionComicLayout(manifest, getSketch) {
  const scenes = manifest.scenes.map((scene) => {
    if (!scene.layout) return scene;
    const slots = layoutSlotRects(manifest.box, scene.layout);
    const resolve = (p) => {
      if (p.slot === undefined) return p;
      const slot = slots[p.slot - 1];
      const sketch = getSketch(placementRef(p));
      let aspect = 1;
      if (p.source.panel !== undefined) {
        const bounds = (sketch?.manifest?.panels || []).find((pn) => pn.id === p.source.panel)?.bounds;
        if (bounds) aspect = bounds.w / bounds.h;
      } else if (sketch?.manifest?.viewBox?.width) {
        aspect = sketch.manifest.viewBox.width / sketch.manifest.viewBox.height;
      }
      const { slot: _slot, ...rest } = p;
      return { ...rest, at: containFit(aspect, slot) };
    };
    return {
      ...scene,
      base: scene.base.map(resolve),
      events: scene.events.map((event) => ({
        ...event,
        do: event.do.map((delta) => (delta.show ? { ...delta, show: resolve(delta.show) } : delta)),
      })),
    };
  });
  return { ...manifest, scenes };
}

/** Every distinct source ref placed anywhere in the story (base + shows +
 * swap variants). A swap's use carries `assetId` `<placementId>#v<n>` so the
 * resolver can hand each variant its own asset entry. */
export function collectMotionComicSources(manifest) {
  const refs = new Map(); // ref → [{ sceneId, placementId, assetId, face, panel? }]
  for (const scene of manifest.scenes || []) {
    const variantCounts = new Map(); // placementId → swap count so far
    const record = (source, placementId, assetId) => {
      const ref = source.ref ?? source.pageRef;
      const list = refs.get(ref) || [];
      const use = { sceneId: scene.id, placementId, assetId, face: source.face };
      if (source.panel !== undefined) use.panel = source.panel;
      list.push(use);
      refs.set(ref, list);
    };
    (scene.base || []).forEach((p) => record(p.source, p.id, p.id));
    for (const event of scene.events || []) {
      for (const delta of event.do) {
        if (delta.show) record(delta.show.source, delta.show.id, delta.show.id);
        if (delta.swap) {
          const n = (variantCounts.get(delta.swap.of) || 0) + 1;
          variantCounts.set(delta.swap.of, n);
          record(delta.swap.to, delta.swap.of, `${delta.swap.of}#v${n}`);
        }
      }
    }
  }
  return refs;
}

/**
 * Store-backed mint gate (called from the tool layer, which has the sketch
 * repository): every placed ref must exist, and every zone-form say must
 * resolve to a real bubbleZone with lettering on a sequential-art page — a
 * dangling ref or an empty zone is a mint error, never a play-time one.
 * `getSketch(ref)` → { manifest } | null.
 */
export function validateMotionComicRefs(manifest, getSketch) {
  const sketches = new Map();
  for (const [ref, uses] of collectMotionComicSources(manifest)) {
    const sketch = getSketch(ref);
    if (!sketch?.manifest) {
      const where = uses.map((u) => `scene '${u.sceneId}' placement '${u.placementId}'`).join(', ');
      throw new Error(`motion-comic source '${ref}' not found (${where}) — mint the source sketch first`);
    }
    sketches.set(ref, sketch);
    // Panel-crop placements: the page must be sequential-art and the named
    // panel must exist — a crop of nothing is a mint error.
    for (const use of uses) {
      if (use.panel === undefined) continue;
      const where = `scene '${use.sceneId}' placement '${use.placementId}'`;
      if (sketch.manifest.kind !== 'sequential-art') {
        throw new Error(`${where}: pageRef '${ref}' is kind '${sketch.manifest.kind}' — panel crops read a sequential-art page (use source.ref for a whole-sketch face)`);
      }
      if (!(sketch.manifest.panels || []).some((p) => p.id === use.panel)) {
        const known = (sketch.manifest.panels || []).map((p) => p.id).join(', ');
        throw new Error(`${where}: page '${ref}' has no panel '${use.panel}' (panels: ${known})`);
      }
    }
  }
  for (const { sceneId, eventIndex, deltaIndex, say, placement } of collectZoneSays(manifest)) {
    const context = `scene '${sceneId}' events[${eventIndex}].do[${deltaIndex}].say`;
    if (!placement) throw new Error(`${context}: of '${say.of}' is not a placed source in that scene`);
    const ref = placementRef(placement);
    const page = sketches.get(ref)?.manifest;
    if (page?.kind !== 'sequential-art') {
      throw new Error(`${context}: '${ref}' is kind '${page?.kind}' — zone says read a sequential-art page's bubbleZones (use inline { text } for other sources)`);
    }
    const panel = (page.panels || []).find((p) => p.id === say.panel);
    if (!panel) {
      const known = (page.panels || []).map((p) => p.id).join(', ');
      throw new Error(`${context}: page '${ref}' has no panel '${say.panel}' (panels: ${known})`);
    }
    const zone = (panel.bubbleZones || [])[say.zone];
    if (!zone) {
      throw new Error(`${context}: panel '${say.panel}' has ${panel.bubbleZones?.length || 0} bubbleZones — zone ${say.zone} does not exist`);
    }
    if (!zone.lettering) {
      throw new Error(`${context}: panel '${say.panel}' bubbleZones[${say.zone}] has no lettering text — author it on the page, or use an inline say`);
    }
  }
}

/** Every zone-form say, with the placement it reads through AT THAT POINT
 * in the fold (swaps update the active art) — for mint-time resolution
 * against the source page's panels[].bubbleZones. */
export function collectZoneSays(manifest) {
  const says = [];
  for (const scene of manifest.scenes || []) {
    const placements = new Map();
    (scene.base || []).forEach((p) => placements.set(p.id, p));
    scene.events.forEach((event, eventIndex) => {
      event.do.forEach((delta, deltaIndex) => {
        if (delta.show) placements.set(delta.show.id, delta.show);
        if (delta.swap) {
          const prev = placements.get(delta.swap.of);
          if (prev) placements.set(delta.swap.of, { ...prev, source: delta.swap.to });
        }
        if (delta.move) {
          const prev = placements.get(delta.move.of);
          if (prev) placements.set(delta.move.of, { ...prev, at: delta.move.to });
        }
        if (delta.say && delta.say.panel !== undefined) {
          says.push({
            sceneId: scene.id,
            eventIndex,
            deltaIndex,
            say: delta.say,
            placement: placements.get(delta.say.of),
          });
        }
      });
    });
  }
  return says;
}
