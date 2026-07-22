import { context, propagation, trace, type Context, type Span } from '@opentelemetry/api';
import type { MsgHdrs } from 'nats';

const TRACE_PARENT = 'traceparent';
const TRACE_STATE = 'tracestate';

export function injectTraceContext(headers: MsgHdrs, ctx: Context = context.active()): void {
  const carrier: Record<string, string> = {};
  propagation.inject(ctx, carrier);
  if (carrier.traceparent) {
    headers.set(TRACE_PARENT, carrier.traceparent);
  }
  if (carrier.tracestate) {
    headers.set(TRACE_STATE, carrier.tracestate);
  }
}

export function extractTraceContext(headers: MsgHdrs): Context {
  const carrier: Record<string, string> = {};
  const traceparent = headers.get(TRACE_PARENT);
  const tracestate = headers.get(TRACE_STATE);
  if (traceparent) {
    carrier.traceparent = traceparent;
  }
  if (tracestate) {
    carrier.tracestate = tracestate;
  }
  return propagation.extract(context.active(), carrier);
}

export function withMessageSpan<T>(
  name: string,
  correlationId: string,
  fn: () => Promise<T>,
  parentCtx?: Context,
): Promise<T> {
  const tracer = trace.getTracer('message-fabric');
  const ctx = parentCtx ?? context.active();
  return context.with(ctx, () =>
    tracer.startActiveSpan(name, { attributes: { correlationId } }, async (span: Span) => {
      try {
        return await fn();
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        span.end();
      }
    }),
  );
}
