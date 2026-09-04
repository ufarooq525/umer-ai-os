import { describe, expect, it } from 'vitest';
import {
  classifySeoItem,
  deriveSeoOwnerBoard,
  explainSeoItem,
  isSeoGate,
  seoProjectIdFromGate,
} from './seo-owner';
import type { GateWaitRecord, ProjectRecord } from './control-api';

const project = (over: Partial<ProjectRecord> = {}): ProjectRecord => ({
  projectId: 'cursive-generator',
  name: 'Cursive Generator',
  slug: 'cursive-generator',
  path: 'cursive-generator',
  absolutePath: 'C:/laragon/www/cursive-generator',
  status: 'active',
  category: 'seo-project',
  stack: ['frontend'],
  defaultSpecialists: ['seo.audit'],
  constraints: [],
  tags: ['seo'],
  seoBaseUrl: 'https://www.cursive-font-generator.com',
  autoApplyEng: false,
  ...over,
});

const gate = (over: Partial<GateWaitRecord> = {}): GateWaitRecord => ({
  waitId: 'wait-seo',
  gateId: 'gate-seo-cursive-generator',
  execId: 'exec-1',
  workPackageId: 'wp-seo',
  stageFrom: 'Review',
  stageTo: 'Apply',
  status: 'Waiting',
  requiredApprovers: ['human.approver'],
  recordedApprovers: [],
  humanRequired: true,
  requestedAt: '2026-09-04T00:00:00.000Z',
  ...over,
});

describe('seo-owner', () => {
  it('classifies whitelist items as safe mechanical and titles as needing words', () => {
    expect(classifySeoItem('tech-canonical')).toBe('safe_mechanical');
    expect(classifySeoItem('onpage-title')).toBe('needs_your_words');
    expect(classifySeoItem('perf-lcp')).toBe('needs_search_console');
    expect(explainSeoItem('tech-canonical').owner).toMatch(/www and non-www/);
  });

  it('parses SEO gate ids without guessing other gates', () => {
    expect(isSeoGate('gate-seo-flow-tool-works')).toBe(true);
    expect(seoProjectIdFromGate('gate-seo-flow-tool-works')).toBe('flow-tool-works');
    expect(isSeoGate('gate-eng-school-app')).toBe(false);
    expect(seoProjectIdFromGate('gate-eng-school-app')).toBeNull();
  });

  it('puts owner sites first and keeps traffic unknown', () => {
    const board = deriveSeoOwnerBoard({
      projects: [
        project({
          projectId: 'umer-portfolio',
          name: 'Umer Portfolio',
          seoBaseUrl: undefined,
        }),
        project({
          projectId: 'flow-tool-works',
          name: 'Flow Tool Works',
          seoBaseUrl: 'https://toolworks.app',
        }),
        project(),
        project({
          projectId: 'school-app',
          name: 'School App',
          category: 'digital-product',
          tags: [],
          defaultSpecialists: ['qa.verify'],
        }),
      ],
      gates: [gate()],
    });
    expect(board.sites.map((s) => s.projectId)).toEqual([
      'cursive-generator',
      'flow-tool-works',
      'umer-portfolio',
    ]);
    expect(board.trafficKnown).toBe(false);
    expect(board.pendingApprovals).toBe(1);
    expect(board.sites[0]?.status).toBe('needs_approval');
    expect(board.sites[0]?.pendingGateWaitId).toBe('wait-seo');
    expect(board.sites[1]?.status).toBe('idle');
    expect(board.sites[2]?.status).toBe('url_unknown');
    expect(board.sites[0]?.traffic.status).toBe('unknown');
  });
});
