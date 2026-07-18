/**
 * Storyboard board module — normalize + shot lowering + briefs + board
 * compositor. Spike-local by design: the shipping image-outcomes files are
 * under active development, so this kind is proven BY COMPOSITION — every
 * shot lowers into a plain `image-outcome` manifest and reuses the
 * shipping normalizer / scaffold / instructions verbatim. Promotion to a
 * first-class `storyboard/v1` kind in manifest.js is the plan's P1.
 *
 * The storyboard doctrine (see storyboard.plan.md):
 *   - a SHOT is an image-outcome frame + board metadata (timing, moves,
 *     dialogue, transition) — all deterministic annotation;
 *   - the model paints frames; the BOARD paints everything else — shot
 *     numbers, annotation bands, and motion arrows are a deterministic
 *     overlay (the overlay-re-imposes-truth rule applied to motion);
 *   - dialogue/sfx/timing NEVER reach render instructions (the lettering
 *     invariant: board text is typesetting, not paint).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { normalizeImageOutcomesManifest } from '../manifest.js';
import { buildRenderInstructions, buildCharacterSheetInstructions } from '../instructions.js';
import { renderMarkdown } from '../../../outcomes/markdown.js';
import { escapeHtml } from '../picture-book-spike/book-compositor.js';
import { isFidelity, fidelityLines, FIDELITY_KINDS } from './fidelity.js';
import {
  isCameraMove,
  isSubjectMove,
  cameraMovePhrase,
  subjectMovePhrase,
  shotArrows,
  ARROW_MARKER_DEF,
  CAMERA_MOVE_KINDS,
  SUBJECT_MOVE_KINDS,
} from './moves.js';

export const STORYBOARD_CONTRACT = 'storyboard/v0-spike';
export const TRANSITIONS = ['cut', 'dissolve', 'wipe', 'match'];
export const CASTING_MODES = ['locked', 'explore'];

const DEFAULT_FRAME = { width: 1536, height: 864 }; // 16:9, the board norm

/**
 * Lower one shot into a plain image-outcome manifest — the composition
 * seam. Board metadata (moves, dialogue, sfx, seconds, transition) stays
 * behind on the shot; the lowered manifest is pure frame direction.
 *
 * Casting decides what the substrate's identity machinery sees:
 *   - locked  — characters[] + figure bindings pass through, so briefs get
 *               the "match the reference sheet exactly" language.
 *   - explore — the cast is a DESIGN brief, not a locked reference: the
 *               lowered manifest carries no characters and no bindings
 *               (the sheet language would be a lie); the board layer adds
 *               its own Cast section + design-plate contract instead.
 */
export function shotToImageOutcome(board, shot) {
  const locked = board.casting !== 'explore';
  return {
    kind: 'image-outcome',
    title: `${board.title} — ${shot.id}`,
    intent: shot.beat,
    viewBox: board.frame,
    ...(shot.camera ? { camera: shot.camera } : {}),
    ...(Number.isFinite(shot.horizonY) ? { horizonY: shot.horizonY } : {}),
    characters: locked ? board.characters : [],
    forms: shot.forms,
    // figures pass through minus the board-side `move` field (subject moves
    // are annotation, not staging — the lowered frame stages the START
    // pose); in explore mode the character/outfit bindings are stripped too.
    figures: shot.figures.map(({ move, character, outfit, ...f }) =>
      locked ? { ...f, ...(character ? { character } : {}), ...(outfit ? { outfit } : {}) } : f,
    ),
    renderBrief: board.renderBrief,
  };
}

/**
 * Normalize a storyboard spec. Validates board fields itself; frame
 * direction is validated by lowering every shot through the SHIPPING
 * normalizer (one source of truth for cameras, poses, forms, characters).
 */
