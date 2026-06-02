import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

type ModuleInfo = {
  id: string;
  isEntry: boolean;
  importedIds: string[];
};

type ChunkingContext = {
  getModuleInfo(id: string): ModuleInfo | null;
};

const ROOTS = {
  root1: path.resolve('src/vite/root1.tsx'),
  root2: path.resolve('src/vite/root2.tsx'),
};

const TARGETS = {
  expected: path.resolve('src/vite/expected-to-be-included.tsx'),
  eliminatedWrapper: path.resolve('src/vite/eliminated-import.tsx'),
  nestedComponent: path.resolve('src/vite/component-only-rendered-in-here.tsx'),
};

const diagnostics = {
  eliminatedWrapperReportedShared: false,
  nestedComponentReportedShared: false,
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

  function getReachability(ctx: ChunkingContext) {
    if (reachability) {
      return reachability;
    }

    const root1 = new Set<string>();
    const root2 = new Set<string>();
    walkStaticImports(ctx, ROOTS.root1, root1);
    walkStaticImports(ctx, ROOTS.root2, root2);
    reachability = { root1, root2 };

    console.log('\n[vite debug] target reachability reported by chunking context:');
    for (const [label, modulePath] of Object.entries(TARGETS)) {
      const id = normalizeId(modulePath);
      const owners = [
        root1.has(id) && 'root1',
        root2.has(id) && 'root2',
      ].filter(Boolean);
      const reportedShared = owners.length === 2;

      if (label === 'eliminatedWrapper') {
        diagnostics.eliminatedWrapperReportedShared = reportedShared;
      }
      if (label === 'nestedComponent') {
        diagnostics.nestedComponentReportedShared = reportedShared;
      }

      console.log(
        `[vite chunking graph] ${shortId(modulePath)} owners=${owners.join(',') || '<none>'} -> ${
          reportedShared ? 'shared' : 'not-shared'
        }`
      );
    }

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

    if (Object.values(TARGETS).some((target) => id === normalizeId(target))) {
      console.log(
        `[vite chunking] ${shortId(id)} owners=${[
          inRoot1 && 'root1',
          inRoot2 && 'root2',
        ].filter(Boolean).join(',') || '<none>'} -> ${chunkName}`
      );
    }

    return chunkName;
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'verify-vite-final-output',
      generateBundle(_options, bundle) {
        const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
        const allCode = chunks.map((chunk) => chunk.code).join('\n');
        const fileNames = chunks.map((chunk) => chunk.fileName).join(', ');

        console.log('\n[vite final bundle check]');
        console.log(`  emitted chunks: ${fileNames}`);
        console.log(
          `  contains __EXPECTED_SHARED_MARKER__: ${allCode.includes('__EXPECTED_SHARED_MARKER__')}`
        );
        console.log(
          `  contains __ELIMINATED_WRAPPER_MARKER__: ${allCode.includes('__ELIMINATED_WRAPPER_MARKER__')}`
        );
        console.log(
          `  contains __COMPONENT_ONLY_RENDERED_IN_HERE_MARKER__: ${allCode.includes('__COMPONENT_ONLY_RENDERED_IN_HERE_MARKER__')}`
        );
        console.log(
          `  wrapper mismatch reproduced: ${diagnostics.eliminatedWrapperReportedShared && !allCode.includes('__ELIMINATED_WRAPPER_MARKER__')}`
        );
        console.log(
          `  nested component mismatch reproduced: ${diagnostics.nestedComponentReportedShared && !allCode.includes('__COMPONENT_ONLY_RENDERED_IN_HERE_MARKER__')}`
        );
      },
    },
  ],
  define: {
    __RESTRICTED__: 'false',
  },
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: 'dist-vite',
    rolldownOptions: {
      input: {
        root1: ROOTS.root1,
        root2: ROOTS.root2,
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              test(id) {
                return normalizeId(id).includes('/src/vite/') && id.endsWith('.tsx');
              },
              name: createChunkName(),
            },
          ],
        },
      },
    },
  },
});
