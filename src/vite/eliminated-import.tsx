import type { ReactNode } from 'react';

export function EliminatedImport({
  children,
  owner,
}: {
  children: ReactNode;
  owner: string;
}) {
  return <section data-owner={owner}>{`__ELIMINATED_WRAPPER_MARKER__:${owner}`}{children}</section>;
}