export function normalizeStoryboard(input) {
  if (!input?.title) throw new Error('storyboard requires title');
  if (!input?.intent) throw new Error('storyboard requires intent');
  const frame = {
    width: Number(input.frame?.width ?? DEFAULT_FRAME.width),
    height: Number(input.frame?.height ?? DEFAULT_FRAME.height),
  };
  if (!(frame.width > 0) || !(frame.height > 0)) throw new Error('storyboard frame requires positive width/height');
  if (!Array.isArray(input.shots) || input.shots.length === 0) {
    throw new Error('storyboard requires at least one shot');
  }
  const fidelity = input.fidelity ?? 'working';
  if (!isFidelity(fidelity)) {
    throw new Error(`unknown fidelity level: ${fidelity} (one of: ${FIDELITY_KINDS.join(', ')})`);
  }
  const cast = input.characters || [];
  const casting = input.casting ?? (cast.length ? 'locked' : 'explore');
  if (!CASTING_MODES.includes(casting)) {
    throw new Error(`unknown casting mode: ${casting} (one of: ${CASTING_MODES.join(', ')})`);
  }
  if (casting === 'locked' && cast.length === 0) {
    throw new Error("casting 'locked' requires characters[] — a locked cast with nobody in it");
  }
  const seen = new Set();
  const shots = input.shots.map((shot, i) => {
    const id = shot.id || `s${i + 1}`;
    if (seen.has(id)) throw new Error(`duplicate shot id: ${id}`);
    seen.add(id);
    if (!shot.beat) throw new Error(`shot ${id}: beat is required`);
    if (shot.cameraMove != null && !isCameraMove(shot.cameraMove)) {
      throw new Error(`shot ${id}: unknown camera move '${shot.cameraMove}' (one of: ${CAMERA_MOVE_KINDS.join(', ')})`);
    }
    for (const f of shot.figures || []) {
      if (f.move != null && !isSubjectMove(f.move)) {
        throw new Error(`shot ${id}: unknown subject move '${f.move}' (one of: ${SUBJECT_MOVE_KINDS.join(', ')})`);
      }
      // In explore mode the lowered manifest carries no characters, so the
      // substrate can't check membership — the board checks it instead
      // (a figure may still POINT at a cast entry to say who stands here).
      if (casting === 'explore' && f.character != null && !cast.some((c) => c.id === f.character)) {
        throw new Error(`shot ${id}: figure character '${f.character}' is not in the cast (${cast.map((c) => c.id).join(', ') || 'none'})`);
      }
    }
    const transition = shot.transition ?? 'cut';
    if (!TRANSITIONS.includes(transition)) {
      throw new Error(`shot ${id}: unknown transition '${transition}' (one of: ${TRANSITIONS.join(', ')})`);
    }
    if (shot.seconds != null && !(Number.isFinite(shot.seconds) && shot.seconds > 0)) {
      throw new Error(`shot ${id}: seconds must be a positive number`);
    }
    return {
      id,
      scene: shot.scene || null,
      beat: String(shot.beat),
      camera: shot.camera,
      ...(Number.isFinite(shot.horizonY) ? { horizonY: shot.horizonY } : {}),
      cameraMove: shot.cameraMove ?? 'static',
      figures: (shot.figures || []).map((f) => ({ ...f })),
      forms: shot.forms || [],
      dialogue: shot.dialogue ?? null,
      sfx: shot.sfx ?? null,
      seconds: shot.seconds ?? null,
      transition,
    };
  });
  const board = {
    kind: 'storyboard',
    contractVersion: STORYBOARD_CONTRACT,
    title: String(input.title),
    intent: String(input.intent),
    frame,
    fidelity,
    casting,
    characters: cast,
    shots,
    renderBrief: input.renderBrief || {},
  };
  // Frame-direction validation: every shot must lower cleanly. In locked
  // mode the lowered manifests also normalize the cast (one source of
  // truth); in explore mode the cast is a design brief and stays as
  // authored (the lowered manifests deliberately carry no characters).
  board.lowered = board.shots.map((shot) => normalizeImageOutcomesManifest(shotToImageOutcome(board, shot)));
  if (casting === 'locked') board.characters = board.lowered[0]?.characters ?? [];
  return board;
}

/**
 * The Cast section for explore mode — the design-brief replacement for the
 * substrate's "match the reference sheet exactly" identity language. The
 * worker designs the cast on a DESIGN PLATE first (same strip layout as a
 * character sheet, but authored by the worker), then holds its own design.
 */
