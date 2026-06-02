import path from 'node:path';
import { defineConfig } from 'rolldown';
import { replacePlugin } from 'rolldown/plugins';

type ModuleInfo = {
  id: string;
  isEntry: boolean;
  importedIds: string[];
};

type ChunkingContext = {
  getModuleInfo(id: string): ModuleInfo | null;
};

const ROOTS = {
  root1: path.resolve('src/root1.tsx'),
  root2: path.resolve('src/root2.tsx'),
};

const TARGETS = {
  expected: path.resolve('src/expected-to-be-included.tsx'),
  internal: path.resolve('src/internal-module.tsx'),
};

const diagnostics = {
  expectedReportedShared: false,
  internalReportedShared: false,
};

function normalizeId(id: string): string {
  return id.replace(/\\/g, '/');
}

function shortId(id: string): string {
  const normalized = normalizeId(id);
  const srcIndex = normalized.lastIndexOf('/src/');
  return srcIndex === -1 ? normalized : normalized.slice(srcIndex + 1);
}

function createChunkName() {
  let reachability: null | {
    root1: Set<string>;
    root2: Set<string>;
  } = null;

  function walkStaticImports(ctx: ChunkingContext, moduleId: string, seen: Set<string>) {
    const normalized = normalizeId(moduleId);
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    const info = ctx.getModuleInfo(moduleId);
    for (const importedId of info?.importedIds ?? []) {
      walkStaticImports(ctx, importedId, seen);
    }
  }

  function ownersFor(graph: { root1: Set<string>; root2: Set<string> }, modulePath: string) {
    const id = normalizeId(modulePath);
    return [
      graph.root1.has(id) && 'root1',
      graph.root2.has(id) && 'root2',
    ].filter(Boolean);
  }

  function logTargetReachability(
    graph: { root1: Set<string>; root2: Set<string> },
    label: 'expected' | 'internal',
    modulePath: string
  ) {
    const owners = ownersFor(graph, modulePath);
    const reportedShared = owners.length === 2;
    diagnostics[`${label}ReportedShared`] = reportedShared;

    console.log(
      `[chunking graph] ${shortId(modulePath)} owners=${owners.join(',') || '<none>'} -> ${
        reportedShared ? 'shared' : 'not-shared'
      }`
    );
  }

  function getReachability(ctx: ChunkingContext) {
    if (reachability) {
      return reachability;
    }

    const root1 = new Set<string>();
    const root2 = new Set<string>();
    walkStaticImports(ctx, ROOTS.root1, root1);
    walkStaticImports(ctx, ROOTS.root2, root2);
    reachability = { root1, root2 };

    console.log('\n[debug] static closure from root1:');
    for (const id of [...root1].sort()) {
      console.log(`  - ${shortId(id)}`);
    }

    console.log('\n[debug] static closure from root2:');
    for (const id of [...root2].sort()) {
      console.log(`  - ${shortId(id)}`);
    }

    console.log('\n[debug] target reachability reported by chunking context:');
    logTargetReachability(reachability, 'expected', TARGETS.expected);
    logTargetReachability(reachability, 'internal', TARGETS.internal);

    return reachability;
  }

  return function name(moduleId: string, ctx: ChunkingContext): string | null {
    const info = ctx.getModuleInfo(moduleId);
    if (!info || info.isEntry) {
      return null;
    }

    const id = normalizeId(moduleId);
    const graph = getReachability(ctx);
    const inRoot1 = graph.root1.has(id);
    const inRoot2 = graph.root2.has(id);
    const chunkName =
      inRoot1 && inRoot2 ? 'shared' :
      inRoot1 ? 'root1-only' :
      inRoot2 ? 'root2-only' :
      null;

    if (
      id.endsWith('/internal-module.tsx') ||
      id.endsWith('/expected-to-be-included.tsx')
    ) {
      console.log(
        `[chunking] ${shortId(id)} owners=${[
          inRoot1 && 'root1',
          inRoot2 && 'root2',
        ].filter(Boolean).join(',') || '<none>'} -> ${chunkName}`
      );
    }

    return chunkName;
  };
}

export default defineConfig({
  input: {
    root1: ROOTS.root1,
    root2: ROOTS.root2,
  },
  treeshake: true,
  plugins: [
    replacePlugin({
      __IS_GATED_BUILD__: 'false',
    }),
    {
      name: 'verify-final-output',
      generateBundle(_options, bundle) {
        const allCode = Object.values(bundle)
          .filter((assetOrChunk) => assetOrChunk.type === 'chunk')
          .map((chunk) => chunk.code)
          .join('\n');

        console.log('\n[final bundle check]');
        console.log(
          `  contains __EXPECTED_SHARED_MARKER__: ${allCode.includes('__EXPECTED_SHARED_MARKER__')}`
        );
        console.log(
          `  contains __INTERNAL_MODULE_MARKER__: ${allCode.includes('__INTERNAL_MODULE_MARKER__')}`
        );
        console.log(
          `  mismatch reproduced: ${diagnostics.internalReportedShared && !allCode.includes('__INTERNAL_MODULE_MARKER__')}`
        );
      },
    },
  ],
  output: {
    dir: 'dist',
    format: 'esm',
    minify: false,
    entryFileNames: '[name].js',
    chunkFileNames: '[name].js',
    codeSplitting: {
      groups: [
        {
          test(id) {
            return normalizeId(id).includes('/src/') && id.endsWith('.tsx');
          },
          name: createChunkName(),
        },
      ],
    },
  },
});
