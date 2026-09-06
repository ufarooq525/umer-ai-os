/** Command names consumed on `cmd.orchestration`. */
export const ORCHESTRATION_COMMANDS = {
  QUEUE: 'workpackage.queue',
  DISPATCH: 'workpackage.dispatch',
  CANCEL: 'workpackage.cancel',
  ACCEPT: 'workpackage.accept',
  REJECT: 'workpackage.reject',
  RETRY: 'workpackage.retry',
  /** Runs ReadyWorkPackagePlanner for one project — see worker.ts's handling and OrchestrationWorkerOptions.workGraphPlanning. */
  PLAN_PROJECT: 'workgraph.plan',
} as const;

/** Agent dispatch command published to `cmd.agent.dispatch`. */
export const AGENT_DISPATCH_COMMAND = 'workpackage.dispatch';

/** Default retry ceiling when resource envelope does not specify attempts. */
export const DEFAULT_MAX_ATTEMPTS = 3;
