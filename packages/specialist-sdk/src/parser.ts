import { createHash } from 'node:crypto';
import type { AgentSectionName, EnterpriseSectionId } from './types.js';
import { AGENT_SECTIONS, ENTERPRISE_SECTIONS } from './constants.js';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const TITLE_RE = /^#\s+(.+)$/m;
const SECTION_RE = /^##\s+(.+)$/gm;
const ENTERPRISE_HEADING_RE = /^E(\d{1,2})\s*[—\-:.]\s*(.+)$/i;

export function parseYamlBlock(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

function normalizeSectionName(raw: string): AgentSectionName | undefined {
  const normalized = raw.trim();
  return AGENT_SECTIONS.find(
    (section) => section.toLowerCase() === normalized.toLowerCase(),
  );
}

function parseEnterpriseHeading(raw: string): EnterpriseSectionId | undefined {
  const match = raw.trim().match(ENTERPRISE_HEADING_RE);
  if (!match) {
    return undefined;
  }
  const id = `E${Number(match[1])}` as EnterpriseSectionId;
  return ENTERPRISE_SECTIONS.some((section) => section.id === id) ? id : undefined;
}

function parseEnterpriseByTitle(raw: string): EnterpriseSectionId | undefined {
  const normalized = raw.trim().toLowerCase();
  const found = ENTERPRISE_SECTIONS.find(
    (section) => section.title.toLowerCase() === normalized,
  );
  return found?.id;
}

export function parseMarkdownSpec(content: string): {
  title: string;
  frontmatter: Record<string, string>;
  agentSections: Partial<Record<AgentSectionName, string>>;
  enterpriseSections: Partial<Record<EnterpriseSectionId, string>>;
  rawContent: string;
} {
  let body = content;
  let frontmatter: Record<string, string> = {};

  const frontmatterMatch = body.match(FRONTMATTER_RE);
  if (frontmatterMatch) {
    frontmatter = parseYamlBlock(frontmatterMatch[1] ?? '');
    body = body.slice(frontmatterMatch[0].length);
  }

  const titleMatch = body.match(TITLE_RE);
  const title = titleMatch?.[1]?.trim() ?? frontmatter.title ?? 'Untitled Specialist';

  const agentSections: Partial<Record<AgentSectionName, string>> = {};
  const enterpriseSections: Partial<Record<EnterpriseSectionId, string>> = {};

  const matches = [...body.matchAll(SECTION_RE)];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const heading = match?.[1]?.trim() ?? '';
    const start = (match?.index ?? 0) + (match?.[0].length ?? 0);
    const end = matches[i + 1]?.index ?? body.length;
    const sectionBody = body.slice(start, end).trim();

    const agentSection = normalizeSectionName(heading);
    if (agentSection) {
      agentSections[agentSection] = sectionBody;
      continue;
    }

    const enterpriseId =
      parseEnterpriseHeading(heading) ?? parseEnterpriseByTitle(heading);
    if (enterpriseId) {
      enterpriseSections[enterpriseId] = sectionBody;
    }
  }

  const metadata = agentSections.Metadata;
  if (metadata) {
    frontmatter = { ...frontmatter, ...parseYamlBlock(metadata) };
  }

  return {
    title,
    frontmatter,
    agentSections,
    enterpriseSections,
    rawContent: content,
  };
}

export function normalizeSpecContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}

export function computeSpecHash(content: string): string {
  const normalized = normalizeSpecContent(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
