# Task Template

> The smallest trackable unit of work. Every task belongs to an [Epic](Epic.md) and is scheduled into a [Sprint](Sprint.md). A task without acceptance criteria is not schedulable — see `PROJECT_MANAGER_AGENT.md` Decision Rules.

```markdown
# Task: <short, action-oriented title>

## Metadata
- ID: <PROJECT-EPIC-###>
- Epic: <link to Epic.md instance>
- Sprint: <link to Sprint.md instance, or "Backlog">
- Owner: <Department / Agent>
- Status: Not Started | In Progress | Blocked | In Review | Done
- Priority: P0 | P1 | P2 | P3
- Estimate: <size/points/hours>

## Description
What needs to be done and why, in one or two sentences. Link back to the Epic's goal — a task with no traceable reason to exist is a scope error, not a task.

## Acceptance Criteria
- [ ] <specific, checkable condition>
- [ ] <specific, checkable condition>
- [ ] Applicable Core/QUALITY_STANDARD.md gates satisfied: <list which — Security, Testing, etc.>

## Dependencies
- Blocked by: <task/epic ID, or "none">
- Blocks: <task/epic ID, or "none">

## Risk Notes
<Only if non-trivial — otherwise "none identified">

## Handoff
- Next owner on completion: <Department/Agent, per Core/WORKFLOW_STANDARD.md>
- Artifacts produced: <file paths / links>
```
