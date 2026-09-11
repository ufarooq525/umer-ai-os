import { describe, expect, it } from 'vitest';
import type { LLMProvider, ChatRequest, ChatResponse } from '@umer/model-routing';
import { createLlmCodeProducer } from './code-producer-llm.js';
import type { CodeProductionRequest } from '@umer/registry';

function mockProvider(responseContent: string | (() => Promise<string>)): LLMProvider {
  return {
    providerId: 'mock-llm',
    chat: async (_req: ChatRequest): Promise<ChatResponse> => {
      const content = typeof responseContent === 'function' ? await responseContent() : responseContent;
      return {
        message: { role: 'assistant', content },
        finishReason: 'stop',
      };
    },
  };
}

function createMockRequest(overrides: Partial<CodeProductionRequest> = {}): CodeProductionRequest {
  const files: Record<string, string> = {
    'Math.php': '<?php\nclass Math {\n  public static function add($a, $b) { return $a + $b; }\n}\n',
    'tests/MathTest.php': '<?php\nclass MathTest extends TestCase {\n  public function testAdd() { $this->assertEquals(4, Math::add(2, 2)); }\n}\n',
  };

  return {
    projectId: 'test-proj',
    projectName: 'Test Project',
    absolutePath: '/mock/path',
    category: 'digital-product',
    type: 'feature',
    goal: 'Add multiply method to Math.php with unit test',
    maxFiles: 3,
    scopeFiles: [
      { path: 'Math.php', exists: true },
      { path: 'tests/MathTest.php', exists: true },
    ],
    readProjectFile: async (rel) => files[rel] ?? null,
    ...overrides,
  };
}

