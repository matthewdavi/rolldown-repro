export function ComponentOnlyRenderedInHere({ owner }: { owner: string }) {
  return <span>{`__COMPONENT_ONLY_RENDERED_IN_HERE_MARKER__:${owner}`}</span>;
}
