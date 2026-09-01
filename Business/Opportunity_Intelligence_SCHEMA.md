# Umer AI OS — Opportunity Intelligence Domain Model

**Status:** V1 implementation specification  
**Branch:** `feat/autonomous-revenue-os`

## Purpose

Define the durable objects required for the first revenue engine: discovering businesses, researching them, identifying problems, evaluating commercial opportunities, and producing evidence-backed recommendations.

The model is deliberately independent of industry and technology. A website is one possible solution; custom software is another.

## Core lifecycle

```text
Signal → Business → Research Case → Evidence → Problem → Opportunity
                                                   ↓
                                             Solution Proposal
                                                   ↓
                                             Outreach Package
```

## Entities

### 1. Business

Represents a real organization or local business that may become a prospect.

Required fields:

- `id`
- `name`
- `website_url` (nullable)
- `google_business_url` (nullable)
- `location`
- `industry` (nullable)
- `source`
- `discovered_at`
- `status`: discovered | researching | qualified | contacted | engaged | won | lost | rejected
- `canonical_identity` — normalized identity used for deduplication

### 2. Research Case

One investigation of a business or market opportunity.

Required fields:

- `id`
- `business_id` (nullable for market-level research)
- `objective`
- `status`: queued | running | completed | failed | stale
- `started_at`
- `completed_at`
- `research_version`

### 3. Source

A retrievable source used as evidence.

Fields:

- `id`
- `url`
- `title`
- `publisher`
- `source_type`: website | search | google_business | review | social | directory | news | documentation | other
- `retrieved_at`
- `published_at` (nullable)
- `content_hash` (for deduplication)

### 4. Evidence

A specific observation extracted from a source.

Fields:

- `id`
- `research_case_id`
- `source_id`
- `claim`
- `evidence_excerpt` or structured observation
- `evidence_type`: fact | observation
- `confidence`
- `observed_at`
- `agent_id`

No recommendation should be treated as evidence.

### 5. Problem

A business/customer problem inferred from evidence.

Fields:

- `id`
- `business_id`
- `statement`
- `severity`: low | medium | high | critical
- `frequency`: unknown | occasional | recurring | frequent
- `evidence_ids`
- `confidence`
- `status`: hypothesis | validated | rejected

### 6. Opportunity

The commercial opportunity created by solving one or more problems.

Fields:

- `id`
- `business_id`
- `problem_ids`
- `score` (0–100)
- `demand_score`
- `problem_severity_score`
- `ability_to_pay_score`
- `reachability_score`
- `competition_score`
- `solution_fit_score`
- `effort_score`
- `commercial_value_estimate`
- `confidence`
- `recommendation`: pursue | research_more | reject
- `reasoning_artifact_id`

### 7. Competitor

A relevant alternative competing for the customer's attention, budget, or workflow.

Fields:

- `id`
- `name`
- `url`
- `category`
- `pricing_summary`
- `strengths`
- `weaknesses`
- `target_customer`
- `evidence_ids`
- `researched_at`

### 8. Solution Proposal

The smallest appropriate solution to the identified problem.

Fields:

- `id`
- `opportunity_id`
- `problem_ids`
- `solution_summary`
- `solution_type`: website | ecommerce | automation | integration | custom_app | saas | other
- `features`
- `expected_outcomes`
- `estimated_effort`
- `estimated_price_range`
- `recommended_stack` (optional)
- `alternatives_considered`
- `evidence_ids`

Technology must not determine the solution type.

### 9. Outreach Package

Everything required to contact a prospect responsibly.

Fields:

- `id`
- `opportunity_id`
- `recipient_identity`
- `channel`
- `subject`
- `message`
- `personalization_evidence_ids`
- `call_to_action`
- `status`: draft | approved | sent | replied | paused | rejected
- `created_at`

## Evidence lineage

Every important recommendation should be traversable:

```text
Recommendation
   ↓
Opportunity
   ↓
Problem
   ↓
Evidence
   ↓
Source
```

## Research quality rules

1. Prefer primary sources where possible.
2. Do not treat search snippets as final evidence when the source can be inspected.
3. Separate observed facts from inference.
4. Record retrieval time because web information changes.
5. Deduplicate sources and businesses.
6. Contradictory evidence must be retained rather than silently discarded.
7. Confidence is not certainty.
8. Recommendations require explicit evidence links.

## Initial scoring model

The first version should use a transparent weighted score rather than an opaque model:

```text
Opportunity Score =
  20% problem severity
+ 15% demand evidence
+ 15% ability to pay
+ 15% reachability
+ 15% solution fit
+ 10% competitive gap
+ 10% delivery feasibility
```

The weights should become configurable after real outcomes are collected.

## Non-goals for V1

- autonomous mass emailing
- autonomous financial commitments
- autonomous contract signing
- fully autonomous software development
- pretending estimates are guaranteed revenue

V1 exists to prove **research → evidence → opportunity → actionable report**.
