# Getting Started with Umer AI OS

Umer AI OS is an autonomous business operating system that discovers commercial opportunities, orchestrates development work, and manages the full product delivery lifecycle with AI-powered agents.

## What It Does

- **Opportunity Intelligence**: Discovers local businesses (e.g. travel agencies, transport providers) that need digital products, using Google Places API
- **Autonomous Product Development**: Creates websites, booking systems, and business tools from requirements to deployment
- **Sales Pipeline**: Manages leads, outreach, and customer relationships
- **Quality Assurance**: Runs automated tests (PHPUnit, Playwright) with gated evidence collection
- **Executive Dashboard**: Real-time view of agents, work packages, gates, and revenue pipeline

## Prerequisites

1. **Node.js** 20+ and **pnpm** 9.15.0
2. **LM Studio** running locally with a model (e.g. `qwen/qwen3-8b`) on `http://localhost:1234`
3. **MySQL 8.4** (via Laragon or Docker) on port 3306
4. **Laragon** (Windows) or equivalent PHP/web server for project hosting at `C:/laragon/www`

## Quick Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd umer-ai-os
cp .env.example .env
pnpm install
```

### 2. Configure Environment

Edit `.env` and verify/update:

```bash
# Point to your LM Studio
LLM_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen/qwen3-8b
LLM_MAX_TOKENS=4096
AGENT_LOOP_MAX_ITERATIONS=20

# MySQL for Opportunity Intelligence / Revenue OS
OPPORTUNITY_DATABASE_URL=mysql://umer_revenue:umer_revenue@localhost:3306/umer_revenue_os

# Laragon project root
UMER_PROJECTS_ROOT=C:/laragon/www

# Optional: Google Maps API for live lead discovery (otherwise uses example businesses)
# GOOGLE_MAPS_API_KEY=your_key_here
```

### 3. Start LM Studio

1. Open LM Studio
2. Load a model (e.g. `qwen2.5-coder:7b` or `qwen3-8b`)
3. Start the local server on port 1234 (default)
4. Verify: `curl http://localhost:1234/v1/models`

### 4. Set Up Databases

#### Option A: Docker (recommended)

```bash
# Start MySQL, Redis, NATS, MinIO, and observability
pnpm dev:infra
```

#### Option B: Laragon (Windows)

MySQL 8.4 should already be running. Create the revenue database:

```sql
CREATE DATABASE IF NOT EXISTS umer_revenue_os;
CREATE USER IF NOT EXISTS 'umer_revenue'@'localhost' IDENTIFIED BY 'umer_revenue';
GRANT ALL PRIVILEGES ON umer_revenue_os.* TO 'umer_revenue'@'localhost';
FLUSH PRIVILEGES;
```

### 5. Run Migrations

```bash
pnpm db:migrate
```

### 6. Start the Stack

#### One Command (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1
```

This starts:
- NATS (message fabric) on `:4222`
- `control-api` on `:4000`
- `agent-worker` (health on `:8080`)
- `web` dashboard on `:3001`
- `jarvis-api` (CEO assistant) on `:3010`

#### Check Status

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1 -Status
```

#### Manual Start (Linux/Mac)

```bash
# Terminal 1: control-api
pnpm --filter @umer/app-control-api dev

# Terminal 2: web dashboard
pnpm --filter @umer/app-web dev

# Terminal 3: agent-worker
pnpm --filter @umer/app-agent-worker dev

# Terminal 4: jarvis-api
pnpm --filter @umer/jarvis-api dev
```

### 7. Verify Setup

