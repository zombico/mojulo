import SketchPageClient from './SketchPageClient';
import { SketchRepository } from '@/lib/db/repositories/sketches';

export default async function SketchPage({ params }) {
  const { ref } = await params;
  const sketch = SketchRepository.getByRef(ref);

  return (
    <SketchPageClient
      refId={ref}
      initialData={sketch || null}
      initialNotFound={!sketch}
    />
  );
}