describe('createLlmCodeProducer', () => {
  it('produces valid structured change-sets from LLM output', async () => {
    const updatedMath =
      '<?php\nclass Math {\n  public static function add($a, $b) { return $a + $b; }\n  public static function multiply($a, $b) { return $a * $b; }\n}\n';
    const updatedTest =
      '<?php\nclass MathTest extends TestCase {\n  public function testAdd() { $this->assertEquals(4, Math::add(2, 2)); }\n  public function testMultiply() { $this->assertEquals(6, Math::multiply(2, 3)); }\n}\n';

    const llmJson = JSON.stringify({
      changes: [
        {
          path: 'Math.php',
          content: updatedMath,
          note: 'Add multiply() method',
        },
        {
          path: 'tests/MathTest.php',
          content: updatedTest,
          note: 'Add testMultiply() test method',
        },
      ],
      notes: ['Implemented multiplication support'],
    });

    const provider = mockProvider(llmJson);
    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest();

    const outcome = await producer.produce(request);

    expect(outcome.status).toBe('produced');
    if (outcome.status === 'produced') {
      expect(outcome.changes).toHaveLength(2);
      expect(outcome.changes[0]!.path).toBe('Math.php');
      expect(outcome.changes[0]!.content).toBe(updatedMath);
      expect(outcome.changes[0]!.expectedContent).toContain('class Math');
      expect(outcome.changes[0]!.expectedHash).toBeTruthy();

      expect(outcome.changes[1]!.path).toBe('tests/MathTest.php');
      expect(outcome.changes[1]!.content).toBe(updatedTest);
      expect(outcome.changes[1]!.expectedContent).toContain('class MathTest');
      expect(outcome.changes[1]!.expectedHash).toBeTruthy();
    }
  });

  it('strips <think> tags and parses markdown code-fences from reasoning models', async () => {
    const updatedMath =
      '<?php\nclass Math {\n  public static function add($a, $b) { return $a + $b; }\n  public static function subtract($a, $b) { return $a - $b; }\n}\n';

    const responseWithThink = `
<think>
We need to add a subtract method.
Let's inspect Math.php and produce clean PHP code.
</think>

Here is the implementation:
\`\`\`json
{
  "changes": [
    {
      "path": "Math.php",
      "content": ${JSON.stringify(updatedMath)},
      "note": "Add subtract method"
    }
  ],
  "notes": ["Added subtraction method"]
}
\`\`\`
`;

    const provider = mockProvider(responseWithThink);
    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest({
      scopeFiles: [{ path: 'Math.php', exists: true }],
    });

    const outcome = await producer.produce(request);

    expect(outcome.status).toBe('produced');
    if (outcome.status === 'produced') {
      expect(outcome.changes).toHaveLength(1);
      expect(outcome.changes[0]!.path).toBe('Math.php');
      expect(outcome.changes[0]!.content).toBe(updatedMath);
    }
  });

  it('declines honestly when model provides declinedReason', async () => {
    const llmJson = JSON.stringify({
      declinedReason: 'Target file not understood or outside safety boundary',
      notes: ['Refusing to author change without clear specification'],
    });

    const provider = mockProvider(llmJson);
    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest();

    const outcome = await producer.produce(request);

    expect(outcome.status).toBe('declined');
    if (outcome.status === 'declined') {
      expect(outcome.reason).toContain('Target file not understood');
    }
  });

  it('declines honestly when model returns identical content without changes', async () => {
    const identicalMath = '<?php\nclass Math {\n  public static function add($a, $b) { return $a + $b; }\n}\n';
    const llmJson = JSON.stringify({
      changes: [
        {
          path: 'Math.php',
          content: identicalMath,
          note: 'No changes',
        },
      ],
    });

    const provider = mockProvider(llmJson);
    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest({
      scopeFiles: [{ path: 'Math.php', exists: true }],
    });

    const outcome = await producer.produce(request);

    expect(outcome.status).toBe('declined');
    if (outcome.status === 'declined') {
      expect(outcome.reason).toContain('identical content');
    }
  });

  it('declines honestly when LLM provider throws', async () => {
    const provider: LLMProvider = {
      providerId: 'failing-provider',
      chat: async () => {
        throw new Error('Connection refused to LLM host');
      },
    };

    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest();

    const outcome = await producer.produce(request);

    expect(outcome.status).toBe('declined');
    if (outcome.status === 'declined') {
      expect(outcome.reason).toContain('Connection refused to LLM host');
    }
  });

  it('recovers gracefully from invalid JSON escapes like \\$param or unescaped backslashes', async () => {
    // Malformed JSON where $a is escaped as \$a (illegal in strict JSON)
    const rawWithBadEscapes = `{
      "changes": [
        {
          "path": "Math.php",
          "content": "<?php\\nclass Math {\\n  public static function multiply(\\$a, \\$b) { return \\$a * \\$b; }\\n}\\n",
          "note": "Multiply with \\$a parameter"
        }
      ]
    }`;

    const provider = mockProvider(rawWithBadEscapes);
    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest();

    const outcome = await producer.produce(request);
    expect(outcome.status).toBe('produced');
    if (outcome.status === 'produced') {
      expect(outcome.changes).toHaveLength(1);
      expect(outcome.changes[0]!.path).toBe('Math.php');
      expect(outcome.changes[0]!.content).toContain('multiply');
    }
  });

  it('injects operational learnings and company knowledge into prompt when present', async () => {
    let capturedPrompt = '';
    const provider: LLMProvider = {
      providerId: 'mock-llm',
      chat: async (req) => {
        capturedPrompt = req.messages.find((m) => m.role === 'user')?.content ?? '';
        return {
          message: {
            role: 'assistant',
            content: JSON.stringify({
              changes: [
                {
                  path: 'Math.php',
                  content: '<?php\nclass Math {}\n',
                  note: 'Updated with knowledge',
                },
              ],
            }),
          },
          finishReason: 'stop',
        };
      },
    };

    const producer = createLlmCodeProducer({ provider });
    const request = createMockRequest({
      knowledgeContext: [
        'Always validate input parameters before arithmetic operations',
        'Avoid fatal division by zero errors by throwing InvalidArgumentException',
      ],
    });

    const outcome = await producer.produce(request);
    expect(outcome.status).toBe('produced');
    expect(capturedPrompt).toContain('COMPANY KNOWLEDGE & OPERATIONAL LEARNINGS:');
    expect(capturedPrompt).toContain('- Always validate input parameters before arithmetic operations');
    expect(capturedPrompt).toContain('- Avoid fatal division by zero errors by throwing InvalidArgumentException');
  });
});