function exploreCastLines(board, shot) {
  if (board.casting !== 'explore' || !board.characters.length) return [];
  const staged = new Set(shot.figures.map((f) => f.character).filter(Boolean));
  return [
    '',
    '## Cast (design brief — casting: explore)',
    '- This board DESIGNS its cast: no locked reference exists. You produced a design plate first (design-plate/); every frame must match YOUR OWN plate — same face, same costume, same silhouette.',
    ...board.characters.map((c) => {
      const inShot = staged.has(c.id) ? ' [in this shot]' : '';
      return `- ${c.id}${c.name ? ` (${c.name})` : ''}${inShot}: ${c.description} — the description is a starting point; the design decisions (costume, silhouette, palette, face) are yours to make and then keep.`;
    }),
  ];
}

/** Per-shot render brief: the shipping frame brief + fidelity + motion + cast. */
export function buildShotInstructions(board, shot) {
  const motion = [];
  if (shot.cameraMove && shot.cameraMove !== 'static') {
    motion.push(`- ${cameraMovePhrase(shot.cameraMove)}`);
  }
  for (const f of shot.figures) {
    if (f.move) motion.push(`- ${f.id} ${subjectMovePhrase(f.move)} — stage the START of the move; leave room along its path`);
  }
  return [
    `## Storyboard frame ${shot.id}${shot.scene ? ` — scene: ${shot.scene}` : ''}`,
    'This is ONE FRAME of a storyboard. Paint the frame art only:',
    '- no arrows, motion lines, or annotation graphics of any kind (motion is annotated by the board overlay, never painted)',
    '- no frame borders, shot numbers, timecodes, or text',
    '',
    ...fidelityLines(board.fidelity),
    ...(motion.length ? ['', '### Motion (composition guidance only — do NOT draw it)', ...motion] : []),
    ...exploreCastLines(board, shot),
    '',
    buildRenderInstructions(shotToImageOutcome(board, shot)),
  ].join('\n');
}

/**
 * Design-plate brief (explore mode) — the character-sheet primitive with
 * the framing flipped from "reproduce the reference" to "author the
 * design". The plate manifest IS a character-sheet manifest built from
 * the cast entry, so the scaffold layout, the neutral-presentation
 * contract, and — after the render round — `bind_character_sheet` all
 * apply unchanged: an accepted plate can be bound, promoting the
 * explored design into the substrate's locked cast (comics, books).
 */
export function designPlateManifest(board, castId) {
  const ch = board.characters.find((c) => c.id === castId);
  if (!ch) throw new Error(`unknown cast member: ${castId} (cast: ${board.characters.map((c) => c.id).join(', ') || 'none'})`);
  return {
    kind: 'character-sheet',
    title: `${board.title} — design plate: ${ch.name || ch.id}`,
    character: ch,
    renderBrief: board.renderBrief,
  };
}

export function buildDesignPlateInstructions(board, castId) {
  return [
    '## Design plate (casting: explore)',
    'This is a DESIGN task, not a reproduction: no locked reference exists for this character. Author the design — face, hair, costume, silhouette, palette — from the description below, making confident decisions the way a character designer would.',
    'The plate you produce becomes the reference: every frame of this board must match it, and an accepted plate can be bound as the production\'s character sheet (locking your design for future artifacts).',
    '',
    ...fidelityLines(board.fidelity),
    '',
    buildCharacterSheetInstructions(designPlateManifest(board, castId)),
  ].join('\n');
}

// ── the board composite (deterministic; frames in, board out) ──

