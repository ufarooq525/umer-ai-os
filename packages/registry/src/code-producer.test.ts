import { describe, expect, it, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  buildChangeSetDraft,
  createManualCodeProducer,
  createProjectFileReader,
  createScriptedCodeProducer,
  validateProducedChangeSet,
  type CodeProducer,
} from './code-producer.js';
import { contentHash, type EngChangeSetEntry } from './eng-diff.js';
import { runEngDelivery } from './eng-delivery.js';
import type { ResolvedProject } from './types.js';

const CONTROLLER_REL = 'app/Http/Controllers/FeeController.php';

const CONTROLLER = [
  '<?php',
  '',
  'class FeeController',
  '{',
  '    public function store(Request $request)',
  '    {',
  '        $data = $request->all();',
  '        return Fee::create($data);',
  '    }',
  '}',
  '',
].join('\n');

const CONTROLLER_FIXED = CONTROLLER.replace(
  '        $data = $request->all();',
  "        $data = $request->validate(['amount' => 'required|numeric']);",
);

function fakeProject(overrides: Partial<ResolvedProject> = {}): ResolvedProject {
  return {
    projectId: 'demo',
    name: 'Demo',
    slug: 'demo',
    path: 'demo',
    status: 'active',
    category: 'client-task',
    stack: ['fullstack'],
    defaultSpecialists: ['eng.app-delivery'],
    constraints: [],
    tags: [],
    absolutePath: '/tmp/demo',
    autoApplyEng: false,
    ...overrides,
  };
}

async function seedProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'umer-producer-'));
  await mkdir(join(dir, 'app', 'Http', 'Controllers'), { recursive: true });
  await writeFile(join(dir, 'phpunit.xml'), '<phpunit/>', 'utf8');
  await writeFile(join(dir, CONTROLLER_REL), CONTROLLER, 'utf8');
  return dir;
}

function validationChange(overrides: Partial<EngChangeSetEntry> = {}): EngChangeSetEntry {
  return {
    path: CONTROLLER_REL,
    expectedContent: CONTROLLER,
    expectedHash: contentHash(CONTROLLER),
    content: CONTROLLER_FIXED,
    note: 'Validate the fee payload',
    ...overrides,
  };
}

/** Producer that mirrors what an LLM adapter would return for this fixture. */
function fixtureProducer(changes: EngChangeSetEntry[]): CodeProducer {
  return createScriptedCodeProducer({
    id: 'test.fixture',
    description: 'Fixture producer',
    changes,
    notes: ['fixture note'],
  });
}

afterEach(() => {
  delete process.env.UMER_QA_SKIP_RUN;
});

