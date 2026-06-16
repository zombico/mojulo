/**
 * Motion — CSS `steps()` flipbook compositor.
 *
 * Stitches N stripped frame bodies into ONE self-contained SVG that animates by
 * toggling per-frame group opacity on a stepped @keyframes timeline. Because the
 * @keyframes live in the SVG's own <style>, the file animates anywhere an <img>
 * goes — zero deps, lossless, no rasterization. `prefers-reduced-motion` freezes
 * to the first frame. This is the durable, portable form of a motion artifact;
 * the GIF is a heavier cache for tools that won't tick a clock.
 */

const BG_FILL = '#fafaf6';

export function composeFlipbook({ frames, viewBox, fps = 12, width, loop = true, bgFill = BG_FILL }) {
  if (!frames.length) throw new Error('composeFlipbook: no frames');
  const [x, y, w, h] = viewBox;
  const outW = width || Math.min(900, w);
  const outH = Math.round((outW * h) / w);
  const n = frames.length;
  const total = (n / fps).toFixed(3); // seconds for the whole loop
  const slot = 100 / n; // % of the timeline one frame is visible
  const iteration = loop ? 'infinite' : '1';

  const style = `  <style>
    .moj-frame { opacity: 0; animation: moj-flip ${total}s steps(1) ${iteration}; }
    @keyframes moj-flip {
      0% { opacity: 1; }
      ${(slot - 0.001).toFixed(3)}% { opacity: 1; }
      ${slot.toFixed(3)}% { opacity: 0; }
      100% { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .moj-frame { animation: none; }
      .moj-frame:first-of-type { opacity: 1; }
    }
  </style>`;

  const groups = frames.map(
    (body, i) =>
      `  <g class="moj-frame" style="animation-delay:${((i * Number(total)) / n).toFixed(3)}s">\n${body}\n  </g>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}" width="${outW}" height="${outH}">`,
    style,
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bgFill}" />`,
    ...groups,
    '</svg>',
    '',
  ].join('\n');
}
