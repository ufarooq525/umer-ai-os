export type GuideSection = {
  id: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  content: string[];
};

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'overview', title: 'What is Umer AI OS?', category: 'Getting Started',
    summary: 'The AI operating system coordinates objectives, plans, work, agents, tools, evidence, decisions and outcomes.',
    keywords: ['overview', 'ai os', 'company', 'architecture', 'ceo'],
    content: [
      'Umer AI OS is designed as an autonomous company operating system rather than a collection of chatbots. The CEO defines objectives; the system plans work, assigns agents, gathers evidence, evaluates results and creates the next work.',
      'The dashboard is the source of truth for operational state. Every meaningful task, agent state change, tool call, decision, evidence item, error, token/cost event and outcome should be traceable to its parent objective, project, run and task.',
      'The current opportunity-intelligence pipeline is the first workload on this foundation. Future workloads such as product research, engineering, marketing, sales and operations should reuse the same workforce kernel.'
    ]
  },
  {
    id: 'workforce', title: 'AI Workforce', category: 'Workforce',
    summary: 'Agents are workers with roles, assignments, status, heartbeats, history and measurable performance.',
    keywords: ['agent', 'worker', 'department', 'status', 'heartbeat', 'assignment'],
    content: [
      'An agent is a specialized worker. An assignment is a concrete piece of work connected to a project, business, niche and run. Agents should claim work instead of being hard-wired to one permanent workflow.',
      'Recommended lifecycle: ASSIGNED → RUNNING → WAITING/BLOCKED → COMPLETED or FAILED. Heartbeats make long-running work observable and allow stale work to be recovered.',
      'Departments organize capabilities such as Intelligence, Product, Revenue and Operations. Worker instances can eventually scale up or down according to demand.'
    ]
  },
  {
    id: 'tasks', title: 'Tasks, Plans and Objectives', category: 'Execution',
    summary: 'Objectives become plans, plans become tasks, and tasks produce durable results and follow-up work.',
    keywords: ['objective', 'plan', 'task', 'queue', 'planner', 'execution'],
    content: [
      'The desired execution chain is Objective → Project → Plan → Task → Agent → Tool calls → Evidence → Result → Evaluation → Next task.',
      'Tasks should be durable records with priority, parent task, owner, attempts, lease, deadline, token budget, cost budget and status. This makes work recoverable after a worker crash.',
      'The planner decides what should happen next; deterministic infrastructure controls leases, retries, permissions, persistence and execution safety.'
    ]
  },
  {
    id: 'context', title: 'Context Engineering & Token Optimization', category: 'AI / Models',
    summary: 'Agents should receive the smallest useful context and retrieve additional information only when required.',
    keywords: ['tokens', 'tokenization', 'context', 'compression', 'cache', 'cost', 'model routing'],
    content: [
      'Do not send entire project histories, webpages or tool catalogs between agents. Store durable data and pass compact structured references such as evidence IDs, task IDs and required facts.',
      'Use context tiers: system rules, current task, project context, entity context, relevant memory, selected tools, then raw data on demand.',
      'Use model routing: inexpensive models for extraction, classification and normalization; stronger models for synthesis, planning and difficult decisions. Track input, output, cached and saved tokens per task and agent.',
      'Use semantic and tool-result caching where freshness permits. Long-running sessions should be compacted into durable facts, decisions, open work and relevant evidence rather than retaining unbounded history.'
    ]
  },
  {
    id: 'mcp', title: 'MCP & Tool Gateway', category: 'Tools',
    summary: 'External capabilities should be discoverable through a controlled tool layer instead of being exposed to every agent.',
    keywords: ['mcp', 'tools', 'gateway', 'server', 'permissions', 'tool discovery'],
    content: [
      'The MCP gateway should maintain a registry of servers and tools, including health, version, permissions, cost, latency, risk and schemas.',
      'Agents should search for relevant tools and receive only the small set needed for the current task. This avoids wasting context on hundreds of irrelevant tool schemas.',
      'Tool permissions are policy-driven. Read-only research tools can be broadly available; external side effects such as sending email, writing code or moving money require stricter permissions and, where appropriate, human approval.',
      'The gateway should record every invocation with agent, task, tool, latency, result status, cost and trace identifiers.'
    ]
  },
  {
    id: 'memory', title: 'Memory & Knowledge', category: 'Knowledge',
    summary: 'Separate operational records, semantic memory, raw artifacts and short-lived cache so agents can retrieve exactly what they need.',
    keywords: ['memory', 'knowledge', 'evidence', 'vector', 'mysql', 'redis', 'minio'],
    content: [
      'MySQL is the system of record for relational business state: agents, tasks, projects, businesses, opportunities, decisions, permissions and accounting.',
      'Redis is suited to hot cache, locks, leases, rate limits and temporary coordination. NATS JetStream carries durable events and commands. Object storage such as MinIO holds large raw artifacts. Vector search/pgvector can hold semantic memories and evidence embeddings.',
      'Memory should distinguish facts, experiences, decisions and organizational rules. Retrieval should be relevance- and freshness-aware rather than dumping all historical information into prompts.'
    ]
  },
  {
    id: 'events', title: 'Events & Traceability', category: 'Observability',
    summary: 'Everything important should have a traceable event chain so the CEO can understand what happened and why.',
    keywords: ['events', 'trace', 'audit', 'timeline', 'why', 'observability'],
    content: [
      'Prefer structured events such as task.created, task.claimed, tool.called, evidence.created, decision.made, task.completed and task.failed. NATS JetStream can distribute these events to independent consumers.',
      'Every event should retain links to objective, project, run, task, agent and related entity IDs where applicable. This creates a complete explainability graph.',
      'The CEO UI should expose a timeline and a Why view. For a decision, the user should be able to follow the decision back to its evidence, tool calls, agent and original objective.'
    ]
  },
  {
    id: 'economics', title: 'AI Economics', category: 'Business',
    summary: 'Token, model, tool and infrastructure costs should be measurable by company, project, agent and task.',
    keywords: ['cost', 'tokens', 'roi', 'economics', 'budget', 'usage'],
    content: [
      'Every model execution should record model, provider, input tokens, output tokens, cached tokens when available, latency and estimated cost.',
      'Every task can have a token budget, cost budget, tool-call limit and execution deadline. The runtime should warn, pause or fail safely when budgets are exceeded.',
      'The CEO dashboard should compare actual cost with estimated unoptimized cost and show savings from caching, compression, routing and structured inter-agent messages.'
    ]
  },
  {
    id: 'dashboard', title: 'CEO Command Center', category: 'Dashboard',
    summary: 'The home view answers: what is running now, what needs a decision, and what happened recently — all from real data.',
    keywords: ['dashboard', 'ceo', 'command center', 'search', 'visibility', 'guide', 'pulse', 'how the company operates'],
    content: [
      'Open the app to /command-center. The header gives one deterministic sentence describing current state (built from real counts, never hardcoded), followed by "How the Company Operates" — a four-stage strip (Opportunities discovered → CEO decides → Project created → Agents execute) where a stage only glows and pulses when its own real count is nonzero.',
      'Below that: Company Pulse (clickable metric tiles into each area), the Opportunity Pipeline (a real stage-count breakdown), Live Company Activity (the real agent-run play-by-play), the Live Company Map (Opportunity → Project → Agents → Tasks → Tools → Artifacts, animated only on genuinely active edges), Active Projects, CEO Attention, "While You Were Away," and Recent Activity.',
      'Every agent, project, task, business, evidence item, opportunity, decision and artifact is navigable and connected to related records — click through from any card.'
    ]
  },
  {
    id: 'decision-center', title: 'CEO Decision Center', category: 'Dashboard',
    summary: 'Where the company actually needs you: a real, sorted queue of opportunities awaiting a Select/Reject decision.',
    keywords: ['decisions', 'decision center', 'select opportunity', 'reject opportunity', 'priority', 'triage'],
    content: [
      'Open /decisions. The header shows real counts (decisions required, opportunities being evaluated, active projects, working agents) — never a fabricated small number. "Priority Decisions" lists every opportunity that has cleared the real scoring threshold and sits in a decidable status, sorted by score, tagged Important (score 85+) or Review.',
      'Click a decision to open its detail: why it is here, real evidence count, a live-fetched prospect summary (discovered / high-fit / contactable), estimated value, a real status timeline, and exactly what happens if you approve or reject — then Select or Reject, which calls the same CEO Command Plane (POST /v1/commands) every other action in this app uses. A confirmation banner shows the real command result.',
      'Opportunities already selected but not yet turned into a project appear in a second "ready to create a project" list. Project, Task and Agent management (pause/resume/assign/cancel) remain below, unchanged.'
    ]
  },
  {
    id: 'attention', title: 'CEO Attention', category: 'Dashboard',
    summary: 'The system surfaces exceptions instead of making you monitor every agent — every case is explainable, never a raw count.',
    keywords: ['attention', 'alerts', 'exceptions', 'repeated failure', 'contact intelligence', 'outreach ready'],
    content: [
      'Open /attention (or the sidebar badge). Real categories only: repeated agent failures (2+ real failures on one run), one aggregated "decision required" case for the whole opportunity queue (never one row per opportunity — that was an early mistake, since fixed), work that has run unusually long, incomplete contact intelligence for a research run, and outreach drafts awaiting review.',
      'Click a case to open its full investigation: what happened, why, its real source chain (agent → run → project, or opportunity → business), evidence, current state, and a recommended next action. Nothing here is invented — a case with no real trigger simply does not appear.'
    ]
  },
  {
    id: 'prospects', title: 'Prospects & Commercial Intelligence', category: 'Dashboard',
    summary: 'Who exactly the company would contact, with real contact channels, confidence, and evidence — not just a market score.',
    keywords: ['prospect', 'contact intelligence', 'evidence', 'outreach', 'qualification', 'business'],
    content: [
      'Every Opportunity page shows its real Target Prospect: the specific business behind it, with a Contact Intelligence card (phone/website/email/address/WhatsApp, each with a real confidence level and source — "Not discovered" when a channel genuinely was not found, never guessed), a fit score drawn from that business\'s own opportunities, and a computed outreach-readiness state with real reasons.',
      'One business can have several opportunities (one per problem the research found) — the page shows the others honestly, plus other prospects discovered in the same research run. Click through to /company/prospects/[id] for the full record, including any prepared outreach message — always labeled "prepared, not sent."'
    ]
  },
  {
    id: 'agent-work', title: 'Agent Work', category: 'Workforce',
    summary: 'What every agent is doing right now, in plain language, with a real play-by-play for any single run.',
    keywords: ['agent runs', 'agent work', 'run detail', 'live execution', 'play by play'],
    content: [
      'Open /agent-runs ("Agent Work"). Each card shows the agent, its real current task and project, and how many real actions it has completed — not a raw work-package id. Click through to a run for a full "Live Execution" checklist built entirely from its real action log: no fabricated progress percentages, ever.'
    ]
  },
  {
    id: 'guide', title: 'How to Use the Guide', category: 'Getting Started',
    summary: 'Search this manual for concepts, workflows, architecture and operational rules.',
    keywords: ['guide', 'documentation', 'help', 'search', 'how'],
    content: [
      'Use the search box for natural phrases such as “how does an agent get a task”, “why did an opportunity score 87”, “where are tokens tracked”, or “what can an MCP tool do”.',
      'Use category filters to narrow results. Each article links the conceptual explanation to the live areas of the operating console where possible.',
      'The guide is intentionally versioned with the application so the documented behavior can evolve alongside the implementation.'
    ]
  },
  {
    id: 'security', title: 'Security & Human Approval', category: 'Security',
    summary: 'Autonomy requires explicit identity, permissions, budgets, audit trails and approval boundaries.',
    keywords: ['security', 'approval', 'authorization', 'identity', 'guardrail'],
    content: [
      'Agents should have explicit identities and least-privilege tool permissions. A worker should only be able to access the data and tools required for its assignment.',
      'Separate planning from side effects. High-risk actions should pass through policy checks and approval gates before they affect external systems.',
      'All sensitive actions must be auditable with actor, tool, target, reason, approval and result. Observability failures must not silently turn into authorization failures or uncontrolled side effects.'
    ]
  },
  {
    id: 'autonomy', title: 'Autonomous Company Loop', category: 'Autonomy',
    summary: 'The long-term goal is a continuous loop that discovers, validates, acts, measures and learns.',
    keywords: ['autonomy', 'self healing', 'self improvement', 'revenue', 'continuous'],
    content: [
      'The target loop is CEO objective → strategy → planning → work queue → agents → evidence → evaluation → decisions → actions → outcomes → feedback → revised planning.',
      'Self-healing means failed or stale tasks are detected, retried or reassigned without losing history. Self-improvement means measured outcomes influence future routing, planning and agent configuration.',
      'The system should never pretend work happened when it did not. Registered agents can remain idle until real execution is wired; telemetry must represent actual runtime state.'
    ]
  }
];