describe('project file reader sandbox', () => {
  it('reads in-root files and refuses traversal', async () => {
    const dir = await seedProject();
    try {
      const read = createProjectFileReader(dir);
      expect(await read(CONTROLLER_REL)).toBe(CONTROLLER);
      expect(await read('../../etc/hosts')).toBeNull();
      expect(await read('does/not/exist.php')).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('buildChangeSetDraft', () => {
  it('pins the current base hash for existing files and marks missing ones as create', async () => {
    const dir = await seedProject();
    try {
      const draft = await buildChangeSetDraft({
        root: dir,
        scopeFiles: [
          { path: CONTROLLER_REL, exists: true },
          { path: 'app/Http/Controllers/NewController.php', exists: false },
        ],
        maxFiles: 3,
      });
      expect(draft).toHaveLength(2);
      expect(draft[0]).toMatchObject({
        path: CONTROLLER_REL,
        action: 'modify',
        expectedHash: contentHash(CONTROLLER),
      });
      expect(draft[0]!.currentBytes).toBeGreaterThan(0);
      expect(draft[1]).toMatchObject({ action: 'create', currentBytes: 0 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never drafts more than the file limit', async () => {
    const dir = await seedProject();
    try {
      const draft = await buildChangeSetDraft({
        root: dir,
        scopeFiles: ['a', 'b', 'c', 'd'].map((n) => ({ path: `${n}.php`, exists: false })),
        maxFiles: 2,
      });
      expect(draft).toHaveLength(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('validateProducedChangeSet', () => {
  const root = '/tmp/demo';

  it('accepts a well-formed change-set', () => {
    expect(
      validateProducedChangeSet({ root, changes: [validationChange()], maxFiles: 3 }),
    ).toEqual([]);
  });

  it('rejects an empty change-set', () => {
    expect(validateProducedChangeSet({ root, changes: [], maxFiles: 3 })).toContain(
      'producer returned an empty change-set',
    );
  });

  it('rejects traversal and absolute paths', () => {
    const problems = validateProducedChangeSet({
      root,
      changes: [
        validationChange({ path: '../../etc/hosts' }),
        validationChange({ path: 'C:/Windows/system32/drivers/etc/hosts' }),
      ],
      maxFiles: 3,
    });
    expect(problems.filter((p) => p.includes('unsafe path'))).toHaveLength(2);
  });

  it('rejects duplicates, empty content, and malformed hashes', () => {
    const problems = validateProducedChangeSet({
      root,
      changes: [
        validationChange(),
        validationChange(),
        validationChange({ path: 'other.php', content: '' }),
        validationChange({ path: 'third.php', expectedHash: 'nope' }),
      ],
      maxFiles: 4,
    });
    expect(problems.join(' ')).toContain('repeats');
    expect(problems.join(' ')).toContain('no replacement content');
    expect(problems.join(' ')).toContain('malformed expectedHash');
  });

  it('rejects paths outside the declared scope', () => {
    const problems = validateProducedChangeSet({
      root,
      changes: [validationChange({ path: 'app/Other.php' })],
      maxFiles: 3,
      allowedPaths: [CONTROLLER_REL],
    });
    expect(problems.join(' ')).toContain('outside the declared scope');
  });

  it('enforces the file ceiling', () => {
    const problems = validateProducedChangeSet({
      root,
      changes: ['a', 'b', 'c', 'd'].map((n) => validationChange({ path: `${n}.php` })),
      maxFiles: 3,
    });
    expect(problems.join(' ')).toContain('spans 4 files (limit 3)');
  });
});

describe('manual code producer', () => {
  it('declines and says what is needed instead', async () => {
    const producer = createManualCodeProducer();
    const outcome = await producer.produce({
      projectId: 'demo',
      projectName: 'Demo',
      absolutePath: '/tmp/demo',
      category: 'client-task',
      type: 'bug',
      goal: 'validate the fee payload',
      scopeFiles: [{ path: CONTROLLER_REL, exists: true }],
      maxFiles: 3,
      readProjectFile: async () => null,
    });
    expect(outcome.status).toBe('declined');
    if (outcome.status !== 'declined') throw new Error('expected decline');
    expect(outcome.reason).toContain('No code generator is configured');
    expect(outcome.notes?.join(' ')).toContain('proposedChanges');
  });
});

describe('runEngDelivery with an injected producer', () => {
  it('uses the produced change-set to build a ready work package', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload before creating a Fee',
        targetFiles: [CONTROLLER_REL],
        codeProducer: fixtureProducer([validationChange()]),
        runId: 'eng-producer-ready',
      });

      expect(report.status).toBe('ready');
      expect(report.production).toMatchObject({
        producerId: 'test.fixture',
        status: 'produced',
        changeCount: 1,
        problems: [],
      });
      expect(report.production?.draft[0]?.expectedHash).toBe(contentHash(CONTROLLER));
      expect(report.editStats.filesChanged).toBe(1);
      expect(report.proposedDiff).toContain('$request->validate');
      expect(report.blockers).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('blocks the package when the producer declines', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'feature',
        goal: 'Add a fee export endpoint',
        targetFiles: [CONTROLLER_REL],
        codeProducer: createManualCodeProducer(),
        runId: 'eng-producer-declined',
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.production?.status).toBe('declined');
      expect(report.blockers.join(' ')).toContain('declined');
      expect(report.edits).toEqual([]);
      expect(report.proposedDiff).toBe('');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects producer output that leaves the declared scope', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload',
        targetFiles: [CONTROLLER_REL],
        codeProducer: fixtureProducer([
          validationChange({ path: 'app/Http/Controllers/OtherController.php' }),
        ]),
        runId: 'eng-producer-out-of-scope',
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.production?.problems.join(' ')).toContain('outside the declared scope');
      expect(report.edits).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects producer output that tries to escape the project root', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload',
        codeProducer: fixtureProducer([validationChange({ path: '../../etc/hosts' })]),
        runId: 'eng-producer-traversal',
      });

      expect(report.status).toBe('needs-manual-scoping');
      expect(report.production?.problems.join(' ')).toContain('unsafe path');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('prefers an intake change-set over the producer', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload',
        targetFiles: [CONTROLLER_REL],
        proposedChanges: [validationChange()],
        codeProducer: fixtureProducer([
          validationChange({ content: `${CONTROLLER_FIXED}\n// producer version\n` }),
        ]),
        runId: 'eng-producer-skipped',
      });

      expect(report.status).toBe('ready');
      expect(report.production?.status).toBe('skipped');
      expect(report.proposedDiff).not.toContain('producer version');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the original behaviour when no producer is injected', async () => {
    process.env.UMER_QA_SKIP_RUN = '1';
    const dir = await seedProject();
    try {
      const report = await runEngDelivery({
        project: fakeProject({ absolutePath: dir }),
        type: 'bug',
        goal: 'Validate fee payload',
        targetFiles: [CONTROLLER_REL],
        runId: 'eng-producer-absent',
      });

      expect(report.production).toBeUndefined();
      expect(report.blockers.join(' ')).toContain('No proposedChanges supplied');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
