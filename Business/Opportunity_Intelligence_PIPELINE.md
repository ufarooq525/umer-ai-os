# Umer AI OS — Opportunity Intelligence Pipeline

## Objective

Turn raw public business signals into a small, evidence-backed set of opportunities that Umer can act on.

## Pipeline

```text
1. DISCOVER
   ↓
2. NORMALIZE + DEDUPLICATE
   ↓
3. BUSINESS AUDIT
   ↓
4. MARKET + COMPETITOR RESEARCH
   ↓
5. PROBLEM DETECTION
   ↓
6. SOLUTION DESIGN
   ↓
7. COMMERCIAL SCORING
   ↓
8. DOSSIER GENERATION
   ↓
9. MORNING REPORT
   ↓
10. HUMAN SALES HANDOFF
```

## 1. Discover

Initial discovery sources should be pluggable. Examples include public search results, local business directories, business websites, review pages, industry directories, and other permitted public sources.

A discovery adapter emits a normalized `BusinessCandidate` rather than creating a final lead immediately.

Minimum candidate data:

- business name
- location
- source URL
- category/industry if available
- website URL if available
- discovery timestamp

## 2. Normalize + deduplicate

Before research, normalize identity using:

- normalized business name
- domain
- location
- phone where legally/appropriately available
- source identifiers

Potential duplicates must be merged or linked rather than researched repeatedly.

## 3. Business audit

Inspect the public digital presence and record evidence such as:

- website existence
- accessibility
- mobile usability indicators
- obvious conversion paths
- booking/order/quote flows
- contact options
- content quality
- discoverability/SEO indicators
- social presence
- obvious workflow friction

The audit reports observations; it does not automatically declare a business “bad”.

## 4. Market + competitor research

Identify meaningful alternatives and document:

- who they serve
- core offer
- positioning
- visible pricing
- important features
- strengths
- weaknesses/gaps
- evidence for each material claim

## 5. Problem detection

Convert evidence into explicit problems or hypotheses.

Each problem must link to evidence and include confidence.

Example:

```text
Problem: Quote requests require manual phone/email handling.
Evidence: Website contact flow observed on 2026-09-01.
Severity: medium/high.
Confidence: 0.86.
Status: hypothesis.
```

## 6. Solution design

Generate the smallest credible solution that addresses the validated/high-confidence problems.

Possible solution types:

- marketing website
- conversion-focused redesign
- e-commerce
- booking/order system
- workflow automation
- CRM integration
- custom business application
- SaaS/product

The system should explicitly consider a “do nothing / not worth solving” option.

## 7. Commercial scoring

Score the opportunity using transparent factors defined in `Opportunity_Intelligence_SCHEMA.md`.

The score is a prioritization mechanism, not a claim of guaranteed revenue.

## 8. Dossier generation

Generate a versioned dossier containing:

```text
00-overview.md
01-business-research.md
02-digital-audit.md
03-market-research.md
04-competitor-analysis.md
05-problems-and-evidence.md
06-opportunity-analysis.md
07-solution-proposal.md
08-scope-and-estimate.md
09-outreach-strategy.md
10-outreach-draft.md
11-decision-log.md
12-sources.md
```

Every generated document should identify its parent research case and version.

## 9. Morning report

Do not dump all research into the dashboard. Summarize:

- number discovered
- number researched
- number qualified
- top opportunities
- why they matter
- evidence count
- confidence
- estimated commercial value range
- actions ready
- actions requiring Umer
- failures and stale research

Every summary must link back to the dossier.

## 10. Human sales handoff

For V1, Umer remains the human sales owner.

The system prepares:

- prospect summary
- problem/evidence summary
- recommended solution
- competitor context
- suggested price range
- personalized outreach draft
- likely objections
- suggested discovery questions

Actual sales conversations and important commercial commitments remain human-controlled.

## First implementation slice

Build in this order:

1. Domain types for Business, Source, Evidence, Problem, Opportunity, Competitor, Solution Proposal, Outreach Package.
2. Persistence/repository interfaces.
3. Source/evidence lineage.
4. One discovery adapter abstraction.
5. Business deduplication.
6. Research case orchestration.
7. Opportunity scoring service.
8. Markdown dossier renderer.
9. Morning report renderer.
10. Tests for scoring, lineage, deduplication, and dossier completeness.

Do not build autonomous outbound sending or autonomous coding until this slice produces trustworthy dossiers from real research.
