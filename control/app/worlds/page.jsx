/**
 * /worlds — the worlds on a rail, as cards that show how far each has come (components/rail/ProjectShelf.jsx).
 */

import ProjectShelf from '@/components/rail/ProjectShelf';
import { isAuthEnabled } from '@/lib/auth/session';

export default function WorldsPage() {
  return <ProjectShelf group="worlds" authEnabled={isAuthEnabled()} />;
}
