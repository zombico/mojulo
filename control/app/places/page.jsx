/**
 * /places — the places on a rail, as cards that show how far each has come (components/rail/ProjectShelf.jsx).
 */

import ProjectShelf from '@/components/rail/ProjectShelf';
import { isAuthEnabled } from '@/lib/auth/session';

export default function PlacesPage() {
  return <ProjectShelf group="places" authEnabled={isAuthEnabled()} />;
}
