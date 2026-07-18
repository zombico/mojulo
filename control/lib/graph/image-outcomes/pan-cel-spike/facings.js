/**
 * Facing vocabulary + model-sheet strip scaffold — pan-cel spike
 * (pan-cel-motion.plan.md, spike build step 2). Throwaway-grade: on
 * promotion this graduates to image-outcomes/facings.js beside cameras.js
 * and poses.js with the same closed-vocab discipline.
 *
 * The strip is the production-standard turnaround layout (facings in a
 * horizontal row, common ground line, identical scale) because that layout
 * is what the image model has seen — the layout IS the instruction
 * (plan decision 7). Meru discipline here is just: one shared unit scale
 * across cells so the character cannot change height between facings.
 */

import { poseFigure } from '../poses.js';

export const FACING_VOCAB = {
  front: { yaw: 0, phrase: 'facing the viewer square-on (front view)' },
  'three-quarter-left': { yaw: -45, phrase: 'turned three-quarters toward frame-left' },
  left: { yaw: -90, phrase: 'in full left profile' },
  'three-quarter-right': { yaw: 45, phrase: 'turned three-quarters toward frame-right' },
  right: { yaw: 90, phrase: 'in full right profile' },
  back: { yaw: 180, phrase: 'facing away from the viewer (back view)' },
};

export const FACING_KINDS = Object.keys(FACING_VOCAB);

export function facingEntry(facing) {
  const entry = FACING_VOCAB[facing];
  if (!entry) throw new Error(`unknown facing: ${facing} (one of: ${FACING_KINDS.join(', ')})`);
  return { facing, ...entry };
}

export function facingPhrase(facing) {
  return facingEntry(facing).phrase;
}

/**
 * A small gaze tick on the head circle indicating facing (screen-space
 * projection of yaw: profile → tick at the head's edge, front → centered
 * dot, back → no tick). Head center is (x, y − 78s), radius 18s — the
 * poseFigure geometry.
 */
export function facingTick({ x, y, scale = 1, facing, color = '#f59e0b' }) {
  const { yaw } = facingEntry(facing);
  const s = scale;
  const cy = y - 78 * s;
  if (yaw === 180) return ''; // back view: no face marker
  if (yaw === 0) return `<circle cx="${x}" cy="${cy}" r="${3.5 * s}" fill="${color}"/>`;
  const dx = Math.sin((yaw * Math.PI) / 180) * 18 * s;
  return `<line x1="${x + dx * 0.55}" y1="${cy}" x2="${x + dx}" y2="${cy}" stroke="${color}" stroke-width="${4 * s}" stroke-linecap="round"/>`;
}

/**
 * The character-key strip scaffold (cel 0). Neutral study pose per facing,
 * generous framing, common ground line, stated light arrow. Never footage.
 */
export function stripScaffoldSvg({ title, character, facings, light, cellW = 512, cellH = 640 }) {
  facings.forEach(facingEntry); // validate all before emitting
  const width = cellW * facings.length;
  const height = cellH;
  const groundY = height - 90;
  const figY = groundY - 104 * 2.2; // feet on the ground line, scale 2.2
  const cells = facings
    .map((facing, i) => {
      const cx = cellW * i + cellW / 2;
      return [
        `  <line x1="${cellW * i}" y1="0" x2="${cellW * i}" y2="${height}" stroke="#334155" stroke-width="${i === 0 ? 0 : 2}"/>`,
        `  ${poseFigure({ x: cx, y: figY, scale: 2.2, pose: 'stand' })}`,
        `  ${facingTick({ x: cx, y: figY, scale: 2.2, facing })}`,
        `  <text x="${cx}" y="${height - 40}" fill="#cbd5e1" font-size="24" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${facing}</text>`,
      ].join('\n');
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#10151f"/>
  <line x1="0" y1="${groundY}" x2="${width}" y2="${groundY}" stroke="#94a3b8" stroke-width="3" stroke-dasharray="14 10" opacity="0.8"/>
  <text x="24" y="44" fill="#f8fafc" font-size="26" font-family="Inter, system-ui, sans-serif" font-weight="700">${title} — character key (cel 0)</text>
  <text x="24" y="76" fill="#94a3b8" font-size="17" font-family="Inter, system-ui, sans-serif">${character}</text>
  <text x="24" y="104" fill="#eab308" font-size="17" font-family="Inter, system-ui, sans-serif">⟵ key light: ${light}</text>
${cells}
</svg>
`;
}
