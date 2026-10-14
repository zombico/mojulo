/**
 * /elements — what a world is built and styled from: the repertoire of sheets, and every geocube, kit and city grammar
 * (components/elements/ElementsBody.jsx).
 */

import ElementsBody from '@/components/elements/ElementsBody';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ElementsPage() {
  return <ElementsBody authEnabled={isAuthEnabled()} />;
}