Open [http://localhost:3001/command-center](http://localhost:3001/command-center)

You should see:
- **CEO Operating Console**: agent status, pending decisions, blockers
- **Opportunity Pipeline**: discovered businesses and revenue opportunities
- **Work Packages**: active development work
- **Agent Activity**: real-time agent logs

## First Steps

### Run an Opportunity Discovery

1. Go to **Opportunities** in the sidebar
2. Click **Start Discovery Run**
3. Choose a market (e.g. "Umrah Travel Agencies - Makkah, Saudi Arabia")
4. Watch the Discovery → Research → Opportunity agents work
5. Review discovered businesses and scored opportunities

Without `GOOGLE_MAPS_API_KEY`, it will use deterministic example businesses (marked `*.example` domains) — good for testing the flow.

### Submit a Project Intake

1. Go to **Projects**
2. Select an existing Laragon project (e.g. `school-app`)
3. Submit intake with type: **QA** (to run tests)
4. Approve the gate when it appears (this "seals" the evidence and runs the test suite)
5. View the sealed QA artifact in **Artifacts**

### Check the Sales Pipeline

1. Go to **Revenue** → **Commercial Pipeline**
2. See leads, deals, and outreach events
3. Create a test deal or contact manually
4. Watch the outreach agent generate evidence-backed messages

## Architecture

```
apps/
  control-api       — REST API for CEO Command Plane, Work Packages, Gates
  web               — Next.js dashboard (Opportunities, Command Center, Revenue)
  agent-worker      — Autonomous agent runtime (LLM + tools → work packages)
  jarvis-api        — CEO agentic assistant (chat, delegation, attention stream)
  orchestration-worker — NATS-based work orchestration

packages/
  agent-runtime     — LLM agent loop (tool calls, decisions, context)
  opportunity-intelligence — Lead discovery, research, scoring
  control-plane     — CEO Command Plane (intakes, gates, work packages)
  trust             — Authorization & audit (grants, policies)
  db                — Database migrations (Postgres + MySQL)
```

## Common Issues

### "Catalog not found"

Make sure `projects/catalog.json` exists with at least one entry:

```json
[
  {
    "projectId": "test-project",
    "name": "Test Project",
    "path": "C:/laragon/www/test-project",
    "status": "active"
  }
]
```

### LLM Agent Fails / Empty Responses

- Check LM Studio is running and the model is loaded
- Verify `LLM_MAX_TOKENS=4096` (not 2048 — too small for reasoning models)
- Check `apps/agent-worker` logs for `finishReason: "length"` (means token limit hit)

### MySQL Connection Refused

- Laragon: ensure MySQL service is started
- Docker: `docker ps` should show `umer_ai_os-mysql-1` healthy
- Check credentials match `.env` and `docker-compose.yml`

### Agents Stuck at IDLE

- NATS must be running (`:4222`)
- Check agent-worker logs — it subscribes to `work.intake.*` subjects
- If using Docker NATS, make sure `NATS_URL=nats://localhost:4222` (not `nats://nats:4222` in `.env`)

## Production Deployment

See `implementation/DEPLOYMENT.md` for:
- Docker Compose (`pnpm prod:up`)
- Kubernetes + Helm (`infra/k8s/charts/umer-ai-os`)
- Deployment gates, rollback plans, health probes

**Note**: Full K8s deployment is currently deferred for local-first milestone — see `AUTONOMY_STATUS.md` for details.

## Cleanup

### Remove Old Test Agents

After running smoke tests, you may have leftover agent records:

```bash
# Dry-run: show what would be deleted
pnpm cleanup:agents

# Actually delete
pnpm cleanup:agents:apply
```

This only removes agents matching `test`, `smoke`, `demo`, `e2e`, `fixture` patterns that are IDLE/COMPLETED/FAILED and older than 7 days.

### Stop Everything

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-down.ps1
```

Or manually:

```bash
pnpm dev:infra:down  # Stop Docker services
# Then kill the pnpm dev processes (Ctrl+C in each terminal)
```

## Next Steps

- Read `ROADMAP.md` for milestone progress
- See `implementation/MONOREPO_BLUEPRINT.md` for architecture details
- Check `AUTONOMY_STATUS.md` for the current autonomous delivery status
- Browse `Runtime/`, `Departments/`, `Executive/` for architectural context
