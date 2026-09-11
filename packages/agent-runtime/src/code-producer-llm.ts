import { contentHash, type CodeProducer, type CodeProductionRequest, type CodeProductionOutcome, type EngChangeSetEntry } from '@umer/registry';
import type { LLMProvider, ChatMessage } from '@umer/model-routing';

export type LlmCodeProducerOptions = {
  provider: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
};

/**
 * Strips <think>...</think> blocks from reasoning models (e.g. Qwen, DeepSeek).
 */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Fixes unescaped literal control characters (newlines, carriage returns, tabs)
 * that occur inside JSON string literals.
 */
function fixControlCharactersInJson(input: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === '\\') {
        result += char;
        isEscaped = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  return result;
}

/**
 * Normalizes invalid backslash escapes in JSON strings (e.g. \\$var or \\App\\Namespace
 * where the LLM only emitted a single backslash before a non-JSON escape character).
 */
function sanitizeJsonEscapes(raw: string): string {
  return raw.replace(/\\(?:[^"\\/bfnrtu]|u(?![\da-fA-F]{4}))/g, (match) => {
    return '\\\\' + match.slice(1);
  });
}

function parseJsonCandidate(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Attempt 1: Fix invalid backslash escapes (e.g. \$ in PHP code)
    const escapeFixed = sanitizeJsonEscapes(trimmed);
    try {
      return JSON.parse(escapeFixed);
    } catch {
      // Attempt 2: Fix unescaped control characters inside string literals
      const controlFixed = fixControlCharactersInJson(escapeFixed);
      return JSON.parse(controlFixed);
    }
  }
}

/**
 * Extracts a JSON object from text that may contain markdown code fences.
 */
function extractJsonPayload(text: string): unknown {
  const cleaned = stripThinking(text);

  // Try direct parse first
  try {
    return parseJsonCandidate(cleaned);
  } catch {
    // Try code fence extraction: ```json ... ``` or ``` ... ```
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
      try {
        return parseJsonCandidate(fenceMatch[1]);
      } catch {
        // Continue to regex bracket search
      }
    }

    // Try finding the first outer curly brace pair { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = cleaned.slice(firstBrace, lastBrace + 1);
      return parseJsonCandidate(jsonSub);
    }

    throw new Error('No valid JSON structure found in model output');
  }
}

type ParsedRawChange = {
  path?: unknown;
  content?: unknown;
  note?: unknown;
};

type ParsedLlmOutput = {
  changes?: ParsedRawChange[];
  notes?: string[];
  declinedReason?: string;
};

/**
 * Creates an autonomous LLM CodeProducer that:
 * 1. Inspects real repository files via request.readProjectFile.
 * 2. Prompts the configured LLMProvider (e.g. Qwen 3 8B) with the exact problem,
 *    acceptance criteria, and current file contents.
 * 3. Extracts structured file replacements and binds them to the verified
 *    expectedContent and expectedHash on disk.
 * 4. Fails closed with an honest 'declined' status if the model output is malformed
 *    or fails validation.
 */
