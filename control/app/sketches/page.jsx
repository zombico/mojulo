'use client';

/**
 * /sketches — the Sketches concern: diagrams, flows, charts, and scientific
 * explanation. A tuned, opinionated surface over the sketch primitive, sibling
 * to Mojulo Maker (/maker, the illustration concern). Same gallery component as
 * Maker's Illustrations rail, filtered to the `diagram` bucket — a sketch is
 * the same primitive either way; the bucket only decides which concern owns it.
 */

import SketchGallery from '@/components/SketchGallery';

export default function SketchesIndexPage() {
  return <SketchGallery bucket="diagram" />;
}
