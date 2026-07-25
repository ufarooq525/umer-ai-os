# Event Bus Shim (v1)

Minimal in-process publish/subscribe plane for unlocking watchdogs.

This is **not** Message Fabric / Envelope v2. Fabric remains the eventual
substrate (`Runtime/EventBus/*`). This package is the shim-first step:
specialists keep executing exactly as today; callers publish events instead of
invoking them directly.

## Event shape

```ts
{
  eventId: string;
  type: 'specialist.qa.requested'; // widen per specialist later
  projectId: string;
  occurredAt: string;
  correlationId: string;
  source:
    | { kind: 'human.intake'; actorId: string; channel: 'control-api' | 'quick-task' | 'intake-form' | 'api' }
    | { kind: 'watchdog'; watchdogId: string; cadence: 'nightly' | 'hourly' | 'on-commit' | 'on-deploy' | 'manual'; scheduleId?: string; tickId?: string }
    | { kind: 'system'; componentId: string; reason: string };
  payload: { goal: string; doneWhen?: string; constraints?: string[] };
}
```

`source` is structured so a later auditor can distinguish nightly sweeps from
human intakes without retrofitting.

## QA shim

1. Human `POST /v1/intake` type=`qa` → `publishQaViaBus` with `source.kind=human.intake`
2. Watchdog → `publishQaViaBus` with `source.kind=watchdog`
3. Single subscriber → `executeQaIntake` → same `gate-qa-*` + `humanRequired: true`
