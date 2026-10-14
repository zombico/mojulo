import SketchPageClient from './SketchPageClient';
import RailPage from '@/components/rail/RailPage';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { hasBoundRender } from '@/lib/graph/image-outcomes/render-store';
import { railFor } from '@/lib/graph/rail/index';
import { isAuthEnabled } from '@/lib/auth/session';

// The bare frame's own params: printing, a chosen display mode (the Render Bay's eyes-gate links), or asking for it.
const BARE_PARAMS = ['print', 'display', 'mode', 'bare'];

export default async function SketchPage({ params, searchParams }) {
  const { ref } = await params;
  const search = (await searchParams) ?? {};
  const sketch = SketchRepository.getByRef(ref);

  // A recipe on a rail is a project: its outcomes, its book or World, its parts and its files, in the shell. The bare
  // frame stays for everything else, and for a rail recipe asked for bare.
  if (sketch && railFor(sketch.manifest) && !BARE_PARAMS.some((k) => search[k] !== undefined)) {
    return <RailPage refId={ref} initialTitle={sketch.title || null} authEnabled={isAuthEnabled()} />;
  }

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
