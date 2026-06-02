# Rolldown code splitting graph repro

This repository demonstrates a mismatch between Rolldown's custom code splitting
graph and the final tree-shaken bundle.

The repro uses `output.codeSplitting.groups[].name` to inspect static imports via
`ctx.getModuleInfo(id).importedIds`. Both entry roots statically import
`src/internal-module.tsx`, but those imports only appear inside a branch guarded
by `__IS_GATED_BUILD__`. The Rolldown replace plugin turns that symbol into
literal `false`, so the branch and import are removed by DCE.

The issue is that the code splitting callback still sees
`src/internal-module.tsx` as reachable from both roots and classifies it as
`shared`, even though the final generated bundle no longer contains the module's
marker string.

## Run

```sh
pnpm install
pnpm repro
```

## Expected signal

The important output is:

```txt
[chunking graph] src/expected-to-be-included.tsx owners=root1,root2 -> shared
[chunking graph] src/internal-module.tsx owners=root1,root2 -> shared

[final bundle check]
  contains __EXPECTED_SHARED_MARKER__: true
  contains __INTERNAL_MODULE_MARKER__: false
  mismatch reproduced: true
```

`expected-to-be-included.tsx` is truly shared and remains in the final bundle.
`internal-module.tsx` is reported as shared by the chunking graph, but is absent
from the final bundle after replacement and tree-shaking.
