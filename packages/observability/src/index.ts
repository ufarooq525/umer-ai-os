import { DiagConsoleLogger, DiagLogLevel, diag, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { loadEnv } from '@umer/config';
import pino from 'pino';

export const packageName = '@umer/observability' as const;

export type TelemetryOptions = {
  serviceName?: string;
};

let sdk: NodeSDK | undefined;
let telemetryActive = false;

/**
 * OpenTelemetry bootstrap — Runtime Observability domain.
 * Idempotent: OTel global APIs cannot be registered twice per process.
 */
export function startTelemetry(options: TelemetryOptions = {}): NodeSDK | undefined {
  if (telemetryActive) {
    return sdk;
  }

  const env = loadEnv();
  const serviceName = options.serviceName ?? env.OTEL_SERVICE_NAME;

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
    }),
  });

  sdk.start();
  telemetryActive = true;
  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = undefined;
}

/** Test-only reset — not for production multi-boot. */
export function resetTelemetryForTests(): void {
  sdk = undefined;
  telemetryActive = false;
}

export function createLogger(name: string) {
  const env = loadEnv();
  return pino({
    name,
    level: env.LOG_LEVEL,
    base: { service: env.OTEL_SERVICE_NAME },
  });
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export type { Logger } from 'pino';

export {
  InMemoryAgentRunReadModelStore,
  projectRuntimeEvent,
  type ActionLogEntry,
  type AgentRunCurrentAction,
  type AgentRunReadModelStore,
  type AgentRunSnapshot,
  type AgentRunStatus,
  type DecisionRecord,
  type FailureRecord,
  type ToolCallRecord,
  type ToolCallStatus,
} from './agent-run-read-model.js';

export {
  InMemoryAgentRegistryStore,
  projectAgentEvent,
  type AgentRegistryStore,
  type AgentSnapshot,
  type AgentSnapshotStatus,
} from './agent-registry.js';
