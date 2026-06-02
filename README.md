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
pnpm vite:repro
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

## Vite 8 signal

The Vite repro uses `vite@8` with `build.rolldownOptions`, React TSX entries,
`codeSplitting.includeDependenciesRecursively: false`, and this eliminated JSX
shape:

```tsx
const component = __RESTRICTED__ ? (
  <EliminatedImport>
    <ComponentOnlyRenderedInHere />
  </EliminatedImport>
) : null;
```

Run:

```sh
pnpm vite:repro
```

The important output is:

```txt
[vite chunking graph] src/vite/eliminated-import.tsx owners=root1,root2 -> shared
[vite chunking graph] src/vite/component-only-rendered-in-here.tsx owners=root1,root2 -> shared
[vite chunking] src/vite/component-only-rendered-in-here.tsx owners=root1,root2 -> shared
[vite chunking] src/vite/eliminated-import.tsx owners=root1,root2 -> shared

[vite final bundle check]
  contains __ELIMINATED_WRAPPER_MARKER__: false
  contains __COMPONENT_ONLY_RENDERED_IN_HERE_MARKER__: false
  wrapper mismatch reproduced: true
  nested component mismatch reproduced: true
```

In Vite 8, the eliminated wrapper and nested component are assigned to `shared`
by the custom chunking callback, but their code is not emitted in the final
bundle.

With `includeDependenciesRecursively: false`, dependencies of captured modules
are not automatically pulled into the same chunk. In this repro, that moves the
React JSX runtime into a separate `jsx-runtime.js` chunk instead of keeping it in
`shared.js`. It does not change the stale graph exposed to the callback, and it
does not force the eliminated wrapper or nested component into the emitted code.
The practical issue is stale chunking-time reachability, not that this minimal
case forces dead code back into the generated output.
