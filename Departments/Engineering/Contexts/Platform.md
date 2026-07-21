# Bounded Context: Platform

Governed by `Departments/Engineering/ENGINEERING_CHARTER.md`.

## Purpose

Provide the shared runtime, environment, and golden-path substrate multiple Services build on. Absorbs classical “Infrastructure” ownership so Infra/Platform/DevOps do not thrash as three orgs.

## Owns

Platform Standards, Environment/Runtime Models, shared deployment substrate contracts, golden paths and exception process.

## Does Not Own

Product feature delivery (Application Delivery); release go/no-go (Release Engineering + gates/QA); enterprise workplace IT (future Operations/IT); security control frameworks (Security).

## Interfaces

Enables Application Delivery and Release Engineering; Constrained by Security; referenced by Solution Architecture Reference Architectures.

## Primary Artifacts

Platform Standard, Environment/Runtime Model.

## Anti-Patterns

Ivory-tower Platform nobody adopts; rebranding as “DevOps team”; bypass channels that skip golden paths without exception records.

## Metadata

```yaml
version: 1.0.0
status: active
last_reviewed: 2026-07-22
owner: Engineering / Platform
```
