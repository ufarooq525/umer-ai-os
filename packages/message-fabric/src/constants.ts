/** JetStream stream names — Message Fabric plane separation. */
export const STREAMS = {
  COMMANDS: 'UMER_COMMANDS',
  EVENTS: 'UMER_EVENTS',
  DLQ: 'UMER_DLQ',
} as const;

/** Subject prefixes per MONOREPO_BLUEPRINT.md */
export const SUBJECTS = {
  CMD_ORCHESTRATION: 'cmd.orchestration',
  CMD_AGENT_DISPATCH: 'cmd.agent.dispatch',
  CMD_EXTENSION: 'cmd.extension',
  CMD_CONTROL_GATES: 'cmd.control.gates',
  EVT_RUNTIME: 'evt.runtime',
  EVT_AUDIT: 'evt.audit',
  DLQ_PREFIX: 'dlq',
} as const;

export const DEFAULT_MAX_DELIVER = 5;
export const DEFAULT_ACK_WAIT_MS = 30_000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
