/**
 * /elements/<family>/<id> — one element: its specimen live, its colours, the recipes that name it, its document
 * (components/elements/ElementPage.jsx).
 */

import ElementPage from '@/components/elements/ElementPage';
import { isAuthEnabled } from '@/lib/auth/session';

export default async function Page({ params }) {
  const { family, id } = await params;
  return <ElementPage family={family} id={id} authEnabled={isAuthEnabled()} />;
}
