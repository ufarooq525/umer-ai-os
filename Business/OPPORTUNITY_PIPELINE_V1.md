# Opportunity Pipeline V1

## Purpose

Turn global economic signals into traceable commercial opportunities without assuming the answer is always a website, a lead, or a SaaS product.

## Runtime flow

```text
Niche / autonomous search strategy
        ↓
Discovery adapter
        ↓
Candidate normalization + quota
        ↓
Research adapter
        ↓
Evidence records
        ↓
Problem detector
        ↓
Opportunity builder
        ↓
Commercial scoring
        ↓
Dossier / experiment
        ↓
CEO review or bounded action
```

## Hard rules

1. External adapters provide evidence; the domain layer does not scrape or assume a specific provider.
2. Every opportunity must carry evidence references.
3. Research is bounded by the niche quota and research depth.
4. A failed candidate must not abort the entire run.
5. Low-confidence evidence can block outreach even when the theoretical score is high.
6. The system must be able to reject an opportunity and stop spending research resources.
7. Autonomous outbound communication is not part of this V1 slice; commercial outreach remains approval-gated.

## Why this matters

The first useful milestone is not an autonomous salesperson. It is a trustworthy intelligence loop where Umer can open a recommendation and trace it back to the businesses, observations, sources, evidence, detected problem, economics and reasoning that produced it.

## Next integrations

- public web/search discovery adapter
- business-page and directory discovery
- job-posting signal adapter
- public-review signal adapter
- evidence persistence
- business audit persistence
- dossier generator
- CEO morning report
- experiment tracker
- outcome/learning feedback
