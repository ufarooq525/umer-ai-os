# Release Template

> The packaged output of one or more completed [Epics](Epic.md)/[Sprints](Sprint.md), ready for the Deployment stage of `Core/WORKFLOW_STANDARD.md`. A release is not "the code that happens to be on main" — it is a deliberate, reviewed package with a rollback plan.

```markdown
# Release: <version/name>

## Metadata
- Project: <link to Projects/<name>/>
- Target date: YYYY-MM-DD
- Status: Planned | Staged | Shipped | Rolled Back

## Contents
| Epic/Sprint | Summary | Owner |
|---|---|---|
| | | |

## Quality Gate Sign-off (Core/QUALITY_STANDARD.md)
| Gate | Status | Evidence |
|---|---|---|
| Security | Pass/Fail/N/A | |
| Performance | Pass/Fail/N/A | |
| Accessibility | Pass/Fail/N/A | |
| SEO | Pass/Fail/N/A | |
| Maintainability | Pass/Fail/N/A | |
| Testing | Pass/Fail/N/A | |
| Documentation | Pass/Fail/N/A | |
| Scalability | Pass/Fail/N/A | |
| Business Value | Pass/Fail/N/A | |

## Rollback Plan
What happens if this release needs to be reverted, and who owns executing it.

## Deployment Notes
Handoff to Deployment stage per Core/WORKFLOW_STANDARD.md — environment, sequencing, any manual steps.

## Post-Release
- Analytics handoff: <what's being measured, baseline, link to Departments/Analytics/>
- Known follow-ups deferred to next cycle: <list, with rationale, per Core/DECISION_FRAMEWORK.md>

## Sign-off
- Project Manager: 
- CEO (business value + go/no-go): 
- Chief of Staff (documentation + standards check): 
```
