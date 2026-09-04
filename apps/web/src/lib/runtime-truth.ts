export type ProbeStatus = 'up' | 'down' | 'unknown';

export type RuntimeTruth = {
  controlApi: { status: ProbeStatus; label: string; url: string };
  llm: { status: ProbeStatus; label: string; url: string; model: string | null };
  checkedAt: string;
};

const CONTROL_DEFAULT = 'http://127.0.0.1:4000';
const LLM_DEFAULT = 'http://localhost:1234/v1';

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

async function probe(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeRuntimeTruth(timeoutMs = 2000): Promise<RuntimeTruth> {
  const controlUrl = trimSlash(process.env.NEXT_PUBLIC_CONTROL_API_URL ?? CONTROL_DEFAULT);
  const llmBase = trimSlash(process.env.LLM_BASE_URL ?? LLM_DEFAULT);
  const model = process.env.LLM_MODEL?.trim() || null;

  const [controlOk, llmOk] = await Promise.all([
    probe(`${controlUrl}/health`, timeoutMs),
    probe(`${llmBase}/models`, timeoutMs),
  ]);

  return {
    controlApi: {
      status: controlOk ? 'up' : 'down',
      label: controlOk ? 'REACHABLE' : 'UNREACHABLE',
      url: controlUrl,
    },
    llm: {
      status: llmOk ? 'up' : 'down',
      label: llmOk ? 'REACHABLE' : 'UNREACHABLE — specialists will fail closed',
      url: llmBase,
      model,
    },
    checkedAt: new Date().toISOString(),
  };
}
