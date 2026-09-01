# Opportunity Intelligence Context

## Purpose

Opportunity Intelligence continuously identifies businesses, market signals, and recurring problems that may create commercially valuable work or products for Umer.

## Scope

This context owns:

- business/prospect discovery
- market signals
- digital presence analysis
- problem/opportunity identification
- evidence-backed opportunity scoring
- solution opportunity recommendations
- transition into Revenue Acquisition or Product Management

It does not own outbound sending, sales negotiation, software delivery, payments, or legal commitments.

## Core entities

- **Signal** — an observed market or business fact that may indicate change or need.
- **Business Prospect** — a business discovered as a possible customer.
- **Business Audit** — structured observations about a prospect's public digital/business presence.
- **Problem** — a customer/business issue supported by evidence.
- **Opportunity** — a commercially relevant problem/solution hypothesis.
- **Evidence Record** — source-backed support for a claim.
- **Opportunity Score** — structured assessment of commercial attractiveness and confidence.
- **Solution Brief** — proposed outcome, scope, approach, and estimated value.
- **Opportunity Dossier** — complete research package and lineage.

## Decision rule

The system must not equate a missing website with an automatic sales opportunity. It should evaluate business activity, problem severity, likely value, ability to pay, competition, reachability, solution fit, confidence, and evidence quality.

## Preferred discovery signals

- active business with weak/no website
- strong reviews but weak conversion infrastructure
- outdated or broken website
- poor mobile experience
- missing booking/order/quote functionality
- visible manual workflow or operational friction
- missing integrations
- repeated customer complaints
- underserved market segment
- repeated problem across multiple businesses
- emerging market/category signals

## Outcome

Every investigated opportunity ends in one of:

- `REJECTED`
- `WATCH`
- `RESEARCH_MORE`
- `OUTREACH_READY`
- `PRODUCT_CANDIDATE`
- `CONVERTED_TO_PROJECT`

The reason and evidence for the outcome must be preserved.
