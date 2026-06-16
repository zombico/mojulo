/**
 * Motion — M2b interpolation: expand ONE reveal-annotated slide into a sequence
 * of sub-frame manifests, so the slide makes its points in sequence (the
 * agent-era-infomercial build). Promoted from the slide-reveal spike. See
 * motion-substrate.plan.md §3, §6.
 *
 * A reveal is expressed THROUGH the slide interface, not as a separate concern:
 * a slide's marks carry an optional
 *   reveal: { step, enter: 'fly-in'|'fade-up'|'type-on'|'pop', from?: 'left'|'right', dwell? }
 * Marks WITHOUT `reveal` are the slide's base (always present). Marks WITH it
 * enter at their `step` (marks sharing a step enter together), held `dwell`
 * seconds after. Timing is authored in seconds and rendered to frames via fps,
 * so the same slide reads the same at any fps.
 */

import { applyEntrance } from './interpolate.js';

const stripReveal = (m) => {
  const { reveal, ...rest } = m;
  void reveal;
  return rest;
};

/** True when a slide carries any reveal annotation (so the deck should expand it). */
export function hasReveals(slide) {
  return Array.isArray(slide?.marks) && slide.marks.some((m) => m && m.reveal);
}

/**
 * @param {object} slide  a sketch manifest whose marks may carry `reveal`
 * @param {object} [opts] { fps }
 * @returns {object[]} sub-frame manifests (each a full slide), in play order
 */
export function expandSlide(slide, { fps = 12 } = {}) {
  const marks = Array.isArray(slide.marks) ? slide.marks : [];
  const base = marks.filter((m) => !m.reveal).map(stripReveal);
  const revealed = marks.filter((m) => m.reveal);
  if (!revealed.length) return [slide];

  const steps = [...new Set(revealed.map((m) => m.reveal.step ?? 0))].sort((a, b) => a - b);
  const enterF = Math.max(2, Math.round(0.3 * fps));
  const startF = Math.max(1, Math.round(0.25 * fps));
  const finalF = Math.max(1, Math.round(1.2 * fps));

  const slideWith = (extra) => ({ ...slide, marks: [...base, ...extra] });

  const frames = [];
  const shown = [];
  for (let h = 0; h < startF; h++) frames.push(slideWith([]));

  for (const step of steps) {
    const group = revealed.filter((m) => (m.reveal.step ?? 0) === step);
    for (let f = 0; f < enterF; f++) {
      const p = (f + 1) / enterF;
      const entering = group.map((m) => applyEntrance(m, m.reveal.enter, m.reveal.from, p));
      frames.push(slideWith([...shown, ...entering]));
    }
    shown.push(...group.map(stripReveal));
    const dwellSec = Math.max(...group.map((m) => m.reveal.dwell ?? 0.7));
    const holdF = Math.max(1, Math.round(dwellSec * fps));
    for (let h = 0; h < holdF; h++) frames.push(slideWith([...shown]));
  }

  for (let h = 0; h < finalF; h++) frames.push(slideWith([...shown]));
  return frames;
}
