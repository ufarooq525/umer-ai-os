#!/usr/bin/env node
/**
 * Build all production images from repo root.
 * Usage: node scripts/docker-build.mjs
 */
import { spawnSync } from 'node:child_process';

const workers = [
  'control-api',
  'api-gateway',
  'orchestration-worker',
  'agent-worker',
  'extension-worker',
  'audit-sink',
];

const tags = {
  'control-api': 'umer-control-api',
  'api-gateway': 'umer-gateway',
  'orchestration-worker': 'umer-orchestration',
  'agent-worker': 'umer-agent',
  'extension-worker': 'umer-extension',
  'audit-sink': 'umer-audit',
};

function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const app of workers) {
  run('docker', [
    'build',
    '-f',
    'infra/docker/Dockerfile.worker',
    '--build-arg',
    `APP_NAME=${app}`,
    '-t',
    `${tags[app]}:local`,
    '.',
  ]);
}

run('docker', [
  'build',
  '-f',
  'infra/docker/Dockerfile.web',
  '--build-arg',
  'NEXT_PUBLIC_CONTROL_API_URL=http://localhost:4000',
  '-t',
  'umer-web:local',
  '.',
]);

console.log('\nAll images built: umer-*-local');