export function createLlmCodeProducer(options: LlmCodeProducerOptions): CodeProducer {
  const provider = options.provider;
  const id = `llm.${provider.providerId}`;

  return {
    id,
    describe() {
      return `Autonomous LLM Code Producer via ${provider.providerId} (${options.model ?? 'default model'})`;
    },
    async produce(request: CodeProductionRequest): Promise<CodeProductionOutcome> {
      // 1. Repository inspection: read current bytes for scoped files
      const inspectedFiles: Array<{
        path: string;
        content: string | null;
        exists: boolean;
      }> = [];

      for (const file of request.scopeFiles.slice(0, request.maxFiles)) {
        const content = await request.readProjectFile(file.path);
        inspectedFiles.push({
          path: file.path,
          content,
          exists: content !== null,
        });
      }

      if (inspectedFiles.length === 0) {
        return {
          status: 'declined',
          reason: 'No files are in scope to inspect or modify.',
        };
      }

      // 2. Build grounded prompt with inspected repository contents
      const filesContext = inspectedFiles
        .map((f) => {
          if (!f.exists || f.content === null) {
            return `--- FILE (NEW): ${f.path} ---\n(File currently does not exist)`;
          }
          return `--- FILE: ${f.path} ---\n${f.content}`;
        })
        .join('\n\n');

      const systemPrompt =
        options.systemPrompt ??
        `You are a Lead Software Engineer working on the autonomous delivery of software projects.
Your job is to implement real, high-quality code changes for the specified goal in the target repository.

CONSTRAINTS & RULES:
1. You must output ONLY valid JSON matching the schema below.
2. The "path" must be one of the files provided in the prompt.
3. The "content" must be the COMPLETE, READY-TO-RUN code for the file (not a diff, not a snippet, no ellipses/placeholders).
4. Preserve existing style, framework conventions, and imports.
5. In the JSON "content" string: escape backslashes as \\ and double quotes as \". Do NOT escape dollar signs (use $a, never \$a).
6. If you cannot safely implement the change or the request is ambiguous/impossible, provide a "declinedReason".

JSON RESPONSE SCHEMA:
{
  "changes": [
    {
      "path": "path/to/file.ext",
      "content": "...complete replacement code...",
      "note": "Clear explanation of what was changed and why"
    }
  ],
  "notes": ["Optional notes on implementation details"]
}`;

      const knowledgeBlock =
        request.knowledgeContext && request.knowledgeContext.length > 0
          ? `COMPANY KNOWLEDGE & OPERATIONAL LEARNINGS:\n${request.knowledgeContext.map((k) => `- ${k}`).join('\n')}\n\n`
          : '';

      const userPrompt = `PROJECT: ${request.projectName} (Category: ${request.category}, Type: ${request.type})
GOAL: ${request.goal}
${request.doneWhen ? `DONE WHEN: ${request.doneWhen}\n` : ''}${knowledgeBlock}INSPECTED REPOSITORY FILES:
${filesContext}

Implement the requested change now. Output only the JSON response object.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // 3. Query LLM Provider
      let responseContent: string;
      try {
        const res = await provider.chat({
          messages,
          temperature: options.temperature ?? 0.1,
          maxTokens: options.maxTokens ?? 4096,
        });
        responseContent = res.message.content ?? '';
      } catch (err) {
        return {
          status: 'declined',
          reason: `LLM Provider error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // 4. Parse model response
      let parsed: ParsedLlmOutput;
      try {
        parsed = extractJsonPayload(responseContent) as ParsedLlmOutput;
      } catch (err) {
        return {
          status: 'declined',
          reason: `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}`,
          notes: [responseContent.slice(0, 500)],
        };
      }

      if (parsed.declinedReason) {
        return {
          status: 'declined',
          reason: `Model declined to author changes: ${parsed.declinedReason}`,
          notes: parsed.notes,
        };
      }

      if (!Array.isArray(parsed.changes) || parsed.changes.length === 0) {
        return {
          status: 'declined',
          reason: 'Model returned no file changes in response.',
          notes: parsed.notes,
        };
      }

      // 5. Structure and validate proposed changes against inspected repository state
      const resolvedChanges: EngChangeSetEntry[] = [];
      const inspectedByPath = new Map(inspectedFiles.map((f) => [f.path, f]));

      for (const change of parsed.changes) {
        const path = String(change.path ?? '').trim().replace(/\\/g, '/');
        const content = typeof change.content === 'string' ? change.content : '';
        const note = typeof change.note === 'string' ? change.note : `Update ${path}`;

        if (!path) {
          return {
            status: 'declined',
            reason: 'Model produced a change missing a target file path.',
          };
        }

        if (!content) {
          return {
            status: 'declined',
            reason: `Model produced empty content for ${path}.`,
          };
        }

        const inspected = inspectedByPath.get(path);
        const expectedContent = inspected?.content ?? null;

        // Check if identical to existing
        if (expectedContent !== null && expectedContent.trim() === content.trim()) {
          return {
            status: 'declined',
            reason: `Model returned identical content for ${path} without making any changes.`,
          };
        }

        resolvedChanges.push({
          path,
          expectedContent,
          expectedHash: expectedContent !== null ? contentHash(expectedContent) : undefined,
          content,
          note,
        });
      }

      return {
        status: 'produced',
        changes: resolvedChanges,
        notes: parsed.notes ?? [`Authored by ${id} for goal: ${request.goal}`],
      };
    },
  };
}
