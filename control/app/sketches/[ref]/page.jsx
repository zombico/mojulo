import SketchPageClient from './SketchPageClient';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';

export default async function SketchPage({ params }) {
  const { ref } = await params;
  const sketch = SketchRepository.getByRef(ref);

  // The two display-mode facts that don't live in the manifest. Both are cheap
  // (one indexed lookup, one directory probe) and resolved here so the client
  // never has to round-trip to find out which modes exist. `<ref>_gi` is the
  // variant the generated-mesh GI adapter mints (scripts/bake-world-gi.mjs).
  const giVariantRef = sketch && SketchRepository.getByRef(`${ref}_gi`) ? `${ref}_gi` : null;
  const boundRender = sketch ? hasBoundRender(ref) : false;

  return (
    <SketchPageClient
      refId={ref}
      initialData={sketch || null}
      initialNotFound={!sketch}
      giVariantRef={giVariantRef}
      hasBoundRender={boundRender}
    />
  );
}
