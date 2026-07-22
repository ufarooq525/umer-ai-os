import { describe, expect, it } from 'vitest';
import { computeSpecHash, parseMarkdownSpec, parseYamlBlock } from './parser.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('parser', () => {
  it('parses frontmatter, agent, and enterprise sections', () => {
    const parsed = parseMarkdownSpec(buildValidSpecialistSpec());
    expect(parsed.title).toBe('Application Delivery Specialist');
    expect(parsed.frontmatter.specialist_id).toBe('eng.app-delivery');
    expect(parsed.agentSections.Mission).toContain('Deliver application changes');
    expect(parsed.enterpriseSections.E5).toContain('Must refuse');
  });

  it('parses yaml blocks', () => {
    expect(parseYamlBlock('department: Engineering\nstatus: Active')).toEqual({
      department: 'Engineering',
      status: 'Active',
    });
  });

  it('computes stable spec hash', () => {
    const content = buildValidSpecialistSpec();
    const hash = computeSpecHash(content);
    expect(hash).toHaveLength(64);
    expect(computeSpecHash(`  ${content}  `)).toBe(hash);
  });

  it('ignores yaml comments and lines without separators', () => {
    expect(
      parseYamlBlock('# comment\ninvalid-line\nkey: value'),
    ).toEqual({ key: 'value' });
  });

  it('ignores invalid enterprise headings', () => {
    const parsed = parseMarkdownSpec(`${buildValidSpecialistSpec()}\n## E99 — Invalid\n\nnoop`);
    expect(parsed.enterpriseSections.E99).toBeUndefined();
  });
});