const BOARD_CSS = `
  body { background: #12151c; color: #e7e9ee; font-family: Inter, system-ui, sans-serif; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .intent { color: #9aa3b2; font-size: 14px; margin: 0 0 28px; max-width: 900px; }
  .scene { color: #c8cedb; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; margin: 30px 0 12px; border-bottom: 1px solid #2a2f3a; padding-bottom: 6px; }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .shot { background: #191d26; border: 1px solid #2a2f3a; border-radius: 8px; overflow: hidden; margin-bottom: 22px; }
  .frame { position: relative; aspect-ratio: 16 / 9; background: #0b0e14; }
  .frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .frame svg.overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
  .band { padding: 10px 12px 12px; font-size: 12.5px; line-height: 1.45; }
  .band .head { display: flex; justify-content: space-between; color: #9aa3b2; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; margin-bottom: 6px; }
  .band .action { color: #e7e9ee; }
  .band .dialogue { color: #f3d9a4; margin-top: 6px; }
  .band .dialogue p, .band .action p { margin: 0; }
  .band .sfx { color: #8fd0c9; margin-top: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; }
  .footer { color: #6b7280; font-size: 11px; margin-top: 26px; font-family: ui-monospace, Menlo, monospace; }
`;

function shotCell(board, shot, imgRel) {
  const arrows = shotArrows(shot, board.frame);
  const overlay = arrows.length
    ? `<svg class="overlay" viewBox="0 0 ${board.frame.width} ${board.frame.height}" preserveAspectRatio="none"><defs>${ARROW_MARKER_DEF}</defs>${arrows.join('')}</svg>`
    : '';
  const timing = [
    shot.seconds != null ? `${shot.seconds}s` : null,
    shot.cameraMove !== 'static' ? shot.cameraMove : null,
    shot.transition !== 'cut' ? `→ ${shot.transition}` : null,
  ].filter(Boolean).join(' · ');
  return [
    '<div class="shot">',
    `<div class="frame"><img src="${escapeHtml(imgRel)}" alt="${escapeHtml(shot.id)}"/>${overlay}</div>`,
    '<div class="band">',
    `<div class="head"><span>${escapeHtml(shot.id)}</span><span>${escapeHtml(timing || 'hold')}</span></div>`,
    `<div class="action">${renderMarkdown(shot.beat)}</div>`,
    shot.dialogue ? `<div class="dialogue">${renderMarkdown(shot.dialogue)}</div>` : '',
    shot.sfx ? `<div class="sfx">sfx: ${escapeHtml(shot.sfx)}</div>` : '',
    '</div>',
    '</div>',
  ].filter(Boolean).join('\n');
}

/**
 * Build the board's index.html. `frames` maps shot id → image path
 * relative to the html file. Deterministic: same (board, frames, edition)
 * → same bytes; no timestamps.
 */
export function buildBoardHtml({ board, frames, edition }) {
  const groups = [];
  let currentScene;
  for (const shot of board.shots) {
    if (shot.scene !== currentScene) {
      currentScene = shot.scene;
      groups.push({ scene: currentScene, shots: [] });
    }
    groups[groups.length - 1].shots.push(shot);
  }
  const totalSeconds = board.shots.reduce((n, s) => n + (s.seconds || 0), 0);
  const body = groups.map((g) => [
    g.scene ? `<div class="scene">${escapeHtml(g.scene)}</div>` : '',
    '<div class="row">',
    ...g.shots.map((shot) => shotCell(board, shot, frames[shot.id])),
    '</div>',
  ].filter(Boolean).join('\n')).join('\n');
  return [
    `<title>${escapeHtml(board.title)}</title>`,
    `<style>${BOARD_CSS}</style>`,
    `<h1>${escapeHtml(board.title)}</h1>`,
    `<p class="intent">${escapeHtml(board.intent)}</p>`,
    body,
    `<div class="footer">${escapeHtml(`storyboard ${STORYBOARD_CONTRACT} · ${board.shots.length} shots · ~${totalSeconds}s · fidelity: ${board.fidelity} · casting: ${board.casting} · ${edition}`)}</div>`,
  ].join('\n');
}

// Test seam: the real picture_book doc chrome is not needed here — a board
// is a working document, not a publication; it gets a plain html shell.
export async function writeBoardHtml(filePath, html) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `<!doctype html>\n<html><head><meta charset="utf-8"/></head><body>\n${html}\n</body></html>\n`, 'utf8');
}

export const _internals = { shotCell, DEFAULT_FRAME };
