import { createHash, randomUUID } from 'node:crypto';
import { createMySqlExecutor } from '@umer/db';

export async function getMcpControlState() {
  const db = createMySqlExecutor();
  const [servers, tools, permissions, usage] = await Promise.all([
    db.execute<any[]>(`SELECT server_id, name, description, endpoint, transport, status, version, trust_level, health_json, updated_at FROM ai_mcp_servers ORDER BY name`),
    db.execute<any[]>(`SELECT t.tool_id, t.server_id, s.name AS server_name, t.name, t.description, t.risk_level, t.read_only, t.requires_approval, t.estimated_cost, t.estimated_latency_ms, t.enabled, t.updated_at FROM ai_mcp_tools t INNER JOIN ai_mcp_servers s ON s.server_id=t.server_id ORDER BY s.name, t.name`),
    db.execute<any[]>(`SELECT p.permission_id, p.tool_id, p.subject_type, p.subject_id, p.allowed, p.requires_approval, p.max_calls_per_hour, p.updated_at, t.name AS tool_name FROM ai_mcp_permissions p INNER JOIN ai_mcp_tools t ON t.tool_id=p.tool_id ORDER BY p.updated_at DESC LIMIT 200`),
    db.execute<any[]>(`SELECT tool_name, COUNT(*) AS calls, SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) AS failures, SUM(CASE WHEN cache_hit=1 THEN 1 ELSE 0 END) AS cache_hits, AVG(latency_ms) AS avg_latency_ms, SUM(estimated_cost) AS estimated_cost FROM ai_tool_usage WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 24 HOUR) GROUP BY tool_name ORDER BY calls DESC LIMIT 100`),
  ]);
  return { servers, tools, permissions, usage };
}

export async function authorizeMcpToolCall(input: { toolId: string; agentId: string; taskId?: string | null; input?: unknown; estimatedCost?: number }) {
  const db = createMySqlExecutor();
  const tools = await db.execute<any[]>(`SELECT tool_id, name, enabled, risk_level, requires_approval, estimated_cost FROM ai_mcp_tools WHERE tool_id=? LIMIT 1`, [input.toolId]);
  if (!tools.length) throw new Error('MCP tool not found');
  const tool = tools[0];
  const hash = input.input === undefined ? null : createHash('sha256').update(JSON.stringify(input.input)).digest('hex');
  const deny = async (reason: string) => {
    await db.execute(`INSERT INTO ai_tool_usage (usage_id, task_id, agent_id, tool_id, tool_name, input_hash, cache_hit, latency_ms, estimated_cost, success, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, FALSE, 0, ?, FALSE, ?, UTC_TIMESTAMP(3))`, [randomUUID(), input.taskId ?? null, input.agentId, tool.tool_id, tool.name, hash, input.estimatedCost ?? tool.estimated_cost ?? 0, reason]);
    await db.execute(`INSERT INTO ai_control_audit_events (audit_id, action, target_type, target_id, actor_type, actor_id, reason, occurred_at) VALUES (?, 'mcp.call_denied', 'mcp_tool', ?, 'AGENT', ?, ?, UTC_TIMESTAMP(3))`, [randomUUID(), tool.tool_id, input.agentId, reason]);
    await db.execute(`INSERT INTO ai_workflow_events (event_id, task_id, agent_id, event_type, entity_type, entity_id, message, metadata_json, occurred_at) VALUES (?, ?, ?, 'mcp.call_denied', 'mcp_tool', ?, ?, ?, UTC_TIMESTAMP(3))`, [randomUUID(), input.taskId ?? null, input.agentId, tool.tool_id, `MCP call denied: ${tool.name}`, JSON.stringify({ reason, toolId: tool.tool_id })]);
    return { allowed: false, reason };
  };
  if (!tool.enabled) return deny('Tool is disabled');
  const permissions = await db.execute<any[]>(`SELECT allowed, requires_approval, max_calls_per_hour FROM ai_mcp_permissions WHERE tool_id=? AND subject_type='agent' AND subject_id=? LIMIT 1`, [tool.tool_id, input.agentId]);
  if (!permissions.length || !permissions[0].allowed) return deny('Agent has no allow permission for this tool');
  const permission = permissions[0];
  if (permission.requires_approval || tool.requires_approval) return deny('Tool requires explicit approval before execution');
  if (permission.max_calls_per_hour != null) {
    const counts = await db.execute<any[]>(`SELECT COUNT(*) AS count FROM ai_tool_usage WHERE tool_id=? AND agent_id=? AND success=1 AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 HOUR)`, [tool.tool_id, input.agentId]);
    if (Number(counts[0]?.count ?? 0) >= Number(permission.max_calls_per_hour)) return deny('Hourly tool-call limit exceeded');
  }
  return { allowed: true, tool, permission };
}
