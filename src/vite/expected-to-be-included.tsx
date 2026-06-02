export function ExpectedToBeIncluded({ owner }: { owner: string }) {
  return <span>{`__EXPECTED_SHARED_MARKER__:${owner}`}</span>;
}
