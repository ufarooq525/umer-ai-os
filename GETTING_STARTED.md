
# Getting Started with Opportunity Intelligence

This guide helps you discover and qualify business leads using the opportunity intelligence system.

## Prerequisites

1. **Google Maps API Key**: Required for live business discovery
   - Enable the Places API (New) in your Google Cloud project
   - Set `GOOGLE_MAPS_API_KEY` in your `.env` file

2. **Database**: MySQL/MariaDB running locally or accessible via connection string

## Quick Start

### 1. Find Clinic Leads in Your City

Run a discovery batch for clinics and hospitals:

```bash
cd packages/opportunity-intelligence
pnpm discover --niche=clinics-hospitals --city="Karachi" --limit=20
```

**Parameters:**
- `--niche`: Niche profile to use (`clinics-hospitals` or `saudi-umrah`)
- `--city`: Target city for discovery (e.g., "Karachi", "Lahore", "Makkah")
- `--limit`: Maximum businesses to discover (1-20, default: 20)

**Example for other cities:**
```bash
pnpm discover --niche=clinics-hospitals --city="Lahore" --limit=15
pnpm discover --niche=clinics-hospitals --city="Islamabad" --limit=10
```

### 2. View Results

The discovery run will:
1. **Discover** businesses via Google Places API using healthcare-specific queries
2. **Research** each business by auditing their website (or lack thereof)
3. **Score** opportunities based on digital gaps and business signals
4. **Generate** personalized outreach drafts (email/WhatsApp)

Results are saved to the database and viewable in the web UI at `/opportunities`.

### 3. Review Outreach Drafts

All outreach is **draft-only** by design:
- No messages are sent automatically
- Each opportunity includes a `mailto:` link or copy-paste template
- Review and customize before sending

## Niche Profiles

### Clinics & Hospitals

**Target:** Medical facilities needing digital infrastructure

**Scoring signals:**
- No website or outdated site
- No online appointment booking
- No HTTPS / poor security
- WhatsApp-only booking
- Poor appointment-related reviews

**Outreach focus:**
- Modern website development
- Online booking systems
- Patient portals
- Secure payment integration
- Hospital/clinic ERP systems

**Discovery queries:**
- clinic
- hospital
- dental clinic
- medical center
- diagnostic lab
- polyclinic

### Saudi Umrah Services

**Target:** Umrah travel operators, hotels, and transportation

**Scoring signals:**
- Manual booking workflows
- Missing payment integration
- Poor multilingual support
- WhatsApp-only inquiries

**Discovery queries:**
- Umrah travel agency
- Umrah hotel
- Umrah transport

## Configuration

### Set Target City via Environment

Instead of passing `--city` every time, set a default:

```bash
# .env
OPPORTUNITY_NICHE_ID=clinics-hospitals
OPPORTUNITY_NICHE_GEOGRAPHIES=Karachi,Lahore
OPPORTUNITY_DISCOVERY_LIMIT=20
```

Then run:
```bash
pnpm discover
```

### Web UI Discovery

Start the web application:
```bash
cd ../../apps/web
pnpm dev
```

Navigate to `/opportunities` and use the discovery controls to:
1. Select a niche profile
2. Choose target city/region
3. Set batch limit
4. Run discovery

## What Happens During Discovery?

1. **Discovery Stage**: Google Places API searches for businesses matching the niche profile's queries in the target city

2. **Deduplication**: Removes duplicate businesses found across multiple queries

3. **Research Stage**: For each unique business:
   - Fetches and analyzes their website (if present)
   - Identifies digital gaps: no website, no booking, no payments, no HTTPS, etc.
   - Extracts social media links (when published on their own site)

4. **Audit Stage**: Scores businesses based on:
   - Digital presence maturity
   - Operational signals from evidence
   - Problem severity and confidence

5. **Problem Detection**: Identifies concrete problems such as:
   - "No public digital storefront"
   - "Missing online appointment booking"
   - "No secure payment checkout"

6. **Scoring Stage**: Calculates opportunity scores using:
   - Problem severity
   - Demand evidence
   - Ability to pay
   - Reachability
   - Solution fit
   - Competitive gap

7. **Outreach Generation**: Creates personalized draft messages using niche-specific templates with real evidence

## API Quota & Limits

- **Google Places API**: Each search returns up to 20 results
- **Discovery Limit**: Capped at 20 businesses per batch by default (respects API quota)
- **Rate Limiting**: Built-in delays between requests to avoid quota exhaustion

## Outreach Templates

Templates are niche-specific and support variable substitution:

**Available variables:**
- `{{businessName}}`: Name of the business
- `{{primaryProblem}}`: Top-ranked problem identified
- `{{solutionTitle}}`: Opportunity title
- `{{specificObservation}}`: Concrete finding from website audit
- `{{concreteOffer}}`: Context-aware value proposition

**Example (Clinics & Hospitals):**
```
Subject: Quick observation about {{businessName}}'s online presence

Hi {{businessName}} team,

I came across your practice while researching local healthcare providers. 
I noticed {{specificObservation}}.

I've worked on similar projects for medical facilities — {{concreteOffer}}. 
This typically improves patient experience and reduces administrative load.

Would a brief 10-minute call this week work to discuss what might fit your needs?

Best regards
```

## Troubleshooting

### "GOOGLE_MAPS_API_KEY is not configured"

1. Obtain a Google Cloud API key
2. Enable "Places API (New)" in your project
3. Add to `.env`: `GOOGLE_MAPS_API_KEY=your_key_here`

### "No businesses found"

- Try a different city or region
- Check that the niche profile's `discoveryQueries` match the target market
- Verify Google Places API quota hasn't been exhausted

### Database Connection Error

Ensure MySQL is running and connection details are correct:
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=umer_ai_os
```

## Next Steps

1. **Run your first batch**: `pnpm discover --niche=clinics-hospitals --city="Karachi"`
2. **Review opportunities**: Open `/opportunities` in the web UI
3. **Customize outreach**: Review and edit draft messages before sending
4. **Add more niches**: Edit `src/niche-profiles.ts` to define new market segments

## Support

For questions or issues:
- Check the `Business/Opportunity_Intelligence_PIPELINE.md` documentation
- Review the niche profile definitions in `src/niche-profiles.ts`
- Examine the test files for usage examples
=======
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

