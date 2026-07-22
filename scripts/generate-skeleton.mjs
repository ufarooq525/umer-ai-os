/**
 * One-shot scaffold generator — run from repo root with: node scripts/generate-skeleton.mjs
 * Safe to re-run; overwrites package stubs only.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const packages = [
  'contracts',
  'config',
  'db',
  'auth',
  'message-fabric',
  'kernel',
  'trust',
  'control-plane',
  'registry',
  'model-routing',
  'context',
  'memory-access',
  'orchestration',
  'artifacts',
  'resilience',
  'session',
  'resource-economy',
  'observability',
  'audit',
  'extension',
  'agent-runtime',
  'specialist-sdk',
  'plugin-sdk',
  'ui',
];

const apps = [
  'web',
  'api-gateway',
  'control-api',
  'orchestration-worker',
  'agent-worker',
  'extension-worker',
  'audit-sink',
];

function pkgJson(name, opts = {}) {
  const { deps = {}, devDeps = {}, scripts = {} } = opts;
  return JSON.stringify(
    {
      name: `@umer/${name}`,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
        },
      },
      scripts: {
        build: 'tsc -p tsconfig.json',
        clean: 'rimraf dist',
        typecheck: 'tsc -p tsconfig.json --noEmit',
        lint: 'eslint src --max-warnings=0',
        test: 'vitest run --passWithNoTests',
        dev: 'tsc -p tsconfig.json --watch --preserveWatchOutput',
        ...scripts,
      },
      dependencies: deps,
      devDependencies: {
        typescript: '^5.7.2',
        ...devDeps,
      },
    },
    null,
    2,
  );
}

function tsconfig(extendsPath = '../../tsconfig.base.json') {
  return JSON.stringify(
    {
      extends: extendsPath,
      compilerOptions: {
        outDir: 'dist',
        rootDir: 'src',
        composite: true,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'dist', 'node_modules'],
    },
    null,
    2,
  );
}

function stubIndex(packageName) {
  return `/**
 * @umer/${packageName}
 * Skeleton only — no business logic (Phase 6).
 */
export const packageName = '@umer/${packageName}' as const;
`;
}

for (const name of packages) {
  const dir = join(root, 'packages', name);
  mkdirSync(join(dir, 'src'), { recursive: true });

  const deps = {};
  if (name !== 'contracts' && name !== 'config') {
    // most packages will eventually depend on contracts/config; keep skeleton light
  }
  if (name === 'config') {
    deps['zod'] = '^3.24.1';
    deps['dotenv'] = '^16.4.7';
  }
  if (name === 'db') {
    deps['@umer/config'] = 'workspace:*';
    deps['postgres'] = '^3.4.5';
    deps['ioredis'] = '^5.4.2';
  }
  if (name === 'message-fabric') {
    deps['@umer/config'] = 'workspace:*';
    deps['@umer/observability'] = 'workspace:*';
    deps['nats'] = '^2.28.2';
  }
  if (name === 'observability') {
    deps['@umer/config'] = 'workspace:*';
    deps['@opentelemetry/api'] = '^1.9.0';
    deps['@opentelemetry/sdk-node'] = '^0.57.0';
    deps['@opentelemetry/sdk-trace-node'] = '^1.30.0';
    deps['@opentelemetry/resources'] = '^1.30.0';
    deps['@opentelemetry/semantic-conventions'] = '^1.28.0';
    deps['@opentelemetry/exporter-trace-otlp-http'] = '^0.57.0';
    deps['pino'] = '^9.6.0';
  }
  if (name === 'artifacts') {
    deps['@umer/config'] = 'workspace:*';
    deps['@aws-sdk/client-s3'] = '^3.721.0';
  }
  if (name === 'auth') {
    deps['@umer/config'] = 'workspace:*';
  }
  if (name === 'ui') {
    // react types only later; stub exports constants
  }

  writeFileSync(join(dir, 'package.json'), pkgJson(name, { deps }));
  writeFileSync(join(dir, 'tsconfig.json'), tsconfig());
  if (!existsSync(join(dir, 'src', 'index.ts'))) {
    writeFileSync(join(dir, 'src', 'index.ts'), stubIndex(name));
  }
}

for (const name of apps) {
  const dir = join(root, 'apps', name);
  mkdirSync(join(dir, 'src'), { recursive: true });

  const isWeb = name === 'web';
  const appPkg = {
    name: `@umer/app-${name}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: isWeb
      ? {
          build: 'next build',
          dev: 'next dev --port 3000',
          start: 'next start --port 3000',
          typecheck: 'tsc -p tsconfig.json --noEmit',
          lint: 'eslint src --max-warnings=0',
          test: 'vitest run --passWithNoTests',
          clean: 'rimraf .next',
        }
      : {
          build: 'tsc -p tsconfig.json',
          dev: 'tsx watch src/main.ts',
          start: 'node dist/main.js',
          typecheck: 'tsc -p tsconfig.json --noEmit',
          lint: 'eslint src --max-warnings=0',
          test: 'vitest run --passWithNoTests',
          clean: 'rimraf dist',
        },
    dependencies: {
      '@umer/config': 'workspace:*',
      '@umer/observability': 'workspace:*',
      ...(isWeb
        ? { next: '^15.1.2', react: '^19.0.0', 'react-dom': '^19.0.0' }
        : {
            '@umer/kernel': 'workspace:*',
            '@umer/message-fabric': 'workspace:*',
          }),
    },
    devDependencies: {
      typescript: '^5.7.2',
      ...(isWeb
        ? { '@types/react': '^19.0.2', '@types/react-dom': '^19.0.2' }
        : { tsx: '^4.19.2' }),
    },
  };

  writeFileSync(join(dir, 'package.json'), JSON.stringify(appPkg, null, 2));

  if (isWeb) {
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: '../../tsconfig.base.json',
          compilerOptions: {
            lib: ['DOM', 'DOM.Iterable', 'ES2022'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'preserve',
            noEmit: true,
            allowJs: true,
            incremental: true,
            plugins: [{ name: 'next' }],
            paths: { '@/*': ['./src/*'] },
            verbatimModuleSyntax: false,
          },
          include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
          exclude: ['node_modules'],
        },
        null,
        2,
      ),
    );
  } else {
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify(
        {
          extends: '../../tsconfig.base.json',
          compilerOptions: {
            outDir: 'dist',
            rootDir: 'src',
          },
          include: ['src/**/*.ts'],
          exclude: ['dist', 'node_modules'],
        },
        null,
        2,
      ),
    );
  }
}

console.log('Generated package.json + tsconfig for', packages.length, 'packages and', apps.length, 'apps');
